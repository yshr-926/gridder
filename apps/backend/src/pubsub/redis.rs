//! Redis 接続管理
//!
//! fred クライアントを使用した Redis 接続プール管理。
//! ヘルスチェックと自動再接続をサポートする。

use std::sync::Arc;

use fred::{
    clients::{RedisClient, SubscriberClient},
    interfaces::{ClientLike, EventInterface, PubsubInterface},
    types::RedisConfig,
};
use parking_lot::RwLock;
use tokio::sync::broadcast;
use tracing::{debug, error, info, warn};

use crate::{
    config::RedisConfig as AppRedisConfig,
    error::{AppError, AppResult},
};

/// Redis 接続状態
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConnectionState {
    /// 接続済み
    Connected,
    /// 接続中
    Connecting,
    /// 切断
    Disconnected,
    /// 再接続中
    Reconnecting,
}

/// Redis 接続マネージャー
///
/// Redis クライアントの初期化、接続プール管理、ヘルスチェックを担当する。
pub struct RedisConnectionManager {
    /// Publish 用クライアント
    client: RedisClient,
    /// Subscribe 用クライアント
    subscriber: SubscriberClient,
    /// 接続状態
    state: Arc<RwLock<ConnectionState>>,
    /// 接続状態通知チャネル
    state_tx: broadcast::Sender<ConnectionState>,
    /// アクティブなサブスクリプション
    subscriptions: Arc<RwLock<Vec<String>>>,
}

impl RedisConnectionManager {
    /// 新しい接続マネージャーを作成
    ///
    /// # Arguments
    /// * `config` - Redis 接続設定
    ///
    /// # Returns
    /// 接続マネージャーインスタンス
    pub async fn new(config: &AppRedisConfig) -> AppResult<Self> {
        info!(host = %config.host, port = config.port, "Initializing Redis connection");

        // Redis URL を構築
        let redis_url = if let Some(ref password) = config.password {
            format!("redis://:{}@{}:{}", password, config.host, config.port)
        } else {
            format!("redis://{}:{}", config.host, config.port)
        };

        // Redis 設定
        let redis_config = RedisConfig::from_url(&redis_url)
            .map_err(|e| AppError::Redis(format!("Invalid Redis URL: {}", e)))?;

        // クライアント作成
        let client = RedisClient::new(redis_config.clone(), None, None, None);
        let subscriber = SubscriberClient::new(redis_config.clone(), None, None, None);

        // 接続
        client.connect();
        subscriber.connect();

        // 接続完了を待機
        client
            .wait_for_connect()
            .await
            .map_err(|e| AppError::Redis(format!("Failed to connect to Redis: {}", e)))?;

        subscriber
            .wait_for_connect()
            .await
            .map_err(|e| AppError::Redis(format!("Failed to connect subscriber: {}", e)))?;

        info!("Redis connection established");

        // 状態管理
        let state = Arc::new(RwLock::new(ConnectionState::Connected));
        let (state_tx, _) = broadcast::channel(16);

        let manager = Self {
            client,
            subscriber,
            state,
            state_tx,
            subscriptions: Arc::new(RwLock::new(Vec::new())),
        };

        // 再接続ハンドラーを設定
        manager.setup_reconnection_handler();

        Ok(manager)
    }

    /// Publish 用クライアントを取得
    pub fn client(&self) -> &RedisClient {
        &self.client
    }

    /// Subscribe 用クライアントを取得
    pub fn subscriber(&self) -> &SubscriberClient {
        &self.subscriber
    }

    /// 接続状態を取得
    pub fn connection_state(&self) -> ConnectionState {
        *self.state.read()
    }

    /// 接続中かどうか
    pub fn is_connected(&self) -> bool {
        self.connection_state() == ConnectionState::Connected
    }

    /// 接続状態変更の通知を購読
    pub fn subscribe_state_changes(&self) -> broadcast::Receiver<ConnectionState> {
        self.state_tx.subscribe()
    }

    /// サブスクリプションリストに追加
    pub fn add_subscription(&self, channel: &str) {
        let mut subs = self.subscriptions.write();
        if !subs.contains(&channel.to_string()) {
            subs.push(channel.to_string());
        }
    }

    /// サブスクリプションリストから削除
    pub fn remove_subscription(&self, channel: &str) {
        let mut subs = self.subscriptions.write();
        subs.retain(|s| s != channel);
    }

    /// アクティブなサブスクリプションを取得
    pub fn get_subscriptions(&self) -> Vec<String> {
        self.subscriptions.read().clone()
    }

    /// ヘルスチェック
    ///
    /// Redis サーバーに PING を送信して接続を確認する。
    pub async fn health_check(&self) -> AppResult<()> {
        use fred::interfaces::ClientLike;

        self.client
            .ping::<String>()
            .await
            .map_err(|e| AppError::Redis(format!("Health check failed: {}", e)))?;

        debug!("Redis health check passed");
        Ok(())
    }

    /// 再接続ハンドラーを設定
    fn setup_reconnection_handler(&self) {
        let client = self.client.clone();
        let subscriber = self.subscriber.clone();
        let state = self.state.clone();
        let state_tx = self.state_tx.clone();
        let subscriptions = self.subscriptions.clone();

        tokio::spawn(async move {
            let mut reconnect_rx = client.reconnect_rx();

            while (reconnect_rx.recv().await).is_ok() {
                info!("Redis reconnected");

                // 状態を更新
                {
                    let mut s = state.write();
                    *s = ConnectionState::Connected;
                }
                let _ = state_tx.send(ConnectionState::Connected);

                // サブスクリプションを復元
                let channels = subscriptions.read().clone();
                for channel in channels {
                    debug!(channel = %channel, "Resubscribing to channel");
                    if let Err(e) = subscriber.subscribe(channel.clone()).await {
                        error!(channel = %channel, error = %e, "Failed to resubscribe");
                    }
                }
            }
        });

        // 切断ハンドラー
        let client = self.client.clone();
        let state = self.state.clone();
        let state_tx = self.state_tx.clone();

        tokio::spawn(async move {
            let mut error_rx = client.error_rx();

            while let Ok(error) = error_rx.recv().await {
                warn!(error = %error, "Redis connection error");

                // 状態を更新
                {
                    let mut s = state.write();
                    *s = ConnectionState::Reconnecting;
                }
                let _ = state_tx.send(ConnectionState::Reconnecting);
            }
        });
    }

    /// 接続をクローズ
    pub async fn close(&self) {
        info!("Closing Redis connection");

        // 状態を更新
        {
            let mut s = self.state.write();
            *s = ConnectionState::Disconnected;
        }
        let _ = self.state_tx.send(ConnectionState::Disconnected);

        // クライアントを切断
        let _ = self.client.quit().await;
        let _ = self.subscriber.quit().await;
    }
}

impl Drop for RedisConnectionManager {
    fn drop(&mut self) {
        // 同期コンテキストでは quit() を呼べないため、フラグのみ更新
        let mut s = self.state.write();
        *s = ConnectionState::Disconnected;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Redis が利用可能な環境でのみテスト
    #[tokio::test]
    #[ignore = "Requires Redis server"]
    async fn test_connection_manager_new() {
        let config = AppRedisConfig {
            host: "localhost".to_string(),
            port: 6379,
            password: None,
        };

        let manager = RedisConnectionManager::new(&config).await.unwrap();
        assert!(manager.is_connected());
    }

    #[tokio::test]
    #[ignore = "Requires Redis server"]
    async fn test_health_check() {
        let config = AppRedisConfig {
            host: "localhost".to_string(),
            port: 6379,
            password: None,
        };

        let manager = RedisConnectionManager::new(&config).await.unwrap();
        manager.health_check().await.unwrap();
    }

    #[tokio::test]
    #[ignore = "Requires Redis server"]
    async fn test_subscription_management() {
        let config = AppRedisConfig {
            host: "localhost".to_string(),
            port: 6379,
            password: None,
        };

        let manager = RedisConnectionManager::new(&config).await.unwrap();

        // サブスクリプション追加
        manager.add_subscription("test:channel1");
        manager.add_subscription("test:channel2");

        let subs = manager.get_subscriptions();
        assert_eq!(subs.len(), 2);
        assert!(subs.contains(&"test:channel1".to_string()));
        assert!(subs.contains(&"test:channel2".to_string()));

        // サブスクリプション削除
        manager.remove_subscription("test:channel1");

        let subs = manager.get_subscriptions();
        assert_eq!(subs.len(), 1);
        assert!(!subs.contains(&"test:channel1".to_string()));
    }
}
