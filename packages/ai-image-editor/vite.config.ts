import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// Vite 8's default CSS minifier, Lightning CSS, drops the unprefixed `backdrop-filter` when
// `-webkit-backdrop-filter` follows it (no blur in Chrome/Firefox) and rewrites `light-dark()`
// into vars that only flip on a `color-scheme` it compiled itself, so a host page's
// `color-scheme` stops reaching the editor. esbuild keeps the CSS as Vite 6 shipped it.
const cssMinify = 'esbuild';

export default defineConfig(({ command, mode }) => {
  if (command === 'serve') {
    return {
      root: resolve(import.meta.dirname, 'demo'),
      server: { open: '/standalone.html' },
    };
  }

  // Static demo site build: vite build --mode demo
  if (mode === 'demo') {
    return {
      root: resolve(import.meta.dirname, 'demo'),
      build: {
        outDir: resolve(import.meta.dirname, 'dist-demo'),
        emptyOutDir: true,
        cssMinify,
        rolldownOptions: {
          // shimmer-lab.html is deliberately absent: it is a renderer-tuning
          // harness, so it stays a `vite dev` page (which serves any HTML under
          // the demo root) rather than shipping to the published playground.
          input: {
            index: resolve(import.meta.dirname, 'demo/index.html'),
            standalone: resolve(import.meta.dirname, 'demo/standalone.html'),
            plugin: resolve(import.meta.dirname, 'demo/plugin.html'),
          },
        },
      },
    };
  }

  return {
    build: {
      // Vite 6's default ('modules'), pinned: Vite 7+ raised it to Safari 16.4 / Chrome 111,
      // which would ship unlowered syntax (class static blocks, `??=`) to consumers.
      target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
      cssCodeSplit: false,
      cssMinify,
      lib: {
        entry: {
          'ai-image-editor': resolve(import.meta.dirname, 'src/index.ts'),
          plugin: resolve(import.meta.dirname, 'src/plugin.ts'),
          errors: resolve(import.meta.dirname, 'src/errors.ts'),
        },
        name: '@uploadcare/ai-image-editor',
        formats: ['es', 'cjs'],
        // Pin output names to match package.json `exports`
        // (dist/<entry>.js for ESM, dist/<entry>.cjs for CommonJS).
        fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
      },
      rolldownOptions: {
        // Not bundled, so the editor shares one copy with File Uploader: the
        // plugin gets the uploader's token function, and a second bundled copy
        // of `AuthTokenResolverError` fails `instanceof` and wraps it again.
        external: [
          'lit',
          /^lit\//,
          '@uploadcare/file-uploader',
          /^@uploadcare\/signed-uploads(\/|$)/,
          /^@uploadcare\/upload-client(\/|$)/,
        ],
        output: {
          // Rolldown drops both by default; Rollup kept them
          strict: true,
          comments: { legal: true },
          globals: {
            lit: 'lit',
            '@uploadcare/file-uploader': 'UC',
          },
        },
      },
    },
    plugins: [dts({ rollupTypes: true, insertTypesEntry: true, exclude: ['**/*.dev.ts', '**/*.test.ts'] })],
  };
});
