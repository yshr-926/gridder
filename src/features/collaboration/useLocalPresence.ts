/**
 * ローカルプレゼンス管理フック
 *
 * 自分のプレゼンス（カーソル位置、選択オブジェクト）を管理し、
 * スロットリングによる最適化を行いながら他のユーザーに共有する。
 *
 * @module features/collaboration/useLocalPresence
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { throttle } from '../../utils/performance';
import type { Presence, CursorPosition } from './types';
import { PRESENCE_THROTTLE_MS } from './types';

/**
 * useLocalPresence のオプション
 */
export interface UseLocalPresenceOptions {
  /**
   * 更新間隔（ミリ秒）
   * @default 50 (PRESENCE_THROTTLE_MS)
   */
  throttleMs?: number;

  /**
   * プレゼンス更新時のコールバック
   * スロットリングされた後に呼び出される
   */
  onPresenceChange?: (presence: Partial<Presence>) => void;

  /**
   * ユーザーID
   * 指定がない場合はプレゼンスにuserIdが含まれない
   */
  userId?: string;

  /**
   * 自動的に選択状態の変更を追跡するかどうか
   * @default true
   */
  autoTrackSelection?: boolean;
}

/**
 * useLocalPresence の戻り値
 */
export interface UseLocalPresenceResult {
  /**
   * カーソル位置を更新する
   * @param position - カーソル位置（nullでキャンバス外を示す）
   */
  updateCursor: (position: CursorPosition | null) => void;

  /**
   * 現在のカーソル位置を取得する
   * @returns 現在のカーソル位置
   */
  getCursor: () => CursorPosition | null;

  /**
   * 現在の選択オブジェクトIDを取得する
   * @returns 選択中のオブジェクトID配列
   */
  getSelectedIds: () => string[];

  /**
   * 選択オブジェクトを手動で更新する
   * autoTrackSelection が false の場合に使用
   * @param ids - 選択中のオブジェクトID配列
   */
  updateSelection: (ids: string[]) => void;

  /**
   * 現在のプレゼンス情報を取得する
   * @returns 現在のプレゼンス情報
   */
  getPresence: () => Partial<Presence>;
}

/**
 * ローカルプレゼンス管理フック
 *
 * 自分のカーソル位置と選択オブジェクトを管理し、
 * 変更があればコールバックで通知する。
 *
 * @example
 * ```tsx
 * const { updateCursor, getCursor } = useLocalPresence({
 *   onPresenceChange: (presence) => {
 *     // WebSocket経由で他のユーザーに送信
 *     awareness.setLocalState(presence);
 *   },
 *   userId: 'user-123',
 * });
 *
 * // マウス移動時
 * const handleMouseMove = (e: MouseEvent) => {
 *   const { x, y } = getGridPosition(e);
 *   updateCursor({ x, y });
 * };
 *
 * // マウスがキャンバス外に出た時
 * const handleMouseLeave = () => {
 *   updateCursor(null);
 * };
 * ```
 */
export const useLocalPresence = (
  options: UseLocalPresenceOptions = {}
): UseLocalPresenceResult => {
  const {
    throttleMs = PRESENCE_THROTTLE_MS,
    onPresenceChange,
    userId,
    autoTrackSelection = true,
  } = options;

  // Zustand から選択状態を取得
  const selectedIds = useCanvasStore((state) => state.selection.selectedIds);

  // 現在のカーソル位置（再レンダリングを防ぐためRefで管理）
  const cursorPositionRef = useRef<CursorPosition | null>(null);

  // 選択状態のRef（手動更新用）
  const selectedIdsRef = useRef<string[]>(selectedIds);

  // 選択状態の同期（autoTrackSelection が有効な場合）
  useEffect(() => {
    if (autoTrackSelection) {
      selectedIdsRef.current = selectedIds;
    }
  }, [selectedIds, autoTrackSelection]);

  // スロットリングされた更新関数を作成
  const throttledUpdate = useMemo(() => {
    if (!onPresenceChange) {
      return null;
    }

    return throttle((presence: Partial<Presence>) => {
      onPresenceChange(presence);
    }, throttleMs);
  }, [onPresenceChange, throttleMs]);

  // カーソル位置の更新
  const updateCursor = useCallback(
    (position: CursorPosition | null) => {
      cursorPositionRef.current = position;

      if (throttledUpdate) {
        const presenceUpdate: Partial<Presence> = {
          cursor: position,
          updatedAt: new Date().toISOString(),
        };

        if (userId) {
          presenceUpdate.userId = userId;
        }

        throttledUpdate(presenceUpdate);
      }
    },
    [throttledUpdate, userId]
  );

  // 選択状態の手動更新
  const updateSelection = useCallback(
    (ids: string[]) => {
      selectedIdsRef.current = ids;

      if (throttledUpdate) {
        const presenceUpdate: Partial<Presence> = {
          selectedObjectIds: ids,
          updatedAt: new Date().toISOString(),
        };

        if (userId) {
          presenceUpdate.userId = userId;
        }

        throttledUpdate(presenceUpdate);
      }
    },
    [throttledUpdate, userId]
  );

  // 選択オブジェクトの変更を監視（autoTrackSelection が有効な場合）
  useEffect(() => {
    if (!autoTrackSelection || !throttledUpdate) {
      return;
    }

    const presenceUpdate: Partial<Presence> = {
      selectedObjectIds: selectedIds,
      updatedAt: new Date().toISOString(),
    };

    if (userId) {
      presenceUpdate.userId = userId;
    }

    throttledUpdate(presenceUpdate);
  }, [selectedIds, throttledUpdate, userId, autoTrackSelection]);

  // 現在のカーソル位置を取得
  const getCursor = useCallback((): CursorPosition | null => {
    return cursorPositionRef.current;
  }, []);

  // 現在の選択オブジェクトIDを取得
  const getSelectedIds = useCallback((): string[] => {
    return autoTrackSelection ? selectedIds : selectedIdsRef.current;
  }, [autoTrackSelection, selectedIds]);

  // 現在のプレゼンス情報を取得
  const getPresence = useCallback((): Partial<Presence> => {
    const presence: Partial<Presence> = {
      cursor: cursorPositionRef.current,
      selectedObjectIds: autoTrackSelection
        ? selectedIds
        : selectedIdsRef.current,
      updatedAt: new Date().toISOString(),
    };

    if (userId) {
      presence.userId = userId;
    }

    return presence;
  }, [userId, autoTrackSelection, selectedIds]);

  return {
    updateCursor,
    getCursor,
    getSelectedIds,
    updateSelection,
    getPresence,
  };
};
