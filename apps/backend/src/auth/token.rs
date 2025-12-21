//! JWT トークン生成・検証
//!
//! ルーム認証用のトークン生成と検証を提供する。

use chrono::{Duration, Utc};
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tracing::{debug, warn};
use uuid::Uuid;

/// トークンエラー
#[derive(Debug, Error)]
pub enum TokenError {
    #[error("Token encoding failed: {0}")]
    EncodingFailed(#[from] jsonwebtoken::errors::Error),

    #[error("Token expired")]
    Expired,

    #[error("Invalid token")]
    Invalid,

    #[error("Invalid token claims")]
    InvalidClaims,

    #[error("Room mismatch: expected {expected}, got {actual}")]
    RoomMismatch { expected: String, actual: String },
}

/// JWT クレーム
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    /// Subject（ルーム名）
    pub sub: String,
    /// クライアント ID
    pub client_id: String,
    /// 発行時刻（Unix タイムスタンプ）
    pub iat: i64,
    /// 有効期限（Unix タイムスタンプ）
    pub exp: i64,
}

impl Claims {
    /// 新しいクレームを作成
    pub fn new(room_name: &str, expiry_hours: i64) -> Self {
        let now = Utc::now();
        let exp = now + Duration::hours(expiry_hours);

        Self {
            sub: room_name.to_string(),
            client_id: Uuid::new_v4().to_string(),
            iat: now.timestamp(),
            exp: exp.timestamp(),
        }
    }

    /// トークンが有効期限内かチェック
    pub fn is_valid(&self) -> bool {
        Utc::now().timestamp() < self.exp
    }

    /// ルーム名が一致するかチェック
    pub fn matches_room(&self, room_name: &str) -> bool {
        self.sub == room_name
    }
}

/// トークンマネージャー
#[derive(Clone)]
pub struct TokenManager {
    secret: String,
    expiry_hours: i64,
}

impl TokenManager {
    /// 新しいトークンマネージャーを作成
    pub fn new(secret: String, expiry_hours: i64) -> Self {
        Self {
            secret,
            expiry_hours,
        }
    }

    /// トークンを生成
    ///
    /// # Arguments
    ///
    /// * `room_name` - ルーム名（トークンの subject に設定）
    ///
    /// # Returns
    ///
    /// 生成された JWT トークン
    ///
    /// # Example
    ///
    /// ```
    /// use gridder_backend::auth::token::TokenManager;
    ///
    /// let manager = TokenManager::new("secret".to_string(), 24);
    /// let token = manager.generate_token("test-room").unwrap();
    /// assert!(!token.is_empty());
    /// ```
    pub fn generate_token(&self, room_name: &str) -> Result<String, TokenError> {
        debug!("Generating token for room: {}", room_name);

        let claims = Claims::new(room_name, self.expiry_hours);

        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.secret.as_bytes()),
        )?;

        debug!(
            "Token generated for room {} with client_id {}",
            room_name, claims.client_id
        );

        Ok(token)
    }

    /// トークンを検証
    ///
    /// # Arguments
    ///
    /// * `token` - 検証する JWT トークン
    ///
    /// # Returns
    ///
    /// トークンが有効な場合、クレームを返す
    ///
    /// # Example
    ///
    /// ```
    /// use gridder_backend::auth::token::TokenManager;
    ///
    /// let manager = TokenManager::new("secret".to_string(), 24);
    /// let token = manager.generate_token("test-room").unwrap();
    /// let claims = manager.verify_token(&token).unwrap();
    /// assert_eq!(claims.sub, "test-room");
    /// ```
    pub fn verify_token(&self, token: &str) -> Result<Claims, TokenError> {
        debug!("Verifying token");

        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.secret.as_bytes()),
            &Validation::default(),
        )
        .map_err(|e| {
            warn!("Token verification failed: {}", e);
            match e.kind() {
                jsonwebtoken::errors::ErrorKind::ExpiredSignature => TokenError::Expired,
                _ => TokenError::Invalid,
            }
        })?;

        let claims = token_data.claims;

        if !claims.is_valid() {
            warn!("Token expired for room: {}", claims.sub);
            return Err(TokenError::Expired);
        }

        debug!(
            "Token verified for room {} with client_id {}",
            claims.sub, claims.client_id
        );

        Ok(claims)
    }

    /// トークンを検証し、ルーム名も確認
    ///
    /// # Arguments
    ///
    /// * `token` - 検証する JWT トークン
    /// * `expected_room` - 期待されるルーム名
    ///
    /// # Returns
    ///
    /// トークンが有効でルーム名が一致する場合、クレームを返す
    pub fn verify_token_for_room(
        &self,
        token: &str,
        expected_room: &str,
    ) -> Result<Claims, TokenError> {
        let claims = self.verify_token(token)?;

        if !claims.matches_room(expected_room) {
            warn!(
                "Room mismatch: expected {}, got {}",
                expected_room, claims.sub
            );
            return Err(TokenError::RoomMismatch {
                expected: expected_room.to_string(),
                actual: claims.sub,
            });
        }

        Ok(claims)
    }

    /// トークンのクレームを抽出（検証なし）
    ///
    /// 注意: この関数は署名検証を行わないため、セキュリティが重要な場面では使用しないこと
    pub fn decode_without_verify(&self, token: &str) -> Result<Claims, TokenError> {
        let mut validation = Validation::default();
        validation.insecure_disable_signature_validation();

        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.secret.as_bytes()),
            &validation,
        )
        .map_err(|_| TokenError::InvalidClaims)?;

        Ok(token_data.claims)
    }
}

impl std::fmt::Debug for TokenManager {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TokenManager")
            .field("secret", &"[REDACTED]")
            .field("expiry_hours", &self.expiry_hours)
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread::sleep;
    use std::time::Duration as StdDuration;

    fn create_test_manager() -> TokenManager {
        TokenManager::new("test-secret-key-for-testing".to_string(), 24)
    }

    #[test]
    fn test_generate_token() {
        let manager = create_test_manager();
        let token = manager.generate_token("test-room").unwrap();

        assert!(!token.is_empty());
        // JWT は 3 つのパートからなる（ヘッダー.ペイロード.署名）
        assert_eq!(token.split('.').count(), 3);
    }

    #[test]
    fn test_verify_token() {
        let manager = create_test_manager();
        let token = manager.generate_token("test-room").unwrap();
        let claims = manager.verify_token(&token).unwrap();

        assert_eq!(claims.sub, "test-room");
        assert!(!claims.client_id.is_empty());
        assert!(claims.exp > claims.iat);
    }

    #[test]
    fn test_verify_token_invalid() {
        let manager = create_test_manager();
        let result = manager.verify_token("invalid-token");

        assert!(matches!(result, Err(TokenError::Invalid)));
    }

    #[test]
    fn test_verify_token_wrong_secret() {
        let manager1 = TokenManager::new("secret1".to_string(), 24);
        let manager2 = TokenManager::new("secret2".to_string(), 24);

        let token = manager1.generate_token("test-room").unwrap();
        let result = manager2.verify_token(&token);

        assert!(matches!(result, Err(TokenError::Invalid)));
    }

    #[test]
    fn test_verify_token_for_room() {
        let manager = create_test_manager();
        let token = manager.generate_token("room-1").unwrap();

        // 正しいルーム名
        let result = manager.verify_token_for_room(&token, "room-1");
        assert!(result.is_ok());

        // 間違ったルーム名
        let result = manager.verify_token_for_room(&token, "room-2");
        assert!(matches!(result, Err(TokenError::RoomMismatch { .. })));
    }

    #[test]
    fn test_expired_token() {
        // 有効期限が非常に短いトークンを作成
        let manager = TokenManager::new("test-secret".to_string(), 0);
        let token = manager.generate_token("test-room").unwrap();

        // 少し待つ
        sleep(StdDuration::from_secs(1));

        let result = manager.verify_token(&token);
        assert!(matches!(result, Err(TokenError::Expired)));
    }

    #[test]
    fn test_claims_is_valid() {
        let claims = Claims::new("room", 24);
        assert!(claims.is_valid());

        // 期限切れのクレーム
        let mut expired_claims = Claims::new("room", 24);
        expired_claims.exp = Utc::now().timestamp() - 1;
        assert!(!expired_claims.is_valid());
    }

    #[test]
    fn test_claims_matches_room() {
        let claims = Claims::new("my-room", 24);
        assert!(claims.matches_room("my-room"));
        assert!(!claims.matches_room("other-room"));
    }

    #[test]
    fn test_decode_without_verify() {
        let manager = create_test_manager();
        let token = manager.generate_token("test-room").unwrap();
        let claims = manager.decode_without_verify(&token).unwrap();

        assert_eq!(claims.sub, "test-room");
    }

    #[test]
    fn test_token_manager_debug() {
        let manager = create_test_manager();
        let debug_str = format!("{:?}", manager);

        // シークレットが露出していないことを確認
        assert!(debug_str.contains("[REDACTED]"));
        assert!(!debug_str.contains("test-secret"));
    }

    #[test]
    fn test_unique_client_ids() {
        let manager = create_test_manager();
        let token1 = manager.generate_token("room").unwrap();
        let token2 = manager.generate_token("room").unwrap();

        let claims1 = manager.verify_token(&token1).unwrap();
        let claims2 = manager.verify_token(&token2).unwrap();

        // 異なるクライアント ID が生成される
        assert_ne!(claims1.client_id, claims2.client_id);
    }
}
