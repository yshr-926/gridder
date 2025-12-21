//! パスフレーズ認証
//!
//! bcrypt によるハッシュ化と検証、タイミング攻撃対策を提供する。

use bcrypt::{BcryptError, DEFAULT_COST, hash, verify};
use thiserror::Error;
use tracing::{debug, warn};

use crate::error::AppError;

/// 認証エラー
#[derive(Debug, Error)]
pub enum AuthError {
    #[error("Invalid passphrase")]
    InvalidPassphrase,

    #[error("Passphrase required")]
    PassphraseRequired,

    #[error("Room not found: {0}")]
    RoomNotFound(String),

    #[error("Room expired")]
    RoomExpired,

    #[error("Hash error: {0}")]
    HashError(#[from] BcryptError),
}

impl From<AuthError> for AppError {
    fn from(err: AuthError) -> Self {
        match err {
            AuthError::InvalidPassphrase => AppError::InvalidPassphrase,
            AuthError::PassphraseRequired => AppError::PassphraseRequired,
            AuthError::RoomNotFound(id) => AppError::RoomNotFound(id),
            AuthError::RoomExpired => AppError::Validation("Room has expired".to_string()),
            AuthError::HashError(e) => AppError::Internal(anyhow::anyhow!("Hash error: {}", e)),
        }
    }
}

/// タイミング攻撃対策用ダミーハッシュ
///
/// パスフレーズが設定されていないルームへのアクセス時でも
/// bcrypt.compare を実行して応答時間を均一化する。
const DUMMY_HASH: &str = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8xB4kz14oJmVchVTD0JZ4F1qF7F5eG";

/// パスフレーズをハッシュ化する
///
/// # Arguments
///
/// * `passphrase` - ハッシュ化するパスフレーズ
/// * `rounds` - bcrypt ラウンド数 (推奨: 10-12)
///
/// # Returns
///
/// ハッシュ化されたパスフレーズ
///
/// # Example
///
/// ```
/// use gridder_backend::auth::passphrase::hash_passphrase;
///
/// let hash = hash_passphrase("my-secret", 4).unwrap();
/// assert!(hash.starts_with("$2b$"));
/// ```
pub fn hash_passphrase(passphrase: &str, rounds: u32) -> Result<String, AuthError> {
    debug!("Hashing passphrase with {} rounds", rounds);
    Ok(hash(passphrase, rounds)?)
}

/// デフォルトのラウンド数でパスフレーズをハッシュ化する
///
/// # Arguments
///
/// * `passphrase` - ハッシュ化するパスフレーズ
///
/// # Returns
///
/// ハッシュ化されたパスフレーズ
pub fn hash_passphrase_default(passphrase: &str) -> Result<String, AuthError> {
    hash_passphrase(passphrase, DEFAULT_COST)
}

/// パスフレーズを検証する
///
/// # Arguments
///
/// * `passphrase` - 検証するパスフレーズ
/// * `hash` - 保存されているハッシュ
///
/// # Returns
///
/// パスフレーズが一致する場合は `true`
pub fn verify_passphrase(passphrase: &str, hash: &str) -> Result<bool, AuthError> {
    Ok(verify(passphrase, hash)?)
}

/// タイミング攻撃対策を施したパスフレーズ検証
///
/// パスフレーズの有無やトークンの有無によらず、
/// 常に bcrypt.compare を実行して応答時間を均一化する。
///
/// # Arguments
///
/// * `token` - クライアントから提供されたトークン（パスフレーズ）
/// * `stored_hash` - データベースに保存されているハッシュ
///
/// # Returns
///
/// * `Ok(())` - 認証成功
/// * `Err(AuthError::InvalidPassphrase)` - 認証失敗
/// * `Err(AuthError::PassphraseRequired)` - トークンが必要だが提供されなかった
///
/// # Security
///
/// この関数は以下のシナリオで一定時間応答を保証する:
///
/// 1. パスフレーズ設定あり + 正しいトークン → OK (bcrypt.compare 実行)
/// 2. パスフレーズ設定あり + 不正なトークン → NG (bcrypt.compare 実行)
/// 3. パスフレーズ設定あり + トークンなし → NG (ダミーハッシュと比較)
/// 4. パスフレーズ設定なし + トークンあり → OK (ダミーハッシュと比較)
/// 5. パスフレーズ設定なし + トークンなし → OK (ダミーハッシュと比較)
pub fn verify_passphrase_safe(
    token: Option<&str>,
    stored_hash: Option<&str>,
) -> Result<(), AuthError> {
    match (token, stored_hash) {
        // ケース 1 & 2: パスフレーズ設定あり + トークンあり
        (Some(t), Some(h)) => {
            debug!("Verifying passphrase (hash present, token present)");
            if verify_passphrase(t, h)? {
                debug!("Passphrase verified successfully");
                Ok(())
            } else {
                warn!("Invalid passphrase provided");
                Err(AuthError::InvalidPassphrase)
            }
        }

        // ケース 3: パスフレーズ設定あり + トークンなし
        (None, Some(_)) => {
            debug!("Verifying passphrase (hash present, token missing)");
            // タイミング攻撃対策: ダミーハッシュと比較して応答時間を均一化
            let _ = verify_passphrase("dummy-token-for-timing-safety", DUMMY_HASH);
            warn!("Passphrase required but not provided");
            Err(AuthError::InvalidPassphrase)
        }

        // ケース 4: パスフレーズ設定なし + トークンあり
        (Some(_), None) => {
            debug!("Verifying passphrase (hash absent, token present)");
            // タイミング攻撃対策: ダミーハッシュと比較
            let _ = verify_passphrase("dummy-token-for-timing-safety", DUMMY_HASH);
            Ok(())
        }

        // ケース 5: パスフレーズ設定なし + トークンなし
        (None, None) => {
            debug!("Verifying passphrase (hash absent, token absent)");
            // タイミング攻撃対策: ダミーハッシュと比較
            let _ = verify_passphrase("dummy-token-for-timing-safety", DUMMY_HASH);
            Ok(())
        }
    }
}

/// パスフレーズの検証ルール
#[derive(Debug, Clone)]
pub struct PassphraseRules {
    pub min_length: usize,
    pub max_length: usize,
}

impl Default for PassphraseRules {
    fn default() -> Self {
        Self {
            min_length: 4,
            max_length: 128,
        }
    }
}

impl PassphraseRules {
    /// カスタムルールでインスタンスを作成
    pub fn new(min_length: usize, max_length: usize) -> Self {
        Self {
            min_length,
            max_length,
        }
    }

    /// パスフレーズが検証ルールを満たしているか確認
    pub fn validate(&self, passphrase: &str) -> Result<(), String> {
        let len = passphrase.len();

        if len < self.min_length {
            return Err(format!(
                "Passphrase must be at least {} characters",
                self.min_length
            ));
        }

        if len > self.max_length {
            return Err(format!(
                "Passphrase must be at most {} characters",
                self.max_length
            ));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_and_verify() {
        let passphrase = "test-passphrase-123";
        let hash = hash_passphrase(passphrase, 4).unwrap(); // 低コストでテスト高速化

        assert!(verify_passphrase(passphrase, &hash).unwrap());
        assert!(!verify_passphrase("wrong-passphrase", &hash).unwrap());
    }

    #[test]
    fn test_hash_different_each_time() {
        let passphrase = "same-passphrase";
        let hash1 = hash_passphrase(passphrase, 4).unwrap();
        let hash2 = hash_passphrase(passphrase, 4).unwrap();

        // 同じパスフレーズでも異なるハッシュが生成される
        assert_ne!(hash1, hash2);

        // しかし、どちらのハッシュでも検証は通る
        assert!(verify_passphrase(passphrase, &hash1).unwrap());
        assert!(verify_passphrase(passphrase, &hash2).unwrap());
    }

    #[test]
    fn test_hash_passphrase_default() {
        let passphrase = "test-default-cost";
        let hash = hash_passphrase_default(passphrase).unwrap();

        // デフォルトコスト（12）でハッシュされていることを確認
        assert!(hash.starts_with("$2b$12$"));
        assert!(verify_passphrase(passphrase, &hash).unwrap());
    }

    #[test]
    fn test_verify_safe_no_passphrase_no_token() {
        // ケース 5: パスフレーズ設定なし + トークンなし → OK
        let result = verify_passphrase_safe(None, None);
        assert!(result.is_ok());
    }

    #[test]
    fn test_verify_safe_no_passphrase_with_token() {
        // ケース 4: パスフレーズ設定なし + トークンあり → OK
        let result = verify_passphrase_safe(Some("any-token"), None);
        assert!(result.is_ok());
    }

    #[test]
    fn test_verify_safe_with_passphrase_correct_token() {
        // ケース 1: パスフレーズ設定あり + 正しいトークン → OK
        let hash = hash_passphrase("secret", 4).unwrap();
        let result = verify_passphrase_safe(Some("secret"), Some(&hash));
        assert!(result.is_ok());
    }

    #[test]
    fn test_verify_safe_with_passphrase_wrong_token() {
        // ケース 2: パスフレーズ設定あり + 不正なトークン → NG
        let hash = hash_passphrase("secret", 4).unwrap();
        let result = verify_passphrase_safe(Some("wrong"), Some(&hash));
        assert!(matches!(result, Err(AuthError::InvalidPassphrase)));
    }

    #[test]
    fn test_verify_safe_with_passphrase_no_token() {
        // ケース 3: パスフレーズ設定あり + トークンなし → NG
        let hash = hash_passphrase("secret", 4).unwrap();
        let result = verify_passphrase_safe(None, Some(&hash));
        assert!(matches!(result, Err(AuthError::InvalidPassphrase)));
    }

    #[test]
    fn test_passphrase_rules_too_short() {
        let rules = PassphraseRules {
            min_length: 4,
            max_length: 128,
        };
        let result = rules.validate("abc");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("at least 4"));
    }

    #[test]
    fn test_passphrase_rules_too_long() {
        let rules = PassphraseRules {
            min_length: 4,
            max_length: 10,
        };
        let result = rules.validate("12345678901");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("at most 10"));
    }

    #[test]
    fn test_passphrase_rules_valid() {
        let rules = PassphraseRules::default();
        let result = rules.validate("valid-passphrase");
        assert!(result.is_ok());
    }

    #[test]
    fn test_passphrase_rules_boundary_min() {
        let rules = PassphraseRules::default();
        // 最小長（4文字）はOK
        assert!(rules.validate("abcd").is_ok());
        // 最小長未満（3文字）はNG
        assert!(rules.validate("abc").is_err());
    }

    #[test]
    fn test_passphrase_rules_boundary_max() {
        let rules = PassphraseRules {
            min_length: 1,
            max_length: 5,
        };
        // 最大長（5文字）はOK
        assert!(rules.validate("abcde").is_ok());
        // 最大長超過（6文字）はNG
        assert!(rules.validate("abcdef").is_err());
    }

    #[test]
    fn test_passphrase_rules_new() {
        let rules = PassphraseRules::new(8, 64);
        assert_eq!(rules.min_length, 8);
        assert_eq!(rules.max_length, 64);

        assert!(rules.validate("short").is_err());
        assert!(rules.validate("longenough").is_ok());
    }

    #[test]
    fn test_auth_error_into_app_error() {
        // InvalidPassphrase の変換
        let auth_err = AuthError::InvalidPassphrase;
        let app_err: AppError = auth_err.into();
        assert!(matches!(app_err, AppError::InvalidPassphrase));

        // PassphraseRequired の変換
        let auth_err = AuthError::PassphraseRequired;
        let app_err: AppError = auth_err.into();
        assert!(matches!(app_err, AppError::PassphraseRequired));

        // RoomNotFound の変換
        let auth_err = AuthError::RoomNotFound("test-room".to_string());
        let app_err: AppError = auth_err.into();
        assert!(matches!(app_err, AppError::RoomNotFound(_)));

        // RoomExpired の変換
        let auth_err = AuthError::RoomExpired;
        let app_err: AppError = auth_err.into();
        assert!(matches!(app_err, AppError::Validation(_)));
    }
}
