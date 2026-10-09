/**
 * A `derivative/status/` success frame production sent, verbatim: no `type` on success, and for an image file
 * `image_info` and `content_info.image` present, `video_info` null. The only frame of the derivative API recorded
 * from the real API, so the one fixture the emulator's derivative routes can be held to.
 */
export const PRODUCTION_STATUS_SUCCESS = {
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
};

/** `value` with every leaf replaced by its JSON type (`'null'` and `'array'` kept apart), so two frames compare by shape. */
export const shapeOf = (value: unknown): unknown => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value !== 'object') return typeof value;
  return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, shapeOf(inner)]));
};
