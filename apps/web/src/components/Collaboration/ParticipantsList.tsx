import { memo } from 'react';
import { useCollaborationStore } from '@/stores/collaborationStore';

/**
 * 参加者一覧コンポーネント
 *
 * 共同編集セッションの全参加者を表示する。
 * 自分には「（あなた）」のサフィックスを付けて区別する。
 */
export const ParticipantsList = memo(() => {
  const self = useCollaborationStore((state) => state.self);
  const collaborators = useCollaborationStore((state) => state.collaborators);

  if (!self) {
    return null;
  }

  const totalCount = collaborators.length + 1;

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">
        参加者（{totalCount}）
      </h3>

      <ul className="space-y-2">
        {/* 自分 */}
        <li className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: self.color }}
            aria-hidden="true"
          />
          <span className="text-sm text-gray-800 truncate">
            {self.displayName}
            <span className="ml-1 text-xs text-gray-500">（あなた）</span>
          </span>
        </li>

        {/* 他の参加者 */}
        {collaborators.map((collaborator) => (
          <li key={collaborator.id} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: collaborator.color }}
              aria-hidden="true"
            />
            <span className="text-sm text-gray-800 truncate">
              {collaborator.displayName}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
});

ParticipantsList.displayName = 'ParticipantsList';
