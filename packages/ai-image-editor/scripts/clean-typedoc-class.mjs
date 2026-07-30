/**
 * Post-process the TypeDoc-generated `UcAiImageEditor` class page.
 *
 * TypeDoc doesn't understand the web-component JSDoc tags (`@fires`, `@cssprop`,
 * `@csspart`, `@slot`), so it renders each occurrence as its own bare `## Fires`
 * / `## Cssprop` heading. We keep the information but consolidate each tag into a
 * single readable table. We also drop the inherited Lit lifecycle bits
 * (`Constructors`, `Extends`) that aren't part of the public component API.
 */
import { readFile, writeFile } from 'node:fs/promises';

const FILE = new URL('../docs/api/typescript/classes/UcAiImageEditor.md', import.meta.url);

// Web-component tags TypeDoc emits as repeated H2s → one table each.
const TAG_TABLES = {
  Fires: { title: 'Fires', col: 'Event' },
  Cssprop: { title: 'CSS Custom Properties', col: 'Property' },
  Csspart: { title: 'CSS Shadow Parts', col: 'Part' },
  Slot: { title: 'Slots', col: 'Slot' },
};
// Inherited Lit internals — not public component API.
const DROP = new Set(['Constructors', 'Extends']);

const cell = (s) => s.replace(/\|/g, '\\|');
const code = (s) => `\`${s.replace(/^\[|\]$/g, '').replace(/^`|`$/g, '')}\``;

/** `name - description` (name may be `[--token]`) → { name, desc }. */
function parseEntry(bodyLines) {
  const text = bodyLines.join(' ').replace(/\s+/g, ' ').trim();
  const m = text.match(/^(\S+)\s+-\s+(.*)$/);
  return m ? { name: m[1], desc: m[2] } : { name: text, desc: '' };
}

function table(col, rows) {
  const head = `| ${col} | Description |\n| --- | --- |`;
  const body = rows.map((r) => `| ${code(r.name)} | ${cell(r.desc)} |`).join('\n');
  return `${head}\n${body}`;
}

const src = await readFile(FILE, 'utf8');

// Split into top-level (##) sections, keeping the preamble before the first one.
const sections = [];
let current = { heading: null, body: [] };
for (const line of src.split('\n')) {
  if (/^## (?!#)/.test(line)) {
    sections.push(current);
    current = { heading: line.replace(/^##\s+/, '').trim(), body: [] };
  } else {
    current.body.push(line);
  }
}
sections.push(current);

const tagRows = Object.fromEntries(Object.keys(TAG_TABLES).map((k) => [k, []]));
const blocks = [];
const placed = new Set();

for (const s of sections) {
  if (s.heading === null) {
    blocks.push(s.body.join('\n'));
  } else if (s.heading in TAG_TABLES) {
    tagRows[s.heading].push(parseEntry(s.body));
    if (!placed.has(s.heading)) {
      blocks.push({ tag: s.heading }); // placeholder; filled in after the pass
      placed.add(s.heading);
    }
  } else if (!DROP.has(s.heading)) {
    blocks.push(`## ${s.heading}\n${s.body.join('\n')}`);
  }
}

const rendered = blocks
  .map((b) =>
    typeof b === 'string' ? b : `## ${TAG_TABLES[b.tag].title}\n\n${table(TAG_TABLES[b.tag].col, tagRows[b.tag])}\n`,
  )
  .join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .trimEnd();

await writeFile(FILE, `${rendered}\n`);
console.log('[docs] cleaned typedoc class page (consolidated tags, dropped Lit internals)');
