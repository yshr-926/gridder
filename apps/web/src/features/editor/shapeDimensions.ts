import type { GridPolygon, PhysicalScale } from '@gridder/editor-core';
import { polygonBounds } from './hitTest';

/**
 * Read-only dimension helpers for the contextual inspector (issue #45).
 *
 * A shape's width and height are derived from its polygon's bounding box in
 * whole grid cells. When the sketch has no real-world scale the inspector shows
 * a plain cell count; once a {@link PhysicalScale} is set it shows the physical
 * length with its unit. Nothing here mutates the document — the inspector only
 * displays these values.
 */

export interface ShapeCellSize {
  /** Bounding-box width in grid cells. */
  readonly widthCells: number;
  /** Bounding-box height in grid cells. */
  readonly heightCells: number;
}

/** Bounding-box size of a polygon in whole grid cells. */
export const shapeCellSize = (polygon: GridPolygon): ShapeCellSize => {
  const bounds = polygonBounds(polygon);
  return {
    widthCells: Math.max(0, Math.round(bounds.maxX - bounds.minX)),
    heightCells: Math.max(0, Math.round(bounds.maxY - bounds.minY)),
  };
};

/** Drop trailing zeros from a fixed-precision physical length. */
const formatNumber = (value: number): string => {
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
};

/**
 * Format one axis of a shape's size for display. With no scale it reads
 * `"3 セル"`; with a scale it reads e.g. `"30 cm"` (cells × valuePerCell).
 */
export const formatDimension = (
  cells: number,
  scale: PhysicalScale | undefined,
): string => {
  if (scale === undefined) {
    return `${cells} セル`;
  }
  return `${formatNumber(cells * scale.valuePerCell)} ${scale.unit}`;
};
