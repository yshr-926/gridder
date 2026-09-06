import { useCallback, useMemo } from 'react';
import { Circle, Group, Line } from 'react-konva';
import type { GridPoint } from '@gridder/editor-core';

/**
 * PolygonDraftLayer Props
 */
export interface PolygonDraftLayerProps {
  /** Placed vertices, in click order (grid units). */
  vertices: readonly GridPoint[];
  /** Live pointer position (grid vertex), or `null` before the first move. */
  cursorVertex: GridPoint | null;
  /** True once there are enough vertices to close the polygon (spec §48). */
  canClose: boolean;
  /** Pixel size of one grid cell. */
  gridSize: number;
  /** Viewport scale — used to keep markers and strokes a constant screen size. */
  scale: number;
}

/** Draft edge colour (single accent per ui-principles §3). */
const DRAFT_STROKE = '#2563eb';
/** Placed-edge width in screen pixels, constant across zoom. */
const EDGE_STROKE_WIDTH_SCREEN = 2;
/** Rubber-band (cursor) edge width in screen pixels. */
const RUBBER_BAND_STROKE_WIDTH_SCREEN = 1.5;
/** Closing-edge dash pattern, in screen pixels. */
const CLOSING_DASH_SCREEN: readonly number[] = [5, 5];
const CLOSING_STROKE_OPACITY = 0.6;

/** Placed-vertex marker radius, in screen pixels. */
const VERTEX_RADIUS_SCREEN = 4;
/** The start vertex gets a larger ring once the polygon can close. */
const START_VERTEX_RING_RADIUS_SCREEN = 8;
const START_VERTEX_RING_WIDTH_SCREEN = 2;
const VERTEX_FILL = '#1f2937';
const START_VERTEX_FILL = DRAFT_STROKE;
const VERTEX_STROKE = '#ffffff';
const VERTEX_STROKE_WIDTH_SCREEN = 1;

/**
 * Konva-only preview for the in-progress polygon-creation gesture
 * (issue #48, spec §6.3, §14): the edges between placed vertices, a
 * rubber-band edge from the last vertex to the live pointer position, a
 * dashed closing-edge hint back to the start vertex once there are enough
 * vertices to close, and a marker per placed vertex — the start vertex drawn
 * larger to signal it can be clicked to close the shape. Nothing here
 * touches React document state; the whole gesture commits as one
 * `CreateShapeCommand` on confirm.
 */
export const PolygonDraftLayer = ({
  vertices,
  cursorVertex,
  canClose,
  gridSize,
  scale,
}: PolygonDraftLayerProps) => {
  const safeScale = Math.max(scale, Number.EPSILON);

  const toPixel = useCallback(
    (point: GridPoint): [number, number] => [point.x * gridSize, point.y * gridSize],
    [gridSize]
  );

  const edgePoints = useMemo(() => {
    if (vertices.length < 2) {
      return null;
    }
    return vertices.flatMap((point) => toPixel(point));
  }, [vertices, toPixel]);

  const rubberBandPoints = useMemo(() => {
    const last = vertices[vertices.length - 1];
    if (last === undefined || cursorVertex === null) {
      return null;
    }
    return [...toPixel(last), ...toPixel(cursorVertex)];
  }, [vertices, cursorVertex, toPixel]);

  const closingPoints = useMemo(() => {
    const first = vertices[0];
    if (!canClose || first === undefined || cursorVertex === null) {
      return null;
    }
    return [...toPixel(cursorVertex), ...toPixel(first)];
  }, [vertices, cursorVertex, canClose, toPixel]);

  if (vertices.length === 0 && cursorVertex === null) {
    return null;
  }

  return (
    <Group name="polygon-draft-layer" listening={false}>
      {edgePoints !== null && (
        <Line
          name="polygon-draft-edges"
          points={edgePoints}
          stroke={DRAFT_STROKE}
          strokeWidth={EDGE_STROKE_WIDTH_SCREEN / safeScale}
          strokeScaleEnabled={false}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      )}
      {rubberBandPoints !== null && (
        <Line
          name="polygon-draft-rubber-band"
          points={rubberBandPoints}
          stroke={DRAFT_STROKE}
          strokeWidth={RUBBER_BAND_STROKE_WIDTH_SCREEN / safeScale}
          strokeScaleEnabled={false}
          lineCap="round"
          listening={false}
        />
      )}
      {closingPoints !== null && (
        <Line
          name="polygon-draft-closing-edge"
          points={closingPoints}
          stroke={DRAFT_STROKE}
          strokeWidth={RUBBER_BAND_STROKE_WIDTH_SCREEN / safeScale}
          strokeScaleEnabled={false}
          dash={CLOSING_DASH_SCREEN.map((d) => d / safeScale)}
          opacity={CLOSING_STROKE_OPACITY}
          listening={false}
        />
      )}
      {vertices.map((point, index) => {
        const isStart = index === 0;
        const [x, y] = toPixel(point);
        return (
          <Group key={`${point.x},${point.y},${index}`} x={x} y={y}>
            {isStart && canClose && (
              <Circle
                name="polygon-draft-start-ring"
                radius={START_VERTEX_RING_RADIUS_SCREEN / safeScale}
                stroke={DRAFT_STROKE}
                strokeWidth={START_VERTEX_RING_WIDTH_SCREEN / safeScale}
                strokeScaleEnabled={false}
                listening={false}
              />
            )}
            <Circle
              name={`polygon-draft-vertex-${index}`}
              radius={VERTEX_RADIUS_SCREEN / safeScale}
              fill={isStart ? START_VERTEX_FILL : VERTEX_FILL}
              stroke={VERTEX_STROKE}
              strokeWidth={VERTEX_STROKE_WIDTH_SCREEN / safeScale}
              strokeScaleEnabled={false}
              listening={false}
            />
          </Group>
        );
      })}
    </Group>
  );
};
