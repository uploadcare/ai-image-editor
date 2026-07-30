import { afterEach } from 'vitest';

/**
 * Per-file DOM container factory with automatic afterEach cleanup. Call at
 * module scope, then use the returned factory inside tests.
 */
export function setupContainers(): () => HTMLElement {
  const containers: HTMLElement[] = [];

  afterEach(() => {
    for (const container of containers.splice(0)) container.remove();
  });

  return () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    containers.push(container);
    return container;
  };
}
