/**
 * API サービスモジュール
 *
 * Rust バックエンドとの通信を行う API クライアントをエクスポート。
 */

// API クライアント
export { apiClient, ApiError, NetworkError } from './client';

// ルーム管理 API
export { roomsApi } from './rooms';
export type {
  CreateRoomRequest,
  VerifyPassphraseRequest,
  VerifyPassphraseResponse,
} from './rooms';

// 認証 API
export { authApi } from './auth';
export type {
  AuthRequest,
  AuthResponse,
  VerifyTokenRequest,
  VerifyTokenResponse,
  RefreshTokenResponse,
} from './auth';
