import { beforeEach, describe, expect, it } from 'vitest';
import { useShapeEditPreviewStore } from './shapeEditPreviewStore';

/**
 * Tests for the transient cell-edit preview store (issue #49). It exists
 * purely so the Konva renderer Adapters can redraw the edited shape's
 * node(s) from the live working polygons while a cell-drag stroke is in
 * progress — the document is never touched here.
 */
describe('useShapeEditPreviewStore', () => {
  beforeEach(() => {
    useShapeEditPreviewStore.setState({ preview: null });
  });

  it('test_useShapeEditPreviewStore_startsWithNoPreview', () => {
    expect(useShapeEditPreviewStore.getState().preview).toBeNull();
  });

  it('test_useShapeEditPreviewStore_setPreview_storesShapeIdAndWorkingPolygons', () => {
    const polygon = { outerRing: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }], innerRings: [] };
    useShapeEditPreviewStore.getState().setPreview('a', [polygon]);
    expect(useShapeEditPreviewStore.getState().preview).toEqual({
      shapeId: 'a',
      workingPolygons: [polygon],
    });
  });

  it('test_useShapeEditPreviewStore_setPreview_supportsMultiplePolygons_forASplit', () => {
    const left = { outerRing: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], innerRings: [] };
    const right = { outerRing: [{ x: 2, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 2, y: 1 }], innerRings: [] };
    useShapeEditPreviewStore.getState().setPreview('a', [left, right]);
    expect(useShapeEditPreviewStore.getState().preview?.workingPolygons).toHaveLength(2);
  });

  it('test_useShapeEditPreviewStore_clearPreview_resetsToNull', () => {
    const polygon = { outerRing: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], innerRings: [] };
    useShapeEditPreviewStore.getState().setPreview('a', [polygon]);
    useShapeEditPreviewStore.getState().clearPreview();
    expect(useShapeEditPreviewStore.getState().preview).toBeNull();
  });

  it('test_useShapeEditPreviewStore_setPreview_replacesThePreviousValue', () => {
    const first = { outerRing: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], innerRings: [] };
    const second = { outerRing: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }], innerRings: [] };
    useShapeEditPreviewStore.getState().setPreview('a', [first]);
    useShapeEditPreviewStore.getState().setPreview('a', [second]);
    expect(useShapeEditPreviewStore.getState().preview).toEqual({
      shapeId: 'a',
      workingPolygons: [second],
    });
  });
});
