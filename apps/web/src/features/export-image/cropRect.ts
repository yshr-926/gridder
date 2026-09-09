import type { ResolvedDrawingBounds } from '@gridder/editor-core';

/** Pixel-space crop rectangle for the share-image raster. */
export interface ExportCropRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Convert a drawing range (grid units) to the pixel rectangle the share
 * image covers at 1:1 (before the output scale — the raster applies that
 * multiplier itself). The export scene renders with no pan/zoom (scale 1,
 * position 0,0), so this is the bounds multiplied by `gridSize`, grown by
 * `marginCells` whole cells on every side (issue #67 item 3) so the picture
 * keeps some grid around the shapes instead of cutting them at the edge.
 */
export const drawingBoundsToCropRect = (
  bounds: ResolvedDrawingBounds,
  gridSize: number,
  marginCells = 0,
): ExportCropRect => ({
  x: (bounds.min.x - marginCells) * gridSize,
  y: (bounds.min.y - marginCells) * gridSize,
  width: (bounds.max.x - bounds.min.x + marginCells * 2) * gridSize,
  height: (bounds.max.y - bounds.min.y + marginCells * 2) * gridSize,
});
