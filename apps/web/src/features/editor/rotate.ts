import { RotateShapesCommand, type RotationDirection } from '@gridder/editor-core';
import { useSelectionStore } from '@/stores/selectionStore';
import { editorSession } from './useEditorSession';
import { expandSelectionForGroups } from './groupSelection';

/**
 * Rotate the current selection 90° as one rigid group (issue #47, spec §6.2 /
 * §7). `direction` is `'cw'` for clockwise, `'ccw'` for counter-clockwise; both
 * dispatch a single {@link RotateShapesCommand} so the change is one Undo step.
 *
 * A group's members rotate together because {@link RotateShapesCommand} pivots
 * on the whole selection's bounding box: `expandSelectionForGroups` (issue #52)
 * makes sure every member is in that bounding box even when `selectedIds`
 * only holds one of them — normally a no-op, since a click already expands
 * the selection to the whole group, but this stays correct even if
 * `selectedIds` ever holds just one member of a not-currently-entered group.
 * A shape individually selected inside its entered group (issue #52's
 * double-click mode) still rotates alone, matching that mode's "select just
 * this member" intent.
 *
 * No-ops when nothing is selected.
 */
export const rotateSelection = (direction: RotationDirection): void => {
  const { selectedIds, activeGroupId } = useSelectionStore.getState();
  if (selectedIds.length === 0) {
    return;
  }
  const document = editorSession.getDocument();
  const expanded = expandSelectionForGroups(document, selectedIds, activeGroupId);
  editorSession.dispatch(new RotateShapesCommand(expanded, direction));
};
