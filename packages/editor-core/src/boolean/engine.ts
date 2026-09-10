import type { GridPolygon } from '../model.js';

/**
 * A boolean operation between grid polygons.
 *
 * `union` merges whole shapes into one (ADR-0006: combining shapes is the
 * union of their polygons). `difference` subtracts one shape from another and
 * may leave several disconnected pieces, which the caller turns into
 * independent shapes (ADR-0001). `intersection` is intentionally absent until
 * a feature needs it.
 */
export interface PolygonBooleanEngine {
  /**
   * Returns the union of every operand as a normalized list of grid polygons.
   * An empty operand list yields an empty result.
   */
  union(operands: readonly GridPolygon[]): readonly GridPolygon[];

  /**
   * Returns `subject` with every polygon in `clips` removed, as a normalized
   * list of grid polygons. The result is empty when the subject is fully
   * covered, and has more than one entry when the subtraction disconnects it.
   */
  difference(subject: GridPolygon, clips: readonly GridPolygon[]): readonly GridPolygon[];
}

/**
 * Every polygon a {@link PolygonBooleanEngine} returns satisfies these rules:
 *
 * - all vertices are integers;
 * - no ring repeats its first vertex at the end, and no ring has consecutive
 *   duplicate or collinear vertices;
 * - the outer ring winds counter-clockwise (positive shoelace area over the
 *   stored `(x, y)` coordinates) and every inner ring winds clockwise
 *   (negative area);
 * - results that form disconnected regions are split into separate polygons,
 *   while a single region with a hole keeps its inner ring.
 */
export type NormalizedGridPolygon = GridPolygon;
