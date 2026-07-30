import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The strongest possible canary: if anything in the wrapper's server-side
// module graph or render path ever imports the Lit package again, this throws
// and every test below fails — independently of whether Lit's own Node shims
// would have masked the regression.
vi.mock('@uploadcare/ai-image-editor', () => {
  throw new Error('@uploadcare/ai-image-editor must never be evaluated during SSR');
});

import { AiImageEditor, preloadAiImageEditor } from '../../src';

describe('SSR (bare Node, no DOM globals)', () => {
  it('runs in an environment without DOM globals', () => {
    expect(typeof globalThis.window).toBe('undefined');
    expect(typeof globalThis.document).toBe('undefined');
    expect(typeof globalThis.HTMLElement).toBe('undefined');
    expect(typeof globalThis.customElements).toBe('undefined');
  });

  it('renderToString renders nothing by default and does not throw', () => {
    const html = renderToString(<AiImageEditor pubkey="test-pubkey" />);
    expect(html).toBe('');
  });

  it('renderToString renders the fallback, never the custom element', () => {
    const html = renderToString(
      <AiImageEditor pubkey="test-pubkey" fallback={<div data-testid="skeleton">loading</div>} />,
    );
    expect(html).toContain('loading');
    expect(html).toContain('data-testid="skeleton"');
    expect(html).not.toContain('uc-ai-image-editor');
  });

  it('renderToString with the full prop surface does not throw', () => {
    const apiRef = React.createRef<never>();
    const html = renderToString(
      <AiImageEditor
        pubkey="test-pubkey"
        sourceUuid="00000000-0000-0000-0000-000000000000"
        aspectRatios={[
          [1, 1],
          [16, 9],
        ]}
        presets={{}}
        presetsOnly={false}
        metadata={{ k: 'v' }}
        outputFilename="out.png"
        baseUrl="https://upload.uploadcare.com"
        cdnCname="https://ucarecdn.com"
        localeName="en"
        composerPlacement="bottom"
        canvasFit="available"
        historyPlacement="composer-below"
        composerAutoHide={false}
        toolbarPlacement="top"
        className="my-class"
        apiRef={apiRef}
        onDone={() => {}}
        onCancel={() => {}}
        onError={() => {}}
        fallback={<span>f</span>}
      />,
    );
    expect(html).toContain('<span>f</span>');
    expect(apiRef.current).toBeNull();
  });

  it('preloadAiImageEditor is a no-op on the server', () => {
    expect(() => preloadAiImageEditor()).not.toThrow();
  });

  it('leaves the environment untouched after rendering', () => {
    renderToString(<AiImageEditor pubkey="test-pubkey" />);
    expect(typeof globalThis.HTMLElement).toBe('undefined');
    expect(typeof globalThis.customElements).toBe('undefined');
  });
});
