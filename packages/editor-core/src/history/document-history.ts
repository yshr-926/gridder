import type { EditorDocument } from '../model.js';
import type { EditorCommand } from '../commands/command.js';

/** Notified after any change to the current document. */
export type DocumentHistoryListener = (document: EditorDocument) => void;
/** Call to stop receiving notifications. Safe to call more than once. */
export type Unsubscribe = () => void;

export interface DocumentHistoryOptions {
  /**
   * Maximum number of undoable entries kept. When exceeded, the oldest entries
   * are discarded (they can no longer be undone). Must be a positive integer.
   * Defaults to 100.
   */
  readonly limit?: number;
}

interface HistoryEntry {
  readonly command: EditorCommand;
  readonly inverse: EditorCommand;
}

const DEFAULT_LIMIT = 100;

/**
 * Holds the canonical {@link EditorDocument} and its confirmed undo / redo
 * stacks (spec §11, target architecture "履歴状態"). The viewport lives in the
 * app layer, never here, and the history is not serialized to JSON.
 *
 * `subscribe` is a plain callback registry with no React dependency; the app
 * layer adapts it to `useSyncExternalStore` or a Zustand store.
 */
export class DocumentHistory {
  private current: EditorDocument;
  private readonly undoStack: HistoryEntry[] = [];
  private readonly redoStack: HistoryEntry[] = [];
  private readonly limit: number;
  private readonly listeners = new Set<DocumentHistoryListener>();

  constructor(initialDocument: EditorDocument, options: DocumentHistoryOptions = {}) {
    const limit = options.limit ?? DEFAULT_LIMIT;
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error('DocumentHistory limit must be a positive integer.');
    }
    this.current = initialDocument;
    this.limit = limit;
  }

  /** The current document snapshot. */
  getDocument(): EditorDocument {
    return this.current;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Number of entries currently on the undo stack. */
  get undoDepth(): number {
    return this.undoStack.length;
  }

  /**
   * Apply a confirmed Command, push it onto the undo stack, and clear the redo
   * stack. Drag-in-progress updates must be coalesced by the caller into one
   * Command before reaching here.
   */
  dispatch(command: EditorCommand): EditorDocument {
    const before = this.current;
    const next = command.apply(before);
    const inverse = command.invert(before);
    this.undoStack.push({ command, inverse });
    if (this.undoStack.length > this.limit) {
      this.undoStack.splice(0, this.undoStack.length - this.limit);
    }
    this.redoStack.length = 0;
    return this.commit(next);
  }

  /** Undo the most recent Command. No-op (returns current) when the stack is empty. */
  undo(): EditorDocument {
    const entry = this.undoStack.pop();
    if (entry === undefined) {
      return this.current;
    }
    const next = entry.inverse.apply(this.current);
    this.redoStack.push(entry);
    return this.commit(next);
  }

  /** Redo the most recently undone Command. No-op when the redo stack is empty. */
  redo(): EditorDocument {
    const entry = this.redoStack.pop();
    if (entry === undefined) {
      return this.current;
    }
    const next = entry.command.apply(this.current);
    this.undoStack.push(entry);
    return this.commit(next);
  }

  /**
   * Drop all history without touching the current document. Used when loading a
   * new sketch: the freshly loaded document has nothing to undo back to.
   */
  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  /**
   * Replace the current document and drop all history. Used when loading a
   * saved file. Notifies subscribers.
   */
  reset(document: EditorDocument): EditorDocument {
    this.clear();
    return this.commit(document);
  }

  /**
   * Register a listener called after every document change (dispatch, undo,
   * redo, reset). Returns an unsubscribe function.
   */
  subscribe(listener: DocumentHistoryListener): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private commit(document: EditorDocument): EditorDocument {
    this.current = document;
    for (const listener of [...this.listeners]) {
      listener(document);
    }
    return document;
  }
}
