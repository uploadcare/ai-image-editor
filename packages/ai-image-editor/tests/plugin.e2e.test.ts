import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { UcAiImageEditor } from '../src/index';
import { session } from './emulator';
import { cleanup, getCtxName } from './test-renderer';

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
    l10n: (key: string) => string;
  };
};

async function renderUploader(plugins: unknown[] = []) {
  const ctxName = getCtxName();
  page.render(
    `<uc-file-uploader-regular ctx-name="${ctxName}"></uc-file-uploader-regular>
     <uc-config ctx-name="${ctxName}" pubkey="demopublickey" test-mode debug></uc-config>
     <uc-upload-ctx-provider ctx-name="${ctxName}"></uc-upload-ctx-provider>`,
  );
  await customElements.whenDefined('uc-config');
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

/** Waits for the plugin's editor to open in `mode` (its region is named after the mode) and answers the element. */
async function openedEditor(mode: 'generate' | 'edit'): Promise<UcAiImageEditor> {
  const name = mode === 'edit' ? 'Edit image' : 'Generate image';
  await expect.element(page.getByRole('region', { name, exact: true })).toBeVisible();
  return document.querySelector('uc-ai-image-editor') as UcAiImageEditor;
}

/** The plugin's editor, for locators scoped to it (the uploader around it has its own Cancel). */
const editorLocator = () => page.elementLocator(document.querySelector('uc-ai-image-editor')!);

async function openModal() {
  await page.getByText('Upload files', { exact: true }).click();
}

beforeAll(async () => {
  const UC = await import('@uploadcare/file-uploader');
  UC.defineComponents(UC);
  // The uploader bundles only English by default; define its German locale so
  // switching `localeName` to "de" doesn't throw "Locale de is not defined".
  UC.defineLocale('de', () => import('@uploadcare/file-uploader/locales/file-uploader/de.js').then((m) => m.default));
  // Registers <uc-ai-image-editor> and sub-elements
  await import('../src/index');
});

/*
 * The editor harness forces the dot grid's 2D path with `shimmerConfig = { useWebgl: false }`, but the plugin creates
 * its own editor, and the canvas picks its backend before a test can reach it. Headless Chromium's WebGL is software
 * (swiftshader): the generating shimmer's per-frame GL work starves the main thread, which is also where the emulator
 * answers, so a single edit took ~5s instead of ~0.3s and, under a loaded suite, ran the test past its timeout. With no
 * webgl2 context on offer the grid falls back to 2D, as it does in a browser without WebGL. Restored after each test.
 */
beforeEach(() => {
  const getContext = HTMLCanvasElement.prototype.getContext;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
    ...args: Parameters<HTMLCanvasElement['getContext']>
  ) {
    return args[0] === 'webgl2' ? null : getContext.apply(this, args);
  } as HTMLCanvasElement['getContext']);
});

describe('AiImageEditorPlugin', () => {
  it('registers "Generate image" as an upload source', async () => {
    const { AiImageEditorPlugin } = await import('../src/plugin');
    const { config } = await renderUploader([AiImageEditorPlugin]);
    addSource(config, 'ai-image-editor');
    await openModal();
    await expect.element(page.getByText('Generate image')).toBeVisible();
    cleanup();
  });

  it("hands the editor the uploader's cached token instead of the raw config value", async () => {
    // The uploader already caches what an `authToken` function returns, so the
    // editor must not wrap it again — it gets `cacheAuthToken = false` and the
    // uploader's resolver, not the function from `<uc-config>`.
    const { AiImageEditorPlugin } = await import('../src/plugin');
    const { config } = await renderUploader([AiImageEditorPlugin]);
    const fetchToken = vi.fn(async () => 'eyJ.uploader.sig');
    (config as unknown as { authToken: unknown }).authToken = fetchToken;
    addSource(config, 'ai-image-editor');
    await openModal();
    await page.getByText('Generate image').click();

    const editor = await openedEditor('generate');

    expect(editor.cacheAuthToken).toBe(false);
    expect(typeof editor.authToken).toBe('function');
    // Not the configured function itself: the uploader's cache stands in front.
    expect(editor.authToken).not.toBe(fetchToken);

    const resolve = editor.authToken as () => Promise<string>;
    await expect(resolve()).resolves.toBe('eyJ.uploader.sig');
    await expect(resolve()).resolves.toBe('eyJ.uploader.sig');
    expect(fetchToken).toHaveBeenCalledOnce();
    cleanup();
  });

  it('opens the AI editor activity when the Generate image source is selected', async () => {
    const { AiImageEditorPlugin } = await import('../src/plugin');
    const { config } = await renderUploader([AiImageEditorPlugin]);
    addSource(config, 'ai-image-editor');
    await openModal();
    await page.getByText('Generate image').click();
    // No source → derived generate mode.
    const editor = await openedEditor('generate');
    expect(editor.sourceFileInfo).toBeUndefined();
    cleanup();
  });

  /** The editor's button named `name`. */
  const editorButton = (name: string) => editorLocator().getByRole('button', { name, exact: true });

  it('feeds editor locale overrides from the uploader config (localeDefinitionOverride)', async () => {
    const { AiImageEditorPlugin } = await import('../src/plugin');
    const { config } = await renderUploader([AiImageEditorPlugin]);
    type L10nConfig = { localeDefinitionOverride: Record<string, Record<string, string>> | null };
    (config as unknown as L10nConfig).localeDefinitionOverride = {
      en: { 'ai-image-editor-generate-btn': 'Make it!' },
    };
    addSource(config, 'ai-image-editor');
    await openModal();
    await page.getByText('Generate image').click();
    // The send button shows once the prompt holds text.
    await userEvent.fill(editorLocator().getByRole('textbox'), 'a tiger');

    await expect.element(editorButton('Make it!')).toBeVisible();

    // Reactive: changing the override after the editor is open updates it.
    (config as unknown as L10nConfig).localeDefinitionOverride = {
      en: { 'ai-image-editor-generate-btn': 'Generate now' },
    };
    await expect.element(editorButton('Generate now')).toBeVisible();
    cleanup();
  });

  it('lazily switches the editor locale when the uploader localeName changes', async () => {
    const { AiImageEditorPlugin } = await import('../src/plugin');
    const { config } = await renderUploader([AiImageEditorPlugin]);
    addSource(config, 'ai-image-editor');
    await openModal();
    await page.getByText('Generate image').click();

    // Defaults to English.
    await openedEditor('generate');
    await expect.element(editorButton('Cancel')).toBeVisible();

    // Switching localeName lazy-loads and applies the German strings.
    (config as unknown as { localeName: string }).localeName = 'de';
    await expect.element(editorButton('Abbrechen')).toBeVisible();
    // The editor loads its own strings; the uploader loads its locale separately
    // and may still be resolving. Tearing it down mid-load is a file-uploader bug
    // (fixed upstream, not yet released), so let the uploader finish switching too.
    await vi.waitFor(() => expect(getApi().l10n('cancel')).toBe('Abbrechen'));
    cleanup();
  });

  it('opens the editor in edit mode when the AI Edit file action is clicked', async () => {
    const { AiImageEditorPlugin } = await import('../src/plugin');
    await renderUploader([AiImageEditorPlugin]);
    const api = getApi();
    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    await expect.element(page.getByRole('button', { name: 'AI Edit' })).toBeVisible();
    await page.getByRole('button', { name: 'AI Edit' }).click();

    // A source file → derived edit mode, on the uploaded file.
    const editor = await openedEditor('edit');
    expect(editor.sourceFileInfo).toMatchObject({ uuid: api.getOutputCollectionState().allEntries[0]!.uuid });
    cleanup();
  });

  it('replaces the source entry in place (not a second entry) when an edit completes, sourced to ai-image-editor', async () => {
    const { AiImageEditorPlugin } = await import('../src/plugin');
    await renderUploader([AiImageEditorPlugin]);
    const api = getApi();
    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    // Wait until the source file finished uploading (the AI Edit action only
    // renders once the entry has a uuid).
    await expect.element(page.getByRole('button', { name: 'AI Edit' })).toBeVisible();
    const before = api.getOutputCollectionState().allEntries;
    expect(before).toHaveLength(1);
    const originalUuid = before[0]!.uuid;
    const originalInternalId = before[0]!.internalId;
    const originalName = before[0]!.name;
    expect(originalName).toMatch(/.+/);

    await page.getByRole('button', { name: 'AI Edit' }).click();
    const editor = await openedEditor('edit');

    // The plugin hands the source entry's file info to the editor (so it can
    // frame the canvas and name the result after the original) — verify it's the
    // source file's info that was wired through.
    expect(editor.sourceFileInfo?.uuid).toBe(originalUuid);

    // Run the edit against the emulator and commit its result.
    session.use('derivativesInstant');
    await userEvent.fill(editorLocator().getByRole('textbox'), 'add a hat');
    await userEvent.click(editorButton('Generate'));
    await expect.element(editorButton('Done')).toBeEnabled();
    const onDone = vi.fn();
    editor.addEventListener('uc:done', onDone);
    await userEvent.click(editorButton('Done'));
    expect(onDone).toHaveBeenCalledOnce();
    const resultUuid: string = onDone.mock.calls[0]![0].detail.file.uuid;
    expect(resultUuid).not.toBe(originalUuid);
    expect(session.files.get(resultUuid)).toBeDefined();

    await vi.waitFor(() => {
      const after = api.getOutputCollectionState().allEntries;
      // Replaced in place: still a single entry, now carrying the edited result.
      expect(after).toHaveLength(1);
      expect(after[0]!.uuid).toBe(resultUuid);
      // It's a fresh entry (remove + add), so the internalId changed...
      expect(after[0]!.internalId).not.toBe(originalInternalId);
      // ...the replacement is attributed to the AI Image Editor...
      expect(after[0]!.source).toBe('ai-image-editor');
      // ...and it keeps the original file's name.
      expect(after[0]!.name).toBe(originalName);
    });
    cleanup();
  });

  it('paints floating panels even though the uploader defines no --uc-floating token', async () => {
    const { AiImageEditorPlugin } = await import('../src/plugin');
    const { config } = await renderUploader([AiImageEditorPlugin]);
    addSource(config, 'ai-image-editor');
    await openModal();
    await page.getByText('Generate image').click();

    const editor = await openedEditor('generate');

    // The plugin must NOT map `--uc-ai-floating` to the (undefined) `--uc-floating`
    // token — doing so resolves to an invalid value and blanks every panel.
    expect(editor.style.getPropertyValue('--uc-ai-floating')).toBe('');

    // The prompt row's card mixes `--uc-ai-floating`; with a real default it paints.
    const card = await vi.waitFor(() => {
      const c = editor.shadowRoot?.querySelector('uc-ai-prompt-row')?.shadowRoot?.querySelector('.card');
      expect(c).toBeInstanceOf(HTMLElement);
      return c as HTMLElement;
    });
    const bg = getComputedStyle(card).backgroundColor;
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(bg).not.toBe('transparent');
    cleanup();
  });
});
