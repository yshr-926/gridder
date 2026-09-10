import { useMemo, useState } from 'react';
import { isDirty } from './dirtyTracking';
import { openSketchFile, saveSketch, saveSketchAs, startNewSketch } from './fileSession';
import { selectFileAdapter } from './selectFileAdapter';
import type { FileAdapter } from './types';

export type PendingConfirmAction = 'new' | 'open' | null;

export interface FileMenuControls {
  /** Which destructive action is waiting on the confirmation dialog, or `null` when it's closed. */
  readonly pendingConfirmAction: PendingConfirmAction;
  /** Start a new sketch, asking for confirmation first only if the current one is unsaved. */
  requestNew: () => void;
  /** Open a file, asking for confirmation first only if the current sketch is unsaved. */
  requestOpen: () => void;
  /** User confirmed discarding unsaved changes: proceed with the pending action. */
  confirmDiscard: () => void;
  /** User backed out of the confirmation dialog. */
  cancelDiscard: () => void;
  /** Save, overwriting the associated file where the platform supports it. */
  save: () => void;
  /** Always prompt for a destination. */
  saveAs: () => void;
}

/**
 * Wires the Header's ファイル (File) menu to `fileSession.ts` (issue #54,
 * spec §9 / §12). Owns exactly one piece of state — which confirmation, if
 * any, is pending — so a single {@link ConfirmDialog} instance in the Header
 * can represent both "discard and start new" and "discard and open".
 *
 * One adapter instance lives for the component's lifetime so a File System
 * Access handle acquired by an `open` survives into later `save` calls.
 */
export const useFileMenu = (): FileMenuControls => {
  const adapter = useMemo<FileAdapter>(() => selectFileAdapter(), []);
  const [pendingConfirmAction, setPendingConfirmAction] = useState<PendingConfirmAction>(null);

  const requestNew = (): void => {
    if (isDirty()) {
      setPendingConfirmAction('new');
      return;
    }
    startNewSketch(adapter);
  };

  const requestOpen = (): void => {
    if (isDirty()) {
      setPendingConfirmAction('open');
      return;
    }
    void openSketchFile(adapter);
  };

  const confirmDiscard = (): void => {
    const action = pendingConfirmAction;
    setPendingConfirmAction(null);
    if (action === 'new') {
      startNewSketch(adapter);
    } else if (action === 'open') {
      void openSketchFile(adapter);
    }
  };

  const cancelDiscard = (): void => {
    setPendingConfirmAction(null);
  };

  const save = (): void => {
    void saveSketch(adapter);
  };

  const saveAs = (): void => {
    void saveSketchAs(adapter);
  };

  return {
    pendingConfirmAction,
    requestNew,
    requestOpen,
    confirmDiscard,
    cancelDiscard,
    save,
    saveAs,
  };
};
