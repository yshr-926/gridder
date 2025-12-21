import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useCanvasStore } from './canvasStore';
import type { GridObject, CellCoordinate } from '@/types';
import { colorPaletteManager } from '@/utils/colorPalette';

/**
 * テスト用ヘルパー: オブジェクトを作成
 */
const createTestObject = (
  id: string,
  position: { x: number; y: number } = { x: 0, y: 0 },
  cells: CellCoordinate[] = [[0, 0]]
): GridObject => ({
  id,
  cells,
  position,
  rotation: 0,
  color: '#3b82f6',
});

describe('canvasStore', () => {
  beforeEach(() => {
    // ストアをリセット
    const store = useCanvasStore.getState();
    store.clearObjects();
    colorPaletteManager.reset();
  });

  describe('selection state', () => {
    it('should have initial empty selection state', () => {
      const state = useCanvasStore.getState();

      expect(state.selection).toEqual({
        selectedIds: [],
        primaryId: null,
        mode: 'single',
      });
      expect(state.selectedObjectId).toBeNull();
    });
  });

  describe('selectObject', () => {
    it('should select a single object', () => {
      const store = useCanvasStore.getState();
      const obj = createTestObject('obj-1');

      act(() => {
        store.addObject(obj);
        store.selectObject('obj-1');
      });

      const state = useCanvasStore.getState();
      expect(state.selection.selectedIds).toEqual(['obj-1']);
      expect(state.selection.primaryId).toBe('obj-1');
      expect(state.selection.mode).toBe('single');
      expect(state.selectedObjectId).toBe('obj-1');
    });

    it('should clear selection when selecting null', () => {
      const store = useCanvasStore.getState();
      const obj = createTestObject('obj-1');

      act(() => {
        store.addObject(obj);
        store.selectObject('obj-1');
        store.selectObject(null);
      });

      const state = useCanvasStore.getState();
      expect(state.selection.selectedIds).toEqual([]);
      expect(state.selection.primaryId).toBeNull();
      expect(state.selectedObjectId).toBeNull();
    });

    it('should replace selection with normal click', () => {
      const store = useCanvasStore.getState();

      act(() => {
        store.addObject(createTestObject('obj-1'));
        store.addObject(createTestObject('obj-2'));
        store.selectObject('obj-1');
        store.selectObject('obj-2'); // Normal click, should replace
      });

      const state = useCanvasStore.getState();
      expect(state.selection.selectedIds).toEqual(['obj-2']);
      expect(state.selection.primaryId).toBe('obj-2');
    });

    it('should add to selection with additive=true (Shift+click)', () => {
      const store = useCanvasStore.getState();

      act(() => {
        store.addObject(createTestObject('obj-1'));
        store.addObject(createTestObject('obj-2'));
        store.selectObject('obj-1');
        store.selectObject('obj-2', true); // Shift+click, should add
      });

      const state = useCanvasStore.getState();
      expect(state.selection.selectedIds).toEqual(['obj-1', 'obj-2']);
      expect(state.selection.primaryId).toBe('obj-2');
      expect(state.selection.mode).toBe('multiple');
    });

    it('should remove from selection with additive=true on already selected object', () => {
      const store = useCanvasStore.getState();

      act(() => {
        store.addObject(createTestObject('obj-1'));
        store.addObject(createTestObject('obj-2'));
        store.selectObject('obj-1');
        store.selectObject('obj-2', true); // Add obj-2
        store.selectObject('obj-1', true); // Remove obj-1
      });

      const state = useCanvasStore.getState();
      expect(state.selection.selectedIds).toEqual(['obj-2']);
      expect(state.selection.primaryId).toBe('obj-1'); // Still points to toggled object
    });
  });

  describe('selectObjects', () => {
    it('should select multiple objects at once', () => {
      const store = useCanvasStore.getState();

      act(() => {
        store.addObject(createTestObject('obj-1'));
        store.addObject(createTestObject('obj-2'));
        store.addObject(createTestObject('obj-3'));
        store.selectObjects(['obj-1', 'obj-2', 'obj-3']);
      });

      const state = useCanvasStore.getState();
      expect(state.selection.selectedIds).toEqual(['obj-1', 'obj-2', 'obj-3']);
      expect(state.selection.primaryId).toBe('obj-1');
      expect(state.selection.mode).toBe('multiple');
    });

    it('should set mode to single when selecting one object', () => {
      const store = useCanvasStore.getState();

      act(() => {
        store.addObject(createTestObject('obj-1'));
        store.selectObjects(['obj-1']);
      });

      const state = useCanvasStore.getState();
      expect(state.selection.mode).toBe('single');
    });

    it('should handle empty array', () => {
      const store = useCanvasStore.getState();

      act(() => {
        store.selectObjects([]);
      });

      const state = useCanvasStore.getState();
      expect(state.selection.selectedIds).toEqual([]);
      expect(state.selection.primaryId).toBeNull();
    });
  });

  describe('toggleSelection', () => {
    it('should add object to selection if not selected', () => {
      const store = useCanvasStore.getState();

      act(() => {
        store.addObject(createTestObject('obj-1'));
        store.addObject(createTestObject('obj-2'));
        store.selectObject('obj-1');
        store.toggleSelection('obj-2');
      });

      const state = useCanvasStore.getState();
      expect(state.selection.selectedIds).toContain('obj-1');
      expect(state.selection.selectedIds).toContain('obj-2');
    });

    it('should remove object from selection if already selected', () => {
      const store = useCanvasStore.getState();

      act(() => {
        store.addObject(createTestObject('obj-1'));
        store.addObject(createTestObject('obj-2'));
        store.selectObjects(['obj-1', 'obj-2']);
        store.toggleSelection('obj-1');
      });

      const state = useCanvasStore.getState();
      expect(state.selection.selectedIds).toEqual(['obj-2']);
    });
  });

  describe('clearSelection', () => {
    it('should clear all selected objects', () => {
      const store = useCanvasStore.getState();

      act(() => {
        store.addObject(createTestObject('obj-1'));
        store.addObject(createTestObject('obj-2'));
        store.selectObjects(['obj-1', 'obj-2']);
        store.clearSelection();
      });

      const state = useCanvasStore.getState();
      expect(state.selection.selectedIds).toEqual([]);
      expect(state.selection.primaryId).toBeNull();
      expect(state.selectedObjectId).toBeNull();
    });
  });

  describe('selectAll', () => {
    it('should select all objects', () => {
      const store = useCanvasStore.getState();

      act(() => {
        store.addObject(createTestObject('obj-1'));
        store.addObject(createTestObject('obj-2'));
        store.addObject(createTestObject('obj-3'));
        store.selectAll();
      });

      const state = useCanvasStore.getState();
      expect(state.selection.selectedIds).toEqual(['obj-1', 'obj-2', 'obj-3']);
      expect(state.selection.primaryId).toBe('obj-1');
      expect(state.selection.mode).toBe('multiple');
    });

    it('should handle empty objects list', () => {
      const store = useCanvasStore.getState();

      act(() => {
        store.selectAll();
      });

      const state = useCanvasStore.getState();
      expect(state.selection.selectedIds).toEqual([]);
      expect(state.selection.primaryId).toBeNull();
    });
  });

  describe('removeObject', () => {
    it('should remove object from selection when deleted', () => {
      const store = useCanvasStore.getState();

      act(() => {
        store.addObject(createTestObject('obj-1'));
        store.addObject(createTestObject('obj-2'));
        store.selectObjects(['obj-1', 'obj-2']);
        store.removeObject('obj-1');
      });

      const state = useCanvasStore.getState();
      expect(state.selection.selectedIds).toEqual(['obj-2']);
      expect(state.objects).toHaveLength(1);
    });

    it('should update primaryId when primary is deleted', () => {
      const store = useCanvasStore.getState();

      act(() => {
        store.addObject(createTestObject('obj-1'));
        store.addObject(createTestObject('obj-2'));
        store.selectObjects(['obj-1', 'obj-2']); // obj-1 is primary
        store.removeObject('obj-1'); // Delete primary
      });

      const state = useCanvasStore.getState();
      expect(state.selection.primaryId).toBe('obj-2');
      expect(state.selectedObjectId).toBe('obj-2');
    });

    it('should clear selection when last selected object is deleted', () => {
      const store = useCanvasStore.getState();

      act(() => {
        store.addObject(createTestObject('obj-1'));
        store.selectObject('obj-1');
        store.removeObject('obj-1');
      });

      const state = useCanvasStore.getState();
      expect(state.selection.selectedIds).toEqual([]);
      expect(state.selection.primaryId).toBeNull();
      expect(state.selectedObjectId).toBeNull();
    });
  });

  describe('clearObjects', () => {
    it('should clear selection when all objects are cleared', () => {
      const store = useCanvasStore.getState();

      act(() => {
        store.addObject(createTestObject('obj-1'));
        store.selectObject('obj-1');
        store.clearObjects();
      });

      const state = useCanvasStore.getState();
      expect(state.selection.selectedIds).toEqual([]);
      expect(state.selection.primaryId).toBeNull();
      expect(state.selectedObjectId).toBeNull();
    });
  });

  describe('setObjects', () => {
    it('should clear selection when objects are set', () => {
      const store = useCanvasStore.getState();

      act(() => {
        store.addObject(createTestObject('obj-1'));
        store.selectObject('obj-1');
        store.setObjects([createTestObject('obj-2')]);
      });

      const state = useCanvasStore.getState();
      expect(state.selection.selectedIds).toEqual([]);
      expect(state.selection.primaryId).toBeNull();
    });
  });

  describe('duplicateObject', () => {
    it('should select the duplicated object', () => {
      const store = useCanvasStore.getState();

      act(() => {
        store.addObject(createTestObject('obj-1'));
        store.selectObject('obj-1');
        store.duplicateObject('obj-1');
      });

      const state = useCanvasStore.getState();
      expect(state.objects).toHaveLength(2);
      // New object should be selected
      expect(state.selection.selectedIds).toHaveLength(1);
      expect(state.selection.selectedIds[0]).not.toBe('obj-1');
      expect(state.selection.mode).toBe('single');
    });
  });

  describe('selectedObjectId backward compatibility', () => {
    it('should sync selectedObjectId with selection.primaryId', () => {
      const store = useCanvasStore.getState();

      act(() => {
        store.addObject(createTestObject('obj-1'));
        store.addObject(createTestObject('obj-2'));
        store.selectObjects(['obj-1', 'obj-2']);
      });

      const state = useCanvasStore.getState();
      expect(state.selectedObjectId).toBe(state.selection.primaryId);
    });

    it('should keep selectedObjectId null when no selection', () => {
      const store = useCanvasStore.getState();

      act(() => {
        store.clearSelection();
      });

      const state = useCanvasStore.getState();
      expect(state.selectedObjectId).toBeNull();
      expect(state.selection.primaryId).toBeNull();
    });
  });
});
