import { beforeEach, describe, expect, it } from 'vitest';
import { screenToWorld } from '@/features/viewport';
import { MAX_VIEWPORT_SCALE, MIN_VIEWPORT_SCALE, useViewportStore } from './viewportStore';

describe('useViewportStore', () => {
  beforeEach(() => {
    useViewportStore.getState().resetViewport();
  });

  it('pans without changing scale', () => {
    useViewportStore.getState().panBy({ x: 25, y: -10 });

    expect(useViewportStore.getState()).toMatchObject({
      scale: 1,
      offset: { x: 25, y: -10 },
    });
  });

  it('clamps scale to the supported range', () => {
    useViewportStore.getState().setScale(100);
    expect(useViewportStore.getState().scale).toBe(MAX_VIEWPORT_SCALE);

    useViewportStore.getState().setScale(0.001);
    expect(useViewportStore.getState().scale).toBe(MIN_VIEWPORT_SCALE);
  });

  it('keeps the cursor world point stable when zooming', () => {
    useViewportStore.getState().setOffset({ x: 30, y: -15 });
    const cursor = { x: 240, y: 160 };
    const before = screenToWorld(cursor, useViewportStore.getState());

    useViewportStore.getState().zoomAtPoint(cursor, 2);

    expect(screenToWorld(cursor, useViewportStore.getState())).toEqual(before);
  });
});
