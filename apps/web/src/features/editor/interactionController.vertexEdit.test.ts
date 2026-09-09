import { describe, expect, it } from 'vitest';
import {
  CURRENT_DOCUMENT_FORMAT_VERSION,
  DEFAULT_ANNOTATION_FONT_SIZE,
  type EditorDocument,
  type EditorShape,
  type GridPolygon,
} from '@gridder/editor-core';
import {
  IDLE_STATE,
  reduceInteraction,
  vertexEditPreview,
  type InteractionEvent,
  type InteractionState,
  type PointerSample,
} from './interactionController';

/**
 * Vertex/edge direct-manipulation reducer behaviour for issue #50 (spec
 * §6.2). Split from `interactionController.test.ts` so parallel work on that
 * file's other states (issue #49's cell editing) doesn't collide here.
 */

/** An L-shaped concave hexagon — not an axis-aligned rectangle, so it gets vertex/edge handles instead of resize handles. */
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

const documentOf = (shapes: readonly EditorShape[]): EditorDocument => ({
  formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
  annotationFontSize: DEFAULT_ANNOTATION_FONT_SIZE,
  shapes: Object.fromEntries(shapes.map((shape) => [shape.id, shape])),
  zOrder: shapes.map((shape) => shape.id),
  groups: {},
  drawingBounds: { mode: 'auto', min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
});

const sample = (x: number, y: number, shiftKey = false): PointerSample => ({
  vertex: { x: Math.round(x), y: Math.round(y) },
  precise: { x, y },
  shiftKey,
});

/** Drive a sequence of events through the reducer, collecting effects. */
const run = (
  document: EditorDocument,
  events: readonly InteractionEvent[],
  selectedIds: readonly string[] = [],
  handleHitRadius = 0
): { state: InteractionState; effects: unknown[] } => {
  let state: InteractionState = IDLE_STATE;
  const effects: unknown[] = [];
  for (const event of events) {
    const result = reduceInteraction(state, event, document, selectedIds, handleHitRadius);
    state = result.state;
    if (result.effect !== undefined) {
      effects.push(result.effect);
    }
  }
  return { state, effects };
};

describe('reduceInteraction — vertex/edge entry (issue #50)', () => {
  it('test_pointerDownOnVertex_ofSelectedNonRectShape_entersMovingVertex', () => {
    const document = documentOf([lShape('l')]);
    const { state } = run(document, [{ type: 'pointerDown', sample: sample(0, 0) }], ['l'], 0.5);
    expect(state).toMatchObject({
      kind: 'movingVertex',
      shapeId: 'l',
      vertex: { ring: { kind: 'outer' }, vertexIndex: 0 },
    });
  });

  it('test_pointerDownOnEdge_ofSelectedNonRectShape_entersMovingEdge', () => {
    const document = documentOf([lShape('l')]);
    // Midpoint of the bottom edge (0,0)-(6,0), away from either vertex.
    const { state } = run(document, [{ type: 'pointerDown', sample: sample(3, 0) }], ['l'], 0.5);
    expect(state).toMatchObject({
      kind: 'movingEdge',
      shapeId: 'l',
      edge: { ring: { kind: 'outer' }, edgeIndex: 0 },
    });
  });

  it('test_pointerDownOnVertex_winsOverEdge_atTheSamePoint', () => {
    const document = documentOf([lShape('l')]);
    const { state } = run(document, [{ type: 'pointerDown', sample: sample(0.1, 0.1) }], ['l'], 1);
    expect(state.kind).toBe('movingVertex');
  });

  it('test_pointerDownOnAxisAlignedRect_neverEntersVertexEditing_getsResizeInstead', () => {
    const document = documentOf([rectShape('r', 0, 0, 4, 4)]);
    const { state } = run(document, [{ type: 'pointerDown', sample: sample(4, 4) }], ['r'], 0.5);
    expect(state.kind).toBe('resizing');
  });

  it('test_pointerDownAwayFromAnyVertexOrEdge_fallsThroughToPendingOrShapeBody', () => {
    const document = documentOf([lShape('l')]);
    const { state } = run(document, [{ type: 'pointerDown', sample: sample(1, 1) }], ['l'], 0.35);
    expect(state.kind).toBe('pending');
  });

  it('test_multiSelection_getsNoVertexEditing_evenIfOneMemberIsNonRectangular', () => {
    const document = documentOf([lShape('l'), rectShape('r', 10, 10, 2, 2)]);
    const { state } = run(
      document,
      [{ type: 'pointerDown', sample: sample(0, 0) }],
      ['l', 'r'],
      0.5
    );
    expect(state.kind).not.toBe('movingVertex');
  });
});

describe('reduceInteraction — movingVertex (issue #50)', () => {
  it('test_movingVertex_pointerMove_updatesCurrentPolygon_liveWithoutCommitting', () => {
    const document = documentOf([lShape('l')]);
    let state: InteractionState = IDLE_STATE;
    state = reduceInteraction(state, { type: 'pointerDown', sample: sample(0, 0) }, document, ['l'], 0.5).state;
    expect(state.kind).toBe('movingVertex');

    const moved = reduceInteraction(state, { type: 'pointerMove', sample: sample(-2, -2) }, document, ['l'], 0.5);
    const preview = vertexEditPreview(moved.state);
    expect(preview?.shapeId).toBe('l');
    expect(preview?.polygon.outerRing[0]).toEqual({ x: -2, y: -2 });
    expect(moved.effect).toBeUndefined();
  });

  it('test_movingVertex_pointerUp_commitsUpdateShapeVerticesEffect', () => {
    const document = documentOf([lShape('l')]);
    let state: InteractionState = IDLE_STATE;
    state = reduceInteraction(state, { type: 'pointerDown', sample: sample(0, 0) }, document, ['l'], 0.5).state;

    const result = reduceInteraction(state, { type: 'pointerUp', sample: sample(-2, -2) }, document, ['l'], 0.5);
    expect(result.state).toEqual(IDLE_STATE);
    expect(result.effect).toMatchObject({ type: 'updateShapeVertices', shapeId: 'l' });
    expect((result.effect as { polygon: GridPolygon }).polygon.outerRing[0]).toEqual({ x: -2, y: -2 });
  });

  it('test_movingVertex_pointerUpWithNoNetChange_commitsNothing', () => {
    const document = documentOf([lShape('l')]);
    let state: InteractionState = IDLE_STATE;
    state = reduceInteraction(state, { type: 'pointerDown', sample: sample(0, 0) }, document, ['l'], 0.5).state;

    const result = reduceInteraction(state, { type: 'pointerUp', sample: sample(0, 0) }, document, ['l'], 0.5);
    expect(result.state).toEqual(IDLE_STATE);
    expect(result.effect).toBeUndefined();
  });

  it('test_movingVertex_pointerCancel_returnsToIdle_withPreviewCleared', () => {
    const document = documentOf([lShape('l')]);
    let state: InteractionState = IDLE_STATE;
    state = reduceInteraction(state, { type: 'pointerDown', sample: sample(0, 0) }, document, ['l'], 0.5).state;
    state = reduceInteraction(state, { type: 'pointerMove', sample: sample(-2, -2) }, document, ['l'], 0.5).state;

    const result = reduceInteraction(state, { type: 'pointerCancel' }, document, ['l'], 0.5);
    expect(result.state).toEqual(IDLE_STATE);
    expect(vertexEditPreview(result.state)).toBeNull();
  });

  it('test_movingVertex_holeVertex_movesOnlyThatHoleVertex', () => {
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
    const document = documentOf([holed]);
    let state: InteractionState = IDLE_STATE;
    state = reduceInteraction(state, { type: 'pointerDown', sample: sample(2, 2) }, document, ['holed'], 0.5).state;
    expect(state).toMatchObject({ kind: 'movingVertex', vertex: { ring: { kind: 'inner', holeIndex: 0 } } });

    const result = reduceInteraction(state, { type: 'pointerUp', sample: sample(1, 1) }, document, ['holed'], 0.5);
    const polygon = (result.effect as { polygon: GridPolygon }).polygon;
    expect(polygon.innerRings[0]?.[0]).toEqual({ x: 1, y: 1 });
    expect(polygon.outerRing).toEqual(holed.polygon.outerRing);
  });
});

describe('reduceInteraction — movingEdge (issue #50)', () => {
  it('test_movingEdge_axisAlignedEdge_pointerMove_translatesBothEndpoints', () => {
    const document = documentOf([lShape('l')]);
    let state: InteractionState = IDLE_STATE;
    state = reduceInteraction(state, { type: 'pointerDown', sample: sample(3, 0) }, document, ['l'], 0.5).state;
    expect(state.kind).toBe('movingEdge');

    const moved = reduceInteraction(state, { type: 'pointerMove', sample: sample(3, -2) }, document, ['l'], 0.5);
    const preview = vertexEditPreview(moved.state);
    expect(preview?.polygon.outerRing[0]).toEqual({ x: 0, y: -2 });
    expect(preview?.polygon.outerRing[1]).toEqual({ x: 6, y: -2 });
  });

  it('test_movingEdge_pointerUp_commitsUpdateShapeVerticesEffect', () => {
    const document = documentOf([lShape('l')]);
    let state: InteractionState = IDLE_STATE;
    state = reduceInteraction(state, { type: 'pointerDown', sample: sample(3, 0) }, document, ['l'], 0.5).state;

    const result = reduceInteraction(state, { type: 'pointerUp', sample: sample(3, -2) }, document, ['l'], 0.5);
    expect(result.effect).toMatchObject({ type: 'updateShapeVertices', shapeId: 'l' });
    const polygon = (result.effect as { polygon: GridPolygon }).polygon;
    expect(polygon.outerRing[0]).toEqual({ x: 0, y: -2 });
    expect(polygon.outerRing[1]).toEqual({ x: 6, y: -2 });
  });

  it('test_movingEdge_pointerUpWithNoNetChange_commitsNothing', () => {
    const document = documentOf([lShape('l')]);
    let state: InteractionState = IDLE_STATE;
    state = reduceInteraction(state, { type: 'pointerDown', sample: sample(3, 0) }, document, ['l'], 0.5).state;

    const result = reduceInteraction(state, { type: 'pointerUp', sample: sample(3, 0) }, document, ['l'], 0.5);
    expect(result.state).toEqual(IDLE_STATE);
    expect(result.effect).toBeUndefined();
  });

  it('test_movingEdge_diagonalEdge_translatesBothEndpointsBySameDelta', () => {
    const diagonalShape: EditorShape = {
      id: 'tri',
      polygon: {
        outerRing: [
          { x: 0, y: 0 },
          { x: 4, y: 2 },
          { x: 0, y: 4 },
        ],
        innerRings: [],
      },
      style: { fill: '#3b82f6', opacity: 1, isBorderVisible: true },
    };
    const document = documentOf([diagonalShape]);
    let state: InteractionState = IDLE_STATE;
    // Midpoint of the diagonal edge (0,0)-(4,2).
    state = reduceInteraction(
      state,
      { type: 'pointerDown', sample: sample(2, 1) },
      document,
      ['tri'],
      0.5
    ).state;
    expect(state).toMatchObject({ kind: 'movingEdge', edge: { edgeIndex: 0 } });

    const result = reduceInteraction(state, { type: 'pointerUp', sample: sample(5, 4) }, document, ['tri'], 0.5);
    const polygon = (result.effect as { polygon: GridPolygon }).polygon;
    expect(polygon.outerRing[0]).toEqual({ x: 3, y: 3 });
    expect(polygon.outerRing[1]).toEqual({ x: 7, y: 5 });
    expect(polygon.outerRing[2]).toEqual({ x: 0, y: 4 });
  });

  it('test_movingEdge_pointerCancel_returnsToIdle_withPreviewCleared', () => {
    const document = documentOf([lShape('l')]);
    let state: InteractionState = IDLE_STATE;
    state = reduceInteraction(state, { type: 'pointerDown', sample: sample(3, 0) }, document, ['l'], 0.5).state;

    const result = reduceInteraction(state, { type: 'pointerCancel' }, document, ['l'], 0.5);
    expect(result.state).toEqual(IDLE_STATE);
    expect(vertexEditPreview(result.state)).toBeNull();
  });
});

describe('vertexEditPreview', () => {
  it('test_vertexEditPreview_idleState_returnsNull', () => {
    expect(vertexEditPreview(IDLE_STATE)).toBeNull();
  });

  it('test_vertexEditPreview_resizingState_returnsNull', () => {
    const document = documentOf([rectShape('r', 0, 0, 4, 4)]);
    const { state } = run(document, [{ type: 'pointerDown', sample: sample(4, 4) }], ['r'], 0.5);
    expect(vertexEditPreview(state)).toBeNull();
  });
});
