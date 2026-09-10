import { describe, expect, it } from 'vitest';
import {
  getVisibleWorldBounds,
  gridToWorld,
  screenToGrid,
  screenToWorld,
  visibleCellRange,
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

  describe('visibleCellRange', () => {
    const size = { width: 800, height: 600 };

    it('test_visibleCellRange_quantumOne_coversTheVisibleWorldExactly', () => {
      // scale 1, offset (-30, 10): world left = 30 -> cell 1 (floor), right = 830 -> 42 (ceil).
      const range = visibleCellRange({ scale: 1, offset: { x: -30, y: 10 } }, size, 20, 1);
      expect(range).toEqual({ startX: 1, startY: -1, endX: 42, endY: 30 });
    });

    it('test_visibleCellRange_quantum_roundsOutwardToMultiples', () => {
      const range = visibleCellRange({ scale: 1, offset: { x: -30, y: 10 } }, size, 20, 5);
      expect(range).toEqual({ startX: 0, startY: -5, endX: 45, endY: 30 });
    });

    it('test_visibleCellRange_subQuantumPan_yieldsIdenticalRange', () => {
      const before = visibleCellRange({ scale: 1, offset: { x: -30, y: 10 } }, size, 20, 5);
      const after = visibleCellRange({ scale: 1, offset: { x: -47, y: 3 } }, size, 20, 5);
      expect(after).toEqual(before);
    });

    it('test_visibleCellRange_crossingQuantumBoundary_shiftsRange', () => {
      const before = visibleCellRange({ scale: 1, offset: { x: 0, y: 0 } }, size, 20, 5);
      const after = visibleCellRange({ scale: 1, offset: { x: -101, y: 0 } }, size, 20, 5);
      expect(after.startX).toBe(before.startX + 5);
    });

    it('test_visibleCellRange_zoomedOut_growsWithTheVisibleArea', () => {
      const near = visibleCellRange({ scale: 1, offset: { x: 0, y: 0 } }, size, 20, 1);
      const far = visibleCellRange({ scale: 0.25, offset: { x: 0, y: 0 } }, size, 20, 1);
      expect(far.endX - far.startX).toBe(4 * (near.endX - near.startX));
    });
  });
});
