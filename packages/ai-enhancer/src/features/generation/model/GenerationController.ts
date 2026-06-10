import type { UploadcareFile } from '@uploadcare/upload-client';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { AspectRatio } from '../../../entities/aspect-ratio';
import type { AiEditorMode } from '../../../entities/mode';
import type { AiProvider, AiProviderResult } from '../../../entities/provider';

export type HistoryEntry = {
  id: string;
  prompt: string;
  mode: AiEditorMode;
  url: string;
  file: UploadcareFile;
};

export type RunArgs = {
  provider: AiProvider;
  prompt: string;
  mode: AiEditorMode;
  aspectRatio?: AspectRatio;
  /** UUID of the source image to edit (when `mode` is `edit`). */
  source?: string;
};

const MAX_HISTORY = 20;

export class GenerationController implements ReactiveController {
  public busy = false;
  public resultUrl: string | null = null;
  /** The last successful generation result, including its raw response. */
  public result: AiProviderResult | null = null;
  public error: string | null = null;
  public history: HistoryEntry[] = [];

  private readonly _host: ReactiveControllerHost;
  private _abortController: AbortController | null = null;

  public constructor(host: ReactiveControllerHost) {
    this._host = host;
    host.addController(this);
  }

  public hostDisconnected(): void {
    this.abort();
  }

  public abort(): void {
    /*
     * Only signal cancellation. Leave _abortController in place so the
     * in-flight run's `finally` can match its own controller and clear `busy`
     * — otherwise the controller would be stuck busy=true after an external
     * abort.
     */
    this._abortController?.abort();
  }

  public reset(): void {
    this.abort();
    this.resultUrl = null;
    this.result = null;
    this.error = null;
    this._host.requestUpdate();
  }

  public setResult(result: AiProviderResult): void {
    this.resultUrl = result.url;
    this.result = result;
    this.error = null;
    this._host.requestUpdate();
  }

  public async run(args: RunArgs): Promise<AiProviderResult | null> {
    if (this.busy) return null;
    this._abortController?.abort();
    const controller = new AbortController();
    this._abortController = controller;
    this.busy = true;
    this.error = null;
    this._host.requestUpdate();

    try {
      const result = await args.provider.generate({
        prompt: args.prompt,
        mode: args.mode,
        aspectRatio: args.aspectRatio,
        source: args.source,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return null;
      this.resultUrl = result.url;
      this.result = result;
      this.history = [
        {
          id: crypto.randomUUID(),
          prompt: result.prompt,
          mode: result.mode,
          url: result.url,
          file: result.file,
        },
        ...this.history,
      ].slice(0, MAX_HISTORY);
      return result;
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return null;
      this.error = (err as Error).message || 'Generation failed';
      throw err;
    } finally {
      if (this._abortController === controller) {
        this.busy = false;
        this._abortController = null;
      }
      this._host.requestUpdate();
    }
  }
}
