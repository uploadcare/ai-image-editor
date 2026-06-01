import { html, LitElement, nothing, type PropertyValues, type TemplateResult, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import styles from './canvas.css?inline';

/** `document.startViewTransition` is not in every engine's lib types yet. */
type ViewTransitionDocument = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => unknown;
};

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

  /** The image currently shown — only updated once a new `url` has loaded. */
  @state()
  private _displayedUrl: string | null = null;

  /** A new `url` is being preloaded (kept up alongside `busy`). */
  @state()
  private _loading = false;

  @state()
  private _failed = false;

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has('url')) return;

    if (!this.url) {
      this._displayedUrl = null;
      this._loading = false;
      this._failed = false;
    } else if (this.url !== this._displayedUrl) {
      // A fresh target: preload it (a hidden <img> renders for it) before swap.
      this._loading = true;
      this._failed = false;
    }
  }

  private _onLoaded(): void {
    const loaded = this.url;
    const commit = (): void => {
      this._displayedUrl = loaded;
      this._loading = false;
    };

    const doc = document as ViewTransitionDocument;
    if (typeof doc.startViewTransition === 'function') {
      doc.startViewTransition(async () => {
        commit();
        await this.updateComplete;
      });
    } else {
      commit();
    }
  }

  private _onError(): void {
    this._failed = true;
    this._loading = false;
    this.dispatchEvent(new CustomEvent('uc:image-error', { detail: { url: this.url }, bubbles: true, composed: true }));
  }

  public override render(): TemplateResult {
    const preloading = this.url != null && this.url !== this._displayedUrl && !this._failed;

    return html`
      <div class="canvas" data-state="${this.url ? 'filled' : 'empty'}">
        ${this._displayedUrl ? html`<img class="shown" src="${this._displayedUrl}" alt="${this.alt || 'AI image'}" />` : nothing}
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
          this._loading || this.busy
            ? html`<div class="busy-overlay"><div class="spinner" role="progressbar" aria-label="${this.busyLabel}"></div></div>`
            : nothing
        }
      </div>
    `;
  }
}
