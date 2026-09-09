import {
  MAX_ANNOTATION_FONT_SIZE,
  MIN_ANNOTATION_FONT_SIZE,
  isValidAnnotationFontSize,
  type DrawingBounds,
  type EditorDocument,
  type GroupId,
  type PhysicalScale,
  type ShapeGroup,
  type ShapeId,
} from '../model.js';
import { CommandApplicationError, type EditorCommand } from './command.js';
import { CompositeCommand } from './composite-command.js';
import {
  dropGroup,
  indexInZOrder,
  putGroup,
  requireGroup,
  requireShape,
  withAnnotationFontSize,
  withDrawingBounds,
  withPhysicalScale,
  withZOrder,
} from './document-mutations.js';

/**
 * Commands that change document structure rather than a single shape's own
 * data: stacking order, the export region, and the one-level grouping skeleton
 * (spec §7). Nested groups are never produced here.
 */

const moveWithinZOrder = (
  zOrder: readonly ShapeId[],
  shapeId: ShapeId,
  targetIndex: number,
): readonly ShapeId[] => {
  const without = zOrder.filter((id) => id !== shapeId);
  const clamped = Math.max(0, Math.min(targetIndex, without.length));
  return [...without.slice(0, clamped), shapeId, ...without.slice(clamped)];
};

/**
 * Move one shape to an absolute z-order slot (0 = backmost). The interaction
 * layer maps "bring forward", "send to back", etc. onto a concrete index.
 */
export class ReorderShapeCommand implements EditorCommand {
  readonly type = 'reorder-shape';
  readonly label = 'Reorder shape';

  constructor(
    private readonly shapeId: ShapeId,
    private readonly targetIndex: number,
  ) {}

  apply(document: EditorDocument): EditorDocument {
    indexInZOrder(document, this.shapeId);
    return withZOrder(
      document,
      moveWithinZOrder(document.zOrder, this.shapeId, this.targetIndex),
    );
  }

  invert(documentBeforeApply: EditorDocument): EditorCommand {
    const previousIndex = indexInZOrder(documentBeforeApply, this.shapeId);
    return new ReorderShapeCommand(this.shapeId, previousIndex);
  }
}

export class SetDrawingBoundsCommand implements EditorCommand {
  readonly type = 'set-drawing-bounds';
  readonly label = 'Change drawing bounds';

  constructor(private readonly drawingBounds: DrawingBounds) {}

  apply(document: EditorDocument): EditorDocument {
    return withDrawingBounds(document, this.drawingBounds);
  }

  invert(documentBeforeApply: EditorDocument): EditorCommand {
    return new SetDrawingBoundsCommand(documentBeforeApply.drawingBounds);
  }
}

/**
 * Set or clear the sketch's real-world scale (spec §8: `1セル = 数値 +
 * mm/cm/m`, optional). `undefined` returns the document to plain cell counts.
 * This is document-level state — a single scale applies to the whole sketch,
 * not per-shape — so it belongs beside {@link SetDrawingBoundsCommand} rather
 * than the shape Commands.
 */
export class SetPhysicalScaleCommand implements EditorCommand {
  readonly type = 'set-physical-scale';
  readonly label = 'Change physical scale';

  constructor(private readonly physicalScale: PhysicalScale | undefined) {}

  apply(document: EditorDocument): EditorDocument {
    return withPhysicalScale(document, this.physicalScale);
  }

  invert(documentBeforeApply: EditorDocument): EditorCommand {
    return new SetPhysicalScaleCommand(documentBeforeApply.physicalScale);
  }
}

/**
 * Set the sketch-wide annotation font size (issue #66, spec §8). Like
 * {@link SetPhysicalScaleCommand} this is document-level state — one size for
 * every shape name and dimension label, never per shape — so it lives here.
 * An out-of-range size is refused at `apply` time rather than silently
 * clamped: the caller (the settings panel) already clamps its input, so a bad
 * value reaching a Command is a programming error, not user input.
 */
export class SetAnnotationFontSizeCommand implements EditorCommand {
  readonly type = 'set-annotation-font-size';
  readonly label = 'Change annotation font size';

  constructor(private readonly annotationFontSize: number) {}

  apply(document: EditorDocument): EditorDocument {
    if (!isValidAnnotationFontSize(this.annotationFontSize)) {
      throw new CommandApplicationError(
        `Annotation font size must be an integer from ${MIN_ANNOTATION_FONT_SIZE} through ${MAX_ANNOTATION_FONT_SIZE}; received ${this.annotationFontSize}.`,
      );
    }
    return withAnnotationFontSize(document, this.annotationFontSize);
  }

  invert(documentBeforeApply: EditorDocument): EditorCommand {
    return new SetAnnotationFontSizeCommand(documentBeforeApply.annotationFontSize);
  }
}

/**
 * Group shapes into a new one-level group (spec §7, issue #52). Nested groups
 * are impossible by construction: when a shape in the selection already
 * belongs to a group, that whole existing group is dissolved and folded into
 * the new one rather than rejected — grouping a fresh selection that partly
 * overlaps an existing group is a normal editing move (e.g. "add this shape to
 * that group" via a re-selection + re-group), and refusing it would force a
 * manual ungroup first for no benefit. A shape can be dissolved out of at most
 * one existing group per `apply`, since a shape belongs to at most one group
 * at a time.
 */
export class GroupShapesCommand implements EditorCommand {
  readonly type = 'group-shapes';
  readonly label = 'Group shapes';

  constructor(
    private readonly groupId: GroupId,
    private readonly shapeIds: readonly ShapeId[],
  ) {}

  apply(document: EditorDocument): EditorDocument {
    if (document.groups[this.groupId] !== undefined) {
      throw new Error(`Group "${this.groupId}" already exists.`);
    }
    if (this.shapeIds.length < 2) {
      throw new Error('A group must contain at least two shapes.');
    }
    const seen = new Set<ShapeId>();
    for (const shapeId of this.shapeIds) {
      requireShape(document, shapeId);
      if (seen.has(shapeId)) {
        throw new Error(`Shape "${shapeId}" is listed twice for the group.`);
      }
      seen.add(shapeId);
    }

    const dissolvedGroupIds = new Set<GroupId>();
    for (const shapeId of this.shapeIds) {
      for (const group of Object.values(document.groups)) {
        if (group.shapeIds.includes(shapeId)) {
          dissolvedGroupIds.add(group.id);
        }
      }
    }

    let next = document;
    for (const dissolvedGroupId of dissolvedGroupIds) {
      next = dropGroup(next, dissolvedGroupId);
    }
    const group: ShapeGroup = { id: this.groupId, shapeIds: [...this.shapeIds] };
    return putGroup(next, group);
  }

  invert(documentBeforeApply: EditorDocument): EditorCommand {
    const dissolvedGroups: ShapeGroup[] = [];
    for (const shapeId of this.shapeIds) {
      for (const group of Object.values(documentBeforeApply.groups)) {
        if (group.shapeIds.includes(shapeId) && !dissolvedGroups.includes(group)) {
          dissolvedGroups.push(group);
        }
      }
    }
    if (dissolvedGroups.length === 0) {
      return new UngroupShapesCommand(this.groupId);
    }
    // Undo must both remove the new group and restore every group it
    // dissolved — one Command per concern, wrapped so the whole thing is
    // still a single history entry when this is itself the inverse of a redo.
    return new CompositeCommand(
      [
        new UngroupShapesCommand(this.groupId),
        ...dissolvedGroups.map(
          (group) => new GroupShapesCommand(group.id, group.shapeIds),
        ),
      ],
      'Undo group shapes',
    );
  }
}

export class UngroupShapesCommand implements EditorCommand {
  readonly type = 'ungroup-shapes';
  readonly label = 'Ungroup shapes';

  constructor(private readonly groupId: GroupId) {}

  apply(document: EditorDocument): EditorDocument {
    requireGroup(document, this.groupId);
    return dropGroup(document, this.groupId);
  }

  invert(documentBeforeApply: EditorDocument): EditorCommand {
    const group = requireGroup(documentBeforeApply, this.groupId);
    return new GroupShapesCommand(group.id, group.shapeIds);
  }
}
