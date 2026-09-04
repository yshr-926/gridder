# Gridder エディタ技術スタック調査

- 調査日: 2026-09-04
- 対象: tldraw SDK、Fabric.js、Konva / react-konva、PixiJS 8
- 情報源: 各プロジェクトの公式ドキュメント、公式リポジトリ、公式ライセンスのみ

## 結論

Gridder の初回リリースには、**Konva / react-konva を継続採用**する。図形データと操作履歴は Konva のノードではなく Gridder のドメインモデルで管理し、描画を「セルごとの `Rect`」から「オブジェクトごとのポリゴン」に改める。選択枠・頂点・辺ハンドルは専用の操作オーバーレイとして実装する。

理由は次のとおり。

1. Konva はドラッグ、イベント、`Transformer`、カスタム図形、ヒット領域、カーソル中心ズーム、画像出力を提供し、Gridder が必要とする低レベル部品が揃っている。公式にも「数千の図形」を扱う用途が示されており、最大約500図形という前提では、PixiJS へ移る根拠が弱い。[Konva overview](https://konvajs.org/docs/)、[Transformer](https://konvajs.org/docs/react/Transformer.html)、[pointer-relative zoom](https://konvajs.org/docs/sandbox/Zooming_Relative_To_Pointer.html)
2. 現行フロントエンドは Konva / react-konva を使用しており、描画・ズーム・パン・入力処理が既に存在する。一方、PixiJS の現行コードは描画境界の PoC であり、エディタ操作はまだ含まない。[web package.json](../../apps/web/package.json)、[Pixi renderer PoC](../../packages/editor-renderer-pixi/src/pixi-editor-renderer.ts)
3. tldraw はエディタ機能が最も充実するが、本番利用には原則ライセンスキーが必要で、Gridder 固有のポリゴン操作を実現しても SDK の操作モデルと製品ライセンスに強く依存する。[tldraw license documentation](https://github.com/tldraw/tldraw/blob/main/apps/docs/content/community/license.mdx)、[LICENSE.md](https://github.com/tldraw/tldraw/blob/main/LICENSE.md)
4. Fabric.js は permissive な MIT ライセンスで標準の直接操作も強いが、既存 Konva 実装を捨てるほどの機能差はない。React 公式アダプターも公式コア機能としては提供されず、Canvas の命令的ライフサイクルをアプリ側で管理する構成になる。[Fabric.js core concepts](https://fabricjs.com/docs/core-concepts/)、[official resources](https://fabricjs.com/resources/)、[MIT license](https://github.com/fabricjs/fabric.js/blob/master/LICENSE)
5. PixiJS 8 は高性能レンダラーとして優れるが、選択・リサイズ・スナップ・編集ツール・文書シリアライズは Gridder 側の実装になる。500図形規模では、その追加コストを正当化する測定結果がない。[PixiJS architecture](https://pixijs.com/8.x/guides/concepts/architecture)、[events](https://pixijs.com/8.x/guides/components/events)

UI シェルは **Base UI + Tailwind CSS + Lucide** を推奨する。Base UI はアクセシブルな unstyled React primitives、Tailwind は制約付きのスタイリング、Lucide は一貫した tree-shakable SVG アイコンを提供する。キャンバス操作はこれらから独立させ、メニュー、ポップオーバー、ダイアログ、ツールチップ、入力欄などの DOM UI に限定して使う。[Base UI overview](https://base-ui.com/react/overview/about)、[Base UI accessibility](https://base-ui.com/react/overview/accessibility)、[Tailwind utility classes](https://tailwindcss.com/docs/styling-with-utility-classes)、[Lucide](https://lucide.dev/)

## 評価前提

- デスクトップ向けグリッドベース・ビジュアルスケッチツール
- 最大約500図形
- グリッド頂点へスナップする矩形・ポリゴン
- 空白の左ドラッグで矩形作成
- 選択中は中央ドラッグで移動、辺・角付近のドラッグでリサイズ
- カーソル中心ホイールズーム、中ボタンまたは Space + ドラッグでパン
- セル追加・削除はポリゴンの和・差として扱う
- PNG / JPEG 出力
- 共同編集は初回リリース後
- 旧 JSON 互換性は不要

「標準提供」は、公式 API または公式サンプルで直接確認できる機能を指す。サンプルの組み合わせやアプリ固有コードが必要なものは「要実装」とした。

## 比較表

| 項目 | tldraw SDK | Fabric.js | Konva / react-konva | PixiJS 8 |
|---|---|---|---|---|
| 標準の直接操作 | **最も充実**。選択、移動、リサイズ、回転、ハンド、ズーム、パン、履歴をエディタとして提供。[tools](https://tldraw.dev/sdk-features/tools)、[selection](https://tldraw.dev/sdk-features/selection) | **充実**。選択、範囲選択、移動、拡縮、回転、スキュー、コントロールを提供。[core concepts](https://fabricjs.com/docs/core-concepts/)、[controls](https://fabricjs.com/docs/configuring-controls/) | **部品を提供**。イベント、drag、`Transformer` はあるが、選択状態と操作規則はアプリ側。[drag](https://konvajs.org/docs/react/Drag_And_Drop.html)、[Transformer](https://konvajs.org/docs/react/Transformer.html) | **入力基盤のみ**。イベントとヒットテストはあるが、エディタ操作はアプリ側。[events](https://pixijs.com/8.x/guides/components/events) |
| 空白ドラッグ作成 | カスタム `StateNode` / tool が必要。[custom tools](https://tldraw.dev/sdk-features/tools) | ポインターイベントから要実装。[events](https://fabricjs.com/docs/events/) | Stage のポインターイベントから要実装。[events](https://konvajs.org/docs/events/Binding_Events.html) | federated events から要実装。[events](https://pixijs.com/8.x/guides/components/events) |
| 中央移動・辺/角リサイズ | select tool が標準提供。ただし Gridder 固有の当たり判定・スナップ規則は要拡張。[tools](https://tldraw.dev/sdk-features/tools) | オブジェクト移動と control による変形を標準提供。[controls](https://fabricjs.com/docs/configuring-controls/) | `draggable` と `Transformer` を標準提供。辺近傍のカーソル判定やグリッド拘束は要実装。[Transformer](https://konvajs.org/docs/react/Transformer.html)、[resize limits](https://konvajs.org/docs/select_and_transform/Resize_Limits.html) | 全て要実装。[events](https://pixijs.com/8.x/guides/components/events)、[scene objects](https://pixijs.com/8.x/guides/components/scene-objects) |
| カーソル中心ズーム、パン | 標準エディタ操作。Space / 右ボタンパン等を option で制御可能。[options](https://tldraw.dev/sdk-features/options) | `zoomToPoint` と `absolutePan` を提供。ホイール・Space・中ボタンの割り当ては要実装。[Canvas API](https://fabricjs.com/api/classes/canvas/) | カーソル中心ホイールズームの公式実装例あり。パンの入力規則は要実装。[zoom example](https://konvajs.org/docs/sandbox/Zooming_Relative_To_Pointer.html) | viewport container の transform と wheel/pointer events から要実装。[scene graph](https://pixijs.com/8.x/guides/concepts/scene-graph)、[events](https://pixijs.com/8.x/guides/components/events) |
| カスタム図形 | `ShapeUtil`、props、geometry、React rendering を提供。[shapes](https://tldraw.dev/sdk-features/shapes) | `FabricObject` の拡張とカスタム property が可能。[custom properties](https://fabricjs.com/docs/using-custom-properties/) | `Shape` の `sceneFunc` / `hitFunc` を提供。[custom shape](https://konvajs.org/docs/react/Custom_Shape.html)、[custom hit region](https://konvajs.org/docs/events/Custom_Hit_Region.html) | `Graphics` で polygon、path、hole を描画可能。[Graphics](https://pixijs.com/8.x/guides/components/scene-objects/graphics) |
| グリッドスナップ | snap API と `Vec.SnapToGrid` はあるが、Gridder の頂点・辺ルールは要実装。[Vec API](https://tldraw.dev/reference/editor/Vec)、[custom snapping example](https://tldraw.dev/examples/shapes/tools/bounds-snapping-shape) | 汎用座標・イベントから要実装。[Canvas API](https://fabricjs.com/api/classes/canvas/) | 公式 snapping 例はアプリコードとして実装。Gridder の頂点スナップも同様。[object snapping](https://konvajs.org/docs/sandbox/Objects_Snapping.html) | 要実装。[events](https://pixijs.com/8.x/guides/components/events) |
| ポリゴン頂点編集 | custom handles と callbacks を提供。Gridder の編集規則は要実装。[handles](https://tldraw.dev/sdk-features/handles) | `createPolyControls` を公式提供。ただし座標補正を含むカスタム control 実装になる。[polygon controls demo](https://fabricjs.com/demos/poly-controls/)、[createPolyControls](https://fabricjs.com/api/fabric/namespaces/controlsutils/functions/createpolycontrols/) | カスタム anchor / overlay と hit region で要実装。[custom shape](https://konvajs.org/docs/react/Custom_Shape.html)、[custom hit region](https://konvajs.org/docs/events/Custom_Hit_Region.html) | Graphics と events から全て要実装。[Graphics](https://pixijs.com/8.x/guides/components/scene-objects/graphics)、[events](https://pixijs.com/8.x/guides/components/events) |
| ポリゴン論理演算 | Gridder のドメイン処理として別途必要 | 同左 | 同左 | 同左 |
| PNG / JPEG | `toImage` / `toImageDataUrl` で PNG、JPEG、WebP、SVG。[image export](https://tldraw.dev/sdk-features/image-export) | Canvas / object の `toDataURL` と JPEG / PNG 出力。[toDataURL API](https://fabricjs.com/api/fabric/namespaces/util/functions/todataurl/)、[getting started](https://fabricjs.com/docs/getting-started/helloworld/) | Node / Stage の `toDataURL`、`mimeType`、`quality`、`pixelRatio` を提供。[Node API](https://konvajs.org/api/Konva.Node.html)、[high-quality export](https://konvajs.org/docs/data_and_serialization/High-Quality-Export.html) | `ExtractSystem` が canvas / image / download を提供し、PNG、JPEG、WebP を扱う。[ExtractSystem](https://pixijs.download/dev/docs/rendering.ExtractSystem.html) |
| React 統合 | React コンポーネントとして SDK を提供。[repository](https://github.com/tldraw/tldraw) | 公式 resources は React ラッパーを third-party として掲載。コアは命令的 Canvas API。[resources](https://fabricjs.com/resources/)、[Canvas API](https://fabricjs.com/api/classes/canvas/) | 公式 `react-konva` が宣言的 React binding を提供し、React 19 系をサポート。[React guide](https://konvajs.org/docs/react/index.html)、[react-konva repository](https://github.com/konvajs/react-konva) | 公式 `@pixi/react` が React 19+ を対象にする。[ecosystem](https://pixijs.com/8.x/guides/getting-started/ecosystem)、[@pixi/react repository](https://github.com/pixijs/pixi-react) |
| シリアライズ | store snapshot、validation、migration、persistence を提供。[persistence](https://tldraw.dev/sdk-features/persistence)、[store](https://tldraw.dev/sdk-features/store) | JSON export/load と custom properties を提供。イベントや control function は JSON に含まれない。[core concepts](https://fabricjs.com/docs/core-concepts/)、[custom properties](https://fabricjs.com/docs/using-custom-properties/) | `toJSON` はあるが、公式は大きなアプリで app state の保存を推奨。イベント等は直列化されない。[serialization best practices](https://konvajs.org/docs/data_and_serialization/Best_Practices.html) | 公式の中心は renderer / scene graph であり、エディタ文書の snapshot / migration API は示されない。したがって文書モデルはアプリ側所有になる、という判断。[architecture](https://pixijs.com/8.x/guides/concepts/architecture)、[scene graph](https://pixijs.com/8.x/guides/concepts/scene-graph) |
| ライセンス | source-available。開発は可能だが、本番利用は原則 trial / commercial / hobby key が必要。[license docs](https://github.com/tldraw/tldraw/blob/main/apps/docs/content/community/license.mdx)、[LICENSE.md](https://github.com/tldraw/tldraw/blob/main/LICENSE.md) | MIT。著作権表示と許諾表示を維持すれば、使用・改変・配布・販売を許可。[LICENSE](https://github.com/fabricjs/fabric.js/blob/master/LICENSE) | Konva と react-konva は MIT。ライセンスキー不要。[Konva LICENSE](https://github.com/konvajs/konva/blob/master/LICENSE)、[react-konva repository](https://github.com/konvajs/react-konva) | PixiJS と `@pixi/react` は MIT。[PixiJS LICENSE](https://github.com/pixijs/pixijs/blob/dev/LICENSE)、[@pixi/react LICENSE](https://github.com/pixijs/pixi-react/blob/main/LICENSE) |
| Gridder 導入・移行コスト | **高** | **高** | **低〜中** | **高** |
| 判定 | 不採用 | 不採用 | **採用** | 現時点では不採用 |

## 候補別評価

### tldraw SDK

#### 標準提供される範囲

tldraw は単なる描画ライブラリではなく、選択・移動・変形・ハンドツール・履歴・ショートカットを含むエディタ SDK である。tool は階層的 state machine として構成され、select tool 自体に translating / resizing 等の状態がある。[tools](https://tldraw.dev/sdk-features/tools) shape は immutable record、`ShapeUtil`、geometry、React component の組で拡張でき、geometry は hit testing、snapping、selection 等にも使われる。[shapes](https://tldraw.dev/sdk-features/shapes)

カスタム handle には vertex / virtual / create の種別と drag callbacks があり、ポリゴン頂点編集の土台として最も高機能である。[handles](https://tldraw.dev/sdk-features/handles) store は snapshot、schema validation、migration、undo / redo、sync に接続できるため、将来の共同編集まで一体で採用したい場合は技術的な完成度が高い。[store](https://tldraw.dev/sdk-features/store)、[persistence](https://tldraw.dev/sdk-features/persistence)

#### Gridder で必要な追加実装

- 空白ドラッグから Gridder の矩形を生成する custom tool / `StateNode`
- グリッド頂点への厳密な snap と最小サイズ・自己交差禁止等の制約
- セル追加・削除をポリゴンの和・差へ変換するドメイン処理
- Gridder の「中央は移動、辺・角付近は変形」を既定 select tool と調停する処理
- custom shape の SVG export 実装。tldraw の raster export は SVG を中間表現に使うため、custom shape は `toSvg` を正しく実装する必要がある。[image export](https://tldraw.dev/sdk-features/image-export)

#### ライセンスと商用利用

tldraw の SDK ライセンスは MIT ではない。公式文書では、開発中はキーなしで使えるが、本番利用には trial、commercial、または hobby license key が必要とされる。trial は期間制、commercial は契約対象、hobby は裁量的で watermark を伴う。[license docs](https://github.com/tldraw/tldraw/blob/main/apps/docs/content/community/license.mdx) ライセンス本文も、production use を別契約なしでは認めていない。[LICENSE.md](https://github.com/tldraw/tldraw/blob/main/LICENSE.md)

#### 判定

**不採用。** 直接操作を最短で揃えられる候補だが、Gridder の中核であるグリッドポリゴン編集は結局 custom shape / tool になる。商用条件、license key、SDK 固有の store・tool・shape model への依存を受け入れるほど、初回リリースの工数削減が確実ではない。将来、既定のホワイトボード機能と共同編集を製品の中心へ広げ、商用ライセンス費用を許容する場合のみ再評価する。

### Fabric.js

#### 標準提供される範囲

Fabric.js は object model を持つ Canvas ライブラリで、単一・範囲・複数選択、drag、scale、rotate、skew と configurable controls を標準提供する。[core concepts](https://fabricjs.com/docs/core-concepts/)、[controls](https://fabricjs.com/docs/configuring-controls/) `createPolyControls` と公式 polygon controls demo があり、四候補中、permissive license で頂点編集に最も近い既製部品を持つ。[createPolyControls](https://fabricjs.com/api/fabric/namespaces/controlsutils/functions/createpolycontrols/)、[demo](https://fabricjs.com/demos/poly-controls/)

JSON、SVG、PNG / JPEG の入出力も組み込まれている。ただし custom properties は型拡張と `customProperties` 登録が必要で、control function や event listener は文書 JSON ではなくアプリコードとして再構築する。[custom properties](https://fabricjs.com/docs/using-custom-properties/)、[core concepts](https://fabricjs.com/docs/core-concepts/)

#### Gridder で必要な追加実装

- 空白ドラッグ作成、Space / 中ボタンパン、操作競合の state machine
- 全頂点・移動・リサイズのグリッド snap
- ポリゴン論理演算と結果の正規化
- 「辺付近」の hit area、cursor、control visibility の調整
- React component の mount / cleanup と Fabric Canvas の命令的更新境界

Fabric.js の公式 resources では React 向けラッパーが third-party integrations として掲載されているため、Gridder では公式 React binding に依存せず、hook 内で Fabric Canvas を所有する設計になる。[official resources](https://fabricjs.com/resources/)

#### ライセンスと商用利用

MIT ライセンスで、著作権表示と許諾表示を保持すれば商用利用・改変・配布・販売が可能である。[LICENSE](https://github.com/fabricjs/fabric.js/blob/master/LICENSE)

#### 判定

**不採用。** 新規プロジェクトなら有力だが、Gridder は既に Konva / react-konva で入力・描画・ズーム・パンを実装している。Fabric.js への変更は canvas interaction layer の全面移植になる一方、Gridder 固有の snap、空白ドラッグ、Boolean 編集は残る。公式の polygon controls だけでは移行費用を回収できない。

### Konva / react-konva

#### 標準提供される範囲

Konva は retained-mode の 2D canvas scene graph、shape events、drag、layer、custom shape を提供する。[overview](https://konvajs.org/docs/) `react-konva` は Konva node を React component として宣言的に扱い、現在の React 19 系を対象にした公式 binding である。[React guide](https://konvajs.org/docs/react/index.html)、[react-konva repository](https://github.com/konvajs/react-konva)

`Transformer` は選択対象へ attach して resize / rotate handles を提供する。変形時は width / height ではなく scale を変更するため、Gridder の確定処理では scale をグリッド座標へ正規化してから 1 に戻す必要がある。[Transformer](https://konvajs.org/docs/react/Transformer.html) `boundBoxFunc` で変形境界を制約できる。[resize limits](https://konvajs.org/docs/select_and_transform/Resize_Limits.html)

公式例にはカーソル位置を固定した wheel zoom と object snapping がある。いずれも Gridder の store / command と結ぶアプリコードは必要だが、座標変換の前例がある。[pointer-relative zoom](https://konvajs.org/docs/sandbox/Zooming_Relative_To_Pointer.html)、[object snapping](https://konvajs.org/docs/sandbox/Objects_Snapping.html)

#### Gridder で必要な追加実装

- 空白ドラッグ作成、中央移動、辺・角変形を統合する pointer interaction controller
- screen / world / grid の座標変換を一箇所に集約
- ポリゴンの頂点・辺ハンドルと拡張 hit region
- drag / resize 中の preview と、pointer-up 時の単一 command commit
- ポリゴン Boolean 演算と結果の正規化
- 選択 overlay、hover cursor、multi-selection rules

Konva の `hitFunc` / `hitStrokeWidth` で、細い辺や小さい頂点の見た目を変えずに hit target を広げられる。[custom hit region](https://konvajs.org/docs/events/Custom_Hit_Region.html) これはモードを増やさず「中央を掴むと移動、辺・角に近づくと変形」を実現するのに適している。

#### シリアライズ方針

Konva node tree は永続化しない。公式も複雑なアプリでは app state を保存し、描画を再生成する方針を推奨している。[serialization best practices](https://konvajs.org/docs/data_and_serialization/Best_Practices.html) Gridder の schema は整数の grid vertices、style、z-order、metadata に限定し、selection、hover、handler、Konva node は transient state とする。この分離は将来 renderer や共同編集方式を変更しても文書形式を守れる。

#### ライセンスと商用利用

Konva と react-konva は MIT license で、ライセンスキーは不要である。[Konva LICENSE](https://github.com/konvajs/konva/blob/master/LICENSE)、[react-konva repository](https://github.com/konvajs/react-konva)

#### 導入・移行コスト

四候補で最小。現行 web app は Konva 10 と react-konva 19 を依存関係に持ち、複数の canvas component が既に存在する。[web package.json](../../apps/web/package.json) 主な変更は renderer の交換ではなく、次の内部再設計になる。

1. `GridObjectShape` のセル単位 `Rect` 群を、オブジェクト単位の polygon path へ置換する。[current GridObjectShape](../../apps/web/src/components/Canvas/GridObjectShape.tsx)
2. document state と interaction state を分離する。
3. 選択 overlay と pointer interaction controller を導入する。
4. Boolean operation を command として editor core に閉じ込める。

#### 判定

**採用。** 500図形では、レンダラーの理論上限より操作仕様、座標系、データモデル、テスト可能性が支配的である。まず node 数を図形数に近づけ、実測で不足が出るまで renderer migration を行わない。

### PixiJS 8

#### 標準提供される範囲

PixiJS は renderer、scene graph、textures、graphics、events を組み合わせる高性能 2D rendering engine である。[architecture](https://pixijs.com/8.x/guides/concepts/architecture) WebGL renderer が推奨され、WebGPU は公式ガイド上 experimental とされる。[renderers](https://pixijs.com/8.x/guides/components/renderers)

`Graphics` は rectangle、polygon、path、hole を描画できる。[Graphics](https://pixijs.com/8.x/guides/components/scene-objects/graphics) federated event system は pointer / wheel events、hit testing、custom `hitArea`、global pointer move を提供する。[events](https://pixijs.com/8.x/guides/components/events) `@pixi/react` は React 19+ integration を公式 ecosystem として提供する。[ecosystem](https://pixijs.com/8.x/guides/getting-started/ecosystem)、[@pixi/react repository](https://github.com/pixijs/pixi-react)

#### Gridder で必要な追加実装

- selection model、marquee、drag、resize handles、cursor feedback
- 空白ドラッグ作成と全 gesture arbitration
- viewport zoom / pan の製品仕様
- snap engine と screen / world / grid 座標変換
- undo / redo、command、clipboard、document serialization
- polygon vertex editing と Boolean operations
- accessibility を担う DOM UI との統合

つまり、PixiJS が標準提供するのは上記を作るための rendering / input substrate であり、直接操作型エディタではない。この評価は欠点ではなく、抽象化レベルの違いである。[scene objects](https://pixijs.com/8.x/guides/components/scene-objects)、[events](https://pixijs.com/8.x/guides/components/events)

画像出力は `ExtractSystem` の `canvas` / `image` / `download` 等で行える。[ExtractSystem](https://pixijs.download/dev/docs/rendering.ExtractSystem.html) 文書 snapshot や schema migration は PixiJS の renderer / scene graph API の責務外なので、Gridder 側で所有する。

#### ライセンスと商用利用

PixiJS と `@pixi/react` は MIT license で、商用利用可能である。[PixiJS LICENSE](https://github.com/pixijs/pixijs/blob/dev/LICENSE)、[@pixi/react LICENSE](https://github.com/pixijs/pixi-react/blob/main/LICENSE)

#### 判定

**現時点では不採用。** 現行リポジトリにも PixiJS 8 の renderer PoC はあるが、責務は viewport と cell particle rendering までで、エディタ操作を含まない。[Pixi renderer PoC](../../packages/editor-renderer-pixi/src/pixi-editor-renderer.ts) 500図形の要件に対して操作層を全面実装する費用が大きい。Konva の図形集約後も実機計測で描画予算を満たせない場合に限り、既存 renderer boundary を使って再評価する。

## ポリゴン論理演算

セル追加・削除は renderer の責務にしない。整数グリッド座標の polygon / multipolygon に対する pure domain operation とし、結果を同じ文書 schema に戻す。

候補として `polygon-clipping` は union、intersection、xor、difference と Polygon / MultiPolygon 入出力を提供し、MIT license である。[official repository](https://github.com/mfogel/polygon-clipping)、[LICENSE](https://github.com/mfogel/polygon-clipping/blob/main/LICENSE.md) ただしライブラリ型を文書 schema に直接漏らさず、`PolygonBooleanEngine` のような小さい adapter の内側に閉じ込める。これにより、退化辺、穴、複数 component、自己交差、非常に大きい座標などの実データ試験で問題が出た場合に実装を交換できる。

最低限、以下を golden / property test にする。

- 単一セルの追加・削除
- 辺・頂点だけ接するセル
- 穴の生成と穴の消滅
- 結果が複数 polygon に分離する差分
- 同一操作の反復に対する安定性
- clockwise / counter-clockwise、重複頂点、collinear vertex の正規化
- undo / redo 後の完全一致

## UI シェル

### Base UI

Base UI は style を持たない React component library で、accessible な behavior と structure を提供し、Tailwind CSS と組み合わせられる。[overview](https://base-ui.com/react/overview/about) keyboard、focus、ARIA を扱う方針も公式に記載されている。[accessibility](https://base-ui.com/react/overview/accessibility) MIT license である。[LICENSE](https://github.com/mui/base-ui/blob/master/LICENSE)

採用対象は Toolbar の menu / tooltip、property panel の select / checkbox / slider、dialog、popover、context menu 等とする。canvas selection、resize handles、pan / zoom は Base UI に寄せない。

### Tailwind CSS

Tailwind は utility classes を組み合わせ、hover、focus、responsive 等の状態を markup 上で制御する。[utility classes](https://tailwindcss.com/docs/styling-with-utility-classes) MIT license である。[LICENSE](https://github.com/tailwindlabs/tailwindcss/blob/main/LICENSE) Gridder は既に Tailwind 4 を利用しているため、継続コストが低い。[web package.json](../../apps/web/package.json)

ただし utility library 自体はデザイン品質を決めない。色、spacing、radius、type scale、border、shadow、motion duration を少数の semantic token に制限し、ツール UI の密度を維持する。

### Lucide

Lucide は一貫した SVG icon set で、customizable、tree-shakable を掲げている。[official site](https://lucide.dev/)、[official repository](https://github.com/lucide-icons/lucide) ISC license で、著作権・許諾表示を保持すれば利用・改変・配布が可能である。[LICENSE](https://github.com/lucide-icons/lucide/blob/main/LICENSE)

アイコンは明確な command に使用し、未知のアイコンには tooltip と accessible name を付ける。独自 SVG を増やさず、Lucide にない Gridder 固有表現だけを追加する。

### 判定

**Base UI + Tailwind CSS + Lucide を採用する。** Base UI が behavior / accessibility、Tailwind が visual tokens と layout、Lucide が iconography を担当し、責務が重ならない。代替 headless primitive を追加で併用せず、必要な component が Base UI にない場合だけ個別に評価する。

## 推奨アーキテクチャ

```text
React DOM UI
  Base UI + Tailwind + Lucide
          |
Interaction controller
  pointer arbitration / cursor / keyboard / selection overlay
          |
Editor commands
  create / move / resize / vertex edit / union / difference
          |
Document model
  integer grid vertices / style / z-order / metadata
          |
Renderer adapter
  Konva / react-konva (one visual polygon per object)
```

### 状態の境界

- **永続状態**: 図形 ID、整数 grid vertices、holes / multipolygon、style、z-order、metadata
- **履歴に入る操作**: create、move、resize、vertex edit、union、difference、delete、style change
- **一時状態**: hover target、pointer capture、drag origin、preview geometry、selection handles、viewport animation
- **renderer 固有状態**: Konva node refs、Transformer、hit graph、cached draw data

drag / resize 中は preview だけを更新し、pointer-up で正規化済み grid geometry を1 command として commit する。これにより undo / redo と将来の共同編集で、中間 pointer event を文書更新として流さずに済む。

### 操作モデル

1. 空白の左ドラッグ: grid vertex から矩形 preview を開始し、pointer-up で作成。
2. 図形中央の左ドラッグ: move。全頂点へ同じ整数 grid delta を適用。
3. 選択図形の辺・角付近: hover cursor と handle を表示し、drag で resize。hit target は表示より広くする。[Konva custom hit region](https://konvajs.org/docs/events/Custom_Hit_Region.html)
4. polygon tool: click で grid vertex を追加し、始点 click / Enter で確定、Escape で破棄。
5. セル追加・削除: pointer で指定した grid cell polygon と現在 geometry の union / difference を実行。
6. wheel: cursor の world position を保つ zoom。[Konva zoom example](https://konvajs.org/docs/sandbox/Zooming_Relative_To_Pointer.html)
7. Space + 左ドラッグ、または中ボタンドラッグ: pan。操作開始時に pointer capture し、図形 drag より優先する。

## 導入順序と判断ゲート

1. **ドメインモデル確定**: 旧 JSON 互換は持たず、grid polygon / multipolygon schema と migration version だけを定義する。
2. **Boolean spike**: `polygon-clipping` を adapter 越しに組み込み、上記 edge cases を試験する。
3. **Konva 描画集約**: 1 cell = 1 node をやめ、1 object = 1 visual polygon を基本にする。
4. **直接操作 PoC**: 矩形作成、中央移動、辺・角リサイズ、pointer-relative zoom、Space / 中ボタン pan を同じ interaction controller で通す。
5. **UI shell**: Base UI primitives、Tailwind tokens、Lucide icons を toolbar / inspector へ適用する。
6. **性能測定**: 500図形の pan、zoom、drag、resize、export を対象に、対象デスクトップ環境で frame time と input latency を測る。
7. **PixiJS 再評価ゲート**: 1 object = 1 polygon 化、不要 layer redraw の削減、drag 中の React 更新抑制を行っても性能目標を満たさない場合だけ PixiJS renderer を再検討する。

## 棄却理由まとめ

- **tldraw SDK**: 機能は最も豊富だが、本番 license key / commercial terms と SDK 固有 model への依存が大きい。Gridder 固有操作の custom 実装も残る。
- **Fabric.js**: MIT、直接操作、polygon controls は魅力的だが、Konva からの全面移植に対して得られる差が小さい。React 統合も Gridder 側で命令的 lifecycle を設計する必要がある。
- **PixiJS 8**: renderer として強いが、エディタ操作・文書モデル・履歴・snap を全面実装する必要がある。500図形という現在の上限では premature optimization になる。
- **Konva / react-konva**: 標準エディタではないため操作層は必要だが、その操作層こそ Gridder の製品固有部分である。既存資産を活用しつつ、renderer から独立した domain / command / interaction 境界を作れるため、総コストと将来の交換可能性のバランスが最もよい。
