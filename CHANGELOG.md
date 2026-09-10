# Changelog

このプロジェクトの注目すべき変更はすべてこのファイルに記録します。

書式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に、バージョニングは [Semantic Versioning](https://semver.org/lang/ja/) に従います。

## [Unreleased]

### Added
- favicon とロゴ SVG を追加
- Cloudflare へのデプロイ手順書を追加
- GitHub Actions による CI（lint / type-check / test / build / E2E）を追加

### Removed
- 未使用だった Plausible Analytics のスクリプトを削除

### Technical
- `public/_headers` の CSP を `security.ts` の本番設定と一致させ、テストで検証するようにした
