import { beforeAll, describe, expect, it, vi } from 'vitest';
import { page } from '@vitest/browser/context';
import { cleanup, delay, getCtxName } from './test-renderer';

const TEST_IMAGE_URL =
  'https://images.unsplash.com/photo-1699102241946-45c5e1937d69?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=640';

type Config = HTMLElement & { plugins: unknown[]; sourceList: string };
type UploadCtxProvider = HTMLElement & {
  api: {
    addFileFromUrl: (url: string) => void;
    initFlow: () => void;
    removeAllFiles: () => void;
  };
};

async function renderUploader(plugins: unknown[] = []) {
  const ctxName = getCtxName();
  page.render(
    `<uc-file-uploader-regular ctx-name="${ctxName}"></uc-file-uploader-regular>
     <uc-config ctx-name="${ctxName}" pubkey="demopublickey" test-mode debug></uc-config>
     <uc-upload-ctx-provider ctx-name="${ctxName}"></uc-upload-ctx-provider>`,
  );
  await delay(0);
  const config = document.querySelector(`uc-config[ctx-name="${ctxName}"]`) as Config;
  config.plugins = plugins;
  return { ctxName, config };
}

function getApi() {
  const provider = document.querySelector('uc-upload-ctx-provider') as UploadCtxProvider;
  return provider.api;
}

function addSource(config: Config, sourceId: string) {
  config.sourceList += `,${sourceId}`;
}

async function openModal() {
  await page.getByText('Upload files', { exact: true }).click();
}

beforeAll(async () => {
  const UC = await import('@uploadcare/file-uploader');
  UC.defineComponents(UC);
  // Registers <uc-ai-editor> and sub-elements
  await import('../src/index');
});

describe('AiEnhancerPlugin', () => {
  it('registers "Generate image" as an upload source', async () => {
    const { AiEnhancerPlugin } = await import('../src/plugin');
    const { config } = await renderUploader([AiEnhancerPlugin]);
    addSource(config, 'ai-generate');
    await openModal();
    await expect.element(page.getByText('Generate image')).toBeVisible();
    cleanup();
  });

  it('opens the AI editor activity when the Generate image source is selected', async () => {
    const { AiEnhancerPlugin } = await import('../src/plugin');
    const { config } = await renderUploader([AiEnhancerPlugin]);
    addSource(config, 'ai-generate');
    await openModal();
    await page.getByText('Generate image').click();
    await vi.waitFor(() => {
      const editor = document.querySelector('uc-ai-editor') as (Element & { mode?: string }) | null;
      expect(editor).toBeTruthy();
      expect(editor?.mode).toBe('generate');
    });
    cleanup();
  });

  it('opens the editor in edit mode when the AI Edit file action is clicked', async () => {
    const { AiEnhancerPlugin } = await import('../src/plugin');
    await renderUploader([AiEnhancerPlugin]);
    const api = getApi();
    api.addFileFromUrl(TEST_IMAGE_URL);
    (api as unknown as { initFlow?: () => void }).initFlow?.();

    await expect.element(page.getByRole('button', { name: 'AI Edit' })).toBeVisible();
    await page.getByRole('button', { name: 'AI Edit' }).click();

    await vi.waitFor(() => {
      const editor = document.querySelector('uc-ai-editor') as (Element & { mode?: string; src?: string }) | null;
      expect(editor?.mode).toBe('edit');
      expect(editor?.src).toBeTruthy();
    });
    cleanup();
  });
});
