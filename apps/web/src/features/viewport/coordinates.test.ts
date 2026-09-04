import { describe, expect, it } from 'vitest';
import {
  getVisibleWorldBounds,
  gridToWorld,
  screenToGrid,
  screenToWorld,
  worldToScreen,
  worldToGrid,
  zoomViewportAtPoint,
} from './coordinates';

describe('viewport coordinates', () => {
  const viewport = {
    scale: 2,
    offset: { x: 40, y: -20 },
  };

  it('round-trips between screen and world coordinates', () => {
    const screenPoint = { x: 240, y: 180 };

    expect(worldToScreen(screenToWorld(screenPoint, viewport), viewport)).toEqual(screenPoint);
  });

  it('converts between world and grid coordinates', () => {
    expect(worldToGrid({ x: 39, y: -1 }, 20)).toEqual({ x: 1, y: -1 });
    expect(gridToWorld({ x: 3, y: -2 }, 20)).toEqual({ x: 60, y: -40 });
    expect(screenToGrid({ x: 119, y: 61 }, viewport, 20)).toEqual({
      x: 1,
      y: 2,
    });
  });

  it('keeps the world coordinate under the cursor fixed after zooming', () => {
    const cursor = { x: 320, y: 180 };
    const worldBefore = screenToWorld(cursor, viewport);

    const zoomedViewport = zoomViewportAtPoint(viewport, cursor, 1.25);

    expect(screenToWorld(cursor, zoomedViewport)).toEqual(worldBefore);
  });

  it('calculates visible world bounds with overscan', () => {
    expect(getVisibleWorldBounds(viewport, { width: 800, height: 600 }, 20)).toEqual({
      left: -40,
      top: -10,
      right: 400,
      bottom: 330,
    });
  });
});
