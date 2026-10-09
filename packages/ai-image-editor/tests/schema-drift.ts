import { afterEach, beforeEach, vi } from 'vitest';

/** The prefix `uploadcareApiClient.schemas.dev.ts` puts on every contract-drift report. */
const DRIFT = '[uploadcare-derivative-api]';

/**
 * Fails the test in which the dev-only schema validation reports a request or response that breaks the derivative
 * API contract. In the app that report is only a `console.error`; here it means the emulator (or the client) drifted
 * from the schema, which no assertion would otherwise notice. A test that spies on `console.error` itself replaces
 * this check for its own duration.
 */
export function failOnSchemaDrift(): void {
  let reports: unknown[][] = [];
  beforeEach(() => {
    reports = [];
    const log = console.error;
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].startsWith(DRIFT)) reports.push(args);
      log(...args);
    });
  });
  afterEach(() => {
    if (reports.length)
      throw new Error(`The derivative API schema validation failed:\n${reports.map(String).join('\n')}`);
  });
}
