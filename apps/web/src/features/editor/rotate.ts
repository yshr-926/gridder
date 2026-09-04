import { RotateShapesCommand, type RotationDirection } from '@gridder/editor-core';
import { useSelectionStore } from '@/stores/selectionStore';
import { editorSession } from './useEditorSession';

/**
 * Rotate the current selection 90° as one rigid group (issue #47, spec §6.2 /
 * §7). `direction` is `'cw'` for clockwise, `'ccw'` for counter-clockwise; both
 * dispatch a single {@link RotateShapesCommand} so the change is one Undo step.
 *
 * A group's members rotate together because {@link RotateShapesCommand} pivots
 * on the whole selection's bounding box, but group membership is not read here
 * — rotating a group as a locked unit (so selecting one member rotates the
 * rest) is issue #52's scope, not this one's.
 *
 * No-ops when nothing is selected.
 */
export const rotateSelection = (direction: RotationDirection): void => {
  const selectedIds = useSelectionStore.getState().selectedIds;
  if (selectedIds.length === 0) {
    return;
  }
  editorSession.dispatch(new RotateShapesCommand(selectedIds, direction));
};
