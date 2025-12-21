import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSubtractionDrawing } from '../useSubtractionDrawing';
import { useCanvasStore } from '@/stores/canvasStore';
import type { GridObject } from '@/types';

/**
 * テスト用のオブジェクトを作成
 */
const createTestObject = (
  id: string,
  cells: [number, number][],
  position: { x: number; y: number }
): GridObject => ({
  id,
  cells,
  position,
  rotation: 0,
  color: '#333333',
});

describe('useSubtractionDrawing', () => {
  beforeEach(() => {
    // 各テスト前にストアをリセット
    useCanvasStore.setState({
      objects: [],
      selectedObjectId: null,
      selection: {
        selectedIds: [],
        primaryId: null,
        mode: 'single',
      },
    });
  });

  describe('isSubtractionAvailable', () => {
    it('オブジェクトが選択されていない場合はfalseを返す', () => {
      const { result } = renderHook(() => useSubtractionDrawing());
      expect(result.current.isSubtractionAvailable).toBe(false);
    });

    it('オブジェクトが選択されている場合はtrueを返す', () => {
      const testObject = createTestObject('obj-1', [[0, 0], [1, 0]], { x: 5, y: 5 });
      useCanvasStore.setState({
        objects: [testObject],
        selectedObjectId: 'obj-1',
        selection: {
          selectedIds: ['obj-1'],
          primaryId: 'obj-1',
          mode: 'single',
        },
      });

      const { result } = renderHook(() => useSubtractionDrawing());
      expect(result.current.isSubtractionAvailable).toBe(true);
    });
  });

  describe('globalToLocal', () => {
    it('選択オブジェクトがない場合はnullを返す', () => {
      const { result } = renderHook(() => useSubtractionDrawing());
      const local = result.current.globalToLocal(5, 5);
      expect(local).toBeNull();
    });

    it('グローバル座標をローカル座標に変換する', () => {
      const testObject = createTestObject('obj-1', [[0, 0], [1, 0]], { x: 5, y: 10 });
      useCanvasStore.setState({
        objects: [testObject],
        selectedObjectId: 'obj-1',
        selection: {
          selectedIds: ['obj-1'],
          primaryId: 'obj-1',
          mode: 'single',
        },
      });

      const { result } = renderHook(() => useSubtractionDrawing());
      const local = result.current.globalToLocal(6, 10);
      expect(local).toEqual([1, 0]);
    });

    it('負のローカル座標も正しく計算する', () => {
      const testObject = createTestObject('obj-1', [[0, 0]], { x: 10, y: 10 });
      useCanvasStore.setState({
        objects: [testObject],
        selectedObjectId: 'obj-1',
        selection: {
          selectedIds: ['obj-1'],
          primaryId: 'obj-1',
          mode: 'single',
        },
      });

      const { result } = renderHook(() => useSubtractionDrawing());
      const local = result.current.globalToLocal(8, 8);
      expect(local).toEqual([-2, -2]);
    });
  });

  describe('isLocalCellInObject', () => {
    it('選択オブジェクトがない場合はfalseを返す', () => {
      const { result } = renderHook(() => useSubtractionDrawing());
      const inObject = result.current.isLocalCellInObject(0, 0);
      expect(inObject).toBe(false);
    });

    it('セルがオブジェクト内にある場合はtrueを返す', () => {
      const testObject = createTestObject('obj-1', [[0, 0], [1, 0], [2, 0]], { x: 5, y: 5 });
      useCanvasStore.setState({
        objects: [testObject],
        selectedObjectId: 'obj-1',
        selection: {
          selectedIds: ['obj-1'],
          primaryId: 'obj-1',
          mode: 'single',
        },
      });

      const { result } = renderHook(() => useSubtractionDrawing());
      expect(result.current.isLocalCellInObject(0, 0)).toBe(true);
      expect(result.current.isLocalCellInObject(1, 0)).toBe(true);
      expect(result.current.isLocalCellInObject(2, 0)).toBe(true);
    });

    it('セルがオブジェクト外にある場合はfalseを返す', () => {
      const testObject = createTestObject('obj-1', [[0, 0], [1, 0]], { x: 5, y: 5 });
      useCanvasStore.setState({
        objects: [testObject],
        selectedObjectId: 'obj-1',
        selection: {
          selectedIds: ['obj-1'],
          primaryId: 'obj-1',
          mode: 'single',
        },
      });

      const { result } = renderHook(() => useSubtractionDrawing());
      expect(result.current.isLocalCellInObject(3, 0)).toBe(false);
      expect(result.current.isLocalCellInObject(0, 1)).toBe(false);
    });
  });

  describe('isGlobalCellInObject', () => {
    it('グローバル座標でセルがオブジェクト内にあるかチェックする', () => {
      const testObject = createTestObject('obj-1', [[0, 0], [1, 0]], { x: 5, y: 5 });
      useCanvasStore.setState({
        objects: [testObject],
        selectedObjectId: 'obj-1',
        selection: {
          selectedIds: ['obj-1'],
          primaryId: 'obj-1',
          mode: 'single',
        },
      });

      const { result } = renderHook(() => useSubtractionDrawing());
      expect(result.current.isGlobalCellInObject(5, 5)).toBe(true);
      expect(result.current.isGlobalCellInObject(6, 5)).toBe(true);
      expect(result.current.isGlobalCellInObject(7, 5)).toBe(false);
    });
  });

  describe('subtractCell', () => {
    it('選択オブジェクトがない場合は失敗を返す', () => {
      const { result } = renderHook(() => useSubtractionDrawing());

      let subtractionResult;
      act(() => {
        subtractionResult = result.current.subtractCell(5, 5);
      });

      expect(subtractionResult).toEqual({
        success: false,
        removedCount: 0,
        objectRemoved: false,
      });
    });

    it('オブジェクト外のセルを指定した場合は失敗を返す', () => {
      const testObject = createTestObject('obj-1', [[0, 0], [1, 0]], { x: 5, y: 5 });
      useCanvasStore.setState({
        objects: [testObject],
        selectedObjectId: 'obj-1',
        selection: {
          selectedIds: ['obj-1'],
          primaryId: 'obj-1',
          mode: 'single',
        },
      });

      const { result } = renderHook(() => useSubtractionDrawing());

      let subtractionResult;
      act(() => {
        subtractionResult = result.current.subtractCell(10, 10);
      });

      expect(subtractionResult).toEqual({
        success: false,
        removedCount: 0,
        objectRemoved: false,
      });
    });

    it('単一セルを削除する', () => {
      const testObject = createTestObject('obj-1', [[0, 0], [1, 0], [2, 0]], { x: 5, y: 5 });
      useCanvasStore.setState({
        objects: [testObject],
        selectedObjectId: 'obj-1',
        selection: {
          selectedIds: ['obj-1'],
          primaryId: 'obj-1',
          mode: 'single',
        },
      });

      const { result } = renderHook(() => useSubtractionDrawing());

      let subtractionResult;
      act(() => {
        subtractionResult = result.current.subtractCell(6, 5); // ローカル座標 [1, 0]
      });

      expect(subtractionResult).toEqual({
        success: true,
        removedCount: 1,
        objectRemoved: false,
      });

      const state = useCanvasStore.getState();
      expect(state.objects[0].cells).toHaveLength(2);
      expect(state.objects[0].cells).not.toContainEqual([1, 0]);
    });

    it('すべてのセルを削除するとオブジェクトが削除される', () => {
      const testObject = createTestObject('obj-1', [[0, 0]], { x: 5, y: 5 });
      useCanvasStore.setState({
        objects: [testObject],
        selectedObjectId: 'obj-1',
        selection: {
          selectedIds: ['obj-1'],
          primaryId: 'obj-1',
          mode: 'single',
        },
      });

      const { result } = renderHook(() => useSubtractionDrawing());

      let subtractionResult;
      act(() => {
        subtractionResult = result.current.subtractCell(5, 5);
      });

      expect(subtractionResult).toEqual({
        success: true,
        removedCount: 1,
        objectRemoved: true,
      });

      const state = useCanvasStore.getState();
      expect(state.objects).toHaveLength(0);
    });
  });

  describe('subtractDrag', () => {
    it('空のセル配列の場合は失敗を返す', () => {
      const testObject = createTestObject('obj-1', [[0, 0], [1, 0]], { x: 5, y: 5 });
      useCanvasStore.setState({
        objects: [testObject],
        selectedObjectId: 'obj-1',
        selection: {
          selectedIds: ['obj-1'],
          primaryId: 'obj-1',
          mode: 'single',
        },
      });

      const { result } = renderHook(() => useSubtractionDrawing());

      let subtractionResult;
      act(() => {
        subtractionResult = result.current.subtractDrag([]);
      });

      expect(subtractionResult).toEqual({
        success: false,
        removedCount: 0,
        objectRemoved: false,
      });
    });

    it('複数セルを一度に削除する', () => {
      const testObject = createTestObject(
        'obj-1',
        [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1]],
        { x: 5, y: 5 }
      );
      useCanvasStore.setState({
        objects: [testObject],
        selectedObjectId: 'obj-1',
        selection: {
          selectedIds: ['obj-1'],
          primaryId: 'obj-1',
          mode: 'single',
        },
      });

      const { result } = renderHook(() => useSubtractionDrawing());

      let subtractionResult;
      act(() => {
        subtractionResult = result.current.subtractDrag([
          { x: 5, y: 5 },   // ローカル [0, 0]
          { x: 6, y: 5 },   // ローカル [1, 0]
          { x: 5, y: 6 },   // ローカル [0, 1]
        ]);
      });

      expect(subtractionResult).toEqual({
        success: true,
        removedCount: 3,
        objectRemoved: false,
      });

      const state = useCanvasStore.getState();
      expect(state.objects[0].cells).toHaveLength(2);
      expect(state.objects[0].cells).toContainEqual([2, 0]);
      expect(state.objects[0].cells).toContainEqual([1, 1]);
    });

    it('重複するセルを指定しても1回しか削除しない', () => {
      const testObject = createTestObject('obj-1', [[0, 0], [1, 0], [2, 0]], { x: 5, y: 5 });
      useCanvasStore.setState({
        objects: [testObject],
        selectedObjectId: 'obj-1',
        selection: {
          selectedIds: ['obj-1'],
          primaryId: 'obj-1',
          mode: 'single',
        },
      });

      const { result } = renderHook(() => useSubtractionDrawing());

      let subtractionResult;
      act(() => {
        subtractionResult = result.current.subtractDrag([
          { x: 5, y: 5 },   // ローカル [0, 0]
          { x: 5, y: 5 },   // 重複
          { x: 5, y: 5 },   // 重複
        ]);
      });

      expect(subtractionResult).toEqual({
        success: true,
        removedCount: 1,
        objectRemoved: false,
      });

      const state = useCanvasStore.getState();
      expect(state.objects[0].cells).toHaveLength(2);
    });

    it('オブジェクト外のセルを含む場合は有効なセルのみ削除する', () => {
      const testObject = createTestObject('obj-1', [[0, 0], [1, 0]], { x: 5, y: 5 });
      useCanvasStore.setState({
        objects: [testObject],
        selectedObjectId: 'obj-1',
        selection: {
          selectedIds: ['obj-1'],
          primaryId: 'obj-1',
          mode: 'single',
        },
      });

      const { result } = renderHook(() => useSubtractionDrawing());

      let subtractionResult;
      act(() => {
        subtractionResult = result.current.subtractDrag([
          { x: 5, y: 5 },   // ローカル [0, 0] - 有効
          { x: 10, y: 10 }, // オブジェクト外 - 無視
          { x: 6, y: 5 },   // ローカル [1, 0] - 有効
        ]);
      });

      expect(subtractionResult).toEqual({
        success: true,
        removedCount: 2,
        objectRemoved: true,
      });

      const state = useCanvasStore.getState();
      expect(state.objects).toHaveLength(0);
    });
  });

  describe('subtractRect', () => {
    it('矩形領域内のセルを削除する', () => {
      const testObject = createTestObject(
        'obj-1',
        [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
        { x: 5, y: 5 }
      );
      useCanvasStore.setState({
        objects: [testObject],
        selectedObjectId: 'obj-1',
        selection: {
          selectedIds: ['obj-1'],
          primaryId: 'obj-1',
          mode: 'single',
        },
      });

      const { result } = renderHook(() => useSubtractionDrawing());

      let subtractionResult;
      act(() => {
        // 中央の1セルだけ削除 (グローバル座標 6,6 = ローカル座標 1,1)
        subtractionResult = result.current.subtractRect(6, 6, 6, 6);
      });

      expect(subtractionResult).toEqual({
        success: true,
        removedCount: 1,
        objectRemoved: false,
      });

      const state = useCanvasStore.getState();
      expect(state.objects[0].cells).toHaveLength(8);
      expect(state.objects[0].cells).not.toContainEqual([1, 1]);
    });

    it('座標の順序に関係なく矩形領域を削除する', () => {
      const testObject = createTestObject(
        'obj-1',
        [[0, 0], [1, 0], [0, 1], [1, 1]],
        { x: 5, y: 5 }
      );
      useCanvasStore.setState({
        objects: [testObject],
        selectedObjectId: 'obj-1',
        selection: {
          selectedIds: ['obj-1'],
          primaryId: 'obj-1',
          mode: 'single',
        },
      });

      const { result } = renderHook(() => useSubtractionDrawing());

      let subtractionResult;
      act(() => {
        // 逆順で矩形を指定（右下から左上）
        subtractionResult = result.current.subtractRect(6, 6, 5, 5);
      });

      expect(subtractionResult).toEqual({
        success: true,
        removedCount: 4,
        objectRemoved: true,
      });

      const state = useCanvasStore.getState();
      expect(state.objects).toHaveLength(0);
    });
  });

  describe('subtractCells', () => {
    it('何も削除しない場合は失敗を返す', () => {
      const testObject = createTestObject('obj-1', [[0, 0], [1, 0]], { x: 5, y: 5 });
      useCanvasStore.setState({
        objects: [testObject],
        selectedObjectId: 'obj-1',
        selection: {
          selectedIds: ['obj-1'],
          primaryId: 'obj-1',
          mode: 'single',
        },
      });

      const { result } = renderHook(() => useSubtractionDrawing());

      let subtractionResult;
      act(() => {
        // オブジェクトに存在しないセルを指定
        subtractionResult = result.current.subtractCells([[5, 5], [6, 6]]);
      });

      expect(subtractionResult).toEqual({
        success: false,
        removedCount: 0,
        objectRemoved: false,
      });

      const state = useCanvasStore.getState();
      expect(state.objects[0].cells).toHaveLength(2);
    });
  });
});
