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
 * The shapes a group-aware action — move, delete, duplicate, copy, rotate, a
 * boolean operation — should act on, given a selection.
 *
 * A group is expanded to all its members ("select one, act on the whole
 * group", spec §7), *except* when the selection holds some but not all of
 * them. That partial state is only reachable deliberately, by Shift-clicking a
 * member out of a fully-selected group, and expanding it would act on shapes
 * the user just removed from the selection — deleting a shape that is visibly
 * unselected, for instance. `activeGroupId` is the group currently entered for
 * individual selection (issue #52's double-click mode); its members are never
 * expanded, since inside group mode they are meant to be handled individually.
 *
 * Order: the given IDs first, in their given order, then any added group
 * members, deduplicated.
 */
export const resolveSelectionForGroupActions = (
  document: EditorDocument,
  shapeIds: readonly string[],
  activeGroupId: string | null
): readonly string[] => {
  const selected = new Set(shapeIds);
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
    if (group === null || group.id === activeGroupId) {
      continue;
    }
    // Every member selected → a whole-group selection, expansion is a no-op.
    // No other member selected → the group was selected via this one shape
    // (e.g. from `selectOnly`), so expand as usual. In between the user has
    // deselected members on purpose; honour that.
    const isPartiallySelected = group.shapeIds.some((id) => id !== shapeId && selected.has(id));
    const isWhollySelected = group.shapeIds.every((id) => selected.has(id));
    if (isPartiallySelected && !isWhollySelected) {
      continue;
    }
    for (const memberId of group.shapeIds) {
      add(memberId);
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
