import type { CustomUserAgentFn } from '@uploadcare/upload-client';
import { getUserAgent } from '@uploadcare/upload-client';
import { name, version } from '../../../package.json';

const LIBRARY = { libraryName: name, libraryVersion: version } as const;

/**
 * Identifies this editor in `X-UC-User-Agent` on the upload-client calls it
 * makes, so they are attributable to it rather than to the client underneath.
 * upload-client calls this per request with the parts only it knows.
 */
export const customUserAgent: CustomUserAgentFn = (options) => getUserAgent({ ...options, ...LIBRARY });
