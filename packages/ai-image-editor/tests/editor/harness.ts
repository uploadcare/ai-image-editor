import { afterEach } from 'vitest';
import { page } from 'vitest/browser';
import type { UcAiImageEditor as UcAiImageEditorType } from '../../src/index';
import { UcAiImageEditor } from '../../src/index';
import { cleanup } from '../test-renderer';

/**
 * Shared setup for the `<uc-ai-image-editor>` browser tests, which are split by
 * subject (mounting, generation, history, layout, …) and all need the same
 * three things: the elements registered, a stubbed Upload API, and a mounted
 * editor. Importing this module registers the custom elements and the teardown
 * for whichever test file pulls it in.
 */
export { UcAiImageEditor };
export type { UcAiImageEditorType };

let restoreFetch: (() => void) | null = null;

afterEach(() => {
  restoreFetch?.();
  restoreFetch = null;
  // Persisted history is namespaced by pubkey in localStorage; clear it so a
  // seeded/recorded lineage in one test can't leak into the next.
  localStorage.clear();
  cleanup();
});

export const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

/** A finished job frame, as `derivative/status/` returns it. */
export const successFrame = (uuid: string): Record<string, unknown> => ({
  status: 'success',
  uuid,
  file_id: uuid,
  size: 1,
  done: 1,
  total: 1,
  original_filename: 'generated.png',
  filename: 'generated.png',
  mime_type: 'image/png',
  is_image: true,
  is_stored: false,
  is_ready: true,
  image_info: null,
  video_info: null,
  content_info: null,
  metadata: {},
});

/**
 * Swap `globalThis.fetch` for the rest of the test. The provider binds
 * `globalThis.fetch` at construction, so install a stub BEFORE setting `pubkey`.
 */
export function installFetch(handler: typeof fetch): void {
  const real = globalThis.fetch;
  globalThis.fetch = handler;
  restoreFetch = () => {
    globalThis.fetch = real;
  };
}

/**
 * Drive the internal UploadcareDerivativeApi: the generate POST returns a job,
 * the status GET returns success (or a custom handler). Captures the POST
 * bodies for assertions.
 */
export function stubFetch(opts: { uuid?: string; status?: (signal?: AbortSignal) => Promise<Response> } = {}): {
  generateBodies: Array<Record<string, unknown>>;
} {
  const generateBodies: Array<Record<string, unknown>> = [];
  installFetch((async (_input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    if (method === 'POST') {
      generateBodies.push(JSON.parse((init?.body as string) ?? '{}'));
      return jsonResponse({ type: 'job', job_id: 'job-1' });
    }
    if (opts.status) return opts.status(init?.signal ?? undefined);
    return jsonResponse(successFrame(opts.uuid ?? 'result'));
  }) as typeof fetch);
  return { generateBodies };
}

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

export const SAMPLE_UUID = '11111111-2222-3333-4444-555555555555';

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
