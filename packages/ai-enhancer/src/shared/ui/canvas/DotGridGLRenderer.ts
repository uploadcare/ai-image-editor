/**
 * WebGL2 backend for the {@link DotGridController}'s rendering. The controller
 * still owns all state (epicentre physics, clip/frame following, env/shimMix
 * envelopes, opacity); this class only paints one frame from a {@link GLFrame}
 * snapshot.
 *
 * Why WebGL: the grid is ~30k dots. In 2D that's a Path2D fill plus an offscreen
 * gradient mask every frame; here it's a single instanced draw, and each dot's
 * brightness is computed in the vertex shader at float precision — so the
 * epicentre wave never quantises into rings, with no dithering tricks. Dots are
 * hard-edged quads rendered at the device pixel ratio, so they stay crisp
 * squares (the reason a previous WebGL attempt — soft sprite dots — was dropped).
 *
 * Masking an image: dots are drawn white into the (premultiplied) drawing buffer
 * with alpha = coverage × brightness, then the image is drawn over them with
 * `blendFunc(DST_ALPHA, ZERO)` so only the dot-shaped, brightness-graded part of
 * the image survives — the GL equivalent of the 2D `source-in` reveal.
 */

/** Per-frame snapshot the controller hands to {@link DotGridGLRenderer.render}. */
export type GLFrame = {
  /** Viewport size in CSS px and the device-pixel scale to render at. */
  cssW: number;
  cssH: number;
  scale: number;
  // Grid layout (CSS px).
  cols: number;
  rows: number;
  offsetX: number;
  offsetY: number;
  cell: number;
  baseRadius: number;
  fullHalf: number;
  // Envelopes.
  env: number;
  shimMix: number;
  // Mode.
  mask: boolean;
  generating: boolean;
  alphaShimmer: boolean;
  // Sizing.
  minScale: number;
  peakScale: number;
  idleScale: number;
  // Epicentre brightness wave.
  epis: Float32Array; // flat [x0,y0, x1,y1, …] in CSS px
  epiCount: number;
  epiRadius: number;
  epiFalloff: number;
  shimFloor: number;
  // Effects.
  falloffWarp: number;
  dither: number;
  alphaDither: number;
  posJitter: number;
  roundness: number;
  alphaFalloff: number;
  pulse: number; // precomputed global size multiplier
  noiseSeed: number;
  glitchOn: boolean;
  glitchSeed: number;
  glitchAmount: number;
  glitchShift: number;
  glitchSize: number;
  // Dot colour (0..1 each) for the non-mask grid.
  color: [number, number, number, number];
  /** Per-dot frame-clip factor (0 = outside frame, 1 = fully in), length cols*rows. */
  clip: Float32Array;
  // Image masking.
  frameLeft: number;
  frameTop: number;
  frameRight: number;
  frameBottom: number;
};

const MAX_EPIS = 8;

const DOT_VERT = `#version 300 es
precision highp float;
precision highp int;
in vec2 aCorner;        // unit quad corner, -0.5..0.5
in float aClip;         // per-instance frame clip, 0..1
uniform vec2 uResolution;
uniform float uCols;
uniform vec2 uOffset;
uniform float uCell;
uniform float uBaseRadius;
uniform float uFullHalf;
uniform float uEnv;
uniform float uShimMix;
uniform int uMask;
uniform int uGenerating;
uniform int uAlphaShimmer;
uniform float uMinScale;
uniform float uPeakScale;
uniform float uIdleScale;
uniform int uEpiCount;
uniform vec2 uEpis[${MAX_EPIS}];
uniform float uEpiRadius;
uniform float uEpiFalloff;
uniform float uShimFloor;
uniform float uColorA;
// ----- effects -----
uniform float uFalloffWarp;   // bends the distance field (de-ring)
uniform float uDither;        // per-dot size dither (size-wave mode)
uniform float uAlphaDither;   // per-dot opacity noise
uniform float uPosJitter;     // per-dot position jitter (× cell)
uniform float uPulse;         // global size multiplier (breathing)
uniform float uNoiseSeed;     // animates the per-dot noise (temporal jitter)
uniform int uGlitchOn;
uniform float uGlitchSeed;
uniform float uGlitchAmount;
uniform float uGlitchShift;
uniform float uGlitchSize;
uniform float uAlphaFalloff;  // legacy radial dimming (size-wave mode)
out float vAlpha;
out vec2 vLocalPx;            // fragment offset from the dot centre, CSS px
out float vHalf;             // dot half-size, CSS px

float hash(float a, float b) { return fract(sin(a * 12.9898 + b * 78.233) * 43758.5453); }

float epiIntensity(vec2 p) {
  float best = 0.0;
  // Low-frequency warp of the distance field — dissolves ring banding.
  float k = uFalloffWarp > 0.0 ? (6.2831853 / (uEpiRadius * 0.7)) : 0.0;
  float warp = k > 0.0 ? uFalloffWarp * uEpiRadius * sin(p.x * k + 1.3) * cos(p.y * k * 0.9) : 0.0;
  for (int i = 0; i < ${MAX_EPIS}; i++) {
    if (i >= uEpiCount) break;
    float d = max(0.0, distance(p, uEpis[i]) + warp);
    if (d >= uEpiRadius) continue;
    float t = 1.0 - d / uEpiRadius;
    float f = t * t * (3.0 - 2.0 * t);      // smoothstep
    if (uEpiFalloff != 1.0) f = pow(f, uEpiFalloff);
    best = max(best, f);
  }
  return best;
}

void main() {
  float col = mod(float(gl_InstanceID), uCols);
  float row = floor(float(gl_InstanceID) / uCols);
  vec2 center = uOffset + vec2(col, row) * uCell;
  float intensity = epiIntensity(center);
  // When masking, ignore the per-dot frame clip and let the scissor define the
  // frame edge instead: dots straddling the edge then poke in and cover it, so
  // the revealed image fills the frame exactly (no uncovered strip that pops in
  // when the grid hands off to the real <img>). The idle/shimmer grid keeps the
  // soft per-dot clip so stray dots never show outside the frame.
  float clipv = (uMask == 1) ? 1.0 : aClip;

  // Per-row digital glitch (a torn row jumps sideways and may spike in size).
  float rowShift = 0.0;
  float rowSize = 1.0;
  if (uGlitchOn == 1 && hash(row, uGlitchSeed) < uGlitchAmount) {
    rowShift = (hash(row + 31.0, uGlitchSeed) - 0.5) * 2.0 * uGlitchShift * uCell;
    if (uGlitchSize > 0.0) rowSize = 1.0 + uGlitchSize * hash(row + 67.0, uGlitchSeed);
  }

  float sizeDither = (hash(col, row + uNoiseSeed) - 0.5) * uDither * intensity;

  float halfSize;
  float brightness;
  if (uMask == 1) {
    float animated;
    if (uAlphaShimmer == 1) {
      animated = uPeakScale;
      float amount = ((uGenerating == 1) ? 1.0 : 0.0) * (1.0 - uShimFloor);
      brightness = (1.0 - amount) + amount * intensity;
    } else {
      float wave = uMinScale + (uPeakScale - uMinScale) * intensity + sizeDither;
      animated = (uGenerating == 1) ? wave : uMinScale;
      brightness = (uAlphaFalloff > 0.0 && uGenerating == 1) ? ((1.0 - uAlphaFalloff) + uAlphaFalloff * intensity) : 1.0;
    }
    float smallHalf = uBaseRadius * animated;
    halfSize = (uFullHalf + uEnv * (smallHalf - uFullHalf)) * clipv;
  } else {
    if (uAlphaShimmer == 1) {
      halfSize = uBaseRadius * uIdleScale * clipv;
      float amount = uShimMix * (1.0 - uShimFloor);
      brightness = (1.0 - amount) + amount * intensity;
    } else {
      float scale = uIdleScale;
      if (uShimMix > 0.0) {
        float wave = uMinScale + (uPeakScale - uMinScale) * intensity + sizeDither;
        scale += (wave - scale) * uShimMix;
      }
      halfSize = uBaseRadius * scale * clipv;
      brightness = (uAlphaFalloff > 0.0 && uShimMix > 0.0) ? ((1.0 - uAlphaFalloff) + uAlphaFalloff * intensity) : 1.0;
    }
  }

  halfSize *= uPulse * rowSize;
  if (halfSize <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // offscreen → culled
    vAlpha = 0.0;
    vLocalPx = vec2(0.0);
    vHalf = 0.0;
    return;
  }

  vec2 pos = center + vec2(rowShift, 0.0);
  if (uPosJitter > 0.0) {
    float amt = uPosJitter * uCell * intensity * (uMask == 1 ? 1.0 : uShimMix);
    pos.x += (hash(col + uNoiseSeed, row) - 0.5) * amt;
    pos.y += (hash(col + 101.0, row + 53.0 + uNoiseSeed) - 0.5) * amt;
  }
  // Expand the quad ~1px beyond the dot so the fragment can anti-alias the edge
  // sub-pixel — without this, hard quad edges snap to whole pixels and the
  // grow/shrink reveal looks stepped.
  float ext = halfSize + 1.0;
  vLocalPx = aCorner * (2.0 * ext);
  vHalf = halfSize;
  pos += aCorner * (2.0 * ext);
  vec2 ndc = (pos / uResolution) * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);

  float a = (uMask == 1 ? 1.0 : uColorA) * brightness;
  if (uAlphaDither > 0.0) {
    float bucket = floor(hash(col + 7.0, row + uNoiseSeed) * 8.0);
    a *= (1.0 - uAlphaDither) + uAlphaDither * (bucket + 0.5) / 8.0;
  }
  vAlpha = a;
}`;

const DOT_FRAG = `#version 300 es
precision highp float;
precision highp int;
in float vAlpha;
in vec2 vLocalPx;       // CSS px from the dot centre
in float vHalf;         // dot half-size, CSS px
uniform vec3 uColorRGB;
uniform int uMask;
uniform float uRoundness; // 0 = square, 1 = circle
out vec4 frag;
void main() {
  // (Rounded-)box signed distance, evaluated in CSS px, anti-aliased over ~1px
  // of screen space via fwidth. Always on, so size changes are sub-pixel-smooth
  // (no stepping) while a square at idle still reads crisp.
  float rr = uRoundness * vHalf;
  vec2 d = abs(vLocalPx) - (vec2(vHalf) - rr);
  float sd = min(max(d.x, d.y), 0.0) + length(max(d, vec2(0.0))) - rr;
  float aaw = max(fwidth(sd), 1e-4);
  float cov = clamp(0.5 - sd / aaw, 0.0, 1.0);
  vec3 rgb = (uMask == 1) ? vec3(1.0) : uColorRGB;
  frag = vec4(rgb * vAlpha * cov, vAlpha * cov); // premultiplied
}`;

const IMG_VERT = `#version 300 es
precision highp float;
in vec2 aQuad;          // 0..1
uniform vec2 uResolution;
uniform vec4 uFrame;    // left, top, right, bottom (CSS px)
out vec2 vFramePx;
void main() {
  vec2 px = mix(uFrame.xy, uFrame.zw, aQuad);
  vFramePx = px - uFrame.xy;
  vec2 ndc = (px / uResolution) * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
}`;

const IMG_FRAG = `#version 300 es
precision highp float;
in vec2 vFramePx;
uniform sampler2D uImage;
uniform vec2 uFrameSize;
uniform vec2 uImageSize;
out vec4 frag;
void main() {
  // object-fit: cover.
  float s = max(uFrameSize.x / uImageSize.x, uFrameSize.y / uImageSize.y);
  vec2 dsz = uImageSize * s;
  vec2 off = (uFrameSize - dsz) * 0.5;
  vec2 uv = (vFramePx - off) / dsz;
  frag = vec4(texture(uImage, uv).rgb, 1.0);
}`;

export class DotGridGLRenderer {
  private readonly _gl: WebGL2RenderingContext;
  private readonly _dotProgram: WebGLProgram;
  private readonly _imgProgram: WebGLProgram;
  private readonly _cornerBuf: WebGLBuffer;
  private readonly _quadBuf: WebGLBuffer;
  private readonly _clipBuf: WebGLBuffer;
  private readonly _dotVao: WebGLVertexArrayObject;
  private readonly _imgVao: WebGLVertexArrayObject;
  private readonly _texture: WebGLTexture;
  private readonly _dotUniforms: Record<string, WebGLUniformLocation | null> = {};
  private readonly _imgUniforms: Record<string, WebGLUniformLocation | null> = {};

  private _appliedW = 0;
  private _appliedH = 0;
  private _appliedScale = 0;
  /** The image element last uploaded to the texture, and whether it succeeded. */
  private _texImage: HTMLImageElement | null = null;
  private _texOk = false;

  private constructor(gl: WebGL2RenderingContext) {
    this._gl = gl;
    this._dotProgram = this._link(DOT_VERT, DOT_FRAG);
    this._imgProgram = this._link(IMG_VERT, IMG_FRAG);

    // Static unit-quad corners (triangle strip) for dots and the image.
    this._cornerBuf = this._staticBuffer([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]);
    this._quadBuf = this._staticBuffer([0, 0, 1, 0, 0, 1, 1, 1]);
    this._clipBuf = gl.createBuffer()!;

    // Dot VAO: per-vertex corner + per-instance clip.
    this._dotVao = gl.createVertexArray()!;
    gl.bindVertexArray(this._dotVao);
    const aCorner = gl.getAttribLocation(this._dotProgram, 'aCorner');
    gl.bindBuffer(gl.ARRAY_BUFFER, this._cornerBuf);
    gl.enableVertexAttribArray(aCorner);
    gl.vertexAttribPointer(aCorner, 2, gl.FLOAT, false, 0, 0);
    const aClip = gl.getAttribLocation(this._dotProgram, 'aClip');
    gl.bindBuffer(gl.ARRAY_BUFFER, this._clipBuf);
    gl.enableVertexAttribArray(aClip);
    gl.vertexAttribPointer(aClip, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aClip, 1);
    gl.bindVertexArray(null);

    // Image VAO: just the quad.
    this._imgVao = gl.createVertexArray()!;
    gl.bindVertexArray(this._imgVao);
    const aQuad = gl.getAttribLocation(this._imgProgram, 'aQuad');
    gl.bindBuffer(gl.ARRAY_BUFFER, this._quadBuf);
    gl.enableVertexAttribArray(aQuad);
    gl.vertexAttribPointer(aQuad, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    for (const name of ['uResolution','uCols','uOffset','uCell','uBaseRadius','uFullHalf','uEnv','uShimMix','uMask','uGenerating','uAlphaShimmer','uMinScale','uPeakScale','uIdleScale','uEpiCount','uEpis','uEpiRadius','uEpiFalloff','uShimFloor','uColorA','uColorRGB','uFalloffWarp','uDither','uAlphaDither','uPosJitter','uPulse','uNoiseSeed','uGlitchOn','uGlitchSeed','uGlitchAmount','uGlitchShift','uGlitchSize','uAlphaFalloff','uRoundness']) {
      this._dotUniforms[name] = gl.getUniformLocation(this._dotProgram, name);
    }
    for (const name of ['uResolution','uFrame','uImage','uFrameSize','uImageSize']) {
      this._imgUniforms[name] = gl.getUniformLocation(this._imgProgram, name);
    }

    this._texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this._texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // No Y-flip: our UVs are top-down (uv.y = 0 at the frame's top edge), and
    // texImage2D already maps the image's top row to v = 0 — flipping would
    // render the image upside down.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }

  /** Create a renderer on `canvas`, or null if WebGL2 / compilation is unavailable. */
  public static create(canvas: HTMLCanvasElement): DotGridGLRenderer | null {
    let gl: WebGL2RenderingContext | null = null;
    try {
      // preserveDrawingBuffer: the loop stops between shimmers, but the grid must
      // hold its last frame while CSS fades its opacity out.
      gl = canvas.getContext('webgl2', {
        premultipliedAlpha: true,
        antialias: false,
        alpha: true,
        preserveDrawingBuffer: true,
      });
    } catch {
      return null;
    }
    if (!gl) return null;
    try {
      return new DotGridGLRenderer(gl);
    } catch (e) {
      if (typeof console !== 'undefined') console.warn('[dot-grid] WebGL init failed, using 2D:', e);
      return null;
    }
  }

  /** Upload (or clear) the image used for masking. Cross-origin images need CORS;
   *  if the upload taints/fails the renderer just skips the image pass. */
  public setImage(image: HTMLImageElement | null): void {
    const gl = this._gl;
    this._texImage = image;
    this._texOk = false;
    if (!image || !image.complete || image.naturalWidth === 0) return;
    gl.bindTexture(gl.TEXTURE_2D, this._texture);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      this._texOk = true;
    } catch {
      this._texOk = false;
    }
  }

  /** Whether the current image was uploaded successfully (CORS-clean). */
  public get hasImage(): boolean {
    return this._texOk;
  }

  public render(f: GLFrame): void {
    const gl = this._gl;
    this._resize(f.cssW, f.cssH, f.scale);

    // Clear the whole buffer (no scissor), then — while masking — scissor every
    // draw to the frame rect. The dot stencil ignores the per-dot clip in that
    // mode (see the shader), so dots straddling the edge fill it; the scissor
    // trims the overflow to a pixel-crisp frame boundary that matches the real
    // <img>, eliminating the uncovered top/bottom strip that popped at hand-off.
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const count = f.cols * f.rows;
    if (count <= 0) return;

    if (f.mask) {
      const s = f.scale;
      const sx = Math.round(f.frameLeft * s);
      const sy = Math.round((f.cssH - f.frameBottom) * s); // GL y origin is bottom-left
      const sw = Math.round((f.frameRight - f.frameLeft) * s);
      const sh = Math.round((f.frameBottom - f.frameTop) * s);
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(sx, sy, Math.max(0, sw), Math.max(0, sh));
    }

    // Per-dot clip (changes every frame as the frame mask eases).
    gl.bindBuffer(gl.ARRAY_BUFFER, this._clipBuf);
    gl.bufferData(gl.ARRAY_BUFFER, f.clip, gl.DYNAMIC_DRAW);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied

    // ----- Pass 1: dots -----
    gl.useProgram(this._dotProgram);
    gl.bindVertexArray(this._dotVao);
    const u = this._dotUniforms;
    gl.uniform2f(u.uResolution, f.cssW, f.cssH);
    gl.uniform1f(u.uCols, f.cols);
    gl.uniform2f(u.uOffset, f.offsetX, f.offsetY);
    gl.uniform1f(u.uCell, f.cell);
    gl.uniform1f(u.uBaseRadius, f.baseRadius);
    gl.uniform1f(u.uFullHalf, f.fullHalf);
    gl.uniform1f(u.uEnv, f.env);
    gl.uniform1f(u.uShimMix, f.shimMix);
    gl.uniform1i(u.uMask, f.mask ? 1 : 0);
    gl.uniform1i(u.uGenerating, f.generating ? 1 : 0);
    gl.uniform1i(u.uAlphaShimmer, f.alphaShimmer ? 1 : 0);
    gl.uniform1f(u.uMinScale, f.minScale);
    gl.uniform1f(u.uPeakScale, f.peakScale);
    gl.uniform1f(u.uIdleScale, f.idleScale);
    gl.uniform1i(u.uEpiCount, Math.min(f.epiCount, MAX_EPIS));
    gl.uniform2fv(u.uEpis, f.epis);
    gl.uniform1f(u.uEpiRadius, f.epiRadius);
    gl.uniform1f(u.uEpiFalloff, f.epiFalloff);
    gl.uniform1f(u.uShimFloor, f.shimFloor);
    gl.uniform1f(u.uColorA, f.color[3]);
    gl.uniform3f(u.uColorRGB, f.color[0], f.color[1], f.color[2]);
    gl.uniform1f(u.uFalloffWarp, f.falloffWarp);
    gl.uniform1f(u.uDither, f.dither);
    gl.uniform1f(u.uAlphaDither, f.alphaDither);
    gl.uniform1f(u.uPosJitter, f.posJitter);
    gl.uniform1f(u.uPulse, f.pulse);
    gl.uniform1f(u.uNoiseSeed, f.noiseSeed);
    gl.uniform1i(u.uGlitchOn, f.glitchOn ? 1 : 0);
    gl.uniform1f(u.uGlitchSeed, f.glitchSeed);
    gl.uniform1f(u.uGlitchAmount, f.glitchAmount);
    gl.uniform1f(u.uGlitchShift, f.glitchShift);
    gl.uniform1f(u.uGlitchSize, f.glitchSize);
    gl.uniform1f(u.uAlphaFalloff, f.alphaFalloff);
    gl.uniform1f(u.uRoundness, f.roundness);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);

    // ----- Pass 2: image keeps only the dot-shaped, brightness-graded part -----
    if (f.mask && this._texOk && this._texImage) {
      gl.blendFunc(gl.DST_ALPHA, gl.ZERO);
      gl.useProgram(this._imgProgram);
      gl.bindVertexArray(this._imgVao);
      const iu = this._imgUniforms;
      gl.uniform2f(iu.uResolution, f.cssW, f.cssH);
      gl.uniform4f(iu.uFrame, f.frameLeft, f.frameTop, f.frameRight, f.frameBottom);
      gl.uniform2f(iu.uFrameSize, f.frameRight - f.frameLeft, f.frameBottom - f.frameTop);
      gl.uniform2f(iu.uImageSize, this._texImage.naturalWidth, this._texImage.naturalHeight);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this._texture);
      gl.uniform1i(iu.uImage, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    gl.disable(gl.SCISSOR_TEST);
    gl.bindVertexArray(null);
  }

  public dispose(): void {
    const gl = this._gl;
    gl.deleteProgram(this._dotProgram);
    gl.deleteProgram(this._imgProgram);
    gl.deleteBuffer(this._cornerBuf);
    gl.deleteBuffer(this._quadBuf);
    gl.deleteBuffer(this._clipBuf);
    gl.deleteVertexArray(this._dotVao);
    gl.deleteVertexArray(this._imgVao);
    gl.deleteTexture(this._texture);
    // Release the context immediately rather than waiting for GC — browsers cap
    // live WebGL contexts (~16) and force-lose the oldest, so mount/unmount
    // churn (or a test suite) would otherwise exhaust them.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  private _resize(cssW: number, cssH: number, scale: number): void {
    if (cssW === this._appliedW && cssH === this._appliedH && scale === this._appliedScale) return;
    const gl = this._gl;
    gl.canvas.width = Math.round(cssW * scale);
    gl.canvas.height = Math.round(cssH * scale);
    (gl.canvas as HTMLCanvasElement).style.width = `${cssW}px`;
    (gl.canvas as HTMLCanvasElement).style.height = `${cssH}px`;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    this._appliedW = cssW;
    this._appliedH = cssH;
    this._appliedScale = scale;
  }

  private _staticBuffer(data: number[]): WebGLBuffer {
    const gl = this._gl;
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    return buf;
  }

  private _link(vertSrc: string, fragSrc: string): WebGLProgram {
    const gl = this._gl;
    const vs = this._compile(gl.VERTEX_SHADER, vertSrc);
    const fs = this._compile(gl.FRAGMENT_SHADER, fragSrc);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`DotGrid GL link failed: ${log}`);
    }
    return program;
  }

  private _compile(type: number, src: string): WebGLShader {
    const gl = this._gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`DotGrid GL compile failed: ${log}`);
    }
    return shader;
  }
}
