import {
  CompositeCommand,
  RenameShapeCommand,
  SetShapeStyleCommand,
  type EditorShape,
  type ShapeFillColor,
  type ShapeStyle,
} from '@gridder/editor-core';
import { editorSession } from './useEditorSession';

/**
 * Command helpers the contextual inspector (issue #45) uses to edit the
 * selection. Every change lands on the editor-core history as exactly one entry
 * so a single Undo reverts it: a multi-selection style change is wrapped in a
 * {@link CompositeCommand}. Callers pass the already-resolved shapes from
 * {@link useSelectedShapes}; these helpers do not read the store.
 */

/** Rename a single shape. An empty / whitespace-only name clears it. */
export const renameShape = (shapeId: string, name: string): void => {
  const trimmed = name.trim();
  editorSession.dispatch(new RenameShapeCommand(shapeId, trimmed.length > 0 ? trimmed : undefined));
};

const applyStyleToShapes = (
  shapes: readonly EditorShape[],
  nextStyle: (style: ShapeStyle) => ShapeStyle,
  label: string
): void => {
  const commands = shapes
    .map((shape) => {
      const updated = nextStyle(shape.style);
      const unchanged =
        updated.fill === shape.style.fill &&
        updated.opacity === shape.style.opacity &&
        updated.isBorderVisible === shape.style.isBorderVisible;
      return unchanged ? null : new SetShapeStyleCommand(shape.id, updated);
    })
    .filter((command): command is SetShapeStyleCommand => command !== null);

  if (commands.length === 0) {
    return;
  }
  editorSession.dispatch(
    commands.length === 1 ? commands[0] : new CompositeCommand(commands, label)
  );
};

/** Set the fill colour on every given shape. */
export const setShapesFill = (shapes: readonly EditorShape[], fill: ShapeFillColor): void => {
  applyStyleToShapes(shapes, (style) => ({ ...style, fill }), 'Change fill');
};

/** Set the opacity (0..1) on every given shape. */
export const setShapesOpacity = (shapes: readonly EditorShape[], opacity: number): void => {
  const clamped = Math.min(1, Math.max(0, opacity));
  applyStyleToShapes(shapes, (style) => ({ ...style, opacity: clamped }), 'Change opacity');
};

/** Toggle border visibility on every given shape to `isBorderVisible`. */
export const setShapesBorderVisible = (
  shapes: readonly EditorShape[],
  isBorderVisible: boolean
): void => {
  applyStyleToShapes(shapes, (style) => ({ ...style, isBorderVisible }), 'Toggle border');
};
