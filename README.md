# Gridder

[![CI](https://github.com/yshr-926/gridder/actions/workflows/ci.yml/badge.svg)](https://github.com/yshr-926/gridder/actions/workflows/ci.yml)
[![Security](https://github.com/yshr-926/gridder/actions/workflows/security.yml/badge.svg)](https://github.com/yshr-926/gridder/actions/workflows/security.yml)
[![codecov](https://codecov.io/gh/yshr-926/gridder/branch/main/graph/badge.svg)](https://codecov.io/gh/yshr-926/gridder)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

グリッドベース簡易作図 Web アプリケーション

## 概要

Gridder は、グリッド（方眼）を塗りつぶして直感的に図形を作成・配置できるリアルタイム共同編集ツールです。厳密な CAD を使うほどではないが、寸法を意識した配置図や概念図を作りたいユーザー向けに設計されています。

### 主な用途

- 部屋の模様替えや家具の配置シミュレーション
- イベント会場のブース割り当て
- DIY のための簡易設計図作成

## 機能

### 描画モード

| ツール | キー | 説明 |
|--------|------|------|
| 描画ツール | `D` | グリッド上をクリック/ドラッグして塗りつぶし |
| 選択ツール | `V` | オブジェクトを選択・移動・回転 |
| 消しゴム | `E` | 塗りつぶしを消去 |

### キャンバス操作

- **ズーム**: マウスホイールで拡大/縮小
- **パン**: Space キー + ドラッグで視点移動

### リアルタイム共同編集

- **Yjs/CRDT**: コンフリクトフリーな同時編集
- **Awareness**: 他ユーザーのカーソル位置をリアルタイム表示
- **自動同期**: 変更は即座に全参加者へ反映

### データ管理

- **JSON 保存**: プロジェクトを JSON ファイルとして保存
- **画像出力**: PNG/JPEG 形式で画像をエクスポート
- **自動保存**: 作業内容は自動的にブラウザに保存
- **パスフレーズ認証**: ルームへのアクセス制御

## キーボードショートカット

| キー | 機能 |
|------|------|
| `D` | 描画モード |
| `V` | 選択モード |
| `E` | 消しゴム |
| `R` | 90度回転 |
| `Delete` / `Backspace` | 削除 |
| `Ctrl/Cmd + D` | 複製 |
| `Ctrl/Cmd + Z` | 元に戻す |
| `Ctrl/Cmd + Shift + Z` | やり直し |
| Arrow Keys | 選択オブジェクトを移動 |
| `Space + Drag` | キャンバスをパン |
| `?` | ショートカットヘルプを表示 |

## アーキテクチャ

```
gridder/
├── apps/
│   ├── web/           # React フロントエンド
│   └── backend/       # Rust WebSocket サーバー
├── packages/
│   ├── shared-types/  # 共有型定義
│   ├── eslint-config/ # ESLint 共有設定
│   └── typescript-config/ # TypeScript 共有設定
└── docker/            # Docker 設定
```

### 技術スタック

| レイヤー | 技術 |
|----------|------|
| **フロントエンド** | React 19, TypeScript, Vite, Konva.js, Tailwind CSS, Zustand |
| **バックエンド** | Rust, Axum, Yrs (Yjs Rust), tokio |
| **データベース** | PostgreSQL 16 |
| **キャッシュ** | Redis 7 |
| **インフラ** | Docker, Traefik, GitHub Actions |

## クイックスタート

### 必要条件

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- Rust 1.85+ (バックエンド開発時)
- Docker & Docker Compose (フルスタック開発時)

### フロントエンドのみ (開発)

```bash
# リポジトリをクローン
git clone https://github.com/yshr-926/gridder.git
cd gridder

# 依存関係をインストール
pnpm install

# 開発サーバーを起動
pnpm dev:web
```

http://localhost:5173 でアクセスできます。

### Docker でフルスタック起動

```bash
# 全サービスを起動 (PostgreSQL, Redis, Backend, Frontend)
docker-compose up -d

# ログを確認
docker-compose logs -f

# サービスを停止
docker-compose down
```

| サービス | URL |
|----------|-----|
| Frontend | http://localhost:8080 |
| Backend API | http://localhost:3001/api |
| WebSocket | ws://localhost:3001/ws |

## 開発

### コマンド一覧

```bash
# ============================================================
# 全体
# ============================================================
pnpm dev           # 全アプリの開発サーバー起動
pnpm build         # 全アプリをビルド
pnpm lint          # 全アプリをリント
pnpm type-check    # 全アプリの型チェック
pnpm test          # 全アプリのテスト
pnpm format        # コードフォーマット

# ============================================================
# フロントエンド (apps/web)
# ============================================================
pnpm dev:web       # フロントエンド開発サーバー
pnpm build:web     # フロントエンドビルド
pnpm test:e2e      # E2E テスト (Playwright)

# ============================================================
# バックエンド (apps/backend)
# ============================================================
cd apps/backend
cargo build        # ビルド
cargo test         # テスト実行
cargo run          # サーバー起動
cargo clippy       # リント
```

### 環境変数

#### フロントエンド (.env)

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `VITE_APP_ENV` | 環境 | `development` |
| `VITE_API_URL` | Backend API URL | `http://localhost:3001` |
| `VITE_WS_URL` | WebSocket URL | `ws://localhost:3001/ws` |
| `VITE_DEBUG` | デバッグモード | `false` |

#### バックエンド (.env)

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `DATABASE_URL` | PostgreSQL 接続文字列 | 必須 |
| `REDIS_URL` | Redis 接続文字列 | オプション |
| `JWT_SECRET` | JWT 署名キー | 必須 |
| `PORT` | サーバーポート | `3001` |
| `RUST_LOG` | ログレベル | `info` |

### ディレクトリ構成

#### フロントエンド (apps/web)

```
src/
├── components/           # 再利用可能なUIコンポーネント
│   ├── Canvas/          # Konva.js キャンバス関連
│   ├── Toolbar/         # ツールバー
│   ├── PropertyPanel/   # プロパティパネル
│   ├── Toast/           # トースト通知
│   └── ui/              # 汎用 UI コンポーネント
├── features/            # 機能ごとのドメインロジック
│   ├── drawing/         # 描画モード機能
│   ├── selection/       # 選択・移動モード機能
│   ├── eraser/          # 消しゴム機能
│   └── export/          # エクスポート・インポート機能
├── hooks/               # カスタムフック
├── stores/              # Zustand 状態管理
├── types/               # TypeScript 型定義
├── utils/               # ユーティリティ関数
└── App.tsx              # メインアプリケーション
```

#### バックエンド (apps/backend)

```
src/
├── api/                 # REST API ハンドラー
├── auth/                # 認証 (JWT, パスフレーズ)
├── config/              # 設定管理
├── error/               # エラー定義
├── persistence/         # データ永続化 (PostgreSQL)
├── pubsub/              # Redis Pub/Sub (マルチインスタンス同期)
├── sync/                # CRDT 同期ロジック (Yrs)
└── websocket/           # WebSocket ハンドラー
```

## デプロイ

### 本番環境 (Docker Compose + Traefik)

```bash
# 環境変数を設定
cp .env.prod.example .env.prod
# .env.prod を編集

# 本番環境を起動
docker-compose -f docker-compose.prod.yml up -d
```

本番環境では Traefik リバースプロキシにより以下が提供されます:
- Let's Encrypt による自動 TLS 証明書
- HTTP → HTTPS リダイレクト
- セキュリティヘッダー
- レート制限

## API リファレンス

### REST API

| エンドポイント | メソッド | 説明 |
|----------------|----------|------|
| `/api/health` | GET | ヘルスチェック |
| `/api/rooms` | POST | ルーム作成 |
| `/api/rooms/{id}/auth` | POST | パスフレーズ認証 |
| `/api/rooms/{id}` | GET | ルーム情報取得 |

### WebSocket

```
ws://localhost:3001/ws/{room_id}?token={jwt_token}&name={user_name}
```

y-protocols 互換のバイナリプロトコルで通信します。

## ブラウザサポート

- Google Chrome (最新版)
- Firefox (最新版)
- Safari (最新版)
- Edge (最新版)

## コーディング規約

詳細は [CLAUDE.md](./CLAUDE.md) を参照してください。

### 主なルール

- TypeScript strict mode を使用
- `any` 型の使用禁止（`unknown` を使用）
- クラスコンポーネント禁止（関数コンポーネントのみ）
- Named export を使用（default export 禁止）

## 貢献

1. Fork する
2. Feature ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'feat: Add amazing feature'`)
4. ブランチをプッシュ (`git push origin feature/amazing-feature`)
5. Pull Request を作成

### コミットメッセージ規約

```
<type>: <subject>

Types:
- feat: 新機能
- fix: バグ修正
- refactor: リファクタリング
- docs: ドキュメント
- test: テスト
- chore: その他
```

## ライセンス

[MIT License](LICENSE)

## 作者

- [@yshr-926](https://github.com/yshr-926)
