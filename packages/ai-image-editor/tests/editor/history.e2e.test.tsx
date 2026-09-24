import type { UploadcareFile } from '@uploadcare/upload-client';
import { describe, expect, it, vi } from 'vitest';
import {
  canvasUrl,
  clickSend,
  editorMode,
  historyEl,
  mount,
  SAMPLE_UUID,
  STAGING,
  stubFetch,
  typePrompt,
} from './harness';

/**
 * The history strip and the lineage behind it, including what survives a reload
 * (persisted per pubkey in localStorage).
 */
describe('<uc-ai-image-editor> history', () => {
  it('populates the history strip after a successful generation', async () => {
    stubFetch();
    const el = mount(STAGING);
    await el.updateComplete;
    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => {
      expect(historyEl(el)?.entries.length).toBe(1);
    });
  });

  it('shows the generated result as a selectable history chip', async () => {
    stubFetch();
    const el = mount(STAGING);
    await el.updateComplete;
    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(historyEl(el)?.entries.length).toBe(1));
    await el.updateComplete;

    const history = historyEl(el)!;
    const chips = history.shadowRoot!.querySelectorAll('.chip');
    expect(chips.length).toBe(1);
    // The current result's chip is marked selected.
    expect(history.shadowRoot!.querySelector('.chip--selected')).toBeTruthy();
  });

  it('shows and persists the original image in the history strip when editing (plugin path)', async () => {
    localStorage.removeItem(`uc-ai-image-editor/history/${STAGING.pubkey}`);
    const el = mount(STAGING);
    // The plugin hands the editor the source's file info directly.
    el.sourceFileInfo = { uuid: SAMPLE_UUID } as UploadcareFile;
    await el.updateComplete;
    await vi.waitFor(() => expect(editorMode(el)).toBe('edit'));

    // The strip mounts with the original as its base entry — the starting point
    // you can revert to — once the source's display url has resolved.
    await vi.waitFor(() => {
      const strip = historyEl(el) as (HTMLElement & { entries: Array<{ file: { uuid: string } }> }) | null;
      expect(strip).not.toBeNull();
      expect(strip!.entries.some((entry) => entry.file.uuid === SAMPLE_UUID)).toBe(true);
    });

    // …and the original is persisted as a root node so it survives a reload.
    const stored = JSON.parse(localStorage.getItem(`uc-ai-image-editor/history/${STAGING.pubkey}`) ?? '{}');
    expect(stored[SAMPLE_UUID]?.source).toBe(null);
  });

  it('resumes on the latest result (not the original) when reopening a lineage', async () => {
    const LATEST = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
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
    await el.updateComplete;
    await vi.waitFor(() => expect(editorMode(el)).toBe('edit'));

    // The canvas (and shimmer) resume on the latest result, not the original.
    await vi.waitFor(() => expect(canvasUrl(el)).toContain(LATEST));
    expect(canvasUrl(el)).not.toContain(SAMPLE_UUID);
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
    stubFetch({ uuid: 'result' });
    const el = mount(STAGING);
    await el.updateComplete;
    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(editorMode(el)).toBe('edit'));
    await el.updateComplete;

    const history = historyEl(el)!;
    const startOver = history.shadowRoot!.querySelector('.startover__btn') as HTMLButtonElement;
    startOver.click();
    await el.updateComplete;
    expect(editorMode(el)).toBe('generate');
    expect(canvasUrl(el)).toBeNull();
    // Start over also clears the prompt history (the strip unmounts).
    await vi.waitFor(() => expect(historyEl(el)).toBeNull());
  });
});
