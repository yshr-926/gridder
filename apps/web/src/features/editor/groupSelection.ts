import type { EditorDocument, ShapeGroup } from '@gridder/editor-core';

/**
 * Group-aware selection resolution (issue #52, spec §7: "通常はグループを一体
 * として選択・移動・複製・削除・90度回転し、ダブルクリックで構成図形を個別選択
 * できる"). Kept separate from `interactionController.ts` — the state machine
 * there stays untouched; every group rule lives here as plain functions the
 * callers (`applyInteractionEffect.ts`, `editCommands.ts`, `rotate.ts`) apply
 * to a resolved click / selection before acting on it.
 */

/** The one-level group `shapeId` belongs to, or `null` if it belongs to none. */
export const groupContaining = (
  document: EditorDocument,
  shapeId: string,
): ShapeGroup | null => {
  for (const group of Object.values(document.groups)) {
    if (group.shapeIds.includes(shapeId)) {
      return group;
    }
  }
  return null;
};

/**
 * Expand a set of shape IDs so that every member of a group any of them
 * belongs to is included too — "select one, get the whole group" (spec §7).
 * `activeGroupId` is the group currently entered for individual selection
 * (issue #52's double-click mode): a shape belonging to *that* group is left
 * as-is rather than expanded, since inside group mode the group's members are
 * meant to be selected individually. Order: original IDs first (in their
 * given order), then any newly-added group members, deduplicated.
 */
export const expandSelectionForGroups = (
  document: EditorDocument,
  shapeIds: readonly string[],
  activeGroupId: string | null,
): readonly string[] => {
  const result: string[] = [];
  const seen = new Set<string>();

  const add = (id: string) => {
    if (!seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  };

  for (const shapeId of shapeIds) {
    add(shapeId);
    const group = groupContaining(document, shapeId);
    if (group !== null && group.id !== activeGroupId) {
      for (const memberId of group.shapeIds) {
        add(memberId);
      }
    }
  }
  return result;
};

/**
 * What a click on `clickedShapeId` should select and which group (if any)
 * remains "entered" afterward (issue #52):
 *
 * - Clicking a member of the currently-entered group selects that member
 *   alone and keeps the group entered (individual selection within it).
 * - Clicking a member of a *different* group selects the whole group and
 *   exits any previously-entered group.
 * - Clicking an ungrouped shape selects it alone and exits group mode.
 */
export interface ClickSelectionResult {
  readonly shapeIds: readonly string[];
  readonly activeGroupId: string | null;
}

export const resolveClickSelection = (
  document: EditorDocument,
  activeGroupId: string | null,
  clickedShapeId: string,
): ClickSelectionResult => {
  const group = groupContaining(document, clickedShapeId);
  if (group === null) {
    return { shapeIds: [clickedShapeId], activeGroupId: null };
  }
  if (group.id === activeGroupId) {
    return { shapeIds: [clickedShapeId], activeGroupId };
  }
  return { shapeIds: [...group.shapeIds], activeGroupId: null };
};

/**
 * What a double-click on `shapeId` should do (issue #52 / #49, per the
 * coordinator's split): `'enter-group'` when the shape belongs to a group
 * that isn't already entered — group mode lets its members be selected
 * individually. `'edit-shape'` covers every other case (an ungrouped shape,
 * or one already in the entered group) and is issue #49's cell-editing
 * double-click; this function only decides the branch; #49 implements what
 * `'edit-shape'` actually does. `'none'` is currently unreachable but kept so
 * callers exhaustively switch rather than assume only two outcomes.
 */
export type DoubleClickTarget = 'enter-group' | 'edit-shape' | 'none';

export const resolveDoubleClickTarget = (
  document: EditorDocument,
  activeGroupId: string | null,
  shapeId: string,
): DoubleClickTarget => {
  const group = groupContaining(document, shapeId);
  if (group !== null && group.id !== activeGroupId) {
    return 'enter-group';
  }
  // TODO(#49): cell-editing double-click (double-clicking an ungrouped shape,
  // or a shape already inside its entered group) belongs here.
  return 'edit-shape';
};
