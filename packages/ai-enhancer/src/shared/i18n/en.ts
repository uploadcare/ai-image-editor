export const enLocale = {
  'ai-enhancer-source-label': 'Generate image',
  'ai-enhancer-file-action-label': 'AI Edit',
  'ai-enhancer-generate-title': 'Generate image',
  'ai-enhancer-edit-title': 'Edit image',
  'ai-enhancer-generate-placeholder': 'Create image...',
  'ai-enhancer-edit-placeholder': 'Edit image...',
  'ai-enhancer-cancel': 'Cancel',
  'ai-enhancer-generate-btn': 'Generate',
  'ai-enhancer-done-btn': 'Done',
  'ai-enhancer-start-over': 'Start over',
  'ai-enhancer-history-empty': 'No prompts yet',
  'ai-enhancer-history-title': 'Recent prompts',
  'ai-enhancer-busy': 'Generating…',
  'ai-enhancer-error': 'Something went wrong. Try again.',
  'ai-enhancer-fullscreen': 'View fullscreen',
  'ai-enhancer-exit-fullscreen': 'Exit fullscreen',
  'ai-enhancer-aspect-ratio-aria': 'Pick aspect ratio',
  'ai-enhancer-aspect-square': 'Square',
  'ai-enhancer-aspect-tall': 'Tall',
  'ai-enhancer-aspect-wide': 'Wide',
  'ai-enhancer-aspect-portrait': 'Portrait',
  'ai-enhancer-aspect-landscape': 'Landscape',
  'ai-enhancer-aspect-vertical': 'Vertical',
  'ai-enhancer-aspect-widescreen': 'Widescreen',
};

export type AiEnhancerLocaleKey = keyof typeof enLocale;

/** A full set of ai-enhancer strings for a single locale. */
export type AiEnhancerLocale = Record<AiEnhancerLocaleKey, string>;
