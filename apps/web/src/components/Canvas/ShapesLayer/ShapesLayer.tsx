import { useMemo } from 'react';
import { Group } from 'react-konva';
import type { EditorDocument, EditorShape } from '@gridder/editor-core';
import { ShapePolygon } from './ShapePolygon';
import { ShapeAnnotation } from './ShapeAnnotation';
import { DEFAULT_SHAPES_LAYER_THEME, type ShapesLayerTheme } from './shapesLayerTheme';

/**
 * ShapesLayer Props
 */
export interface ShapesLayerProps {
  /** The editor-core document snapshot to render. */
  document: EditorDocument;
  /** Pixel size of one grid cell. */
  gridSize: number;
  /** Current viewport scale, forwarded to the zoom-invariant annotations. */
  scale: number;
  /** Renderer theme; defaults to {@link DEFAULT_SHAPES_LAYER_THEME}. */
  theme?: ShapesLayerTheme;
}

/**
 * Resolve the document's `zOrder` (back-to-front shape IDs) to shape records,
 * skipping any ID with no matching shape. React renders children in array
 * order, so the first entry paints first and ends up at the back.
 */
const resolveOrderedShapes = (document: EditorDocument): readonly EditorShape[] => {
  const ordered: EditorShape[] = [];
  for (const shapeId of document.zOrder) {
    const shape = document.shapes[shapeId];
    if (shape !== undefined) {
      ordered.push(shape);
    }
  }
  return ordered;
};

/**
 * ShapesLayer is the polygon renderer Adapter (ADR-0003): it consumes an
 * `EditorDocument` and draws one Konva polygon node per shape, in `zOrder`,
 * with the name annotation on top. Konva-specific concerns (custom shape,
 * hit region, theme) stay inside this folder; the document model has no Konva
 * types.
 */
export const ShapesLayer = ({
  document,
  gridSize,
  scale,
  theme = DEFAULT_SHAPES_LAYER_THEME,
}: ShapesLayerProps) => {
  const orderedShapes = useMemo(() => resolveOrderedShapes(document), [document]);

  return (
    <Group name="shapes-layer">
      {orderedShapes.map((shape) => (
        <ShapePolygon
          key={shape.id}
          shape={shape}
          gridSize={gridSize}
          theme={theme}
        />
      ))}
      {orderedShapes.map((shape) => (
        <ShapeAnnotation
          key={shape.id}
          shape={shape}
          gridSize={gridSize}
          scale={scale}
          theme={theme}
        />
      ))}
    </Group>
  );
};
