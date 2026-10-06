// TEMPORARY: `@uploadcare/api-emulator` is a `file:` dependency on an unreleased
// checkout (see packages/ai-image-editor/package.json); swap it for a version
// range once the package ships, and drop this comment.
import { handle, resetSession, SESSION_HEADER, SIGNED_UPLOADS_SECRET_KEY } from '@uploadcare/api-emulator';
import { generateAuthToken } from '@uploadcare/signed-uploads/server';
import type { Page } from 'playwright';
import type { BrowserCommand } from 'vitest/node';
// Types `page` on the command context.
import type {} from '@vitest/browser-playwright';

/**
 * Node-side browser commands that put the Uploadcare API emulator behind the
 * test page, so the browser suite never reaches the real Upload API or CDN.
 *
 * Only Uploadcare's hosts are routed, plus `cdn.example.com`, the CDN cname the
 * editor tests configure. Anything else (e.g. the Unsplash image the uploader
 * tests import from a URL) is left alone: the emulator's `from_url` answers for
 * that source without fetching it.
 */
const UPLOADCARE = /^https:\/\/(?:[\w-]+\.)*(?:uploadcare\.com|ucarecdn\.com|ucarecd\.net|cdn\.example\.com)\//;

/** One emulator session per page, so test files running side by side keep their files apart. */
const sessions = new WeakMap<Page, string>();
let opened = 0;

/**
 * Answer the page's Uploadcare requests from the emulator, starting from an
 * empty session. Call it before every test: the route is installed once per
 * page, the session is reset each time.
 *
 * Requests are fulfilled in place from `handle()` (the README's "As a
 * function" shape) rather than redirected to an emulator server: nothing here
 * depends on the browser making a real request, so there's no server or TLS
 * certificate to manage.
 */
const useEmulator: BrowserCommand<[]> = async ({ page }) => {
  const existing = sessions.get(page);
  if (existing) {
    resetSession(existing);
    return;
  }

  const session = `session-${++opened}`;
  sessions.set(page, session);
  resetSession(session);

  await page.route(UPLOADCARE, async (route) => {
    const request = route.request();
    const method = request.method();
    // Every request here is cross-origin, as it is for the real API.
    const cors = { 'access-control-allow-origin': '*' };
    if (method === 'OPTIONS') {
      const allowHeaders = (await request.headerValue('access-control-request-headers')) ?? '*';
      return route.fulfill({
        status: 204,
        headers: {
          ...cors,
          'access-control-allow-methods': 'GET, POST, PUT, HEAD',
          'access-control-allow-headers': allowHeaders,
        },
      });
    }
    const body = method === 'GET' || method === 'HEAD' ? null : request.postDataBuffer();
    const response = await handle(
      new Request(request.url(), {
        method,
        headers: { ...request.headers(), [SESSION_HEADER]: session },
        body: body && new Uint8Array(body),
      }),
    );
    if (!response) return route.abort();
    await route.fulfill({
      status: response.status,
      headers: { ...Object.fromEntries(response.headers), ...cors },
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
};

/** A Bearer token the emulator accepts; `id` keeps tokens minted in the same second apart. */
const mintAuthToken: BrowserCommand<[id?: string]> = async (_context, id = 'token') =>
  generateAuthToken(SIGNED_UPLOADS_SECRET_KEY, { lifetime: 600_000, tokenId: id });

export const emulatorCommands = { useEmulator, mintAuthToken };

declare module 'vitest/browser' {
  interface BrowserCommands {
    useEmulator: () => Promise<void>;
    mintAuthToken: (id?: string) => Promise<string>;
  }
}
