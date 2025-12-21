//! API ルーター
//!
//! REST API のルーティングと共通ミドルウェアを設定する。

use std::sync::Arc;
use std::time::Duration;

use axum::{
    http::{header, Method},
    Router,
};
use tower_http::cors::{Any, CorsLayer};

use crate::{
    api::{health, rooms},
    auth::{auth_router, AuthHandlerState, TokenManager},
    config::Config,
    persistence::RoomRepository,
    sync::RoomManager,
};

/// API 共有状態
#[derive(Clone)]
pub struct ApiState {
    /// 設定
    pub config: Arc<Config>,
    /// ルームリポジトリ
    pub room_repo: RoomRepository,
    /// ルームマネージャー
    pub room_manager: Arc<RoomManager>,
}

impl ApiState {
    /// 新しい API 状態を作成
    pub fn new(
        config: Arc<Config>,
        room_repo: RoomRepository,
        room_manager: Arc<RoomManager>,
    ) -> Self {
        Self {
            config,
            room_repo,
            room_manager,
        }
    }
}

/// API ルーターを構築
///
/// # Arguments
///
/// * `state` - API 共有状態
///
/// # Returns
///
/// (Router, TokenManager) タプル - CORS ミドルウェアを含む API ルーターと TokenManager
pub fn create_api_router(state: ApiState) -> (Router, TokenManager) {
    // CORS 設定
    let cors = CorsLayer::new()
        // 開発環境では全オリジンを許可
        // 本番環境では環境変数で制限する
        .allow_origin(Any)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            header::CONTENT_TYPE,
            header::AUTHORIZATION,
            header::ACCEPT,
            header::HeaderName::from_static("x-request-id"),
        ])
        .max_age(Duration::from_secs(3600));

    // 認証ハンドラー状態
    let token_manager = TokenManager::new(
        state.config.auth.jwt_secret.clone(),
        state.config.auth.jwt_expiry_hours,
    );
    let auth_state = AuthHandlerState::new(
        token_manager.clone(),
        state.config.auth.bcrypt_rounds,
        state.config.auth.min_passphrase_length,
        state.config.auth.max_passphrase_length,
    )
    .with_room_repo(state.room_repo.clone());

    // ルーターを構築
    let router = Router::new()
        // ヘルスチェック
        .merge(health::router(state.clone()))
        // ルーム管理 API
        .merge(rooms::router(state.clone()))
        // 認証 API
        .merge(auth_router(auth_state))
        // CORS ミドルウェア
        .layer(cors);

    (router, token_manager)
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::PgPool;

    // コンパイル確認用（実際のテストは統合テストで行う）
    #[test]
    fn test_api_state_clone() {
        // ApiState が Clone を実装していることを確認
        fn assert_clone<T: Clone>() {}
        assert_clone::<ApiState>();
    }
}
