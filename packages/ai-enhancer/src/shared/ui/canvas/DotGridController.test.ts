import { describe, expect, it, vi } from 'vitest';
import type { ReactiveControllerHost } from 'lit';
import { DotGridController } from './DotGridController';

function fakeHost(): ReactiveControllerHost {
  return {
    addController: vi.fn(),
    removeController: vi.fn(),
    requestUpdate: vi.fn(),
    updateComplete: Promise.resolve(true),
  };
}

describe('DotGridController', () => {
  it('registers itself with the host', () => {
    const host = fakeHost();
    new DotGridController(host);
    expect(host.addController).toHaveBeenCalledOnce();
  });

  it('stays inert (never throws) when the canvas has no 2D context', () => {
    // happy-dom returns null from canvas.getContext, exercising the guard.
    const ctrl = new DotGridController(fakeHost());
    const surface = document.createElement('canvas');
    const viewport = document.createElement('div');
    const frame = document.createElement('div');

    expect(() => ctrl.attach({ surface, viewport, frame, getImage: () => null })).not.toThrow();
    expect(() => ctrl.sync({ shimmering: true, empty: false })).not.toThrow();
    expect(() => ctrl.sync({ shimmering: false, empty: true })).not.toThrow();
    expect(() => ctrl.onImageLoad()).not.toThrow();
    expect(() => ctrl.refreshColor()).not.toThrow();
    expect(() => ctrl.reset()).not.toThrow();
    expect(() => ctrl.hostDisconnected()).not.toThrow();
  });
});
