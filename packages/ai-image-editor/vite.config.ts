import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig(({ command, mode }) => {
  if (command === 'serve') {
    return {
      root: resolve(__dirname, 'demo'),
      server: { open: '/standalone.html' },
    };
  }

  // Static demo site build: vite build --mode demo
  if (mode === 'demo') {
    return {
      root: resolve(__dirname, 'demo'),
      build: {
        outDir: resolve(__dirname, 'dist-demo'),
        emptyOutDir: true,
        rollupOptions: {
          input: {
            index: resolve(__dirname, 'demo/index.html'),
            standalone: resolve(__dirname, 'demo/standalone.html'),
            plugin: resolve(__dirname, 'demo/plugin.html'),
            'shimmer-lab': resolve(__dirname, 'demo/shimmer-lab.html'),
          },
        },
      },
    };
  }

  return {
    build: {
      cssCodeSplit: false,
      lib: {
        entry: {
          'ai-image-editor': resolve(__dirname, 'src/index.ts'),
          plugin: resolve(__dirname, 'src/plugin.ts'),
          errors: resolve(__dirname, 'src/errors.ts'),
        },
        name: '@uploadcare/ai-image-editor',
        formats: ['es', 'cjs'],
        // Pin output names to match package.json `exports`
        // (dist/<entry>.js for ESM, dist/<entry>.cjs for CommonJS).
        fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
      },
      rollupOptions: {
        external: ['lit', /^lit\//, '@uploadcare/file-uploader'],
        output: {
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
