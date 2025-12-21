//! カスタムエラー型定義

use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;
use thiserror::Error;

/// アプリケーションエラー
#[derive(Debug, Error)]
pub enum AppError {
    #[error("Room not found: {0}")]
    RoomNotFound(String),

    #[error("Invalid passphrase")]
    InvalidPassphrase,

    #[error("Passphrase required")]
    PassphraseRequired,

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Redis error: {0}")]
    Redis(String),

    #[error("WebSocket error: {0}")]
    WebSocket(String),

    #[error("Internal error: {0}")]
    Internal(#[from] anyhow::Error),
}

/// エラーレスポンス
///
/// フロントエンドは { code, message } 形式を期待しているため、
/// `error` ではなく `message` フィールドを使用する。
/// 06-rest-api.md のエラーハンドリング設計と統一。
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub message: String,
    pub code: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code, message) = match &self {
            AppError::RoomNotFound(id) => (
                StatusCode::NOT_FOUND,
                "ROOM_NOT_FOUND",
                format!("Room not found: {}", id),
            ),
            AppError::InvalidPassphrase => (
                StatusCode::FORBIDDEN,
                "INVALID_PASSPHRASE",
                "Invalid passphrase".to_string(),
            ),
            AppError::PassphraseRequired => (
                StatusCode::FORBIDDEN,
                "PASSPHRASE_REQUIRED",
                "Passphrase required".to_string(),
            ),
            AppError::Validation(msg) => (StatusCode::BAD_REQUEST, "VALIDATION_ERROR", msg.clone()),
            AppError::Database(e) => {
                tracing::error!("Database error: {:?}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "INTERNAL_ERROR",
                    "Internal server error".to_string(),
                )
            }
            AppError::Redis(e) => {
                tracing::error!("Redis error: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "INTERNAL_ERROR",
                    "Internal server error".to_string(),
                )
            }
            AppError::WebSocket(e) => {
                tracing::error!("WebSocket error: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "INTERNAL_ERROR",
                    "Internal server error".to_string(),
                )
            }
            AppError::Internal(e) => {
                tracing::error!("Internal error: {:?}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "INTERNAL_ERROR",
                    "Internal server error".to_string(),
                )
            }
        };

        let body = Json(ErrorResponse {
            message,
            code: code.to_string(),
            details: None,
        });

        (status, body).into_response()
    }
}

/// Result 型エイリアス
pub type AppResult<T> = Result<T, AppError>;
