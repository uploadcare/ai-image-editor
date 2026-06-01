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
      image_url: 'https://ucarecdn.com/abc/',
      filename: 'edited.png',
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('reports an edit request without a source image url', () => {
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
});
