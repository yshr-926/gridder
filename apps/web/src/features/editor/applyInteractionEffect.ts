import {
  CompositeCommand,
  CreateShapeCommand,
  ReplaceShapeVerticesCommand,
  type EditorCommand,
  type GridPoint,
  type GridPolygon,
  type GridRing,
} from '@gridder/editor-core';
import { generateId } from '@/utils/id';
import { useSelectionStore } from '@/stores/selectionStore';
import { createRectShape } from './document';
import type { EditorSession } from './editorSession';
import type { InteractionEffect } from './interactionController';

/** Translate every vertex of a ring by a whole-grid-unit offset. */
const translateRing = (ring: GridRing, delta: GridPoint): GridRing =>
  ring.map((point) => ({ x: point.x + delta.x, y: point.y + delta.y }));

/** Translate every ring (outer and holes) of a polygon by `delta`. */
const translatePolygon = (polygon: GridPolygon, delta: GridPoint): GridPolygon => ({
  outerRing: translateRing(polygon.outerRing, delta),
  innerRings: polygon.innerRings.map((ring) => translateRing(ring, delta)),
});

/**
 * Carry out one {@link InteractionEffect} produced by the interaction
 * controller: selection effects update {@link useSelectionStore}, `createRect`
 * builds a shape and commits it through a single {@link CreateShapeCommand}
 * (issue #42 — one gesture, one Command), then selects the new shape (spec
 * §6.3 "作成した図形を選択する" also applies to the rectangle drag), and
 * `moveShapes` (issue #43) applies the same integer grid delta to every
 * dragged shape's vertices, committed as one {@link ReplaceShapeVerticesCommand}
 * or, for a multi-shape drag, one {@link CompositeCommand} wrapping one per
 * shape — a single undo step for the whole gesture.
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
    case 'moveShapes': {
      if (effect.delta.x === 0 && effect.delta.y === 0) {
        return;
      }
      const document = session.getDocument();
      const commands: EditorCommand[] = [];
      for (const shapeId of effect.shapeIds) {
        const shape = document.shapes[shapeId];
        if (shape === undefined) {
          continue;
        }
        commands.push(
          new ReplaceShapeVerticesCommand(
            shapeId,
            translatePolygon(shape.polygon, effect.delta)
          )
        );
      }
      if (commands.length === 0) {
        return;
      }
      const command =
        commands.length === 1 ? commands[0] : new CompositeCommand(commands, 'Move shapes');
      session.dispatch(command);
      return;
    }
  }
};
