//! Room リポジトリ
//!
//! ルームのCRUD操作とパスフレーズ管理を提供する。

use chrono::{DateTime, Utc};
use sqlx::{FromRow, PgPool, Row, postgres::PgRow};
use tracing::{debug, info};

use crate::error::{AppError, AppResult};

/// ルーム情報
#[derive(Debug, Clone)]
pub struct RoomRow {
    /// ルームID
    pub id: String,
    /// ルーム名
    pub name: Option<String>,
    /// パスフレーズハッシュ（bcrypt）
    pub passphrase_hash: Option<String>,
    /// 作成日時
    pub created_at: DateTime<Utc>,
    /// 最終アクセス日時
    pub last_accessed_at: DateTime<Utc>,
    /// 有効期限
    pub expires_at: Option<DateTime<Utc>>,
}

impl<'r> FromRow<'r, PgRow> for RoomRow {
    fn from_row(row: &'r PgRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            name: row.try_get("name")?,
            passphrase_hash: row.try_get("passphrase_hash")?,
            created_at: row.try_get("created_at")?,
            last_accessed_at: row.try_get("last_accessed_at")?,
            expires_at: row.try_get("expires_at")?,
        })
    }
}

/// Room リポジトリ
#[derive(Clone)]
pub struct RoomRepository {
    pool: PgPool,
}

impl RoomRepository {
    /// 新しいリポジトリを作成
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    // ============================================================
    // ルーム操作
    // ============================================================

    /// ルームを作成（存在しない場合のみ）
    ///
    /// ON CONFLICT DO NOTHING を使用し、既存ルームがあれば何もしない。
    pub async fn create_room_if_not_exists(&self, room_id: &str) -> AppResult<()> {
        sqlx::query(
            r#"
            INSERT INTO rooms (id, created_at, last_accessed_at)
            VALUES ($1, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
            "#,
        )
        .bind(room_id)
        .execute(&self.pool)
        .await?;

        debug!(room_id = %room_id, "Room created or already exists");
        Ok(())
    }

    /// 名前付きでルームを作成
    pub async fn create_room_with_name(
        &self,
        room_id: &str,
        name: Option<&str>,
    ) -> AppResult<RoomRow> {
        let row = sqlx::query_as::<_, RoomRow>(
            r#"
            INSERT INTO rooms (id, name, created_at, last_accessed_at)
            VALUES ($1, $2, NOW(), NOW())
            RETURNING id, name, passphrase_hash, created_at, last_accessed_at, expires_at
            "#,
        )
        .bind(room_id)
        .bind(name)
        .fetch_one(&self.pool)
        .await?;

        info!(room_id = %room_id, name = ?name, "Room created");
        Ok(row)
    }

    /// ルーム情報を取得
    pub async fn get_room(&self, room_id: &str) -> AppResult<Option<RoomRow>> {
        let room = sqlx::query_as::<_, RoomRow>(
            r#"
            SELECT id, name, passphrase_hash, created_at, last_accessed_at, expires_at
            FROM rooms
            WHERE id = $1
            "#,
        )
        .bind(room_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(room)
    }

    /// ルームの存在確認
    pub async fn room_exists(&self, room_id: &str) -> AppResult<bool> {
        let exists: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS(SELECT 1 FROM rooms WHERE id = $1)
            "#,
        )
        .bind(room_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(exists)
    }

    /// 最終アクセス日時を更新
    pub async fn update_last_accessed(&self, room_id: &str) -> AppResult<()> {
        let result = sqlx::query(
            r#"
            UPDATE rooms
            SET last_accessed_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(room_id)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::RoomNotFound(room_id.to_string()));
        }

        debug!(room_id = %room_id, "Last accessed updated");
        Ok(())
    }

    // ============================================================
    // パスフレーズ操作
    // ============================================================

    /// パスフレーズハッシュを取得
    pub async fn get_passphrase_hash(&self, room_id: &str) -> AppResult<Option<String>> {
        let hash: Option<String> = sqlx::query_scalar(
            r#"
            SELECT passphrase_hash
            FROM rooms
            WHERE id = $1
            "#,
        )
        .bind(room_id)
        .fetch_optional(&self.pool)
        .await?
        .flatten();

        Ok(hash)
    }

    /// パスフレーズを設定
    ///
    /// # Arguments
    /// * `room_id` - ルームID
    /// * `passphrase_hash` - bcrypt ハッシュ（None で削除）
    pub async fn set_passphrase(
        &self,
        room_id: &str,
        passphrase_hash: Option<&str>,
    ) -> AppResult<()> {
        let result = sqlx::query(
            r#"
            UPDATE rooms
            SET passphrase_hash = $1
            WHERE id = $2
            "#,
        )
        .bind(passphrase_hash)
        .bind(room_id)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::RoomNotFound(room_id.to_string()));
        }

        debug!(
            room_id = %room_id,
            has_passphrase = passphrase_hash.is_some(),
            "Passphrase updated"
        );
        Ok(())
    }

    /// ルームにパスフレーズが設定されているか確認
    pub async fn has_passphrase(&self, room_id: &str) -> AppResult<bool> {
        let has: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM rooms
                WHERE id = $1 AND passphrase_hash IS NOT NULL
            )
            "#,
        )
        .bind(room_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(has)
    }

    // ============================================================
    // クリーンアップ
    // ============================================================

    /// 期限切れルームを削除
    ///
    /// # Arguments
    /// * `expiry_days` - 最終アクセスからの日数
    ///
    /// # Returns
    /// 削除されたルーム数
    pub async fn cleanup_expired_rooms(&self, expiry_days: i64) -> AppResult<u64> {
        let result = sqlx::query(
            r#"
            DELETE FROM rooms
            WHERE last_accessed_at < NOW() - INTERVAL '1 day' * $1
            "#,
        )
        .bind(expiry_days)
        .execute(&self.pool)
        .await?;

        let count = result.rows_affected();
        if count > 0 {
            info!(
                count = count,
                expiry_days = expiry_days,
                "Expired rooms deleted"
            );
        }

        Ok(count)
    }

    /// 明示的な期限が過ぎたルームを削除
    pub async fn cleanup_explicitly_expired_rooms(&self) -> AppResult<u64> {
        let result = sqlx::query(
            r#"
            DELETE FROM rooms
            WHERE expires_at IS NOT NULL AND expires_at < NOW()
            "#,
        )
        .execute(&self.pool)
        .await?;

        let count = result.rows_affected();
        if count > 0 {
            info!(count = count, "Explicitly expired rooms deleted");
        }

        Ok(count)
    }

    /// ルームを削除
    pub async fn delete_room(&self, room_id: &str) -> AppResult<bool> {
        let result = sqlx::query(
            r#"
            DELETE FROM rooms WHERE id = $1
            "#,
        )
        .bind(room_id)
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected() > 0)
    }

    // ============================================================
    // 統計
    // ============================================================

    /// ルーム数を取得
    pub async fn count_rooms(&self) -> AppResult<i64> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM rooms")
            .fetch_one(&self.pool)
            .await?;

        Ok(count)
    }

    /// プールへの参照を取得（トランザクション用）
    pub fn pool(&self) -> &PgPool {
        &self.pool
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // 接続プール作成ヘルパー
    #[allow(dead_code)]
    async fn create_test_pool() -> PgPool {
        let url = std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| {
            "postgresql://postgres:password@localhost:5432/gridder_test".to_string()
        });

        sqlx::postgres::PgPoolOptions::new()
            .max_connections(5)
            .connect(&url)
            .await
            .expect("Failed to create test pool")
    }

    #[test]
    fn test_room_row_debug() {
        // RoomRow が Debug を実装していることを確認
        let room = RoomRow {
            id: "test".to_string(),
            name: Some("Test Room".to_string()),
            passphrase_hash: None,
            created_at: Utc::now(),
            last_accessed_at: Utc::now(),
            expires_at: None,
        };
        let debug_str = format!("{:?}", room);
        assert!(debug_str.contains("test"));
    }
}
