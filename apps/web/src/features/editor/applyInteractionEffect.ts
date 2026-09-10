import {
  cleanPolygon,
  CompositeCommand,
  CreateShapeCommand,
  doubleSignedArea,
  isSimplePolygon,
  ReplaceShapeVerticesCommand,
  type EditorCommand,
  type GridPoint,
  type GridPolygon,
  type GridRing,
} from '@gridder/editor-core';
import { generateId } from '@/utils/id';
import { useSelectionStore } from '@/stores/selectionStore';
import { useToastStore } from '@/hooks/useToast';
import { createRectShape, defaultShapeStyle } from './document';
import type { EditorSession } from './editorSession';
import type { InteractionEffect } from './interactionController';
import { ringFromRect } from './hitTest';
import { expandSelectionForGroups, resolveClickSelection } from './groupSelection';

/** Translate every vertex of a ring by a whole-grid-unit offset. */
const translateRing = (ring: GridRing, delta: GridPoint): GridRing =>
  ring.map((point) => ({ x: point.x + delta.x, y: point.y + delta.y }));

/** Translate every ring (outer and holes) of a polygon by `delta`. */
const translatePolygon = (polygon: GridPolygon, delta: GridPoint): GridPolygon => ({
  outerRing: translateRing(polygon.outerRing, delta),
  innerRings: polygon.innerRings.map((ring) => translateRing(ring, delta)),
});

/**
 * Whether a normalised vertex/edge edit (issue #50, spec §6.2 "自己交差や退化に
 * なる操作は確定時に拒否") can be committed: every ring — the outer boundary and
 * every hole — must be a simple polygon (no self-intersection, no repeated
 * vertex) and the outer ring must keep a non-zero area. The caller runs
 * {@link cleanPolygon} first, so adjacent duplicates and collinear vertices
 * are already gone; what is left for this check is a genuine crossing, a
 * non-adjacent self-touch, or a ring collapsed onto a line.
 */
const isValidPolygonEdit = (polygon: GridPolygon): boolean => {
  if (!isSimplePolygon(polygon.outerRing)) {
    return false;
  }
  if (doubleSignedArea(polygon.outerRing) === 0) {
    return false;
  }
  return polygon.innerRings.every((ring) => isSimplePolygon(ring));
};

const sameRing = (a: GridRing, b: GridRing): boolean =>
  a.length === b.length &&
  a.every((point, index) => point.x === b[index]?.x && point.y === b[index]?.y);

/** Structural equality of two polygons, ring by ring and vertex by vertex. */
const samePolygon = (a: GridPolygon, b: GridPolygon): boolean =>
  sameRing(a.outerRing, b.outerRing) &&
  a.innerRings.length === b.innerRings.length &&
  a.innerRings.every((ring, index) => {
    const other = b.innerRings[index];
    return other !== undefined && sameRing(ring, other);
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
 * shape — a single undo step for the whole gesture. `resizeShape`
 * (issue #44) replaces the rectangle's four vertices with the ones for its
 * new (already flip-normalised, min-1-cell) bounds, in one
 * {@link ReplaceShapeVerticesCommand}. `createPolygon` (issue #48) validates
 * the confirmed vertices with {@link isSimplePolygon} — a self-intersecting
 * ring is refused with a toast rather than committed — then builds and
 * commits the shape through one {@link CreateShapeCommand}, same as
 * `createRect`. `updateShapeVertices` (issue #50, vertex/edge direct
 * manipulation; issue #64, ghost-vertex insertion) first normalises the
 * proposed polygon with {@link cleanPolygon} — merging duplicate vertices and
 * dropping collinear ones, so an L-shape dragged back into a rectangle really
 * is a 4-vertex rectangle again and gets its resize handles back — then
 * validates it the same way, additionally rejecting a zero-area result,
 * before committing one {@link ReplaceShapeVerticesCommand}. An edit whose
 * normalised result equals the shape's current geometry commits nothing.
 */
export const applyInteractionEffect = (session: EditorSession, effect: InteractionEffect): void => {
  const selection = useSelectionStore.getState();

  switch (effect.type) {
    case 'selectOnly': {
      // A click resolves through the group rules (issue #52, spec §7): a
      // member of a group not currently entered selects the whole group; a
      // member of the entered group (or an ungrouped shape) selects just
      // itself. `resolveClickSelection` also decides whether group mode
      // stays entered.
      const { shapeIds, activeGroupId } = resolveClickSelection(
        session.getDocument(),
        selection.activeGroupId,
        effect.shapeId
      );
      if (shapeIds.length === 1) {
        selection.selectOnly(shapeIds[0]);
      } else {
        selection.setSelection(shapeIds);
      }
      if (activeGroupId !== null) {
        // `setSelection` / `selectOnly` above already exited group mode;
        // restore it when the click landed on the still-entered group.
        selection.enterGroup(activeGroupId, shapeIds);
      }
      return;
    }
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
      // A group moves as a rigid whole (spec §7): if the drag started on one
      // member without the group already fully selected (`interactionController`
      // only knows the single hit shape at that point), expand it here so
      // every member gets the same delta in the same Command.
      const shapeIds = expandSelectionForGroups(document, effect.shapeIds, selection.activeGroupId);
      const commands: EditorCommand[] = [];
      for (const shapeId of shapeIds) {
        const shape = document.shapes[shapeId];
        if (shape === undefined) {
          continue;
        }
        commands.push(
          new ReplaceShapeVerticesCommand(shapeId, translatePolygon(shape.polygon, effect.delta))
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
    case 'resizeShape': {
      const document = session.getDocument();
      const shape = document.shapes[effect.shapeId];
      if (shape === undefined) {
        return;
      }
      session.dispatch(
        new ReplaceShapeVerticesCommand(effect.shapeId, {
          outerRing: ringFromRect(effect.bounds),
          innerRings: shape.polygon.innerRings,
        })
      );
      return;
    }
    case 'createPolygon': {
      if (!isSimplePolygon(effect.vertices)) {
        useToastStore.getState().addToast({
          type: 'error',
          message: '辺が交差するポリゴンは作成できません。',
        });
        return;
      }
      const shape = {
        id: generateId('shape'),
        polygon: { outerRing: effect.vertices, innerRings: [] },
        style: defaultShapeStyle(session.shapeCount),
      };
      session.dispatch(new CreateShapeCommand(shape));
      selection.selectOnly(shape.id);
      return;
    }
    case 'updateShapeVertices': {
      const document = session.getDocument();
      const shape = document.shapes[effect.shapeId];
      if (shape === undefined) {
        return;
      }
      // Normalise first (issue #64): a vertex dropped onto its neighbour
      // merges into it, and a vertex left on the straight line between its
      // neighbours is removed. A ring that collapses below three vertices or
      // to zero area in the process is a degenerate edit.
      const normalized = cleanPolygon(effect.polygon);
      // Reject a vertex/edge drag that would self-intersect or collapse to
      // zero area (issue #50, spec §6.2) by simply not committing — the
      // shape stays at its last valid geometry, matching `createPolygon`'s
      // reject-with-a-toast pattern rather than clamping the drag.
      if (normalized === null || !isValidPolygonEdit(normalized)) {
        useToastStore.getState().addToast({
          type: 'error',
          message: '辺が交差する、または面積が0になる変形はできません。',
        });
        return;
      }
      // Normalisation can undo the whole edit (e.g. a ghost vertex dragged
      // along its own edge): nothing to commit, and no empty undo step.
      if (samePolygon(normalized, shape.polygon)) {
        return;
      }
      session.dispatch(new ReplaceShapeVerticesCommand(effect.shapeId, normalized));
      return;
    }
  }
};
