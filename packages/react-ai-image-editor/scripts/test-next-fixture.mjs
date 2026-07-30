#!/usr/bin/env node
/**
 * Builds the Next.js App Router fixture against the freshly built package and
 * asserts the prerendered HTML contains the SSR fallback (and never the raw
 * custom element). Run `npm run build` in this package first — the fixture
 * consumes dist/ via a file: dependency.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = dirname(dirname(fileURLToPath(import.meta.url)));
const fixtureDir = join(pkgDir, 'tests', 'next-fixture');

function run(cmd, args, cwd) {
  console.log(`\n$ ${cmd} ${args.join(' ')}  (${cwd})`);
  execFileSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
  });
}

if (!existsSync(join(pkgDir, 'dist', 'react-ai-image-editor.js'))) {
  console.error('dist/ is missing — run `npm run build` in packages/react-ai-image-editor first.');
  process.exit(1);
}

run('npm', ['ci', '--no-audit', '--no-fund'], fixtureDir);
run('npx', ['next', 'build'], fixtureDir);

const prerendered = join(fixtureDir, '.next', 'server', 'app', 'index.html');
if (!existsSync(prerendered)) {
  console.error(`Expected prerendered page at ${prerendered} — did the App Router output layout change?`);
  process.exit(1);
}
const html = readFileSync(prerendered, 'utf8');

if (!html.includes('ai-image-editor-fallback')) {
  console.error('Prerendered HTML is missing the SSR fallback marker — the page rendered empty or crashed.');
  process.exit(1);
}
if (html.includes('<uc-ai-image-editor')) {
  console.error('Prerendered HTML contains the raw custom element — SSR must render the fallback only.');
  process.exit(1);
}

console.log('\nnext-fixture: OK — next build succeeded and prerendered HTML contains the SSR fallback.');
