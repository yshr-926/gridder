/**
 * REST API 型定義
 */

// ============================================================
// パスフレーズ API
// ============================================================

/** パスフレーズ設定リクエスト */
export interface SetPassphraseRequest {
  /** 新しいパスフレーズ（null で解除） */
  passphrase: string | null;
  /** 現在のパスフレーズ（設定済みの場合必須） */
  currentToken?: string;
}

/** パスフレーズ設定レスポンス */
export interface SetPassphraseResponse {
  success: boolean;
  hasPassphrase: boolean;
}

/** パスフレーズ有無確認レスポンス */
export interface HasPassphraseResponse {
  hasPassphrase: boolean;
}

// ============================================================
// ルーム情報 API
// ============================================================

/** ルーム情報レスポンス */
export interface RoomInfoResponse {
  id: string;
  name?: string;
  hasPassphrase: boolean;
  participantCount: number;
  createdAt: string;
  lastAccessedAt: string;
}

// ============================================================
// ヘルスチェック API
// ============================================================

/** システムステータス */
export type SystemStatus = 'ok' | 'degraded' | 'error';

/** ヘルスチェックレスポンス */
export interface HealthResponse {
  status: SystemStatus;
  timestamp: string;
  version: string;
  components?: {
    database: SystemStatus;
    redis: SystemStatus;
  };
}

// ============================================================
// エラーレスポンス
// ============================================================

/** API エラーコード */
export type ApiErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'INVALID_PASSPHRASE'
  | 'PASSPHRASE_REQUIRED'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR';

/** API エラーレスポンス */
export interface ErrorResponse {
  message: string;
  code: ApiErrorCode;
  details?: Record<string, unknown>;
}
