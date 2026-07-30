import { html, LitElement, type TemplateResult, unsafeCSS } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';

import {
  type AspectRatioOption,
  aspectRatioKey,
  aspectRatioSvg,
  type AspectRatioValue,
  aspectRatioValueEquals,
  isConcreteRatio,
} from '../../../entities/aspect-ratio';
import { ICON_ASPECT_AUTO } from '../../../shared/ui/icons';
import styles from './aspect-ratio.css?inline';

export type AspectRatioSelectDetail = { value: AspectRatioValue };

type PopoverElement = HTMLElement & { showPopover: () => void; hidePopover: () => void };

@customElement('uc-ai-aspect-ratio')
export class UcAiAspectRatio extends LitElement {
  public static override styles = unsafeCSS(styles);

  @property({ attribute: false })
  public options: AspectRatioOption[] = [];

  @property({ attribute: false })
  public selected: AspectRatioValue | null = null;

  @property({ type: Boolean })
  public busy = false;

  /**
   * Accessible label for the trigger. A plain property (not the inherited
   * `ariaLabel`) so it doesn't also stamp `aria-label` on the host element.
   */
  @property({ attribute: 'aria-label-text' })
  public labelText: string | null = null;

  @property({ attribute: false })
  public labelFor: (option: AspectRatioOption) => string = (o) =>
    isConcreteRatio(o.value) ? aspectRatioKey(o.value) : '';

  @state()
  public open = false;

  @query('.popover')
  private _popover?: PopoverElement;

  private _onToggle = (e: Event): void => {
    if ((e as ToggleEvent).newState === 'closed' && this.open) {
      this.open = false;
    }
  };

  private _setOpen(next: boolean): void {
    this.open = next;
    const pop = this._popover;
    if (!pop) return;
    const isOpen = pop.matches(':popover-open');
    if (next && !isOpen) pop.showPopover();
    else if (!next && isOpen) pop.hidePopover();
  }

  private _toggle(): void {
    this._setOpen(!this.open);
  }

  private _select(value: AspectRatioValue): void {
    this.dispatchEvent(
      new CustomEvent<AspectRatioSelectDetail>('uc:select', {
        detail: { value },
        bubbles: true,
        composed: true,
      }),
    );
    this._setOpen(false);
  }

  /** Icon for a selection: the ratio's shape, or the generic "Auto" square glyph. */
  private _iconFor(value: AspectRatioValue): string {
    return isConcreteRatio(value) ? aspectRatioSvg(value) : ICON_ASPECT_AUTO;
  }

  private _triggerLabel(): string {
    const sel = this.selected;
    if (!sel) return '';
    if (isConcreteRatio(sel)) return aspectRatioKey(sel);
    // For "Auto", reuse the matching option's human label.
    const option = this.options.find((o) => o.value === sel);
    return option ? this.labelFor(option) : '';
  }

  public override render(): TemplateResult {
    const triggerLabel = this._triggerLabel();

    return html`
      <button
        type="button"
        class="trigger"
        aria-haspopup="listbox"
        aria-expanded="${this.open ? 'true' : 'false'}"
        aria-label="${this.labelText ?? 'Aspect ratio'}"
        ?disabled=${this.busy}
        @click=${this._toggle}
      >
        ${this.selected ? unsafeSVG(this._iconFor(this.selected)) : null}
        ${triggerLabel ? html`<span class="trigger-label">${triggerLabel}</span>` : null}
      </button>
      <div class="popover" popover="auto" role="listbox" @toggle=${this._onToggle}>
        <div class="popover-inner">
          ${this.options.map((option) => {
            const isSelected = this.selected ? aspectRatioValueEquals(option.value, this.selected) : false;
            return html`
              <button
                type="button"
                class="option"
                role="option"
                aria-selected="${isSelected ? 'true' : 'false'}"
                @click=${() => this._select(option.value)}
              >
                ${unsafeSVG(this._iconFor(option.value))}
                <span class="option-ratio">${isConcreteRatio(option.value) ? aspectRatioKey(option.value) : ''}</span>
                <span class="option-label">${this.labelFor(option)}</span>
              </button>
            `;
          })}
        </div>
      </div>
    `;
  }
}
