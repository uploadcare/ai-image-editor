import type { UploadcareFile } from '@uploadcare/upload-client';
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
import { type AiEditorMode, MODES } from '../../../entities/mode';
import { UploadcareDerivativeApi } from '../../../entities/provider';
import { GenerationController } from '../../../features/generation';
import { type AiEnhancerLocaleKey, enLocale, translate } from '../../../shared/i18n';
import { cdnPreviewUrl } from '../../../shared/lib/cdn';
import { SecureUrlController } from '../../../shared/lib/SecureUrlController';
import type { SecureDeliveryProxyUrlResolver } from '../../../shared/lib/secureDelivery';
import '../../../features/aspect-ratio-select';
import '../../../features/prompt-history';
import '../../../features/prompt-input';
import '../../../features/template-chips';
import '../../../shared/ui/canvas';
import '../../../shared/ui/footer';
import type { AspectRatioSelectDetail } from '../../../features/aspect-ratio-select';
import type { HistorySelectDetail } from '../../../features/prompt-history';
import type { PromptInputDetail, UcAiPromptRow } from '../../../features/prompt-input';
import type { TemplateSelectDetail } from '../../../features/template-chips';
import type { UcAiCanvas } from '../../../shared/ui/canvas';
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

@customElement('uc-ai-editor')
export class UcAiEditor extends LitElement {
  public static override styles = unsafeCSS(styles);

  /**
   * UUID of an image to edit. When set, the editor opens straight in edit mode;
   * when absent, it starts in generate mode. The mode is otherwise derived (see
   * {@link _mode}) — there is no explicit mode property.
   */
  @property()
  public source: string | null = null;

  /** Uploadcare public key. Required to enable generate/edit. */
  @property()
  public pubkey = '';

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

  @property({ attribute: 'l10n', type: Object })
  public l10nOverrides: Partial<typeof enLocale> = {};

  /**
   * Presets-only mode: hides the free-text prompt so only the preset chips
   * remain, and selecting a preset starts the generation immediately (there's
   * nothing to type, so no separate send step). Off by default.
   */
  @property({ type: Boolean, attribute: 'presets-only' })
  public presetsOnly = false;

  @state()
  private _prompt = '';

  @state()
  private _selectedRatio: AspectRatioValue | null = null;

  /** Display URL for {@link source}, resolved via the provider's CDN base. */
  @state()
  private _inputUrl: string | null = null;

  /** Last derived mode, to (re)default the ratio selection when it flips. */
  private _lastMode?: AiEditorMode;

  @query('uc-ai-prompt-row')
  private _promptRow?: UcAiPromptRow;

  @query('.stage')
  private _stageEl?: HTMLElement;

  @query('.composer')
  private _composerEl?: HTMLElement;

  @query('uc-ai-canvas')
  private _canvasEl?: UcAiCanvas;

  /** Keeps the canvas viewport's reserved bottom space synced to the composer. */
  private _composerObserver?: ResizeObserver;

  private readonly _gen = new GenerationController(this);
  private readonly _secure = new SecureUrlController(this);
  private _provider?: UploadcareDerivativeApi;

  public override willUpdate(changed: PropertyValues<this>): void {
    const providerConfigChanged =
      changed.has('pubkey') || changed.has('baseUrl') || changed.has('cdnCname') || changed.has('cdnCnamePrefixed');
    if (providerConfigChanged) {
      this._provider = this.pubkey
        ? new UploadcareDerivativeApi({
            publicKey: this.pubkey,
            baseUrl: this.baseUrl,
            cdnBaseUrl: this.cdnCname,
            cdnCnamePrefixed: this.cdnCnamePrefixed,
          })
        : undefined;
    }
    if (changed.has('secureDeliveryProxyUrlResolver')) {
      this._secure.setResolver(this.secureDeliveryProxyUrlResolver);
    }
    if (changed.has('source')) {
      this._gen.reset();
    }
    // Re-resolve the input image's display URL once when its uuid or the
    // provider (CDN base) changed — covers both set in the same update.
    if (providerConfigChanged || changed.has('source')) {
      this._resolveInputUrl();
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
  }

  protected override firstUpdated(): void {
    // Reserve room in the canvas viewport for the floating composer, so the
    // image frame sits above it. Tracks the composer's live height (which grows
    // with the history strip / multi-line prompt).
    if (typeof ResizeObserver === 'function' && this._composerEl) {
      this._composerObserver = new ResizeObserver(() => this._scheduleComposerSpace());
      this._composerObserver.observe(this._composerEl);
    }
    this._syncComposerSpace();
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._composerObserver?.disconnect();
    if (this._composerSpaceRaf) cancelAnimationFrame(this._composerSpaceRaf);
    this._composerSpaceRaf = 0;
  }

  private _composerSpaceRaf = 0;

  /** Coalesce composer-resize notifications (typing grows the textarea) into one
   *  rAF write, so we don't read+write layout synchronously on every keystroke. */
  private _scheduleComposerSpace(): void {
    if (this._composerSpaceRaf) return;
    this._composerSpaceRaf = requestAnimationFrame(() => {
      this._composerSpaceRaf = 0;
      this._syncComposerSpace();
    });
  }

  /** Bottom anchor (20px) + composer height + a 16px breathing gap. */
  private _syncComposerSpace(): void {
    const composer = this._composerEl;
    const stage = this._stageEl;
    if (!composer || !stage) return;
    stage.style.setProperty('--uc-ai-composer-space', `${20 + composer.offsetHeight + 16}px`);
  }

  private _l(key: keyof typeof enLocale): string {
    return translate(key, this.l10nOverrides);
  }

  /** Friendly message for the current failure: the per-`error_code` string
   *  (`ai-enhancer-error-<code>`, overridable via `l10n`) when one is defined,
   *  otherwise the generic error message. */
  private _errorMessage(): string {
    const code = this._gen.errorCode;
    if (code) {
      const key = `ai-enhancer-error-${code}` as AiEnhancerLocaleKey;
      const specific = this.l10nOverrides[key] ?? (enLocale as Record<string, string>)[key];
      if (specific) return specific;
    }
    return this._l('ai-enhancer-error');
  }

  /** UUID of the image the editor is currently operating on, if any. */
  private get _currentSourceUuid(): string | null {
    return this._gen.result?.uuid ?? this.source;
  }

  /**
   * Derived editor mode: `edit` whenever there is a current image (an input
   * `source` or a generation result), otherwise `generate`. This makes the
   * first successful generation flip the editor into edit mode for free.
   */
  private get _mode(): AiEditorMode {
    return this._currentSourceUuid ? 'edit' : 'generate';
  }

  /** Resolve {@link source} to a display URL via the provider's CDN base. */
  private _resolveInputUrl(): void {
    const uuid = this.source;
    const provider = this._provider;
    if (!uuid || !provider) {
      this._inputUrl = null;
      return;
    }
    void provider.resolveCdnUrl(uuid).then((url) => {
      // Guard against races: a later source/provider change wins.
      if (this.source === uuid && this._provider === provider) this._inputUrl = url;
    });
  }

  private get _displayUrl(): string | null {
    return this._gen.resultUrl ?? this._inputUrl;
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

  private async _generate(): Promise<void> {
    const prompt = this._prompt.trim();
    const provider = this._provider;
    if (!prompt || !provider) return;
    const mode = this._mode;
    try {
      const result = await this._gen.run({
        provider,
        prompt,
        mode,
        // "Original" (and generate's null) omit the ratio; only a concrete pick
        // is sent — in edit that reshapes, otherwise the source AR is preserved.
        aspectRatio: isConcreteRatio(this._selectedRatio) ? this._selectedRatio : undefined,
        source: mode === 'edit' ? (this._currentSourceUuid ?? undefined) : undefined,
      });
      // Clear the prompt only on a produced result — a failed/aborted run keeps
      // the text so the user can retry or tweak it.
      if (result) this._prompt = '';
    } catch (err) {
      this.dispatchEvent(new CustomEvent('uc:error', { detail: { error: err }, bubbles: true, composed: true }));
    }
  }

  /** Discard the current image (input or result) and return to generate mode. */
  private _onStartOver(): void {
    this.source = null;
    this._inputUrl = null;
    this._prompt = '';
    this._gen.reset();
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

  private _onSelectTemplate(e: CustomEvent<TemplateSelectDetail>): void {
    this._prompt = e.detail.template.prompt;
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
    const placeholderKey = MODES[mode].placeholderKey as keyof typeof enLocale;
    // The primary commits a generation result, so it's enabled only once one exists.
    const primaryDisabled = this._gen.busy || !this._gen.result;

    const ratioOptions = this._ratioOptions(mode);
    const hasImage = this._displayUrl != null;
    // A concrete pick sizes the frame (as width/height); "Original"/null lets
    // the canvas fall back to the displayed image's natural ratio.
    const frameRatio = isConcreteRatio(this._selectedRatio)
      ? this._selectedRatio[0] / this._selectedRatio[1]
      : null;
    const stageClasses = { stage: true, 'is-empty': !hasImage };

    return html`
      <div
        class="shell"
        role="region"
        aria-label="${this._l(mode === 'edit' ? 'ai-enhancer-edit-title' : 'ai-enhancer-generate-title')}"
      >
        <div class=${classMap(stageClasses)}>
          <uc-ai-canvas
            .url=${this._previewUrl}
            .ratio=${frameRatio}
            .fullsizeUrl=${this._fullsizeUrl}
            .busy=${this._gen.busy}
            .alt=${this._prompt}
            busy-label="${this._l('ai-enhancer-busy')}"
            error-label="${this._l('ai-enhancer-error')}"
            fullscreen-label="${this._l('ai-enhancer-fullscreen')}"
            exit-fullscreen-label="${this._l('ai-enhancer-exit-fullscreen')}"
          ></uc-ai-canvas>

          <div class="composer">
            ${
              // Only mount the strip when it has something to show (results, or
              // the edit-mode "Start over"); avoids a dead gap in generate mode.
              this._gen.history.length > 0 || mode === 'edit'
                ? html`
                  <uc-ai-history
                    .entries=${this._gen.history}
                    .selectedUuid=${this._gen.result?.uuid ?? null}
                    ?show-start-over=${mode === 'edit'}
                    start-over-label="${this._l('ai-enhancer-start-over')}"
                    list-label="${this._l('ai-enhancer-history-title')}"
                    .secureResolver=${this.secureDeliveryProxyUrlResolver}
                    @uc:select=${this._onSelectHistoryEntry}
                    @uc:start-over=${this._onStartOver}
                  ></uc-ai-history>
                `
                : nothing
            }

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
              <uc-ai-chips
                slot="chips"
                .mode=${mode}
                .busy=${this._gen.busy}
                @uc:select=${this._onSelectTemplate}
              ></uc-ai-chips>
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
          </div>

          ${
            this._gen.error
              ? html`<div class="error-box" role="alert">
                  <div class="error-box__card">${this._errorMessage()}</div>
                </div>`
              : nothing
          }
        </div>

        <uc-ai-footer
          cancel-label="${this._l('ai-enhancer-cancel')}"
          primary-label="${this._l('ai-enhancer-done-btn')}"
          ?primary-disabled=${primaryDisabled}
          @uc:cancel=${this._onCancel}
          @uc:primary=${this._onPrimary}
        ></uc-ai-footer>
      </div>
    `;
  }
}
