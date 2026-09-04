import { SetPhysicalScaleCommand, type PhysicalScale, type PhysicalUnit } from '@gridder/editor-core';
import { editorSession } from './useEditorSession';

/**
 * Mutations for the sketch's real-world scale (issue #53, spec §8: optional
 * `1セル = 数値 + mm/cm/m`). Both operations are exactly one
 * {@link SetPhysicalScaleCommand}, so enabling, changing, or disabling the
 * scale is a single Undo step.
 */

/** Set the real-world scale. Non-finite or non-positive values are ignored. */
export const setPhysicalScale = (valuePerCell: number, unit: PhysicalUnit): void => {
  if (!Number.isFinite(valuePerCell) || valuePerCell <= 0) {
    return;
  }
  const next: PhysicalScale = { valuePerCell, unit };
  editorSession.dispatch(new SetPhysicalScaleCommand(next));
};

/** Clear the real-world scale, returning the sketch to plain cell counts. */
export const clearPhysicalScale = (): void => {
  editorSession.dispatch(new SetPhysicalScaleCommand(undefined));
};
