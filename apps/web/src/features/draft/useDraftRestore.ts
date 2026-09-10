import { useEffect, useMemo, useState } from 'react';
import { deserializeDocument } from '@gridder/editor-core';
import { editorSession } from '@/features/editor';
import { markDirty } from '@/features/file';
import { clearCleanExitFlag, wasCleanExit } from './cleanExitFlag';
import { selectDraftStorage } from './selectDraftStorage';
import type { DraftStorageAdapter } from './types';

export interface DraftRestoreControls {
  /** Whether the confirmation dialog should be shown right now. */
  readonly isPromptOpen: boolean;
  /** User chose to load the draft into the document. */
  restore: () => void;
  /** User chose to keep the current (empty) document and discard the draft. */
  discard: () => void;
}

/**
 * Checks, once at startup, whether a crash-recovery draft should be offered
 * (issue #55, spec §9: "正常終了後の通常起動ではドラフトを自動的に開かない。異常終了後
 * だけ復元するか確認する"). Clearing the clean-exit flag happens unconditionally
 * and immediately, before the async draft lookup even starts, so a session
 * that itself crashes before this check finishes is still correctly seen as
 * unclean on the *next* launch (see `cleanExitFlag.ts`).
 *
 * Only prompts when both hold: the previous session did not exit cleanly,
 * and a draft actually exists (a clean-but-empty IndexedDB store never
 * prompts). The dialog stays open until `restore` or `discard` is called;
 * both remove the draft — `restore` because the document itself becomes the
 * source of truth from here on, `discard` because the user explicitly said
 * not to keep it — so this only ever prompts once per crash.
 */
export const useDraftRestore = (): DraftRestoreControls => {
  const storage = useMemo<DraftStorageAdapter>(() => selectDraftStorage(), []);
  const [isPromptOpen, setIsPromptOpen] = useState(false);

  useEffect(() => {
    const wasClean = wasCleanExit();
    clearCleanExitFlag();
    if (wasClean) {
      return;
    }

    let cancelled = false;
    void storage.load().then((content) => {
      if (!cancelled && content !== null) {
        setIsPromptOpen(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  const restore = (): void => {
    setIsPromptOpen(false);
    void storage.load().then((content) => {
      if (content === null) {
        return;
      }
      let document;
      try {
        document = deserializeDocument(content);
      } catch {
        // A draft that fails to parse or validate can't be restored; treat
        // it the same as discarding rather than surfacing a broken document.
        void storage.clear();
        return;
      }
      editorSession.reset(document);
      markDirty();
      void storage.clear();
    });
  };

  const discard = (): void => {
    setIsPromptOpen(false);
    void storage.clear();
  };

  return { isPromptOpen, restore, discard };
};
