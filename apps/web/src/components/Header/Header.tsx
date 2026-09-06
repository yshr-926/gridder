import { Menu } from '@base-ui/react/menu';
import {
  ChevronDown,
  FilePlus2,
  FileText,
  FolderOpen,
  Image,
  Maximize2,
  PenTool,
  Redo2,
  Save,
  SaveAll,
  Share2,
  Undo2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { Tooltip, TooltipProvider } from '../ui';
import { SettingsPanel } from '../SettingsPanel';

interface HeaderProps {
  onNewSketch: () => void;
  onOpenSketch: () => void;
  onSaveSketch: () => void;
  /** "名前を付けて保存" (issue #54, spec §12): always prompts for a destination. */
  onSaveSketchAs: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onAddPolygon: () => void;
  isAddingPolygon: boolean;
  onSharePNG: () => void;
  onShareJPEG: () => void;
  /** "内容に合わせる" (spec §4, issue #46): switch the drawing range back to auto. */
  onFitDrawingBoundsToContent: () => void;
}

interface HeaderActionProps {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  isPressed?: boolean;
}

const iconButtonClassName = cn(
  'inline-flex h-control min-w-control items-center justify-center gap-1.5 rounded-control px-2',
  'text-sm font-medium text-ui-muted transition-colors duration-fast',
  'hover:bg-surface-muted hover:text-ui focus-visible:outline-none',
  'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
  'disabled:cursor-not-allowed disabled:opacity-40'
);

const menuPopupClassName = cn(
  'z-40 min-w-44 origin-[var(--transform-origin)] rounded-panel border border-ui-border bg-surface p-1',
  'transition-[transform,opacity] duration-fast ease-out',
  'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
  'data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:ease-in'
);

const menuItemClassName = cn(
  'flex cursor-default select-none items-center gap-2 rounded-control px-2.5 py-2 text-sm text-ui outline-none',
  'data-[highlighted]:bg-surface-muted'
);

const HeaderAction = ({
  label,
  children,
  onClick,
  disabled = false,
  isPressed,
}: HeaderActionProps) => (
  <Tooltip content={label} position="bottom">
    <button
      type="button"
      className={cn(
        iconButtonClassName,
        isPressed && 'bg-accent-soft text-accent-strong hover:bg-accent-soft'
      )}
      aria-label={label}
      aria-pressed={isPressed}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  </Tooltip>
);

export const Header = ({
  onNewSketch,
  onOpenSketch,
  onSaveSketch,
  onSaveSketchAs,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onAddPolygon,
  isAddingPolygon,
  onSharePNG,
  onShareJPEG,
  onFitDrawingBoundsToContent,
}: HeaderProps) => (
  <TooltipProvider>
    <header className="flex h-header shrink-0 items-center border-b border-ui-border bg-surface px-3">
      <h1 className="mr-4 text-base font-semibold tracking-tight text-ui">Gridder</h1>

      <nav className="flex min-w-0 flex-1 items-center gap-1" aria-label="スケッチ操作">
        <Menu.Root>
          <Tooltip content="ファイル" position="bottom">
            <Menu.Trigger className={iconButtonClassName} aria-label="ファイル">
              <FileText aria-hidden="true" className="size-4" />
              <span>ファイル</span>
              <ChevronDown aria-hidden="true" className="size-3.5" />
            </Menu.Trigger>
          </Tooltip>
          <Menu.Portal>
            <Menu.Positioner side="bottom" align="start" sideOffset={8} className="z-40">
              <Menu.Popup className={menuPopupClassName} aria-label="ファイル操作">
                <Menu.Item className={menuItemClassName} onClick={onNewSketch}>
                  <FilePlus2 aria-hidden="true" className="size-4" />
                  新規スケッチ
                </Menu.Item>
                <Menu.Item className={menuItemClassName} onClick={onOpenSketch}>
                  <FolderOpen aria-hidden="true" className="size-4" />
                  開く
                </Menu.Item>
                <Menu.Item className={menuItemClassName} onClick={onSaveSketch}>
                  <Save aria-hidden="true" className="size-4" />
                  保存
                </Menu.Item>
                <Menu.Item className={menuItemClassName} onClick={onSaveSketchAs}>
                  <SaveAll aria-hidden="true" className="size-4" />
                  名前を付けて保存
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>

        <div className="mx-1 h-5 w-px bg-ui-border" aria-hidden="true" />

        <HeaderAction label="元に戻す" onClick={onUndo} disabled={!canUndo}>
          <Undo2 aria-hidden="true" className="size-4" />
        </HeaderAction>
        <HeaderAction label="やり直す" onClick={onRedo} disabled={!canRedo}>
          <Redo2 aria-hidden="true" className="size-4" />
        </HeaderAction>
        <HeaderAction label="ポリゴンを追加" onClick={onAddPolygon} isPressed={isAddingPolygon}>
          <PenTool aria-hidden="true" className="size-4" />
        </HeaderAction>
        <HeaderAction label="内容に合わせる" onClick={onFitDrawingBoundsToContent}>
          <Maximize2 aria-hidden="true" className="size-4" />
        </HeaderAction>

        <div className="ml-auto flex items-center gap-1">
          <Menu.Root>
            <Tooltip content="共有" position="bottom">
              <Menu.Trigger
                className={cn(
                  iconButtonClassName,
                  'bg-accent text-white hover:bg-accent-strong hover:text-white'
                )}
                aria-label="共有"
              >
                <Share2 aria-hidden="true" className="size-4" />
                <span>共有</span>
                <ChevronDown aria-hidden="true" className="size-3.5" />
              </Menu.Trigger>
            </Tooltip>
            <Menu.Portal>
              <Menu.Positioner side="bottom" align="end" sideOffset={8} className="z-40">
                <Menu.Popup className={menuPopupClassName} aria-label="共有画像の形式">
                  <Menu.Item className={menuItemClassName} onClick={onSharePNG}>
                    <Image aria-hidden="true" className="size-4" />
                    PNG画像
                  </Menu.Item>
                  <Menu.Item className={menuItemClassName} onClick={onShareJPEG}>
                    <Image aria-hidden="true" className="size-4" />
                    JPEG画像
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>

          <SettingsPanel />
        </div>
      </nav>
    </header>
  </TooltipProvider>
);
