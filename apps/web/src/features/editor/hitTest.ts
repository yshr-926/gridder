import type {
  EditorDocument,
  EditorShape,
  GridPoint,
  GridPolygon,
  GridRing,
} from '@gridder/editor-core';

/**
 * Geometric hit-testing for the direct-manipulation controller (issue #42).
 *
 * The controller resolves a pointer to a shape itself rather than leaning on
 * Konva event targets, so the selection rules stay pure and unit-testable and
 * do not depend on the renderer's hit graph.
 */

/** An axis-aligned box in grid units. */
export interface GridRect {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** The box spanned by two grid vertices, normalised so min <= max. */
export const rectFromPoints = (a: GridPoint, b: GridPoint): GridRect => ({
  minX: Math.min(a.x, b.x),
  minY: Math.min(a.y, b.y),
  maxX: Math.max(a.x, b.x),
  maxY: Math.max(a.y, b.y),
});

/** Bounding box of a ring; `null` for an empty ring. */
const ringBounds = (ring: GridRing): GridRect | null => {
  if (ring.length === 0) {
    return null;
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of ring) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
};

/** Bounding box of a polygon's outer ring in grid units. */
export const polygonBounds = (polygon: GridPolygon): GridRect =>
  ringBounds(polygon.outerRing) ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 };

/**
 * Even-odd ray cast: is the point strictly inside the implicitly-closed ring?
 * Points exactly on an edge count as inside so a click on a shape's border
 * still selects it.
 */
const isPointInRing = (point: GridPoint, ring: GridRing): boolean => {
  if (ring.length < 3) {
    return false;
  }
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i];
    const b = ring[j];

    // On-segment check (treats the boundary as inside).
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    const withinX =
      point.x >= Math.min(a.x, b.x) - 1e-9 && point.x <= Math.max(a.x, b.x) + 1e-9;
    const withinY =
      point.y >= Math.min(a.y, b.y) - 1e-9 && point.y <= Math.max(a.y, b.y) + 1e-9;
    if (Math.abs(cross) < 1e-9 && withinX && withinY) {
      return true;
    }

    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
};

/** Is the grid point inside the polygon (outer ring minus any holes)? */
export const isPointInPolygon = (point: GridPoint, polygon: GridPolygon): boolean => {
  if (!isPointInRing(point, polygon.outerRing)) {
    return false;
  }
  for (const hole of polygon.innerRings) {
    if (isPointInRing(point, hole)) {
      return false;
    }
  }
  return true;
};

/**
 * The topmost shape whose polygon contains `point`, or `null`. "Topmost" means
 * last in `zOrder` (drawn frontmost), matching what the user sees.
 */
export const shapeAtPoint = (
  document: EditorDocument,
  point: GridPoint
): EditorShape | null => {
  for (let i = document.zOrder.length - 1; i >= 0; i -= 1) {
    const shape = document.shapes[document.zOrder[i]];
    if (shape !== undefined && isPointInPolygon(point, shape.polygon)) {
      return shape;
    }
  }
  return null;
};

/** True when `inner` lies entirely within `outer` (inclusive edges). */
export const rectContainsRect = (outer: GridRect, inner: GridRect): boolean =>
  inner.minX >= outer.minX &&
  inner.minY >= outer.minY &&
  inner.maxX <= outer.maxX &&
  inner.maxY <= outer.maxY;

/**
 * IDs of every shape whose bounding box is fully contained by `region`
 * (marquee semantics: containment, not intersection — issue #42). Returned in
 * `zOrder` so callers get a stable back-to-front ordering.
 */
export const shapesWithinRegion = (
  document: EditorDocument,
  region: GridRect
): readonly string[] => {
  const ids: string[] = [];
  for (const shapeId of document.zOrder) {
    const shape = document.shapes[shapeId];
    if (shape === undefined) {
      continue;
    }
    if (rectContainsRect(region, polygonBounds(shape.polygon))) {
      ids.push(shapeId);
    }
  }
  return ids;
};

/**
 * Edge and corner resize handles (issue #44, spec §6.2). Rectangles only —
 * a non-rectangular polygon has no handles here (vertex editing is a
 * separate Issue).
 */
export type ResizeHandleKind = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/**
 * Every handle kind, in a stable order used for rendering and hit-testing.
 * Corners come first so {@link resizeHandleAtPoint} never mistakes a click
 * near a corner for the adjacent edge handle.
 */
export const RESIZE_HANDLE_KINDS: readonly ResizeHandleKind[] = [
  'nw',
  'ne',
  'se',
  'sw',
  'n',
  'e',
  's',
  'w',
];

/**
 * True when `polygon` is exactly a 4-vertex, axis-aligned rectangle with no
 * holes — the only shape issue #44 puts resize handles on. A rectangle
 * created by `#42`'s blank-drag, or one still unedited by anything that
 * skews it, satisfies this; a general polygon (even one that happens to look
 * rectangular after a boolean op) is out of scope here on purpose — the
 * vertex ordering isn't guaranteed axis-aligned corners in sequence, so this
 * checks the geometry directly rather than trusting shape provenance.
 */
export const isAxisAlignedRect = (polygon: GridPolygon): boolean => {
  if (polygon.innerRings.length > 0 || polygon.outerRing.length !== 4) {
    return false;
  }
  const bounds = polygonBounds(polygon);
  if (bounds.minX >= bounds.maxX || bounds.minY >= bounds.maxY) {
    return false;
  }
  const corners = new Set(polygon.outerRing.map((p) => `${p.x},${p.y}`));
  const expected = [
    `${bounds.minX},${bounds.minY}`,
    `${bounds.maxX},${bounds.minY}`,
    `${bounds.maxX},${bounds.maxY}`,
    `${bounds.minX},${bounds.maxY}`,
  ];
  return expected.every((key) => corners.has(key));
};

/** Grid-unit position of one resize handle on `bounds`. */
export const resizeHandlePoint = (bounds: GridRect, kind: ResizeHandleKind): GridPoint => {
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midY = (bounds.minY + bounds.maxY) / 2;
  const x = kind.includes('w') ? bounds.minX : kind.includes('e') ? bounds.maxX : midX;
  const y = kind.includes('n') ? bounds.minY : kind.includes('s') ? bounds.maxY : midY;
  return { x, y };
};

/**
 * The resize handle at `point` (grid units) for `bounds`, within
 * `hitRadius` grid units of the handle's exact position, or `null`. Corners
 * are checked before edges so a click near a corner never falls through to
 * the adjacent edge handle.
 */
export const resizeHandleAtPoint = (
  bounds: GridRect,
  point: GridPoint,
  hitRadius: number
): ResizeHandleKind | null => {
  for (const kind of RESIZE_HANDLE_KINDS) {
    const handle = resizeHandlePoint(bounds, kind);
    if (Math.hypot(point.x - handle.x, point.y - handle.y) <= hitRadius) {
      return kind;
    }
  }
  return null;
};

/**
 * Cursor family for a resize handle (spec §6.2, issue #44): opposite corners
 * / edges share a cursor because dragging either one resizes along the same
 * axis. Matches CSS `*-resize` cursor names minus the suffix.
 */
export type ResizeCursorAxis = 'ew' | 'ns' | 'nwse' | 'nesw';

const RESIZE_CURSOR_BY_HANDLE: Readonly<Record<ResizeHandleKind, ResizeCursorAxis>> = {
  e: 'ew',
  w: 'ew',
  n: 'ns',
  s: 'ns',
  nw: 'nwse',
  se: 'nwse',
  ne: 'nesw',
  sw: 'nesw',
};

/** The cursor axis to show while hovering or dragging `kind`. */
export const resizeCursorForHandle = (kind: ResizeHandleKind): ResizeCursorAxis =>
  RESIZE_CURSOR_BY_HANDLE[kind];

/** Smallest rectangle span allowed by a resize (spec §6.2 "最小1セル"). */
const MIN_RECT_SIZE_CELLS = 1;

/**
 * Resize one axis: `fixed` is the edge opposite the dragged handle (stays
 * put), `dragged` is where the handle's pointer coordinate landed. Sorting
 * the pair back into `(min, max)` is exactly the flip normalisation issue #44
 * asks for — if `dragged` crosses past `fixed`, the two swap roles instead of
 * producing an inverted (`min > max`) rect. The minimum span is enforced by
 * pushing `dragged` away from `fixed` first, so a flip can never itself
 * collapse below {@link MIN_RECT_SIZE_CELLS}.
 */
const resizeAxis = (
  fixed: number,
  dragged: number
): { readonly min: number; readonly max: number } => {
  const clamped =
    dragged >= fixed
      ? Math.max(dragged, fixed + MIN_RECT_SIZE_CELLS)
      : Math.min(dragged, fixed - MIN_RECT_SIZE_CELLS);
  return clamped >= fixed
    ? { min: fixed, max: clamped }
    : { min: clamped, max: fixed };
};

/**
 * The new rectangle bounds after dragging `kind` so its handle sits at
 * `pointerVertex` (already snapped to a grid vertex by the caller). Each axis
 * the handle touches is resized independently via {@link resizeAxis}; an axis
 * the handle doesn't touch (e.g. the Y axis for the `e` handle) is left
 * unchanged. Dragging past the opposite edge flips the rectangle rather than
 * clamping at the minimum — "反転は正規化して扱う" (issue #44) — so the result
 * is always normalised (`min <= max`) with at least
 * {@link MIN_RECT_SIZE_CELLS} of span on every axis.
 */
export const resizeRectBounds = (
  bounds: GridRect,
  kind: ResizeHandleKind,
  pointerVertex: GridPoint
): GridRect => {
  let { minX, minY, maxX, maxY } = bounds;

  if (kind.includes('w')) {
    ({ min: minX, max: maxX } = resizeAxis(maxX, pointerVertex.x));
  } else if (kind.includes('e')) {
    ({ min: minX, max: maxX } = resizeAxis(minX, pointerVertex.x));
  }

  if (kind.includes('n')) {
    ({ min: minY, max: maxY } = resizeAxis(maxY, pointerVertex.y));
  } else if (kind.includes('s')) {
    ({ min: minY, max: maxY } = resizeAxis(minY, pointerVertex.y));
  }

  return { minX, minY, maxX, maxY };
};

/** The 4-vertex outer ring (TL, TR, BR, BL) for axis-aligned `bounds`. */
export const ringFromRect = (bounds: GridRect): GridRing => [
  { x: bounds.minX, y: bounds.minY },
  { x: bounds.maxX, y: bounds.minY },
  { x: bounds.maxX, y: bounds.maxY },
  { x: bounds.minX, y: bounds.maxY },
];

/**
 * Identifies one ring of a {@link GridPolygon} — the outer boundary or one
 * numbered hole (issue #50, spec §6.2 "ポリゴンは...頂点・辺を直接動かして変形する").
 * A hole's vertices are edited exactly like the outer ring's; this is only how
 * a caller says *which* ring a vertex or edge index belongs to.
 */
export type PolygonRingRef =
  | { readonly kind: 'outer' }
  | { readonly kind: 'inner'; readonly holeIndex: number };

/** One vertex of a polygon, identified by ring and index within that ring. */
export interface PolygonVertexRef {
  readonly ring: PolygonRingRef;
  readonly vertexIndex: number;
}

/** One edge of a polygon: the segment from vertex `edgeIndex` to the next one in the same ring (wrapping). */
export interface PolygonEdgeRef {
  readonly ring: PolygonRingRef;
  readonly edgeIndex: number;
}

/** The ring identified by `ref`, or `undefined` if the hole index is out of range. */
const ringByRef = (polygon: GridPolygon, ref: PolygonRingRef): GridRing | undefined =>
  ref.kind === 'outer' ? polygon.outerRing : polygon.innerRings[ref.holeIndex];

/** Every ring of `polygon` paired with the {@link PolygonRingRef} that identifies it. */
const allRings = (polygon: GridPolygon): readonly (readonly [PolygonRingRef, GridRing])[] => [
  [{ kind: 'outer' }, polygon.outerRing],
  ...polygon.innerRings.map(
    (ring, holeIndex): readonly [PolygonRingRef, GridRing] => [{ kind: 'inner', holeIndex }, ring]
  ),
];

/**
 * The polygon vertex (outer ring or a hole) nearest `point`, within
 * `hitRadius` grid units, or `null`. Ties are broken by ring/vertex order —
 * in practice a genuine tie only happens for a degenerate polygon, which
 * cannot reach this hit-test in the first place (issue #50: only a non-
 * rectangular, therefore already-valid, shape gets vertex editing).
 */
export const vertexAtPoint = (
  polygon: GridPolygon,
  point: GridPoint,
  hitRadius: number
): PolygonVertexRef | null => {
  let best: PolygonVertexRef | null = null;
  let bestDistance = hitRadius;
  for (const [ringRef, ring] of allRings(polygon)) {
    ring.forEach((vertex, vertexIndex) => {
      const distance = Math.hypot(point.x - vertex.x, point.y - vertex.y);
      if (distance <= bestDistance) {
        bestDistance = distance;
        best = { ring: ringRef, vertexIndex };
      }
    });
  }
  return best;
};

/** Squared distance from `point` to the closed segment `[a, b]`. */
const distanceToSegmentSquared = (point: GridPoint, a: GridPoint, b: GridPoint): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return (point.x - a.x) ** 2 + (point.y - a.y) ** 2;
  }
  const t = Math.max(
    0,
    Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)
  );
  const closestX = a.x + t * dx;
  const closestY = a.y + t * dy;
  return (point.x - closestX) ** 2 + (point.y - closestY) ** 2;
};

/**
 * The polygon edge (outer ring or a hole) nearest `point`, within `hitRadius`
 * grid units, or `null`. Checked only after {@link vertexAtPoint} finds
 * nothing, matching the resize-handle-before-body priority: grabbing a
 * vertex should never instead grab the edge that touches it.
 */
export const edgeAtPoint = (
  polygon: GridPolygon,
  point: GridPoint,
  hitRadius: number
): PolygonEdgeRef | null => {
  let best: PolygonEdgeRef | null = null;
  let bestDistanceSquared = hitRadius * hitRadius;
  for (const [ringRef, ring] of allRings(polygon)) {
    for (let edgeIndex = 0; edgeIndex < ring.length; edgeIndex += 1) {
      const a = ring[edgeIndex];
      const b = ring[(edgeIndex + 1) % ring.length];
      if (a === undefined || b === undefined) {
        continue;
      }
      const distanceSquared = distanceToSegmentSquared(point, a, b);
      if (distanceSquared <= bestDistanceSquared) {
        bestDistanceSquared = distanceSquared;
        best = { ring: ringRef, edgeIndex };
      }
    }
  }
  return best;
};

/** True when the segment `[a, b]` is horizontal or vertical. */
const isAxisAlignedEdge = (a: GridPoint, b: GridPoint): boolean => a.x === b.x || a.y === b.y;

/**
 * Whether the edge at `ref` is axis-aligned (spec §6.2: "軸平行の辺はその辺を平行
 * 移動" vs. "斜辺は両端頂点を同じ delta で移動" — both end up moving both
 * endpoints by the same delta, but callers use this to decide edge-drag
 * semantics vs. axis, e.g. showing an `ew`/`ns` cursor for an axis-aligned
 * edge). Returns `false` (treated as diagonal) if the ref is out of range.
 */
export const isAxisAlignedPolygonEdge = (polygon: GridPolygon, ref: PolygonEdgeRef): boolean => {
  const ring = ringByRef(polygon, ref.ring);
  if (ring === undefined) {
    return false;
  }
  const a = ring[ref.edgeIndex];
  const b = ring[(ref.edgeIndex + 1) % ring.length];
  if (a === undefined || b === undefined) {
    return false;
  }
  return isAxisAlignedEdge(a, b);
};

/**
 * Replaces one vertex of `polygon` at `ref` with `next`, leaving every other
 * vertex (including the same vertex in every other ring) untouched. Returns
 * `polygon` — the exact same reference — unchanged both when `ref` is out of
 * range and when `next` is already the vertex's position, so a caller can use
 * reference equality to detect "no net change" (matching how
 * {@link resizeRectBounds}'s callers compare `GridRect`s by value instead,
 * since a `GridRect` is cheap to compare structurally but a whole
 * {@link GridPolygon} is not).
 */
export const withVertexMoved = (
  polygon: GridPolygon,
  ref: PolygonVertexRef,
  next: GridPoint
): GridPolygon => {
  const ring = ringByRef(polygon, ref.ring);
  if (ring === undefined || ref.vertexIndex < 0 || ref.vertexIndex >= ring.length) {
    return polygon;
  }
  const current = ring[ref.vertexIndex];
  if (current !== undefined && current.x === next.x && current.y === next.y) {
    return polygon;
  }
  const nextRing = ring.map((vertex, index) => (index === ref.vertexIndex ? next : vertex));
  return withRingReplaced(polygon, ref.ring, nextRing);
};

/**
 * Translates both endpoints of the edge at `ref` by `delta` (spec §6.2: an
 * axis-aligned edge drag slides the whole edge, a diagonal edge drag moves
 * both endpoints by the same offset — the same operation either way). Returns
 * `polygon` — the exact same reference — unchanged both when `ref` is out of
 * range and when `delta` is zero, so a caller can use reference equality to
 * detect "no net change" the same way {@link withVertexMoved} does.
 */
export const withEdgeMoved = (
  polygon: GridPolygon,
  ref: PolygonEdgeRef,
  delta: GridPoint
): GridPolygon => {
  if (delta.x === 0 && delta.y === 0) {
    return polygon;
  }
  const ring = ringByRef(polygon, ref.ring);
  if (ring === undefined || ref.edgeIndex < 0 || ref.edgeIndex >= ring.length) {
    return polygon;
  }
  const nextIndex = (ref.edgeIndex + 1) % ring.length;
  const nextRing = ring.map((vertex, index) => {
    if (index !== ref.edgeIndex && index !== nextIndex) {
      return vertex;
    }
    return { x: vertex.x + delta.x, y: vertex.y + delta.y };
  });
  return withRingReplaced(polygon, ref.ring, nextRing);
};

/** Returns a copy of `polygon` with the ring identified by `ref` replaced by `nextRing`. */
const withRingReplaced = (
  polygon: GridPolygon,
  ref: PolygonRingRef,
  nextRing: GridRing
): GridPolygon => {
  if (ref.kind === 'outer') {
    return { ...polygon, outerRing: nextRing };
  }
  return {
    ...polygon,
    innerRings: polygon.innerRings.map((ring, index) => (index === ref.holeIndex ? nextRing : ring)),
  };
};
