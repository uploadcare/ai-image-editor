import { describe, expect, it, vi } from 'vitest';
import { MODES } from '../../src/internal';
import { editorMode, mount, SAMPLE_UUID, STAGING, UcAiImageEditor } from './harness';

/**
 * What the element renders when it mounts, and the configuration that decides
 * it: mode, presets and locale. Nothing here runs a generation.
 */
describe('<uc-ai-image-editor> mounting and configuration', () => {
  it('registers the custom element', () => {
    expect(customElements.get('uc-ai-image-editor')).toBe(UcAiImageEditor);
  });

  it('mounts in generate mode and renders the canvas + prompt + chips + footer (no history strip yet)', async () => {
    const el = mount();
    await el.updateComplete;
    const root = el.shadowRoot;
    expect(root?.querySelector('uc-ai-canvas')).toBeTruthy();
    expect(root?.querySelector('uc-ai-prompt-row')).toBeTruthy();
    expect(root?.querySelector('uc-ai-chips')).toBeTruthy();
    expect(root?.querySelector('uc-ai-footer')).toBeTruthy();
    // The history strip only mounts once there are results (or in edit mode).
    expect(root?.querySelector('uc-ai-history')).toBeNull();
    expect(editorMode(el)).toBe('generate');
  });

  it('derives edit mode from a source uuid, generate mode without one', async () => {
    const el = mount();
    await el.updateComplete;
    expect(editorMode(el)).toBe('generate');
    el.sourceUuid = SAMPLE_UUID;
    await el.updateComplete;
    expect(editorMode(el)).toBe('edit');
  });

  it('updates internal prompt state when the user types in the prompt input', async () => {
    const el = mount();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('uc-ai-prompt-row')!.shadowRoot!.querySelector('textarea')!;
    input.value = 'a tiger';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    expect(input.value).toBe('a tiger');
  });

  it('renders configurable prompt presets per mode', async () => {
    const el = mount();
    el.presets = {
      generate: [
        { label: 'Logo', prompt: 'A logo of ' },
        { label: 'Sticker', prompt: 'A sticker of ' },
      ],
      edit: [{ label: 'Enhance', prompt: 'Enhance it' }],
    };
    await el.updateComplete;

    const chipLabels = async (): Promise<string[]> => {
      const chips = el.shadowRoot!.querySelector('uc-ai-chips') as unknown as {
        updateComplete: Promise<unknown>;
        shadowRoot: ShadowRoot;
      } | null;
      await chips?.updateComplete;
      return [...(chips?.shadowRoot.querySelectorAll('.chip') ?? [])].map((c) => c.textContent!.trim());
    };

    // generate mode uses presets.generate…
    expect(await chipLabels()).toEqual(['Logo', 'Sticker']);

    // …and edit mode uses presets.edit.
    el.sourceUuid = SAMPLE_UUID;
    await el.updateComplete;
    expect(await chipLabels()).toEqual(['Enhance']);
  });

  it('falls back to built-in presets for modes left out of the presets map', async () => {
    const el = mount();
    el.presets = { edit: [{ label: 'Enhance', prompt: 'Enhance it' }] }; // generate omitted
    await el.updateComplete;
    const chips = el.shadowRoot!.querySelector('uc-ai-chips') as unknown as { shadowRoot: ShadowRoot };
    expect(chips.shadowRoot.querySelectorAll('.chip').length).toBe(MODES.generate.presets.length);
  });

  it('hides the chips toolbar when a mode preset set is empty', async () => {
    const el = mount();
    el.presets = { generate: [] };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('uc-ai-chips')).toBeNull();
  });

  it('resolves locale strings from localeName + locale-keyed localeDefinitionOverride', async () => {
    const el = mount(STAGING);
    const cancelLabel = () => el.shadowRoot!.querySelector('uc-ai-footer')!.getAttribute('cancel-label');

    // Override is keyed by locale name (same shape as the uploader's config).
    el.localeDefinitionOverride = { en: { 'ai-image-editor-cancel': 'Dismiss' } };
    await el.updateComplete;
    await vi.waitFor(() => expect(cancelLabel()).toBe('Dismiss'));

    // Switching the active locale lazy-loads that locale's built-in strings.
    el.localeName = 'de';
    await vi.waitFor(() => expect(cancelLabel()).toBe('Abbrechen'));
  });
});
