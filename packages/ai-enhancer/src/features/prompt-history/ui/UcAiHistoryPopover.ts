import { html, LitElement, type PropertyValues, type TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { cdnSquareThumbUrl } from '../../../shared/lib/cdn';
import { SecureUrlController } from '../../../shared/lib/SecureUrlController';
import type { SecureDeliveryProxyUrlResolver } from '../../../shared/lib/secureDelivery';
import type { HistoryEntry } from '../../generation';
import styles from './history-popover.css?inline';

export type HistorySelectDetail = { entry: HistoryEntry };

/** CSS size of the thumbnail (see `.thumb` in history-popover.css). */
const THUMB_SIZE = 32;

@customElement('uc-ai-history-popover')
export class UcAiHistoryPopover extends LitElement {
  public static override styles = unsafeCSS(styles);

  @property({ type: Boolean })
  public open = false;

  @property({ attribute: false })
  public entries: HistoryEntry[] = [];

  @property({ attribute: 'empty-label' })
  public emptyLabel = '';

  @property({ attribute: false })
  public secureResolver?: SecureDeliveryProxyUrlResolver;

  private readonly _secure = new SecureUrlController(this);

  public override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('popover')) {
      this.setAttribute('popover', 'auto');
    }
    this.addEventListener('toggle', this._onToggle);
  }

  public override disconnectedCallback(): void {
    this.removeEventListener('toggle', this._onToggle);
    super.disconnectedCallback();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('secureResolver')) this._secure.setResolver(this.secureResolver);
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (!changed.has('open')) return;
    const isOpen = this.matches(':popover-open');
    if (this.open && !isOpen) this.showPopover();
    else if (!this.open && isOpen) this.hidePopover();
  }

  private _onToggle = (e: Event): void => {
    if ((e as ToggleEvent).newState === 'closed' && this.open) {
      this.open = false;
      this.dispatchEvent(new CustomEvent('uc:close', { bubbles: true, composed: true }));
    }
  };

  private _select(entry: HistoryEntry): void {
    this.dispatchEvent(
      new CustomEvent<HistorySelectDetail>('uc:select', { detail: { entry }, bubbles: true, composed: true }),
    );
  }

  public override render(): TemplateResult {
    return html`
      <div class="pop" role="listbox">
        ${
          this.entries.length === 0
            ? html`<div class="empty">${this.emptyLabel}</div>`
            : this.entries.map((entry) => {
                const thumb = this._secure.resolve(cdnSquareThumbUrl(entry.url, THUMB_SIZE));
                return html`
                <button type="button" class="item" role="option" @click=${() => this._select(entry)}>
                  ${thumb ? html`<img class="thumb" src="${thumb}" alt="" loading="lazy" />` : html`<span class="thumb"></span>`}
                  <span class="text">${entry.prompt}</span>
                </button>
              `;
              })
        }
      </div>
    `;
  }
}
