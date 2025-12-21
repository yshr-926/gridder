/**
 * ルーム作成フック
 *
 * nanoid(24) で推測困難なルームIDを生成し、共同編集ルームを作成する。
 */

import { useCallback } from 'react';
import { nanoid } from 'nanoid';
import { useCollaborationStore } from '@/stores/collaborationStore';

/**
 * ルームID の長さ（推測困難性のため24文字）
 */
const ROOM_ID_LENGTH = 24;

/**
 * useRoomCreation の戻り値の型
 */
interface UseRoomCreationResult {
  /** 新しいルームを作成して接続する */
  createRoom: (displayName: string, passphrase?: string) => Promise<string>;
  /** ルーム作成中かどうか */
  isCreating: boolean;
}

/**
 * ルーム作成フック
 *
 * 新しい共同編集ルームを作成し、接続する機能を提供する。
 *
 * @returns ルーム作成関数と作成中状態
 *
 * @example
 * ```tsx
 * const { createRoom, isCreating } = useRoomCreation();
 *
 * const handleCreate = async () => {
 *   const roomId = await createRoom('My Name');
 *   // roomId を使って共有URLを生成
 *   const shareUrl = `${window.location.origin}/room/${roomId}`;
 * };
 * ```
 */
export const useRoomCreation = (): UseRoomCreationResult => {
  const { connect, connectionState } = useCollaborationStore();

  const isCreating = connectionState === 'connecting';

  const createRoom = useCallback(
    async (displayName: string, passphrase?: string): Promise<string> => {
      const roomId = nanoid(ROOM_ID_LENGTH);
      await connect(roomId, displayName, passphrase);
      return roomId;
    },
    [connect]
  );

  return { createRoom, isCreating };
};
