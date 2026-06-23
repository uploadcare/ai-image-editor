import { html, LitElement, nothing, type PropertyValues, type TemplateResult, unsafeCSS } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';

import { ICON_FULLSCREEN, ICON_FULLSCREEN_EXIT } from '../icons';
import styles from './canvas.css?inline';
import { DotGridController } from './DotGridController';

/** Frame aspect ratio used until an image's natural ratio is known. */
const DEFAULT_RATIO = 3 / 2;

/** A switch that loads within this window is treated as instant — no dot
 *  transition — so cached/quick history swaps swap directly instead of flashing. */
const COVER_DELAY_MS = 70;

@customElement('uc-ai-canvas')
export class UcAiCanvas extends LitElement {
  public static override styles = unsafeCSS(styles);

  /** The image to display. The canvas preloads it before swapping it in. */
  @property()
  public url: string | null = null;

  /**
   * Aspect ratio (`width / height`) the frame is sized to. A concrete number
   * pins the frame; `null` falls back to {@link naturalRatio}, then to the
   * displayed image's natural ratio.
   */
  @property({ type: Number })
  public ratio: number | null = null;

  /**
   * Best-known intrinsic ratio (`width / height`) of the image at {@link url},
   * supplied from metadata ahead of decode. Used when no concrete {@link ratio}
   * pins the frame, so the frame is sized correctly from the first paint instead
   * of defaulting to landscape and snapping once the image loads. `null` when
   * unknown — the frame then falls back to the decoded image's natural size.
   */
  @property({ type: Number, attribute: 'natural-ratio' })
  public naturalRatio: number | null = null;

  @property({ type: Boolean })
  public busy = false;

  @property()
  public alt = '';

  @property({ attribute: 'busy-label' })
  public busyLabel = '';

  /** Message shown when the image fails to load. */
  @property({ attribute: 'error-label' })
  public errorLabel = '';

  @property({ attribute: 'fullscreen-label' })
  public fullscreenLabel = '';

  @property({ attribute: 'exit-fullscreen-label' })
  public exitFullscreenLabel = '';

  /**
   * Full-quality rendition shown while fullscreen (the regular `url` is a
   * downscaled CDN preview). Preloaded eagerly when the user hovers the
   * fullscreen button, so it is usually cached by the time it is needed.
   */
  @property({ attribute: 'fullsize-url' })
  public fullsizeUrl: string | null = null;

  /** The image currently shown — only updated once a new `url` has loaded. */
  @state()
  private _displayedUrl: string | null = null;

  /** Previous image kept painted under the new one during an instant swap. */
  @state()
  private _fadingUrl: string | null = null;

  @state()
  private _failed = false;

  /** True after the first layout — gates the frame's resize transition so the
   *  initial size snaps in (no intro animation on the idle grid). */
  @state()
  private _frameReady = false;

  /** Mirrors whether the canvas is the current fullscreen element. */
  @state()
  private _fullscreen = false;

  @query('.canvas')
  private _canvasEl?: HTMLElement;

  @query('.canvas__viewport')
  private _viewportEl?: HTMLElement;

  @query('.canvas__frame')
  private _frameEl?: HTMLElement;

  @query('.canvas__image')
  private _imageEl?: HTMLImageElement | null;

  @query('.dot-grid')
  private _dotGridEl?: HTMLCanvasElement;

  private readonly _dotGrid = new DotGridController(this);
  private _resizeObserver?: ResizeObserver;

  /** A plain image switch is covering the frame with dots (vs. an instant swap). */
  private _switchCovering = false;
  private _coverTimer?: number;
  /** URLs already displayed once — switching back to one is an instant swap. */
  private readonly _seenUrls = new Set<string>();
  /** The pending swap is instant (no dot transition), so double-buffer it. */
  private _instantSwap = false;

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._resizeObserver?.disconnect();
    this._clearCoverTimer();
    document.removeEventListener('keydown', this._onFullscreenKeydown, true);
  }

  protected override firstUpdated(): void {
    const surface = this._dotGridEl;
    const viewport = this._viewportEl;
    const frame = this._frameEl;
    if (surface && viewport && frame) {
      this._dotGrid.attach({ surface, viewport, frame, getImage: () => this._imageEl ?? null });
    }
    if (typeof ResizeObserver === 'function' && viewport) {
      this._resizeObserver = new ResizeObserver(() => this._updateFrame());
      this._resizeObserver.observe(viewport);
    }
    this._updateFrame();
    // Enable the frame's resize transition only after the initial size is
    // painted, so it snaps in instead of animating from zero on load.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this._frameReady = true;
      });
    });
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has('url')) return;
    if (!this.url) {
      this._displayedUrl = null;
      this._failed = false;
    } else if (this.url !== this._displayedUrl) {
      this._failed = false;
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    // `keyof this` omits private @state, so reach the key through an untyped view.
    const displayedChanged = (changed as Map<string, unknown>).has('_displayedUrl');
    if (changed.has('ratio') || changed.has('naturalRatio') || displayedChanged) this._updateFrame();
    if (changed.has('busy') || changed.has('url') || displayedChanged) {
      this._updateSwitchCover(changed.has('busy'));
      this._syncGrid();
    }
  }

  private _syncGrid(): void {
    this._dotGrid.sync({
      // The grid covers during a generation (`busy`) and during a slow image
      // switch (`_switchCovering`), then materialises the result out of the dots.
      shimmering: this.busy || this._switchCovering,
      empty: this._displayedUrl == null,
      // Only a real generation wanders the epicenters; switches/reveals are a
      // uniform, ring-free growth.
      generating: this.busy,
    });
  }

  /**
   * Gate the dot transition for a plain history/source switch: only cover with
   * dots if the new image is still loading after a short delay. A cached/instant
   * switch skips the transition and swaps directly (no glitchy dot flash).
   * Generations drive their own cover via `busy`, so they're left untouched.
   */
  private _updateSwitchCover(busyChanged: boolean): void {
    const transitioning = this.url != null && this.url !== this._displayedUrl && !this._failed;
    if (!transitioning) {
      // Settled (loaded) or cleared — stop covering.
      this._clearCoverTimer();
      this._switchCovering = false;
      return;
    }
    // A generation (busy, or busy just toggled) owns the cover; don't gate it.
    if (this.busy || busyChanged) {
      this._clearCoverTimer();
      this._instantSwap = false;
      return;
    }
    // Switching back to an already-displayed (cached) image: swap directly, no
    // dot transition — only genuinely new images materialise out of the grid. The
    // double-buffer (see _onLoaded) keeps the frame from blanking for a frame.
    if (this.url != null && this._seenUrls.has(this.url)) {
      this._clearCoverTimer();
      this._switchCovering = false;
      this._instantSwap = true;
      return;
    }
    this._instantSwap = false;
    // A plain switch started while idle — arm the instant-load gate once.
    if (this._switchCovering || this._coverTimer != null) return;
    this._coverTimer = window.setTimeout(() => {
      this._coverTimer = undefined;
      const stillLoading = this.url != null && this.url !== this._displayedUrl && !this._failed;
      if (stillLoading && !this.busy && !this._switchCovering) {
        this._switchCovering = true;
        this._syncGrid();
      }
    }, COVER_DELAY_MS);
  }

  private _clearCoverTimer(): void {
    if (this._coverTimer != null) {
      clearTimeout(this._coverTimer);
      this._coverTimer = undefined;
    }
  }

  /** Reset the dot grid to its empty state — used when the editor starts over. */
  public resetGrid(): void {
    this._dotGrid.reset();
  }

  private _frameRatioValue(): number {
    // Precedence: a pinned ratio, then the metadata hint (known before decode),
    // then the decoded image's own dimensions, then the landscape default.
    if (this.ratio && this.ratio > 0) return this.ratio;
    if (this.naturalRatio && this.naturalRatio > 0) return this.naturalRatio;
    const img = this._imageEl;
    if (img && img.naturalWidth > 0 && img.naturalHeight > 0) return img.naturalWidth / img.naturalHeight;
    return DEFAULT_RATIO;
  }

  /** Size the frame to the largest box of the chosen ratio that fits the viewport. */
  private _updateFrame(): void {
    const viewport = this._viewportEl;
    const frame = this._frameEl;
    if (!viewport || !frame) return;
    const aw = viewport.clientWidth;
    const ah = viewport.clientHeight;
    if (!aw || !ah) return;
    const ratio = this._frameRatioValue();
    let w: number;
    let h: number;
    if (aw / ah > ratio) {
      h = ah;
      w = h * ratio;
    } else {
      w = aw;
      h = w / ratio;
    }
    frame.style.width = `${Math.round(w)}px`;
    frame.style.height = `${Math.round(h)}px`;
  }

  private _onLoaded(e: Event): void {
    const loaded = (e.currentTarget as HTMLImageElement).getAttribute('src');
    // Ignore a stale preload that resolved after `url` moved on.
    if (!loaded || loaded !== this.url) return;
    // For an instant swap, hold the outgoing image underneath until the new one
    // paints (its `@load`), so the single <img>'s src-swap can't blank a frame.
    const prev = this._displayedUrl;
    if (this._instantSwap && prev && prev !== loaded) this._fadingUrl = prev;
    this._displayedUrl = loaded;
    this._failed = false;
    // Remember it: switching back to an already-shown image swaps directly,
    // with no dot transition (see _updateSwitchCover).
    this._seenUrls.add(loaded);
  }

  /**
   * The on-screen image finished decoding. Driving the reveal off the displayed
   * <img>'s own `load` (rather than the preload's `complete` at a microtask)
   * makes the dot-grid reveal fire reliably, even on a cold cache.
   */
  private _onDisplayedLoad(): void {
    // The new image has painted — drop the under-layer it was covering.
    this._fadingUrl = null;
    // Re-size the frame now that the image's natural dimensions are known. This
    // is the safety net for when no ratio is pinned and no `naturalRatio` hint
    // was supplied (e.g. a standalone uuid before its info fetch resolves):
    // without it a portrait image stays cropped in the landscape default until
    // an unrelated resize fires.
    this._updateFrame();
    this._dotGrid.onImageLoad();
  }

  private _onError(): void {
    this._failed = true;
    this.dispatchEvent(new CustomEvent('uc:image-error', { detail: { url: this.url }, bubbles: true, composed: true }));
  }

  /** Fullscreen is unavailable on some platforms (e.g. iPhone Safari). */
  private get _fullscreenSupported(): boolean {
    return document.fullscreenEnabled && typeof this._canvasEl?.requestFullscreen === 'function';
  }

  private _preloadedFullsizeUrl: string | null = null;

  /** Warm the browser cache for the fullscreen rendition ahead of the click. */
  private _preloadFullsize(): void {
    if (!this.fullsizeUrl || this.fullsizeUrl === this._preloadedFullsizeUrl) return;
    this._preloadedFullsizeUrl = this.fullsizeUrl;
    new Image().src = this.fullsizeUrl;
  }

  private _toggleFullscreen(): void {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void this._canvasEl?.requestFullscreen();
    }
  }

  private _onFullscreenChange(): void {
    this._fullscreen = document.fullscreenElement != null;
    if (this._fullscreen) {
      document.addEventListener('keydown', this._onFullscreenKeydown, true);
    } else {
      document.removeEventListener('keydown', this._onFullscreenKeydown, true);
    }
  }

  private _onFullscreenKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && document.fullscreenElement) {
      e.preventDefault();
      e.stopPropagation();
      void document.exitFullscreen();
    }
  };

  public override render(): TemplateResult {
    const preloading = this.url != null && this.url !== this._displayedUrl && !this._failed;
    const isEmpty = this._displayedUrl == null;
    const showFullscreenBtn = !isEmpty && !this._failed && this._fullscreenSupported;

    const canvasClasses = {
      canvas: true,
      'is-empty': isEmpty,
      'is-loading': this.busy,
      'is-ready': this._frameReady,
    };

    return html`
      <div class=${classMap(canvasClasses)} @fullscreenchange=${this._onFullscreenChange}>
        <div class="canvas__bg"></div>

        <div class="canvas__viewport">
          <div class="canvas__frame">
            ${
              // Previous image held underneath during an instant (cached) swap so
              // the frame never blanks for the frame it takes the new <img> to
              // paint; dropped on the new image's load.
              this._fadingUrl
                ? html`<img class="canvas__under" src="${this._fadingUrl}" alt="" aria-hidden="true" crossorigin="anonymous" />`
                : nothing
            }
            ${
              this._displayedUrl
                ? html`<img
                    class="canvas__image"
                    src="${this._displayedUrl}"
                    alt="${this.alt || 'AI image'}"
                    decoding="async"
                    crossorigin="anonymous"
                    @load=${this._onDisplayedLoad}
                  />`
                : nothing
            }
          </div>
          <canvas class="dot-grid" aria-hidden="true"></canvas>
        </div>

        ${
          // Full-quality rendition overlays the preview while fullscreen.
          this._fullscreen && this.fullsizeUrl
            ? html`<img class="layer full" src="${this.fullsizeUrl}" alt="${this.alt || 'AI image'}" decoding="async" />`
            : nothing
        }
        ${
          preloading
            ? html`<img
                class="preload"
                src="${this.url}"
                alt=""
                aria-hidden="true"
                decoding="async"
                crossorigin="anonymous"
                @load=${this._onLoaded}
                @error=${this._onError}
              />`
            : nothing
        }
        ${
          this._failed
            ? html`<div class="error-state" role="alert">${this.errorLabel || 'Failed to load image'}</div>`
            : nothing
        }
        ${
          showFullscreenBtn
            ? html`
              <button
                type="button"
                class="fullscreen-btn"
                data-testid="fullscreen-btn"
                aria-label="${this._fullscreen ? this.exitFullscreenLabel : this.fullscreenLabel}"
                @mouseenter=${this._preloadFullsize}
                @focus=${this._preloadFullsize}
                @click=${this._toggleFullscreen}
              >
                ${unsafeSVG(this._fullscreen ? ICON_FULLSCREEN_EXIT : ICON_FULLSCREEN)}
              </button>
            `
            : nothing
        }
        <span class="sr-only" role="status" aria-live="polite">${this.busy ? this.busyLabel : ''}</span>
      </div>
    `;
  }
}
