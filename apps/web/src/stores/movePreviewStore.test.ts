import { beforeEach, describe, expect, it } from 'vitest';
import { useMovePreviewStore } from './movePreviewStore';

/**
 * Tests for the transient move-gesture preview store (issue #43). It exists
 * purely so the Konva renderer Adapters can offset a shape's node while a
 * drag is live — the document is never touched here.
 */
describe('useMovePreviewStore', () => {
  beforeEach(() => {
    useMovePreviewStore.setState({ preview: null });
  });

  it('test_useMovePreviewStore_startsWithNoPreview', () => {
    expect(useMovePreviewStore.getState().preview).toBeNull();
  });

  it('test_useMovePreviewStore_setPreview_storesShapeIdsAndDelta', () => {
    useMovePreviewStore.getState().setPreview(['a', 'b'], { x: 3, y: -2 });
    expect(useMovePreviewStore.getState().preview).toEqual({
      shapeIds: ['a', 'b'],
      delta: { x: 3, y: -2 },
    });
  });

  it('test_useMovePreviewStore_clearPreview_resetsToNull', () => {
    useMovePreviewStore.getState().setPreview(['a'], { x: 1, y: 1 });
    useMovePreviewStore.getState().clearPreview();
    expect(useMovePreviewStore.getState().preview).toBeNull();
  });

  it('test_useMovePreviewStore_setPreview_replacesThePreviousValue', () => {
    useMovePreviewStore.getState().setPreview(['a'], { x: 1, y: 1 });
    useMovePreviewStore.getState().setPreview(['a'], { x: 4, y: 4 });
    expect(useMovePreviewStore.getState().preview).toEqual({
      shapeIds: ['a'],
      delta: { x: 4, y: 4 },
    });
  });
});
