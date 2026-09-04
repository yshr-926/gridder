# リリースワークフロー

本ドキュメントでは、Gridder プロジェクトのバージョン管理とリリース手順を定義します。

## バージョニング方針

[Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) に準拠します。

| バージョン種別 | 形式 | 変更内容 | 例 |
|----------------|------|----------|-----|
| **MAJOR** | X.0.0 | 後方互換性のない変更 | 1.0.0 → 2.0.0 |
| **MINOR** | 0.X.0 | 後方互換性のある機能追加 | 1.0.0 → 1.1.0 |
| **PATCH** | 0.0.X | 後方互換性のあるバグ修正 | 1.0.0 → 1.0.1 |

### バージョン変更の判断基準

#### MAJOR バージョン（X.0.0）

ユーザーに影響する破壊的変更が含まれる場合：

- プロジェクトファイル形式（JSON）の互換性がなくなる変更
- 既存の機能の削除
- UI/UX の大幅な変更

#### MINOR バージョン（0.X.0）

後方互換性を保ちながら新機能を追加する場合：

- 新しいツールやモードの追加
- 新しいエクスポート形式のサポート
- 新しいキーボードショートカットの追加

#### PATCH バージョン（0.0.X）

バグ修正やパフォーマンス改善の場合：

- 描画のバグ修正
- パフォーマンス改善
- ドキュメント修正

## リリース手順

### 1. リリース準備

1. `main` ブランチが最新であることを確認

   ```bash
   git checkout main
   git pull origin main
   ```

2. すべてのテストが通ることを確認

   ```bash
   npm run lint
   npm run type-check
   npm run test:run
   npm run test:e2e
   npm run build
   ```

3. 変更内容を確認

   ```bash
   git log --oneline origin/main..HEAD
   ```

### 2. バージョン更新

1. `package.json` の version を更新

   ```bash
   # パッチリリース（バグ修正）
   npm version patch

   # マイナーリリース（新機能追加）
   npm version minor

   # メジャーリリース（破壊的変更）
   npm version major
   ```

   **注意**: `npm version` コマンドは自動的に git タグを作成しますが、
   `--no-git-tag-version` オプションを使用して手動でタグを作成することも可能です。

2. `CHANGELOG.md` を更新

   - `[Unreleased]` セクションの内容を新バージョンに移動
   - リリース日を追記（YYYY-MM-DD 形式）
   - 新しい空の `[Unreleased]` セクションを追加

   例：

   ```markdown
   ## [Unreleased]

   ## [1.1.0] - 2025-01-15

   ### Added
   - 新機能の説明
   ```

### 3. リリースコミット

```bash
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: release v1.0.0"
git tag v1.0.0
git push origin main --tags
```

### 4. GitHub Release 作成

1. GitHub リポジトリの「Releases」ページを開く
2. 「Draft a new release」をクリック
3. 作成したタグを選択（例：`v1.0.0`）
4. リリースタイトルを入力（例：`v1.0.0`）
5. CHANGELOG の該当バージョンの内容をリリースノートにコピー
6. 「Publish release」をクリック

### 5. デプロイ

1. [デプロイ手順書](./deployment-guide.md) に従ってデプロイを実行
2. [デプロイ後チェックリスト](./deployment-checklist.md) を実行して動作確認

## CHANGELOG 記載ルール

### カテゴリ定義

| カテゴリ | 説明 | 例 |
|----------|------|-----|
| **Added** | 新機能 | 新しいツール、新しいエクスポート形式 |
| **Changed** | 既存機能の変更 | UIの改善、動作の変更 |
| **Deprecated** | 将来削除予定の機能 | 非推奨となった機能の通知 |
| **Removed** | 削除された機能 | 機能の廃止 |
| **Fixed** | バグ修正 | 不具合の修正 |
| **Security** | セキュリティ修正 | 脆弱性の修正 |
| **Technical** | 技術的な変更 | 依存関係更新、ビルド設定変更 |

### 記載フォーマット

```markdown
### カテゴリ名
- 変更内容の簡潔な説明 (#Issue番号)
```

### 記載例

```markdown
## [1.1.0] - 2025-02-01

### Added
- グリッドのスナップ機能を追加 (#123)
- SVG 形式でのエクスポートに対応 (#145)

### Fixed
- 大量オブジェクト時のパフォーマンス低下を修正 (#156)
- 消しゴムモードでの描画バグを修正 (#162)

### Changed
- ズーム操作の感度を調整 (#170)

### Technical
- React を 19.2.0 から 19.3.0 に更新
- Konva.js を 10.0.12 から 10.1.0 に更新
```

### 記載のポイント

1. **ユーザー視点で書く**: 技術的な詳細よりもユーザーへの影響を重視
2. **動詞で始める**: 「追加」「修正」「変更」など明確な動詞を使用
3. **Issue/PR 番号を含める**: 詳細を追跡できるようにリンクを記載
4. **簡潔に**: 1項目につき1〜2行で記載

## GitHub Releases の活用

### リリースノートの内容

- CHANGELOG の該当バージョンの内容をコピー
- 必要に応じて追加の説明や注意事項を記載
- 破壊的変更がある場合は特に強調

### 将来的な拡張（検討事項）

- ビルドアーティファクトの添付（静的Webバンドル等）
- リリース自動化（GitHub Actions による自動リリース）
- リリースノートの自動生成

## 関連ドキュメント

- [CHANGELOG.md](../CHANGELOG.md)
- [第一リリース仕様](./spec.md)
- [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
- [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
