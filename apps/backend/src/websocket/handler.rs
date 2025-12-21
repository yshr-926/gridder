//! WebSocket ハンドラー
//!
//! 接続のアップグレード、認証、メッセージループを処理する。

use std::sync::Arc;

use axum::{
    extract::{
        Path, Query, State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    response::Response,
};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};
use yrs::{Transact, Update, updates::decoder::Decode};

use crate::{
    auth::TokenManager,
    error::{AppError, AppResult},
    pubsub::OptionalRedisPubSub,
    sync::{
        awareness::AwarenessState,
        room::{Room, RoomManager},
    },
    websocket::connection::ClientConnection,
};

use super::protocol::{
    AwarenessEntry, AwarenessUpdate, MessageType, SyncMessage, decode_message, encode_awareness,
    encode_sync_step1, encode_sync_step2, encode_update,
};

/// WebSocket 接続クエリパラメータ
#[derive(Debug, Deserialize)]
pub struct WsQuery {
    /// 認証トークン（パスフレーズ）
    #[serde(default)]
    pub token: Option<String>,
    /// ユーザー表示名
    #[serde(default)]
    pub name: Option<String>,
}

/// WebSocket アプリケーション状態
#[derive(Clone)]
pub struct WsAppState {
    pub room_manager: Arc<RoomManager>,
    /// Redis Pub/Sub（オプショナル）
    pub redis_pubsub: Arc<OptionalRedisPubSub>,
    /// トークンマネージャー（認証用）
    pub token_manager: Option<Arc<TokenManager>>,
}

impl WsAppState {
    /// 認証なしで新しい状態を作成
    pub fn new() -> Self {
        Self {
            room_manager: Arc::new(RoomManager::new()),
            redis_pubsub: Arc::new(OptionalRedisPubSub::disabled()),
            token_manager: None,
        }
    }

    /// 認証付きで新しい状態を作成
    pub fn with_auth(token_manager: TokenManager) -> Self {
        Self {
            room_manager: Arc::new(RoomManager::new()),
            redis_pubsub: Arc::new(OptionalRedisPubSub::disabled()),
            token_manager: Some(Arc::new(token_manager)),
        }
    }
}

impl Default for WsAppState {
    fn default() -> Self {
        Self::new()
    }
}

/// WebSocket エンドポイントハンドラー
///
/// GET /ws/:room_id にマップされる。
///
/// # 認証フロー
///
/// 1. トークンマネージャーが設定されている場合、クエリパラメータの token を検証
/// 2. トークンが有効でルーム名が一致する場合のみ接続を許可
/// 3. トークンマネージャーが未設定の場合、認証をスキップ（開発モード）
#[axum::debug_handler]
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Path(room_id): Path<String>,
    Query(query): Query<WsQuery>,
    State(state): State<WsAppState>,
) -> Result<Response, AppError> {
    info!(room_id = %room_id, "WebSocket upgrade request");

    // 認証処理
    let client_id = if let Some(ref token_manager) = state.token_manager {
        // トークンが必要
        let token = query.token.as_ref().ok_or_else(|| {
            warn!(room_id = %room_id, "WebSocket connection rejected: no token provided");
            AppError::PassphraseRequired
        })?;

        // トークンを検証し、ルーム名が一致するか確認
        let claims = token_manager
            .verify_token_for_room(token, &room_id)
            .map_err(|e| {
                warn!(room_id = %room_id, error = ?e, "WebSocket connection rejected: invalid token");
                AppError::InvalidPassphrase
            })?;

        debug!(
            room_id = %room_id,
            client_id = %claims.client_id,
            "Token verified for WebSocket connection"
        );

        Some(claims.client_id)
    } else {
        // 認証なし（開発モード）
        debug!(room_id = %room_id, "WebSocket authentication skipped (no token manager)");
        None
    };

    // ルームの取得または作成
    let room = state.room_manager.get_or_create_room(&room_id).await;

    // Redis Pub/Sub でルームを購読
    state.redis_pubsub.subscribe_room(&room_id).await;

    let user_name = query.name.unwrap_or_else(|| "Anonymous".to_string());
    let redis_pubsub = state.redis_pubsub.clone();

    Ok(
        ws.on_upgrade(move |socket| {
            handle_socket(socket, room, user_name, client_id, redis_pubsub)
        }),
    )
}

/// WebSocket 接続を処理する
async fn handle_socket(
    socket: WebSocket,
    room: Arc<Room>,
    user_name: String,
    auth_client_id: Option<String>,
    redis_pubsub: Arc<OptionalRedisPubSub>,
) {
    let (mut ws_sender, mut ws_receiver) = socket.split();

    // クライアント ID を使用（認証済みの場合はトークンから、そうでなければ生成）
    let client_id = auth_client_id.unwrap_or_else(|| nanoid::nanoid!());
    info!(
        room_id = %room.id,
        client_id = %client_id,
        user_name = %user_name,
        "Client connected"
    );

    // 送信チャネル作成
    let (tx, mut rx) = mpsc::unbounded_channel::<Vec<u8>>();

    // クライアントをルームに登録
    let connection = ClientConnection::new(client_id.clone(), user_name.clone(), tx.clone());
    room.add_client(connection).await;

    // Awareness 状態を初期化
    let awareness_state = AwarenessState::new(&client_id, &user_name);
    room.update_awareness(&client_id, awareness_state).await;

    // 初期同期: サーバーの State Vector を送信
    let sync_step1 = {
        let doc = room.document().read().await;
        encode_sync_step1(&doc)
    };

    if let Err(e) = tx.send(sync_step1) {
        error!(client_id = %client_id, error = %e, "Failed to send initial sync");
        room.remove_client(&client_id).await;
        return;
    }

    // 送信タスク
    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_sender.send(Message::Binary(msg)).await.is_err() {
                break;
            }
        }
    });

    // 受信ループ
    while let Some(result) = ws_receiver.next().await {
        match result {
            Ok(Message::Binary(data)) => {
                if let Err(e) =
                    handle_message(&room, &client_id, &data, redis_pubsub.as_ref()).await
                {
                    warn!(
                        client_id = %client_id,
                        error = %e,
                        "Error handling message"
                    );
                }
            }
            Ok(Message::Close(_)) => {
                debug!(client_id = %client_id, "Client requested close");
                break;
            }
            Ok(Message::Ping(_)) => {
                // Axum の WebSocket は Ping を受信すると自動的に Pong を返す
                // ここでは追加の処理は不要
                debug!(client_id = %client_id, "Received ping (auto-pong handled by axum)");
            }
            Err(e) => {
                warn!(client_id = %client_id, error = %e, "WebSocket error");
                break;
            }
            _ => {}
        }
    }

    // オフライン通知を他のクライアントにブロードキャスト
    // フロントエンドから受信した Yjs clientID を使用（y-protocols 互換）
    // Note: クライアント削除前に yjs_client_id を取得する必要がある
    let yjs_client_id = get_yjs_client_id(&room, &client_id);

    // クリーンアップ
    room.remove_client(&client_id).await;

    if let Some(yjs_client_id) = yjs_client_id {
        let offline_entry = AwarenessEntry {
            client_id: yjs_client_id,
            clock: 0, // clock=0 はオフラインを示す
            state: None,
        };
        let offline_msg = encode_awareness(&[offline_entry]);
        room.broadcast_except(&client_id, offline_msg).await;
    }

    room.remove_awareness(&client_id).await;
    send_task.abort();

    // ルームにクライアントがいなくなったら Redis 購読を解除
    if room.client_count().await == 0 {
        redis_pubsub.unsubscribe_room(&room.id).await;
    }

    info!(client_id = %client_id, room_id = %room.id, "Client disconnected");
}

/// クライアントの Yjs クライアント ID を取得（Awareness用）
///
/// フロントエンドから受信した Awareness メッセージに含まれる数値 clientID を返す。
/// これにより、オフライン通知時に正しい clientID を使用できる。
fn get_yjs_client_id(room: &Arc<Room>, client_id: &str) -> Option<u64> {
    room.get_yjs_client_id(client_id)
}

/// メッセージを処理する
async fn handle_message(
    room: &Arc<Room>,
    client_id: &str,
    data: &[u8],
    redis_pubsub: &OptionalRedisPubSub,
) -> AppResult<()> {
    let message = decode_message(data)?;

    match message {
        MessageType::Sync(sync_msg) => {
            handle_sync_message(room, client_id, sync_msg, redis_pubsub).await?;
        }
        MessageType::Awareness(awareness_update) => {
            handle_awareness_message(room, client_id, &awareness_update, redis_pubsub).await?;
        }
        MessageType::QueryAwareness => {
            handle_query_awareness(room, client_id).await?;
        }
        MessageType::Auth(_) => {
            // 認証は接続時に処理済み
            debug!(client_id = %client_id, "Received auth message after connection");
        }
    }

    Ok(())
}

/// Sync メッセージを処理する
async fn handle_sync_message(
    room: &Arc<Room>,
    client_id: &str,
    sync_msg: SyncMessage,
    redis_pubsub: &OptionalRedisPubSub,
) -> AppResult<()> {
    match sync_msg {
        SyncMessage::SyncStep1(state_vector) => {
            // クライアントの State Vector を受信
            // サーバーとの差分を計算して SyncStep2 として返す
            let response = {
                let doc = room.document().read().await;
                encode_sync_step2(&doc, &state_vector)?
            };

            room.send_to_client(client_id, response).await?;
            debug!(client_id = %client_id, "Sent SyncStep2");
        }
        SyncMessage::SyncStep2(update_data) => {
            // クライアントからの差分更新を適用
            apply_update(room, client_id, &update_data).await?;
        }
        SyncMessage::Update(update_data) => {
            // インクリメンタル更新を適用
            apply_update(room, client_id, &update_data).await?;

            // 他のローカルクライアントにブロードキャスト
            let broadcast_msg = encode_update(&update_data);
            room.broadcast_except(client_id, broadcast_msg).await;

            // Redis を通じて他インスタンスに配信
            redis_pubsub
                .try_publish_update(&room.id, &update_data)
                .await;

            debug!(
                client_id = %client_id,
                room_id = %room.id,
                update_size = update_data.len(),
                "Update broadcasted"
            );
        }
    }

    Ok(())
}

/// 更新を適用する
async fn apply_update(room: &Arc<Room>, client_id: &str, update_data: &[u8]) -> AppResult<()> {
    // ドキュメントに適用
    // Note: yrs::Update は Send を実装していないため、
    // デコードと適用を同じスコープ内で行う必要がある
    {
        let doc = room.document().read().await;
        let update = Update::decode_v1(update_data)
            .map_err(|e| AppError::WebSocket(format!("Invalid update: {}", e)))?;
        let mut txn = doc.transact_mut();
        txn.apply_update(update);
    }

    debug!(
        client_id = %client_id,
        room_id = %room.id,
        update_size = update_data.len(),
        "Applied update"
    );

    Ok(())
}

/// Awareness メッセージを処理する (y-protocols/awareness 互換)
async fn handle_awareness_message(
    room: &Arc<Room>,
    client_id: &str,
    awareness_update: &AwarenessUpdate,
    redis_pubsub: &OptionalRedisPubSub,
) -> AppResult<()> {
    // 各エントリを処理
    for entry in &awareness_update.entries {
        let entry_client_id = entry.client_id.to_string();

        if entry.clock == 0 {
            // clock=0 はクライアント離脱を示す
            room.remove_awareness(&entry_client_id).await;
        } else if let Some(ref state_json) = entry.state {
            // 状態を更新（clock が既存より大きい場合のみ）
            room.update_awareness_with_clock(&entry_client_id, entry.clock, state_json)
                .await;

            // 最初の Awareness 更新で Yjs clientID を記録
            // クライアントは通常自分自身の状態のみを送信するため、
            // 受信した数値 clientID をこのクライアントの Yjs ID として保存
            if room.get_yjs_client_id(client_id).is_none() {
                room.set_yjs_client_id(client_id, entry.client_id);
                debug!(
                    client_id = %client_id,
                    yjs_client_id = entry.client_id,
                    "Recorded Yjs client ID from first awareness message"
                );
            }
        }
    }

    // 他のローカルクライアントにブロードキャスト（受信したメッセージをそのまま転送）
    let entries: Vec<AwarenessEntry> = awareness_update.entries.clone();
    let broadcast_msg = encode_awareness(&entries);
    room.broadcast_except(client_id, broadcast_msg.clone())
        .await;

    // Redis を通じて他インスタンスに配信
    // Awareness エントリをバイト配列としてシリアライズ
    let awareness_data = encode_awareness_for_pubsub(&entries);
    redis_pubsub
        .try_publish_awareness(&room.id, &awareness_data)
        .await;

    debug!(
        client_id = %client_id,
        entry_count = awareness_update.entries.len(),
        "Awareness update processed"
    );

    Ok(())
}

/// Awareness エントリを Pub/Sub 用にエンコード
fn encode_awareness_for_pubsub(entries: &[AwarenessEntry]) -> Vec<u8> {
    use super::protocol::write_var_byte_array;
    use super::protocol::write_var_uint;

    let mut buf = Vec::new();
    write_var_uint(entries.len() as u64, &mut buf);

    for entry in entries {
        write_var_uint(entry.client_id, &mut buf);
        write_var_uint(entry.clock, &mut buf);

        let state_bytes = entry.state.as_ref().map(|s| s.as_bytes()).unwrap_or(&[]);
        write_var_byte_array(state_bytes, &mut buf);
    }

    buf
}

/// Awareness クエリを処理する
async fn handle_query_awareness(room: &Arc<Room>, client_id: &str) -> AppResult<()> {
    // 現在の全 Awareness 状態をエントリ形式で取得
    let entries = room.get_all_awareness_entries().await;
    let encoded = encode_awareness(&entries);

    room.send_to_client(client_id, encoded).await?;

    debug!(
        client_id = %client_id,
        entry_count = entries.len(),
        "Awareness query responded"
    );

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ws_query_deserialize() {
        // 空のクエリ
        let query: WsQuery = serde_json::from_str("{}").unwrap();
        assert!(query.token.is_none());
        assert!(query.name.is_none());

        // 値ありのクエリ
        let query: WsQuery =
            serde_json::from_str(r#"{"token": "secret", "name": "Alice"}"#).unwrap();
        assert_eq!(query.token, Some("secret".to_string()));
        assert_eq!(query.name, Some("Alice".to_string()));
    }

    #[test]
    fn test_ws_app_state_new() {
        let state = WsAppState::new();
        assert_eq!(state.room_manager.room_count(), 0);
    }

    #[tokio::test]
    async fn test_ws_app_state_room_creation() {
        let state = WsAppState::new();
        let room = state.room_manager.get_or_create_room("test-room").await;
        assert_eq!(room.id, "test-room");
        assert_eq!(state.room_manager.room_count(), 1);
    }

    #[test]
    fn test_encode_awareness_for_pubsub() {
        let entries = vec![AwarenessEntry {
            client_id: 12345,
            clock: 1,
            state: Some(r#"{"user":{"name":"Alice"}}"#.to_string()),
        }];

        let encoded = encode_awareness_for_pubsub(&entries);
        assert!(!encoded.is_empty());

        // 最初のバイトはエントリ数 (1)
        assert_eq!(encoded[0], 1);
    }
}
