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
  previewRegion,
  reduceInteraction,
  resizePreview,
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
    // No handles for a triangle: (0,0) hits its vertex/border, so this is a
    // plain shape hit — pending, not resizing.
    expect(state.kind).toBe('pending');
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
