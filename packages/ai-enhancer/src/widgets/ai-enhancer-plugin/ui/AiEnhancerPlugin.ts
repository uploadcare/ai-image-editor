import type { UploaderPlugin } from '@uploadcare/file-uploader';
import type { Metadata } from '@uploadcare/upload-client';
import { type AspectRatio, isValidAspectRatio, POPULAR_ASPECT_RATIOS } from '../../../entities/aspect-ratio';
import { type AiEnhancerLocale, enLocale, LOCALE_LOADERS } from '../../../shared/i18n';
import { ICON_EDIT_AI, ICON_GENERATE } from '../../../shared/ui/icons';
import type { DoneDetail, UcAiEditor } from '../../ai-editor';
import { parseCropPreset } from '../lib/parseCropPreset';

import '../../ai-editor';

// One shared id for the plugin, its source, file action, and activity. They live
// in separate registries, so reusing the same value is safe and keeps them aligned.
const AI_ENHANCER_ID = 'ai-enhancer';

/**
 * Pipes the file-uploader's theme tokens (`--uc-*`) into the AI editor's
 * (`--uc-ai-*`) so the editor follows whatever theme the uploader resolved
 * (system preference, `.uc-light` / `.uc-dark`, or consumer overrides).
 */
const UPLOADER_TOKEN_MAP: ReadonlyArray<readonly [aiToken: string, ucToken: string]> = [
  ['--uc-ai-foreground', '--uc-foreground'],
  ['--uc-ai-background', '--uc-background'],
  // `--uc-ai-floating` / `--uc-ai-floating-border` are intentionally NOT mapped:
  // the uploader doesn't define those tokens, so mapping them to `var(--uc-floating)`
  // would resolve to an invalid value and blank out every floating panel. Their
  // CSS defaults already prefer `--uc-floating(-border)` when a host provides them.
  ['--uc-ai-muted', '--uc-muted'],
  ['--uc-ai-muted-foreground', '--uc-muted-foreground'],
  ['--uc-ai-primary', '--uc-primary'],
  ['--uc-ai-primary-hover', '--uc-primary-hover'],
  ['--uc-ai-primary-foreground', '--uc-primary-foreground'],
  ['--uc-ai-primary-transparent', '--uc-primary-transparent'],
  ['--uc-ai-secondary', '--uc-secondary'],
  ['--uc-ai-secondary-hover', '--uc-secondary-hover'],
  ['--uc-ai-secondary-foreground', '--uc-secondary-foreground'],
  ['--uc-ai-border', '--uc-border'],
  ['--uc-ai-destructive', '--uc-destructive'],
  ['--uc-ai-dialog-shadow', '--uc-dialog-shadow'],
  ['--uc-ai-radius', '--uc-radius'],
  ['--uc-ai-padding', '--uc-padding'],
  ['--uc-ai-button-size', '--uc-button-size'],
  ['--uc-ai-font-family', '--uc-font-family'],
  ['--uc-ai-font-size', '--uc-font-size'],
  ['--uc-ai-transition', '--uc-transition'],
];

function applyUploaderTheme(editor: HTMLElement): void {
  for (const [aiToken, ucToken] of UPLOADER_TOKEN_MAP) {
    editor.style.setProperty(aiToken, `var(${ucToken})`);
  }
}

const ACTIVITY_SIZE_STYLE_ID = 'uc-ai-enhancer-activity-size';

/**
 * Let the AI editor activity fill the uploader modal, mirroring how the uploader's
 * own large activities (cloud-image-edit, camera, external) size themselves: a
 * global rule matching the dialog that contains the active `ai-enhancer` activity.
 * The uploader renders in light DOM, so this document-level rule reaches its modal.
 * Scoped to this activity only — other activities and the inline uploader keep
 * their default size.
 */
function ensureActivityModalSize(): void {
  if (typeof document === 'undefined' || document.getElementById(ACTIVITY_SIZE_STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = ACTIVITY_SIZE_STYLE_ID;
  // The `:not(#\#)` pairs replicate the uploader's own specificity hack so this
  // rule outranks the base `> dialog` width/height rules (matching how
  // cloud-image-edit / camera / external size their modal).
  style.textContent = [
    `[uc-modal]:not(#\\#) > dialog:has([activity="${AI_ENHANCER_ID}"][active]) {`,
    '  width: 100%;',
    '  height: 100%;',
    '}',
  ].join('\n');
  document.head.appendChild(style);
}

export type AiEditorActivityParams = {
  /**
   * `internalId` of the collection entry being edited. Absent → the editor opens
   * in generate mode. When present, the source image's UUID is read from this
   * entry, and `uc:done` replaces it in place instead of adding a new one.
   */
  sourceInternalId?: string;
};

/**
 * Register the plugin's custom activity with the file-uploader's type system so
 * `setCurrentActivity(AI_ENHANCER_ID, params)` is type-checked instead of cast.
 */
declare module '@uploadcare/file-uploader' {
  interface CustomActivities {
    [AI_ENHANCER_ID]: { params: AiEditorActivityParams };
  }
}

/**
 * Translate the uploader's cropPreset config into the aspect-ratio list the AI
 * editor should offer. Returns null when the host gave us no usable input, so
 * the editor falls back to its built-in popular set.
 */
export function aspectRatiosFromCropPreset(cropPreset: string): AspectRatio[] | null {
  const parsed = parseCropPreset(cropPreset);
  if (parsed.length === 0) return null;

  const hasFreeform = parsed.some((p) => p.hasFreeform);
  const ratios = parsed
    .filter((p) => !p.hasFreeform)
    .map((p) => [p.width, p.height] as AspectRatio)
    .filter(isValidAspectRatio);

  if (hasFreeform && ratios.length === 0) {
    return [...POPULAR_ASPECT_RATIOS];
  }
  if (hasFreeform) {
    return ratios;
  }
  return ratios.length > 0 ? ratios : null;
}

export const AiEnhancerPlugin: UploaderPlugin = {
  id: AI_ENHANCER_ID,
  setup: ({ pluginApi, uploaderApi }) => {
    const { registry, config } = pluginApi;

    ensureActivityModalSize();

    registry.registerIcon({ name: 'ai-generate', svg: ICON_GENERATE });
    registry.registerIcon({ name: 'ai-edit', svg: ICON_EDIT_AI });

    // English is the always-present synchronous fallback; every other locale
    // loads lazily and is registered with the uploader on demand.
    registry.registerL10n({ en: enLocale });

    const localeCache = new Map<string, AiEnhancerLocale>([['en', enLocale]]);
    const registeredLocales = new Set<string>(['en']);

    const loadLocale = async (localeName: string): Promise<AiEnhancerLocale | null> => {
      const name = localeName || 'en';
      const cached = localeCache.get(name);
      if (cached) return cached;
      const loader = LOCALE_LOADERS[name];
      if (!loader) return null;
      const strings = await loader();
      localeCache.set(name, strings);
      return strings;
    };

    /**
     * Lazy-load the active locale's strings and register them with the uploader
     * so the uploader-rendered source / file-action labels follow `localeName`.
     */
    const syncLocaleToUploader = async (localeName: string): Promise<void> => {
      const name = localeName || 'en';
      if (registeredLocales.has(name)) return;
      const strings = await loadLocale(name);
      if (!strings) return;
      registeredLocales.add(name);
      registry.registerL10n({ [name]: strings });
    };

    void syncLocaleToUploader(config.get('localeName'));
    config.subscribe('localeName', (value) => {
      void syncLocaleToUploader(value);
    });

    registry.registerSource({
      id: AI_ENHANCER_ID,
      label: 'ai-enhancer-source-label',
      icon: 'ai-generate',
      onSelect: () => {
        // No source → the editor opens in generate mode.
        uploaderApi.setCurrentActivity(AI_ENHANCER_ID, {});
        uploaderApi.setModalState(true);
      },
    });

    // The AI-edit file-action: edit an already-uploaded image. Passing its UUID
    // as `source` opens the editor straight in edit mode.
    registry.registerFileAction({
      id: AI_ENHANCER_ID,
      icon: 'ai-edit',
      label: 'ai-enhancer-file-action-label',
      shouldRender: (fileEntry) => Boolean(fileEntry.isImage && fileEntry.uuid),
      onClick: (fileEntry) => {
        uploaderApi.setCurrentActivity(AI_ENHANCER_ID, { sourceInternalId: fileEntry.internalId });
        uploaderApi.setModalState(true);
      },
    });

    registry.registerActivity({
      id: AI_ENHANCER_ID,
      render: (host, activityParams) => {
        if (!config.get('pubkey')) {
          console.warn('[ai-enhancer] No `pubkey` configured; the AI editor is disabled.');
          return () => {};
        }

        const params = (activityParams ?? {}) as AiEditorActivityParams;
        const editor = document.createElement('uc-ai-editor') as UcAiEditor;
        // Edit mode: resolve the source image's collection entry, so the edit
        // opens on that image. We hand the editor the entry's `fileInfo` it
        // already holds, so the editor skips its own lookup and can frame the
        // canvas to the source's true aspect ratio from the first paint (and
        // name the result after the original). (Falls back to generate mode if
        // the entry is gone.)
        if (params.sourceInternalId) {
          try {
            const sourceItem = uploaderApi.getOutputItem(params.sourceInternalId);
            editor.source = sourceItem.uuid;
            editor.sourceFileInfo = sourceItem.fileInfo ?? undefined;
          } catch {
            // Entry no longer exists — leave `editor.source` unset (generate mode).
          }
        }
        applyUploaderTheme(editor);

        const refreshProviderConfig = () => {
          editor.pubkey = config.get('pubkey');
          editor.baseUrl = config.get('baseUrl');
          editor.cdnCname = config.get('cdnCname');
          editor.cdnCnamePrefixed = config.get('cdnCnamePrefixed');
          // Inherit the uploader's secure-delivery resolver so the editor's
          // rendered CDN urls are signed the same way.
          editor.secureDeliveryProxyUrlResolver = config.get('secureDeliveryProxyUrlResolver') ?? undefined;
        };
        refreshProviderConfig();

        // Forward the uploader's `metadata` config so the AI result carries the
        // same metadata as a regular upload. The config is either a static bag or
        // a per-file `(entry) => Metadata` callback. For a callback we resolve it
        // against the source entry being edited; a generate has no input file, so
        // the callback can't run and metadata is left unset for that case.
        const resolveConfigMetadata = async (): Promise<Metadata | undefined> => {
          const meta = config.get('metadata');
          if (!meta) return undefined;
          if (typeof meta !== 'function') return meta;
          if (!params.sourceInternalId) return undefined;
          try {
            return await meta(uploaderApi.getOutputItem(params.sourceInternalId));
          } catch {
            // Source entry gone, or the callback threw — fall back to no metadata.
            return undefined;
          }
        };
        // The callback form may be async, so the assignment lands a microtask
        // later; a token drops a stale resolution if `metadata` changes meanwhile.
        let metadataToken = 0;
        const refreshMetadata = () => {
          const token = ++metadataToken;
          void resolveConfigMetadata().then((meta) => {
            if (token === metadataToken) editor.metadata = meta;
          });
        };
        refreshMetadata();

        // The editor owns locale loading + overrides; pass the uploader's
        // `localeName` and (locale-keyed) `localeDefinitionOverride` straight through.
        const refreshLocale = () => {
          editor.localeName = config.get('localeName') || 'en';
          editor.localeDefinitionOverride =
            (config.get('localeDefinitionOverride') as Record<string, Partial<AiEnhancerLocale>>) ?? {};
        };
        refreshLocale();

        const ratios = aspectRatiosFromCropPreset(config.get('cropPreset') ?? '');
        if (ratios) editor.aspectRatios = ratios;

        const unsubscribers = [
          config.subscribe('pubkey', refreshProviderConfig),
          config.subscribe('baseUrl', refreshProviderConfig),
          config.subscribe('cdnCname', refreshProviderConfig),
          config.subscribe('cdnCnamePrefixed', refreshProviderConfig),
          config.subscribe('secureDeliveryProxyUrlResolver', refreshProviderConfig),
          config.subscribe('metadata', refreshMetadata),
          config.subscribe('localeName', refreshLocale),
          config.subscribe('localeDefinitionOverride', refreshLocale),
          config.subscribe('cropPreset', (value) => {
            editor.aspectRatios = aspectRatiosFromCropPreset(value ?? '');
          }),
        ];

        const onDone = (e: Event) => {
          const { file } = (e as CustomEvent<DoneDetail>).detail;
          // The result is already stored on Uploadcare — hand the full file
          // object over so the uploader takes it in `success` state without
          // re-fetching file info (needs file-uploader >= 1.32.0-alpha.0).
          // Edit mode replaces the source entry in place (keeping its list
          // position); generate mode adds a new entry. Either way the file is
          // sourced to the AI enhancer.
          if (params.sourceInternalId) {
            try {
              // The edited result already carries the source file's name (the
              // editor names it after the source's `fileInfo` by default), so a
              // plain replace preserves it.
              uploaderApi.replaceFileFromUploadcareFile(params.sourceInternalId, file, { source: AI_ENHANCER_ID });
            } catch {
              // The source entry is gone (e.g. removed while editing) — fall back to adding.
              uploaderApi.addFileFromUploadcareFile(file, { source: AI_ENHANCER_ID });
            }
          } else {
            uploaderApi.addFileFromUploadcareFile(file, { source: AI_ENHANCER_ID });
          }
          uploaderApi.setCurrentActivity('upload-list');
          uploaderApi.setModalState(true);
        };

        const onCancel = () => {
          uploaderApi.setCurrentActivity('upload-list');
          uploaderApi.setModalState(true);
        };

        editor.addEventListener('uc:done', onDone);
        editor.addEventListener('uc:cancel', onCancel);
        host.replaceChildren(editor);

        return () => {
          editor.removeEventListener('uc:done', onDone);
          editor.removeEventListener('uc:cancel', onCancel);
          for (const unsub of unsubscribers) unsub();
          host.replaceChildren();
        };
      },
    });
  },
};
