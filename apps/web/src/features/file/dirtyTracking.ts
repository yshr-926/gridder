import { create } from 'zustand';
import { editorSession } from '@/features/editor';

/**
 * Unsaved-changes tracking for issue #54 (spec §9: confirm before a new
 * sketch, opening a file, or leaving the page while unsaved changes exist).
 *
 * Built entirely from outside {@link EditorSession} by subscribing to it and
 * comparing `editorSession.undoDepth` against the depth recorded at the last
 * save — the only surface `EditorSession` had to grow for this (issue #47's
 * later comment on this task) is that `undoDepth` getter. A Command dispatch
 * always changes `undoDepth` (it grows by exactly one), and `undo`/`redo`
 * move it up or down; equality with the saved depth is a precise proxy for
 * "the document matches what's on disk", cheaper than deep-equality and
 * correct even though it doesn't survive a save happening mid-undo-stack
 * (Gridder has no such flow: saving does not truncate history).
 */
interface DirtyState {
  readonly isDirty: boolean;
}

const useDirtyStore = create<DirtyState>(() => ({ isDirty: false }));

/** Depth recorded at the last successful save, or `null` before the first one. */
let savedAtDepth: number | null = null;

const recompute = (): void => {
  const isDirty = savedAtDepth === null || editorSession.undoDepth !== savedAtDepth;
  if (useDirtyStore.getState().isDirty !== isDirty) {
    useDirtyStore.setState({ isDirty });
  }
};

// A fresh, never-saved sketch with no edits yet is not "dirty" — there is
// nothing to lose. `recompute` only starts reporting dirty once a Command
// has been dispatched or a save has happened, both of which call it again.
savedAtDepth = editorSession.undoDepth;
editorSession.subscribe(recompute);

/** Call after a successful save (or a fresh/loaded document) to mark the current history position clean. */
export const markSaved = (): void => {
  savedAtDepth = editorSession.undoDepth;
  recompute();
};

/**
 * Force the document to read as dirty regardless of its current
 * `undoDepth` (issue #55: a restored crash-recovery draft is unsaved by
 * definition, but `editorSession.reset` clears history back to depth 0 —
 * the same depth a fresh, never-edited session starts at — so comparing
 * depths alone can't tell the two apart). Setting `savedAtDepth` to a value
 * `undoDepth` can never equal keeps `recompute` reporting dirty until the
 * next real save, without needing a sentinel `isDirty` flag of its own.
 */
export const markDirty = (): void => {
  savedAtDepth = editorSession.undoDepth - 1;
  recompute();
};

/** Subscribe a component to whether the document has unsaved changes. */
export const useIsDirty = (): boolean => useDirtyStore((state) => state.isDirty);

/** Non-reactive read for use outside React (e.g. a `beforeunload` handler). */
export const isDirty = (): boolean => useDirtyStore.getState().isDirty;

/** Test-only reset so each test file starts from a clean slate against the shared `editorSession` singleton. */
export const resetDirtyTrackingForTests = (): void => {
  savedAtDepth = editorSession.undoDepth;
  useDirtyStore.setState({ isDirty: false });
};
