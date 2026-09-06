import { beforeEach, describe, expect, it } from 'vitest';
import { CreateShapeCommand, type EditorShape, type GridPolygon } from '@gridder/editor-core';
import { useSelectionStore } from '@/stores/selectionStore';
import { useToastStore } from '@/hooks/useToast';
import { EditorSession } from './editorSession';
import { createEmptyDocument } from './document';
import { applyInteractionEffect } from './applyInteractionEffect';

/**
 * `updateShapeVertices` effect handling for issue #50 (spec §6.2: reject a
 * self-intersecting or zero-area vertex/edge edit at commit time). Split from
 * `applyInteractionEffect.test.ts` so parallel work on that file's other
 * effect cases doesn't collide here.
 */

const lShapePolygon: GridPolygon = {
  outerRing: [
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 6, y: 3 },
    { x: 3, y: 3 },
    { x: 3, y: 6 },
    { x: 0, y: 6 },
  ],
  innerRings: [],
};

const lShape = (id: string): EditorShape => ({
  id,
  polygon: lShapePolygon,
  style: { fill: '#3b82f6', opacity: 0.8, isBorderVisible: true },
});

describe('applyInteractionEffect — updateShapeVertices (issue #50)', () => {
  beforeEach(() => {
    useSelectionStore.setState({ selectedIds: [], primaryId: null, activeGroupId: null });
    useToastStore.setState({ toasts: [] });
  });

  it('test_updateShapeVertices_validEdit_commitsReplaceShapeVerticesCommand', () => {
    const session = new EditorSession(createEmptyDocument());
    session.dispatch(new CreateShapeCommand(lShape('l')));

    const nextPolygon: GridPolygon = {
      outerRing: [
        { x: -2, y: -2 },
        { x: 6, y: 0 },
        { x: 6, y: 3 },
        { x: 3, y: 3 },
        { x: 3, y: 6 },
        { x: 0, y: 6 },
      ],
      innerRings: [],
    };
    applyInteractionEffect(session, { type: 'updateShapeVertices', shapeId: 'l', polygon: nextPolygon });

    expect(session.getDocument().shapes['l']?.polygon).toEqual(nextPolygon);
  });

  it('test_updateShapeVertices_isOneUndoStep', () => {
    const session = new EditorSession(createEmptyDocument());
    session.dispatch(new CreateShapeCommand(lShape('l')));
    const beforeEdit = session.getDocument();

    const nextPolygon: GridPolygon = {
      outerRing: [
        { x: -2, y: -2 },
        { x: 6, y: 0 },
        { x: 6, y: 3 },
        { x: 3, y: 3 },
        { x: 3, y: 6 },
        { x: 0, y: 6 },
      ],
      innerRings: [],
    };
    applyInteractionEffect(session, { type: 'updateShapeVertices', shapeId: 'l', polygon: nextPolygon });
    expect(session.getDocument()).not.toEqual(beforeEdit);

    session.undo();
    expect(session.getDocument()).toEqual(beforeEdit);
  });

  it('test_updateShapeVertices_selfIntersectingResult_isRejected_andShowsToast', () => {
    const session = new EditorSession(createEmptyDocument());
    session.dispatch(new CreateShapeCommand(lShape('l')));
    const beforeEdit = session.getDocument();

    // Moving vertex 1 (6,0) to (0,3) makes edges 0 and 2 cross.
    const selfIntersecting: GridPolygon = {
      outerRing: [
        { x: 0, y: 0 },
        { x: 0, y: 3 },
        { x: 6, y: 3 },
        { x: 3, y: 3 },
        { x: 3, y: 6 },
        { x: 0, y: 6 },
      ],
      innerRings: [],
    };
    applyInteractionEffect(session, {
      type: 'updateShapeVertices',
      shapeId: 'l',
      polygon: selfIntersecting,
    });

    expect(session.getDocument()).toEqual(beforeEdit);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0]?.type).toBe('error');
  });

  it('test_updateShapeVertices_zeroAreaResult_isRejected', () => {
    const square: EditorShape = {
      id: 'sq',
      polygon: {
        outerRing: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 4 },
          { x: 0, y: 4 },
        ],
        innerRings: [],
      },
      style: { fill: '#3b82f6', opacity: 1, isBorderVisible: true },
    };
    const session = new EditorSession(createEmptyDocument());
    session.dispatch(new CreateShapeCommand(square));
    const beforeEdit = session.getDocument();

    // Collapsing every vertex onto a single line (zero area).
    const degenerate: GridPolygon = {
      outerRing: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 0 },
        { x: 0, y: 0 },
      ],
      innerRings: [],
    };
    applyInteractionEffect(session, { type: 'updateShapeVertices', shapeId: 'sq', polygon: degenerate });

    expect(session.getDocument()).toEqual(beforeEdit);
  });

  it('test_updateShapeVertices_selfIntersectingHole_isRejected', () => {
    const holed: EditorShape = {
      id: 'holed',
      polygon: {
        outerRing: [
          { x: 0, y: 0 },
          { x: 8, y: 0 },
          { x: 8, y: 8 },
          { x: 0, y: 8 },
        ],
        innerRings: [
          [
            { x: 2, y: 2 },
            { x: 5, y: 2 },
            { x: 5, y: 5 },
            { x: 2, y: 5 },
          ],
        ],
      },
      style: { fill: '#3b82f6', opacity: 1, isBorderVisible: true },
    };
    const session = new EditorSession(createEmptyDocument());
    session.dispatch(new CreateShapeCommand(holed));
    const beforeEdit = session.getDocument();

    // Self-intersecting (bowtie) hole ring: swapping two opposite corners
    // makes edges 0-1 and 2-3 cross instead of forming a simple quadrilateral.
    const brokenHole: GridPolygon = {
      outerRing: holed.polygon.outerRing,
      innerRings: [
        [
          { x: 5, y: 2 },
          { x: 2, y: 2 },
          { x: 5, y: 5 },
          { x: 2, y: 5 },
        ],
      ],
    };
    applyInteractionEffect(session, {
      type: 'updateShapeVertices',
      shapeId: 'holed',
      polygon: brokenHole,
    });

    expect(session.getDocument()).toEqual(beforeEdit);
  });

  it('test_updateShapeVertices_missingShape_isANoOp', () => {
    const session = new EditorSession(createEmptyDocument());
    const before = session.getDocument();

    applyInteractionEffect(session, {
      type: 'updateShapeVertices',
      shapeId: 'missing',
      polygon: lShapePolygon,
    });

    expect(session.getDocument()).toBe(before);
  });
});
