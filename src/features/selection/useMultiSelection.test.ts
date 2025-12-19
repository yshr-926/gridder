import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMultiSelection } from './useMultiSelection';
import { useCanvasStore } from '@/stores/canvasStore';
import type { GridObject, CellCoordinate } from '@/types';
import { colorPaletteManager } from '@/utils/colorPalette';

/**
 * テスト用ヘルパー: オブジェクトを作成
 */
const createTestObject = (
  id: string,
  position: { x: number; y: number } = { x: 0, y: 0 },
  cells: CellCoordinate[] = [[0, 0]],
  color: string = '#3b82f6'
): GridObject => ({
  id,
  cells,
  position,
  rotation: 0,
  color,
});

describe('useMultiSelection', () => {
  beforeEach(() => {
    // ストアをリセット
    const store = useCanvasStore.getState();
    store.clearObjects();
    colorPaletteManager.reset();
  });

  describe('selectedObjects', () => {
    it('should return empty array when no selection', () => {
      const { result } = renderHook(() => useMultiSelection());

      expect(result.current.selectedObjects).toEqual([]);
      expect(result.current.selectedCount).toBe(0);
      expect(result.current.hasSelection).toBe(false);
      expect(result.current.hasMultipleSelection).toBe(false);
    });

    it('should return selected objects', () => {
      const store = useCanvasStore.getState();
      const obj1 = createTestObject('obj-1', { x: 0, y: 0 });
      const obj2 = createTestObject('obj-2', { x: 5, y: 5 });

      act(() => {
        store.addObject(obj1);
        store.addObject(obj2);
        store.selectObjects(['obj-1', 'obj-2']);
      });

      const { result } = renderHook(() => useMultiSelection());

      expect(result.current.selectedObjects).toHaveLength(2);
      expect(result.current.selectedCount).toBe(2);
      expect(result.current.hasSelection).toBe(true);
      expect(result.current.hasMultipleSelection).toBe(true);
    });

    it('should correctly identify single selection', () => {
      const store = useCanvasStore.getState();
      const obj1 = createTestObject('obj-1');

      act(() => {
        store.addObject(obj1);
        store.selectObject('obj-1');
      });

      const { result } = renderHook(() => useMultiSelection());

      expect(result.current.selectedCount).toBe(1);
      expect(result.current.hasSelection).toBe(true);
      expect(result.current.hasMultipleSelection).toBe(false);
    });
  });

  describe('calculateRelativePositions', () => {
    it('should return empty map when no selection', () => {
      const { result } = renderHook(() => useMultiSelection());

      const positions = result.current.calculateRelativePositions();
      expect(positions.size).toBe(0);
    });

    it('should calculate relative positions from anchor', () => {
      const store = useCanvasStore.getState();
      const obj1 = createTestObject('obj-1', { x: 0, y: 0 });
      const obj2 = createTestObject('obj-2', { x: 5, y: 3 });
      const obj3 = createTestObject('obj-3', { x: -2, y: 1 });

      act(() => {
        store.addObject(obj1);
        store.addObject(obj2);
        store.addObject(obj3);
        store.selectObjects(['obj-1', 'obj-2', 'obj-3']);
      });

      const { result } = renderHook(() => useMultiSelection());

      const positions = result.current.calculateRelativePositions();

      // obj-1 is anchor, so its relative position is (0, 0)
      expect(positions.get('obj-1')).toEqual({ x: 0, y: 0 });
      // obj-2 is at (5, 3), relative to (0, 0) = (5, 3)
      expect(positions.get('obj-2')).toEqual({ x: 5, y: 3 });
      // obj-3 is at (-2, 1), relative to (0, 0) = (-2, 1)
      expect(positions.get('obj-3')).toEqual({ x: -2, y: 1 });
    });
  });

  describe('moveSelectedObjects', () => {
    it('should move all selected objects by delta', () => {
      const store = useCanvasStore.getState();
      const obj1 = createTestObject('obj-1', { x: 0, y: 0 });
      const obj2 = createTestObject('obj-2', { x: 5, y: 5 });

      act(() => {
        store.addObject(obj1);
        store.addObject(obj2);
        store.selectObjects(['obj-1', 'obj-2']);
      });

      const { result } = renderHook(() => useMultiSelection());

      act(() => {
        result.current.moveSelectedObjects(3, 2);
      });

      const state = useCanvasStore.getState();
      const movedObj1 = state.objects.find((o) => o.id === 'obj-1');
      const movedObj2 = state.objects.find((o) => o.id === 'obj-2');

      expect(movedObj1?.position).toEqual({ x: 3, y: 2 });
      expect(movedObj2?.position).toEqual({ x: 8, y: 7 });
    });

    it('should maintain relative positions after move', () => {
      const store = useCanvasStore.getState();
      const obj1 = createTestObject('obj-1', { x: 0, y: 0 });
      const obj2 = createTestObject('obj-2', { x: 5, y: 3 });

      act(() => {
        store.addObject(obj1);
        store.addObject(obj2);
        store.selectObjects(['obj-1', 'obj-2']);
      });

      const { result } = renderHook(() => useMultiSelection());

      // Calculate initial relative position
      const initialRelativeX = 5 - 0;
      const initialRelativeY = 3 - 0;

      act(() => {
        result.current.moveSelectedObjects(10, 10);
      });

      const state = useCanvasStore.getState();
      const movedObj1 = state.objects.find((o) => o.id === 'obj-1');
      const movedObj2 = state.objects.find((o) => o.id === 'obj-2');

      // Verify relative position is maintained
      const newRelativeX = movedObj2!.position.x - movedObj1!.position.x;
      const newRelativeY = movedObj2!.position.y - movedObj1!.position.y;

      expect(newRelativeX).toBe(initialRelativeX);
      expect(newRelativeY).toBe(initialRelativeY);
    });
  });

  describe('moveSelectedObjectsTo', () => {
    it('should move anchor to specified position maintaining relative positions', () => {
      const store = useCanvasStore.getState();
      const obj1 = createTestObject('obj-1', { x: 0, y: 0 });
      const obj2 = createTestObject('obj-2', { x: 5, y: 3 });

      act(() => {
        store.addObject(obj1);
        store.addObject(obj2);
        store.selectObjects(['obj-1', 'obj-2']);
      });

      const { result } = renderHook(() => useMultiSelection());

      act(() => {
        result.current.moveSelectedObjectsTo({ x: 10, y: 10 });
      });

      const state = useCanvasStore.getState();
      const movedObj1 = state.objects.find((o) => o.id === 'obj-1');
      const movedObj2 = state.objects.find((o) => o.id === 'obj-2');

      // Anchor (obj-1) should be at (10, 10)
      expect(movedObj1?.position).toEqual({ x: 10, y: 10 });
      // obj-2 was at (5, 3) relative to obj-1, so now at (10+5, 10+3)
      expect(movedObj2?.position).toEqual({ x: 15, y: 13 });
    });

    it('should do nothing when no selection', () => {
      const { result } = renderHook(() => useMultiSelection());

      // Should not throw
      act(() => {
        result.current.moveSelectedObjectsTo({ x: 10, y: 10 });
      });
    });
  });

  describe('deleteSelectedObjects', () => {
    it('should delete all selected objects', () => {
      const store = useCanvasStore.getState();
      const obj1 = createTestObject('obj-1');
      const obj2 = createTestObject('obj-2');
      const obj3 = createTestObject('obj-3');

      act(() => {
        store.addObject(obj1);
        store.addObject(obj2);
        store.addObject(obj3);
        store.selectObjects(['obj-1', 'obj-2']);
      });

      const { result } = renderHook(() => useMultiSelection());

      act(() => {
        result.current.deleteSelectedObjects();
      });

      const state = useCanvasStore.getState();
      expect(state.objects).toHaveLength(1);
      expect(state.objects[0].id).toBe('obj-3');
      expect(state.selection.selectedIds).toEqual([]);
    });

    it('should handle empty selection', () => {
      const { result } = renderHook(() => useMultiSelection());

      // Should not throw
      act(() => {
        result.current.deleteSelectedObjects();
      });
    });
  });

  describe('duplicateSelectedObjects', () => {
    it('should duplicate all selected objects with new colors', () => {
      const store = useCanvasStore.getState();
      const obj1 = createTestObject('obj-1', { x: 0, y: 0 }, [[0, 0]], '#3b82f6');
      const obj2 = createTestObject('obj-2', { x: 5, y: 5 }, [[0, 0]], '#ef4444');

      act(() => {
        store.addObject(obj1);
        store.addObject(obj2);
        store.selectObjects(['obj-1', 'obj-2']);
      });

      const { result } = renderHook(() => useMultiSelection());

      act(() => {
        result.current.duplicateSelectedObjects();
      });

      const state = useCanvasStore.getState();

      // Should have 4 objects total
      expect(state.objects).toHaveLength(4);

      // New objects should be selected
      expect(state.selection.selectedIds).toHaveLength(2);
      expect(state.selection.selectedIds).not.toContain('obj-1');
      expect(state.selection.selectedIds).not.toContain('obj-2');

      // Find duplicated objects
      const duplicates = state.objects.filter(
        (o) => o.id !== 'obj-1' && o.id !== 'obj-2'
      );

      // Duplicates should have colors from the palette
      expect(duplicates[0].color).toBeDefined();
      expect(duplicates[1].color).toBeDefined();
      // Each duplicate should have a unique color (from palette)
      expect(typeof duplicates[0].color).toBe('string');
      expect(typeof duplicates[1].color).toBe('string');

      // Duplicates should be offset by 1
      const dup1 = state.objects.find((o) => o.position.x === 1 && o.position.y === 1);
      const dup2 = state.objects.find((o) => o.position.x === 6 && o.position.y === 6);
      expect(dup1).toBeDefined();
      expect(dup2).toBeDefined();
    });

    it('should maintain relative positions in duplicates', () => {
      const store = useCanvasStore.getState();
      const obj1 = createTestObject('obj-1', { x: 0, y: 0 });
      const obj2 = createTestObject('obj-2', { x: 5, y: 3 });

      act(() => {
        store.addObject(obj1);
        store.addObject(obj2);
        store.selectObjects(['obj-1', 'obj-2']);
      });

      const { result } = renderHook(() => useMultiSelection());

      act(() => {
        result.current.duplicateSelectedObjects();
      });

      const state = useCanvasStore.getState();
      const duplicates = state.objects.filter(
        (o) => o.id !== 'obj-1' && o.id !== 'obj-2'
      );

      // Relative position should be same as original
      const originalRelativeX = 5 - 0;
      const originalRelativeY = 3 - 0;

      const newRelativeX = duplicates[1].position.x - duplicates[0].position.x;
      const newRelativeY = duplicates[1].position.y - duplicates[0].position.y;

      expect(newRelativeX).toBe(originalRelativeX);
      expect(newRelativeY).toBe(originalRelativeY);
    });

    it('should add "(コピー)" suffix to name if object has name', () => {
      const store = useCanvasStore.getState();
      const obj1: GridObject = {
        ...createTestObject('obj-1'),
        name: 'テーブル',
      };

      act(() => {
        store.addObject(obj1);
        store.selectObject('obj-1');
      });

      const { result } = renderHook(() => useMultiSelection());

      act(() => {
        result.current.duplicateSelectedObjects();
      });

      const state = useCanvasStore.getState();
      const duplicate = state.objects.find((o) => o.id !== 'obj-1');

      expect(duplicate?.name).toBe('テーブル (コピー)');
    });
  });

  describe('getSelectionBoundingBox', () => {
    it('should return null when no selection', () => {
      const { result } = renderHook(() => useMultiSelection());

      expect(result.current.getSelectionBoundingBox()).toBeNull();
    });

    it('should calculate bounding box for single object', () => {
      const store = useCanvasStore.getState();
      const obj1 = createTestObject(
        'obj-1',
        { x: 5, y: 5 },
        [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ] // 2x2 object
      );

      act(() => {
        store.addObject(obj1);
        store.selectObject('obj-1');
      });

      const { result } = renderHook(() => useMultiSelection());

      const box = result.current.getSelectionBoundingBox();

      expect(box).toEqual({
        minX: 5,
        minY: 5,
        maxX: 7, // 5 + 2
        maxY: 7, // 5 + 2
      });
    });

    it('should calculate bounding box for multiple objects', () => {
      const store = useCanvasStore.getState();
      const obj1 = createTestObject('obj-1', { x: 0, y: 0 }, [[0, 0]]);
      const obj2 = createTestObject('obj-2', { x: 10, y: 10 }, [[0, 0]]);

      act(() => {
        store.addObject(obj1);
        store.addObject(obj2);
        store.selectObjects(['obj-1', 'obj-2']);
      });

      const { result } = renderHook(() => useMultiSelection());

      const box = result.current.getSelectionBoundingBox();

      expect(box).toEqual({
        minX: 0,
        minY: 0,
        maxX: 11,
        maxY: 11,
      });
    });
  });

  describe('getSelectionCenter', () => {
    it('should return null when no selection', () => {
      const { result } = renderHook(() => useMultiSelection());

      expect(result.current.getSelectionCenter()).toBeNull();
    });

    it('should calculate center of selection', () => {
      const store = useCanvasStore.getState();
      const obj1 = createTestObject('obj-1', { x: 0, y: 0 }, [[0, 0]]);
      const obj2 = createTestObject('obj-2', { x: 10, y: 10 }, [[0, 0]]);

      act(() => {
        store.addObject(obj1);
        store.addObject(obj2);
        store.selectObjects(['obj-1', 'obj-2']);
      });

      const { result } = renderHook(() => useMultiSelection());

      const center = result.current.getSelectionCenter();

      // Box is (0,0) to (11,11), center is (5.5, 5.5)
      expect(center).toEqual({ x: 5.5, y: 5.5 });
    });
  });

  describe('clearSelection', () => {
    it('should clear selection', () => {
      const store = useCanvasStore.getState();
      const obj1 = createTestObject('obj-1');

      act(() => {
        store.addObject(obj1);
        store.selectObject('obj-1');
      });

      const { result } = renderHook(() => useMultiSelection());

      expect(result.current.hasSelection).toBe(true);

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectedCount).toBe(0);
    });
  });
});
