import type { Metadata, UploadcareFile } from '@uploadcare/upload-client';
import { html, LitElement, nothing, type PropertyValues, type TemplateResult, unsafeCSS } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import {
  type AspectRatio,
  type AspectRatioOption,
  type AspectRatioValue,
  aspectRatioValueEquals,
  DEFAULT_GENERATE_RATIO,
  isConcreteRatio,
  isValidAspectRatio,
  ORIGINAL_RATIO,
  POPULAR_ASPECT_RATIOS,
  parseAspectRatioList,
  toAspectRatioOption,
} from '../../../entities/aspect-ratio';
import { type AiEditorMode, type AiPresets, MODES } from '../../../entities/mode';
import { type AiProvider, UploadcareDerivativeApi } from '../../../entities/provider';
import { GenerationController } from '../../../features/generation';
import { type AiEnhancerLocale, type AiEnhancerLocaleKey, enLocale, LOCALE_LOADERS, translate } from '../../../shared/i18n';
import { cdnPreviewUrl } from '../../../shared/lib/cdn';
import { HistoryStorageController } from '../../../shared/lib/HistoryStorageController';
import { SecureUrlController } from '../../../shared/lib/SecureUrlController';
import type { SecureDeliveryProxyUrlResolver } from '../../../shared/lib/secureDelivery';
import '../../../features/aspect-ratio-select';
import '../../../features/prompt-history';
import '../../../features/prompt-input';
import '../../../features/preset-chips';
import '../../../shared/ui/canvas';
import '../../../shared/ui/footer';
import type { AspectRatioSelectDetail } from '../../../features/aspect-ratio-select';
import type { HistorySelectDetail } from '../../../features/prompt-history';
import type { PromptInputDetail, UcAiPromptRow } from '../../../features/prompt-input';
import type { PresetSelectDetail } from '../../../features/preset-chips';
import type { ShimmerConfig, UcAiCanvas } from '../../../shared/ui/canvas';
import styles from './ai-editor.css?inline';

export type { HistoryEntry } from '../../../features/generation';

export type DoneDetail = {
  url: string;
  /** UUID of the committed Uploadcare file (same as `file.uuid`). */
  uuid: string;
  prompt: string;
  mode: AiEditorMode;
  aspectRatio?: AspectRatio;
  /** The committed result as an Uploadcare file object. */
  file: UploadcareFile;
};

/**
 * Resolves the filename given to a generated/edited result. Receives the source
 * image's original filename (`undefined` when generating from scratch) and the
 * 1-based counter of this generation within the session's history (the first is
 * `1`). Returns the desired output filename.
 */
export type OutputFilenameResolver = (originalFilename: string | undefined, counter: number) => string;

/**
 * Per-file metadata callback, mirroring the file uploader's `metadata` config
 * option. Called at generation time with the source image's file info (the
 * uploader passes its entry's `.fileInfo`); returns the metadata bag, optionally
 * async. Only invoked when there is a source (an edit); a generate-from-scratch
 * gets no callback. Use the static {@link Metadata} form to cover both.
 */
export type MetadataCallback = (fileInfo: UploadcareFile) => Promise<Metadata> | Metadata;

/** Which edge the composer (prompt + chips + aspect ratio) sits on. */
export type ComposerPlacement = 'top' | 'bottom';

/**
 * How the canvas sizes relative to the composer.
 * - `available`: the canvas uses only the space left by the composer, which is
 *   docked outside the image (history chips still overlay the canvas).
 * - `full`: the canvas fills the whole area and the composer floats over it.
 */
export type CanvasFit = 'full' | 'available';

/**
 * Where the history strip sits.
 * - `composer-above` / `composer-below`: relative to the composer (moves with it).
 * - `canvas-top` / `canvas-bottom`: pinned to that canvas edge, independent of the composer.
 */
export type HistoryPlacement = 'composer-above' | 'composer-below' | 'canvas-top' | 'canvas-bottom';

/** Where the toolbar (Cancel / Done) sits within the editor. */
export type ToolbarPlacement = 'bottom' | 'top';

const COMPOSER_PLACEMENTS: readonly ComposerPlacement[] = ['top', 'bottom'];
const CANVAS_FITS: readonly CanvasFit[] = ['full', 'available'];
const HISTORY_PLACEMENTS: readonly HistoryPlacement[] = [
  'composer-above',
  'composer-below',
  'canvas-top',
  'canvas-bottom',
];

/**
 * `<uc-ai-enhancer>` — the standalone AI image generate/edit editor.
 *
 * Generates images from a text prompt and edits an existing image (`source`),
 * backed by Uploadcare's derivative API (configured via {@link pubkey}).
 *
 * @summary AI image generation & editing web component.
 *
 * @fires uc:done - A `CustomEvent<DoneDetail>` fired when the user commits a
 *   result (the Done button). `detail` carries the result `url`, `uuid`,
 *   `prompt`, `mode`, optional `aspectRatio`, and the `file` object.
 * @fires uc:cancel - Fired when the user cancels (the Cancel button). No detail.
 * @fires uc:error - A `CustomEvent<{ error: unknown }>` fired when a generation
 *   throws.
 *
 * @cssprop [--uc-ai-background] - Editor surface background.
 * @cssprop [--uc-ai-foreground] - Primary text/icon colour.
 * @cssprop [--uc-ai-muted-foreground] - Secondary/muted text colour.
 * @cssprop [--uc-ai-accent] - Accent colour for primary actions.
 * @cssprop [--uc-ai-radius-button] - Corner radius for buttons.
 * @cssprop [--uc-ai-transition] - Base transition timing.
 * @cssprop [--uc-ai-dot-grid-color] - Colour of the shimmer dot grid.
 *
 * @see The theming guide for the full token list.
 */
@customElement('uc-ai-enhancer')
export class UcAiEditor extends LitElement {
  public static override styles = unsafeCSS(styles);

  /**
   * UUID of an image to edit. When set (or {@link sourceFileInfo} is), the editor
   * opens straight in edit mode; when absent, it starts in generate mode.
   *
   * Use **either** `sourceUuid` **or** {@link sourceFileInfo}, not both — they're
   * two ways to point at the same source (a uuid the editor looks up, vs. the
   * already-resolved file). The mode is otherwise derived (see {@link _mode}).
   */
  @property({ attribute: 'source-uuid' })
  public sourceUuid: string | null = null;

  /**
   * The source image as an `UploadcareFile` — e.g. the object returned by
   * `@uploadcare/upload-client`, or the `fileInfo` of a File Uploader output
   * entry (`OutputFileEntry.fileInfo`). Hands the editor the file directly
   * instead of having it look it up from a uuid.
   *
   * Use **either** `sourceFileInfo` **or** {@link sourceUuid}, not both. Property
   * only.
   */
  @property({ attribute: false })
  public sourceFileInfo?: UploadcareFile;

  /**
   * Names the generated/edited result. A string is used verbatim; a function
   * receives `(originalFilename, counter)` and returns the name (see
   * {@link OutputFilenameResolver}). When unset, the result keeps the source's
   * original filename (and falls back to the provider's default when generating
   * from scratch). Property only (the function form can't be an attribute).
   */
  @property({ attribute: false })
  public outputFilename?: string | OutputFilenameResolver;

  /**
   * Metadata attached to the resulting Uploadcare file, for both generate and
   * edit. Mirrors the file uploader's `metadata` config: either a static bag
   * (`Record<string, string>`, e.g. `{ source: 'ai-enhancer' }`) or a
   * {@link MetadataCallback} resolved at generation time against the source file.
   * Property only.
   */
  @property({ attribute: false })
  public metadata?: Metadata | MetadataCallback | null;

  /** Uploadcare public key. Required to enable generate/edit. */
  @property()
  public pubkey = '';

  /**
   * Custom AI provider that replaces the built-in Uploadcare provider (built
   * from {@link pubkey}) — the editor calls its {@link AiProvider.generate} for
   * every run. Internal/advanced; used by the docs demo to drive the editor with
   * a fake backend. Property only.
   * @internal
   */
  @property({ attribute: false })
  public provider?: AiProvider;

  /** Upload API base URL. Defaults to the provider's default. */
  @property({ attribute: 'base-url' })
  public baseUrl?: string;

  /** CDN cname for resolving results (maps to the provider's `cdnBaseUrl`). */
  @property({ attribute: 'cdn-cname' })
  public cdnCname?: string;

  /** Base domain for public-key-prefixed CDN URLs. */
  @property({ attribute: 'cdn-cname-prefixed' })
  public cdnCnamePrefixed?: string;

  /** Secure-delivery resolver: signs/proxies the CDN urls the editor renders. */
  @property({ attribute: false })
  public secureDeliveryProxyUrlResolver?: SecureDeliveryProxyUrlResolver;

  /**
   * Available aspect ratios for the generate flow. When set as an attribute
   * (`aspect-ratios="16:9 5:4 1:1"`), the string is parsed. Falsy / empty
   * input falls back to the popular set.
   */
  @property({ type: Array, attribute: 'aspect-ratios', converter: (v) => (v ? parseAspectRatioList(v) : null) })
  public aspectRatios: AspectRatio[] | null = null;

  /** Active locale. The editor lazy-loads its built-in strings for this locale
   *  (falling back to English) and layers `localeDefinitionOverride` on top. */
  @property({ attribute: 'locale-name' })
  public localeName = 'en';

  /**
   * Locale string overrides, keyed by locale name — the same shape as the file
   * uploader's `localeDefinitionOverride`. The section matching {@link localeName}
   * is layered on top of that locale's built-in strings, e.g.
   * `{ en: { 'ai-enhancer-generate-btn': 'Make it!' } }`.
   */
  @property({ attribute: false })
  public localeDefinitionOverride: Record<string, Partial<AiEnhancerLocale>> = {};

  /**
   * Presets-only mode: hides the free-text prompt so only the preset chips
   * remain, and selecting a preset starts the generation immediately (there's
   * nothing to type, so no separate send step). Off by default.
   */
  @property({ type: Boolean, attribute: 'presets-only' })
  public presetsOnly = false;

  /**
   * Quick-prompt presets (the chips above the prompt), keyed by mode. Each preset
   * is `{ label, prompt }`: clicking a chip fills the prompt with `prompt`. Modes
   * left out use their built-in set; an empty array hides that mode's chips, e.g.
   * `{ generate: [{ label: 'Logo', prompt: 'A logo of ' }], edit: [] }`.
   *
   * Keyed by {@link AiEditorMode} (and partial), so new modes/capabilities (e.g.
   * `outpaint`) extend this additively — without breaking existing configs.
   */
  @property({ attribute: false })
  public presets: AiPresets = {};

  /** Which edge the composer sits on: `bottom` (default) or `top`. */
  @property({ attribute: 'composer-placement' })
  public composerPlacement: ComposerPlacement = 'bottom';

  /**
   * How the canvas sizes relative to the composer. `available` (default) shrinks
   * the canvas to the space left by the composer, which is docked outside the
   * image (history chips still overlay the canvas). `full` lets the canvas fill
   * the whole area with the composer floating over it. Auto-hide always floats,
   * so {@link composerAutoHide} implies `full`.
   */
  @property({ attribute: 'canvas-fit' })
  public canvasFit: CanvasFit = 'available';

  /**
   * Where the history strip sits. `composer-above` (default) / `composer-below`
   * are relative to the composer; `canvas-top` / `canvas-bottom` pin it to the
   * canvas edge.
   */
  @property({ attribute: 'history-placement' })
  public historyPlacement: HistoryPlacement = 'composer-above';

  /**
   * Auto-hide ("dock") the floating composer once an image exists: it drops to a
   * small peek at the edge and raises when the pointer approaches its edge or it
   * gains focus. Always floats the composer (implies {@link canvasFit} `full`);
   * off by default.
   */
  @property({ type: Boolean, attribute: 'composer-auto-hide', reflect: true })
  public composerAutoHide = false;

  /** Where the toolbar (Cancel / Done) sits: `bottom` (default) or `top`. */
  @property({ attribute: 'toolbar-placement' })
  public toolbarPlacement: ToolbarPlacement = 'bottom';

  /**
   * Shimmer tuning forwarded to the canvas's dot grid (e.g. force the 2D backend
   * in tests). Not part of the public component API.
   * @internal
   */
  @property({ attribute: false })
  public shimmerConfig?: Partial<ShimmerConfig>;

  @state()
  private _prompt = '';

  @state()
  private _selectedRatio: AspectRatioValue | null = null;

  /** Display URL for {@link source}, resolved via the provider's CDN base. */
  @state()
  private _inputUrl: string | null = null;

  /** Source info fetched from {@link source} when none was injected via
   *  {@link sourceFileInfo}. The injected value always takes precedence. */
  @state()
  private _fetchedFileInfo?: UploadcareFile;

  /** Last derived mode, to (re)default the ratio selection when it flips. */
  private _lastMode?: AiEditorMode;

  @query('uc-ai-prompt-row')
  private _promptRow?: UcAiPromptRow;

  @query('uc-ai-canvas')
  private _canvasEl?: UcAiCanvas;

  private readonly _gen = new GenerationController(this);
  private readonly _history = new HistoryStorageController(this);
  private readonly _secure = new SecureUrlController(this);
  private _provider?: AiProvider;

  /** Effective strings for the active locale (built-ins + overrides). */
  @state()
  private _localeStrings: Partial<typeof enLocale> = enLocale;
  private _localeToken = 0;

  public override willUpdate(changed: PropertyValues<this>): void {
    const providerConfigChanged =
      changed.has('provider') ||
      changed.has('pubkey') ||
      changed.has('baseUrl') ||
      changed.has('cdnCname') ||
      changed.has('cdnCnamePrefixed');
    if (providerConfigChanged) {
      // An injected provider wins; otherwise build the default Uploadcare one
      // from `pubkey` (and stay disabled until a pubkey is set).
      this._provider =
        this.provider ??
        (this.pubkey
          ? new UploadcareDerivativeApi({
              publicKey: this.pubkey,
              baseUrl: this.baseUrl,
              cdnBaseUrl: this.cdnCname,
              cdnCnamePrefixed: this.cdnCnamePrefixed,
            })
          : undefined);
    }
    if (changed.has('secureDeliveryProxyUrlResolver')) {
      this._secure.setResolver(this.secureDeliveryProxyUrlResolver);
    }
    // The source identity can change via either input property.
    const sourceChanged = changed.has('sourceUuid') || changed.has('sourceFileInfo');
    if (import.meta.env.DEV && this.sourceUuid && this.sourceFileInfo) {
      console.warn('[uc-ai-enhancer] Set either `sourceUuid` or `sourceFileInfo`, not both.');
    }
    // Namespace persisted history by pubkey before any hydration below (both can
    // land in the same update when the plugin sets pubkey and source together).
    if (changed.has('pubkey')) this._history.setNamespace(this.pubkey);
    if (sourceChanged) this._gen.reset();
    // Restore the strip for the current source's lineage from past sessions. Keyed
    // off the source uuid (from either input), so reopening on a previously edited
    // image rehydrates its results automatically.
    if (sourceChanged || changed.has('pubkey')) {
      this._gen.setHistory(this._history.lineage(this._sourceUuid));
    }
    // Re-resolve the input image's display URL once when its uuid or the
    // provider (CDN base) changed — covers both set in the same update.
    if (providerConfigChanged || sourceChanged) {
      this._resolveInputUrl();
    }
    // Resolve the source's file info: use the injected value, else fetch it from
    // the uuid. Gives the canvas the source's true aspect ratio before its image
    // decodes (no portrait crop), and feeds the output-filename resolver.
    if (providerConfigChanged || sourceChanged) {
      this._resolveSourceFileInfo();
    }
    // Default the ratio selection when the mode flips — edit defaults to
    // "Original" (omit aspect_ratio → backend preserves the source AR), generate
    // to the first standard ratio — and keep a concrete pick valid when the host
    // changes the available ratios.
    const mode = this._mode;
    if (mode !== this._lastMode) {
      this._lastMode = mode;
      this._selectedRatio = mode === 'edit' ? ORIGINAL_RATIO : this._defaultGenerateRatio();
    } else if (changed.has('aspectRatios')) {
      const sel = this._selectedRatio;
      if (isConcreteRatio(sel) && !this._standardRatios().some((r) => aspectRatioValueEquals(r, sel))) {
        this._selectedRatio = this._defaultGenerateRatio();
      }
    }
    // The ratio option set only depends on `aspectRatios`; drop the memo when it
    // changes so the picker child isn't handed a fresh array every render.
    if (changed.has('aspectRatios')) this._ratioOptionsCache.clear();
    // Resolve the active locale's strings (lazy-loads non-English built-ins, then
    // layers `localeDefinitionOverride[localeName]` on top).
    if (changed.has('localeName') || changed.has('localeDefinitionOverride')) {
      void this._resolveLocale();
    }
  }

  /** Load the active locale's built-in strings and layer its overrides on top. */
  private async _resolveLocale(): Promise<void> {
    const name = this.localeName || 'en';
    const token = ++this._localeToken;
    let base: Partial<typeof enLocale> = enLocale;
    if (name !== 'en') {
      try {
        base = (await LOCALE_LOADERS[name]?.()) ?? enLocale;
      } catch {
        base = enLocale;
      }
    }
    // A newer locale change superseded this async load — drop the stale result.
    if (token !== this._localeToken) return;
    const override = this.localeDefinitionOverride?.[name];
    this._localeStrings = override ? { ...base, ...override } : base;
  }

  private _l(key: keyof typeof enLocale): string {
    return translate(key, this._localeStrings);
  }

  /** Friendly message for the current failure: the per-`error_code` string
   *  (`ai-enhancer-error-<code>`, overridable via the locale) when one is
   *  defined, otherwise the generic error message. */
  private _errorMessage(): string {
    const code = this._gen.errorCode;
    if (code) {
      const key = `ai-enhancer-error-${code}` as AiEnhancerLocaleKey;
      const specific =
        (this._localeStrings as Record<string, string>)[key] ?? (enLocale as Record<string, string>)[key];
      if (specific) return specific;
    }
    return this._l('ai-enhancer-error');
  }

  /** The source image's uuid, from whichever input was given. */
  private get _sourceUuid(): string | null {
    return this.sourceUuid ?? this.sourceFileInfo?.uuid ?? null;
  }

  /** UUID of the image the editor is currently operating on, if any. */
  private get _currentSourceUuid(): string | null {
    return this._gen.result?.uuid ?? this._sourceUuid;
  }

  /**
   * Derived editor mode: `edit` whenever there is a current image (an input
   * source or a generation result), otherwise `generate`. This makes the first
   * successful generation flip the editor into edit mode for free.
   */
  private get _mode(): AiEditorMode {
    return this._currentSourceUuid ? 'edit' : 'generate';
  }

  /** Resolve the source uuid to a display URL via the provider's CDN base.
   *  No-op for a provider that can't resolve uuids (generate-only). */
  private _resolveInputUrl(): void {
    const uuid = this._sourceUuid;
    const provider = this._provider;
    if (!uuid || !provider?.resolveCdnUrl) {
      this._inputUrl = null;
      return;
    }
    void provider.resolveCdnUrl(uuid).then((url) => {
      // Guard against races: a later source/provider change wins.
      if (this._sourceUuid === uuid && this._provider === provider) this._inputUrl = url;
    });
  }

  /** Effective source info: the injected value, else the fetched fallback. */
  private get _effectiveSourceFileInfo(): UploadcareFile | undefined {
    return this.sourceFileInfo ?? this._fetchedFileInfo;
  }

  /** Resolve the source's file info — an injected {@link sourceFileInfo} wins;
   *  otherwise fetch it from {@link sourceUuid}. Failures fall back silently. */
  private _resolveSourceFileInfo(): void {
    this._fetchedFileInfo = undefined;
    // Injected info (or the plugin path) needs no fetch.
    if (this.sourceFileInfo) return;
    const uuid = this.sourceUuid;
    const provider = this._provider;
    if (!uuid || !provider?.getFileInfo) return;
    void provider.getFileInfo(uuid).then(
      (file) => {
        // Guard against races and a value injected meanwhile.
        if (this.sourceUuid === uuid && this._provider === provider && !this.sourceFileInfo) {
          this._fetchedFileInfo = file;
        }
      },
      () => {
        // Silent fallback: the canvas re-frames on image load instead.
      },
    );
  }

  private get _displayUrl(): string | null {
    return this._gen.resultUrl ?? this._inputUrl;
  }

  /**
   * Intrinsic ratio of the image currently on the canvas, from metadata when
   * known — the displayed result's file info, else the source's. Lets the canvas
   * frame correctly before the image decodes. `null` when unknown.
   */
  private _displayedNaturalRatio(): number | null {
    const info = this._gen.result?.file.imageInfo ?? this._effectiveSourceFileInfo?.imageInfo;
    if (info && info.width > 0 && info.height > 0) return info.width / info.height;
    return null;
  }

  /** Last non-null resolved preview, kept on screen while an async resolver runs. */
  private _lastPreviewUrl: string | null = null;

  /** CDN-optimized, secure-delivery-resolved rendition for the on-canvas preview. */
  private get _previewUrl(): string | null {
    const url = this._displayUrl;
    if (!url) {
      this._lastPreviewUrl = null;
      return null;
    }
    // The canvas spans the editor width; measured at render time (the result
    // arrives long after first layout). Fall back for detached renders.
    const resolved = this._secure.resolve(cdnPreviewUrl(url, this.clientWidth || 1024));
    // An async resolver returns `null` while pending; keep the previous preview
    // on screen (rather than blanking the canvas) until the new one resolves.
    if (resolved != null) this._lastPreviewUrl = resolved;
    return this._lastPreviewUrl;
  }

  /** Full-resolution rendition for fullscreen, secure-delivery-resolved. */
  private get _fullsizeUrl(): string | null {
    return this._secure.resolve(this._displayUrl);
  }

  /** The configured (or popular) standard ratios, validated. */
  private _standardRatios(): AspectRatio[] {
    // Fall back to the popular set when the host gave us nothing usable — an
    // empty or all-invalid `aspect-ratios` would otherwise hide the picker.
    const configured = (this.aspectRatios ?? []).filter(isValidAspectRatio);
    return configured.length > 0 ? configured : [...POPULAR_ASPECT_RATIOS];
  }

  /**
   * The ratio the generate flow starts on: the prototype's landscape default
   * ({@link DEFAULT_GENERATE_RATIO}) when it's in the available set, else the
   * first available ratio.
   */
  private _defaultGenerateRatio(): AspectRatio | null {
    const ratios = this._standardRatios();
    return ratios.find((r) => aspectRatioValueEquals(r, DEFAULT_GENERATE_RATIO)) ?? ratios[0] ?? null;
  }

  /**
   * Options for the ratio picker. In edit mode a leading "Original" entry
   * (preserve the source AR) is the default; standard ratios follow for
   * reshaping.
   */
  private readonly _ratioOptionsCache = new Map<AiEditorMode, AspectRatioOption[]>();

  private _ratioOptions(mode: AiEditorMode): AspectRatioOption[] {
    // Memoized by mode (invalidated in willUpdate when `aspectRatios` changes) so
    // the aspect-ratio child receives a stable array reference across renders.
    const cached = this._ratioOptionsCache.get(mode);
    if (cached) return cached;
    const standard = this._standardRatios().map(toAspectRatioOption);
    const options: AspectRatioOption[] =
      mode === 'edit' ? [{ value: ORIGINAL_RATIO, labelKey: 'ai-enhancer-aspect-original' }, ...standard] : standard;
    this._ratioOptionsCache.set(mode, options);
    return options;
  }

  private _labelForOption = (option: AspectRatioOption): string => {
    return option.labelKey ? this._l(option.labelKey) : '';
  };

  /**
   * Resolve the result's filename from {@link outputFilename}: a function gets
   * the source's original name + this generation's 1-based counter; a string is
   * used verbatim. Unset preserves the source's original name (`undefined` when
   * generating from scratch → the provider's default).
   */
  private _resolveOutputFilename(): string | undefined {
    const original = this._effectiveSourceFileInfo?.originalFilename || undefined;
    const out = this.outputFilename;
    if (typeof out === 'function') {
      // Counter is the 1-based position of this result in the lineage history.
      return out(original, this._gen.history.length + 1) || undefined;
    }
    if (typeof out === 'string') return out || undefined;
    return original;
  }

  /**
   * Resolve {@link metadata}: a static bag is used as-is; a callback is invoked
   * with the source file (only when one exists — a generate-from-scratch gets
   * none) and may be async. A throwing callback yields no metadata.
   */
  private async _resolveMetadata(): Promise<Metadata | undefined> {
    const meta = this.metadata;
    if (typeof meta !== 'function') return meta ?? undefined;
    const source = this._effectiveSourceFileInfo;
    if (!source) return undefined;
    try {
      return await meta(source);
    } catch {
      return undefined;
    }
  }

  private async _generate(): Promise<void> {
    const prompt = this._prompt.trim();
    const provider = this._provider;
    if (!prompt || !provider) return;
    const mode = this._mode;
    // The result's parent is whatever image is on the canvas now (an edit chains
    // off it; a generate has none). Captured before the run, since a produced
    // result becomes the new `_currentSourceUuid`.
    const parentUuid = mode === 'edit' ? this._currentSourceUuid : null;
    const metadata = await this._resolveMetadata();
    try {
      const result = await this._gen.run({
        provider,
        prompt,
        mode,
        // "Original" (and generate's null) omit the ratio; only a concrete pick
        // is sent — in edit that reshapes, otherwise the source AR is preserved.
        aspectRatio: isConcreteRatio(this._selectedRatio) ? this._selectedRatio : undefined,
        // Record the full selection (incl. "Original") so the history entry can
        // restore the picker when re-selected.
        ratioValue: this._selectedRatio,
        source: mode === 'edit' ? (this._currentSourceUuid ?? undefined) : undefined,
        // Name the result (resolver / static string / preserved source name).
        filename: this._resolveOutputFilename(),
        // Attach the configured metadata to the result, for both modes.
        metadata,
      });
      // Clear the prompt only on a produced result — a failed/aborted run keeps
      // the text so the user can retry or tweak it.
      if (result) {
        this._prompt = '';
        // Persist the result so its lineage survives a reload / activity unmount.
        this._history.record({
          uuid: result.uuid,
          source: parentUuid,
          url: result.url,
          prompt: result.prompt,
          mode: result.mode,
          ratio: this._selectedRatio,
          file: result.file,
        });
      }
    } catch (err) {
      this.dispatchEvent(new CustomEvent('uc:error', { detail: { error: err }, bubbles: true, composed: true }));
    }
  }

  /** Discard the current image (input or result) and prompt history, returning
   *  to a blank generate session. */
  private _onStartOver(): void {
    this.sourceUuid = null;
    this.sourceFileInfo = undefined;
    this._inputUrl = null;
    this._fetchedFileInfo = undefined;
    this._prompt = '';
    this._gen.reset();
    this._gen.clearHistory();
    // Return the dot grid to its empty state regardless of mid-reveal state.
    this._canvasEl?.resetGrid();
  }

  private _onPromptInput(e: CustomEvent<PromptInputDetail>): void {
    this._prompt = e.detail.value;
  }

  private _onSend(): void {
    void this._generate();
  }

  private _onSelectHistoryEntry(e: CustomEvent<HistorySelectDetail>): void {
    const { entry } = e.detail;
    this._prompt = entry.prompt;
    // Restore the ratio that produced this entry (incl. "Original"), so the
    // picker and canvas framing match the selected result.
    this._selectedRatio = entry.ratio;
    this._gen.setResult({
      url: entry.url,
      uuid: entry.file.uuid,
      prompt: entry.prompt,
      mode: entry.mode,
      file: entry.file,
    });
  }

  private _onSelectAspectRatio(e: CustomEvent<AspectRatioSelectDetail>): void {
    this._selectedRatio = e.detail.value;
  }

  private _onSelectPreset(e: CustomEvent<PresetSelectDetail>): void {
    this._prompt = e.detail.preset.prompt;
    // With no free-text prompt, the preset is the whole action — generate now.
    if (this.presetsOnly) {
      void this._generate();
      return;
    }
    // Otherwise a preset only fills the prompt — the user still presses send.
    queueMicrotask(() => this._promptRow?.focusInput());
  }

  private _onPrimary(): void {
    // The primary action commits the current generation result; it never
    // triggers generation (that's the prompt row's send button).
    const result = this._gen.result;
    if (!result) return;
    const detail: DoneDetail = {
      url: result.url,
      uuid: result.uuid,
      prompt: result.prompt,
      mode: result.mode,
      aspectRatio: isConcreteRatio(this._selectedRatio) ? this._selectedRatio : undefined,
      file: result.file,
    };
    this.dispatchEvent(new CustomEvent('uc:done', { detail, bubbles: true, composed: true }));
  }

  private _onCancel(e: Event): void {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('uc:cancel', { bubbles: true, composed: true }));
  }

  public override render(): TemplateResult {
    const mode = this._mode;
    // "Start over" discards the current image and returns to a blank generate
    // canvas, so it only makes sense for a generate session (edit mode reached
    // via a generation). When the editor was opened to edit an existing image
    // (a source set — e.g. the uploader's AI-edit action), there's nothing to
    // start over to, so it's hidden.
    const showStartOver = mode === 'edit' && !this.sourceUuid && !this.sourceFileInfo;
    const placeholderKey = MODES[mode].placeholderKey as keyof typeof enLocale;
    // Quick-prompt chips: the per-mode preset override if set, else the built-in set.
    const activePresets = this.presets?.[mode] ?? MODES[mode].presets;
    // The primary commits a generation result, so it's enabled only once one exists.
    const primaryDisabled = this._gen.busy || !this._gen.result;

    const ratioOptions = this._ratioOptions(mode);
    const hasImage = this._displayUrl != null;
    // A concrete pick sizes the frame (as width/height); "Original"/null lets
    // the canvas fall back to the displayed image's natural ratio.
    const frameRatio = isConcreteRatio(this._selectedRatio)
      ? this._selectedRatio[0] / this._selectedRatio[1]
      : null;
    const stageClasses = {
      stage: true,
      'is-empty': !hasImage,
    };

    // Two orthogonal public axes: which edge the composer sits on, and whether
    // the canvas fills the full area (composer overlays) or only the space left
    // by the composer (composer docked outside the image).
    const edge: 'top' | 'bottom' = COMPOSER_PLACEMENTS.includes(this.composerPlacement)
      ? this.composerPlacement
      : 'bottom';
    const canvasFit = CANVAS_FITS.includes(this.canvasFit) ? this.canvasFit : 'available';
    // `canvas-fit` alone decides overlay vs docked; auto-hide is orthogonal (an
    // overlay composer slides out to a peek, a docked one collapses its height to
    // a peek — see the stylesheet).
    const composerOverlay = canvasFit === 'full';
    const composerDocked = !composerOverlay;
    // Internal layout token, e.g. `overlay-bottom` / `docked-top` — keeps the
    // existing CSS class vocabulary.
    const layoutToken = `${composerOverlay ? 'overlay' : 'docked'}-${edge}`;

    const historyPlacement = HISTORY_PLACEMENTS.includes(this.historyPlacement)
      ? this.historyPlacement
      : 'composer-above';
    const historyRelative = historyPlacement === 'composer-above' || historyPlacement === 'composer-below';

    // The history strip rides inside the composer (so it moves with it) for an
    // OVERLAY composer, and for a DOCKED composer that auto-hides — otherwise the
    // pinned strip would stay at the canvas edge while the composer slides down to
    // its peek. A static docked composer keeps the strip pinned over the canvas.
    const historyInComposer = (composerOverlay || (composerDocked && this.composerAutoHide)) && historyRelative;
    const historyPinnedEdge =
      historyPlacement === 'canvas-top' ? 'top' : historyPlacement === 'canvas-bottom' ? 'bottom' : edge;

    // Only mount the strip when it has something to show (results, or the
    // "Start over" affordance); avoids a dead gap otherwise.
    const showHistory = this._gen.history.length > 0 || showStartOver;
    const historyTpl = showHistory
      ? html`
          <uc-ai-history
            .entries=${this._gen.history}
            .selectedUuid=${this._gen.result?.uuid ?? null}
            ?show-start-over=${showStartOver}
            start-over-label="${this._l('ai-enhancer-start-over')}"
            list-label="${this._l('ai-enhancer-history-title')}"
            .secureResolver=${this.secureDeliveryProxyUrlResolver}
            @uc:select=${this._onSelectHistoryEntry}
            @uc:start-over=${this._onStartOver}
          ></uc-ai-history>
        `
      : nothing;

    const promptRowTpl = html`
      <uc-ai-prompt-row
        .mode=${mode}
        .value=${this._prompt}
        .placeholder=${this._l(placeholderKey)}
        .busy=${this._gen.busy}
        .allowCustom=${!this.presetsOnly}
        send-aria-label="${this._l('ai-enhancer-generate-btn')}"
        @uc:input=${this._onPromptInput}
        @uc:send=${this._onSend}
      >
        ${
          activePresets.length > 0
            ? html`
              <uc-ai-chips
                slot="chips"
                .mode=${mode}
                .presets=${activePresets}
                .busy=${this._gen.busy}
                @uc:select=${this._onSelectPreset}
              ></uc-ai-chips>
            `
            : nothing
        }
        ${
          ratioOptions.length > 0
            ? html`
              <uc-ai-aspect-ratio
                slot="aspect-ratio"
                .options=${ratioOptions}
                .selected=${this._selectedRatio}
                .busy=${this._gen.busy}
                .labelFor=${this._labelForOption}
                aria-label-text="${this._l('ai-enhancer-aspect-ratio-aria')}"
                @uc:select=${this._onSelectAspectRatio}
              ></uc-ai-aspect-ratio>
            `
            : nothing
        }
      </uc-ai-prompt-row>
    `;

    // The composer wrapper. An overlay composer floats over the full canvas and
    // (for a relative history) carries the strip; a docked composer holds only
    // the prompt and sits outside the canvas (the canvas shrinks to fit it).
    const composerTpl = html`
      <div
        class=${classMap({
          composer: true,
          'composer--overlay': composerOverlay,
          'composer--docked': composerDocked,
          [`composer--${layoutToken}`]: true,
        })}
      >
        <div class="composer__content">
          ${historyInComposer && historyPlacement === 'composer-above' ? historyTpl : nothing}
          ${promptRowTpl}
          ${historyInComposer && historyPlacement === 'composer-below' ? historyTpl : nothing}
        </div>
      </div>
    `;

    // Pinned to a canvas edge — an absolute strip floating over the canvas,
    // independent of the composer (canvas placements, or a docked composer).
    const pinnedHistoryTpl =
      showHistory && !historyInComposer
        ? html`<div
            class=${classMap({
              'history-pinned': true,
              'history-pinned--docked': composerDocked,
              [`history-pinned--canvas-${historyPinnedEdge}`]: true,
            })}
          >
            ${historyTpl}
          </div>`
        : nothing;

    // Auto-hide ("dock") chrome for an OVERLAY composer: a pointer catch-strip
    // along its edge that raises it once it has slid out, plus a gradient overlay
    // that dissolves its trailing edge into the transparent toolbar. Both are
    // CSS-driven (via :has() — see the stylesheet). The fade is a separate overlay
    // (not a mask on the composer) so it doesn't clip the chips' shadows. A docked
    // composer auto-hides by collapsing in place, so it needs no chrome.
    const dockChrome =
      this.composerAutoHide && composerOverlay
        ? html`
            <div class=${classMap({ 'dock-hotzone': true, [`dock-hotzone--${edge}`]: true })}></div>
            <div class=${classMap({ 'composer-fade': true, [`composer-fade--${edge}`]: true })}></div>
          `
        : nothing;

    const toolbarTop = this.toolbarPlacement === 'top';
    const footerTpl = html`
      <uc-ai-footer
        cancel-label="${this._l('ai-enhancer-cancel')}"
        primary-label="${this._l('ai-enhancer-done-btn')}"
        ?primary-disabled=${primaryDisabled}
        @uc:cancel=${this._onCancel}
        @uc:primary=${this._onPrimary}
      ></uc-ai-footer>
    `;

    return html`
      <div
        class=${classMap({ shell: true, 'shell--has-image': hasImage })}
        role="region"
        aria-label="${this._l(mode === 'edit' ? 'ai-enhancer-edit-title' : 'ai-enhancer-generate-title')}"
      >
        ${toolbarTop ? footerTpl : nothing}
        ${composerDocked && edge === 'top' ? composerTpl : nothing}
        <div class=${classMap(stageClasses)}>
          <uc-ai-canvas
            .url=${this._previewUrl}
            .ratio=${frameRatio}
            .naturalRatio=${this._displayedNaturalRatio()}
            .fullsizeUrl=${this._fullsizeUrl}
            .shimmerConfig=${this.shimmerConfig}
            .busy=${this._gen.busy}
            .alt=${this._prompt}
            busy-label="${this._l('ai-enhancer-busy')}"
            error-label="${this._l('ai-enhancer-error')}"
            fullscreen-label="${this._l('ai-enhancer-fullscreen')}"
            exit-fullscreen-label="${this._l('ai-enhancer-exit-fullscreen')}"
          ></uc-ai-canvas>

          ${dockChrome}
          ${pinnedHistoryTpl}
          ${composerOverlay ? composerTpl : nothing}

          ${
            this._gen.error
              ? html`<div class="error-box" role="alert">
                  <div class="error-box__card">${this._errorMessage()}</div>
                </div>`
              : nothing
          }
        </div>
        ${composerDocked && edge === 'bottom' ? composerTpl : nothing}
        ${toolbarTop ? nothing : footerTpl}
      </div>
    `;
  }
}
