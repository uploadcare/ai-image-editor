<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';

/** Public, non-internal editor properties exposed as live controls. */
const opts = reactive({
  composerPlacement: 'bottom',
  canvasFit: 'available',
  sizing: 'fill',
  historyPlacement: 'composer-above',
  toolbarPlacement: 'bottom',
  presetsOnly: false,
  localeName: 'en',
  aspectRatios: '',
});

const SELECTS: { key: keyof typeof opts; label: string; options: string[] }[] = [
  { key: 'composerPlacement', label: 'Composer placement', options: ['bottom', 'top'] },
  { key: 'canvasFit', label: 'Canvas fit', options: ['available', 'full'] },
  { key: 'sizing', label: 'Sizing', options: ['fill', 'content'] },
  {
    key: 'historyPlacement',
    label: 'History placement',
    options: ['composer-above', 'composer-below', 'canvas-top', 'canvas-bottom'],
  },
  { key: 'toolbarPlacement', label: 'Toolbar placement', options: ['bottom', 'top', 'none'] },
  {
    key: 'localeName',
    label: 'Locale',
    options: ['en', 'de', 'fr', 'es', 'it', 'ja', 'ko', 'zh', 'ru', 'uk', 'pt', 'nl', 'ar'],
  },
];
const TOGGLES: { key: keyof typeof opts; label: string }[] = [
  { key: 'presetsOnly', label: 'Presets only' },
];

const host = ref<HTMLDivElement>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let editor: any;

function apply(): void {
  if (!editor) return;
  editor.composerPlacement = opts.composerPlacement;
  editor.canvasFit = opts.canvasFit;
  editor.sizing = opts.sizing;
  editor.historyPlacement = opts.historyPlacement;
  editor.toolbarPlacement = opts.toolbarPlacement;
  editor.presetsOnly = opts.presetsOnly;
  editor.localeName = opts.localeName;
  const ar = opts.aspectRatios.trim();
  if (ar) editor.setAttribute('aspect-ratios', ar);
  else editor.removeAttribute('aspect-ratios');
  // Content sizing: the editor derives its own height, so the stage wraps it
  // (see .demo-stage--content) and plain CSS on the host bounds the height.
  // Fill keeps the fixed-height stage the editor fills.
  const content = opts.sizing === 'content';
  editor.style.height = content ? 'auto' : '100%';
  editor.style.minHeight = content ? '320px' : '';
  editor.style.maxHeight = content ? '80vh' : '';
}

// A small event/option log, like the standalone demo's shell.
const logLines = ref<string[]>([]);
function logMsg(message: string): void {
  const t = new Date().toLocaleTimeString();
  logLines.value = [`${t}  ${message}`, ...logLines.value].slice(0, 40);
}

// Apply + log which option changed.
let prev = { ...opts };
watch(opts, () => {
  apply();
  for (const k of Object.keys(opts) as (keyof typeof opts)[]) {
    if (opts[k] !== prev[k]) logMsg(`${k} → ${JSON.stringify(opts[k])}`);
  }
  prev = { ...opts };
});

onMounted(async () => {
  // Client-only: registers <uc-ai-image-editor> (a web component) — never during SSR.
  await import('../../../src');
  const { UnsplashFakeProvider } = await import('./UnsplashFakeProvider');

  editor = document.createElement('uc-ai-image-editor');
  editor.provider = new UnsplashFakeProvider();
  for (const type of ['uc:done', 'uc:cancel', 'uc:error'] as const) {
    editor.addEventListener(type, (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (type === 'uc:done') logMsg(`uc:done → ${detail?.url ?? ''}`);
      else if (type === 'uc:error') logMsg(`uc:error → ${detail?.error ?? 'error'}`);
      else logMsg('uc:cancel');
    });
  }
  editor.presets = {
    generate: [
      { label: 'Mountain lake', prompt: 'A serene mountain lake at golden hour' },
      { label: 'Foggy forest', prompt: 'A misty pine forest at dawn' },
      { label: 'Alpine road', prompt: 'A winding road through autumn hills' },
    ],
  };
  editor.style.height = '100%';
  apply();
  host.value?.replaceChildren(editor);
});
</script>

<template>
  <div class="demo">
    <div class="demo-banner">
      ⚠️ <strong>Fake editor for demo purposes.</strong> Results are random
      <a href="https://unsplash.com" target="_blank" rel="noreferrer">Unsplash</a>
      photos — nothing is AI-generated, and no Uploadcare account or network API
      is used.
    </div>

    <div class="demo-controls">
      <label v-for="s in SELECTS" :key="s.key" class="ctl">
        <span>{{ s.label }}</span>
        <select v-model="opts[s.key]">
          <option v-for="o in s.options" :key="o" :value="o">{{ o }}</option>
        </select>
      </label>
      <label v-for="t in TOGGLES" :key="t.key" class="ctl ctl--check">
        <input type="checkbox" v-model="opts[t.key]" />
        <span>{{ t.label }}</span>
      </label>
      <label class="ctl">
        <span>Aspect ratios</span>
        <input
          type="text"
          v-model="opts.aspectRatios"
          placeholder="e.g. 16:9 1:1 4:3 (blank = default)"
        />
      </label>
    </div>

    <div ref="host" :class="['demo-stage', { 'demo-stage--content': opts.sizing === 'content' }]"></div>

    <div class="demo-log" aria-label="Event log">
      <div v-if="!logLines.length" class="demo-log__empty">
        Events (uc:done / uc:cancel / uc:error) and option changes appear here…
      </div>
      <div v-for="(line, i) in logLines" :key="i" class="demo-log__line">{{ line }}</div>
    </div>
  </div>
</template>

<style scoped>
.demo-banner {
  margin: 16px 0 12px;
  padding: 10px 14px;
  border: 1px solid var(--vp-c-warning-1, #d97706);
  border-radius: 10px;
  background: var(--vp-c-warning-soft, rgba(217, 119, 6, 0.1));
  font-size: 14px;
  line-height: 1.5;
}
.demo-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  margin-bottom: 14px;
  padding: 12px 14px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
}
.ctl {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--vp-c-text-2);
}
.ctl--check {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  align-self: end;
  padding-bottom: 6px;
}
.ctl select,
.ctl input[type='text'] {
  font: inherit;
  font-size: 13px;
  padding: 5px 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}
.ctl input[type='text'] {
  min-width: 230px;
}
.demo-stage {
  height: min(70vh, 640px);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
}
/* Content sizing: the editor owns its height — the stage wraps it. */
.demo-stage--content {
  height: auto;
}
.demo-log {
  margin-top: 12px;
  max-height: 168px;
  overflow-y: auto;
  padding: 10px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg-alt);
  font: 12px/1.6 var(--vp-font-family-mono, ui-monospace, monospace);
  color: var(--vp-c-text-2);
}
.demo-log__empty {
  color: var(--vp-c-text-3);
}
.demo-log__line {
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
