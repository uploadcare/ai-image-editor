/**
 * Dev-only Zod schemas for the Uploadcare derivative API contract.
 *
 * This module is the ONLY place that imports `zod`. It is reached exclusively
 * through a dynamic `import()` guarded by `import.meta.env.DEV` (see
 * `uploadcareApiClient.ts`), so the production build dead-code-eliminates that
 * branch and zod never enters the bundle. zod is a devDependency on purpose.
 */
import * as z from 'zod';
import type { UploadcareJobResponse, UploadcareJobStatus } from './uploadcareApiClient';

/** Request body sent to `derivative/image/generate/`. */
const GenerateRequestSchema = z.object({
  pub_key: z.string().min(1),
  prompt: z.string(),
  aspect_ratio: z.tuple([z.number(), z.number()]),
  filename: z.string(),
  store: z.union([z.literal('auto'), z.boolean()]).optional(),
});

/** Request body sent to `derivative/image/edit/` (provisional contract). */
const EditRequestSchema = z.object({
  pub_key: z.string().min(1),
  prompt: z.string(),
  image_url: z.string().url(),
  aspect_ratio: z.tuple([z.number(), z.number()]).optional(),
  filename: z.string(),
  store: z.union([z.literal('auto'), z.boolean()]).optional(),
});

/** Job handle returned by the generate/edit POST. */
const JobResponseSchema: z.ZodType<UploadcareJobResponse> = z.object({
  type: z.literal('job').optional(),
  job_id: z.string().optional(),
});

/**
 * Status frames from `derivative/status/`, discriminated on `status`. Each
 * variant is non-strict, so the full upload-info bag returned on `success`
 * validates without enumerating every field.
 */
const StatusResponseSchema: z.ZodType<UploadcareJobStatus> = z.discriminatedUnion('status', [
  z.object({ type: z.literal('job').optional(), status: z.literal('processing') }),
  z.object({ type: z.literal('job').optional(), status: z.literal('uploading') }),
  z.object({
    type: z.literal('job').optional(),
    status: z.literal('error'),
    error_source: z.string().optional(),
    error_code: z.string().optional(),
    error: z.string().optional(),
  }),
  z.object({
    status: z.literal('success'),
    uuid: z.string().optional(),
    file: z.string().optional(),
  }),
]);

const schemas = {
  generate: GenerateRequestSchema,
  edit: EditRequestSchema,
  job: JobResponseSchema,
  status: StatusResponseSchema,
} as const;

export type SchemaKind = keyof typeof schemas;

/**
 * Validate `data` against the named schema. On mismatch it logs a readable
 * `console.error` rather than throwing, so dev behaviour stays identical to
 * production — it is a contract-drift diagnostic, not a control-flow gate.
 */
export function validate(kind: SchemaKind, data: unknown): void {
  const result = schemas[kind].safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    console.error(`[uploadcare-derivative-api] ${kind} failed schema validation:\n${issues}\nReceived:`, data);
  }
}
