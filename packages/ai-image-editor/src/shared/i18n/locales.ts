import { type AiImageEditorLocale, enLocale } from './en';

export type LocaleLoader = () => Promise<AiImageEditorLocale>;

/**
 * Every locale the ai-image-editor ships, mirroring the file-uploader's locale set.
 * English is bundled (it is the synchronous fallback); all other locales load
 * lazily via dynamic import so only the active language is fetched.
 */
export const LOCALE_LOADERS: Record<string, LocaleLoader> = {
  en: async () => enLocale,
  ar: () => import('./locales/ar').then((m) => m.default),
  az: () => import('./locales/az').then((m) => m.default),
  ca: () => import('./locales/ca').then((m) => m.default),
  cs: () => import('./locales/cs').then((m) => m.default),
  da: () => import('./locales/da').then((m) => m.default),
  de: () => import('./locales/de').then((m) => m.default),
  el: () => import('./locales/el').then((m) => m.default),
  es: () => import('./locales/es').then((m) => m.default),
  et: () => import('./locales/et').then((m) => m.default),
  fi: () => import('./locales/fi').then((m) => m.default),
  fr: () => import('./locales/fr').then((m) => m.default),
  he: () => import('./locales/he').then((m) => m.default),
  hy: () => import('./locales/hy').then((m) => m.default),
  is: () => import('./locales/is').then((m) => m.default),
  it: () => import('./locales/it').then((m) => m.default),
  ja: () => import('./locales/ja').then((m) => m.default),
  ka: () => import('./locales/ka').then((m) => m.default),
  kk: () => import('./locales/kk').then((m) => m.default),
  ko: () => import('./locales/ko').then((m) => m.default),
  lv: () => import('./locales/lv').then((m) => m.default),
  nb: () => import('./locales/nb').then((m) => m.default),
  nl: () => import('./locales/nl').then((m) => m.default),
  pl: () => import('./locales/pl').then((m) => m.default),
  pt: () => import('./locales/pt').then((m) => m.default),
  ro: () => import('./locales/ro').then((m) => m.default),
  ru: () => import('./locales/ru').then((m) => m.default),
  sk: () => import('./locales/sk').then((m) => m.default),
  sr: () => import('./locales/sr').then((m) => m.default),
  sv: () => import('./locales/sv').then((m) => m.default),
  tr: () => import('./locales/tr').then((m) => m.default),
  uk: () => import('./locales/uk').then((m) => m.default),
  vi: () => import('./locales/vi').then((m) => m.default),
  zh: () => import('./locales/zh').then((m) => m.default),
  'zh-TW': () => import('./locales/zh-TW').then((m) => m.default),
};

export const SUPPORTED_LOCALES = Object.keys(LOCALE_LOADERS);
