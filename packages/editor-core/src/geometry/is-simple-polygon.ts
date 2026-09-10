import type { GridPoint, GridRing } from '../model.js';

/**
 * Self-intersection check for a single closed ring (issue #48, spec §6.3).
 * The interactive polygon-creation gesture must reject a shape whose edges
 * cross before it can be confirmed into a {@link GridPolygon}; this module is
 * the pure, framework-free predicate that decision is built on. It knows
 * nothing about pointer input, Commands, or the interaction controller — it
 * only answers "do these edges cross?" for whatever ring the caller hands it.
 */

/** Twice the signed area of the triangle `(a, b, c)`, via the cross product. */
const cross2 = (a: GridPoint, b: GridPoint, c: GridPoint): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/** True when `point` lies on the closed segment `[a, b]`, assuming collinearity. */
const isOnSegment = (a: GridPoint, b: GridPoint, point: GridPoint): boolean =>
  Math.min(a.x, b.x) <= point.x &&
  point.x <= Math.max(a.x, b.x) &&
  Math.min(a.y, b.y) <= point.y &&
  point.y <= Math.max(a.y, b.y);

/**
 * True when open segments `[a, b]` and `[c, d]` share any point — a proper
 * crossing, a T-touch (one segment's interior meets the other's endpoint), or
 * an overlapping collinear stretch. Endpoints coinciding at exactly one shared
 * point (e.g. two edges that only meet where they are supposed to, at a
 * shared ring vertex) must be excluded by the caller before calling this —
 * see {@link isSimplePolygon}'s adjacent-edge skip.
 */
const segmentsIntersect = (a: GridPoint, b: GridPoint, c: GridPoint, d: GridPoint): boolean => {
  const d1 = cross2(c, d, a);
  const d2 = cross2(c, d, b);
  const d3 = cross2(a, b, c);
  const d4 = cross2(a, b, d);

  // Proper crossing: a and b lie strictly on opposite sides of line cd, and
  // vice versa.
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  // Collinear touches / overlaps: an endpoint of one segment lies exactly on
  // the other segment.
  if (d1 === 0 && isOnSegment(c, d, a)) return true;
  if (d2 === 0 && isOnSegment(c, d, b)) return true;
  if (d3 === 0 && isOnSegment(a, b, c)) return true;
  if (d4 === 0 && isOnSegment(a, b, d)) return true;

  return false;
};

/** True when `a` and `b` are the same grid point. */
const samePoint = (a: GridPoint, b: GridPoint): boolean => a.x === b.x && a.y === b.y;

/**
 * True when `ring` is a simple polygon: no two of its edges cross, other than
 * consecutive edges meeting at their shared vertex, and no vertex repeats.
 * Closure is implicit — the edge from the last vertex back to the first is
 * checked like any other. Fewer than 3 distinct vertices is not a polygon at
 * all, so it counts as not simple.
 */
export const isSimplePolygon = (ring: GridRing): boolean => {
  const n = ring.length;
  if (n < 3) {
    return false;
  }

  // No repeated vertex anywhere in the ring (a self-touching point is a
  // self-intersection even though it needs no segment-pair test to see).
  const seen = new Set<string>();
  for (const point of ring) {
    const key = `${point.x},${point.y}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
  }

  for (let i = 0; i < n; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    if (a === undefined || b === undefined) {
      continue;
    }
    // A zero-length edge means two consecutive vertices coincide — already
    // caught by the repeated-vertex check above, but degenerate edges also
    // break the segment-intersection math below, so skip them defensively.
    if (samePoint(a, b)) {
      continue;
    }

    for (let j = i + 1; j < n; j += 1) {
      // Skip the edge against itself and its two ring-adjacent neighbours —
      // consecutive edges legitimately share exactly their common vertex.
      const isSameEdge = j === i;
      const isNextEdge = j === (i + 1) % n;
      const isPrevEdge = (j + 1) % n === i;
      if (isSameEdge || isNextEdge || isPrevEdge) {
        continue;
      }

      const c = ring[j];
      const d = ring[(j + 1) % n];
      if (c === undefined || d === undefined || samePoint(c, d)) {
        continue;
      }

      if (segmentsIntersect(a, b, c, d)) {
        return false;
      }
    }
  }

  return true;
};
