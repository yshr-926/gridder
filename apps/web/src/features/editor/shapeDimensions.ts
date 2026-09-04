import {
  cellSizeOfPolygon,
  formatDimension,
  type CellSize,
  type GridPolygon,
  type PhysicalScale,
} from '@gridder/editor-core';

/**
 * Read-only dimension helpers for the contextual inspector and canvas
 * annotations (issue #45, #53).
 *
 * The actual bounding-box math and unit-aware formatting live in
 * `@gridder/editor-core`'s `dimensions` module (issue #53) so every surface —
 * this app's inspector, the canvas annotation layer, and editor-core itself —
 * agrees on the same numbers. This module just re-exports them under the
 * names the rest of `apps/web` already imports.
 */

export type ShapeCellSize = CellSize;

/** Bounding-box size of a polygon in whole grid cells. */
export const shapeCellSize = (polygon: GridPolygon): ShapeCellSize => cellSizeOfPolygon(polygon);

export { formatDimension, type PhysicalScale };
