/**
 * コラボレーション関連型定義
 */

// ============================================================
// ルーム情報
// ============================================================

/** ルーム参加者情報 */
export interface Participant {
  /** クライアント ID */
  clientId: number;
  /** ユーザー情報 */
  user: {
    id: string;
    name: string;
    color: string;
  };
  /** 接続時刻 */
  connectedAt: string;
}

/** ルーム状態 */
export interface RoomState {
  /** ルーム ID */
  id: string;
  /** 参加者リスト */
  participants: Participant[];
  /** パスフレーズ設定有無 */
  hasPassphrase: boolean;
}

// ============================================================
// 接続状態
// ============================================================

/** 接続状態 */
export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'synced'
  | 'error';

/** 同期状態 */
export interface SyncState {
  /** 接続状態 */
  status: ConnectionStatus;
  /** 接続エラーメッセージ */
  error?: string;
  /** 同期済みかどうか */
  isSynced: boolean;
  /** 未送信の変更があるか */
  hasUnsavedChanges: boolean;
}
