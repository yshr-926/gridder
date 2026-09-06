import { useCallback, useMemo } from 'react';
import { Group, Line, Shape } from 'react-konva';
import type { Context } from 'konva/lib/Context';
import type { Shape as KonvaShape } from 'konva/lib/Shape';
import type { EditorDocument, EditorShape, GridPolygon } from '@gridder/editor-core';
import {
  DEFAULT_SHAPES_LAYER_THEME,
  polygonBoundingBox,
  polygonToPixelPaths,
  type PixelRingPath,
  type ShapesLayerTheme,
} from '../ShapesLayer';

/**
 * ShapeEditLayer Props
 */
export interface ShapeEditLayerProps {
  /** Current document snapshot — every shape but the edited one gets dimmed. */
  document: EditorDocument;
  /** The shape being cell-edited. */
  shapeId: string;
  /**
   * The edited shape's live working polygons (issue #49, spec §14) — from
   * `useShapeEditPreviewStore`, reflecting every stroke applied so far, not
   * the document's pre-edit geometry. Drawn here in the shape's own style,
   * on top of its now-hidden pre-edit rendering; usually one polygon, more
   * than one while a `difference` stroke has disconnected the shape.
   */
  workingPolygons: readonly GridPolygon[];
  /** Pixel size of one grid cell. */
  gridSize: number;
  /** Renderer theme; defaults to {@link DEFAULT_SHAPES_LAYER_THEME}. */
  theme?: ShapesLayerTheme;
}

/** Dimming overlay colour and opacity — a neutral wash, not the accent. */
const DIM_FILL = 'rgba(255, 255, 255, 0.7)';
/** Cell-boundary grid line colour over the edited shape's footprint. */
const CELL_GRID_COLOR = 'rgba(37, 99, 235, 0.35)';
const CELL_GRID_STROKE_WIDTH_SCREEN = 1;
/** Extra cells of margin drawn around the edited shape's own bounding box. */
const GRID_MARGIN_CELLS = 1;

/** Trace every ring of a polygon (outer + holes) as one evenodd-fillable path. */
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
 * One dimming overlay for a single shape, drawn as a translucent evenodd
 * fill over its exact outline (issue #49 "編集対象以外の図形は薄く表示"). A
 * per-shape polygon fill — rather than one canvas-wide overlay with a
 * cutout — keeps concave shapes and holes exact without touching
 * `ShapesLayer`. Reused to hide the edited shape's own stale (pre-edit)
 * rendering too, at full opacity, so it doesn't show through where the live
 * working polygons have shrunk away from it.
 */
const DimmedShape = ({
  polygon,
  gridSize,
  opacity = 1,
}: {
  polygon: GridPolygon;
  gridSize: number;
  opacity?: number;
}) => {
  const ringPaths = useMemo(() => polygonToPixelPaths(polygon, gridSize), [polygon, gridSize]);

  const sceneFunc = useCallback(
    (context: Context, konvaShape: KonvaShape) => {
      tracePolygonPath(context, ringPaths);
      context.fillStrokeShape(konvaShape);
    },
    [ringPaths]
  );

  return <Shape sceneFunc={sceneFunc} fill={DIM_FILL} opacity={opacity} fillRule="evenodd" listening={false} />;
};

/**
 * The edited shape's live geometry, in its own style, drawn on top of its
 * hidden pre-edit rendering (issue #49). One node per working polygon, so a
 * `difference` stroke that has disconnected the shape previews every piece.
 */
const EditedShape = ({
  polygon,
  style,
  gridSize,
  theme,
}: {
  polygon: GridPolygon;
  style: EditorShape['style'];
  gridSize: number;
  theme: ShapesLayerTheme;
}) => {
  const ringPaths = useMemo(() => polygonToPixelPaths(polygon, gridSize), [polygon, gridSize]);

  const sceneFunc = useCallback(
    (context: Context, konvaShape: KonvaShape) => {
      tracePolygonPath(context, ringPaths);
      context.fillStrokeShape(konvaShape);
    },
    [ringPaths]
  );

  return (
    <Shape
      sceneFunc={sceneFunc}
      fill={style.fill}
      opacity={style.opacity}
      fillRule="evenodd"
      stroke={style.isBorderVisible ? theme.borderColor : undefined}
      strokeWidth={style.isBorderVisible ? theme.borderWidth : 0}
      strokeEnabled={style.isBorderVisible}
      strokeScaleEnabled={false}
      listening={false}
    />
  );
};

/**
 * The cell-grid lines drawn over the edited shape's bounding box, so the
 * user can see exactly which cell a drag will add or remove (issue #49
 * "編集対象のセル境界を示す"). Extends a little past the shape's own bounds so a
 * cell added right at its current edge is still visibly gridded before the
 * drag lands on it.
 */
const EditCellGrid = ({
  workingPolygons,
  gridSize,
}: {
  workingPolygons: readonly GridPolygon[];
  gridSize: number;
}) => {
  const lines = useMemo(() => {
    if (workingPolygons.length === 0) {
      return [];
    }
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const polygon of workingPolygons) {
      const box = polygonBoundingBox(polygon);
      minX = Math.min(minX, box.minX);
      minY = Math.min(minY, box.minY);
      maxX = Math.max(maxX, box.maxX);
      maxY = Math.max(maxY, box.maxY);
    }
    minX -= GRID_MARGIN_CELLS;
    minY -= GRID_MARGIN_CELLS;
    maxX += GRID_MARGIN_CELLS;
    maxY += GRID_MARGIN_CELLS;

    const segments: { key: string; points: readonly number[] }[] = [];
    for (let x = minX; x <= maxX; x += 1) {
      segments.push({
        key: `v${x}`,
        points: [x * gridSize, minY * gridSize, x * gridSize, maxY * gridSize],
      });
    }
    for (let y = minY; y <= maxY; y += 1) {
      segments.push({
        key: `h${y}`,
        points: [minX * gridSize, y * gridSize, maxX * gridSize, y * gridSize],
      });
    }
    return segments;
  }, [workingPolygons, gridSize]);

  return (
    <Group name="shape-edit-cell-grid" listening={false}>
      {lines.map((line) => (
        <Line
          key={line.key}
          points={[...line.points]}
          stroke={CELL_GRID_COLOR}
          strokeWidth={CELL_GRID_STROKE_WIDTH_SCREEN}
          strokeScaleEnabled={false}
          listening={false}
        />
      ))}
    </Group>
  );
};

/**
 * Konva-only overlay for the cell-editing gesture (issue #49, spec §6.3,
 * §14): dims every other shape, hides the edited shape's stale (pre-edit)
 * rendering, draws its live working polygons in its own style on top, and
 * shows the cell grid over its footprint so a drag's target cell is obvious
 * before it lands. The document is untouched until confirm — everything
 * here is a Konva-only substitution over what `ShapesLayer` already drew.
 */
export const ShapeEditLayer = ({
  document,
  shapeId,
  workingPolygons,
  gridSize,
  theme = DEFAULT_SHAPES_LAYER_THEME,
}: ShapeEditLayerProps) => {
  const editedShape = document.shapes[shapeId];

  const otherPolygons = useMemo(() => {
    const polygons: GridPolygon[] = [];
    for (const otherId of document.zOrder) {
      if (otherId === shapeId) {
        continue;
      }
      const shape = document.shapes[otherId];
      if (shape !== undefined) {
        polygons.push(shape.polygon);
      }
    }
    return polygons;
  }, [document, shapeId]);

  return (
    <Group name="shape-edit-layer" listening={false}>
      {otherPolygons.map((polygon, index) => (
        <DimmedShape key={index} polygon={polygon} gridSize={gridSize} />
      ))}
      {editedShape !== undefined && (
        <DimmedShape polygon={editedShape.polygon} gridSize={gridSize} opacity={1} />
      )}
      {editedShape !== undefined &&
        workingPolygons.map((polygon, index) => (
          <EditedShape
            key={index}
            polygon={polygon}
            style={editedShape.style}
            gridSize={gridSize}
            theme={theme}
          />
        ))}
      <EditCellGrid workingPolygons={workingPolygons} gridSize={gridSize} />
    </Group>
  );
};
