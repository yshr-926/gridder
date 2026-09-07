import type { Position } from '@/types';

export interface ViewportTransform {
  scale: number;
  offset: Position;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface WorldBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Convert a point in the viewport element to the infinite world space. */
export const screenToWorld = (point: Position, viewport: ViewportTransform): Position => ({
  x: (point.x - viewport.offset.x) / viewport.scale,
  y: (point.y - viewport.offset.y) / viewport.scale,
});

/** Convert a world-space point to the viewport element's coordinate space. */
export const worldToScreen = (point: Position, viewport: ViewportTransform): Position => ({
  x: point.x * viewport.scale + viewport.offset.x,
  y: point.y * viewport.scale + viewport.offset.y,
});

/** Convert world-space pixels to the containing grid cell. */
export const worldToGrid = (point: Position, gridSize: number): Position => ({
  x: Math.floor(point.x / gridSize),
  y: Math.floor(point.y / gridSize),
});

/** Convert a grid coordinate to its world-space origin. */
export const gridToWorld = (point: Position, gridSize: number): Position => ({
  x: point.x * gridSize,
  y: point.y * gridSize,
});

/** Convert a screen-space point directly to the containing grid cell. */
export const screenToGrid = (
  point: Position,
  viewport: ViewportTransform,
  gridSize: number
): Position => worldToGrid(screenToWorld(point, viewport), gridSize);

/**
 * Return the transform that changes scale while keeping the supplied screen
 * point anchored to the same world coordinate.
 */
export const zoomViewportAtPoint = (
  viewport: ViewportTransform,
  point: Position,
  scale: number
): ViewportTransform => {
  const worldPoint = screenToWorld(point, viewport);

  return {
    scale,
    offset: {
      x: point.x - worldPoint.x * scale,
      y: point.y - worldPoint.y * scale,
    },
  };
};

/** Calculate the world-space rectangle currently visible on screen. */
export const getVisibleWorldBounds = (
  viewport: ViewportTransform,
  size: ViewportSize,
  overscan = 0
): WorldBounds => {
  const start = screenToWorld({ x: 0, y: 0 }, viewport);
  const end = screenToWorld({ x: size.width, y: size.height }, viewport);

  return {
    left: start.x - overscan,
    top: start.y - overscan,
    right: end.x + overscan,
    bottom: end.y + overscan,
  };
};

/** An inclusive range of grid-line indices (cell edges) along each axis. */
export interface GridCellRange {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

/**
 * The grid-line index range that covers the visible world rectangle, rounded
 * *outward* to a multiple of `quantumCells` (issue #61, spec §14). Panning by
 * a sub-quantum amount therefore yields an identical range, so a consumer
 * that regenerates its grid lines from this range (`GridBackground`) does so
 * only when the viewport crosses a quantum boundary instead of every frame.
 * `quantumCells` of 1 gives the exact covering range.
 */
export const visibleCellRange = (
  viewport: ViewportTransform,
  size: ViewportSize,
  gridSize: number,
  quantumCells = 1
): GridCellRange => {
  const quantum = Math.max(1, Math.floor(quantumCells));
  const bounds = getVisibleWorldBounds(viewport, size);
  const floorTo = (value: number): number => Math.floor(value / quantum) * quantum;
  const ceilTo = (value: number): number => Math.ceil(value / quantum) * quantum;
  return {
    startX: floorTo(Math.floor(bounds.left / gridSize)),
    startY: floorTo(Math.floor(bounds.top / gridSize)),
    endX: ceilTo(Math.ceil(bounds.right / gridSize)),
    endY: ceilTo(Math.ceil(bounds.bottom / gridSize)),
  };
};
