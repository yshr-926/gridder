import { useRef, useState, useCallback } from 'react';
import { cn } from '@/utils/cn';
import { UploadIcon } from '../icons';

/**
 * FileDropZone Props
 */
interface FileDropZoneProps {
  /** ファイルがドロップされた時のコールバック */
  onFileDrop: (file: File) => void;
  /** 受け付けるファイル拡張子（例: ".json"） */
  accept?: string;
  /** 無効状態 */
  disabled?: boolean;
  /** カスタムクラス名 */
  className?: string;
}

/**
 * ファイルドロップゾーンコンポーネント
 *
 * ドラッグ＆ドロップまたはクリックでファイルを選択できるエリア
 */
export const FileDropZone = ({
  onFileDrop,
  accept = '.json',
  disabled = false,
  className,
}: FileDropZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * ドラッグオーバー時の処理
   */
  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  /**
   * ドラッグリーブ時の処理
   */
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  /**
   * ドロップ時の処理
   */
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        onFileDrop(files[0]);
      }
    },
    [disabled, onFileDrop]
  );

  /**
   * クリック時の処理（ファイル選択ダイアログを開く）
   */
  const handleClick = useCallback(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  }, [disabled]);

  /**
   * ファイル選択時の処理
   */
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFileDrop(files[0]);
      }
      // 同じファイルを再選択できるようにリセット
      e.target.value = '';
    },
    [onFileDrop]
  );

  /**
   * キーボード操作
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      aria-label="ファイルをドロップまたはクリックして選択"
      aria-disabled={disabled}
      className={cn(
        'border-2 border-dashed rounded-lg p-8',
        'flex flex-col items-center justify-center gap-3',
        'transition-colors duration-150 cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
        isDragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <UploadIcon
        className={cn(
          'w-10 h-10',
          isDragging ? 'text-blue-500' : 'text-gray-400'
        )}
      />
      <div className="text-center">
        <p className={cn('text-sm font-medium', isDragging ? 'text-blue-600' : 'text-gray-600')}>
          {isDragging ? 'ファイルをドロップ' : 'ファイルをドラッグ＆ドロップ'}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          またはクリックして選択
        </p>
      </div>

      {/* 隠し input 要素 */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
        aria-hidden="true"
      />
    </div>
  );
};
