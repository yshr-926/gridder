# Issue tracker: GitHub

このリポジトリの Issue と仕様は GitHub Issues で管理する。すべての操作には `gh` CLI を使用する。

## 規約

- **Issue の作成**: `gh issue create --title "..." --body "..."`。複数行の本文には heredoc を使用する。
- **Issue の参照**: `gh issue view <number> --comments`。コメントは `jq` で絞り込み、ラベルも取得する。
- **Issue の一覧**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`。必要に応じて `--label` と `--state` で絞り込む。
- **Issue へのコメント**: `gh issue comment <number> --body "..."`
- **ラベルの追加・削除**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Issue を閉じる**: `gh issue close <number> --comment "..."`

対象リポジトリは `git remote -v` から判断する。クローン内で実行すれば `gh` が自動的に判断する。

## トリアージ対象としての Pull Request

**PRs as a request surface: no.**（外部 PR を機能リクエストとして扱うリポジトリでは `yes` に変更する。`/triage` はこの値を参照する。）

`yes` の場合、PR にも Issue と同じラベルと状態を適用し、対応する `gh pr` コマンドを使用する。

- **PR の参照**: `gh pr view <number> --comments`。差分には `gh pr diff <number>` を使用する。
- **トリアージ対象の外部 PR の一覧**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` を実行し、`authorAssociation` が `CONTRIBUTOR`、`FIRST_TIME_CONTRIBUTOR`、`NONE` のものだけを残す。`OWNER`、`MEMBER`、`COLLABORATOR` は除外する。
- **コメント・ラベル・クローズ**: `gh pr comment`、`gh pr edit --add-label` / `--remove-label`、`gh pr close` を使用する。

GitHub では Issue と PR が同じ番号空間を共有するため、`#42` はどちらの可能性もある。`gh pr view 42` で確認し、該当しなければ `gh issue view 42` を使用する。

## スキルが「Issue tracker に公開する」と指示した場合

GitHub Issue を作成する。

## スキルが「関連チケットを取得する」と指示した場合

`gh issue view <number> --comments` を実行する。

## Wayfinding 操作

`/wayfinder` が使用する。**map** は単一の Issue、**child** はその配下の Issue とする。

- **Map**: Notes / Decisions-so-far / Fog を本文に持ち、`wayfinder:map` ラベルを付けた単一の Issue。`gh issue create --label wayfinder:map` で作成する。
- **Child ticket**: GitHub の sub-issue として map に紐付けた Issue（sub-issues endpoint を `gh api` で操作する）。sub-issue が利用できない場合は map 本文のタスクリストに child を追加し、child 本文の先頭に `Part of #<map>` を記載する。ラベルは `wayfinder:<type>`（`research` / `prototype` / `grilling` / `task`）。claim 後は担当開発者を assignee に設定する。
- **Blocking**: GitHub ネイティブの Issue dependencies を正式かつ UI 上で確認できる依存関係として使用する。`gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>` で関係を追加する。`<blocker-db-id>` は blocker の数値 **database id**（`gh api repos/<owner>/<repo>/issues/<n> --jq .id`）であり、Issue 番号や `node_id` ではない。GitHub の `issue_dependencies_summary.blocked_by` は未解決 blocker の数を示し、現在の進行条件として扱う。dependencies が利用できない場合は child 本文の先頭に `Blocked by: #<n>, #<n>` を記載する。すべての blocker が閉じられた時点でチケットは unblocked となる。
- **Frontier query**: map 配下の未解決 child を map の sub-issues またはタスクリストに限定して `gh issue list --state open` で取得する。未解決 blocker があるもの（`issue_dependencies_summary.blocked_by > 0` または `Blocked by` 行が未解決 Issue を指すもの）と assignee 設定済みのものを除外し、map 上で最初のものを選ぶ。
- **Claim**: セッション最初の書き込みとして `gh issue edit <n> --add-assignee @me` を実行する。
- **Resolve**: `gh issue comment <n> --body "<answer>"`、`gh issue close <n>` の順で実行し、map の Decisions-so-far にコンテキストへの参照（gist とリンク）を追記する。
