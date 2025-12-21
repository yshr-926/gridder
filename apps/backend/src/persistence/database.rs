//! データベース接続管理
//!
//! SQLx による PostgreSQL 接続プールの初期化とヘルスチェックを提供する。

use std::time::Duration;

use sqlx::{
    postgres::{PgPool, PgPoolOptions},
    Error as SqlxError,
};
use tracing::{debug, info, warn};

use crate::error::{AppError, AppResult};

/// データベース接続プールを作成
///
/// # Arguments
/// * `database_url` - PostgreSQL 接続 URL
/// * `max_connections` - 最大接続数
///
/// # Returns
/// 接続プール
pub async fn create_pool(database_url: &str, max_connections: u32) -> Result<PgPool, SqlxError> {
    info!(
        max_connections = max_connections,
        "Initializing database connection pool"
    );

    let pool = PgPoolOptions::new()
        // 最大接続数
        .max_connections(max_connections)
        // アイドル接続のタイムアウト（10分）
        .idle_timeout(Duration::from_secs(600))
        // 接続取得のタイムアウト（5秒）
        .acquire_timeout(Duration::from_secs(5))
        // 接続の最大寿命（1時間）
        .max_lifetime(Duration::from_secs(3600))
        // 最小接続数
        .min_connections(1)
        .connect(database_url)
        .await?;

    info!("Database connection pool initialized successfully");

    Ok(pool)
}

/// マイグレーションを実行
///
/// `migrations/` ディレクトリのマイグレーションファイルを適用する。
pub async fn run_migrations(pool: &PgPool) -> AppResult<()> {
    info!("Running database migrations");

    sqlx::migrate!("./migrations")
        .run(pool)
        .await
        .map_err(|e| {
            warn!(error = %e, "Failed to run migrations");
            AppError::Internal(anyhow::anyhow!("Migration failed: {}", e))
        })?;

    info!("Database migrations completed successfully");

    Ok(())
}

/// データベース接続のヘルスチェック
///
/// シンプルなクエリを実行して接続状態を確認する。
pub async fn health_check(pool: &PgPool) -> AppResult<()> {
    sqlx::query("SELECT 1")
        .execute(pool)
        .await
        .map_err(|e| {
            warn!(error = %e, "Database health check failed");
            AppError::Database(e)
        })?;

    debug!("Database health check passed");
    Ok(())
}

/// データベース接続状態を詳細に確認
pub async fn detailed_health_check(pool: &PgPool) -> AppResult<DatabaseHealth> {
    let start = std::time::Instant::now();

    // 接続テスト
    let connected = sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(pool)
        .await
        .is_ok();

    let latency_ms = start.elapsed().as_millis() as u64;

    // プール統計
    let pool_size = pool.size();
    let idle_connections = pool.num_idle() as u32;

    Ok(DatabaseHealth {
        connected,
        latency_ms,
        pool_size,
        idle_connections,
    })
}

/// データベースヘルス情報
#[derive(Debug, Clone)]
pub struct DatabaseHealth {
    /// 接続可能かどうか
    pub connected: bool,
    /// レイテンシ（ミリ秒）
    pub latency_ms: u64,
    /// プールサイズ
    pub pool_size: u32,
    /// アイドル接続数
    pub idle_connections: u32,
}

impl DatabaseHealth {
    /// 健全かどうか
    pub fn is_healthy(&self) -> bool {
        self.connected && self.latency_ms < 1000
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_database_health_is_healthy() {
        let health = DatabaseHealth {
            connected: true,
            latency_ms: 50,
            pool_size: 10,
            idle_connections: 5,
        };
        assert!(health.is_healthy());

        let unhealthy = DatabaseHealth {
            connected: false,
            latency_ms: 50,
            pool_size: 10,
            idle_connections: 5,
        };
        assert!(!unhealthy.is_healthy());

        let slow = DatabaseHealth {
            connected: true,
            latency_ms: 2000,
            pool_size: 10,
            idle_connections: 5,
        };
        assert!(!slow.is_healthy());
    }
}
