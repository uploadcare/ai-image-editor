import type { UploadcareFile } from '@uploadcare/upload-client';
import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { session } from '../emulator';
import {
  clickDone,
  editorRegion,
  expectCanvasToShow,
  generatedUuid,
  historyChips,
  mount,
  SAMPLE_UUID,
  STAGING,
  sendPrompt,
  type UcAiImageEditorType,
} from './harness';

/** The picker's trigger, named "Pick aspect ratio: <selection>". */
const ratioTrigger = () => page.getByRole('button', { name: /^Pick aspect ratio/ });
const ratioOptions = () => page.getByRole('listbox', { name: 'Pick aspect ratio' }).getByRole('option');

/** Opens the picker and picks the option named `name`. */
async function pickRatio(name: string): Promise<void> {
  await userEvent.click(ratioTrigger());
  await userEvent.click(ratioOptions().filter({ hasText: name }));
}

/**
 * Waits for the run's result on the canvas, commits it, and returns the image info of the file `uc:done` hands the
 * host. The emulator draws a result at the requested ratio (or keeps the source's size when none is sent), so the
 * dimensions show which ratio the editor asked for.
 */
async function committedImage(el: UcAiImageEditorType): Promise<UploadcareFile['imageInfo']> {
  await expectCanvasToShow(await generatedUuid());
  const onDone = vi.fn();
  el.addEventListener('uc:done', onDone);
  await clickDone();
  expect(onDone).toHaveBeenCalledOnce();
  return (onDone.mock.calls[0]![0] as CustomEvent<{ file: UploadcareFile }>).detail.file.imageInfo;
}

/** A result's width over its height. */
const ratioOf = (image: UploadcareFile['imageInfo']) => (image?.width ?? Number.NaN) / (image?.height ?? Number.NaN);

/** The ratio picker: what it offers per mode, the shape of the image it produces, what it restores. */
describe('<uc-ai-image-editor> aspect ratio', () => {
  it('renders the aspect-ratio picker in generate mode (no Auto) and generates at the selected ratio', async () => {
    // 16:9: neither the generate default (3:2) nor the provider's fallback (1:1).
    const el = mount({ ...STAGING, 'aspect-ratios': '3:2 16:9' });

    // Generate mode offers only the standard ratios — no "Auto".
    await userEvent.click(ratioTrigger());
    await expect.poll(() => ratioOptions().elements()).toHaveLength(2);
    await expect.element(ratioOptions().first()).toHaveTextContent('3:2');
    await expect.element(ratioOptions().last()).toHaveTextContent('16:9');

    // Pick 16:9 before the only generate — sending flips to edit.
    await userEvent.click(ratioOptions().last());
    await expect.element(ratioTrigger()).toHaveAccessibleName('Pick aspect ratio: 16:9');
    await sendPrompt('mountain');
    expect(ratioOf(await committedImage(el))).toBeCloseTo(16 / 9, 2);
  });

  it('defaults edit mode to "Auto", which keeps the dimensions of the source image', async () => {
    const el = mount(STAGING);
    el.sourceUuid = SAMPLE_UUID;
    await expect.element(editorRegion('edit')).toBeVisible();
    await expect.element(ratioTrigger()).toHaveAccessibleName('Pick aspect ratio: Auto');

    // The picker leads with an "Auto" entry, named without any w:h numbers.
    await userEvent.click(ratioTrigger());
    await expect.element(ratioOptions().first()).toHaveAccessibleName('Auto');
    await expect.element(ratioOptions().first()).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Escape}');

    await sendPrompt('add a hat');
    // Auto is the default → no aspect_ratio is sent, so the result keeps the source's size.
    const source = session.files.get(SAMPLE_UUID)!.image!;
    expect(await committedImage(el)).toMatchObject({ width: source.width, height: source.height });
  });

  it('renders the aspect-ratio picker in edit mode too', async () => {
    const el = mount(STAGING);
    el.sourceUuid = SAMPLE_UUID;
    await expect.element(editorRegion('edit')).toBeVisible();
    await expect.element(ratioTrigger()).toBeVisible();
  });

  it('reshapes the result to a ratio the user picks in edit mode', async () => {
    const el = mount({ ...STAGING, 'aspect-ratios': '1:1' });
    el.sourceUuid = SAMPLE_UUID;
    await expect.element(editorRegion('edit')).toBeVisible();

    // [Auto, 1:1] in edit mode — pick the concrete ratio to reshape.
    await userEvent.click(ratioTrigger());
    await expect.poll(() => ratioOptions().elements()).toHaveLength(2);
    await userEvent.click(ratioOptions().filter({ hasText: '1:1' }));
    await expect.element(ratioTrigger()).toHaveAccessibleName('Pick aspect ratio: 1:1');

    await sendPrompt('make it square');
    // The source is not square, so a square result means the 1:1 was sent rather than Auto.
    expect(ratioOf(await committedImage(el))).toBe(1);
  });

  it('records the aspect ratio on a history entry and restores it when re-selected', async () => {
    const el = mount({ ...STAGING, 'aspect-ratios': '16:9 1:1' });

    // Generate with 1:1 (generate options are [16:9, 1:1]).
    await pickRatio('1:1');
    await expect.element(ratioTrigger()).toHaveAccessibleName('Pick aspect ratio: 1:1');
    await sendPrompt('a cat');
    await expect.element(editorRegion('edit')).toBeVisible();
    await expect.element(historyChips().first()).toHaveAccessibleName('a cat');
    expect(ratioOf(await committedImage(el))).toBe(1);

    // Change the ratio after the fact (edit options are [Auto, 16:9, 1:1]).
    await pickRatio('16:9');
    await expect.element(ratioTrigger()).toHaveAccessibleName('Pick aspect ratio: 16:9');

    // Re-selecting the history entry restores the 1:1 ratio it was made with.
    await userEvent.click(historyChips().first());
    await expect.element(ratioTrigger()).toHaveAccessibleName('Pick aspect ratio: 1:1');
  });
});
