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
export const groupContaining = (document: EditorDocument, shapeId: string): ShapeGroup | null => {
  for (const group of Object.values(document.groups)) {
    if (group.shapeIds.includes(shapeId)) {
      return group;
    }
  }
  return null;
};

/**
 * Expand `shapeIds` so every member of a group any of them belongs to is
 * included — "act on the group as a unit" (spec §7).
 *
 * This resolves an *interaction* (a click, a Shift-click, a marquee release),
 * where a shape standing in for its group is exactly the intent. It must not
 * be applied to a selection the user has already shaped: once the selection is
 * stored, a group holding only some of its members means those members were
 * deliberately deselected, and re-expanding would act on shapes that are
 * visibly unselected. Nothing in a stored selection distinguishes "one member
 * clicked" from "deselected down to one member", so the two are separated by
 * *when* they are resolved, not by inspecting the result — the selection
 * itself is authoritative for every action that follows.
 *
 * `activeGroupId` is the group currently entered for individual selection
 * (issue #52's double-click mode): its members are left as-is, since inside
 * group mode they are meant to be handled individually.
 *
 * Order: the given IDs first, in their given order, then any added group
 * members, deduplicated.
 */
export const expandSelectionForGroups = (
  document: EditorDocument,
  shapeIds: readonly string[],
  activeGroupId: string | null
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
 * What a Shift-click on `shapeId` should select, given the current selection
 * (issue #52, spec §7).
 *
 * Adding works on the group as a unit: Shift-clicking a member of a group that
 * is not in the selection brings in every member, matching a plain click.
 * Removing works on the one shape clicked — that is how a selection is
 * narrowed, and re-adding the rest would make a group's members impossible to
 * separate. Inside the entered group (`activeGroupId`) both directions act on
 * the single shape, matching that mode's intent.
 *
 * Resolving here is what lets every later action trust `selectedIds` verbatim:
 * the group rule is applied while the click is still the thing being
 * interpreted. See {@link expandSelectionForGroups}.
 */
export const resolveShiftClickSelection = (
  document: EditorDocument,
  selectedIds: readonly string[],
  activeGroupId: string | null,
  shapeId: string
): readonly string[] => {
  if (selectedIds.includes(shapeId)) {
    return selectedIds.filter((id) => id !== shapeId);
  }

  const group = groupContaining(document, shapeId);
  const added = group === null || group.id === activeGroupId ? [shapeId] : group.shapeIds;
  return [...selectedIds, ...added.filter((id) => !selectedIds.includes(id))];
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
  clickedShapeId: string
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
 * What a double-click on `shapeId` should do (issue #52): `'enter-group'`
 * when the shape belongs to a group that isn't already entered — group mode
 * lets its members be selected individually. `'none'` covers every other
 * case (an ungrouped shape, or one already in the entered group): the
 * cell-editing double-click that used to live here (issue #49) was retired
 * by issue #62, and no other double-click action has replaced it. The
 * function is kept as the single place a future double-click action (e.g.
 * an issue #50 extension) would be resolved, so callers keep switching on
 * the result rather than assuming a single outcome.
 */
export type DoubleClickTarget = 'enter-group' | 'none';

export const resolveDoubleClickTarget = (
  document: EditorDocument,
  activeGroupId: string | null,
  shapeId: string
): DoubleClickTarget => {
  const group = groupContaining(document, shapeId);
  if (group !== null && group.id !== activeGroupId) {
    return 'enter-group';
  }
  return 'none';
};
