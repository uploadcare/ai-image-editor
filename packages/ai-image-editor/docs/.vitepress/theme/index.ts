import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import AiImageEditorDemo from './AiImageEditorDemo.vue';
import './style.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('AiImageEditorDemo', AiImageEditorDemo);
  },
} satisfies Theme;
