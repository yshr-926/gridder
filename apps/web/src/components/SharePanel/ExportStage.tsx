import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import type Konva from 'konva';
import type { EditorDocument } from '@gridder/editor-core';
import { GridBackground, ShapesLayer, DimensionLayer } from '@/components/Canvas';
import type { ExportCropRect } from '@/features/export-image';
import { visibleCellRange } from '@/features/viewport';

/**
 * Imperative handle for triggering the export raster (issue #56, spec §10).
 */
export interface ExportStageHandle {
  /**
   * Render the current document and return a data URL of exactly the drawing
   * range this Stage was sized to (see `cropRect` prop). `null` when the
   * Stage isn't mounted yet.
   */
  toDataUrl: (options: {
    readonly mimeType: string;
    readonly quality?: number;
    readonly pixelRatio: number;
  }) => string | null;
}

interface ExportStageProps {
  readonly document: EditorDocument;
  /** Pixel size of one grid cell, matching the live canvas's grid. */
  readonly gridSize: number;
  /** The drawing range in pixel space (see `drawingBoundsToCropRect`). */
  readonly cropRect: ExportCropRect;
  readonly includeGrid: boolean;
  readonly includeDimensions: boolean;
}

/** White background so JPEG (no alpha channel) never exports black (spec §10). */
const BACKGROUND_COLOR = '#ffffff';

/**
 * Off-screen Konva Stage dedicated to share-image export (issue #56, spec
 * §10). Reuses `GridBackground` / `ShapesLayer` / `DimensionLayer` verbatim —
 * none of those files are touched — but renders none of the interactive
 * overlay: no `EditorInteractionLayer`, no `SelectionOverlay`, no cursor or
 * handles. Dimensions, when included, are drawn for every shape (not just the
 * current canvas selection), since the exported image has no selection
 * concept of its own — `DimensionLayer`'s `selectedIds` prop is given the
 * full `zOrder` for that reason.
 *
 * The Stage is sized exactly to `cropRect` and every child layer is offset by
 * `-cropRect.x, -cropRect.y` so the drawing range's top-left lands at the
 * Stage's origin — `toDataUrl` then needs no `x`/`y`/`width`/`height` crop of
 * its own, only `pixelRatio`. Always mounted (so a real Stage/Layer exists to
 * call `toDataURL` on) but positioned off-screen via CSS rather than
 * `display:none`, which would give Konva a zero-size canvas to draw into.
 */
export const ExportStage = forwardRef<ExportStageHandle, ExportStageProps>(
  ({ document, gridSize, cropRect, includeGrid, includeDimensions }, ref) => {
    const stageRef = useRef<Konva.Stage>(null);

    useImperativeHandle(
      ref,
      () => ({
        toDataUrl: (options) => {
          const stage = stageRef.current;
          if (stage === null) {
            return null;
          }
          return stage.toDataURL({
            mimeType: options.mimeType,
            quality: options.quality,
            pixelRatio: options.pixelRatio,
          });
        },
      }),
      [],
    );

    const offsetX = -cropRect.x;
    const offsetY = -cropRect.y;
    const width = Math.max(1, Math.round(cropRect.width));
    const height = Math.max(1, Math.round(cropRect.height));
    // The grid lines covering exactly the crop rect, in cell indices.
    const gridRange = useMemo(
      () =>
        visibleCellRange(
          { scale: 1, offset: { x: offsetX, y: offsetY } },
          { width, height },
          gridSize
        ),
      [offsetX, offsetY, width, height, gridSize]
    );

    return (
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: '-100000px',
          pointerEvents: 'none',
        }}
      >
        <Stage ref={stageRef} width={width} height={height}>
          <Layer listening={false}>
            <Rect x={0} y={0} width={width} height={height} fill={BACKGROUND_COLOR} listening={false} />
          </Layer>
          {includeGrid && (
            <Layer listening={false} x={offsetX} y={offsetY}>
              <GridBackground
                startX={gridRange.startX}
                startY={gridRange.startY}
                endX={gridRange.endX}
                endY={gridRange.endY}
                gridSize={gridSize}
                zoom={1}
              />
            </Layer>
          )}
          <Layer listening={false} x={offsetX} y={offsetY}>
            <ShapesLayer document={document} gridSize={gridSize} scale={1} />
          </Layer>
          {includeDimensions && (
            <Layer listening={false} x={offsetX} y={offsetY}>
              <DimensionLayer
                document={document}
                selectedIds={document.zOrder}
                gridSize={gridSize}
                scale={1}
              />
            </Layer>
          )}
        </Stage>
      </div>
    );
  },
);

ExportStage.displayName = 'ExportStage';
