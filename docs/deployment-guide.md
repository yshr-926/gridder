# Gridder デプロイガイド

このドキュメントでは、Gridder アプリケーションを Docker Compose を使用してデプロイする手順を説明します。

## 目次

- [前提条件](#前提条件)
- [HTTPS について](#https-について)
- [デプロイ手順](#デプロイ手順)
- [ログの確認](#ログの確認)
- [停止・再起動](#停止再起動)
- [更新手順](#更新手順)
- [トラブルシューティング](#トラブルシューティング)
- [定期メンテナンス](#定期メンテナンス)

---

## 前提条件

以下のソフトウェアがインストールされていること:

| ソフトウェア | バージョン | 確認コマンド |
|-------------|-----------|-------------|
| Docker | 20.10+ | `docker --version` |
| Docker Compose | 2.0+ | `docker compose version` |
| Git | 2.0+ | `git --version` |

また、以下の権限が必要です:

- サーバーへの SSH アクセス権限
- Docker デーモンの操作権限（docker グループへの所属）

---

## HTTPS について

本番環境では **TLS 終端（HTTPS）はリバースプロキシ/ロードバランサ側で行う**ことを推奨します。

このコンテナは HTTP（ポート 80）でのみ配信する設計です。

### 推奨構成

```
[クライアント] --HTTPS--> [リバースプロキシ/LB] --HTTP--> [Gridder コンテナ]
```

リバースプロキシの例:
- Nginx（別途設定）
- Traefik
- AWS ALB / GCP Load Balancer

---

## デプロイ手順

### 1. リポジトリのクローン

```bash
# リポジトリをクローン
git clone <repository-url> gridder
cd gridder

# 本番用ブランチを確認
git checkout main

# 最新のコードを取得
git pull origin main
```

### 2. 環境変数の設定（オプション）

必要に応じて `.env` ファイルを作成します。

```bash
# .env.example をコピー
cp .env.example .env

# 設定を編集（必要な場合）
nano .env
```

### 主な環境変数

| 変数名 | 説明 | デフォルト値 |
|-------|------|------------|
| `PORT` | コンテナの公開ポート | `8080` |
| `NODE_ENV` | 実行環境 | `production` |

### 3. Docker Compose でビルド・起動

```bash
# イメージをビルドしてコンテナをバックグラウンドで起動
docker compose up -d --build

# 起動状態を確認
docker compose ps
```

**期待される出力:**

```
NAME        IMAGE           COMMAND                  SERVICE     CREATED         STATUS         PORTS
gridder     gridder:latest  "/docker-entrypoint.…"   gridder     10 seconds ago  Up 9 seconds   0.0.0.0:8080->80/tcp
```

### 4. 動作確認

```bash
# ヘルスチェック
curl -I http://localhost:8080/health

# 期待される応答: HTTP/1.1 200 OK
```

ブラウザでアクセスして確認:

```
http://[server-ip]:8080
```

---

## ログの確認

### コンテナログの表示

```bash
# 最新のログを表示
docker compose logs

# 最新100行のログを表示
docker compose logs --tail 100

# リアルタイムでログを監視
docker compose logs -f

# 特定のサービスのログ
docker compose logs gridder
```

### Nginx ログの確認

コンテナ内で直接確認する場合:

```bash
# アクセスログ
docker compose exec gridder cat /var/log/nginx/access.log

# エラーログ
docker compose exec gridder cat /var/log/nginx/error.log
```

---

## 停止・再起動

### コンテナの停止

```bash
# コンテナを停止（データは保持）
docker compose stop

# コンテナを停止して削除
docker compose down
```

### コンテナの起動

```bash
# 停止中のコンテナを起動（既存イメージを使用）
docker compose up -d

# コンテナを再起動
docker compose restart
```

### コンテナの状態確認

```bash
# 実行中のコンテナを確認
docker compose ps

# コンテナの詳細情報
docker compose inspect gridder
```

---

## 更新手順

新しいバージョンをデプロイする手順です。

### 1. 最新コードの取得

```bash
cd gridder

# 現在のブランチを確認
git branch

# 最新コードを取得
git pull origin main
```

### 2. コンテナの再ビルド・再起動

```bash
# コンテナを停止
docker compose down

# キャッシュを使わずに再ビルドして起動
docker compose up -d --build
```

### 3. 更新後の確認

```bash
# コンテナの状態確認
docker compose ps

# ヘルスチェック
curl -I http://localhost:8080/health

# ログ確認（エラーがないか）
docker compose logs --tail 50
```

### ロールバック手順

問題が発生した場合のロールバック:

```bash
# 前のバージョンに戻す
git checkout <previous-commit-hash>

# 再ビルドして起動
docker compose down
docker compose up -d --build
```

---

## トラブルシューティング

### コンテナが起動しない

**症状:** `docker compose up -d` 後にコンテナが起動しない

**確認手順:**

```bash
# コンテナの状態確認
docker compose ps

# ログ確認
docker compose logs gridder

# イメージの確認
docker images | grep gridder
```

**よくある原因と対処:**

1. **ビルドエラー**
   ```bash
   # キャッシュをクリアして再ビルド
   docker compose build --no-cache
   ```

2. **依存関係のエラー**
   ```bash
   # node_modules を含めて再ビルド
   docker compose down -v
   docker compose up -d --build
   ```

### ポートが既に使用されている

**症状:** `Bind for 0.0.0.0:8080 failed: port is already allocated`

**確認手順:**

```bash
# ポート8080を使用しているプロセスを確認
sudo lsof -i :8080
# または
sudo netstat -tlnp | grep 8080
```

**対処方法:**

1. 既存のプロセスを停止する
2. または `docker-compose.yml` のポート設定を変更する

```yaml
# docker-compose.yml
ports:
  - "9090:80"  # 8080から9090に変更
```

### ビルドエラーが発生する

**症状:** `npm install` や `npm run build` で失敗する

**対処方法:**

```bash
# キャッシュをクリアして再ビルド
docker compose build --no-cache

# 既存のコンテナ・ボリュームを削除して再構築
docker compose down -v
docker compose up -d --build
```

### コンテナにアクセスできない

**症状:** `curl` や ブラウザでアクセスできない

**確認手順:**

```bash
# コンテナが実行中か確認
docker compose ps

# コンテナ内からテスト
docker compose exec gridder curl -I http://localhost/health

# ファイアウォールの確認（Linux）
sudo iptables -L -n | grep 8080
```

### メモリ不足エラー

**症状:** ビルド中に `ENOMEM` や `Killed` エラーが発生

**対処方法:**

```bash
# Docker のメモリ制限を確認
docker info | grep Memory

# 不要なコンテナ・イメージを削除
docker system prune -a
```

---

## 定期メンテナンス

### ディスク容量の管理

Docker イメージやコンテナがディスクを圧迫することがあります。

```bash
# Docker が使用しているディスク容量を確認
docker system df

# 使用していないイメージの削除
docker image prune -a

# 停止したコンテナ、未使用ネットワーク、dangling イメージの削除
docker system prune

# システム全体のクリーンアップ（ボリュームも含む）
docker system prune -a --volumes
```

**注意:** `--volumes` オプションを使用すると、未使用のボリュームも削除されます。

### ログローテーション

Docker のログが肥大化しないように、ログローテーションを設定します。

#### 方法1: daemon.json で設定

`/etc/docker/daemon.json` を作成または編集:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

設定後、Docker を再起動:

```bash
sudo systemctl restart docker
```

#### 方法2: docker-compose.yml で設定

```yaml
services:
  gridder:
    # ... 他の設定 ...
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 定期的なイメージ更新

セキュリティパッチを適用するため、定期的にベースイメージを更新します。

```bash
# 最新のベースイメージを取得
docker pull nginx:alpine

# アプリケーションを再ビルド
docker compose build --no-cache
docker compose up -d
```

### バックアップ

Gridder はブラウザのローカルストレージにデータを保存するため、サーバー側でのバックアップは不要です。

ただし、設定ファイル（`.env` など）がある場合はバックアップを推奨します:

```bash
# 設定ファイルのバックアップ
cp .env .env.backup.$(date +%Y%m%d)
```

---

## 関連ドキュメント

- [デプロイ後確認チェックリスト](./deployment-checklist.md)
- [環境変数の設定](./environment-variables.md)
- [CHANGELOG](../CHANGELOG.md)
