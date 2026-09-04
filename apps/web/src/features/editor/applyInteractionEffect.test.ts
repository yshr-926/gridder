import { beforeEach, describe, expect, it } from 'vitest';
import { CreateShapeCommand, type EditorShape } from '@gridder/editor-core';
import { useSelectionStore } from '@/stores/selectionStore';
import { EditorSession } from './editorSession';
import { createEmptyDocument } from './document';
import { applyInteractionEffect } from './applyInteractionEffect';

const rectShape = (id: string, x: number, y: number, w: number, h: number): EditorShape => ({
  id,
  polygon: {
    outerRing: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
    innerRings: [],
  },
  style: { fill: '#3b82f6', opacity: 0.8, isBorderVisible: true },
});

describe('applyInteractionEffect', () => {
  beforeEach(() => {
    useSelectionStore.setState({ selectedIds: [], primaryId: null });
  });

  it('test_applyInteractionEffect_selectOnly_updatesSelectionStore', () => {
    const session = new EditorSession(createEmptyDocument());
    applyInteractionEffect(session, { type: 'selectOnly', shapeId: 'a' });
    expect(useSelectionStore.getState().selectedIds).toEqual(['a']);
  });

  it('test_applyInteractionEffect_toggleSelection_delegatesToStore', () => {
    const session = new EditorSession(createEmptyDocument());
    applyInteractionEffect(session, { type: 'toggleSelection', shapeId: 'a' });
    applyInteractionEffect(session, { type: 'toggleSelection', shapeId: 'b' });
    expect(useSelectionStore.getState().selectedIds).toEqual(['a', 'b']);
  });

  it('test_applyInteractionEffect_setSelection_replacesSelection', () => {
    const session = new EditorSession(createEmptyDocument());
    applyInteractionEffect(session, { type: 'setSelection', shapeIds: ['x', 'y'] });
    expect(useSelectionStore.getState().selectedIds).toEqual(['x', 'y']);
  });

  it('test_applyInteractionEffect_clearSelection_empties', () => {
    useSelectionStore.setState({ selectedIds: ['a'], primaryId: 'a' });
    const session = new EditorSession(createEmptyDocument());
    applyInteractionEffect(session, { type: 'clearSelection' });
    expect(useSelectionStore.getState().selectedIds).toEqual([]);
  });

  it('test_applyInteractionEffect_createRect_dispatchesOneCommand_andSelectsNewShape', () => {
    const session = new EditorSession(createEmptyDocument());

    applyInteractionEffect(session, {
      type: 'createRect',
      start: { x: 0, y: 0 },
      end: { x: 3, y: 2 },
    });

    const document = session.getDocument();
    expect(document.zOrder).toHaveLength(1);
    const newId = document.zOrder[0];
    expect(document.shapes[newId].polygon.outerRing).toHaveLength(4);
    expect(useSelectionStore.getState().selectedIds).toEqual([newId]);
    // Exactly one undoable entry — the whole gesture is one Command.
    expect(session.canUndo).toBe(true);
    session.undo();
    expect(session.getDocument().zOrder).toEqual([]);
  });

  it('test_applyInteractionEffect_createRect_zeroSizeDrag_stillCreatesOneCell', () => {
    const session = new EditorSession(createEmptyDocument());
    applyInteractionEffect(session, {
      type: 'createRect',
      start: { x: 4, y: 4 },
      end: { x: 4, y: 4 },
    });
    const document = session.getDocument();
    const shape = document.shapes[document.zOrder[0]];
    const xs = shape.polygon.outerRing.map((p) => p.x);
    const ys = shape.polygon.outerRing.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBe(1);
    expect(Math.max(...ys) - Math.min(...ys)).toBe(1);
  });

  describe('moveShapes (issue #43)', () => {
    it('test_moveShapes_singleShape_translatesEveryVertex_byIntegerDelta_inOneCommand', () => {
      const session = new EditorSession(createEmptyDocument());
      session.dispatch(new CreateShapeCommand(rectShape('a', 0, 0, 4, 4)));

      applyInteractionEffect(session, {
        type: 'moveShapes',
        shapeIds: ['a'],
        delta: { x: 3, y: -2 },
      });

      const shape = session.getDocument().shapes['a'];
      expect(shape.polygon.outerRing).toEqual([
        { x: 3, y: -2 },
        { x: 7, y: -2 },
        { x: 7, y: 2 },
        { x: 3, y: 2 },
      ]);
      // Every moved vertex stays an integer grid coordinate.
      for (const point of shape.polygon.outerRing) {
        expect(Number.isInteger(point.x)).toBe(true);
        expect(Number.isInteger(point.y)).toBe(true);
      }
      // The whole gesture is exactly one additional undo step past the create.
      expect(session.canUndo).toBe(true);
    });

    it('test_moveShapes_multipleShapes_appliesSameDelta_asOneCompositeCommand_undoRestoresBoth', () => {
      const session = new EditorSession(createEmptyDocument());
      session.dispatch(new CreateShapeCommand(rectShape('a', 0, 0, 2, 2)));
      session.dispatch(new CreateShapeCommand(rectShape('b', 10, 10, 2, 2)));
      const beforeA = session.getDocument().shapes['a'].polygon;
      const beforeB = session.getDocument().shapes['b'].polygon;

      applyInteractionEffect(session, {
        type: 'moveShapes',
        shapeIds: ['a', 'b'],
        delta: { x: 1, y: 1 },
      });

      const afterMove = session.getDocument();
      expect(afterMove.shapes['a'].polygon.outerRing[0]).toEqual({ x: 1, y: 1 });
      expect(afterMove.shapes['b'].polygon.outerRing[0]).toEqual({ x: 11, y: 11 });

      // One undo reverts both shapes together (one Command for the gesture).
      session.undo();
      const afterUndo = session.getDocument();
      expect(afterUndo.shapes['a'].polygon).toEqual(beforeA);
      expect(afterUndo.shapes['b'].polygon).toEqual(beforeB);
    });

    it('test_moveShapes_zeroDelta_commitsNoCommand', () => {
      const session = new EditorSession(createEmptyDocument());
      session.dispatch(new CreateShapeCommand(rectShape('a', 0, 0, 4, 4)));
      const undoDepthBefore = session.canUndo;

      applyInteractionEffect(session, {
        type: 'moveShapes',
        shapeIds: ['a'],
        delta: { x: 0, y: 0 },
      });

      // No new undo step: undo still lands back at the empty document in one step.
      expect(session.canUndo).toBe(undoDepthBefore);
      session.undo();
      expect(session.getDocument().zOrder).toEqual([]);
    });
  });
});
