/**
 * Recursively convert object keys from snake_case to camelCase.
 *
 * Vendored from `@uploadcare/api-client-utils` (which isn't published as a
 * standalone package) so we can turn the raw snake_case Upload API frame into
 * the camelCase `FileInfo` shape that `UploadcareFile` expects.
 */

/**
 * Type-level inverse of {@link camelizeKeys}: recursively rewrite an object's
 * camelCase keys to snake_case. Lets us describe a raw Upload API frame as the
 * snake_case form of a camelCase type such as upload-client's `FileInfo`.
 */
type SnakeCase<S extends string> = S extends `${infer Head}${infer Tail}`
  ? Head extends Uppercase<Head>
    ? Head extends Lowercase<Head>
      ? `${Head}${SnakeCase<Tail>}` // digit or other non-letter — kept as-is
      : `_${Lowercase<Head>}${SnakeCase<Tail>}` // uppercase letter — prefix an underscore
    : `${Head}${SnakeCase<Tail>}` // lowercase letter
  : S;

export type SnakeCasedPropertiesDeep<T> = T extends readonly (infer U)[]
  ? SnakeCasedPropertiesDeep<U>[]
  : T extends object
    ? { [K in keyof T as K extends string ? SnakeCase<K> : K]: SnakeCasedPropertiesDeep<T[K]> }
    : T;

const SEPARATOR = /\W|_/g;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function camelizeString(text: string): string {
  return text
    .split(SEPARATOR)
    .map((word, index) => (word ? word.charAt(0)[index > 0 ? 'toUpperCase' : 'toLowerCase']() + word.slice(1) : word))
    .join('');
}

export function camelizeKeys<T>(source: T): T {
  if (Array.isArray(source)) {
    return source.map((item) => camelizeKeys(item)) as unknown as T;
  }
  if (!isObject(source)) {
    return source;
  }
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    result[camelizeString(key)] = camelizeKeys(source[key]);
  }
  return result as T;
}
