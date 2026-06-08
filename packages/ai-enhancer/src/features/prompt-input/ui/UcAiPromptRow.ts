import { html, LitElement, nothing, type PropertyValues, type TemplateResult, unsafeCSS } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';

import type { AiEditorMode } from '../../../entities/mode';
import { ICON_ARROW_THICK, ICON_HISTORY } from '../../../shared/ui/icons';
import styles from './prompt-row.css?inline';

export type PromptInputDetail = { value: string };

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

  /** Disables only the send button (not the textarea) — e.g. while references upload. */
  @property({ type: Boolean, attribute: 'send-disabled' })
  public sendDisabled = false;

  @property({ type: Boolean, attribute: 'history-open' })
  public historyOpen = false;

  @property({ attribute: 'history-aria-label' })
  public historyAriaLabel = '';

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
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && this.value.trim() && !this.sendDisabled && !this.busy) {
      e.preventDefault();
      this._emitSend();
    }
  }

  private _emitSend(): void {
    this.dispatchEvent(new CustomEvent('uc:send', { bubbles: true, composed: true }));
  }

  private _emitToggleHistory(): void {
    this.dispatchEvent(new CustomEvent('uc:toggle-history', { bubbles: true, composed: true }));
  }

  public override render(): TemplateResult {
    const showHistory = this.mode === 'edit' && !this.value;
    const showArrow = this.value.trim().length > 0;

    return html`
      <div class="row">
        ${
          showHistory
            ? html`
              <button
                type="button"
                class="icon-btn"
                data-testid="history-btn"
                aria-label="${this.historyAriaLabel}"
                aria-expanded="${this.historyOpen}"
                @click=${this._emitToggleHistory}
              >
                ${unsafeSVG(ICON_HISTORY)}
              </button>
              <div class="divider" role="separator"></div>
            `
            : nothing
        }
        <textarea
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
        ></textarea>
        <slot name="aspect-ratio"></slot>
        ${
          showArrow
            ? html`
              <button
                type="button"
                class="icon-btn icon-btn--primary"
                aria-label="${this.sendAriaLabel}"
                @click=${this._emitSend}
                ?disabled=${this.busy || this.sendDisabled || !this.value.trim()}
              >
                ${unsafeSVG(ICON_ARROW_THICK)}
              </button>
            `
            : nothing
        }
      </div>
    `;
  }
}
