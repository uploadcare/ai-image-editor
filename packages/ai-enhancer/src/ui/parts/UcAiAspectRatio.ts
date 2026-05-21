import { html, LitElement, type TemplateResult, unsafeCSS } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';

import {
  type AspectRatio,
  aspectRatioEquals,
  aspectRatioKey,
  type AspectRatioOption,
  aspectRatioSvg,
} from '../../aspect-ratio';
import styles from './aspect-ratio.css?inline';

export type AspectRatioSelectDetail = { ratio: AspectRatio };

type PopoverElement = HTMLElement & { showPopover: () => void; hidePopover: () => void };

export class UcAiAspectRatio extends LitElement {
  public static override styles = unsafeCSS(styles);

  @property({ attribute: false })
  public options: AspectRatioOption[] = [];

  @property({ attribute: false })
  public selected: AspectRatio | null = null;

  @property({ type: Boolean })
  public busy = false;

  @property({ attribute: 'aria-label-text' })
  public override ariaLabel: string | null = null;

  @property({ attribute: false })
  public labelFor: (option: AspectRatioOption) => string = (o) => aspectRatioKey(o.ratio);

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

  private _select(ratio: AspectRatio): void {
    this.dispatchEvent(
      new CustomEvent<AspectRatioSelectDetail>('uc:select', {
        detail: { ratio },
        bubbles: true,
        composed: true,
      }),
    );
    this._setOpen(false);
  }

  public override render(): TemplateResult {
    const triggerLabel = this.selected ? aspectRatioKey(this.selected) : '';

    return html`
      <button
        type="button"
        class="trigger"
        aria-haspopup="listbox"
        aria-expanded="${this.open}"
        aria-label="${this.ariaLabel ?? 'Aspect ratio'}"
        ?disabled=${this.busy}
        @click=${this._toggle}
      >
        ${this.selected ? unsafeSVG(aspectRatioSvg(this.selected)) : null}
        ${triggerLabel ? html`<span class="trigger-label">${triggerLabel}</span>` : null}
      </button>
      <div class="popover" popover="auto" role="listbox" @toggle=${this._onToggle}>
        <div class="popover-inner">
          ${this.options.map((option) => {
            const isSelected = this.selected ? aspectRatioEquals(option.ratio, this.selected) : false;
            return html`
              <button
                type="button"
                class="option"
                role="option"
                aria-selected="${isSelected}"
                @click=${() => this._select(option.ratio)}
              >
                ${unsafeSVG(aspectRatioSvg(option.ratio))}
                <span class="option-ratio">${aspectRatioKey(option.ratio)}</span>
                <span class="option-label">${this.labelFor(option)}</span>
              </button>
            `;
          })}
        </div>
      </div>
    `;
  }
}

if (!customElements.get('uc-ai-aspect-ratio')) {
  customElements.define('uc-ai-aspect-ratio', UcAiAspectRatio);
}
