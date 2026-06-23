import { defineConfig } from 'vitepress';

export default defineConfig({
  title: '@uploadcare/ai-enhancer',
  description: 'AI image generation & editing web component for Uploadcare.',
  cleanUrls: true,
  // The editor is a custom element we mount imperatively in the demo, but guard
  // any `uc-*` tags in markdown so Vue treats them as custom elements, not components.
  vue: {
    template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('uc-') } },
  },
  themeConfig: {
    logo: 'https://avatars.githubusercontent.com/u/1525984?s=80',
    siteTitle: 'AI Enhancer',
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Demo', link: '/demo' },
      { text: 'API', link: '/api/' },
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
      copyright: 'Built by <a href="https://uploadcare.com">Uploadcare</a> · <a href="https://uploadcare.com/docs/">Docs</a>',
    },
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'File Uploader plugin', link: '/guide/plugin' },
            { text: 'Theming', link: '/guide/theming' },
            { text: 'Localization', link: '/guide/localization' },
          ],
        },
      ],
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
    socialLinks: [{ icon: 'github', link: 'https://github.com/uploadcare/ai-enhancer' }],
  },
});
