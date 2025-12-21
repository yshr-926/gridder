/**
 * 共同編集機能の型定義
 *
 * リアルタイム共同編集に必要な型を定義する。
 * - ユーザー情報
 * - プレゼンス（カーソル位置、選択状態）
 * - ルーム情報
 * - 接続状態
 */

/**
 * カーソル位置（グリッド座標）
 */
export interface CursorPosition {
  /** X座標（グリッド単位） */
  x: number;
  /** Y座標（グリッド単位） */
  y: number;
}

/**
 * ユーザー情報
 *
 * 共同編集セッションに参加しているユーザーの情報を表す。
 * セッションごとに一意のIDが生成され、表示名とカーソル色が割り当てられる。
 */
export interface CollaboratorInfo {
  /** ユーザーID（セッションごとに生成、nanoid(16)） */
  id: string;
  /** 表示名（ユーザーが設定可能） */
  displayName: string;
  /** カーソル色（自動割り当て、HEX形式） */
  color: string;
  /** 接続時刻（ISO 8601形式） */
  connectedAt: string;
}

/**
 * プレゼンス情報
 *
 * リアルタイムで更新されるユーザーの状態を表す。
 * カーソル位置と選択中のオブジェクトIDを含む。
 */
export interface Presence {
  /** ユーザーID */
  userId: string;
  /** カーソル位置（グリッド座標、nullの場合はキャンバス外または非表示） */
  cursor: CursorPosition | null;
  /** 選択中のオブジェクトID配列 */
  selectedObjectIds: string[];
  /** 最終更新時刻（ISO 8601形式） */
  updatedAt: string;
}

/**
 * ルーム情報
 *
 * 共同編集セッションのルーム情報を表す。
 * ルームIDは nanoid(24) で生成される推測困難な文字列。
 */
export interface RoomInfo {
  /** ルームID（nanoid(24)で生成） */
  id: string;
  /** ルーム名（オプション、ユーザーが設定可能） */
  name?: string;
  /** 作成時刻（ISO 8601形式） */
  createdAt: string;
  /** 参加者リスト（Awareness から更新） */
  participants: CollaboratorInfo[];
}

/**
 * 接続状態
 *
 * WebSocket接続の状態を表す列挙型。
 * - disconnected: 未接続
 * - connecting: 接続中
 * - connected: 接続済み
 * - reconnecting: 再接続中
 * - error: エラー発生
 */
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

/**
 * 共同編集の状態
 *
 * 共同編集機能全体の状態を表す。
 * 接続状態、ルーム情報、参加者情報、プレゼンス情報を含む。
 */
export interface CollaborationState {
  /** 接続状態 */
  connectionState: ConnectionState;
  /** ルーム情報（未接続時はnull） */
  room: RoomInfo | null;
  /** 自分のユーザー情報（未接続時はnull） */
  self: CollaboratorInfo | null;
  /** 他の参加者リスト */
  collaborators: CollaboratorInfo[];
  /** プレゼンス情報（ユーザーIDをキーとするMap） */
  presences: Map<string, Presence>;
  /** エラーメッセージ（エラー発生時のみ） */
  error: string | null;
}

/**
 * 共同編集アクション
 *
 * 共同編集ストアで使用するアクションの型定義。
 */
export interface CollaborationActions {
  /** ルームに接続 */
  connect: (roomId: string, displayName: string) => Promise<void>;
  /** ルームから切断 */
  disconnect: () => void;
  /** 表示名を更新 */
  updateDisplayName: (displayName: string) => void;
  /** カーソル位置を更新 */
  updateCursor: (cursor: CursorPosition | null) => void;
  /** 選択オブジェクトを更新 */
  updateSelection: (objectIds: string[]) => void;
  /** 接続状態をリセット */
  reset: () => void;
}

/**
 * カーソル色のパレット
 *
 * 参加者に自動割り当てされるカーソル色のリスト。
 * 視認性が高く、互いに区別しやすい色を選定。
 */
export const CURSOR_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#06b6d4', // Cyan
] as const;

/**
 * カーソル色の型
 */
export type CursorColor = (typeof CURSOR_COLORS)[number];

/**
 * 表示名のバリデーション設定
 */
export const DISPLAY_NAME_CONSTRAINTS = {
  /** 最小文字数 */
  minLength: 1,
  /** 最大文字数 */
  maxLength: 20,
  /** デフォルト表示名のプレフィックス */
  defaultPrefix: 'Guest',
} as const;

/**
 * ルームIDのバリデーション設定
 */
export const ROOM_ID_CONSTRAINTS = {
  /** ルームIDの長さ（nanoid(24)） */
  length: 24,
  /** 有効な文字パターン（URL-safe） */
  pattern: /^[A-Za-z0-9_-]+$/,
} as const;

/**
 * プレゼンス更新のスロットリング設定
 */
export const PRESENCE_THROTTLE_MS = 50;

/**
 * ルームの有効期限（ミリ秒）
 * 最終アクセスから7日間
 */
export const ROOM_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
