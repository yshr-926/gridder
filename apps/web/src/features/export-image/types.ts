/**
 * Share-image export for the polygon document editor (issue #56 / #67, spec
 * §10). Distinct from the retired `features/export`, which serializes the
 * cell-based `GridObject` model — that module is untouched here and removed
 * in its own cleanup issue.
 */

export type ShareImageFormat = 'png' | 'jpeg';

/**
 * Background painted under the sketch (issue #67 item 6, spec §10). Only PNG
 * carries an alpha channel; see {@link resolveShareImageBackground} for what
 * `transparent` means once JPEG is selected.
 */
export type ShareImageBackground = 'white' | 'transparent';

/**
 * Output scale relative to the on-screen 1:1 rendering (issue #67 item 1):
 * the exported image is `scale` device pixels per screen pixel at zoom 1, so
 * 2 matches what a Retina display shows. Presented to the user as "1x / 2x /
 * 3x" next to the resulting pixel size rather than as a target long side,
 * because the size the user reasons about is "how much sharper than my
 * screen", and the concrete pixel count is always displayed alongside.
 */
export type ShareImageScale = 1 | 2 | 3;

export const SHARE_IMAGE_SCALES: readonly ShareImageScale[] = [1, 2, 3];

/**
 * Margin added around the drawing range (issue #67 item 3), in whole cells
 * so the grid — when included — continues naturally into the margin instead
 * of stopping at the shapes' bounding box.
 */
export type ShareImageMargin = 'none' | 'small' | 'medium';

export const SHARE_IMAGE_MARGINS: readonly ShareImageMargin[] = ['none', 'small', 'medium'];

export const SHARE_IMAGE_MARGIN_CELLS: Readonly<Record<ShareImageMargin, number>> = {
  none: 0,
  small: 1,
  medium: 2,
};

export interface ShareImageOptions {
  readonly format: ShareImageFormat;
  /** Draw the grid onto the exported image (spec §10). */
  readonly includeGrid: boolean;
  /** Draw each shape's width × height annotation (spec §10). Off by default. */
  readonly includeDimensions: boolean;
  /** JPEG compression quality, 0..1. Ignored for PNG. */
  readonly quality: number;
  /** Output scale; see {@link ShareImageScale}. */
  readonly scale: ShareImageScale;
  /** Margin around the drawing range; see {@link ShareImageMargin}. */
  readonly margin: ShareImageMargin;
  /** Requested background; see {@link resolveShareImageBackground}. */
  readonly background: ShareImageBackground;
}

/**
 * Defaults keep the pre-#67 behaviour: no margin (the drawing range is cut
 * exactly), a white background (spec §10), and the 2x raster that was
 * previously hard-coded.
 */
export const DEFAULT_SHARE_IMAGE_OPTIONS: ShareImageOptions = {
  format: 'png',
  includeGrid: true,
  includeDimensions: false,
  quality: 0.92,
  scale: 2,
  margin: 'none',
  background: 'white',
};

/**
 * The background actually painted for a format. JPEG has no alpha channel,
 * so a transparent request is painted white there — the user's choice is
 * kept (the panel shows the transparent option disabled while JPEG is
 * selected) and takes effect again when they switch back to PNG, rather
 * than being silently reset.
 */
export const resolveShareImageBackground = (
  format: ShareImageFormat,
  background: ShareImageBackground
): ShareImageBackground => (format === 'jpeg' ? 'white' : background);
