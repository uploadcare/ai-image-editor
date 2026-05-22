import { html, LitElement, nothing, type TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import styles from './canvas.css?inline';

@customElement('uc-ai-canvas')
export class UcAiCanvas extends LitElement {
  public static override styles = unsafeCSS(styles);

  @property()
  public url: string | null = null;

  @property({ type: Boolean })
  public busy = false;

  @property()
  public alt = '';

  @property({ attribute: 'busy-label' })
  public busyLabel = '';

  public override render(): TemplateResult {
    return html`
      <div class="canvas" data-state="${this.url ? 'filled' : 'empty'}">
        ${this.url ? html`<img src="${this.url}" alt="${this.alt || 'AI image'}" />` : nothing}
        ${
          this.busy
            ? html`<div class="busy-overlay"><div class="spinner" role="progressbar" aria-label="${this.busyLabel}"></div></div>`
            : nothing
        }
      </div>
    `;
  }
}

