//! Redis Pub/Sub 統合テスト
//!
//! マルチインスタンス間のメッセージ同期をテストする。
//!
//! # 実行方法
//!
//! Redis が必要なテストは `--ignored` フラグで実行:
//! ```bash
//! cargo test --test pubsub_integration -- --ignored
//! ```
//!
//! # 前提条件
//!
//! - Redis サーバーが localhost:6379 で起動していること

use std::sync::Arc;
use std::time::Duration;

use gridder_backend::{
    config::RedisConfig,
    pubsub::{MessageType, OptionalRedisPubSub, RedisPubSub},
    sync::RoomManager,
};
use tokio::time::timeout;

/// テスト用の Redis 設定を取得
fn test_redis_config() -> RedisConfig {
    RedisConfig {
        host: std::env::var("REDIS_HOST").unwrap_or_else(|_| "localhost".to_string()),
        port: std::env::var("REDIS_PORT")
            .unwrap_or_else(|_| "6379".to_string())
            .parse()
            .unwrap_or(6379),
        password: std::env::var("REDIS_PASSWORD").ok(),
    }
}

/// Redis 接続テスト
#[tokio::test]
#[ignore = "Requires Redis server"]
async fn test_redis_connection() {
    let config = test_redis_config();
    let pubsub = RedisPubSub::new(&config).await.unwrap();

    assert!(pubsub.is_connected());
    pubsub.health_check().await.unwrap();
}

/// Pub/Sub メッセージ配信テスト
#[tokio::test]
#[ignore = "Requires Redis server"]
async fn test_pubsub_message_delivery() {
    let config = test_redis_config();

    // 2つの Pub/Sub インスタンスを作成
    let pubsub1 = Arc::new(RedisPubSub::new(&config).await.unwrap());
    let pubsub2 = Arc::new(RedisPubSub::new(&config).await.unwrap());

    // 異なるサーバー ID を持つことを確認
    assert_ne!(pubsub1.server_id(), pubsub2.server_id());

    // pubsub2 がルームを購読
    pubsub2.subscribe_room("test-room").await.unwrap();

    // メッセージ受信チャネルを購読
    let mut rx = pubsub2.subscribe_messages();

    // 少し待機して購読を確立
    tokio::time::sleep(Duration::from_millis(100)).await;

    // pubsub1 から更新を発行
    let update_data = vec![1, 2, 3, 4, 5];
    pubsub1
        .publish_update("test-room", &update_data)
        .await
        .unwrap();

    // pubsub2 でメッセージを受信（タイムアウト付き）
    let result = timeout(Duration::from_secs(5), rx.recv()).await;

    match result {
        Ok(Ok(msg)) => {
            assert_eq!(msg.room_id, "test-room");
            assert_eq!(msg.message_type, MessageType::Update);
            assert_eq!(msg.payload, update_data);
            assert_eq!(msg.sender_id, pubsub1.server_id());
        }
        Ok(Err(e)) => panic!("Receive error: {:?}", e),
        Err(_) => panic!("Timeout waiting for message"),
    }
}

/// 送信者除外テスト
#[tokio::test]
#[ignore = "Requires Redis server"]
async fn test_sender_exclusion() {
    let config = test_redis_config();

    // 単一の Pub/Sub インスタンス
    let pubsub = Arc::new(RedisPubSub::new(&config).await.unwrap());

    // 自分自身を購読
    pubsub.subscribe_room("test-room-self").await.unwrap();

    // メッセージ受信チャネルを購読
    let mut rx = pubsub.subscribe_messages();

    // 少し待機
    tokio::time::sleep(Duration::from_millis(100)).await;

    // 自分から発行
    pubsub
        .publish_update("test-room-self", &[1, 2, 3])
        .await
        .unwrap();

    // 自分自身からのメッセージは受信されないはず
    let result = timeout(Duration::from_secs(1), rx.recv()).await;

    // タイムアウトすることを期待（自分のメッセージはフィルタリングされる）
    assert!(result.is_err(), "Should not receive own message");
}

/// マルチインスタンス同期テスト
#[tokio::test]
#[ignore = "Requires Redis server"]
async fn test_multi_instance_sync() {
    let config = test_redis_config();
    let room_id = "multi-instance-test";

    // 2つの RoomManager を作成（異なるサーバーインスタンスをシミュレート）
    let pubsub1 = Arc::new(RedisPubSub::new(&config).await.unwrap());
    let pubsub2 = Arc::new(RedisPubSub::new(&config).await.unwrap());

    let room_manager1 = Arc::new(RoomManager::new());
    let room_manager2 = Arc::new(RoomManager::new());

    // 両方でルームを作成
    let _room1 = room_manager1.get_or_create_room(room_id).await;
    let _room2 = room_manager2.get_or_create_room(room_id).await;

    // 両方がルームを購読
    pubsub1.subscribe_room(room_id).await.unwrap();
    pubsub2.subscribe_room(room_id).await.unwrap();

    // 少し待機
    tokio::time::sleep(Duration::from_millis(100)).await;

    // pubsub2 のメッセージ受信チャネルを購読
    let mut rx2 = pubsub2.subscribe_messages();

    // pubsub1 から更新を発行
    let update_data = b"test update data".to_vec();
    pubsub1.publish_update(room_id, &update_data).await.unwrap();

    // pubsub2 でメッセージを受信
    let result = timeout(Duration::from_secs(5), rx2.recv()).await;

    match result {
        Ok(Ok(msg)) => {
            assert_eq!(msg.room_id, room_id);
            assert_eq!(msg.payload, update_data);
        }
        Ok(Err(e)) => panic!("Receive error: {:?}", e),
        Err(_) => panic!("Timeout waiting for message"),
    }
}

/// Awareness メッセージテスト
#[tokio::test]
#[ignore = "Requires Redis server"]
async fn test_awareness_message() {
    let config = test_redis_config();

    let pubsub1 = Arc::new(RedisPubSub::new(&config).await.unwrap());
    let pubsub2 = Arc::new(RedisPubSub::new(&config).await.unwrap());

    pubsub2.subscribe_room("awareness-test").await.unwrap();

    let mut rx = pubsub2.subscribe_messages();
    tokio::time::sleep(Duration::from_millis(100)).await;

    // Awareness データを発行
    let awareness_data = b"awareness state".to_vec();
    pubsub1
        .publish_awareness("awareness-test", &awareness_data)
        .await
        .unwrap();

    let result = timeout(Duration::from_secs(5), rx.recv()).await;

    match result {
        Ok(Ok(msg)) => {
            assert_eq!(msg.room_id, "awareness-test");
            assert_eq!(msg.message_type, MessageType::Awareness);
            assert_eq!(msg.payload, awareness_data);
        }
        Ok(Err(e)) => panic!("Receive error: {:?}", e),
        Err(_) => panic!("Timeout waiting for awareness message"),
    }
}

/// OptionalRedisPubSub テスト（Redis なし）
#[tokio::test]
async fn test_optional_pubsub_disabled() {
    let pubsub = OptionalRedisPubSub::disabled();

    assert!(!pubsub.is_enabled());

    // 無効な状態でもエラーなく呼び出せる
    pubsub.subscribe_room("test").await;
    pubsub.try_publish_update("test", &[1, 2, 3]).await;
    pubsub.try_publish_awareness("test", &[4, 5, 6]).await;
    pubsub.unsubscribe_room("test").await;
}

/// 接続断時のフォールバックテスト
#[tokio::test]
#[ignore = "Requires Redis server"]
async fn test_connection_fallback() {
    let config = test_redis_config();

    let pubsub = RedisPubSub::new(&config).await.unwrap();

    // 接続中の状態でメッセージ発行が成功
    pubsub.publish_update("test", &[1, 2, 3]).await.unwrap();

    // try_publish_* は接続断でもエラーを返さない
    pubsub.try_publish_update("test", &[1, 2, 3]).await;
    pubsub.try_publish_awareness("test", &[4, 5, 6]).await;
}

/// 購読/購読解除テスト
#[tokio::test]
#[ignore = "Requires Redis server"]
async fn test_subscribe_unsubscribe() {
    let config = test_redis_config();

    let pubsub = RedisPubSub::new(&config).await.unwrap();

    // 購読
    pubsub.subscribe_room("sub-test").await.unwrap();

    // 購読解除
    pubsub.unsubscribe_room("sub-test").await.unwrap();
}
