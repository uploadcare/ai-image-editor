import { html, LitElement, nothing, type PropertyValues, type TemplateResult, unsafeCSS } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';

import {
  type AspectRatio,
  type AspectRatioOption,
  aspectRatioEquals,
  isValidAspectRatio,
  POPULAR_ASPECT_RATIOS,
  parseAspectRatioList,
  toAspectRatioOption,
} from '../../../entities/aspect-ratio';
import {
  type AiCapability,
  type AiEditorMode,
  CAPABILITIES,
  CAPABILITIES_FOR_MODE,
} from '../../../entities/capability';
import { UploadcareDerivativeApi } from '../../../entities/provider';
import { GenerationController } from '../../../features/generation';
import { type enLocale, translate } from '../../../shared/i18n';
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
import styles from './ai-editor.css?inline';

export type { HistoryEntry } from '../../../features/generation';

export type DoneDetail = {
  url: string;
  prompt: string;
  capability: AiCapability;
  aspectRatio?: AspectRatio;
};

const CAPABILITIES_USING_ASPECT_RATIO: ReadonlySet<AiCapability> = new Set<AiCapability>(['generate']);

@customElement('uc-ai-editor')
export class UcAiEditor extends LitElement {
  public static override styles = unsafeCSS(styles);

  @property({ reflect: true })
  public mode: AiEditorMode = 'generate';

  @property()
  public src: string | null = null;

  @property({ reflect: true })
  public capability: AiCapability = 'generate';

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

  /**
   * Available aspect ratios for the generate flow. When set as an attribute
   * (`aspect-ratios="16:9 5:4 1:1"`), the string is parsed. Falsy / empty
   * input falls back to the popular set.
   */
  @property({ type: Array, attribute: 'aspect-ratios', converter: (v) => (v ? parseAspectRatioList(v) : null) })
  public aspectRatios: AspectRatio[] | null = null;

  @property({ attribute: 'l10n', type: Object })
  public l10nOverrides: Partial<typeof enLocale> = {};

  @state()
  private _prompt = '';

  @state()
  private _historyOpen = false;

  @state()
  private _selectedRatio: AspectRatio | null = null;

  @query('uc-ai-prompt-row')
  private _promptRow?: UcAiPromptRow;

  private readonly _gen = new GenerationController(this);
  private _provider?: UploadcareDerivativeApi;

  public override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('pubkey') || changed.has('baseUrl') || changed.has('cdnCname') || changed.has('cdnCnamePrefixed')) {
      this._provider = this.pubkey
        ? new UploadcareDerivativeApi({
            publicKey: this.pubkey,
            baseUrl: this.baseUrl,
            cdnBaseUrl: this.cdnCname,
            cdnCnamePrefixed: this.cdnCnamePrefixed,
          })
        : undefined;
    }
    if (changed.has('mode')) {
      const allowed = CAPABILITIES_FOR_MODE[this.mode];
      if (!allowed.includes(this.capability)) {
        this.capability = allowed[0] ?? 'generate';
      }
    }
    if (changed.has('src')) {
      this._gen.reset();
    }
    if (changed.has('aspectRatios') || this._selectedRatio === null) {
      const options = this._aspectRatioOptions();
      if (options.length === 0) {
        this._selectedRatio = null;
      } else {
        const current = this._selectedRatio;
        const stillValid = current ? options.some((o) => aspectRatioEquals(o.ratio, current)) : false;
        if (!stillValid) this._selectedRatio = options[0]?.ratio ?? null;
      }
    }
  }

  private _l(key: keyof typeof enLocale): string {
    return translate(key, this.l10nOverrides);
  }

  private get _displayUrl(): string | null {
    return this._gen.resultUrl ?? this.src;
  }

  private _aspectRatioOptions(): AspectRatioOption[] {
    const list = this.aspectRatios && this.aspectRatios.length > 0 ? this.aspectRatios : POPULAR_ASPECT_RATIOS;
    return list.filter(isValidAspectRatio).map(toAspectRatioOption);
  }

  private _labelForOption = (option: AspectRatioOption): string => {
    return option.labelKey ? this._l(option.labelKey) : '';
  };

  private async _generate(): Promise<void> {
    const prompt = this._prompt.trim();
    const provider = this._provider;
    if (!prompt || !provider) return;
    const useRatio = CAPABILITIES_USING_ASPECT_RATIO.has(this.capability);
    try {
      await this._gen.run({
        provider,
        prompt,
        capability: this.capability,
        aspectRatio: useRatio && this._selectedRatio ? this._selectedRatio : undefined,
        sourceUrl: this._gen.resultUrl ?? this.src ?? undefined,
      });
    } catch (err) {
      this.dispatchEvent(new CustomEvent('uc:error', { detail: { error: err }, bubbles: true, composed: true }));
    }
  }

  private _onPromptInput(e: CustomEvent<PromptInputDetail>): void {
    this._prompt = e.detail.value;
  }

  private _onSend(): void {
    void this._generate();
  }

  private _onToggleHistory(): void {
    this._historyOpen = !this._historyOpen;
  }

  private _onSelectHistoryEntry(e: CustomEvent<HistorySelectDetail>): void {
    const { entry } = e.detail;
    this._prompt = entry.prompt;
    this.capability = entry.capability;
    this._gen.setResult(entry.url);
    this._historyOpen = false;
  }

  private _onCloseHistory(): void {
    this._historyOpen = false;
  }

  private _onSelectAspectRatio(e: CustomEvent<AspectRatioSelectDetail>): void {
    this._selectedRatio = e.detail.ratio;
  }

  private _onSelectTemplate(e: CustomEvent<TemplateSelectDetail>): void {
    const { template } = e.detail;
    this.capability = template.capability;
    this._prompt = template.prompt;
    if (template.prompt && this.mode === 'edit') {
      void this._generate();
    } else {
      queueMicrotask(() => this._promptRow?.focusInput());
    }
  }

  private _onPrimary(): void {
    if (this.mode === 'edit') {
      const url = this._displayUrl;
      if (!url) return;
      const detail: DoneDetail = {
        url,
        prompt: this._prompt,
        capability: this.capability,
        aspectRatio:
          CAPABILITIES_USING_ASPECT_RATIO.has(this.capability) && this._selectedRatio ? this._selectedRatio : undefined,
      };
      this.dispatchEvent(new CustomEvent('uc:done', { detail, bubbles: true, composed: true }));
    } else {
      void this._generate();
    }
  }

  private _onCancel(e: Event): void {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('uc:cancel', { bubbles: true, composed: true }));
  }

  public override render(): TemplateResult {
    const placeholderKey = CAPABILITIES[this.capability].placeholderKey as keyof typeof enLocale;
    const primaryLabelKey = this.mode === 'edit' ? 'ai-enhancer-done-btn' : 'ai-enhancer-generate-btn';
    const primaryDisabled =
      this.mode === 'edit' ? this._gen.busy || !this._displayUrl : this._gen.busy || !this._prompt.trim();

    const showAspectRatio = this.mode === 'generate' && CAPABILITIES_USING_ASPECT_RATIO.has(this.capability);
    const ratioOptions = showAspectRatio ? this._aspectRatioOptions() : [];

    return html`
      <div
        class="shell"
        role="region"
        aria-label="${this._l(this.mode === 'edit' ? 'ai-enhancer-edit-title' : 'ai-enhancer-generate-title')}"
      >
        <div class="body">
          <div class="body-inner">
            <uc-ai-canvas
              .url=${this._displayUrl}
              .busy=${this._gen.busy}
              .alt=${this._prompt}
              busy-label="${this._l('ai-enhancer-busy')}"
              error-label="${this._l('ai-enhancer-error')}"
            ></uc-ai-canvas>
            ${this._gen.error ? html`<div class="error-banner" role="alert">${this._gen.error}</div>` : nothing}
            <div class="bottom">
            <div class="history-wrap">
              <uc-ai-prompt-row
                .mode=${this.mode}
                .value=${this._prompt}
                .placeholder=${this._l(placeholderKey)}
                .busy=${this._gen.busy}
                ?history-open=${this._historyOpen}
                history-aria-label="${this._l('ai-enhancer-history-title')}"
                send-aria-label="${this._l('ai-enhancer-generate-btn')}"
                @uc:input=${this._onPromptInput}
                @uc:send=${this._onSend}
                @uc:toggle-history=${this._onToggleHistory}
              >
                ${
                  showAspectRatio && ratioOptions.length > 0
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
              <uc-ai-history-popover
                ?open=${this._historyOpen}
                .entries=${this._gen.history}
                empty-label="${this._l('ai-enhancer-history-empty')}"
                @uc:select=${this._onSelectHistoryEntry}
                @uc:close=${this._onCloseHistory}
              ></uc-ai-history-popover>
            </div>
            <uc-ai-chips
              .mode=${this.mode}
              .capability=${this.capability}
              .prompt=${this._prompt}
              .busy=${this._gen.busy}
              @uc:select=${this._onSelectTemplate}
            ></uc-ai-chips>
            </div>
          </div>
        </div>
        <uc-ai-footer
          cancel-label="${this._l('ai-enhancer-cancel')}"
          primary-label="${this._l(primaryLabelKey)}"
          ?primary-disabled=${primaryDisabled}
          @uc:cancel=${this._onCancel}
          @uc:primary=${this._onPrimary}
        ></uc-ai-footer>
      </div>
    `;
  }
}
