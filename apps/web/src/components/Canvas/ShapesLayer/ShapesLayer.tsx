import { memo, useMemo } from 'react';
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

/** An inspector opacity drag in progress (issue #45), or `undefined` when idle. */
export interface ShapesLayerOpacityPreview {
  readonly shapeIds: readonly string[];
  /** Live opacity in 0..1, replacing each listed shape's document value. */
  readonly opacity: number;
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
  /**
   * Live opacity from the inspector's slider (issue #45). When set, every
   * listed shape draws at this opacity instead of its own — the document is
   * not touched until the drag ends and commits one Command.
   */
  opacityPreview?: ShapesLayerOpacityPreview;
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

interface ShapeItemProps {
  readonly shape: EditorShape;
  readonly gridSize: number;
  readonly theme: ShapesLayerTheme;
  /** Live move-preview translation in world pixels (0 when the shape is not being dragged). */
  readonly offsetX: number;
  readonly offsetY: number;
}

/**
 * One shape's polygon node inside its move-preview group. Memoised so that a
 * re-render of `ShapesLayer` — a zoom, a selection change, another shape's
 * drag — touches only the items whose own props changed (issue #61): the
 * `shape` reference is stable for every shape not being previewed, and the
 * offsets are `0` for every shape not being moved.
 */
const ShapeItem = memo(({ shape, gridSize, theme, offsetX, offsetY }: ShapeItemProps) => (
  <Group name={`shape-move-group-${shape.id}`} x={offsetX} y={offsetY}>
    <ShapePolygon shape={shape} gridSize={gridSize} theme={theme} />
  </Group>
));
ShapeItem.displayName = 'ShapeItem';

interface ShapeAnnotationItemProps extends ShapeItemProps {
  readonly scale: number;
  /** The document's sketch-wide annotation font size (issue #66). */
  readonly fontSize: number;
}

/**
 * One shape's name annotation inside its move-preview group; see
 * {@link ShapeItem}. `fontSize` is the one document-level value the label
 * needs, handed over as a number so a document change that leaves the size
 * alone (a move elsewhere, a rename of another shape) never reaches it.
 */
const ShapeAnnotationItem = memo(
  ({ shape, gridSize, scale, fontSize, theme, offsetX, offsetY }: ShapeAnnotationItemProps) => (
    <Group name={`shape-annotation-move-group-${shape.id}`} x={offsetX} y={offsetY}>
      <ShapeAnnotation
        shape={shape}
        gridSize={gridSize}
        scale={scale}
        fontSize={fontSize}
        theme={theme}
      />
    </Group>
  )
);
ShapeAnnotationItem.displayName = 'ShapeAnnotationItem';

/**
 * ShapesLayer is the polygon renderer Adapter (ADR-0003): it consumes an
 * `EditorDocument` and draws one Konva polygon node per shape, in `zOrder`,
 * with the name annotation on top. Konva-specific concerns (custom shape,
 * hit region, theme) stay inside this folder; the document model has no Konva
 * types.
 *
 * Memoised end to end (issue #61, spec §14): the layer itself skips renders
 * whose props are unchanged (a pan never reaches it at all — see
 * `useStageViewport`), and every per-shape item is memoised so a zoom only
 * re-renders the annotations, a change to the sketch-wide annotation font
 * size (issue #66) re-renders every annotation but no polygon, and a move /
 * resize / vertex-edit / opacity preview only re-renders the shapes it names.
 * Preview props are resolved *per shape* into plain values (a stable `shape`
 * reference plus two numeric offsets) before they reach an item, so a preview
 * for one shape never invalidates another.
 */
export const ShapesLayer = memo(
  ({
    document,
    gridSize,
    scale,
    theme = DEFAULT_SHAPES_LAYER_THEME,
    movePreview,
    resizePreview,
    vertexPreview,
    opacityPreview,
  }: ShapesLayerProps) => {
    const orderedShapes = useMemo(() => resolveOrderedShapes(document), [document]);
    const annotationFontSize = document.annotationFontSize;

    const offsetFor = (shapeId: string): { x: number; y: number } => {
      if (movePreview === undefined || !movePreview.shapeIds.includes(shapeId)) {
        return { x: 0, y: 0 };
      }
      return { x: movePreview.delta.x * gridSize, y: movePreview.delta.y * gridSize };
    };

    /**
     * The shape to actually draw: unchanged, unless it is being resized
     * (issue #44), vertex/edge-edited (issue #50), or opacity-dragged in the
     * inspector (issue #45), in which case the previewed geometry or style is
     * swapped in — a Konva-only substitution that never touches `document`.
     * Returns the document's own object otherwise, so memoised items see the
     * same reference render after render.
     */
    const shapeToRender = (shape: EditorShape): EditorShape => {
      const previewed =
        opacityPreview !== undefined && opacityPreview.shapeIds.includes(shape.id)
          ? { ...shape, style: { ...shape.style, opacity: opacityPreview.opacity } }
          : shape;
      if (resizePreview !== undefined && resizePreview.shapeId === shape.id) {
        return {
          ...previewed,
          polygon: { outerRing: ringFromRect(resizePreview.bounds), innerRings: [] },
        };
      }
      if (vertexPreview !== undefined && vertexPreview.shapeId === shape.id) {
        return { ...previewed, polygon: vertexPreview.polygon };
      }
      return previewed;
    };

    return (
      <Group name="shapes-layer">
        {orderedShapes.map((shape) => {
          const offset = offsetFor(shape.id);
          return (
            <ShapeItem
              key={shape.id}
              shape={shapeToRender(shape)}
              gridSize={gridSize}
              theme={theme}
              offsetX={offset.x}
              offsetY={offset.y}
            />
          );
        })}
        {orderedShapes.map((shape) => {
          const offset = offsetFor(shape.id);
          return (
            <ShapeAnnotationItem
              key={shape.id}
              shape={shapeToRender(shape)}
              gridSize={gridSize}
              scale={scale}
              fontSize={annotationFontSize}
              theme={theme}
              offsetX={offset.x}
              offsetY={offset.y}
            />
          );
        })}
      </Group>
    );
  }
);

ShapesLayer.displayName = 'ShapesLayer';
