import { html, LitElement, type TemplateResult, unsafeCSS } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

import { type AiEditorMode, type AiTemplate, MODES } from '../../../entities/mode';
import styles from './chips.css?inline';

export type TemplateSelectDetail = { template: AiTemplate };

@customElement('uc-ai-chips')
export class UcAiChips extends LitElement {
  public static override styles = unsafeCSS(styles);

  @property()
  public mode: AiEditorMode = 'generate';

  @property({ type: Boolean })
  public busy = false;

  /**
   * Accessible label for the toolbar. A plain property (not the inherited
   * `ariaLabel`) so it labels the inner toolbar only — overriding `ariaLabel`
   * would also stamp `aria-label` on the host, double-announcing it.
   */
  @property({ attribute: 'aria-label-text' })
  public labelText = 'Quick prompts';

  @query('.row')
  private _rowEl?: HTMLElement;

  private _resizeObserver?: ResizeObserver;

  protected override firstUpdated(): void {
    if (typeof ResizeObserver === 'function' && this._rowEl) {
      this._resizeObserver = new ResizeObserver(() => this._updateFades());
      this._resizeObserver.observe(this._rowEl);
    }
    this._updateFades();
  }

  protected override updated(): void {
    // The template set changes with the mode, so re-measure after each render.
    this._updateFades();
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._resizeObserver?.disconnect();
  }

  /**
   * Show an edge fade only when there's more content to scroll toward. The fades
   * are toggled imperatively (not via reactive state): they're derived from
   * post-layout measurements and re-checked from `updated()`, so routing them
   * through `@state` would re-schedule an update from within the update cycle.
   */
  private _updateFades(): void {
    const el = this._rowEl;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const x = el.scrollLeft;
    el.classList.toggle('fade-left', x > 1);
    el.classList.toggle('fade-right', x < max - 1);
  }

  /** Let a vertical wheel scroll the chips horizontally when they overflow. */
  private _onWheel(e: WheelEvent): void {
    const el = this._rowEl;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    el.scrollLeft += e.deltaY;
    e.preventDefault();
  }

  private _select(template: AiTemplate): void {
    this.dispatchEvent(
      new CustomEvent<TemplateSelectDetail>('uc:select', { detail: { template }, bubbles: true, composed: true }),
    );
  }

  public override render(): TemplateResult {
    const templates: AiTemplate[] = MODES[this.mode].templates;

    // The fade-left/right classes are managed imperatively in `_updateFades`; a
    // static `class` (not a binding) leaves them untouched across re-renders.
    return html`
      <div
        class="row"
        role="toolbar"
        aria-label="${this.labelText}"
        @scroll=${this._updateFades}
        @wheel=${this._onWheel}
      >
        ${templates.map(
          (tpl) => html`
            <button type="button" class="chip" @click=${() => this._select(tpl)} ?disabled=${this.busy}>
              ${tpl.label}
            </button>
          `,
        )}
      </div>
    `;
  }
}
