import type { EditorDocument } from '../model.js';
import type { EditorCommand } from './command.js';

/**
 * Runs several Commands as one history entry (spec §11): a multi-shape move
 * that translates every selected shape, or a delete that first dissolves an
 * under-sized group, records a single undo step. `apply` runs the children in order; `invert` runs their
 * inverses in reverse, each computed against the intermediate document so the
 * round-trip is exact.
 */
export class CompositeCommand implements EditorCommand {
  readonly type = 'composite';
  readonly label: string;
  private readonly commands: readonly EditorCommand[];

  constructor(commands: readonly EditorCommand[], label = 'Multiple changes') {
    if (commands.length === 0) {
      throw new Error('A composite Command needs at least one child Command.');
    }
    this.commands = [...commands];
    this.label = label;
  }

  apply(document: EditorDocument): EditorDocument {
    return this.commands.reduce((current, command) => command.apply(current), document);
  }

  invert(documentBeforeApply: EditorDocument): EditorCommand {
    const inverses: EditorCommand[] = [];
    let current = documentBeforeApply;
    for (const command of this.commands) {
      inverses.push(command.invert(current));
      current = command.apply(current);
    }
    inverses.reverse();
    return new CompositeCommand(inverses, `Undo ${this.label}`);
  }
}
