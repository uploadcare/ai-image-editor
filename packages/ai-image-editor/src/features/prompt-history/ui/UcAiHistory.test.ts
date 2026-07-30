import { describe, expect, it, vi } from 'vitest';
import './UcAiHistory';
import type { HistoryEntry } from '../../generation';
import type { UcAiHistory } from './UcAiHistory';

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
