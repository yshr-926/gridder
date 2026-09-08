import type { GridPoint, GridRing } from '../model.js';

/**
 * Pure integer-grid ring helpers shared by the polygon boolean Adapter and by
 * the vertex-editing commit path (issue #64, {@link cleanPolygon}).
 *
 * None of these functions know about `polygon-clipping`, pointer input, or
 * Commands; they operate only on Gridder's own {@link GridRing} values with
 * implicit closure (the edge from the last vertex back to the first is never
 * stored as a repeated vertex).
 */

/**
 * Twice the signed area of a ring, computed with the shoelace formula over the
 * grid coordinates exactly as they are stored. A positive result means the ring
 * winds counter-clockwise in raw `(x, y)` space, a negative result clockwise.
 *
 * Returning twice the area keeps the value an integer for integer input, which
 * avoids floating-point comparisons when only the sign matters.
 */
export const doubleSignedArea = (ring: GridRing): number => {
  let total = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    if (current === undefined || next === undefined) {
      continue;
    }
    total += current.x * next.y - next.x * current.y;
  }
  return total;
};

/** True when the three points lie on a single straight line. */
export const areCollinear = (
  first: GridPoint,
  second: GridPoint,
  third: GridPoint,
): boolean => {
  const cross =
    (second.x - first.x) * (third.y - first.y) -
    (second.y - first.y) * (third.x - first.x);
  return cross === 0;
};

const isSamePoint = (first: GridPoint, second: GridPoint): boolean =>
  first.x === second.x && first.y === second.y;

/**
 * Removes duplicate vertices (both adjacent repeats and an explicit closing
 * vertex equal to the first) and vertices that sit on a straight line between
 * their neighbours. The winding direction is preserved.
 *
 * The result has no implicit or explicit repeated closing vertex; a ring that
 * collapses to fewer than three distinct vertices returns an empty array so the
 * caller can drop it.
 */
export const cleanRing = (ring: GridRing): GridRing => {
  const deduped: GridPoint[] = [];
  for (const point of ring) {
    const previous = deduped[deduped.length - 1];
    if (previous !== undefined && isSamePoint(previous, point)) {
      continue;
    }
    deduped.push({ x: point.x, y: point.y });
  }
  while (
    deduped.length > 1 &&
    isSamePoint(deduped[0] as GridPoint, deduped[deduped.length - 1] as GridPoint)
  ) {
    deduped.pop();
  }

  if (deduped.length < 3) {
    return [];
  }

  const withoutCollinear: GridPoint[] = [];
  for (let index = 0; index < deduped.length; index += 1) {
    const previous =
      withoutCollinear[withoutCollinear.length - 1] ??
      (deduped[deduped.length - 1] as GridPoint);
    const current = deduped[index] as GridPoint;
    const next = deduped[(index + 1) % deduped.length] as GridPoint;
    if (areCollinear(previous, current, next)) {
      continue;
    }
    withoutCollinear.push(current);
  }

  // Removing the last kept vertex can make the new first and last collinear
  // through the wrap-around edge; sweep once more from the front.
  while (withoutCollinear.length >= 3) {
    const first = withoutCollinear[0] as GridPoint;
    const second = withoutCollinear[1] as GridPoint;
    const last = withoutCollinear[withoutCollinear.length - 1] as GridPoint;
    if (areCollinear(last, first, second)) {
      withoutCollinear.shift();
      continue;
    }
    break;
  }

  return withoutCollinear.length < 3 ? [] : withoutCollinear;
};

/** Returns the ring reversed, i.e. with the opposite winding direction. */
export const reverseRing = (ring: GridRing): GridRing =>
  ring.map((point) => ({ x: point.x, y: point.y })).reverse();

/**
 * Forces a ring to wind counter-clockwise (positive signed area) when
 * `wantCounterClockwise` is true, and clockwise (negative signed area)
 * otherwise. A degenerate ring with zero area is returned unchanged.
 */
export const orientRing = (
  ring: GridRing,
  wantCounterClockwise: boolean,
): GridRing => {
  const area = doubleSignedArea(ring);
  if (area === 0) {
    return ring;
  }
  const isCounterClockwise = area > 0;
  return isCounterClockwise === wantCounterClockwise ? ring : reverseRing(ring);
};

/** True when every vertex of the ring has integer coordinates. */
export const hasIntegerCoordinates = (ring: GridRing): boolean =>
  ring.every((point) => Number.isInteger(point.x) && Number.isInteger(point.y));
