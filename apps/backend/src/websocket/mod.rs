//! WebSocket 処理モジュール
//!
//! WebSocket 接続の管理と Yjs プロトコルの実装を担当する。
//!
//! # サブモジュール
//!
//! - `handler`: WebSocket 接続ハンドラ
//! - `protocol`: y-protocols 互換 Yjs プロトコル実装
//! - `connection`: 接続管理

pub mod connection;
pub mod handler;
pub mod protocol;

pub use connection::{ClientConnection, ConnectionHealth, ConnectionInfo, SendError};
pub use handler::{WsAppState, WsQuery, ws_handler};
pub use protocol::{
    AwarenessEntry, AwarenessUpdate, MessageType, MessageTypeId, SyncMessage, SyncMessageTypeId,
    decode_message, encode_awareness, encode_query_awareness, encode_sync_step1,
    encode_sync_step1_from_sv, encode_sync_step2, encode_sync_step2_from_update, encode_update,
};
