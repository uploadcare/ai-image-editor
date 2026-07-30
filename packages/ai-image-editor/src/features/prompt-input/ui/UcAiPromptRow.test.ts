import { describe, expect, it, vi } from 'vitest';
import './UcAiPromptRow';
import type { UcAiPromptRow } from './UcAiPromptRow';

async function mount(overrides: Partial<UcAiPromptRow> = {}): Promise<UcAiPromptRow> {
  const el = document.createElement('uc-ai-prompt-row') as UcAiPromptRow;
  Object.assign(el, overrides);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const textarea = (el: UcAiPromptRow) => el.shadowRoot!.querySelector<HTMLTextAreaElement>('textarea.input')!;
const sendBtn = (el: UcAiPromptRow) => el.shadowRoot!.querySelector<HTMLButtonElement>('.send');

const keydown = (el: UcAiPromptRow, init: KeyboardEventInit) =>
  textarea(el).dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, composed: true, ...init }));

describe('UcAiPromptRow', () => {
  it('renders a multiline textarea inside the composer card', async () => {
    const el = await mount({ placeholder: 'Describe your image' });
    expect(textarea(el)).toBeTruthy();
    expect(el.shadowRoot!.querySelector('input')).toBeNull();
    expect(el.shadowRoot!.querySelector('.card')).toBeTruthy();
    expect(textarea(el).placeholder).toBe('Describe your image');
  });

  it('exposes slots for chips and the aspect-ratio picker', async () => {
    const el = await mount();
    expect(el.shadowRoot!.querySelector('slot[name="chips"]')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('slot[name="aspect-ratio"]')).toBeTruthy();
  });

  it('emits uc:send on Enter when the value is non-empty', async () => {
    const el = await mount({ value: 'hello' });
    const onSend = vi.fn();
    el.addEventListener('uc:send', onSend);

    keydown(el, { key: 'Enter' });

    expect(onSend).toHaveBeenCalledOnce();
  });

  it('does not emit uc:send on Shift+Enter (newline instead)', async () => {
    const el = await mount({ value: 'hello' });
    const onSend = vi.fn();
    el.addEventListener('uc:send', onSend);

    keydown(el, { key: 'Enter', shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('does not emit uc:send on Enter that confirms an IME composition', async () => {
    const el = await mount({ value: 'こんにちは' });
    const onSend = vi.fn();
    el.addEventListener('uc:send', onSend);

    keydown(el, { key: 'Enter', isComposing: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('does not emit uc:send on Enter when the value is empty or whitespace-only', async () => {
    const el = await mount({ value: '   ' });
    const onSend = vi.fn();
    el.addEventListener('uc:send', onSend);

    keydown(el, { key: 'Enter' });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('emits uc:input with the typed value', async () => {
    const el = await mount();
    const onInput = vi.fn();
    el.addEventListener('uc:input', onInput);

    textarea(el).value = 'sunset beach';
    textarea(el).dispatchEvent(new Event('input', { bubbles: true, composed: true }));

    expect(onInput).toHaveBeenCalledOnce();
    expect((onInput.mock.calls[0]![0] as CustomEvent).detail.value).toBe('sunset beach');
    expect(el.value).toBe('sunset beach');
  });

  it('reflects programmatic value changes (template chips / history) into the textarea', async () => {
    const el = await mount();
    el.value = 'line1\nline2';
    await el.updateComplete;
    expect(textarea(el).value).toBe('line1\nline2');
  });

  it('focusInput() focuses the textarea', async () => {
    const el = await mount();
    const focus = vi.spyOn(textarea(el), 'focus');
    el.focusInput();
    expect(focus).toHaveBeenCalledOnce();
  });

  it('disables the textarea and send button while busy', async () => {
    const el = await mount({ value: 'hi', busy: true });
    expect(textarea(el).disabled).toBe(true);
    expect(sendBtn(el)!.disabled).toBe(true);
    expect(sendBtn(el)!.classList.contains('send--busy')).toBe(true);
  });

  it('hides (collapses) the send button when empty and reveals it otherwise', async () => {
    const el = await mount();
    expect(sendBtn(el)!.hidden).toBe(true);

    el.value = 'hi';
    await el.updateComplete;
    expect(sendBtn(el)!.hidden).toBe(false);
  });

  it('emits uc:send when the send button is clicked', async () => {
    const el = await mount({ value: 'a cat' });
    const onSend = vi.fn();
    el.addEventListener('uc:send', onSend);
    sendBtn(el)!.click();
    expect(onSend).toHaveBeenCalledOnce();
  });
});
