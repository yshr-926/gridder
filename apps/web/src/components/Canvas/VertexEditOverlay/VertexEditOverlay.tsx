import { memo, useMemo } from 'react';
import { Circle, Group, Line } from 'react-konva';
import type { EditorDocument, GridPoint, GridPolygon, GridRing } from '@gridder/editor-core';
import { isAxisAlignedRect } from '@/features/editor';

/** A vertex or edge drag in progress (issue #50), or `undefined` when idle. */
export interface VertexEditOverlayPreview {
  readonly shapeId: string;
  /** Live proposed polygon, replacing the shape's document geometry. */
  readonly polygon: GridPolygon;
}

/**
 * VertexEditOverlay Props
 */
interface VertexEditOverlayProps {
  /** Current document snapshot. */
  document: EditorDocument;
  /** IDs of the selected shapes. */
  selectedIds: readonly string[];
  /** Pixel size of one grid cell. */
  gridSize: number;
  /** Viewport scale — used to keep markers and hit strokes a constant screen size. */
  scale: number;
  /**
   * Live vertex/edge-gesture polygon (issue #50). The markers are drawn from
   * this instead of the document polygon while the edited shape's gesture is
   * in progress.
   */
  vertexPreview?: VertexEditOverlayPreview;
  /**
   * The ghost vertex under the pointer (issue #64): the grid point on the
   * single selected shape's edge where a press would insert a vertex. Drawn
   * as a dashed circle with a "+" — a vertex that does not exist yet — so it
   * reads as neither a resize handle (square) nor an existing vertex (solid
   * circle). Only drawn while it names the selected shape.
   */
  insertGhost?: VertexInsertGhostMarker;
}

/** Where the ghost vertex sits, and on which shape (issue #64). */
export interface VertexInsertGhostMarker {
  readonly shapeId: string;
  readonly point: GridPoint;
}

/** Marker / hit-stroke colour (single accent per ui-principles §3), matching `SelectionOverlay`'s resize handles. */
const ACCENT = '#2563eb';
/** Vertex marker radius, in screen pixels (fixed regardless of zoom). */
const VERTEX_RADIUS_SCREEN = 4.5;
const VERTEX_FILL = '#ffffff';
const VERTEX_STROKE_WIDTH_SCREEN = 1.5;
/**
 * Invisible hit-area circle drawn under each vertex marker, larger than
 * what's shown (matching `SelectionOverlay`'s resize-handle hit squares).
 * The actual hit-testing that decides a pointer-down grabs a vertex happens
 * in `reduceInteraction` (grid-space, via `vertexAtPoint`) — this exists only
 * so a bigger visual target reads as grabbable; it does not itself capture
 * pointer events (the shared `EditorInteractionLayer` surface does).
 */
const VERTEX_HIT_RADIUS_SCREEN = 10;
/** Edge hit-stroke width, in screen pixels — wider than the visible outline so it's easy to grab, per ui-principles §5. */
const EDGE_HIT_STROKE_WIDTH_SCREEN = 12;
/** Ghost vertex radius, in screen pixels (issue #64) — a little larger than a vertex marker so the "+" stays legible. */
const GHOST_RADIUS_SCREEN = 6;
/** Ghost outline dash, in screen pixels. */
const GHOST_DASH_SCREEN: readonly [number, number] = [2, 2];
/** Length of each "+" arm as a fraction of the ghost radius. */
const GHOST_PLUS_ARM_RATIO = 0.55;

/**
 * The single selected shape whose vertices get markers: a non-rectangular
 * polygon (issue #50 — a rectangle keeps its resize handles instead), or any
 * shape while a vertex-edit gesture is live on it (issue #64: a ghost drag on
 * a rectangle turns the ghost into a real vertex marker the moment it
 * starts, and the preview polygon is what is being edited).
 */
const singleEditablePolygon = (
  document: EditorDocument,
  selectedIds: readonly string[],
  vertexPreview: VertexEditOverlayPreview | undefined
): { readonly id: string; readonly polygon: GridPolygon } | null => {
  if (selectedIds.length !== 1) {
    return null;
  }
  const shape = document.shapes[selectedIds[0]];
  if (shape === undefined) {
    return null;
  }
  if (vertexPreview !== undefined && vertexPreview.shapeId === shape.id) {
    return { id: shape.id, polygon: vertexPreview.polygon };
  }
  if (isAxisAlignedRect(shape.polygon)) {
    return null;
  }
  return { id: shape.id, polygon: shape.polygon };
};

/** Every ring of `polygon` — the outer boundary and every hole (issue #50: hole vertices/edges are editable exactly like the outer ring's). */
const allRings = (polygon: GridPolygon): readonly GridRing[] => [
  polygon.outerRing,
  ...polygon.innerRings,
];

/**
 * Draws a vertex marker at every vertex, and an invisible wide hit-stroke
 * along every edge, of the single selected shape's polygon — but only when
 * that shape is not an axis-aligned rectangle (issue #50, spec §6.2: a
 * rectangle keeps `SelectionOverlay`'s bounding-box handles; any other
 * polygon is edited by moving its vertices/edges directly, with no bounding
 * box at all). Holes get the same markers as the outer ring. Also draws the
 * ghost vertex (issue #64) for any single selected shape, rectangles
 * included, while the pointer hovers an edge near a grid point.
 * `strokeScaleEnabled={false}` plus dividing world-space sizes by `scale`
 * keeps every marker and stroke a constant screen size at any zoom, matching
 * `SelectionOverlay`'s resize handles. Memoised (ADR-0005): it re-renders
 * only when the document, selection, zoom, preview, or ghost change — never
 * on a pan, since it does not receive the viewport offset.
 */
export const VertexEditOverlay = memo(
  ({
    document,
    selectedIds,
    gridSize,
    scale,
    vertexPreview,
    insertGhost,
  }: VertexEditOverlayProps) => {
    const safeScale = Math.max(scale, Number.EPSILON);

    const editable = useMemo(
      () => singleEditablePolygon(document, selectedIds, vertexPreview),
      [document, selectedIds, vertexPreview]
    );

    const ghost =
      insertGhost !== undefined &&
      selectedIds.length === 1 &&
      selectedIds[0] === insertGhost.shapeId &&
      vertexPreview === undefined
        ? insertGhost.point
        : null;

    if (editable === null && ghost === null) {
      return null;
    }

    const vertexRadius = VERTEX_RADIUS_SCREEN / safeScale;
    const vertexHitRadius = VERTEX_HIT_RADIUS_SCREEN / safeScale;
    const vertexStrokeWidth = VERTEX_STROKE_WIDTH_SCREEN / safeScale;
    const edgeHitStrokeWidth = EDGE_HIT_STROKE_WIDTH_SCREEN / safeScale;
    const ghostRadius = GHOST_RADIUS_SCREEN / safeScale;
    const ghostArm = ghostRadius * GHOST_PLUS_ARM_RATIO;

    return (
      <Group name="vertex-edit-overlay" listening={false}>
        {editable !== null &&
          allRings(editable.polygon).map((ring, ringIndex) => (
            <Group key={ringIndex}>
              <Line
                name={`vertex-edit-edge-hit-${ringIndex}`}
                points={[...ring, ring[0]].flatMap((point) => [
                  point.x * gridSize,
                  point.y * gridSize,
                ])}
                stroke="transparent"
                strokeWidth={edgeHitStrokeWidth}
                listening={false}
              />
              {ring.map((point, vertexIndex) => (
                <Group key={vertexIndex}>
                  <Circle
                    name={`vertex-edit-hit-${ringIndex}-${vertexIndex}`}
                    x={point.x * gridSize}
                    y={point.y * gridSize}
                    radius={vertexHitRadius}
                    fill="transparent"
                    listening={false}
                  />
                  <Circle
                    name={`vertex-edit-marker-${ringIndex}-${vertexIndex}`}
                    x={point.x * gridSize}
                    y={point.y * gridSize}
                    radius={vertexRadius}
                    fill={VERTEX_FILL}
                    stroke={ACCENT}
                    strokeWidth={vertexStrokeWidth}
                    strokeScaleEnabled={false}
                    listening={false}
                  />
                </Group>
              ))}
            </Group>
          ))}
        {ghost !== null && (
          <Group name="vertex-insert-ghost" listening={false}>
            <Circle
              name="vertex-insert-ghost-circle"
              x={ghost.x * gridSize}
              y={ghost.y * gridSize}
              radius={ghostRadius}
              fill={VERTEX_FILL}
              stroke={ACCENT}
              strokeWidth={VERTEX_STROKE_WIDTH_SCREEN}
              strokeScaleEnabled={false}
              dash={[...GHOST_DASH_SCREEN]}
              listening={false}
            />
            <Line
              name="vertex-insert-ghost-plus-h"
              points={[
                ghost.x * gridSize - ghostArm,
                ghost.y * gridSize,
                ghost.x * gridSize + ghostArm,
                ghost.y * gridSize,
              ]}
              stroke={ACCENT}
              strokeWidth={VERTEX_STROKE_WIDTH_SCREEN}
              strokeScaleEnabled={false}
              listening={false}
            />
            <Line
              name="vertex-insert-ghost-plus-v"
              points={[
                ghost.x * gridSize,
                ghost.y * gridSize - ghostArm,
                ghost.x * gridSize,
                ghost.y * gridSize + ghostArm,
              ]}
              stroke={ACCENT}
              strokeWidth={VERTEX_STROKE_WIDTH_SCREEN}
              strokeScaleEnabled={false}
              listening={false}
            />
          </Group>
        )}
      </Group>
    );
  }
);

VertexEditOverlay.displayName = 'VertexEditOverlay';
