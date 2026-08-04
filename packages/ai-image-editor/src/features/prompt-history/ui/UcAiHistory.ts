import { animate } from '@lit-labs/motion';
import { html, LitElement, nothing, type PropertyValues, type TemplateResult, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { repeat } from 'lit/directives/repeat.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { cdnSquareThumbUrl } from '../../../shared/lib/cdn';
import { SecureUrlController } from '../../../shared/lib/SecureUrlController';
import type { SecureDeliveryProxyUrlResolver } from '../../../shared/lib/secureDelivery';
import { ICON_NEXT_ARROW, ICON_PREV_ARROW } from '../../../shared/ui/icons';
import type { HistoryEntry } from '../../generation';
import styles from './history.css?inline';

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
 *
 * On touch (coarse-pointer) devices there are no arrows: the strip becomes a
 * centre-snapping horizontal carousel holding *every* result, iPhone-style. The
 * chip nearest the centre is the selection, so flicking through pages results
 * one by one; tapping a chip snaps it to the centre.
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

  /** Primary pointer is coarse (touch): render the centre-snap carousel — every
   *  result in a scroller, no arrows — instead of the windowed strip. */
  @state()
  private _coarse = false;

  /** The scroller element (`.chips`) in carousel mode, for centring math. */
  private readonly _chipsRef = createRef<HTMLElement>();
  private _coarseMq?: MediaQueryList;
  /** rAF gate so the scroll handler reads layout at most once per frame. */
  private _scrollRaf = false;
  /** Set when the carousel's own scroll drove the selection — tells `updated`
   *  not to re-centre and fight the in-progress flick. */
  private _selectFromScroll = false;

  public override connectedCallback(): void {
    super.connectedCallback();
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      this._coarseMq = window.matchMedia('(pointer: coarse)');
      this._coarse = this._coarseMq.matches;
      this._coarseMq.addEventListener?.('change', this._onCoarseChange);
    }
    window.addEventListener?.('resize', this._onResize);
  }

  public override disconnectedCallback(): void {
    this._coarseMq?.removeEventListener?.('change', this._onCoarseChange);
    window.removeEventListener?.('resize', this._onResize);
    super.disconnectedCallback();
  }

  private readonly _onCoarseChange = (e: MediaQueryListEvent): void => {
    this._coarse = e.matches;
  };

  private readonly _onResize = (): void => {
    if (this._coarse) this._syncCarousel(false);
  };

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

  // ----- Touch carousel -----

  protected override firstUpdated(): void {
    if (this._coarse) this._syncCarousel(false);
  }

  protected override updated(changed: PropertyValues): void {
    if (!this._coarse) return;
    // The carousel's own scroll picked this selection — let the flick settle.
    if (this._selectFromScroll) {
      this._selectFromScroll = false;
      return;
    }
    // Just switched to touch, a new result arrived, or the parent restored a
    // selection: pad the scroller and snap the selected chip back to centre.
    if (changed.has('_coarse') || changed.has('entries') || changed.has('selectedUuid')) {
      this._syncCarousel(!changed.has('_coarse'));
    }
  }

  /** Re-pad the scroller and centre the selected chip (`smooth` for restores). */
  private _syncCarousel(smooth: boolean): void {
    const scroller = this._chipsRef.value;
    if (!scroller || !this._coarse) return;
    this._padScroller(scroller);
    const sel = scroller.querySelector<HTMLElement>('.chip--selected');
    if (sel) this._centerChip(sel, smooth);
  }

  /** Pad the ends so the first/last chip can still reach the centre. */
  private _padScroller(scroller: HTMLElement): void {
    const chip = scroller.querySelector<HTMLElement>('.chip');
    const chipW = chip ? chip.offsetWidth : 44;
    const pad = Math.max(0, (scroller.getBoundingClientRect().width - chipW) / 2);
    scroller.style.paddingLeft = `${pad}px`;
    scroller.style.paddingRight = `${pad}px`;
  }

  /** Scroll a chip to the horizontal centre of the scroller. */
  private _centerChip(chip: HTMLElement, smooth: boolean): void {
    const scroller = this._chipsRef.value;
    if (!scroller) return;
    const s = scroller.getBoundingClientRect();
    const c = chip.getBoundingClientRect();
    const delta = c.left + c.width / 2 - (s.left + s.width / 2);
    scroller.scrollTo?.({ left: scroller.scrollLeft + delta, behavior: smooth ? 'smooth' : 'auto' });
  }

  /** The chip whose centre is nearest the scroller's centre. */
  private _centeredChip(): HTMLElement | null {
    const scroller = this._chipsRef.value;
    if (!scroller) return null;
    const center = scroller.getBoundingClientRect().left + scroller.getBoundingClientRect().width / 2;
    let best: HTMLElement | null = null;
    let bestD = Infinity;
    for (const c of scroller.querySelectorAll<HTMLElement>('.chip')) {
      const r = c.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - center);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  /** Live-select whichever chip is under the centre as the strip is flicked. */
  private readonly _onScroll = (): void => {
    if (!this._coarse || this._scrollRaf) return;
    this._scrollRaf = true;
    requestAnimationFrame(() => {
      this._scrollRaf = false;
      const chip = this._centeredChip();
      const uuid = chip?.dataset.uuid;
      if (!uuid || uuid === this.selectedUuid) return;
      const entry = this.entries.find((e) => e.file.uuid === uuid);
      if (entry) {
        this._selectFromScroll = true;
        this._select(entry);
      }
    });
  };

  public override render(): TemplateResult {
    const hasEntries = this.entries.length > 0;
    // Nothing to show: no results and start-over not applicable (generate mode).
    if (!hasEntries && !this.showStartOver) return html`${nothing}`;

    const carousel = this._coarse;
    const stripClasses = { strip: true, 'strip--empty': !hasEntries, 'strip--carousel': carousel };
    // Ordered oldest→newest so the newest chip is rightmost and paints on top
    // (later DOM order wins), while the source array stays newest-first.
    const ordered = this._ordered;
    const total = ordered.length;
    // Touch carousels hold every result; the pointer strip windows to VISIBLE
    // with arrows once the roster outgrows it.
    const showArrows = !carousel && total > VISIBLE;
    const start = Math.min(this._windowStart, this._maxStart(total));
    const chipEntries = carousel ? ordered : ordered.slice(start, start + VISIBLE);
    const sel = ordered.findIndex((e) => e.file.uuid === this.selectedUuid);
    const canPrev = sel > 0; // an older result to step back to
    const canNext = sel >= 0 && sel < total - 1; // a newer result to step forward to

    return html`
      <div class=${classMap(stripClasses)} role="toolbar" aria-label="${this.listLabel}">
        ${
          // Position readout (selected / total), revealed with the arrows on
          // hover. Decorative — the toolbar + arrow labels already convey state.
          showArrows ? html`<div class="counter" aria-hidden="true">${Math.max(0, sel) + 1} / ${total}</div>` : nothing
        }
        ${showArrows ? this._navButton('prev', this.prevLabel, !canPrev) : nothing}
        <div
          class=${classMap({ chips: true, 'chips--carousel': carousel })}
          ${ref(this._chipsRef)}
          @scroll=${this._onScroll}
        >
          ${repeat(
            chipEntries,
            (entry) => entry.id,
            (entry) => this._renderChip(entry, carousel),
          )}
        </div>
        ${showArrows ? this._navButton('next', this.nextLabel, !canNext) : nothing}
      </div>
    `;
  }

  /** A single result chip. In carousel mode the FLIP `animate()` is dropped so
   *  it can't fight the scroller's snap, and a `data-uuid` lets the scroll
   *  handler map the centred chip back to its entry. */
  private _renderChip(entry: HistoryEntry, carousel: boolean): TemplateResult {
    const thumb = this._secure.resolve(cdnSquareThumbUrl(entry.url, THUMB_SIZE));
    const selected = this.selectedUuid != null && entry.file.uuid === this.selectedUuid;
    const loaded = this._loaded.has(entry.id);
    return html`
      <button
        type="button"
        ?disabled=${this.busy}
        data-uuid=${entry.file.uuid}
        class=${classMap({ chip: true, 'chip--selected': selected })}
        aria-pressed="${selected ? 'true' : 'false'}"
        aria-label=${entry.prompt || 'Result'}
        title=${entry.prompt}
        @click=${() => this._onChipClick(entry)}
        ${carousel ? nothing : animate({ keyframeOptions: { duration: 300, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' } })}
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
  }

  /** Selecting a chip restores it; on touch it also snaps to the centre. */
  private _onChipClick(entry: HistoryEntry): void {
    this._select(entry);
    if (!this._coarse) return;
    // Centre after the DOM reflects the new selection.
    requestAnimationFrame(() => {
      const el = this._chipsRef.value?.querySelector<HTMLElement>(`.chip--selected`);
      if (el) this._centerChip(el, true);
    });
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
