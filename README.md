# Gridder

Gridderは、空間的なアイデアをグリッド上で素早く形にし、画像で共有するためのデスクトップ向けビジュアルスケッチツールです。

現在は、セル集合を使う既存エディタから、グリッド頂点ポリゴンを正規モデルとする新しい編集体験へ移行しています。第一リリースはブラウザだけで動作し、バックエンドや共同編集を必要としません。

## Documents

- [ドキュメントガイド](docs/README.md)
- [第一リリース仕様](docs/spec.md)
- [ターゲットアーキテクチャ](docs/architecture/target-architecture.md)
- [UI原則](docs/ui-principles.md)
- [ドメイン用語](CONTEXT.md)
- [Architecture Decision Records](docs/adr/)
- [エディタ技術調査](docs/architecture/editor-stack-research.md)

旧計画文書は現行仕様と前提が異なるため、現行文書から分離して歴史的資料としてのみ扱います。位置付けは[ドキュメントガイド](docs/README.md#歴史的文書参照のみ)を参照してください。

## Stack

- React 19
- TypeScript 5.9
- Vite 7
- Konva / react-konva
- Zustand
- Tailwind CSS 4
- Vitest / React Testing Library / Playwright

## Requirements

- Node.js 20以上
- pnpm 8以上
- Chromium系デスクトップブラウザ

## Development

```bash
pnpm install
pnpm dev:web
```

開発サーバーは通常 [http://localhost:5173](http://localhost:5173) で起動します。

## Verification

```bash
pnpm build
pnpm lint
pnpm type-check
pnpm test
pnpm test:e2e
```

個別にフロントエンドだけ検証する場合:

```bash
pnpm --filter @gridder/web build
pnpm --filter @gridder/web lint
pnpm --filter @gridder/web type-check
pnpm --filter @gridder/web test:run
pnpm --filter @gridder/web test:e2e:chromium
```

## Repository

```text
gridder/
├── apps/
│   └── web/                 Reactアプリケーション
├── packages/
│   ├── shared-types/        現行エディタのドメイン型
│   ├── eslint-config/       ESLint共有設定
│   └── typescript-config/   TypeScript共有設定
└── docs/
    ├── README.md            文書の読み順と位置付け
    ├── adr/                 技術判断
    └── architecture/        ターゲット構成と技術調査
```

新しいエディタコアは `packages/editor-core` に置き、React やレンダラーから独立したポリゴン文書モデルを所有します。
