import type { ExportCropRect } from './cropRect';
import type { ShareImageScale } from './types';

/** Pixel dimensions of an exported share image. */
export interface ShareImageSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Practical ceiling on the exported raster (issue #67 item 1).
 *
 * The hard limits are the browser's canvas limits, which `toBlob` /
 * `toDataURL` hit silently — the canvas comes back blank or the encoder
 * returns nothing. Per canvas-size's measurements
 * (https://github.com/jhildenbiddle/canvas-size#test-results): Chromium
 * allows 65,535 px per side but only 16,384 × 16,384 px of area
 * (268,435,456 px, 1 GiB of RGBA); Firefox 32,767 px per side and about
 * 23,168² of area; desktop Safari 16,384² of area (iOS 4,096²). Spec §2 makes
 * Chromium the required environment, so its 16,384 px side is the outer
 * bound here.
 *
 * The area limit is set well below Chromium's because the raster is not the
 * only allocation: Konva's `toCanvas` also creates a buffer canvas of the
 * same size, the PNG/JPEG encoder needs the bitmap again, and a 1 GiB
 * bitmap takes many seconds to encode on the main thread. 8,192 × 8,192 px
 * (64 megapixels, 256 MiB RGBA) is a quarter of Chromium's area limit and
 * keeps the spec §14 baseline document (309 × 361 cells → 6,180 × 7,220 px
 * at 1x, 44.6 MP) exportable at 1x while rejecting its 2x (178 MP) and 3x
 * (401 MP, past Chromium's own limit) rasters. Measured in the dev build on
 * the reference machine, that 1x baseline export took 0.45 s from click to
 * download, with a single 0.28 s main-thread frame for the scene draw and
 * the PNG encoding off the main thread (`canvas.toBlob`).
 */
export const MAX_SHARE_IMAGE_SIDE_PX = 16_384;
export const MAX_SHARE_IMAGE_AREA_PX = 8_192 * 8_192;

/**
 * The pixel size a crop rect exports to at `scale`. Rounded, because the
 * crop rect is whole cells times an integer `gridSize`, so the result is an
 * integer already and rounding only guards against float noise.
 */
export const shareImageOutputSize = (
  cropRect: ExportCropRect,
  scale: ShareImageScale,
): ShareImageSize => ({
  width: Math.max(1, Math.round(cropRect.width * scale)),
  height: Math.max(1, Math.round(cropRect.height * scale)),
});

/** Whether a size stays within {@link MAX_SHARE_IMAGE_SIDE_PX} / {@link MAX_SHARE_IMAGE_AREA_PX}. */
export const isShareImageSizeExportable = (size: ShareImageSize): boolean =>
  size.width <= MAX_SHARE_IMAGE_SIDE_PX &&
  size.height <= MAX_SHARE_IMAGE_SIDE_PX &&
  size.width * size.height <= MAX_SHARE_IMAGE_AREA_PX;

/** Human-readable size, e.g. `2400 × 1800 px`. */
export const formatShareImageSize = (size: ShareImageSize): string =>
  `${size.width} × ${size.height} px`;

/**
 * Uniform scale that fits a crop rect inside a preview box without
 * enlarging it past 1:1 (issue #67 item 2). A sketch smaller than the box
 * is previewed at its actual 1x size rather than blown up.
 */
export const shareImagePreviewScale = (
  cropRect: ExportCropRect,
  box: ShareImageSize,
): number =>
  Math.min(1, box.width / Math.max(1, cropRect.width), box.height / Math.max(1, cropRect.height));
