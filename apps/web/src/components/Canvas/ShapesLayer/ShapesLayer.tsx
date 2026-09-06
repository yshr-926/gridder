import { useMemo } from 'react';
import { Group } from 'react-konva';
import type { EditorDocument, EditorShape, GridPoint, GridPolygon } from '@gridder/editor-core';
import { ringFromRect, type GridRect } from '@/features/editor';
import { ShapePolygon } from './ShapePolygon';
import { ShapeAnnotation } from './ShapeAnnotation';
import { DEFAULT_SHAPES_LAYER_THEME, type ShapesLayerTheme } from './shapesLayerTheme';

/** A shape-drag move in progress (issue #43), or `undefined` when idle. */
export interface ShapesLayerMovePreview {
  readonly shapeIds: readonly string[];
  /** Live offset in whole grid units, applied to each listed shape's node. */
  readonly delta: GridPoint;
}

/** A rectangle resize in progress (issue #44), or `undefined` when idle. */
export interface ShapesLayerResizePreview {
  readonly shapeId: string;
  /** Live flip-normalised bounds, replacing the shape's document geometry. */
  readonly bounds: GridRect;
}

/** A vertex or edge drag in progress (issue #50), or `undefined` when idle. */
export interface ShapesLayerVertexPreview {
  readonly shapeId: string;
  /** Live proposed polygon, replacing the shape's document geometry. */
  readonly polygon: GridPolygon;
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
  /**
   * Live resize-gesture bounds (issue #44, spec §14). When set, the listed
   * shape's Konva node is redrawn from these bounds instead of its document
   * polygon — the document is not touched until pointer-up commits a Command.
   */
  resizePreview?: ShapesLayerResizePreview;
  /**
   * Live vertex/edge-edit polygon (issue #50, spec §14). When set, the listed
   * shape's Konva node is redrawn from this polygon instead of its document
   * geometry — the document is not touched until pointer-up commits a
   * Command (or the edit is rejected and nothing commits).
   */
  vertexPreview?: ShapesLayerVertexPreview;
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
  resizePreview,
  vertexPreview,
}: ShapesLayerProps) => {
  const orderedShapes = useMemo(() => resolveOrderedShapes(document), [document]);

  const offsetFor = (shapeId: string): { x: number; y: number } => {
    if (movePreview === undefined || !movePreview.shapeIds.includes(shapeId)) {
      return { x: 0, y: 0 };
    }
    return { x: movePreview.delta.x * gridSize, y: movePreview.delta.y * gridSize };
  };

  /**
   * The shape to actually draw: unchanged, unless it is the one shape being
   * resized (issue #44) or vertex/edge-edited (issue #50), in which case its
   * polygon is swapped for the live preview — a Konva-only substitution that
   * never touches `document`.
   */
  const shapeToRender = (shape: EditorShape): EditorShape => {
    if (resizePreview !== undefined && resizePreview.shapeId === shape.id) {
      return {
        ...shape,
        polygon: { outerRing: ringFromRect(resizePreview.bounds), innerRings: [] },
      };
    }
    if (vertexPreview !== undefined && vertexPreview.shapeId === shape.id) {
      return { ...shape, polygon: vertexPreview.polygon };
    }
    return shape;
  };

  return (
    <Group name="shapes-layer">
      {orderedShapes.map((shape) => {
        const offset = offsetFor(shape.id);
        return (
          <Group key={shape.id} name={`shape-move-group-${shape.id}`} x={offset.x} y={offset.y}>
            <ShapePolygon shape={shapeToRender(shape)} gridSize={gridSize} theme={theme} />
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
            <ShapeAnnotation
              shape={shapeToRender(shape)}
              gridSize={gridSize}
              scale={scale}
              theme={theme}
            />
          </Group>
        );
      })}
    </Group>
  );
};
