// TEMPORARY: file: dependency, see tests/commands.ts.
import { CONTENT_MODERATED_PROMPT } from '@uploadcare/api-emulator';
import { describe, expect, it, vi } from 'vitest';
import { enLocale } from '../../src/shared/i18n/en';
import {
  canvasUrl,
  clickPrimary,
  clickSend,
  editorMode,
  installFetch,
  mount,
  primaryBtn,
  recordRequests,
  SAMPLE_UUID,
  STAGING,
  typePrompt,
} from './harness';

/**
 * A run end to end: sending a prompt, what the editor does with the result, and
 * the events a host listens for (`uc:done`, `uc:cancel`).
 */
describe('<uc-ai-image-editor> generation', () => {
  it('auto-enters edit mode after the first successful generation', async () => {
    const { results } = recordRequests();
    const el = mount(STAGING);
    await el.updateComplete;
    expect(editorMode(el)).toBe('generate');
    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(canvasUrl(el)).toContain(`https://cdn.example.com/${results[0]}/`));
    await el.updateComplete;
    expect(editorMode(el)).toBe('edit');
  });

  it('clears the prompt after a successful generation', async () => {
    const { results } = recordRequests();
    const el = mount(STAGING);
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('uc-ai-prompt-row')!.shadowRoot!.querySelector('textarea')!;
    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(canvasUrl(el)).toContain(`https://cdn.example.com/${results[0]}/`));
    await el.updateComplete;
    expect(input.value).toBe('');
  });

  it('generates via the send button, then the primary commits the result with uc:done', async () => {
    const { results } = recordRequests();
    const el = mount(STAGING);
    await el.updateComplete;

    // Primary is disabled until there is a result to commit.
    expect(primaryBtn(el).disabled).toBe(true);

    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => {
      expect(canvasUrl(el)).toContain(`https://cdn.example.com/${results[0]}/`);
    });
    await el.updateComplete;

    // Now the primary commits the generated result (it never generates).
    expect(primaryBtn(el).disabled).toBe(false);
    const onDone = vi.fn();
    el.addEventListener('uc:done', onDone);
    clickPrimary(el);
    expect(onDone).toHaveBeenCalledTimes(1);
    const detail = onDone.mock.calls[0]![0].detail;
    expect(detail.url).toBe(`https://cdn.example.com/${results[0]}/`);
    expect(detail.file.uuid).toBe(results[0]);
    expect(detail.file.cdnUrl).toBe(`https://cdn.example.com/${results[0]}/`);
  });

  it('includes the UploadcareFile and its uuid in uc:done after a generation', async () => {
    const { results } = recordRequests();
    const el = mount(STAGING);
    await el.updateComplete;
    const onDone = vi.fn();
    el.addEventListener('uc:done', onDone);

    typePrompt(el, 'make it pop');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(canvasUrl(el)).toContain(`https://cdn.example.com/${results[0]}/`));
    await el.updateComplete;

    clickPrimary(el);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone.mock.calls[0]![0].detail.file.uuid).toBe(results[0]);
    expect(onDone.mock.calls[0]![0].detail.uuid).toBe(results[0]);
  });

  it('reports a refused run with uc:error and its message, and keeps the prompt', async () => {
    const el = mount(STAGING);
    await el.updateComplete;
    const onError = vi.fn();
    el.addEventListener('uc:error', onError);

    typePrompt(el, CONTENT_MODERATED_PROMPT);
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    await el.updateComplete;

    expect(onError.mock.calls[0]![0].detail.error.code).toBe('content_moderated');
    expect(el.shadowRoot!.querySelector('.error-box')?.textContent?.trim()).toBe(
      enLocale['ai-image-editor-error-content_moderated'],
    );
    expect(canvasUrl(el)).toBeNull();
    expect(editorMode(el)).toBe('generate');
    const input = el.shadowRoot!.querySelector('uc-ai-prompt-row')!.shadowRoot!.querySelector('textarea')!;
    expect(input.value).toBe(CONTENT_MODERATED_PROMPT);
  });

  it.skip('fires uc:change as the current result appears and clears', async () => {
    const { results } = recordRequests();
    const el = mount(STAGING);
    await el.updateComplete;
    const onChange = vi.fn();
    el.addEventListener('uc:change', onChange);

    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1);
    });
    const first = onChange.mock.calls[0]![0].detail;
    expect(first.result.url).toBe(`https://cdn.example.com/${results[0]}/`);
    expect(first.result.file.uuid).toBe(results[0]);

    // Start over clears the current result -> uc:change with null.
    await el.updateComplete;
    const history = el.shadowRoot!.querySelector('uc-ai-history')!;
    const startOver = history.shadowRoot!.querySelector('.startover__btn') as HTMLButtonElement;
    startOver.click();
    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(2);
    });
    expect(onChange.mock.calls[1]![0].detail.result).toBeNull();
  });

  it('dispatches uc:cancel when the cancel button is clicked', async () => {
    const el = mount();
    await el.updateComplete;
    const onCancel = vi.fn();
    el.addEventListener('uc:cancel', onCancel);
    const footer = el.shadowRoot!.querySelector('uc-ai-footer')!;
    (footer.shadowRoot!.querySelector('.btn--ghost') as HTMLButtonElement).click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('keeps the primary disabled and fires no uc:done until a result exists (edit mode with a source)', async () => {
    const el = mount(STAGING);
    el.sourceUuid = SAMPLE_UUID;
    await el.updateComplete;
    expect(editorMode(el)).toBe('edit');
    const onDone = vi.fn();
    el.addEventListener('uc:done', onDone);
    // A source image alone is not a result — the primary commits results only.
    expect(primaryBtn(el).disabled).toBe(true);
    clickPrimary(el);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('does not dispatch uc:done when there is no result (generate mode)', async () => {
    const el = mount();
    await el.updateComplete;
    const onDone = vi.fn();
    el.addEventListener('uc:done', onDone);
    expect(primaryBtn(el).disabled).toBe(true);
    primaryBtn(el).click();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('applies an async secure-delivery resolver to the canvas preview', async () => {
    const { results } = recordRequests();
    const el = mount(STAGING);
    el.secureDeliveryProxyUrlResolver = async (url: string) => `https://signed.example/${encodeURIComponent(url)}`;
    await el.updateComplete;
    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() =>
      expect(canvasUrl(el)).toContain(
        `https://signed.example/${encodeURIComponent(`https://cdn.example.com/${results[0]}/`)}`,
      ),
    );
  });

  it('aborts in-flight generation and shows the new source when source changes', async () => {
    // The job must still be running when the source changes, so the status
    // poll hangs until it is aborted — a race the emulator, which answers at
    // once, can't hold open. The job POST is answered here too: the emulator
    // would refuse these made-up sources before the poll ever started.
    installFetch(async (_input, init) =>
      init?.method === 'POST'
        ? new Response(JSON.stringify({ type: 'job', job_id: 'job-1' }), {
            headers: { 'Content-Type': 'application/json' },
          })
        : new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
              once: true,
            });
          }),
    );
    const el = mount({ ...STAGING, 'source-uuid': '00000000-0000-4000-8000-0000000000f1' });
    await el.updateComplete;

    typePrompt(el, 'try');
    await el.updateComplete;
    clickSend(el);

    // Change source mid-flight — this aborts the in-flight generation.
    el.sourceUuid = '00000000-0000-4000-8000-0000000000f2';
    await el.updateComplete;

    // After the abort, the displayed image should be the new source (no result override).
    await vi.waitFor(() => {
      expect(canvasUrl(el)).toContain('https://cdn.example.com/00000000-0000-4000-8000-0000000000f2/');
    });
  });
});
