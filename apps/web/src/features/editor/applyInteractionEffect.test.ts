import { beforeEach, describe, expect, it } from 'vitest';
import { CreateShapeCommand, GroupShapesCommand, type EditorShape } from '@gridder/editor-core';
import { useSelectionStore } from '@/stores/selectionStore';
import { useToastStore } from '@/hooks/useToast';
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
    useSelectionStore.setState({ selectedIds: [], primaryId: null, activeGroupId: null });
    useToastStore.setState({ toasts: [] });
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

  describe('resizeShape (issue #44)', () => {
    it('test_resizeShape_replacesOuterRing_withTheGivenBounds_inOneCommand', () => {
      const session = new EditorSession(createEmptyDocument());
      session.dispatch(new CreateShapeCommand(rectShape('r', 0, 0, 4, 4)));

      applyInteractionEffect(session, {
        type: 'resizeShape',
        shapeId: 'r',
        bounds: { minX: 0, minY: 0, maxX: 9, maxY: 6 },
      });

      const shape = session.getDocument().shapes['r'];
      expect(shape.polygon.outerRing).toEqual([
        { x: 0, y: 0 },
        { x: 9, y: 0 },
        { x: 9, y: 6 },
        { x: 0, y: 6 },
      ]);
      // Every resulting vertex stays an integer grid coordinate.
      for (const point of shape.polygon.outerRing) {
        expect(Number.isInteger(point.x)).toBe(true);
        expect(Number.isInteger(point.y)).toBe(true);
      }
    });

    it('test_resizeShape_isUndoable_restoresThePreResizePolygon', () => {
      const session = new EditorSession(createEmptyDocument());
      session.dispatch(new CreateShapeCommand(rectShape('r', 1, 1, 3, 3)));
      const before = session.getDocument().shapes['r'].polygon;

      applyInteractionEffect(session, {
        type: 'resizeShape',
        shapeId: 'r',
        bounds: { minX: 1, minY: 1, maxX: 8, maxY: 8 },
      });
      expect(session.getDocument().shapes['r'].polygon).not.toEqual(before);

      session.undo();
      expect(session.getDocument().shapes['r'].polygon).toEqual(before);
    });

    it('test_resizeShape_redoable_afterUndo', () => {
      const session = new EditorSession(createEmptyDocument());
      session.dispatch(new CreateShapeCommand(rectShape('r', 0, 0, 4, 4)));

      applyInteractionEffect(session, {
        type: 'resizeShape',
        shapeId: 'r',
        bounds: { minX: 0, minY: 0, maxX: 7, maxY: 7 },
      });
      const resized = session.getDocument().shapes['r'].polygon;

      session.undo();
      session.redo();
      expect(session.getDocument().shapes['r'].polygon).toEqual(resized);
    });

    it('test_resizeShape_unknownShapeId_isNoOp', () => {
      const session = new EditorSession(createEmptyDocument());
      session.dispatch(new CreateShapeCommand(rectShape('r', 0, 0, 4, 4)));
      const before = session.getDocument();

      applyInteractionEffect(session, {
        type: 'resizeShape',
        shapeId: 'missing',
        bounds: { minX: 0, minY: 0, maxX: 2, maxY: 2 },
      });

      expect(session.getDocument()).toBe(before);
    });
  });

  describe('createPolygon (issue #48)', () => {
    it('test_createPolygon_triangle_commitsOneShapeInOneCommand_andSelectsIt', () => {
      const session = new EditorSession(createEmptyDocument());
      const vertices = [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 2, y: 4 },
      ];

      applyInteractionEffect(session, { type: 'createPolygon', vertices });

      const document = session.getDocument();
      expect(document.zOrder).toHaveLength(1);
      const newId = document.zOrder[0];
      expect(document.shapes[newId].polygon.outerRing).toEqual(vertices);
      expect(document.shapes[newId].polygon.innerRings).toEqual([]);
      expect(useSelectionStore.getState().selectedIds).toEqual([newId]);

      // One undo removes the whole gesture.
      session.undo();
      expect(session.getDocument().zOrder).toEqual([]);
    });

    it('test_createPolygon_concaveShape_commitsSuccessfully', () => {
      const session = new EditorSession(createEmptyDocument());
      const vertices = [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 2 },
        { x: 2, y: 2 },
        { x: 2, y: 4 },
        { x: 0, y: 4 },
      ];

      applyInteractionEffect(session, { type: 'createPolygon', vertices });

      const document = session.getDocument();
      expect(document.zOrder).toHaveLength(1);
      expect(document.shapes[document.zOrder[0]].polygon.outerRing).toEqual(vertices);
    });

    it('test_createPolygon_selfIntersecting_isRefused_noShapeCreated_toastShown', () => {
      const session = new EditorSession(createEmptyDocument());
      // A bow-tie: self-intersecting.
      const vertices = [
        { x: 0, y: 0 },
        { x: 4, y: 4 },
        { x: 4, y: 0 },
        { x: 0, y: 4 },
      ];

      applyInteractionEffect(session, { type: 'createPolygon', vertices });

      const document = session.getDocument();
      expect(document.zOrder).toEqual([]);
      expect(session.canUndo).toBe(false);
      expect(useSelectionStore.getState().selectedIds).toEqual([]);
      expect(useToastStore.getState().toasts).toHaveLength(1);
      expect(useToastStore.getState().toasts[0].type).toBe('error');
    });

    it('test_createPolygon_everyShapeCount_getsADistinctFillFromThePalette', () => {
      const session = new EditorSession(createEmptyDocument());
      session.dispatch(new CreateShapeCommand(rectShape('existing', 10, 10, 2, 2)));

      applyInteractionEffect(session, {
        type: 'createPolygon',
        vertices: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 2, y: 4 },
        ],
      });

      const document = session.getDocument();
      const newShapeId = document.zOrder.find((id) => id !== 'existing');
      expect(newShapeId).toBeDefined();
      expect(document.shapes[newShapeId as string].style.fill).not.toBe(
        document.shapes['existing'].style.fill
      );
    });
  });

  describe('group selection and movement (issue #52)', () => {
    const groupedSession = (): EditorSession => {
      const session = new EditorSession(createEmptyDocument());
      session.dispatch(new CreateShapeCommand(rectShape('a', 0, 0, 2, 2)));
      session.dispatch(new CreateShapeCommand(rectShape('b', 5, 0, 2, 2)));
      session.dispatch(new CreateShapeCommand(rectShape('c', 10, 0, 2, 2)));
      session.dispatch(new GroupShapesCommand('group-1', ['a', 'b']));
      return session;
    };

    it('test_selectOnly_groupedShape_selectsWholeGroup', () => {
      const session = groupedSession();
      applyInteractionEffect(session, { type: 'selectOnly', shapeId: 'a' });
      expect([...useSelectionStore.getState().selectedIds].sort()).toEqual(['a', 'b']);
      expect(useSelectionStore.getState().activeGroupId).toBeNull();
    });

    it('test_selectOnly_ungroupedShape_selectsItAlone', () => {
      const session = groupedSession();
      applyInteractionEffect(session, { type: 'selectOnly', shapeId: 'c' });
      expect(useSelectionStore.getState().selectedIds).toEqual(['c']);
    });

    it('test_selectOnly_memberOfEnteredGroup_selectsItAlone_staysInGroupMode', () => {
      const session = groupedSession();
      useSelectionStore.getState().enterGroup('group-1', ['a', 'b']);
      applyInteractionEffect(session, { type: 'selectOnly', shapeId: 'b' });
      expect(useSelectionStore.getState().selectedIds).toEqual(['b']);
      expect(useSelectionStore.getState().activeGroupId).toBe('group-1');
    });

    it('test_moveShapes_dragStartedOnOneGroupMember_movesWholeGroup_oneUndoStep', () => {
      const session = groupedSession();
      // Simulate the interactionController only knowing the hit shape at
      // drag-start (it can't see group membership) — shapeIds is just ['a'].
      applyInteractionEffect(session, {
        type: 'moveShapes',
        shapeIds: ['a'],
        delta: { x: 3, y: 1 },
      });

      const document = session.getDocument();
      expect(document.shapes['a'].polygon.outerRing[0]).toEqual({ x: 3, y: 1 });
      expect(document.shapes['b'].polygon.outerRing[0]).toEqual({ x: 8, y: 1 });
      // Ungrouped shape 'c' is untouched.
      expect(document.shapes['c'].polygon.outerRing[0]).toEqual({ x: 10, y: 0 });

      // One undo reverts both group members together.
      session.undo();
      const reverted = session.getDocument();
      expect(reverted.shapes['a'].polygon.outerRing[0]).toEqual({ x: 0, y: 0 });
      expect(reverted.shapes['b'].polygon.outerRing[0]).toEqual({ x: 5, y: 0 });
    });

    it('test_moveShapes_memberOfEnteredGroup_movesOnlyThatMember', () => {
      const session = groupedSession();
      useSelectionStore.getState().enterGroup('group-1', ['a']);
      applyInteractionEffect(session, {
        type: 'moveShapes',
        shapeIds: ['a'],
        delta: { x: 1, y: 1 },
      });
      const document = session.getDocument();
      expect(document.shapes['a'].polygon.outerRing[0]).toEqual({ x: 1, y: 1 });
      // 'b' — the other group member — is untouched while inside group mode.
      expect(document.shapes['b'].polygon.outerRing[0]).toEqual({ x: 5, y: 0 });
    });
  });

  describe('commitShapeEdit (issue #49)', () => {
    it('test_commitShapeEdit_oneResultPolygon_replacesTheShapeInPlace_oneUndoStep', () => {
      const session = new EditorSession(createEmptyDocument());
      session.dispatch(new CreateShapeCommand(rectShape('a', 0, 0, 2, 2)));
      const original = session.getDocument().shapes['a'].polygon;
      const grown: EditorShape['polygon'] = {
        outerRing: [
          { x: 0, y: 0 },
          { x: 3, y: 0 },
          { x: 3, y: 1 },
          { x: 2, y: 1 },
          { x: 2, y: 2 },
          { x: 0, y: 2 },
        ],
        innerRings: [],
      };

      applyInteractionEffect(session, {
        type: 'commitShapeEdit',
        shapeId: 'a',
        originalPolygon: original,
        resultPolygons: [grown],
      });

      const document = session.getDocument();
      expect(document.zOrder).toEqual(['a']);
      expect(document.shapes['a'].polygon).toEqual(grown);
      expect(useSelectionStore.getState().selectedIds).toEqual(['a']);

      // One undo restores the original 1-shape geometry exactly.
      session.undo();
      expect(session.getDocument().shapes['a'].polygon).toEqual(original);
      expect(session.getDocument().zOrder).toEqual(['a']);
    });

    it('test_commitShapeEdit_holePreserved_keepsOneShape_withInnerRing', () => {
      const session = new EditorSession(createEmptyDocument());
      session.dispatch(new CreateShapeCommand(rectShape('a', 0, 0, 3, 3)));
      const original = session.getDocument().shapes['a'].polygon;
      const withHole: EditorShape['polygon'] = {
        outerRing: original.outerRing,
        innerRings: [
          [
            { x: 1, y: 2 },
            { x: 2, y: 2 },
            { x: 2, y: 1 },
            { x: 1, y: 1 },
          ],
        ],
      };

      applyInteractionEffect(session, {
        type: 'commitShapeEdit',
        shapeId: 'a',
        originalPolygon: original,
        resultPolygons: [withHole],
      });

      const document = session.getDocument();
      expect(document.zOrder).toEqual(['a']);
      expect(document.shapes['a'].polygon.innerRings).toHaveLength(1);

      session.undo();
      expect(session.getDocument().shapes['a'].polygon).toEqual(original);
    });

    it('test_commitShapeEdit_zeroResultPolygons_deletesTheShape_undoRestoresIt', () => {
      const session = new EditorSession(createEmptyDocument());
      session.dispatch(new CreateShapeCommand(rectShape('a', 0, 0, 1, 1)));
      const original = session.getDocument().shapes['a'].polygon;
      useSelectionStore.getState().selectOnly('a');

      applyInteractionEffect(session, {
        type: 'commitShapeEdit',
        shapeId: 'a',
        originalPolygon: original,
        resultPolygons: [],
      });

      expect(session.getDocument().zOrder).toEqual([]);
      expect(useSelectionStore.getState().selectedIds).toEqual([]);

      session.undo();
      const restored = session.getDocument();
      expect(restored.zOrder).toEqual(['a']);
      expect(restored.shapes['a'].polygon).toEqual(original);
    });

    it('test_commitShapeEdit_twoResultPolygons_splitsIntoTwoShapes_inheritingNameAndStyle_oneUndoStep', () => {
      const session = new EditorSession(createEmptyDocument());
      const named: EditorShape = { ...rectShape('a', 0, 0, 3, 1), name: 'My Shape' };
      session.dispatch(new CreateShapeCommand(named));
      const original = session.getDocument().shapes['a'].polygon;

      const left: EditorShape['polygon'] = {
        outerRing: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ],
        innerRings: [],
      };
      const right: EditorShape['polygon'] = {
        outerRing: [
          { x: 2, y: 0 },
          { x: 3, y: 0 },
          { x: 3, y: 1 },
          { x: 2, y: 1 },
        ],
        innerRings: [],
      };

      applyInteractionEffect(session, {
        type: 'commitShapeEdit',
        shapeId: 'a',
        originalPolygon: original,
        resultPolygons: [left, right],
      });

      const document = session.getDocument();
      expect(document.zOrder).toHaveLength(2);
      expect(document.zOrder[0]).toBe('a');
      const newId = document.zOrder[1];
      expect(newId).not.toBe('a');

      expect(document.shapes['a'].polygon).toEqual(left);
      expect(document.shapes[newId].polygon).toEqual(right);
      // Both pieces inherit the original name and style, under their own ids.
      expect(document.shapes['a'].name).toBe('My Shape');
      expect(document.shapes[newId].name).toBe('My Shape');
      expect(document.shapes[newId].style).toEqual(named.style);
      expect(useSelectionStore.getState().selectedIds).toEqual(['a', newId]);

      // One undo reverts the whole split back to the single original shape.
      session.undo();
      const reverted = session.getDocument();
      expect(reverted.zOrder).toEqual(['a']);
      expect(reverted.shapes['a'].polygon).toEqual(original);
      expect(reverted.shapes['a'].name).toBe('My Shape');
    });

    it('test_commitShapeEdit_threeResultPolygons_createsTwoNewShapes_allWithFreshIds', () => {
      const session = new EditorSession(createEmptyDocument());
      session.dispatch(new CreateShapeCommand(rectShape('a', 0, 0, 5, 1)));
      const original = session.getDocument().shapes['a'].polygon;
      const piece = (x: number): EditorShape['polygon'] => ({
        outerRing: [
          { x, y: 0 },
          { x: x + 1, y: 0 },
          { x: x + 1, y: 1 },
          { x, y: 1 },
        ],
        innerRings: [],
      });

      applyInteractionEffect(session, {
        type: 'commitShapeEdit',
        shapeId: 'a',
        originalPolygon: original,
        resultPolygons: [piece(0), piece(2), piece(4)],
      });

      const document = session.getDocument();
      expect(document.zOrder).toHaveLength(3);
      const ids = new Set(document.zOrder);
      expect(ids.size).toBe(3);
      expect(document.zOrder[0]).toBe('a');

      session.undo();
      expect(session.getDocument().zOrder).toEqual(['a']);
    });

    it('test_commitShapeEdit_unknownShapeId_isNoOp', () => {
      const session = new EditorSession(createEmptyDocument());
      session.dispatch(new CreateShapeCommand(rectShape('a', 0, 0, 2, 2)));
      const before = session.getDocument();

      applyInteractionEffect(session, {
        type: 'commitShapeEdit',
        shapeId: 'missing',
        originalPolygon: rectShape('missing', 0, 0, 1, 1).polygon,
        resultPolygons: [rectShape('missing', 0, 0, 2, 2).polygon],
      });

      expect(session.getDocument()).toBe(before);
    });

    it('test_commitShapeEdit_splitShapes_insertRightAboveTheOriginalInZOrder', () => {
      const session = new EditorSession(createEmptyDocument());
      session.dispatch(new CreateShapeCommand(rectShape('below', 20, 20, 1, 1)));
      session.dispatch(new CreateShapeCommand(rectShape('a', 0, 0, 3, 1)));
      session.dispatch(new CreateShapeCommand(rectShape('above', 30, 30, 1, 1)));
      const original = session.getDocument().shapes['a'].polygon;

      const left: EditorShape['polygon'] = {
        outerRing: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ],
        innerRings: [],
      };
      const right: EditorShape['polygon'] = {
        outerRing: [
          { x: 2, y: 0 },
          { x: 3, y: 0 },
          { x: 3, y: 1 },
          { x: 2, y: 1 },
        ],
        innerRings: [],
      };

      applyInteractionEffect(session, {
        type: 'commitShapeEdit',
        shapeId: 'a',
        originalPolygon: original,
        resultPolygons: [left, right],
      });

      const zOrder = session.getDocument().zOrder;
      expect(zOrder).toEqual(['below', 'a', zOrder[2], 'above']);
    });
  });
});
