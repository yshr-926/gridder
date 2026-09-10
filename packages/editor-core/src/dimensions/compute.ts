import type { GridPoint, GridPolygon, PhysicalScale } from '../model.js';

/**
 * Width / height computation and unit-aware formatting for `@gridder/editor-core`
 * (issue #53, spec §8). A shape's displayed size — in the canvas annotation, the
 * inspector, and anywhere else — always comes from this module so every surface
 * agrees on "N セル" vs a physical length.
 */

export interface CellSize {
  /** Bounding-box width in whole grid cells. */
  readonly widthCells: number;
  /** Bounding-box height in whole grid cells. */
  readonly heightCells: number;
}

/** Bounding-box size of a set of grid vertices, in whole grid cells. Empty input is `0 x 0`. */
export const cellSizeOfVertices = (vertices: readonly GridPoint[]): CellSize => {
  if (vertices.length === 0) {
    return { widthCells: 0, heightCells: 0 };
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of vertices) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return {
    widthCells: Math.max(0, Math.round(maxX - minX)),
    heightCells: Math.max(0, Math.round(maxY - minY)),
  };
};

/** Bounding-box size of a polygon's outer ring, in whole grid cells. */
export const cellSizeOfPolygon = (polygon: GridPolygon): CellSize =>
  cellSizeOfVertices(polygon.outerRing);

/** Drop trailing zeros from a fixed-precision physical length. */
const formatNumber = (value: number): string => {
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
};

/**
 * Format one axis of a size for display. With no scale it reads `"3 セル"`;
 * with a scale it reads e.g. `"30 cm"` (cells × valuePerCell, unit-suffixed).
 */
export const formatDimension = (cells: number, scale: PhysicalScale | undefined): string => {
  if (scale === undefined) {
    return `${cells} セル`;
  }
  return `${formatNumber(cells * scale.valuePerCell)} ${scale.unit}`;
};
