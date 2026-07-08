import { page } from 'vitest/browser';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, delay, getCtxName } from './test-renderer';

const TEST_IMAGE_URL =
  'https://images.unsplash.com/photo-1699102241946-45c5e1937d69?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=640';

type OutputEntry = { uuid: string | null; internalId: string; source?: string | null; name?: string | null };
type Config = HTMLElement & { plugins: unknown[]; sourceList: string };
type UploadCtxProvider = HTMLElement & {
  api: {
    addFileFromUrl: (url: string) => void;
    initFlow: () => void;
    removeAllFiles: () => void;
    getOutputCollectionState: () => { allEntries: OutputEntry[] };
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
  // The uploader bundles only English by default; define its German locale so
  // switching `localeName` to "de" doesn't throw "Locale de is not defined".
  UC.defineLocale('de', () => import('@uploadcare/file-uploader/locales/file-uploader/de.js').then((m) => m.default));
  // Registers <uc-ai-enhancer> and sub-elements
  await import('../src/index');
});

describe('AiEnhancerPlugin', () => {
  it('registers "Generate image" as an upload source', async () => {
    const { AiEnhancerPlugin } = await import('../src/plugin');
    const { config } = await renderUploader([AiEnhancerPlugin]);
    addSource(config, 'ai-enhancer');
    await openModal();
    await expect.element(page.getByText('Generate image')).toBeVisible();
    cleanup();
  });

  it('opens the AI editor activity when the Generate image source is selected', async () => {
    const { AiEnhancerPlugin } = await import('../src/plugin');
    const { config } = await renderUploader([AiEnhancerPlugin]);
    addSource(config, 'ai-enhancer');
    await openModal();
    await page.getByText('Generate image').click();
    await vi.waitFor(() => {
      const editor = document.querySelector('uc-ai-enhancer') as (Element & { sourceFileInfo?: unknown }) | null;
      expect(editor).toBeTruthy();
      // No source → derived generate mode (read off the prompt-row child).
      const promptRow = editor?.shadowRoot?.querySelector('uc-ai-prompt-row') as (Element & { mode?: string }) | null;
      expect(promptRow?.mode).toBe('generate');
      expect(editor?.sourceFileInfo).toBeFalsy();
    });
    cleanup();
  });

  // The editor renders the active locale's generate-button label as the prompt
  // row's `send-aria-label`, and the cancel label as the footer's `cancel-label`.
  const generateLabel = () =>
    document
      .querySelector('uc-ai-enhancer')
      ?.shadowRoot?.querySelector('uc-ai-prompt-row')
      ?.getAttribute('send-aria-label');
  const cancelLabel = () =>
    document.querySelector('uc-ai-enhancer')?.shadowRoot?.querySelector('uc-ai-footer')?.getAttribute('cancel-label');

  it('feeds editor locale overrides from the uploader config (localeDefinitionOverride)', async () => {
    const { AiEnhancerPlugin } = await import('../src/plugin');
    const { config } = await renderUploader([AiEnhancerPlugin]);
    type L10nConfig = { localeDefinitionOverride: Record<string, Record<string, string>> | null };
    (config as unknown as L10nConfig).localeDefinitionOverride = {
      en: { 'ai-enhancer-generate-btn': 'Make it!' },
    };
    addSource(config, 'ai-enhancer');
    await openModal();
    await page.getByText('Generate image').click();

    await vi.waitFor(() => expect(generateLabel()).toBe('Make it!'));

    // Reactive: changing the override after the editor is open updates it.
    (config as unknown as L10nConfig).localeDefinitionOverride = {
      en: { 'ai-enhancer-generate-btn': 'Generate now' },
    };
    await vi.waitFor(() => expect(generateLabel()).toBe('Generate now'));
    cleanup();
  });

  it('lazily switches the editor locale when the uploader localeName changes', async () => {
    const { AiEnhancerPlugin } = await import('../src/plugin');
    const { config } = await renderUploader([AiEnhancerPlugin]);
    addSource(config, 'ai-enhancer');
    await openModal();
    await page.getByText('Generate image').click();

    // Defaults to English.
    await vi.waitFor(() => expect(cancelLabel()).toBe('Cancel'));

    // Switching localeName lazy-loads and applies the German strings.
    (config as unknown as { localeName: string }).localeName = 'de';
    await vi.waitFor(() => expect(cancelLabel()).toBe('Abbrechen'));
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
      const editor = document.querySelector('uc-ai-enhancer') as (Element & { sourceFileInfo?: unknown }) | null;
      expect(editor?.sourceFileInfo).toBeTruthy();
      // A source file → derived edit mode (read off the prompt-row child).
      const promptRow = editor?.shadowRoot?.querySelector('uc-ai-prompt-row') as (Element & { mode?: string }) | null;
      expect(promptRow?.mode).toBe('edit');
    });
    cleanup();
  });

  it('replaces the source entry in place (not a second entry) when an edit completes, sourced to ai-enhancer', async () => {
    const { AiEnhancerPlugin } = await import('../src/plugin');
    await renderUploader([AiEnhancerPlugin]);
    const api = getApi();
    api.addFileFromUrl(TEST_IMAGE_URL);
    (api as unknown as { initFlow?: () => void }).initFlow?.();

    // Wait until the source file finished uploading (the AI Edit action only
    // renders once the entry has a uuid).
    await expect.element(page.getByRole('button', { name: 'AI Edit' })).toBeVisible();
    const before = api.getOutputCollectionState().allEntries;
    expect(before).toHaveLength(1);
    const originalUuid = before[0]!.uuid;
    const originalInternalId = before[0]!.internalId;
    const originalName = before[0]!.name;
    expect(originalName).toBeTruthy();

    await page.getByRole('button', { name: 'AI Edit' }).click();
    const editor = (await vi.waitFor(() => {
      const el = document.querySelector('uc-ai-enhancer');
      expect(el).toBeTruthy();
      return el!;
    })) as Element & { sourceFileInfo?: { uuid?: string; originalFilename?: string } };

    // The plugin hands the source entry's file info to the editor (so it can
    // frame the canvas and name the result after the original) — verify it's the
    // source file's info that was wired through.
    expect(editor.sourceFileInfo?.uuid).toBe(originalUuid);

    // The edit produced this already-uploaded result. Drive uc:done directly so
    // the test doesn't depend on the generation backend.
    const resultFile = {
      uuid: 'edited-result',
      cdnUrl: 'https://cdn.example.com/edited-result/',
      originalFilename: originalName,
      size: 4242,
      isImage: true,
      mimeType: 'image/png',
      contentInfo: { mime: { mime: 'image/png' } },
    };
    editor.dispatchEvent(
      new CustomEvent('uc:done', {
        detail: { url: resultFile.cdnUrl, file: resultFile },
        bubbles: true,
        composed: true,
      }),
    );

    await vi.waitFor(() => {
      const after = api.getOutputCollectionState().allEntries;
      // Replaced in place: still a single entry, now carrying the edited result.
      expect(after).toHaveLength(1);
      expect(after[0]!.uuid).toBe('edited-result');
      expect(after[0]!.uuid).not.toBe(originalUuid);
      // It's a fresh entry (remove + add), so the internalId changed...
      expect(after[0]!.internalId).not.toBe(originalInternalId);
      // ...the replacement is attributed to the AI enhancer...
      expect(after[0]!.source).toBe('ai-enhancer');
      // ...and it keeps the original file's name.
      expect(after[0]!.name).toBe(originalName);
    });
    cleanup();
  });

  it('paints floating panels even though the uploader defines no --uc-floating token', async () => {
    const { AiEnhancerPlugin } = await import('../src/plugin');
    const { config } = await renderUploader([AiEnhancerPlugin]);
    addSource(config, 'ai-enhancer');
    await openModal();
    await page.getByText('Generate image').click();

    const editor = (await vi.waitFor(() => {
      const el = document.querySelector('uc-ai-enhancer');
      expect(el).toBeTruthy();
      return el as HTMLElement;
    })) as HTMLElement;

    // The plugin must NOT map `--uc-ai-floating` to the (undefined) `--uc-floating`
    // token — doing so resolves to an invalid value and blanks every panel.
    expect(editor.style.getPropertyValue('--uc-ai-floating')).toBe('');

    // The prompt row's card mixes `--uc-ai-floating`; with a real default it paints.
    const card = await vi.waitFor(() => {
      const c = editor.shadowRoot
        ?.querySelector('uc-ai-prompt-row')
        ?.shadowRoot?.querySelector('.card') as HTMLElement | null;
      expect(c).toBeTruthy();
      return c!;
    });
    const bg = getComputedStyle(card).backgroundColor;
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(bg).not.toBe('transparent');
    cleanup();
  });
});
