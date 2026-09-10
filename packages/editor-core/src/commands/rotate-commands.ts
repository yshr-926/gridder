import type {
  EditorDocument,
  EditorShape,
  GridPoint,
  GridPolygon,
  GridRing,
  ShapeId,
} from '../model.js';
import type { EditorCommand } from './command.js';
import { replaceShape, requireShape, withShapePolygon } from './document-mutations.js';

/** `cw` turns clockwise, `ccw` counter-clockwise; both are 90° (spec §6.2 / §7). */
export type RotationDirection = 'cw' | 'ccw';

const opposite = (direction: RotationDirection): RotationDirection =>
  direction === 'cw' ? 'ccw' : 'cw';

interface BoundingBox {
  readonly min: GridPoint;
  readonly max: GridPoint;
}

const EMPTY_BOUNDS_ERROR = 'RotateShapesCommand needs at least one shape to rotate.';

/** Axis-aligned bounding box in grid units covering every vertex of `shapes`. */
const boundingBoxOf = (shapes: readonly EditorShape[]): BoundingBox => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const shape of shapes) {
    const rings = [shape.polygon.outerRing, ...shape.polygon.innerRings];
    for (const ring of rings) {
      for (const point of ring) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }
  }
  if (!Number.isFinite(minX)) {
    throw new Error(EMPTY_BOUNDS_ERROR);
  }
  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
};

/**
 * Rotates one point 90° within a `width` x `height` local frame anchored at
 * `bounds.min` — see the module doc comment for why this keeps every
 * coordinate an integer.
 */
const rotatePoint = (
  point: GridPoint,
  bounds: BoundingBox,
  width: number,
  height: number,
  direction: RotationDirection
): GridPoint => {
  const localX = point.x - bounds.min.x;
  const localY = point.y - bounds.min.y;
  const [rotatedX, rotatedY] =
    direction === 'cw' ? [height - localY, localX] : [localY, width - localX];
  return { x: bounds.min.x + rotatedX, y: bounds.min.y + rotatedY };
};

const rotateRing = (
  ring: GridRing,
  bounds: BoundingBox,
  width: number,
  height: number,
  direction: RotationDirection
): GridRing => ring.map((point) => rotatePoint(point, bounds, width, height, direction));

const rotatePolygon = (
  polygon: GridPolygon,
  bounds: BoundingBox,
  width: number,
  height: number,
  direction: RotationDirection
): GridPolygon => ({
  outerRing: rotateRing(polygon.outerRing, bounds, width, height, direction),
  innerRings: polygon.innerRings.map((ring) => rotateRing(ring, bounds, width, height, direction)),
});

/**
 * Rotates the shapes in `shapeIds` 90° as one rigid group, pivoting on the
 * selection's shared bounding box (spec §6.2 "回転は90度単位とし、回転後も全頂点を
 * グリッド上に保つ" and spec §7 for multi-select). Holes rotate with their
 * shape since {@link rotatePolygon} transforms every ring, inner and outer.
 *
 * ## Keeping every vertex on the grid
 *
 * A naive pivot at the bounding box's *center* — `((min.x+max.x)/2,
 * (min.y+max.y)/2)` — is a half-integer whenever the box has an odd width or
 * height, and rotating around a half-integer point can land vertices off the
 * grid. Instead this Command anchors on the box's `min` corner (always
 * integer, since every stored vertex is) and works in a local frame:
 *
 * 1. Translate each point into local coordinates relative to `bounds.min`.
 * 2. Rotate 90° *within that local frame*, swapping which axis the local
 *    width/height span (a `w`-by-`h` box becomes `h`-by-`w`): clockwise maps
 *    `(lx, ly) -> (h - ly, lx)`; counter-clockwise maps `(lx, ly) -> (ly, w -
 *    lx)`, where `w`/`h` are the pre-rotation box width/height. Both are
 *    integer-only arithmetic, so no rounding is ever needed.
 * 3. Translate back by re-adding `bounds.min`, so the rotated group's bounding
 *    box keeps the same top-left corner the original had (the group turns in
 *    place rather than sliding).
 *
 * Applying either direction four times returns every vertex to its exact
 * starting coordinate, because each application is an exact integer
 * involution-free 90° turn with no accumulated rounding.
 */
export class RotateShapesCommand implements EditorCommand {
  readonly type = 'rotate-shapes';
  readonly label = 'Rotate';

  constructor(
    private readonly shapeIds: readonly ShapeId[],
    private readonly direction: RotationDirection
  ) {}

  apply(document: EditorDocument): EditorDocument {
    const shapes = this.shapeIds.map((id) => requireShape(document, id));
    const bounds = boundingBoxOf(shapes);
    const width = bounds.max.x - bounds.min.x;
    const height = bounds.max.y - bounds.min.y;

    return shapes.reduce((working, shape) => {
      const rotated = rotatePolygon(shape.polygon, bounds, width, height, this.direction);
      return replaceShape(working, withShapePolygon(shape, rotated));
    }, document);
  }

  invert(): EditorCommand {
    return new RotateShapesCommand(this.shapeIds, opposite(this.direction));
  }
}
