import { html, LitElement, nothing, type TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import styles from './footer.css?inline';

@customElement('uc-ai-footer')
export class UcAiFooter extends LitElement {
  public static override styles = unsafeCSS(styles);

  @property({ attribute: 'cancel-label' })
  public cancelLabel = '';

  @property({ attribute: 'primary-label' })
  public primaryLabel = '';

  @property({ type: Boolean, attribute: 'primary-disabled' })
  public primaryDisabled = false;

  @property({ attribute: 'start-over-label' })
  public startOverLabel = '';

  @property({ type: Boolean, attribute: 'show-start-over' })
  public showStartOver = false;

  private _emitCancel(): void {
    this.dispatchEvent(new CustomEvent('uc:cancel', { bubbles: true, composed: true }));
  }

  private _emitPrimary(): void {
    this.dispatchEvent(new CustomEvent('uc:primary', { bubbles: true, composed: true }));
  }

  private _emitStartOver(): void {
    this.dispatchEvent(new CustomEvent('uc:start-over', { bubbles: true, composed: true }));
  }

  public override render(): TemplateResult {
    return html`
      <div class="footer">
        <button type="button" class="btn" @click=${this._emitCancel}>
          <span>${this.cancelLabel}</span>
        </button>
        <div class="actions">
          ${
            this.showStartOver
              ? html`
                <button type="button" class="btn" @click=${this._emitStartOver}>
                  <span>${this.startOverLabel}</span>
                </button>
              `
              : nothing
          }
          <button type="button" class="btn btn--primary" @click=${this._emitPrimary} ?disabled=${this.primaryDisabled}>
            <span>${this.primaryLabel}</span>
          </button>
        </div>
      </div>
    `;
  }
}
