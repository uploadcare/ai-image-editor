import { html, LitElement, type TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { type AiEditorMode, type AiTemplate, MODES } from '../../../entities/mode';
import styles from './chips.css?inline';

export type TemplateSelectDetail = { template: AiTemplate };

@customElement('uc-ai-chips')
export class UcAiChips extends LitElement {
  public static override styles = unsafeCSS(styles);

  @property()
  public mode: AiEditorMode = 'generate';

  @property()
  public prompt = '';

  @property({ type: Boolean })
  public busy = false;

  @property({ attribute: 'aria-label-text' })
  public override ariaLabel: string | null = 'Quick prompts';

  private _select(template: AiTemplate): void {
    this.dispatchEvent(
      new CustomEvent<TemplateSelectDetail>('uc:select', { detail: { template }, bubbles: true, composed: true }),
    );
  }

  public override render(): TemplateResult {
    const templates: AiTemplate[] = MODES[this.mode].templates;

    return html`
      <div class="row" role="toolbar" aria-label="${this.ariaLabel ?? ''}">
        ${templates.map(
          (tpl) => html`
            <button
              type="button"
              class="chip"
              aria-pressed="${this.prompt === tpl.prompt}"
              @click=${() => this._select(tpl)}
              ?disabled=${this.busy}
            >
              ${tpl.label}
            </button>
          `,
        )}
      </div>
    `;
  }
}
