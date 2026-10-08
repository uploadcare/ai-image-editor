import { describe, expect, it, vi } from 'vitest';
import { session } from '../emulator';
import { clickSend, editorMode, mount, SAMPLE_UUID, STAGING, typePrompt } from './harness';

/**
 * The body of every derivative POST (generate or edit) the emulator received. The
 * emulator ignores the ratio, so the request is the only place it shows.
 */
const derivativeBodies = (): Promise<Array<Record<string, unknown>>> =>
  Promise.all(
    session.requests
      .filter((request) => request.method === 'POST' && new URL(request.url).pathname.startsWith('/derivative/'))
      .map((request) => request.clone().json()),
  );

/** The ratio picker: what it offers per mode, what it sends, what it restores. */
describe('<uc-ai-image-editor> aspect ratio', () => {
  it('renders the aspect-ratio picker in generate mode (no Auto) and sends the selected ratio', async () => {
    // 3:2: neither the picker's default (the first ratio) nor the provider's fallback (1:1).
    const el = mount({ ...STAGING, 'aspect-ratios': '16:9 3:2' });
    await el.updateComplete;

    const ratio = el.shadowRoot!.querySelector('uc-ai-aspect-ratio')!;
    expect(ratio).toBeTruthy();

    // Generate mode offers only the standard ratios — no "Auto".
    (ratio.shadowRoot!.querySelector('.trigger') as HTMLButtonElement).click();
    await el.updateComplete;
    const options = Array.from(ratio.shadowRoot!.querySelectorAll('.option')) as HTMLButtonElement[];
    expect(options.length).toBe(2);

    // Pick the second option (3:2) before the only generate — sending flips to edit.
    options[1]!.click();
    await el.updateComplete;
    typePrompt(el, 'mountain');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(async () => expect(await derivativeBodies()).toHaveLength(1));
    const [body] = await derivativeBodies();
    expect(body!.aspect_ratio).toEqual([3, 2]);
  });

  it('defaults edit mode to "Auto" and omits aspect_ratio (preserving the source AR)', async () => {
    const el = mount(STAGING);
    el.sourceUuid = SAMPLE_UUID;
    await el.updateComplete;
    expect(editorMode(el)).toBe('edit');

    // The picker leads with an "Auto" entry (square icon, no w:h numbers).
    const ratio = el.shadowRoot!.querySelector('uc-ai-aspect-ratio')!;
    (ratio.shadowRoot!.querySelector('.trigger') as HTMLButtonElement).click();
    await el.updateComplete;
    const options = Array.from(ratio.shadowRoot!.querySelectorAll('.option')) as HTMLButtonElement[];
    expect(options[0]!.textContent).toContain('Auto');
    // "Auto" reserves the ratio column but shows no "w:h" numbers.
    expect(options[0]!.querySelector('.option-ratio')?.textContent).toBe('');

    typePrompt(el, 'add a hat');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(async () => expect(await derivativeBodies()).toHaveLength(1));
    const [body] = await derivativeBodies();
    // Auto is the default → no aspect_ratio on the wire; backend preserves it.
    expect(body!.aspect_ratio).toBeUndefined();
    expect(body!.source).toBe(SAMPLE_UUID);
  });

  it('renders the aspect-ratio picker in edit mode too', async () => {
    const el = mount(STAGING);
    el.sourceUuid = SAMPLE_UUID;
    await el.updateComplete;
    expect(editorMode(el)).toBe('edit');
    expect(el.shadowRoot!.querySelector('uc-ai-aspect-ratio')).toBeTruthy();
  });

  it('sends an explicit ratio when the user reshapes in edit mode', async () => {
    const el = mount({ ...STAGING, 'aspect-ratios': '1:1' });
    el.sourceUuid = SAMPLE_UUID;
    await el.updateComplete;

    const ratio = el.shadowRoot!.querySelector('uc-ai-aspect-ratio')!;
    (ratio.shadowRoot!.querySelector('.trigger') as HTMLButtonElement).click();
    await el.updateComplete;
    // [Auto, 1:1] in edit mode — pick the concrete ratio to reshape.
    const options = Array.from(ratio.shadowRoot!.querySelectorAll('.option')) as HTMLButtonElement[];
    expect(options.length).toBe(2);
    options[1]!.click();
    await el.updateComplete;

    typePrompt(el, 'make it square');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(async () => expect(await derivativeBodies()).toHaveLength(1));
    const [body] = await derivativeBodies();
    expect(body!.aspect_ratio).toEqual([1, 1]);
  });

  it('records the aspect ratio on a history entry and restores it when re-selected', async () => {
    const el = mount({ ...STAGING, 'aspect-ratios': '16:9 1:1' });
    await el.updateComplete;

    const ratioEl = () => el.shadowRoot!.querySelector('uc-ai-aspect-ratio')!;
    const selected = () => (ratioEl() as unknown as { selected: unknown }).selected;
    const pickOption = async (i: number) => {
      (ratioEl().shadowRoot!.querySelector('.trigger') as HTMLButtonElement).click();
      await el.updateComplete;
      (ratioEl().shadowRoot!.querySelectorAll('.option')[i] as HTMLButtonElement).click();
      await el.updateComplete;
    };

    // Generate with 1:1 (generate options are [16:9, 1:1]).
    await pickOption(1);
    expect(selected()).toEqual([1, 1]);
    typePrompt(el, 'a cat');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(editorMode(el)).toBe('edit'));
    await el.updateComplete;

    const history = el.shadowRoot!.querySelector('uc-ai-history') as unknown as {
      entries: Array<{ ratio: unknown }>;
    };
    expect(history.entries[0]!.ratio).toEqual([1, 1]);

    // Change the ratio after the fact (edit options are [Auto, 16:9, 1:1]).
    await pickOption(1);
    expect(selected()).toEqual([16, 9]);

    // Re-selecting the history entry restores the 1:1 ratio it was made with.
    const entry = history.entries[0];
    el.shadowRoot!.querySelector('uc-ai-history')!.dispatchEvent(
      new CustomEvent('uc:select', { detail: { entry }, bubbles: true, composed: true }),
    );
    await el.updateComplete;
    expect(selected()).toEqual([1, 1]);
  });
});
