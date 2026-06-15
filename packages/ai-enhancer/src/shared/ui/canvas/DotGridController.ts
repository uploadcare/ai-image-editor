import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { DotGridGLRenderer, type GLFrame } from './DotGridGLRenderer';

// Render the grid on WebGL2 when available (one instanced draw, float-precise
// per-dot brightness → no rings), falling back to the 2D canvas path otherwise.
// Set `window.__ucDotGl = false` before mount to force the 2D path (A/B).
let USE_WEBGL = true;

/**
 * Elements the painter draws into/over. All live inside {@link UcAiCanvas}'s
 * shadow DOM; the canvas hands them over once rendered.
 */
export type DotGridRefs = {
  /** The `<canvas>` the grid paints into (fills the viewport). */
  surface: HTMLCanvasElement;
  /** Available area for the image (canvas minus padding). */
  viewport: HTMLElement;
  /** Aspect-ratio box inside the viewport; its live size masks the grid. */
  frame: HTMLElement;
  /** Returns the image element currently holding the target bitmap, if any. */
  getImage: () => HTMLImageElement | null;
};

/** Visual mode the grid should reflect on the next {@link DotGridController.sync}. */
export type DotGridState = {
  /** Dots cover the frame (a generation runs, or an image swap is loading). */
  shimmering: boolean;
  /** No image yet — the static centre-falloff grid is shown. */
  empty: boolean;
  /** A real generation is in progress (vs. a plain image switch). Only then do
   *  the epicenters wander; switches/reveals use a uniform, ring-free growth. */
  generating: boolean;
};

// Tunable shimmer parameters. They are module-level `let`s (not `const`) so the
// calibration demo can adjust them live via {@link applyShimmerParams}; every
// read below sees the current value. Production never mutates them — the defaults
// here are the shipped look.

// ----- Grid spacing -----
let CELL_SIZE = 6; // distance between dot centres, in px
let DOT_RATIO = 0.46; // dot diameter relative to the cell size

// Scale the epicentre roam *speed* with the canvas size, so the motion reads
// consistently across sizes (slower on small/mobile, faster on large). The
// multiplier is ratio^SIZE_SCALE where ratio = √(area / reference): exactly 1 at
// the reference size; SIZE_SCALE is the strength — 0 = constant speed, 1 =
// proportional, >1 exaggerates, <0 inverts. Always positive (never breaks). The
// falloff radius is NOT scaled here — it's always a fixed fraction of the frame.
let SIZE_SCALE = 1;
const SIZE_REF_W = 1200;
const SIZE_REF_H = 800;

// ----- Shimmer (size only) -----
let MIN_SCALE = 0.68; // smallest dot, as a fraction of its base size

// Shimmer roams two "epicenters" around the frame, bouncing off its edges; dots
// grow within a falloff radius around them and shrink back outside it.
let EPI_COUNT = 2;
let EPI_RADIUS_RATIO = 0.4; // falloff radius as a fraction of the frame width (always proportional)
let EPI_SPEED = 0.54; // travel speed, px per ms
let EPI_WANDER = 0.115; // max heading jitter per frame, in radians
let EPI_FALLOFF = 1.5; // falloff curve exponent: >1 tightens the hotspot, <1 broadens it
let PEAK_SCALE = 1.6; // dot size at an epicentre's centre, as a fraction of base
// Low-frequency warp of the falloff distance field: bends the iso-distance
// contours off perfect circles so the gradient's banding dissolves into a smooth
// organic falloff (a noise-free alternative/complement to dither). 0 = off.
let FALLOFF_WARP = 0.12;

// ----- Static (no-image) state -----
let IDLE_SCALE = 0.9; // uniform dot size — the idle grid is one flat colour

// Per-dot size dither (in scale units) applied to the shimmer, scaled by the
// brightness wave. An alternative ring-breaker; left off in favour of position
// jitter, which avoids size scatter (see POS_JITTER).
let SHIM_DITHER = 0.1;

// Per-dot opacity (value) dither: varies each dot's alpha so neighbours cross the
// 8-bit brightness step at different points. This attacks the *banding itself*
// (the dots' colour), unlike size/position jitter which only move/resize them.
let ALPHA_DITHER = 0;
const ALPHA_DITHER_BUCKETS = 8; // distinct alpha levels (one batched fill each)

// Carry the epicentre brightness in the dots' ALPHA via a real radial gradient
// (browsers dither gradients → smooth, ring-free) multiplied onto the grid. Set
// MIN_SCALE = PEAK_SCALE = 1 alongside this for a pure, size-flat alpha shimmer.
let ALPHA_FALLOFF = 0; // 0 = off; 1 = outer dots fully fade out toward the edge

// Shimmer brightness model. When ALPHA_SHIMMER is on the dots keep a CONSTANT
// size (PEAK_SCALE) and the epicentre wave is carried purely in their ALPHA via
// the native radial gradient above — browsers dither gradients, so it grades
// smoothly with no rings. This is the default: size-scaling sub-2px dots can
// only render a few discrete sizes, which quantises the wave into concentric
// rings (most visible over an image). 0 = legacy size-wave (the proto look).
let ALPHA_SHIMMER = 0;
// Brightness of dots far from any epicentre, as a fraction of the peak (the
// epicentre centre is 1). The travelling wave grades floor → 1 → floor.
let SHIM_FLOOR = 0.32;

// Per-dot position jitter (as a fraction of the cell), scaled by the shimmer
// intensity. De-aligns the equidistant dots so the epicenter falloff doesn't
// quantise into coherent concentric rings — breaks banding without size scatter.
let POS_JITTER = 0;
// Re-roll rate (Hz) for the dither + position jitter, so the breakup pattern
// animates and the eye time-averages residual banding away. 0 = static.
let TEMPORAL_JITTER = 0;

// ----- Dot shape + global pulse -----
let ROUNDNESS = 0; // 0 = square, 1 = circle (corner radius as a fraction of half-size)
let PULSE_AMOUNT = 0; // global size "breathing" amplitude (× size); 0 = off
let PULSE_SPEED = 1; // breaths per second

// ----- Glitch (digital row-tear) -----
// Random rows jump horizontally and spike in size, re-rolling GLITCH_SPEED times
// a second — a VHS/datamosh feel. GLITCH_AMOUNT is the fraction of rows hit; 0 = off.
let GLITCH_AMOUNT = 0; // 0..1 — share of rows torn each glitch frame
let GLITCH_SPEED = 10; // glitch re-rolls per second (flicker rate within a burst)
let GLITCH_SHIFT = 2; // max horizontal jump of a torn row, in cells
let GLITCH_SIZE = 0; // extra size spike on torn rows (× base); 0 = none
let GLITCH_SPACING = 0; // seconds between brief glitch bursts; 0 = continuous
let GLITCH_RANDOM = 0; // 0..1 — jitter each burst's timing so gaps are irregular
// Glitch that plays *while the dots animate in or out* (the enter/exit envelope),
// scaled by env so it ramps up as the shimmer enters and fades out as the image
// resolves to clean. Uses GLITCH_SHIFT/SIZE/SPEED for its look. 0 = off.
// Independent of GLITCH_AMOUNT (the steady, generation-time glitch).
let REVEAL_GLITCH = 0; // 0..1 — peak share of rows torn at full shimmer (env = 1)

// Cap the backing store density. Rendering 1:1 with the device keeps the crisp
// flat-alpha squares sharp; the cap only bounds the buffer size on extreme
// ratios. Must cover hi-dpi screens *and* browser zoom (zoom multiplies the
// devicePixelRatio) — capping below the real ratio upscale-blurs the dots into
// soft circles, so keep this at/above the highest ratio we expect to render at.
let MAX_DPR = 3;

// Optional reveal supersampling. Crisp squares are sharp at native density, and
// supersampling a regular grid then CSS-downscaling beats into moiré *rings* — so
// this defaults to off (1 = native floor; the cap keeps retina at device density).
// Left tunable for the lab — raise it to *see* the moiré it causes.
let REVEAL_SS_MIN = 1;
let REVEAL_SS_MAX = 2;

// ----- Frame mask softening -----
let EDGE_TAU = 80; // ms — time constant easing a dot toward its in/out target

// ----- Progress enter/exit envelope -----
let ENTER_MS = 380;
let EXIT_MS = 420;
const easeOut = (t: number): number => 1 - (1 - t) ** 3;

// ----- Initial-state -> shimmer blend (no image) -----
let SHIM_ENTER_MS = 450;
let SHIM_EXIT_MS = 450;

/** Snapshot of the live-tunable shimmer parameters (see the `let`s above). */
export type ShimmerParams = {
  cellSize: number;
  dotRatio: number;
  minScale: number;
  epiCount: number;
  epiRadiusRatio: number;
  epiSpeed: number;
  epiWander: number;
  epiFalloff: number;
  peakScale: number;
  falloffWarp: number;
  idleScale: number;
  dither: number;
  alphaDither: number;
  alphaFalloff: number;
  alphaShimmer: number;
  shimFloor: number;
  posJitter: number;
  temporalJitter: number;
  roundness: number;
  pulseAmount: number;
  pulseSpeed: number;
  glitchAmount: number;
  glitchSpeed: number;
  glitchShift: number;
  glitchSize: number;
  glitchSpacing: number;
  glitchRandom: number;
  revealGlitch: number;
  sizeScale: number;
  maxDpr: number;
  revealSsMin: number;
  revealSsMax: number;
  edgeTau: number;
  enterMs: number;
  exitMs: number;
  shimEnterMs: number;
  shimExitMs: number;
};

/** Current shimmer parameters — used by the calibration demo to seed its controls. */
export function getShimmerParams(): ShimmerParams {
  return {
    cellSize: CELL_SIZE,
    dotRatio: DOT_RATIO,
    minScale: MIN_SCALE,
    epiCount: EPI_COUNT,
    epiRadiusRatio: EPI_RADIUS_RATIO,
    epiSpeed: EPI_SPEED,
    epiWander: EPI_WANDER,
    epiFalloff: EPI_FALLOFF,
    peakScale: PEAK_SCALE,
    falloffWarp: FALLOFF_WARP,
    idleScale: IDLE_SCALE,
    dither: SHIM_DITHER,
    alphaDither: ALPHA_DITHER,
    alphaFalloff: ALPHA_FALLOFF,
    alphaShimmer: ALPHA_SHIMMER,
    shimFloor: SHIM_FLOOR,
    posJitter: POS_JITTER,
    temporalJitter: TEMPORAL_JITTER,
    roundness: ROUNDNESS,
    pulseAmount: PULSE_AMOUNT,
    pulseSpeed: PULSE_SPEED,
    glitchAmount: GLITCH_AMOUNT,
    glitchSpeed: GLITCH_SPEED,
    glitchShift: GLITCH_SHIFT,
    glitchSize: GLITCH_SIZE,
    glitchSpacing: GLITCH_SPACING,
    glitchRandom: GLITCH_RANDOM,
    revealGlitch: REVEAL_GLITCH,
    sizeScale: SIZE_SCALE,
    maxDpr: MAX_DPR,
    revealSsMin: REVEAL_SS_MIN,
    revealSsMax: REVEAL_SS_MAX,
    edgeTau: EDGE_TAU,
    enterMs: ENTER_MS,
    exitMs: EXIT_MS,
    shimEnterMs: SHIM_ENTER_MS,
    shimExitMs: SHIM_EXIT_MS,
  };
}

/** Overwrite shimmer parameters live (calibration demo only). */
export function applyShimmerParams(p: Partial<ShimmerParams>): void {
  if (p.cellSize != null) CELL_SIZE = p.cellSize;
  if (p.dotRatio != null) DOT_RATIO = p.dotRatio;
  if (p.minScale != null) MIN_SCALE = p.minScale;
  if (p.epiCount != null) EPI_COUNT = p.epiCount;
  if (p.epiRadiusRatio != null) EPI_RADIUS_RATIO = p.epiRadiusRatio;
  if (p.epiSpeed != null) EPI_SPEED = p.epiSpeed;
  if (p.epiWander != null) EPI_WANDER = p.epiWander;
  if (p.epiFalloff != null) EPI_FALLOFF = p.epiFalloff;
  if (p.peakScale != null) PEAK_SCALE = p.peakScale;
  if (p.falloffWarp != null) FALLOFF_WARP = p.falloffWarp;
  if (p.idleScale != null) IDLE_SCALE = p.idleScale;
  if (p.dither != null) SHIM_DITHER = p.dither;
  if (p.alphaDither != null) ALPHA_DITHER = p.alphaDither;
  if (p.alphaFalloff != null) ALPHA_FALLOFF = p.alphaFalloff;
  if (p.alphaShimmer != null) ALPHA_SHIMMER = p.alphaShimmer;
  if (p.shimFloor != null) SHIM_FLOOR = p.shimFloor;
  if (p.posJitter != null) POS_JITTER = p.posJitter;
  if (p.temporalJitter != null) TEMPORAL_JITTER = p.temporalJitter;
  if (p.roundness != null) ROUNDNESS = p.roundness;
  if (p.pulseAmount != null) PULSE_AMOUNT = p.pulseAmount;
  if (p.pulseSpeed != null) PULSE_SPEED = p.pulseSpeed;
  if (p.glitchAmount != null) GLITCH_AMOUNT = p.glitchAmount;
  if (p.glitchSpeed != null) GLITCH_SPEED = p.glitchSpeed;
  if (p.glitchShift != null) GLITCH_SHIFT = p.glitchShift;
  if (p.glitchSize != null) GLITCH_SIZE = p.glitchSize;
  if (p.glitchSpacing != null) GLITCH_SPACING = p.glitchSpacing;
  if (p.glitchRandom != null) GLITCH_RANDOM = p.glitchRandom;
  if (p.revealGlitch != null) REVEAL_GLITCH = p.revealGlitch;
  if (p.sizeScale != null) SIZE_SCALE = p.sizeScale;
  if (p.maxDpr != null) MAX_DPR = p.maxDpr;
  if (p.revealSsMin != null) REVEAL_SS_MIN = p.revealSsMin;
  if (p.revealSsMax != null) REVEAL_SS_MAX = p.revealSsMax;
  if (p.edgeTau != null) EDGE_TAU = p.edgeTau;
  if (p.enterMs != null) ENTER_MS = p.enterMs;
  if (p.exitMs != null) EXIT_MS = p.exitMs;
  if (p.shimEnterMs != null) SHIM_ENTER_MS = p.shimEnterMs;
  if (p.shimExitMs != null) SHIM_EXIT_MS = p.shimExitMs;
}

type Epicenter = { x: number; y: number; vx: number; vy: number };
type Rect = { left: number; top: number; right: number; bottom: number };

/**
 * The animated dot-grid overlay for {@link UcAiCanvas}, ported from the design
 * prototype. The grid is painted across the whole viewport and stays anchored
 * to it; dots whose footprint falls outside the (live, animating) frame shrink
 * to 0, so changing the aspect ratio animates dots in/out rather than clipping.
 *
 * While a generation runs the in-frame dots shimmer: a travelling epicentre
 * brightens them via a smooth alpha gradient (ALPHA_SHIMMER) — dot size stays
 * flat, so the wave never quantises into rings. When masking an existing image
 * the grid becomes the image's mask (`source-in` compositing), so the result
 * "materialises" out of the dots and the wave grades how much image shows.
 *
 * Degrades to a no-op when there's no 2D context (e.g. the happy-dom unit-test
 * environment), so mounting the canvas never throws there.
 */
export class DotGridController implements ReactiveController {
  private _refs: DotGridRefs | null = null;
  private _ctx: CanvasRenderingContext2D | null = null;
  /** WebGL backend; when set it owns rendering and `_ctx` stays null. */
  private _gl: DotGridGLRenderer | null = null;
  /** The image element currently uploaded to the GL texture, + its ready state. */
  private _glImageEl: HTMLImageElement | null = null;
  private _glImageReady = false;
  /** True when either backend can paint. */
  private get _canDraw(): boolean {
    return !!this._ctx || !!this._gl;
  }

  private readonly _reduceMotion: boolean;
  /** Canvas-size multiplier (1 at the reference size), applied to the epicentre
   *  size + speed. Recomputed in {@link _resize}. */
  private _sizeMul = 1;

  /** Dot half-size in px. A getter so live CELL_SIZE/DOT_RATIO tweaks apply. */
  private get _baseRadius(): number {
    return (CELL_SIZE * DOT_RATIO) / 2;
  }

  /** Canvas-size multiplier: ratio^SIZE_SCALE, where ratio = √(area / reference).
   *  Exactly 1 at the reference size; SIZE_SCALE is the strength (0 = off, 1 =
   *  proportional, >1 exaggerates, <0 inverts). Always positive, so it never
   *  produces a negative radius/speed however far it's pushed. */
  private _computeSizeMul(): number {
    if (this._w <= 0 || this._h <= 0) return 1;
    const ratio = Math.sqrt((this._w * this._h) / (SIZE_REF_W * SIZE_REF_H));
    return ratio ** SIZE_SCALE;
  }

  private _dotColor = 'rgba(0, 0, 0, 0.16)';
  /** Dot colour parsed to 0..1 RGBA for the GL backend. */
  private _dotColorRGBA: [number, number, number, number] = [0, 0, 0, 0.16];
  private _scratch2d?: CanvasRenderingContext2D | null;

  // Viewport pixel size + grid layout (depends only on the viewport size).
  private _w = 0;
  private _h = 0;
  private _cols = 0;
  private _rows = 0;
  private _offsetX = 0;
  private _offsetY = 0;
  private _epiRadius = 1;
  /** Backing-store scale currently applied (device px per CSS px). */
  private _appliedScale = 0;
  /** Time-quantised seed offset for dither/jitter (drives TEMPORAL_JITTER). */
  private _noiseSeed = 0;
  /** Offscreen alpha mask for the radial ALPHA_FALLOFF (browser-dithered gradient). */
  private _maskCanvas: HTMLCanvasElement | null = null;
  private _maskCtx: CanvasRenderingContext2D | null = null;

  /** Per-dot mask factor (1 = fully in frame, 0 = clipped). */
  private _clip = new Float32Array(0);

  // Progress envelope: 0 = dots at full size (image shown), 1 = full shimmer.
  private _env = 0;
  private _envFrom = 0;
  private _envTo = 0;
  private _envStart = 0;
  private _envDur = 0;
  private _envAnimating = false;

  // Initial-state -> shimmer blend: 0 = static centre-fade, 1 = full shimmer.
  private _shimMix = 0;
  private _shimFrom = 0;
  private _shimTo = 0;
  private _shimStart = 0;
  private _shimDur = 0;
  private _shimAnimating = false;

  private _exitPending = false;
  private _prevShim = false;
  private _opacityManual = false;
  /** The exact <img> we forced transparent (tracked by element, not a flag, so
   *  a swapped/recreated image element can't strand the old one hidden). */
  private _hiddenImage: HTMLImageElement | null = null;

  private _rafId: number | null = null;
  private _lastTime = 0;

  private _state: DotGridState = { shimmering: false, empty: true, generating: false };
  private readonly _epis: Epicenter[] = [];

  private _resizeObserver?: ResizeObserver;
  private _frameObserver?: ResizeObserver;
  /** Watches for theme changes so the foreground-tinted dot colour re-resolves. */
  private _themeObserver?: MutationObserver;
  private _schemeMql?: MediaQueryList;

  public constructor(host: ReactiveControllerHost) {
    host.addController(this);
    this._reduceMotion =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;
  }

  /** Wire the painter to the canvas's rendered elements. */
  public attach(refs: DotGridRefs): void {
    this._refs = refs;

    // Prefer the WebGL2 backend; once a canvas hands out a webgl2 context it
    // can't also give a 2d one, so only fall back to 2d when GL is unavailable.
    const wantGL =
      USE_WEBGL && (typeof window === 'undefined' || (window as { __ucDotGl?: boolean }).__ucDotGl !== false);
    if (wantGL) this._gl = DotGridGLRenderer.create(refs.surface);
    if (!this._gl) this._ctx = refs.surface.getContext('2d');
    // No usable backend (e.g. happy-dom) → stay inert.
    if (!this._canDraw) return;

    this._readDotColor();

    if (typeof ResizeObserver === 'function') {
      this._resizeObserver = new ResizeObserver(() => {
        this._resize();
        this.sync(this._state);
      });
      this._resizeObserver.observe(refs.viewport);
      // The frame's CSS width/height transition fires this on every animated
      // step; we just keep the loop running so the mask follows the live size.
      this._frameObserver = new ResizeObserver(() => this._ensureLoop());
      this._frameObserver.observe(refs.frame);
    }

    // The overlay dots tint with the foreground, which flips with the theme. Re-
    // read the resolved colour on a system-scheme change (auto theme) and on
    // class/style mutations of the document root (where light/dark is usually
    // toggled) — otherwise the colour stays frozen at its mount-time value.
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      this._schemeMql = window.matchMedia('(prefers-color-scheme: dark)');
      this._schemeMql.addEventListener('change', this._onThemeChange);
    }
    if (typeof MutationObserver === 'function' && typeof document !== 'undefined') {
      this._themeObserver = new MutationObserver(this._onThemeChange);
      for (const node of [document.documentElement, document.body]) {
        if (node) this._themeObserver.observe(node, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
      }
    }

    this._resize();
    this.sync(this._state);
  }

  public hostDisconnected(): void {
    this._resizeObserver?.disconnect();
    this._frameObserver?.disconnect();
    this._themeObserver?.disconnect();
    this._schemeMql?.removeEventListener('change', this._onThemeChange);
    if (this._rafId !== null) cancelAnimationFrame(this._rafId);
    this._rafId = null;
    this._gl?.dispose();
    this._gl = null;
  }

  private _onThemeChange = (): void => {
    this.refreshColor();
  };

  /** Notify the painter that the result image finished loading. */
  public onImageLoad(): void {
    this._tryStartExit();
    this._ensureLoop();
  }

  /** Re-read the theme-driven overlay colour (e.g. after a theme switch). */
  public refreshColor(): void {
    this._readDotColor();
    if (this._rafId === null) this._draw();
  }

  /**
   * Reconcile to a new visual state. Drives the enter/exit envelopes off the
   * shimmer transition, mirroring the prototype's `syncProgress`.
   */
  public sync(state: DotGridState): void {
    this._state = state;
    if (!this._canDraw) return;

    const shim = state.shimmering;
    if (shim && !this._prevShim) {
      // Entering progress.
      this._exitPending = false;
      this._initEpicenters();
      if (this._hasImage()) {
        this._startEnv(1, ENTER_MS);
      } else {
        // Initial generation (no image yet): prime the envelope so the first
        // reveal can play the exit animation, but skip the enter animation.
        this._env = 1;
        this._envAnimating = false;
        this._startShimMix(1, SHIM_ENTER_MS);
      }
    } else if (!shim && this._prevShim) {
      // Leaving progress.
      if (this._hasImage()) {
        // Snap to fully covered first, so a fast/cached image still materialises
        // out of the dots rather than popping in (the cover may not have finished).
        this._env = 1;
        this._startEnv(0, EXIT_MS);
        this._shimMix = 0;
      } else if (state.empty) {
        this._env = 0;
        this._envAnimating = false;
        this._startShimMix(0, SHIM_EXIT_MS);
      } else {
        // Result not loaded yet — reveal when it loads (first image shown).
        this._exitPending = true;
      }
    }
    this._prevShim = shim;

    if (shim || this._envAnimating || this._shimAnimating) this._ensureLoop();
    else if (this._rafId === null) this._draw();
  }

  /** Re-apply layout-affecting params (grid spacing, backing scale, epicenter
   *  count) after a live {@link applyShimmerParams} change. Calibration demo only;
   *  purely dynamic params are picked up by the running animation frame. */
  public recalibrate(): void {
    if (!this._canDraw) return;
    this._resize();
    if (this._epis.length !== EPI_COUNT) this._initEpicenters();
    if (this._rafId === null) this._draw();
  }

  /** Hard reset to the static initial (no-image) grid (used by "Start over"). */
  public reset(): void {
    this._env = 0;
    this._envAnimating = false;
    this._shimMix = 0;
    this._shimAnimating = false;
    this._exitPending = false;
    this._prevShim = false;
    this._epis.length = 0;
    this._state = { shimmering: false, empty: true, generating: false };
    this._restoreOpacity();
    if (!this._canDraw) return;
    this._snapClip();
    this._draw();
  }

  private _now(): number {
    return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
  }

  private _readDotColor(): void {
    if (!this._refs) return;
    const c = getComputedStyle(this._refs.surface).color;
    if (c) {
      this._dotColor = c;
      this._dotColorRGBA = this._parseColor(c);
    }
  }

  /** Resolve any CSS colour string to 0..1 RGBA via a 1×1 scratch context. */
  private _parseColor(c: string): [number, number, number, number] {
    if (this._scratch2d === undefined) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 1;
      this._scratch2d = cv.getContext('2d', { willReadFrequently: true });
    }
    const ctx = this._scratch2d;
    if (!ctx) return this._dotColorRGBA;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = c; // an unparseable value leaves the previous (#000)
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0]! / 255, d[1]! / 255, d[2]! / 255, d[3]! / 255];
  }

  private _hasImage(): boolean {
    const image = this._refs?.getImage() ?? null;
    return !!image && !!image.getAttribute('src') && image.complete && image.naturalWidth > 0;
  }

  /** The grid masks the image while shimmering and during the reveal envelope. */
  private _maskingImage(): boolean {
    return this._hasImage() && !this._state.empty && (this._state.shimmering || this._env > 0.001);
  }

  private _startEnv(to: number, dur: number): void {
    if (dur <= 0 || this._reduceMotion) {
      this._env = to;
      this._envTo = to;
      this._envAnimating = false;
      return;
    }
    this._envFrom = this._env;
    this._envTo = to;
    this._envStart = this._now();
    this._envDur = dur;
    this._envAnimating = true;
    this._ensureLoop();
  }

  private _startShimMix(to: number, dur: number): void {
    if (dur <= 0 || this._reduceMotion) {
      this._shimMix = to;
      this._shimAnimating = false;
      return;
    }
    this._shimFrom = this._shimMix;
    this._shimTo = to;
    this._shimStart = this._now();
    this._shimDur = dur;
    this._shimAnimating = true;
    this._ensureLoop();
  }

  /** Frame rect cached for the duration of one animation tick (cleared after),
   *  so the several readers in a frame share a single forced layout. */
  private _rectCache: Rect | null = null;

  /** Frame rectangle in viewport coordinates, read from the *live* layout. */
  private _frameRect(): Rect {
    const refs = this._refs!;
    const fr = refs.frame.getBoundingClientRect();
    const vp = refs.viewport.getBoundingClientRect();
    const left = fr.left - vp.left;
    const top = fr.top - vp.top;
    return { left, top, right: left + fr.width, bottom: top + fr.height };
  }

  /** The frame rect, reusing the per-tick cache when one is active. */
  private _liveRect(): Rect {
    return this._rectCache ?? this._frameRect();
  }

  private _inFrame(x: number, y: number, r: Rect): boolean {
    return (
      x - this._baseRadius >= r.left &&
      x + this._baseRadius <= r.right &&
      y - this._baseRadius >= r.top &&
      y + this._baseRadius <= r.bottom
    );
  }

  private _snapClip(): void {
    const r = this._frameRect();
    let i = 0;
    for (let row = 0; row < this._rows; row++) {
      const y = this._offsetY + row * CELL_SIZE;
      for (let col = 0; col < this._cols; col++, i++) {
        this._clip[i] = this._inFrame(this._offsetX + col * CELL_SIZE, y, r) ? 1 : 0;
      }
    }
  }

  /** Ease the mask toward the live frame. Returns true while still settling. */
  private _followFrame(dt: number): boolean {
    const r = this._liveRect();
    const k = this._reduceMotion ? 1 : 1 - Math.exp(-dt / EDGE_TAU);
    let settling = false;
    let i = 0;
    for (let row = 0; row < this._rows; row++) {
      const y = this._offsetY + row * CELL_SIZE;
      for (let col = 0; col < this._cols; col++, i++) {
        const m = this._inFrame(this._offsetX + col * CELL_SIZE, y, r) ? 1 : 0;
        let next = this._clip[i]! + (m - this._clip[i]!) * k;
        if (Math.abs(m - next) < 0.002) next = m;
        else settling = true;
        this._clip[i] = next;
      }
    }
    return settling;
  }

  private _allocate(): void {
    this._cols = Math.max(1, Math.round(this._w / CELL_SIZE));
    this._rows = Math.max(1, Math.round(this._h / CELL_SIZE));
    this._offsetX = (this._w - (this._cols - 1) * CELL_SIZE) / 2;
    this._offsetY = (this._h - (this._rows - 1) * CELL_SIZE) / 2;
    this._clip = new Float32Array(this._cols * this._rows);
    this._snapClip();
  }

  /** True whenever the dots are animated bells (shimmer or reveal) rather than
   *  the static crisp-square idle grid. */
  private _wantsBell(): boolean {
    return this._maskingImage() || this._state.shimmering || this._envAnimating || this._shimAnimating;
  }

  private _scaleFor(bell: boolean): number {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    if (!bell) return dpr;
    // The shimmer/reveal renders at *at least* native density — capping below it
    // (e.g. REVEAL_SS_MAX < dpr on a 3× screen or under zoom) would upscale-blur
    // the dots into soft circles. REVEAL_SS_* can only push *above* native, for
    // the lab to demonstrate the moiré that supersampling a regular grid causes.
    return Math.max(dpr, Math.min(Math.max(dpr, REVEAL_SS_MIN), REVEAL_SS_MAX));
  }

  /** Size the backing store to `scale`× the viewport. Note: setting width/height
   *  clears the canvas and resets the context, so the transform is re-applied. */
  private _applyBacking(scale: number): void {
    const refs = this._refs;
    const ctx = this._ctx;
    if (!refs || !ctx) return;
    refs.surface.width = Math.round(this._w * scale);
    refs.surface.height = Math.round(this._h * scale);
    refs.surface.style.width = `${this._w}px`;
    refs.surface.style.height = `${this._h}px`;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this._appliedScale = scale;
  }

  /** Switch backing density when the mode flips (crisp squares ↔ smooth bells).
   *  The grid layout is unchanged, so the eased clip state is preserved. */
  private _ensureScale(bell: boolean): void {
    const scale = this._scaleFor(bell);
    if (scale !== this._appliedScale) this._applyBacking(scale);
  }

  private _resize(): void {
    const refs = this._refs;
    if (!refs || !this._canDraw) return;
    this._w = refs.viewport.clientWidth;
    this._h = refs.viewport.clientHeight;
    if (this._w <= 0 || this._h <= 0) return; // no layout yet (e.g. detached)
    this._sizeMul = this._computeSizeMul();
    this._allocate();
    // 2D sizes the backing here; the GL backend sizes itself each render() from
    // the frame's scale, so just track the scale the next frame should use.
    if (this._ctx) this._applyBacking(this._scaleFor(this._wantsBell()));
    else this._appliedScale = this._scaleFor(this._wantsBell());
  }

  // ----- Epicentre shimmer -----
  private _initEpicenters(): void {
    const r = this._frameRect();
    this._epis.length = 0;
    const spd = EPI_SPEED * this._sizeMul; // roam proportionally faster on a bigger canvas
    for (let n = 0; n < EPI_COUNT; n++) {
      const a = Math.random() * Math.PI * 2;
      this._epis.push({
        x: r.left + Math.random() * (r.right - r.left),
        y: r.top + Math.random() * (r.bottom - r.top),
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
      });
    }
  }

  private _moveEpicenters(dt: number): void {
    if (this._epis.length === 0) this._initEpicenters();
    const r = this._liveRect();
    const spd = EPI_SPEED * this._sizeMul;
    for (const e of this._epis) {
      const a = Math.atan2(e.vy, e.vx) + (Math.random() - 0.5) * EPI_WANDER;
      e.vx = Math.cos(a) * spd;
      e.vy = Math.sin(a) * spd;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.x < r.left) {
        e.x = r.left;
        e.vx = Math.abs(e.vx);
      } else if (e.x > r.right) {
        e.x = r.right;
        e.vx = -Math.abs(e.vx);
      }
      if (e.y < r.top) {
        e.y = r.top;
        e.vy = Math.abs(e.vy);
      } else if (e.y > r.bottom) {
        e.y = r.bottom;
        e.vy = -Math.abs(e.vy);
      }
    }
  }

  private _epiIntensity(px: number, py: number): number {
    let best = 0;
    // Low-frequency smooth warp of the distance field — bends the iso-distance
    // contours off perfect circles so the falloff's banding dissolves smoothly.
    const k = FALLOFF_WARP > 0 ? (Math.PI * 2) / (this._epiRadius * 0.7 || 1) : 0;
    const warp = k > 0 ? FALLOFF_WARP * this._epiRadius * Math.sin(px * k + 1.3) * Math.cos(py * k * 0.9) : 0;
    for (const e of this._epis) {
      const d = Math.max(0, Math.hypot(px - e.x, py - e.y) + warp);
      if (d >= this._epiRadius) continue;
      const t = 1 - d / this._epiRadius;
      let f = t * t * (3 - 2 * t); // smoothstep
      if (EPI_FALLOFF !== 1) f = Math.pow(f, EPI_FALLOFF);
      if (f > best) best = f;
    }
    return best;
  }

  private _staticScale(): number {
    return IDLE_SCALE;
  }

  /** Deterministic per-dot value in [0, 1) — a stable hash of the grid cell. */
  private _hash(col: number, row: number): number {
    const s = Math.sin(col * 12.9898 + row * 78.233) * 43758.5453;
    return s - Math.floor(s);
  }

  private _shimmerScale(col: number, row: number, px: number, py: number): number {
    const intensity = this._epiIntensity(px, py);
    // Dither the size by a tiny per-dot amount (scaled by intensity, so flat areas
    // stay clean). The brightness wave is so low-contrast that its smooth falloff
    // otherwise quantises into visible concentric rings ("stepped gradient"); the
    // jitter breaks those bands into imperceptible noise.
    const jitter = (this._hash(col, row + this._noiseSeed) - 0.5) * SHIM_DITHER * intensity;
    return MIN_SCALE + (PEAK_SCALE - MIN_SCALE) * intensity + jitter;
  }

  private _drawCover(r: Rect): void {
    const ctx = this._ctx!;
    const image = this._refs?.getImage();
    if (!image) return;
    const iw = image.naturalWidth;
    const ih = image.naturalHeight;
    if (!iw || !ih) return;
    const fw = r.right - r.left;
    const fh = r.bottom - r.top;
    const s = Math.max(fw / iw, fh / ih);
    const dw = iw * s;
    const dh = ih * s;
    ctx.drawImage(image, r.left + (fw - dw) / 2, r.top + (fh - dh) / 2, dw, dh);
  }

  private _setOpacity(manualMask: boolean): void {
    const refs = this._refs;
    if (!refs) return;
    const image = refs.getImage();
    if (manualMask) {
      if (!this._opacityManual) {
        refs.surface.style.transition = 'none';
        refs.surface.style.opacity = '1';
        this._opacityManual = true;
      }
      if (image && image !== this._hiddenImage) {
        // A different element is being masked now — un-hide the previous one.
        this._showHiddenImage();
        image.style.transition = 'none';
        image.style.opacity = '0';
        this._hiddenImage = image;
      }
    } else {
      if (this._opacityManual) {
        refs.surface.style.transition = '';
        refs.surface.style.opacity = '';
        this._opacityManual = false;
      }
      this._showHiddenImage();
    }
  }

  /** Restore the element we forced transparent (if it's still in the DOM). */
  private _showHiddenImage(): void {
    const hidden = this._hiddenImage;
    if (!hidden) return;
    if (hidden.isConnected) {
      hidden.style.transition = '';
      hidden.style.opacity = '1';
    }
    this._hiddenImage = null;
  }

  private _restoreOpacity(): void {
    const refs = this._refs;
    if (this._opacityManual && refs) {
      refs.surface.style.transition = '';
      refs.surface.style.opacity = '';
      this._opacityManual = false;
    }
    this._showHiddenImage();
  }

  /**
   * Multiply the just-drawn dots' alpha by a radial gradient centred on each
   * epicentre (full at the centre, fading to `1 − ALPHA_FALLOFF` outside). The
   * gradient is a native canvas gradient — the browser dithers it, so the
   * brightness grades smoothly with no banding/rings.
   */
  private _applyAlphaFalloff(amount: number = ALPHA_FALLOFF): void {
    const ctx = this._ctx!;
    const surf = this._refs!.surface;
    let mc = this._maskCanvas;
    if (!mc) {
      mc = document.createElement('canvas');
      this._maskCanvas = mc;
      this._maskCtx = mc.getContext('2d');
    }
    const mctx = this._maskCtx;
    if (!mctx) return;
    if (mc.width !== surf.width || mc.height !== surf.height) {
      mc.width = surf.width;
      mc.height = surf.height;
    }
    // Build the mask in the same (scaled) coordinate space as the grid.
    mctx.setTransform(this._appliedScale, 0, 0, this._appliedScale, 0, 0);
    mctx.globalCompositeOperation = 'source-over';
    mctx.clearRect(0, 0, this._w, this._h);
    // Floor brightness for dots far from any epicentre.
    mctx.fillStyle = `rgba(255,255,255,${1 - amount})`;
    mctx.fillRect(0, 0, this._w, this._h);
    // Additive radial boosts toward each epicentre (union ≈ lighter).
    mctx.globalCompositeOperation = 'lighter';
    const rad = this._epiRadius;
    for (const e of this._epis) {
      const g = mctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, rad);
      g.addColorStop(0, `rgba(255,255,255,${amount})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      mctx.fillStyle = g;
      mctx.fillRect(e.x - rad, e.y - rad, rad * 2, rad * 2);
    }
    mctx.globalCompositeOperation = 'source-over';
    // Multiply the grid's alpha by the mask (1:1 device pixels).
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mc, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  private _draw(): void {
    if (this._gl) {
      this._drawGL();
      return;
    }
    const ctx = this._ctx;
    if (!ctx || this._w <= 0 || this._h <= 0) return;

    const mask = this._maskingImage();
    this._setOpacity(mask);

    // Nothing to draw: leave the last frame in place so CSS can fade it out.
    if (!(this._state.shimmering || this._state.empty || mask)) return;

    const animating = this._state.shimmering || this._envAnimating || this._shimAnimating;
    // Static idle renders at device density (crisp); the moment anything animates
    // we supersample + dither so the size-wave/reveal stays smooth (no banding).
    this._ensureScale(mask || animating);
    ctx.clearRect(0, 0, this._w, this._h);

    // Falloff radius tracks the live frame width (rides the AR transition).
    const fr = this._liveRect();
    // Radius is a constant fraction of the live frame, so the epicentre keeps the
    // same *relative* size on every canvas (proportional). SIZE_SCALE only scales
    // the roam speed, not the size.
    this._epiRadius = (fr.right - fr.left) * EPI_RADIUS_RATIO || 1;
    // Animate the dither/jitter pattern when TEMPORAL_JITTER > 0 (time-averaged smoothing).
    this._noiseSeed =
      TEMPORAL_JITTER > 0 && !this._reduceMotion ? Math.floor(this._now() * 0.001 * TEMPORAL_JITTER) : 0;

    const fullHalf = CELL_SIZE / 2;
    // Crisp flat-alpha squares everywhere, batched into one Path2D + fill(). While
    // masking, they're the image's stencil (#000 + source-in below), so the result
    // materialises out of the grid; full coverage at the reveal's end comes from
    // the real <img> fading in.
    ctx.fillStyle = mask ? '#000' : this._dotColor;
    const hasPath = typeof Path2D === 'function';
    // Value (opacity) dither: split dots into N alpha buckets, each its own Path2D
    // filled at a different globalAlpha — so the dot *colour* carries the noise that
    // breaks the brightness banding. Only while a gradient exists (not the flat idle).
    const ditherOn = ALPHA_DITHER > 0 && hasPath && (this._state.generating || mask || this._shimMix > 0);
    const buckets = ALPHA_DITHER_BUCKETS;
    const paths: Path2D[] | null = hasPath ? Array.from({ length: ditherOn ? buckets : 1 }, () => new Path2D()) : null;
    // Global "breathing": one sine applied to every dot's size while generating.
    const pulse =
      !this._reduceMotion && PULSE_AMOUNT > 0 && this._state.generating
        ? 1 + PULSE_AMOUNT * Math.sin(this._now() * 0.001 * PULSE_SPEED * Math.PI * 2)
        : 1;
    // Rounded dots (0 = square … 1 = circle), when the platform has roundRect.
    const canRound = ROUNDNESS > 0 && paths !== null && typeof (paths[0] as Partial<Path2D>).roundRect === 'function';
    // Digital row-tear glitch: a time-quantised seed re-rolls which rows tear.
    let glitchOn = GLITCH_AMOUNT > 0 && !this._reduceMotion && (this._state.generating || mask || this._shimMix > 0);
    if (glitchOn && GLITCH_SPACING > 0) {
      // Fire only a brief burst every ~GLITCH_SPACING seconds; GLITCH_RANDOM
      // jitters each burst's start within its slot so the gaps are irregular.
      const t = this._now() * 0.001;
      const slot = Math.floor(t / GLITCH_SPACING);
      const within = t - slot * GLITCH_SPACING;
      const burst = Math.min(GLITCH_SPACING, 0.35);
      const start = GLITCH_RANDOM > 0 ? this._hash(slot, 7) * GLITCH_RANDOM * (GLITCH_SPACING - burst) : 0;
      glitchOn = within >= start && within < start + burst;
    }
    let effGlitchAmount = glitchOn ? GLITCH_AMOUNT : 0;
    // Reveal/transition glitch: tear rows while the envelope animates (enter or
    // exit), scaled by env so it ramps in with the shimmer and settles clean.
    if (REVEAL_GLITCH > 0 && !this._reduceMotion && this._envAnimating) {
      glitchOn = true;
      effGlitchAmount = Math.max(effGlitchAmount, REVEAL_GLITCH * this._env);
    }
    const glitchSeed = glitchOn ? Math.floor(this._now() * 0.001 * GLITCH_SPEED) : 0;
    let i = 0;
    for (let row = 0; row < this._rows; row++) {
      const y = this._offsetY + row * CELL_SIZE;
      // Per-row glitch: a torn row jumps horizontally and (optionally) spikes size.
      let rowShift = 0;
      let rowSize = 1;
      if (glitchOn && this._hash(row, glitchSeed) < effGlitchAmount) {
        rowShift = (this._hash(row + 31, glitchSeed) - 0.5) * 2 * GLITCH_SHIFT * CELL_SIZE;
        if (GLITCH_SIZE > 0) rowSize = 1 + GLITCH_SIZE * this._hash(row + 67, glitchSeed);
      }
      for (let col = 0; col < this._cols; col++, i++) {
        const c = this._clip[i]!;
        if (c <= 0) continue;
        const x = this._offsetX + col * CELL_SIZE;
        let half: number;
        if (mask) {
          // Alpha shimmer keeps a constant halftone dot (the wave rides the alpha
          // gradient below); the legacy size wave grows dots per epicentre. Either
          // way a switch/reveal (not generating) grows uniformly so the image
          // materialises without ring banding.
          const animated = this._reduceMotion
            ? 1
            : ALPHA_SHIMMER
              ? PEAK_SCALE
              : this._state.generating
                ? this._shimmerScale(col, row, x, y)
                : MIN_SCALE;
          const smallHalf = this._baseRadius * animated;
          half = (fullHalf + this._env * (smallHalf - fullHalf)) * c;
        } else {
          let scale = this._staticScale();
          // Legacy size wave only; alpha shimmer leaves dot size flat (idle) and
          // carries the wave in the alpha gradient instead.
          if (!ALPHA_SHIMMER && !this._reduceMotion && this._shimMix > 0) {
            const shim = this._shimmerScale(col, row, x, y);
            scale += (shim - scale) * this._shimMix;
          }
          half = this._baseRadius * scale * c;
        }
        if (pulse !== 1) half *= pulse;
        if (rowSize !== 1) half *= rowSize;
        if (half <= 0) continue;
        // Jitter the position (scaled by shimmer intensity) to break the grid
        // coherence that turns the falloff into concentric rings. Idle dots
        // (intensity 0) stay perfectly on-grid.
        let dx = x + rowShift;
        let dy = y;
        if (POS_JITTER > 0 && !this._reduceMotion) {
          const amt = POS_JITTER * CELL_SIZE * this._epiIntensity(x, y) * (mask ? 1 : this._shimMix);
          if (amt > 0) {
            dx += (this._hash(col + this._noiseSeed, row) - 0.5) * amt;
            dy += (this._hash(col + 101, row + 53 + this._noiseSeed) - 0.5) * amt;
          }
        }
        const side = half * 2;
        const tp = paths
          ? paths[ditherOn ? Math.min(buckets - 1, (this._hash(col + 7, row + this._noiseSeed) * buckets) | 0) : 0]!
          : null;
        if (tp) {
          if (canRound) tp.roundRect(dx - half, dy - half, side, side, half * ROUNDNESS);
          else tp.rect(dx - half, dy - half, side, side);
        } else {
          ctx.fillRect(dx - half, dy - half, side, side);
        }
      }
    }
    if (paths) {
      for (let b = 0; b < paths.length; b++) {
        // Bucket b → globalAlpha in [1 − ALPHA_DITHER, 1] (dim-only value noise).
        ctx.globalAlpha = ditherOn ? 1 - ALPHA_DITHER + (ALPHA_DITHER * (b + 0.5)) / buckets : 1;
        ctx.fill(paths[b]!);
      }
      ctx.globalAlpha = 1;
    }

    // Carry the epicentre brightness in the dots' alpha via a smooth (browser-
    // dithered) radial gradient — the ring-free way to grade centre → outside.
    if (!this._reduceMotion && this._epis.length > 0) {
      if (ALPHA_SHIMMER) {
        // Brightness wave: floor (outer) → 1 (epicentre). Present only while
        // actually shimmering — a reveal/idle stays uniform (no spotlight).
        const presence = mask ? (this._state.generating ? 1 : 0) : this._shimMix;
        const amount = presence * (1 - SHIM_FLOOR);
        if (amount > 0) this._applyAlphaFalloff(amount);
      } else if (ALPHA_FALLOFF > 0 && (this._state.generating || this._shimMix > 0)) {
        this._applyAlphaFalloff();
      }
    }

    if (mask) {
      ctx.globalCompositeOperation = 'source-in';
      this._drawCover(fr);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /** Flat epicentre uniform buffer (x,y pairs) reused across GL frames. */
  private readonly _glEpis = new Float32Array(16);

  /** WebGL render path — mirrors {@link _draw}'s orchestration, but the per-dot
   *  size/brightness and the image mask are computed on the GPU. */
  private _drawGL(): void {
    const gl = this._gl;
    const refs = this._refs;
    if (!gl || !refs || this._w <= 0 || this._h <= 0) return;

    const mask = this._maskingImage();
    this._setOpacity(mask);

    // Nothing to draw: leave the last frame in place (the context preserves its
    // buffer) so CSS can fade the grid out.
    if (!(this._state.shimmering || this._state.empty || mask)) return;

    const fr = this._liveRect();
    // Radius is a constant fraction of the live frame, so the epicentre keeps the
    // same *relative* size on every canvas (proportional). SIZE_SCALE only scales
    // the roam speed, not the size.
    this._epiRadius = (fr.right - fr.left) * EPI_RADIUS_RATIO || 1;

    // Upload the mask image lazily — only when the element or its readiness flips.
    if (mask) {
      const img = refs.getImage();
      if (img !== this._glImageEl || (img !== null && img.complete && !this._glImageReady)) {
        gl.setImage(img && img.complete && img.naturalWidth > 0 ? img : null);
        this._glImageEl = img;
        this._glImageReady = gl.hasImage;
      }
    }

    const n = Math.min(this._epis.length, 8);
    for (let i = 0; i < n; i++) {
      this._glEpis[i * 2] = this._epis[i]!.x;
      this._glEpis[i * 2 + 1] = this._epis[i]!.y;
    }

    // Time-driven scalars (same maths as the 2D path) — the GPU does the rest.
    const now = this._now();
    const noiseSeed =
      TEMPORAL_JITTER > 0 && !this._reduceMotion ? Math.floor(now * 0.001 * TEMPORAL_JITTER) : 0;
    const pulse =
      !this._reduceMotion && PULSE_AMOUNT > 0 && this._state.generating
        ? 1 + PULSE_AMOUNT * Math.sin(now * 0.001 * PULSE_SPEED * Math.PI * 2)
        : 1;
    let glitchOn = GLITCH_AMOUNT > 0 && !this._reduceMotion && (this._state.generating || mask || this._shimMix > 0);
    if (glitchOn && GLITCH_SPACING > 0) {
      const t = now * 0.001;
      const slot = Math.floor(t / GLITCH_SPACING);
      const within = t - slot * GLITCH_SPACING;
      const burst = Math.min(GLITCH_SPACING, 0.35);
      const start = GLITCH_RANDOM > 0 ? this._hash(slot, 7) * GLITCH_RANDOM * (GLITCH_SPACING - burst) : 0;
      glitchOn = within >= start && within < start + burst;
    }
    let effGlitchAmount = glitchOn ? GLITCH_AMOUNT : 0;
    // Reveal/transition glitch: while the envelope animates (enter or exit), tear
    // rows proportional to the "shimmer-ness" (env) — ramps up as the shimmer
    // enters, fades out as the image resolves clean.
    if (REVEAL_GLITCH > 0 && !this._reduceMotion && this._envAnimating) {
      glitchOn = true;
      effGlitchAmount = Math.max(effGlitchAmount, REVEAL_GLITCH * this._env);
    }
    const glitchSeed = glitchOn ? Math.floor(now * 0.001 * GLITCH_SPEED) : 0;

    const frame: GLFrame = {
      cssW: this._w,
      cssH: this._h,
      scale: this._appliedScale || this._scaleFor(true),
      cols: this._cols,
      rows: this._rows,
      offsetX: this._offsetX,
      offsetY: this._offsetY,
      cell: CELL_SIZE,
      baseRadius: this._baseRadius,
      fullHalf: CELL_SIZE / 2,
      env: this._env,
      shimMix: this._shimMix,
      mask,
      // Reduced motion → uniform brightness (no roaming spotlight); the
      // epicentres are already frozen by _tick in that case.
      generating: this._state.generating && !this._reduceMotion,
      alphaShimmer: !!ALPHA_SHIMMER,
      minScale: MIN_SCALE,
      peakScale: PEAK_SCALE,
      idleScale: IDLE_SCALE,
      epis: this._glEpis,
      epiCount: n,
      epiRadius: this._epiRadius,
      epiFalloff: EPI_FALLOFF,
      shimFloor: SHIM_FLOOR,
      falloffWarp: FALLOFF_WARP,
      dither: SHIM_DITHER,
      alphaDither: ALPHA_DITHER,
      posJitter: POS_JITTER,
      roundness: ROUNDNESS,
      alphaFalloff: ALPHA_FALLOFF,
      pulse,
      noiseSeed,
      glitchOn,
      glitchSeed,
      glitchAmount: effGlitchAmount,
      glitchShift: GLITCH_SHIFT,
      glitchSize: GLITCH_SIZE,
      color: this._dotColorRGBA,
      clip: this._clip,
      frameLeft: fr.left,
      frameTop: fr.top,
      frameRight: fr.right,
      frameBottom: fr.bottom,
    };
    gl.render(frame);
  }

  private _tick = (time: number): void => {
    const dt = this._lastTime ? Math.min(64, time - this._lastTime) : 16;
    this._lastTime = time;
    // One forced layout per frame: every reader below shares this rect.
    this._rectCache = this._frameRect();

    if (this._envAnimating) {
      const p = Math.min(1, (time - this._envStart) / this._envDur);
      this._env = this._envFrom + (this._envTo - this._envFrom) * easeOut(p);
      if (p >= 1) {
        this._env = this._envTo;
        this._envAnimating = false;
      }
    }
    if (this._shimAnimating) {
      const p = Math.min(1, (time - this._shimStart) / this._shimDur);
      this._shimMix = this._shimFrom + (this._shimTo - this._shimFrom) * easeOut(p);
      if (p >= 1) {
        this._shimMix = this._shimTo;
        this._shimAnimating = false;
      }
    }

    if (this._state.generating && !this._reduceMotion) {
      this._moveEpicenters(dt);
    }

    const settling = this._followFrame(dt);
    this._draw();
    this._rectCache = null; // invalidate; next tick re-reads the live layout

    if (this._state.shimmering || this._envAnimating || this._shimAnimating || settling) {
      this._rafId = requestAnimationFrame(this._tick);
    } else {
      this._rafId = null;
      this._lastTime = 0;
    }
  };

  private _ensureLoop(): void {
    if (!this._canDraw) return;
    if (this._rafId === null) {
      this._lastTime = 0;
      this._rafId = requestAnimationFrame(this._tick);
    }
  }

  private _tryStartExit(): void {
    if (!this._exitPending) return;
    if (this._hasImage()) {
      this._exitPending = false;
      // Full cover first, so the just-loaded image materialises out of the dots.
      this._env = 1;
      this._startEnv(0, EXIT_MS);
    }
  }
}
