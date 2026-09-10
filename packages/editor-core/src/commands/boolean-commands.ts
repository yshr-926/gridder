import type { PolygonBooleanEngine } from '../boolean/engine.js';
import { splitDisjointPolygons } from '../boolean/split.js';
import type { EditorDocument, EditorShape, GridPolygon, ShapeGroup, ShapeId } from '../model.js';
import { CommandApplicationError, type EditorCommand } from './command.js';
import {
  indexInZOrder,
  insertShape,
  putGroup,
  removeShape,
  replaceShape,
  requireShape,
  withShapePolygon,
} from './document-mutations.js';

/**
 * Boolean operations between whole shapes (issue #62, ADR-0006, spec §7):
 * *combine* unions the selected shapes into one, *subtract* uses the
 * frontmost selected shape as a cutter and removes it from every other
 * selected shape. Both replace the retired cell editing of issue #49 —
 * instead of painting cells onto a shape, the user arranges rectangles and
 * polygons and merges or carves them.
 *
 * The geometry comes from a {@link PolygonBooleanEngine} handed in by the
 * caller (the polygon-boolean Adapter port of ADR-0001), so this module never
 * imports the concrete library. Every Command here is one history entry:
 * `apply` derives the whole result and `invert` restores the shapes, z-order,
 * and groups exactly as they were, so Undo returns the untouched originals.
 */

/** Shapes that take part in a boolean operation: at least a subject and one more. */
const MIN_OPERAND_COUNT = 2;

const requireOperands = (
  document: EditorDocument,
  shapeIds: readonly ShapeId[],
  operation: string
): readonly EditorShape[] => {
  if (shapeIds.length < MIN_OPERAND_COUNT) {
    throw new CommandApplicationError(`${operation} needs at least two shapes.`);
  }
  const seen = new Set<ShapeId>();
  return shapeIds.map((shapeId) => {
    if (seen.has(shapeId)) {
      throw new CommandApplicationError(`Shape "${shapeId}" is listed twice for ${operation}.`);
    }
    seen.add(shapeId);
    return requireShape(document, shapeId);
  });
};

/**
 * The shape among `shapeIds` that is drawn last (highest z-order slot). It
 * is the style / name donor of a combine and the cutter of a subtract,
 * matching the "frontmost object wins" convention of Illustrator's Pathfinder.
 */
export const frontmostShapeId = (
  document: EditorDocument,
  shapeIds: readonly ShapeId[]
): ShapeId => {
  let frontmost: ShapeId | undefined;
  let frontmostIndex = -1;
  for (const shapeId of shapeIds) {
    const index = indexInZOrder(document, shapeId);
    if (index > frontmostIndex) {
      frontmostIndex = index;
      frontmost = shapeId;
    }
  }
  if (frontmost === undefined) {
    throw new CommandApplicationError('At least one shape id is required.');
  }
  return frontmost;
};

/** The one-level group `shapeId` belongs to, or `undefined`. */
const groupOf = (document: EditorDocument, shapeId: ShapeId): ShapeGroup | undefined =>
  Object.values(document.groups).find((group) => group.shapeIds.includes(shapeId));

/**
 * A fresh id for a piece split off `baseId`, derived deterministically from
 * the base rather than drawn from a random generator: `apply` must yield the
 * same document on redo as on the first run (`DocumentHistory.redo` re-runs
 * `apply`), and an id derived from the document it is applied to does
 * exactly that. `-2`, `-3`, ... are tried in order, skipping ids already in
 * use.
 */
const derivePieceId = (baseId: ShapeId, takenIds: Set<ShapeId>): ShapeId => {
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${baseId}-${suffix}`;
    if (!takenIds.has(candidate)) {
      takenIds.add(candidate);
      return candidate;
    }
  }
};

/**
 * The union of the selected shapes' polygons as the boolean Adapter returns
 * it: exactly one polygon when every shape overlaps or touches another along
 * an edge, more than one when the selection has disconnected parts. Exposed
 * so the application layer can decide *before* dispatching whether a
 * {@link CombineShapesCommand} would be accepted.
 */
export const unionOfShapes = (
  document: EditorDocument,
  shapeIds: readonly ShapeId[],
  engine: PolygonBooleanEngine
): readonly GridPolygon[] => {
  const shapes = requireOperands(document, shapeIds, 'Combine');
  return splitDisjointPolygons(engine.union(shapes.map((shape) => shape.polygon)));
};

/**
 * Restores `shapes`, `zOrder`, and `groups` to a recorded snapshot. Used as
 * the inverse of the boolean Commands, whose results (derived piece ids,
 * dropped groups, removed cutters) are easier to undo by putting the
 * pre-operation structure back than by replaying each change in reverse.
 * Drawing bounds and physical scale are left alone — the boolean Commands
 * never touch them.
 */
class RestoreShapesCommand implements EditorCommand {
  readonly type = 'restore-shapes';
  readonly label: string;

  constructor(
    private readonly snapshot: Pick<EditorDocument, 'shapes' | 'zOrder' | 'groups'>,
    private readonly forward: EditorCommand
  ) {
    this.label = `Undo ${forward.label}`;
  }

  apply(document: EditorDocument): EditorDocument {
    return {
      ...document,
      shapes: this.snapshot.shapes,
      zOrder: this.snapshot.zOrder,
      groups: this.snapshot.groups,
    };
  }

  invert(): EditorCommand {
    return this.forward;
  }
}

const snapshotOf = (
  document: EditorDocument
): Pick<EditorDocument, 'shapes' | 'zOrder' | 'groups'> => ({
  shapes: document.shapes,
  zOrder: document.zOrder,
  groups: document.groups,
});

/**
 * Unions two or more shapes into one (spec §7 "結合"). The frontmost shape
 * keeps its id, z-order slot, name, and style and receives the merged
 * polygon; every other operand is deleted. Two rectangles sharing an edge
 * become one L-shape this way.
 *
 * ## Disconnected selections are refused
 *
 * A union of shapes that neither overlap nor share an edge is more than one
 * polygon. This Command refuses that case (throws
 * {@link CommandApplicationError}) instead of leaving several shapes behind:
 * "結合" promises exactly one shape, and silently producing two shapes with
 * unified style and fresh ids would look like nothing happened while still
 * consuming an Undo step. Gridder already has grouping (spec §7) for keeping
 * separate shapes together, so a disconnected combine has no useful
 * meaning of its own. The application layer checks {@link unionOfShapes}
 * first and explains the refusal to the user without dispatching. Shapes
 * that only touch at a corner count as disconnected: they cannot form one
 * simple polygon.
 */
export class CombineShapesCommand implements EditorCommand {
  readonly type = 'combine-shapes';
  readonly label = 'Combine shapes';

  constructor(
    private readonly shapeIds: readonly ShapeId[],
    private readonly engine: PolygonBooleanEngine
  ) {}

  apply(document: EditorDocument): EditorDocument {
    const polygons = unionOfShapes(document, this.shapeIds, this.engine);
    if (polygons.length !== 1) {
      throw new CommandApplicationError(
        'Combine needs shapes that overlap or share an edge; the union is not one connected polygon.'
      );
    }
    const keeperId = frontmostShapeId(document, this.shapeIds);
    const keeper = requireShape(document, keeperId);
    let next = replaceShape(document, withShapePolygon(keeper, polygons[0] as GridPolygon));
    for (const shapeId of this.shapeIds) {
      if (shapeId !== keeperId) {
        next = removeShape(next, shapeId);
      }
    }
    return next;
  }

  invert(documentBeforeApply: EditorDocument): EditorCommand {
    return new RestoreShapesCommand(snapshotOf(documentBeforeApply), this);
  }
}

/**
 * Subtracts the frontmost selected shape from every other selected shape
 * (spec §7 "くり抜き", Illustrator's "Minus Front"). The cutter is consumed —
 * it is deleted whether or not it touched anything. Each remaining subject
 * keeps its id, slot, name, and style for the largest surviving region; a
 * subject that the cutter disconnects splits into independent shapes
 * (ADR-0001), the extra pieces inserted right above it in z-order with
 * derived ids and the same name, style, and group membership; a subject
 * fully covered by the cutter is deleted. A cutter that merely dents a
 * subject or sits inside it leaves one shape with a concavity or a hole.
 */
export class SubtractShapesCommand implements EditorCommand {
  readonly type = 'subtract-shapes';
  readonly label = 'Subtract shapes';

  constructor(
    private readonly shapeIds: readonly ShapeId[],
    private readonly engine: PolygonBooleanEngine
  ) {}

  apply(document: EditorDocument): EditorDocument {
    requireOperands(document, this.shapeIds, 'Subtract');
    const cutterId = frontmostShapeId(document, this.shapeIds);
    const cutter = requireShape(document, cutterId);
    // Subjects are processed back to front so derived ids and z-order
    // insertions stay deterministic regardless of selection order.
    const subjectIds = document.zOrder.filter(
      (shapeId) => shapeId !== cutterId && this.shapeIds.includes(shapeId)
    );
    const takenIds = new Set(Object.keys(document.shapes));

    let next = document;
    for (const subjectId of subjectIds) {
      const subject = requireShape(next, subjectId);
      const pieces = splitDisjointPolygons(
        this.engine.difference(subject.polygon, [cutter.polygon])
      );
      const [largest, ...rest] = pieces;
      if (largest === undefined) {
        next = removeShape(next, subjectId);
        continue;
      }
      next = replaceShape(next, withShapePolygon(subject, largest));
      let zIndex = indexInZOrder(next, subjectId) + 1;
      for (const polygon of rest) {
        const piece: EditorShape = { ...subject, id: derivePieceId(subjectId, takenIds), polygon };
        next = insertShape(next, piece, zIndex);
        zIndex += 1;
        const group = groupOf(next, subjectId);
        if (group !== undefined) {
          next = putGroup(next, { ...group, shapeIds: [...group.shapeIds, piece.id] });
        }
      }
    }
    return removeShape(next, cutterId);
  }

  invert(documentBeforeApply: EditorDocument): EditorCommand {
    return new RestoreShapesCommand(snapshotOf(documentBeforeApply), this);
  }
}
