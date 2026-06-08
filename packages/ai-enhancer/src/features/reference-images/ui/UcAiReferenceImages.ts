import { html, LitElement, nothing, type PropertyValues, type TemplateResult, unsafeCSS } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';

import { cdnSquareThumbUrl } from '../../../shared/lib/cdn';
import { SecureUrlController } from '../../../shared/lib/SecureUrlController';
import type { SecureDeliveryProxyUrlResolver } from '../../../shared/lib/secureDelivery';
import {
  ICON_ADD_IMAGE,
  ICON_CLOSE,
  ICON_SOURCE_CAMERA,
  ICON_SOURCE_CLOUD,
  ICON_SOURCE_LOCAL,
  ICON_SOURCE_URL,
} from '../../../shared/ui/icons';
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
  file: File | Blob | null;
};
type UploaderApi = {
  openSystemDialog: (options?: { captureCamera?: boolean }) => void;
  setCurrentActivity: (activity: string, params?: { externalSourceType?: string }) => void;
  setModalState: (opened: boolean) => void;
  removeFileByInternalId: (id: string) => void;
  removeAllFiles: () => void;
  uploadAll: () => void;
  getOutputCollectionState: () => { allEntries: OutputEntryLike[] };
  l10n: (key: string) => string;
  on: (type: string, handler: (payload: { activity?: string }) => void) => () => void;
};
type CtxProvider = HTMLElement & { api: UploaderApi };
type PopoverElement = HTMLElement & { showPopover: () => void; hidePopover: () => void };

const THUMB_SIZE = 48;
const DEFAULT_MAX = 7;

/** Built-in sources with a label key that isn't simply `src-type-<id>`. */
const SOURCE_LABEL_KEY: Record<string, string> = { url: 'src-type-from-url' };
const SOURCE_ICON: Record<string, string> = {
  local: ICON_SOURCE_LOCAL,
  url: ICON_SOURCE_URL,
  camera: ICON_SOURCE_CAMERA,
};

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
 * uploads never mix into a host uploader's collection). The "+" tile opens our
 * own inline source chooser; picking a source opens that source directly (OS
 * dialog for local, the uploader's modal for url/camera/external) and the
 * built-in upload list is suppressed. Uploaded UUIDs surface via
 * `uc:references-change`. The heavy uploader is imported on first "+".
 */
@customElement('uc-ai-reference-images')
export class UcAiReferenceImages extends LitElement {
  public static override styles = unsafeCSS(styles);

  @property() public pubkey = '';
  @property({ attribute: 'base-url' }) public baseUrl?: string;
  @property({ attribute: 'cdn-cname' }) public cdnCname?: string;
  @property({ attribute: 'cdn-cname-prefixed' }) public cdnCnamePrefixed?: string;
  @property({ attribute: false }) public secureResolver?: SecureDeliveryProxyUrlResolver;
  /** Comma/space-separated source ids offered by the chooser. */
  @property({ attribute: 'source-list' }) public sourceList = 'local, url, camera';
  @property({ type: Number }) public max = DEFAULT_MAX;
  @property({ type: Boolean }) public disabled = false;
  @property({ attribute: 'label' }) public label = '';
  @property({ attribute: 'add-label' }) public addLabel = '';
  @property({ attribute: 'remove-label' }) public removeLabel = '';
  @property({ attribute: 'error-label' }) public errorLabel = '';

  @state() private _items: RefItem[] = [];
  @state() private _menuOpen = false;
  @state() private _loading = false;

  @query('.menu') private _menuEl?: PopoverElement;

  private readonly _ctxName = `uc-ai-ref-${crypto.randomUUID()}`;
  private _host?: HTMLElement;
  private _config?: HTMLElement;
  private _provider?: CtxProvider;
  private _unsubscribe?: () => void;
  /** Local preview URLs by entry id, so a thumbnail shows before the CDN one. */
  private readonly _objectUrls = new Map<string, string>();
  private readonly _secure = new SecureUrlController(this);
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
    const provider = document.createElement('uc-upload-ctx-provider') as unknown as CtxProvider;
    for (const el of [config, uploader, provider]) el.setAttribute('ctx-name', this._ctxName);
    // Headless: no built-in button — we drive the flow from our own chooser.
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
    // We never use the built-in upload list; every add-flow tries to open it,
    // so close the modal the moment it would navigate there.
    const offActivity = provider.api.on('activity-change', ({ activity }) => {
      if (activity === 'upload-list') provider.api.setModalState(false);
    });
    this._unsubscribe = () => {
      provider.removeEventListener('change', onChange);
      offActivity();
    };
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
    config.setAttribute('source-list', this.sourceList);
    config.setAttribute('img-only', '');
    config.setAttribute('multiple', '');
    config.setAttribute('multiple-max', String(this.max));
    // Hand the secure-delivery resolver to the embedded uploader too (it signs
    // its own internals). It's a complex config key — set as an element property.
    (config as HTMLElement & { secureDeliveryProxyUrlResolver?: SecureDeliveryProxyUrlResolver | null }).secureDeliveryProxyUrlResolver =
      this.secureResolver ?? null;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    // Clear the cache before render so this render resolves against the new resolver.
    if (changed.has('secureResolver')) this._secure.setResolver(this.secureResolver);
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (!this._config) return;
    if (
      changed.has('pubkey') ||
      changed.has('baseUrl') ||
      changed.has('cdnCname') ||
      changed.has('cdnCnamePrefixed') ||
      changed.has('sourceList') ||
      changed.has('max') ||
      changed.has('secureResolver')
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
    for (const url of this._objectUrls.values()) URL.revokeObjectURL(url);
    this._objectUrls.clear();
  }

  private _syncFromCollection(): void {
    const api = this._provider?.api;
    if (!api) return;
    const entries = api.getOutputCollectionState().allEntries.filter((e) => e.status !== 'removed');
    this._items = entries.map((e) => ({
      internalId: e.internalId,
      status: e.status === 'success' ? 'success' : e.status === 'failed' ? 'failed' : 'uploading',
      uuid: e.status === 'success' ? e.uuid : null,
      thumbUrl: this._thumbFor(e),
    }));
    // Release local preview URLs for entries that are gone.
    const live = new Set(entries.map((e) => e.internalId));
    for (const [id, url] of this._objectUrls) {
      if (!live.has(id)) {
        URL.revokeObjectURL(url);
        this._objectUrls.delete(id);
      }
    }
    this._emitChange();
  }

  /**
   * Thumbnail for an entry: a local object URL (instant, shown while uploading)
   * when we have the file bytes — kept for the entry's life so it never flashes
   * to the CDN rendition — otherwise the CDN thumbnail once available.
   */
  private _thumbFor(e: OutputEntryLike): string | null {
    const cached = this._objectUrls.get(e.internalId);
    if (cached) return cached;
    if (e.file) {
      const url = URL.createObjectURL(e.file);
      this._objectUrls.set(e.internalId, url);
      return url;
    }
    return e.cdnUrl ? cdnSquareThumbUrl(e.cdnUrl, THUMB_SIZE) : null;
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

  private get _sources(): string[] {
    return this.sourceList
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private _sourceLabel(id: string): string {
    const key = SOURCE_LABEL_KEY[id] ?? `src-type-${id}`;
    return this._provider?.api.l10n(key) || id;
  }

  private _setMenuOpen(next: boolean): void {
    this._menuOpen = next;
    const pop = this._menuEl;
    if (!pop) return;
    const isOpen = pop.matches(':popover-open');
    if (next && !isOpen) pop.showPopover();
    else if (!next && isOpen) pop.hidePopover();
  }

  private _onMenuToggle = (e: Event): void => {
    if ((e as ToggleEvent).newState === 'closed' && this._menuOpen) this._menuOpen = false;
  };

  /** Open the source chooser, bootstrapping the uploader (for labels) on first use. */
  private async _onAdd(): Promise<void> {
    if (this.disabled || this._loading || this._items.length >= this.max) return;
    if (this._menuOpen) {
      this._setMenuOpen(false);
      return;
    }
    if (!this._provider) {
      this._loading = true;
      await this._ensureUploader();
      this._loading = false;
    }
    // Wait for the render flush so the popover opens with localized labels
    // (not the raw source ids shown before the uploader's l10n is ready).
    await this.updateComplete;
    this._setMenuOpen(true);
  }

  private _chooseSource(id: string): void {
    this._setMenuOpen(false);
    const api = this._provider?.api;
    if (!api) return;
    if (id === 'local') {
      api.openSystemDialog();
      return;
    }
    if (id === 'url' || id === 'camera') {
      api.setCurrentActivity(id);
      api.setModalState(true);
      return;
    }
    // Everything else is an external/cloud source (dropbox, gdrive, …).
    api.setCurrentActivity('external', { externalSourceType: id });
    api.setModalState(true);
  }

  private _onRemove(item: RefItem): void {
    this._provider?.api.removeFileByInternalId(item.internalId);
  }

  private _onRetry(): void {
    this._provider?.api.uploadAll();
  }

  /** Local previews (`blob:`) render as-is; CDN thumbs go through secure delivery. */
  private _thumbSrc(thumbUrl: string | null): string | null {
    if (!thumbUrl || thumbUrl.startsWith('blob:')) return thumbUrl;
    return this._secure.resolve(thumbUrl);
  }

  public override render(): TemplateResult {
    const atMax = this._items.length >= this.max;
    return html`
      <div class="strip" role="group" aria-label="${this.label}">
        ${this._items.map((item) => {
          const src = this._thumbSrc(item.thumbUrl);
          return html`
            <div class="tile tile--${item.status}">
              ${src ? html`<img class="thumb" src="${src}" alt="" />` : nothing}
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
          `;
        })}
        ${atMax ? nothing : this._renderAdd()}
      </div>
    `;
  }

  private _renderAdd(): TemplateResult {
    return html`
      <div class="add-wrap">
        <button
          type="button"
          class="add"
          aria-label="${this.addLabel}"
          title="${this.addLabel}"
          aria-haspopup="menu"
          aria-expanded="${this._menuOpen}"
          ?disabled=${this.disabled || this._loading}
          @click=${this._onAdd}
        >
          ${this._loading ? html`<div class="spinner"></div>` : unsafeSVG(ICON_ADD_IMAGE)}
        </button>
        <div class="menu" popover="auto" role="menu" @toggle=${this._onMenuToggle}>
          <div class="menu-inner">
            ${this._sources.map(
              (id) => html`
                <button type="button" class="menu-item" role="menuitem" @click=${() => this._chooseSource(id)}>
                  ${unsafeSVG(SOURCE_ICON[id] ?? ICON_SOURCE_CLOUD)}
                  <span>${this._sourceLabel(id)}</span>
                </button>
              `,
            )}
          </div>
        </div>
      </div>
    `;
  }
}
