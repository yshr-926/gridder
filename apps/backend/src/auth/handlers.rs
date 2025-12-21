//! REST API 認証ハンドラー
//!
//! 認証関連の HTTP エンドポイントを提供する。

use std::sync::Arc;

use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};
use tracing::{debug, info, warn};

use crate::auth::{verify_passphrase_safe, PassphraseRules, TokenError, TokenManager};
use crate::error::AppError;
use crate::persistence::RoomRepository;

/// 認証ハンドラー状態
#[derive(Clone)]
pub struct AuthHandlerState {
    pub token_manager: Arc<TokenManager>,
    pub bcrypt_rounds: u32,
    pub passphrase_rules: PassphraseRules,
    /// オプショナルなルームリポジトリ（データベース統合用）
    pub room_repo: Option<RoomRepository>,
}

impl AuthHandlerState {
    /// 新しい認証ハンドラー状態を作成
    pub fn new(
        token_manager: TokenManager,
        bcrypt_rounds: u32,
        min_passphrase_length: usize,
        max_passphrase_length: usize,
    ) -> Self {
        Self {
            token_manager: Arc::new(token_manager),
            bcrypt_rounds,
            passphrase_rules: PassphraseRules::new(min_passphrase_length, max_passphrase_length),
            room_repo: None,
        }
    }

    /// ルームリポジトリを設定
    pub fn with_room_repo(mut self, room_repo: RoomRepository) -> Self {
        self.room_repo = Some(room_repo);
        self
    }
}

// =============================================================================
// リクエスト・レスポンス型
// =============================================================================

/// 認証リクエスト
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthRequest {
    /// ルーム名（roomName または room_id を受け付ける）
    #[serde(alias = "room_id")]
    pub room_name: String,
    /// パスフレーズ（任意）
    pub passphrase: Option<String>,
}

/// 認証レスポンス
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthResponse {
    /// JWT トークン
    pub token: String,
    /// 有効期限（Unix タイムスタンプ）
    pub expires_at: i64,
    /// クライアント ID
    pub client_id: String,
}

/// トークン検証リクエスト
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyTokenRequest {
    /// 検証するトークン
    pub token: String,
}

/// トークン検証レスポンス
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyTokenResponse {
    /// トークンが有効かどうか
    pub valid: bool,
    /// ルーム ID（有効な場合）- フロントエンド互換
    #[serde(skip_serializing_if = "Option::is_none")]
    pub room_id: Option<String>,
    /// ルーム名（有効な場合）- レガシー互換、room_id と同じ値
    #[serde(skip_serializing_if = "Option::is_none")]
    pub room_name: Option<String>,
    /// クライアント ID（有効な場合）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_id: Option<String>,
    /// 有効期限（Unix タイムスタンプ、有効な場合）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<i64>,
}

/// パスフレーズ設定リクエスト
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetPassphraseRequest {
    /// 新しいパスフレーズ（空文字列またはnullで解除）
    pub passphrase: Option<String>,
    /// 現在のパスフレーズ（既存のパスフレーズがある場合に必要）
    pub current_passphrase: Option<String>,
}

/// パスフレーズ設定レスポンス
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetPassphraseResponse {
    /// 設定成功フラグ
    pub success: bool,
    /// パスフレーズが設定されているかどうか
    pub has_passphrase: bool,
}

/// トークンリフレッシュレスポンス
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshTokenResponse {
    /// 新しいトークン
    pub token: String,
    /// 有効期限（Unix タイムスタンプ）
    pub expires_at: i64,
}

// =============================================================================
// ハンドラー関数
// =============================================================================

/// POST /api/auth
///
/// ルーム認証を行い、トークンを発行する。
///
/// # Request Body
///
/// ```json
/// {
///     "roomName": "my-room",
///     "passphrase": "optional-passphrase"
/// }
/// ```
///
/// # Response
///
/// ```json
/// {
///     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
///     "expiresAt": 1703980800,
///     "clientId": "550e8400-e29b-41d4-a716-446655440000"
/// }
/// ```
pub async fn authenticate(
    State(state): State<AuthHandlerState>,
    Json(req): Json<AuthRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    debug!("Authentication request for room: {}", req.room_name);

    // ルーム名のバリデーション
    if req.room_name.is_empty() {
        return Err(AppError::Validation("Room name is required".to_string()));
    }

    // ルームリポジトリが設定されている場合はパスフレーズを検証
    if let Some(ref room_repo) = state.room_repo {
        // ルームのパスフレーズハッシュを取得
        let passphrase_hash = room_repo.get_passphrase_hash(&req.room_name).await?;

        // パスフレーズを検証
        verify_passphrase_safe(req.passphrase.as_deref(), passphrase_hash.as_deref()).map_err(
            |e| {
                warn!(
                    room_name = %req.room_name,
                    error = %e,
                    "Authentication failed"
                );
                AppError::InvalidPassphrase
            },
        )?;
    }

    // トークン生成
    let token = state
        .token_manager
        .generate_token(&req.room_name)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Token generation failed: {}", e)))?;

    // トークンからクレームを取得
    let claims = state
        .token_manager
        .verify_token(&token)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Token verification failed: {}", e)))?;

    info!(
        "Authentication successful for room: {}, client: {}",
        req.room_name, claims.client_id
    );

    Ok(Json(AuthResponse {
        token,
        expires_at: claims.exp,
        client_id: claims.client_id,
    }))
}

/// POST /api/auth/verify
///
/// トークンの有効性を検証する。
///
/// # Request Body
///
/// ```json
/// {
///     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
/// }
/// ```
///
/// # Response
///
/// ```json
/// {
///     "valid": true,
///     "roomName": "my-room",
///     "clientId": "550e8400-e29b-41d4-a716-446655440000",
///     "expiresAt": 1703980800
/// }
/// ```
pub async fn verify_token(
    State(state): State<AuthHandlerState>,
    Json(req): Json<VerifyTokenRequest>,
) -> Json<VerifyTokenResponse> {
    debug!("Token verification request");

    match state.token_manager.verify_token(&req.token) {
        Ok(claims) => {
            debug!("Token valid for room: {}", claims.sub);
            Json(VerifyTokenResponse {
                valid: true,
                room_id: Some(claims.sub.clone()),
                room_name: Some(claims.sub),
                client_id: Some(claims.client_id),
                expires_at: Some(claims.exp),
            })
        }
        Err(e) => {
            debug!("Token invalid: {:?}", e);
            Json(VerifyTokenResponse {
                valid: false,
                room_id: None,
                room_name: None,
                client_id: None,
                expires_at: None,
            })
        }
    }
}

/// POST /api/auth/refresh
///
/// 有効なトークンを使用して新しいトークンを発行する。
///
/// # Headers
///
/// - Authorization: Bearer <token>
///
/// # Response
///
/// ```json
/// {
///     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
///     "expiresAt": 1703980800
/// }
/// ```
pub async fn refresh_token(
    State(state): State<AuthHandlerState>,
    headers: axum::http::HeaderMap,
) -> Result<Json<RefreshTokenResponse>, AppError> {
    debug!("Token refresh request");

    // Authorization ヘッダーからトークンを取得
    let auth_header = headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| AppError::Validation("Authorization header required".to_string()))?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or_else(|| AppError::Validation("Invalid Authorization header format".to_string()))?;

    // 現在のトークンを検証
    let claims = state.token_manager.verify_token(token).map_err(|e| {
        warn!("Token refresh failed: {:?}", e);
        match e {
            TokenError::Expired => AppError::Validation("Token expired".to_string()),
            _ => AppError::InvalidPassphrase,
        }
    })?;

    // 新しいトークンを生成
    let new_token = state
        .token_manager
        .generate_token(&claims.sub)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Token generation failed: {}", e)))?;

    let new_claims = state
        .token_manager
        .verify_token(&new_token)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Token verification failed: {}", e)))?;

    info!("Token refreshed for room: {}", claims.sub);

    Ok(Json(RefreshTokenResponse {
        token: new_token,
        expires_at: new_claims.exp,
    }))
}

/// POST /api/rooms/:room_id/passphrase
///
/// ルームのパスフレーズを設定・変更・解除する。
/// 注意: この機能は主に api/rooms.rs で実装されているが、
/// AuthHandlerState を使用する場合のためにここにも残している。
///
/// # Path Parameters
///
/// - room_id: ルーム ID
///
/// # Request Body
///
/// ```json
/// {
///     "passphrase": "new-passphrase",
///     "currentPassphrase": "old-passphrase"
/// }
/// ```
///
/// # Response
///
/// ```json
/// {
///     "success": true,
///     "hasPassphrase": true
/// }
/// ```
pub async fn set_passphrase(
    State(state): State<AuthHandlerState>,
    Path(room_id): Path<String>,
    Json(req): Json<SetPassphraseRequest>,
) -> Result<Json<SetPassphraseResponse>, AppError> {
    debug!("Set passphrase request for room: {}", room_id);

    // 新しいパスフレーズのバリデーション
    if let Some(ref passphrase) = req.passphrase {
        if !passphrase.is_empty() {
            state
                .passphrase_rules
                .validate(passphrase)
                .map_err(AppError::Validation)?;
        }
    }

    // ルームリポジトリが設定されている場合はデータベースで処理
    if let Some(ref room_repo) = state.room_repo {
        // ルームの存在確認
        if !room_repo.room_exists(&room_id).await? {
            return Err(AppError::RoomNotFound(room_id));
        }

        // 既存パスフレーズを取得
        let current_hash = room_repo.get_passphrase_hash(&room_id).await?;

        // 既存パスフレーズがある場合は検証
        if current_hash.is_some() {
            verify_passphrase_safe(req.current_passphrase.as_deref(), current_hash.as_deref())
                .map_err(|_| AppError::InvalidPassphrase)?;
        }

        // 新しいパスフレーズをハッシュ化
        let new_hash = match req.passphrase {
            Some(ref p) if !p.is_empty() => {
                Some(crate::auth::hash_passphrase(p, state.bcrypt_rounds)?)
            }
            _ => None,
        };

        // データベース更新
        room_repo
            .set_passphrase(&room_id, new_hash.as_deref())
            .await?;

        info!(
            "Passphrase {} for room: {}",
            if new_hash.is_some() { "set" } else { "removed" },
            room_id
        );

        return Ok(Json(SetPassphraseResponse {
            success: true,
            has_passphrase: new_hash.is_some(),
        }));
    }

    // ルームリポジトリがない場合（レガシーモード）
    let has_passphrase = req
        .passphrase
        .as_ref()
        .map(|p| !p.is_empty())
        .unwrap_or(false);

    info!(
        "Passphrase {} for room: {} (no database)",
        if has_passphrase { "set" } else { "removed" },
        room_id
    );

    Ok(Json(SetPassphraseResponse {
        success: true,
        has_passphrase,
    }))
}

// =============================================================================
// Router 構築ヘルパー
// =============================================================================

use axum::{routing::post, Router};

/// 認証 API ルーターを構築
///
/// # Routes
///
/// - POST /auth - 認証してトークン取得
/// - POST /auth/verify - トークン検証
/// - POST /auth/refresh - トークンリフレッシュ
/// - POST /rooms/:room_id/passphrase - パスフレーズ設定
pub fn auth_router(state: AuthHandlerState) -> Router {
    Router::new()
        .route("/auth", post(authenticate))
        .route("/auth/verify", post(verify_token))
        .route("/auth/refresh", post(refresh_token))
        .route("/rooms/:room_id/passphrase", post(set_passphrase))
        .with_state(state)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use serde_json::json;
    use tower::ServiceExt;

    fn create_test_state() -> AuthHandlerState {
        let token_manager = TokenManager::new("test-secret".to_string(), 24);
        AuthHandlerState::new(token_manager, 4, 4, 128)
    }

    fn create_test_router() -> Router {
        auth_router(create_test_state())
    }

    #[tokio::test]
    async fn test_authenticate_success() {
        let app = create_test_router();

        let request = Request::builder()
            .method("POST")
            .uri("/auth")
            .header("Content-Type", "application/json")
            .body(Body::from(
                json!({
                    "roomName": "test-room"
                })
                .to_string(),
            ))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let auth_response: AuthResponse = serde_json::from_slice(&body).unwrap();

        assert!(!auth_response.token.is_empty());
        assert!(!auth_response.client_id.is_empty());
        assert!(auth_response.expires_at > 0);
    }

    #[tokio::test]
    async fn test_authenticate_empty_room_name() {
        let app = create_test_router();

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
    }

    #[tokio::test]
    async fn test_verify_token_valid() {
        let state = create_test_state();
        let token = state.token_manager.generate_token("test-room").unwrap();
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
        let verify_response: VerifyTokenResponse = serde_json::from_slice(&body).unwrap();

        assert!(verify_response.valid);
        assert_eq!(verify_response.room_id, Some("test-room".to_string()));
        assert_eq!(verify_response.room_name, Some("test-room".to_string()));
    }

    #[tokio::test]
    async fn test_verify_token_invalid() {
        let app = create_test_router();

        let request = Request::builder()
            .method("POST")
            .uri("/auth/verify")
            .header("Content-Type", "application/json")
            .body(Body::from(
                json!({
                    "token": "invalid-token"
                })
                .to_string(),
            ))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let verify_response: VerifyTokenResponse = serde_json::from_slice(&body).unwrap();

        assert!(!verify_response.valid);
        assert!(verify_response.room_id.is_none());
        assert!(verify_response.room_name.is_none());
    }

    #[tokio::test]
    async fn test_refresh_token_success() {
        let state = create_test_state();
        let token = state.token_manager.generate_token("test-room").unwrap();
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
        let refresh_response: RefreshTokenResponse = serde_json::from_slice(&body).unwrap();

        assert!(!refresh_response.token.is_empty());
        assert!(refresh_response.expires_at > 0);
    }

    #[tokio::test]
    async fn test_refresh_token_missing_header() {
        let app = create_test_router();

        let request = Request::builder()
            .method("POST")
            .uri("/auth/refresh")
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_set_passphrase_success() {
        let app = create_test_router();

        let request = Request::builder()
            .method("POST")
            .uri("/rooms/test-room/passphrase")
            .header("Content-Type", "application/json")
            .body(Body::from(
                json!({
                    "passphrase": "new-passphrase"
                })
                .to_string(),
            ))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let set_response: SetPassphraseResponse = serde_json::from_slice(&body).unwrap();

        assert!(set_response.success);
        assert!(set_response.has_passphrase);
    }

    #[tokio::test]
    async fn test_set_passphrase_too_short() {
        let app = create_test_router();

        let request = Request::builder()
            .method("POST")
            .uri("/rooms/test-room/passphrase")
            .header("Content-Type", "application/json")
            .body(Body::from(
                json!({
                    "passphrase": "ab"  // 最小長（4）未満
                })
                .to_string(),
            ))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_set_passphrase_remove() {
        let app = create_test_router();

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
        let set_response: SetPassphraseResponse = serde_json::from_slice(&body).unwrap();

        assert!(set_response.success);
        assert!(!set_response.has_passphrase);
    }

    #[tokio::test]
    async fn test_set_passphrase_null() {
        let app = create_test_router();

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
        let set_response: SetPassphraseResponse = serde_json::from_slice(&body).unwrap();

        assert!(set_response.success);
        assert!(!set_response.has_passphrase);
    }
}
