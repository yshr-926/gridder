import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '../ui';
import { CloseIcon } from '../icons';
import { cn } from '@/utils/cn';

/**
 * 表示名保存用のLocalStorageキー
 */
const STORAGE_KEY = 'gridder_display_name';

/**
 * 表示名の最大文字数
 */
const MAX_NAME_LENGTH = 20;

/**
 * DisplayNameDialog Props
 */
interface DisplayNameDialogProps {
  /** ダイアログが開いているかどうか */
  isOpen: boolean;
  /** 表示名送信時のコールバック */
  onSubmit: (displayName: string) => void;
  /** キャンセル時のコールバック */
  onCancel: () => void;
}

/**
 * LocalStorageから表示名を読み込む
 * エラー時はnullを返す
 */
const loadSavedName = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    console.error('Failed to load display name from localStorage');
    return null;
  }
};

/**
 * LocalStorageに表示名を保存する
 * エラー時はコンソールに出力
 */
const saveName = (name: string): void => {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    console.error('Failed to save display name to localStorage');
  }
};

/**
 * デフォルト表示名を生成する
 * Guest-XXXX 形式（4文字のランダム英数字）
 */
const generateDefaultName = (): string => {
  return `Guest-${Math.random().toString(36).substring(2, 6)}`;
};

/**
 * 表示名設定ダイアログコンポーネント
 *
 * 共同編集参加時に表示名を入力するモーダルダイアログ。
 * LocalStorageに名前を保存し、次回接続時に再利用する。
 */
export const DisplayNameDialog = ({
  isOpen,
  onSubmit,
  onCancel,
}: DisplayNameDialogProps) => {
  // Initialize with saved name from localStorage (lazy initialization)
  const [name, setName] = useState(() => loadSavedName() || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const prevIsOpenRef = useRef(isOpen);

  // Re-load saved name when dialog opens (after being closed)
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      // Dialog just opened - load saved name if we don't have one
      const savedName = loadSavedName();
      if (savedName && !name) {
        // Use a ref-based approach to avoid the eslint warning
        // The name will be loaded on next render cycle
        requestAnimationFrame(() => {
          setName(savedName);
        });
      }
      // Focus the input
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, name]);

  // Escapeキーでキャンセル
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      // 空白のみまたは空の場合はデフォルト名を生成
      const trimmedName = name.trim();
      const finalName = trimmedName || generateDefaultName();
      saveName(finalName);
      onSubmit(finalName);
    },
    [name, onSubmit]
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  }, []);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onCancel();
      }
    },
    [onCancel]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="display-name-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleOverlayClick}
    >
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      {/* ダイアログ本体 */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-sm mx-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2
            id="display-name-dialog-title"
            className="text-lg font-semibold text-gray-800"
          >
            共同編集に参加
          </h2>
          <button
            onClick={onCancel}
            className={cn(
              'p-1 rounded-md transition-colors',
              'hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
            )}
            aria-label="閉じる"
          >
            <CloseIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* コンテンツ */}
        <form onSubmit={handleSubmit}>
          <div className="p-4">
            <div className="mb-4">
              <label
                htmlFor="displayName"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                表示名
              </label>
              <input
                ref={inputRef}
                id="displayName"
                type="text"
                value={name}
                onChange={handleChange}
                placeholder="あなたの名前を入力"
                className={cn(
                  'w-full px-3 py-2',
                  'text-sm text-gray-800',
                  'bg-white border border-gray-300 rounded-md',
                  'placeholder:text-gray-400',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                )}
                maxLength={MAX_NAME_LENGTH}
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-gray-500">
                他の参加者に表示される名前です（最大{MAX_NAME_LENGTH}文字）
              </p>
            </div>
          </div>

          {/* フッター */}
          <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
            <Button type="button" variant="secondary" size="md" onClick={onCancel}>
              キャンセル
            </Button>
            <Button type="submit" variant="primary" size="md">
              参加
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
