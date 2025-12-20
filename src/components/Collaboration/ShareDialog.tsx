/**
 * 共有ダイアログコンポーネント
 *
 * プロジェクトの共有URLを表示し、クリップボードへのコピー機能と
 * パスフレーズ設定機能を提供する。
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '../ui';
import { CloseIcon } from '../icons';
import { cn } from '@/utils/cn';
import { useCollaborationStore } from '@/stores/collaborationStore';

/**
 * ShareDialog Props
 */
interface ShareDialogProps {
  /** ダイアログが開いているかどうか */
  isOpen: boolean;
  /** ダイアログを閉じる際のコールバック */
  onClose: () => void;
}

/**
 * パスフレーズ有無確認APIのレスポンス型
 */
interface HasPassphraseResponse {
  hasPassphrase: boolean;
}

/**
 * パスフレーズ設定APIのレスポンス型
 */
interface SetPassphraseResponse {
  hasPassphrase: boolean;
}

/**
 * エラーレスポンス型
 */
interface ErrorResponse {
  error: string;
}

/**
 * 共有ダイアログコンポーネント
 *
 * 共有URLの表示、クリップボードコピー、パスフレーズ設定機能を提供する。
 *
 * @example
 * ```tsx
 * <ShareDialog
 *   isOpen={isShareDialogOpen}
 *   onClose={() => setIsShareDialogOpen(false)}
 * />
 * ```
 */
export const ShareDialog = ({ isOpen, onClose }: ShareDialogProps) => {
  // ステート
  const [copied, setCopied] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [currentPassphrase, setCurrentPassphrase] = useState('');
  const [hasPassphrase, setHasPassphrase] = useState(false);
  const [isSettingPassphrase, setIsSettingPassphrase] = useState(false);
  const [passphraseError, setPassphraseError] = useState<string | null>(null);
  const [isCheckingPassphrase, setIsCheckingPassphrase] = useState(false);

  // Refs
  const urlInputRef = useRef<HTMLInputElement>(null);
  const prevIsOpenRef = useRef(isOpen);

  // Store
  const { room } = useCollaborationStore();

  // 共有URL
  const shareUrl = room
    ? `${window.location.origin}/room/${room.id}`
    : null;

  // パスフレーズ有無を確認
  useEffect(() => {
    if (room?.id && isOpen) {
      setIsCheckingPassphrase(true);
      fetch(`/api/rooms/${room.id}/has-passphrase`)
        .then((res) => {
          if (!res.ok) {
            throw new Error('Failed to check passphrase status');
          }
          return res.json() as Promise<HasPassphraseResponse>;
        })
        .then((data) => setHasPassphrase(data.hasPassphrase))
        .catch(() => {
          // API がまだ存在しない場合やエラー時は false として扱う
          setHasPassphrase(false);
        })
        .finally(() => {
          setIsCheckingPassphrase(false);
        });
    }
  }, [room?.id, isOpen]);

  // ダイアログが開いたときにURL入力にフォーカス
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      requestAnimationFrame(() => {
        urlInputRef.current?.focus();
        urlInputRef.current?.select();
      });
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  // ダイアログが閉じたときにステートをリセット
  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      setPassphrase('');
      setCurrentPassphrase('');
      setPassphraseError(null);
    }
  }, [isOpen]);

  // Escapeキーでダイアログを閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // クリップボードにコピー
  const handleCopy = useCallback(async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // クリップボードAPIが利用できない場合のフォールバック
      try {
        urlInputRef.current?.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        console.error('Failed to copy URL:', error);
        setPassphraseError('URLのコピーに失敗しました');
      }
    }
  }, [shareUrl]);

  // パスフレーズを設定
  const handleSetPassphrase = useCallback(async () => {
    if (!room?.id) return;

    // パスフレーズが既に設定されている場合、現在のパスフレーズが必要
    if (hasPassphrase && !currentPassphrase) {
      setPassphraseError('現在のパスフレーズを入力してください');
      return;
    }

    // 新しいパスフレーズが空の場合は設定しない（解除には専用ボタンを使用）
    if (!passphrase.trim()) {
      setPassphraseError('新しいパスフレーズを入力してください');
      return;
    }

    setIsSettingPassphrase(true);
    setPassphraseError(null);

    try {
      const res = await fetch(`/api/rooms/${room.id}/passphrase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passphrase: passphrase,
          currentToken: hasPassphrase ? currentPassphrase : undefined,
        }),
      });

      if (!res.ok) {
        const errorData = (await res.json()) as ErrorResponse;
        throw new Error(errorData.error || 'Failed to set passphrase');
      }

      const data = (await res.json()) as SetPassphraseResponse;
      setHasPassphrase(data.hasPassphrase);
      setPassphrase('');
      setCurrentPassphrase('');
    } catch (error) {
      setPassphraseError(
        error instanceof Error ? error.message : '設定に失敗しました'
      );
    } finally {
      setIsSettingPassphrase(false);
    }
  }, [room?.id, passphrase, hasPassphrase, currentPassphrase]);

  // パスフレーズを解除
  const handleClearPassphrase = useCallback(async () => {
    if (!room?.id) return;

    if (!currentPassphrase) {
      setPassphraseError('解除するには現在のパスフレーズが必要です');
      return;
    }

    setIsSettingPassphrase(true);
    setPassphraseError(null);

    try {
      const res = await fetch(`/api/rooms/${room.id}/passphrase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passphrase: null,
          currentToken: currentPassphrase,
        }),
      });

      if (!res.ok) {
        const errorData = (await res.json()) as ErrorResponse;
        throw new Error(errorData.error || 'Failed to clear passphrase');
      }

      setHasPassphrase(false);
      setPassphrase('');
      setCurrentPassphrase('');
    } catch (error) {
      setPassphraseError(
        error instanceof Error ? error.message : '解除に失敗しました'
      );
    } finally {
      setIsSettingPassphrase(false);
    }
  }, [room?.id, currentPassphrase]);

  // オーバーレイクリックでダイアログを閉じる
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleOverlayClick}
    >
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      {/* ダイアログ本体 */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2
            id="share-dialog-title"
            className="text-lg font-semibold text-gray-800"
          >
            プロジェクトを共有
          </h2>
          <button
            onClick={onClose}
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
        <div className="p-4 space-y-4">
          {/* 共有URL */}
          <div>
            <label
              htmlFor="shareUrl"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              共有URL
            </label>
            <div className="flex gap-2">
              <input
                ref={urlInputRef}
                id="shareUrl"
                type="text"
                value={shareUrl || ''}
                readOnly
                className={cn(
                  'flex-1 px-3 py-2',
                  'text-sm text-gray-600',
                  'bg-gray-100 border border-gray-300 rounded-md',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                )}
              />
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleCopy}
                disabled={!shareUrl}
              >
                {copied ? 'コピー完了' : 'コピー'}
              </Button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              このURLを共有すると、他の人も編集に参加できます
            </p>
          </div>

          {/* パスフレーズ設定 */}
          <div className="p-3 bg-gray-50 rounded-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              パスフレーズ保護（オプション）
            </label>

            {/* パスフレーズ状態表示 */}
            {isCheckingPassphrase ? (
              <p className="mb-2 text-xs text-gray-500">確認中...</p>
            ) : hasPassphrase ? (
              <p className="mb-2 text-xs text-green-600">
                パスフレーズが設定されています
              </p>
            ) : null}

            {/* 現在のパスフレーズ入力（既に設定されている場合のみ） */}
            {hasPassphrase && (
              <div className="mb-2">
                <input
                  type="password"
                  value={currentPassphrase}
                  onChange={(e) => setCurrentPassphrase(e.target.value)}
                  placeholder="現在のパスフレーズ"
                  className={cn(
                    'w-full px-3 py-2',
                    'text-sm text-gray-800',
                    'bg-white border border-gray-300 rounded-md',
                    'placeholder:text-gray-400',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                  )}
                  autoComplete="current-password"
                />
              </div>
            )}

            {/* 新しいパスフレーズ入力 */}
            <div className="flex gap-2">
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder={
                  hasPassphrase ? '新しいパスフレーズ' : 'パスフレーズを設定'
                }
                className={cn(
                  'flex-1 px-3 py-2',
                  'text-sm text-gray-800',
                  'bg-white border border-gray-300 rounded-md',
                  'placeholder:text-gray-400',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                )}
                autoComplete="new-password"
              />
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleSetPassphrase}
                disabled={isSettingPassphrase}
              >
                {isSettingPassphrase
                  ? '...'
                  : hasPassphrase
                    ? '変更'
                    : '設定'}
              </Button>
            </div>

            {/* パスフレーズ解除ボタン */}
            {hasPassphrase && (
              <button
                type="button"
                onClick={handleClearPassphrase}
                disabled={isSettingPassphrase}
                className={cn(
                  'mt-2 text-xs text-red-600',
                  'hover:underline',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                パスフレーズを解除
              </button>
            )}

            {/* エラーメッセージ */}
            {passphraseError && (
              <p className="mt-1 text-xs text-red-600" role="alert">
                {passphraseError}
              </p>
            )}

            <p className="mt-2 text-xs text-gray-500">
              設定すると、参加時にパスフレーズの入力が必要になります
            </p>
          </div>
        </div>

        {/* フッター */}
        <div className="flex justify-end p-4 border-t border-gray-200">
          <Button type="button" variant="secondary" size="md" onClick={onClose}>
            閉じる
          </Button>
        </div>
      </div>
    </div>
  );
};
