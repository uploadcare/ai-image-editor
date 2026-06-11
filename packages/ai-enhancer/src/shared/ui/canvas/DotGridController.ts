import type { ReactiveController, ReactiveControllerHost } from 'lit';

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
  /** A generation/edit is running — dots shimmer (and mask the image). */
  shimmering: boolean;
  /** No image yet — the static centre-falloff grid is shown. */
  empty: boolean;
};

// ----- Grid spacing -----
const CELL_SIZE = 6; // distance between dot centres, in px
const DOT_RATIO = 0.4; // dot diameter relative to the cell size

// ----- Shimmer (size only) -----
const MIN_SCALE = 0.5; // smallest dot, as a fraction of its base size

// Shimmer roams two "epicenters" around the frame, bouncing off its edges; dots
// grow within a falloff radius around them and shrink back outside it.
const EPI_COUNT = 2;
const EPI_RADIUS_RATIO = 0.4; // falloff radius as a fraction of frame width
const EPI_SPEED = 0.5; // travel speed, px per ms
const EPI_WANDER = 0.05; // max heading jitter per frame, in radians

// ----- Static (no-image) state -----
const IDLE_SCALE = 0.9; // uniform dot size — the idle grid is one flat colour

// ----- Soft dot sprite -----
// Each dot is a pre-rendered radial *bell*: brightest at the centre, fading
// smoothly to a transparent edge (no flat core, no hard ring). Rendered once at
// high resolution; per-dot draws downscale it, which removes the 8-bit gradient
// banding that makes a small faint gradient look stepped.
const SPRITE_PX = 64; // sprite backing size (its radius = SPRITE_PX / 2)
const DOT_PEAK = 1.6; // centre-alpha boost (so the bell's average ≈ the base alpha)
const DOT_GLOW = 2.4; // drawn dot radius relative to its base half-size

// Backing-store supersampling: dots are small, so render at ≥SS_MIN× the display
// (CSS downscales it) to give each dot's gradient enough pixels to stay smooth.
const SS_MIN = 2.5;
const SS_MAX = 3;

// ----- Frame mask softening -----
const EDGE_TAU = 80; // ms — time constant easing a dot toward its in/out target

// ----- Progress enter/exit envelope -----
const ENTER_MS = 380;
const EXIT_MS = 420;
const easeOut = (t: number): number => 1 - (1 - t) ** 3;

// ----- Initial-state -> shimmer blend (no image) -----
const SHIM_ENTER_MS = 450;
const SHIM_EXIT_MS = 450;

type Epicenter = { x: number; y: number; vx: number; vy: number };
type Rect = { left: number; top: number; right: number; bottom: number };

/**
 * The animated dot-grid overlay for {@link UcAiCanvas}, ported from the design
 * prototype. The grid is painted across the whole viewport and stays anchored
 * to it; dots whose footprint falls outside the (live, animating) frame shrink
 * to 0, so changing the aspect ratio animates dots in/out rather than clipping.
 *
 * While a generation runs the in-frame dots shimmer by animating their *size*
 * (never colour). When masking an existing image the grid becomes the image's
 * mask (`source-in` compositing), so the result "materialises" out of the dots.
 *
 * Degrades to a no-op when there's no 2D context (e.g. the happy-dom unit-test
 * environment), so mounting the canvas never throws there.
 */
export class DotGridController implements ReactiveController {
  private _refs: DotGridRefs | null = null;
  private _ctx: CanvasRenderingContext2D | null = null;

  private readonly _reduceMotion: boolean;
  private readonly _baseRadius = (CELL_SIZE * DOT_RATIO) / 2;

  private _dotColor = 'rgba(0, 0, 0, 0.16)';
  /** Pre-rendered soft radial-bell dot (theme colour baked in) for idle/shimmer. */
  private _dotSprite: HTMLCanvasElement | null = null;
  /** Opaque radial-bell used as the image-reveal mask (alpha = how much shows). */
  private _maskSprite: HTMLCanvasElement | null = null;

  // Viewport pixel size + grid layout (depends only on the viewport size).
  private _w = 0;
  private _h = 0;
  private _cols = 0;
  private _rows = 0;
  private _offsetX = 0;
  private _offsetY = 0;
  private _epiRadius = 1;

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

  private _state: DotGridState = { shimmering: false, empty: true };
  private readonly _epis: Epicenter[] = [];

  private _resizeObserver?: ResizeObserver;
  private _frameObserver?: ResizeObserver;

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
    this._ctx = refs.surface.getContext('2d');
    // No 2D context (happy-dom) → stay inert.
    if (!this._ctx) return;

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

    this._resize();
    this.sync(this._state);
  }

  public hostDisconnected(): void {
    this._resizeObserver?.disconnect();
    this._frameObserver?.disconnect();
    if (this._rafId !== null) cancelAnimationFrame(this._rafId);
    this._rafId = null;
  }

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
    if (!this._ctx) return;

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

  /** Hard reset to the static initial (no-image) grid (used by "Start over"). */
  public reset(): void {
    this._env = 0;
    this._envAnimating = false;
    this._shimMix = 0;
    this._shimAnimating = false;
    this._exitPending = false;
    this._prevShim = false;
    this._epis.length = 0;
    this._state = { shimmering: false, empty: true };
    this._restoreOpacity();
    if (!this._ctx) return;
    this._snapClip();
    this._draw();
  }

  private _now(): number {
    return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
  }

  private _readDotColor(): void {
    if (!this._refs) return;
    const c = getComputedStyle(this._refs.surface).color;
    if (c) this._dotColor = c;
    this._buildSprites();
  }

  /** Parse the resolved overlay colour into rgb (0–255) + alpha (0–1). */
  private _parseDotColor(): { r: number; g: number; b: number; a: number } {
    const nums = this._dotColor.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) ?? [];
    if (nums.length < 3) return { r: 225, g: 225, b: 225, a: 0.15 };
    // `color(srgb r g b / a)` gives channels in 0–1; `rgb()/rgba()` in 0–255.
    const unit = /srgb|color\(/i.test(this._dotColor);
    const ch = (n: number): number => Math.round(unit ? n * 255 : n);
    return { r: ch(nums[0]!), g: ch(nums[1]!), b: ch(nums[2]!), a: nums.length >= 4 ? nums[3]! : 1 };
  }

  /**
   * (Re)rasterise the dot sprites: the theme-coloured bell for idle/shimmer, and
   * an opaque bell whose alpha masks the image during the reveal — so the result
   * materialises through soft, smoothly-graded dots instead of hard squares.
   */
  private _buildSprites(): void {
    if (typeof document === 'undefined') {
      this._dotSprite = null;
      this._maskSprite = null;
      return;
    }
    const { r, g, b, a } = this._parseDotColor();
    this._dotSprite = this._makeBellSprite(r, g, b, a * DOT_PEAK);
    this._maskSprite = this._makeBellSprite(0, 0, 0, 1);
  }

  /** A radial bell: opaque-ish centre fading smoothly (no flat core) to a clear edge. */
  private _makeBellSprite(r: number, g: number, b: number, peak: number): HTMLCanvasElement | null {
    const cvs = document.createElement('canvas');
    cvs.width = SPRITE_PX;
    cvs.height = SPRITE_PX;
    const sg = cvs.getContext('2d');
    if (!sg) return null;
    const c = SPRITE_PX / 2;
    const grad = sg.createRadialGradient(c, c, 0, c, c, c);
    const stops: ReadonlyArray<readonly [number, number]> = [
      [0, 1],
      [0.2, 0.82],
      [0.4, 0.55],
      [0.6, 0.3],
      [0.78, 0.13],
      [0.9, 0.04],
      [1, 0],
    ];
    for (const [t, k] of stops) grad.addColorStop(t, `rgba(${r}, ${g}, ${b}, ${peak * k})`);
    sg.fillStyle = grad;
    sg.fillRect(0, 0, SPRITE_PX, SPRITE_PX);
    return cvs;
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

  /** Frame rectangle in viewport coordinates, read from the *live* layout. */
  private _frameRect(): Rect {
    const refs = this._refs!;
    const fr = refs.frame.getBoundingClientRect();
    const vp = refs.viewport.getBoundingClientRect();
    const left = fr.left - vp.left;
    const top = fr.top - vp.top;
    return { left, top, right: left + fr.width, bottom: top + fr.height };
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
    const r = this._frameRect();
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

  private _resize(): void {
    const refs = this._refs;
    const ctx = this._ctx;
    if (!refs || !ctx) return;
    // Supersample the backing store. The dots are small and dense (~5px), so at
    // 1× each spans too few pixels to render its radial gradient — it collapses
    // to a flat-topped blob. Rendering at ≥SS_MIN× gives the gradient room, and
    // CSS downscales the canvas to the display, anti-aliasing the result smooth.
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.min(Math.max(dpr, SS_MIN), SS_MAX);
    this._w = refs.viewport.clientWidth;
    this._h = refs.viewport.clientHeight;
    if (this._w <= 0 || this._h <= 0) return; // no layout yet (e.g. detached)
    refs.surface.width = Math.round(this._w * scale);
    refs.surface.height = Math.round(this._h * scale);
    refs.surface.style.width = `${this._w}px`;
    refs.surface.style.height = `${this._h}px`;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this._allocate();
  }

  // ----- Epicentre shimmer -----
  private _initEpicenters(): void {
    const r = this._frameRect();
    this._epis.length = 0;
    for (let n = 0; n < EPI_COUNT; n++) {
      const a = Math.random() * Math.PI * 2;
      this._epis.push({
        x: r.left + Math.random() * (r.right - r.left),
        y: r.top + Math.random() * (r.bottom - r.top),
        vx: Math.cos(a) * EPI_SPEED,
        vy: Math.sin(a) * EPI_SPEED,
      });
    }
  }

  private _moveEpicenters(dt: number): void {
    if (this._epis.length === 0) this._initEpicenters();
    const r = this._frameRect();
    for (const e of this._epis) {
      const a = Math.atan2(e.vy, e.vx) + (Math.random() - 0.5) * EPI_WANDER;
      e.vx = Math.cos(a) * EPI_SPEED;
      e.vy = Math.sin(a) * EPI_SPEED;
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
    for (const e of this._epis) {
      const d = Math.hypot(px - e.x, py - e.y);
      if (d >= this._epiRadius) continue;
      const t = 1 - d / this._epiRadius;
      const f = t * t * (3 - 2 * t); // smoothstep
      if (f > best) best = f;
    }
    return best;
  }

  private _staticScale(): number {
    return IDLE_SCALE;
  }

  private _shimmerScale(px: number, py: number): number {
    return MIN_SCALE + (1 - MIN_SCALE) * this._epiIntensity(px, py);
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
    const ctx = this._ctx;
    if (!ctx || this._w <= 0 || this._h <= 0) return;

    const mask = this._maskingImage();
    this._setOpacity(mask);

    // Nothing to draw: leave the last frame in place so CSS can fade it out.
    if (!(this._state.shimmering || this._state.empty || mask)) return;

    ctx.clearRect(0, 0, this._w, this._h);

    // Falloff radius tracks the live frame width (rides the AR transition).
    const fr = this._frameRect();
    this._epiRadius = (fr.right - fr.left) * EPI_RADIUS_RATIO || 1;

    const fullHalf = CELL_SIZE / 2;
    // Every dot is a soft radial bell (smooth centre→edge transparency) drawn from
    // a pre-rendered sprite — the theme-coloured one idle, the opaque one as the
    // image mask. Full coverage at the end of the reveal comes from the real <img>
    // fading in (handled by _setOpacity), so the bells needn't tile.
    const sprite = mask ? this._maskSprite : this._dotSprite;
    const useSprite = sprite !== null;
    if (!useSprite) ctx.fillStyle = mask ? '#000' : this._dotColor;
    // Squares batch into one Path2D + a single fill(); sprites draw per dot.
    const path = !useSprite && typeof Path2D === 'function' ? new Path2D() : null;
    let i = 0;
    for (let row = 0; row < this._rows; row++) {
      const y = this._offsetY + row * CELL_SIZE;
      for (let col = 0; col < this._cols; col++, i++) {
        const c = this._clip[i]!;
        if (c <= 0) continue;
        const x = this._offsetX + col * CELL_SIZE;
        let half: number;
        if (mask) {
          const animated = this._reduceMotion ? 1 : this._shimmerScale(x, y);
          const smallHalf = this._baseRadius * animated;
          half = (fullHalf + this._env * (smallHalf - fullHalf)) * c;
        } else {
          let scale = this._staticScale();
          if (!this._reduceMotion && this._shimMix > 0) {
            const shim = this._shimmerScale(x, y);
            scale += (shim - scale) * this._shimMix;
          }
          half = this._baseRadius * scale * c;
        }
        if (half <= 0) continue;
        if (useSprite) {
          const rad = half * DOT_GLOW;
          ctx.drawImage(sprite!, x - rad, y - rad, rad * 2, rad * 2);
        } else if (path) {
          const side = half * 2;
          path.rect(x - half, y - half, side, side);
        } else {
          const side = half * 2;
          ctx.fillRect(x - half, y - half, side, side);
        }
      }
    }
    if (path) ctx.fill(path);

    if (mask) {
      ctx.globalCompositeOperation = 'source-in';
      this._drawCover(this._frameRect());
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  private _tick = (time: number): void => {
    const dt = this._lastTime ? Math.min(64, time - this._lastTime) : 16;
    this._lastTime = time;

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

    if (this._state.shimmering && !this._reduceMotion) {
      this._moveEpicenters(dt);
    }

    const settling = this._followFrame(dt);
    this._draw();

    if (this._state.shimmering || this._envAnimating || this._shimAnimating || settling) {
      this._rafId = requestAnimationFrame(this._tick);
    } else {
      this._rafId = null;
      this._lastTime = 0;
    }
  };

  private _ensureLoop(): void {
    if (!this._ctx) return;
    if (this._rafId === null) {
      this._lastTime = 0;
      this._rafId = requestAnimationFrame(this._tick);
    }
  }

  private _tryStartExit(): void {
    if (!this._exitPending) return;
    if (this._hasImage()) {
      this._exitPending = false;
      this._startEnv(0, EXIT_MS);
    }
  }
}
