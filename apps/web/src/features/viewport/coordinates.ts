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
