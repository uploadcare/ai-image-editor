import { XMLHttpRequestInterceptor } from '@mswjs/interceptors/XMLHttpRequest';
// TEMPORARY: file: dependency, see tests/commands.ts.
import { handle, resetSession } from '@uploadcare/api-emulator';
import { http, passthrough } from 'msw';
import { setupWorker } from 'msw/browser';

/**
 * The Uploadcare API emulator, running in the page. Two entry points, one state:
 * - `XMLHttpRequestInterceptor` answers XHR (the file-uploader's uploads) in-process, so `xhr.upload` progress
 *   fires per body chunk the way MSW's recipe describes
 *   (https://mswjs.io/docs/recipes/xmlhttprequest-progress-events/);
 * - the MSW Service Worker answers `fetch` (the derivative API) and resource loads (`<img>` results), which no
 *   in-page hook can reach.
 *
 * Only Uploadcare's hosts are emulated, plus `cdn.example.com`, the CDN cname the editor tests configure.
 * Anything else (the page's own modules from the Vite server, or the Unsplash image the uploader tests import
 * from a URL) goes through to the real network; the emulator's `from_url` answers for that source without
 * fetching it.
 */
const UPLOADCARE = /^https:\/\/(?:[\w-]+\.)*(?:uploadcare\.com|ucarecdn\.com|ucarecd\.net|cdn\.example\.com)\//;

/** `handle` routes by path alone, so the host check is here. */
const answer = (request: Request) => (UPLOADCARE.test(request.url) ? handle(request) : undefined);

let started: Promise<void> | undefined;

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve));

/**
 * Holds the response body back by one macrotask. In-page, the whole XHR — upload progress, response, `load` —
 * would otherwise complete within microtasks of `send()`, before the uploader's store flushes (a `setTimeout(0)`),
 * and `file-upload-start`/`file-upload-progress` would never be observed. A real network cannot answer before the
 * body has gone out; this keeps that order.
 */
const afterUpload = (response: Response): Response => {
  if (!response.body) {
    return response;
  }
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      await nextTask();
      controller.enqueue(bytes);
      controller.close();
    },
  });
  return new Response(body, response);
};

const start = async () => {
  const xhr = new XMLHttpRequestInterceptor();
  xhr.on('request', async ({ request, controller }) => {
    const response = await answer(request);
    if (response) {
      controller.respondWith(afterUpload(response));
    }
  });
  xhr.apply();

  const worker = setupWorker(http.all('*', async ({ request }) => (await answer(request)) ?? passthrough()));
  // bypass: the page's own modules come from the Vite server.
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true });
};

/**
 * Answer the page's Uploadcare requests from the emulator, starting from an empty session. Call it before every
 * test: the worker and interceptor are installed once per page, the session is reset each time.
 */
export const useEmulator = async () => {
  started ??= start();
  await started;
  resetSession();
};
