import { Button } from '../ui';
import { PlusIcon, FolderOpenIcon, SaveIcon } from '../icons';

interface HeaderProps {
  onNewProject: () => void;
  onOpenProject: () => void;
  onSaveProject: () => void;
}

export const Header = ({ onNewProject, onOpenProject, onSaveProject }: HeaderProps) => {
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
      </nav>
    </header>
  );
};
