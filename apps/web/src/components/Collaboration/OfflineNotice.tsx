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

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useCollaborationStore } from '@/stores/collaborationStore';

/**
 * 通知状態を表す型
 */
type NoticeState = 'hidden' | 'offline' | 'reconnected';

/**
 * 接続状態をトラッキングしてオフライン復帰を検出するためのカスタムフック
 */
const useOfflineNoticeState = () => {
  const initialConnectionState = useCollaborationStore.getState().connectionState;
  const connectionStateRef = useRef<string>(initialConnectionState);
  const offlineDismissedRef = useRef(false);
  const reconnectedTimerRef = useRef<number | null>(null);
  const [noticeState, setNoticeState] = useState<NoticeState>(() => {
    return initialConnectionState === 'disconnected' ||
      initialConnectionState === 'reconnecting'
      ? 'offline'
      : 'hidden';
  });

  const clearReconnectedTimer = useCallback(() => {
    if (reconnectedTimerRef.current === null) {
      return;
    }
    window.clearTimeout(reconnectedTimerRef.current);
    reconnectedTimerRef.current = null;
  }, []);

  const handleConnectionChange = useCallback(
    (state: { connectionState: string }, prevState: { connectionState: string }) => {
      const nextConnectionState = state.connectionState;
      const prevConnectionState = prevState.connectionState;

      connectionStateRef.current = nextConnectionState;

      const wasOffline =
        prevConnectionState === 'disconnected' ||
        prevConnectionState === 'reconnecting';
      const isOffline =
        nextConnectionState === 'disconnected' ||
        nextConnectionState === 'reconnecting';
      const isConnected = nextConnectionState === 'connected';

      clearReconnectedTimer();

      if (isOffline) {
        if (!wasOffline) {
          offlineDismissedRef.current = false;
        }

        setNoticeState(offlineDismissedRef.current ? 'hidden' : 'offline');
        return;
      }

      if (isConnected && wasOffline) {
        setNoticeState('reconnected');
        reconnectedTimerRef.current = window.setTimeout(() => {
          setNoticeState('hidden');
          reconnectedTimerRef.current = null;
        }, 3000);
        return;
      }

      setNoticeState('hidden');
    },
    [clearReconnectedTimer]
  );

  useEffect(() => {
    const unsubscribe = useCollaborationStore.subscribe(handleConnectionChange);
    return () => {
      clearReconnectedTimer();
      unsubscribe();
    };
  }, [clearReconnectedTimer, handleConnectionChange]);

  // 通知状態を計算
  const dismiss = useCallback(() => {
    clearReconnectedTimer();

    if (
      connectionStateRef.current === 'disconnected' ||
      connectionStateRef.current === 'reconnecting'
    ) {
      offlineDismissedRef.current = true;
      setNoticeState('hidden');
      return;
    }
    setNoticeState('hidden');
  }, [clearReconnectedTimer]);

  return { noticeState, dismiss };
};

/**
 * オフライン通知コンポーネント
 *
 * 接続状態を監視し、適切な通知を表示する。
 */
export const OfflineNotice = memo(() => {
  const { noticeState, dismiss } = useOfflineNoticeState();

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
          <p className="text-xs mt-1">
            {isOffline
              ? '編集内容はローカルに保存され、再接続時に自動で同期されます'
              : '変更が正常に同期されました'}
          </p>
        </div>

        {/* 閉じるボタン */}
        <button
          onClick={dismiss}
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
