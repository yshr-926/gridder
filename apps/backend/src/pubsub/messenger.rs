//! Pub/Sub メッセージング
//!
//! Redis を介したメッセージの発行と購読を担当する。
//! MessagePack 形式でシリアライズし、効率的なバイナリ転送を実現する。

use std::sync::Arc;

use fred::interfaces::{EventInterface, PubsubInterface};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use tracing::{debug, info, warn};

use super::redis::RedisConnectionManager;
use crate::error::{AppError, AppResult};

// ============================================================
// メッセージタイプ
// ============================================================

/// メッセージタイプ
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MessageType {
    /// ドキュメント更新
    Update,
    /// Awareness 更新
    Awareness,
}

/// Pub/Sub メッセージ
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PubSubMessage {
    /// ルーム ID
    pub room_id: String,
    /// 送信元サーバー ID
    pub sender_id: String,
    /// メッセージタイプ
    pub message_type: MessageType,
    /// ペイロード（バイナリデータ）
    #[serde(with = "serde_bytes")]
    pub payload: Vec<u8>,
    /// タイムスタンプ（ミリ秒）
    pub timestamp: i64,
}

impl PubSubMessage {
    /// 新しいドキュメント更新メッセージを作成
    pub fn new_update(room_id: &str, sender_id: &str, update_data: Vec<u8>) -> Self {
        Self {
            room_id: room_id.to_string(),
            sender_id: sender_id.to_string(),
            message_type: MessageType::Update,
            payload: update_data,
            timestamp: chrono::Utc::now().timestamp_millis(),
        }
    }

    /// 新しい Awareness 更新メッセージを作成
    pub fn new_awareness(room_id: &str, sender_id: &str, awareness_data: Vec<u8>) -> Self {
        Self {
            room_id: room_id.to_string(),
            sender_id: sender_id.to_string(),
            message_type: MessageType::Awareness,
            payload: awareness_data,
            timestamp: chrono::Utc::now().timestamp_millis(),
        }
    }

    /// MessagePack 形式にシリアライズ
    fn to_msgpack(&self) -> AppResult<Vec<u8>> {
        // MessagePack の代わりに JSON を使用（serde_json は既に依存関係にある）
        // 本番環境では rmp-serde を追加して MessagePack を使用することを推奨
        serde_json::to_vec(self)
            .map_err(|e| AppError::Redis(format!("Failed to serialize message: {}", e)))
    }

    /// MessagePack 形式からデシリアライズ
    fn from_msgpack(data: &[u8]) -> AppResult<Self> {
        serde_json::from_slice(data)
            .map_err(|e| AppError::Redis(format!("Failed to deserialize message: {}", e)))
    }
}

// ============================================================
// チャネル名
// ============================================================

/// チャネル名を生成
fn updates_channel(room_id: &str) -> String {
    format!("gridder:room:{}:updates", room_id)
}

fn awareness_channel(room_id: &str) -> String {
    format!("gridder:room:{}:awareness", room_id)
}

// ============================================================
// メッセンジャー
// ============================================================

/// Pub/Sub メッセンジャー
///
/// Redis Pub/Sub を使用したメッセージの発行と購読を担当する。
pub struct Messenger {
    /// 接続マネージャー
    connection: Arc<RedisConnectionManager>,
    /// サーバー固有 ID
    server_id: String,
    /// 受信メッセージ通知チャネル
    message_tx: broadcast::Sender<PubSubMessage>,
}

impl Messenger {
    /// 新しいメッセンジャーを作成
    ///
    /// # Arguments
    /// * `connection` - Redis 接続マネージャー
    /// * `server_id` - サーバー固有 ID（自分自身からのメッセージをフィルタリングするため）
    pub fn new(connection: Arc<RedisConnectionManager>, server_id: String) -> Self {
        let (message_tx, _) = broadcast::channel(1024);

        info!(server_id = %server_id, "Messenger initialized");

        Self {
            connection,
            server_id,
            message_tx,
        }
    }

    /// サーバー ID を取得
    pub fn server_id(&self) -> &str {
        &self.server_id
    }

    /// メッセージ受信チャネルを購読
    pub fn subscribe_messages(&self) -> broadcast::Receiver<PubSubMessage> {
        self.message_tx.subscribe()
    }

    // ================================================================
    // 発行
    // ================================================================

    /// ドキュメント更新を発行
    ///
    /// # Arguments
    /// * `room_id` - ルーム ID
    /// * `update_data` - Yjs 更新データ
    /// * `sender_id` - 送信元クライアント ID（オプション、ログ用）
    pub async fn publish_update(
        &self,
        room_id: &str,
        update_data: &[u8],
        _sender_id: Option<&str>,
    ) -> AppResult<()> {
        if !self.connection.is_connected() {
            warn!(room_id = %room_id, "Redis not connected, skipping publish");
            return Ok(());
        }

        let message = PubSubMessage::new_update(room_id, &self.server_id, update_data.to_vec());
        let payload = message.to_msgpack()?;
        let channel = updates_channel(room_id);

        self.connection
            .client()
            .publish::<(), _, _>(&channel, payload)
            .await
            .map_err(|e| AppError::Redis(format!("Failed to publish update: {}", e)))?;

        debug!(room_id = %room_id, channel = %channel, "Published update");
        Ok(())
    }

    /// Awareness 更新を発行
    ///
    /// # Arguments
    /// * `room_id` - ルーム ID
    /// * `awareness_data` - Awareness データ
    /// * `sender_id` - 送信元クライアント ID
    pub async fn publish_awareness(
        &self,
        room_id: &str,
        awareness_data: &[u8],
        _sender_id: Option<&str>,
    ) -> AppResult<()> {
        if !self.connection.is_connected() {
            warn!(room_id = %room_id, "Redis not connected, skipping publish");
            return Ok(());
        }

        let message =
            PubSubMessage::new_awareness(room_id, &self.server_id, awareness_data.to_vec());
        let payload = message.to_msgpack()?;
        let channel = awareness_channel(room_id);

        self.connection
            .client()
            .publish::<(), _, _>(&channel, payload)
            .await
            .map_err(|e| AppError::Redis(format!("Failed to publish awareness: {}", e)))?;

        debug!(room_id = %room_id, channel = %channel, "Published awareness");
        Ok(())
    }

    /// 更新を発行（失敗時はログのみ）
    ///
    /// Redis 接続断時にもローカル同期を継続するため、
    /// エラー時はワーニングログを出力するのみで処理を続行する。
    pub async fn try_publish_update(&self, room_id: &str, update_data: &[u8]) {
        if let Err(e) = self.publish_update(room_id, update_data, None).await {
            warn!(
                room_id = %room_id,
                error = %e,
                "Failed to publish update to Redis (continuing locally)"
            );
        }
    }

    /// Awareness を発行（失敗時はログのみ）
    pub async fn try_publish_awareness(&self, room_id: &str, awareness_data: &[u8]) {
        if let Err(e) = self.publish_awareness(room_id, awareness_data, None).await {
            warn!(
                room_id = %room_id,
                error = %e,
                "Failed to publish awareness to Redis (continuing locally)"
            );
        }
    }

    // ================================================================
    // 購読
    // ================================================================

    /// ルームのチャネルを購読
    ///
    /// # Arguments
    /// * `room_id` - ルーム ID
    pub async fn subscribe_to_room(&self, room_id: &str) -> AppResult<()> {
        let channels = vec![updates_channel(room_id), awareness_channel(room_id)];

        for channel in &channels {
            self.connection
                .subscriber()
                .subscribe(channel.clone())
                .await
                .map_err(|e| AppError::Redis(format!("Failed to subscribe: {}", e)))?;

            self.connection.add_subscription(channel);
        }

        info!(room_id = %room_id, "Subscribed to room channels");
        Ok(())
    }

    /// ルームのチャネル購読を解除
    ///
    /// # Arguments
    /// * `room_id` - ルーム ID
    pub async fn unsubscribe_from_room(&self, room_id: &str) -> AppResult<()> {
        let channels = vec![updates_channel(room_id), awareness_channel(room_id)];

        for channel in &channels {
            self.connection
                .subscriber()
                .unsubscribe(channel.clone())
                .await
                .map_err(|e| AppError::Redis(format!("Failed to unsubscribe: {}", e)))?;

            self.connection.remove_subscription(channel);
        }

        info!(room_id = %room_id, "Unsubscribed from room channels");
        Ok(())
    }

    /// メッセージ受信ループを開始
    ///
    /// このメソッドは購読されたチャネルからメッセージを受信し、
    /// 内部のブロードキャストチャネルに転送する。
    pub fn start_message_listener(&self) {
        let subscriber = self.connection.subscriber().clone();
        let server_id = self.server_id.clone();
        let message_tx = self.message_tx.clone();

        tokio::spawn(async move {
            let mut message_rx = subscriber.message_rx();

            while let Ok(message) = message_rx.recv().await {
                // ペイロードをバイト配列として取得
                let bytes: Vec<u8> = match message.value.convert() {
                    Ok(b) => b,
                    Err(e) => {
                        warn!(error = %e, "Failed to convert message payload");
                        continue;
                    }
                };

                // メッセージをデシリアライズ
                let pubsub_message = match PubSubMessage::from_msgpack(&bytes) {
                    Ok(m) => m,
                    Err(e) => {
                        warn!(error = %e, "Failed to deserialize message");
                        continue;
                    }
                };

                // 自分自身からのメッセージは無視
                if pubsub_message.sender_id == server_id {
                    debug!("Ignoring message from self");
                    continue;
                }

                debug!(
                    room_id = %pubsub_message.room_id,
                    from_server = %pubsub_message.sender_id,
                    message_type = ?pubsub_message.message_type,
                    "Received remote message"
                );

                // ブロードキャストチャネルに転送
                if message_tx.send(pubsub_message).is_err() {
                    // 受信者がいない場合は無視
                    debug!("No receivers for message");
                }
            }

            info!("Message listener stopped");
        });
    }
}

// ============================================================
// テスト
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pubsub_message_serialization() {
        let message = PubSubMessage::new_update("room-1", "server-1", vec![1, 2, 3, 4, 5]);

        // シリアライズ
        let bytes = message.to_msgpack().unwrap();
        assert!(!bytes.is_empty());

        // デシリアライズ
        let decoded = PubSubMessage::from_msgpack(&bytes).unwrap();
        assert_eq!(decoded.room_id, "room-1");
        assert_eq!(decoded.sender_id, "server-1");
        assert_eq!(decoded.message_type, MessageType::Update);
        assert_eq!(decoded.payload, vec![1, 2, 3, 4, 5]);
    }

    #[test]
    fn test_pubsub_message_awareness() {
        let message =
            PubSubMessage::new_awareness("room-1", "server-1", b"awareness data".to_vec());

        assert_eq!(message.message_type, MessageType::Awareness);

        let bytes = message.to_msgpack().unwrap();
        let decoded = PubSubMessage::from_msgpack(&bytes).unwrap();

        assert_eq!(decoded.message_type, MessageType::Awareness);
        assert_eq!(decoded.payload, b"awareness data".to_vec());
    }

    #[test]
    fn test_channel_names() {
        assert_eq!(updates_channel("my-room"), "gridder:room:my-room:updates");
        assert_eq!(
            awareness_channel("my-room"),
            "gridder:room:my-room:awareness"
        );
    }
}
