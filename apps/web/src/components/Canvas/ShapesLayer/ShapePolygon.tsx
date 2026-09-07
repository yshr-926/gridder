import { memo, useCallback, useMemo } from 'react';
import { Shape } from 'react-konva';
import type { Context } from 'konva/lib/Context';
import type { Shape as KonvaShape } from 'konva/lib/Shape';
import type { EditorShape } from '@gridder/editor-core';
import { polygonToPixelPaths, type PixelRingPath } from './shapeGeometry';
import { DEFAULT_SHAPES_LAYER_THEME, type ShapesLayerTheme } from './shapesLayerTheme';

/**
 * ShapePolygon Props
 */
export interface ShapePolygonProps {
  /** The document shape to draw. */
  shape: EditorShape;
  /** Pixel size of one grid cell. */
  gridSize: number;
  /** Renderer theme; defaults to {@link DEFAULT_SHAPES_LAYER_THEME}. */
  theme?: ShapesLayerTheme;
}

/**
 * Trace the polygon (outer ring plus every hole) as one path. The caller fills
 * it with the `evenodd` rule so the inner rings punch holes out of the fill,
 * and a concave outer ring is drawn faithfully.
 */
const tracePolygonPath = (context: Context, ringPaths: readonly PixelRingPath[]): void => {
  context.beginPath();
  for (const ringPath of ringPaths) {
    if (ringPath.length < 2) {
      continue;
    }
    context.moveTo(ringPath[0], ringPath[1]);
    for (let i = 2; i < ringPath.length; i += 2) {
      context.lineTo(ringPath[i], ringPath[i + 1]);
    }
    context.closePath();
  }
};

/**
 * ShapePolygon renders exactly one Konva node per document shape: a custom
 * `Shape` whose `sceneFunc` paints the outer ring and any holes with an
 * `evenodd` fill, and whose `hitFunc` uses the same polygon path (widened by
 * `hitStrokeWidth`) so even thin shapes stay grabbable. `strokeScaleEnabled`
 * is off, so the border keeps a constant screen width while zooming.
 *
 * `perfectDrawEnabled` is off (issue #61, ADR-0005). Konva's default draws
 * every shape that has a fill *and* a stroke *and* an opacity below 1 into a
 * full-layer buffer canvas first, then composites that buffer onto the layer
 * — one full-screen clear + composite per shape. With the spec §14 baseline
 * (500 semi-transparent, bordered shapes) that raster work cost ~93 ms per
 * frame on the GPU side (measured: Konva-only `stage.draw()` flush 93 ms →
 * 4 ms once disabled), invisible to JS profiling and far past the 16.7 ms
 * frame budget in docs/performance.md §4; it also made the off-screen
 * `ExportStage` (SharePanel, issue #56) take ~4 s per document change. The
 * visual trade-off is sub-pixel: the inner half of the 1.5 px border now
 * blends over the fill instead of replacing it, so a semi-transparent
 * shape's border reads very slightly darker on its inside edge. The same
 * applies to the exported share image, which reuses this component.
 */
export const ShapePolygon = memo(
  ({ shape, gridSize, theme = DEFAULT_SHAPES_LAYER_THEME }: ShapePolygonProps) => {
    const ringPaths = useMemo(
      () => polygonToPixelPaths(shape.polygon, gridSize),
      [shape.polygon, gridSize]
    );

    const isBorderVisible = shape.style.isBorderVisible;

    const sceneFunc = useCallback(
      (context: Context, konvaShape: KonvaShape) => {
        tracePolygonPath(context, ringPaths);
        context.fillStrokeShape(konvaShape);
      },
      [ringPaths]
    );

    const hitFunc = useCallback(
      (context: Context, konvaShape: KonvaShape) => {
        tracePolygonPath(context, ringPaths);
        context.fillStrokeShape(konvaShape);
      },
      [ringPaths]
    );

    return (
      <Shape
        name={`shape-polygon-${shape.id}`}
        sceneFunc={sceneFunc}
        hitFunc={hitFunc}
        fill={shape.style.fill}
        opacity={shape.style.opacity}
        fillRule="evenodd"
        stroke={isBorderVisible ? theme.borderColor : undefined}
        strokeWidth={isBorderVisible ? theme.borderWidth : 0}
        strokeEnabled={isBorderVisible}
        strokeScaleEnabled={false}
        perfectDrawEnabled={false}
        hitStrokeWidth={theme.hitStrokeWidth}
      />
    );
  }
);

ShapePolygon.displayName = 'ShapePolygon';
