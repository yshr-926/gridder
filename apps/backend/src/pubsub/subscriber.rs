//! Redis メッセージ購読ハンドラー
//!
//! Redis から受信したメッセージを処理し、ローカルクライアントに配信する。

use std::sync::Arc;

use tokio::sync::broadcast;
use tracing::{debug, info, warn};
use yrs::{Transact, Update, updates::decoder::Decode};

use super::{MessageType, PubSubMessage, RedisPubSub};
use crate::{sync::RoomManager, websocket::protocol::encode_update};

/// リモートメッセージハンドラー
///
/// Redis から受信したメッセージを処理し、ローカルクライアントに配信する。
pub struct RemoteMessageHandler {
    /// Pub/Sub マネージャー
    pubsub: Arc<RedisPubSub>,
    /// ルームマネージャー
    room_manager: Arc<RoomManager>,
}

impl RemoteMessageHandler {
    /// 新しいハンドラーを作成
    pub fn new(pubsub: Arc<RedisPubSub>, room_manager: Arc<RoomManager>) -> Self {
        Self {
            pubsub,
            room_manager,
        }
    }

    /// メッセージ処理ループを開始
    ///
    /// バックグラウンドタスクとして実行され、Redis からのメッセージを処理する。
    pub fn start(self: Arc<Self>) {
        let mut rx = self.pubsub.subscribe_messages();

        tokio::spawn(async move {
            info!("Remote message handler started");

            loop {
                match rx.recv().await {
                    Ok(message) => {
                        self.handle_message(message).await;
                    }
                    Err(broadcast::error::RecvError::Lagged(count)) => {
                        warn!(count, "Receiver lagged, some messages were dropped");
                    }
                    Err(broadcast::error::RecvError::Closed) => {
                        info!("Message channel closed, stopping handler");
                        break;
                    }
                }
            }
        });
    }

    /// メッセージを処理
    async fn handle_message(&self, message: PubSubMessage) {
        match message.message_type {
            MessageType::Update => {
                self.handle_update_message(&message).await;
            }
            MessageType::Awareness => {
                self.handle_awareness_message(&message).await;
            }
        }
    }

    /// ドキュメント更新メッセージを処理
    async fn handle_update_message(&self, message: &PubSubMessage) {
        let room_id = &message.room_id;
        let payload = message.payload.clone();

        debug!(
            room_id = %room_id,
            from_server = %message.sender_id,
            payload_size = payload.len(),
            "Handling remote update"
        );

        // ルームを取得
        let room = match self.room_manager.get_room(room_id).await {
            Some(r) => r,
            None => {
                debug!(room_id = %room_id, "Room not found for remote update");
                return;
            }
        };

        // ローカルクライアントにブロードキャスト（先に実行）
        let broadcast_msg = encode_update(&payload);
        room.broadcast(broadcast_msg).await;

        // ドキュメントに適用
        // Note: Update型はSendでないため、awaitの前に全ての処理を完了する必要がある
        let doc = room.document().write().await;
        {
            // 更新をデコードして即座に適用（awaitを挟まない）
            let update = match Update::decode_v1(&payload) {
                Ok(u) => u,
                Err(e) => {
                    warn!(
                        room_id = %room_id,
                        error = %e,
                        "Failed to decode remote update"
                    );
                    return;
                }
            };

            let mut txn = doc.transact_mut();
            txn.apply_update(update);
        }

        debug!(
            room_id = %room_id,
            "Remote update applied and broadcast"
        );
    }

    /// Awareness 更新メッセージを処理
    async fn handle_awareness_message(&self, message: &PubSubMessage) {
        let room_id = &message.room_id;

        debug!(
            room_id = %room_id,
            from_server = %message.sender_id,
            payload_size = message.payload.len(),
            "Handling remote awareness"
        );

        // ルームを取得
        let room = match self.room_manager.get_room(room_id).await {
            Some(r) => r,
            None => {
                debug!(room_id = %room_id, "Room not found for remote awareness");
                return;
            }
        };

        // Awareness ペイロードをデコード
        use crate::websocket::protocol::decode_awareness_payload;

        let entries = match decode_awareness_payload(&message.payload) {
            Ok(e) => e,
            Err(e) => {
                warn!(
                    room_id = %room_id,
                    error = %e,
                    "Failed to decode remote awareness payload"
                );
                return;
            }
        };

        // 各エントリをローカルAwareness状態に反映
        for entry in &entries {
            let client_id_str = format!("remote-{}-{}", message.sender_id, entry.client_id);

            if entry.clock == 0 {
                // clock=0 はクライアント離脱を示す
                room.remove_awareness(&client_id_str).await;
            } else if let Some(state_json) = &entry.state {
                // Awareness 状態を更新
                room.update_awareness_with_clock(&client_id_str, entry.clock, state_json)
                    .await;
            }
        }

        // ローカルクライアントにブロードキャスト
        let broadcast_msg = encode_awareness_raw(&message.payload);
        room.broadcast(broadcast_msg).await;

        debug!(
            room_id = %room_id,
            entry_count = entries.len(),
            "Remote awareness updated and broadcast"
        );
    }
}

/// Awareness データをそのままエンコード
///
/// リモートから受信した Awareness データをそのまま y-protocols 形式でラップする。
fn encode_awareness_raw(awareness_data: &[u8]) -> Vec<u8> {
    use crate::websocket::protocol::{MessageTypeId, write_var_uint};

    let mut encoder = Vec::new();
    write_var_uint(MessageTypeId::Awareness as u64, &mut encoder);
    encoder.extend_from_slice(awareness_data);
    encoder
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_awareness_raw() {
        let data = vec![1, 2, 3, 4, 5];
        let encoded = encode_awareness_raw(&data);

        // 先頭が Awareness メッセージタイプ (1)
        assert_eq!(encoded[0], 1);
        // 残りがデータ
        assert_eq!(&encoded[1..], &data);
    }
}
