import { beforeAll, describe, expect, it, vi } from 'vitest';
import './UcAiHistory';
import type { HistoryEntry } from '../../generation';
import type { UcAiHistory } from './UcAiHistory';

// happy-dom has no Element.animate; @lit-labs/motion's FLIP directive calls it
// when chips re-render (e.g. paging), which would surface as an unhandled
// rejection. Stub a no-op Animation so those updates stay quiet.
beforeAll(() => {
  if (typeof Element.prototype.animate !== 'function') {
    Element.prototype.animate = (() => ({
      finished: Promise.resolve(),
      cancel() {},
      finish() {},
    })) as unknown as Element['animate'];
  }
});

function entry(overrides: Partial<HistoryEntry> & { uuid?: string } = {}): HistoryEntry {
  const uuid = overrides.uuid ?? 'uuid-1';
  return {
    id: overrides.id ?? uuid,
    prompt: overrides.prompt ?? 'a prompt',
    mode: overrides.mode ?? 'generate',
    url: overrides.url ?? `https://ucarecdn.com/${uuid}/`,
    file: { uuid } as HistoryEntry['file'],
    ratio: overrides.ratio ?? null,
  };
}

async function mount(overrides: Partial<UcAiHistory> = {}): Promise<UcAiHistory> {
  const el = document.createElement('uc-ai-history') as UcAiHistory;
  Object.assign(el, overrides);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const chips = (el: UcAiHistory) => [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.chip')];
const startOver = (el: UcAiHistory) => el.shadowRoot!.querySelector<HTMLButtonElement>('.startover__btn');
const prev = (el: UcAiHistory) => el.shadowRoot!.querySelector<HTMLButtonElement>('.nav--prev');
const next = (el: UcAiHistory) => el.shadowRoot!.querySelector<HTMLButtonElement>('.nav--next');

/** Build `n` newest-first entries (uuid/id `e{n-1}` … `e0`, newest first). */
function series(n: number): HistoryEntry[] {
  return Array.from({ length: n }, (_, i) => {
    const uuid = `e${n - 1 - i}`;
    return entry({ uuid, id: uuid, prompt: uuid });
  });
}

describe('UcAiHistory', () => {
  it('renders nothing in generate mode with no results', async () => {
    const el = await mount({ entries: [], showStartOver: false });
    expect(chips(el)).toHaveLength(0);
    expect(startOver(el)).toBeNull();
    expect(el.shadowRoot!.querySelector('.strip')).toBeNull();
  });

  it('renders a chip per entry, newest last (rightmost, painted on top)', async () => {
    const el = await mount({ entries: [entry({ uuid: 'new', id: 'new' }), entry({ uuid: 'old', id: 'old' })] });
    const c = chips(el);
    expect(c).toHaveLength(2);
    // Source array is newest-first; rendered oldest→newest so newest is last.
    expect(c[0]!.getAttribute('aria-label')).toBeDefined();
    expect(c[c.length - 1]!.title).toBe('a prompt');
  });

  it('marks the chip whose uuid matches selectedUuid as selected', async () => {
    const el = await mount({
      entries: [entry({ uuid: 'a', id: 'a' }), entry({ uuid: 'b', id: 'b' })],
      selectedUuid: 'a',
    });
    const selected = chips(el).filter((c) => c.classList.contains('chip--selected'));
    expect(selected).toHaveLength(1);
    expect(selected[0]!.getAttribute('aria-pressed')).toBe('true');
  });

  it('emits uc:select with the entry when a chip is clicked', async () => {
    const el = await mount({ entries: [entry({ uuid: 'a', id: 'a' })] });
    const onSelect = vi.fn();
    el.addEventListener('uc:select', onSelect);

    chips(el)[0]!.click();

    expect(onSelect).toHaveBeenCalledOnce();
    expect((onSelect.mock.calls[0]![0] as CustomEvent).detail.entry.id).toBe('a');
  });

  const labelsOf = (el: UcAiHistory) => chips(el).map((c) => c.getAttribute('aria-label'));
  const selectedLabels = (el: UcAiHistory) =>
    chips(el)
      .filter((c) => c.classList.contains('chip--selected'))
      .map((c) => c.getAttribute('aria-label'));

  it('shows no arrows when entries fit the window', async () => {
    const el = await mount({ entries: series(5), selectedUuid: 'e4' });
    expect(chips(el)).toHaveLength(5);
    expect(prev(el)).toBeNull();
    expect(next(el)).toBeNull();
  });

  it('windows to 5 chips around the newest selection by default', async () => {
    const el = await mount({ entries: series(7), selectedUuid: 'e6' });
    // ordered oldest→newest is e0…e6; the newest window is e2…e6.
    expect(labelsOf(el)).toEqual(['e2', 'e3', 'e4', 'e5', 'e6']);
    expect(prev(el)!.disabled).toBe(false); // an older result exists
    expect(next(el)!.disabled).toBe(true); // already at the newest
  });

  it('prev/next step the active result and emit uc:select', async () => {
    const el = await mount({ entries: series(7), selectedUuid: 'e6' });
    const onSelect = vi.fn();
    el.addEventListener('uc:select', onSelect);

    prev(el)!.click(); // one older than e6
    expect((onSelect.mock.calls[0]![0] as CustomEvent).detail.entry.id).toBe('e5');

    // The parent restores that result, handing the selection back down.
    el.selectedUuid = 'e5';
    await el.updateComplete;
    expect(selectedLabels(el)).toEqual(['e5']);

    next(el)!.click(); // one newer than e5
    expect((onSelect.mock.calls[1]![0] as CustomEvent).detail.entry.id).toBe('e6');
  });

  const selectedIndex = (el: UcAiHistory) => chips(el).findIndex((c) => c.classList.contains('chip--selected'));

  it('centers the selected result, re-centering as it steps', async () => {
    const el = await mount({ entries: series(9), selectedUuid: 'e4' });
    // e4 sits dead-center (window index 2) of the 5-wide window.
    expect(labelsOf(el)).toEqual(['e2', 'e3', 'e4', 'e5', 'e6']);
    expect(selectedIndex(el)).toBe(2);

    // Stepping newer re-centers: the window shifts one and e5 lands in the middle.
    next(el)!.click();
    el.selectedUuid = 'e5'; // parent restores the newer result
    await el.updateComplete;
    expect(labelsOf(el)).toEqual(['e3', 'e4', 'e5', 'e6', 'e7']);
    expect(selectedIndex(el)).toBe(2);
  });

  it('pins the window at the edges for the first/last results (cannot center)', async () => {
    const first = await mount({ entries: series(9), selectedUuid: 'e1' });
    // Second-oldest can't be centered — window stays at the start, chip off-center.
    expect(labelsOf(first)).toEqual(['e0', 'e1', 'e2', 'e3', 'e4']);
    expect(selectedIndex(first)).toBe(1);

    const last = await mount({ entries: series(9), selectedUuid: 'e8' });
    // Newest can't be centered — window stays at the end, chip on the right.
    expect(labelsOf(last)).toEqual(['e4', 'e5', 'e6', 'e7', 'e8']);
    expect(selectedIndex(last)).toBe(4);
  });

  it('disables prev at the oldest result and next at the newest', async () => {
    const oldest = await mount({ entries: series(7), selectedUuid: 'e0' });
    expect(prev(oldest)!.disabled).toBe(true);
    expect(next(oldest)!.disabled).toBe(false);

    const newest = await mount({ entries: series(7), selectedUuid: 'e6' });
    expect(prev(newest)!.disabled).toBe(false);
    expect(next(newest)!.disabled).toBe(true);
  });

  it('keeps the window steady across unrelated re-renders (fresh array, same selection)', async () => {
    const el = await mount({ entries: series(7), selectedUuid: 'e3' });
    expect(labelsOf(el)).toEqual(['e1', 'e2', 'e3', 'e4', 'e5']); // e3 centered

    // The parent re-renders with a freshly-built array (new ref, same content)
    // and the unchanged selection — the window must not jitter.
    el.entries = series(7);
    el.busy = false;
    await el.updateComplete;
    expect(labelsOf(el)).toEqual(['e1', 'e2', 'e3', 'e4', 'e5']);
  });

  it('slides the window to keep the selected chip visible', async () => {
    const el = await mount({ entries: series(7), selectedUuid: 'e0' });
    // Selecting the oldest pulls the window to the start.
    expect(labelsOf(el)).toEqual(['e0', 'e1', 'e2', 'e3', 'e4']);
    expect(selectedLabels(el)).toEqual(['e0']);
  });

  it('snaps to the newest window when a new entry is prepended', async () => {
    const el = await mount({ entries: series(7), selectedUuid: 'e0' });
    expect(chips(el)[0]!.getAttribute('aria-label')).toBe('e0');
    // A fresh generation prepends a newest-first entry and selects it.
    el.entries = [entry({ uuid: 'e7', id: 'e7', prompt: 'e7' }), ...series(7)];
    el.selectedUuid = 'e7';
    await el.updateComplete;
    expect(labelsOf(el)).toEqual(['e3', 'e4', 'e5', 'e6', 'e7']);
  });

  it('shows a Start over control in edit mode and emits uc:start-over', async () => {
    const el = await mount({ entries: [], showStartOver: true, startOverLabel: 'Start over' });
    expect(el.shadowRoot!.querySelector('.strip')).toBeTruthy();
    expect(startOver(el)?.textContent).toContain('Start over');

    const onStartOver = vi.fn();
    el.addEventListener('uc:start-over', onStartOver);
    startOver(el)!.click();
    expect(onStartOver).toHaveBeenCalledOnce();
  });
});
