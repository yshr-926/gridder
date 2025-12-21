//! Gridder Backend Library
//!
//! WebSocket サーバーと REST API のコア実装を提供する。

pub mod api;
pub mod auth;
pub mod config;
pub mod error;
pub mod persistence;
pub mod pubsub;
pub mod sync;
pub mod websocket;

use std::sync::Arc;

use anyhow::Result;
use axum::{
    Router,
    http::{HeaderName, Method, header},
    routing::get,
};
use sqlx::PgPool;
use tokio::net::TcpListener;
use tower_http::{
    cors::{Any, CorsLayer},
    request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer},
    trace::TraceLayer,
};
use tracing::info;

/// X-Request-Id ヘッダー名
const X_REQUEST_ID: HeaderName = HeaderName::from_static("x-request-id");

use crate::{
    api::{ApiState, create_api_router},
    config::Config,
    persistence::{DocumentRepository, RoomRepository, create_pool, run_migrations},
    pubsub::{OptionalRedisPubSub, RemoteMessageHandler},
    sync::RoomManager,
    websocket::{WsAppState, ws_handler},
};

/// アプリケーション共有状態
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub room_manager: Arc<RoomManager>,
    pub redis_pubsub: Arc<OptionalRedisPubSub>,
    pub db_pool: Option<PgPool>,
}

/// サーバーを起動する
pub async fn run_server(config: Config) -> Result<()> {
    // データベース接続プールを作成
    let db_pool = create_pool(&config.database.url, config.database.max_connections).await?;

    // マイグレーションを実行
    run_migrations(&db_pool).await?;

    // Redis Pub/Sub を初期化（オプショナル）
    let redis_pubsub = Arc::new(OptionalRedisPubSub::from_config(config.redis.as_ref()).await);

    // リポジトリを作成
    let room_repo = RoomRepository::new(db_pool.clone());
    let document_repo = DocumentRepository::new(db_pool.clone());

    // RoomManager を作成（永続化機能付き）
    let room_manager = Arc::new(RoomManager::with_persistence(
        room_repo.clone(),
        document_repo,
        config.cleanup.snapshot_threshold,
    ));

    // Redis Pub/Sub が有効な場合、リモートメッセージハンドラーを開始
    if let Some(pubsub) = redis_pubsub.get() {
        let handler = Arc::new(RemoteMessageHandler::new(
            pubsub.clone(),
            room_manager.clone(),
        ));
        handler.start();
        info!("Redis Pub/Sub remote message handler started");
    }

    // アプリケーション状態
    let _app_state = AppState {
        config: Arc::new(config.clone()),
        room_manager: room_manager.clone(),
        redis_pubsub: redis_pubsub.clone(),
        db_pool: Some(db_pool),
    };

    // API 状態を作成
    let api_state = ApiState::new(Arc::new(config.clone()), room_repo, room_manager.clone());

    // API ルーター（REST API）と TokenManager を取得
    let (api_router, token_manager) = create_api_router(api_state);

    // WebSocket 状態（TokenManager を注入して認証を有効化）
    let ws_state = WsAppState {
        room_manager,
        redis_pubsub,
        token_manager: Some(Arc::new(token_manager)),
    };

    // CORS 設定（WebSocket 用）
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION]);

    // WebSocket ルーター
    let ws_router = Router::new()
        .route("/:room_id", get(ws_handler))
        .with_state(ws_state);

    // メインアプリケーション
    let app = Router::new()
        .nest("/api", api_router)
        .nest("/ws", ws_router)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .layer(SetRequestIdLayer::new(
            X_REQUEST_ID.clone(),
            MakeRequestUuid,
        ))
        .layer(PropagateRequestIdLayer::new(X_REQUEST_ID));

    // サーバー起動
    let addr = format!("0.0.0.0:{}", config.server.port);
    info!(
        "Starting server on {} (REST API: /api/*, WebSocket: /ws/:room_id)",
        addr
    );

    let listener = TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
