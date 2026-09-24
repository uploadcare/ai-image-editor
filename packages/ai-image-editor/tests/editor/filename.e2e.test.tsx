import type { UploadcareFile } from '@uploadcare/upload-client';
import { describe, expect, it, vi } from 'vitest';
import { clickSend, editorMode, mount, SAMPLE_UUID, STAGING, stubFetch, typePrompt } from './harness';

/** What the result is named: the source's name, a resolver, or a fixed string. */
describe('<uc-ai-image-editor> result filename', () => {
  it('names the result after the source file in edit mode (preserves the original name)', async () => {
    const stub = stubFetch({ uuid: 'edited' });
    const el = mount(STAGING);
    // Inject the source's file info (as the plugin does) — it carries the uuid
    // (→ edit mode) and its originalFilename is the default output name.
    el.sourceFileInfo = {
      uuid: SAMPLE_UUID,
      originalFilename: 'holiday-photo.jpg',
      imageInfo: null,
    } as unknown as UploadcareFile;
    await el.updateComplete;
    expect(editorMode(el)).toBe('edit');

    typePrompt(el, 'add a hat');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(stub.generateBodies.length).toBe(1));
    // The edit result is named after the source, not the provider's default.
    expect(stub.generateBodies[0]!.filename).toBe('holiday-photo.jpg');
  });

  it('names the result via the outputFilename resolver (original + counter)', async () => {
    const stub = stubFetch({ uuid: 'r1' });
    const el = mount(STAGING);
    // A fresh uuid with no persisted lineage → counter starts at 1.
    el.sourceFileInfo = {
      uuid: 'resolver-test-uuid-0001',
      originalFilename: 'cat.png',
      imageInfo: null,
    } as unknown as UploadcareFile;
    // First generation in the session → counter is 1, original is the source's.
    el.outputFilename = (original, counter) => `${original ?? 'ai'}-edit-${counter}`;
    await el.updateComplete;

    typePrompt(el, 'add a hat');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(stub.generateBodies.length).toBe(1));
    expect(stub.generateBodies[0]!.filename).toBe('cat.png-edit-1');
  });

  it('uses a static outputFilename string verbatim', async () => {
    const stub = stubFetch({ uuid: 'r1' });
    const el = mount(STAGING);
    el.outputFilename = 'my-art.png';
    await el.updateComplete;

    typePrompt(el, 'a sunset');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(stub.generateBodies.length).toBe(1));
    expect(stub.generateBodies[0]!.filename).toBe('my-art.png');
  });
});
