import { Button } from '../ui';
import { PlusIcon, FolderOpenIcon, SaveIcon, ShareIcon, UsersIcon } from '../icons';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { SyncIndicator } from '../Collaboration/SyncIndicator';

interface HeaderProps {
  onNewProject: () => void;
  onOpenProject: () => void;
  onSaveProject: () => void;
  onShare: () => void;
}

export const Header = ({ onNewProject, onOpenProject, onSaveProject, onShare }: HeaderProps) => {
  const { room, collaborators, connectionState } = useCollaborationStore();
  const isConnected = connectionState === 'connected';
  const participantCount = collaborators.length + (room ? 1 : 0); // 自分 + 他の参加者

  return (
    <header className="h-12 border-b border-gray-200 flex items-center justify-between px-4 bg-white">
      {/* Logo / Title */}
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold text-gray-800">Gridder</h1>
      </div>

      {/* Menu Actions */}
      <nav className="flex items-center gap-1" aria-label="ファイル操作">
        <Button variant="ghost" size="sm" onClick={onNewProject} aria-label="新規プロジェクト">
          <PlusIcon className="w-4 h-4 mr-1" />
          新規
        </Button>
        <Button variant="ghost" size="sm" onClick={onOpenProject} aria-label="プロジェクトを開く">
          <FolderOpenIcon className="w-4 h-4 mr-1" />
          開く
        </Button>
        <Button variant="ghost" size="sm" onClick={onSaveProject} aria-label="プロジェクトを保存">
          <SaveIcon className="w-4 h-4 mr-1" />
          保存
        </Button>

        {/* 共有ボタン */}
        <div className="ml-2 pl-2 border-l border-gray-200 flex items-center gap-3">
          {/* 同期状態インジケーター（接続中のみ表示） */}
          {isConnected && <SyncIndicator compact />}

          <Button
            variant={isConnected ? 'primary' : 'ghost'}
            size="sm"
            onClick={onShare}
            aria-label="共同編集"
          >
            {isConnected ? (
              <>
                <UsersIcon className="w-4 h-4 mr-1" />
                {participantCount}人で編集中
              </>
            ) : (
              <>
                <ShareIcon className="w-4 h-4 mr-1" />
                共有
              </>
            )}
          </Button>
        </div>
      </nav>
    </header>
  );
};
