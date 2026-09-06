import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateShapeCommand, serializeDocument, type EditorShape } from '@gridder/editor-core';
import { createEmptyDocument, editorSession } from '@/features/editor';
import { useToastStore } from '@/hooks/useToast';
import { isDirty, resetDirtyTrackingForTests } from './dirtyTracking';
import { openSketchFile, saveSketch, saveSketchAs, startNewSketch } from './fileSession';
import type { FileAdapter, OpenResult } from './types';

/**
 * `FileAdapter` is exercised here through a hand-built mock rather than
 * either real implementation (issue #54's "両 Adapter の差し替えテスト" is
 * `fileSystemAccessAdapter.test.ts` / `downloadFallbackAdapter.test.ts`) —
 * this file checks that `fileSession.ts` orchestrates *any* adapter
 * correctly: what it hands the adapter, what it does with the result, and
 * that the document / dirty state / Toast all end up right.
 */

const rectShape = (id: string): EditorShape => ({
  id,
  polygon: {
    outerRing: [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 2 },
      { x: 0, y: 2 },
    ],
    innerRings: [],
  },
  style: { fill: '#3b82f6', opacity: 0.8, isBorderVisible: true },
});

const mockAdapter = (overrides: Partial<FileAdapter> = {}): FileAdapter => ({
  hasAssociatedFile: false,
  save: vi.fn(async () => null),
  saveAs: vi.fn(async () => null),
  open: vi.fn(async () => null),
  ...overrides,
});

const reset = () => {
  act(() => {
    while (editorSession.canUndo) {
      editorSession.undo();
    }
    resetDirtyTrackingForTests();
    useToastStore.getState().clearToasts();
  });
};

describe('fileSession', () => {
  beforeEach(reset);
  afterEach(reset);

  describe('startNewSketch', () => {
    it('test_startNewSketch_resetsToEmptyDocument_andMarksSaved', () => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));

      startNewSketch();

      expect(editorSession.getDocument()).toEqual(createEmptyDocument());
      expect(editorSession.canUndo).toBe(false);
      expect(isDirty()).toBe(false);
    });
  });

  describe('saveSketch', () => {
    it('test_saveSketch_passesSerializedDocumentToAdapter_andMarksSaved', async () => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
      const save = vi.fn<FileAdapter['save']>(async () => ({ fileName: 'sketch.json' }));
      const adapter = mockAdapter({ save });

      const result = await saveSketch(adapter);

      expect(result).toBe(true);
      expect(save).toHaveBeenCalledWith(serializeDocument(editorSession.getDocument()), 'sketch');
      expect(isDirty()).toBe(false);
      expect(useToastStore.getState().toasts).toHaveLength(1);
      expect(useToastStore.getState().toasts[0]).toMatchObject({
        type: 'success',
        message: '"sketch.json" に保存しました',
      });
    });

    it('test_saveSketch_userCancelsPicker_resolvesFalse_andStaysDirty', async () => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
      const adapter = mockAdapter({ save: vi.fn(async () => null) });

      const result = await saveSketch(adapter);

      expect(result).toBe(false);
      expect(isDirty()).toBe(true);
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });
  });

  describe('saveSketchAs', () => {
    it('test_saveSketchAs_delegatesToAdapterSaveAs_notSave', async () => {
      const save = vi.fn<FileAdapter['save']>(async () => ({ fileName: 'should-not-be-used.json' }));
      const saveAs = vi.fn<FileAdapter['saveAs']>(async () => ({ fileName: 'renamed.json' }));
      const adapter = mockAdapter({ save, saveAs });

      const result = await saveSketchAs(adapter);

      expect(result).toBe(true);
      expect(saveAs).toHaveBeenCalledTimes(1);
      expect(save).not.toHaveBeenCalled();
      expect(useToastStore.getState().toasts[0]?.message).toBe('"renamed.json" に保存しました');
    });
  });

  describe('openSketchFile', () => {
    it('test_openSketchFile_validDocument_replacesDocument_andMarksSaved', async () => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('existing')));
      const loaded = { ...createEmptyDocument(), shapes: {}, zOrder: [] };
      const openResult: OpenResult = {
        fileName: 'loaded.json',
        content: serializeDocument(loaded),
      };
      const adapter = mockAdapter({ open: vi.fn(async () => openResult) });

      const result = await openSketchFile(adapter);

      expect(result).toBe(true);
      expect(editorSession.getDocument()).toEqual(loaded);
      expect(editorSession.canUndo).toBe(false);
      expect(isDirty()).toBe(false);
      expect(useToastStore.getState().toasts[0]).toMatchObject({
        type: 'success',
        message: '"loaded.json" を開きました',
      });
    });

    it('test_openSketchFile_userCancelsPicker_resolvesFalse_leavesDocumentUnchanged', async () => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
      const before = editorSession.getDocument();
      const adapter = mockAdapter({ open: vi.fn(async () => null) });

      const result = await openSketchFile(adapter);

      expect(result).toBe(false);
      expect(editorSession.getDocument()).toBe(before);
    });

    it('test_openSketchFile_invalidJson_throws_showsErrorToast_leavesDocumentUnchanged', async () => {
      editorSession.dispatch(new CreateShapeCommand(rectShape('a')));
      const before = editorSession.getDocument();
      const openResult: OpenResult = { fileName: 'broken.json', content: '{not json' };
      const adapter = mockAdapter({ open: vi.fn(async () => openResult) });

      await expect(openSketchFile(adapter)).rejects.toThrow();

      expect(editorSession.getDocument()).toBe(before);
      expect(useToastStore.getState().toasts[0]?.type).toBe('error');
    });

    it('test_openSketchFile_adapterThrows_propagates_showsErrorToast', async () => {
      const adapter = mockAdapter({
        open: vi.fn(async () => {
          throw new Error('boom');
        }),
      });

      await expect(openSketchFile(adapter)).rejects.toThrow('boom');
      expect(useToastStore.getState().toasts[0]?.type).toBe('error');
    });
  });
});
