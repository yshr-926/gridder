//! WebSocket 接続管理
//!
//! 個々のクライアント接続の情報を追跡し、ヘルスチェックを行う。

use std::time::{Duration, Instant};

use tokio::sync::mpsc::UnboundedSender;

/// クライアント接続
#[derive(Debug, Clone)]
pub struct ClientConnection {
    /// クライアント ID（バックエンド側で管理する文字列ID）
    pub client_id: String,
    /// Yjs クライアント ID（フロントエンドの ydoc.clientID、Awareness用）
    /// 最初の Awareness メッセージ受信時に設定される
    pub yjs_client_id: Option<u64>,
    /// ユーザー表示名
    pub user_name: String,
    /// 送信チャネル
    pub sender: UnboundedSender<Vec<u8>>,
    /// 接続情報
    pub info: ConnectionInfo,
}

impl ClientConnection {
    /// 新しいクライアント接続を作成
    pub fn new(client_id: String, user_name: String, sender: UnboundedSender<Vec<u8>>) -> Self {
        Self {
            client_id,
            yjs_client_id: None,
            user_name,
            sender,
            info: ConnectionInfo::new(),
        }
    }

    /// Yjs クライアント ID を設定
    pub fn set_yjs_client_id(&mut self, yjs_client_id: u64) {
        if self.yjs_client_id.is_none() {
            self.yjs_client_id = Some(yjs_client_id);
        }
    }

    /// メッセージを送信
    pub fn send(&self, message: Vec<u8>) -> Result<(), SendError> {
        self.sender
            .send(message)
            .map_err(|_| SendError::ChannelClosed)
    }

    /// アクティビティを記録
    pub fn touch(&mut self) {
        self.info.touch();
    }

    /// 接続がアイドル状態かどうか
    pub fn is_idle(&self, timeout: Duration) -> bool {
        self.info.is_idle(timeout)
    }
}

/// 接続情報
#[derive(Debug, Clone)]
pub struct ConnectionInfo {
    /// 接続時刻
    pub connected_at: Instant,
    /// 最後のアクティビティ時刻
    pub last_activity: Instant,
    /// 送信メッセージ数
    pub messages_sent: u64,
    /// 受信メッセージ数
    pub messages_received: u64,
}

impl ConnectionInfo {
    /// 新しい接続情報を作成
    pub fn new() -> Self {
        let now = Instant::now();
        Self {
            connected_at: now,
            last_activity: now,
            messages_sent: 0,
            messages_received: 0,
        }
    }

    /// アクティビティを記録
    pub fn touch(&mut self) {
        self.last_activity = Instant::now();
    }

    /// メッセージ送信をカウント
    pub fn record_sent(&mut self) {
        self.messages_sent += 1;
        self.touch();
    }

    /// メッセージ受信をカウント
    pub fn record_received(&mut self) {
        self.messages_received += 1;
        self.touch();
    }

    /// 接続がアイドル状態かどうか
    pub fn is_idle(&self, timeout: Duration) -> bool {
        self.last_activity.elapsed() > timeout
    }

    /// 接続時間を取得
    pub fn duration(&self) -> Duration {
        self.connected_at.elapsed()
    }

    /// 最後のアクティビティからの経過時間
    pub fn idle_duration(&self) -> Duration {
        self.last_activity.elapsed()
    }
}

impl Default for ConnectionInfo {
    fn default() -> Self {
        Self::new()
    }
}

/// 接続ヘルスチェック結果
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConnectionHealth {
    /// 正常
    Healthy,
    /// アイドル状態（活動なし）
    Idle,
    /// 古い接続（長時間アイドル）
    Stale,
}

impl ConnectionHealth {
    /// ConnectionInfo からヘルス状態を判定
    pub fn from_info(
        info: &ConnectionInfo,
        idle_timeout: Duration,
        stale_timeout: Duration,
    ) -> Self {
        let idle_time = info.idle_duration();

        if idle_time > stale_timeout {
            ConnectionHealth::Stale
        } else if idle_time > idle_timeout {
            ConnectionHealth::Idle
        } else {
            ConnectionHealth::Healthy
        }
    }
}

/// 送信エラー
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SendError {
    /// チャネルが閉じられた
    ChannelClosed,
}

impl std::fmt::Display for SendError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SendError::ChannelClosed => write!(f, "Channel closed"),
        }
    }
}

impl std::error::Error for SendError {}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn test_connection_info_new() {
        let info = ConnectionInfo::new();
        assert_eq!(info.messages_sent, 0);
        assert_eq!(info.messages_received, 0);
        assert!(info.duration() < Duration::from_secs(1));
    }

    #[test]
    fn test_connection_info_touch() {
        let mut info = ConnectionInfo::new();
        std::thread::sleep(Duration::from_millis(10));
        info.touch();
        assert!(info.idle_duration() < Duration::from_millis(10));
    }

    #[test]
    fn test_connection_info_is_idle() {
        let info = ConnectionInfo::new();
        // 直後はアイドルではない
        assert!(!info.is_idle(Duration::from_secs(1)));
        // 0秒タイムアウトならアイドル
        assert!(info.is_idle(Duration::from_nanos(1)));
    }

    #[test]
    fn test_connection_health() {
        let info = ConnectionInfo::new();

        let health =
            ConnectionHealth::from_info(&info, Duration::from_secs(30), Duration::from_secs(60));

        assert_eq!(health, ConnectionHealth::Healthy);
    }

    #[test]
    fn test_client_connection() {
        let (tx, _rx) = tokio::sync::mpsc::unbounded_channel();
        let conn = ClientConnection::new("client-1".to_string(), "Test User".to_string(), tx);

        assert_eq!(conn.client_id, "client-1");
        assert_eq!(conn.user_name, "Test User");
    }

    #[test]
    fn test_client_connection_send() {
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
        let conn = ClientConnection::new("client-1".to_string(), "Test User".to_string(), tx);

        // 送信成功
        let result = conn.send(vec![1, 2, 3]);
        assert!(result.is_ok());

        // 受信確認
        let received = rx.try_recv().unwrap();
        assert_eq!(received, vec![1, 2, 3]);
    }

    #[test]
    fn test_client_connection_send_closed_channel() {
        let (tx, rx) = tokio::sync::mpsc::unbounded_channel::<Vec<u8>>();
        let conn = ClientConnection::new("client-1".to_string(), "Test User".to_string(), tx);

        // レシーバーをドロップ
        drop(rx);

        // 送信失敗
        let result = conn.send(vec![1, 2, 3]);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), SendError::ChannelClosed);
    }
}
