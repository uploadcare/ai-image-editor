import { html, LitElement, nothing, type PropertyValues, type TemplateResult, unsafeCSS } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';

import { ICON_FULLSCREEN, ICON_FULLSCREEN_EXIT } from '../icons';
import styles from './canvas.css?inline';

@customElement('uc-ai-canvas')
export class UcAiCanvas extends LitElement {
  public static override styles = unsafeCSS(styles);

  /** The image to display. The canvas preloads it before swapping it in. */
  @property()
  public url: string | null = null;

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

  /** The outgoing image, kept underneath until the new one finishes fading in. */
  @state()
  private _previousUrl: string | null = null;

  /** A new `url` is being preloaded (kept up alongside `busy`). */
  @state()
  private _loading = false;

  @state()
  private _failed = false;

  /** Mirrors whether the canvas is the current fullscreen element. */
  @state()
  private _fullscreen = false;

  @query('.canvas')
  private _canvasEl?: HTMLElement;

  /**
   * Safety net for dropping the outgoing layer: the cross-fade normally clears
   * it on `animationend`, but that never fires when the fade is disabled
   * (`prefers-reduced-motion`) or interrupted — which would leave the old image
   * stranded underneath the new one.
   */
  private _dropPreviousTimer?: ReturnType<typeof setTimeout>;

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this._dropPreviousTimer);
    document.removeEventListener('keydown', this._onFullscreenKeydown, true);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has('url')) return;

    if (!this.url) {
      this._displayedUrl = null;
      this._previousUrl = null;
      this._loading = false;
      this._failed = false;
    } else if (this.url !== this._displayedUrl) {
      // A fresh target: preload it (a hidden <img> renders for it) before swap.
      this._loading = true;
      this._failed = false;
    }
  }

  private _onLoaded(e: Event): void {
    const loaded = (e.currentTarget as HTMLImageElement).getAttribute('src');
    // Ignore a stale preload that resolved after `url` moved on.
    if (!loaded || loaded !== this.url) return;
    if (loaded !== this._displayedUrl) {
      // Keep the outgoing image underneath for the cross-fade — but not when
      // motion is reduced, since there's no fade (and so no `animationend`) to
      // clear it afterwards.
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      this._previousUrl = reducedMotion ? null : this._displayedUrl;
      if (this._previousUrl) this._scheduleDropPrevious();
    }
    this._displayedUrl = loaded;
    this._loading = false;
  }

  /** Guarantee the outgoing layer is dropped even if `animationend` never fires. */
  private _scheduleDropPrevious(): void {
    clearTimeout(this._dropPreviousTimer);
    this._dropPreviousTimer = setTimeout(() => {
      this._previousUrl = null;
    }, 600);
  }

  private _onFadeEnd(): void {
    // The incoming image is fully opaque now; drop the layer beneath it.
    clearTimeout(this._dropPreviousTimer);
    this._previousUrl = null;
  }

  private _onError(): void {
    this._failed = true;
    this._loading = false;
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
    // While fullscreen, swallow Escape before it reaches an ancestor <dialog>
    // (e.g. the file-uploader modal): the browser exits fullscreen natively,
    // but without this the same keypress would also cancel the dialog.
    if (this._fullscreen) {
      document.addEventListener('keydown', this._onFullscreenKeydown, true);
    } else {
      document.removeEventListener('keydown', this._onFullscreenKeydown, true);
    }
  }

  private _onFullscreenKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && document.fullscreenElement) {
      // preventDefault also suppresses the browser's own Esc handling, so we
      // exit fullscreen ourselves.
      e.preventDefault();
      e.stopPropagation();
      void document.exitFullscreen();
    }
  };

  public override render(): TemplateResult {
    const preloading = this.url != null && this.url !== this._displayedUrl && !this._failed;
    const busyActive = this._loading || this.busy;

    const showFullscreenBtn = this._displayedUrl != null && !this._failed && this._fullscreenSupported;

    return html`
      <div class="canvas" data-state="${this.url ? 'filled' : 'empty'}" @fullscreenchange=${this._onFullscreenChange}>
        ${
          this._previousUrl
            ? html`<img class="layer prev" src="${this._previousUrl}" alt="" aria-hidden="true" />`
            : nothing
        }
        ${
          this._displayedUrl
            ? keyed(
                this._displayedUrl,
                html`<img class="layer shown" src="${this._displayedUrl}" alt="${this.alt || 'AI image'}" @animationend=${this._onFadeEnd} />`,
              )
            : nothing
        }
        ${
          // Full-quality rendition overlays the preview while fullscreen; the
          // preview stays underneath so there is no flash while it loads.
          this._fullscreen && this.fullsizeUrl
            ? html`<img class="layer full" src="${this.fullsizeUrl}" alt="${this.alt || 'AI image'}" />`
            : nothing
        }
        ${
          preloading
            ? html`<img class="preload" src="${this.url}" alt="" aria-hidden="true" @load=${this._onLoaded} @error=${this._onError} />`
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
        <div class="busy-overlay ${busyActive ? 'busy-overlay--active' : ''}" aria-hidden="${!busyActive}">
          <div class="spinner" role="progressbar" aria-label="${this.busyLabel}"></div>
        </div>
      </div>
    `;
  }
}
