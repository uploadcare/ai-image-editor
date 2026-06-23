/**
 * Render the Custom Elements Manifest (produced by `cem analyze`) to a VitePress
 * markdown page. Run after `cem analyze` — see the `docs:api` script.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { customElementsManifestToMarkdown } from '@custom-elements-manifest/to-markdown';

const MANIFEST = new URL('../docs/api/custom-elements.json', import.meta.url);
const OUT = new URL('../docs/api/components.md', import.meta.url);

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));

const body = customElementsManifestToMarkdown(manifest, {
  headingOffset: 1, // page already has an h1
  private: 'hidden', // drop private/internal members
  omitSections: ['main-heading', 'super-class', 'mixins'],
});

const page = `---
title: Components
outline: deep
---

# Components

The web-component API for \`<uc-ai-editor>\` — attributes, properties, events,
slots, and CSS custom properties.

${body}
`;

await writeFile(OUT, page);
console.log('[docs] wrote docs/api/components.md');
