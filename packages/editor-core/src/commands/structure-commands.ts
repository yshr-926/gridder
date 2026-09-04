import type {
  DrawingBounds,
  EditorDocument,
  GroupId,
  ShapeGroup,
  ShapeId,
} from '../model.js';
import type { EditorCommand } from './command.js';
import {
  dropGroup,
  indexInZOrder,
  putGroup,
  requireGroup,
  requireShape,
  withDrawingBounds,
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
      for (const group of Object.values(document.groups)) {
        if (group.shapeIds.includes(shapeId)) {
          throw new Error(`Shape "${shapeId}" already belongs to a group.`);
        }
      }
    }
    const group: ShapeGroup = { id: this.groupId, shapeIds: [...this.shapeIds] };
    return putGroup(document, group);
  }

  invert(): EditorCommand {
    return new UngroupShapesCommand(this.groupId);
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
