import { DEMO_FILES } from '@uploadcare/api-emulator';
import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { session } from '../emulator';
import {
  canvasImage,
  clickDone,
  doneButton,
  editorRegion,
  expectCanvasToShow,
  generatedUuid,
  mount,
  promptBox,
  SAMPLE_UUID,
  STAGING,
  sendPrompt,
} from './harness';

/**
 * A run end to end: sending a prompt, what the editor does with the result, and
 * the events a host listens for (`uc:done`, `uc:cancel`).
 */
describe('<uc-ai-image-editor> generation', () => {
  it('auto-enters edit mode after the first successful generation', async () => {
    mount(STAGING);
    await expect.element(editorRegion('generate')).toBeVisible();
    await sendPrompt('a tiger');
    await expectCanvasToShow(await generatedUuid());
    await expect.element(editorRegion('edit')).toBeVisible();
  });

  it('clears the prompt after a successful generation', async () => {
    mount(STAGING);
    await sendPrompt('a tiger');
    await expectCanvasToShow(await generatedUuid());
    await expect.element(promptBox()).toHaveValue('');
  });

  it('generates via the send button, then the primary commits the result with uc:done', async () => {
    const el = mount(STAGING);

    // Primary is disabled until there is a result to commit.
    await expect.element(doneButton()).toBeDisabled();

    await sendPrompt('a tiger');
    const uuid = await generatedUuid();
    await expectCanvasToShow(uuid);

    // Now the primary commits the generated result (it never generates).
    await expect.element(doneButton()).toBeEnabled();
    const onDone = vi.fn();
    el.addEventListener('uc:done', onDone);
    await clickDone();
    expect(onDone).toHaveBeenCalledOnce();
    const detail = onDone.mock.calls[0]![0].detail;
    expect(detail.url).toBe(`https://cdn.example.com/${uuid}/`);
    expect(detail.file.uuid).toBe(uuid);
    expect(detail.file.cdnUrl).toBe(`https://cdn.example.com/${uuid}/`);
  });

  it('includes the UploadcareFile and its uuid in uc:done after a generation', async () => {
    const el = mount(STAGING);
    const onDone = vi.fn();
    el.addEventListener('uc:done', onDone);

    await sendPrompt('make it pop');
    const uuid = await generatedUuid();
    await expectCanvasToShow(uuid);

    await clickDone();
    expect(onDone).toHaveBeenCalledOnce();
    expect(onDone.mock.calls[0]![0].detail.file.uuid).toBe(uuid);
    expect(onDone.mock.calls[0]![0].detail.uuid).toBe(uuid);
  });

  it('reports a refused run with uc:error and its message, and keeps the prompt', async () => {
    // derivativesInstant again, so it wraps the failure and the error comes on the first poll.
    session.use('derivativeFailure', { code: 'content_moderated' }).use('derivativesInstant');
    const el = mount(STAGING);
    const onError = vi.fn();
    el.addEventListener('uc:error', onError);

    await sendPrompt('a tiger');
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent("That prompt isn't allowed. Try describing it differently.");

    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0]![0].detail.error.code).toBe('content_moderated');
    await expect.element(canvasImage()).not.toBeInTheDocument();
    await expect.element(editorRegion('generate')).toBeVisible();
    await expect.element(promptBox()).toHaveValue('a tiger');
  });

  it('fires uc:change with the result when a run lands, and with null when a new source clears it', async () => {
    const el = mount(STAGING);
    const onChange = vi.fn();
    el.addEventListener('uc:change', onChange);

    await sendPrompt('a tiger');
    const uuid = await generatedUuid();
    await expectCanvasToShow(uuid);
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0]![0].detail.result).toMatchObject({
      url: `https://cdn.example.com/${uuid}/`,
      file: { uuid },
    });

    // A host handing over another image drops the result: that source has no history to resume.
    el.sourceUuid = SAMPLE_UUID;
    await expectCanvasToShow(SAMPLE_UUID);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[1]![0].detail).toEqual({ result: null });
  });

  it('dispatches uc:cancel when the cancel button is clicked', async () => {
    const el = mount();
    await el.updateComplete;
    const onCancel = vi.fn();
    el.addEventListener('uc:cancel', onCancel);
    await userEvent.click(page.getByRole('button', { name: 'Cancel', exact: true }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('keeps the primary disabled and fires no uc:done until a result exists (edit mode with a source)', async () => {
    const el = mount(STAGING);
    el.sourceUuid = SAMPLE_UUID;
    await expect.element(editorRegion('edit')).toBeVisible();
    await expectCanvasToShow(SAMPLE_UUID);
    const onDone = vi.fn();
    el.addEventListener('uc:done', onDone);
    // A source image alone is not a result — the primary commits results only.
    await expect.element(doneButton()).toBeDisabled();
    await userEvent.click(doneButton(), { force: true });
    expect(onDone).not.toHaveBeenCalled();
  });

  it('does not dispatch uc:done when there is no result (generate mode)', async () => {
    const el = mount();
    const onDone = vi.fn();
    el.addEventListener('uc:done', onDone);
    await expect.element(doneButton()).toBeDisabled();
    await userEvent.click(doneButton(), { force: true });
    expect(onDone).not.toHaveBeenCalled();
  });

  it('applies an async secure-delivery resolver to the canvas preview', async () => {
    const el = mount(STAGING);
    // The signed URL stays on the emulated CDN, so the preview loads instead of reaching for a proxy that doesn't exist.
    el.secureDeliveryProxyUrlResolver = async (url: string) => `${url}?token=signed`;
    await sendPrompt('a tiger');
    const uuid = await generatedUuid();
    await expect
      .element(canvasImage())
      .toHaveAttribute(
        'src',
        expect.stringMatching(new RegExp(`^https://cdn\\.example\\.com/${uuid}/.*\\?token=signed$`)),
      );
  });

  it('aborts in-flight generation and shows the new source when source changes', async () => {
    // The status poll never answers, so the job is still running when the source changes.
    session.on('GET /derivative/status/', () => new Promise<never>(() => {}));
    const el = mount({ ...STAGING, 'source-uuid': DEMO_FILES[0] });
    await sendPrompt('try');
    // The prompt box locks while the run is in flight.
    await expect.element(promptBox()).toBeDisabled();

    // Change source mid-flight — this aborts the in-flight generation.
    el.sourceUuid = DEMO_FILES[1];

    // After the abort, the displayed image should be the new source (no result override).
    await expectCanvasToShow(DEMO_FILES[1]!);
    await expect.element(promptBox()).toBeEnabled();
  });
});
