# ==========================================
# Gridder - Docker Multi-stage Build
# ==========================================

# ==========================================
# ビルドステージ
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# 依存関係のインストール（キャッシュ最適化）
COPY package*.json ./
RUN npm ci

# ソースコードをコピー
COPY . .

# アプリケーションをビルド
RUN npm run build

# ==========================================
# 本番ステージ
# ==========================================
FROM nginx:1.25-alpine

# Nginx 設定ファイルをコピー
COPY nginx.conf /etc/nginx/nginx.conf

# ビルド成果物をコピー
COPY --from=builder /app/dist /usr/share/nginx/html

# ヘルスチェック用エンドポイント
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/health || exit 1

# ポート公開
EXPOSE 80

# Nginx を起動
CMD ["nginx", "-g", "daemon off;"]
