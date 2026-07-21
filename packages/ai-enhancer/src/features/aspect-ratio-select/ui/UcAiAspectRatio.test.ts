import { describe, expect, it } from 'vitest';
import './UcAiAspectRatio';
import { AUTO_RATIO, POPULAR_ASPECT_RATIOS, toAspectRatioOption } from '../../../entities/aspect-ratio';
import type { UcAiAspectRatio } from './UcAiAspectRatio';

async function mount(overrides: Partial<UcAiAspectRatio> = {}): Promise<UcAiAspectRatio> {
  const el = document.createElement('uc-ai-aspect-ratio') as UcAiAspectRatio;
  el.options = POPULAR_ASPECT_RATIOS.map(toAspectRatioOption);
  el.selected = POPULAR_ASPECT_RATIOS[1]!; // [3, 2]
  Object.assign(el, overrides);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const trigger = (el: UcAiAspectRatio) => el.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!;
const options = (el: UcAiAspectRatio) => [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.option')];

describe('UcAiAspectRatio', () => {
  it('shows the selected ratio on the trigger', async () => {
    const el = await mount();
    expect(trigger(el).querySelector('.trigger-label')?.textContent).toBe('3:2');
  });

  it('renders one option per provided ratio', async () => {
    const el = await mount();
    expect(options(el)).toHaveLength(POPULAR_ASPECT_RATIOS.length);
  });

  it('marks the matching option as selected', async () => {
    const el = await mount();
    const selected = options(el).filter((o) => o.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0]!.querySelector('.option-ratio')?.textContent).toBe('3:2');
  });

  it('disables the trigger while busy', async () => {
    const el = await mount({ busy: true });
    expect(trigger(el).disabled).toBe(true);
  });

  it('renders an Auto entry when one is provided (edit mode)', async () => {
    const el = await mount({
      options: [
        { value: AUTO_RATIO, labelKey: 'ai-enhancer-aspect-auto' },
        ...POPULAR_ASPECT_RATIOS.map(toAspectRatioOption),
      ],
      selected: AUTO_RATIO,
      labelFor: () => 'Auto',
    });
    expect(options(el)).toHaveLength(POPULAR_ASPECT_RATIOS.length + 1);
    expect(trigger(el).textContent).toContain('Auto');
  });
});
