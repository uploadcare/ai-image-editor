import { defineConfig } from 'vitepress';

// The guides live in Uploadcare's docs (uploadcare/fern-docs); this site keeps
// the generated API reference and the demo/playground.
export default defineConfig({
  title: '@uploadcare/ai-image-editor',
  description: 'AI image generation & editing web component for Uploadcare.',
  // Served as a GitHub Pages project site at https://uploadcare.github.io/ai-image-editor/.
  // Overridable via DOCS_BASE for other hosts (e.g. '/' for a root/custom domain).
  base: process.env.DOCS_BASE ?? '/ai-image-editor/',
  cleanUrls: true,
  // The editor is a custom element we mount imperatively in the demo, but guard
  // any `uc-*` tags in markdown so Vue treats them as custom elements, not components.
  vue: {
    template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('uc-') } },
  },
  themeConfig: {
    logo: {
      light: 'https://ucarecdn.com/27eed822-4a34-4347-b227-a89df2e7bf47/uploadcare-logo.svg',
      dark: 'https://ucarecdn.com/dfd6c07b-fd17-4559-8803-bc98f92b564b/uploadcare-logo-inverted.svg',
      alt: 'Uploadcare',
    },
    siteTitle: 'AI Image Editor',
    nav: [
      { text: 'Guides', link: 'https://uploadcare.com/docs/ai-image-editor/' },
      // { text: 'Demo', link: '/demo' },
      { text: 'API', link: '/api/' },
      // Built by `playground:build` into `<dist>/playground/`, not a VitePress
      // route — so it is only reachable on a built site, not in `docs:dev`.
      //
      // `target` is load-bearing: VitePress's router hijacks same-origin clicks
      // unless the anchor carries `download`/`target`, and since the playground
      // is not in its route map that lookup 404s. `_self` (rather than `_blank`)
      // keeps it in the same tab and avoids the external-link icon, which
      // `VPLink` only adds for `_blank`.
      // { text: 'Playground', link: '/playground/', target: '_self' },
      {
        text: 'Uploadcare',
        items: [
          { text: 'Website', link: 'https://uploadcare.com' },
          { text: 'Documentation', link: 'https://uploadcare.com/docs/' },
          { text: 'File Uploader', link: 'https://uploadcare.com/docs/file-uploader/' },
          { text: 'Dashboard', link: 'https://app.uploadcare.com/' },
        ],
      },
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright:
        'Built by <a href="https://uploadcare.com">Uploadcare</a> · <a href="https://uploadcare.com/docs/">Docs</a>',
    },
    sidebar: {
      '/api/': [
        {
          text: 'API reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'Components', link: '/api/components' },
            { text: 'TypeScript API', link: '/api/typescript/' },
          ],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/uploadcare/ai-image-editor' }],
  },
});
