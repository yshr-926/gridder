import {
  CompositeCommand,
  CreateShapeCommand,
  DeleteShapeCommand,
  ReorderShapeCommand,
  UngroupShapesCommand,
  type EditorCommand,
  type EditorDocument,
  type EditorShape,
  type GridPoint,
  type GridPolygon,
  type GridRing,
  type ShapeId,
} from '@gridder/editor-core';
import { generateId } from '@/utils/id';
import { useSelectionStore } from '@/stores/selectionStore';
import { copyToClipboard, notePasted, readClipboard } from './clipboard';
import { editorSession } from './useEditorSession';
import { expandSelectionForGroups, groupContaining } from './groupSelection';

/**
 * Multi-shape edit operations for issue #51: copy / paste / duplicate / delete
 * and z-order changes. Every mutation is one editor-core Command (a
 * {@link CompositeCommand} when more than one shape is involved) so it is a
 * single Undo step, and every operation reads the current selection and
 * document itself rather than taking them as parameters — these are meant to
 * be called directly from a keyboard shortcut or a toolbar button.
 */

const PASTE_OFFSET_CELLS = 1;

const translateRing = (ring: GridRing, delta: GridPoint): GridRing =>
  ring.map((point) => ({ x: point.x + delta.x, y: point.y + delta.y }));

const translatePolygon = (polygon: GridPolygon, delta: GridPoint): GridPolygon => ({
  outerRing: translateRing(polygon.outerRing, delta),
  innerRings: polygon.innerRings.map((ring) => translateRing(ring, delta)),
});

/**
 * Selected shapes resolved against the live document, in selection order.
 * Expanded to whole groups (issue #52, spec §7: copy/duplicate/delete act on
 * a group as a unit) — normally a no-op, since a click already expands the
 * selection to the whole group (see `applyInteractionEffect`'s `selectOnly`),
 * but this stays correct even if `selectedIds` ever holds just one member of
 * a not-currently-entered group.
 */
const selectedShapes = (): readonly EditorShape[] => {
  const document = editorSession.getDocument();
  const { selectedIds, activeGroupId } = useSelectionStore.getState();
  return expandSelectionForGroups(document, selectedIds, activeGroupId)
    .map((id) => document.shapes[id])
    .filter((shape): shape is EditorShape => shape !== undefined);
};

/**
 * Clone shapes onto new IDs with an integer grid offset, keeping name and
 * style. Used by both duplicate (offset by one cell) and paste (offset scales
 * with how many times the clipboard has already been pasted).
 */
const cloneWithOffset = (
  shapes: readonly EditorShape[],
  delta: GridPoint
): readonly EditorShape[] =>
  shapes.map((shape) => ({
    ...shape,
    id: generateId('shape'),
    polygon: translatePolygon(shape.polygon, delta),
  }));

/** Dispatch one Command for a single shape, or a CompositeCommand for many. */
const dispatchAll = (commands: readonly EditorCommand[], label: string): void => {
  if (commands.length === 0) {
    return;
  }
  editorSession.dispatch(
    commands.length === 1 ? commands[0] : new CompositeCommand(commands, label)
  );
};

/** Copy the current selection to the in-app clipboard (spec §7). No Command: copying does not change the document. */
export const copySelection = (): void => {
  copyToClipboard(selectedShapes());
};

/**
 * Paste the clipboard contents, offsetting by one more cell than the last
 * paste of the same copy, and select the newly created shapes.
 */
export const pasteClipboard = (): void => {
  const clipboard = readClipboard();
  if (clipboard === null || clipboard.shapes.length === 0) {
    return;
  }
  const offset = PASTE_OFFSET_CELLS * (clipboard.pasteCount + 1);
  const pasted = cloneWithOffset(clipboard.shapes, { x: offset, y: offset });

  dispatchAll(
    pasted.map((shape) => new CreateShapeCommand(shape)),
    'Paste'
  );
  notePasted();
  useSelectionStore.getState().setSelection(pasted.map((shape) => shape.id));
};

/**
 * Duplicate the current selection in place, offset by one cell, and select the
 * copies (spec §7). Unlike paste, this does not touch the clipboard.
 */
export const duplicateSelection = (): void => {
  const shapes = selectedShapes();
  if (shapes.length === 0) {
    return;
  }
  const duplicated = cloneWithOffset(shapes, {
    x: PASTE_OFFSET_CELLS,
    y: PASTE_OFFSET_CELLS,
  });

  dispatchAll(
    duplicated.map((shape) => new CreateShapeCommand(shape)),
    'Duplicate'
  );
  useSelectionStore.getState().setSelection(duplicated.map((shape) => shape.id));
};

/** A group can never have fewer than two members (spec §7's "一階層だけ" minimum). */
const MIN_GROUP_SIZE = 2;

/**
 * Delete every selected shape, no confirmation, one Undo step (ui-principles
 * §5, spec §7: a group deletes as a unit). Any group left with fewer than two
 * members by the deletion — whether every member is deleted (group mode off)
 * or just enough are (deleting one member while inside group mode) — is
 * explicitly ungrouped first, in the same Command: `DeleteShapeCommand` itself
 * never restores group membership on undo (see its doc comment; the
 * document-mutation layer drops an under-sized group as a side effect of
 * removing a shape), so without this the group would vanish permanently even
 * after an Undo brought its shapes back.
 */
export const deleteSelection = (): void => {
  const shapes = selectedShapes();
  if (shapes.length === 0) {
    return;
  }
  const document = editorSession.getDocument();
  const deletedIds = new Set(shapes.map((shape) => shape.id));
  const dissolvedGroupIds = new Set<string>();
  for (const shape of shapes) {
    const group = groupContaining(document, shape.id);
    if (group === null) {
      continue;
    }
    const remaining = group.shapeIds.filter((id) => !deletedIds.has(id));
    if (remaining.length < MIN_GROUP_SIZE) {
      dissolvedGroupIds.add(group.id);
    }
  }

  const commands: EditorCommand[] = [
    ...[...dissolvedGroupIds].map((groupId) => new UngroupShapesCommand(groupId)),
    ...shapes.map((shape) => new DeleteShapeCommand(shape.id)),
  ];
  dispatchAll(commands, 'Delete');
  useSelectionStore.getState().clear();
};

type ZOrderTarget = 'forward' | 'backward' | 'front' | 'back';

/** Absolute z-order index for `shapeId` after applying `target`. */
const targetIndex = (document: EditorDocument, shapeId: ShapeId, target: ZOrderTarget): number => {
  const current = document.zOrder.indexOf(shapeId);
  const lastIndex = document.zOrder.length - 1;
  switch (target) {
    case 'forward':
      return Math.min(current + 1, lastIndex);
    case 'backward':
      return Math.max(current - 1, 0);
    case 'front':
      return lastIndex;
    case 'back':
      return 0;
  }
};

/**
 * Move every selected shape one step (or all the way) toward front/back,
 * preserving their relative order (spec §7's four z-order operations).
 * Shapes are reordered back-to-front so a forward/front move doesn't clobber
 * the slot the next shape is about to take.
 */
const reorderSelection = (target: ZOrderTarget): void => {
  const document = editorSession.getDocument();
  const selectedIds = useSelectionStore.getState().selectedIds;
  // Walk in current z-order so relative order among selected shapes is kept.
  const orderedSelectedIds = document.zOrder.filter((id) => selectedIds.includes(id));
  if (orderedSelectedIds.length === 0) {
    return;
  }

  // Moving toward the front: process back-to-front so each shape settles just
  // ahead of the one before it, keeping their relative order intact. Moving
  // toward the back needs the opposite processing order for the same reason.
  const idsInApplyOrder =
    target === 'backward' || target === 'back'
      ? [...orderedSelectedIds].reverse()
      : orderedSelectedIds;

  const commands: EditorCommand[] = [];
  let working = document;
  for (const shapeId of idsInApplyOrder) {
    const nextIndex = targetIndex(working, shapeId, target);
    const command = new ReorderShapeCommand(shapeId, nextIndex);
    commands.push(command);
    working = command.apply(working);
  }
  dispatchAll(commands, 'Reorder');
};

/** Move the selection one step toward the front. */
export const bringForward = (): void => reorderSelection('forward');
/** Move the selection one step toward the back. */
export const sendBackward = (): void => reorderSelection('backward');
/** Move the selection to the very front. */
export const bringToFront = (): void => reorderSelection('front');
/** Move the selection to the very back. */
export const sendToBack = (): void => reorderSelection('back');
