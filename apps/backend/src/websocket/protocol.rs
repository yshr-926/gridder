//! y-protocols 互換 Yjs プロトコル実装
//!
//! @hocuspocus/provider との完全なバイナリ互換性を維持する。
//! 全てのメッセージは y-protocols の varUint/varByteArray フレーミングに従う。

use yrs::{
    Doc, ReadTxn, StateVector, Transact,
    updates::{decoder::Decode, encoder::Encode},
};

use crate::error::{AppError, AppResult};

// ============================================================
// y-protocols 互換エンコーディングプリミティブ
// ============================================================

/// varUint を読み取る (LEB128 風)
///
/// 各バイトの MSB が継続フラグ (1=続く, 0=終端)
pub fn read_var_uint(data: &[u8]) -> AppResult<(u64, usize)> {
    let mut result: u64 = 0;
    let mut shift = 0;
    let mut pos = 0;

    loop {
        if pos >= data.len() {
            return Err(AppError::WebSocket("Unexpected end of varUint".to_string()));
        }
        let byte = data[pos];
        result |= ((byte & 0x7F) as u64) << shift;
        pos += 1;
        if byte & 0x80 == 0 {
            break;
        }
        shift += 7;
        if shift > 63 {
            return Err(AppError::WebSocket("varUint overflow".to_string()));
        }
    }
    Ok((result, pos))
}

/// varUint を書き込む
pub fn write_var_uint(value: u64, buf: &mut Vec<u8>) {
    let mut v = value;
    loop {
        let byte = (v & 0x7F) as u8;
        v >>= 7;
        if v == 0 {
            buf.push(byte);
            break;
        } else {
            buf.push(byte | 0x80);
        }
    }
}

/// varByteArray を読み取る
///
/// [varUint length][bytes...]
pub fn read_var_byte_array(data: &[u8]) -> AppResult<(Vec<u8>, usize)> {
    let (len, len_size) = read_var_uint(data)?;
    let len = len as usize;
    let start = len_size;
    let end = start + len;

    if end > data.len() {
        return Err(AppError::WebSocket(
            "Unexpected end of varByteArray".to_string(),
        ));
    }

    Ok((data[start..end].to_vec(), end))
}

/// varByteArray を書き込む
pub fn write_var_byte_array(data: &[u8], buf: &mut Vec<u8>) {
    write_var_uint(data.len() as u64, buf);
    buf.extend_from_slice(data);
}

// ============================================================
// メッセージタイプ定義
// ============================================================

/// メッセージタイプ ID
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum MessageTypeId {
    Sync = 0,
    Awareness = 1,
    Auth = 2,
    QueryAwareness = 3,
}

impl TryFrom<u64> for MessageTypeId {
    type Error = AppError;

    fn try_from(value: u64) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(MessageTypeId::Sync),
            1 => Ok(MessageTypeId::Awareness),
            2 => Ok(MessageTypeId::Auth),
            3 => Ok(MessageTypeId::QueryAwareness),
            _ => Err(AppError::WebSocket(format!(
                "Unknown message type: {}",
                value
            ))),
        }
    }
}

/// Sync メッセージサブタイプ
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum SyncMessageTypeId {
    SyncStep1 = 0,
    SyncStep2 = 1,
    Update = 2,
}

impl TryFrom<u64> for SyncMessageTypeId {
    type Error = AppError;

    fn try_from(value: u64) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(SyncMessageTypeId::SyncStep1),
            1 => Ok(SyncMessageTypeId::SyncStep2),
            2 => Ok(SyncMessageTypeId::Update),
            _ => Err(AppError::WebSocket(format!(
                "Unknown sync message type: {}",
                value
            ))),
        }
    }
}

/// デコードされたメッセージ
#[derive(Debug)]
pub enum MessageType {
    Sync(SyncMessage),
    Awareness(AwarenessUpdate),
    Auth(Vec<u8>),
    QueryAwareness,
}

/// Sync メッセージ
#[derive(Debug)]
pub enum SyncMessage {
    /// SyncStep1: State Vector
    SyncStep1(StateVector),
    /// SyncStep2: Update (diff) - raw bytes
    SyncStep2(Vec<u8>),
    /// Update: Incremental update - raw bytes
    Update(Vec<u8>),
}

/// Awareness 更新エントリ
#[derive(Debug, Clone)]
pub struct AwarenessEntry {
    pub client_id: u64,
    pub clock: u64,
    /// JSON 文字列、clock=0 の場合は None (クライアント離脱)
    pub state: Option<String>,
}

/// Awareness 更新メッセージ
#[derive(Debug)]
pub struct AwarenessUpdate {
    pub entries: Vec<AwarenessEntry>,
}

// ============================================================
// メッセージデコード
// ============================================================

/// メッセージをデコードする (y-protocols 互換)
pub fn decode_message(data: &[u8]) -> AppResult<MessageType> {
    if data.is_empty() {
        return Err(AppError::WebSocket("Empty message".to_string()));
    }

    let (msg_type, pos) = read_var_uint(data)?;
    let msg_type_id = MessageTypeId::try_from(msg_type)?;

    match msg_type_id {
        MessageTypeId::Sync => decode_sync_message(&data[pos..]),
        MessageTypeId::Awareness => decode_awareness_message(&data[pos..]),
        MessageTypeId::Auth => Ok(MessageType::Auth(data[pos..].to_vec())),
        MessageTypeId::QueryAwareness => Ok(MessageType::QueryAwareness),
    }
}

/// Sync メッセージをデコード
fn decode_sync_message(data: &[u8]) -> AppResult<MessageType> {
    if data.is_empty() {
        return Err(AppError::WebSocket(
            "Empty sync message payload".to_string(),
        ));
    }

    let (sync_type, pos) = read_var_uint(data)?;
    let sync_type_id = SyncMessageTypeId::try_from(sync_type)?;
    let (payload, _) = read_var_byte_array(&data[pos..])?;

    match sync_type_id {
        SyncMessageTypeId::SyncStep1 => {
            // SyncStep1: State Vector
            let sv = StateVector::decode_v1(&payload)
                .map_err(|e| AppError::WebSocket(format!("Invalid state vector: {}", e)))?;
            Ok(MessageType::Sync(SyncMessage::SyncStep1(sv)))
        }
        SyncMessageTypeId::SyncStep2 => Ok(MessageType::Sync(SyncMessage::SyncStep2(payload))),
        SyncMessageTypeId::Update => Ok(MessageType::Sync(SyncMessage::Update(payload))),
    }
}

/// Awareness メッセージをデコード (y-protocols/awareness 互換)
fn decode_awareness_message(data: &[u8]) -> AppResult<MessageType> {
    decode_awareness_payload(data)
        .map(|entries| MessageType::Awareness(AwarenessUpdate { entries }))
}

/// Awareness ペイロードをデコード (公開API)
///
/// y-protocols/awareness 互換のバイナリフォーマットをデコードし、
/// AwarenessEntry のリストを返す。
pub fn decode_awareness_payload(data: &[u8]) -> AppResult<Vec<AwarenessEntry>> {
    if data.is_empty() {
        return Err(AppError::WebSocket(
            "Empty awareness message payload".to_string(),
        ));
    }

    let (count, mut pos) = read_var_uint(data)?;
    let mut entries = Vec::with_capacity(count as usize);

    for _ in 0..count {
        if pos >= data.len() {
            return Err(AppError::WebSocket(
                "Unexpected end of awareness entries".to_string(),
            ));
        }

        let (client_id, size) = read_var_uint(&data[pos..])?;
        pos += size;

        let (clock, size) = read_var_uint(&data[pos..])?;
        pos += size;

        let (state_bytes, size) = read_var_byte_array(&data[pos..])?;
        pos += size;

        let state =
            if clock == 0 {
                None // クライアント離脱
            } else {
                Some(String::from_utf8(state_bytes).map_err(|e| {
                    AppError::WebSocket(format!("Invalid UTF-8 in awareness: {}", e))
                })?)
            };

        entries.push(AwarenessEntry {
            client_id,
            clock,
            state,
        });
    }

    Ok(entries)
}

// ============================================================
// メッセージエンコード
// ============================================================

/// SyncStep1 メッセージをエンコードする (y-protocols 互換)
///
/// サーバーからクライアントに送信する State Vector リクエスト
pub fn encode_sync_step1(doc: &Doc) -> Vec<u8> {
    let txn = doc.transact();
    let sv = txn.state_vector();
    let sv_bytes = sv.encode_v1();

    let mut encoder = Vec::new();
    write_var_uint(MessageTypeId::Sync as u64, &mut encoder);
    write_var_uint(SyncMessageTypeId::SyncStep1 as u64, &mut encoder);
    write_var_byte_array(&sv_bytes, &mut encoder);

    encoder
}

/// SyncStep1 メッセージを State Vector から直接エンコードする
pub fn encode_sync_step1_from_sv(sv: &StateVector) -> Vec<u8> {
    let sv_bytes = sv.encode_v1();

    let mut encoder = Vec::new();
    write_var_uint(MessageTypeId::Sync as u64, &mut encoder);
    write_var_uint(SyncMessageTypeId::SyncStep1 as u64, &mut encoder);
    write_var_byte_array(&sv_bytes, &mut encoder);

    encoder
}

/// SyncStep2 メッセージをエンコードする
///
/// クライアントの State Vector に基づいて差分更新を返す
pub fn encode_sync_step2(doc: &Doc, remote_sv: &StateVector) -> AppResult<Vec<u8>> {
    let txn = doc.transact();
    let update = txn.encode_diff_v1(remote_sv);

    let mut encoder = Vec::new();
    write_var_uint(MessageTypeId::Sync as u64, &mut encoder);
    write_var_uint(SyncMessageTypeId::SyncStep2 as u64, &mut encoder);
    write_var_byte_array(&update, &mut encoder);

    Ok(encoder)
}

/// SyncStep2 メッセージを生の update データからエンコードする
pub fn encode_sync_step2_from_update(update: &[u8]) -> Vec<u8> {
    let mut encoder = Vec::new();
    write_var_uint(MessageTypeId::Sync as u64, &mut encoder);
    write_var_uint(SyncMessageTypeId::SyncStep2 as u64, &mut encoder);
    write_var_byte_array(update, &mut encoder);

    encoder
}

/// Update メッセージをエンコードする
pub fn encode_update(update: &[u8]) -> Vec<u8> {
    let mut encoder = Vec::new();
    write_var_uint(MessageTypeId::Sync as u64, &mut encoder);
    write_var_uint(SyncMessageTypeId::Update as u64, &mut encoder);
    write_var_byte_array(update, &mut encoder);

    encoder
}

/// Awareness メッセージをエンコードする (y-protocols/awareness 互換)
pub fn encode_awareness(entries: &[AwarenessEntry]) -> Vec<u8> {
    let mut encoder = Vec::new();
    write_var_uint(MessageTypeId::Awareness as u64, &mut encoder);
    write_var_uint(entries.len() as u64, &mut encoder);

    for entry in entries {
        write_var_uint(entry.client_id, &mut encoder);
        write_var_uint(entry.clock, &mut encoder);

        let state_bytes = entry.state.as_ref().map(|s| s.as_bytes()).unwrap_or(&[]);
        write_var_byte_array(state_bytes, &mut encoder);
    }

    encoder
}

/// QueryAwareness メッセージをエンコードする
pub fn encode_query_awareness() -> Vec<u8> {
    let mut encoder = Vec::new();
    write_var_uint(MessageTypeId::QueryAwareness as u64, &mut encoder);
    encoder
}

// ============================================================
// テスト
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_var_uint_single_byte() {
        // 127 以下は1バイト
        let mut buf = Vec::new();
        write_var_uint(0, &mut buf);
        assert_eq!(buf, vec![0]);

        let mut buf = Vec::new();
        write_var_uint(127, &mut buf);
        assert_eq!(buf, vec![127]);

        // 読み取り
        let (value, size) = read_var_uint(&[0]).unwrap();
        assert_eq!(value, 0);
        assert_eq!(size, 1);

        let (value, size) = read_var_uint(&[127]).unwrap();
        assert_eq!(value, 127);
        assert_eq!(size, 1);
    }

    #[test]
    fn test_var_uint_multi_byte() {
        // 128 以上は複数バイト
        let mut buf = Vec::new();
        write_var_uint(128, &mut buf);
        assert_eq!(buf, vec![0x80, 0x01]);

        let mut buf = Vec::new();
        write_var_uint(16384, &mut buf);
        assert_eq!(buf, vec![0x80, 0x80, 0x01]);

        // 読み取り
        let (value, size) = read_var_uint(&[0x80, 0x01]).unwrap();
        assert_eq!(value, 128);
        assert_eq!(size, 2);

        let (value, size) = read_var_uint(&[0x80, 0x80, 0x01]).unwrap();
        assert_eq!(value, 16384);
        assert_eq!(size, 3);
    }

    #[test]
    fn test_var_uint_roundtrip() {
        let test_values = [0u64, 1, 127, 128, 255, 256, 16383, 16384, 65535, 1_000_000];

        for value in test_values {
            let mut buf = Vec::new();
            write_var_uint(value, &mut buf);
            let (decoded, _) = read_var_uint(&buf).unwrap();
            assert_eq!(value, decoded, "Failed for value {}", value);
        }
    }

    #[test]
    fn test_var_byte_array() {
        let data = b"hello world";
        let mut buf = Vec::new();
        write_var_byte_array(data, &mut buf);

        let (decoded, size) = read_var_byte_array(&buf).unwrap();
        assert_eq!(decoded, data.to_vec());
        assert_eq!(size, buf.len());
    }

    #[test]
    fn test_var_byte_array_empty() {
        let data = b"";
        let mut buf = Vec::new();
        write_var_byte_array(data, &mut buf);

        assert_eq!(buf, vec![0]); // 長さ0のみ

        let (decoded, size) = read_var_byte_array(&buf).unwrap();
        assert_eq!(decoded, Vec::<u8>::new());
        assert_eq!(size, 1);
    }

    #[test]
    fn test_encode_decode_sync_step1() {
        let doc = Doc::new();

        // エンコード
        let encoded = encode_sync_step1(&doc);

        // 先頭がSync(0)であること
        assert_eq!(encoded[0], MessageTypeId::Sync as u8);
        // 次がSyncStep1(0)であること
        assert_eq!(encoded[1], SyncMessageTypeId::SyncStep1 as u8);

        // デコード
        let decoded = decode_message(&encoded).unwrap();

        match decoded {
            MessageType::Sync(SyncMessage::SyncStep1(_sv)) => {
                // OK - State Vector がデコードできた
            }
            _ => panic!("Expected SyncStep1"),
        }
    }

    #[test]
    fn test_encode_decode_update() {
        let update_data = vec![1, 2, 3, 4, 5];
        let encoded = encode_update(&update_data);

        assert_eq!(encoded[0], MessageTypeId::Sync as u8);
        assert_eq!(encoded[1], SyncMessageTypeId::Update as u8);

        // デコード
        let decoded = decode_message(&encoded).unwrap();

        match decoded {
            MessageType::Sync(SyncMessage::Update(data)) => {
                assert_eq!(data, update_data);
            }
            _ => panic!("Expected Update"),
        }
    }

    #[test]
    fn test_encode_decode_awareness() {
        let entries = vec![
            AwarenessEntry {
                client_id: 12345,
                clock: 1,
                state: Some(r#"{"user":{"name":"Alice"}}"#.to_string()),
            },
            AwarenessEntry {
                client_id: 67890,
                clock: 2,
                state: Some(r#"{"user":{"name":"Bob"}}"#.to_string()),
            },
        ];

        let encoded = encode_awareness(&entries);

        // デコード
        let decoded = decode_message(&encoded).unwrap();

        match decoded {
            MessageType::Awareness(update) => {
                assert_eq!(update.entries.len(), 2);
                assert_eq!(update.entries[0].client_id, 12345);
                assert_eq!(update.entries[0].clock, 1);
                assert_eq!(
                    update.entries[0].state,
                    Some(r#"{"user":{"name":"Alice"}}"#.to_string())
                );
                assert_eq!(update.entries[1].client_id, 67890);
                assert_eq!(update.entries[1].clock, 2);
            }
            _ => panic!("Expected Awareness"),
        }
    }

    #[test]
    fn test_awareness_offline() {
        // clock=0 はオフラインを示す
        let entries = vec![AwarenessEntry {
            client_id: 12345,
            clock: 0,
            state: None,
        }];

        let encoded = encode_awareness(&entries);
        let decoded = decode_message(&encoded).unwrap();

        match decoded {
            MessageType::Awareness(update) => {
                assert_eq!(update.entries.len(), 1);
                assert_eq!(update.entries[0].clock, 0);
                // clock=0 の場合は空文字列としてデコードされる（仕様通り）
            }
            _ => panic!("Expected Awareness"),
        }
    }

    #[test]
    fn test_encode_query_awareness() {
        let encoded = encode_query_awareness();

        assert_eq!(encoded, vec![MessageTypeId::QueryAwareness as u8]);

        let decoded = decode_message(&encoded).unwrap();
        match decoded {
            MessageType::QueryAwareness => {}
            _ => panic!("Expected QueryAwareness"),
        }
    }

    #[test]
    fn test_decode_empty_message() {
        let result = decode_message(&[]);
        assert!(result.is_err());
    }

    #[test]
    fn test_decode_unknown_message_type() {
        // 未知のメッセージタイプ (99)
        let result = decode_message(&[99]);
        assert!(result.is_err());
    }

    #[test]
    fn test_var_uint_truncated() {
        // 継続ビットが立っているが次のバイトがない
        let result = read_var_uint(&[0x80]);
        assert!(result.is_err());
    }
}
