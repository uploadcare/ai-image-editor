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
const sendBtn = (el: UcAiPromptRow) => el.shadowRoot!.querySelector('.icon-btn--primary');
const historyBtn = (el: UcAiPromptRow) => el.shadowRoot!.querySelector('[data-testid="history-btn"]');

const keydown = (el: UcAiPromptRow, init: KeyboardEventInit) =>
  textarea(el).dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, composed: true, ...init }));

describe('UcAiPromptRow', () => {
  it('renders a multiline textarea instead of a single-line input', async () => {
    const el = await mount({ placeholder: 'Describe your image' });
    expect(textarea(el)).toBeTruthy();
    expect(el.shadowRoot!.querySelector('input')).toBeNull();
    expect(textarea(el).placeholder).toBe('Describe your image');
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

  it('disables the textarea while busy', async () => {
    const el = await mount({ value: 'hi', busy: true });
    expect(textarea(el).disabled).toBe(true);
    expect((sendBtn(el) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the send button only when the value is non-empty', async () => {
    const el = await mount();
    expect(sendBtn(el)).toBeNull();

    el.value = 'hi';
    await el.updateComplete;
    expect(sendBtn(el)).toBeTruthy();
  });

  it('shows the history button only in edit mode with an empty value', async () => {
    const el = await mount({ mode: 'edit' });
    expect(historyBtn(el)).toBeTruthy();

    el.value = 'x';
    await el.updateComplete;
    expect(historyBtn(el)).toBeNull();
  });
});
