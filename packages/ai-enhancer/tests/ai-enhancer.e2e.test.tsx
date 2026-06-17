import { page } from '@vitest/browser/context';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MODES, type UcAiEditor as UcAiEditorType } from '../src/index';
import { cleanup } from './test-renderer';

let UcAiEditorCtor: CustomElementConstructor;

// These tests exercise editor *logic* (modes, generation flow, events), which is
// backend-agnostic. Force the dot-grid's 2D canvas path: headless Chromium uses
// a software WebGL renderer (swiftshader), and the shimmer's per-frame GL work
// starves the main thread enough to flake the async `waitFor`s. Real GPUs are
// fine; WebGL rendering itself is covered manually / in the Shimmer Lab.
(globalThis as { __ucDotGl?: boolean }).__ucDotGl = false;

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
  (promptRow.shadowRoot!.querySelector('.send') as HTMLButtonElement).click();
}

const historyEl = (el: UcAiEditorType) =>
  el.shadowRoot!.querySelector('uc-ai-history') as (HTMLElement & { entries: unknown[] }) | null;

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

  it('mounts in generate mode and renders the canvas + prompt + chips + footer (no history strip yet)', async () => {
    const el = mount();
    await el.updateComplete;
    const root = el.shadowRoot;
    expect(root?.querySelector('uc-ai-canvas')).toBeTruthy();
    expect(root?.querySelector('uc-ai-prompt-row')).toBeTruthy();
    expect(root?.querySelector('uc-ai-chips')).toBeTruthy();
    expect(root?.querySelector('uc-ai-footer')).toBeTruthy();
    // The history strip only mounts once there are results (or in edit mode).
    expect(root?.querySelector('uc-ai-history')).toBeNull();
    expect(editorMode(el)).toBe('generate');
  });

  it('renders configurable prompt presets per mode', async () => {
    const el = mount();
    el.presets = {
      generate: [
        { label: 'Logo', prompt: 'A logo of ' },
        { label: 'Sticker', prompt: 'A sticker of ' },
      ],
      edit: [{ label: 'Enhance', prompt: 'Enhance it' }],
    };
    await el.updateComplete;

    const chipLabels = async (): Promise<string[]> => {
      const chips = el.shadowRoot!.querySelector('uc-ai-chips') as unknown as { updateComplete: Promise<unknown>; shadowRoot: ShadowRoot } | null;
      await chips?.updateComplete;
      return [...(chips?.shadowRoot.querySelectorAll('.chip') ?? [])].map((c) => c.textContent!.trim());
    };

    // generate mode uses presets.generate…
    expect(await chipLabels()).toEqual(['Logo', 'Sticker']);

    // …and edit mode uses presets.edit.
    el.source = SAMPLE_UUID;
    await el.updateComplete;
    expect(await chipLabels()).toEqual(['Enhance']);
  });

  it('falls back to built-in presets for modes left out of the presets map', async () => {
    const el = mount();
    el.presets = { edit: [{ label: 'Enhance', prompt: 'Enhance it' }] }; // generate omitted
    await el.updateComplete;
    const chips = el.shadowRoot!.querySelector('uc-ai-chips') as unknown as { shadowRoot: ShadowRoot };
    expect(chips.shadowRoot.querySelectorAll('.chip').length).toBe(MODES.generate.presets.length);
  });

  it('hides the chips toolbar when a mode preset set is empty', async () => {
    const el = mount();
    el.presets = { generate: [] };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('uc-ai-chips')).toBeNull();
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

  it('returns to generate mode after Start over (from the history strip)', async () => {
    stubFetch({ uuid: 'result' });
    const el = mount(STAGING);
    await el.updateComplete;
    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(editorMode(el)).toBe('edit'));
    await el.updateComplete;

    const history = historyEl(el)!;
    const startOver = history.shadowRoot!.querySelector('.startover__btn') as HTMLButtonElement;
    startOver.click();
    await el.updateComplete;
    expect(editorMode(el)).toBe('generate');
    expect(canvasUrl(el)).toBeNull();
    // Start over also clears the prompt history (the strip unmounts).
    await vi.waitFor(() => expect(historyEl(el)).toBeNull());
  });

  it('does not render Start over in edit mode opened with a source (uploader AI-edit)', async () => {
    const el = mount(STAGING);
    el.source = SAMPLE_UUID;
    await el.updateComplete;
    await vi.waitFor(() => expect(editorMode(el)).toBe('edit'));
    await el.updateComplete;

    // Editing an existing image has nothing to "start over" to — the affordance
    // is absent (and, with no generation history yet, the strip isn't mounted).
    const history = historyEl(el);
    const startOver = history?.shadowRoot?.querySelector('.startover__btn') ?? null;
    expect(startOver).toBeNull();
  });

  it('places the composer per composer-placement + canvas-fit', async () => {
    const el = mount(STAGING);
    el.canvasFit = 'full';
    el.composerPlacement = 'bottom';
    await el.updateComplete;
    const shell = el.shadowRoot!.querySelector('.shell')!;
    const stage = () => shell.querySelector('.stage')!;
    const composer = () => shell.querySelector('.composer')!;

    // canvas-fit full → composer floats over the full canvas (inside the stage).
    expect(composer().classList.contains('composer--overlay-bottom')).toBe(true);
    expect(stage().contains(composer())).toBe(true);

    el.composerPlacement = 'top';
    await el.updateComplete;
    expect(composer().classList.contains('composer--overlay-top')).toBe(true);
    expect(stage().contains(composer())).toBe(true);

    // canvas-fit available → composer docked outside the stage so the canvas
    // shrinks. `top` sits before the stage…
    el.canvasFit = 'available';
    el.composerPlacement = 'top';
    await el.updateComplete;
    expect(composer().classList.contains('composer--docked')).toBe(true);
    expect(stage().contains(composer())).toBe(false);
    let kids = [...shell.children];
    expect(kids.indexOf(composer())).toBeLessThan(kids.indexOf(stage()));

    // …`bottom` after it.
    el.composerPlacement = 'bottom';
    await el.updateComplete;
    kids = [...shell.children];
    expect(kids.indexOf(composer())).toBeGreaterThan(kids.indexOf(stage()));
  });

  it('defaults to a docked composer at the bottom', async () => {
    const el = mount(STAGING);
    await el.updateComplete;
    const composer = el.shadowRoot!.querySelector('.composer')!;
    expect(el.composerPlacement).toBe('bottom');
    expect(el.canvasFit).toBe('available');
    expect(composer.classList.contains('composer--docked-bottom')).toBe(true);
  });

  it('places the history strip per history-placement (overlay composer)', async () => {
    stubFetch({ uuid: 'r' });
    const el = mount(STAGING);
    el.canvasFit = 'full'; // relative history rides an overlay composer
    await el.updateComplete;
    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(editorMode(el)).toBe('edit')); // a result mounts the strip
    await el.updateComplete;

    const shell = el.shadowRoot!.querySelector('.shell')!;
    const history = () => shell.querySelector('uc-ai-history')!;
    const composer = () => shell.querySelector('.composer')!;
    const stage = () => shell.querySelector('.stage')!;
    const promptRow = () => composer().querySelector('uc-ai-prompt-row')!;

    // composer-above (default): inside the composer, before the prompt row.
    expect(composer().contains(history())).toBe(true);
    let kids = [...composer().children];
    expect(kids.indexOf(history())).toBeLessThan(kids.indexOf(promptRow()));

    // composer-below: inside the composer, after the prompt row.
    el.historyPlacement = 'composer-below';
    await el.updateComplete;
    kids = [...composer().children];
    expect(kids.indexOf(history())).toBeGreaterThan(kids.indexOf(promptRow()));

    // canvas-top: pinned in the stage, not inside the composer.
    el.historyPlacement = 'canvas-top';
    await el.updateComplete;
    expect(composer().contains(history())).toBe(false);
    const pinned = stage().querySelector('.history-pinned')!;
    expect(pinned.classList.contains('history-pinned--canvas-top')).toBe(true);
    expect(pinned.contains(history())).toBe(true);
  });

  it('pins the history over the canvas when the composer is docked-out', async () => {
    stubFetch({ uuid: 'r' });
    const el = mount(STAGING); // docked at the bottom by default
    await el.updateComplete;
    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(editorMode(el)).toBe('edit'));
    await el.updateComplete;

    const shell = el.shadowRoot!.querySelector('.shell')!;
    const stage = shell.querySelector('.stage')!;
    const composer = shell.querySelector('.composer')!;
    const history = shell.querySelector('uc-ai-history')!;

    // The composer (prompt) is docked outside the canvas; the history chips
    // float over the canvas (pinned), not inside the docked composer.
    expect(stage.contains(composer)).toBe(false);
    expect(composer.contains(history)).toBe(false);
    const pinned = stage.querySelector('.history-pinned')!;
    expect(pinned.contains(history)).toBe(true);
    expect(pinned.classList.contains('history-pinned--canvas-bottom')).toBe(true);
  });

  it('places the toolbar per toolbar-placement', async () => {
    const el = mount(STAGING);
    await el.updateComplete;
    const shell = el.shadowRoot!.querySelector('.shell')!;
    const footer = () => shell.querySelector('uc-ai-footer')!;
    const stage = () => shell.querySelector('.stage')!;

    // Default: toolbar at the bottom (after the stage).
    let kids = [...shell.children];
    expect(kids.indexOf(footer())).toBeGreaterThan(kids.indexOf(stage()));

    // Top: toolbar before the stage.
    el.toolbarPlacement = 'top';
    await el.updateComplete;
    kids = [...shell.children];
    expect(kids.indexOf(footer())).toBeLessThan(kids.indexOf(stage()));
  });

  it('docks the overlay composer (renders the dock-hotzone) when composer-auto-hide is on', async () => {
    const el = mount(STAGING);
    el.canvasFit = 'full'; // an overlay (floating) composer
    el.composerAutoHide = true;
    el.source = SAMPLE_UUID; // edit mode + an image to dock against
    await el.updateComplete;
    await vi.waitFor(() => expect(canvasUrl(el)).toBeTruthy());
    await el.updateComplete;

    // The CSS docking keys off this reflected host attribute.
    expect(el.hasAttribute('composer-auto-hide')).toBe(true);

    // A pointer catch-strip is rendered on the composer's edge (bottom by default).
    const hotzone = el.shadowRoot!.querySelector('.dock-hotzone');
    expect(hotzone).toBeTruthy();
    expect(hotzone!.classList.contains('dock-hotzone--bottom')).toBe(true);
  });

  it('resolves locale strings from localeName + locale-keyed localeDefinitionOverride', async () => {
    const el = mount(STAGING);
    const cancelLabel = () => el.shadowRoot!.querySelector('uc-ai-footer')!.getAttribute('cancel-label');

    // Override is keyed by locale name (same shape as the uploader's config).
    el.localeDefinitionOverride = { en: { 'ai-enhancer-cancel': 'Dismiss' } };
    await el.updateComplete;
    await vi.waitFor(() => expect(cancelLabel()).toBe('Dismiss'));

    // Switching the active locale lazy-loads that locale's built-in strings.
    el.localeName = 'de';
    await vi.waitFor(() => expect(cancelLabel()).toBe('Abbrechen'));
  });

  it('does not dock (no hotzone) when auto-hide is disabled', async () => {
    const el = mount(STAGING);
    el.source = SAMPLE_UUID;
    await el.updateComplete;
    await vi.waitFor(() => expect(canvasUrl(el)).toBeTruthy());

    // Disabled (default): no dock-hotzone, no reserved space.
    expect(el.shadowRoot!.querySelector('.dock-hotzone')).toBeNull();
    expect(el.hasAttribute('composer-auto-hide')).toBe(false);
  });

  it('keeps a docked composer docked under auto-hide (no overlay, no hotzone), independent of canvas-fit', async () => {
    const el = mount(STAGING);
    el.source = SAMPLE_UUID;
    el.composerAutoHide = true;
    el.composerPlacement = 'bottom';
    el.canvasFit = 'available';
    await el.updateComplete;
    await vi.waitFor(() => expect(canvasUrl(el)).toBeTruthy());
    await el.updateComplete;

    // Auto-hide is orthogonal to canvas-fit: it does NOT force `full`. A docked
    // composer stays docked and hides by collapsing in place (so no overlay
    // positioning and no dock-hotzone — that chrome is overlay-only).
    expect(el.canvasFit).toBe('available');
    const composer = el.shadowRoot!.querySelector('.composer')!;
    expect(composer.classList.contains('composer--docked')).toBe(true);
    expect(composer.classList.contains('composer--overlay')).toBe(false);
    expect(el.shadowRoot!.querySelector('.dock-hotzone')).toBeNull();
  });

  it('docks an overlay composer with a hotzone when auto-hide is on', async () => {
    const el = mount(STAGING);
    el.source = SAMPLE_UUID;
    el.composerAutoHide = true;
    el.canvasFit = 'full'; // floating composer
    await el.updateComplete;
    await vi.waitFor(() => expect(canvasUrl(el)).toBeTruthy());
    await el.updateComplete;

    const composer = el.shadowRoot!.querySelector('.composer')!;
    expect(composer.classList.contains('composer--overlay')).toBe(true);
    const hotzone = el.shadowRoot!.querySelector('.dock-hotzone');
    expect(hotzone).toBeTruthy();
    expect(hotzone!.classList.contains('dock-hotzone--bottom')).toBe(true);
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

  it('dispatches uc:cancel when the cancel button is clicked', async () => {
    const el = mount();
    await el.updateComplete;
    const onCancel = vi.fn();
    el.addEventListener('uc:cancel', onCancel);
    const footer = el.shadowRoot!.querySelector('uc-ai-footer')!;
    (footer.shadowRoot!.querySelector('.btn--ghost') as HTMLButtonElement).click();
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

  it('populates the history strip after a successful generation', async () => {
    stubFetch();
    const el = mount(STAGING);
    await el.updateComplete;
    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => {
      expect(historyEl(el)?.entries.length).toBe(1);
    });
  });

  it('shows the generated result as a selectable history chip', async () => {
    stubFetch();
    const el = mount(STAGING);
    await el.updateComplete;
    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(historyEl(el)?.entries.length).toBe(1));
    await el.updateComplete;

    const history = historyEl(el)!;
    const chips = history.shadowRoot!.querySelectorAll('.chip');
    expect(chips.length).toBe(1);
    // The current result's chip is marked selected.
    expect(history.shadowRoot!.querySelector('.chip--selected')).toBeTruthy();
  });

  it('renders the aspect-ratio picker in generate mode (no Original) and sends the selected ratio', async () => {
    const stub = stubFetch();
    const el = mount({ ...STAGING, 'aspect-ratios': '16:9 1:1' });
    await el.updateComplete;

    const ratio = el.shadowRoot!.querySelector('uc-ai-aspect-ratio')!;
    expect(ratio).toBeTruthy();

    // Generate mode offers only the standard ratios — no "Original".
    (ratio.shadowRoot!.querySelector('.trigger') as HTMLButtonElement).click();
    await el.updateComplete;
    const options = Array.from(ratio.shadowRoot!.querySelectorAll('.option')) as HTMLButtonElement[];
    expect(options.length).toBe(2);

    // Pick the second option (1:1) before the only generate — sending flips to edit.
    options[1]!.click();
    await el.updateComplete;
    typePrompt(el, 'mountain');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(stub.generateBodies.length).toBe(1));
    expect(stub.generateBodies[0]!.aspect_ratio).toEqual([1, 1]);
  });

  it('defaults edit mode to "Original" and omits aspect_ratio (preserving the source AR)', async () => {
    const stub = stubFetch({ uuid: 'edited' });
    const el = mount(STAGING);
    el.source = SAMPLE_UUID;
    await el.updateComplete;
    expect(editorMode(el)).toBe('edit');

    // The picker leads with an "Original" entry (generic icon, no w:h numbers).
    const ratio = el.shadowRoot!.querySelector('uc-ai-aspect-ratio')!;
    (ratio.shadowRoot!.querySelector('.trigger') as HTMLButtonElement).click();
    await el.updateComplete;
    const options = Array.from(ratio.shadowRoot!.querySelectorAll('.option')) as HTMLButtonElement[];
    expect(options[0]!.textContent).toContain('Original');
    // "Original" reserves the ratio column but shows no "w:h" numbers.
    expect(options[0]!.querySelector('.option-ratio')?.textContent).toBe('');

    typePrompt(el, 'add a hat');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(stub.generateBodies.length).toBe(1));
    // Original is the default → no aspect_ratio on the wire; backend preserves it.
    expect(stub.generateBodies[0]!.aspect_ratio).toBeUndefined();
    expect(stub.generateBodies[0]!.source).toBe(SAMPLE_UUID);
  });

  it('records the aspect ratio on a history entry and restores it when re-selected', async () => {
    stubFetch({ uuid: 'r1' });
    const el = mount({ ...STAGING, 'aspect-ratios': '16:9 1:1' });
    await el.updateComplete;

    const ratioEl = () => el.shadowRoot!.querySelector('uc-ai-aspect-ratio')!;
    const selected = () => (ratioEl() as unknown as { selected: unknown }).selected;
    const pickOption = async (i: number) => {
      (ratioEl().shadowRoot!.querySelector('.trigger') as HTMLButtonElement).click();
      await el.updateComplete;
      (ratioEl().shadowRoot!.querySelectorAll('.option')[i] as HTMLButtonElement).click();
      await el.updateComplete;
    };

    // Generate with 1:1 (generate options are [16:9, 1:1]).
    await pickOption(1);
    expect(selected()).toEqual([1, 1]);
    typePrompt(el, 'a cat');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(editorMode(el)).toBe('edit'));
    await el.updateComplete;

    const history = el.shadowRoot!.querySelector('uc-ai-history') as unknown as {
      entries: Array<{ ratio: unknown }>;
    };
    expect(history.entries[0]!.ratio).toEqual([1, 1]);

    // Change the ratio after the fact (edit options are [Original, 16:9, 1:1]).
    await pickOption(1);
    expect(selected()).toEqual([16, 9]);

    // Re-selecting the history entry restores the 1:1 ratio it was made with.
    const entry = history.entries[0];
    el.shadowRoot!.querySelector('uc-ai-history')!.dispatchEvent(
      new CustomEvent('uc:select', { detail: { entry }, bubbles: true, composed: true }),
    );
    await el.updateComplete;
    expect(selected()).toEqual([1, 1]);
  });

  it('sends sourceFilename as the result filename in edit mode (preserves the original name)', async () => {
    const stub = stubFetch({ uuid: 'edited' });
    const el = mount(STAGING);
    el.source = SAMPLE_UUID;
    el.sourceFilename = 'holiday-photo.jpg';
    await el.updateComplete;
    expect(editorMode(el)).toBe('edit');

    typePrompt(el, 'add a hat');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(stub.generateBodies.length).toBe(1));
    // The edit result is named after the source, not the provider's default.
    expect(stub.generateBodies[0]!.filename).toBe('holiday-photo.jpg');
  });

  it('sends an explicit ratio when the user reshapes in edit mode', async () => {
    const stub = stubFetch({ uuid: 'edited' });
    const el = mount({ ...STAGING, 'aspect-ratios': '1:1' });
    el.source = SAMPLE_UUID;
    await el.updateComplete;

    const ratio = el.shadowRoot!.querySelector('uc-ai-aspect-ratio')!;
    (ratio.shadowRoot!.querySelector('.trigger') as HTMLButtonElement).click();
    await el.updateComplete;
    // [Original, 1:1] in edit mode — pick the concrete ratio to reshape.
    const options = Array.from(ratio.shadowRoot!.querySelectorAll('.option')) as HTMLButtonElement[];
    expect(options.length).toBe(2);
    options[1]!.click();
    await el.updateComplete;

    typePrompt(el, 'make it square');
    await el.updateComplete;
    clickSend(el);
    await vi.waitFor(() => expect(stub.generateBodies.length).toBe(1));
    expect(stub.generateBodies[0]!.aspect_ratio).toEqual([1, 1]);
  });

  it('applies an async secure-delivery resolver to the canvas preview', async () => {
    stubFetch({ uuid: 'result' });
    const el = mount(STAGING);
    el.secureDeliveryProxyUrlResolver = async (url: string) => `https://signed.example/${encodeURIComponent(url)}`;
    await el.updateComplete;
    typePrompt(el, 'a tiger');
    await el.updateComplete;
    clickSend(el);
    const raw = 'https://cdn.example.com/result/';
    await vi.waitFor(() => expect(canvasUrl(el)).toBe(`https://signed.example/${encodeURIComponent(raw)}`));
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
    clickSend(el);

    // Change source mid-flight — this aborts the in-flight generation.
    el.source = 'second-uuid';
    await el.updateComplete;

    // After the abort, the displayed image should be the new source (no result override).
    await vi.waitFor(() => {
      expect(canvasUrl(el)).toBe('https://cdn.example.com/second-uuid/');
    });
  });
});
