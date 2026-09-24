import type { Metadata, UploadcareFile } from '@uploadcare/upload-client';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { AspectRatio, AspectRatioValue } from '../../../entities/aspect-ratio';
import type { AiEditorMode } from '../../../entities/mode';
import { type AiImageEditorError, normalizeError } from '../../../entities/error';
import type { AiProvider, AiProviderResult } from '../../../entities/provider';

export type HistoryEntry = {
  id: string;
  prompt: string;
  mode: AiEditorMode;
  url: string;
  file: UploadcareFile;
  /** The ratio selection that produced this entry, so re-selecting it restores
   *  the picker (incl. "Original"). `null` when none was active. */
  ratio: AspectRatioValue | null;
};

export type RunArgs = {
  provider: AiProvider;
  prompt: string;
  mode: AiEditorMode;
  aspectRatio?: AspectRatio;
  /** The full ratio selection (incl. the "Original" sentinel / null) at run time,
   *  recorded on the history entry so it can be restored on re-select. The
   *  provider still receives only the concrete {@link aspectRatio}. */
  ratioValue?: AspectRatioValue | null;
  /** UUID of the source image to edit (when `mode` is `edit`). */
  source?: string;
  /** Desired output filename (e.g. preserve the edited file's original name). */
  filename?: string;
  /** Arbitrary key/value metadata to attach to the resulting Uploadcare file. */
  metadata?: Metadata;
};

const MAX_HISTORY = 20;

export class GenerationController implements ReactiveController {
  public busy = false;
  public resultUrl: string | null = null;
  /** The last successful generation result, including its raw response. */
  public result: AiProviderResult | null = null;
  /**
   * The last failure, normalized. The same object `run()` rethrows and the
   * editor puts on `uc:error`, so the message shown and the error handed to the
   * host cannot describe different things. Its `code` is what the editor maps
   * to a localized, overridable message.
   */
  public error: AiImageEditorError | null = null;
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

  /** Drop the prompt-history strip (e.g. on "Start over"). */
  public clearHistory(): void {
    this.history = [];
    this._host.requestUpdate();
  }

  /** Replace the strip with entries hydrated from storage (e.g. when the editor
   *  opens on a source whose lineage was generated in a past session). */
  public setHistory(entries: HistoryEntry[]): void {
    this.history = entries.slice(0, MAX_HISTORY);
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
        filename: args.filename,
        metadata: args.metadata,
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
          ratio: args.ratioValue ?? null,
        },
        ...this.history,
      ].slice(0, MAX_HISTORY);
      return result;
    } catch (err) {
      // We own this controller, so anything thrown while it is aborted is a
      // cancellation — whatever shape the error has.
      if (controller.signal.aborted) return null;
      // Normalized once, here, and rethrown as the same object the editor
      // dispatches — `normalizeError` is idempotent, so nothing downstream has
      // to know it already happened.
      this.error = normalizeError(err);
      throw this.error;
    } finally {
      if (this._abortController === controller) {
        this.busy = false;
        this._abortController = null;
      }
      this._host.requestUpdate();
    }
  }
}
