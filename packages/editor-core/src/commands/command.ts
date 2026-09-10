import type { EditorDocument } from '../model.js';

/**
 * A document Command as defined by spec §11: every change to the sketch
 * document is expressed as a Command so it can be recorded, undone, and redone.
 *
 * This is unrelated to `apps/web/src/features/commands`, which parses textual
 * command-palette input. That module never touches the document history; this
 * one is the sole gateway for mutating {@link EditorDocument}.
 *
 * A Command is a pure value: `apply` derives a new document without mutating its
 * input, and `invert` — given the document as it was *before* `apply` — returns
 * the Command that restores exactly that state. The history stack pairs each
 * applied Command with its inverse so undo and redo never re-derive geometry.
 */
export interface EditorCommand {
  /** Stable discriminator, e.g. `'create-shape'`. Used for logging and tests. */
  readonly type: string;
  /** Short human-readable summary for menus and debugging. */
  readonly label: string;
  /** Return a new document with this Command applied. Must not mutate `document`. */
  apply(document: EditorDocument): EditorDocument;
  /**
   * Given the document *before* {@link apply} ran, return a Command that undoes
   * this one. Called once at record time; the result is stored for undo.
   */
  invert(documentBeforeApply: EditorDocument): EditorCommand;
}

/** Thrown when a Command is applied to a document it cannot act on. */
export class CommandApplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommandApplicationError';
  }
}
