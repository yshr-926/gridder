import { SetAnnotationFontSizeCommand, isValidAnnotationFontSize } from '@gridder/editor-core';
import { editorSession } from './useEditorSession';

/**
 * Mutation for the sketch-wide annotation font size (issue #66, spec §8).
 * Exactly one {@link SetAnnotationFontSizeCommand}, so a change is a single
 * Undo step. Mirrors `physicalScaleCommands.ts`.
 */

/**
 * Set the annotation font size in screen pixels. Values the document would
 * reject (non-integer, outside the allowed range) and a value equal to the
 * current one are ignored, so a blur that changed nothing never adds an
 * empty Undo entry.
 */
export const setAnnotationFontSize = (fontSize: number): void => {
  if (!isValidAnnotationFontSize(fontSize)) {
    return;
  }
  if (editorSession.getDocument().annotationFontSize === fontSize) {
    return;
  }
  editorSession.dispatch(new SetAnnotationFontSizeCommand(fontSize));
};
