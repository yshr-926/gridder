/**
 * 同期状態インジケーター
 *
 * 同期中、同期完了、エラーの状態を視覚的に表示する。
 * ヘッダーまたはステータスバーに配置して使用する。
 */

import { memo } from 'react';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { cn } from '@/utils/cn';

/**
 * 同期状態に応じたアイコンとテキストを取得
 */
const getSyncStatusDisplay = (
  syncState: 'idle' | 'syncing' | 'error',
  connectionState: 'connected' | 'connecting' | 'reconnecting' | 'disconnected' | 'error'
): { dotColor: string; text: string; textColor: string } => {
  // オフライン時（未接続）
  if (connectionState === 'disconnected') {
    return {
      dotColor: 'bg-gray-400',
      text: 'オフライン',
      textColor: 'text-gray-500',
    };
  }

  // 接続中・再接続中
  if (connectionState === 'connecting' || connectionState === 'reconnecting') {
    return {
      dotColor: 'bg-yellow-500 animate-pulse',
      text: '接続中...',
      textColor: 'text-gray-500',
    };
  }

  // 接続エラー
  if (connectionState === 'error') {
    return {
      dotColor: 'bg-red-500',
      text: '接続エラー',
      textColor: 'text-red-500',
    };
  }

  // 同期状態に応じた表示
  switch (syncState) {
    case 'idle':
      return {
        dotColor: 'bg-green-500',
        text: '同期済み',
        textColor: 'text-gray-500',
      };
    case 'syncing':
      return {
        dotColor: 'bg-blue-500 animate-pulse',
        text: '同期中...',
        textColor: 'text-gray-500',
      };
    case 'error':
      return {
        dotColor: 'bg-red-500',
        text: '同期エラー',
        textColor: 'text-red-500',
      };
    default:
      return {
        dotColor: 'bg-gray-400',
        text: '不明',
        textColor: 'text-gray-500',
      };
  }
};

interface SyncIndicatorProps {
  /** コンパクト表示（テキストなし） */
  compact?: boolean;
  /** 追加のクラス名 */
  className?: string;
}

/**
 * 同期状態インジケーター
 *
 * - idle: 緑のドット - 同期済み
 * - syncing: 青いアニメーション付きドット - 同期中
 * - error: 赤いドット - 同期エラー
 * - オフライン: グレーのドット - オフライン
 */
export const SyncIndicator = memo(({ compact = false, className }: SyncIndicatorProps) => {
  const syncState = useCollaborationStore((state) => state.syncState);
  const connectionState = useCollaborationStore((state) => state.connectionState);
  const room = useCollaborationStore((state) => state.room);

  // ルームに接続していない場合は表示しない
  if (!room) {
    return null;
  }

  const { dotColor, text, textColor } = getSyncStatusDisplay(syncState, connectionState);

  return (
    <div
      className={cn('flex items-center gap-1.5', className)}
      role="status"
      aria-label={`同期状態: ${text}`}
    >
      <span
        className={cn('w-2 h-2 rounded-full', dotColor)}
        aria-hidden="true"
      />
      {!compact && (
        <span className={cn('text-xs', textColor)}>
          {text}
        </span>
      )}
    </div>
  );
});

SyncIndicator.displayName = 'SyncIndicator';
