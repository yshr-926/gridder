/**
 * 環境変数の型定義と検証
 *
 * Phase 8 で追加された環境変数を含む統合的な環境変数管理
 */

/**
 * 環境の種類
 */
export type AppEnvironment = 'development' | 'staging' | 'production';

/**
 * Plausible Analytics 設定
 */
export interface PlausibleConfig {
  /** トラッキング対象ドメイン */
  domain: string;
  /** API ホスト（セルフホスト時） */
  apiHost?: string;
}

/**
 * 環境変数の型定義
 */
export interface EnvConfig {
  // アプリケーション設定
  /** アプリケーション環境 */
  appEnv: AppEnvironment;
  /** デバッグモード */
  debug: boolean;
  /** アプリケーションバージョン */
  appVersion: string;

  // Sentry エラー追跡
  /** Sentry DSN（オプション） */
  sentryDsn?: string;

  // Plausible Analytics（推奨）
  /** Plausible 設定（オプション） */
  plausible?: PlausibleConfig;

  // Google Analytics 4（代替）
  /** GA4 測定 ID（オプション） */
  ga4MeasurementId?: string;
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
 * オプショナルな環境変数の検証
 * 空文字列や "undefined" は undefined に変換
 */
const validateOptional = (value: string | undefined): string | undefined => {
  if (!value || value === 'undefined' || value.trim() === '') {
    return undefined;
  }
  return value;
};

/**
 * 環境変数を検証して取得する
 */
function validateEnv(): EnvConfig {
  const appEnv = import.meta.env.VITE_APP_ENV;
  const debug = import.meta.env.VITE_DEBUG;
  const appVersion = import.meta.env.VITE_APP_VERSION;

  // Sentry
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

  // Plausible Analytics
  const plausibleDomain = import.meta.env.VITE_PLAUSIBLE_DOMAIN;
  const plausibleApiHost = import.meta.env.VITE_PLAUSIBLE_API_HOST;

  // Google Analytics 4
  const ga4MeasurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID;

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

  // Plausible 設定の構築
  const validatedPlausibleDomain = validateOptional(plausibleDomain);
  const plausibleConfig: PlausibleConfig | undefined = validatedPlausibleDomain
    ? {
        domain: validatedPlausibleDomain,
        apiHost: validateOptional(plausibleApiHost),
      }
    : undefined;

  return {
    appEnv: validatedAppEnv,
    debug: validatedDebug,
    appVersion: validatedVersion,
    sentryDsn: validateOptional(sentryDsn),
    plausible: plausibleConfig,
    ga4MeasurementId: validateOptional(ga4MeasurementId),
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

/**
 * Sentry が設定されているかどうか
 */
export const isSentryConfigured = (): boolean => {
  return env.sentryDsn !== undefined;
};

/**
 * Plausible が設定されているかどうか
 */
export const isPlausibleConfigured = (): boolean => {
  return env.plausible !== undefined;
};

/**
 * GA4 が設定されているかどうか
 */
export const isGA4Configured = (): boolean => {
  return env.ga4MeasurementId !== undefined;
};

/**
 * いずれかのアナリティクスが設定されているかどうか
 */
export const isAnalyticsConfigured = (): boolean => {
  return isPlausibleConfigured() || isGA4Configured();
};
