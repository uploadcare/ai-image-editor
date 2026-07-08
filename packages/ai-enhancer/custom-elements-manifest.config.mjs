/**
 * Custom Elements Manifest analyzer config — the web-component-native API ref
 * source. Analyzes the public `<uc-ai-enhancer>` element (LitElement) into
 * `docs/api/custom-elements.json`, which `scripts/build-cem-docs.mjs` renders to
 * markdown for the VitePress site. Internal sub-components (canvas, prompt row,
 * chips, …) are intentionally excluded.
 */
export default {
  globs: ['src/widgets/ai-editor/ui/UcAiEnhancer.ts'],
  outdir: 'docs/api',
  litelement: true,
};
