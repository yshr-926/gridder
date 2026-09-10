import { GroupShapesCommand, UngroupShapesCommand } from '@gridder/editor-core';
import { generateId } from '@/utils/id';
import { useSelectionStore } from '@/stores/selectionStore';
import { editorSession } from './useEditorSession';
import { groupContaining } from './groupSelection';

/**
 * Group / ungroup the current selection (issue #52, spec §7: `Cmd/Ctrl+G` /
 * `Cmd/Ctrl+Shift+G`). Both are exactly one editor-core Command, so each is a
 * single Undo step; `GroupShapesCommand` itself folds any pre-existing group
 * in the selection into the new one (nesting stays impossible — see that
 * class's doc comment) rather than requiring a manual ungroup first.
 */

/** Fewer than two shapes can't form a group (spec §7). */
const MIN_GROUP_SIZE = 2;

/**
 * Group every selected shape into one new group and select it as a unit.
 * No-ops when fewer than two shapes are selected.
 */
export const groupSelection = (): void => {
  const selectedIds = useSelectionStore.getState().selectedIds;
  if (selectedIds.length < MIN_GROUP_SIZE) {
    return;
  }
  const groupId = generateId('group');
  editorSession.dispatch(new GroupShapesCommand(groupId, [...selectedIds]));
  useSelectionStore.getState().setSelection(selectedIds);
};

/**
 * Ungroup the group the current selection belongs to, selecting its former
 * members individually. No-ops when the selection isn't exactly one group's
 * shapes (or a subset while inside group mode — ungrouping there would be
 * ambiguous about which group is meant, so this requires the whole group, or
 * any one of its members while *not* in group mode).
 */
export const ungroupSelection = (): void => {
  const { selectedIds, activeGroupId } = useSelectionStore.getState();
  if (selectedIds.length === 0) {
    return;
  }
  const document = editorSession.getDocument();
  const group =
    activeGroupId !== null
      ? document.groups[activeGroupId]
      : groupContaining(document, selectedIds[0]);
  if (group === undefined || group === null) {
    return;
  }
  editorSession.dispatch(new UngroupShapesCommand(group.id));
  useSelectionStore.getState().setSelection(group.shapeIds);
};
