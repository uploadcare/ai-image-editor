import { afterEach, describe, expect, it, vi } from 'vitest';
import { validate } from './uploadcareApiClient.schemas.dev';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('uploadcare derivative API dev schema validation', () => {
  it('stays silent for a well-formed generate request body', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    validate('generate', {
      pub_key: 'pk',
      prompt: 'a hat',
      aspect_ratio: [16, 9],
      filename: 'generated.png',
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('reports a generate request missing required fields', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    validate('generate', { prompt: 'a hat' });
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]!.join(' ')).toMatch(/generate/);
  });

  it('stays silent for a well-formed edit request body', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    validate('edit', {
      pub_key: 'pk',
      prompt: 'remove the cat',
      source: 'abc-uuid',
      filename: 'edited.png',
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('reports an edit request without a source uuid', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    validate('edit', { pub_key: 'pk', prompt: 'x', filename: 'f.png' });
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]!.join(' ')).toMatch(/edit/);
  });

  it('stays silent for a well-formed job response', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    validate('job', { type: 'job', job_id: 'job-1' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('stays silent for the various success/processing/error status shapes', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    validate('status', { type: 'job', status: 'processing' });
    validate('status', { type: 'job', status: 'error', error_source: 'x', error_code: 'y', error: 'z' });
    validate('status', { status: 'success', uuid: 'u', original_filename: 'f.png', size: 123 });
    expect(spy).not.toHaveBeenCalled();
  });

  it('reports a status response with a wrong field type', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    validate('status', { status: 'success', uuid: 42 });
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]!.join(' ')).toMatch(/status/);
  });

  it('stays silent for a full FileInfo success bag', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    validate('status', {
      type: 'job',
      status: 'success',
      uuid: 'final-uuid',
      file_id: 'final-uuid',
      size: 12345,
      done: 12345,
      total: 12345,
      original_filename: 'generated.png',
      filename: 'generated.png',
      mime_type: 'image/png',
      is_image: true,
      is_stored: true,
      is_ready: true,
      image_info: {
        height: 512,
        width: 512,
        geo_location: null,
        datetime_original: null,
        format: 'PNG',
        color_mode: 'RGB',
        dpi: [72, 72],
        orientation: null,
        sequence: null,
      },
      video_info: null,
      content_info: { mime: { mime: 'image/png', type: 'image', subtype: 'png' } },
      metadata: { source: 'ai-enhancer' },
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('reports a success bag with a wrong-typed FileInfo field', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    validate('status', { status: 'success', uuid: 'u', is_image: 'yes' });
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]!.join(' ')).toMatch(/is_image/);
  });
});
