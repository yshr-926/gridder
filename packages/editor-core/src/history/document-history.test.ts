import { describe, expect, it, vi } from 'vitest';

import {
  CURRENT_DOCUMENT_FORMAT_VERSION,
  type EditorDocument,
  type EditorShape,
} from '../model.js';
import {
  CreateShapeCommand,
  DeleteShapeCommand,
  RenameShapeCommand,
} from '../commands/index.js';
import { DocumentHistory } from './index.js';

const rectangle = (id: string, offsetX: number): EditorShape => ({
  id,
  polygon: {
    outerRing: [
      { x: offsetX, y: 0 },
      { x: offsetX + 4, y: 0 },
      { x: offsetX + 4, y: 3 },
      { x: offsetX, y: 3 },
    ],
    innerRings: [],
  },
  style: { fill: '#3b82f6', opacity: 1, isBorderVisible: true },
});

const baseDocument = (): EditorDocument => ({
  formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
  shapes: { 'shape-a': rectangle('shape-a', 0) },
  zOrder: ['shape-a'],
  groups: {},
  drawingBounds: { mode: 'auto', min: { x: 0, y: 0 }, max: { x: 4, y: 3 } },
});

describe('DocumentHistory', () => {
  it('test_dispatch_undo_redo_documentMatchesEachStep', () => {
    const start = baseDocument();
    const history = new DocumentHistory(start);
    const afterCreate = history.dispatch(
      new CreateShapeCommand(rectangle('shape-b', 6)),
    );

    expect(history.getDocument()).toBe(afterCreate);
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);

    expect(history.undo()).toEqual(start);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);

    expect(history.redo()).toEqual(afterCreate);
  });

  it('test_dispatch_afterUndo_clearsRedoStack', () => {
    const history = new DocumentHistory(baseDocument());
    history.dispatch(new CreateShapeCommand(rectangle('shape-b', 6)));
    history.undo();
    history.dispatch(new CreateShapeCommand(rectangle('shape-c', 12)));
    expect(history.canRedo).toBe(false);
  });

  it('test_undo_onEmptyStack_returnsCurrentDocument', () => {
    const start = baseDocument();
    const history = new DocumentHistory(start);
    expect(history.undo()).toBe(start);
    expect(history.redo()).toBe(start);
  });

  it('test_limit_discardsOldestUndoableEntries', () => {
    const history = new DocumentHistory(baseDocument(), { limit: 2 });
    history.dispatch(new CreateShapeCommand(rectangle('shape-b', 6)));
    history.dispatch(new CreateShapeCommand(rectangle('shape-c', 12)));
    history.dispatch(new CreateShapeCommand(rectangle('shape-d', 18)));

    expect(history.undoDepth).toBe(2);
    history.undo();
    history.undo();
    expect(history.canUndo).toBe(false);
    // shape-b was created by the discarded entry and stays in the document.
    expect(history.getDocument().shapes['shape-b']).toBeDefined();
    expect(history.getDocument().shapes['shape-c']).toBeUndefined();
  });

  it('test_limit_nonPositiveInteger_throws', () => {
    expect(() => new DocumentHistory(baseDocument(), { limit: 0 })).toThrow();
    expect(() => new DocumentHistory(baseDocument(), { limit: 1.5 })).toThrow();
  });

  it('test_clear_dropsHistoryButKeepsDocument', () => {
    const history = new DocumentHistory(baseDocument());
    const afterCreate = history.dispatch(
      new CreateShapeCommand(rectangle('shape-b', 6)),
    );
    history.clear();
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.getDocument()).toBe(afterCreate);
  });

  it('test_reset_replacesDocumentAndClearsHistory', () => {
    const history = new DocumentHistory(baseDocument());
    history.dispatch(new CreateShapeCommand(rectangle('shape-b', 6)));
    const loaded = baseDocument();
    expect(history.reset(loaded)).toBe(loaded);
    expect(history.canUndo).toBe(false);
  });

  it('test_subscribe_notifiesOnEveryChange_andUnsubscribeStops', () => {
    const history = new DocumentHistory(baseDocument());
    const listener = vi.fn();
    const unsubscribe = history.subscribe(listener);

    history.dispatch(new RenameShapeCommand('shape-a', 'Table'));
    history.undo();
    history.redo();
    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener).toHaveBeenLastCalledWith(history.getDocument());

    unsubscribe();
    history.dispatch(new RenameShapeCommand('shape-a', 'Desk'));
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('test_subscribe_hasNoReactDependency_plainCallback', () => {
    const history = new DocumentHistory(baseDocument());
    let received: EditorDocument | undefined;
    history.subscribe((document) => {
      received = document;
    });
    const next = history.dispatch(new DeleteShapeCommand('shape-a'));
    expect(received).toBe(next);
  });
});
