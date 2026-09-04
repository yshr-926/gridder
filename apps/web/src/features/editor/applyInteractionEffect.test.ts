import { beforeEach, describe, expect, it } from 'vitest';
import { useSelectionStore } from '@/stores/selectionStore';
import { EditorSession } from './editorSession';
import { createEmptyDocument } from './document';
import { applyInteractionEffect } from './applyInteractionEffect';

describe('applyInteractionEffect', () => {
  beforeEach(() => {
    useSelectionStore.setState({ selectedIds: [], primaryId: null });
  });

  it('test_applyInteractionEffect_selectOnly_updatesSelectionStore', () => {
    const session = new EditorSession(createEmptyDocument());
    applyInteractionEffect(session, { type: 'selectOnly', shapeId: 'a' });
    expect(useSelectionStore.getState().selectedIds).toEqual(['a']);
  });

  it('test_applyInteractionEffect_toggleSelection_delegatesToStore', () => {
    const session = new EditorSession(createEmptyDocument());
    applyInteractionEffect(session, { type: 'toggleSelection', shapeId: 'a' });
    applyInteractionEffect(session, { type: 'toggleSelection', shapeId: 'b' });
    expect(useSelectionStore.getState().selectedIds).toEqual(['a', 'b']);
  });

  it('test_applyInteractionEffect_setSelection_replacesSelection', () => {
    const session = new EditorSession(createEmptyDocument());
    applyInteractionEffect(session, { type: 'setSelection', shapeIds: ['x', 'y'] });
    expect(useSelectionStore.getState().selectedIds).toEqual(['x', 'y']);
  });

  it('test_applyInteractionEffect_clearSelection_empties', () => {
    useSelectionStore.setState({ selectedIds: ['a'], primaryId: 'a' });
    const session = new EditorSession(createEmptyDocument());
    applyInteractionEffect(session, { type: 'clearSelection' });
    expect(useSelectionStore.getState().selectedIds).toEqual([]);
  });

  it('test_applyInteractionEffect_createRect_dispatchesOneCommand_andSelectsNewShape', () => {
    const session = new EditorSession(createEmptyDocument());

    applyInteractionEffect(session, {
      type: 'createRect',
      start: { x: 0, y: 0 },
      end: { x: 3, y: 2 },
    });

    const document = session.getDocument();
    expect(document.zOrder).toHaveLength(1);
    const newId = document.zOrder[0];
    expect(document.shapes[newId].polygon.outerRing).toHaveLength(4);
    expect(useSelectionStore.getState().selectedIds).toEqual([newId]);
    // Exactly one undoable entry — the whole gesture is one Command.
    expect(session.canUndo).toBe(true);
    session.undo();
    expect(session.getDocument().zOrder).toEqual([]);
  });

  it('test_applyInteractionEffect_createRect_zeroSizeDrag_stillCreatesOneCell', () => {
    const session = new EditorSession(createEmptyDocument());
    applyInteractionEffect(session, {
      type: 'createRect',
      start: { x: 4, y: 4 },
      end: { x: 4, y: 4 },
    });
    const document = session.getDocument();
    const shape = document.shapes[document.zOrder[0]];
    const xs = shape.polygon.outerRing.map((p) => p.x);
    const ys = shape.polygon.outerRing.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBe(1);
    expect(Math.max(...ys) - Math.min(...ys)).toBe(1);
  });
});
