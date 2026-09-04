import { useEffect, useCallback } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useViewportStore } from '@/stores/viewportStore';
import { useGroupStore } from '@/stores/groupStore';
import { useSelection, useMultiSelection } from '@/features/selection';

/**
 * キーボードショートカットの設定
 */
const SHORTCUTS = {
  DRAW_MODE: 'KeyD',
  SELECT_MODE: 'KeyV',
  ERASER_MODE: 'KeyE',
  POLYGON_MODE: 'KeyP',
  LINE_MODE: 'KeyL',
  SUBTRACT_MODE: 'KeyM',
  ROTATE: 'KeyR',
  DELETE: ['Delete', 'Backspace'] as const,
  ESCAPE: 'Escape',
  ZOOM_IN: ['Equal', 'NumpadAdd'] as const, // = or +
  ZOOM_OUT: ['Minus', 'NumpadSubtract'] as const, // - or _
  DUPLICATE: 'KeyD', // with Ctrl/Cmd
  SELECT_ALL: 'KeyA', // with Ctrl/Cmd
  GROUP: 'KeyG', // with Ctrl/Cmd
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
};

/**
 * 配列に値が含まれるかチェックするヘルパー関数
 */
const includesCode = <T extends string>(
  arr: readonly T[],
  code: string
): code is T => {
  return (arr as readonly string[]).includes(code);
};

/**
 * 入力フィールドかどうかを判定
 */
const isInputElement = (target: EventTarget | null): boolean => {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target.isContentEditable
  );
};

/**
 * useCanvasKeyboard - キャンバス操作のキーボードショートカットを管理するフック
 *
 * キーボードショートカット一覧:
 * - D: 描画モード
 * - V / S: 選択モード
 * - E: 消しゴムモード
 * - P: ポリゴン描画モード
 * - L: 線描画モード
 * - M: 減算モード
 * - R: 選択オブジェクトを90度回転
 * - Ctrl/Cmd + D: 選択オブジェクトを複製
 * - Delete / Backspace: 選択オブジェクトを削除
 * - Arrow Keys: 選択オブジェクトを1マス移動
 * - Escape: 選択解除
 * - Ctrl/Cmd + +: ズームイン
 * - Ctrl/Cmd + -: ズームアウト
 * - Ctrl/Cmd + A: 全選択
 * - Ctrl/Cmd + G: グループ化
 * - Ctrl/Cmd + Shift + G: グループ解除
 */
export const useCanvasKeyboard = () => {
  const { toolMode, setToolMode, selectedObjectId, selectAll, selection } = useCanvasStore();

  const zoomIn = useViewportStore((state) => state.zoomIn);
  const zoomOut = useViewportStore((state) => state.zoomOut);

  const { createGroup, deleteGroup, getGroupByObjectId } = useGroupStore();

  // Selection hook for rotate, delete, duplicate, move operations
  const {
    rotateSelectedObject,
    deleteSelectedObject,
    duplicateSelectedObject,
    deselect,
    moveSelectedObject,
  } = useSelection();

  const { deleteSelectedObjects, duplicateSelectedObjects } = useMultiSelection();

  /**
   * 選択解除
   */
  const clearSelection = useCallback(() => {
    deselect();
  }, [deselect]);

  /**
   * グループ化
   */
  const handleGroup = useCallback(() => {
    if (selection.selectedIds.length >= 2) {
      createGroup(selection.selectedIds);
    }
  }, [selection.selectedIds, createGroup]);

  /**
   * グループ解除
   */
  const handleUngroup = useCallback(() => {
    const groupsToDelete = new Set<string>();

    for (const id of selection.selectedIds) {
      const group = getGroupByObjectId(id);
      if (group) {
        groupsToDelete.add(group.id);
      }
    }

    for (const groupId of groupsToDelete) {
      deleteGroup(groupId);
    }
  }, [selection.selectedIds, getGroupByObjectId, deleteGroup]);

  /**
   * キーボードイベントハンドラ
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // 入力フィールドの場合は無視
      if (isInputElement(e.target)) return;

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // Ctrl/Cmd + ショートカット
      if (isCtrlOrCmd) {
        // Ctrl/Cmd + D: 複製
        if (e.code === SHORTCUTS.DUPLICATE) {
          e.preventDefault();
          // 複数選択時は複数複製、単一選択時は単一複製
          if (selection.selectedIds.length > 1) {
            duplicateSelectedObjects();
          } else {
            duplicateSelectedObject();
          }
          return;
        }

        // Ctrl/Cmd + +: ズームイン
        if (includesCode(SHORTCUTS.ZOOM_IN, e.code)) {
          e.preventDefault();
          zoomIn();
          return;
        }

        // Ctrl/Cmd + -: ズームアウト
        if (includesCode(SHORTCUTS.ZOOM_OUT, e.code)) {
          e.preventDefault();
          zoomOut();
          return;
        }

        // Ctrl/Cmd + A: 全選択
        if (e.code === SHORTCUTS.SELECT_ALL) {
          e.preventDefault();
          selectAll();
          return;
        }

        // Ctrl/Cmd + G: グループ化 / Ctrl/Cmd + Shift + G: グループ解除
        if (e.code === SHORTCUTS.GROUP) {
          e.preventDefault();
          if (e.shiftKey) {
            handleUngroup();
          } else {
            handleGroup();
          }
          return;
        }
      }

      // 単独キーショートカット
      switch (e.code) {
        case SHORTCUTS.DRAW_MODE:
          if (!isCtrlOrCmd) {
            setToolMode('draw');
          }
          break;

        case SHORTCUTS.SELECT_MODE:
          setToolMode('select');
          break;

        case 'KeyS':
          // S キーも選択モードに（V と同様）
          setToolMode('select');
          break;

        case SHORTCUTS.ERASER_MODE:
          setToolMode('eraser');
          break;

        case SHORTCUTS.POLYGON_MODE:
          setToolMode('polygon');
          break;

        case SHORTCUTS.LINE_MODE:
          setToolMode('line');
          break;

        case SHORTCUTS.SUBTRACT_MODE:
          setToolMode('subtract');
          break;

        case SHORTCUTS.ROTATE:
          rotateSelectedObject();
          break;

        case SHORTCUTS.ESCAPE:
          clearSelection();
          break;

        // Arrow key movement
        case SHORTCUTS.ARROW_UP:
          e.preventDefault();
          moveSelectedObject(0, -1);
          break;

        case SHORTCUTS.ARROW_DOWN:
          e.preventDefault();
          moveSelectedObject(0, 1);
          break;

        case SHORTCUTS.ARROW_LEFT:
          e.preventDefault();
          moveSelectedObject(-1, 0);
          break;

        case SHORTCUTS.ARROW_RIGHT:
          e.preventDefault();
          moveSelectedObject(1, 0);
          break;

        default:
          // Delete / Backspace
          if (includesCode(SHORTCUTS.DELETE, e.code)) {
            e.preventDefault();
            // 複数選択時は複数削除、単一選択時は単一削除
            if (selection.selectedIds.length > 1) {
              deleteSelectedObjects();
            } else {
              deleteSelectedObject();
            }
          }
          break;
      }
    },
    [
      setToolMode,
      rotateSelectedObject,
      deleteSelectedObject,
      deleteSelectedObjects,
      duplicateSelectedObject,
      duplicateSelectedObjects,
      clearSelection,
      moveSelectedObject,
      zoomIn,
      zoomOut,
      selectAll,
      handleGroup,
      handleUngroup,
      selection.selectedIds.length,
    ]
  );

  /**
   * キーボードイベントリスナーを登録
   */
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return {
    toolMode,
    selectedObjectId,
    rotateSelectedObject,
    deleteSelectedObject,
    duplicateSelectedObject,
    clearSelection,
    moveSelectedObject,
    handleGroup,
    handleUngroup,
  };
};
