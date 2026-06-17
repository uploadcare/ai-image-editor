/**
 * The editor's modes. Currently derived from whether a source image is present
 * (`generate` without one, `edit` with). Designed to grow — adding a capability
 * like `'outpaint'` here is additive, and the `presets` map (keyed by this type)
 * extends with it without breaking existing configs.
 */
export type AiEditorMode = 'generate' | 'edit';

/** A quick-start preset chip: clicking it fills the prompt with `prompt`. */
export type AiPreset = {
  label: string;
  prompt: string;
};

/**
 * Per-mode preset overrides, keyed by {@link AiEditorMode}. Partial so a config
 * may set some modes and leave the rest on their built-in defaults — and so
 * future modes are additive (a new key, never a required change).
 */
export type AiPresets = Partial<Record<AiEditorMode, AiPreset[]>>;

export type ModeMeta = {
  id: AiEditorMode;
  placeholderKey: string;
  presets: AiPreset[];
};

/**
 * The editor operates in one of two modes, derived from whether it currently
 * holds a source image: `generate` (text→image, no source) and `edit`
 * (image→image, editing the current image via a freeform prompt). Each mode
 * carries its placeholder text and a set of quick-start presets.
 */
export const MODES: Record<AiEditorMode, ModeMeta> = {
  generate: {
    id: 'generate',
    placeholderKey: 'ai-enhancer-generate-placeholder',
    presets: [
      { label: 'Photorealistic', prompt: 'A photorealistic ' },
      { label: 'Illustration', prompt: 'A flat illustration of ' },
      { label: 'Cinematic', prompt: 'Cinematic shot of ' },
      { label: 'Watercolor', prompt: 'A soft watercolor painting of ' },
      { label: 'Surprise me', prompt: '' },
    ],
  },
  edit: {
    id: 'edit',
    placeholderKey: 'ai-enhancer-edit-placeholder',
    presets: [
      { label: 'Remove people', prompt: 'Remove all people from the scene' },
      { label: 'Clean up', prompt: 'Remove clutter' },
      { label: 'White studio', prompt: 'Replace background with a white studio backdrop' },
      { label: 'Beach', prompt: 'Replace background with a sunny beach' },
      { label: 'Remove background', prompt: 'Remove the background entirely' },
      { label: 'Extend to 16:9', prompt: 'Extend the image to a horizontal 16:9 aspect ratio' },
    ],
  },
};
