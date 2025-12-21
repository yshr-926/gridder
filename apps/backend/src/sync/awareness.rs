//! Awareness 状態管理
//!
//! y-protocols/awareness 互換のユーザープレゼンス管理を担当する。
//! カーソル位置、ユーザー情報などのリアルタイム状態を同期する。

use std::collections::HashMap;

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};

use crate::websocket::protocol::AwarenessEntry;

/// Awareness マネージャー
///
/// ルーム内の全クライアントの Awareness 状態を管理する。
#[derive(Debug)]
pub struct AwarenessManager {
    /// クライアント ID -> Awareness 状態
    states: RwLock<HashMap<String, AwarenessStateEntry>>,
    /// 次に使用する clock 値 (内部クライアントID生成用)
    next_client_id: RwLock<u64>,
}

/// Awareness 状態エントリ（内部管理用）
#[derive(Debug, Clone)]
pub struct AwarenessStateEntry {
    /// クライアント ID（数値形式、y-protocols互換）
    pub numeric_client_id: u64,
    /// 更新カウンター
    pub clock: u64,
    /// JSON エンコードされた状態
    pub state_json: Option<String>,
}

/// Awareness 状態（JSON形式）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AwarenessState {
    /// ユーザー情報
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<UserInfo>,
    /// カーソル位置
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cursor: Option<CursorPosition>,
}

/// ユーザー情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    /// ユーザー名
    pub name: String,
    /// ユーザーカラー（#RRGGBB形式）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

/// カーソル位置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorPosition {
    /// X座標
    pub x: f64,
    /// Y座標
    pub y: f64,
}

impl AwarenessManager {
    /// 新しい AwarenessManager を作成
    pub fn new() -> Self {
        Self {
            states: RwLock::new(HashMap::new()),
            next_client_id: RwLock::new(1),
        }
    }

    /// 新しい数値クライアントIDを生成
    fn generate_client_id(&self) -> u64 {
        let mut next = self.next_client_id.write();
        let id = *next;
        *next += 1;
        id
    }

    /// クライアントの Awareness 状態を更新
    pub fn update(&self, client_id: &str, state: AwarenessState) {
        let state_json = serde_json::to_string(&state).ok();
        let mut states = self.states.write();

        if let Some(entry) = states.get_mut(client_id) {
            entry.clock += 1;
            entry.state_json = state_json;
        } else {
            let numeric_id = self.generate_client_id();
            states.insert(
                client_id.to_string(),
                AwarenessStateEntry {
                    numeric_client_id: numeric_id,
                    clock: 1,
                    state_json,
                },
            );
        }
    }

    /// クライアントの Awareness 状態を clock 付きで更新
    ///
    /// 既存の clock より大きい場合のみ更新される（y-protocols仕様）
    pub fn update_with_clock(&self, client_id: &str, clock: u64, state_json: &str) {
        let mut states = self.states.write();

        if let Some(entry) = states.get_mut(client_id) {
            if clock > entry.clock {
                entry.clock = clock;
                entry.state_json = Some(state_json.to_string());
            }
        } else {
            let numeric_id = self.generate_client_id();
            states.insert(
                client_id.to_string(),
                AwarenessStateEntry {
                    numeric_client_id: numeric_id,
                    clock,
                    state_json: Some(state_json.to_string()),
                },
            );
        }
    }

    /// クライアントの Awareness 状態を削除（離脱時）
    pub fn remove(&self, client_id: &str) {
        let mut states = self.states.write();
        states.remove(client_id);
    }

    /// クライアントの数値IDを取得
    pub fn get_numeric_client_id(&self, client_id: &str) -> Option<u64> {
        self.states
            .read()
            .get(client_id)
            .map(|e| e.numeric_client_id)
    }

    /// 全クライアントの Awareness エントリを取得
    ///
    /// y-protocols/awareness 互換形式で返す
    pub fn get_all_entries(&self) -> Vec<AwarenessEntry> {
        let states = self.states.read();
        states
            .values()
            .map(|entry| AwarenessEntry {
                client_id: entry.numeric_client_id,
                clock: entry.clock,
                state: entry.state_json.clone(),
            })
            .collect()
    }

    /// クライアント数を取得
    pub fn client_count(&self) -> usize {
        self.states.read().len()
    }

    /// 全状態をクリア
    pub fn clear(&self) {
        self.states.write().clear();
    }
}

impl Default for AwarenessManager {
    fn default() -> Self {
        Self::new()
    }
}

impl AwarenessState {
    /// 新しい Awareness 状態を作成
    pub fn new(client_id: &str, user_name: &str) -> Self {
        Self {
            user: Some(UserInfo {
                name: user_name.to_string(),
                color: Some(Self::generate_color(client_id)),
            }),
            cursor: None,
        }
    }

    /// クライアントIDからユーザーカラーを生成
    fn generate_color(client_id: &str) -> String {
        // クライアントIDのハッシュから色を生成
        let hash: u32 = client_id
            .bytes()
            .fold(0u32, |acc, b| acc.wrapping_mul(31).wrapping_add(b as u32));

        // HSL の H 値として使用（彩度と明度は固定）
        let hue = hash % 360;

        // HSL -> RGB 変換（簡易版：固定彩度70%、明度50%）
        let s = 0.7f64;
        let l = 0.5f64;
        let c = (1.0 - (2.0 * l - 1.0).abs()) * s;
        let x = c * (1.0 - ((hue as f64 / 60.0) % 2.0 - 1.0).abs());
        let m = l - c / 2.0;

        let (r, g, b) = match hue {
            0..=59 => (c, x, 0.0),
            60..=119 => (x, c, 0.0),
            120..=179 => (0.0, c, x),
            180..=239 => (0.0, x, c),
            240..=299 => (x, 0.0, c),
            _ => (c, 0.0, x),
        };

        format!(
            "#{:02x}{:02x}{:02x}",
            ((r + m) * 255.0) as u8,
            ((g + m) * 255.0) as u8,
            ((b + m) * 255.0) as u8
        )
    }

    /// JSON 文字列にエンコード
    pub fn encode(&self) -> Vec<u8> {
        serde_json::to_vec(self).unwrap_or_default()
    }

    /// JSON 文字列からデコード
    pub fn decode(data: &[u8]) -> Option<Self> {
        serde_json::from_slice(data).ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_awareness_state_new() {
        let state = AwarenessState::new("client-1", "Alice");

        assert!(state.user.is_some());
        let user = state.user.unwrap();
        assert_eq!(user.name, "Alice");
        assert!(user.color.is_some());
        assert!(user.color.unwrap().starts_with('#'));
    }

    #[test]
    fn test_awareness_state_encode_decode() {
        let state = AwarenessState {
            user: Some(UserInfo {
                name: "Bob".to_string(),
                color: Some("#ff0000".to_string()),
            }),
            cursor: Some(CursorPosition { x: 100.0, y: 200.0 }),
        };

        let encoded = state.encode();
        let decoded = AwarenessState::decode(&encoded).unwrap();

        assert_eq!(decoded.user.as_ref().unwrap().name, "Bob");
        assert_eq!(decoded.cursor.as_ref().unwrap().x, 100.0);
        assert_eq!(decoded.cursor.as_ref().unwrap().y, 200.0);
    }

    #[test]
    fn test_awareness_manager_update() {
        let manager = AwarenessManager::new();

        let state = AwarenessState::new("client-1", "Alice");
        manager.update("client-1", state);

        let entries = manager.get_all_entries();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].clock, 1);
        assert!(entries[0].state.is_some());
    }

    #[test]
    fn test_awareness_manager_update_increments_clock() {
        let manager = AwarenessManager::new();

        let state = AwarenessState::new("client-1", "Alice");
        manager.update("client-1", state.clone());
        manager.update("client-1", state);

        let entries = manager.get_all_entries();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].clock, 2);
    }

    #[test]
    fn test_awareness_manager_remove() {
        let manager = AwarenessManager::new();

        let state = AwarenessState::new("client-1", "Alice");
        manager.update("client-1", state);

        assert_eq!(manager.client_count(), 1);

        manager.remove("client-1");
        assert_eq!(manager.client_count(), 0);
    }

    #[test]
    fn test_awareness_manager_update_with_clock() {
        let manager = AwarenessManager::new();

        // clock=5 で状態を設定
        manager.update_with_clock("client-1", 5, r#"{"user":{"name":"Alice"}}"#);

        // clock=3 での更新は無視される
        manager.update_with_clock("client-1", 3, r#"{"user":{"name":"Bob"}}"#);

        let entries = manager.get_all_entries();
        assert_eq!(entries[0].clock, 5);
        assert!(entries[0].state.as_ref().unwrap().contains("Alice"));

        // clock=10 での更新は適用される
        manager.update_with_clock("client-1", 10, r#"{"user":{"name":"Charlie"}}"#);

        let entries = manager.get_all_entries();
        assert_eq!(entries[0].clock, 10);
        assert!(entries[0].state.as_ref().unwrap().contains("Charlie"));
    }

    #[test]
    fn test_color_generation() {
        let color1 = AwarenessState::generate_color("client-1");
        let color2 = AwarenessState::generate_color("client-2");

        // 異なるクライアントIDは異なる色を生成
        assert_ne!(color1, color2);

        // 同じクライアントIDは同じ色を生成
        let color1_again = AwarenessState::generate_color("client-1");
        assert_eq!(color1, color1_again);
    }
}
