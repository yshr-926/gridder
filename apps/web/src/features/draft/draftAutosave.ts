import { serializeDocument } from '@gridder/editor-core';
import { editorSession } from '@/features/editor';
import type { DraftStorageAdapter } from './types';

/** Debounce window between the last document change and the draft write (issue #55). */
const AUTOSAVE_DEBOUNCE_MS = 2000;

/**
 * Starts writing the current document to `storage` a debounce window after
 * every change (issue #55, spec §9 crash-recovery draft). Subscribes
 * directly to {@link EditorSession} — the same mechanism `dirtyTracking.ts`
 * (issue #54) uses — rather than through any React state, so it keeps
 * running independent of which components are mounted.
 *
 * Returns a stop function that cancels any pending write and unsubscribes;
 * call it once, from the component that starts the autosave (mirroring how
 * `useBeforeUnload` / `dirtyTracking` are wired), typically for the whole
 * lifetime of the app so there is normally no need to call it.
 */
export const startDraftAutosave = (
  storage: DraftStorageAdapter,
  debounceMs = AUTOSAVE_DEBOUNCE_MS
): (() => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const scheduleSave = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;
      const content = serializeDocument(editorSession.getDocument());
      void storage.save(content);
    }, debounceMs);
  };

  const unsubscribe = editorSession.subscribe(scheduleSave);

  return () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    unsubscribe();
  };
};
