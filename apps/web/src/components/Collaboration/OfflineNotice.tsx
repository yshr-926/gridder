/**
 * オフライン通知コンポーネント
 *
 * ネットワーク接続状態を監視し、オフライン時やオンライン復帰時に
 * ユーザーに通知を表示する。
 *
 * 機能:
 * - オフライン時: 黄色の警告バナーを表示
 * - オンライン復帰時: 緑色の成功バナーを一時的に表示
 * - Yjsが自動的にオフライン中の変更をマージすることを説明
 */

import { memo, useEffect, useState, useCallback, useRef } from 'react';
import { useCollaborationStore } from '@/stores/collaborationStore';

/**
 * オフライン通知の状態
 */
type NoticeState = 'hidden' | 'offline' | 'reconnected';

/**
 * オフライン通知コンポーネント
 *
 * 接続状態を監視し、適切な通知を表示する。
 */
export const OfflineNotice = memo(() => {
  const connectionState = useCollaborationStore((state) => state.connectionState);
  const [noticeState, setNoticeState] = useState<NoticeState>('hidden');
  const wasOfflineRef = useRef(false);
  const prevConnectionStateRef = useRef(connectionState);

  // 接続状態の変化を監視
  // NOTE: これは意図的なuseEffect内でのsetStateです。
  // 外部状態（WebSocket接続）の変化に応じてUIを更新するために必要です。
  useEffect(() => {
    // 前回と同じ状態なら何もしない
    if (prevConnectionStateRef.current === connectionState) {
      return;
    }
    prevConnectionStateRef.current = connectionState;

    if (connectionState === 'disconnected' || connectionState === 'reconnecting') {
      wasOfflineRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 接続状態変化の同期に必要
      setNoticeState('offline');
    } else if (connectionState === 'connected' && wasOfflineRef.current) {
      // オフラインから復帰した場合のみ「復帰」通知を表示
      setNoticeState('reconnected');

      // 3秒後に通知を非表示
      const timer = setTimeout(() => {
        setNoticeState('hidden');
        wasOfflineRef.current = false;
      }, 3000);

      return () => clearTimeout(timer);
    } else if (connectionState === 'connected') {
      // 初回接続時は何も表示しない
      setNoticeState('hidden');
    }
  }, [connectionState]);

  // 通知を閉じるハンドラ
  const handleClose = useCallback(() => {
    setNoticeState('hidden');
    if (connectionState === 'connected') {
      wasOfflineRef.current = false;
    }
  }, [connectionState]);

  // 非表示の場合は何も表示しない
  if (noticeState === 'hidden') {
    return null;
  }

  const isOffline = noticeState === 'offline';

  return (
    <div
      className={`fixed top-16 left-1/2 transform -translate-x-1/2 px-4 py-3 rounded-lg shadow-lg z-50 max-w-md ${
        isOffline
          ? 'bg-yellow-50 border border-yellow-300 text-yellow-800'
          : 'bg-green-50 border border-green-300 text-green-800'
      }`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {/* アイコン */}
        <div className="flex-shrink-0 mt-0.5">
          {isOffline ? (
            <svg
              className="w-5 h-5 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
        </div>

        {/* メッセージ */}
        <div className="flex-1">
          <p className="text-sm font-medium">
            {isOffline ? 'オフラインモード' : 'オンラインに復帰しました'}
          </p>
          <p className="text-xs mt-1 opacity-80">
            {isOffline
              ? '編集内容はローカルに保存され、再接続時に自動で同期されます'
              : '変更が正常に同期されました'}
          </p>
        </div>

        {/* 閉じるボタン */}
        <button
          onClick={handleClose}
          className="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
          aria-label="通知を閉じる"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
});

OfflineNotice.displayName = 'OfflineNotice';
