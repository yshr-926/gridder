# バンドル最適化

## 現状のバンドルサイズ

| チャンク | 非圧縮 | gzip |
|----------|--------|------|
| index.js | 271KB | ~84KB |
| konva.js | 312KB | ~95KB |
| sentry.js | 254KB | ~83KB |
| vendor.js | 11KB | ~4KB |
| zustand.js | 0.7KB | ~0.5KB |
| index.css | 24KB | ~5KB |
| **合計** | **~873KB** | **~272KB** |

> 計測日: 2025-12-19

## 実施済み最適化

### 1. コード分割（Code Splitting）

```typescript
// vite.config.ts
manualChunks: {
  vendor: ['react', 'react-dom'],
  konva: ['konva', 'react-konva'],
  zustand: ['zustand'],
  sentry: ['@sentry/react'],
}
```

- React/ReactDOM を vendor チャンクに分離
- Konva.js を専用チャンクに分離
- Zustand を専用チャンクに分離
- Sentry を専用チャンクに分離

### 2. Tree Shaking

- ES Modules を使用し、未使用コードを自動削除
- Named exports を使用

### 3. 本番ビルド最適化

- console.log / debugger の削除（本番環境のみ）
- ソースマップは Sentry 用に生成（デバッグ目的）
- esbuild による高速ミニファイ
- ES2020 ターゲットでモダンブラウザ向け最適化

### 4. Nginx での圧縮とキャッシュ

- Gzip 圧縮有効化（nginx.conf）
- アセットファイルの長期キャッシュ設定（1年間）
- Brotli 圧縮も設定可能（要追加設定）

### 5. Docker マルチステージビルド

- ビルドステージと本番ステージを分離
- 本番イメージには最小限のファイルのみ含める
- Alpine ベースイメージで軽量化

## 今後の最適化候補

### 検討中

1. **動的インポート**: 使用頻度の低い機能の遅延読み込み
   - エクスポート機能の遅延読み込み
   - ヘルプ/チュートリアル機能の遅延読み込み

2. **Konva.js の部分インポート**: 必要なシェイプのみインポート（要調査）
   - Konva.js はモノリシックな設計のため、部分インポートには限界あり

3. **Sentry SDK の軽量化**: 必要な機能のみインポート
   - エラートラッキングのみ必要な場合、オプション機能を除外

4. **フォント最適化**: Web フォント使用時の最適化
   - システムフォントを使用中のため、現時点で不要

### 見送り

1. **Brotli 圧縮**: Nginx で対応可能（要設定）
2. **画像最適化**: 現時点で画像アセットが少ない
3. **SSR / ISR**: ブラウザ完結型アプリケーションのため不要

## バンドルサイズ基準

| 指標 | 目標値 | 現状 | 状態 |
|------|--------|------|------|
| Total (gzip) | < 350KB | ~272KB | OK |
| 最大チャンク (gzip) | < 100KB | ~95KB | OK |
| index.js (gzip) | < 100KB | ~84KB | OK |
| chunkSizeWarningLimit | 500KB | 設定済み | OK |

### パフォーマンス指標

| 指標 | 目標値 | 備考 |
|------|--------|------|
| LCP (Largest Contentful Paint) | < 2.5s | Canvas 初期化が完了するまで |
| FCP (First Contentful Paint) | < 1.8s | 初期ローディング |
| TTI (Time to Interactive) | < 3.5s | ツール操作可能になるまで |

## 分析コマンド

### バンドル分析レポート生成

```bash
# バンドル分析を実行
npm run build:analyze

# dist/stats.html がブラウザで自動的に開く
# 開かない場合は手動で開く
open dist/stats.html
```

### バンドルサイズ確認

```bash
# 通常ビルド
npm run build

# アセットサイズ確認
du -h dist/assets/*

# gzip 圧縮後のサイズ確認（すべての JS ファイル）
for f in dist/assets/*.js; do
  echo "$f: $(gzip -c "$f" | wc -c) bytes (gzip)"
done
```

## Docker イメージサイズ

```bash
# イメージサイズ確認
docker images gridder

# レイヤー構成確認
docker history gridder:latest

# 詳細なサイズ内訳
docker system df -v | grep gridder
```

### 目標

- 最終イメージサイズ: < 50MB（Nginx Alpine ベース）
- ビルドキャッシュを活用して CI 時間を短縮

## トラブルシューティング

### stats.html が生成されない

1. `npm run build:analyze` で --mode analyze が渡されているか確認
2. vite.config.ts の mode 判定を確認
3. rollup-plugin-visualizer がインストールされているか確認

```bash
npm list rollup-plugin-visualizer
```

### ブラウザが自動的に開かない

visualizer の `open: true` オプションが設定されているか確認し、手動で開く:

```bash
open dist/stats.html
```

### バンドルサイズが大きすぎる

1. `npm run build:analyze` で stats.html を確認
2. 大きなチャンクを特定
3. 不要な依存関係がないか `package.json` を確認
4. 動的インポートで遅延読み込みを検討

### チャンクサイズ警告が表示される

```
⚠ Some chunks are larger than 500 kB after minification...
```

- 現在の設定（`chunkSizeWarningLimit: 500`）を超えるチャンクがある
- 必要に応じて閾値を調整するか、チャンク分割を検討

## 関連ドキュメント

- [Vite Build Optimizations](https://vitejs.dev/guide/build.html)
- [rollup-plugin-visualizer](https://github.com/btd/rollup-plugin-visualizer)
- [Web Performance Budgets](https://web.dev/performance-budgets-101/)
- [Core Web Vitals](https://web.dev/vitals/)
