import { describe, expect, it, vi } from 'vitest';
import './UcAiChips';
import { MODES } from '../../../entities/mode';
import type { UcAiChips } from './UcAiChips';

async function mount(overrides: Partial<UcAiChips> = {}): Promise<UcAiChips> {
  const el = document.createElement('uc-ai-chips') as UcAiChips;
  Object.assign(el, overrides);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const chips = (el: UcAiChips) => [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.chip')];

describe('UcAiChips', () => {
  it('renders a chip per preset for the active mode', async () => {
    const el = await mount({ mode: 'generate' });
    expect(chips(el)).toHaveLength(MODES.generate.presets.length);
  });

  it('switches presets with the mode', async () => {
    const el = await mount({ mode: 'generate' });
    el.mode = 'edit';
    await el.updateComplete;
    expect(chips(el)).toHaveLength(MODES.edit.presets.length);
  });

  it('renders chips as plain buttons (no sticky pressed state)', async () => {
    const el = await mount({ mode: 'generate' });
    expect(chips(el).some((c) => c.hasAttribute('aria-pressed'))).toBe(false);
  });

  it('emits uc:select with the preset when a chip is clicked', async () => {
    const el = await mount({ mode: 'generate' });
    const onSelect = vi.fn();
    el.addEventListener('uc:select', onSelect);

    chips(el)[0]!.click();

    expect(onSelect).toHaveBeenCalledOnce();
    expect((onSelect.mock.calls[0]![0] as CustomEvent).detail.preset).toEqual(MODES.generate.presets[0]);
  });

  it('disables the chips while busy', async () => {
    const el = await mount({ mode: 'generate', busy: true });
    expect(chips(el).every((c) => c.disabled)).toBe(true);
  });
});
