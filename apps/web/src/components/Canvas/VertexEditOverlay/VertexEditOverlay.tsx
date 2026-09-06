import { useMemo } from 'react';
import { Circle, Group, Line } from 'react-konva';
import type { EditorDocument, GridPolygon, GridRing } from '@gridder/editor-core';
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

/** True when exactly one shape is selected and it is not an axis-aligned rectangle (issue #50: vertex/edge editing is for non-rectangular polygons only — a rectangle keeps its resize handles instead). */
const singleEditablePolygon = (
  document: EditorDocument,
  selectedIds: readonly string[]
): { readonly id: string; readonly polygon: GridPolygon } | null => {
  if (selectedIds.length !== 1) {
    return null;
  }
  const shape = document.shapes[selectedIds[0]];
  if (shape === undefined || isAxisAlignedRect(shape.polygon)) {
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
 * box at all). Holes get the same markers as the outer ring.
 * `strokeScaleEnabled={false}` plus dividing world-space sizes by `scale`
 * keeps every marker and stroke a constant screen size at any zoom, matching
 * `SelectionOverlay`'s resize handles.
 */
export const VertexEditOverlay = ({
  document,
  selectedIds,
  gridSize,
  scale,
  vertexPreview,
}: VertexEditOverlayProps) => {
  const safeScale = Math.max(scale, Number.EPSILON);

  const editable = useMemo(
    () => singleEditablePolygon(document, selectedIds),
    [document, selectedIds]
  );

  const polygon = useMemo(() => {
    if (editable === null) {
      return null;
    }
    if (vertexPreview !== undefined && vertexPreview.shapeId === editable.id) {
      return vertexPreview.polygon;
    }
    return editable.polygon;
  }, [editable, vertexPreview]);

  if (editable === null || polygon === null) {
    return null;
  }

  const vertexRadius = VERTEX_RADIUS_SCREEN / safeScale;
  const vertexHitRadius = VERTEX_HIT_RADIUS_SCREEN / safeScale;
  const vertexStrokeWidth = VERTEX_STROKE_WIDTH_SCREEN / safeScale;
  const edgeHitStrokeWidth = EDGE_HIT_STROKE_WIDTH_SCREEN / safeScale;

  return (
    <Group name="vertex-edit-overlay" listening={false}>
      {allRings(polygon).map((ring, ringIndex) => (
        <Group key={ringIndex}>
          <Line
            name={`vertex-edit-edge-hit-${ringIndex}`}
            points={[...ring, ring[0]].flatMap((point) => [point.x * gridSize, point.y * gridSize])}
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
    </Group>
  );
};
