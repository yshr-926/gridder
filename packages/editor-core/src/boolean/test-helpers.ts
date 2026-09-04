import type { GridPoint, GridPolygon, GridRing } from '../model.js';
import { areCollinear, doubleSignedArea } from './geometry.js';

/**
 * Shared builders and invariant checks for the polygon boolean tests. Kept in a
 * plain `.ts` module (not a `.test.ts`) so both the golden and property suites
 * import the same helpers.
 */

/** A closed square with its lower-left corner at `(x, y)` and the given size. */
export const square = (x: number, y: number, size = 1): GridPolygon => ({
  outerRing: [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ],
  innerRings: [],
});

/** A rectangle spanning `[minX, maxX] x [minY, maxY]`. */
export const rectangle = (
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): GridPolygon => ({
  outerRing: [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ],
  innerRings: [],
});

const isSamePoint = (first: GridPoint, second: GridPoint): boolean =>
  first.x === second.x && first.y === second.y;

/** Rotates a ring so its lexicographically smallest vertex comes first. */
const canonicalizeRing = (ring: GridRing): GridRing => {
  let startIndex = 0;
  for (let index = 1; index < ring.length; index += 1) {
    const candidate = ring[index] as GridPoint;
    const current = ring[startIndex] as GridPoint;
    if (
      candidate.x < current.x ||
      (candidate.x === current.x && candidate.y < current.y)
    ) {
      startIndex = index;
    }
  }
  return [...ring.slice(startIndex), ...ring.slice(0, startIndex)];
};

/**
 * A stable string form of a polygon: outer ring canonicalized, inner rings
 * canonicalized and sorted. Two polygons with the same key describe the same
 * region regardless of vertex start offset or inner-ring order.
 */
export const polygonKey = (polygon: GridPolygon): string => {
  const outer = JSON.stringify(canonicalizeRing(polygon.outerRing));
  const inners = polygon.innerRings
    .map((ring) => JSON.stringify(canonicalizeRing(ring)))
    .sort();
  return `${outer}|${inners.join('#')}`;
};

/** An order-independent key for a whole boolean result. */
export const resultKey = (polygons: readonly GridPolygon[]): string =>
  polygons.map(polygonKey).sort().join('||');

const assertRingIsClean = (ring: GridRing, label: string): void => {
  if (ring.length < 3) {
    throw new Error(`${label}: ring has fewer than 3 vertices`);
  }
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index] as GridPoint;
    const next = ring[(index + 1) % ring.length] as GridPoint;
    const previous = ring[(index - 1 + ring.length) % ring.length] as GridPoint;
    if (!Number.isInteger(current.x) || !Number.isInteger(current.y)) {
      throw new Error(`${label}: non-integer vertex ${JSON.stringify(current)}`);
    }
    if (isSamePoint(current, next)) {
      throw new Error(`${label}: consecutive duplicate vertex`);
    }
    if (areCollinear(previous, current, next)) {
      throw new Error(`${label}: collinear vertex ${JSON.stringify(current)}`);
    }
  }
};

/**
 * Throws unless every polygon satisfies the Adapter's normalization contract:
 * integer coordinates, no duplicate or collinear vertices, counter-clockwise
 * outer ring, clockwise inner rings.
 */
export const assertNormalized = (polygons: readonly GridPolygon[]): void => {
  polygons.forEach((polygon, polygonIndex) => {
    assertRingIsClean(polygon.outerRing, `polygon[${polygonIndex}].outerRing`);
    if (doubleSignedArea(polygon.outerRing) <= 0) {
      throw new Error(
        `polygon[${polygonIndex}].outerRing is not counter-clockwise`,
      );
    }
    polygon.innerRings.forEach((ring, ringIndex) => {
      assertRingIsClean(
        ring,
        `polygon[${polygonIndex}].innerRings[${ringIndex}]`,
      );
      if (doubleSignedArea(ring) >= 0) {
        throw new Error(
          `polygon[${polygonIndex}].innerRings[${ringIndex}] is not clockwise`,
        );
      }
    });
  });
};

/**
 * The total covered area of a result: sum of outer-ring areas minus inner-ring
 * areas, using absolute shoelace values so winding does not matter. Doubled to
 * stay integral.
 */
export const coveredDoubleArea = (polygons: readonly GridPolygon[]): number =>
  polygons.reduce((total, polygon) => {
    const outer = Math.abs(doubleSignedArea(polygon.outerRing));
    const holes = polygon.innerRings.reduce(
      (sum, ring) => sum + Math.abs(doubleSignedArea(ring)),
      0,
    );
    return total + outer - holes;
  }, 0);

/** A tiny deterministic PRNG (mulberry32) so property runs are reproducible. */
export const createRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Rasterizes a normalized result onto an integer grid and returns the set of
 * covered unit cells as `"cx,cy"` keys. Uses an even-odd ray cast per cell
 * center against every ring, which is enough for the axis-aligned, hole-bearing
 * polygons these tests produce.
 */
export const coveredCells = (
  polygons: readonly GridPolygon[],
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
): Set<string> => {
  const cells = new Set<string>();
  for (let cx = bounds.minX; cx < bounds.maxX; cx += 1) {
    for (let cy = bounds.minY; cy < bounds.maxY; cy += 1) {
      const px = cx + 0.5;
      const py = cy + 0.5;
      let inside = false;
      for (const polygon of polygons) {
        const rings = [polygon.outerRing, ...polygon.innerRings];
        let windingParity = false;
        for (const ring of rings) {
          for (let index = 0; index < ring.length; index += 1) {
            const a = ring[index] as GridPoint;
            const b = ring[(index + 1) % ring.length] as GridPoint;
            const straddles = a.y > py !== b.y > py;
            if (!straddles) {
              continue;
            }
            const crossX = ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x;
            if (px < crossX) {
              windingParity = !windingParity;
            }
          }
        }
        if (windingParity) {
          inside = true;
          break;
        }
      }
      if (inside) {
        cells.add(`${cx},${cy}`);
      }
    }
  }
  return cells;
};
