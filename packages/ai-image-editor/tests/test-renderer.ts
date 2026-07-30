import { page } from 'vitest/browser';
import { beforeEach } from 'vitest';

const containers = new Set<HTMLElement>();

function render(input: HTMLElement | string): HTMLElement {
  const container = document.createElement('div');
  containers.add(container);
  if (typeof input === 'string') {
    container.innerHTML = input;
  } else {
    container.appendChild(input);
  }
  document.body.appendChild(container);
  return container;
}

export function cleanup(): void {
  for (const container of containers) {
    container.remove();
  }
  containers.clear();
}

page.extend({
  render,
  [Symbol.for('vitest:component-cleanup')]: cleanup,
});

beforeEach(() => {
  cleanup();
});

declare module 'vitest/browser' {
  interface BrowserPage {
    render: typeof render;
  }
}

export function getCtxName(): string {
  return `test-${Math.random().toString(36).slice(2)}`;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
