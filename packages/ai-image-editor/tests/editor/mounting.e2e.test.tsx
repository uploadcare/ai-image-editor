import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { doneButton, editorRegion, mount, promptBox, SAMPLE_UUID, STAGING, UcAiImageEditor } from './harness';

/** The quick-prompt chips, by their labels. */
const quickPrompts = () => page.getByRole('toolbar', { name: 'Quick prompts' }).getByRole('button');
const quickPromptLabels = () =>
  quickPrompts()
    .elements()
    .map((chip) => chip.textContent!.trim());

/**
 * What the element renders when it mounts, and the configuration that decides
 * it: mode, presets and locale. Nothing here runs a generation.
 */
describe('<uc-ai-image-editor> mounting and configuration', () => {
  it('registers the custom element', () => {
    expect(customElements.get('uc-ai-image-editor')).toBe(UcAiImageEditor);
  });

  it('mounts in generate mode with the prompt, quick prompts and footer (no history strip yet)', async () => {
    mount();
    await expect.element(editorRegion('generate')).toBeVisible();
    await expect.element(promptBox()).toHaveAccessibleName('Create image...');
    await expect.element(page.getByRole('toolbar', { name: 'Quick prompts' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
    await expect.element(doneButton()).toBeVisible();
    // The history strip only mounts once there are results (or in edit mode).
    await expect.element(page.getByRole('toolbar', { name: 'Recent prompts' })).not.toBeInTheDocument();
  });

  it('derives edit mode from a source uuid, generate mode without one', async () => {
    const el = mount();
    await expect.element(editorRegion('generate')).toBeVisible();
    el.sourceUuid = SAMPLE_UUID;
    await expect.element(editorRegion('edit')).toBeVisible();
    await expect.element(promptBox()).toHaveAccessibleName('Edit image...');
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

    // generate mode uses presets.generate…
    await expect.poll(quickPromptLabels).toEqual(['Logo', 'Sticker']);

    // …and edit mode uses presets.edit.
    el.sourceUuid = SAMPLE_UUID;
    await expect.poll(quickPromptLabels).toEqual(['Enhance']);
  });

  it('falls back to built-in presets for modes left out of the presets map', async () => {
    const el = mount();
    el.presets = { edit: [{ label: 'Enhance', prompt: 'Enhance it' }] }; // generate omitted
    await expect
      .poll(quickPromptLabels)
      .toEqual(['Portrait', 'Cinematic', 'Product', 'Landscape', 'Illustration', '3D character']);
  });

  it('hides the chips toolbar when a mode preset set is empty', async () => {
    const el = mount();
    await expect.element(page.getByRole('toolbar', { name: 'Quick prompts' })).toBeVisible();
    el.presets = { generate: [] };
    await expect.element(page.getByRole('toolbar', { name: 'Quick prompts' })).not.toBeInTheDocument();
  });

  it('resolves locale strings from localeName + locale-keyed localeDefinitionOverride', async () => {
    const el = mount(STAGING);

    // Override is keyed by locale name (same shape as the uploader's config).
    el.localeDefinitionOverride = { en: { 'ai-image-editor-cancel': 'Dismiss' } };
    await expect.element(page.getByRole('button', { name: 'Dismiss', exact: true })).toBeVisible();

    // Switching the active locale lazy-loads that locale's built-in strings.
    el.localeName = 'de';
    await expect.element(page.getByRole('button', { name: 'Abbrechen', exact: true })).toBeVisible();
  });
});
