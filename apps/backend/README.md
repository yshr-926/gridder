# Gridder Backend

[![Rust](https://img.shields.io/badge/Rust-1.92-DEA584?logo=rust&logoColor=black)](https://www.rust-lang.org/)
[![Axum](https://img.shields.io/badge/Axum-0.7-blue)](https://github.com/tokio-rs/axum)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Gridder のリアルタイム共同編集バックエンド。Yjs 互換の WebSocket サーバーと REST API を提供します。

## 概要

- **WebSocket サーバー**: y-protocols 互換のバイナリプロトコルで CRDT 同期
- **REST API**: ルーム管理、認証エンドポイント
- **CRDT エンジン**: Yrs (Yjs の Rust 実装) による状態管理
- **永続化**: PostgreSQL によるドキュメント状態の保存
- **スケーラビリティ**: Redis Pub/Sub によるマルチインスタンス同期

## 技術スタック

| カテゴリ | 技術 |
|----------|------|
| 言語 | Rust 1.92 (Edition 2024) |
| Web フレームワーク | Axum 0.7 |
| 非同期ランタイム | Tokio |
| CRDT | Yrs 0.18 |
| データベース | PostgreSQL (SQLx 0.8) |
| キャッシュ | Redis (Fred 9) |
| 認証 | JWT + bcrypt |

## 必要条件

- Rust 1.92+
- PostgreSQL 16+
- Redis 7+ (オプション、マルチインスタンス時)

## セットアップ

### 環境変数

```bash
cp ../../.env.example .env
```

| 変数名 | 説明 | 本番環境 |
|--------|------|---------|
| `DATABASE_URL` | PostgreSQL 接続文字列 | **必須** |
| `JWT_SECRET` | JWT 署名キー | **必須** |
| `CORS_ALLOWED_ORIGINS` | 許可オリジン (カンマ区切り) | **必須** |
| `PORT` | サーバーポート | `3001` |
| `REDIS_HOST` | Redis ホスト | オプション |
| `REDIS_PORT` | Redis ポート | `6379` |
| `RUST_LOG` | ログレベル | `info` |

### ビルド・実行

```bash
# 開発ビルド
cargo build

# リリースビルド
cargo build --release

# サーバー起動
cargo run

# マイグレーション実行
sqlx migrate run
```

## 開発

### コマンド

```bash
# テスト実行
cargo test

# リント
cargo clippy --all-targets --all-features -- -D warnings

# フォーマット
cargo fmt

# 型チェック (高速)
cargo check

# ドキュメント生成
cargo doc --open
```

### ディレクトリ構成

```
src/
├── api/           # REST API ハンドラー
│   ├── handlers.rs   # エンドポイント実装
│   ├── routes.rs     # ルーティング定義
│   └── state.rs      # API 状態管理
├── auth/          # 認証
│   ├── jwt.rs        # JWT トークン管理
│   └── passphrase.rs # パスフレーズ認証
├── config.rs      # 設定管理
├── error.rs       # エラー定義
├── persistence/   # データ永続化
│   ├── document.rs   # ドキュメントリポジトリ
│   ├── room.rs       # ルームリポジトリ
│   └── snapshot.rs   # スナップショット管理
├── pubsub/        # Redis Pub/Sub
│   └── handler.rs    # リモートメッセージハンドラ
├── sync/          # CRDT 同期
│   ├── awareness.rs  # Awareness 状態管理
│   └── room.rs       # ルーム・ドキュメント管理
├── websocket/     # WebSocket
│   ├── connection.rs # クライアント接続
│   ├── handler.rs    # メッセージハンドラ
│   └── protocol.rs   # y-protocols 実装
├── lib.rs         # ライブラリエントリポイント
└── main.rs        # バイナリエントリポイント
```

## API

### REST API

| エンドポイント | メソッド | 説明 |
|----------------|----------|------|
| `/api/health` | GET | ヘルスチェック |
| `/api/rooms` | POST | ルーム作成 |
| `/api/rooms/{id}` | GET | ルーム情報取得 |
| `/api/rooms/{id}/auth` | POST | パスフレーズ認証 |

### WebSocket

```
ws://localhost:3001/ws/{room_id}?token={jwt_token}&name={user_name}
```

**プロトコル**: y-protocols 互換バイナリ形式

| メッセージタイプ | 説明 |
|------------------|------|
| `0` | Sync Step 1 (状態ベクトル) |
| `1` | Sync Step 2 (状態差分) |
| `2` | Update (増分更新) |
| `3` | Awareness |

## テスト

```bash
# 全テスト実行
cargo test

# 特定テスト実行
cargo test test_room_creation

# 統合テスト (DB 必要)
cargo test --test integration
```

## Docker

```bash
# イメージビルド
docker build -t gridder-backend .

# コンテナ起動
docker run -p 3001:3001 \
  -e DATABASE_URL=postgres://... \
  -e JWT_SECRET=your-secret \
  -e CORS_ALLOWED_ORIGINS=https://example.com \
  gridder-backend
```

## ライセンス

[MIT License](../../LICENSE)
