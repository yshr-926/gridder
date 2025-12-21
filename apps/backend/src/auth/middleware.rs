//! Axum 認証ミドルウェア
//!
//! JWT トークンによる認証ミドルウェアを提供する。

use std::sync::Arc;

use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use tracing::{debug, warn};

use crate::auth::token::{Claims, TokenManager};

/// 認証レイヤー状態
#[derive(Clone)]
pub struct AuthLayer {
    pub token_manager: Arc<TokenManager>,
}

impl AuthLayer {
    /// 新しい認証レイヤーを作成
    pub fn new(token_manager: TokenManager) -> Self {
        Self {
            token_manager: Arc::new(token_manager),
        }
    }
}

/// Bearer トークンを Authorization ヘッダーから抽出
fn extract_bearer_token(auth_header: &str) -> Option<&str> {
    auth_header.strip_prefix("Bearer ")
}

/// 認証ミドルウェア
///
/// Authorization ヘッダーから Bearer トークンを抽出し、検証する。
/// 検証成功時は、Claims をリクエストの extensions に追加する。
///
/// # Usage
///
/// ```ignore
/// use axum::{Router, routing::get, middleware};
/// use gridder_backend::auth::middleware::{auth_middleware, AuthLayer};
///
/// let auth_layer = AuthLayer::new(token_manager);
///
/// let protected_router = Router::new()
///     .route("/protected", get(handler))
///     .layer(middleware::from_fn_with_state(
///         auth_layer,
///         auth_middleware,
///     ));
/// ```
pub async fn auth_middleware(
    State(auth_layer): State<AuthLayer>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    debug!("Processing authentication middleware");

    // Authorization ヘッダーを取得
    let auth_header = req
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| {
            warn!("Missing Authorization header");
            StatusCode::UNAUTHORIZED
        })?;

    // Bearer トークンを抽出
    let token = extract_bearer_token(auth_header).ok_or_else(|| {
        warn!("Invalid Authorization header format (expected Bearer token)");
        StatusCode::UNAUTHORIZED
    })?;

    // トークンを検証
    let claims = auth_layer.token_manager.verify_token(token).map_err(|e| {
        warn!("Token verification failed: {:?}", e);
        StatusCode::UNAUTHORIZED
    })?;

    debug!(
        "Authentication successful for room: {}, client: {}",
        claims.sub, claims.client_id
    );

    // Claims をリクエストの extensions に追加
    req.extensions_mut().insert(claims);

    Ok(next.run(req).await)
}

/// オプショナル認証ミドルウェア
///
/// トークンがある場合のみ検証し、なくても通過させる。
/// 認証が成功した場合、Claims をリクエストの extensions に追加する。
///
/// # Usage
///
/// これは認証が任意のエンドポイントで使用する。
/// 例えばパスフレーズなしのルームへのアクセスなど。
pub async fn optional_auth_middleware(
    State(auth_layer): State<AuthLayer>,
    mut req: Request,
    next: Next,
) -> Response {
    debug!("Processing optional authentication middleware");

    // Authorization ヘッダーがあれば検証
    if let Some(auth_header) = req
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
    {
        if let Some(token) = extract_bearer_token(auth_header) {
            if let Ok(claims) = auth_layer.token_manager.verify_token(token) {
                debug!(
                    "Optional auth: authenticated for room: {}, client: {}",
                    claims.sub, claims.client_id
                );
                req.extensions_mut().insert(claims);
            } else {
                debug!("Optional auth: token verification failed, proceeding without auth");
            }
        }
    }

    next.run(req).await
}

/// リクエストから Claims を取得するエクステンショントレイト
pub trait RequestExt {
    /// Claims を取得（認証済みの場合）
    fn claims(&self) -> Option<&Claims>;
}

impl RequestExt for Request {
    fn claims(&self) -> Option<&Claims> {
        self.extensions().get::<Claims>()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request as HttpRequest, routing::get, Router};
    use tower::ServiceExt;

    fn create_test_token_manager() -> TokenManager {
        TokenManager::new("test-secret".to_string(), 24)
    }

    fn create_test_auth_layer() -> AuthLayer {
        AuthLayer::new(create_test_token_manager())
    }

    #[test]
    fn test_extract_bearer_token() {
        assert_eq!(
            extract_bearer_token("Bearer my-token"),
            Some("my-token")
        );
        assert_eq!(
            extract_bearer_token("Bearer "),
            Some("")
        );
        assert_eq!(extract_bearer_token("Basic credentials"), None);
        assert_eq!(extract_bearer_token("token"), None);
    }

    #[test]
    fn test_auth_layer_creation() {
        let manager = create_test_token_manager();
        let layer = AuthLayer::new(manager);

        // layer が作成されていることを確認
        assert!(Arc::strong_count(&layer.token_manager) == 1);
    }

    async fn protected_handler() -> &'static str {
        "Protected content"
    }

    #[tokio::test]
    async fn test_auth_middleware_missing_header() {
        let auth_layer = create_test_auth_layer();

        let app = Router::new()
            .route("/protected", get(protected_handler))
            .layer(axum::middleware::from_fn_with_state(
                auth_layer,
                auth_middleware,
            ));

        let request = HttpRequest::builder()
            .uri("/protected")
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn test_auth_middleware_invalid_format() {
        let auth_layer = create_test_auth_layer();

        let app = Router::new()
            .route("/protected", get(protected_handler))
            .layer(axum::middleware::from_fn_with_state(
                auth_layer,
                auth_middleware,
            ));

        let request = HttpRequest::builder()
            .uri("/protected")
            .header("Authorization", "Basic credentials")
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn test_auth_middleware_invalid_token() {
        let auth_layer = create_test_auth_layer();

        let app = Router::new()
            .route("/protected", get(protected_handler))
            .layer(axum::middleware::from_fn_with_state(
                auth_layer,
                auth_middleware,
            ));

        let request = HttpRequest::builder()
            .uri("/protected")
            .header("Authorization", "Bearer invalid-token")
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn test_auth_middleware_valid_token() {
        let token_manager = create_test_token_manager();
        let token = token_manager.generate_token("test-room").unwrap();
        let auth_layer = AuthLayer::new(token_manager);

        let app = Router::new()
            .route("/protected", get(protected_handler))
            .layer(axum::middleware::from_fn_with_state(
                auth_layer,
                auth_middleware,
            ));

        let request = HttpRequest::builder()
            .uri("/protected")
            .header("Authorization", format!("Bearer {}", token))
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_optional_auth_middleware_no_header() {
        let auth_layer = create_test_auth_layer();

        let app = Router::new()
            .route("/optional", get(protected_handler))
            .layer(axum::middleware::from_fn_with_state(
                auth_layer,
                optional_auth_middleware,
            ));

        let request = HttpRequest::builder()
            .uri("/optional")
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        // オプショナル認証なので成功
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_optional_auth_middleware_invalid_token() {
        let auth_layer = create_test_auth_layer();

        let app = Router::new()
            .route("/optional", get(protected_handler))
            .layer(axum::middleware::from_fn_with_state(
                auth_layer,
                optional_auth_middleware,
            ));

        let request = HttpRequest::builder()
            .uri("/optional")
            .header("Authorization", "Bearer invalid-token")
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        // オプショナル認証なので成功（トークンが無効でも通過）
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_optional_auth_middleware_valid_token() {
        let token_manager = create_test_token_manager();
        let token = token_manager.generate_token("test-room").unwrap();
        let auth_layer = AuthLayer::new(token_manager);

        let app = Router::new()
            .route("/optional", get(protected_handler))
            .layer(axum::middleware::from_fn_with_state(
                auth_layer,
                optional_auth_middleware,
            ));

        let request = HttpRequest::builder()
            .uri("/optional")
            .header("Authorization", format!("Bearer {}", token))
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }
}
