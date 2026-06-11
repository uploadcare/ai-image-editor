import { css, html, LitElement, nothing } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';

import {
  applyShimmerParams,
  DotGridController,
  getShimmerParams,
  type ShimmerParams,
} from '../src/shared/ui/canvas/DotGridController';

type Mode = 'idle' | 'shimmer' | 'over-image';

type Slider = { key: keyof ShimmerParams; label: string; min: number; max: number; step: number };

/** The tunable controls, grouped for the panel. */
const GROUPS: { title: string; sliders: Slider[] }[] = [
  {
    title: 'Grid',
    sliders: [
      { key: 'cellSize', label: 'Cell size (px)', min: 2, max: 20, step: 1 },
      { key: 'dotRatio', label: 'Dot ratio', min: 0.1, max: 1, step: 0.02 },
      { key: 'idleScale', label: 'Idle scale', min: 0.2, max: 1.5, step: 0.02 },
    ],
  },
  {
    title: 'Shimmer (epicenters)',
    sliders: [
      { key: 'alphaShimmer', label: 'Alpha shimmer (1) / size wave (0)', min: 0, max: 1, step: 1 },
      { key: 'shimFloor', label: 'Brightness floor (alpha mode)', min: 0, max: 1, step: 0.02 },
      { key: 'minScale', label: 'Min scale (size mode)', min: 0, max: 1, step: 0.02 },
      { key: 'epiCount', label: 'Epicenter count', min: 1, max: 6, step: 1 },
      { key: 'epiRadiusRatio', label: 'Falloff radius (×frame w)', min: 0.05, max: 1.2, step: 0.02 },
      { key: 'epiSpeed', label: 'Speed (px/ms)', min: 0, max: 2, step: 0.02 },
      { key: 'epiWander', label: 'Wander (rad/frame)', min: 0, max: 0.5, step: 0.005 },
      { key: 'epiFalloff', label: 'Falloff sharpness', min: 0.3, max: 4, step: 0.1 },
      { key: 'peakScale', label: 'Peak scale (×base)', min: 0.5, max: 2.5, step: 0.05 },
      { key: 'falloffWarp', label: 'Falloff warp (de-ring)', min: 0, max: 0.6, step: 0.02 },
      { key: 'alphaFalloff', label: 'Alpha falloff (gradient; de-ring)', min: 0, max: 1, step: 0.02 },
      { key: 'dither', label: 'Dither (size)', min: 0, max: 1, step: 0.02 },
      { key: 'alphaDither', label: 'Alpha dither (colour)', min: 0, max: 1, step: 0.02 },
      { key: 'posJitter', label: 'Position jitter (×cell)', min: 0, max: 1, step: 0.02 },
      { key: 'temporalJitter', label: 'Temporal jitter (Hz; de-ring)', min: 0, max: 30, step: 1 },
    ],
  },
  {
    title: 'Shape & pulse',
    sliders: [
      { key: 'roundness', label: 'Roundness (0 sq → 1 circle)', min: 0, max: 1, step: 0.05 },
      { key: 'pulseAmount', label: 'Pulse amount', min: 0, max: 0.6, step: 0.02 },
      { key: 'pulseSpeed', label: 'Pulse speed (Hz)', min: 0.1, max: 6, step: 0.1 },
    ],
  },
  {
    title: 'Glitch (row tear)',
    sliders: [
      { key: 'glitchAmount', label: 'Amount (rows torn)', min: 0, max: 1, step: 0.02 },
      { key: 'glitchSpeed', label: 'Speed (re-rolls/s)', min: 1, max: 30, step: 1 },
      { key: 'glitchShift', label: 'Shift (cells)', min: 0, max: 12, step: 0.5 },
      { key: 'glitchSize', label: 'Size spike (×base)', min: 0, max: 3, step: 0.1 },
      { key: 'glitchSpacing', label: 'Spacing (s; 0 = always)', min: 0, max: 8, step: 0.25 },
      { key: 'glitchRandom', label: 'Burst randomness', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    title: 'Resolution',
    sliders: [
      { key: 'maxDpr', label: 'Max DPR (idle)', min: 1, max: 3, step: 0.5 },
      { key: 'revealSsMin', label: 'Reveal supersample min', min: 1, max: 4, step: 0.5 },
      { key: 'revealSsMax', label: 'Reveal supersample max', min: 1, max: 5, step: 0.5 },
    ],
  },
  {
    title: 'Timing (ms)',
    sliders: [
      { key: 'edgeTau', label: 'Edge ease τ', min: 5, max: 300, step: 5 },
      { key: 'enterMs', label: 'Enter (cover)', min: 50, max: 1500, step: 10 },
      { key: 'exitMs', label: 'Exit (reveal)', min: 50, max: 1500, step: 10 },
      { key: 'shimEnterMs', label: 'Shim enter', min: 50, max: 1500, step: 10 },
      { key: 'shimExitMs', label: 'Shim exit', min: 50, max: 1500, step: 10 },
    ],
  },
];

/** Sample image masked in the over-image mode (the prototype's mountain). */
const SAMPLE_IMAGE = 'https://ai-image-editor-proto.vercel.app/assets/mountain.jpg';

/**
 * A standalone lab to calibrate the dot-grid shimmer. Hosts a real
 * {@link DotGridController} against a stage, with live sliders bound to every
 * tunable parameter. Not shipped — a dev tool to find the best values.
 */
@customElement('shimmer-lab')
export class ShimmerLab extends LitElement {
  public static override styles = css`
    :host {
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: 20px;
      height: 100vh;
      box-sizing: border-box;
      padding: 20px;
      background: #1b1b1b;
      color: #e1e1e1;
      font: 13px/1.4 system-ui, -apple-system, sans-serif;
      color-scheme: dark;
    }
    .stage {
      position: relative;
      border-radius: 12px;
      background: #181818;
      overflow: hidden;
      min-width: 0;
    }
    /* Light-mode preview, so dot visibility can be calibrated on a light bg. */
    .stage.light {
      background: #ffffff;
    }
    .viewport {
      position: absolute;
      inset: 24px;
      display: grid;
      place-items: center;
    }
    .fps {
      position: absolute;
      top: 10px;
      left: 10px;
      z-index: 2;
      padding: 3px 8px;
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.5);
      color: #9fe0a0;
      font-variant-numeric: tabular-nums;
      font-size: 12px;
      pointer-events: none;
    }
    .frame {
      position: relative;
      overflow: hidden;
    }
    .image {
      position: relative;
      z-index: 1;
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .dot-grid {
      position: absolute;
      inset: 0;
      pointer-events: none;
      opacity: 1;
      /* The controller reads this for the dot colour. */
      color: var(--lab-dot-color, color-mix(in srgb, #e1e1e1 15%, transparent));
    }
    .panel {
      overflow-y: auto;
      padding-right: 6px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .modes {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    button {
      font: inherit;
      color: inherit;
      background: #2a2a2a;
      border: 1px solid #3a3a3a;
      border-radius: 8px;
      padding: 6px 10px;
      cursor: pointer;
    }
    button.active {
      background: #174bd7;
      border-color: #174bd7;
      color: #fff;
    }
    .group {
      border: 1px solid #2e2e2e;
      border-radius: 10px;
      padding: 10px 12px;
    }
    .group h3 {
      margin: 0 0 8px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #989898;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr 56px;
      align-items: center;
      gap: 8px;
      margin: 6px 0;
    }
    .row label {
      grid-column: 1 / -1;
      font-size: 12px;
      color: #c7c7c7;
    }
    .row input[type='range'] {
      width: 100%;
    }
    .row .val {
      text-align: right;
      font-variant-numeric: tabular-nums;
      color: #989898;
    }
    .colorrow {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    textarea {
      width: 100%;
      box-sizing: border-box;
      height: 150px;
      background: #111;
      color: #9fe0a0;
      border: 1px solid #2e2e2e;
      border-radius: 8px;
      font: 11px/1.4 ui-monospace, monospace;
      padding: 8px;
    }
  `;

  @state() private _mode: Mode = 'shimmer';
  @state() private _params: ShimmerParams = getShimmerParams();
  @state() private _dotColorHex = '#e1e1e1';
  @state() private _dotAlpha = 0.15;
  @state() private _exported = '';
  @state() private _fps = 0;
  @state() private _lightStage = false;

  @query('.dot-grid') private _surface?: HTMLCanvasElement;
  @query('.viewport') private _viewport?: HTMLElement;
  @query('.frame') private _frame?: HTMLElement;
  @query('.image') private _image?: HTMLImageElement | null;

  private readonly _grid = new DotGridController(this);
  private readonly _ratio = 3 / 2;
  private readonly _sampleSrc = SAMPLE_IMAGE;
  private _resizeObs?: ResizeObserver;
  private _fpsRaf = 0;
  private _fpsFrames = 0;
  private _fpsLast = 0;

  protected override firstUpdated(): void {
    const surface = this._surface;
    const viewport = this._viewport;
    const frame = this._frame;
    if (!surface || !viewport || !frame) return;
    this._applyDotColor();
    this._grid.attach({ surface, viewport, frame, getImage: () => this._image ?? null });
    this._resizeObs = new ResizeObserver(() => this._sizeFrame());
    this._resizeObs.observe(viewport);
    this._sizeFrame();
    this._applyMode();
    this._fpsRaf = requestAnimationFrame((t) => this._measureFps(t));
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._resizeObs?.disconnect();
    if (this._fpsRaf) cancelAnimationFrame(this._fpsRaf);
  }

  /** Sample the real render cadence and surface it (updates ~2×/s). */
  private _measureFps(t: number): void {
    if (this._fpsLast === 0) this._fpsLast = t;
    this._fpsFrames++;
    const elapsed = t - this._fpsLast;
    if (elapsed >= 500) {
      this._fps = Math.round((this._fpsFrames * 1000) / elapsed);
      this._fpsFrames = 0;
      this._fpsLast = t;
    }
    this._fpsRaf = requestAnimationFrame((next) => this._measureFps(next));
  }

  /** Largest box of the chosen ratio that fits the viewport (mirrors the canvas). */
  private _sizeFrame(): void {
    const vp = this._viewport;
    const frame = this._frame;
    if (!vp || !frame) return;
    const aw = vp.clientWidth;
    const ah = vp.clientHeight;
    if (!aw || !ah) return;
    let w: number;
    let h: number;
    if (aw / ah > this._ratio) {
      h = ah;
      w = h * this._ratio;
    } else {
      w = aw;
      h = w / this._ratio;
    }
    frame.style.width = `${Math.round(w)}px`;
    frame.style.height = `${Math.round(h)}px`;
    this._grid.recalibrate();
  }

  private _applyDotColor(): void {
    const hex = this._dotColorHex.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    this.style.setProperty('--lab-dot-color', `rgba(${r}, ${g}, ${b}, ${this._dotAlpha})`);
    this._grid.refreshColor();
  }

  private _setMode(mode: Mode): void {
    this._mode = mode;
    this._applyMode();
  }

  /** Preview against a light vs dark stage. Flips the dot colour to the opposite
   *  theme's default (only if it's still on a default) so dots stay visible. */
  private _toggleStageTheme(): void {
    this._lightStage = !this._lightStage;
    if (this._lightStage && this._dotColorHex.toLowerCase() === '#e1e1e1') this._dotColorHex = '#181818';
    else if (!this._lightStage && this._dotColorHex.toLowerCase() === '#181818') this._dotColorHex = '#e1e1e1';
    this._applyDotColor();
  }

  private _applyMode(): void {
    // Over-image needs the sample <img> rendered + decoded before masking.
    this.updateComplete.then(() => {
      switch (this._mode) {
        case 'idle':
          this._grid.sync({ shimmering: false, empty: true, generating: false });
          break;
        case 'shimmer':
          this._grid.sync({ shimmering: true, empty: true, generating: true });
          break;
        case 'over-image':
          this._grid.sync({ shimmering: true, empty: false, generating: true });
          break;
      }
    });
  }

  /** Play the cover → materialize reveal once (over the sample image). */
  private _replayReveal(): void {
    this._mode = 'over-image';
    this.updateComplete.then(() => {
      this._grid.sync({ shimmering: true, empty: false, generating: true });
      setTimeout(() => this._grid.sync({ shimmering: false, empty: false, generating: false }), 600);
    });
  }

  private _onParam(key: keyof ShimmerParams, value: number): void {
    this._params = { ...this._params, [key]: value };
    applyShimmerParams({ [key]: value });
    this._grid.recalibrate();
  }

  private _reset(): void {
    // Reload defaults by re-importing module values is overkill; restore the
    // shipped numbers explicitly via a fresh snapshot before any mutation.
    location.reload();
  }

  private _export(): void {
    const p = this._params;
    const lines = [
      `CELL_SIZE = ${p.cellSize};`,
      `DOT_RATIO = ${p.dotRatio};`,
      `MIN_SCALE = ${p.minScale};`,
      `EPI_COUNT = ${p.epiCount};`,
      `EPI_RADIUS_RATIO = ${p.epiRadiusRatio};`,
      `EPI_SPEED = ${p.epiSpeed};`,
      `EPI_WANDER = ${p.epiWander};`,
      `EPI_FALLOFF = ${p.epiFalloff};`,
      `PEAK_SCALE = ${p.peakScale};`,
      `FALLOFF_WARP = ${p.falloffWarp};`,
      `IDLE_SCALE = ${p.idleScale};`,
      `SHIM_DITHER = ${p.dither};`,
      `ALPHA_DITHER = ${p.alphaDither};`,
      `ALPHA_FALLOFF = ${p.alphaFalloff};`,
      `ALPHA_SHIMMER = ${p.alphaShimmer};`,
      `SHIM_FLOOR = ${p.shimFloor};`,
      `POS_JITTER = ${p.posJitter};`,
      `TEMPORAL_JITTER = ${p.temporalJitter};`,
      `ROUNDNESS = ${p.roundness};`,
      `PULSE_AMOUNT = ${p.pulseAmount};`,
      `PULSE_SPEED = ${p.pulseSpeed};`,
      `GLITCH_AMOUNT = ${p.glitchAmount};`,
      `GLITCH_SPEED = ${p.glitchSpeed};`,
      `GLITCH_SHIFT = ${p.glitchShift};`,
      `GLITCH_SIZE = ${p.glitchSize};`,
      `GLITCH_SPACING = ${p.glitchSpacing};`,
      `GLITCH_RANDOM = ${p.glitchRandom};`,
      `MAX_DPR = ${p.maxDpr};`,
      `REVEAL_SS_MIN = ${p.revealSsMin};`,
      `REVEAL_SS_MAX = ${p.revealSsMax};`,
      `EDGE_TAU = ${p.edgeTau};`,
      `ENTER_MS = ${p.enterMs};`,
      `EXIT_MS = ${p.exitMs};`,
      `SHIM_ENTER_MS = ${p.shimEnterMs};`,
      `SHIM_EXIT_MS = ${p.shimExitMs};`,
      `/* dot colour: ${this._dotColorHex} @ alpha ${this._dotAlpha} */`,
    ];
    this._exported = lines.join('\n');
    void navigator.clipboard?.writeText(this._exported);
  }

  public override render() {
    return html`
      <div class=${this._lightStage ? 'stage light' : 'stage'}>
        <div class="fps" title="render FPS">${this._fps} fps</div>
        <div class="viewport">
          <div class="frame">
            ${this._mode === 'over-image' ? html`<img class="image" src="${this._sampleSrc}" alt="" />` : nothing}
          </div>
          <canvas class="dot-grid" aria-hidden="true"></canvas>
        </div>
      </div>

      <div class="panel">
        <div class="modes">
          ${(['idle', 'shimmer', 'over-image'] as Mode[]).map(
            (m) => html`<button class=${m === this._mode ? 'active' : ''} @click=${() => this._setMode(m)}>${m}</button>`,
          )}
          <button @click=${this._replayReveal}>↺ replay reveal</button>
          <button @click=${this._toggleStageTheme}>${this._lightStage ? '🌙 dark stage' : '☀ light stage'}</button>
        </div>

        <div class="group">
          <h3>Dot colour</h3>
          <div class="colorrow">
            <input
              type="color"
              .value=${this._dotColorHex}
              @input=${(e: Event) => {
                this._dotColorHex = (e.target as HTMLInputElement).value;
                this._applyDotColor();
              }}
            />
            <div class="row" style="flex:1; margin:0;">
              <label>Alpha</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                .value=${String(this._dotAlpha)}
                @input=${(e: Event) => {
                  this._dotAlpha = +(e.target as HTMLInputElement).value;
                  this._applyDotColor();
                }}
              />
              <span class="val">${this._dotAlpha.toFixed(2)}</span>
            </div>
          </div>
        </div>

        ${GROUPS.map(
          (group) => html`
            <div class="group">
              <h3>${group.title}</h3>
              ${group.sliders.map((s) => {
                const value = this._params[s.key];
                return html`
                  <div class="row">
                    <label>${s.label}</label>
                    <input
                      type="range"
                      min=${s.min}
                      max=${s.max}
                      step=${s.step}
                      .value=${String(value)}
                      @input=${(e: Event) => this._onParam(s.key, +(e.target as HTMLInputElement).value)}
                    />
                    <span class="val">${s.step < 1 ? value.toFixed(2) : value}</span>
                  </div>
                `;
              })}
            </div>
          `,
        )}

        <div class="modes">
          <button @click=${this._export}>Copy config</button>
          <button @click=${this._reset}>Reset (reload)</button>
        </div>
        ${this._exported ? html`<textarea readonly .value=${this._exported}></textarea>` : nothing}
      </div>
    `;
  }
}
