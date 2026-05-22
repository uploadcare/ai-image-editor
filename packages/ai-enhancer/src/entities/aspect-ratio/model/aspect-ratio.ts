import type { enLocale } from '../../../shared/i18n/en';

export type AspectRatio = readonly [number, number];

export type AspectRatioLabelKey = Extract<keyof typeof enLocale, `ai-enhancer-aspect-${string}`>;

export type AspectRatioOption = {
  /** Tuple [w, h] in lowest sensible terms. */
  ratio: AspectRatio;
  /**
   * Locale key for the human label ("Square", "Tall", …). `null` when the
   * ratio is not in the known set — the picker shows just the "w:h" string.
   */
  labelKey: AspectRatioLabelKey | null;
};

/**
 * Default ratios offered when the host gave us nothing useful — or when the
 * host's crop preset is "free". Order matches the Figma popover.
 */
export const POPULAR_ASPECT_RATIOS: readonly AspectRatio[] = [
  [2, 3],
  [3, 2],
  [1, 1],
  [9, 16],
  [16, 9],
];

const LABEL_BY_RATIO: Record<string, AspectRatioLabelKey> = {
  '1:1': 'ai-enhancer-aspect-square',
  '2:3': 'ai-enhancer-aspect-tall',
  '3:2': 'ai-enhancer-aspect-wide',
  '4:5': 'ai-enhancer-aspect-portrait',
  '5:4': 'ai-enhancer-aspect-landscape',
  '9:16': 'ai-enhancer-aspect-vertical',
  '16:9': 'ai-enhancer-aspect-widescreen',
};

const MIN_RATIO = 0.1;
const MAX_RATIO = 10;

export function isValidAspectRatio(ratio: AspectRatio): boolean {
  const [w, h] = ratio;
  if (!Number.isFinite(w) || !Number.isFinite(h)) return false;
  if (w <= 0 || h <= 0) return false;
  const value = w / h;
  return value >= MIN_RATIO && value <= MAX_RATIO;
}

export function aspectRatioKey(ratio: AspectRatio): string {
  return `${ratio[0]}:${ratio[1]}`;
}

export function labelKeyForRatio(ratio: AspectRatio): AspectRatioLabelKey | null {
  return LABEL_BY_RATIO[aspectRatioKey(ratio)] ?? null;
}

export function toAspectRatioOption(ratio: AspectRatio): AspectRatioOption {
  return { ratio, labelKey: labelKeyForRatio(ratio) };
}

/**
 * Parse a free-form list like "16:9, 5:4, 1:1" (commas and/or whitespace).
 * Invalid entries are dropped. Returns an empty list when nothing parses.
 */
export function parseAspectRatioList(input: string): AspectRatio[] {
  const out: AspectRatio[] = [];
  for (const raw of input.split(/[\s,]+/)) {
    const token = raw.trim();
    if (!token) continue;
    const sep = token.indexOf(':');
    if (sep === -1) continue;
    const w = Number(token.slice(0, sep));
    const h = Number(token.slice(sep + 1));
    const ratio: AspectRatio = [w, h];
    if (isValidAspectRatio(ratio)) out.push(ratio);
  }
  return out;
}

export function aspectRatioEquals(a: AspectRatio, b: AspectRatio): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/**
 * Render the ratio as a small rectangle SVG (16×16 viewBox) whose proportions
 * mirror the ratio itself — a square for 1:1, tall portrait for 2:3, wide for
 * 16:9, etc. Used in place of a generic crop icon to make each option
 * visually self-describing.
 */
export function aspectRatioSvg(ratio: AspectRatio): string {
  const [w, h] = ratio;
  const maxEdge = 12;
  const rectW = w >= h ? maxEdge : maxEdge * (w / h);
  const rectH = h >= w ? maxEdge : maxEdge * (h / w);
  const x = (16 - rectW) / 2;
  const y = (16 - rectH) / 2;
  return `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${rectW.toFixed(2)}" height="${rectH.toFixed(2)}" rx="1.5" stroke="currentColor" stroke-width="1.4"/></svg>`;
}
