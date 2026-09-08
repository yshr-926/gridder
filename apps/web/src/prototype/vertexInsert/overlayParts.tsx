/**
 * PROTOTYPE (issue #63) — Konva pieces shared by the host page and the
 * variants: the shape itself, the #44 resize handles, the #50 vertex markers,
 * and a few insertion-handle glyphs. Visual constants mirror
 * `SelectionOverlay` / `VertexEditOverlay` so the comparison is honest.
 */
import { Circle, Group, Line, Rect, Shape } from 'react-konva';
import type Konva from 'konva';
import type { GridPoint, GridPolygon, GridRing } from '@gridder/editor-core';
import { RESIZE_HANDLE_KINDS, polygonBounds, resizeHandlePoint } from '@/features/editor';

import { ACCENT, ACCENT_SOFT, NEUTRAL } from './theme';

const HANDLE_SIZE_SCREEN = 7;
const VERTEX_RADIUS_SCREEN = 4.5;
const STROKE_SCREEN = 1.5;

interface ShapeFillProps {
  readonly polygon: GridPolygon;
  readonly gridSize: number;
  readonly scale: number;
  readonly dimmed?: boolean;
}

/** One polygon node, holes included (rings are drawn with opposite winding, nonzero fill). */
export const ShapeFill = ({ polygon, gridSize, scale, dimmed = false }: ShapeFillProps) => (
  <Shape
    sceneFunc={(context: Konva.Context, shape: Konva.Shape) => {
      context.beginPath();
      for (const ring of [polygon.outerRing, ...polygon.innerRings]) {
        ring.forEach((p, i) => {
          if (i === 0) {
            context.moveTo(p.x * gridSize, p.y * gridSize);
          } else {
            context.lineTo(p.x * gridSize, p.y * gridSize);
          }
        });
        context.closePath();
      }
      context.fillStrokeShape(shape);
    }}
    fill={dimmed ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.55)'}
    stroke="#334155"
    strokeWidth={STROKE_SCREEN / scale}
    perfectDrawEnabled={false}
    listening={false}
  />
);

interface SelectionFrameProps {
  readonly polygon: GridPolygon;
  readonly gridSize: number;
  readonly scale: number;
}

export const SelectionFrame = ({ polygon, gridSize, scale }: SelectionFrameProps) => {
  const b = polygonBounds(polygon);
  const pad = 2 / scale;
  return (
    <Rect
      x={b.minX * gridSize - pad}
      y={b.minY * gridSize - pad}
      width={(b.maxX - b.minX) * gridSize + pad * 2}
      height={(b.maxY - b.minY) * gridSize + pad * 2}
      stroke={ACCENT}
      strokeWidth={STROKE_SCREEN}
      strokeScaleEnabled={false}
      listening={false}
    />
  );
};

interface ResizeHandlesProps {
  readonly polygon: GridPolygon;
  readonly gridSize: number;
  readonly scale: number;
  readonly hovered: string | null;
}

/** The 8 square handles of issue #44 (only meaningful on an axis-aligned rectangle). */
export const ResizeHandles = ({ polygon, gridSize, scale, hovered }: ResizeHandlesProps) => {
  const b = polygonBounds(polygon);
  const size = HANDLE_SIZE_SCREEN / scale;
  return (
    <Group listening={false}>
      {RESIZE_HANDLE_KINDS.map((kind) => {
        const p = resizeHandlePoint(b, kind);
        const s = hovered === kind ? size * 1.3 : size;
        return (
          <Rect
            key={kind}
            x={p.x * gridSize - s / 2}
            y={p.y * gridSize - s / 2}
            width={s}
            height={s}
            fill={hovered === kind ? ACCENT : '#ffffff'}
            stroke={ACCENT}
            strokeWidth={STROKE_SCREEN}
            strokeScaleEnabled={false}
          />
        );
      })}
    </Group>
  );
};

interface VertexMarkersProps {
  readonly polygon: GridPolygon;
  readonly gridSize: number;
  readonly scale: number;
  readonly hovered: GridPoint | null;
}

/** The round vertex markers of issue #50. */
export const VertexMarkers = ({ polygon, gridSize, scale, hovered }: VertexMarkersProps) => {
  const r = VERTEX_RADIUS_SCREEN / scale;
  return (
    <Group listening={false}>
      {[polygon.outerRing, ...polygon.innerRings].map((ring, ringIndex) =>
        ring.map((p, i) => {
          const isHovered = hovered !== null && hovered.x === p.x && hovered.y === p.y;
          return (
            <Circle
              key={`${ringIndex}-${i}`}
              x={p.x * gridSize}
              y={p.y * gridSize}
              radius={isHovered ? r * 1.3 : r}
              fill={isHovered ? ACCENT : '#ffffff'}
              stroke={ACCENT}
              strokeWidth={STROKE_SCREEN}
              strokeScaleEnabled={false}
            />
          );
        })
      )}
    </Group>
  );
};

interface EdgeHighlightProps {
  readonly a: GridPoint;
  readonly b: GridPoint;
  readonly gridSize: number;
  readonly color?: string;
  readonly widthScreen?: number;
  readonly dash?: readonly number[];
}

/** Accent stroke over one edge (hover feedback, ui-principles §5). */
export const EdgeHighlight = ({
  a,
  b,
  gridSize,
  color = ACCENT,
  widthScreen = 3,
  dash,
}: EdgeHighlightProps) => (
  <Line
    points={[a.x * gridSize, a.y * gridSize, b.x * gridSize, b.y * gridSize]}
    stroke={color}
    strokeWidth={widthScreen}
    strokeScaleEnabled={false}
    lineCap="round"
    dash={dash === undefined ? undefined : [...dash]}
    listening={false}
  />
);

interface DiamondHandleProps {
  readonly point: GridPoint;
  readonly gridSize: number;
  readonly scale: number;
  readonly hovered: boolean;
}

/** Variant A's mid-edge handle: a hollow diamond, so it reads as neither a square (#44) nor a circle (#50). */
export const DiamondHandle = ({ point, gridSize, scale, hovered }: DiamondHandleProps) => {
  const half = ((hovered ? 9 : 7) / 2) / scale;
  const cx = point.x * gridSize;
  const cy = point.y * gridSize;
  return (
    <Line
      points={[cx, cy - half, cx + half, cy, cx, cy + half, cx - half, cy]}
      closed
      fill={hovered ? ACCENT : '#ffffff'}
      stroke={ACCENT}
      strokeWidth={STROKE_SCREEN}
      strokeScaleEnabled={false}
      listening={false}
    />
  );
};

interface GhostVertexProps {
  readonly point: GridPoint;
  readonly gridSize: number;
  readonly scale: number;
  readonly armed: boolean;
}

/** Variant D's hover ghost: a dashed circle with a "+" — a vertex that does not exist yet. */
export const GhostVertex = ({ point, gridSize, scale, armed }: GhostVertexProps) => {
  const r = (armed ? 6 : 5) / scale;
  const cx = point.x * gridSize;
  const cy = point.y * gridSize;
  const arm = r * 0.55;
  return (
    <Group listening={false}>
      <Circle
        x={cx}
        y={cy}
        radius={r}
        fill={armed ? '#ffffff' : 'rgba(255,255,255,0.7)'}
        stroke={ACCENT}
        strokeWidth={STROKE_SCREEN}
        strokeScaleEnabled={false}
        dash={armed ? undefined : [2, 2]}
      />
      <Line
        points={[cx - arm, cy, cx + arm, cy]}
        stroke={ACCENT}
        strokeWidth={STROKE_SCREEN}
        strokeScaleEnabled={false}
      />
      <Line
        points={[cx, cy - arm, cx, cy + arm]}
        stroke={ACCENT}
        strokeWidth={STROKE_SCREEN}
        strokeScaleEnabled={false}
      />
    </Group>
  );
};

interface GhostRectProps {
  readonly ring: GridRing;
  readonly gridSize: number;
  readonly subtract: boolean;
}

/** Variant C's push-out region: dashed accent for union, dashed neutral for a cut. */
export const GhostRect = ({ ring, gridSize, subtract }: GhostRectProps) => (
  <Line
    points={ring.flatMap((p) => [p.x * gridSize, p.y * gridSize])}
    closed
    fill={subtract ? 'rgba(148, 163, 184, 0.25)' : ACCENT_SOFT}
    stroke={subtract ? NEUTRAL : ACCENT}
    strokeWidth={1.5}
    strokeScaleEnabled={false}
    dash={[5, 4]}
    listening={false}
  />
);
