import { describe, expect, it } from 'vitest';
import {
  CURRENT_DOCUMENT_FORMAT_VERSION,
  type EditorDocument,
  type EditorShape,
  type GridRing,
} from '@gridder/editor-core';
import {
  IDLE_STATE,
  movePreview,
  polygonDraftPreview,
  previewRegion,
  reduceInteraction,
  resizePreview,
  shapeEditPreview,
  type InteractionEvent,
  type InteractionState,
  type PointerSample,
} from './interactionController';

const rectRing = (x: number, y: number, w: number, h: number): GridRing => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

const rectShape = (id: string, x: number, y: number, w: number, h: number): EditorShape => ({
  id,
  polygon: { outerRing: rectRing(x, y, w, h), innerRings: [] },
  style: { fill: '#3b82f6', opacity: 0.8, isBorderVisible: true },
});

const documentOf = (shapes: readonly EditorShape[]): EditorDocument => ({
  formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
  shapes: Object.fromEntries(shapes.map((shape) => [shape.id, shape])),
  zOrder: shapes.map((shape) => shape.id),
  groups: {},
  drawingBounds: { mode: 'auto', min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
});

const sample = (
  x: number,
  y: number,
  shiftKey = false
): PointerSample => ({
  vertex: { x: Math.round(x), y: Math.round(y) },
  precise: { x, y },
  shiftKey,
});

/** A pointer sample at a precise (non-vertex-snapped) grid position, optionally with Alt held (issue #49). */
const cellSample = (x: number, y: number, altKey = false): PointerSample => ({
  vertex: { x: Math.round(x), y: Math.round(y) },
  precise: { x, y },
  shiftKey: false,
  altKey,
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

describe('reduceInteraction — click selection', () => {
  it('test_click_onShape_selectsThatShapeOnly', () => {
    const document = documentOf([rectShape('a', 0, 0, 4, 4)]);
    const { state, effects } = run(document, [
      { type: 'pointerDown', sample: sample(2, 2) },
      { type: 'pointerUp', sample: sample(2, 2) },
    ]);
    expect(state).toEqual(IDLE_STATE);
    expect(effects).toEqual([{ type: 'selectOnly', shapeId: 'a' }]);
  });

  it('test_shiftClick_onShape_togglesSelection', () => {
    const document = documentOf([rectShape('a', 0, 0, 4, 4)]);
    const { effects } = run(document, [
      { type: 'pointerDown', sample: sample(2, 2, true) },
      { type: 'pointerUp', sample: sample(2, 2, true) },
    ]);
    expect(effects).toEqual([{ type: 'toggleSelection', shapeId: 'a' }]);
  });

  it('test_click_onBlankSpace_clearsSelection', () => {
    const document = documentOf([rectShape('a', 0, 0, 4, 4)]);
    const { effects } = run(document, [
      { type: 'pointerDown', sample: sample(20, 20) },
      { type: 'pointerUp', sample: sample(20, 20) },
    ]);
    expect(effects).toEqual([{ type: 'clearSelection' }]);
  });

  it('test_shiftClick_onBlankSpace_keepsSelection', () => {
    const document = documentOf([rectShape('a', 0, 0, 4, 4)]);
    const { effects } = run(document, [
      { type: 'pointerDown', sample: sample(20, 20, true) },
      { type: 'pointerUp', sample: sample(20, 20, true) },
    ]);
    expect(effects).toEqual([]);
  });
});

describe('reduceInteraction — blank-drag rectangle creation', () => {
  it('test_blankDrag_entersCreatingRect_thenEmitsCreateRectOnPointerUp', () => {
    const document = documentOf([]);
    let state: InteractionState = IDLE_STATE;
    state = reduceInteraction(state, { type: 'pointerDown', sample: sample(1, 1) }, document).state;
    expect(state.kind).toBe('pending');

    const moved = reduceInteraction(state, { type: 'pointerMove', sample: sample(5, 4) }, document);
    expect(moved.state.kind).toBe('creatingRect');

    const up = reduceInteraction(
      moved.state,
      { type: 'pointerUp', sample: sample(5, 4) },
      document
    );
    expect(up.state).toEqual(IDLE_STATE);
    expect(up.effect).toEqual({
      type: 'createRect',
      start: { x: 1, y: 1 },
      end: { x: 5, y: 4 },
    });
  });

  it('test_creatingRect_previewRegion_tracksTheDrag', () => {
    const state: InteractionState = {
      kind: 'creatingRect',
      originVertex: { x: 2, y: 2 },
      currentVertex: { x: 6, y: 9 },
    };
    expect(previewRegion(state)).toEqual({ minX: 2, minY: 2, maxX: 6, maxY: 9 });
  });

  it('test_tinyMove_belowThreshold_staysAClick_notARectangle', () => {
    const document = documentOf([]);
    const { effects } = run(document, [
      { type: 'pointerDown', sample: sample(3, 3) },
      { type: 'pointerMove', sample: sample(3.1, 3.05) },
      { type: 'pointerUp', sample: sample(3.1, 3.05) },
    ]);
    expect(effects).toEqual([{ type: 'clearSelection' }]);
  });
});

describe('reduceInteraction — Shift blank-drag marquee', () => {
  it('test_shiftDrag_selectsFullyContainedShapes_containmentSemantics', () => {
    const inside = rectShape('inside', 2, 2, 2, 2);
    const straddling = rectShape('straddling', 8, 8, 6, 6);
    const document = documentOf([inside, straddling]);

    const { state, effects } = run(document, [
      { type: 'pointerDown', sample: sample(0, 0, true) },
      { type: 'pointerMove', sample: sample(10, 10, true) },
      { type: 'pointerUp', sample: sample(10, 10, true) },
    ]);
    expect(state).toEqual(IDLE_STATE);
    expect(effects).toEqual([{ type: 'setSelection', shapeIds: ['inside'] }]);
  });

  it('test_marquee_previewRegion_usesPrecisePoints', () => {
    const state: InteractionState = {
      kind: 'marquee',
      originPrecise: { x: 0.5, y: 0.5 },
      currentPrecise: { x: 4.25, y: 3.75 },
    };
    expect(previewRegion(state)).toEqual({
      minX: 0.5,
      minY: 0.5,
      maxX: 4.25,
      maxY: 3.75,
    });
  });

  it('test_dragThatStartsOnAShape_movesItInstead_doesNotCreateARectangle', () => {
    // issue #43: a drag that starts on a shape moves it — it never falls
    // through to blank-drag rectangle creation.
    const document = documentOf([rectShape('a', 0, 0, 10, 10)]);
    const { state, effects } = run(document, [
      { type: 'pointerDown', sample: sample(2, 2) },
      { type: 'pointerMove', sample: sample(7, 7) },
      { type: 'pointerUp', sample: sample(7, 7) },
    ]);
    expect(state).toEqual(IDLE_STATE);
    expect(effects).toEqual([
      { type: 'selectOnly', shapeId: 'a' },
      { type: 'moveShapes', shapeIds: ['a'], delta: { x: 5, y: 5 } },
    ]);
  });

  it('test_pointerCancel_returnsToIdle_withNoEffect', () => {
    const document = documentOf([]);
    const { state, effects } = run(document, [
      { type: 'pointerDown', sample: sample(1, 1) },
      { type: 'pointerMove', sample: sample(6, 6) },
      { type: 'pointerCancel' },
    ]);
    expect(state).toEqual(IDLE_STATE);
    expect(effects).toEqual([]);
  });
});

describe('reduceInteraction — shape drag move (issue #43)', () => {
  it('test_dragOnUnselectedShape_selectsIt_thenMovesOnlyThatShape', () => {
    const moved = rectShape('a', 0, 0, 4, 4);
    const other = rectShape('b', 10, 10, 4, 4);
    const document = documentOf([moved, other]);
    const { state, effects } = run(
      document,
      [
        { type: 'pointerDown', sample: sample(2, 2) },
        { type: 'pointerMove', sample: sample(5, 3) },
        { type: 'pointerUp', sample: sample(5, 3) },
      ],
      ['b'] // 'b' selected beforehand, but the drag started on 'a'.
    );
    expect(state).toEqual(IDLE_STATE);
    expect(effects).toEqual([
      { type: 'selectOnly', shapeId: 'a' },
      { type: 'moveShapes', shapeIds: ['a'], delta: { x: 3, y: 1 } },
    ]);
  });

  it('test_dragOnAlreadySelectedShape_movesWholeSelection_withoutReselecting', () => {
    const a = rectShape('a', 0, 0, 4, 4);
    const b = rectShape('b', 10, 10, 4, 4);
    const document = documentOf([a, b]);
    const { state, effects } = run(
      document,
      [
        { type: 'pointerDown', sample: sample(2, 2) },
        { type: 'pointerMove', sample: sample(4, 2) },
        { type: 'pointerUp', sample: sample(4, 2) },
      ],
      ['a', 'b']
    );
    expect(state).toEqual(IDLE_STATE);
    // No selectOnly: the drag started on an already-selected shape, so the
    // whole current selection moves together with one integer delta.
    expect(effects).toEqual([
      { type: 'moveShapes', shapeIds: ['a', 'b'], delta: { x: 2, y: 0 } },
    ]);
  });

  it('test_movePreview_tracksTheLiveDelta_untilPointerUp', () => {
    const document = documentOf([rectShape('a', 0, 0, 4, 4)]);
    let state: InteractionState = IDLE_STATE;
    state = reduceInteraction(state, { type: 'pointerDown', sample: sample(2, 2) }, document, [])
      .state;
    state = reduceInteraction(
      state,
      { type: 'pointerMove', sample: sample(5, 6) },
      document,
      []
    ).state;
    expect(state.kind).toBe('moving');
    expect(movePreview(state)).toEqual({ shapeIds: ['a'], delta: { x: 3, y: 4 } });

    const further = reduceInteraction(
      state,
      { type: 'pointerMove', sample: sample(1, 2) },
      document,
      []
    ).state;
    expect(movePreview(further)).toEqual({ shapeIds: ['a'], delta: { x: -1, y: 0 } });
  });

  it('test_moveThatReturnsToOrigin_commitsNothing_onPointerUp', () => {
    const document = documentOf([rectShape('a', 0, 0, 4, 4)]);
    const { state, effects } = run(document, [
      { type: 'pointerDown', sample: sample(2, 2) },
      { type: 'pointerMove', sample: sample(6, 6) },
      { type: 'pointerMove', sample: sample(2, 2) },
      { type: 'pointerUp', sample: sample(2, 2) },
    ]);
    expect(state).toEqual(IDLE_STATE);
    // Only the selection effect from entering `moving`; no-op move commits no Command.
    expect(effects).toEqual([{ type: 'selectOnly', shapeId: 'a' }]);
  });

  it('test_shiftDragOnAShape_doesNotMoveIt_fallsThroughToShiftClickToggle', () => {
    // Shift is reserved for the blank-space marquee (spec §6.1), so a
    // Shift-drag that starts on a shape stays `pending` through the move —
    // pointer-up on it acts as a Shift+click toggle, not a move.
    const document = documentOf([rectShape('a', 0, 0, 4, 4)]);
    const { state, effects } = run(document, [
      { type: 'pointerDown', sample: sample(2, 2, true) },
      { type: 'pointerMove', sample: sample(6, 6, true) },
      { type: 'pointerUp', sample: sample(6, 6, true) },
    ]);
    expect(state).toEqual(IDLE_STATE);
    expect(effects).toEqual([{ type: 'toggleSelection', shapeId: 'a' }]);
  });

  it('test_movePreview_isNull_outsideMovingState', () => {
    expect(movePreview(IDLE_STATE)).toBeNull();
    expect(
      movePreview({ kind: 'creatingRect', originVertex: { x: 0, y: 0 }, currentVertex: { x: 1, y: 1 } })
    ).toBeNull();
  });
});

describe('reduceInteraction — rectangle handle resize (issue #44)', () => {
  it('test_pointerDownOnHandle_entersResizing_priorityOverMove', () => {
    const rect = rectShape('r', 0, 0, 4, 4);
    const document = documentOf([rect]);
    // Pointer-down exactly on the 'se' corner (4,4), rect selected.
    const { state } = run(document, [{ type: 'pointerDown', sample: sample(4, 4) }], ['r'], 0.5);
    expect(state).toMatchObject({ kind: 'resizing', shapeId: 'r', handle: 'se' });
  });

  it('test_pointerDownAwayFromHandle_fallsThroughToShapeHitTest_startsMoveInstead', () => {
    const rect = rectShape('r', 0, 0, 4, 4);
    const document = documentOf([rect]);
    // Pointer-down at the shape's centre, far from any handle.
    const { state } = run(document, [{ type: 'pointerDown', sample: sample(2, 2) }], ['r'], 0.5);
    expect(state.kind).toBe('pending');
    expect(state).toMatchObject({ hitShapeId: 'r' });
  });

  it('test_handlesOnlyExist_whenExactlyOneShapeSelected', () => {
    const a = rectShape('a', 0, 0, 4, 4);
    const b = rectShape('b', 10, 10, 4, 4);
    const document = documentOf([a, b]);
    const { state } = run(
      document,
      [{ type: 'pointerDown', sample: sample(4, 4) }],
      ['a', 'b'],
      0.5
    );
    // Two shapes selected: no handles, so pointer-down on 'a's corner falls
    // through to a shape hit-test — 'a' occupies (0,0)-(4,4), so (4,4) is on
    // its border and counts as a hit, starting a move-pending gesture.
    expect(state.kind).toBe('pending');
  });

  it('test_handlesOnlyExist_forAxisAlignedRectangles_notArbitraryPolygons', () => {
    const triangle: EditorShape = {
      id: 't',
      polygon: {
        outerRing: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 2, y: 4 },
        ],
        innerRings: [],
      },
      style: { fill: '#3b82f6', opacity: 0.8, isBorderVisible: true },
    };
    const document = documentOf([triangle]);
    const { state } = run(document, [{ type: 'pointerDown', sample: sample(0, 0) }], ['t'], 0.5);
    // No bounding-box resize handles for a triangle: (0,0) hits its own
    // vertex instead, entering vertex/edge direct manipulation (issue #50)
    // rather than resizing.
    expect(state.kind).toBe('movingVertex');
  });

  it('test_resizing_pointerMove_updatesCurrentBounds_liveWithoutCommitting', () => {
    const rect = rectShape('r', 0, 0, 4, 4);
    const document = documentOf([rect]);
    let state: InteractionState = IDLE_STATE;
    state = reduceInteraction(
      state,
      { type: 'pointerDown', sample: sample(4, 4) },
      document,
      ['r'],
      0.5
    ).state;
    expect(state.kind).toBe('resizing');

    const moved = reduceInteraction(
      state,
      { type: 'pointerMove', sample: sample(7, 9) },
      document,
      ['r'],
      0.5
    );
    expect(resizePreview(moved.state)).toEqual({
      shapeId: 'r',
      bounds: { minX: 0, minY: 0, maxX: 7, maxY: 9 },
    });
    expect(moved.effect).toBeUndefined();
  });

  it('test_resizing_pointerUp_commitsOneResizeShapeEffect_withFinalBounds', () => {
    const rect = rectShape('r', 0, 0, 4, 4);
    const document = documentOf([rect]);
    const { state, effects } = run(
      document,
      [
        { type: 'pointerDown', sample: sample(4, 4) }, // grabs 'se'
        { type: 'pointerMove', sample: sample(6, 6) },
        { type: 'pointerUp', sample: sample(6, 6) },
      ],
      ['r'],
      0.5
    );
    expect(state).toEqual(IDLE_STATE);
    expect(effects).toEqual([
      { type: 'resizeShape', shapeId: 'r', bounds: { minX: 0, minY: 0, maxX: 6, maxY: 6 } },
    ]);
  });

  it('test_resizing_edgeHandle_resultingBoundsHaveIntegerVertices', () => {
    const rect = rectShape('r', 0, 0, 5, 5);
    const document = documentOf([rect]);
    const { effects } = run(
      document,
      [
        { type: 'pointerDown', sample: sample(5, 2.5) }, // 'e' edge handle
        { type: 'pointerMove', sample: sample(9, 2.5) },
        { type: 'pointerUp', sample: sample(9, 2.5) },
      ],
      ['r'],
      0.5
    );
    expect(effects).toHaveLength(1);
    const effect = effects[0] as { type: string; bounds: { minX: number; minY: number; maxX: number; maxY: number } };
    expect(effect.type).toBe('resizeShape');
    for (const value of Object.values(effect.bounds)) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('test_resizing_dragPastOppositeEdge_flipsAndNormalizes_onCommit', () => {
    const rect = rectShape('r', 2, 2, 4, 4); // (2,2)-(6,6)
    const document = documentOf([rect]);
    const { effects } = run(
      document,
      [
        { type: 'pointerDown', sample: sample(6, 6) }, // 'se' corner
        { type: 'pointerMove', sample: sample(-1, -1) }, // past the 'nw' corner (2,2)
        { type: 'pointerUp', sample: sample(-1, -1) },
      ],
      ['r'],
      0.5
    );
    expect(effects).toEqual([
      { type: 'resizeShape', shapeId: 'r', bounds: { minX: -1, minY: -1, maxX: 2, maxY: 2 } },
    ]);
  });

  it('test_resizing_noNetChange_commitsNothing_onPointerUp', () => {
    const rect = rectShape('r', 0, 0, 4, 4);
    const document = documentOf([rect]);
    const { state, effects } = run(
      document,
      [
        { type: 'pointerDown', sample: sample(4, 4) },
        { type: 'pointerUp', sample: sample(4, 4) },
      ],
      ['r'],
      0.5
    );
    expect(state).toEqual(IDLE_STATE);
    expect(effects).toEqual([]);
  });

  it('test_resizing_pointerCancel_returnsToIdle_withNoEffect_andClearsPreview', () => {
    const rect = rectShape('r', 0, 0, 4, 4);
    const document = documentOf([rect]);
    const { state, effects } = run(
      document,
      [
        { type: 'pointerDown', sample: sample(4, 4) },
        { type: 'pointerMove', sample: sample(8, 8) },
        { type: 'pointerCancel' },
      ],
      ['r'],
      0.5
    );
    expect(state).toEqual(IDLE_STATE);
    expect(effects).toEqual([]);
    expect(resizePreview(state)).toBeNull();
  });

  it('test_resizePreview_isNull_outsideResizingState', () => {
    expect(resizePreview(IDLE_STATE)).toBeNull();
    expect(
      resizePreview({ kind: 'moving', originVertex: { x: 0, y: 0 }, shapeIds: ['a'], delta: { x: 1, y: 1 } })
    ).toBeNull();
  });
});

describe('reduceInteraction — polygon creation (issue #48)', () => {
  it('test_startPolygon_fromIdle_entersCreatingPolygon_withNoVertices', () => {
    const document = documentOf([]);
    const { state } = run(document, [{ type: 'startPolygon' }]);
    expect(state).toEqual({ kind: 'creatingPolygon', vertices: [], cursorVertex: null });
  });

  it('test_startPolygon_whileAlreadyDragging_isIgnored', () => {
    const document = documentOf([]);
    const { state } = run(document, [
      { type: 'pointerDown', sample: sample(1, 1) },
      { type: 'pointerMove', sample: sample(5, 4) },
      { type: 'startPolygon' },
    ]);
    // Still creatingRect: startPolygon had no effect mid-drag.
    expect(state.kind).toBe('creatingRect');
  });

  it('test_click_placesAVertex_eachTime', () => {
    const document = documentOf([]);
    const { state } = run(document, [
      { type: 'startPolygon' },
      { type: 'pointerDown', sample: sample(0, 0) },
      { type: 'pointerDown', sample: sample(4, 0) },
    ]);
    expect(state).toMatchObject({
      kind: 'creatingPolygon',
      vertices: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ],
    });
  });

  it('test_pointerMove_updatesCursorVertex_forTheRubberBandPreview', () => {
    const document = documentOf([]);
    const { state } = run(document, [
      { type: 'startPolygon' },
      { type: 'pointerDown', sample: sample(0, 0) },
      { type: 'pointerMove', sample: sample(5, 3) },
    ]);
    expect(polygonDraftPreview(state)).toEqual({
      vertices: [{ x: 0, y: 0 }],
      cursorVertex: { x: 5, y: 3 },
      canClose: false,
    });
  });

  it('test_polygonDraftPreview_canClose_becomesTrueAtThreeVertices', () => {
    const document = documentOf([]);
    const twoVertexState = run(document, [
      { type: 'startPolygon' },
      { type: 'pointerDown', sample: sample(0, 0) },
      { type: 'pointerDown', sample: sample(4, 0) },
    ]).state;
    expect(polygonDraftPreview(twoVertexState)?.canClose).toBe(false);

    const threeVertexState = run(document, [
      { type: 'startPolygon' },
      { type: 'pointerDown', sample: sample(0, 0) },
      { type: 'pointerDown', sample: sample(4, 0) },
      { type: 'pointerDown', sample: sample(2, 4) },
    ]).state;
    expect(polygonDraftPreview(threeVertexState)?.canClose).toBe(true);
  });

  it('test_clickOnStartVertex_withThreeOrMoreVertices_confirmsAsCreatePolygon', () => {
    const document = documentOf([]);
    const { state, effects } = run(document, [
      { type: 'startPolygon' },
      { type: 'pointerDown', sample: sample(0, 0) },
      { type: 'pointerDown', sample: sample(4, 0) },
      { type: 'pointerDown', sample: sample(2, 4) },
      { type: 'pointerDown', sample: sample(0.1, 0.1) }, // close to (0,0)
    ]);
    expect(state).toEqual(IDLE_STATE);
    expect(effects).toEqual([
      {
        type: 'createPolygon',
        vertices: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 2, y: 4 },
        ],
      },
    ]);
  });

  it('test_clickOnStartVertex_withFewerThanThreeVertices_doesNotClose', () => {
    const document = documentOf([]);
    const { state } = run(document, [
      { type: 'startPolygon' },
      { type: 'pointerDown', sample: sample(0, 0) },
      { type: 'pointerDown', sample: sample(0, 0) }, // clicking start again, only 1 vertex so far
    ]);
    // Duplicate click at the same spot is a no-op, not a close or a new vertex.
    expect(state).toMatchObject({ kind: 'creatingPolygon', vertices: [{ x: 0, y: 0 }] });
  });

  it('test_confirmPolygon_withThreeOrMoreVertices_emitsCreatePolygon', () => {
    const document = documentOf([]);
    const { state, effects } = run(document, [
      { type: 'startPolygon' },
      { type: 'pointerDown', sample: sample(0, 0) },
      { type: 'pointerDown', sample: sample(4, 0) },
      { type: 'pointerDown', sample: sample(2, 4) },
      { type: 'confirmPolygon' },
    ]);
    expect(state).toEqual(IDLE_STATE);
    expect(effects).toEqual([
      {
        type: 'createPolygon',
        vertices: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 2, y: 4 },
        ],
      },
    ]);
  });

  it('test_confirmPolygon_withFewerThanThreeVertices_isRefused_stateUnchanged', () => {
    const document = documentOf([]);
    const { state, effects } = run(document, [
      { type: 'startPolygon' },
      { type: 'pointerDown', sample: sample(0, 0) },
      { type: 'pointerDown', sample: sample(4, 0) },
      { type: 'confirmPolygon' },
    ]);
    expect(state.kind).toBe('creatingPolygon');
    expect(effects).toEqual([]);
  });

  it('test_confirmPolygon_outsideCreatingPolygon_isIgnored', () => {
    const document = documentOf([]);
    const { state, effects } = run(document, [{ type: 'confirmPolygon' }]);
    expect(state).toEqual(IDLE_STATE);
    expect(effects).toEqual([]);
  });

  it('test_cancelPolygon_discardsEverything_backToIdle_noEffect', () => {
    const document = documentOf([]);
    const { state, effects } = run(document, [
      { type: 'startPolygon' },
      { type: 'pointerDown', sample: sample(0, 0) },
      { type: 'pointerDown', sample: sample(4, 0) },
      { type: 'cancelPolygon' },
    ]);
    expect(state).toEqual(IDLE_STATE);
    expect(effects).toEqual([]);
  });

  it('test_cancelPolygon_outsideCreatingPolygon_isIgnored', () => {
    const document = documentOf([]);
    const { state } = run(document, [{ type: 'cancelPolygon' }]);
    expect(state).toEqual(IDLE_STATE);
  });

  it('test_pointerCancel_doesNotInterruptPolygonCreation', () => {
    const document = documentOf([]);
    const { state } = run(document, [
      { type: 'startPolygon' },
      { type: 'pointerDown', sample: sample(0, 0) },
      { type: 'pointerCancel' },
    ]);
    // Unlike a drag gesture, a stray pointerCancel does not discard the draft.
    expect(state).toMatchObject({ kind: 'creatingPolygon', vertices: [{ x: 0, y: 0 }] });
  });

  it('test_concaveShape_confirmsSuccessfully_asCreatePolygon', () => {
    const document = documentOf([]);
    const { effects } = run(document, [
      { type: 'startPolygon' },
      { type: 'pointerDown', sample: sample(0, 0) },
      { type: 'pointerDown', sample: sample(4, 0) },
      { type: 'pointerDown', sample: sample(4, 2) },
      { type: 'pointerDown', sample: sample(2, 2) },
      { type: 'pointerDown', sample: sample(2, 4) },
      { type: 'pointerDown', sample: sample(0, 4) },
      { type: 'confirmPolygon' },
    ]);
    expect(effects).toEqual([
      {
        type: 'createPolygon',
        vertices: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 2 },
          { x: 2, y: 2 },
          { x: 2, y: 4 },
          { x: 0, y: 4 },
        ],
      },
    ]);
  });

  it('test_polygonDraftPreview_isNull_outsideCreatingPolygon', () => {
    expect(polygonDraftPreview(IDLE_STATE)).toBeNull();
    expect(
      polygonDraftPreview({
        kind: 'creatingRect',
        originVertex: { x: 0, y: 0 },
        currentVertex: { x: 1, y: 1 },
      })
    ).toBeNull();
  });
});

describe('reduceInteraction — shape cell editing (issue #49)', () => {
  it('test_doubleClickShape_fromIdle_entersEditingShape_withOriginalPolygonAsWorking', () => {
    const shape = rectShape('a', 0, 0, 2, 2);
    const document = documentOf([shape]);
    const { state } = run(document, [{ type: 'doubleClickShape', shapeId: 'a' }]);
    expect(state).toMatchObject({
      kind: 'editingShape',
      shapeId: 'a',
      originalPolygon: shape.polygon,
      workingPolygons: [shape.polygon],
      stroke: null,
    });
  });

  it('test_doubleClickShape_unknownShapeId_isIgnored', () => {
    const document = documentOf([]);
    const { state } = run(document, [{ type: 'doubleClickShape', shapeId: 'missing' }]);
    expect(state).toEqual(IDLE_STATE);
  });

  it('test_doubleClickShape_whileAlreadyEditingAnotherGesture_isIgnored', () => {
    const document = documentOf([rectShape('a', 0, 0, 2, 2)]);
    const { state } = run(document, [
      { type: 'pointerDown', sample: sample(10, 10) },
      { type: 'pointerMove', sample: sample(15, 14) },
      { type: 'doubleClickShape', shapeId: 'a' },
    ]);
    expect(state.kind).toBe('creatingRect');
  });

  it('test_cellDrag_addsACell_growsTheShape_byUnion', () => {
    const document = documentOf([rectShape('a', 0, 0, 2, 2)]);
    const { state } = run(document, [
      { type: 'doubleClickShape', shapeId: 'a' },
      { type: 'pointerDown', sample: cellSample(2.5, 0.5) }, // cell (2,0)-(3,1)
      { type: 'pointerUp', sample: cellSample(2.5, 0.5) },
    ]);
    const preview = shapeEditPreview(state);
    expect(preview?.workingPolygons).toHaveLength(1);
    expect(preview?.workingPolygons[0]).toEqual({
      outerRing: [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
        { x: 0, y: 2 },
      ],
      innerRings: [],
    });
  });

  it('test_altCellDrag_removesACell_byDifference', () => {
    const document = documentOf([rectShape('a', 0, 0, 2, 2)]);
    const { state } = run(document, [
      { type: 'doubleClickShape', shapeId: 'a' },
      { type: 'pointerDown', sample: cellSample(1.5, 1.5, true) }, // cell (1,1)-(2,2), Alt held
      { type: 'pointerUp', sample: cellSample(1.5, 1.5, true) },
    ]);
    const preview = shapeEditPreview(state);
    expect(preview?.workingPolygons).toHaveLength(1);
    // Removing the corner cell of a 2x2 square leaves an L-shape.
    expect(preview?.workingPolygons[0].outerRing).toHaveLength(6);
  });

  it('test_altCellDrag_onInteriorCell_createsAHole', () => {
    const document = documentOf([rectShape('a', 0, 0, 3, 3)]);
    const { state } = run(document, [
      { type: 'doubleClickShape', shapeId: 'a' },
      { type: 'pointerDown', sample: cellSample(1.5, 1.5, true) }, // centre cell
      { type: 'pointerUp', sample: cellSample(1.5, 1.5, true) },
    ]);
    const preview = shapeEditPreview(state);
    expect(preview?.workingPolygons).toHaveLength(1);
    expect(preview?.workingPolygons[0].innerRings).toHaveLength(1);
  });

  it('test_altCellDrag_thatDisconnectsTheShape_splitsWorkingPolygonsIntoTwo', () => {
    // A 1x3 horizontal strip; removing the middle cell splits it in two.
    const document = documentOf([rectShape('a', 0, 0, 3, 1)]);
    const { state } = run(document, [
      { type: 'doubleClickShape', shapeId: 'a' },
      { type: 'pointerDown', sample: cellSample(1.5, 0.5, true) },
      { type: 'pointerUp', sample: cellSample(1.5, 0.5, true) },
    ]);
    const preview = shapeEditPreview(state);
    expect(preview?.workingPolygons).toHaveLength(2);
  });

  it('test_altCellDrag_thatRemovesTheWholeShape_leavesNoWorkingPolygons', () => {
    const document = documentOf([rectShape('a', 0, 0, 1, 1)]);
    const { state } = run(document, [
      { type: 'doubleClickShape', shapeId: 'a' },
      { type: 'pointerDown', sample: cellSample(0.5, 0.5, true) },
      { type: 'pointerUp', sample: cellSample(0.5, 0.5, true) },
    ]);
    expect(shapeEditPreview(state)?.workingPolygons).toEqual([]);
  });

  it('test_dragAcrossMultipleCells_unionsEveryTouchedCell_inOneStroke', () => {
    const document = documentOf([rectShape('a', 0, 0, 1, 1)]);
    const { state } = run(document, [
      { type: 'doubleClickShape', shapeId: 'a' },
      { type: 'pointerDown', sample: cellSample(1.5, 0.5) }, // cell (1,0)
      { type: 'pointerMove', sample: cellSample(2.5, 0.5) }, // cell (2,0)
      { type: 'pointerUp', sample: cellSample(2.5, 0.5) },
    ]);
    const preview = shapeEditPreview(state);
    expect(preview?.workingPolygons).toHaveLength(1);
    expect(preview?.workingPolygons[0]).toEqual({
      outerRing: [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 1 },
        { x: 0, y: 1 },
      ],
      innerRings: [],
    });
  });

  it('test_pointerMove_sameCellAsLast_isANoOp_doesNotRecompute', () => {
    const document = documentOf([rectShape('a', 0, 0, 2, 2)]);
    const afterDown = run(document, [
      { type: 'doubleClickShape', shapeId: 'a' },
      { type: 'pointerDown', sample: cellSample(0.5, 0.5) },
    ]).state;
    const afterMove = reduceInteraction(afterDown, {
      type: 'pointerMove',
      sample: cellSample(0.9, 0.9),
    }).state;
    // Still inside cell (0,0): the state reference should be unchanged.
    expect(afterMove).toBe(afterDown);
  });

  it('test_secondStroke_buildsOnFirst_notOnOriginal', () => {
    const document = documentOf([rectShape('a', 0, 0, 1, 1)]);
    const { state } = run(document, [
      { type: 'doubleClickShape', shapeId: 'a' },
      { type: 'pointerDown', sample: cellSample(1.5, 0.5) }, // add cell (1,0)
      { type: 'pointerUp', sample: cellSample(1.5, 0.5) },
      { type: 'pointerDown', sample: cellSample(2.5, 0.5) }, // add cell (2,0)
      { type: 'pointerUp', sample: cellSample(2.5, 0.5) },
    ]);
    const preview = shapeEditPreview(state);
    expect(preview?.workingPolygons).toHaveLength(1);
    // Both strokes accumulated: three cells wide now.
    const xs = preview?.workingPolygons[0].outerRing.map((p) => p.x) ?? [];
    expect(Math.max(...xs)).toBe(3);
  });

  it('test_selectingAnotherShape_isDisallowedWhileEditing_pointerDownDrivesTheStrokeInstead', () => {
    const editingShape = rectShape('a', 0, 0, 2, 2);
    const otherShape = rectShape('b', 10, 10, 2, 2);
    const document = documentOf([editingShape, otherShape]);
    const { state } = run(document, [
      { type: 'doubleClickShape', shapeId: 'a' },
      // Pointer down where 'b' lives — must not select it or exit editing.
      { type: 'pointerDown', sample: cellSample(10.5, 10.5) },
    ]);
    expect(state.kind).toBe('editingShape');
    expect((state as { shapeId: string }).shapeId).toBe('a');
  });

  it('test_confirmShapeEdit_emitsCommitShapeEdit_withOriginalAndResultPolygons', () => {
    const shape = rectShape('a', 0, 0, 2, 2);
    const document = documentOf([shape]);
    const { state, effects } = run(document, [
      { type: 'doubleClickShape', shapeId: 'a' },
      { type: 'pointerDown', sample: cellSample(2.5, 0.5) },
      { type: 'pointerUp', sample: cellSample(2.5, 0.5) },
      { type: 'confirmShapeEdit' },
    ]);
    expect(state).toEqual(IDLE_STATE);
    expect(effects).toHaveLength(1);
    const effect = effects[0] as {
      type: string;
      shapeId: string;
      originalPolygon: unknown;
      resultPolygons: unknown[];
    };
    expect(effect.type).toBe('commitShapeEdit');
    expect(effect.shapeId).toBe('a');
    expect(effect.originalPolygon).toEqual(shape.polygon);
    expect(effect.resultPolygons).toHaveLength(1);
  });

  it('test_confirmShapeEdit_withNoChangeAtAll_commitsNothing', () => {
    const document = documentOf([rectShape('a', 0, 0, 2, 2)]);
    const { state, effects } = run(document, [
      { type: 'doubleClickShape', shapeId: 'a' },
      { type: 'confirmShapeEdit' },
    ]);
    expect(state).toEqual(IDLE_STATE);
    expect(effects).toEqual([]);
  });

  it('test_confirmShapeEdit_outsideEditingShape_isIgnored', () => {
    const document = documentOf([]);
    const { state, effects } = run(document, [{ type: 'confirmShapeEdit' }]);
    expect(state).toEqual(IDLE_STATE);
    expect(effects).toEqual([]);
  });

  it('test_cancelShapeEdit_discardsEverything_backToIdle_noEffect', () => {
    const document = documentOf([rectShape('a', 0, 0, 2, 2)]);
    const { state, effects } = run(document, [
      { type: 'doubleClickShape', shapeId: 'a' },
      { type: 'pointerDown', sample: cellSample(2.5, 0.5) },
      { type: 'pointerUp', sample: cellSample(2.5, 0.5) },
      { type: 'cancelShapeEdit' },
    ]);
    expect(state).toEqual(IDLE_STATE);
    expect(effects).toEqual([]);
  });

  it('test_cancelShapeEdit_outsideEditingShape_isIgnored', () => {
    const document = documentOf([]);
    const { state } = run(document, [{ type: 'cancelShapeEdit' }]);
    expect(state).toEqual(IDLE_STATE);
  });

  it('test_pointerCancel_midStroke_dropsOnlyTheStroke_keepsEditingShapeActive', () => {
    const document = documentOf([rectShape('a', 0, 0, 2, 2)]);
    const { state } = run(document, [
      { type: 'doubleClickShape', shapeId: 'a' },
      { type: 'pointerDown', sample: cellSample(2.5, 0.5) },
      { type: 'pointerCancel' },
    ]);
    expect(state.kind).toBe('editingShape');
    expect((state as { stroke: unknown }).stroke).toBeNull();
    // The in-progress stroke's speculative cell is dropped, not kept.
    const preview = shapeEditPreview(state);
    expect(preview?.workingPolygons).toEqual([rectShape('a', 0, 0, 2, 2).polygon]);
  });

  it('test_shapeEditPreview_isNull_outsideEditingShape', () => {
    expect(shapeEditPreview(IDLE_STATE)).toBeNull();
    expect(
      shapeEditPreview({
        kind: 'creatingRect',
        originVertex: { x: 0, y: 0 },
        currentVertex: { x: 1, y: 1 },
      })
    ).toBeNull();
  });
});
