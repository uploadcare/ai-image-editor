/**
 * Render the Custom Elements Manifest (produced by `cem analyze`) to a VitePress
 * markdown page. We render the tables ourselves (rather than via a generic
 * to-markdown) so we control the columns, keep descriptions as real markdown,
 * and link known types. Run after `cem analyze` — see the `docs:api` script.
 */
import { readFile, writeFile } from 'node:fs/promises';

const MANIFEST = new URL('../docs/api/custom-elements.json', import.meta.url);
const OUT = new URL('../docs/api/components.md', import.meta.url);

// Types we link from the Type column.
const TYPE_LINKS = {
  AiImageEditorError: '/api/typescript/classes/AiImageEditorError',
  AspectRatio: '/api/typescript/type-aliases/AspectRatio',
  ErrorDetail: '/api/typescript/type-aliases/ErrorDetail',
  MetadataCallback: '/api/typescript/type-aliases/MetadataCallback',
  OutputFilenameResolver: '/api/typescript/type-aliases/OutputFilenameResolver',
  SecureDeliveryProxyUrlResolver: '/api/typescript/type-aliases/SecureDeliveryProxyUrlResolver',
  UploadcareFile: 'https://uploadcare.com/docs/uploads/',
  Metadata: 'https://uploadcare.com/docs/file-metadata/',
};

const DOCS = 'https://uploadcare.com/docs/ai-image-editor/';

// Properties with their own section on the Options page of the Uploadcare docs
// (uploadcare/fern-docs), anchored by the kebab-case name. Add one here when
// its section ships; an unlisted property just isn't linked.
const OPTION_SECTIONS = new Set([
  'pubkey', 'sourceUuid', 'sourceFileInfo', 'outputFilename', 'metadata', 'baseUrl',
  'cdnCname', 'cdnCnamePrefixed', 'authToken', 'cacheAuthToken',
  'secureDeliveryProxyUrlResolver', 'aspectRatios', 'localeName',
  'localeDefinitionOverride', 'presets', 'presetsOnly', 'composerPlacement', 'canvasFit',
  'sizing', 'historyPlacement', 'toolbarPlacement',
]);
const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const propCell = (name) =>
  OPTION_SECTIONS.has(name) ? `[${cell(name)}](${DOCS}options/#${kebab(name)})` : cell(name);

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
const decl = manifest.modules.flatMap((m) => m.declarations ?? []).find((d) => d.tagName);
if (!decl) throw new Error('No custom element found in the manifest');

/** Description → single-line, table-safe, but still real markdown (bold/code/links). */
const desc = (text = '') =>
  text
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();

const cell = (s) => (s ? `\`${String(s).replace(/\|/g, '\\|')}\`` : '');

/** Type text → code per union member, linking known types; `|` kept table-safe. */
const typeCell = (text = '') =>
  !text
    ? ''
    : text
        .split('|')
        .map((part) => {
          const t = part.trim();
          const url = TYPE_LINKS[t];
          return url ? `[\`${t}\`](${url})` : `\`${t}\``;
        })
        .join(' \\| ');

const attrByField = new Map((decl.attributes ?? []).map((a) => [a.fieldName ?? a.name, a.name]));

// Public reactive properties only (drop private `_` members, statics, inherited).
const props = (decl.members ?? []).filter(
  (m) => m.kind === 'field' && m.privacy !== 'private' && !m.static && !m.name.startsWith('_') && !m.inheritedFrom,
);

let body = `## \`<${decl.tagName}>\`\n\n`;

body += '### Properties & attributes\n\n';
body += '| Property | Attribute | Type | Default | Description |\n| --- | --- | --- | --- | --- |\n';
for (const p of props) {
  const attr = attrByField.get(p.name);
  body += `| ${propCell(p.name)} | ${attr ? cell(attr) : '—'} | ${typeCell(p.type?.text)} | ${p.default ? cell(p.default) : ''} | ${desc(p.description)} |\n`;
}

if (decl.events?.length) {
  body += '\n### Events\n\n| Event | Type | Description |\n| --- | --- | --- |\n';
  for (const e of decl.events) body += `| ${cell(e.name)} | ${typeCell(e.type?.text)} | ${desc(e.description)} |\n`;
}

if (decl.cssProperties?.length) {
  body += '\n### CSS custom properties\n\n| Property | Description |\n| --- | --- |\n';
  for (const c of decl.cssProperties) body += `| ${cell(c.name)} | ${desc(c.description)} |\n`;
}

if (decl.slots?.length) {
  body += '\n### Slots\n\n| Name | Description |\n| --- | --- |\n';
  for (const s of decl.slots) body += `| ${s.name ? cell(s.name) : '(default)'} | ${desc(s.description)} |\n`;
}

const page = `---
title: Components
outline: deep
aside: false
pageClass: api-wide
---

# Components

The web-component API for \`<${decl.tagName}>\` — attributes, properties, events,
slots, and CSS custom properties. A linked property has its own section, with
examples, on the [Options](${DOCS}options/) page of the Uploadcare docs. See
[Error handling](${DOCS}errors/) for what \`uc:error\` carries and
[Theming](${DOCS}theming/) for using the CSS custom properties.

${body}`;

await writeFile(OUT, page);
console.log('[docs] wrote docs/api/components.md');
