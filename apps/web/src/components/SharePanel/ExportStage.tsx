import { forwardRef, memo, useImperativeHandle, useMemo, useRef } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import type Konva from 'konva';
import type { EditorDocument } from '@gridder/editor-core';
import {
  DEFAULT_SHAPES_LAYER_THEME,
  GridBackground,
  ShapesLayer,
  DimensionLayer,
  type ShapesLayerTheme,
} from '@/components/Canvas';
import {
  shareImageOutputSize,
  type ExportCropRect,
  type ShareImageBackground,
  type ShareImageScale,
} from '@/features/export-image';
import { visibleCellRange } from '@/features/viewport';
import { gridLineZoomForScale } from './gridLineZoom';

/**
 * Imperative handle for producing the export raster (issue #56 / #67, spec §10).
 */
export interface ExportStageHandle {
  /**
   * Rasterise the scene this Stage previews at `scale` device pixels per
   * 1:1 pixel and return it as an encoded Blob of exactly
   * `shareImageOutputSize(cropRect, scale)`. `null` when the Stage isn't
   * mounted yet or the browser refused to encode (a canvas over its size
   * limit comes back as a `null` blob).
   */
  toBlob: (options: {
    readonly mimeType: string;
    readonly quality?: number;
    readonly scale: ShareImageScale;
  }) => Promise<Blob | null>;
}

interface ExportStageProps {
  readonly document: EditorDocument;
  /** Pixel size of one grid cell, matching the live canvas's grid. */
  readonly gridSize: number;
  /** The drawing range plus margin in pixel space (see `drawingBoundsToCropRect`). */
  readonly cropRect: ExportCropRect;
  readonly includeGrid: boolean;
  readonly includeDimensions: boolean;
  /** Effective background (already resolved for the format). */
  readonly background: ShareImageBackground;
  /**
   * Output scale the export will use. Part of the scene (not only of
   * `toBlob`) because the grid line width is corrected for it — see
   * {@link gridLineZoomForScale}.
   */
  readonly scale: ShareImageScale;
  /**
   * Scale at which the Stage is displayed as a preview, ≤ 1 (see
   * `shareImagePreviewScale`). The Stage's own canvases are this small; the
   * export raster is drawn into a fresh canvas at the requested scale.
   */
  readonly previewScale: number;
}

/** White background so JPEG (no alpha channel) never exports black (spec §10). */
const BACKGROUND_COLOR = '#ffffff';

/**
 * Konva Stage that both previews the share image and produces the export
 * raster (issue #56 / #67, spec §10). Reuses `GridBackground` /
 * `ShapesLayer` / `DimensionLayer` verbatim, but renders none of the
 * interactive overlay: no `EditorInteractionLayer`, no `SelectionOverlay`,
 * no cursor or handles. Dimensions, when included, are drawn for every shape
 * (not just the current canvas selection), since the exported image has no
 * selection concept of its own — `DimensionLayer`'s `selectedIds` prop is
 * given the full `zOrder` for that reason.
 *
 * Mounted only while the share panel is open (issue #67 item 2). The pre-#67
 * version was always mounted at the drawing range's full 1:1 size, which
 * for the spec §14 baseline meant four 12,360 × 14,440 px layer canvases
 * (about 2.8 GB of backing store at devicePixelRatio 2) living for the whole
 * session and being redrawn on every document commit. Here the Stage is
 * scaled to the preview box — `scaleX/scaleY = previewScale` — so its
 * canvases are a few hundred pixels across, and everything sits in a
 * single Layer so the export allocates one raster (plus Konva's buffer
 * canvas of the same size) instead of one per layer.
 *
 * The Layer is offset by `-cropRect.x, -cropRect.y` so the crop rect's
 * top-left lands at the Stage origin; `toBlob` then only needs the output
 * size and a `pixelRatio` of `scale / previewScale` to undo the preview
 * scale. Konva sizes the raster as `trunc(width × pixelRatio)`, so the
 * requested width is nudged by half a pixel: float error in
 * `size / pixelRatio × pixelRatio` then truncates to exactly `size` instead
 * of one pixel below it.
 *
 * Shape borders need one correction for this arrangement. `ShapePolygon`
 * draws its stroke with `strokeScaleEnabled` off, so Konva resets the
 * transform to the canvas `pixelRatio` alone and the stage scale never
 * reaches the stroke: the border would come out `borderWidth × scale /
 * previewScale` device pixels wide — 54 px on the spec §14 baseline at 1x
 * (previewScale ≈ 0.028). The theme handed to `ShapesLayer` therefore
 * pre-multiplies `borderWidth` by `previewScale`, which lands the export at
 * exactly `borderWidth × scale` device pixels (the same as the screen at
 * that device pixel ratio) and, as a side effect, makes the on-screen
 * preview a faithful shrink of the export instead of drawing every border
 * at full width over tiny shapes.
 */
export const ExportStage = memo(
  forwardRef<ExportStageHandle, ExportStageProps>(
    (
      {
        document,
        gridSize,
        cropRect,
        includeGrid,
        includeDimensions,
        background,
        scale,
        previewScale,
      },
      ref,
    ) => {
      const layerRef = useRef<Konva.Layer>(null);

      useImperativeHandle(
        ref,
        () => ({
          toBlob: async (options) => {
            const layer = layerRef.current;
            if (layer === null) {
              return null;
            }
            const size = shareImageOutputSize(cropRect, options.scale);
            const pixelRatio = options.scale / previewScale;
            const blob = await layer.toBlob({
              x: 0,
              y: 0,
              width: (size.width + 0.5) / pixelRatio,
              height: (size.height + 0.5) / pixelRatio,
              pixelRatio,
              mimeType: options.mimeType,
              quality: options.quality,
            });
            return blob instanceof Blob ? blob : null;
          },
        }),
        [cropRect, previewScale],
      );

      const shapesTheme = useMemo<ShapesLayerTheme>(
        () => ({
          ...DEFAULT_SHAPES_LAYER_THEME,
          borderWidth: DEFAULT_SHAPES_LAYER_THEME.borderWidth * previewScale,
        }),
        [previewScale],
      );

      const offsetX = -cropRect.x;
      const offsetY = -cropRect.y;
      const width = Math.max(1, cropRect.width * previewScale);
      const height = Math.max(1, cropRect.height * previewScale);
      // The grid lines covering exactly the crop rect, in cell indices.
      const gridRange = useMemo(
        () =>
          visibleCellRange(
            { scale: 1, offset: { x: offsetX, y: offsetY } },
            { width: cropRect.width, height: cropRect.height },
            gridSize,
          ),
        [offsetX, offsetY, cropRect.width, cropRect.height, gridSize],
      );

      return (
        <Stage width={width} height={height} scaleX={previewScale} scaleY={previewScale}>
          <Layer ref={layerRef} listening={false} x={offsetX} y={offsetY}>
            {background === 'white' && (
              <Rect
                name="share-image-background"
                x={cropRect.x}
                y={cropRect.y}
                width={cropRect.width}
                height={cropRect.height}
                fill={BACKGROUND_COLOR}
                listening={false}
              />
            )}
            {includeGrid && (
              <GridBackground
                startX={gridRange.startX}
                startY={gridRange.startY}
                endX={gridRange.endX}
                endY={gridRange.endY}
                gridSize={gridSize}
                zoom={gridLineZoomForScale(scale)}
                isBackgroundVisible={false}
              />
            )}
            <ShapesLayer document={document} gridSize={gridSize} scale={1} theme={shapesTheme} />
            {includeDimensions && (
              <DimensionLayer
                document={document}
                selectedIds={document.zOrder}
                gridSize={gridSize}
                scale={1}
              />
            )}
          </Layer>
        </Stage>
      );
    },
  ),
);

ExportStage.displayName = 'ExportStage';
