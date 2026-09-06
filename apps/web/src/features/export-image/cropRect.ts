import type { ResolvedDrawingBounds } from '@gridder/editor-core';

/** Pixel-space crop rectangle for Konva `Stage.toDataURL`. */
export interface ExportCropRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Convert a drawing range (grid units) to the pixel rectangle
 * `Stage.toDataURL({ x, y, width, height })` should crop to, at 1:1 (before
 * `pixelRatio` scaling — Konva applies that multiplier itself). The export
 * Stage always renders with no pan/zoom (scale 1, position 0,0), so this is
 * just the bounds multiplied by `gridSize`.
 */
export const drawingBoundsToCropRect = (
  bounds: ResolvedDrawingBounds,
  gridSize: number,
): ExportCropRect => ({
  x: bounds.min.x * gridSize,
  y: bounds.min.y * gridSize,
  width: (bounds.max.x - bounds.min.x) * gridSize,
  height: (bounds.max.y - bounds.min.y) * gridSize,
});
