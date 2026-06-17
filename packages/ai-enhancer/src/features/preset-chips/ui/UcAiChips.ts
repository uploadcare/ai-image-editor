import { html, LitElement, type TemplateResult, unsafeCSS } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

import { type AiEditorMode, type AiPreset, MODES } from '../../../entities/mode';
import styles from './chips.css?inline';

export type PresetSelectDetail = { preset: AiPreset };

@customElement('uc-ai-chips')
export class UcAiChips extends LitElement {
  public static override styles = unsafeCSS(styles);

  @property()
  public mode: AiEditorMode = 'generate';

  /**
   * Quick-prompt presets to render. When unset (`null`), falls back to the
   * built-in set for the active {@link mode}. An empty array renders no chips.
   */
  @property({ attribute: false })
  public presets: AiPreset[] | null = null;

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
    // The preset set changes with the mode, so re-measure after each render.
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

  private _select(preset: AiPreset): void {
    this.dispatchEvent(
      new CustomEvent<PresetSelectDetail>('uc:select', { detail: { preset }, bubbles: true, composed: true }),
    );
  }

  public override render(): TemplateResult {
    const presets: AiPreset[] = this.presets ?? MODES[this.mode].presets;

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
        ${presets.map(
          (preset) => html`
            <button type="button" class="chip" @click=${() => this._select(preset)} ?disabled=${this.busy}>
              ${preset.label}
            </button>
          `,
        )}
      </div>
    `;
  }
}
