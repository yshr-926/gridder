import type { EditorShape } from '@gridder/editor-core';

/**
 * In-app clipboard for issue #51. The system clipboard is out of scope (spec
 * §7 asks only for copy / paste / duplicate within the app), so this is a
 * plain module-level slot holding the last copied shapes plus how many times
 * they have been pasted since. `pasteCount` drives the "shift by one more
 * cell" behaviour: the first paste offsets by one cell, the second by two,
 * and so on, until the next copy resets it.
 */

export interface ClipboardContents {
  readonly shapes: readonly EditorShape[];
  /** How many times this clipboard content has been pasted so far. */
  readonly pasteCount: number;
}

let clipboard: ClipboardContents | null = null;

/** Replace the clipboard with a snapshot of the given shapes. */
export const copyToClipboard = (shapes: readonly EditorShape[]): void => {
  if (shapes.length === 0) {
    return;
  }
  clipboard = { shapes: [...shapes], pasteCount: 0 };
};

/** Current clipboard contents, or `null` when nothing has been copied. */
export const readClipboard = (): ClipboardContents | null => clipboard;

/** Record that a paste happened, so the next one shifts one cell further. */
export const notePasted = (): void => {
  if (clipboard !== null) {
    clipboard = { ...clipboard, pasteCount: clipboard.pasteCount + 1 };
  }
};

/** Test-only reset so specs don't leak clipboard state between runs. */
export const clearClipboardForTests = (): void => {
  clipboard = null;
};
