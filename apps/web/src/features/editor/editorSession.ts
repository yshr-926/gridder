import {
  DocumentHistory,
  type EditorCommand,
  type EditorDocument,
  type Unsubscribe,
} from '@gridder/editor-core';
import { createEmptyDocument } from './document';

/**
 * The app's single connection point to the editor-core document (issue #42).
 *
 * `EditorSession` owns a {@link DocumentHistory} — the canonical document plus
 * its confirmed undo / redo stacks — and exposes exactly the operations the UI
 * needs. React subscribes through {@link subscribe} / {@link getDocument}, which
 * are shaped for `useSyncExternalStore`. Every mutation goes through
 * {@link dispatch} so it lands on the history as one Command; drag previews must
 * be coalesced by the caller before they get here.
 */
export class EditorSession {
  private readonly history: DocumentHistory;
  private readonly listeners = new Set<() => void>();
  private cachedDocument: EditorDocument;

  constructor(initialDocument: EditorDocument = createEmptyDocument()) {
    this.history = new DocumentHistory(initialDocument);
    this.cachedDocument = this.history.getDocument();
    this.history.subscribe((document) => {
      this.cachedDocument = document;
      for (const listener of [...this.listeners]) {
        listener();
      }
    });
  }

  /** Current immutable document snapshot. Stable between mutations. */
  getDocument = (): EditorDocument => this.cachedDocument;

  /** Register a change listener; returns an unsubscribe. */
  subscribe = (listener: () => void): Unsubscribe => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Apply a Command and record it. Returns the resulting snapshot. */
  dispatch = (command: EditorCommand): EditorDocument => this.history.dispatch(command);

  undo = (): EditorDocument => this.history.undo();
  redo = (): EditorDocument => this.history.redo();

  get canUndo(): boolean {
    return this.history.canUndo;
  }

  get canRedo(): boolean {
    return this.history.canRedo;
  }

  /** Number of shapes currently in the document. */
  get shapeCount(): number {
    return this.cachedDocument.zOrder.length;
  }
}
