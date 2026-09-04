import { describe, expect, it, vi } from 'vitest';
import { CreateShapeCommand, type EditorShape } from '@gridder/editor-core';
import { EditorSession } from './editorSession';
import { createEmptyDocument } from './document';

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

describe('EditorSession', () => {
  it('test_EditorSession_startsEmpty_withNoUndoHistory', () => {
    const session = new EditorSession();
    expect(session.shapeCount).toBe(0);
    expect(session.canUndo).toBe(false);
    expect(session.canRedo).toBe(false);
  });

  it('test_EditorSession_dispatch_appliesCommand_andNotifiesSubscribers', () => {
    const session = new EditorSession(createEmptyDocument());
    const listener = vi.fn();
    session.subscribe(listener);

    session.dispatch(new CreateShapeCommand(rectShape('s1')));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(session.getDocument().zOrder).toEqual(['s1']);
    expect(session.shapeCount).toBe(1);
    expect(session.canUndo).toBe(true);
  });

  it('test_EditorSession_undo_removesTheCreatedShape_redoRestoresIt', () => {
    const session = new EditorSession(createEmptyDocument());
    session.dispatch(new CreateShapeCommand(rectShape('s1')));

    session.undo();
    expect(session.getDocument().zOrder).toEqual([]);
    expect(session.canRedo).toBe(true);

    session.redo();
    expect(session.getDocument().zOrder).toEqual(['s1']);
  });

  it('test_EditorSession_getDocument_isStableReferenceBetweenMutations', () => {
    const session = new EditorSession(createEmptyDocument());
    const first = session.getDocument();
    expect(session.getDocument()).toBe(first);

    session.dispatch(new CreateShapeCommand(rectShape('s1')));
    expect(session.getDocument()).not.toBe(first);
  });

  it('test_EditorSession_unsubscribe_stopsNotifications', () => {
    const session = new EditorSession(createEmptyDocument());
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);
    unsubscribe();

    session.dispatch(new CreateShapeCommand(rectShape('s1')));
    expect(listener).not.toHaveBeenCalled();
  });
});
