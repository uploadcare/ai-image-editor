import { DEMO_FILES } from '@uploadcare/api-emulator';
import type { UploadcareFile } from '@uploadcare/upload-client';
import { describe, expect, it, vi } from 'vitest';
import type { UcAiImageEditorType } from './harness';
import { clickDone, doneButton, editorRegion, mount, SAMPLE_UUID, STAGING, sendPrompt } from './harness';

/**
 * What the result is named: the source's name, a resolver, or a fixed string.
 * The emulator stores a result under the name the editor asked for, so the
 * committed file's `originalFilename` is the name the run produced.
 */
describe('<uc-ai-image-editor> result filename', () => {
  /** Runs the test's one generation, commits it, and answers the committed file's name. */
  const producedFilename = async (el: UcAiImageEditorType, prompt: string) => {
    await sendPrompt(prompt);
    // The primary commits a result, so it is enabled once the run has one.
    await expect.element(doneButton()).toBeEnabled();
    const onDone = vi.fn();
    el.addEventListener('uc:done', onDone);
    await clickDone();
    expect(onDone).toHaveBeenCalledOnce();
    return (onDone.mock.calls[0]![0].detail.file as UploadcareFile).originalFilename;
  };

  it('names the result after the source file in edit mode (preserves the original name)', async () => {
    const el = mount(STAGING);
    // Inject the source's file info (as the plugin does) — it carries the uuid
    // (→ edit mode) and its originalFilename is the default output name.
    el.sourceFileInfo = {
      uuid: SAMPLE_UUID,
      originalFilename: 'holiday-photo.jpg',
      imageInfo: null,
    } as unknown as UploadcareFile;
    await expect.element(editorRegion('edit')).toBeVisible();

    // The edit result is named after the source, not the provider's default.
    expect(await producedFilename(el, 'add a hat')).toBe('holiday-photo.jpg');
  });

  it('names the result via the outputFilename resolver (original + counter)', async () => {
    const el = mount(STAGING);
    // A seeded image no test has edited, so no persisted lineage → counter starts at 1.
    el.sourceFileInfo = {
      uuid: DEMO_FILES[1],
      originalFilename: 'cat.png',
      imageInfo: null,
    } as unknown as UploadcareFile;
    // First generation in the session → counter is 1, original is the source's.
    el.outputFilename = (original, counter) => `${original ?? 'ai'}-edit-${counter}`;
    await el.updateComplete;

    expect(await producedFilename(el, 'add a hat')).toBe('cat.png-edit-1');
  });

  it('uses a static outputFilename string verbatim', async () => {
    const el = mount(STAGING);
    el.outputFilename = 'my-art.png';
    await el.updateComplete;

    expect(await producedFilename(el, 'a sunset')).toBe('my-art.png');
  });
});
