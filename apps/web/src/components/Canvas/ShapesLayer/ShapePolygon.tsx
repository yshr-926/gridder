import { useCallback, useMemo } from 'react';
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
 */
export const ShapePolygon = ({
  shape,
  gridSize,
  theme = DEFAULT_SHAPES_LAYER_THEME,
}: ShapePolygonProps) => {
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
      hitStrokeWidth={theme.hitStrokeWidth}
    />
  );
};
