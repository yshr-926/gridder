import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { EditorDocument } from '@gridder/editor-core';
import { EditorSession } from './editorSession';
import { useEditShortcuts } from './useEditShortcuts';

/**
 * Process-wide editor session. The first release has one open sketch, so a
 * module singleton is enough; a future multi-document shell would put this in a
 * React context instead. Exposed on `window` in dev for Playwright.
 */
export const editorSession = new EditorSession();

// Exposed for tooling and the issue #42 Playwright workflow so the browser test
// can read document / history state. Restricted to dev builds and the Playwright
// build (VITE_E2E=true) so it is never present in a production bundle. Guarded
// for non-browser (SSR / test) contexts.
const isEditorDebugExposed =
  import.meta.env.DEV || import.meta.env.VITE_E2E === 'true';

if (isEditorDebugExposed && typeof window !== 'undefined') {
  (window as unknown as { __GRIDDER_EDITOR_SESSION__: EditorSession }).__GRIDDER_EDITOR_SESSION__ =
    editorSession;
}

/** Subscribe a component to the live document snapshot. */
export const useEditorDocument = (): EditorDocument =>
  useSyncExternalStore(editorSession.subscribe, editorSession.getDocument, editorSession.getDocument);

interface EditorHistoryControls {
  readonly undo: () => void;
  readonly redo: () => void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

/**
 * Undo / redo wired to the editor session. `canUndo` / `canRedo` re-read on
 * every document change because a mutation is what flips them.
 */
export const useEditorHistory = (): EditorHistoryControls => {
  useEditorDocument();
  useEditShortcuts();

  const undo = useCallback(() => {
    editorSession.undo();
  }, []);

  const redo = useCallback(() => {
    editorSession.redo();
  }, []);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean =>
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT');

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    undo,
    redo,
    canUndo: editorSession.canUndo,
    canRedo: editorSession.canRedo,
  };
};
