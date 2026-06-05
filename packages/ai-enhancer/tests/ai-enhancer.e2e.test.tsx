import { page } from '@vitest/browser/context';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { UcAiEditor as UcAiEditorType } from '../src/index';
import { cleanup } from './test-renderer';

let UcAiEditorCtor: CustomElementConstructor;

beforeAll(async () => {
  // Importing the module registers <uc-ai-editor> and all sub-elements.
  const mod = await import('../src/index');
  UcAiEditorCtor = mod.UcAiEditor;
});

let restoreFetch: (() => void) | null = null;

afterEach(() => {
  restoreFetch?.();
  restoreFetch = null;
  cleanup();
});

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

/**
 * Stub `globalThis.fetch` to drive the now-internal UploadcareDerivativeApi:
 * the generate POST returns a job, the status GET returns success (or a custom
 * handler). Captures the POST bodies for assertions. The provider binds
 * `globalThis.fetch` at construction, so install this BEFORE setting `pubkey`.
 */
function stubFetch(opts: { uuid?: string; status?: (signal?: AbortSignal) => Promise<Response> } = {}): {
  generateBodies: Array<Record<string, unknown>>;
} {
  const real = globalThis.fetch;
  const generateBodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    if (method === 'POST') {
      generateBodies.push(JSON.parse((init?.body as string) ?? '{}'));
      return jsonResponse({ type: 'job', job_id: 'job-1' });
    }
    if (opts.status) return opts.status(init?.signal ?? undefined);
    return jsonResponse({ status: 'success', uuid: opts.uuid ?? 'result' });
  }) as typeof fetch;
  restoreFetch = () => {
    globalThis.fetch = real;
  };
  return { generateBodies };
}

function mount(attrs: Record<string, string> = {}): UcAiEditorType {
  const el = document.createElement('uc-ai-editor') as UcAiEditorType;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  page.render(el);
  return el;
}

const STAGING = { pubkey: 'demopublickey', 'cdn-cname': 'https://cdn.example.com' };

function typePrompt(el: UcAiEditorType, value: string): void {
  const input = el.shadowRoot!.querySelector('uc-ai-prompt-row')!.shadowRoot!.querySelector('textarea')!;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function primaryBtn(el: UcAiEditorType): HTMLButtonElement {
  return el.shadowRoot!.querySelector('uc-ai-footer')!.shadowRoot!.querySelector('.btn--primary') as HTMLButtonElement;
}

/** Footer primary commits the result (fires uc:done). */
function clickPrimary(el: UcAiEditorType): void {
  primaryBtn(el).click();
}

/** The prompt row's send button triggers generation. */
function clickSend(el: UcAiEditorType): void {
  const promptRow = el.shadowRoot!.querySelector('uc-ai-prompt-row')!;
  (promptRow.shadowRoot!.querySelector('.icon-btn--primary') as HTMLButtonElement).click();
}

const canvasUrl = (el: UcAiEditorType): string | null =>
  (el.shadowRoot!.querySelector('uc-ai-canvas') as unknown as { url: string | null }).url;

/** The derived editor mode, read off the prompt-row child the editor feeds. */
const editorMode = (el: UcAiEditorType): string =>
  (el.shadowRoot!.querySelector('uc-ai-prompt-row') as unknown as { mode: string }).mode;

const SAMPLE_UUID = '11111111-2222-3333-4444-555555555555';

describe('<uc-ai-editor>', () => {
  it('registers the custom element', () => {
    expect(customElements.get('uc-ai-editor')).toBe(UcAiEditorCtor);
  });

  it('mounts in generate mode by default and renders the canvas + prompt + chips + footer', async () => {
    const el = mount();
    await el.updateComplete;
    const root = el.shadowRoot;
    expect(root?.querySelector('uc-ai-canvas')).toBeTruthy();
    expect(root?.querySelector('uc-ai-prompt-row')).toBeTruthy();
    expect(root?.querySelector('uc-ai-chips')).toBeTruthy();
    expect(root?.querySelector('uc-ai-footer')).toBeTruthy();
    expect(root?.querySelector('uc-ai-history-popover')).toBeTruthy();
    expect(editorMode(el)).toBe('generate');
  });

  it('derives edit mode from a source uuid, generate mode without one', async () => {
    const el = mount();
    await el.updateComplete;
    expect(editorMode(el)).toBe('generate');
    el.source = SAMPLE_UUID;
    await el.updateComplete;
    expect(editorMode(el)).toBe('edit');
  });

  it('auto-enters edit mode after the first successful generation', async () => {
    stubFetch({ uuid: 'result' });
    const el = mount(STAGING);
    await el.updateComplete;
    expect(editorMode(el)).toBe('generate');
    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(canvasUrl(el)).toBe('https://cdn.example.com/result/'));
    await el.updateComplete;
    expect(editorMode(el)).toBe('edit');
  });

  it('clears the prompt after a successful generation', async () => {
    stubFetch({ uuid: 'result' });
    const el = mount(STAGING);
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('uc-ai-prompt-row')!.shadowRoot!.querySelector('textarea')!;
    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(canvasUrl(el)).toBe('https://cdn.example.com/result/'));
    await el.updateComplete;
    expect(input.value).toBe('');
  });

  it('returns to generate mode after Start over', async () => {
    stubFetch({ uuid: 'result' });
    const el = mount(STAGING);
    await el.updateComplete;
    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(editorMode(el)).toBe('edit'));

    const footer = el.shadowRoot!.querySelector('uc-ai-footer')!;
    const startOver = Array.from(footer.shadowRoot!.querySelectorAll('.actions .btn')).find(
      (b) => !b.classList.contains('btn--primary'),
    ) as HTMLButtonElement;
    startOver.click();
    await el.updateComplete;
    expect(editorMode(el)).toBe('generate');
    expect(canvasUrl(el)).toBeNull();
  });

  it('updates internal prompt state when the user types in the prompt input', async () => {
    const el = mount();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('uc-ai-prompt-row')!.shadowRoot!.querySelector('textarea')!;
    input.value = 'a tiger';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    expect(input.value).toBe('a tiger');
  });

  it('generates via the send button, then the primary commits the result with uc:done', async () => {
    stubFetch({ uuid: 'result' });
    const el = mount(STAGING);
    await el.updateComplete;

    // Primary is disabled until there is a result to commit.
    expect(primaryBtn(el).disabled).toBe(true);

    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => {
      expect(canvasUrl(el)).toBe('https://cdn.example.com/result/');
    });
    await el.updateComplete;

    // Now the primary commits the generated result (it never generates).
    expect(primaryBtn(el).disabled).toBe(false);
    const onDone = vi.fn();
    el.addEventListener('uc:done', onDone);
    clickPrimary(el);
    expect(onDone).toHaveBeenCalledTimes(1);
    const detail = onDone.mock.calls[0]![0].detail;
    expect(detail.url).toBe('https://cdn.example.com/result/');
    expect(detail.file.uuid).toBe('result');
    expect(detail.file.cdnUrl).toBe('https://cdn.example.com/result/');
  });

  it('dispatches uc:cancel when the back button is clicked', async () => {
    const el = mount();
    await el.updateComplete;
    const onCancel = vi.fn();
    el.addEventListener('uc:cancel', onCancel);
    const footer = el.shadowRoot!.querySelector('uc-ai-footer')!;
    (footer.shadowRoot!.querySelector('.btn') as HTMLButtonElement).click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('keeps the primary disabled and fires no uc:done until a result exists (edit mode with a source)', async () => {
    const el = mount(STAGING);
    el.source = SAMPLE_UUID;
    await el.updateComplete;
    expect(editorMode(el)).toBe('edit');
    const onDone = vi.fn();
    el.addEventListener('uc:done', onDone);
    // A source image alone is not a result — the primary commits results only.
    expect(primaryBtn(el).disabled).toBe(true);
    clickPrimary(el);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('does not dispatch uc:done when there is no result (generate mode)', async () => {
    const el = mount();
    await el.updateComplete;
    const onDone = vi.fn();
    el.addEventListener('uc:done', onDone);
    expect(primaryBtn(el).disabled).toBe(true);
    primaryBtn(el).click();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('populates history after a successful generation', async () => {
    stubFetch();
    const el = mount(STAGING);
    await el.updateComplete;
    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => {
      const popover = el.shadowRoot!.querySelector('uc-ai-history-popover')!;
      // @ts-expect-error reading public Lit @property
      expect(popover.entries.length).toBe(1);
    });
  });

  it('opens the popover (native Popover API) when the history button is clicked in edit mode with empty prompt', async () => {
    stubFetch();
    // A successful generation seeds history and auto-enters edit mode.
    const el = mount(STAGING);
    await el.updateComplete;
    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => {
      const popover = el.shadowRoot!.querySelector('uc-ai-history-popover')!;
      // @ts-expect-error reading public Lit @property
      expect(popover.entries.length).toBe(1);
    });
    expect(editorMode(el)).toBe('edit');
    // The history button is the edit-mode affordance shown when the prompt is empty.
    const promptRow = el.shadowRoot!.querySelector('uc-ai-prompt-row')!;
    const input = promptRow.shadowRoot!.querySelector('textarea')!;
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    (promptRow.shadowRoot!.querySelector('.icon-btn') as HTMLButtonElement).click();
    await el.updateComplete;
    const popover = el.shadowRoot!.querySelector('uc-ai-history-popover')!;
    expect(popover.matches(':popover-open')).toBe(true);
  });

  it('renders the aspect-ratio picker in generate mode and sends the selected ratio', async () => {
    const stub = stubFetch();
    const el = mount({ ...STAGING, 'aspect-ratios': '16:9 1:1' });
    await el.updateComplete;

    const ratio = el.shadowRoot!.querySelector('uc-ai-aspect-ratio')!;
    expect(ratio).toBeTruthy();

    // Default selection is the first option in the list (16:9).
    typePrompt(el, 'mountain');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(stub.generateBodies.length).toBe(1));
    expect(stub.generateBodies[0]!.aspect_ratio).toEqual([16, 9]);

    // Pick the second option from the popover.
    (ratio.shadowRoot!.querySelector('.trigger') as HTMLButtonElement).click();
    await el.updateComplete;
    const options = Array.from(ratio.shadowRoot!.querySelectorAll('.option')) as HTMLButtonElement[];
    expect(options.length).toBe(2);
    options[1]!.click();
    await el.updateComplete;
    // The first run cleared the prompt — re-type so the send button reappears.
    typePrompt(el, 'mountain again');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(stub.generateBodies.length).toBe(2));
    expect(stub.generateBodies[1]!.aspect_ratio).toEqual([1, 1]);
  });

  it('includes the UploadcareFile and its uuid in uc:done after a generation', async () => {
    stubFetch({ uuid: 'result-123' });
    const el = mount(STAGING);
    await el.updateComplete;
    const onDone = vi.fn();
    el.addEventListener('uc:done', onDone);

    typePrompt(el, 'make it pop');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(canvasUrl(el)).toBe('https://cdn.example.com/result-123/'));
    await el.updateComplete;

    clickPrimary(el);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone.mock.calls[0]![0].detail.file.uuid).toBe('result-123');
    expect(onDone.mock.calls[0]![0].detail.uuid).toBe('result-123');
  });

  it('renders the aspect-ratio picker in edit mode too', async () => {
    const el = mount(STAGING);
    el.source = SAMPLE_UUID;
    await el.updateComplete;
    expect(editorMode(el)).toBe('edit');
    expect(el.shadowRoot!.querySelector('uc-ai-aspect-ratio')).toBeTruthy();
  });

  it('aborts in-flight generation and shows the new source when source changes', async () => {
    // Status hangs until the request is aborted.
    stubFetch({
      status: (signal) =>
        new Promise((_res, rej) => {
          signal?.addEventListener('abort', () => rej(new DOMException('Aborted', 'AbortError')), { once: true });
        }),
    });
    // Non-UUID-shaped ids keep the CDN preview helper from rewriting the URL,
    // so the canvas URL is the bare resolved source.
    const el = mount({ ...STAGING, source: 'first-uuid' });
    await el.updateComplete;

    typePrompt(el, 'try');
    await el.updateComplete;
    (
      el
        .shadowRoot!.querySelector('uc-ai-prompt-row')!
        .shadowRoot!.querySelector('.icon-btn--primary') as HTMLButtonElement
    ).click();

    // Change source mid-flight — this aborts the in-flight generation.
    el.source = 'second-uuid';
    await el.updateComplete;

    // After the abort, the displayed image should be the new source (no result override).
    await vi.waitFor(() => {
      expect(canvasUrl(el)).toBe('https://cdn.example.com/second-uuid/');
    });
  });
});
