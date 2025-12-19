# Contributing to Gridder

Gridder への貢献ありがとうございます。このドキュメントでは、プロジェクトへの貢献方法を説明します。

## 開発環境のセットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/yshr-926/gridder.git
cd gridder
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数のセットアップ

```bash
# .env.example をコピーして .env を作成
cp .env.example .env

# 必要に応じて環境変数を編集
vim .env
```

環境変数の詳細については `.env.example` を参照してください。

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:5173` を開いてください。

## 開発フロー

### ブランチ戦略

- `main`: 本番環境用の安定版
- `feature/*`: 新機能開発用ブランチ
- `fix/*`: バグ修正用ブランチ
- `refactor/*`: リファクタリング用ブランチ

### PRの作成前チェックリスト

PRを作成する前に、以下のコマンドがすべて成功することを確認してください。

```bash
# Lint チェック
npm run lint

# 型チェック
npm run type-check

# テスト実行
npm run test:run

# ビルド確認
npm run build
```

または、一括で実行：

```bash
npm run lint && npm run type-check && npm run test:run && npm run build
```

### CI チェック

PRを作成すると、以下のチェックが自動で実行されます。

1. **Lint**: ESLint によるコード品質チェック
2. **Type Check**: TypeScript の型チェック
3. **Test**: Vitest によるユニットテスト（カバレッジ80%以上必須）
4. **Build**: プロダクションビルドの成功確認

すべてのチェックが成功しないとマージできません。

### テストカバレッジ

- プロジェクト全体で **80%以上** のカバレッジを維持してください
- 新機能を追加する場合は、必ずユニットテストを追加してください
- カバレッジレポートは `npm run test:coverage` で確認できます

### コードスタイル

- TypeScript の `any` 型は使用禁止です（`unknown` を使用）
- クラスコンポーネントは使用禁止です（関数コンポーネントのみ）
- Named export を使用してください（default export は禁止）
- 詳細は `CLAUDE.md` を参照してください

## コミットメッセージ規約

```
<type>: <subject>

[optional body]
```

**Type:**
- `feat`: 新機能
- `fix`: バグ修正
- `refactor`: リファクタリング
- `style`: コードスタイル（機能に影響なし）
- `docs`: ドキュメント
- `test`: テスト
- `chore`: ビルド、設定変更

**例:**
```
feat: グリッドのズーム機能を追加

- マウスホイールでズームイン/アウト
- ピンチジェスチャー対応
```

## 質問や問題があれば

- Issue を作成してください
- PR のコメントで質問してください

Gridder への貢献をお待ちしています。
