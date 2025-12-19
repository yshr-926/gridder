# 環境変数設定ガイド

## 概要

Gridder では以下の環境変数を使用します。すべての環境変数はオプショナルですが、本番環境ではセキュリティ・監視機能の有効化を推奨します。

## セットアップ手順

1. `.env.example` をコピーして `.env` を作成:

   ```bash
   cp .env.example .env
   ```

2. `.env` ファイルに実際の値を設定

3. 開発サーバーを起動:

   ```bash
   npm run dev
   ```

## 環境変数一覧

### アプリケーション設定

| 変数名 | 必須 | デフォルト | 説明 |
|--------|------|-----------|------|
| `VITE_APP_ENV` | - | `development` | 環境（development, staging, production） |
| `VITE_DEBUG` | - | `false` | デバッグモード（true/false） |
| `VITE_APP_VERSION` | - | `0.0.0` | アプリケーションバージョン |

### Sentry エラー追跡

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `VITE_SENTRY_DSN` | 任意 | Sentry プロジェクトの DSN |
| `SENTRY_AUTH_TOKEN` | 任意 | ソースマップアップロード用トークン（ビルド時のみ） |
| `SENTRY_ORG` | 任意 | Sentry 組織名（ビルド時のみ） |
| `SENTRY_PROJECT` | 任意 | Sentry プロジェクト名（ビルド時のみ） |

**取得方法**:

1. [Sentry](https://sentry.io) でアカウント作成
2. プロジェクト作成（React を選択）
3. Settings -> Client Keys から DSN を取得
4. Settings -> Auth Tokens から認証トークンを生成（ソースマップアップロード用）

**注意**: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` は `VITE_` プレフィックスが付いていないため、クライアント側には公開されません。ビルド時のソースマップアップロードにのみ使用されます。

### Plausible Analytics（推奨）

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `VITE_PLAUSIBLE_DOMAIN` | 任意 | トラッキング対象ドメイン |
| `VITE_PLAUSIBLE_API_HOST` | 任意 | API ホスト（セルフホスト時のみ） |

**特徴**:

- プライバシーファースト（Cookie 不使用）
- GDPR/CCPA 準拠（同意バナー不要）
- 軽量（< 1KB）
- セルフホスト可能

**取得方法**:

1. [Plausible](https://plausible.io) でアカウント作成
2. サイトを追加
3. ドメイン名を `VITE_PLAUSIBLE_DOMAIN` に設定

### Google Analytics 4（代替）

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `VITE_GA4_MEASUREMENT_ID` | 任意 | GA4 測定 ID（例: G-XXXXXXXXXX） |

**取得方法**:

1. [Google Analytics](https://analytics.google.com) でアカウント作成
2. プロパティ作成
3. データストリームから測定 ID を取得

**注意**: GA4 を使用する場合、地域によっては Cookie 同意バナーが必要です。

## 環境変数の優先順位

アナリティクスは以下の優先順位で設定されます:

1. **Plausible Analytics** - `VITE_PLAUSIBLE_DOMAIN` が設定されている場合
2. **Google Analytics 4** - `VITE_GA4_MEASUREMENT_ID` が設定されている場合

両方が設定されている場合、両方のアナリティクスが有効になります。

## コードでの使用方法

```typescript
import {
  env,
  isDevelopment,
  isProduction,
  isSentryConfigured,
  isPlausibleConfigured,
  isGA4Configured,
  isAnalyticsConfigured,
} from '@/config/env';

// 環境変数へのアクセス
console.log(env.appEnv);        // 'development' | 'staging' | 'production'
console.log(env.debug);         // boolean
console.log(env.appVersion);    // string
console.log(env.sentryDsn);     // string | undefined
console.log(env.plausible);     // { domain: string, apiHost?: string } | undefined
console.log(env.ga4MeasurementId); // string | undefined

// 環境チェック
if (isDevelopment) {
  console.log('開発環境です');
}

if (isProduction) {
  console.log('本番環境です');
}

// 設定チェック
if (isSentryConfigured()) {
  console.log('Sentry が設定されています');
}

if (isAnalyticsConfigured()) {
  console.log('アナリティクスが設定されています');
}
```

## 型定義

環境変数の型は `src/vite-env.d.ts` で定義されています:

```typescript
interface ImportMetaEnv {
  readonly VITE_APP_ENV: string;
  readonly VITE_DEBUG: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_PLAUSIBLE_DOMAIN?: string;
  readonly VITE_PLAUSIBLE_API_HOST?: string;
  readonly VITE_GA4_MEASUREMENT_ID?: string;
  readonly MODE: 'development' | 'production' | 'test';
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
  readonly BASE_URL: string;
}
```

## 注意事項

### セキュリティ

- `.env` ファイルは Git にコミットしない（`.gitignore` に含まれています）
- `VITE_` プレフィックスの変数のみクライアント側で利用可能
- 秘密情報（トークン等）は適切に管理する
- 本番環境ではデプロイプラットフォームの環境変数設定を使用

### デプロイプラットフォーム別設定

#### Vercel

```bash
vercel env add VITE_SENTRY_DSN
vercel env add VITE_PLAUSIBLE_DOMAIN
```

または Vercel ダッシュボードの Settings -> Environment Variables から設定。

#### Netlify

Netlify ダッシュボードの Site settings -> Environment variables から設定。

#### Cloudflare Pages

Cloudflare Pages ダッシュボードの Settings -> Environment variables から設定。

### 開発環境でのトラッキング無効化

開発環境では以下の条件でトラッキングが自動的に無効化されます:

- Sentry: `localhost` ではエラー送信をスキップ
- Plausible: 開発環境検出時に無効化
- GA4: 開発環境検出時に無効化

### 環境変数のバリデーション

環境変数は `src/config/env.ts` で検証されます:

- 無効な `VITE_APP_ENV` は `development` にフォールバック
- 空文字列の `VITE_DEBUG` は `false` として扱われる
- 空文字列のオプショナル変数は `undefined` として扱われる

## トラブルシューティング

### 環境変数が反映されない

1. 開発サーバーを再起動してください
2. `.env` ファイルの構文を確認してください（`=` の前後にスペースを入れない）
3. `VITE_` プレフィックスが付いていることを確認してください

### Sentry にエラーが送信されない

1. `VITE_SENTRY_DSN` が正しく設定されていることを確認
2. 開発環境（localhost）ではエラー送信が無効化されています
3. ブラウザの開発者ツールでネットワークリクエストを確認

### アナリティクスが動作しない

1. 環境変数が正しく設定されていることを確認
2. アドブロッカーが無効になっていることを確認
3. ブラウザの開発者ツールでネットワークリクエストを確認

## 関連ドキュメント

- [Vite 環境変数](https://vitejs.dev/guide/env-and-mode.html)
- [Sentry React SDK](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Plausible Analytics](https://plausible.io/docs)
- [Google Analytics 4](https://developers.google.com/analytics/devguides/collection/ga4)
