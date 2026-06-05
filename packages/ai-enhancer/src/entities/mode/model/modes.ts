export type AiEditorMode = 'generate' | 'edit';

export type AiTemplate = {
  label: string;
  prompt: string;
};

export type ModeMeta = {
  id: AiEditorMode;
  placeholderKey: string;
  templates: AiTemplate[];
};

/**
 * The editor operates in one of two modes, derived from whether it currently
 * holds a source image: `generate` (text→image, no source) and `edit`
 * (image→image, editing the current image via a freeform prompt). Each mode
 * carries its placeholder text and a set of quick-start prompt templates.
 */
export const MODES: Record<AiEditorMode, ModeMeta> = {
  generate: {
    id: 'generate',
    placeholderKey: 'ai-enhancer-generate-placeholder',
    templates: [
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
    templates: [
      { label: 'Remove people', prompt: 'Remove all people from the scene' },
      { label: 'Clean up', prompt: 'Remove clutter' },
      { label: 'White studio', prompt: 'Replace background with a white studio backdrop' },
      { label: 'Beach', prompt: 'Replace background with a sunny beach' },
      { label: 'Remove background', prompt: 'Remove the background entirely' },
      { label: 'Extend to 16:9', prompt: 'Extend the image to a horizontal 16:9 aspect ratio' },
    ],
  },
};
