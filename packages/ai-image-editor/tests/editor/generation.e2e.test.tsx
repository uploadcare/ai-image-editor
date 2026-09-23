import { describe, expect, it, vi } from 'vitest';
import {
  canvasUrl,
  clickPrimary,
  clickSend,
  editorMode,
  mount,
  primaryBtn,
  SAMPLE_UUID,
  STAGING,
  stubFetch,
  typePrompt,
} from './harness';

/**
 * A run end to end: sending a prompt, what the editor does with the result, and
 * the events a host listens for (`uc:done`, `uc:cancel`).
 */
describe('<uc-ai-image-editor> generation', () => {
  it('auto-enters edit mode after the first successful generation', async () => {
    stubFetch({ uuid: 'result' });
    const el = mount(STAGING);
    await el.updateComplete;
    expect(editorMode(el)).toBe('generate');
    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(canvasUrl(el)).toBe('https://cdn.example.com/result/'));
    await el.updateComplete;
    expect(editorMode(el)).toBe('edit');
  });

  it('clears the prompt after a successful generation', async () => {
    stubFetch({ uuid: 'result' });
    const el = mount(STAGING);
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('uc-ai-prompt-row')!.shadowRoot!.querySelector('textarea')!;
    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(canvasUrl(el)).toBe('https://cdn.example.com/result/'));
    await el.updateComplete;
    expect(input.value).toBe('');
  });

  it('generates via the send button, then the primary commits the result with uc:done', async () => {
    stubFetch({ uuid: 'result' });
    const el = mount(STAGING);
    await el.updateComplete;

    // Primary is disabled until there is a result to commit.
    expect(primaryBtn(el).disabled).toBe(true);

    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => {
      expect(canvasUrl(el)).toBe('https://cdn.example.com/result/');
    });
    await el.updateComplete;

    // Now the primary commits the generated result (it never generates).
    expect(primaryBtn(el).disabled).toBe(false);
    const onDone = vi.fn();
    el.addEventListener('uc:done', onDone);
    clickPrimary(el);
    expect(onDone).toHaveBeenCalledTimes(1);
    const detail = onDone.mock.calls[0]![0].detail;
    expect(detail.url).toBe('https://cdn.example.com/result/');
    expect(detail.file.uuid).toBe('result');
    expect(detail.file.cdnUrl).toBe('https://cdn.example.com/result/');
  });

  it('includes the UploadcareFile and its uuid in uc:done after a generation', async () => {
    stubFetch({ uuid: 'result-123' });
    const el = mount(STAGING);
    await el.updateComplete;
    const onDone = vi.fn();
    el.addEventListener('uc:done', onDone);

    typePrompt(el, 'make it pop');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(canvasUrl(el)).toBe('https://cdn.example.com/result-123/'));
    await el.updateComplete;

    clickPrimary(el);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone.mock.calls[0]![0].detail.file.uuid).toBe('result-123');
    expect(onDone.mock.calls[0]![0].detail.uuid).toBe('result-123');
  });

  it.skip('fires uc:change as the current result appears and clears', async () => {
    stubFetch({ uuid: 'result' });
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
    expect(first.result.url).toBe('https://cdn.example.com/result/');
    expect(first.result.file.uuid).toBe('result');

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
    stubFetch({ uuid: 'result' });
    const el = mount(STAGING);
    el.secureDeliveryProxyUrlResolver = async (url: string) => `https://signed.example/${encodeURIComponent(url)}`;
    await el.updateComplete;
    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    const raw = 'https://cdn.example.com/result/';
    await vi.waitFor(() => expect(canvasUrl(el)).toBe(`https://signed.example/${encodeURIComponent(raw)}`));
  });

  it('aborts in-flight generation and shows the new source when source changes', async () => {
    // Status hangs until the request is aborted.
    stubFetch({
      status: (signal) =>
        new Promise((_res, rej) => {
          signal?.addEventListener('abort', () => rej(new DOMException('Aborted', 'AbortError')), { once: true });
        }),
    });
    // Non-UUID-shaped ids keep the CDN preview helper from rewriting the URL,
    // so the canvas URL is the bare resolved source.
    const el = mount({ ...STAGING, 'source-uuid': 'first-uuid' });
    await el.updateComplete;

    typePrompt(el, 'try');
    await el.updateComplete;
    clickSend(el);

    // Change source mid-flight — this aborts the in-flight generation.
    el.sourceUuid = 'second-uuid';
    await el.updateComplete;

    // After the abort, the displayed image should be the new source (no result override).
    await vi.waitFor(() => {
      expect(canvasUrl(el)).toBe('https://cdn.example.com/second-uuid/');
    });
  });
});
