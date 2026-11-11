/**
 * Check every link to the Uploadcare docs (uploadcare.com/docs, the Fern site
 * that holds the guides) in the built docs site, the READMEs and the package
 * homepages: the page must load, and each `#anchor` must be an `id` on it.
 * Fern renders pages on the server, so the ids are in the fetched HTML.
 *
 * Run after `docs:build` (it reads `docs/.vitepress/dist`). Exits 1 on any
 * broken link. Run weekly by `.github/workflows/docs-links.yml`.
 */
import { readdir, readFile } from 'node:fs/promises';

const ROOT = new URL('../../../', import.meta.url);
const DIST = new URL('docs/.vitepress/dist/', new URL('../', import.meta.url));
const FILES = [
  'README.md',
  'packages/ai-image-editor/README.md',
  'packages/ai-image-editor/package.json',
  'packages/react-ai-image-editor/README.md',
  'packages/react-ai-image-editor/package.json',
];
const LINK = /https:\/\/uploadcare\.com\/docs\/[^\s"'<>()[\]`\\]*/g;

const sources = [
  ...(await readdir(DIST, { recursive: true }))
    .filter((f) => f.endsWith('.html'))
    .map((f) => new URL(f, DIST)),
  ...FILES.map((f) => new URL(f, ROOT)),
];
if (sources.length === FILES.length) throw new Error('No built site in docs/.vitepress/dist; run docs:build first');

/** page URL → anchor → files linking to it ('' for a link without an anchor) */
const pages = new Map();
for (const src of sources) {
  const text = (await readFile(src, 'utf8')).replaceAll('&amp;', '&');
  for (const raw of text.match(LINK) ?? []) {
    const url = new URL(raw.replace(/[.,:;]+$/, ''));
    const anchor = decodeURIComponent(url.hash.slice(1));
    url.hash = '';
    url.search = '';
    const anchors = pages.get(url.href) ?? pages.set(url.href, new Map()).get(url.href);
    const from = anchors.get(anchor) ?? anchors.set(anchor, new Set()).get(anchor);
    from.add(src.href.replace(ROOT.href, ''));
  }
}

async function load(url, attempt = 1) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'docs-link-check' } });
    if (res.status >= 500 && attempt < 3) return load(url, attempt + 1);
    return { status: res.status, ok: res.ok, html: res.ok ? await res.text() : '' };
  } catch (error) {
    if (attempt < 3) return load(url, attempt + 1);
    return { status: String(error.cause?.code ?? error.message), ok: false, html: '' };
  }
}

const broken = [];
await Promise.all(
  [...pages].map(async ([page, anchors]) => {
    const { status, ok, html } = await load(page);
    for (const [anchor, from] of anchors) {
      const link = anchor ? `${page}#${anchor}` : page;
      if (!ok) broken.push({ link, why: `HTTP ${status}`, from });
      else if (anchor && !html.includes(`id="${anchor}"`)) broken.push({ link, why: 'no such anchor', from });
    }
  }),
);

const total = [...pages.values()].reduce((n, a) => n + a.size, 0);
for (const { link, why, from } of broken.sort((a, b) => a.link.localeCompare(b.link))) {
  console.error(`✗ ${link}  (${why})\n    in ${[...from].join(', ')}`);
}
console.log(`[docs] ${total - broken.length}/${total} Uploadcare docs links OK across ${pages.size} pages`);
if (broken.length) process.exit(1);
