import type { UploaderPlugin } from '@uploadcare/file-uploader';
import { type AspectRatio, isValidAspectRatio, POPULAR_ASPECT_RATIOS } from '../aspect-ratio';
import { enLocale } from '../locales/en';
import { mockBflProvider } from '../providers/mockBfl';
import type { AiProvider } from '../providers/types';
import { createUploadcareGenerateProvider } from '../providers/uploadcareGenerate';
import type { ApplyDetail, UcAiEditor } from '../UcAiEditor';
import { ICON_EDIT_AI, ICON_GENERATE } from '../ui/icons';
import { parseCropPreset } from './parseCropPreset';

import '../UcAiEditor';

const PLUGIN_ID = 'ai-enhancer';
const SOURCE_ID = 'ai-generate';
const FILE_ACTION_ID = 'ai-edit';
const ACTIVITY_ID = 'ai-editor' as const;

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

        const onApply = async (e: Event) => {
          const detail = (e as CustomEvent<ApplyDetail>).detail;
          try {
            const file = await urlToFile(
              detail.url,
              detail.prompt ? `${detail.prompt.slice(0, 32).trim() || 'ai-image'}.jpg` : 'ai-image.jpg',
            );
            uploaderApi.addFileFromObject(file, { source: PLUGIN_ID });
            uploaderApi.uploadAll?.();
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

        editor.addEventListener('uc:apply', onApply);
        editor.addEventListener('uc:cancel', onCancel);
        host.replaceChildren(editor);

        return () => {
          editor.removeEventListener('uc:apply', onApply);
          editor.removeEventListener('uc:cancel', onCancel);
          for (const unsub of unsubscribers) unsub();
          host.replaceChildren();
        };
      },
    });
  },
};
