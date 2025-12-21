//! ヘルスチェック API
//!
//! サーバーの稼働状態を確認するためのエンドポイント。
//!
//! # エンドポイント
//!
//! - `GET /health` - システム全体のヘルスチェック
//! - `GET /health/live` - Kubernetes Liveness Probe
//! - `GET /health/ready` - Kubernetes Readiness Probe

use axum::{Router, extract::State, http::StatusCode, response::Json, routing::get};
use serde::Serialize;
use tracing::error;

use crate::api::router::ApiState;
use crate::persistence::health_check as db_health_check;

/// ヘルスチェックレスポンス
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthResponse {
    /// システムステータス
    pub status: HealthStatus,
    /// タイムスタンプ
    pub timestamp: String,
    /// バージョン
    pub version: String,
    /// コンポーネント別ヘルス
    #[serde(skip_serializing_if = "Option::is_none")]
    pub components: Option<ComponentHealth>,
}

/// システムステータス
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum HealthStatus {
    Ok,
    Degraded,
    Error,
}

/// コンポーネント別ヘルス
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComponentHealth {
    /// データベース
    pub database: HealthStatus,
    /// Redis（オプショナル）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub redis: Option<HealthStatus>,
}

/// ヘルスチェックルーターを構築
pub fn router(state: ApiState) -> Router {
    Router::new()
        .route("/health", get(health_check))
        .route("/health/live", get(liveness))
        .route("/health/ready", get(readiness))
        .with_state(state)
}

/// GET /api/health
///
/// システム全体のヘルスチェック
pub async fn health_check(State(state): State<ApiState>) -> Json<HealthResponse> {
    let timestamp = chrono::Utc::now().to_rfc3339();
    let version = env!("CARGO_PKG_VERSION").to_string();

    // データベースチェック
    let db_status = match db_health_check(state.room_repo.pool()).await {
        Ok(_) => HealthStatus::Ok,
        Err(e) => {
            error!(error = %e, "Database health check failed");
            HealthStatus::Error
        }
    };

    // 全体ステータスを決定
    let status = db_status;

    Json(HealthResponse {
        status,
        timestamp,
        version,
        components: Some(ComponentHealth {
            database: db_status,
            redis: None, // Redis は Optional なので None
        }),
    })
}

/// GET /api/health/live
///
/// Kubernetes Liveness Probe 用
/// プロセスが生きているかの確認
pub async fn liveness() -> StatusCode {
    StatusCode::OK
}

/// GET /api/health/ready
///
/// Kubernetes Readiness Probe 用
/// リクエストを受け付ける準備ができているかの確認
pub async fn readiness(State(state): State<ApiState>) -> StatusCode {
    // データベース接続を確認
    match db_health_check(state.room_repo.pool()).await {
        Ok(_) => StatusCode::OK,
        Err(_) => StatusCode::SERVICE_UNAVAILABLE,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_status_serialization() {
        let status = HealthStatus::Ok;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"ok\"");

        let status = HealthStatus::Degraded;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"degraded\"");

        let status = HealthStatus::Error;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"error\"");
    }

    #[test]
    fn test_health_response_serialization() {
        let response = HealthResponse {
            status: HealthStatus::Ok,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            version: "0.1.0".to_string(),
            components: Some(ComponentHealth {
                database: HealthStatus::Ok,
                redis: None,
            }),
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"status\":\"ok\""));
        assert!(json.contains("\"version\":\"0.1.0\""));
        assert!(json.contains("\"database\":\"ok\""));
        // redis が None の場合はスキップされる
        assert!(!json.contains("\"redis\""));
    }

    #[test]
    fn test_liveness_returns_ok() {
        // liveness は常に OK を返すべき
        // 非同期テストは統合テストで実施
    }
}
