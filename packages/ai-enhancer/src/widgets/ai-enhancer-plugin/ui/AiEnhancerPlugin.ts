import type { UploaderPlugin } from '@uploadcare/file-uploader';
import { type AspectRatio, isValidAspectRatio, POPULAR_ASPECT_RATIOS } from '../../../entities/aspect-ratio';
import {
  type AiProvider,
  createUploadcareGenerateProvider,
  mockBflProvider,
} from '../../../entities/provider';
import { enLocale } from '../../../shared/i18n';
import { ICON_EDIT_AI, ICON_GENERATE } from '../../../shared/ui/icons';
import type { DoneDetail, UcAiEditor } from '../../ai-editor';
import { parseCropPreset } from '../lib/parseCropPreset';

import '../../ai-editor';

const PLUGIN_ID = 'ai-enhancer';
const SOURCE_ID = 'ai-generate';
const FILE_ACTION_ID = 'ai-edit';
const ACTIVITY_ID = 'ai-editor' as const;

/**
 * Pipes the file-uploader's theme tokens (`--uc-*`) into the AI editor's
 * (`--uc-ai-*`) so the editor follows whatever theme the uploader resolved
 * (system preference, `.uc-light` / `.uc-dark`, or consumer overrides).
 */
const UPLOADER_TOKEN_MAP: ReadonlyArray<readonly [aiToken: string, ucToken: string]> = [
  ['--uc-ai-foreground', '--uc-foreground'],
  ['--uc-ai-background', '--uc-background'],
  ['--uc-ai-muted', '--uc-muted'],
  ['--uc-ai-muted-foreground', '--uc-muted-foreground'],
  ['--uc-ai-primary', '--uc-primary'],
  ['--uc-ai-primary-hover', '--uc-primary-hover'],
  ['--uc-ai-primary-foreground', '--uc-primary-foreground'],
  ['--uc-ai-secondary', '--uc-secondary'],
  ['--uc-ai-secondary-hover', '--uc-secondary-hover'],
  ['--uc-ai-secondary-foreground', '--uc-secondary-foreground'],
  ['--uc-ai-border', '--uc-border'],
  ['--uc-ai-destructive', '--uc-destructive'],
  ['--uc-ai-radius', '--uc-radius'],
  ['--uc-ai-padding', '--uc-padding'],
  ['--uc-ai-button-size', '--uc-button-size'],
  ['--uc-ai-font-family', '--uc-font-family'],
  ['--uc-ai-font-size', '--uc-font-size'],
  ['--uc-ai-transition', '--uc-transition'],
  ['--uc-ai-dialog-width', '--uc-dialog-width'],
];

function applyUploaderTheme(editor: HTMLElement): void {
  for (const [aiToken, ucToken] of UPLOADER_TOKEN_MAP) {
    editor.style.setProperty(aiToken, `var(${ucToken})`);
  }
}

export type AiEditorActivityParams = {
  mode?: 'generate' | 'edit';
  src?: string;
  internalId?: string;
};

async function urlToFile(url: string, name: string): Promise<File> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || 'image/jpeg' });
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
  id: PLUGIN_ID,
  setup: ({ pluginApi, uploaderApi }) => {
    const { registry, config } = pluginApi;

    registry.registerIcon({ name: 'ai-generate', svg: ICON_GENERATE });
    registry.registerIcon({ name: 'ai-edit', svg: ICON_EDIT_AI });

    registry.registerL10n({ en: enLocale });

    registry.registerSource({
      id: SOURCE_ID,
      label: 'ai-enhancer-source-label',
      icon: 'ai-generate',
      onSelect: () => {
        // ActivityType is a published enum; the plugin's custom activity is named "ai-editor".
        (uploaderApi.setCurrentActivity as (id: string, params?: unknown) => void)?.(ACTIVITY_ID,{ mode: 'generate' });
        uploaderApi.setModalState?.(true);
      },
    });

    registry.registerFileAction({
      id: FILE_ACTION_ID,
      icon: 'ai-edit',
      label: 'ai-enhancer-file-action-label',
      shouldRender: (fileEntry) => Boolean(fileEntry.isImage && fileEntry.cdnUrl),
      onClick: (fileEntry) => {
        (uploaderApi.setCurrentActivity as (id: string, params?: unknown) => void)?.(ACTIVITY_ID,{
          mode: 'edit',
          src: fileEntry.cdnUrl ?? undefined,
          internalId: fileEntry.internalId,
        });
        uploaderApi.setModalState?.(true);
      },
    });

    const resolveProvider = (): AiProvider => {
      const pubkey = config.get('pubkey');
      if (!pubkey) return mockBflProvider;
      return createUploadcareGenerateProvider({
        publicKey: pubkey,
        baseUrl: config.get('baseUrl'),
        cdnBaseUrl: config.get('cdnCname'),
      });
    };

    registry.registerActivity({
      id: ACTIVITY_ID,
      render: (host, activityParams) => {
        const params = (activityParams ?? {}) as AiEditorActivityParams;
        const editor = document.createElement('uc-ai-editor') as UcAiEditor;
        editor.mode = params.mode ?? 'generate';
        if (params.src) editor.src = params.src;
        editor.style.margin = 'auto';
        applyUploaderTheme(editor);

        editor.provider = resolveProvider();
        const ratios = aspectRatiosFromCropPreset(config.get('cropPreset') ?? '');
        if (ratios) editor.aspectRatios = ratios;

        const refreshProvider = () => {
          editor.provider = resolveProvider();
        };
        const unsubscribers = [
          config.subscribe('pubkey', refreshProvider),
          config.subscribe('baseUrl', refreshProvider),
          config.subscribe('cdnCname', refreshProvider),
          config.subscribe('cropPreset', (value) => {
            editor.aspectRatios = aspectRatiosFromCropPreset(value ?? '');
          }),
        ];

        const onDone = async (e: Event) => {
          const detail = (e as CustomEvent<DoneDetail>).detail;
          try {
            const file = await urlToFile(
              detail.url,
              detail.prompt ? `${detail.prompt.slice(0, 32).trim() || 'ai-image'}.jpg` : 'ai-image.jpg',
            );
            uploaderApi.addFileFromObject(file, { source: PLUGIN_ID });
            uploaderApi.setCurrentActivity?.('upload-list');
            uploaderApi.setModalState?.(true);
          } catch (err) {
            editor.dispatchEvent(
              new CustomEvent('uc:error', { detail: { error: err }, bubbles: true, composed: true }),
            );
          }
        };

        const onCancel = () => {
          uploaderApi.setCurrentActivity?.('upload-list');
          uploaderApi.setModalState?.(true);
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
