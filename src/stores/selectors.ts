import { useShallow } from 'zustand/shallow';
import { useCanvasStore } from './canvasStore';

/**
 * パフォーマンス最適化されたZustandセレクタ集
 * Phase 17: オブジェクト選択・移動操作のパフォーマンス最適化
 */

/**
 * 選択状態のセレクタ
 * selectedIds の参照が変わった場合のみ再レンダリング
 */
export const useSelectionState = () => {
  return useCanvasStore(
    useShallow((state) => ({
      selectedIds: state.selection.selectedIds,
      primaryId: state.selection.primaryId,
      mode: state.selection.mode,
    }))
  );
};

/**
 * ツールモードのセレクタ
 */
export const useToolMode = () => {
  return useCanvasStore((state) => state.toolMode);
};

/**
 * オブジェクト操作アクションのセレクタ
 * アクション関数のみを購読（状態変更で再レンダリングしない）
 */
export const useCanvasActions = () => {
  return useCanvasStore(
    useShallow((state) => ({
      selectObject: state.selectObject,
      updateObject: state.updateObject,
      removeObject: state.removeObject,
      addObject: state.addObject,
      clearSelection: state.clearSelection,
      selectObjects: state.selectObjects,
    }))
  );
};

/**
 * オブジェクト一覧のセレクタ
 */
export const useObjects = () => {
  return useCanvasStore((state) => state.objects);
};

/**
 * 選択状態全体のセレクタ
 */
export const useSelection = () => {
  return useCanvasStore((state) => state.selection);
};

