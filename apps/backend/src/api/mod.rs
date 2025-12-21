//! REST API モジュール
//!
//! ヘルスチェック、ルーム管理、認証などの REST API エンドポイントを提供する。
//!
//! # サブモジュール
//!
//! - `health`: ヘルスチェックエンドポイント
//! - `rooms`: ルーム管理 API
//! - `router`: API ルーター構築
//!
//! # エンドポイント一覧
//!
//! | メソッド | パス | 説明 |
//! |---------|------|------|
//! | GET | /api/health | ヘルスチェック |
//! | GET | /api/health/live | Liveness Probe |
//! | GET | /api/health/ready | Readiness Probe |
//! | GET | /api/rooms/:room_id | ルーム情報取得 |
//! | GET | /api/rooms/:room_id/has-passphrase | パスフレーズ有無確認 |
//! | POST | /api/rooms/:room_id/passphrase | パスフレーズ設定 |
//! | POST | /api/rooms/:room_id/passphrase/verify | パスフレーズ検証 |
//! | POST | /api/auth | 認証トークン発行 |
//! | POST | /api/auth/verify | トークン検証 |
//! | POST | /api/auth/refresh | トークンリフレッシュ |

pub mod health;
pub mod rooms;
pub mod router;

pub use router::{ApiState, create_api_router};
