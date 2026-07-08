import { html, LitElement, nothing, type PropertyValues, type TemplateResult, unsafeCSS } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';

import type { AiEditorMode } from '../../../entities/mode';
import { ICON_ARROW_THICK } from '../../../shared/ui/icons';
import styles from './prompt-row.css?inline';

export type PromptInputDetail = { value: string };

/**
 * The floating composer card: an auto-growing prompt textarea above a control
 * row that holds the preset chips (slotted, left), the aspect-ratio picker
 * (slotted) and the send button. The send button reveals itself (sliding the
 * ratio picker over) only once there's something to send, and cross-fades its
 * arrow into a spinner while a generation is running.
 */
@customElement('uc-ai-prompt-row')
export class UcAiPromptRow extends LitElement {
  public static override styles = unsafeCSS(styles);

  @property()
  public mode: AiEditorMode = 'generate';

  @property()
  public value = '';

  @property()
  public placeholder = '';

  @property({ type: Boolean })
  public busy = false;

  /** When false the free-text prompt is hidden; only the slotted chips remain. */
  @property({ type: Boolean })
  public allowCustom = true;

  @property({ attribute: 'send-aria-label' })
  public sendAriaLabel = '';

  @query('.input')
  private _inputEl?: HTMLTextAreaElement;

  public focusInput(): void {
    this._inputEl?.focus();
  }

  protected override updated(changed: PropertyValues<this>): void {
    // Covers programmatic value changes (template chips, history) as well as typing.
    if (changed.has('value')) {
      this._resize();
    }
  }

  /**
   * Auto-grow fallback for browsers without `field-sizing: content` support.
   * The CSS `max-height` caps the growth; overflow scrolls internally.
   */
  private _resize(): void {
    const el = this._inputEl;
    if (!el || CSS.supports('field-sizing', 'content')) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  private _onInput(e: Event): void {
    const value = (e.target as HTMLTextAreaElement).value;
    this.value = value;
    this.dispatchEvent(
      new CustomEvent<PromptInputDetail>('uc:input', { detail: { value }, bubbles: true, composed: true }),
    );
    this._resize();
  }

  private _onKeydown(e: KeyboardEvent): void {
    // Enter sends; Shift+Enter falls through and inserts a newline natively.
    // Ignore Enter that confirms an IME composition candidate.
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && this.value.trim() && !this.busy) {
      e.preventDefault();
      this._emitSend();
    }
  }

  private _emitSend(): void {
    this.dispatchEvent(new CustomEvent('uc:send', { bubbles: true, composed: true }));
  }

  public override render(): TemplateResult {
    const empty = this.value.trim().length === 0;

    return html`
      <div class="card">
        <div class="body">
          ${
            this.allowCustom
              ? html`<textarea
                  class="input"
                  rows="1"
                  .value=${this.value}
                  placeholder="${this.placeholder}"
                  aria-label="${this.placeholder}"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                  name="uc-ai-prompt"
                  data-1p-ignore
                  data-lpignore="true"
                  data-form-type="other"
                  @input=${this._onInput}
                  @keydown=${this._onKeydown}
                  ?disabled=${this.busy}
                ></textarea>`
              : nothing
          }

          <div class="row">
            <div class="actions">
              <slot name="chips"></slot>
            </div>
            <div class="controls">
              <slot name="aspect-ratio"></slot>
              <button
                type="button"
                class=${classMap({ send: true, 'send--busy': this.busy })}
                aria-label="${this.sendAriaLabel}"
                ?hidden=${empty}
                ?disabled=${this.busy || empty}
                @click=${this._emitSend}
              >
                <span class="send__icon">${unsafeSVG(ICON_ARROW_THICK)}</span>
                <span class="send__spinner" aria-hidden="true"></span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
