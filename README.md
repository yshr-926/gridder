# Gridder

Gridderは、空間的なアイデアをグリッド上で素早く形にし、画像で共有するためのデスクトップ向けビジュアルスケッチツールです。

現在は、セル集合を使う既存エディタから、グリッド頂点ポリゴンを正規モデルとする新しい編集体験へ移行しています。第一リリースはブラウザだけで動作し、バックエンドや共同編集を必要としません。

## Documents

- [第一リリース仕様](docs/spec.md)
- [UI原則](docs/ui-principles.md)
- [ドメイン用語](CONTEXT.md)
- [Architecture Decision Records](docs/adr/)
- [エディタ技術調査](docs/architecture/editor-stack-research.md)

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
    ├── adr/                 技術判断
    └── architecture/        技術調査
```

新しいエディタコアは、操作プロトタイプの承認後にポリゴンモデルで作成します。
