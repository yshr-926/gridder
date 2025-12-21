//! ルーム管理 API
//!
//! ルームの情報取得、パスフレーズ管理などの REST API エンドポイントを提供する。
//!
//! # エンドポイント
//!
//! - `GET /rooms/:room_id` - ルーム情報取得
//! - `GET /rooms/:room_id/has-passphrase` - パスフレーズ有無確認
//! - `POST /rooms/:room_id/passphrase/verify` - パスフレーズ検証
//!
//! Note: `POST /rooms/:room_id/passphrase` は auth_router で定義

use axum::{
    Json, Router,
    extract::{Path, State},
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use tracing::debug;

use crate::{
    api::router::ApiState,
    auth::verify_passphrase_safe,
    error::{AppError, AppResult},
};

// =============================================================================
// リクエスト・レスポンス型
// =============================================================================

/// ルーム情報レスポンス
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoomInfoResponse {
    /// ルーム ID
    pub id: String,
    /// ルーム名（オプション）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// パスフレーズが設定されているか
    pub has_passphrase: bool,
    /// 参加者数
    pub participant_count: usize,
    /// 作成日時
    pub created_at: String,
    /// 最終アクセス日時
    pub last_accessed_at: String,
}

/// パスフレーズ有無レスポンス
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HasPassphraseResponse {
    /// パスフレーズが設定されているか
    pub has_passphrase: bool,
}

/// パスフレーズ設定リクエスト
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetPassphraseRequest {
    /// 新しいパスフレーズ（null/空で解除）
    pub passphrase: Option<String>,
    /// 現在のパスフレーズ（設定済みの場合必須）
    pub current_passphrase: Option<String>,
}

/// パスフレーズ設定レスポンス
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetPassphraseResponse {
    /// 設定成功
    pub success: bool,
    /// パスフレーズが設定されているか
    pub has_passphrase: bool,
}

/// パスフレーズ検証リクエスト
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyPassphraseRequest {
    /// 検証するパスフレーズ
    pub passphrase: String,
}

/// パスフレーズ検証レスポンス
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyPassphraseResponse {
    /// パスフレーズが正しいか
    pub valid: bool,
}

// =============================================================================
// ルーター
// =============================================================================

/// ルーム API ルーターを構築
///
/// パスフレーズ設定 (POST /rooms/:room_id/passphrase) は認証ルーター (auth_router) で定義
pub fn router(state: ApiState) -> Router {
    Router::new()
        .route("/rooms/:room_id", get(get_room_info))
        .route("/rooms/:room_id/has-passphrase", get(has_passphrase))
        .route("/rooms/:room_id/passphrase/verify", post(verify_passphrase))
        .with_state(state)
}

// =============================================================================
// ハンドラー
// =============================================================================

/// GET /api/rooms/:room_id
///
/// ルーム情報を取得
pub async fn get_room_info(
    State(state): State<ApiState>,
    Path(room_id): Path<String>,
) -> AppResult<Json<RoomInfoResponse>> {
    debug!(room_id = %room_id, "Getting room info");

    // ルーム情報を取得
    let room = state
        .room_repo
        .get_room(&room_id)
        .await?
        .ok_or_else(|| AppError::RoomNotFound(room_id.clone()))?;

    // 参加者数を取得（ルームがロードされている場合）
    let participant_count = match state.room_manager.get_room(&room_id).await {
        Some(room) => room.client_count().await,
        None => 0,
    };

    Ok(Json(RoomInfoResponse {
        id: room.id,
        name: room.name,
        has_passphrase: room.passphrase_hash.is_some(),
        participant_count,
        created_at: room.created_at.to_rfc3339(),
        last_accessed_at: room.last_accessed_at.to_rfc3339(),
    }))
}

/// GET /api/rooms/:room_id/has-passphrase
///
/// パスフレーズが設定されているか確認
pub async fn has_passphrase(
    State(state): State<ApiState>,
    Path(room_id): Path<String>,
) -> AppResult<Json<HasPassphraseResponse>> {
    debug!(room_id = %room_id, "Checking passphrase status");

    // ルームの存在確認
    if !state.room_repo.room_exists(&room_id).await? {
        return Err(AppError::RoomNotFound(room_id));
    }

    // パスフレーズの有無を確認
    let has = state.room_repo.has_passphrase(&room_id).await?;

    Ok(Json(HasPassphraseResponse {
        has_passphrase: has,
    }))
}

// Note: POST /api/rooms/:room_id/passphrase (set_passphrase) は
// auth_router (auth/handlers.rs) で定義されています。

/// POST /api/rooms/:room_id/passphrase/verify
///
/// パスフレーズを検証（WebSocket 接続前の事前チェック用）
///
/// # リクエスト
///
/// ```json
/// {
///   "passphrase": "room-password"
/// }
/// ```
///
/// # レスポンス
///
/// ```json
/// {
///   "valid": true
/// }
/// ```
///
/// # エラー
///
/// - 404: ルームが存在しない
/// - 400: パスフレーズが空
pub async fn verify_passphrase(
    State(state): State<ApiState>,
    Path(room_id): Path<String>,
    Json(body): Json<VerifyPassphraseRequest>,
) -> AppResult<Json<VerifyPassphraseResponse>> {
    debug!(room_id = %room_id, "Verifying passphrase");

    // ルームの存在確認
    if !state.room_repo.room_exists(&room_id).await? {
        return Err(AppError::RoomNotFound(room_id));
    }

    // パスフレーズが空でないことを確認
    if body.passphrase.is_empty() {
        return Err(AppError::Validation(
            "Passphrase cannot be empty".to_string(),
        ));
    }

    // ルームのパスフレーズハッシュを取得
    let passphrase_hash = state.room_repo.get_passphrase_hash(&room_id).await?;

    // パスフレーズを検証
    let valid = match passphrase_hash {
        Some(hash) => verify_passphrase_safe(Some(&body.passphrase), Some(&hash)).is_ok(),
        None => {
            // パスフレーズが設定されていない場合は常に valid
            true
        }
    };

    Ok(Json(VerifyPassphraseResponse { valid }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_room_info_response_serialization() {
        let response = RoomInfoResponse {
            id: "test-room".to_string(),
            name: Some("Test Room".to_string()),
            has_passphrase: true,
            participant_count: 5,
            created_at: "2024-01-01T00:00:00Z".to_string(),
            last_accessed_at: "2024-01-01T12:00:00Z".to_string(),
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"id\":\"test-room\""));
        assert!(json.contains("\"name\":\"Test Room\""));
        assert!(json.contains("\"hasPassphrase\":true"));
        assert!(json.contains("\"participantCount\":5"));
    }

    #[test]
    fn test_room_info_response_without_name() {
        let response = RoomInfoResponse {
            id: "test-room".to_string(),
            name: None,
            has_passphrase: false,
            participant_count: 0,
            created_at: "2024-01-01T00:00:00Z".to_string(),
            last_accessed_at: "2024-01-01T12:00:00Z".to_string(),
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"id\":\"test-room\""));
        // name が None の場合はスキップされる
        assert!(!json.contains("\"name\""));
        assert!(json.contains("\"hasPassphrase\":false"));
    }

    #[test]
    fn test_set_passphrase_request_deserialization() {
        let json = r#"{"passphrase": "test123", "currentPassphrase": "old123"}"#;
        let request: SetPassphraseRequest = serde_json::from_str(json).unwrap();
        assert_eq!(request.passphrase, Some("test123".to_string()));
        assert_eq!(request.current_passphrase, Some("old123".to_string()));
    }

    #[test]
    fn test_set_passphrase_request_without_current() {
        let json = r#"{"passphrase": "test123"}"#;
        let request: SetPassphraseRequest = serde_json::from_str(json).unwrap();
        assert_eq!(request.passphrase, Some("test123".to_string()));
        assert!(request.current_passphrase.is_none());
    }

    #[test]
    fn test_set_passphrase_response_serialization() {
        let response = SetPassphraseResponse {
            success: true,
            has_passphrase: true,
        };
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"success\":true"));
        assert!(json.contains("\"hasPassphrase\":true"));
    }

    #[test]
    fn test_verify_passphrase_request_deserialization() {
        let json = r#"{"passphrase": "test123"}"#;
        let request: VerifyPassphraseRequest = serde_json::from_str(json).unwrap();
        assert_eq!(request.passphrase, "test123");
    }

    #[test]
    fn test_verify_passphrase_response_serialization() {
        let response = VerifyPassphraseResponse { valid: true };
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"valid\":true"));
    }
}
