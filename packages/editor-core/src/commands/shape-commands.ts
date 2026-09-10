import type { EditorDocument, EditorShape, GridPolygon, ShapeId, ShapeStyle } from '../model.js';
import type { EditorCommand } from './command.js';
import {
  indexInZOrder,
  insertShape,
  removeShape,
  replaceShape,
  requireShape,
  withShapeName,
  withShapePolygon,
  withShapeStyle,
} from './document-mutations.js';

/**
 * Commands that add, remove, or edit a single shape. Every single-shape
 * geometry edit (move, resize, vertex edit) is expressed through
 * {@link ReplaceShapeVerticesCommand}: callers compute the new polygon and
 * hand the finished {@link GridPolygon} to this Command. Combining and
 * subtracting whole shapes live in `boolean-commands.ts`, since their result
 * spans several shapes.
 */

export class CreateShapeCommand implements EditorCommand {
  readonly type = 'create-shape';
  readonly label = 'Create shape';

  constructor(
    private readonly shape: EditorShape,
    /** Insertion point in z-order (back to front). Defaults to frontmost. */
    private readonly zIndex?: number
  ) {}

  apply(document: EditorDocument): EditorDocument {
    const zIndex = this.zIndex ?? document.zOrder.length;
    return insertShape(document, this.shape, zIndex);
  }

  invert(): EditorCommand {
    return new DeleteShapeCommand(this.shape.id);
  }
}

export class DeleteShapeCommand implements EditorCommand {
  readonly type = 'delete-shape';
  readonly label = 'Delete shape';

  constructor(private readonly shapeId: ShapeId) {}

  apply(document: EditorDocument): EditorDocument {
    requireShape(document, this.shapeId);
    return removeShape(document, this.shapeId);
  }

  invert(documentBeforeApply: EditorDocument): EditorCommand {
    const shape = requireShape(documentBeforeApply, this.shapeId);
    const zIndex = indexInZOrder(documentBeforeApply, this.shapeId);
    // Groups the shape belonged to are restored by GroupShapesCommand history
    // entries, not here; a lone delete only round-trips the shape and its slot.
    return new CreateShapeCommand(shape, zIndex);
  }
}

export class ReplaceShapeVerticesCommand implements EditorCommand {
  readonly type = 'replace-shape-vertices';
  readonly label = 'Edit shape geometry';

  constructor(
    private readonly shapeId: ShapeId,
    private readonly polygon: GridPolygon
  ) {}

  apply(document: EditorDocument): EditorDocument {
    const shape = requireShape(document, this.shapeId);
    return replaceShape(document, withShapePolygon(shape, this.polygon));
  }

  invert(documentBeforeApply: EditorDocument): EditorCommand {
    const shape = requireShape(documentBeforeApply, this.shapeId);
    return new ReplaceShapeVerticesCommand(this.shapeId, shape.polygon);
  }
}

export class SetShapeStyleCommand implements EditorCommand {
  readonly type = 'set-shape-style';
  readonly label = 'Change style';

  constructor(
    private readonly shapeId: ShapeId,
    private readonly style: ShapeStyle
  ) {}

  apply(document: EditorDocument): EditorDocument {
    const shape = requireShape(document, this.shapeId);
    return replaceShape(document, withShapeStyle(shape, this.style));
  }

  invert(documentBeforeApply: EditorDocument): EditorCommand {
    const shape = requireShape(documentBeforeApply, this.shapeId);
    return new SetShapeStyleCommand(this.shapeId, shape.style);
  }
}

export class RenameShapeCommand implements EditorCommand {
  readonly type = 'rename-shape';
  readonly label = 'Rename shape';

  constructor(
    private readonly shapeId: ShapeId,
    /** `undefined` clears the name. */
    private readonly name: string | undefined
  ) {}

  apply(document: EditorDocument): EditorDocument {
    const shape = requireShape(document, this.shapeId);
    return replaceShape(document, withShapeName(shape, this.name));
  }

  invert(documentBeforeApply: EditorDocument): EditorCommand {
    const shape = requireShape(documentBeforeApply, this.shapeId);
    return new RenameShapeCommand(this.shapeId, shape.name);
  }
}
