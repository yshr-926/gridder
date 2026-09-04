# ADR 0004: Chromium で初期版を成立させ、主要ブラウザ対応を目指す

- Status: Accepted
- Date: 2026-09-04

## Context

Gridder はデスクトップ操作を前提とするが、インストール型アプリを必須としない。初期版では素早く編集体験を検証する必要があり、同時に将来の Firefox と Safari 対応を不必要に妨げない構成が望ましい。

## Decision

- Gridder はデスクトップ向け Web アプリとして提供する。
- 初期版の必須動作環境は Chromium 系ブラウザとする。
- Firefox と Safari を将来の対応対象とし、エディタコアと文書形式をブラウザ固有 API から独立させる。
- ブラウザ固有のファイル操作は Adapter に閉じ込める。
- Chromium では対応ブラウザのファイル API を使い、同じ JSON ファイルへ保存できるようにする。
- Firefox と Safari では、対応する標準 API が利用できない間はファイル選択による読み込みとダウンロードによる保存を提供する。
- Electron や Tauri によるデスクトップアプリ化は初期版の対象外とする。

## Consequences

- 初期版では Chromium のファイル API を活用できる。
- ブラウザ差異はファイル Adapter と入力 Adapter の境界で吸収する必要がある。
- Firefox と Safari での具体的な保存 UX は、対応時点で利用可能な標準 API に合わせて決める。
