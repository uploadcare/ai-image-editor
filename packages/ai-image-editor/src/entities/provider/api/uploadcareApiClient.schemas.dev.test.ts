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
    validate('status', {
      status: 'success',
      uuid: 'u',
      file_id: 'u',
      size: 123,
      done: 123,
      total: 123,
      original_filename: 'f.png',
      filename: 'f.png',
      mime_type: 'image/png',
      is_image: true,
      is_stored: false,
      is_ready: true,
      image_info: null,
      video_info: null,
      content_info: null,
      metadata: {},
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('reports a status response with a wrong field type', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    validate('status', { status: 'success', uuid: 42, is_ready: true });
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]!.join(' ')).toMatch(/status/);
  });

  it('stays silent for a full FileInfo success bag', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    validate('status', {
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
      metadata: { source: 'ai-image-editor' },
    });
    expect(spy).not.toHaveBeenCalled();
  });

  // A verbatim `derivative/status/` success frame from production (no `type` on
  // success; image file → image_info + content_info.image present, video_info null).
  it('stays silent for a real derivative status success frame', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    validate('status', {
      size: 1620930,
      total: 1620930,
      done: 1620930,
      uuid: '2e0c4294-32e0-4999-aed1-e78221224339',
      file_id: '2e0c4294-32e0-4999-aed1-e78221224339',
      original_filename: 'generated.png',
      is_image: true,
      is_stored: false,
      image_info: {
        dpi: null,
        width: 1248,
        format: 'PNG',
        height: 832,
        sequence: false,
        color_mode: 'RGB',
        orientation: null,
        geo_location: null,
        datetime_original: null,
      },
      video_info: null,
      content_info: {
        mime: { mime: 'image/png', type: 'image', subtype: 'png' },
        image: {
          dpi: null,
          width: 1248,
          format: 'PNG',
          height: 832,
          sequence: false,
          color_mode: 'RGB',
          orientation: null,
          geo_location: null,
          datetime_original: null,
        },
      },
      is_ready: true,
      filename: 'generated.png',
      mime_type: 'image/png',
      metadata: {},
      status: 'success',
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('reports a success bag with a wrong-typed FileInfo field', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    validate('status', { status: 'success', uuid: 'u', is_ready: true, is_image: 'yes' });
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]!.join(' ')).toMatch(/is_image/);
  });
});
