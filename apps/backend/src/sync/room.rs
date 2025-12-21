//! ルーム管理
//!
//! Y.Doc とクライアント接続を管理する。
//! 各ルームは独立した CRDT ドキュメントを持ち、複数クライアントの同期を担当する。

use std::{collections::HashMap, sync::Arc};

use parking_lot::RwLock;
use tokio::sync::RwLock as TokioRwLock;
use tracing::{debug, info, warn};
use yrs::{Doc, Transact, Update, updates::decoder::Decode};

use crate::{
    error::{AppError, AppResult},
    persistence::{DocumentRepository, RoomRepository, SnapshotManager},
    websocket::{
        connection::ClientConnection,
        protocol::{AwarenessEntry, encode_awareness},
    },
};

use super::awareness::{AwarenessManager, AwarenessState};

/// ルーム
///
/// 単一の共同編集セッションを表す。
/// Y.Doc、接続クライアント、Awareness 状態を管理する。
pub struct Room {
    /// ルーム ID
    pub id: String,
    /// Y.Doc
    doc: TokioRwLock<Doc>,
    /// 接続中のクライアント
    clients: RwLock<HashMap<String, ClientConnection>>,
    /// Awareness マネージャー
    awareness: AwarenessManager,
}

impl Room {
    /// 新しい空のルームを作成
    pub fn new(id: String) -> Self {
        info!(room_id = %id, "Creating new room");
        Self {
            id,
            doc: TokioRwLock::new(Doc::new()),
            clients: RwLock::new(HashMap::new()),
            awareness: AwarenessManager::new(),
        }
    }

    /// 既存のドキュメント状態でルームを作成
    ///
    /// # Arguments
    /// * `id` - ルーム ID
    /// * `snapshot` - スナップショットデータ（オプション）
    pub fn with_state(id: String, snapshot: Option<&[u8]>) -> AppResult<Self> {
        info!(room_id = %id, has_snapshot = snapshot.is_some(), "Creating room with state");
        let doc = Doc::new();

        if let Some(snapshot_data) = snapshot
            && !snapshot_data.is_empty()
        {
            let update = Update::decode_v1(snapshot_data)
                .map_err(|e| AppError::WebSocket(format!("Invalid snapshot: {}", e)))?;
            let mut txn = doc.transact_mut();
            txn.apply_update(update);
        }

        Ok(Self {
            id,
            doc: TokioRwLock::new(doc),
            clients: RwLock::new(HashMap::new()),
            awareness: AwarenessManager::new(),
        })
    }

    /// スナップショットと更新ログからルームを復元
    ///
    /// # 重要
    /// Yjs の更新形式では、複数の更新を連結して一度にデコードすることはできない。
    /// 各更新は個別にデコードして逐次適用する必要がある。
    pub fn with_updates(
        id: String,
        snapshot: Option<&[u8]>,
        updates: &[Vec<u8>],
    ) -> AppResult<Self> {
        info!(
            room_id = %id,
            has_snapshot = snapshot.is_some(),
            update_count = updates.len(),
            "Restoring room from updates"
        );
        let doc = Doc::new();

        // 1. スナップショットを適用
        if let Some(snapshot_data) = snapshot
            && !snapshot_data.is_empty()
        {
            let update = Update::decode_v1(snapshot_data)
                .map_err(|e| AppError::WebSocket(format!("Invalid snapshot: {}", e)))?;
            let mut txn = doc.transact_mut();
            txn.apply_update(update);
        }

        // 2. 更新ログを逐次適用
        for (i, update_data) in updates.iter().enumerate() {
            if update_data.is_empty() {
                continue;
            }
            let update = Update::decode_v1(update_data).map_err(|e| {
                AppError::WebSocket(format!("Invalid update at index {}: {}", i, e))
            })?;
            let mut txn = doc.transact_mut();
            txn.apply_update(update);
        }

        Ok(Self {
            id,
            doc: TokioRwLock::new(doc),
            clients: RwLock::new(HashMap::new()),
            awareness: AwarenessManager::new(),
        })
    }

    /// ドキュメントへの参照を取得
    pub fn document(&self) -> &TokioRwLock<Doc> {
        &self.doc
    }

    /// クライアントを追加
    pub async fn add_client(&self, connection: ClientConnection) {
        let client_id = connection.client_id.clone();
        let user_name = connection.user_name.clone();

        info!(
            room_id = %self.id,
            client_id = %client_id,
            user_name = %user_name,
            "Client joined room"
        );

        let mut clients = self.clients.write();
        clients.insert(client_id.clone(), connection);

        debug!(
            room_id = %self.id,
            client_count = clients.len(),
            "Room client count updated"
        );
    }

    /// クライアントを削除
    pub async fn remove_client(&self, client_id: &str) {
        let mut clients = self.clients.write();
        if clients.remove(client_id).is_some() {
            info!(
                room_id = %self.id,
                client_id = %client_id,
                remaining = clients.len(),
                "Client left room"
            );
        }
    }

    /// クライアント数を取得
    pub async fn client_count(&self) -> usize {
        self.clients.read().len()
    }

    /// ルームが空かどうか
    pub fn is_empty(&self) -> bool {
        self.clients.read().is_empty()
    }

    /// 特定のクライアントにメッセージを送信
    pub async fn send_to_client(&self, client_id: &str, message: Vec<u8>) -> AppResult<()> {
        let clients = self.clients.read();
        if let Some(client) = clients.get(client_id) {
            client.send(message).map_err(|e| {
                AppError::WebSocket(format!("Failed to send to client {}: {}", client_id, e))
            })?;
        } else {
            warn!(
                room_id = %self.id,
                client_id = %client_id,
                "Attempted to send to non-existent client"
            );
        }
        Ok(())
    }

    /// 特定のクライアント以外にブロードキャスト
    pub async fn broadcast_except(&self, exclude_client_id: &str, message: Vec<u8>) {
        let clients = self.clients.read();
        let mut failed_count = 0;

        for (client_id, client) in clients.iter() {
            if client_id != exclude_client_id && client.send(message.clone()).is_err() {
                failed_count += 1;
            }
        }

        if failed_count > 0 {
            debug!(
                room_id = %self.id,
                failed_count,
                "Some clients failed to receive broadcast"
            );
        }
    }

    /// 全クライアントにブロードキャスト
    pub async fn broadcast(&self, message: Vec<u8>) {
        let clients = self.clients.read();
        for client in clients.values() {
            let _ = client.send(message.clone());
        }
    }

    /// Awareness 状態を更新
    pub async fn update_awareness(&self, client_id: &str, state: AwarenessState) {
        self.awareness.update(client_id, state);
    }

    /// Awareness 状態を clock 付きで更新
    pub async fn update_awareness_with_clock(&self, client_id: &str, clock: u64, state_json: &str) {
        self.awareness
            .update_with_clock(client_id, clock, state_json);
    }

    /// Awareness 状態を削除
    pub async fn remove_awareness(&self, client_id: &str) {
        self.awareness.remove(client_id);
    }

    /// クライアントの Yjs クライアント ID を設定
    pub fn set_yjs_client_id(&self, client_id: &str, yjs_client_id: u64) {
        let mut clients = self.clients.write();
        if let Some(client) = clients.get_mut(client_id) {
            client.set_yjs_client_id(yjs_client_id);
        }
    }

    /// クライアントの Yjs クライアント ID を取得
    pub fn get_yjs_client_id(&self, client_id: &str) -> Option<u64> {
        self.clients
            .read()
            .get(client_id)
            .and_then(|c| c.yjs_client_id)
    }

    /// 全 Awareness エントリを取得
    pub async fn get_all_awareness_entries(&self) -> Vec<AwarenessEntry> {
        self.awareness.get_all_entries()
    }

    /// 全 Awareness 状態をエンコードしたメッセージを取得
    pub async fn encode_all_awareness(&self) -> Vec<u8> {
        let entries = self.awareness.get_all_entries();
        encode_awareness(&entries)
    }

    /// ドキュメントの現在の状態をエンコード
    pub async fn encode_state(&self) -> Vec<u8> {
        use yrs::{ReadTxn, Transact};

        let doc = self.doc.read().await;
        let txn = doc.transact();
        txn.encode_state_as_update_v1(&yrs::StateVector::default())
    }

    /// クライアントIDのリストを取得
    pub fn get_client_ids(&self) -> Vec<String> {
        self.clients.read().keys().cloned().collect()
    }

    /// データベースからルームを復元
    ///
    /// スナップショットと更新ログを読み込み、ドキュメント状態を復元する。
    ///
    /// # Arguments
    /// * `id` - ルームID
    /// * `snapshot_manager` - スナップショットマネージャー
    ///
    /// # Returns
    /// 復元されたルーム。データが存在しない場合は新規ルームを作成。
    pub async fn from_database(id: String, snapshot_manager: &SnapshotManager) -> AppResult<Self> {
        info!(room_id = %id, "Restoring room from database");

        match snapshot_manager.restore_document(&id).await? {
            Some(doc) => {
                info!(room_id = %id, "Room restored from database");
                Ok(Self {
                    id,
                    doc: TokioRwLock::new(doc),
                    clients: RwLock::new(HashMap::new()),
                    awareness: AwarenessManager::new(),
                })
            }
            None => {
                info!(room_id = %id, "No data found, creating new room");
                Ok(Self::new(id))
            }
        }
    }
}

impl std::fmt::Debug for Room {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Room")
            .field("id", &self.id)
            .field("client_count", &self.clients.read().len())
            .finish()
    }
}

/// ルームマネージャー
///
/// 全ルームのライフサイクルを管理する。
pub struct RoomManager {
    rooms: RwLock<HashMap<String, Arc<Room>>>,
    /// ルームリポジトリ（永続化用、オプション）
    room_repo: Option<RoomRepository>,
    /// ドキュメントリポジトリ（永続化用、オプション）
    document_repo: Option<DocumentRepository>,
    /// スナップショットマネージャー（永続化用、オプション）
    snapshot_manager: Option<SnapshotManager>,
}

impl RoomManager {
    /// 新しい RoomManager を作成（永続化なし）
    pub fn new() -> Self {
        Self {
            rooms: RwLock::new(HashMap::new()),
            room_repo: None,
            document_repo: None,
            snapshot_manager: None,
        }
    }

    /// 永続化機能付きで RoomManager を作成
    pub fn with_persistence(
        room_repo: RoomRepository,
        document_repo: DocumentRepository,
        snapshot_threshold: i64,
    ) -> Self {
        let snapshot_manager = SnapshotManager::new(document_repo.clone(), snapshot_threshold);
        Self {
            rooms: RwLock::new(HashMap::new()),
            room_repo: Some(room_repo),
            document_repo: Some(document_repo),
            snapshot_manager: Some(snapshot_manager),
        }
    }

    /// 永続化が有効かどうか
    pub fn has_persistence(&self) -> bool {
        self.room_repo.is_some() && self.document_repo.is_some()
    }

    /// ドキュメントリポジトリへの参照を取得
    pub fn document_repo(&self) -> Option<&DocumentRepository> {
        self.document_repo.as_ref()
    }

    /// スナップショットマネージャーへの参照を取得
    pub fn snapshot_manager(&self) -> Option<&SnapshotManager> {
        self.snapshot_manager.as_ref()
    }

    /// ルームを取得、存在しない場合は作成
    ///
    /// 永続化が有効な場合、データベースからルーム状態を復元する。
    pub async fn get_or_create_room(&self, room_id: &str) -> Arc<Room> {
        // まず読み取りロックで確認
        {
            let rooms = self.rooms.read();
            if let Some(room) = rooms.get(room_id) {
                return room.clone();
            }
        }

        // ロックを保持せずに、永続化が有効ならDBから復元を試みる
        // Note: awaitを含む処理はロックの外で実行する必要がある（parking_lotのロックはSendでない）
        let room = if let Some(ref snapshot_manager) = self.snapshot_manager {
            // DBにルームレコードを作成（存在しなければ）
            if let Some(ref room_repo) = self.room_repo
                && let Err(e) = room_repo.create_room_if_not_exists(room_id).await
            {
                warn!(room_id = %room_id, error = %e, "Failed to create room record");
            }

            // ドキュメント状態を復元
            match Room::from_database(room_id.to_string(), snapshot_manager).await {
                Ok(room) => Arc::new(room),
                Err(e) => {
                    warn!(room_id = %room_id, error = %e, "Failed to restore room, creating new");
                    Arc::new(Room::new(room_id.to_string()))
                }
            }
        } else {
            Arc::new(Room::new(room_id.to_string()))
        };

        // DBから復元した後、書き込みロックで登録
        let mut rooms = self.rooms.write();

        // ダブルチェック（async処理中に他のスレッドが先に作成した可能性）
        if let Some(existing_room) = rooms.get(room_id) {
            return existing_room.clone();
        }

        rooms.insert(room_id.to_string(), room.clone());
        info!(room_id = %room_id, total_rooms = rooms.len(), "Room created");

        room
    }

    /// ルームの更新をデータベースに保存
    ///
    /// 永続化が有効な場合のみ動作する。
    pub async fn persist_update(&self, room_id: &str, update_data: &[u8]) -> AppResult<()> {
        if let Some(ref doc_repo) = self.document_repo {
            doc_repo.append_update(room_id, update_data).await?;

            // 最終アクセス日時を更新
            if let Some(ref room_repo) = self.room_repo {
                let _ = room_repo.update_last_accessed(room_id).await;
            }
        }
        Ok(())
    }

    /// スナップショットが必要か確認し、必要なら作成
    pub async fn maybe_create_snapshot(&self, room_id: &str) -> AppResult<bool> {
        let room = self.get_room(room_id).await;
        if room.is_none() {
            return Ok(false);
        }
        let room = room.unwrap();

        if let Some(ref snapshot_manager) = self.snapshot_manager {
            let doc = room.document().read().await;
            snapshot_manager.maybe_create_snapshot(room_id, &doc).await
        } else {
            Ok(false)
        }
    }

    /// 既存の状態からルームを作成
    pub async fn create_room_with_state(
        &self,
        room_id: &str,
        snapshot: Option<&[u8]>,
    ) -> AppResult<Arc<Room>> {
        let mut rooms = self.rooms.write();

        if rooms.contains_key(room_id) {
            return Err(AppError::Validation(format!(
                "Room {} already exists",
                room_id
            )));
        }

        let room = Arc::new(Room::with_state(room_id.to_string(), snapshot)?);
        rooms.insert(room_id.to_string(), room.clone());

        info!(room_id = %room_id, "Room created with state");

        Ok(room)
    }

    /// ルームを取得
    pub async fn get_room(&self, room_id: &str) -> Option<Arc<Room>> {
        self.rooms.read().get(room_id).cloned()
    }

    /// ルームが空の場合にアンロード
    pub async fn maybe_unload_room(&self, room_id: &str) {
        let mut rooms = self.rooms.write();

        if let Some(room) = rooms.get(room_id)
            && room.is_empty()
        {
            info!(room_id = %room_id, "Unloading empty room");
            rooms.remove(room_id);
        }
    }

    /// ルームを強制的にアンロード
    pub async fn unload_room(&self, room_id: &str) {
        let mut rooms = self.rooms.write();
        if rooms.remove(room_id).is_some() {
            info!(room_id = %room_id, "Room forcefully unloaded");
        }
    }

    /// ルーム数を取得
    pub fn room_count(&self) -> usize {
        self.rooms.read().len()
    }

    /// 全ルームIDのリストを取得
    pub fn get_room_ids(&self) -> Vec<String> {
        self.rooms.read().keys().cloned().collect()
    }
}

impl Default for RoomManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::sync::mpsc;
    use yrs::GetString;

    fn create_test_connection(client_id: &str, user_name: &str) -> ClientConnection {
        let (tx, _rx) = mpsc::unbounded_channel();
        ClientConnection::new(client_id.to_string(), user_name.to_string(), tx)
    }

    #[tokio::test]
    async fn test_room_creation() {
        let room = Room::new("test-room".to_string());
        assert_eq!(room.id, "test-room");
        assert_eq!(room.client_count().await, 0);
    }

    #[tokio::test]
    async fn test_room_add_remove_client() {
        let room = Room::new("test-room".to_string());

        let conn = create_test_connection("client-1", "User 1");
        room.add_client(conn).await;
        assert_eq!(room.client_count().await, 1);

        room.remove_client("client-1").await;
        assert_eq!(room.client_count().await, 0);
    }

    #[tokio::test]
    async fn test_room_send_to_client() {
        let room = Room::new("test-room".to_string());

        let (tx, mut rx) = mpsc::unbounded_channel();
        let conn = ClientConnection::new("client-1".to_string(), "User 1".to_string(), tx);
        room.add_client(conn).await;

        room.send_to_client("client-1", vec![1, 2, 3])
            .await
            .unwrap();

        let received = rx.recv().await.unwrap();
        assert_eq!(received, vec![1, 2, 3]);
    }

    #[tokio::test]
    async fn test_room_broadcast_except() {
        let room = Room::new("test-room".to_string());

        let (tx1, mut rx1) = mpsc::unbounded_channel();
        let (tx2, mut rx2) = mpsc::unbounded_channel();

        let conn1 = ClientConnection::new("client-1".to_string(), "User 1".to_string(), tx1);
        let conn2 = ClientConnection::new("client-2".to_string(), "User 2".to_string(), tx2);

        room.add_client(conn1).await;
        room.add_client(conn2).await;

        room.broadcast_except("client-1", vec![1, 2, 3]).await;

        // client-1 は除外されるので受信しない
        assert!(rx1.try_recv().is_err());

        // client-2 は受信する
        let received = rx2.recv().await.unwrap();
        assert_eq!(received, vec![1, 2, 3]);
    }

    #[tokio::test]
    async fn test_room_manager_get_or_create() {
        let manager = RoomManager::new();

        let room1 = manager.get_or_create_room("room-1").await;
        assert_eq!(room1.id, "room-1");
        assert_eq!(manager.room_count(), 1);

        // 同じIDで再取得しても同じルーム
        let room1_again = manager.get_or_create_room("room-1").await;
        assert_eq!(Arc::strong_count(&room1), Arc::strong_count(&room1_again));
        assert_eq!(manager.room_count(), 1);

        // 別のルームを作成
        let room2 = manager.get_or_create_room("room-2").await;
        assert_eq!(room2.id, "room-2");
        assert_eq!(manager.room_count(), 2);
    }

    #[tokio::test]
    async fn test_room_manager_unload_empty() {
        let manager = RoomManager::new();

        let _room = manager.get_or_create_room("room-1").await;
        assert_eq!(manager.room_count(), 1);

        // クライアントがいない場合はアンロード可能
        manager.maybe_unload_room("room-1").await;
        assert_eq!(manager.room_count(), 0);

        // クライアントがいる場合はアンロードされない
        let room = manager.get_or_create_room("room-2").await;
        let conn = create_test_connection("client-1", "User 1");
        room.add_client(conn).await;

        manager.maybe_unload_room("room-2").await;
        assert_eq!(manager.room_count(), 1);
    }

    #[tokio::test]
    async fn test_room_awareness() {
        let room = Room::new("test-room".to_string());

        let state = AwarenessState::new("client-1", "Alice");
        room.update_awareness("client-1", state).await;

        let entries = room.get_all_awareness_entries().await;
        assert_eq!(entries.len(), 1);

        room.remove_awareness("client-1").await;
        let entries = room.get_all_awareness_entries().await;
        assert_eq!(entries.len(), 0);
    }

    #[tokio::test]
    async fn test_room_with_state() {
        use yrs::{Text, Transact};

        // 元のルームにデータを設定
        let room1 = Room::new("room-1".to_string());
        {
            let doc = room1.document().write().await;
            let text = doc.get_or_insert_text("content");
            let mut txn = doc.transact_mut();
            text.insert(&mut txn, 0, "Hello, World!");
        }

        // 状態をエンコード
        let state = room1.encode_state().await;

        // 新しいルームに状態を復元
        let room2 = Room::with_state("room-2".to_string(), Some(&state)).unwrap();

        // 同じ内容であることを確認
        let doc = room2.document().read().await;
        let text = doc.get_or_insert_text("content");
        let txn = doc.transact();
        assert_eq!(text.get_string(&txn), "Hello, World!");
    }
}
