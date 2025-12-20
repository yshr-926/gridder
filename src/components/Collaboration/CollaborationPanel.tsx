import { memo } from 'react';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { ParticipantsList } from './ParticipantsList';
import { cn } from '@/utils/cn';

/**
 * 接続状態に応じたステータスドットの色
 */
const getStatusDotColor = (
  connectionState: 'connected' | 'connecting' | 'reconnecting' | 'disconnected' | 'error'
): string => {
  switch (connectionState) {
    case 'connected':
      return 'bg-green-500';
    case 'connecting':
    case 'reconnecting':
      return 'bg-yellow-500';
    case 'disconnected':
    case 'error':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};

/**
 * 接続状態に応じたステータステキスト
 */
const getStatusText = (
  connectionState: 'connected' | 'connecting' | 'reconnecting' | 'disconnected' | 'error'
): string => {
  switch (connectionState) {
    case 'connected':
      return '接続中';
    case 'connecting':
      return '接続中...';
    case 'reconnecting':
      return '再接続中...';
    case 'disconnected':
      return '切断';
    case 'error':
      return 'エラー';
    default:
      return '不明';
  }
};

/**
 * 共同編集パネルコンポーネント
 *
 * 接続状態の表示と参加者一覧を含む。
 * キャンバスの右上に固定配置される。
 */
export const CollaborationPanel = memo(() => {
  const connectionState = useCollaborationStore((state) => state.connectionState);
  const room = useCollaborationStore((state) => state.room);
  const error = useCollaborationStore((state) => state.error);

  // ルームが存在しない場合は表示しない
  if (!room) {
    return null;
  }

  return (
    <div className="absolute top-4 right-4 w-64 space-y-3 z-10">
      {/* 接続状態 */}
      <div className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              getStatusDotColor(connectionState)
            )}
            aria-hidden="true"
          />
          <span className="text-xs text-gray-600">
            {getStatusText(connectionState)}
          </span>
        </div>
        {error && (
          <p className="mt-2 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* 参加者一覧 */}
      <ParticipantsList />
    </div>
  );
});

CollaborationPanel.displayName = 'CollaborationPanel';
