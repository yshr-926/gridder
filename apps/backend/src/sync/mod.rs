//! CRDT 同期モジュール
//!
//! Yjs/yrs ドキュメントの同期と Awareness 状態管理を担当する。
//!
//! # サブモジュール
//!
//! - `document`: Y.Doc 管理
//! - `awareness`: Awareness 状態管理
//! - `room`: ルーム管理

pub mod awareness;
pub mod document;
pub mod room;

pub use awareness::{AwarenessManager, AwarenessState, AwarenessStateEntry, CursorPosition, UserInfo};
pub use document::DocumentManager;
pub use room::{Room, RoomManager};
