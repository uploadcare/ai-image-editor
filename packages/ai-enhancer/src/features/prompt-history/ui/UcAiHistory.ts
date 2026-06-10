import { animate } from '@lit-labs/motion';
import { html, LitElement, nothing, type PropertyValues, type TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';

import { cdnSquareThumbUrl } from '../../../shared/lib/cdn';
import { SecureUrlController } from '../../../shared/lib/SecureUrlController';
import type { SecureDeliveryProxyUrlResolver } from '../../../shared/lib/secureDelivery';
import type { HistoryEntry } from '../../generation';
import styles from './history.css?inline';

export type HistorySelectDetail = { entry: HistoryEntry };

/** Requested thumbnail size (2× the 40px CSS box for crisp retina rendering). */
const THUMB_SIZE = 80;

/**
 * The result-history strip: overlapping thumbnail chips that fan apart on
 * hover, sitting just above the composer. Selecting a chip restores that
 * result; a "Start over" affordance reveals to the left of the strip. New
 * results animate in via `@lit-labs/motion`'s FLIP `animate()` directive, so
 * the existing chips slide aside smoothly as one is prepended.
 */
@customElement('uc-ai-history')
export class UcAiHistory extends LitElement {
  public static override styles = unsafeCSS(styles);

  @property({ attribute: false })
  public entries: HistoryEntry[] = [];

  /** UUID of the result currently shown on the canvas (marks the active chip). */
  @property({ attribute: 'selected-uuid' })
  public selectedUuid: string | null = null;

  @property({ type: Boolean, attribute: 'show-start-over' })
  public showStartOver = false;

  @property({ attribute: 'start-over-label' })
  public startOverLabel = '';

  /** Accessible label for the strip (the toolbar of past results). */
  @property({ attribute: 'list-label' })
  public listLabel = 'Generation history';

  @property({ attribute: false })
  public secureResolver?: SecureDeliveryProxyUrlResolver;

  private readonly _secure = new SecureUrlController(this);

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('secureResolver')) this._secure.setResolver(this.secureResolver);
  }

  private _select(entry: HistoryEntry): void {
    this.dispatchEvent(
      new CustomEvent<HistorySelectDetail>('uc:select', { detail: { entry }, bubbles: true, composed: true }),
    );
  }

  private _startOver(): void {
    this.dispatchEvent(new CustomEvent('uc:start-over', { bubbles: true, composed: true }));
  }

  public override render(): TemplateResult {
    const hasEntries = this.entries.length > 0;
    // Nothing to show: no results and start-over not applicable (generate mode).
    if (!hasEntries && !this.showStartOver) return html`${nothing}`;

    const stripClasses = { strip: true, 'strip--empty': !hasEntries };
    // Render oldest→newest so the newest chip is rightmost and paints on top
    // (later DOM order wins), while the source array stays newest-first.
    const ordered = [...this.entries].reverse();

    return html`
      <div class=${classMap(stripClasses)} role="toolbar" aria-label="${this.listLabel}">
        ${
          this.showStartOver
            ? html`
              <div class="startover">
                <button type="button" class="startover__btn" @click=${this._startOver}>${this.startOverLabel}</button>
              </div>
            `
            : nothing
        }
        ${repeat(
          ordered,
          (entry) => entry.id,
          (entry) => {
            const thumb = this._secure.resolve(cdnSquareThumbUrl(entry.url, THUMB_SIZE));
            const selected = this.selectedUuid != null && entry.file.uuid === this.selectedUuid;
            return html`
              <button
                type="button"
                class=${classMap({ chip: true, 'chip--selected': selected })}
                aria-pressed="${selected ? 'true' : 'false'}"
                aria-label=${entry.prompt || 'Result'}
                title=${entry.prompt}
                @click=${() => this._select(entry)}
                ${animate({ keyframeOptions: { duration: 300, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' } })}
              >
                ${
                  thumb
                    ? html`<span class="thumb" style="background-image:url('${thumb}')"></span>`
                    : html`<span class="thumb"></span>`
                }
              </button>
            `;
          },
        )}
      </div>
    `;
  }
}
