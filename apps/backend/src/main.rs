//! Gridder Collaboration Server
//!
//! Yjs 互換の WebSocket サーバー。
//! リアルタイム共同編集機能を提供する。

use anyhow::Result;
use gridder_backend::{config::Config, run_server};
use tracing::info;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

#[tokio::main]
async fn main() -> Result<()> {
    // 環境変数の読み込み
    dotenvy::dotenv().ok();

    // トレーシング初期化
    init_tracing();

    info!("Starting Gridder Collaboration Server...");

    // 設定の読み込み
    let config = Config::from_env()?;
    info!(?config, "Configuration loaded");

    // サーバー起動
    run_server(config).await?;

    Ok(())
}

/// トレーシングの初期化
fn init_tracing() {
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,gridder_backend=debug,sqlx=warn"));

    let fmt_layer = fmt::layer()
        .with_target(true)
        .with_thread_ids(true)
        .with_file(true)
        .with_line_number(true);

    tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt_layer)
        .init();
}
