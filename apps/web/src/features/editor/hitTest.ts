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
