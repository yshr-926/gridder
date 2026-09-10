import { beforeEach, describe, expect, it } from 'vitest';
import { useResizePreviewStore } from './resizePreviewStore';

/**
 * Tests for the transient resize-gesture preview store (issue #44). It
 * exists purely so the Konva renderer Adapters can redraw a shape's node
 * from live bounds while a rectangle handle drag is in progress — the
 * document is never touched here.
 */
describe('useResizePreviewStore', () => {
  beforeEach(() => {
    useResizePreviewStore.setState({ preview: null });
  });

  it('test_useResizePreviewStore_startsWithNoPreview', () => {
    expect(useResizePreviewStore.getState().preview).toBeNull();
  });

  it('test_useResizePreviewStore_setPreview_storesShapeIdAndBounds', () => {
    useResizePreviewStore.getState().setPreview('a', { minX: 0, minY: 0, maxX: 5, maxY: 3 });
    expect(useResizePreviewStore.getState().preview).toEqual({
      shapeId: 'a',
      bounds: { minX: 0, minY: 0, maxX: 5, maxY: 3 },
    });
  });

  it('test_useResizePreviewStore_clearPreview_resetsToNull', () => {
    useResizePreviewStore.getState().setPreview('a', { minX: 0, minY: 0, maxX: 5, maxY: 3 });
    useResizePreviewStore.getState().clearPreview();
    expect(useResizePreviewStore.getState().preview).toBeNull();
  });

  it('test_useResizePreviewStore_setPreview_replacesThePreviousValue', () => {
    useResizePreviewStore.getState().setPreview('a', { minX: 0, minY: 0, maxX: 5, maxY: 3 });
    useResizePreviewStore.getState().setPreview('a', { minX: 0, minY: 0, maxX: 9, maxY: 9 });
    expect(useResizePreviewStore.getState().preview).toEqual({
      shapeId: 'a',
      bounds: { minX: 0, minY: 0, maxX: 9, maxY: 9 },
    });
  });
});
