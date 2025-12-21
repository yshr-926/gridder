/**
 * コンフリクト警告コンポーネント
 *
 * 同一オブジェクトを複数ユーザーが選択時に警告を表示する。
 * 編集競合の可能性をユーザーに通知する。
 */

import { memo, useEffect, useState, useMemo } from 'react';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { cn } from '@/utils/cn';

/**
 * 警告アイコン（シンプルなSVG）
 */
const WarningIcon = () => (
  <svg
    className="w-5 h-5 text-yellow-600"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
);

/**
 * 閉じるアイコン（シンプルなSVG）
 */
const CloseIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

interface ConflictWarningProps {
  /** 追加のクラス名 */
  className?: string;
  /** 警告を自動的に非表示にするまでの時間（ミリ秒）。0の場合は自動非表示なし */
  autoHideMs?: number;
}

/**
 * コンフリクト警告コンポーネント
 *
 * 自分が選択しているオブジェクトを他のユーザーも選択している場合に警告を表示する。
 */
export const ConflictWarning = memo(({ className, autoHideMs = 0 }: ConflictWarningProps) => {
  const presences = useCollaborationStore((state) => state.presences);
  const collaborators = useCollaborationStore((state) => state.collaborators);
  const localSelectedIds = useCanvasStore((state) => state.selection.selectedIds);
  const room = useCollaborationStore((state) => state.room);

  const [dismissed, setDismissed] = useState(false);
  const [prevConflictKey, setPrevConflictKey] = useState('');

  // 競合ユーザーをuseMemoで計算（useEffectの代わり）
  const conflictUsers = useMemo(() => {
    // ルームに接続していない場合は空配列
    if (!room) {
      return [];
    }

    // 他のユーザーが選択中のオブジェクトIDを収集
    const remoteSelectedIds = new Map<string, string[]>(); // objectId -> [displayNames]

    collaborators.forEach((collaborator) => {
      const presence = presences.get(collaborator.id);
      if (!presence || presence.selectedObjectIds.length === 0) return;

      presence.selectedObjectIds.forEach((objectId) => {
        if (!remoteSelectedIds.has(objectId)) {
          remoteSelectedIds.set(objectId, []);
        }
        remoteSelectedIds.get(objectId)?.push(collaborator.displayName);
      });
    });

    // 自分が選択中のオブジェクトと競合しているユーザーを検出
    const conflicts: string[] = [];
    localSelectedIds.forEach((objectId) => {
      const users = remoteSelectedIds.get(objectId);
      if (users && users.length > 0) {
        conflicts.push(...users);
      }
    });

    // 重複を除去してソート（安定した比較のため）
    return [...new Set(conflicts)].sort();
  }, [presences, collaborators, localSelectedIds, room]);

  // 競合が変化した場合、dismissedをリセット
  // NOTE: これは意図的なuseEffect内でのsetStateです。
  // 競合状態の変化を追跡し、ユーザーに再度警告を表示するために必要です。
  useEffect(() => {
    const conflictKey = conflictUsers.join(',');
    if (conflictKey !== prevConflictKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 競合変化の追跡に必要
      setPrevConflictKey(conflictKey);
      if (conflictUsers.length > 0) {
        setDismissed(false);
      }
    }
  }, [conflictUsers, prevConflictKey]);

  // 自動非表示
  useEffect(() => {
    if (autoHideMs > 0 && conflictUsers.length > 0 && !dismissed) {
      const timer = setTimeout(() => {
        setDismissed(true);
      }, autoHideMs);
      return () => clearTimeout(timer);
    }
  }, [autoHideMs, conflictUsers, dismissed]);

  // 警告を表示しない条件
  if (conflictUsers.length === 0 || dismissed) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50',
        'bg-yellow-50 border border-yellow-300 rounded-lg shadow-lg',
        'px-4 py-3 max-w-sm',
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <WarningIcon />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-yellow-800">
            編集競合の可能性
          </p>
          <p className="mt-1 text-xs text-yellow-700">
            {conflictUsers.join(', ')} が同じオブジェクトを編集中です
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 p-1 rounded hover:bg-yellow-100 text-yellow-600 transition-colors"
          aria-label="警告を閉じる"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
});

ConflictWarning.displayName = 'ConflictWarning';
