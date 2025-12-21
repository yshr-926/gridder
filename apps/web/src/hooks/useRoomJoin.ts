/**
 * useRoomJoin - ルーム参加フック
 *
 * ルームへの参加フローを統合的に管理する。
 * - ルームの存在確認
 * - パスフレーズ認証
 * - WebSocket 接続
 * - エラーハンドリング
 */

import { useState, useCallback } from 'react';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { roomsApi, ApiError } from '@/services/api';
import { isDebug } from '@/config/environment';

/**
 * ルーム参加オプション
 */
export interface JoinRoomOptions {
  /** 表示名 */
  displayName: string;
  /** パスフレーズ（パスフレーズ設定済みルームの場合） */
  passphrase?: string;
  /** ルームが存在しない場合に作成するか */
  createIfNotExists?: boolean;
}

/**
 * ルーム参加結果
 */
export interface JoinRoomResult {
  /** 成功したかどうか */
  success: boolean;
  /** ルーム ID */
  roomId?: string;
  /** エラーメッセージ */
  error?: string;
  /** パスフレーズが必要かどうか */
  requiresPassphrase?: boolean;
}

/**
 * useRoomJoin フックの戻り値
 */
export interface UseRoomJoinResult {
  /** 参加処理中かどうか */
  isJoining: boolean;
  /** ルーム情報取得中かどうか */
  isCheckingRoom: boolean;
  /** エラーメッセージ */
  error: string | null;
  /** パスフレーズが必要かどうか */
  requiresPassphrase: boolean;
  /** ルームに参加 */
  joinRoom: (roomId: string, options: JoinRoomOptions) => Promise<JoinRoomResult>;
  /** エラーをクリア */
  clearError: () => void;
}

/**
 * ルーム参加フック
 *
 * ルームへの参加を簡単に行うためのフック。
 * パスフレーズ確認、認証、WebSocket 接続を一連のフローで実行する。
 *
 * @example
 * ```tsx
 * const { isJoining, error, joinRoom, requiresPassphrase } = useRoomJoin();
 *
 * const handleJoin = async () => {
 *   const result = await joinRoom('room-123', {
 *     displayName: 'User1',
 *     passphrase: 'secret',
 *   });
 *   if (result.success) {
 *     // 参加成功
 *   }
 * };
 * ```
 */
export const useRoomJoin = (): UseRoomJoinResult => {
  const [isJoining, setIsJoining] = useState(false);
  const [isCheckingRoom, setIsCheckingRoom] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresPassphrase, setRequiresPassphrase] = useState(false);

  const connect = useCollaborationStore((state) => state.connect);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const joinRoom = useCallback(
    async (roomId: string, options: JoinRoomOptions): Promise<JoinRoomResult> => {
      const { displayName, passphrase, createIfNotExists = false } = options;

      setIsJoining(true);
      setError(null);
      setRequiresPassphrase(false);

      if (isDebug()) {
        console.log('[useRoomJoin] Joining room:', roomId, { displayName, createIfNotExists });
      }

      try {
        // 1. ルームの存在確認とパスフレーズ要否のチェック
        setIsCheckingRoom(true);
        let roomExists = false;
        let needsPassphrase = false;

        try {
          const roomInfo = await roomsApi.getRoomInfo(roomId);
          roomExists = true;
          needsPassphrase = roomInfo.hasPassphrase;

          if (isDebug()) {
            console.log('[useRoomJoin] Room info:', roomInfo);
          }
        } catch (err) {
          if (err instanceof ApiError && err.code === 'ROOM_NOT_FOUND') {
            roomExists = false;
            if (isDebug()) {
              console.log('[useRoomJoin] Room not found');
            }
          } else {
            throw err;
          }
        } finally {
          setIsCheckingRoom(false);
        }

        // 2. ルームが存在しない場合の処理
        if (!roomExists) {
          if (!createIfNotExists) {
            const errorMessage = 'ルームが見つかりません';
            setError(errorMessage);
            return {
              success: false,
              error: errorMessage,
            };
          }
          // ルームは WebSocket 接続時に自動作成されるため、ここでは何もしない
          if (isDebug()) {
            console.log('[useRoomJoin] Room will be created on connect');
          }
        }

        // 3. パスフレーズが必要だが提供されていない場合
        if (needsPassphrase && !passphrase) {
          setRequiresPassphrase(true);
          const errorMessage = 'パスフレーズを入力してください';
          setError(errorMessage);
          return {
            success: false,
            error: errorMessage,
            requiresPassphrase: true,
          };
        }

        // 4. 接続を開始
        if (isDebug()) {
          console.log('[useRoomJoin] Connecting to room...');
        }

        await connect(roomId, displayName, passphrase);

        if (isDebug()) {
          console.log('[useRoomJoin] Successfully joined room:', roomId);
        }

        return {
          success: true,
          roomId,
        };
      } catch (err) {
        let errorMessage = '接続に失敗しました';

        if (err instanceof ApiError) {
          if (err.code === 'INVALID_PASSPHRASE') {
            errorMessage = 'パスフレーズが正しくありません';
            setRequiresPassphrase(true);
          } else if (err.code === 'PASSPHRASE_REQUIRED') {
            errorMessage = 'パスフレーズを入力してください';
            setRequiresPassphrase(true);
          } else {
            errorMessage = err.message;
          }
        } else if (err instanceof Error) {
          errorMessage = err.message;
        }

        if (isDebug()) {
          console.error('[useRoomJoin] Error:', errorMessage, err);
        }

        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
          requiresPassphrase,
        };
      } finally {
        setIsJoining(false);
      }
    },
    [connect, requiresPassphrase]
  );

  return {
    isJoining,
    isCheckingRoom,
    error,
    requiresPassphrase,
    joinRoom,
    clearError,
  };
};
