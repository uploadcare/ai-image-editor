import { DEMO_FILES } from '@uploadcare/api-emulator';
import { describe, expect, it, vi } from 'vitest';
import { enLocale } from '../../src/shared/i18n/en';
import { session } from '../emulator';
import {
  canvasUrl,
  clickPrimary,
  clickSend,
  editorMode,
  mount,
  primaryBtn,
  resultUuid,
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
    const el = mount(STAGING);
    await el.updateComplete;
    expect(editorMode(el)).toBe('generate');
    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(canvasUrl(el)).toContain(`https://cdn.example.com/${resultUuid()}/`));
    await el.updateComplete;
    expect(editorMode(el)).toBe('edit');
  });

  it('clears the prompt after a successful generation', async () => {
    const el = mount(STAGING);
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('uc-ai-prompt-row')!.shadowRoot!.querySelector('textarea')!;
    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(canvasUrl(el)).toContain(`https://cdn.example.com/${resultUuid()}/`));
    await el.updateComplete;
    expect(input.value).toBe('');
  });

  it('generates via the send button, then the primary commits the result with uc:done', async () => {
    const el = mount(STAGING);
    await el.updateComplete;

    // Primary is disabled until there is a result to commit.
    expect(primaryBtn(el).disabled).toBe(true);

    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => {
      expect(canvasUrl(el)).toContain(`https://cdn.example.com/${resultUuid()}/`);
    });
    await el.updateComplete;

    // Now the primary commits the generated result (it never generates).
    expect(primaryBtn(el).disabled).toBe(false);
    const onDone = vi.fn();
    el.addEventListener('uc:done', onDone);
    clickPrimary(el);
    expect(onDone).toHaveBeenCalledTimes(1);
    const detail = onDone.mock.calls[0]![0].detail;
    expect(detail.url).toBe(`https://cdn.example.com/${resultUuid()}/`);
    expect(detail.file.uuid).toBe(resultUuid());
    expect(detail.file.cdnUrl).toBe(`https://cdn.example.com/${resultUuid()}/`);
  });

  it('includes the UploadcareFile and its uuid in uc:done after a generation', async () => {
    const el = mount(STAGING);
    await el.updateComplete;
    const onDone = vi.fn();
    el.addEventListener('uc:done', onDone);

    typePrompt(el, 'make it pop');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(canvasUrl(el)).toContain(`https://cdn.example.com/${resultUuid()}/`));
    await el.updateComplete;

    clickPrimary(el);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone.mock.calls[0]![0].detail.file.uuid).toBe(resultUuid());
    expect(onDone.mock.calls[0]![0].detail.uuid).toBe(resultUuid());
  });

  it('reports a refused run with uc:error and its message, and keeps the prompt', async () => {
    // derivativesInstant again, so it wraps the failure and the error comes on the first poll.
    session.use('derivativeFailure', { code: 'content_moderated' }).use('derivativesInstant');
    const el = mount(STAGING);
    await el.updateComplete;
    const onError = vi.fn();
    el.addEventListener('uc:error', onError);

    typePrompt(el, 'a tiger');
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
    expect(input.value).toBe('a tiger');
  });

  it.skip('fires uc:change as the current result appears and clears', async () => {
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
    expect(first.result.url).toBe(`https://cdn.example.com/${resultUuid()}/`);
    expect(first.result.file.uuid).toBe(resultUuid());

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
    const el = mount(STAGING);
    el.secureDeliveryProxyUrlResolver = async (url: string) => `https://signed.example/${encodeURIComponent(url)}`;
    await el.updateComplete;
    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() =>
      expect(canvasUrl(el)).toContain(
        `https://signed.example/${encodeURIComponent(`https://cdn.example.com/${resultUuid()}/`)}`,
      ),
    );
  });

  it('aborts in-flight generation and shows the new source when source changes', async () => {
    // The status poll never answers, so the job is still running when the source changes.
    session.on('GET /derivative/status/', () => new Promise<never>(() => {}));
    const el = mount({ ...STAGING, 'source-uuid': DEMO_FILES[0] });
    await el.updateComplete;

    typePrompt(el, 'try');
    await el.updateComplete;
    clickSend(el);

    // Change source mid-flight — this aborts the in-flight generation.
    el.sourceUuid = DEMO_FILES[1];
    await el.updateComplete;

    // After the abort, the displayed image should be the new source (no result override).
    await vi.waitFor(() => {
      expect(canvasUrl(el)).toContain(`https://cdn.example.com/${DEMO_FILES[1]}/`);
    });
  });
});
