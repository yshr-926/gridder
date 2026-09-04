import { useMemo } from 'react';
import { Text } from 'react-konva';
import type { EditorShape } from '@gridder/editor-core';
import { polygonCenterPixel } from './shapeGeometry';
import { DEFAULT_SHAPES_LAYER_THEME, type ShapesLayerTheme } from './shapesLayerTheme';

/**
 * ShapeAnnotation Props
 */
export interface ShapeAnnotationProps {
  /** The document shape whose name is annotated. */
  shape: EditorShape;
  /** Pixel size of one grid cell. */
  gridSize: number;
  /**
   * Current viewport scale. The annotation keeps a constant *screen* size, so
   * the world-space font size and offsets are divided by this value.
   */
  scale: number;
  /** Renderer theme; defaults to {@link DEFAULT_SHAPES_LAYER_THEME}. */
  theme?: ShapesLayerTheme;
}

/** Rough on-screen width of the label, used only to centre it horizontally. */
const estimateLabelWidth = (text: string, fontSize: number): number =>
  text.length * fontSize * 0.6;

/**
 * ShapeAnnotation draws a shape's name at the centre of its bounding box. The
 * name is always shown (spec §8) and stays readable at any zoom because the
 * font size is expressed in screen pixels and converted back to world units.
 */
export const ShapeAnnotation = ({
  shape,
  gridSize,
  scale,
  theme = DEFAULT_SHAPES_LAYER_THEME,
}: ShapeAnnotationProps) => {
  const name = shape.name;

  const center = useMemo(
    () => polygonCenterPixel(shape.polygon, gridSize),
    [shape.polygon, gridSize]
  );

  if (name === undefined || name.length === 0) {
    return null;
  }

  const safeScale = Math.max(scale, Number.EPSILON);
  const worldFontSize = theme.annotationFontSize / safeScale;
  const worldWidth = estimateLabelWidth(name, theme.annotationFontSize) / safeScale;

  return (
    <Text
      name={`shape-annotation-${shape.id}`}
      x={center.x}
      y={center.y}
      text={name}
      fontSize={worldFontSize}
      fontFamily={theme.annotationFontFamily}
      fill={theme.annotationColor}
      align="center"
      verticalAlign="middle"
      offsetX={worldWidth / 2}
      offsetY={worldFontSize / 2}
      listening={false}
    />
  );
};
