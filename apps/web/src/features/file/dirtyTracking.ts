import { create } from 'zustand';
import type { EditorDocument } from '@gridder/editor-core';
import { editorSession } from '@/features/editor';

/**
 * Unsaved-changes tracking for issue #54 (spec §9: confirm before a new
 * sketch, opening a file, or leaving the page while unsaved changes exist).
 *
 * Built entirely from outside {@link EditorSession} by subscribing to it and
 * comparing the current document against the one last written to disk. The
 * comparison is on content, not on history position: the document is immutable,
 * so an unchanged reference settles it immediately, and only when the reference
 * differs is the structure compared — which also makes an undo back to exactly
 * the saved state read as clean again.
 *
 * That comparison ignores the order of record keys. `shapes` and `groups` are
 * keyed lookups, not sequences — the visible order lives in `zOrder` — and a
 * delete followed by an undo re-inserts the shape's key at the end. Comparing
 * serialized JSON, as this once did, would call that identical document
 * modified.
 *
 * Comparing `undoDepth` instead, as this originally did, mistakes different
 * documents for the same one whenever they sit at the same depth: create, save,
 * undo, create something else lands back on the saved depth with a different
 * document, and once the 100-entry history limit stops the depth growing, every
 * later edit looks saved. Depth counts steps; only the content says what is on
 * disk.
 */
interface DirtyState {
  readonly isDirty: boolean;
}

const useDirtyStore = create<DirtyState>(() => ({ isDirty: false }));

/**
 * Structural equality that treats plain objects as unordered maps. Arrays stay
 * order-sensitive: `zOrder` and a polygon's rings are sequences, where order is
 * the meaning.
 */
const isDeepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) {
    return true;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => isDeepEqual(item, b[index]));
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord);
  if (aKeys.length !== Object.keys(bRecord).length) {
    return false;
  }
  return aKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(bRecord, key) && isDeepEqual(aRecord[key], bRecord[key])
  );
};

/** The document version last written to disk, or `null` before the first save. */
let savedDocument: EditorDocument | null = null;

const recompute = (): void => {
  const isDirty =
    savedDocument === null || !isDeepEqual(editorSession.getDocument(), savedDocument);

  if (useDirtyStore.getState().isDirty !== isDirty) {
    useDirtyStore.setState({ isDirty });
  }
};

const rememberSaved = (document: EditorDocument): void => {
  savedDocument = document;
};

// A fresh, never-saved sketch with no edits yet is not "dirty" — there is
// nothing to lose. `recompute` only starts reporting dirty once a Command
// has been dispatched or a save has happened, both of which call it again.
rememberSaved(editorSession.getDocument());
editorSession.subscribe(recompute);

/**
 * Call after a successful save (or a fresh / loaded document) to record a
 * document version as the one on disk.
 *
 * `document` defaults to whatever is current, which is right for a load or a
 * new sketch. A save must pass the version it actually serialized: writing is
 * asynchronous, and edits made while it was in flight are not in the file, so
 * marking the *current* document saved would hide them from the
 * unsaved-changes prompt.
 */
export const markSaved = (document: EditorDocument = editorSession.getDocument()): void => {
  rememberSaved(document);
  recompute();
};

/**
 * Force the document to read as dirty regardless of its content (issue #55: a
 * restored crash-recovery draft is unsaved by definition, but it arrives
 * through `editorSession.reset` the same way a freshly loaded file would).
 * Forgetting the saved version keeps `recompute` reporting dirty until the
 * next real save, without needing a sentinel `isDirty` flag of its own.
 */
export const markDirty = (): void => {
  savedDocument = null;
  recompute();
};

/** Subscribe a component to whether the document has unsaved changes. */
export const useIsDirty = (): boolean => useDirtyStore((state) => state.isDirty);

/** Non-reactive read for use outside React (e.g. a `beforeunload` handler). */
export const isDirty = (): boolean => useDirtyStore.getState().isDirty;

/** Test-only reset so each test file starts from a clean slate against the shared `editorSession` singleton. */
export const resetDirtyTrackingForTests = (): void => {
  rememberSaved(editorSession.getDocument());
  useDirtyStore.setState({ isDirty: false });
};
