import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CreateShapeCommand, type EditorShape } from '@gridder/editor-core';
import { createEmptyDocument, editorSession } from '@/features/editor';
import { isDirty, markSaved, resetDirtyTrackingForTests, useIsDirty } from './dirtyTracking';

const rectShape = (id: string): EditorShape => ({
  id,
  polygon: {
    outerRing: [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 2 },
      { x: 0, y: 2 },
    ],
    innerRings: [],
  },
  style: { fill: '#3b82f6', opacity: 0.8, isBorderVisible: true },
});

const reset = () => {
  act(() => {
    while (editorSession.canUndo) {
      editorSession.undo();
    }
    resetDirtyTrackingForTests();
  });
};

describe('dirty tracking', () => {
  beforeEach(reset);
  afterEach(reset);

  it('test_isDirty_freshDocument_isFalse', () => {
    expect(isDirty()).toBe(false);
  });

  it('test_isDirty_afterDispatch_becomesTrue', () => {
    act(() => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    });
    expect(isDirty()).toBe(true);
  });

  it('test_isDirty_afterMarkSaved_becomesFalseAgain', () => {
    act(() => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    });
    expect(isDirty()).toBe(true);

    act(() => {
      markSaved();
    });
    expect(isDirty()).toBe(false);
  });

  it('test_isDirty_furtherEditAfterSave_becomesTrueAgain', () => {
    act(() => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
      markSaved();
      editorSession.dispatch(new CreateShapeCommand(rectShape('b')));
    });
    expect(isDirty()).toBe(true);
  });

  it('test_isDirty_undoBackToSavedDepth_becomesFalseAgain', () => {
    act(() => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
      markSaved();
      editorSession.dispatch(new CreateShapeCommand(rectShape('b')));
    });
    expect(isDirty()).toBe(true);

    act(() => {
      editorSession.undo();
    });
    expect(isDirty()).toBe(false);
  });

  it('test_isDirty_resetDocument_countsAsSaved', () => {
    act(() => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    });
    expect(isDirty()).toBe(true);

    act(() => {
      editorSession.reset(createEmptyDocument());
      markSaved();
    });
    expect(isDirty()).toBe(false);
  });

  it('test_useIsDirty_reactsToDocumentChanges', () => {
    const { result } = renderHook(() => useIsDirty());
    expect(result.current).toBe(false);

    act(() => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
    });
    expect(result.current).toBe(true);

    act(() => {
      markSaved();
    });
    expect(result.current).toBe(false);
  });
});
