//! アプリケーション設定
//!
//! 環境変数から設定を読み込む。

use anyhow::{Context, Result};
use serde::Deserialize;

/// アプリケーション設定
#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub redis: Option<RedisConfig>,
    pub auth: AuthConfig,
    pub cleanup: CleanupConfig,
    pub cors: CorsConfig,
}

/// CORS 設定
#[derive(Debug, Clone, Deserialize)]
pub struct CorsConfig {
    /// 許可するオリジンのリスト
    pub allowed_origins: Vec<String>,
}

/// サーバー設定
#[derive(Debug, Clone, Deserialize)]
pub struct ServerConfig {
    /// サーバーポート（WebSocket と REST API を同じポートで提供）
    pub port: u16,
}

/// データベース設定
#[derive(Debug, Clone, Deserialize)]
pub struct DatabaseConfig {
    /// PostgreSQL 接続 URL
    pub url: String,
    /// 最大接続数
    pub max_connections: u32,
}

/// Redis 設定
#[derive(Debug, Clone, Deserialize)]
pub struct RedisConfig {
    /// Redis ホスト
    pub host: String,
    /// Redis ポート
    pub port: u16,
    /// Redis パスワード
    pub password: Option<String>,
}

/// 認証設定
#[derive(Debug, Clone, Deserialize)]
pub struct AuthConfig {
    /// bcrypt ハッシュラウンド数
    pub bcrypt_rounds: u32,
    /// パスフレーズ最小長
    pub min_passphrase_length: usize,
    /// パスフレーズ最大長
    pub max_passphrase_length: usize,
    /// JWT シークレット
    pub jwt_secret: String,
    /// JWT トークン有効期限（時間）
    pub jwt_expiry_hours: i64,
}

/// クリーンアップ設定
#[derive(Debug, Clone, Deserialize)]
pub struct CleanupConfig {
    /// ルーム有効期限（日数）
    pub room_expiry_days: i64,
    /// クリーンアップ間隔（時間）
    pub cleanup_interval_hours: u64,
    /// スナップショット閾値（更新数）
    pub snapshot_threshold: i64,
}

impl Config {
    /// 環境変数から設定を読み込む
    pub fn from_env() -> Result<Self> {
        let config = Config {
            server: ServerConfig {
                port: std::env::var("PORT")
                    .unwrap_or_else(|_| "3001".to_string())
                    .parse()
                    .context("Invalid PORT")?,
            },
            database: DatabaseConfig {
                url: std::env::var("DATABASE_URL").unwrap_or_else(|_| {
                    if std::env::var("PRODUCTION").is_ok() || std::env::var("NODE_ENV").map(|v| v == "production").unwrap_or(false) {
                        panic!("DATABASE_URL environment variable is required in production");
                    }
                    "postgresql://postgres:password@localhost:5432/gridder".to_string()
                }),
                max_connections: std::env::var("DATABASE_MAX_CONNECTIONS")
                    .unwrap_or_else(|_| "20".to_string())
                    .parse()
                    .context("Invalid DATABASE_MAX_CONNECTIONS")?,
            },
            redis: Self::parse_redis_config(),
            auth: AuthConfig {
                bcrypt_rounds: std::env::var("BCRYPT_ROUNDS")
                    .unwrap_or_else(|_| "10".to_string())
                    .parse()
                    .context("Invalid BCRYPT_ROUNDS")?,
                min_passphrase_length: std::env::var("MIN_PASSPHRASE_LENGTH")
                    .unwrap_or_else(|_| "4".to_string())
                    .parse()
                    .context("Invalid MIN_PASSPHRASE_LENGTH")?,
                max_passphrase_length: std::env::var("MAX_PASSPHRASE_LENGTH")
                    .unwrap_or_else(|_| "128".to_string())
                    .parse()
                    .context("Invalid MAX_PASSPHRASE_LENGTH")?,
                jwt_secret: std::env::var("JWT_SECRET").unwrap_or_else(|_| {
                    if std::env::var("PRODUCTION").is_ok() || std::env::var("NODE_ENV").map(|v| v == "production").unwrap_or(false) {
                        panic!("JWT_SECRET environment variable is required in production");
                    }
                    "gridder-dev-secret-change-in-production".to_string()
                }),
                jwt_expiry_hours: std::env::var("JWT_EXPIRY_HOURS")
                    .unwrap_or_else(|_| "24".to_string())
                    .parse()
                    .context("Invalid JWT_EXPIRY_HOURS")?,
            },
            cleanup: CleanupConfig {
                room_expiry_days: std::env::var("ROOM_EXPIRY_DAYS")
                    .unwrap_or_else(|_| "7".to_string())
                    .parse()
                    .context("Invalid ROOM_EXPIRY_DAYS")?,
                cleanup_interval_hours: std::env::var("CLEANUP_INTERVAL_HOURS")
                    .unwrap_or_else(|_| "24".to_string())
                    .parse()
                    .context("Invalid CLEANUP_INTERVAL_HOURS")?,
                snapshot_threshold: std::env::var("SNAPSHOT_THRESHOLD")
                    .unwrap_or_else(|_| "100".to_string())
                    .parse()
                    .context("Invalid SNAPSHOT_THRESHOLD")?,
            },
            cors: CorsConfig {
                allowed_origins: std::env::var("CORS_ALLOWED_ORIGINS")
                    .map(|s| s.split(',').map(|o| o.trim().to_string()).collect())
                    .unwrap_or_else(|_| {
                        if std::env::var("PRODUCTION").is_ok() || std::env::var("NODE_ENV").map(|v| v == "production").unwrap_or(false) {
                            panic!("CORS_ALLOWED_ORIGINS environment variable is required in production");
                        }
                        vec!["http://localhost:5173".to_string(), "http://localhost:3000".to_string()]
                    }),
            },
        };

        Ok(config)
    }

    fn parse_redis_config() -> Option<RedisConfig> {
        let host = std::env::var("REDIS_HOST").ok()?;
        Some(RedisConfig {
            host,
            port: std::env::var("REDIS_PORT")
                .unwrap_or_else(|_| "6379".to_string())
                .parse()
                .ok()?,
            password: std::env::var("REDIS_PASSWORD").ok(),
        })
    }
}

impl Default for Config {
    fn default() -> Self {
        Self::from_env().expect("Failed to load config")
    }
}
