import { html, LitElement, nothing, type PropertyValues, type TemplateResult, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';

import { cdnSquareThumbUrl } from '../../../shared/lib/cdn';
import { ICON_ADD_IMAGE, ICON_CLOSE } from '../../../shared/ui/icons';
import styles from './reference-images.css?inline';

export type ReferencesChangeDetail = {
  /** UUIDs of successfully uploaded reference images. */
  uuids: string[];
  /** True while any reference is still uploading (send should wait). */
  uploading: boolean;
};

type RefStatus = 'uploading' | 'success' | 'failed';
type RefItem = { internalId: string; status: RefStatus; uuid: string | null; thumbUrl: string | null };

/** Minimal structural views of the file-uploader bits we touch (avoids a hard type import). */
type OutputEntryLike = {
  internalId: string;
  status: 'idle' | 'uploading' | 'success' | 'failed' | 'removed';
  uuid: string | null;
  cdnUrl: string | null;
  isImage: boolean;
};
type UploaderApi = {
  initFlow: () => void;
  removeFileByInternalId: (id: string) => void;
  removeAllFiles: () => void;
  uploadAll: () => void;
  getOutputCollectionState: () => { allEntries: OutputEntryLike[] };
};
type CtxProvider = HTMLElement & { api: UploaderApi };

const THUMB_SIZE = 48;
const DEFAULT_MAX = 7;
let styleSheetPromise: Promise<CSSStyleSheet> | undefined;

/**
 * Lazily build a single constructable stylesheet from the file-uploader's CSS
 * (imported as a string). It is adopted into the per-instance shadow root that
 * hosts the uploader — scoping the uploader's `.uc-*` styles to that root
 * instead of leaking them into the host document. Shared across instances.
 */
function loadUploaderStyleSheet(): Promise<CSSStyleSheet> {
  if (!styleSheetPromise) {
    styleSheetPromise = import('@uploadcare/file-uploader/web/uc-file-uploader-regular.min.css?inline').then((mod) => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(mod.default);
      return sheet;
    });
  }
  return styleSheetPromise;
}

/**
 * Reference-images strip for edit mode. Uploads run through an isolated,
 * lazily-loaded `@uploadcare/file-uploader` context (its own `ctx-name`, so
 * uploads never mix into a host uploader's collection); this element renders
 * its own thumbnail strip and surfaces the uploaded UUIDs via
 * `uc:references-change`. The heavy uploader is imported only when the user
 * first adds a reference.
 */
@customElement('uc-ai-reference-images')
export class UcAiReferenceImages extends LitElement {
  public static override styles = unsafeCSS(styles);

  @property() public pubkey = '';
  @property({ attribute: 'base-url' }) public baseUrl?: string;
  @property({ attribute: 'cdn-cname' }) public cdnCname?: string;
  @property({ attribute: 'cdn-cname-prefixed' }) public cdnCnamePrefixed?: string;
  @property({ type: Number }) public max = DEFAULT_MAX;
  @property({ type: Boolean }) public disabled = false;
  @property({ attribute: 'label' }) public label = '';
  @property({ attribute: 'add-label' }) public addLabel = '';
  @property({ attribute: 'remove-label' }) public removeLabel = '';
  @property({ attribute: 'error-label' }) public errorLabel = '';

  @state() private _items: RefItem[] = [];

  private readonly _ctxName = `uc-ai-ref-${crypto.randomUUID()}`;
  private _host?: HTMLElement;
  private _config?: HTMLElement;
  private _provider?: CtxProvider;
  private _unsubscribe?: () => void;
  /** In-flight bootstrap, so concurrent "+" clicks share one context. */
  private _bootstrap?: Promise<UploaderApi | undefined>;

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._teardown();
  }

  /** Lazily bootstrap the isolated uploader context on first use (memoized). */
  private _ensureUploader(): Promise<UploaderApi | undefined> {
    if (this._provider) return Promise.resolve(this._provider.api);
    if (!this.pubkey) return Promise.resolve(undefined);
    if (!this._bootstrap) {
      this._bootstrap = this._createUploader().finally(() => {
        this._bootstrap = undefined;
      });
    }
    return this._bootstrap;
  }

  private async _createUploader(): Promise<UploaderApi | undefined> {
    const [UC, sheet] = await Promise.all([import('@uploadcare/file-uploader'), loadUploaderStyleSheet()]);
    UC.defineComponents(UC);
    // The custom elements upgrade asynchronously — wait before touching `.api`.
    await customElements.whenDefined('uc-upload-ctx-provider');

    const config = document.createElement('uc-config');
    const uploader = document.createElement('uc-file-uploader-regular');
    const provider = document.createElement('uc-upload-ctx-provider') as CtxProvider;
    for (const el of [config, uploader, provider]) el.setAttribute('ctx-name', this._ctxName);
    // Headless: no built-in button — we drive the flow from our own "+" tile.
    uploader.setAttribute('headless', '');
    this._config = config;
    this._applyConfig(config);

    // Host the uploader in a body-attached element with its own shadow root,
    // and adopt the uploader stylesheet there — scoping its styles to this root
    // (no global leak) while staying in the document so the uploader works.
    const host = document.createElement('div');
    host.className = 'uc-ai-ref-uploader';
    const root = host.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [sheet];
    root.append(config, uploader, provider);
    document.body.append(host);

    this._host = host;
    this._provider = provider;
    const onChange = () => this._syncFromCollection();
    provider.addEventListener('change', onChange);
    this._unsubscribe = () => provider.removeEventListener('change', onChange);
    return provider.api;
  }

  private _setOrRemoveAttr(el: HTMLElement, attr: string, value?: string): void {
    if (value) el.setAttribute(attr, value);
    else el.removeAttribute(attr);
  }

  private _applyConfig(config: HTMLElement): void {
    config.setAttribute('pubkey', this.pubkey);
    this._setOrRemoveAttr(config, 'base-url', this.baseUrl);
    this._setOrRemoveAttr(config, 'cdn-cname', this.cdnCname);
    this._setOrRemoveAttr(config, 'cdn-cname-prefixed', this.cdnCnamePrefixed);
    config.setAttribute('img-only', '');
    config.setAttribute('multiple', '');
    config.setAttribute('multiple-max', String(this.max));
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (!this._config) return;
    if (
      changed.has('pubkey') ||
      changed.has('baseUrl') ||
      changed.has('cdnCname') ||
      changed.has('cdnCnamePrefixed')
    ) {
      this._applyConfig(this._config);
    }
  }

  private _teardown(): void {
    this._unsubscribe?.();
    this._unsubscribe = undefined;
    try {
      this._provider?.api.removeAllFiles();
    } catch {
      // Uploader may already be gone; nothing to clean.
    }
    this._host?.remove();
    this._host = undefined;
    this._config = undefined;
    this._provider = undefined;
    this._items = [];
  }

  private _syncFromCollection(): void {
    const api = this._provider?.api;
    if (!api) return;
    this._items = api
      .getOutputCollectionState()
      .allEntries.filter((e) => e.status !== 'removed' && e.status !== 'idle')
      .map((e) => ({
        internalId: e.internalId,
        // The filter above leaves only uploading | success | failed.
        status: e.status as RefStatus,
        uuid: e.status === 'success' ? e.uuid : null,
        thumbUrl: e.cdnUrl ? cdnSquareThumbUrl(e.cdnUrl, THUMB_SIZE) : null,
      }));
    this._emitChange();
  }

  private _emitChange(): void {
    const uuids = this._items.filter((i) => i.status === 'success' && i.uuid).map((i) => i.uuid as string);
    const uploading = this._items.some((i) => i.status === 'uploading');
    this.dispatchEvent(
      new CustomEvent<ReferencesChangeDetail>('uc:references-change', {
        detail: { uuids, uploading },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private async _onAdd(): Promise<void> {
    if (this.disabled || this._items.length >= this.max) return;
    const api = await this._ensureUploader();
    api?.initFlow();
  }

  private _onRemove(item: RefItem): void {
    this._provider?.api.removeFileByInternalId(item.internalId);
  }

  private _onRetry(): void {
    this._provider?.api.uploadAll();
  }

  public override render(): TemplateResult {
    const atMax = this._items.length >= this.max;
    return html`
      <div class="strip" role="group" aria-label="${this.label}">
        ${this._items.map(
          (item) => html`
            <div class="tile tile--${item.status}">
              ${item.thumbUrl ? html`<img class="thumb" src="${item.thumbUrl}" alt="" />` : nothing}
              ${item.status === 'uploading' ? html`<div class="spinner" role="progressbar"></div>` : nothing}
              ${
                item.status === 'failed'
                  ? html`<button type="button" class="retry" aria-label="${this.errorLabel}" title="${this.errorLabel}" @click=${this._onRetry}>!</button>`
                  : nothing
              }
              <button
                type="button"
                class="remove"
                aria-label="${this.removeLabel}"
                @click=${() => this._onRemove(item)}
              >
                ${unsafeSVG(ICON_CLOSE)}
              </button>
            </div>
          `,
        )}
        ${
          atMax
            ? nothing
            : html`
              <button
                type="button"
                class="add"
                aria-label="${this.addLabel}"
                title="${this.addLabel}"
                ?disabled=${this.disabled}
                @click=${this._onAdd}
              >
                ${unsafeSVG(ICON_ADD_IMAGE)}
              </button>
            `
        }
      </div>
    `;
  }
}
