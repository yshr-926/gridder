import { useCallback, useEffect } from 'react';
import { cn } from '@/utils';

/**
 * Keyboard shortcut definition
 */
interface KeyboardShortcut {
  key: string;
  description: string;
  category: 'shape' | 'action' | 'navigation';
}

/**
 * All available keyboard shortcuts
 */
const SHORTCUTS: KeyboardShortcut[] = [
  // Shape shortcuts
  { key: 'P', description: 'ポリゴン作成', category: 'shape' },
  { key: 'Enter', description: 'ポリゴンを確定', category: 'shape' },
  { key: 'Escape', description: '操作を取り消す', category: 'shape' },
  { key: 'R', description: '90度回転（時計回り）', category: 'shape' },
  { key: 'Shift + R', description: '90度回転（反時計回り）', category: 'shape' },

  // Action shortcuts
  { key: 'Delete / Backspace', description: '選択図形を削除', category: 'action' },
  { key: 'Ctrl/Cmd + C', description: 'コピー', category: 'action' },
  { key: 'Ctrl/Cmd + V', description: '貼り付け', category: 'action' },
  { key: 'Ctrl/Cmd + D', description: '複製', category: 'action' },
  { key: 'Ctrl/Cmd + Z', description: '元に戻す', category: 'action' },
  { key: 'Ctrl/Cmd + Shift + Z', description: 'やり直し', category: 'action' },
  { key: 'Ctrl/Cmd + ]', description: '前面へ', category: 'action' },
  { key: 'Ctrl/Cmd + [', description: '背面へ', category: 'action' },
  { key: 'Ctrl/Cmd + Shift + ]', description: '最前面へ', category: 'action' },
  { key: 'Ctrl/Cmd + Shift + [', description: '最背面へ', category: 'action' },
  { key: 'Ctrl/Cmd + G', description: 'グループ化', category: 'action' },
  { key: 'Ctrl/Cmd + Shift + G', description: 'グループ解除', category: 'action' },

  // Navigation shortcuts
  { key: 'Shift + クリック', description: '追加選択', category: 'navigation' },
  { key: 'Space + Drag', description: 'キャンバスをパン', category: 'navigation' },
  { key: 'Mouse Wheel', description: 'ズームイン/アウト', category: 'navigation' },
  { key: '?', description: 'このヘルプを表示', category: 'navigation' },
];

/**
 * Category labels
 */
const CATEGORY_LABELS: Record<KeyboardShortcut['category'], string> = {
  shape: '図形の作成と変形',
  action: 'アクション',
  navigation: 'ナビゲーション',
};

/**
 * KeyboardShortcutsHelp Props
 */
interface KeyboardShortcutsHelpProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
}

/**
 * KeyboardShortcutsHelp component
 * Modal dialog showing all keyboard shortcuts
 */
export const KeyboardShortcutsHelp = ({ isOpen, onClose }: KeyboardShortcutsHelpProps) => {
  // Handle escape key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Trap focus within modal
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  // Group shortcuts by category
  const groupedShortcuts = SHORTCUTS.reduce(
    (acc, shortcut) => {
      if (!acc[shortcut.category]) {
        acc[shortcut.category] = [];
      }
      acc[shortcut.category].push(shortcut);
      return acc;
    },
    {} as Record<KeyboardShortcut['category'], KeyboardShortcut[]>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
        role="document"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 id="shortcuts-title" className="text-lg font-semibold text-gray-900">
            キーボードショートカット
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            aria-label="閉じる"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {(['shape', 'action', 'navigation'] as const).map(category => (
            <div key={category}>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                {CATEGORY_LABELS[category]}
              </h3>
              <dl className="space-y-2">
                {groupedShortcuts[category]?.map(shortcut => (
                  <div key={shortcut.key} className="flex items-center justify-between">
                    <dt className="text-sm text-gray-700">{shortcut.description}</dt>
                    <dd>
                      <kbd
                        className={cn(
                          'inline-flex items-center px-2 py-1',
                          'text-xs font-mono text-gray-800',
                          'bg-gray-100 border border-gray-300 rounded',
                          'shadow-sm'
                        )}
                      >
                        {shortcut.key}
                      </kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">Escキーまたは外側をクリックして閉じる</p>
        </div>
      </div>
    </div>
  );
};
