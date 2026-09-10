# デプロイ手順（Cloudflare）

Gridder はバックエンドを持たない静的サイトとして配信する。本ドキュメントは Cloudflare Workers（Static Assets）へのデプロイ手順と、デプロイ後の確認項目を定義する。

## 前提

- ビルド成果物は `apps/web/dist` に生成される。
- レスポンスヘッダー（CSP など）は `apps/web/public/_headers` で定義し、ビルド時に `dist/` へコピーされる。
- 実行時に外部サービスへ通信しない。環境変数は `VITE_APP_ENV` / `VITE_DEBUG` / `VITE_APP_VERSION` のみで、いずれも省略可能。

## 初回セットアップ

1. Cloudflare ダッシュボードで **Workers & Pages → Create → Import a repository** を選び、GitHub の `gridder` リポジトリを接続する。
2. ビルド設定を次のとおり入力する。ルートディレクトリはリポジトリ直下のままにする（Turborepo と pnpm workspace が必要なため）。

   | 項目 | 値 |
   |------|-----|
   | Build command | `pnpm build:web` |
   | Deploy command | `npx wrangler deploy` |
   | Root directory | `/` |

3. 環境変数に `NODE_VERSION=20` を設定する。pnpm のバージョンはルート `package.json` の `packageManager` から自動で解決される。
4. 本番ブランチを `main` に設定する。`main` 以外へのプッシュはプレビュー環境として個別 URL に配信される。

Wrangler の設定はリポジトリ直下の `wrangler.jsonc` に置く。

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "gridder",
  "compatibility_date": "2026-09-01",
  "assets": {
    "directory": "./apps/web/dist",
    "not_found_handling": "single-page-application"
  }
}
```

## 手動デプロイ

ローカルから直接デプロイする場合は、ビルド後に Wrangler を実行する。

```bash
pnpm build:web
npx wrangler deploy
```

## デプロイ後チェックリスト

デプロイ完了後、本番 URL で次を確認する。

- [ ] ページが表示され、ブラウザのコンソールに CSP 違反や 404 が出ていない
- [ ] レスポンスヘッダーに `Content-Security-Policy` と `X-Frame-Options: DENY` が含まれている（DevTools の Network タブで確認）
- [ ] 図形の作成、移動、Undo / Redo が動作する
- [ ] ページを再読み込みしても下書きが復元される（IndexedDB）
- [ ] PNG / SVG / JSON のエクスポートがダウンロードできる
- [ ] favicon（`/favicon.svg`）が表示される

問題があれば Cloudflare ダッシュボードの **Deployments** から直前のデプロイへロールバックする。

## 関連ドキュメント

- [リリースワークフロー](./release-workflow.md)
- [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Headers ファイルの仕様](https://developers.cloudflare.com/workers/static-assets/headers/)
