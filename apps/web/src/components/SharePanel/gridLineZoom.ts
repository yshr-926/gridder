import { GRID_NORMAL_STROKE_WIDTH } from '@/components/Canvas';
import type { ShareImageScale } from '@/features/export-image';

/**
 * The `zoom` handed to `GridBackground` so the minor grid line is never
 * thinner than one device pixel in the export (issue #67 item 4).
 * `GridBackground` divides its screen-pixel widths by `zoom`, and the raster
 * multiplies them by `scale`, so the minor line ends up
 * `GRID_NORMAL_STROKE_WIDTH × scale / zoom` device pixels wide. Measured on
 * the 1x export, the uncorrected 0.5 px line covered a quarter of two pixel
 * columns each (RGB 249 on white) and the grid was effectively invisible; at
 * 2x and 3x the same line is 1 and 1.5 device pixels — the proportions a
 * Retina screen shows — and is left alone. The major line follows with the
 * same factor, so the 2:1 ratio between the two is preserved.
 */
export const gridLineZoomForScale = (scale: ShareImageScale): number =>
  Math.min(1, scale * GRID_NORMAL_STROKE_WIDTH);
