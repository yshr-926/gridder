import { beforeEach, describe, expect, it } from 'vitest';
import { CreateShapeCommand, type EditorShape, type GridPolygon } from '@gridder/editor-core';
import { useSelectionStore } from '@/stores/selectionStore';
import { useToastStore } from '@/hooks/useToast';
import { EditorSession } from './editorSession';
import { createEmptyDocument } from './document';
import { applyInteractionEffect } from './applyInteractionEffect';
import { isAxisAlignedRect } from './hitTest';

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

    // Moving vertex 1 (6,0) to (0,6) makes edge 0 (0,0)-(0,6) overlap the
    // closing edge and edge 1 (0,6)-(6,3) cross edge 3 (3,3)-(3,6): a genuine
    // self-intersection that no amount of normalisation can clean away.
    const selfIntersecting: GridPolygon = {
      outerRing: [
        { x: 0, y: 0 },
        { x: 0, y: 6 },
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

/**
 * Commit-time normalisation for issue #64: duplicate and collinear vertices
 * are removed before validation, so a shape dragged back into a rectangular
 * outline is a 4-vertex rectangle again (and regains issue #44's resize
 * handles), a vertex dropped onto its neighbour merges into it, and an edit
 * whose normalised result is degenerate is rejected.
 */
describe('applyInteractionEffect — updateShapeVertices normalisation (issue #64)', () => {
  beforeEach(() => {
    useSelectionStore.setState({ selectedIds: [], primaryId: null, activeGroupId: null });
    useToastStore.setState({ toasts: [] });
  });

  const squareRing = (x: number, y: number, size: number) => [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ];

  it('test_updateShapeVertices_lShapeNotchDraggedBackToCorner_commitsAFourVertexRectangle', () => {
    const session = new EditorSession(createEmptyDocument());
    session.dispatch(new CreateShapeCommand(lShape('l')));

    // The notch corner (3,3) dragged onto the rectangle's corner (6,6): the
    // two former notch vertices now sit on the rectangle's edges.
    const notchClosed: GridPolygon = {
      outerRing: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 6, y: 3 },
        { x: 6, y: 6 },
        { x: 3, y: 6 },
        { x: 0, y: 6 },
      ],
      innerRings: [],
    };
    applyInteractionEffect(session, { type: 'updateShapeVertices', shapeId: 'l', polygon: notchClosed });

    expect(session.getDocument().shapes['l']?.polygon).toEqual({
      outerRing: squareRing(0, 0, 6),
      innerRings: [],
    });
    expect(isAxisAlignedRect(session.getDocument().shapes['l']!.polygon)).toBe(true);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('test_updateShapeVertices_vertexDroppedOnNeighbour_mergesIntoOneVertex', () => {
    const session = new EditorSession(createEmptyDocument());
    session.dispatch(new CreateShapeCommand(lShape('l')));

    // Vertex 2 (6,3) dropped onto vertex 3 (3,3).
    const overlapping: GridPolygon = {
      outerRing: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 3, y: 3 },
        { x: 3, y: 3 },
        { x: 3, y: 6 },
        { x: 0, y: 6 },
      ],
      innerRings: [],
    };
    applyInteractionEffect(session, { type: 'updateShapeVertices', shapeId: 'l', polygon: overlapping });

    expect(session.getDocument().shapes['l']?.polygon.outerRing).toEqual([
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 3, y: 3 },
      { x: 3, y: 6 },
      { x: 0, y: 6 },
    ]);
  });

  it('test_updateShapeVertices_collapsingBelowThreeVertices_isRejected', () => {
    const triangle: EditorShape = {
      id: 'tri',
      polygon: {
        outerRing: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 0, y: 4 },
        ],
        innerRings: [],
      },
      style: { fill: '#3b82f6', opacity: 1, isBorderVisible: true },
    };
    const session = new EditorSession(createEmptyDocument());
    session.dispatch(new CreateShapeCommand(triangle));
    const beforeEdit = session.getDocument();

    // Vertex 2 dropped onto vertex 1: two distinct vertices remain.
    applyInteractionEffect(session, {
      type: 'updateShapeVertices',
      shapeId: 'tri',
      polygon: {
        outerRing: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 0 },
        ],
        innerRings: [],
      },
    });

    expect(session.getDocument()).toEqual(beforeEdit);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('test_updateShapeVertices_collapsingToZeroArea_isRejected', () => {
    const square: EditorShape = {
      id: 'sq',
      polygon: { outerRing: squareRing(0, 0, 4), innerRings: [] },
      style: { fill: '#3b82f6', opacity: 1, isBorderVisible: true },
    };
    const session = new EditorSession(createEmptyDocument());
    session.dispatch(new CreateShapeCommand(square));
    const beforeEdit = session.getDocument();

    // Four distinct vertices all on one line: every one is collinear.
    applyInteractionEffect(session, {
      type: 'updateShapeVertices',
      shapeId: 'sq',
      polygon: {
        outerRing: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 4, y: 0 },
          { x: 2, y: 0 },
        ],
        innerRings: [],
      },
    });

    expect(session.getDocument()).toEqual(beforeEdit);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  const holedShape = (id: string): EditorShape => ({
    id,
    polygon: {
      outerRing: squareRing(0, 0, 8),
      innerRings: [
        [
          { x: 2, y: 2 },
          { x: 5, y: 2 },
          { x: 5, y: 5 },
          { x: 3, y: 5 },
          { x: 2, y: 5 },
        ],
      ],
    },
    style: { fill: '#3b82f6', opacity: 1, isBorderVisible: true },
  });

  it('test_updateShapeVertices_holeVertexDroppedOnNeighbour_mergesInsideTheHole', () => {
    const session = new EditorSession(createEmptyDocument());
    session.dispatch(new CreateShapeCommand(holedShape('h')));

    // Hole vertex 3 (3,5) dropped onto vertex 4 (2,5): one merges into the
    // other and the hole becomes a plain 3x3 square.
    applyInteractionEffect(session, {
      type: 'updateShapeVertices',
      shapeId: 'h',
      polygon: {
        outerRing: squareRing(0, 0, 8),
        innerRings: [
          [
            { x: 2, y: 2 },
            { x: 5, y: 2 },
            { x: 5, y: 5 },
            { x: 2, y: 5 },
            { x: 2, y: 5 },
          ],
        ],
      },
    });

    expect(session.getDocument().shapes['h']?.polygon.innerRings[0]).toEqual(squareRing(2, 2, 3));
  });

  it('test_updateShapeVertices_holeCollapsingToZeroArea_isRejected', () => {
    const session = new EditorSession(createEmptyDocument());
    session.dispatch(new CreateShapeCommand(holedShape('h')));
    const beforeEdit = session.getDocument();

    applyInteractionEffect(session, {
      type: 'updateShapeVertices',
      shapeId: 'h',
      polygon: {
        outerRing: squareRing(0, 0, 8),
        innerRings: [
          [
            { x: 2, y: 2 },
            { x: 5, y: 2 },
            { x: 5, y: 2 },
            { x: 3, y: 2 },
            { x: 2, y: 2 },
          ],
        ],
      },
    });

    expect(session.getDocument()).toEqual(beforeEdit);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('test_updateShapeVertices_normalisedResultEqualsCurrentGeometry_commitsNothing', () => {
    const session = new EditorSession(createEmptyDocument());
    session.dispatch(new CreateShapeCommand(lShape('l')));
    const beforeEdit = session.getDocument();

    // A ghost vertex inserted on the bottom edge and left on that edge: it
    // normalises away, leaving the shape exactly as it was.
    applyInteractionEffect(session, {
      type: 'updateShapeVertices',
      shapeId: 'l',
      polygon: {
        outerRing: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 6, y: 0 },
          { x: 6, y: 3 },
          { x: 3, y: 3 },
          { x: 3, y: 6 },
          { x: 0, y: 6 },
        ],
        innerRings: [],
      },
    });

    expect(session.getDocument()).toBe(beforeEdit);
    expect(session.canUndo).toBe(true); // only the CreateShapeCommand
    session.undo();
    expect(session.canUndo).toBe(false);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
