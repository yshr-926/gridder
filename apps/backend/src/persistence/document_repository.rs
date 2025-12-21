//! Document リポジトリ
//!
//! Yjs ドキュメントの更新ログとスナップショットの永続化を提供する。
//! zstd 圧縮によるスナップショットの効率的な保存をサポート。

use chrono::{DateTime, Utc};
use sqlx::{FromRow, PgPool, Postgres, Row, Transaction, postgres::PgRow};
use tracing::{debug, info};

use crate::error::AppResult;

/// 更新ログ行
#[derive(Debug, Clone)]
pub struct UpdateRow {
    /// シーケンシャルID
    pub id: i32,
    /// ルームID
    pub room_id: String,
    /// 更新バイナリデータ
    pub update_data: Vec<u8>,
    /// 作成日時
    pub created_at: DateTime<Utc>,
}

impl<'r> FromRow<'r, PgRow> for UpdateRow {
    fn from_row(row: &'r PgRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            room_id: row.try_get("room_id")?,
            update_data: row.try_get("update_data")?,
            created_at: row.try_get("created_at")?,
        })
    }
}

/// スナップショット行
#[derive(Debug, Clone)]
pub struct SnapshotRow {
    /// ルームID
    pub room_id: String,
    /// スナップショットバイナリデータ
    pub snapshot_data: Vec<u8>,
    /// 更新日時
    pub updated_at: DateTime<Utc>,
}

impl<'r> FromRow<'r, PgRow> for SnapshotRow {
    fn from_row(row: &'r PgRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            room_id: row.try_get("room_id")?,
            snapshot_data: row.try_get("snapshot_data")?,
            updated_at: row.try_get("updated_at")?,
        })
    }
}

/// Document リポジトリ
#[derive(Clone)]
pub struct DocumentRepository {
    pool: PgPool,
}

impl DocumentRepository {
    /// 新しいリポジトリを作成
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    // ============================================================
    // 更新ログ操作
    // ============================================================

    /// 更新を保存
    pub async fn append_update(&self, room_id: &str, update_data: &[u8]) -> AppResult<()> {
        sqlx::query(
            r#"
            INSERT INTO room_updates (room_id, update_data, created_at)
            VALUES ($1, $2, NOW())
            "#,
        )
        .bind(room_id)
        .bind(update_data)
        .execute(&self.pool)
        .await?;

        debug!(
            room_id = %room_id,
            size = update_data.len(),
            "Update appended"
        );
        Ok(())
    }

    /// 複数の更新をバッチで保存
    pub async fn append_updates_batch(&self, room_id: &str, updates: &[Vec<u8>]) -> AppResult<()> {
        if updates.is_empty() {
            return Ok(());
        }

        // トランザクション内で複数の INSERT を実行
        let mut tx = self.pool.begin().await?;

        for update_data in updates {
            sqlx::query(
                r#"
                INSERT INTO room_updates (room_id, update_data, created_at)
                VALUES ($1, $2, NOW())
                "#,
            )
            .bind(room_id)
            .bind(update_data)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;

        debug!(
            room_id = %room_id,
            count = updates.len(),
            "Batch updates appended"
        );
        Ok(())
    }

    /// 全更新ログを取得
    pub async fn load_updates(&self, room_id: &str) -> AppResult<Vec<UpdateRow>> {
        let updates = sqlx::query_as::<_, UpdateRow>(
            r#"
            SELECT id, room_id, update_data, created_at
            FROM room_updates
            WHERE room_id = $1
            ORDER BY id ASC
            "#,
        )
        .bind(room_id)
        .fetch_all(&self.pool)
        .await?;

        debug!(
            room_id = %room_id,
            count = updates.len(),
            "Updates loaded"
        );
        Ok(updates)
    }

    /// 指定IDより後の更新ログを取得
    pub async fn load_updates_since(
        &self,
        room_id: &str,
        since_id: i32,
    ) -> AppResult<Vec<UpdateRow>> {
        let updates = sqlx::query_as::<_, UpdateRow>(
            r#"
            SELECT id, room_id, update_data, created_at
            FROM room_updates
            WHERE room_id = $1 AND id > $2
            ORDER BY id ASC
            "#,
        )
        .bind(room_id)
        .bind(since_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(updates)
    }

    /// 更新ログ数を取得
    pub async fn get_update_count(&self, room_id: &str) -> AppResult<i64> {
        let count: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) FROM room_updates WHERE room_id = $1
            "#,
        )
        .bind(room_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(count)
    }

    /// 更新ログを削除
    pub async fn delete_updates(&self, room_id: &str) -> AppResult<u64> {
        let result = sqlx::query(
            r#"
            DELETE FROM room_updates WHERE room_id = $1
            "#,
        )
        .bind(room_id)
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected())
    }

    /// トランザクション内で更新ログを削除
    pub async fn delete_updates_in_tx(
        tx: &mut Transaction<'_, Postgres>,
        room_id: &str,
    ) -> AppResult<u64> {
        let result = sqlx::query(
            r#"
            DELETE FROM room_updates WHERE room_id = $1
            "#,
        )
        .bind(room_id)
        .execute(&mut **tx)
        .await?;

        Ok(result.rows_affected())
    }

    // ============================================================
    // スナップショット操作
    // ============================================================

    /// 最新のスナップショットを取得
    pub async fn load_latest_snapshot(&self, room_id: &str) -> AppResult<Option<SnapshotRow>> {
        let snapshot = sqlx::query_as::<_, SnapshotRow>(
            r#"
            SELECT room_id, snapshot_data, updated_at
            FROM room_snapshots
            WHERE room_id = $1
            "#,
        )
        .bind(room_id)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(ref s) = snapshot {
            debug!(
                room_id = %room_id,
                size = s.snapshot_data.len(),
                "Snapshot loaded"
            );
        }

        Ok(snapshot)
    }

    /// スナップショットを保存（UPSERT）
    ///
    /// 既存のスナップショットがあれば上書きする。
    pub async fn save_snapshot(&self, room_id: &str, snapshot_data: &[u8]) -> AppResult<()> {
        sqlx::query(
            r#"
            INSERT INTO room_snapshots (room_id, snapshot_data, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (room_id) DO UPDATE
            SET snapshot_data = $2, updated_at = NOW()
            "#,
        )
        .bind(room_id)
        .bind(snapshot_data)
        .execute(&self.pool)
        .await?;

        debug!(
            room_id = %room_id,
            size = snapshot_data.len(),
            "Snapshot saved"
        );
        Ok(())
    }

    /// トランザクション内でスナップショットを保存
    pub async fn save_snapshot_in_tx(
        tx: &mut Transaction<'_, Postgres>,
        room_id: &str,
        snapshot_data: &[u8],
    ) -> AppResult<()> {
        sqlx::query(
            r#"
            INSERT INTO room_snapshots (room_id, snapshot_data, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (room_id) DO UPDATE
            SET snapshot_data = $2, updated_at = NOW()
            "#,
        )
        .bind(room_id)
        .bind(snapshot_data)
        .execute(&mut **tx)
        .await?;

        Ok(())
    }

    /// スナップショットを削除
    pub async fn delete_snapshot(&self, room_id: &str) -> AppResult<bool> {
        let result = sqlx::query(
            r#"
            DELETE FROM room_snapshots WHERE room_id = $1
            "#,
        )
        .bind(room_id)
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected() > 0)
    }

    // ============================================================
    // ドキュメント状態の読み込み
    // ============================================================

    /// ドキュメント状態を読み込む
    ///
    /// スナップショットと更新ログを個別に返す。
    /// 呼び出し側で逐次適用する必要がある。
    ///
    /// # Returns
    /// - `Ok(None)` - ルームのデータが存在しない
    /// - `Ok(Some((snapshot, updates)))` - スナップショット（存在すれば）と更新ログのリスト
    pub async fn load_document_state(
        &self,
        room_id: &str,
    ) -> AppResult<Option<(Option<Vec<u8>>, Vec<Vec<u8>>)>> {
        // スナップショットを取得
        let snapshot = self.load_latest_snapshot(room_id).await?;

        // 更新ログを取得
        let updates = self.load_updates(room_id).await?;

        if snapshot.is_none() && updates.is_empty() {
            return Ok(None);
        }

        // スナップショットデータ（存在すれば）
        let snapshot_data = snapshot.map(|s| s.snapshot_data);

        // 更新ログを個別の Vec<u8> として返す
        let update_list: Vec<Vec<u8>> = updates.into_iter().map(|u| u.update_data).collect();

        Ok(Some((snapshot_data, update_list)))
    }

    // ============================================================
    // スナップショットコンパクション
    // ============================================================

    /// スナップショットを作成し、更新ログを削除（アトミック）
    ///
    /// トランザクション内で以下を実行：
    /// 1. スナップショットを保存
    /// 2. 更新ログを削除
    ///
    /// # Arguments
    /// * `room_id` - ルームID
    /// * `snapshot_data` - スナップショットバイナリデータ
    ///
    /// # Returns
    /// 削除された更新ログ数
    pub async fn compact_with_snapshot(
        &self,
        room_id: &str,
        snapshot_data: &[u8],
    ) -> AppResult<u64> {
        let mut tx = self.pool.begin().await?;

        // スナップショットを保存
        Self::save_snapshot_in_tx(&mut tx, room_id, snapshot_data).await?;

        // 更新ログを削除
        let deleted = Self::delete_updates_in_tx(&mut tx, room_id).await?;

        tx.commit().await?;

        info!(
            room_id = %room_id,
            snapshot_size = snapshot_data.len(),
            deleted_updates = deleted,
            "Compaction completed"
        );

        Ok(deleted)
    }

    /// スナップショットが必要かチェック
    ///
    /// 更新ログ数が閾値を超えた場合に true を返す。
    pub async fn needs_snapshot(&self, room_id: &str, threshold: i64) -> AppResult<bool> {
        let count = self.get_update_count(room_id).await?;
        Ok(count >= threshold)
    }

    // ============================================================
    // 統計
    // ============================================================

    /// 統計情報を取得
    pub async fn get_stats(&self) -> AppResult<DocumentStats> {
        let update_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM room_updates")
            .fetch_one(&self.pool)
            .await?;

        let snapshot_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM room_snapshots")
            .fetch_one(&self.pool)
            .await?;

        let total_update_size: Option<i64> =
            sqlx::query_scalar("SELECT SUM(LENGTH(update_data)) FROM room_updates")
                .fetch_one(&self.pool)
                .await?;

        let total_snapshot_size: Option<i64> =
            sqlx::query_scalar("SELECT SUM(LENGTH(snapshot_data)) FROM room_snapshots")
                .fetch_one(&self.pool)
                .await?;

        Ok(DocumentStats {
            update_count,
            snapshot_count,
            total_update_size_bytes: total_update_size.unwrap_or(0),
            total_snapshot_size_bytes: total_snapshot_size.unwrap_or(0),
        })
    }

    /// プールへの参照を取得
    pub fn pool(&self) -> &PgPool {
        &self.pool
    }
}

/// ドキュメント統計情報
#[derive(Debug, Clone)]
pub struct DocumentStats {
    /// 更新ログ総数
    pub update_count: i64,
    /// スナップショット総数
    pub snapshot_count: i64,
    /// 更新ログ合計サイズ（バイト）
    pub total_update_size_bytes: i64,
    /// スナップショット合計サイズ（バイト）
    pub total_snapshot_size_bytes: i64,
}

// ============================================================
// zstd 圧縮サポート
// ============================================================

// zstd 圧縮サポートは将来の拡張用に予約
// 注意: zstd クレートが必要。Cargo.toml に追加する場合に有効化。
// #[cfg(feature = "zstd")]
// pub fn compress_snapshot(data: &[u8]) -> Result<Vec<u8>, std::io::Error> {
//     zstd::encode_all(std::io::Cursor::new(data), 3)
// }
//
// #[cfg(feature = "zstd")]
// pub fn decompress_snapshot(data: &[u8]) -> Result<Vec<u8>, std::io::Error> {
//     zstd::decode_all(std::io::Cursor::new(data))
// }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_update_row_debug() {
        let update = UpdateRow {
            id: 1,
            room_id: "test-room".to_string(),
            update_data: vec![1, 2, 3],
            created_at: Utc::now(),
        };
        let debug_str = format!("{:?}", update);
        assert!(debug_str.contains("test-room"));
    }

    #[test]
    fn test_snapshot_row_debug() {
        let snapshot = SnapshotRow {
            room_id: "test-room".to_string(),
            snapshot_data: vec![1, 2, 3, 4, 5],
            updated_at: Utc::now(),
        };
        let debug_str = format!("{:?}", snapshot);
        assert!(debug_str.contains("test-room"));
    }

    #[test]
    fn test_document_stats_debug() {
        let stats = DocumentStats {
            update_count: 100,
            snapshot_count: 5,
            total_update_size_bytes: 1024 * 1024,
            total_snapshot_size_bytes: 512 * 1024,
        };
        assert_eq!(stats.update_count, 100);
        assert_eq!(stats.snapshot_count, 5);
    }
}
