import {
  CompositeCommand,
  CreateShapeCommand,
  DeleteShapeCommand,
  GroupShapesCommand,
  ReorderShapeCommand,
  UngroupShapesCommand,
  type EditorCommand,
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
import { groupContaining } from './groupSelection';

/**
 * Multi-shape edit operations for issue #51: copy / paste / duplicate / delete
 * and z-order changes. Every mutation is one editor-core Command (a
 * {@link CompositeCommand} when more than one shape is involved) so it is a
 * single Undo step, and every operation reads the current selection and
 * document itself rather than taking them as parameters — these are meant to
 * be called directly from a keyboard shortcut or a toolbar button.
 */

const PASTE_OFFSET_CELLS = 1;

/** A group can never have fewer than two members (spec §7's "一階層だけ" minimum). */
const MIN_GROUP_SIZE = 2;

const translateRing = (ring: GridRing, delta: GridPoint): GridRing =>
  ring.map((point) => ({ x: point.x + delta.x, y: point.y + delta.y }));

const translatePolygon = (polygon: GridPolygon, delta: GridPoint): GridPolygon => ({
  outerRing: translateRing(polygon.outerRing, delta),
  innerRings: polygon.innerRings.map((ring) => translateRing(ring, delta)),
});

/**
 * Selected shapes resolved against the live document, in selection order.
 *
 * The selection is taken verbatim: group membership was already applied when
 * the click, Shift-click or marquee that produced it was interpreted (see
 * `groupSelection.ts`), so a group is either wholly in `selectedIds` or was
 * deliberately reduced. Re-expanding here would act on shapes the user
 * Shift-clicked out of the selection.
 */
const selectedShapes = (): readonly EditorShape[] => {
  const document = editorSession.getDocument();
  return useSelectionStore
    .getState()
    .selectedIds.map((id) => document.shapes[id])
    .filter((shape): shape is EditorShape => shape !== undefined);
};

/**
 * Clone shapes onto new IDs with an integer grid offset, keeping name and
 * style. Used by both duplicate (offset by one cell) and paste (offset scales
 * with how many times the clipboard has already been pasted). Returned in the
 * given order, so a caller can map a source shape's index to its clone.
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

/**
 * How `shapes` are grouped in the current document, as lists of their IDs —
 * the shape of {@link ClipboardContents.groupings}. Only groups wholly
 * contained in `shapes` are reported: a partially-copied group has no
 * meaningful counterpart among the copies.
 */
const groupingsOf = (shapes: readonly EditorShape[]): readonly (readonly string[])[] => {
  const document = editorSession.getDocument();
  const present = new Set(shapes.map((shape) => shape.id));
  const groupings: string[][] = [];
  const seenGroupIds = new Set<string>();

  for (const shape of shapes) {
    const group = groupContaining(document, shape.id);
    if (group === null || seenGroupIds.has(group.id)) {
      continue;
    }
    seenGroupIds.add(group.id);
    const members = group.shapeIds.filter((id) => present.has(id));
    if (members.length >= MIN_GROUP_SIZE) {
      groupings.push(members);
    }
  }
  return groupings;
};

/**
 * The {@link GroupShapesCommand}s that reproduce `groupings` on freshly-cloned
 * shapes (spec §7: duplicating or pasting a group yields a group). `sourceIds`
 * and `clones` are index-aligned, so each source ID maps to its clone's new ID
 * and every reproduced group gets an ID of its own.
 */
const regroupClones = (
  groupings: readonly (readonly string[])[],
  sourceIds: readonly string[],
  clones: readonly EditorShape[]
): readonly EditorCommand[] => {
  const cloneIdBySourceId = new Map(sourceIds.map((id, index) => [id, clones[index]?.id]));
  const commands: EditorCommand[] = [];

  for (const memberIds of groupings) {
    const clonedMemberIds = memberIds
      .map((id) => cloneIdBySourceId.get(id))
      .filter((id): id is string => id !== undefined);
    if (clonedMemberIds.length >= MIN_GROUP_SIZE) {
      commands.push(new GroupShapesCommand(generateId('group'), clonedMemberIds));
    }
  }
  return commands;
};

/** Copy the current selection to the in-app clipboard (spec §7). No Command: copying does not change the document. */
export const copySelection = (): void => {
  const shapes = selectedShapes();
  copyToClipboard(shapes, groupingsOf(shapes));
};

/**
 * Paste the clipboard contents, offsetting by one more cell than the last
 * paste of the same copy, and select the newly created shapes. Groups among
 * the copied shapes are reproduced on the pasted ones, in the same Command.
 */
export const pasteClipboard = (): void => {
  const clipboard = readClipboard();
  if (clipboard === null || clipboard.shapes.length === 0) {
    return;
  }
  const offset = PASTE_OFFSET_CELLS * (clipboard.pasteCount + 1);
  const pasted = cloneWithOffset(clipboard.shapes, { x: offset, y: offset });
  const sourceIds = clipboard.shapes.map((shape) => shape.id);

  dispatchAll(
    [
      ...pasted.map((shape) => new CreateShapeCommand(shape)),
      ...regroupClones(clipboard.groupings, sourceIds, pasted),
    ],
    'Paste'
  );
  notePasted();
  useSelectionStore.getState().setSelection(pasted.map((shape) => shape.id));
};

/**
 * Duplicate the current selection in place, offset by one cell, and select the
 * copies (spec §7). Unlike paste, this does not touch the clipboard. Groups
 * within the selection are reproduced on the copies, in the same Command.
 */
export const duplicateSelection = (): void => {
  const shapes = selectedShapes();
  if (shapes.length === 0) {
    return;
  }
  const groupings = groupingsOf(shapes);
  const duplicated = cloneWithOffset(shapes, {
    x: PASTE_OFFSET_CELLS,
    y: PASTE_OFFSET_CELLS,
  });

  dispatchAll(
    [
      ...duplicated.map((shape) => new CreateShapeCommand(shape)),
      ...regroupClones(
        groupings,
        shapes.map((shape) => shape.id),
        duplicated
      ),
    ],
    'Duplicate'
  );
  useSelectionStore.getState().setSelection(duplicated.map((shape) => shape.id));
};

/**
 * Delete every selected shape, no confirmation, one Undo step (ui-principles
 * §5, spec §7: a group deletes as a unit).
 *
 * Group membership needs explicit Commands on both sides of the deletion,
 * because `DeleteShapeCommand` never round-trips it: the document-mutation
 * layer quietly rewrites `groups` as a side effect of removing a shape —
 * dropping the member, and dropping the whole group once it falls below two —
 * while the Command's inverse only puts the shape and its z-slot back. So:
 *
 * - A group the deletion empties or leaves with a single member is
 *   {@link UngroupShapesCommand}-ed *before* the deletes. Its inverse
 *   re-creates the group with its original membership.
 * - A group that survives with two or more members is ungrouped too, then
 *   re-created *after* the deletes with just the survivors
 *   ({@link GroupShapesCommand}). Applied forward this is the same group
 *   minus the deleted shapes; inverted, the pair restores the group exactly as
 *   it was, so an Undo returns the survivors to it rather than leaving them
 *   loose.
 */
export const deleteSelection = (): void => {
  const shapes = selectedShapes();
  if (shapes.length === 0) {
    return;
  }
  const document = editorSession.getDocument();
  const deletedIds = new Set(shapes.map((shape) => shape.id));

  const affectedGroups = new Map<string, readonly string[]>();
  for (const shape of shapes) {
    const group = groupContaining(document, shape.id);
    if (group !== null) {
      affectedGroups.set(group.id, group.shapeIds);
    }
  }

  const ungroupCommands: EditorCommand[] = [];
  const regroupCommands: EditorCommand[] = [];
  for (const [groupId, memberIds] of affectedGroups) {
    ungroupCommands.push(new UngroupShapesCommand(groupId));
    const survivors = memberIds.filter((id) => !deletedIds.has(id));
    if (survivors.length >= MIN_GROUP_SIZE) {
      regroupCommands.push(new GroupShapesCommand(groupId, survivors));
    }
  }

  const commands: EditorCommand[] = [
    ...ungroupCommands,
    ...shapes.map((shape) => new DeleteShapeCommand(shape.id)),
    ...regroupCommands,
  ];
  dispatchAll(commands, 'Delete');
  useSelectionStore.getState().clear();
};

type ZOrderTarget = 'forward' | 'backward' | 'front' | 'back';

/**
 * The z-order the selection should end up in (spec §7's four z-order
 * operations), computed as one rearrangement rather than one move per shape.
 *
 * `front` / `back` gather the whole selection at the corresponding end,
 * keeping its relative order. The step operations move each *contiguous run*
 * of selected shapes one slot past the unselected neighbour on that side —
 * so `[A, B, C]` with `A, B` selected steps forward to `[C, A, B]`, and
 * `[A, B, C, D]` with the non-adjacent `B, D` selected steps backward to
 * `[B, A, D, C]`, each run moving on its own.
 *
 * Runs are what makes this correct: moving each shape in turn instead lets a
 * later move undo an earlier one — within `[A, B]`, `A` steps over `B`, then
 * `B` steps back over `A`, and the order never changes.
 */
const reorderedZOrder = (
  zOrder: readonly ShapeId[],
  selectedIds: ReadonlySet<ShapeId>,
  target: ZOrderTarget
): readonly ShapeId[] => {
  if (target === 'front' || target === 'back') {
    const selected = zOrder.filter((id) => selectedIds.has(id));
    const rest = zOrder.filter((id) => !selectedIds.has(id));
    return target === 'front' ? [...rest, ...selected] : [...selected, ...rest];
  }

  const next = [...zOrder];
  if (target === 'forward') {
    // Walk from the front so a run never steps onto a slot another run is
    // still occupying; each run swaps with the single unselected shape ahead.
    for (let index = next.length - 1; index >= 0; index -= 1) {
      const id = next[index];
      if (!selectedIds.has(id) || index + 1 >= next.length) {
        continue;
      }
      const ahead = next[index + 1];
      if (selectedIds.has(ahead)) {
        continue;
      }
      // `index` is the front of a run: find its back, then move the whole run
      // one slot forward by dropping the neighbour behind it.
      let runStart = index;
      while (runStart > 0 && selectedIds.has(next[runStart - 1])) {
        runStart -= 1;
      }
      next.splice(index + 1, 1);
      next.splice(runStart, 0, ahead);
    }
    return next;
  }

  for (let index = 0; index < next.length; index += 1) {
    const id = next[index];
    if (!selectedIds.has(id) || index === 0) {
      continue;
    }
    const behind = next[index - 1];
    if (selectedIds.has(behind)) {
      continue;
    }
    let runEnd = index;
    while (runEnd + 1 < next.length && selectedIds.has(next[runEnd + 1])) {
      runEnd += 1;
    }
    next.splice(index - 1, 1);
    next.splice(runEnd, 0, behind);
  }
  return next;
};

/**
 * Move every selected shape one step (or all the way) toward front/back,
 * preserving their relative order (spec §7's four z-order operations), as one
 * Command. The target order is computed in full by {@link reorderedZOrder},
 * then expressed as the {@link ReorderShapeCommand}s that produce it — one per
 * shape that is not already in its final slot, each applied to the document
 * the previous ones have already produced.
 */
const reorderSelection = (target: ZOrderTarget): void => {
  const document = editorSession.getDocument();
  const selectedIds = new Set(useSelectionStore.getState().selectedIds);
  if (!document.zOrder.some((id) => selectedIds.has(id))) {
    return;
  }

  const nextZOrder = reorderedZOrder(document.zOrder, selectedIds, target);
  const commands: EditorCommand[] = [];
  let working = document;
  nextZOrder.forEach((shapeId, index) => {
    if (working.zOrder[index] === shapeId) {
      return;
    }
    const command = new ReorderShapeCommand(shapeId, index);
    commands.push(command);
    working = command.apply(working);
  });
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
