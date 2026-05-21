import type { AspectRatio } from '../aspect-ratio';
import type { AiProvider, AiProviderRequest, AiProviderResult } from './types';

const DEFAULT_SEEDS: readonly number[] = [1015, 1043, 1062, 219, 433, 866];
const SAMPLE_SEEDS: Record<string, readonly number[]> = {
  generate: DEFAULT_SEEDS,
  'object-remove': [177, 200, 250, 312],
  'bg-replace': [27, 64, 119, 152],
  outpaint: [400, 408, 421, 448],
};

function pickSeed(prompt: string, capability: string): number {
  const pool = SAMPLE_SEEDS[capability] ?? DEFAULT_SEEDS;
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    hash = (hash * 31 + prompt.charCodeAt(i)) | 0;
  }
  return pool[Math.abs(hash) % pool.length] ?? 1015;
}

function fitToBox(ratio: AspectRatio, longEdge: number): { width: number; height: number } {
  const [rw, rh] = ratio;
  if (rw >= rh) {
    return { width: longEdge, height: Math.max(1, Math.round((longEdge * rh) / rw)) };
  }
  return { width: Math.max(1, Math.round((longEdge * rw) / rh)), height: longEdge };
}

export type MockBflOptions = {
  /** Latency in ms before the mock resolves. Default: 900. */
  latency?: number;
  /** Probability in [0, 1] of returning a fake error. Default: 0. */
  errorRate?: number;
  /** Image width returned by Picsum when no aspectRatio is provided. Default: 768. */
  width?: number;
  /** Image height returned by Picsum when no aspectRatio is provided. Default: 768. */
  height?: number;
  /**
   * Long-edge size (px) when an aspectRatio is provided; the short edge is
   * derived from the ratio. Default: 768.
   */
  longEdge?: number;
};

export function createMockBflProvider(options: MockBflOptions = {}): AiProvider {
  const { latency = 900, errorRate = 0, width = 768, height = 768, longEdge = 768 } = options;

  return {
    id: 'mock-bfl',
    async generate({ prompt, capability, aspectRatio, signal }: AiProviderRequest): Promise<AiProviderResult> {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, latency);
        signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          },
          { once: true },
        );
      });

      if (errorRate > 0 && Math.random() < errorRate) {
        throw new Error('Mock BFL provider: simulated failure');
      }

      const seed = pickSeed(prompt || capability, capability);
      const { width: w, height: h } = aspectRatio ? fitToBox(aspectRatio, longEdge) : { width, height };
      const url = `https://picsum.photos/seed/${seed}/${w}/${h}`;

      return { url, prompt, capability };
    },
  };
}

export const mockBflProvider: AiProvider = createMockBflProvider();
