import { describe, expect, it, vi } from 'vitest';
import { canvasUrl, clickSend, editorMode, mount, SAMPLE_UUID, STAGING, stubFetch, typePrompt } from './harness';

/**
 * Where the composer, history strip and toolbar sit for a given placement, and
 * how auto-hide docking changes that.
 */
describe('<uc-ai-image-editor> layout', () => {
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

    // None: no toolbar at all; the stage still renders.
    el.toolbarPlacement = 'none';
    await el.updateComplete;
    expect(shell.querySelector('uc-ai-footer')).toBeNull();
    expect(stage()).not.toBeNull();

    // An unknown value falls back to the default (bottom), like the other
    // placement enums.
    el.toolbarPlacement = 'junk' as never;
    await el.updateComplete;
    kids = [...shell.children];
    expect(kids.indexOf(footer())).toBeGreaterThan(kids.indexOf(stage()));
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
    const content = () => composer().querySelector('.composer__content')!;

    // composer-above (default): inside the composer, before the prompt row.
    expect(composer().contains(history())).toBe(true);
    let kids = [...content().children];
    expect(kids.indexOf(history())).toBeLessThan(kids.indexOf(promptRow()));

    // composer-below: inside the composer, after the prompt row.
    el.historyPlacement = 'composer-below';
    await el.updateComplete;
    kids = [...content().children];
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

  it('docks the overlay composer (renders the dock-hotzone) when composer-auto-hide is on', async () => {
    const el = mount(STAGING);
    el.canvasFit = 'full'; // an overlay (floating) composer
    el.composerAutoHide = true;
    el.sourceUuid = SAMPLE_UUID; // edit mode + an image to dock against
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

  it('does not dock (no hotzone) when auto-hide is disabled', async () => {
    const el = mount(STAGING);
    el.sourceUuid = SAMPLE_UUID;
    await el.updateComplete;
    await vi.waitFor(() => expect(canvasUrl(el)).toBeTruthy());

    // Disabled (default): no dock-hotzone, no reserved space.
    expect(el.shadowRoot!.querySelector('.dock-hotzone')).toBeNull();
    expect(el.hasAttribute('composer-auto-hide')).toBe(false);
  });

  it('keeps a docked composer docked under auto-hide (no overlay, no hotzone), independent of canvas-fit', async () => {
    const el = mount(STAGING);
    el.sourceUuid = SAMPLE_UUID;
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
    el.sourceUuid = SAMPLE_UUID;
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
});
