import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {
      root: resolve(__dirname, 'demo'),
      server: { open: '/standalone.html' },
    };
  }

  return {
    build: {
      cssCodeSplit: false,
      lib: {
        entry: {
          'ai-enhancer': resolve(__dirname, 'src/index.ts'),
          plugin: resolve(__dirname, 'src/plugin.ts'),
        },
        name: '@uploadcare/ai-enhancer',
        formats: ['es', 'cjs'],
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
