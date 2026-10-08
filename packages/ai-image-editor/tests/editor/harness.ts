import { DEMO_FILES } from '@uploadcare/api-emulator';
import { afterEach, beforeEach } from 'vitest';
import { page } from 'vitest/browser';
import type { UcAiImageEditor as UcAiImageEditorType } from '../../src/index';
import { UcAiImageEditor } from '../../src/index';
import { session } from '../emulator';
import { cleanup } from '../test-renderer';

/**
 * Shared setup for the `<uc-ai-image-editor>` browser tests, which are split by
 * subject (mounting, generation, history, layout, …) and all need the same
 * three things: the elements registered, the Upload API (the emulator, see
 * `tests/emulator.ts`), and a mounted editor. Importing this module registers
 * the custom elements and the teardown for whichever test file pulls it in.
 */
export { UcAiImageEditor };
export type { UcAiImageEditorType };

/** Generations finish on their first status poll, so a test doesn't sit through the editor's 1.5s interval. */
beforeEach(() => {
  session.use('derivativesInstant');
});

afterEach(() => {
  // Persisted history is namespaced by pubkey in localStorage; clear it so a
  // seeded/recorded lineage in one test can't leak into the next.
  localStorage.clear();
  cleanup();
});

export function mount(attrs: Record<string, string> = {}): UcAiImageEditorType {
  const el = document.createElement('uc-ai-image-editor') as UcAiImageEditorType;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  // These tests exercise editor *logic* (modes, generation flow, events), which
  // is backend-agnostic. Force the dot-grid's 2D path: headless Chromium uses a
  // software WebGL renderer (swiftshader), and the shimmer's per-frame GL work
  // starves the main thread enough to flake the async `waitFor`s. Real GPUs are
  // fine; WebGL rendering itself is covered manually / in the shimmer lab.
  el.shimmerConfig = { useWebgl: false };
  page.render(el);
  return el;
}

export const STAGING = { pubkey: 'demopublickey', 'cdn-cname': 'https://cdn.example.com' };

/** An image every fresh emulator session already holds. */
export const SAMPLE_UUID = DEMO_FILES[0];

/** The file the test's run produced: the one in the session that isn't a seeded `DEMO_FILES` image. */
export const resultUuid = (): string | undefined =>
  [...session.files.keys()].find((uuid) => !DEMO_FILES.includes(uuid));

export function typePrompt(el: UcAiImageEditorType, value: string): void {
  const input = el.shadowRoot!.querySelector('uc-ai-prompt-row')!.shadowRoot!.querySelector('textarea')!;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

export function primaryBtn(el: UcAiImageEditorType): HTMLButtonElement {
  return el.shadowRoot!.querySelector('uc-ai-footer')!.shadowRoot!.querySelector('.btn--primary') as HTMLButtonElement;
}

/** Footer primary commits the result (fires uc:done). */
export function clickPrimary(el: UcAiImageEditorType): void {
  primaryBtn(el).click();
}

/** The prompt row's send button triggers generation. */
export function clickSend(el: UcAiImageEditorType): void {
  const promptRow = el.shadowRoot!.querySelector('uc-ai-prompt-row')!;
  (promptRow.shadowRoot!.querySelector('.send') as HTMLButtonElement).click();
}

export const historyEl = (el: UcAiImageEditorType) =>
  el.shadowRoot!.querySelector('uc-ai-history') as (HTMLElement & { entries: unknown[] }) | null;

export const canvasUrl = (el: UcAiImageEditorType): string | null =>
  (el.shadowRoot!.querySelector('uc-ai-canvas') as unknown as { url: string | null }).url;

/** The derived editor mode, read off the prompt-row child the editor feeds. */
export const editorMode = (el: UcAiImageEditorType): string =>
  (el.shadowRoot!.querySelector('uc-ai-prompt-row') as unknown as { mode: string }).mode;
