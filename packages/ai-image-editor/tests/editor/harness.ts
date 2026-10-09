import { DEMO_FILES } from '@uploadcare/api-emulator';
import { afterEach, beforeEach, expect } from 'vitest';
import { page, userEvent } from 'vitest/browser';
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

/*
 * The editor as a user finds it: by role and accessible name, through its shadow roots (locators pierce open ones).
 * The names are the English strings, written out so a changed label fails here rather than following the source.
 */

/** The prompt box, named after the mode's placeholder. */
export const promptBox = () => page.getByRole('textbox');

/** The prompt row's send button. It is hidden until the prompt holds text. */
export const sendButton = () => page.getByRole('button', { name: 'Generate', exact: true });

/** The footer's primary, which commits the result (fires `uc:done`). */
export const doneButton = () => page.getByRole('button', { name: 'Done', exact: true });

/** The editor's region, named after its mode. */
export const editorRegion = (mode: 'generate' | 'edit') =>
  page.getByRole('region', { name: mode === 'edit' ? 'Edit image' : 'Generate image', exact: true });

/** The canvas's picture. Thumbnails and preloads are hidden from the accessibility tree, so it is the only image. */
export const canvasImage = () => page.getByRole('img');

/** The result chips in the history strip, each named after the prompt that made it. */
export const historyChips = () => page.getByRole('toolbar', { name: 'Recent prompts' }).getByRole('button');

export const fillPrompt = (value: string) => userEvent.fill(promptBox(), value);

export const clickDone = () => userEvent.click(doneButton());

/** Types the prompt and sends it. */
export async function sendPrompt(value: string): Promise<void> {
  await fillPrompt(value);
  await userEvent.click(sendButton());
}

/** Waits for the run's result to land in the session and answers its uuid. */
export async function generatedUuid(): Promise<string> {
  await expect.poll(resultUuid).toBeDefined();
  return resultUuid()!;
}

/** Waits for the canvas to show the CDN rendition of `uuid`. */
export const expectCanvasToShow = (uuid: string) =>
  expect.element(canvasImage()).toHaveAttribute('src', expect.stringContaining(`https://cdn.example.com/${uuid}/`));
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
