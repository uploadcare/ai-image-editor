import { describe, expect, it } from 'vitest';
import { type Locator, page, userEvent } from 'vitest/browser';
import type { UcAiImageEditorType } from './harness';
import {
  doneButton,
  editorRegion,
  expectCanvasToShow,
  mount,
  promptBox,
  SAMPLE_UUID,
  STAGING,
  sendPrompt,
} from './harness';

const historyStrip = () => page.getByRole('toolbar', { name: 'Recent prompts' });

const rectOf = (locator: Locator) => locator.element().getBoundingClientRect();

/** The canvas fills the stage, so its box is the image area the composer and history float over or dock beside. */
const canvasRect = (el: UcAiImageEditorType) => el.shadowRoot!.querySelector('uc-ai-canvas')!.getBoundingClientRect();

/** Where `target` sits against the canvas: wholly above or below it, or over its top or bottom half. */
function sideOfCanvas(el: UcAiImageEditorType, target: Locator): 'above' | 'below' | 'over-top' | 'over-bottom' {
  const box = rectOf(target);
  const canvas = canvasRect(el);
  if (box.bottom <= canvas.top + 1) return 'above';
  if (box.top >= canvas.bottom - 1) return 'below';
  return (box.top + box.bottom) / 2 < (canvas.top + canvas.bottom) / 2 ? 'over-top' : 'over-bottom';
}

/** Where `target` sits against the prompt box: wholly above or below it, or overlapping it. */
function sideOfPrompt(target: Locator): 'above' | 'below' | 'overlapping' {
  const box = rectOf(target);
  const prompt = rectOf(promptBox());
  if (box.bottom <= prompt.top) return 'above';
  if (box.top >= prompt.bottom) return 'below';
  return 'overlapping';
}

/** Runs one generation so the history strip mounts. */
async function generateOnce(): Promise<void> {
  await sendPrompt('a tiger');
  await expect.element(editorRegion('edit')).toBeVisible();
  await expect.element(historyStrip()).toBeVisible();
}

/** Parks the pointer in the canvas's top-left corner, away from the composer and the bottom edge. */
const parkPointer = (el: UcAiImageEditorType) =>
  userEvent.hover(page.elementLocator(el.shadowRoot!.querySelector('uc-ai-canvas')!), {
    position: { x: 2, y: 2 },
    force: true,
  });

/** How far the prompt box's top sits below the canvas's bottom edge: about 20px docked and shown, about 110px hidden. */
const promptDrop = (el: UcAiImageEditorType) => rectOf(promptBox()).top - canvasRect(el).bottom;

/**
 * Waits for the editor's CSS transitions to finish: two frames for a style change to start its transition, then every
 * running animation in the editor's shadow root. A negative layout check made before then could pass on the old frame.
 */
async function transitionsDone(el: UcAiImageEditorType): Promise<void> {
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
  await Promise.all(el.shadowRoot!.getAnimations().map((animation) => animation.finished));
}

/**
 * Where the composer, history strip and toolbar sit for a given placement, and
 * how auto-hide docking changes that, measured on the rendered boxes.
 */
describe('<uc-ai-image-editor> layout', () => {
  // canvas-fit full floats the composer over the canvas; available docks it outside, so the canvas shrinks.
  it.each([
    ['full', 'bottom', 'over-bottom'],
    ['full', 'top', 'over-top'],
    ['available', 'top', 'above'],
    ['available', 'bottom', 'below'],
  ] as const)(
    'with canvas-fit %s and composer-placement %s, puts the composer %s the canvas',
    async (fit, placement, side) => {
      const el = mount(STAGING);
      el.canvasFit = fit;
      el.composerPlacement = placement;
      await expect.poll(() => sideOfCanvas(el, promptBox())).toBe(side);
    },
  );

  it('defaults to a docked composer and a toolbar, both below the canvas', async () => {
    const el = mount(STAGING);
    expect(el.composerPlacement).toBe('bottom');
    expect(el.canvasFit).toBe('available');
    await expect.poll(() => sideOfCanvas(el, promptBox())).toBe('below');
    await expect.poll(() => sideOfCanvas(el, doneButton())).toBe('below');
  });

  // An unknown value falls back to the default (bottom), like the other placement enums.
  it.each([
    ['bottom', 'below'],
    ['top', 'above'],
    ['junk', 'below'],
  ] as const)('with toolbar-placement %s, puts the toolbar %s the canvas', async (placement, side) => {
    const el = mount(STAGING);
    el.toolbarPlacement = placement as UcAiImageEditorType['toolbarPlacement'];
    await expect.poll(() => sideOfCanvas(el, doneButton())).toBe(side);
  });

  it('renders no toolbar with toolbar-placement none, and still renders the canvas', async () => {
    const el = mount(STAGING);
    el.toolbarPlacement = 'none';
    await expect.element(doneButton()).not.toBeInTheDocument();
    expect(canvasRect(el).height).toBeGreaterThan(0);
  });

  // An overlay composer (canvas-fit full), which relative history placements ride.
  it.each([
    ['composer-above', 'over-bottom', 'above'],
    ['composer-below', 'over-bottom', 'below'],
    ['canvas-top', 'over-top', 'above'],
  ] as const)(
    'with history-placement %s, puts the history strip %s the canvas and %s the prompt',
    async (placement, canvasSide, promptSide) => {
      const el = mount(STAGING);
      el.canvasFit = 'full';
      el.historyPlacement = placement;
      await generateOnce();
      await expect.poll(() => sideOfCanvas(el, historyStrip())).toBe(canvasSide);
      await expect.poll(() => sideOfPrompt(historyStrip())).toBe(promptSide);
    },
  );

  it('pins the history over the canvas when the composer is docked-out', async () => {
    const el = mount(STAGING); // docked at the bottom by default
    await generateOnce();

    // The composer (prompt) is docked below the canvas; the history chips
    // float over the canvas's bottom edge, not inside the docked composer.
    await expect.poll(() => sideOfCanvas(el, promptBox())).toBe('below');
    await expect.poll(() => sideOfCanvas(el, historyStrip())).toBe('over-bottom');
  });

  it('slides an overlay composer off the canvas under composer-auto-hide and raises it at the edge', async () => {
    const el = mount(STAGING);
    el.canvasFit = 'full'; // an overlay (floating) composer
    el.composerAutoHide = true;
    el.sourceUuid = SAMPLE_UUID; // edit mode + an image to dock against
    await expectCanvasToShow(SAMPLE_UUID);

    // The CSS docking keys off this reflected host attribute.
    await expect.element(el).toHaveAttribute('composer-auto-hide');

    // Docked: the prompt slides past the canvas's bottom edge, leaving a peek.
    await parkPointer(el);
    await expect.poll(() => -promptDrop(el)).toBeLessThan(40);

    // The pointer nearing the bottom edge (beside the composer, not on it) raises it wholly back over the canvas.
    const canvas = canvasRect(el);
    await userEvent.hover(page.elementLocator(el.shadowRoot!.querySelector('uc-ai-canvas')!), {
      position: { x: 2, y: canvas.height - 10 },
      force: true,
    });
    await expect.poll(() => rectOf(promptBox()).bottom - canvasRect(el).bottom).toBeLessThan(0);
  });

  it('does not dock when auto-hide is disabled', async () => {
    const el = mount(STAGING);
    el.sourceUuid = SAMPLE_UUID;
    await expectCanvasToShow(SAMPLE_UUID);
    await parkPointer(el);

    // Disabled (default): the docked prompt stays shown right below the canvas…
    await expect.element(el).not.toHaveAttribute('composer-auto-hide');
    await transitionsDone(el);
    expect(sideOfCanvas(el, promptBox())).toBe('below');
    expect(promptDrop(el)).toBeLessThan(40);

    // …and an overlay one stays wholly over it.
    el.canvasFit = 'full';
    await expect.poll(() => sideOfCanvas(el, promptBox())).toBe('over-bottom');
    await transitionsDone(el);
    expect(rectOf(promptBox()).bottom - canvasRect(el).bottom).toBeLessThan(0);
  });

  it('keeps a docked composer docked under auto-hide, independent of canvas-fit', async () => {
    const el = mount(STAGING);
    el.sourceUuid = SAMPLE_UUID;
    el.composerAutoHide = true;
    el.composerPlacement = 'bottom';
    el.canvasFit = 'available';
    await expectCanvasToShow(SAMPLE_UUID);
    await parkPointer(el);

    // Auto-hide is orthogonal to canvas-fit: it does NOT force `full`. A docked
    // composer stays below the canvas and hides by collapsing in place: the
    // prompt slides down inside its reserved slot instead of over the canvas…
    expect(el.canvasFit).toBe('available');
    await expect.poll(() => promptDrop(el)).toBeGreaterThan(60);
    const canvasHeight = canvasRect(el).height;

    // …and hovering it raises it in the same slot, so the canvas keeps its size.
    await userEvent.hover(promptBox(), { force: true });
    await expect.poll(() => promptDrop(el)).toBeLessThan(40);
    expect(canvasRect(el).height).toBe(canvasHeight);
  });
});
