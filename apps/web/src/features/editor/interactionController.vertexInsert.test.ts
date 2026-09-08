import { describe, expect, it } from 'vitest';
import {
  CURRENT_DOCUMENT_FORMAT_VERSION,
  type EditorDocument,
  type EditorShape,
  type GridPolygon,
} from '@gridder/editor-core';
import {
  handleTargetAt,
  IDLE_STATE,
  reduceInteraction,
  vertexEditPreview,
  type InteractionState,
  type PointerSample,
} from './interactionController';

/**
 * Ghost-vertex insertion for issue #64 (issue #63 案 D): pressing on an
 * edge near an interior grid point inserts a vertex there and drags it in
 * the same gesture; a click that never moves leaves nothing behind.
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

const shapeOf = (id: string, polygon: GridPolygon): EditorShape => ({
  id,
  polygon,
  style: { fill: '#3b82f6', opacity: 0.8, isBorderVisible: true },
});

const rectPolygon = (x: number, y: number, w: number, h: number): GridPolygon => ({
  outerRing: [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ],
  innerRings: [],
});

const holedPolygon: GridPolygon = {
  outerRing: rectPolygon(0, 0, 8, 8).outerRing,
  innerRings: [
    [
      { x: 2, y: 2 },
      { x: 5, y: 2 },
      { x: 5, y: 5 },
      { x: 2, y: 5 },
    ],
  ],
};

const documentOf = (shapes: readonly EditorShape[]): EditorDocument => ({
  formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
  shapes: Object.fromEntries(shapes.map(shape => [shape.id, shape])),
  zOrder: shapes.map(shape => shape.id),
  groups: {},
  drawingBounds: { mode: 'auto', min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
});

const sample = (x: number, y: number): PointerSample => ({
  vertex: { x: Math.round(x), y: Math.round(y) },
  precise: { x, y },
  shiftKey: false,
});

const HANDLE_RADIUS = 0.5;
const INSERT_RADIUS = 0.3;

const press = (document: EditorDocument, selectedIds: readonly string[], x: number, y: number) =>
  reduceInteraction(
    IDLE_STATE,
    { type: 'pointerDown', sample: sample(x, y) },
    document,
    selectedIds,
    HANDLE_RADIUS,
    INSERT_RADIUS
  ).state;

describe('handleTargetAt (issue #64 priority order)', () => {
  it('test_handleTargetAt_rectangle_resizeHandleWinsOverGhostAtTheSamePoint', () => {
    const document = documentOf([shapeOf('r', rectPolygon(0, 0, 6, 4))]);
    // (3,0) is both the 'n' handle and an interior grid point of the top edge.
    expect(
      handleTargetAt(document, ['r'], { x: 3, y: 0 }, HANDLE_RADIUS, INSERT_RADIUS)
    ).toMatchObject({ kind: 'resizeHandle', handle: 'n' });
  });

  it('test_handleTargetAt_rectangle_edgeGridPointAwayFromHandles_isAGhost', () => {
    const document = documentOf([shapeOf('r', rectPolygon(0, 0, 6, 4))]);
    expect(handleTargetAt(document, ['r'], { x: 2, y: 0.1 }, HANDLE_RADIUS, INSERT_RADIUS)).toEqual(
      {
        kind: 'insertVertex',
        shapeId: 'r',
        hit: { edge: { ring: { kind: 'outer' }, edgeIndex: 0 }, point: { x: 2, y: 0 } },
      }
    );
  });

  it('test_handleTargetAt_rectangle_betweenGridPoints_isNothing_noEdgeDragForRects', () => {
    const document = documentOf([shapeOf('r', rectPolygon(0, 0, 6, 4))]);
    expect(
      handleTargetAt(document, ['r'], { x: 1.5, y: 0 }, HANDLE_RADIUS, INSERT_RADIUS)
    ).toBeNull();
  });

  it('test_handleTargetAt_polygon_vertexWinsOverGhost_andGhostWinsOverEdge', () => {
    const document = documentOf([shapeOf('l', lShapePolygon)]);
    expect(
      handleTargetAt(document, ['l'], { x: 0.1, y: 0 }, HANDLE_RADIUS, INSERT_RADIUS)
    ).toMatchObject({ kind: 'vertex', vertex: { vertexIndex: 0 } });
    expect(
      handleTargetAt(document, ['l'], { x: 2, y: 0.1 }, HANDLE_RADIUS, INSERT_RADIUS)
    ).toMatchObject({ kind: 'insertVertex', hit: { point: { x: 2, y: 0 } } });
    expect(
      handleTargetAt(document, ['l'], { x: 2.5, y: 0.1 }, HANDLE_RADIUS, INSERT_RADIUS)
    ).toEqual({
      kind: 'edge',
      shapeId: 'l',
      edge: { ring: { kind: 'outer' }, edgeIndex: 0 },
      axis: 'horizontal',
    });
  });

  it('test_handleTargetAt_insertRadiusNull_offersNoGhost_edgeDragEverywhere', () => {
    const document = documentOf([shapeOf('l', lShapePolygon)]);
    expect(handleTargetAt(document, ['l'], { x: 2, y: 0.1 }, HANDLE_RADIUS, null)).toMatchObject({
      kind: 'edge',
    });
    const rectDocument = documentOf([shapeOf('r', rectPolygon(0, 0, 6, 4))]);
    expect(handleTargetAt(rectDocument, ['r'], { x: 2, y: 0.1 }, HANDLE_RADIUS, null)).toBeNull();
  });

  it('test_handleTargetAt_multiSelectionOrNoSelection_isNothing', () => {
    const document = documentOf([
      shapeOf('l', lShapePolygon),
      shapeOf('r', rectPolygon(10, 10, 2, 2)),
    ]);
    expect(handleTargetAt(document, [], { x: 2, y: 0 }, HANDLE_RADIUS, INSERT_RADIUS)).toBeNull();
    expect(
      handleTargetAt(document, ['l', 'r'], { x: 2, y: 0 }, HANDLE_RADIUS, INSERT_RADIUS)
    ).toBeNull();
  });

  it('test_handleTargetAt_edgeAxis_isReportedForTheHoverCursor', () => {
    const triangle: GridPolygon = {
      outerRing: [
        { x: 0, y: 0 },
        { x: 4, y: 2 },
        { x: 0, y: 4 },
      ],
      innerRings: [],
    };
    const document = documentOf([shapeOf('t', triangle)]);
    expect(
      handleTargetAt(document, ['t'], { x: 1, y: 0.5 }, HANDLE_RADIUS, INSERT_RADIUS)
    ).toMatchObject({
      kind: 'edge',
      axis: 'diagonal',
    });
    const lDocument = documentOf([shapeOf('l', lShapePolygon)]);
    // Right edge (6,0)-(6,3) is vertical.
    expect(
      handleTargetAt(lDocument, ['l'], { x: 6, y: 1.5 }, HANDLE_RADIUS, INSERT_RADIUS)
    ).toMatchObject({ kind: 'edge', axis: 'vertical' });
  });
});

describe('reduceInteraction — ghost-vertex insertion (issue #64)', () => {
  it('test_pointerDownOnGhost_ofSelectedRectangle_entersMovingVertex_withVertexInserted', () => {
    const document = documentOf([shapeOf('r', rectPolygon(0, 0, 6, 4))]);
    const state = press(document, ['r'], 2, 0.1);
    expect(state).toMatchObject({
      kind: 'movingVertex',
      shapeId: 'r',
      vertex: { ring: { kind: 'outer' }, vertexIndex: 1 },
    });
    const preview = vertexEditPreview(state);
    expect(preview?.polygon.outerRing).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 4 },
      { x: 0, y: 4 },
    ]);
  });

  it('test_pointerDownOnGhost_ofSelectedPolygon_entersMovingVertex', () => {
    const document = documentOf([shapeOf('l', lShapePolygon)]);
    const state = press(document, ['l'], 2, 0.1);
    expect(state).toMatchObject({ kind: 'movingVertex', vertex: { vertexIndex: 1 } });
  });

  it('test_ghostDrag_pointerMove_movesOnlyTheInsertedVertex', () => {
    const document = documentOf([shapeOf('r', rectPolygon(0, 0, 6, 4))]);
    let state: InteractionState = press(document, ['r'], 2, 0.1);
    const moved = reduceInteraction(
      state,
      { type: 'pointerMove', sample: sample(2, 2) },
      document,
      ['r'],
      HANDLE_RADIUS,
      INSERT_RADIUS
    );
    state = moved.state;
    expect(moved.effect).toBeUndefined();
    expect(vertexEditPreview(state)?.polygon.outerRing).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 2 },
      { x: 6, y: 0 },
      { x: 6, y: 4 },
      { x: 0, y: 4 },
    ]);
  });

  it('test_ghostDrag_pointerUp_commitsOneUpdateShapeVerticesEffect', () => {
    const document = documentOf([shapeOf('r', rectPolygon(0, 0, 6, 4))]);
    const state = press(document, ['r'], 2, 0.1);
    const result = reduceInteraction(
      state,
      { type: 'pointerUp', sample: sample(2, 2) },
      document,
      ['r'],
      HANDLE_RADIUS,
      INSERT_RADIUS
    );
    expect(result.state).toEqual(IDLE_STATE);
    expect(result.effect).toMatchObject({ type: 'updateShapeVertices', shapeId: 'r' });
    expect((result.effect as { polygon: GridPolygon }).polygon.outerRing[1]).toEqual({
      x: 2,
      y: 2,
    });
  });

  it('test_ghostClick_withoutMoving_commitsNothing_andLeavesNoVertex', () => {
    const document = documentOf([shapeOf('r', rectPolygon(0, 0, 6, 4))]);
    const state = press(document, ['r'], 2, 0.1);
    const result = reduceInteraction(
      state,
      { type: 'pointerUp', sample: sample(2, 0.1) },
      document,
      ['r'],
      HANDLE_RADIUS,
      INSERT_RADIUS
    );
    expect(result.state).toEqual(IDLE_STATE);
    expect(result.effect).toBeUndefined();
  });

  it('test_ghostDrag_movedAndBroughtBack_commitsNothing', () => {
    const document = documentOf([shapeOf('l', lShapePolygon)]);
    let state: InteractionState = press(document, ['l'], 2, 0.1);
    state = reduceInteraction(
      state,
      { type: 'pointerMove', sample: sample(2, 2) },
      document,
      ['l'],
      HANDLE_RADIUS,
      INSERT_RADIUS
    ).state;
    const result = reduceInteraction(
      state,
      { type: 'pointerUp', sample: sample(2, 0) },
      document,
      ['l'],
      HANDLE_RADIUS,
      INSERT_RADIUS
    );
    expect(result.effect).toBeUndefined();
  });

  it('test_ghostDrag_pointerCancel_returnsToIdle_withPreviewCleared', () => {
    const document = documentOf([shapeOf('r', rectPolygon(0, 0, 6, 4))]);
    const state = press(document, ['r'], 2, 0.1);
    const result = reduceInteraction(
      state,
      { type: 'pointerCancel' },
      document,
      ['r'],
      HANDLE_RADIUS,
      INSERT_RADIUS
    );
    expect(result.state).toEqual(IDLE_STATE);
    expect(vertexEditPreview(result.state)).toBeNull();
  });

  it('test_ghostOnHoleEdge_insertsIntoTheHoleRing', () => {
    const document = documentOf([shapeOf('h', holedPolygon)]);
    const state = press(document, ['h'], 3, 2.1);
    expect(state).toMatchObject({
      kind: 'movingVertex',
      vertex: { ring: { kind: 'inner', holeIndex: 0 }, vertexIndex: 1 },
    });
    const result = reduceInteraction(
      state,
      { type: 'pointerUp', sample: sample(3, 3) },
      document,
      ['h'],
      HANDLE_RADIUS,
      INSERT_RADIUS
    );
    const polygon = (result.effect as { polygon: GridPolygon }).polygon;
    expect(polygon.innerRings[0]).toEqual([
      { x: 2, y: 2 },
      { x: 3, y: 3 },
      { x: 5, y: 2 },
      { x: 5, y: 5 },
      { x: 2, y: 5 },
    ]);
    expect(polygon.outerRing).toEqual(holedPolygon.outerRing);
  });

  it('test_pointerDownBetweenGridPoints_onPolygonEdge_stillEntersMovingEdge', () => {
    const document = documentOf([shapeOf('l', lShapePolygon)]);
    expect(press(document, ['l'], 2.5, 0.1)).toMatchObject({ kind: 'movingEdge' });
  });

  it('test_pointerDownOnRectangleEdge_betweenGridPoints_fallsThroughToShapeBody', () => {
    const document = documentOf([shapeOf('r', rectPolygon(0, 0, 6, 4))]);
    expect(press(document, ['r'], 1.5, 0)).toMatchObject({ kind: 'pending', hitShapeId: 'r' });
  });

  it('test_insertRadiusOmitted_keepsIssue50Behaviour_edgeGridPointIsAnEdgeDrag', () => {
    const document = documentOf([shapeOf('l', lShapePolygon)]);
    const state = reduceInteraction(
      IDLE_STATE,
      { type: 'pointerDown', sample: sample(2, 0) },
      document,
      ['l'],
      HANDLE_RADIUS
    ).state;
    expect(state.kind).toBe('movingEdge');
  });
});
