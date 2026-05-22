/**
 * Vendored from the file-uploader's CloudImageEditor (parseCropPreset.ts).
 * Only the parser is needed here; getClosestAspectRatio was dropped.
 */

const FREEFORM_TOKEN = 'free';

export type CropAspectRatio = {
  id: string;
  type: 'aspect-ratio';
  width: number;
  height: number;
  hasFreeform: boolean;
};

function stringToArray(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(/[\s,]+/).filter(Boolean);
}

export function parseCropPreset(cropPreset: string | null | undefined): CropAspectRatio[] {
  const items = stringToArray(cropPreset);
  if (items.length === 0) return [];

  const result: CropAspectRatio[] = [];
  for (const item of items) {
    const raw = item.trim();
    if (!raw) continue;

    const isFree = raw === FREEFORM_TOKEN;
    const sep = raw.indexOf(':');

    if (sep === -1 && !isFree) {
      console.warn(`Invalid crop preset: ${raw}`);
      continue;
    }

    const w = isFree ? 0 : Number(raw.slice(0, sep));
    const h = isFree ? 0 : Number(raw.slice(sep + 1));

    if (!isFree && (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0)) {
      console.warn(`Invalid crop preset: ${raw}`);
      continue;
    }

    result.push({
      id: crypto.randomUUID(),
      type: 'aspect-ratio',
      width: w,
      height: h,
      hasFreeform: isFree,
    });
  }

  return result;
}
