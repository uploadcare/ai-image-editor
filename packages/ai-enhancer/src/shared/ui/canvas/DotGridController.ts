import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { DotGridGLRenderer, type GLFrame } from './DotGridGLRenderer';

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

// Reference canvas size for the roam-speed scaling (multiplier is 1 here).
const SIZE_REF_W = 1200;
const SIZE_REF_H = 800;

// Cap the 2D backing density *while the shimmer animates*. The 2D path rebuilds
// ~tens of thousands of dots every frame; at retina density (dpr 2–3) that
// rasterises a multi-megapixel buffer per frame and janks. The moving sub-pixel
// dots don't need full density, so cap them — the static idle grid still renders
// at full density (it's drawn once and must stay crisp). Only affects 2D; the GL
// backend is fast and always renders at full density.
const MAX_ANIMATED_DPR = 1.5;

const easeOut = (t: number): number => 1 - (1 - t) ** 3;

/**
 * Tunable parameters for the dot-grid shimmer. The host passes these to the
 * {@link DotGridController}; the {@link DEFAULT_SHIMMER_CONFIG} values are the
 * shipped look.
 *
 * @internal Not part of the public package API — used by {@link UcAiCanvas} and
 * the shimmer-lab dev tool only.
 */
export type ShimmerConfig = {
  // ----- Grid spacing -----
  cellSize: number; // distance between dot centres, in px
  dotRatio: number; // dot diameter relative to the cell size
  // Roam speed scales with canvas size: ratio^sizeScale where ratio =
  // √(area / reference). 1 at the reference size; 0 = constant speed. The falloff
  // radius is never scaled — it's always a fixed fraction of the frame.
  sizeScale: number;
  // ----- Size-wave shimmer -----
  minScale: number; // smallest dot, as a fraction of base size
  peakScale: number; // dot size at an epicentre centre, as a fraction of base
  // Per-dot size dither, scaled by intensity — breaks the low-contrast size
  // wave's smooth falloff into noise so it doesn't quantise into rings.
  dither: number;
  // ----- Epicentre roam -----
  epiCount: number;
  epiRadiusRatio: number; // falloff radius as a fraction of the frame width
  epiSpeed: number; // travel speed, px per ms
  epiWander: number; // max heading jitter per frame, in radians
  epiFalloff: number; // falloff exponent: >1 tightens the hotspot, <1 broadens it
  // Low-frequency warp of the falloff distance field: bends the iso-distance
  // contours off perfect circles so banding dissolves into a smooth falloff.
  falloffWarp: number;
  // ----- Static (no-image) grid -----
  idleScale: number; // uniform idle dot size (the idle grid is one flat colour)
  // ----- Rendering -----
  // Cap the backing-store density. Rendering 1:1 with the device keeps the crisp
  // squares sharp; the cap only bounds the buffer on extreme ratios (hi-dpi +
  // zoom). Keep at/above the highest ratio we expect to render at.
  maxDpr: number;
  // ----- Timing (ms) -----
  edgeTau: number; // frame-mask follow time constant
  enterMs: number; // cover-in envelope (image present)
  exitMs: number; // reveal-out envelope (image present)
  shimEnterMs: number; // initial-state → shimmer blend (no image)
  shimExitMs: number; // shimmer → initial-state blend (no image)
  /** Force the WebGL (`true`) or 2D (`false`) backend. Omit to auto-detect. */
  useWebgl?: boolean;
};

/** The shipped shimmer look. */
export const DEFAULT_SHIMMER_CONFIG: ShimmerConfig = {
  cellSize: 6,
  dotRatio: 0.46,
  sizeScale: 1,
  minScale: 0.68,
  peakScale: 1.6,
  dither: 0.1,
  epiCount: 2,
  epiRadiusRatio: 0.4,
  epiSpeed: 0.54,
  epiWander: 0.115,
  epiFalloff: 1.5,
  falloffWarp: 0.12,
  idleScale: 0.9,
  maxDpr: 3,
  edgeTau: 80,
  enterMs: 380,
  exitMs: 420,
  shimEnterMs: 450,
  shimExitMs: 450,
};

type Epicenter = { x: number; y: number; vx: number; vy: number };
type Rect = { left: number; top: number; right: number; bottom: number };

/**
 * The animated dot-grid overlay for {@link UcAiCanvas}, ported from the design
 * prototype. The grid is painted across the whole viewport and stays anchored
 * to it; dots whose footprint falls outside the (live, animating) frame shrink
 * to 0, so changing the aspect ratio animates dots in/out rather than clipping.
 *
 * While a generation runs the in-frame dots shimmer: a travelling epicentre
 * grows them (a size wave), with a per-dot size dither to keep the low-contrast
 * falloff from quantising into rings. When masking an existing image the grid
 * becomes the image's mask (`source-in` compositing), so the result
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

  /** Live shimmer parameters (host-supplied; defaults are the shipped look). */
  private _cfg: ShimmerConfig = { ...DEFAULT_SHIMMER_CONFIG };

  private readonly _reduceMotion: boolean;
  /** Canvas-size multiplier (1 at the reference size), applied to the epicentre
   *  size + speed. Recomputed in {@link _resize}. */
  private _sizeMul = 1;

  /** Dot half-size in px. A getter so live config tweaks apply. */
  private get _baseRadius(): number {
    return (this._cfg.cellSize * this._cfg.dotRatio) / 2;
  }

  /** Canvas-size multiplier: ratio^sizeScale, where ratio = √(area / reference).
   *  Exactly 1 at the reference size; sizeScale is the strength (0 = off, 1 =
   *  proportional, >1 exaggerates, <0 inverts). Always positive, so it never
   *  produces a negative radius/speed however far it's pushed. */
  private _computeSizeMul(): number {
    if (this._w <= 0 || this._h <= 0) return 1;
    const ratio = Math.sqrt((this._w * this._h) / (SIZE_REF_W * SIZE_REF_H));
    return ratio ** this._cfg.sizeScale;
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

  public constructor(host: ReactiveControllerHost, config?: Partial<ShimmerConfig>) {
    host.addController(this);
    if (config) this._cfg = { ...this._cfg, ...config };
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
    // `useWebgl: false` forces the 2D path (e.g. tests on a software renderer).
    if (this._cfg.useWebgl !== false) this._gl = DotGridGLRenderer.create(refs.surface);
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
        if (node)
          this._themeObserver.observe(node, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
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
        this._startEnv(1, this._cfg.enterMs);
      } else {
        // Initial generation (no image yet): prime the envelope so the first
        // reveal can play the exit animation, but skip the enter animation.
        this._env = 1;
        this._envAnimating = false;
        this._startShimMix(1, this._cfg.shimEnterMs);
      }
    } else if (!shim && this._prevShim) {
      // Leaving progress.
      if (this._hasImage()) {
        // Snap to fully covered first, so a fast/cached image still materialises
        // out of the dots rather than popping in (the cover may not have finished).
        this._env = 1;
        this._startEnv(0, this._cfg.exitMs);
        this._shimMix = 0;
      } else if (state.empty) {
        this._env = 0;
        this._envAnimating = false;
        this._startShimMix(0, this._cfg.shimExitMs);
      } else {
        // Result not loaded yet — reveal when it loads (first image shown).
        this._exitPending = true;
      }
    }
    this._prevShim = shim;

    if (shim || this._envAnimating || this._shimAnimating) this._ensureLoop();
    else if (this._rafId === null) this._draw();
  }

  /** Merge live {@link ShimmerConfig} (host-supplied; the shimmer lab uses it for
   *  slider tweaks). Re-applies layout-affecting params when already attached.
   *  @internal */
  public setConfig(config: Partial<ShimmerConfig> | undefined): void {
    if (!config) return;
    this._cfg = { ...this._cfg, ...config };
    if (this._canDraw) this.recalibrate();
  }

  /** Re-apply layout-affecting params (grid spacing, backing scale, epicenter
   *  count) after a config change. Purely dynamic params are picked up by the
   *  running animation frame. */
  public recalibrate(): void {
    if (!this._canDraw) return;
    this._resize();
    if (this._epis.length !== this._cfg.epiCount) this._initEpicenters();
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
    const cell = this._cfg.cellSize;
    let i = 0;
    for (let row = 0; row < this._rows; row++) {
      const y = this._offsetY + row * cell;
      for (let col = 0; col < this._cols; col++, i++) {
        this._clip[i] = this._inFrame(this._offsetX + col * cell, y, r) ? 1 : 0;
      }
    }
  }

  /** Ease the mask toward the live frame. Returns true while still settling. */
  private _followFrame(dt: number): boolean {
    const r = this._liveRect();
    const cell = this._cfg.cellSize;
    const k = this._reduceMotion ? 1 : 1 - Math.exp(-dt / this._cfg.edgeTau);
    let settling = false;
    let i = 0;
    for (let row = 0; row < this._rows; row++) {
      const y = this._offsetY + row * cell;
      for (let col = 0; col < this._cols; col++, i++) {
        const m = this._inFrame(this._offsetX + col * cell, y, r) ? 1 : 0;
        let next = this._clip[i]! + (m - this._clip[i]!) * k;
        if (Math.abs(m - next) < 0.002) next = m;
        else settling = true;
        this._clip[i] = next;
      }
    }
    return settling;
  }

  private _allocate(): void {
    const cell = this._cfg.cellSize;
    this._cols = Math.max(1, Math.round(this._w / cell));
    this._rows = Math.max(1, Math.round(this._h / cell));
    this._offsetX = (this._w - (this._cols - 1) * cell) / 2;
    this._offsetY = (this._h - (this._rows - 1) * cell) / 2;
    this._clip = new Float32Array(this._cols * this._rows);
    this._snapClip();
  }

  /** Backing-store density: the device pixel ratio, capped at
   *  {@link ShimmerConfig.maxDpr}. Rendering 1:1 with the device keeps the crisp
   *  flat-alpha squares sharp. The animated 2D path is additionally capped at
   *  {@link MAX_ANIMATED_DPR} so per-frame raster stays cheap on hi-dpi. */
  private _scale(animated = false): number {
    const dpr = Math.min(window.devicePixelRatio || 1, this._cfg.maxDpr);
    return animated ? Math.min(dpr, MAX_ANIMATED_DPR) : dpr;
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
  private _ensureScale(animated: boolean): void {
    const scale = this._scale(animated);
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
    if (this._ctx) this._applyBacking(this._scale());
    else this._appliedScale = this._scale();
  }

  // ----- Epicentre shimmer -----
  private _initEpicenters(): void {
    const r = this._frameRect();
    this._epis.length = 0;
    const spd = this._cfg.epiSpeed * this._sizeMul; // roam proportionally faster on a bigger canvas
    for (let n = 0; n < this._cfg.epiCount; n++) {
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
    const spd = this._cfg.epiSpeed * this._sizeMul;
    for (const e of this._epis) {
      const a = Math.atan2(e.vy, e.vx) + (Math.random() - 0.5) * this._cfg.epiWander;
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
    const warpAmt = this._cfg.falloffWarp;
    const k = warpAmt > 0 ? (Math.PI * 2) / (this._epiRadius * 0.7 || 1) : 0;
    const warp = k > 0 ? warpAmt * this._epiRadius * Math.sin(px * k + 1.3) * Math.cos(py * k * 0.9) : 0;
    const falloff = this._cfg.epiFalloff;
    for (const e of this._epis) {
      const d = Math.max(0, Math.hypot(px - e.x, py - e.y) + warp);
      if (d >= this._epiRadius) continue;
      const t = 1 - d / this._epiRadius;
      let f = t * t * (3 - 2 * t); // smoothstep
      if (falloff !== 1) f = Math.pow(f, falloff);
      if (f > best) best = f;
    }
    return best;
  }

  private _staticScale(): number {
    return this._cfg.idleScale;
  }

  /** Deterministic per-dot value in [0, 1) — a stable hash of the grid cell. */
  private _hash(col: number, row: number): number {
    const s = Math.sin(col * 12.9898 + row * 78.233) * 43758.5453;
    return s - Math.floor(s);
  }

  private _shimmerScale(col: number, row: number, px: number, py: number): number {
    const intensity = this._epiIntensity(px, py);
    // Dither the size by a tiny per-dot amount (scaled by intensity, so flat areas
    // stay clean). The size wave is so low-contrast that its smooth falloff
    // otherwise quantises into visible concentric rings ("stepped gradient"); the
    // jitter breaks those bands into imperceptible noise.
    const { minScale, peakScale } = this._cfg;
    const jitter = (this._hash(col, row) - 0.5) * this._cfg.dither * intensity;
    return minScale + (peakScale - minScale) * intensity + jitter;
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

    // Idle renders at full density (crisp squares); while animating, the backing
    // is capped (see {@link MAX_ANIMATED_DPR}) so per-frame raster stays cheap.
    const animating = mask || this._state.shimmering || this._envAnimating || this._shimAnimating;
    this._ensureScale(animating);
    ctx.clearRect(0, 0, this._w, this._h);

    // Falloff radius tracks the live frame width (rides the AR transition). It's a
    // constant fraction of the live frame, so the epicentre keeps the same
    // *relative* size on every canvas; sizeScale only scales the roam speed.
    const fr = this._liveRect();
    this._epiRadius = (fr.right - fr.left) * this._cfg.epiRadiusRatio || 1;

    const cell = this._cfg.cellSize;
    const fullHalf = cell / 2;
    // Crisp flat-alpha squares everywhere, batched into one Path2D + fill(). While
    // masking, they're the image's stencil (#000 + source-in below), so the result
    // materialises out of the grid; full coverage at the reveal's end comes from
    // the real <img> fading in.
    ctx.fillStyle = mask ? '#000' : this._dotColor;
    const path = typeof Path2D === 'function' ? new Path2D() : null;
    let i = 0;
    for (let row = 0; row < this._rows; row++) {
      const y = this._offsetY + row * cell;
      for (let col = 0; col < this._cols; col++, i++) {
        const c = this._clip[i]!;
        if (c <= 0) continue;
        const x = this._offsetX + col * cell;
        let half: number;
        if (mask) {
          // A generation grows dots per epicentre (the size wave); a switch/reveal
          // (not generating) grows uniformly so the image materialises without ring
          // banding.
          const animated = this._reduceMotion
            ? 1
            : this._state.generating
              ? this._shimmerScale(col, row, x, y)
              : this._cfg.minScale;
          const smallHalf = this._baseRadius * animated;
          half = (fullHalf + this._env * (smallHalf - fullHalf)) * c;
        } else {
          let scale = this._staticScale();
          if (!this._reduceMotion && this._shimMix > 0) {
            const shim = this._shimmerScale(col, row, x, y);
            scale += (shim - scale) * this._shimMix;
          }
          half = this._baseRadius * scale * c;
        }
        if (half <= 0) continue;
        const side = half * 2;
        if (path) path.rect(x - half, y - half, side, side);
        else ctx.fillRect(x - half, y - half, side, side);
      }
    }
    if (path) ctx.fill(path);

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
    // same *relative* size on every canvas; sizeScale only scales the roam speed.
    this._epiRadius = (fr.right - fr.left) * this._cfg.epiRadiusRatio || 1;

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

    const cell = this._cfg.cellSize;
    const frame: GLFrame = {
      cssW: this._w,
      cssH: this._h,
      scale: this._appliedScale || this._scale(),
      cols: this._cols,
      rows: this._rows,
      offsetX: this._offsetX,
      offsetY: this._offsetY,
      cell,
      baseRadius: this._baseRadius,
      fullHalf: cell / 2,
      env: this._env,
      shimMix: this._shimMix,
      mask,
      // Reduced motion → uniform brightness (no roaming spotlight); the
      // epicentres are already frozen by _tick in that case.
      generating: this._state.generating && !this._reduceMotion,
      minScale: this._cfg.minScale,
      peakScale: this._cfg.peakScale,
      idleScale: this._cfg.idleScale,
      epis: this._glEpis,
      epiCount: n,
      epiRadius: this._epiRadius,
      epiFalloff: this._cfg.epiFalloff,
      falloffWarp: this._cfg.falloffWarp,
      dither: this._cfg.dither,
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
      this._startEnv(0, this._cfg.exitMs);
    }
  }
}
