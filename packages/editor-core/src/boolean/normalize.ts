import type { GridPolygon, GridRing } from '../model.js';
import {
  cleanRing,
  doubleSignedArea,
  hasIntegerCoordinates,
  orientRing,
} from './geometry.js';

/**
 * The multi-polygon shape produced by `polygon-clipping`: an array of polygons,
 * each an array of rings, each ring an array of `[x, y]` pairs with the first
 * pair repeated at the end (explicit closure).
 *
 * Declared here so {@link normalizeMultiPolygon} takes a plain data structure
 * and never a library type, keeping `polygon-clipping` out of every module but
 * the Adapter itself.
 */
export type ClosedRing = readonly (readonly [number, number])[];
export type ClosedPolygon = readonly ClosedRing[];
export type ClosedMultiPolygon = readonly ClosedPolygon[];

const toGridRing = (ring: ClosedRing): GridRing =>
  ring.map(([x, y]) => ({ x, y }));

/**
 * Rounds a ring's coordinates to the nearest integer. `polygon-clipping` keeps
 * integer input exact, so this only guards against floating dust; a coordinate
 * that is already an integer is left untouched.
 */
const snapRingToIntegers = (ring: GridRing): GridRing =>
  ring.map((point) => ({ x: Math.round(point.x), y: Math.round(point.y) }));

/**
 * Turns one `polygon-clipping` polygon into a Gridder {@link GridPolygon} with
 * implicit closure, integer coordinates, no duplicate or collinear vertices,
 * a counter-clockwise outer ring and clockwise inner rings.
 *
 * Returns `undefined` when the outer ring is degenerate (zero area after
 * cleanup), so the caller can drop it.
 */
const normalizePolygon = (polygon: ClosedPolygon): GridPolygon | undefined => {
  const [rawOuter, ...rawInners] = polygon;
  if (rawOuter === undefined) {
    return undefined;
  }

  const outerRing = cleanRing(snapRingToIntegers(toGridRing(rawOuter)));
  if (outerRing.length < 3 || doubleSignedArea(outerRing) === 0) {
    return undefined;
  }

  const innerRings: GridRing[] = [];
  for (const rawInner of rawInners) {
    const innerRing = cleanRing(snapRingToIntegers(toGridRing(rawInner)));
    if (innerRing.length < 3 || doubleSignedArea(innerRing) === 0) {
      continue;
    }
    innerRings.push(orientRing(innerRing, false));
  }

  return {
    outerRing: orientRing(outerRing, true),
    innerRings,
  };
};

/**
 * Normalizes a whole `polygon-clipping` result into a list of grid polygons.
 * Disconnected regions arrive as separate polygons and stay separate; a region
 * with a hole keeps its inner ring. The list is ordered by descending outer-ring
 * area so repeated identical operations produce byte-identical output.
 */
export const normalizeMultiPolygon = (
  multiPolygon: ClosedMultiPolygon,
): readonly GridPolygon[] => {
  const normalized: GridPolygon[] = [];
  for (const polygon of multiPolygon) {
    const result = normalizePolygon(polygon);
    if (result !== undefined) {
      normalized.push(result);
    }
  }

  return normalized.sort((first, second) => {
    const areaDelta =
      Math.abs(doubleSignedArea(second.outerRing)) -
      Math.abs(doubleSignedArea(first.outerRing));
    if (areaDelta !== 0) {
      return areaDelta;
    }
    return compareRings(first.outerRing, second.outerRing);
  });
};

/** Lexicographic ring comparison, used only to break area ties deterministically. */
const compareRings = (first: GridRing, second: GridRing): number => {
  const length = Math.min(first.length, second.length);
  for (let index = 0; index < length; index += 1) {
    const a = first[index] as GridRing[number];
    const b = second[index] as GridRing[number];
    if (a.x !== b.x) {
      return a.x - b.x;
    }
    if (a.y !== b.y) {
      return a.y - b.y;
    }
  }
  return first.length - second.length;
};

/** True when every ring of the polygon has integer coordinates. */
export const isIntegerPolygon = (polygon: GridPolygon): boolean =>
  hasIntegerCoordinates(polygon.outerRing) &&
  polygon.innerRings.every(hasIntegerCoordinates);
