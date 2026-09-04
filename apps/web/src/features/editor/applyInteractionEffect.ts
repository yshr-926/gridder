import { CreateShapeCommand } from '@gridder/editor-core';
import { generateId } from '@/utils/id';
import { useSelectionStore } from '@/stores/selectionStore';
import { createRectShape } from './document';
import type { EditorSession } from './editorSession';
import type { InteractionEffect } from './interactionController';

/**
 * Carry out one {@link InteractionEffect} produced by the interaction
 * controller: selection effects update {@link useSelectionStore}, and
 * `createRect` builds a shape and commits it through a single
 * {@link CreateShapeCommand} (issue #42 — one gesture, one Command), then
 * selects the new shape (spec §6.3 "作成した図形を選択する" also applies to the
 * rectangle drag).
 */
export const applyInteractionEffect = (
  session: EditorSession,
  effect: InteractionEffect
): void => {
  const selection = useSelectionStore.getState();

  switch (effect.type) {
    case 'selectOnly':
      selection.selectOnly(effect.shapeId);
      return;
    case 'toggleSelection':
      selection.toggle(effect.shapeId);
      return;
    case 'setSelection':
      selection.setSelection(effect.shapeIds);
      return;
    case 'clearSelection':
      selection.clear();
      return;
    case 'createRect': {
      const shape = createRectShape(
        generateId('shape'),
        effect.start,
        effect.end,
        session.shapeCount
      );
      if (shape === null) {
        return;
      }
      session.dispatch(new CreateShapeCommand(shape));
      selection.selectOnly(shape.id);
      return;
    }
  }
};
