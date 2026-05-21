import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {
      root: resolve(__dirname, 'src/demo'),
    };
  }
  return {
    build: {
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: '@uploadcare/react-ai-enhancer',
        formats: ['es', 'cjs'],
        fileName: 'react-ai-enhancer',
      },
      rollupOptions: {
        external: ['react', '@uploadcare/ai-enhancer', '@uploadcare/react-adapter'],
        output: {
          globals: {
            react: 'React',
          },
        },
      },
    },
    plugins: [dts({ rollupTypes: true, insertTypesEntry: true })],
  };
});
