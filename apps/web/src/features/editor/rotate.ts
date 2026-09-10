import { RotateShapesCommand, type RotationDirection } from '@gridder/editor-core';
import { useSelectionStore } from '@/stores/selectionStore';
import { editorSession } from './useEditorSession';

/**
 * Rotate the current selection 90° as one rigid group (issue #47, spec §6.2 /
 * §7). `direction` is `'cw'` for clockwise, `'ccw'` for counter-clockwise; both
 * dispatch a single {@link RotateShapesCommand} so the change is one Undo step.
 *
 * A group's members rotate together because {@link RotateShapesCommand} pivots
 * on the whole selection's bounding box and the selection already holds every
 * member: group membership is applied when a click or marquee is interpreted
 * (issue #52, see `groupSelection.ts`), not here. A shape individually
 * selected inside its entered group (issue #52's double-click mode) rotates
 * alone, matching that mode's "select just this member" intent.
 *
 * No-ops when nothing is selected.
 */
export const rotateSelection = (direction: RotationDirection): void => {
  const { selectedIds } = useSelectionStore.getState();
  if (selectedIds.length === 0) {
    return;
  }
  editorSession.dispatch(new RotateShapesCommand(selectedIds, direction));
};
