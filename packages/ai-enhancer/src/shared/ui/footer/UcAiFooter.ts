import { html, LitElement, type TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import styles from './footer.css?inline';

/**
 * The editor's action bar: a ghost "Cancel" on the left and a primary "Done"
 * on the right. "Done" commits the current generation result and is disabled
 * until one exists. ("Start over" lives in the history strip, not here.)
 */
@customElement('uc-ai-footer')
export class UcAiFooter extends LitElement {
  public static override styles = unsafeCSS(styles);

  @property({ attribute: 'cancel-label' })
  public cancelLabel = '';

  @property({ attribute: 'primary-label' })
  public primaryLabel = '';

  @property({ type: Boolean, attribute: 'primary-disabled' })
  public primaryDisabled = false;

  private _emitCancel(): void {
    this.dispatchEvent(new CustomEvent('uc:cancel', { bubbles: true, composed: true }));
  }

  private _emitPrimary(): void {
    this.dispatchEvent(new CustomEvent('uc:primary', { bubbles: true, composed: true }));
  }

  public override render(): TemplateResult {
    return html`
      <div class="footer">
        <button type="button" class="btn btn--ghost" @click=${this._emitCancel}>
          <span>${this.cancelLabel}</span>
        </button>
        <button
          type="button"
          class="btn btn--primary"
          @click=${this._emitPrimary}
          ?disabled=${this.primaryDisabled}
        >
          <span>${this.primaryLabel}</span>
        </button>
      </div>
    `;
  }
}
