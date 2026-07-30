import { describe, expect, it, vi } from 'vitest';
import './UcAiFooter';
import type { UcAiFooter } from './UcAiFooter';

async function mount(overrides: Partial<UcAiFooter> = {}): Promise<UcAiFooter> {
  const el = document.createElement('uc-ai-footer') as UcAiFooter;
  Object.assign(el, overrides);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const cancelBtn = (el: UcAiFooter) => el.shadowRoot!.querySelector<HTMLButtonElement>('.btn--ghost');
const primaryBtn = (el: UcAiFooter) => el.shadowRoot!.querySelector<HTMLButtonElement>('.btn--primary');

describe('UcAiFooter', () => {
  it('renders a ghost Cancel and a primary Done — and no Start over', async () => {
    const el = await mount({ cancelLabel: 'Cancel', primaryLabel: 'Done' });
    expect(cancelBtn(el)?.textContent).toContain('Cancel');
    expect(primaryBtn(el)?.textContent).toContain('Done');
    // Start over moved to the history strip — the footer has exactly two buttons.
    expect(el.shadowRoot!.querySelectorAll('.btn')).toHaveLength(2);
  });

  it('emits uc:cancel when Cancel is clicked', async () => {
    const el = await mount();
    const onCancel = vi.fn();
    el.addEventListener('uc:cancel', onCancel);
    cancelBtn(el)!.click();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('emits uc:primary when Done is clicked', async () => {
    const el = await mount();
    const onPrimary = vi.fn();
    el.addEventListener('uc:primary', onPrimary);
    primaryBtn(el)!.click();
    expect(onPrimary).toHaveBeenCalledOnce();
  });

  it('disables Done when primaryDisabled is set', async () => {
    const el = await mount({ primaryDisabled: true });
    expect(primaryBtn(el)!.disabled).toBe(true);
  });
});
