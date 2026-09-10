/// <reference types="vite/client" />

/**
 * Vite 環境変数の型定義
 *
 * 注意:
 * - VITE_ プレフィックスの変数のみクライアント側で利用可能
 * - ビルド時のみ使用する変数はここに含めない
 */
interface ImportMetaEnv {
  // ===========================================
  // アプリケーション設定
  // ===========================================
  /** アプリケーション環境（development, staging, production） */
  readonly VITE_APP_ENV: string;
  /** デバッグモード（'true' または 'false'） */
  readonly VITE_DEBUG: string;
  /** アプリケーションバージョン */
  readonly VITE_APP_VERSION: string;
  /**
   * Playwright ビルド時のみ 'true'。開発ツール用の `window.__GRIDDER_*` を
   * 本番バンドルへ含めず E2E ビルドでだけ公開するためのフラグ（#45）。
   */
  readonly VITE_E2E?: string;

  // ===========================================
  // Vite 標準（Vite 本体の型定義を拡張）
  // ===========================================
  /** 現在のモード（development, production, test 等） */
  readonly MODE: string;
  /** 開発環境かどうか */
  readonly DEV: boolean;
  /** 本番環境かどうか */
  readonly PROD: boolean;
  /** サーバーサイドレンダリングかどうか */
  readonly SSR: boolean;
  /** ベース URL */
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
