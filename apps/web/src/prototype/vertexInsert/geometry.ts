/**
 * PROTOTYPE (issue #63) — throwaway geometry helpers for the vertex-insertion
 * comparison. Not used by the product; delete with the rest of this folder.
 */
import {
  areCollinear,
  cleanRing,
  createPolygonClippingEngine,
  doubleSignedArea,
  isSimplePolygon,
  type GridPoint,
  type GridPolygon,
  type GridRing,
} from '@gridder/editor-core';
import type { PolygonEdgeRef, PolygonRingRef } from '@/features/editor';

export const snapPoint = (point: GridPoint): GridPoint => ({
  x: Math.round(point.x),
  y: Math.round(point.y),
});

export const samePoint = (a: GridPoint, b: GridPoint): boolean => a.x === b.x && a.y === b.y;

export const ringByRef = (polygon: GridPolygon, ref: PolygonRingRef): GridRing =>
  ref.kind === 'outer' ? polygon.outerRing : (polygon.innerRings[ref.holeIndex] ?? []);

export const allRingRefs = (
  polygon: GridPolygon
): readonly (readonly [PolygonRingRef, GridRing])[] => [
  [{ kind: 'outer' }, polygon.outerRing],
  ...polygon.innerRings.map(
    (ring, holeIndex): readonly [PolygonRingRef, GridRing] => [{ kind: 'inner', holeIndex }, ring]
  ),
];

export const edgeEndpoints = (
  polygon: GridPolygon,
  ref: PolygonEdgeRef
): readonly [GridPoint, GridPoint] => {
  const ring = ringByRef(polygon, ref.ring);
  const a = ring[ref.edgeIndex] ?? { x: 0, y: 0 };
  const b = ring[(ref.edgeIndex + 1) % ring.length] ?? a;
  return [a, b];
};

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** Number of grid steps along the edge `[a, b]` (cells for an axis-aligned edge, gcd steps for a diagonal). */
export const edgeSteps = (a: GridPoint, b: GridPoint): number =>
  gcd(Math.abs(b.x - a.x), Math.abs(b.y - a.y));

/** Grid point at step `k` (0..steps) along `[a, b]`. */
export const pointAtStep = (a: GridPoint, b: GridPoint, k: number): GridPoint => {
  const steps = edgeSteps(a, b);
  if (steps === 0) {
    return a;
  }
  return { x: a.x + ((b.x - a.x) / steps) * k, y: a.y + ((b.y - a.y) / steps) * k };
};

/** Fractional step parameter of the projection of `p` onto `[a, b]`, clamped to [0, steps]. */
export const stepParameter = (a: GridPoint, b: GridPoint, p: GridPoint): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return 0;
  }
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return t * edgeSteps(a, b);
};

/**
 * The interior grid point of `[a, b]` nearest to `p` (never an endpoint), or
 * `null` when the edge is too short to have one.
 */
export const nearestInteriorGridPoint = (
  a: GridPoint,
  b: GridPoint,
  p: GridPoint
): { readonly point: GridPoint; readonly step: number } | null => {
  const steps = edgeSteps(a, b);
  if (steps < 2) {
    return null;
  }
  const k = Math.min(steps - 1, Math.max(1, Math.round(stepParameter(a, b, p))));
  return { point: pointAtStep(a, b, k), step: k };
};

/** The interior grid point nearest the geometric midpoint of `[a, b]`, or `null`. */
export const midpointGridPoint = (a: GridPoint, b: GridPoint): GridPoint | null => {
  const steps = edgeSteps(a, b);
  if (steps < 2) {
    return null;
  }
  return pointAtStep(a, b, Math.floor(steps / 2));
};

/** Unit outward normal of the edge at `ref` (pointing away from the filled region). */
export const outwardNormal = (polygon: GridPolygon, ref: PolygonEdgeRef): GridPoint => {
  const ring = ringByRef(polygon, ref.ring);
  const [a, b] = edgeEndpoints(polygon, ref);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  // For a ring with positive doubleSignedArea (counter-clockwise in the stored
  // coordinates), the interior lies to the left of each directed edge, so the
  // outward normal is the right-hand normal (dy, -dx). Holes wind the other
  // way, and "outward" for a hole means "into the hole", which is the same
  // rule relative to the ring's own winding.
  const sign = doubleSignedArea(ring) > 0 ? 1 : -1;
  return { x: (dy / length) * sign, y: (-dx / length) * sign };
};

const withRingReplaced = (polygon: GridPolygon, ref: PolygonRingRef, ring: GridRing): GridPolygon =>
  ref.kind === 'outer'
    ? { ...polygon, outerRing: ring }
    : {
        ...polygon,
        innerRings: polygon.innerRings.map((inner, index) =>
          index === ref.holeIndex ? ring : inner
        ),
      };

/** Inserts `point` as a new vertex after `ref.edgeIndex`; the new vertex's index is `edgeIndex + 1`. */
export const withVertexInserted = (
  polygon: GridPolygon,
  ref: PolygonEdgeRef,
  point: GridPoint
): GridPolygon => {
  const ring = ringByRef(polygon, ref.ring);
  const next = [...ring.slice(0, ref.edgeIndex + 1), point, ...ring.slice(ref.edgeIndex + 1)];
  return withRingReplaced(polygon, ref.ring, next);
};

export const withVertexReplaced = (
  polygon: GridPolygon,
  ref: PolygonRingRef,
  vertexIndex: number,
  point: GridPoint
): GridPolygon => {
  const ring = ringByRef(polygon, ref);
  return withRingReplaced(
    polygon,
    ref,
    ring.map((vertex, index) => (index === vertexIndex ? point : vertex))
  );
};

/** True when the vertex at `vertexIndex` lies on the straight line between its neighbours (i.e. it adds nothing). */
export const isRedundantVertex = (ring: GridRing, vertexIndex: number): boolean => {
  const prev = ring[(vertexIndex - 1 + ring.length) % ring.length];
  const cur = ring[vertexIndex];
  const next = ring[(vertexIndex + 1) % ring.length];
  if (prev === undefined || cur === undefined || next === undefined) {
    return true;
  }
  return areCollinear(prev, cur, next);
};

export interface ValidationResult {
  readonly ok: boolean;
  readonly reason?: string;
}

/** Integer, simple, non-degenerate — the same gate #50 applies on commit. */
export const validatePolygon = (polygon: GridPolygon): ValidationResult => {
  for (const [ref, ring] of allRingRefs(polygon)) {
    const label = ref.kind === 'outer' ? '外周' : `穴 ${ref.holeIndex}`;
    if (ring.length < 3) {
      return { ok: false, reason: `${label}の頂点が 3 個未満` };
    }
    if (!ring.every((p) => Number.isInteger(p.x) && Number.isInteger(p.y))) {
      return { ok: false, reason: `${label}にグリッド外の頂点` };
    }
    if (cleanRing(ring).length < 3 || doubleSignedArea(ring) === 0) {
      return { ok: false, reason: `${label}の面積が 0` };
    }
    if (!isSimplePolygon(ring)) {
      return { ok: false, reason: `${label}が自己交差` };
    }
  }
  return { ok: true };
};

const engine = createPolygonClippingEngine();

/**
 * Union (`depth > 0`) or difference (`depth < 0`) of `polygon` with the
 * rectangle that sits on the edge at `ref`, spanning grid steps
 * `[stepStart, stepEnd]` along it and `|depth|` cells along its outward
 * normal. Returns the single resulting polygon, or a reason it cannot be
 * applied (the prototype does not split shapes).
 */
export const pushEdgeSpan = (
  polygon: GridPolygon,
  ref: PolygonEdgeRef,
  stepStart: number,
  stepEnd: number,
  depth: number
): { readonly polygon: GridPolygon | null; readonly rect: GridRing | null; readonly reason?: string } => {
  if (depth === 0 || stepStart === stepEnd) {
    return { polygon, rect: null };
  }
  const [a, b] = edgeEndpoints(polygon, ref);
  const n = outwardNormal(polygon, ref);
  const p1 = pointAtStep(a, b, stepStart);
  const p2 = pointAtStep(a, b, stepEnd);
  const p3 = { x: p2.x + n.x * depth, y: p2.y + n.y * depth };
  const p4 = { x: p1.x + n.x * depth, y: p1.y + n.y * depth };
  const rect: GridRing = [p1, p2, p3, p4].map(snapPoint);
  const clip: GridPolygon = { outerRing: rect, innerRings: [] };
  const results =
    depth > 0 ? engine.union([polygon, clip]) : engine.difference(polygon, [clip]);
  if (results.length === 1) {
    return { polygon: results[0] ?? null, rect };
  }
  if (results.length === 0) {
    return { polygon: null, rect, reason: '図形が消える' };
  }
  return { polygon: null, rect, reason: `図形が ${results.length} 個に分かれる（プロトタイプでは未対応）` };
};

/** Integer area of the polygon (outer minus holes), for the state panel. */
export const polygonArea = (polygon: GridPolygon): number =>
  Math.abs(doubleSignedArea(polygon.outerRing)) / 2 -
  polygon.innerRings.reduce((sum, ring) => sum + Math.abs(doubleSignedArea(ring)) / 2, 0);

/** Compact `(x,y) (x,y) …` rendering for the state panel. */
export const formatRing = (ring: GridRing): string =>
  ring.map((p) => `(${p.x},${p.y})`).join(' ');
