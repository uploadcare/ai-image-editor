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
import { ICON_NEXT_ARROW, ICON_PREV_ARROW } from '../../../shared/ui/icons';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';

export type HistorySelectDetail = { entry: HistoryEntry };

/** Requested thumbnail size (2× the 40px CSS box for crisp retina rendering). */
const THUMB_SIZE = 80;

/** Most thumbnails shown at once; the rest page in via the prev/next arrows. */
const VISIBLE = 5;

/**
 * The result-history strip: overlapping thumbnail chips that fan apart on
 * hover, sitting just above the composer. Selecting a chip restores that
 * result; a "Start over" affordance reveals to the left of the strip. New
 * results animate in via `@lit-labs/motion`'s FLIP `animate()` directive, so
 * the existing chips slide aside smoothly as one is prepended.
 *
 * At most {@link VISIBLE} chips are shown at a time; when there are more, prev/
 * next arrows flank the strip and step the *active selection* one result older
 * or newer (emitting `uc:select`, so the canvas image changes with it). The
 * visible window keeps the selected chip centred — except near the ends, where
 * the window can't overrun the roster, so the first/last couple of results sit
 * off-centre against their edge.
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

  /** Accessible labels for the paging arrows (left reveals older, right newer). */
  @property({ attribute: 'prev-label' })
  public prevLabel = 'Older results';

  @property({ attribute: 'next-label' })
  public nextLabel = 'Newer results';

  @property({ type: Boolean })
  public busy = false;

  @property({ attribute: false })
  public secureResolver?: SecureDeliveryProxyUrlResolver;

  private readonly _secure = new SecureUrlController(this);

  /** Entry ids whose thumbnail has finished (pre)loading — drives the fade-in.
   *  Keyed by the stable id (not the resolved URL), so a re-signing secure
   *  resolver that rotates URLs doesn't flash the skeleton again. */
  private readonly _loaded = new Set<string>();

  /** Left edge of the visible window into the ordered (oldest→newest) entries. */
  private _windowStart = 0;
  /** `selectedUuid` at the last re-anchor — lets us react to selection *changes*
   *  rather than re-syncing on every render (which would fight manual paging). */
  private _prevSelected: string | null = null;
  /** Whether the window has been given its initial (newest) anchor yet. */
  private _windowReady = false;

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('secureResolver')) this._secure.setResolver(this.secureResolver);
    // Drop loaded flags for entries that aged out of history (bounds the Set).
    if (changed.has('entries')) {
      const ids = new Set(this.entries.map((e) => e.id));
      for (const id of this._loaded) if (!ids.has(id)) this._loaded.delete(id);
    }
    this._reanchorWindow();
  }

  /** Entries oldest→newest, so the newest chip is rightmost (and paints on top). */
  private get _ordered(): HistoryEntry[] {
    return [...this.entries].reverse();
  }

  private _maxStart(total: number): number {
    return Math.max(0, total - VISIBLE);
  }

  /**
   * Re-centre the window on the *selection* — but only when it actually changes.
   * A fresh generation selects its new (newest) result, pulling the window to
   * the end; stepping or clicking a chip re-centres on it. Unrelated re-renders
   * (the parent hands us a freshly-built `entries` array each render, plus
   * `busy` toggles) only re-clamp, so the window never jitters on incidental
   * updates.
   */
  private _reanchorWindow(): void {
    const ordered = this._ordered;
    const maxStart = this._maxStart(ordered.length);
    const sel = ordered.findIndex((e) => e.file.uuid === this.selectedUuid);
    const selChanged = this.selectedUuid !== this._prevSelected;
    this._prevSelected = this.selectedUuid;

    let start = Math.min(this._windowStart, maxStart); // re-clamp against a shrunk roster
    if ((!this._windowReady && ordered.length > 0) || (selChanged && sel >= 0)) {
      this._windowReady = true;
      start = sel >= 0 ? this._centered(sel, maxStart) : maxStart;
    }
    this._windowStart = Math.max(0, start);
  }

  /** Window start that centres index `sel`, clamped to the roster ends — so the
   *  first/last {@link VISIBLE}/2 results sit off-centre against their edge. */
  private _centered(sel: number, maxStart: number): number {
    return Math.max(0, Math.min(sel - Math.floor(VISIBLE / 2), maxStart));
  }

  /** Move the active selection one result older (−1) or newer (+1) and restore
   *  it (via `uc:select`); the window then follows in `_reanchorWindow`. */
  private _step(delta: number): void {
    const ordered = this._ordered;
    const sel = ordered.findIndex((e) => e.file.uuid === this.selectedUuid);
    if (sel < 0) return;
    const target = ordered[sel + delta];
    if (target) this._select(target);
  }

  /** Mark an entry's thumbnail decoded (or failed) so it fades in over the skeleton. */
  private _onThumbSettled(id: string): void {
    if (this._loaded.has(id)) return;
    this._loaded.add(id);
    this.requestUpdate();
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
    // Ordered oldest→newest so the newest chip is rightmost and paints on top
    // (later DOM order wins), while the source array stays newest-first.
    const ordered = this._ordered;
    const total = ordered.length;
    // Arrows appear once the roster outgrows the window; they step the active
    // result, so their enablement tracks the selection, not the window edge.
    const showArrows = total > VISIBLE;
    const start = Math.min(this._windowStart, this._maxStart(total));
    const windowEntries = ordered.slice(start, start + VISIBLE);
    const sel = ordered.findIndex((e) => e.file.uuid === this.selectedUuid);
    const canPrev = sel > 0; // an older result to step back to
    const canNext = sel >= 0 && sel < total - 1; // a newer result to step forward to

    return html`
      <div class=${classMap(stripClasses)} role="toolbar" aria-label="${this.listLabel}">
        ${this.showStartOver
          ? html`
              <div class="startover">
                <button type="button" ?disabled="${this.busy}" class="startover__btn" @click=${this._startOver}>
                  ${this.startOverLabel}
                </button>
              </div>
            `
          : nothing}
        ${showArrows ? this._navButton('prev', this.prevLabel, !canPrev) : nothing}
        <div class="chips">
          ${repeat(
            windowEntries,
            (entry) => entry.id,
            (entry) => {
              const thumb = this._secure.resolve(cdnSquareThumbUrl(entry.url, THUMB_SIZE));
              const selected = this.selectedUuid != null && entry.file.uuid === this.selectedUuid;
              const loaded = this._loaded.has(entry.id);
              return html`
                <button
                  type="button"
                  ?disabled=${this.busy}
                  class=${classMap({ chip: true, 'chip--selected': selected })}
                  aria-pressed="${selected ? 'true' : 'false'}"
                  aria-label=${entry.prompt || 'Result'}
                  title=${entry.prompt}
                  @click=${() => this._select(entry)}
                  ${animate({ keyframeOptions: { duration: 300, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' } })}
                >
                  <span class=${classMap({ thumb: true, 'thumb--loaded': loaded })}>
                    ${
                      // Rendering the <img> preloads it; the skeleton shows until it
                      // decodes, then it fades in (see history.css).
                      thumb
                        ? html`<img
                            class="thumb__img"
                            src="${thumb}"
                            alt=""
                            aria-hidden="true"
                            decoding="async"
                            @load=${() => this._onThumbSettled(entry.id)}
                            @error=${() => this._onThumbSettled(entry.id)}
                          />`
                        : nothing
                    }
                  </span>
                </button>
              `;
            },
          )}
        </div>
        ${showArrows ? this._navButton('next', this.nextLabel, !canNext) : nothing}
      </div>
    `;
  }

  /** A paging arrow. `dir` picks the chevron direction and CSS modifier. */
  private _navButton(dir: 'prev' | 'next', label: string, atEnd: boolean): TemplateResult {
    return html`
      <button
        type="button"
        class=${classMap({ nav: true, [`nav--${dir}`]: true })}
        ?disabled=${this.busy || atEnd}
        aria-label=${label}
        title=${label}
        @click=${() => this._step(dir === 'prev' ? -1 : 1)}
      >
        ${dir === 'prev' ? unsafeSVG(ICON_PREV_ARROW) : unsafeSVG(ICON_NEXT_ARROW)}
      </button>
    `;
  }
}
