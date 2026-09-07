import { memo, useMemo } from 'react';
import { Group, Text } from 'react-konva';
import type { EditorShape } from '@gridder/editor-core';
import { polygonBoundingBox } from './shapeGeometry';
import { isAnnotationLegible } from './annotationLegibility';
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
   * Current viewport scale. The annotation keeps a constant *screen* size:
   * the label is drawn at its screen font size inside a group scaled by
   * `1 / scale`, so zooming changes one group transform instead of
   * re-measuring the text.
   */
  scale: number;
  /** Renderer theme; defaults to {@link DEFAULT_SHAPES_LAYER_THEME}. */
  theme?: ShapesLayerTheme;
}

/** Rough on-screen width of the label, used only to centre it horizontally. */
const estimateLabelWidth = (text: string, fontSize: number): number => text.length * fontSize * 0.6;

/**
 * ShapeAnnotation draws a shape's name at the centre of its bounding box, at a
 * constant screen size regardless of zoom (spec §8). Memoised (issue #61):
 * with 500 shapes on screen, a move, resize, or selection change must not
 * re-render the 499 labels that did not change.
 */
export const ShapeAnnotation = memo(
  ({ shape, gridSize, scale, theme = DEFAULT_SHAPES_LAYER_THEME }: ShapeAnnotationProps) => {
    const name = shape.name;

    const box = useMemo(() => polygonBoundingBox(shape.polygon), [shape.polygon]);

    if (name === undefined || name.length === 0) {
      return null;
    }

    const safeScale = Math.max(scale, Number.EPSILON);
    const fontSize = theme.annotationFontSize;
    if (!isAnnotationLegible(box.width, box.height, gridSize, safeScale, fontSize)) {
      return null;
    }

    const inverseScale = 1 / safeScale;
    const labelWidth = estimateLabelWidth(name, fontSize);

    return (
      <Group
        name={`shape-annotation-${shape.id}`}
        x={(box.minX + box.width / 2) * gridSize}
        y={(box.minY + box.height / 2) * gridSize}
        scaleX={inverseScale}
        scaleY={inverseScale}
        listening={false}
      >
        <Text
          text={name}
          fontSize={fontSize}
          fontFamily={theme.annotationFontFamily}
          fill={theme.annotationColor}
          align="center"
          verticalAlign="middle"
          offsetX={labelWidth / 2}
          offsetY={fontSize / 2}
          listening={false}
        />
      </Group>
    );
  }
);

ShapeAnnotation.displayName = 'ShapeAnnotation';
