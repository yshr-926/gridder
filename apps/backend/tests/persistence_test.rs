//! 永続化モジュールの統合テスト
//!
//! 実際のデータベース接続を使用するテスト。
//! 実行には TEST_DATABASE_URL 環境変数が必要。

use sqlx::postgres::PgPoolOptions;
use yrs::{Doc, GetString, ReadTxn, Text, Transact};

use gridder_backend::persistence::{DocumentRepository, RoomRepository, SnapshotManager};

/// テスト用データベースプールを作成
async fn create_test_pool() -> sqlx::PgPool {
    let url = std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| {
        "postgresql://postgres:password@localhost:5432/gridder_test".to_string()
    });

    PgPoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await
        .expect("Failed to create test pool")
}

/// ユニークなルームIDを生成
fn unique_room_id() -> String {
    format!("test-room-{}", nanoid::nanoid!())
}

// ============================================================
// RoomRepository テスト
// ============================================================

#[tokio::test]
#[ignore] // 実際のDBが必要
async fn test_room_create_and_get() {
    let pool = create_test_pool().await;
    let repo = RoomRepository::new(pool);

    let room_id = unique_room_id();

    // ルームを作成
    repo.create_room_if_not_exists(&room_id).await.unwrap();

    // ルームを取得
    let room = repo.get_room(&room_id).await.unwrap();
    assert!(room.is_some());
    assert_eq!(room.unwrap().id, room_id);

    // 存在確認
    assert!(repo.room_exists(&room_id).await.unwrap());

    // クリーンアップ
    repo.delete_room(&room_id).await.unwrap();
}

#[tokio::test]
#[ignore]
async fn test_room_passphrase() {
    let pool = create_test_pool().await;
    let repo = RoomRepository::new(pool);

    let room_id = unique_room_id();
    repo.create_room_if_not_exists(&room_id).await.unwrap();

    // パスフレーズなし
    assert!(!repo.has_passphrase(&room_id).await.unwrap());
    assert!(repo.get_passphrase_hash(&room_id).await.unwrap().is_none());

    // パスフレーズを設定
    let hash = "$2b$10$test_hash";
    repo.set_passphrase(&room_id, Some(hash)).await.unwrap();

    // パスフレーズあり
    assert!(repo.has_passphrase(&room_id).await.unwrap());
    assert_eq!(
        repo.get_passphrase_hash(&room_id).await.unwrap(),
        Some(hash.to_string())
    );

    // パスフレーズを削除
    repo.set_passphrase(&room_id, None).await.unwrap();
    assert!(!repo.has_passphrase(&room_id).await.unwrap());

    // クリーンアップ
    repo.delete_room(&room_id).await.unwrap();
}

#[tokio::test]
#[ignore]
async fn test_room_last_accessed() {
    let pool = create_test_pool().await;
    let repo = RoomRepository::new(pool);

    let room_id = unique_room_id();
    repo.create_room_if_not_exists(&room_id).await.unwrap();

    // 初期値を取得
    let room1 = repo.get_room(&room_id).await.unwrap().unwrap();
    let initial_accessed = room1.last_accessed_at;

    // 少し待つ
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    // 最終アクセス日時を更新
    repo.update_last_accessed(&room_id).await.unwrap();

    // 更新されたことを確認
    let room2 = repo.get_room(&room_id).await.unwrap().unwrap();
    assert!(room2.last_accessed_at > initial_accessed);

    // クリーンアップ
    repo.delete_room(&room_id).await.unwrap();
}

// ============================================================
// DocumentRepository テスト
// ============================================================

#[tokio::test]
#[ignore]
async fn test_document_append_and_load_updates() {
    let pool = create_test_pool().await;
    let room_repo = RoomRepository::new(pool.clone());
    let doc_repo = DocumentRepository::new(pool);

    let room_id = unique_room_id();
    room_repo.create_room_if_not_exists(&room_id).await.unwrap();

    // 更新を保存
    let update1 = vec![1, 2, 3, 4, 5];
    let update2 = vec![6, 7, 8, 9, 10];
    doc_repo.append_update(&room_id, &update1).await.unwrap();
    doc_repo.append_update(&room_id, &update2).await.unwrap();

    // 更新を取得
    let updates = doc_repo.load_updates(&room_id).await.unwrap();
    assert_eq!(updates.len(), 2);
    assert_eq!(updates[0].update_data, update1);
    assert_eq!(updates[1].update_data, update2);

    // 更新数を確認
    assert_eq!(doc_repo.get_update_count(&room_id).await.unwrap(), 2);

    // クリーンアップ
    room_repo.delete_room(&room_id).await.unwrap();
}

#[tokio::test]
#[ignore]
async fn test_document_snapshot() {
    let pool = create_test_pool().await;
    let room_repo = RoomRepository::new(pool.clone());
    let doc_repo = DocumentRepository::new(pool);

    let room_id = unique_room_id();
    room_repo.create_room_if_not_exists(&room_id).await.unwrap();

    // スナップショットなし
    assert!(
        doc_repo
            .load_latest_snapshot(&room_id)
            .await
            .unwrap()
            .is_none()
    );

    // スナップショットを保存
    let snapshot_data = vec![100, 101, 102, 103];
    doc_repo
        .save_snapshot(&room_id, &snapshot_data)
        .await
        .unwrap();

    // スナップショットを取得
    let snapshot = doc_repo.load_latest_snapshot(&room_id).await.unwrap();
    assert!(snapshot.is_some());
    assert_eq!(snapshot.unwrap().snapshot_data, snapshot_data);

    // クリーンアップ
    room_repo.delete_room(&room_id).await.unwrap();
}

#[tokio::test]
#[ignore]
async fn test_document_compaction() {
    let pool = create_test_pool().await;
    let room_repo = RoomRepository::new(pool.clone());
    let doc_repo = DocumentRepository::new(pool);

    let room_id = unique_room_id();
    room_repo.create_room_if_not_exists(&room_id).await.unwrap();

    // 更新を保存
    for i in 0..5 {
        doc_repo.append_update(&room_id, &[i]).await.unwrap();
    }
    assert_eq!(doc_repo.get_update_count(&room_id).await.unwrap(), 5);

    // コンパクション
    let snapshot_data = vec![1, 2, 3, 4, 5];
    let deleted = doc_repo
        .compact_with_snapshot(&room_id, &snapshot_data)
        .await
        .unwrap();
    assert_eq!(deleted, 5);

    // 更新ログはクリアされ、スナップショットのみ
    assert_eq!(doc_repo.get_update_count(&room_id).await.unwrap(), 0);
    let snapshot = doc_repo.load_latest_snapshot(&room_id).await.unwrap();
    assert!(snapshot.is_some());
    assert_eq!(snapshot.unwrap().snapshot_data, snapshot_data);

    // クリーンアップ
    room_repo.delete_room(&room_id).await.unwrap();
}

#[tokio::test]
#[ignore]
async fn test_document_load_state() {
    let pool = create_test_pool().await;
    let room_repo = RoomRepository::new(pool.clone());
    let doc_repo = DocumentRepository::new(pool);

    let room_id = unique_room_id();
    room_repo.create_room_if_not_exists(&room_id).await.unwrap();

    // データなし
    assert!(
        doc_repo
            .load_document_state(&room_id)
            .await
            .unwrap()
            .is_none()
    );

    // スナップショットと更新を保存
    let snapshot_data = vec![10, 20, 30];
    doc_repo
        .save_snapshot(&room_id, &snapshot_data)
        .await
        .unwrap();
    doc_repo.append_update(&room_id, &[1]).await.unwrap();
    doc_repo.append_update(&room_id, &[2]).await.unwrap();

    // 状態を読み込み
    let state = doc_repo.load_document_state(&room_id).await.unwrap();
    assert!(state.is_some());

    let (snapshot, updates) = state.unwrap();
    assert_eq!(snapshot, Some(snapshot_data));
    assert_eq!(updates.len(), 2);
    assert_eq!(updates[0], vec![1]);
    assert_eq!(updates[1], vec![2]);

    // クリーンアップ
    room_repo.delete_room(&room_id).await.unwrap();
}

// ============================================================
// SnapshotManager テスト
// ============================================================

#[tokio::test]
#[ignore]
async fn test_snapshot_manager_restore_empty() {
    let pool = create_test_pool().await;
    let room_repo = RoomRepository::new(pool.clone());
    let doc_repo = DocumentRepository::new(pool);
    let snapshot_manager = SnapshotManager::new(doc_repo, 100);

    let room_id = unique_room_id();
    room_repo.create_room_if_not_exists(&room_id).await.unwrap();

    // 空のドキュメントを復元（None）
    let doc = snapshot_manager.restore_document(&room_id).await.unwrap();
    assert!(doc.is_none());

    // クリーンアップ
    room_repo.delete_room(&room_id).await.unwrap();
}

#[tokio::test]
#[ignore]
async fn test_snapshot_manager_restore_with_data() {
    let pool = create_test_pool().await;
    let room_repo = RoomRepository::new(pool.clone());
    let doc_repo = DocumentRepository::new(pool);
    let snapshot_manager = SnapshotManager::new(doc_repo.clone(), 100);

    let room_id = unique_room_id();
    room_repo.create_room_if_not_exists(&room_id).await.unwrap();

    // オリジナルのドキュメントを作成
    let original_doc = Doc::new();
    {
        let text = original_doc.get_or_insert_text("content");
        let mut txn = original_doc.transact_mut();
        text.insert(&mut txn, 0, "Hello, World!");
    }

    // スナップショットとして保存
    let snapshot_data = {
        let txn = original_doc.transact();
        txn.encode_state_as_update_v1(&yrs::StateVector::default())
    };
    doc_repo
        .save_snapshot(&room_id, &snapshot_data)
        .await
        .unwrap();

    // 追加の更新を作成して保存
    let update_data = {
        let text = original_doc.get_or_insert_text("content");
        let mut txn = original_doc.transact_mut();
        text.insert(&mut txn, 13, " More text.");
        txn.encode_update_v1()
    };
    doc_repo
        .append_update(&room_id, &update_data)
        .await
        .unwrap();

    // ドキュメントを復元
    let restored_doc = snapshot_manager.restore_document(&room_id).await.unwrap();
    assert!(restored_doc.is_some());

    // 内容を確認
    let restored_doc = restored_doc.unwrap();
    let text = restored_doc.get_or_insert_text("content");
    let txn = restored_doc.transact();
    assert_eq!(text.get_string(&txn), "Hello, World! More text.");

    // クリーンアップ
    room_repo.delete_room(&room_id).await.unwrap();
}

#[tokio::test]
#[ignore]
async fn test_snapshot_manager_maybe_create_snapshot() {
    let pool = create_test_pool().await;
    let room_repo = RoomRepository::new(pool.clone());
    let doc_repo = DocumentRepository::new(pool);
    // 閾値を5に設定
    let snapshot_manager = SnapshotManager::new(doc_repo.clone(), 5);

    let room_id = unique_room_id();
    room_repo.create_room_if_not_exists(&room_id).await.unwrap();

    // ドキュメントを作成
    let doc = Doc::new();
    {
        let text = doc.get_or_insert_text("content");
        let mut txn = doc.transact_mut();
        text.insert(&mut txn, 0, "Test");
    }

    // 更新を4つ追加（閾値未満）
    for i in 0..4 {
        doc_repo.append_update(&room_id, &[i]).await.unwrap();
    }

    // スナップショット不要
    let created = snapshot_manager
        .maybe_create_snapshot(&room_id, &doc)
        .await
        .unwrap();
    assert!(!created);

    // もう1つ追加（閾値到達）
    doc_repo.append_update(&room_id, &[4]).await.unwrap();

    // スナップショット作成
    let created = snapshot_manager
        .maybe_create_snapshot(&room_id, &doc)
        .await
        .unwrap();
    assert!(created);

    // 更新ログがクリアされていることを確認
    assert_eq!(doc_repo.get_update_count(&room_id).await.unwrap(), 0);

    // スナップショットが存在することを確認
    assert!(
        doc_repo
            .load_latest_snapshot(&room_id)
            .await
            .unwrap()
            .is_some()
    );

    // クリーンアップ
    room_repo.delete_room(&room_id).await.unwrap();
}

// ============================================================
// 統合テスト
// ============================================================

#[tokio::test]
#[ignore]
async fn test_full_document_lifecycle() {
    let pool = create_test_pool().await;
    let room_repo = RoomRepository::new(pool.clone());
    let doc_repo = DocumentRepository::new(pool);
    let snapshot_manager = SnapshotManager::new(doc_repo.clone(), 10);

    let room_id = unique_room_id();

    // 1. ルームを作成
    room_repo.create_room_if_not_exists(&room_id).await.unwrap();

    // 2. ドキュメントを作成して編集
    let doc = Doc::new();
    let text = doc.get_or_insert_text("content");

    // 最初の編集
    {
        let mut txn = doc.transact_mut();
        text.insert(&mut txn, 0, "Hello");
        let update = txn.encode_update_v1();
        doc_repo.append_update(&room_id, &update).await.unwrap();
    }

    // 追加の編集
    {
        let mut txn = doc.transact_mut();
        text.insert(&mut txn, 5, ", World!");
        let update = txn.encode_update_v1();
        doc_repo.append_update(&room_id, &update).await.unwrap();
    }

    // 3. ドキュメントを復元
    let restored = snapshot_manager
        .restore_document(&room_id)
        .await
        .unwrap()
        .unwrap();
    let restored_text = restored.get_or_insert_text("content");
    let txn = restored.transact();
    assert_eq!(restored_text.get_string(&txn), "Hello, World!");

    // 4. スナップショットを作成
    snapshot_manager
        .force_create_snapshot(&room_id, &doc)
        .await
        .unwrap();

    // 5. 更新ログがクリアされていることを確認
    assert_eq!(doc_repo.get_update_count(&room_id).await.unwrap(), 0);

    // 6. スナップショットから復元
    let restored2 = snapshot_manager
        .restore_document(&room_id)
        .await
        .unwrap()
        .unwrap();
    let restored_text2 = restored2.get_or_insert_text("content");
    let txn2 = restored2.transact();
    assert_eq!(restored_text2.get_string(&txn2), "Hello, World!");

    // クリーンアップ
    room_repo.delete_room(&room_id).await.unwrap();
}
