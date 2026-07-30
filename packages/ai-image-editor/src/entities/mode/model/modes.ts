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
    placeholderKey: 'ai-image-editor-generate-placeholder',
    // Complete, descriptive starting prompts. Flux responds best to rich
    // natural-language descriptions, and clicking a chip fills the prompt so the
    // user can run it as-is or tweak it.
    presets: [
      {
        label: 'Portrait',
        prompt:
          'A photorealistic close-up portrait of a woman with freckles and windswept hair, soft natural window light, shallow depth of field, shot on an 85mm lens, ultra-detailed skin texture',
      },
      {
        label: 'Cinematic',
        prompt:
          'Cinematic film still of a lone traveler on a neon-lit Tokyo street at night, rain-slicked pavement, glowing reflections, moody atmosphere, anamorphic, shot on 35mm',
      },
      {
        label: 'Product',
        prompt:
          'Product photography of a frosted glass perfume bottle on a polished marble surface, soft studio lighting, gentle reflections, minimalist composition, high detail',
      },
      {
        label: 'Landscape',
        prompt:
          'A serene mountain landscape at golden hour, low mist drifting through the valley, dramatic clouds, mirror-still lake reflections, photorealistic, ultra-detailed',
      },
      {
        label: 'Illustration',
        prompt:
          'A flat vector illustration of a cozy bookshop café, warm color palette, clean bold shapes, soft shadows, modern editorial style',
      },
      {
        label: '3D character',
        prompt:
          'A cute 3D-rendered robot character, Pixar style, big expressive eyes, soft studio lighting, pastel color palette, smooth glossy materials, octane render',
      },
    ],
  },
  edit: {
    id: 'edit',
    placeholderKey: 'ai-image-editor-edit-placeholder',
    // Instruction-style edits Flux Kontext handles well — restyling, relighting,
    // and background/subject changes that preserve the source image.
    presets: [
      {
        label: 'Enhance',
        prompt:
          'Enhance the photo: improve the lighting, sharpen details, and make the colors richer while keeping it natural',
      },
      { label: 'Golden hour', prompt: 'Relight the scene with warm golden-hour sunlight and long, soft shadows' },
      {
        label: 'White studio',
        prompt: 'Place the subject on a clean seamless white studio backdrop with soft, even lighting',
      },
      { label: 'Remove people', prompt: 'Remove all other people from the scene, keeping the main subject intact' },
      {
        label: 'Watercolor',
        prompt: 'Restyle the image as a soft watercolor painting with delicate, visible brush strokes',
      },
      {
        label: 'Black & white',
        prompt: 'Convert to dramatic high-contrast black and white film photography with subtle grain',
      },
    ],
  },
};
