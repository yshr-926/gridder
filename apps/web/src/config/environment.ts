/**
 * Rust バックエンド接続用環境設定
 *
 * WebSocket および REST API の接続先を環境変数から取得する。
 * 環境変数が未設定の場合はデフォルト値を使用する。
 */

/**
 * 環境設定インターフェース
 */
export interface EnvironmentConfig {
  /** WebSocket 接続 URL */
  wsUrl: string;
  /** REST API 接続 URL */
  apiUrl: string;
  /** 実行環境 */
  mode: 'development' | 'production' | 'test';
  /** デバッグモード */
  debug: boolean;
}

/**
 * 環境に応じたデフォルト WebSocket URL を取得
 */
const getDefaultWsUrl = (mode: string): string => {
  if (mode === 'production') {
    // 本番環境では相対パスを使用（リバースプロキシ経由）
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = typeof window !== 'undefined' ? window.location.host : 'gridder.example.com';
    return `${protocol}//${host}/ws`;
  }
  return 'ws://localhost:3001/ws';
};

/**
 * 環境に応じたデフォルト API URL を取得
 */
const getDefaultApiUrl = (mode: string): string => {
  if (mode === 'production') {
    // 本番環境では相対パスを使用（リバースプロキシ経由）
    const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
    const host = typeof window !== 'undefined' ? window.location.host : 'gridder.example.com';
    return `${protocol}//${host}`;
  }
  return 'http://localhost:3001';
};

/**
 * 環境設定を取得
 *
 * 環境変数から設定を読み込み、未設定の場合はデフォルト値を使用する。
 */
export const getEnvironment = (): EnvironmentConfig => {
  const mode = import.meta.env.MODE as EnvironmentConfig['mode'];

  return {
    wsUrl: import.meta.env.VITE_WS_URL || getDefaultWsUrl(mode),
    apiUrl: import.meta.env.VITE_API_URL || getDefaultApiUrl(mode),
    mode,
    debug: import.meta.env.VITE_DEBUG === 'true',
  };
};

/**
 * 環境設定インスタンス（シングルトン）
 */
export const environment = getEnvironment();

/**
 * WebSocket URL を取得（ルーム名とトークンを含む）
 *
 * @param roomName - ルーム名
 * @param token - 認証トークン（オプション）
 * @returns 完全な WebSocket 接続 URL
 */
export const getWebSocketUrl = (roomName: string, token?: string): string => {
  const baseUrl = environment.wsUrl;
  const params = new URLSearchParams();
  params.set('room', roomName);
  if (token) {
    params.set('token', token);
  }
  return `${baseUrl}?${params.toString()}`;
};

/**
 * 開発環境かどうか
 */
export const isDevelopment = (): boolean => {
  return environment.mode === 'development';
};

/**
 * 本番環境かどうか
 */
export const isProduction = (): boolean => {
  return environment.mode === 'production';
};

/**
 * テスト環境かどうか
 */
export const isTest = (): boolean => {
  return environment.mode === 'test';
};

/**
 * デバッグモードかどうか
 */
export const isDebug = (): boolean => {
  return environment.debug;
};
