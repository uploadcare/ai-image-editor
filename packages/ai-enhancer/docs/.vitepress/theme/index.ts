import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import AiEnhancerDemo from './AiEnhancerDemo.vue';
import './style.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('AiEnhancerDemo', AiEnhancerDemo);
  },
} satisfies Theme;
