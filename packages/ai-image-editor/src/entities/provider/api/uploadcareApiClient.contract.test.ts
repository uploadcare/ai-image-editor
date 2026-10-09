import { expect, it } from 'vitest';
import { PRODUCTION_STATUS_SUCCESS, shapeOf } from '../../../../tests/fixtures/production-status-success';
import { session } from '../../../../tests/specs/setup';
import { UploadcareApiClient, type UploadcareJobStatus } from './uploadcareApiClient';

const PUBLIC_KEY = 'demopublickey';

/** Polls `jobId` until its result is ready, at most `polls` times. */
async function pollToReady(client: UploadcareApiClient, jobId: string, polls = 10): Promise<UploadcareJobStatus> {
  for (let poll = 1; ; poll += 1) {
    const status = await client.getJobStatus(jobId);
    if ((status.status === 'success' && status.is_ready) || status.status === 'error' || poll === polls) return status;
  }
}

it("polls a generate job to a success frame with production's keys and value types", async () => {
  session.use('derivativesInstant');
  const client = new UploadcareApiClient({ publicKey: PUBLIC_KEY });

  const { job_id } = await client.generate({ prompt: 'a hat', aspectRatio: [3, 2], filename: 'generated.png' });
  const done = await pollToReady(client, job_id!);

  expect(shapeOf(done)).toEqual(shapeOf(PRODUCTION_STATUS_SUCCESS));
});
