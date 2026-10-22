import { assert, expect, it } from 'vitest';
import { UploadcareApiClient, type UploadcareJobStatus } from '../../src/entities/provider/api/uploadcareApiClient';
import { UploadcareDerivativeApi } from '../../src/entities/provider/api/uploadcareDerivativeApi';
import { PRODUCTION_STATUS_SUCCESS, shapeOf } from '../fixtures/production-status-success';
import { POLL_INTERVAL_MS, PUBLIC_KEY } from './setup';

/** A well-formed uuid no project holds. */
const ABSENT_UUID = '00000000-0000-4000-8000-000000000000';

/** Polls `jobId` until it errors or its result is ready, for at most two minutes. */
async function pollToEnd(client: UploadcareApiClient, jobId: string): Promise<UploadcareJobStatus> {
  const deadline = Date.now() + 120_000;
  for (;;) {
    const status = await client.getJobStatus(jobId);
    if ((status.status === 'success' && status.is_ready) || status.status === 'error' || Date.now() > deadline)
      return status;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

/**
 * The one scenario that spends a generation: start it, poll it to a ready result, then read the file's info. Every
 * request and response also passes the client's dev schemas (see `tests/schema-drift.ts`).
 */
it("generates an image at the requested ratio, ready in a success frame shaped like production's", async () => {
  const client = new UploadcareApiClient({ publicKey: PUBLIC_KEY });

  const { job_id } = await client.generate({
    prompt: 'a red apple on a white table',
    aspectRatio: [3, 2],
    filename: 'generated.png',
    store: false,
  });
  const done = await pollToEnd(client, job_id!);

  expect(shapeOf(done)).toEqual(shapeOf(PRODUCTION_STATUS_SUCCESS));
  assert(done.status === 'success');
  // Live sizes are the model's own (production drew 1248x832 for one request), so allow a pixel of rounding.
  expect(done.image_info!.width / done.image_info!.height).toBeCloseTo(3 / 2, 2);

  const info = await new UploadcareDerivativeApi({ publicKey: PUBLIC_KEY }).getFileInfo(done.uuid);
  expect(info.imageInfo).toMatchObject({ width: done.image_info!.width, height: done.image_info!.height });
});

it('refuses the status of a job nobody started with job_not_found', async () => {
  const client = new UploadcareApiClient({ publicKey: PUBLIC_KEY });
  await expect(client.getJobStatus(ABSENT_UUID)).rejects.toMatchObject({
    name: 'AiProviderError',
    errorCode: 'job_not_found',
  });
});

it('refuses an edit of a file the project does not hold with source_not_found', async () => {
  const client = new UploadcareApiClient({ publicKey: PUBLIC_KEY });
  await expect(
    client.edit({ prompt: 'add a hat', source: ABSENT_UUID, filename: 'edited.png', store: false }),
  ).rejects.toMatchObject({ name: 'AiProviderError', errorCode: 'source_not_found' });
});
