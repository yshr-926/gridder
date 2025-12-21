//! REST API 統合テスト
//!
//! API エンドポイントの統合テストを実施する。
//! 注意: このテストはデータベース接続を必要とする。

use axum::{
    body::Body,
    http::{Request, StatusCode},
    Router,
};
use serde_json::{json, Value};
use tower::ServiceExt;

use gridder_backend::auth::{AuthHandlerState, TokenManager};

// =============================================================================
// テストヘルパー
// =============================================================================

/// テスト用の AuthHandlerState を作成
fn create_test_auth_state() -> AuthHandlerState {
    let token_manager = TokenManager::new("test-secret-key-12345".to_string(), 24);
    AuthHandlerState::new(token_manager, 4, 4, 128)
}

/// テスト用のルーターを作成（データベースなし）
fn create_test_router_without_db() -> Router {
    use gridder_backend::auth::auth_router;

    auth_router(create_test_auth_state())
}

// =============================================================================
// 認証 API テスト
// =============================================================================

#[tokio::test]
async fn test_auth_endpoint_success() {
    let app = create_test_router_without_db();

    let request = Request::builder()
        .method("POST")
        .uri("/auth")
        .header("Content-Type", "application/json")
        .body(Body::from(
            json!({
                "roomName": "test-room-123"
            })
            .to_string(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert!(json["token"].as_str().is_some());
    assert!(!json["token"].as_str().unwrap().is_empty());
    assert!(json["expiresAt"].as_i64().is_some());
    assert!(json["clientId"].as_str().is_some());
}

#[tokio::test]
async fn test_auth_endpoint_empty_room_name() {
    let app = create_test_router_without_db();

    let request = Request::builder()
        .method("POST")
        .uri("/auth")
        .header("Content-Type", "application/json")
        .body(Body::from(
            json!({
                "roomName": ""
            })
            .to_string(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["code"], "VALIDATION_ERROR");
}

#[tokio::test]
async fn test_auth_verify_valid_token() {
    let state = create_test_auth_state();
    let token = state
        .token_manager
        .generate_token("verify-test-room")
        .unwrap();

    use gridder_backend::auth::auth_router;
    let app = auth_router(state);

    let request = Request::builder()
        .method("POST")
        .uri("/auth/verify")
        .header("Content-Type", "application/json")
        .body(Body::from(
            json!({
                "token": token
            })
            .to_string(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["valid"], true);
    assert_eq!(json["roomName"], "verify-test-room");
}

#[tokio::test]
async fn test_auth_verify_invalid_token() {
    let app = create_test_router_without_db();

    let request = Request::builder()
        .method("POST")
        .uri("/auth/verify")
        .header("Content-Type", "application/json")
        .body(Body::from(
            json!({
                "token": "invalid.token.here"
            })
            .to_string(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["valid"], false);
    assert!(json["roomName"].is_null());
}

#[tokio::test]
async fn test_auth_refresh_success() {
    let state = create_test_auth_state();
    let token = state
        .token_manager
        .generate_token("refresh-test-room")
        .unwrap();

    use gridder_backend::auth::auth_router;
    let app = auth_router(state);

    let request = Request::builder()
        .method("POST")
        .uri("/auth/refresh")
        .header("Authorization", format!("Bearer {}", token))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert!(json["token"].as_str().is_some());
    assert!(json["expiresAt"].as_i64().is_some());
}

#[tokio::test]
async fn test_auth_refresh_missing_header() {
    let app = create_test_router_without_db();

    let request = Request::builder()
        .method("POST")
        .uri("/auth/refresh")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_auth_refresh_invalid_format() {
    let app = create_test_router_without_db();

    let request = Request::builder()
        .method("POST")
        .uri("/auth/refresh")
        .header("Authorization", "InvalidFormat token123")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

// =============================================================================
// パスフレーズ API テスト（データベースなし）
// =============================================================================

#[tokio::test]
async fn test_set_passphrase_success() {
    let app = create_test_router_without_db();

    let request = Request::builder()
        .method("POST")
        .uri("/rooms/test-room/passphrase")
        .header("Content-Type", "application/json")
        .body(Body::from(
            json!({
                "passphrase": "my-secure-passphrase"
            })
            .to_string(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["success"], true);
    assert_eq!(json["hasPassphrase"], true);
}

#[tokio::test]
async fn test_set_passphrase_too_short() {
    let app = create_test_router_without_db();

    let request = Request::builder()
        .method("POST")
        .uri("/rooms/test-room/passphrase")
        .header("Content-Type", "application/json")
        .body(Body::from(
            json!({
                "passphrase": "ab"
            })
            .to_string(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["code"], "VALIDATION_ERROR");
    assert!(json["message"].as_str().unwrap().contains("at least"));
}

#[tokio::test]
async fn test_set_passphrase_remove() {
    let app = create_test_router_without_db();

    let request = Request::builder()
        .method("POST")
        .uri("/rooms/test-room/passphrase")
        .header("Content-Type", "application/json")
        .body(Body::from(
            json!({
                "passphrase": ""
            })
            .to_string(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["success"], true);
    assert_eq!(json["hasPassphrase"], false);
}

#[tokio::test]
async fn test_set_passphrase_null() {
    let app = create_test_router_without_db();

    let request = Request::builder()
        .method("POST")
        .uri("/rooms/test-room/passphrase")
        .header("Content-Type", "application/json")
        .body(Body::from(
            json!({
                "passphrase": null
            })
            .to_string(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["success"], true);
    assert_eq!(json["hasPassphrase"], false);
}

// =============================================================================
// CORS テスト
// =============================================================================

#[tokio::test]
async fn test_cors_preflight() {
    // CORS プリフライトリクエストのテスト
    // 実際の CORS ヘッダーは create_api_router で設定される
    // このテストはハンドラーレベルでは確認できないため、
    // 統合テストで確認する必要がある
}

// =============================================================================
// エラーレスポンス形式テスト
// =============================================================================

#[tokio::test]
async fn test_error_response_format() {
    let app = create_test_router_without_db();

    let request = Request::builder()
        .method("POST")
        .uri("/auth")
        .header("Content-Type", "application/json")
        .body(Body::from(
            json!({
                "roomName": ""
            })
            .to_string(),
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    // エラーレスポンスの形式を確認
    assert!(json["code"].is_string());
    assert!(json["message"].is_string());
}

// =============================================================================
// ヘルスチェック API テスト（ユニットテスト）
// =============================================================================

#[test]
fn test_health_status_enum() {
    use gridder_backend::api::health::HealthStatus;

    // HealthStatus が正しくシリアライズされることを確認
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

// =============================================================================
// リクエスト/レスポンス型テスト
// =============================================================================

#[test]
fn test_room_info_response_serialization() {
    use gridder_backend::api::rooms::RoomInfoResponse;

    let response = RoomInfoResponse {
        id: "test-room-id".to_string(),
        name: Some("Test Room".to_string()),
        has_passphrase: true,
        participant_count: 5,
        created_at: "2024-01-01T00:00:00Z".to_string(),
        last_accessed_at: "2024-01-01T12:00:00Z".to_string(),
    };

    let json = serde_json::to_string(&response).unwrap();
    assert!(json.contains("\"id\":\"test-room-id\""));
    assert!(json.contains("\"name\":\"Test Room\""));
    assert!(json.contains("\"hasPassphrase\":true"));
    assert!(json.contains("\"participantCount\":5"));
}

#[test]
fn test_room_info_response_without_name() {
    use gridder_backend::api::rooms::RoomInfoResponse;

    let response = RoomInfoResponse {
        id: "test-room-id".to_string(),
        name: None,
        has_passphrase: false,
        participant_count: 0,
        created_at: "2024-01-01T00:00:00Z".to_string(),
        last_accessed_at: "2024-01-01T12:00:00Z".to_string(),
    };

    let json = serde_json::to_string(&response).unwrap();
    // name が None の場合は JSON に含まれない
    assert!(!json.contains("\"name\""));
    assert!(json.contains("\"hasPassphrase\":false"));
}

#[test]
fn test_set_passphrase_request_deserialization() {
    use gridder_backend::api::rooms::SetPassphraseRequest;

    let json = r#"{"passphrase": "test123", "currentPassphrase": "old123"}"#;
    let request: SetPassphraseRequest = serde_json::from_str(json).unwrap();
    assert_eq!(request.passphrase, Some("test123".to_string()));
    assert_eq!(request.current_passphrase, Some("old123".to_string()));
}

#[test]
fn test_verify_passphrase_request() {
    use gridder_backend::api::rooms::VerifyPassphraseRequest;

    let json = r#"{"passphrase": "secret-pass"}"#;
    let request: VerifyPassphraseRequest = serde_json::from_str(json).unwrap();
    assert_eq!(request.passphrase, "secret-pass");
}
