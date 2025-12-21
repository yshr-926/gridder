//! 永続化モジュール
//!
//! PostgreSQL を使用したデータの永続化を担当する。
//!
//! # サブモジュール
//!
//! - `database`: データベース接続プール管理
//! - `room_repository`: ルーム CRUD 操作
//! - `document_repository`: Yjs ドキュメント（更新ログ・スナップショット）操作
//! - `snapshot`: スナップショットマネージャー
//!
//! # 使用例
//!
//! ```ignore
//! use gridder_backend::persistence::{
//!     create_pool, run_migrations,
//!     RoomRepository, DocumentRepository, SnapshotManager,
//! };
//!
//! // 接続プールを作成
//! let pool = create_pool(&database_url, 20).await?;
//!
//! // マイグレーションを実行
//! run_migrations(&pool).await?;
//!
//! // リポジトリを作成
//! let room_repo = RoomRepository::new(pool.clone());
//! let doc_repo = DocumentRepository::new(pool.clone());
//!
//! // スナップショットマネージャーを作成
//! let snapshot_manager = SnapshotManager::new(doc_repo.clone(), 100);
//! ```

pub mod database;
pub mod document_repository;
pub mod room_repository;
pub mod snapshot;

// 再エクスポート
pub use database::{create_pool, detailed_health_check, health_check, run_migrations, DatabaseHealth};
pub use document_repository::{DocumentRepository, DocumentStats, SnapshotRow, UpdateRow};
pub use room_repository::{RoomRepository, RoomRow};
pub use snapshot::SnapshotManager;
