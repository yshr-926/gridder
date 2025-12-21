//! Redis Pub/Sub モジュール
//!
//! 複数インスタンス間でのリアルタイム同期を担当する。
//!
//! # サブモジュール
//!
//! - `redis`: Redis 接続管理
//! - `messenger`: メッセージ発行/購読

pub mod messenger;
pub mod redis;
pub mod subscriber;

use std::sync::Arc;

use tracing::{error, info};

pub use messenger::{MessageType, Messenger, PubSubMessage};
pub use redis::{ConnectionState, RedisConnectionManager};
pub use subscriber::RemoteMessageHandler;

use crate::{config::RedisConfig, error::AppResult};

/// Redis Pub/Sub マネージャー
///
/// Redis 接続とメッセージングを統合管理する。
pub struct RedisPubSub {
    /// 接続マネージャー
    connection: Arc<RedisConnectionManager>,
    /// メッセンジャー
    messenger: Messenger,
}

impl RedisPubSub {
    /// 新しい Pub/Sub マネージャーを作成
    ///
    /// # Arguments
    /// * `config` - Redis 接続設定
    ///
    /// # Returns
    /// Pub/Sub マネージャーインスタンス
    pub async fn new(config: &RedisConfig) -> AppResult<Self> {
        let server_id = nanoid::nanoid!();
        info!(server_id = %server_id, "Creating Redis Pub/Sub manager");

        let connection = Arc::new(RedisConnectionManager::new(config).await?);
        let messenger = Messenger::new(connection.clone(), server_id);

        // メッセージリスナーを開始
        messenger.start_message_listener();

        Ok(Self {
            connection,
            messenger,
        })
    }

    /// サーバー ID を取得
    pub fn server_id(&self) -> &str {
        self.messenger.server_id()
    }

    /// 接続マネージャーを取得
    pub fn connection(&self) -> &Arc<RedisConnectionManager> {
        &self.connection
    }

    /// メッセンジャーを取得
    pub fn messenger(&self) -> &Messenger {
        &self.messenger
    }

    /// 接続中かどうか
    pub fn is_connected(&self) -> bool {
        self.connection.is_connected()
    }

    /// ヘルスチェック
    pub async fn health_check(&self) -> AppResult<()> {
        self.connection.health_check().await
    }

    /// ルームのチャネルを購読
    pub async fn subscribe_room(&self, room_id: &str) -> AppResult<()> {
        self.messenger.subscribe_to_room(room_id).await
    }

    /// ルームのチャネル購読を解除
    pub async fn unsubscribe_room(&self, room_id: &str) -> AppResult<()> {
        self.messenger.unsubscribe_from_room(room_id).await
    }

    /// ドキュメント更新を発行
    pub async fn publish_update(&self, room_id: &str, update_data: &[u8]) -> AppResult<()> {
        self.messenger
            .publish_update(room_id, update_data, None)
            .await
    }

    /// Awareness 更新を発行
    pub async fn publish_awareness(&self, room_id: &str, awareness_data: &[u8]) -> AppResult<()> {
        self.messenger
            .publish_awareness(room_id, awareness_data, None)
            .await
    }

    /// 更新を発行（失敗時はログのみ）
    pub async fn try_publish_update(&self, room_id: &str, update_data: &[u8]) {
        self.messenger
            .try_publish_update(room_id, update_data)
            .await
    }

    /// Awareness を発行（失敗時はログのみ）
    pub async fn try_publish_awareness(&self, room_id: &str, awareness_data: &[u8]) {
        self.messenger
            .try_publish_awareness(room_id, awareness_data)
            .await
    }

    /// メッセージ受信チャネルを購読
    pub fn subscribe_messages(&self) -> tokio::sync::broadcast::Receiver<PubSubMessage> {
        self.messenger.subscribe_messages()
    }

    /// 接続をクローズ
    pub async fn close(&self) {
        self.connection.close().await
    }
}

/// オプショナルな Redis Pub/Sub
///
/// Redis が設定されていない場合でも動作するラッパー。
pub struct OptionalRedisPubSub {
    inner: Option<Arc<RedisPubSub>>,
}

impl OptionalRedisPubSub {
    /// Redis 設定から作成（設定がない場合は None）
    pub async fn from_config(config: Option<&RedisConfig>) -> Self {
        let inner = match config {
            Some(cfg) => match RedisPubSub::new(cfg).await {
                Ok(pubsub) => {
                    info!("Redis Pub/Sub enabled");
                    Some(Arc::new(pubsub))
                }
                Err(e) => {
                    error!(error = %e, "Failed to initialize Redis Pub/Sub, running in single-instance mode");
                    None
                }
            },
            None => {
                info!("Redis not configured, running in single-instance mode");
                None
            }
        };

        Self { inner }
    }

    /// 無効な状態で作成
    pub fn disabled() -> Self {
        Self { inner: None }
    }

    /// Redis が有効かどうか
    pub fn is_enabled(&self) -> bool {
        self.inner.is_some()
    }

    /// 内部の Pub/Sub マネージャーを取得
    pub fn get(&self) -> Option<&Arc<RedisPubSub>> {
        self.inner.as_ref()
    }

    /// ルームのチャネルを購読
    pub async fn subscribe_room(&self, room_id: &str) {
        if let Some(pubsub) = &self.inner
            && let Err(e) = pubsub.subscribe_room(room_id).await {
                error!(room_id = %room_id, error = %e, "Failed to subscribe to room");
            }
    }

    /// ルームのチャネル購読を解除
    pub async fn unsubscribe_room(&self, room_id: &str) {
        if let Some(pubsub) = &self.inner
            && let Err(e) = pubsub.unsubscribe_room(room_id).await {
                error!(room_id = %room_id, error = %e, "Failed to unsubscribe from room");
            }
    }

    /// 更新を発行
    pub async fn try_publish_update(&self, room_id: &str, update_data: &[u8]) {
        if let Some(pubsub) = &self.inner {
            pubsub.try_publish_update(room_id, update_data).await;
        }
    }

    /// Awareness を発行
    pub async fn try_publish_awareness(&self, room_id: &str, awareness_data: &[u8]) {
        if let Some(pubsub) = &self.inner {
            pubsub.try_publish_awareness(room_id, awareness_data).await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_optional_pubsub_disabled() {
        let pubsub = OptionalRedisPubSub::disabled();
        assert!(!pubsub.is_enabled());
        assert!(pubsub.get().is_none());
    }
}
