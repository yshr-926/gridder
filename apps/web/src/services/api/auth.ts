/**
 * 認証 API
 *
 * ルーム認証トークンの発行と検証を行う REST API クライアント。
 */

import { apiClient } from './client';

/**
 * 認証リクエスト
 */
export interface AuthRequest {
  /** ルーム ID */
  roomId: string;
  /** パスフレーズ（パスフレーズ設定済みルームの場合は必須） */
  passphrase?: string;
}

/**
 * 認証レスポンス
 */
export interface AuthResponse {
  /** JWT トークン */
  token: string;
  /** トークン有効期限（Unix タイムスタンプ、秒） */
  expiresAt: number;
}

/**
 * トークン検証リクエスト
 */
export interface VerifyTokenRequest {
  /** 検証する JWT トークン */
  token: string;
}

/**
 * トークン検証レスポンス
 */
export interface VerifyTokenResponse {
  /** トークンが有効かどうか */
  valid: boolean;
  /** ルーム ID（有効な場合） */
  roomId?: string;
  /** 有効期限（Unix タイムスタンプ、秒） */
  expiresAt?: number;
}

/**
 * トークンリフレッシュレスポンス
 */
export interface RefreshTokenResponse {
  /** 新しい JWT トークン */
  token: string;
  /** 新しい有効期限（Unix タイムスタンプ、秒） */
  expiresAt: number;
}

/**
 * 認証 API
 */
export const authApi = {
  /**
   * 認証トークンを取得
   *
   * ルームに接続するための JWT トークンを発行する。
   * パスフレーズが設定されているルームの場合、正しいパスフレーズが必要。
   *
   * @param request - 認証リクエスト
   * @returns 認証レスポンス（トークンと有効期限）
   * @throws ApiError (ROOM_NOT_FOUND, INVALID_PASSPHRASE, PASSPHRASE_REQUIRED)
   */
  async authenticate(request: AuthRequest): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/api/auth', {
      room_id: request.roomId,
      passphrase: request.passphrase,
    });
  },

  /**
   * トークンを検証
   *
   * JWT トークンの有効性を確認する。
   *
   * @param token - 検証する JWT トークン
   * @returns 検証結果
   */
  async verifyToken(token: string): Promise<VerifyTokenResponse> {
    return apiClient.post<VerifyTokenResponse>('/api/auth/verify', {
      token,
    } as VerifyTokenRequest);
  },

  /**
   * トークンをリフレッシュ
   *
   * 現在のトークンを使用して新しいトークンを発行する。
   * Authorization ヘッダーに現在のトークンを設定する必要がある。
   *
   * @param currentToken - 現在の JWT トークン
   * @returns 新しいトークンと有効期限
   */
  async refreshToken(currentToken: string): Promise<RefreshTokenResponse> {
    return apiClient.post<RefreshTokenResponse>(
      '/api/auth/refresh',
      undefined,
      {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      }
    );
  },

  /**
   * トークンの有効期限をチェック
   *
   * トークンが有効期限切れかどうかを確認する（ローカルチェック）。
   *
   * @param expiresAt - 有効期限（Unix タイムスタンプ、秒）
   * @param bufferSeconds - 猶予時間（秒）、デフォルト 60秒
   * @returns 有効期限切れの場合は true
   */
  isTokenExpired(expiresAt: number, bufferSeconds = 60): boolean {
    const now = Math.floor(Date.now() / 1000);
    return now >= expiresAt - bufferSeconds;
  },
};
