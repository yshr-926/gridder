import { useCallback, useEffect, useRef } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useHistoryStore } from '@/stores/historyStore';
import type { GridObject } from '@/types';

/**
 * デバウンス遅延時間（ミリ秒）
 */
const DEBOUNCE_DELAY = 300;

/**
 * オブジェクト配列を深くコピー
 */
const deepCopyObjects = (objects: GridObject[]): GridObject[] => {
  return objects.map((obj) => ({
    ...obj,
    cells: obj.cells.map((cell) => [...cell] as [number, number]),
    position: { ...obj.position },
  }));
};

/**
 * useUndoRedo - Undo/Redo操作を提供するフック
 *
 * 機能:
 * - オブジェクト変更の自動履歴記録（デバウンス付き）
 * - Undo/Redo操作の実行
 * - キーボードショートカット対応（Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z）
 *
 * 使用例:
 * ```tsx
 * const { handleUndo, handleRedo, canUndo, canRedo } = useUndoRedo();
 *
 * // UIボタンで使用
 * <button onClick={handleUndo} disabled={!canUndo}>Undo</button>
 * <button onClick={handleRedo} disabled={!canRedo}>Redo</button>
 * ```
 */
export const useUndoRedo = () => {
  const { objects, setObjects } = useCanvasStore();
  const { pushState, undo, redo, canUndo, canRedo, clearHistory } =
    useHistoryStore();

  // Undo/Redo操作中かどうかを追跡（無限ループ回避用）
  const isUndoRedoRef = useRef(false);

  // 前回のオブジェクト状態を追跡（変更検出用）
  const previousObjectsRef = useRef<GridObject[] | null>(null);

  // デバウンスタイマー
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * オブジェクトが変更されたかどうかを判定
   */
  const hasObjectsChanged = useCallback(
    (current: GridObject[], previous: GridObject[] | null): boolean => {
      if (previous === null) return true;
      if (current.length !== previous.length) return true;

      // 簡易比較: IDリストとJSON文字列で比較
      const currentStr = JSON.stringify(current);
      const previousStr = JSON.stringify(previous);

      return currentStr !== previousStr;
    },
    []
  );

  /**
   * Undo操作を実行
   */
  const handleUndo = useCallback(() => {
    const currentObjects = useCanvasStore.getState().objects;
    const copiedCurrent = deepCopyObjects(currentObjects);

    isUndoRedoRef.current = true;

    const previousState = undo(copiedCurrent);

    if (previousState) {
      setObjects(previousState);
      previousObjectsRef.current = previousState;
    }

    // 次のティックで無限ループ防止フラグをリセット
    setTimeout(() => {
      isUndoRedoRef.current = false;
    }, 0);
  }, [undo, setObjects]);

  /**
   * Redo操作を実行
   */
  const handleRedo = useCallback(() => {
    const currentObjects = useCanvasStore.getState().objects;
    const copiedCurrent = deepCopyObjects(currentObjects);

    isUndoRedoRef.current = true;

    const nextState = redo(copiedCurrent);

    if (nextState) {
      setObjects(nextState);
      previousObjectsRef.current = nextState;
    }

    // 次のティックで無限ループ防止フラグをリセット
    setTimeout(() => {
      isUndoRedoRef.current = false;
    }, 0);
  }, [redo, setObjects]);

  /**
   * 履歴をクリア
   */
  const handleClearHistory = useCallback(() => {
    clearHistory();
    previousObjectsRef.current = null;
  }, [clearHistory]);

  /**
   * オブジェクト変更の自動監視（デバウンス付き）
   */
  useEffect(() => {
    // Undo/Redo操作中は履歴に追加しない
    if (isUndoRedoRef.current) {
      return;
    }

    // 変更がない場合はスキップ
    if (!hasObjectsChanged(objects, previousObjectsRef.current)) {
      return;
    }

    // 既存のタイマーをクリア
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // 最初の状態（previousが null）の場合は、デバウンスなしで初期状態を保存しない
    // （履歴は変更があった後に前の状態を保存する方式）
    if (previousObjectsRef.current !== null) {
      // 前の状態を履歴に追加（デバウンス付き）
      debounceTimerRef.current = setTimeout(() => {
        if (previousObjectsRef.current) {
          pushState(deepCopyObjects(previousObjectsRef.current));
        }
        previousObjectsRef.current = deepCopyObjects(objects);
      }, DEBOUNCE_DELAY);
    } else {
      // 初回は現在の状態を記録するだけ
      previousObjectsRef.current = deepCopyObjects(objects);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [objects, pushState, hasObjectsChanged]);

  /**
   * キーボードショートカットの登録
   * - Ctrl/Cmd + Z: Undo
   * - Ctrl/Cmd + Shift + Z: Redo
   * - Ctrl/Cmd + Y: Redo（Windows向け）
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 入力フィールドでは無効
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (!isCtrlOrCmd) return;

      // Ctrl/Cmd + Shift + Z: Redo
      if (e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Ctrl/Cmd + Z: Undo
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl/Cmd + Y: Redo（Windows向け）
      if (e.key === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleUndo, handleRedo]);

  return {
    handleUndo,
    handleRedo,
    handleClearHistory,
    canUndo: canUndo(),
    canRedo: canRedo(),
  };
};
