/**
 * WebSocket メッセージ型定義
 *
 * Yjs バイナリプロトコルに加え、カスタムメッセージを定義
 */

// ============================================================
// Yjs プロトコルメッセージタイプ
// ============================================================

/** Yjs メッセージタイプ */
export const YjsMessageType = {
  Sync: 0,
  Awareness: 1,
  Auth: 2,
  QueryAwareness: 3,
} as const;

export type YjsMessageType = (typeof YjsMessageType)[keyof typeof YjsMessageType];

/** Sync メッセージサブタイプ */
export const SyncMessageType = {
  SyncStep1: 0,
  SyncStep2: 1,
  Update: 2,
} as const;

export type SyncMessageType = (typeof SyncMessageType)[keyof typeof SyncMessageType];

// ============================================================
// 認証メッセージ
// ============================================================

/** WebSocket 認証メッセージ */
export interface AuthMessage {
  type: 'auth';
  token: string;
}

/** 認証結果メッセージ */
export interface AuthResultMessage {
  type: 'auth_result';
  success: boolean;
  error?: string;
}

// ============================================================
// Awareness 状態
// ============================================================

/** ユーザーカーソル位置 */
export interface CursorPosition {
  x: number;
  y: number;
}

/** Awareness ユーザー状態 */
export interface AwarenessUserState {
  /** ユーザー ID */
  id: string;
  /** 表示名 */
  name: string;
  /** カーソル色 */
  color: string;
  /** カーソル位置 */
  cursor: CursorPosition | null;
  /** 最終更新時刻 */
  lastActive: number;
}

// ============================================================
// 接続パラメータ
// ============================================================

/** WebSocket 接続パラメータ */
export interface WebSocketConnectionParams {
  /** ルーム ID */
  roomId: string;
  /** 認証トークン（パスフレーズ） */
  token?: string;
  /** ユーザー表示名 */
  name?: string;
}
