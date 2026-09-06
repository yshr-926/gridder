/**
 * Share-image export for the polygon document editor (issue #56, spec §10).
 * Distinct from the retired `features/export`, which serializes the
 * cell-based `GridObject` model — that module is untouched here and removed
 * in its own cleanup issue.
 */

export type ShareImageFormat = 'png' | 'jpeg';

export interface ShareImageOptions {
  readonly format: ShareImageFormat;
  /** Draw the grid onto the exported image (spec §10). */
  readonly includeGrid: boolean;
  /** Draw each shape's width × height annotation (spec §10). Off by default. */
  readonly includeDimensions: boolean;
  /** JPEG compression quality, 0..1. Ignored for PNG. */
  readonly quality: number;
  /** Device pixel ratio applied to the exported raster. */
  readonly pixelRatio: number;
}

export const DEFAULT_SHARE_IMAGE_OPTIONS: ShareImageOptions = {
  format: 'png',
  includeGrid: true,
  includeDimensions: false,
  quality: 0.92,
  pixelRatio: 2,
};
