import { html, LitElement, nothing, type PropertyValues, type TemplateResult, unsafeCSS } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';

import { ICON_FULLSCREEN, ICON_FULLSCREEN_EXIT } from '../icons';
import styles from './canvas.css?inline';
import { DotGridController } from './DotGridController';

/** Frame aspect ratio used until an image's natural ratio is known. */
const DEFAULT_RATIO = 3 / 2;

@customElement('uc-ai-canvas')
export class UcAiCanvas extends LitElement {
  public static override styles = unsafeCSS(styles);

  /** The image to display. The canvas preloads it before swapping it in. */
  @property()
  public url: string | null = null;

  /**
   * Aspect ratio (`width / height`) the frame is sized to. A concrete number
   * pins the frame; `null` falls back to the displayed image's natural ratio.
   */
  @property({ type: Number })
  public ratio: number | null = null;

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

  @state()
  private _failed = false;

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

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._resizeObserver?.disconnect();
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
    if (changed.has('ratio') || displayedChanged) this._updateFrame();
    if (changed.has('busy') || displayedChanged) {
      this._dotGrid.sync({ shimmering: this.busy, empty: this._displayedUrl == null });
    }
  }

  /** Reset the dot grid to its empty state — used when the editor starts over. */
  public resetGrid(): void {
    this._dotGrid.reset();
  }

  private _frameRatioValue(): number {
    if (this.ratio && this.ratio > 0) return this.ratio;
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
    this._displayedUrl = loaded;
    this._failed = false;
  }

  /**
   * The on-screen image finished decoding. Driving the reveal off the displayed
   * <img>'s own `load` (rather than the preload's `complete` at a microtask)
   * makes the dot-grid reveal fire reliably, even on a cold cache.
   */
  private _onDisplayedLoad(): void {
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

    const canvasClasses = { canvas: true, 'is-empty': isEmpty, 'is-loading': this.busy };

    return html`
      <div class=${classMap(canvasClasses)} @fullscreenchange=${this._onFullscreenChange}>
        <div class="canvas__bg"></div>

        <div class="canvas__viewport">
          <div class="canvas__frame">
            ${
              this._displayedUrl
                ? html`<img
                    class="canvas__image"
                    src="${this._displayedUrl}"
                    alt="${this.alt || 'AI image'}"
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
            ? html`<img class="layer full" src="${this.fullsizeUrl}" alt="${this.alt || 'AI image'}" />`
            : nothing
        }
        ${
          preloading
            ? html`<img
                class="preload"
                src="${this.url}"
                alt=""
                aria-hidden="true"
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
