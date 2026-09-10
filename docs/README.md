# Gridder ドキュメントガイド

## 現行文書

プロダクトの挙動や設計を判断するときは、次の順序で確認する。

1. [ドメイン用語](../CONTEXT.md)
2. [第一リリース仕様](./spec.md)
3. [ターゲットアーキテクチャ](./architecture/target-architecture.md)
4. [Architecture Decision Records](./adr/)
5. [UI 原則](./ui-principles.md)

技術選定の比較と根拠は [エディタ技術スタック調査](./architecture/editor-stack-research.md)、リリース作業は [リリースワークフロー](./release-workflow.md)、配信環境は [デプロイ手順](./deployment.md) を参照する。`docs/agents/` はリポジトリ運用の補助資料であり、プロダクト仕様やアーキテクチャの根拠にはしない。

文書間に差異がある場合は、第一リリース仕様と Accepted の ADR を優先し、実装を現行設計へ移行する。

## 歴史的文書（参照のみ）

次のパスにあった資料は、セル集合、Rust バックエンド、共同編集を前提とする旧計画であり、現行設計の根拠ではない。

- `docs/plan/`
- `docs/design/phase18/`
- `docs/review/`

これらは Git の追跡対象から分離されている。既存の作業環境に残っている場合も経緯の確認だけに使い、要件や実装方針の判断には現行文書を使う。
