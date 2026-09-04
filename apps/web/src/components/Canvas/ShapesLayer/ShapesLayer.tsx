import { useMemo } from 'react';
import { Group } from 'react-konva';
import type { EditorDocument, EditorShape, GridPoint } from '@gridder/editor-core';
import { ShapePolygon } from './ShapePolygon';
import { ShapeAnnotation } from './ShapeAnnotation';
import { DEFAULT_SHAPES_LAYER_THEME, type ShapesLayerTheme } from './shapesLayerTheme';

/** A shape-drag move in progress (issue #43), or `undefined` when idle. */
export interface ShapesLayerMovePreview {
  readonly shapeIds: readonly string[];
  /** Live offset in whole grid units, applied to each listed shape's node. */
  readonly delta: GridPoint;
}

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
  /**
   * Live move-gesture offset (issue #43, spec §14). When set, every listed
   * shape's Konva node is translated by `delta * gridSize` screen-space
   * pixels — the document is not touched until pointer-up commits a Command.
   */
  movePreview?: ShapesLayerMovePreview;
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
  movePreview,
}: ShapesLayerProps) => {
  const orderedShapes = useMemo(() => resolveOrderedShapes(document), [document]);

  const offsetFor = (shapeId: string): { x: number; y: number } => {
    if (movePreview === undefined || !movePreview.shapeIds.includes(shapeId)) {
      return { x: 0, y: 0 };
    }
    return { x: movePreview.delta.x * gridSize, y: movePreview.delta.y * gridSize };
  };

  return (
    <Group name="shapes-layer">
      {orderedShapes.map((shape) => {
        const offset = offsetFor(shape.id);
        return (
          <Group key={shape.id} name={`shape-move-group-${shape.id}`} x={offset.x} y={offset.y}>
            <ShapePolygon shape={shape} gridSize={gridSize} theme={theme} />
          </Group>
        );
      })}
      {orderedShapes.map((shape) => {
        const offset = offsetFor(shape.id);
        return (
          <Group
            key={shape.id}
            name={`shape-annotation-move-group-${shape.id}`}
            x={offset.x}
            y={offset.y}
          >
            <ShapeAnnotation shape={shape} gridSize={gridSize} scale={scale} theme={theme} />
          </Group>
        );
      })}
    </Group>
  );
};
