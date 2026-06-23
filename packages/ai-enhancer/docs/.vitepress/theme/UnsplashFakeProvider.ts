import type { UploadcareFile } from '@uploadcare/upload-client';
import type { AiProvider, AiProviderRequest, AiProviderResult } from '../../../src';

/** A handful of stable Unsplash photos, cycled through per "generation". */
const PHOTOS = [
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470', // mountains + lake
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e', // sun over hills
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05', // foggy forest
  'https://images.unsplash.com/photo-1426604966848-d7adac402bff', // green valley
  'https://images.unsplash.com/photo-1505765050516-f72dcac9c60e', // road through forest
  'https://images.unsplash.com/photo-1444065381814-865dc9da92c0', // alpine lake
];

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * A **fake** {@link AiProvider} for the docs demo. It doesn't call any AI
 * backend — it returns a random Unsplash photo, sized to the requested aspect
 * ratio, after a short delay so the shimmer/reveal plays. Drop-in proof that the
 * editor runs on any custom provider.
 */
export class UnsplashFakeProvider implements AiProvider {
  public readonly id = 'unsplash-fake';
  private _counter = 0;

  public async generate(request: AiProviderRequest): Promise<AiProviderResult> {
    // Simulate a generation so the dot-grid shimmer + reveal animation play.
    await delay(1100 + Math.random() * 900);

    const [rw, rh] = request.aspectRatio ?? [3, 2];
    const width = 1200;
    const height = Math.round((width * rh) / rw);
    const base = PHOTOS[this._counter++ % PHOTOS.length]!;
    const url = `${base}?auto=format&fit=crop&w=${width}&h=${height}&q=80`;
    const uuid = `demo-${this._counter}-${Math.random().toString(36).slice(2, 8)}`;

    // The editor only reads `uuid`, `imageInfo` (for framing) and the result URL,
    // so a minimal Uploadcare-file-shaped object is enough for the demo.
    const file = {
      uuid,
      cdnUrl: url,
      name: `${slug(request.prompt)}.jpg`,
      originalFilename: `${slug(request.prompt)}.jpg`,
      mimeType: 'image/jpeg',
      isImage: true,
      imageInfo: { width, height },
    } as unknown as UploadcareFile;

    return { url, uuid, prompt: request.prompt, mode: request.mode, file };
  }
}

function slug(prompt: string): string {
  return (
    prompt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'image'
  );
}
