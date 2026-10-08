import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {
      root: resolve(import.meta.dirname, 'src/demo'),
    };
  }
  return {
    build: {
      // Vite 6's default ('modules'), pinned: Vite 7+ raised it to Safari 16.4 / Chrome 111
      target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
      lib: {
        entry: resolve(import.meta.dirname, 'src/index.ts'),
        name: '@uploadcare/react-ai-image-editor',
        formats: ['es', 'cjs'],
        fileName: 'react-ai-image-editor',
      },
      rolldownOptions: {
        // @lit/react is ESM-only (no require condition) — bundle it so the CJS
        // build doesn't require() an ESM module (breaks on Node < 22.12)
        external: ['react', '@uploadcare/ai-image-editor', '@uploadcare/ai-image-editor/errors'],
        output: {
          // Rolldown drops "use strict" and legal comments (the @lit/react license) by default; Rollup kept them
          strict: true,
          comments: { legal: true },
          // Rolldown strips module-level directives when bundling; Next.js needs
          // 'use client' at the top of the shipped files to mark the client
          // boundary (no-op elsewhere)
          banner: "'use client';",
          globals: {
            react: 'React',
          },
        },
      },
    },
    plugins: [dts({ rollupTypes: true, insertTypesEntry: true })],
  };
});
