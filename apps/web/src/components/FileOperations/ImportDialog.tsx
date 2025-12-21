import { useState, useCallback, useEffect } from 'react';
import { FileDropZone } from './FileDropZone';
import { Button } from '../ui';
import { CloseIcon, AlertCircleIcon, SpinnerIcon } from '../icons';
import { importProjectFromFile, applyProjectData } from '@/features/export/importProject';
import { cn } from '@/utils/cn';

/**
 * ImportDialog Props
 */
interface ImportDialogProps {
  /** ダイアログが開いているかどうか */
  isOpen: boolean;
  /** 閉じる時のコールバック */
  onClose: () => void;
  /** インポート成功時のコールバック */
  onImportSuccess?: () => void;
}

/**
 * インポートダイアログコンポーネント
 *
 * ファイルドロップゾーンとエラー表示を含むモーダルダイアログ
 */
export const ImportDialog = ({
  isOpen,
  onClose,
  onImportSuccess,
}: ImportDialogProps) => {
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * ダイアログが開いたときにエラーをリセット
   */
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsImporting(false);
    }
  }, [isOpen]);

  /**
   * Escape キーでダイアログを閉じる
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isImporting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isImporting, onClose]);

  /**
   * ファイルドロップ時の処理
   */
  const handleFileDrop = useCallback(
    async (file: File) => {
      // 拡張子チェック
      if (!file.name.toLowerCase().endsWith('.json')) {
        setError('JSONファイル（.json）を選択してください。');
        return;
      }

      setIsImporting(true);
      setError(null);

      try {
        const result = await importProjectFromFile(file);

        if (result.success && result.data) {
          applyProjectData(result.data);
          onImportSuccess?.();
          onClose();
        } else {
          setError(result.error || 'インポートに失敗しました。');
        }
      } catch {
        setError('予期しないエラーが発生しました。');
      } finally {
        setIsImporting(false);
      }
    },
    [onClose, onImportSuccess]
  );

  /**
   * オーバーレイクリック時の処理
   */
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget && !isImporting) {
        onClose();
      }
    },
    [isImporting, onClose]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleOverlayClick}
    >
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      {/* ダイアログ本体 */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 id="import-dialog-title" className="text-lg font-semibold text-gray-800">
            プロジェクトを開く
          </h2>
          <button
            onClick={onClose}
            disabled={isImporting}
            className={cn(
              'p-1 rounded-md transition-colors',
              'hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500',
              isImporting && 'opacity-50 cursor-not-allowed'
            )}
            aria-label="閉じる"
          >
            <CloseIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-4">
          {/* 警告メッセージ */}
          <p className="text-sm text-gray-600 mb-4">
            JSONファイルを選択してプロジェクトを読み込みます。
            現在の作業内容は失われます。
          </p>

          {/* ファイルドロップゾーン */}
          <FileDropZone
            onFileDrop={handleFileDrop}
            accept=".json"
            disabled={isImporting}
            className="mb-4"
          />

          {/* ローディング表示 */}
          {isImporting && (
            <div className="flex items-center justify-center gap-2 text-blue-600 mb-4">
              <SpinnerIcon className="w-5 h-5 animate-spin" />
              <span className="text-sm">インポート中...</span>
            </div>
          )}

          {/* エラー表示 */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 mb-4">
              <AlertCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isImporting}
          >
            キャンセル
          </Button>
        </div>
      </div>
    </div>
  );
};
