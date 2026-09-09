import { DocumentDeserializationError, deserializeDocument, serializeDocument } from '@gridder/editor-core';
import { createEmptyDocument, editorSession } from '@/features/editor';
import { useToastStore } from '@/hooks/useToast';
import { markSaved } from './dirtyTracking';
import { DEFAULT_SKETCH_FILENAME, type FileAdapter } from './types';

/**
 * Orchestrates new / open / save / save-as against a {@link FileAdapter}
 * (issue #54, spec §9). Every function here assumes any "discard unsaved
 * changes?" confirmation the caller needed has already happened — that lives
 * in `useFileMenu`, which is also the thing deciding *when* to ask. This
 * module only knows how to actually perform the operation once confirmed:
 * dispatch to the adapter, update the document / dirty tracking, and show
 * the resulting Toast.
 *
 * Toast calls go through `useToastStore.getState().addToast` rather than the
 * `useToast` hook because these are plain async functions, not components —
 * there is no hook context here to call into.
 */

const showToast = (type: 'success' | 'error', message: string): void => {
  useToastStore.getState().addToast({ type, message });
};

/** Start a brand-new empty sketch, discarding the in-memory document and its history. */
export const startNewSketch = (): void => {
  editorSession.reset(createEmptyDocument());
  markSaved();
};

/**
 * Open a sketch file through `adapter`. Resolves to `true` if a file was
 * loaded, `false` if the user cancelled the picker. Rejects (and shows an
 * error Toast) if the file could not be parsed or failed validation.
 */
export const openSketchFile = async (adapter: FileAdapter): Promise<boolean> => {
  let result;
  try {
    result = await adapter.open();
  } catch (error) {
    showToast('error', openErrorMessage(error));
    throw error;
  }
  if (result === null) {
    return false;
  }

  let document;
  try {
    document = deserializeDocument(result.content);
  } catch (error) {
    showToast('error', openErrorMessage(error));
    throw error;
  }

  editorSession.reset(document);
  markSaved();
  showToast('success', `"${result.fileName}" を開きました`);
  return true;
};

/**
 * Save the current document through `adapter`, overwriting the associated
 * file when one exists (Chromium) or downloading a new one otherwise.
 * Resolves to `true` if the save completed, `false` if the user cancelled a
 * picker that was needed.
 */
export const saveSketch = async (adapter: FileAdapter): Promise<boolean> => {
  const content = serializeDocument(editorSession.getDocument());
  const result = await adapter.save(content, DEFAULT_SKETCH_FILENAME);
  if (result === null) {
    return false;
  }
  markSaved();
  showToast('success', `"${result.fileName}" に保存しました`);
  return true;
};

/** Like {@link saveSketch}, but always prompts for a destination (spec §12 "名前を付けて保存"). */
export const saveSketchAs = async (adapter: FileAdapter): Promise<boolean> => {
  const content = serializeDocument(editorSession.getDocument());
  const result = await adapter.saveAs(content, DEFAULT_SKETCH_FILENAME);
  if (result === null) {
    return false;
  }
  markSaved();
  showToast('success', `"${result.fileName}" に保存しました`);
  return true;
};

const openErrorMessage = (error: unknown): string => {
  if (error instanceof DocumentDeserializationError) {
    if (error.code === 'unsupported-format-version') {
      return 'このファイルは古い形式の Gridder スケッチのため開けません。';
    }
    return 'ファイルを読み込めませんでした。Gridder のスケッチファイルではない可能性があります。';
  }
  return 'ファイルを開けませんでした。';
};
