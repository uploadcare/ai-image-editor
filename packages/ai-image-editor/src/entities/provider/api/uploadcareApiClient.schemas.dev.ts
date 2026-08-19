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
  metadata: z.record(z.string(), z.string()).optional(),
});

/**
 * Request body sent to `derivative/image/edit/`.
 *
 * The endpoint also accepts `reference_sources`, `output_format` and `seed`,
 * which the editor does not surface — add them here (and to the request body)
 * when wired up.
 */
const EditRequestSchema = z.object({
  pub_key: z.string().min(1),
  prompt: z.string(),
  source: z.string().min(1),
  aspect_ratio: z.tuple([z.number(), z.number()]).optional(),
  filename: z.string(),
  store: z.union([z.literal('auto'), z.boolean()]).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

/** Job handle returned by the generate/edit POST. */
const JobResponseSchema: z.ZodType<UploadcareJobResponse> = z.object({
  type: z.literal('job').optional(),
  job_id: z.string().optional(),
});

/** Snake_case mirror of upload-client's `ImageInfo`. */
const ImageInfoSchema = z.object({
  height: z.number(),
  width: z.number(),
  geo_location: z.object({ latitude: z.number(), longitude: z.number() }).nullable(),
  datetime_original: z.string().nullable(),
  format: z.string(),
  color_mode: z.string(),
  // The live API sends a `[x, y]` tuple, not the `{0,1}` object upload-client types.
  dpi: z.array(z.number()).nullable(),
  orientation: z.number().nullable(),
  sequence: z.boolean().nullable(),
});

/** Snake_case mirror of upload-client's `VideoInfo`. */
const VideoInfoSchema = z.object({
  duration: z.number(),
  format: z.string(),
  bitrate: z.number(),
  audio: z
    .object({
      bitrate: z.number().nullable(),
      codec: z.string().nullable(),
      sample_rate: z.number().nullable(),
      channels: z.string().nullable(),
    })
    .nullable(),
  video: z.object({
    height: z.number(),
    width: z.number(),
    frame_rate: z.number(),
    bitrate: z.number(),
    codec: z.string(),
  }),
});

/** Snake_case mirror of upload-client's `ContentInfo`. */
const ContentInfoSchema = z.object({
  mime: z.object({ mime: z.string(), type: z.string(), subtype: z.string() }).optional(),
  image: ImageInfoSchema.optional(),
  video: VideoInfoSchema.optional(),
});

/**
 * Status frames from `derivative/status/`, discriminated on `status`. The
 * `success` frame is the platform's `get_upload_info()` bag: the scalar fields
 * are required, `image_info` / `video_info` / `content_info` / `metadata` are
 * present but nullable (per file type), and `s3_bucket` is optional (foreign
 * buckets). Objects are non-strict, so unknown extra fields still validate.
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
    uuid: z.string(),
    file_id: z.string(),
    size: z.number(),
    done: z.number(),
    total: z.number(),
    original_filename: z.string(),
    filename: z.string(),
    mime_type: z.string(),
    is_image: z.boolean(),
    is_stored: z.boolean(),
    // The live API sends a boolean (not the string upload-client types); `false`
    // until the file is CDN-ready.
    is_ready: z.boolean(),
    image_info: ImageInfoSchema.nullable(),
    video_info: VideoInfoSchema.nullable(),
    content_info: ContentInfoSchema.nullable(),
    metadata: z.record(z.string(), z.string()).nullable(),
    s3_bucket: z.string().optional(),
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
