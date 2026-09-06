/**
 * 環境変数の型定義と検証
 */

/**
 * 環境の種類
 */
export type AppEnvironment = 'development' | 'staging' | 'production';

/**
 * 環境変数の型定義
 */
export interface EnvConfig {
  /** アプリケーション環境 */
  appEnv: AppEnvironment;
  /** デバッグモード */
  debug: boolean;
  /** アプリケーションバージョン */
  appVersion: string;
}

/**
 * 有効な環境値の一覧
 */
const VALID_ENVIRONMENTS: readonly AppEnvironment[] = [
  'development',
  'staging',
  'production',
] as const;

/**
 * 環境変数を検証して取得する
 */
function validateEnv(): EnvConfig {
  const appEnv = import.meta.env.VITE_APP_ENV;
  const debug = import.meta.env.VITE_DEBUG;
  const appVersion = import.meta.env.VITE_APP_VERSION;

  // 環境の検証
  const validatedAppEnv: AppEnvironment = VALID_ENVIRONMENTS.includes(
    appEnv as AppEnvironment
  )
    ? (appEnv as AppEnvironment)
    : 'development';

  // デバッグモードの検証
  const validatedDebug = debug === 'true';

  // バージョンの検証
  const validatedVersion =
    typeof appVersion === 'string' && appVersion.length > 0
      ? appVersion
      : '0.0.0';

  return {
    appEnv: validatedAppEnv,
    debug: validatedDebug,
    appVersion: validatedVersion,
  };
}

/**
 * 検証済みの環境変数
 */
export const env = validateEnv();

/**
 * 開発環境かどうか
 */
export const isDevelopment = env.appEnv === 'development';

/**
 * ステージング環境かどうか
 */
export const isStaging = env.appEnv === 'staging';

/**
 * 本番環境かどうか
 */
export const isProduction = env.appEnv === 'production';

/**
 * Vite のモードを取得
 */
export const getViteMode = (): string => {
  return import.meta.env.MODE;
};

/**
 * Vite の DEV フラグ
 */
export const isViteDev = (): boolean => {
  return import.meta.env.DEV;
};

/**
 * Vite の PROD フラグ
 */
export const isViteProd = (): boolean => {
  return import.meta.env.PROD;
};
