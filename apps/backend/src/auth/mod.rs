//! 認証・認可モジュール
//!
//! パスフレーズ認証、トークン管理、認証ミドルウェアを担当する。
//!
//! # サブモジュール
//!
//! - `passphrase`: パスフレーズのハッシュ化と検証
//! - `token`: JWT トークン生成と検証
//! - `middleware`: Axum 認証ミドルウェア
//! - `handlers`: REST API 認証ハンドラー
//!
//! # 使用例
//!
//! ```
//! use gridder_backend::auth::{hash_passphrase, verify_passphrase, verify_passphrase_safe};
//! use gridder_backend::auth::token::TokenManager;
//!
//! // パスフレーズをハッシュ化
//! let hash = hash_passphrase("my-secret", 10).unwrap();
//!
//! // パスフレーズを検証
//! assert!(verify_passphrase("my-secret", &hash).unwrap());
//!
//! // タイミング攻撃対策を施した検証
//! let result = verify_passphrase_safe(Some("my-secret"), Some(&hash));
//! assert!(result.is_ok());
//!
//! // トークン生成と検証
//! let manager = TokenManager::new("secret".to_string(), 24);
//! let token = manager.generate_token("room-1").unwrap();
//! let claims = manager.verify_token(&token).unwrap();
//! assert_eq!(claims.sub, "room-1");
//! ```

pub mod handlers;
pub mod middleware;
pub mod passphrase;
pub mod token;

pub use handlers::{auth_router, AuthHandlerState, AuthRequest, AuthResponse};
pub use middleware::{auth_middleware, optional_auth_middleware, AuthLayer, RequestExt};
pub use passphrase::{
    hash_passphrase, hash_passphrase_default, verify_passphrase, verify_passphrase_safe,
    AuthError, PassphraseRules,
};
pub use token::{Claims, TokenError, TokenManager};
