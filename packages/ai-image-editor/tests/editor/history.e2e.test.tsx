import { DEMO_FILES } from '@uploadcare/api-emulator';
import type { UploadcareFile } from '@uploadcare/upload-client';
import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import {
  canvasImage,
  editorMode,
  editorRegion,
  expectCanvasToShow,
  historyChips,
  historyEl,
  mount,
  SAMPLE_UUID,
  STAGING,
  sendPrompt,
} from './harness';

/**
 * The history strip and the lineage behind it, including what survives a reload
 * (persisted per pubkey in localStorage).
 */
describe('<uc-ai-image-editor> history', () => {
  it('populates the history strip after a successful generation', async () => {
    mount(STAGING);
    await sendPrompt('a tiger');
    await expect.poll(() => historyChips().elements()).toHaveLength(1);
  });

  it('shows the generated result as a selected history chip named after its prompt', async () => {
    mount(STAGING);
    await sendPrompt('a tiger');
    // The current result's chip is marked selected.
    await expect.element(historyChips().first()).toHaveAccessibleName('a tiger');
    await expect.element(historyChips().first()).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows and persists the original image in the history strip when editing (plugin path)', async () => {
    localStorage.removeItem(`uc-ai-image-editor/history/${STAGING.pubkey}`);
    const el = mount(STAGING);
    // The plugin hands the editor the source's file info directly.
    el.sourceFileInfo = { uuid: SAMPLE_UUID } as UploadcareFile;
    await expect.element(editorRegion('edit')).toBeVisible();

    // The strip mounts with the original as its base entry — the starting point
    // you can revert to — once the source's display url has resolved: one
    // selected chip showing the source's thumbnail.
    await expect.poll(() => historyChips().elements()).toHaveLength(1);
    await expect.element(historyChips().first()).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => historyChips().element().querySelector('img')?.src).toContain(`/${SAMPLE_UUID}/`);

    // …and the original is persisted as a root node so it survives a reload.
    const stored = JSON.parse(localStorage.getItem(`uc-ai-image-editor/history/${STAGING.pubkey}`) ?? '{}');
    expect(stored[SAMPLE_UUID]?.source).toBe(null);
  });

  it('resumes on the latest result (not the original) when reopening a lineage', async () => {
    // A seeded image, so the CDN serves it and the canvas can show it.
    const LATEST = DEMO_FILES[1]!;
    const key = `uc-ai-image-editor/history/${STAGING.pubkey}`;
    // Seed a prior edit of SAMPLE_UUID into storage (a result whose parent is it).
    localStorage.setItem(
      key,
      JSON.stringify({
        [LATEST]: {
          uuid: LATEST,
          source: SAMPLE_UUID,
          url: `https://cdn.example.com/${LATEST}/`,
          prompt: 'edited',
          mode: 'edit',
          ratio: null,
          file: { uuid: LATEST, cdnUrl: `https://cdn.example.com/${LATEST}/`, originalFilename: 'r.png' },
          createdAt: Date.now(),
        },
      }),
    );

    const el = mount(STAGING);
    el.sourceFileInfo = { uuid: SAMPLE_UUID } as UploadcareFile;
    await expect.element(editorRegion('edit')).toBeVisible();

    // The canvas (and shimmer) resume on the latest result, not the original.
    await expectCanvasToShow(LATEST);
    await expect.element(canvasImage()).not.toHaveAttribute('src', expect.stringContaining(SAMPLE_UUID));
  });

  it('does not render Start over in edit mode opened with a source (uploader AI-edit)', async () => {
    const el = mount(STAGING);
    el.sourceUuid = SAMPLE_UUID;
    await el.updateComplete;
    await vi.waitFor(() => expect(editorMode(el)).toBe('edit'));
    await el.updateComplete;

    // Editing an existing image has nothing to "start over" to — the affordance
    // is absent (and, with no generation history yet, the strip isn't mounted).
    const history = historyEl(el);
    const startOver = history?.shadowRoot?.querySelector('.startover__btn') ?? null;
    expect(startOver).toBeNull();
  });

  it.skip('returns to generate mode after Start over (from the history strip)', async () => {
    mount(STAGING);
    await sendPrompt('a tiger');
    await expect.element(editorRegion('edit')).toBeVisible();

    await userEvent.click(page.getByRole('button', { name: 'Start over' }));
    await expect.element(editorRegion('generate')).toBeVisible();
    await expect.element(canvasImage()).not.toBeInTheDocument();
    // Start over also clears the prompt history (the strip unmounts).
    await expect.element(page.getByRole('toolbar', { name: 'Recent prompts' })).not.toBeInTheDocument();
  });
});
