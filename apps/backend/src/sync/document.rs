//! Y.Doc 管理
//!
//! yrs ライブラリを使用した CRDT ドキュメントの管理を担当する。

use yrs::{updates::decoder::Decode, Doc, ReadTxn, StateVector, Transact, Update};

use crate::error::{AppError, AppResult};

/// Document マネージャー
///
/// Y.Doc のライフサイクルと更新の適用を管理する。
#[derive(Debug)]
pub struct DocumentManager {
    doc: Doc,
}

impl DocumentManager {
    /// 新しい空のドキュメントを作成
    pub fn new() -> Self {
        Self { doc: Doc::new() }
    }

    /// 既存の状態からドキュメントを復元
    ///
    /// # Arguments
    /// * `snapshot` - スナップショットデータ（オプション）
    pub fn with_snapshot(snapshot: &[u8]) -> AppResult<Self> {
        let doc = Doc::new();

        if !snapshot.is_empty() {
            let update = Update::decode_v1(snapshot)
                .map_err(|e| AppError::WebSocket(format!("Invalid snapshot: {}", e)))?;
            let mut txn = doc.transact_mut();
            txn.apply_update(update);
        }

        Ok(Self { doc })
    }

    /// スナップショットと更新ログからドキュメントを復元
    ///
    /// # 重要
    /// Yjs の更新形式では、複数の更新を連結して一度にデコードすることはできない。
    /// 各更新は個別にデコードして逐次適用する必要がある。
    ///
    /// # Arguments
    /// * `snapshot` - スナップショットデータ（オプション）
    /// * `updates` - 更新ログ（スナップショット以降の更新）
    pub fn with_updates(snapshot: Option<&[u8]>, updates: &[Vec<u8>]) -> AppResult<Self> {
        let doc = Doc::new();

        // 1. スナップショットを適用
        if let Some(snapshot_data) = snapshot
            && !snapshot_data.is_empty() {
                let update = Update::decode_v1(snapshot_data)
                    .map_err(|e| AppError::WebSocket(format!("Invalid snapshot: {}", e)))?;
                let mut txn = doc.transact_mut();
                txn.apply_update(update);
            }

        // 2. 更新ログを逐次適用
        for (i, update_data) in updates.iter().enumerate() {
            if update_data.is_empty() {
                continue;
            }
            let update = Update::decode_v1(update_data).map_err(|e| {
                AppError::WebSocket(format!("Invalid update at index {}: {}", i, e))
            })?;
            let mut txn = doc.transact_mut();
            txn.apply_update(update);
        }

        Ok(Self { doc })
    }

    /// ドキュメントへの参照を取得
    pub fn doc(&self) -> &Doc {
        &self.doc
    }

    /// State Vector を取得
    pub fn state_vector(&self) -> StateVector {
        let txn = self.doc.transact();
        txn.state_vector()
    }

    /// 現在の状態を更新形式でエンコード
    ///
    /// 空の State Vector からの差分として全状態を返す
    pub fn encode_state(&self) -> Vec<u8> {
        let txn = self.doc.transact();
        txn.encode_state_as_update_v1(&StateVector::default())
    }

    /// リモートの State Vector との差分をエンコード
    pub fn encode_diff(&self, remote_sv: &StateVector) -> Vec<u8> {
        let txn = self.doc.transact();
        txn.encode_diff_v1(remote_sv)
    }

    /// 更新を適用
    ///
    /// # Arguments
    /// * `update_data` - エンコードされた更新データ
    pub fn apply_update(&self, update_data: &[u8]) -> AppResult<()> {
        let update = Update::decode_v1(update_data)
            .map_err(|e| AppError::WebSocket(format!("Invalid update: {}", e)))?;

        let mut txn = self.doc.transact_mut();
        txn.apply_update(update);

        Ok(())
    }

    /// 複数の更新を一括適用
    ///
    /// # Arguments
    /// * `updates` - エンコードされた更新データのリスト
    pub fn apply_updates(&self, updates: &[Vec<u8>]) -> AppResult<()> {
        for update_data in updates {
            self.apply_update(update_data)?;
        }
        Ok(())
    }
}

impl Default for DocumentManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use yrs::{GetString, Text, Transact};

    #[test]
    fn test_new_document() {
        let manager = DocumentManager::new();
        let sv = manager.state_vector();

        // 新しいドキュメントの State Vector は空に近い
        assert!(sv.is_empty());
    }

    #[test]
    fn test_encode_state() {
        let manager = DocumentManager::new();

        // ドキュメントに変更を加える
        {
            let text = manager.doc.get_or_insert_text("test");
            let mut txn = manager.doc.transact_mut();
            text.insert(&mut txn, 0, "Hello, World!");
        }

        let state = manager.encode_state();
        assert!(!state.is_empty());

        // 状態から新しいドキュメントを復元
        let restored = DocumentManager::with_snapshot(&state).unwrap();

        // 同じ内容であることを確認
        let text = restored.doc.get_or_insert_text("test");
        let txn = restored.doc.transact();
        assert_eq!(text.get_string(&txn), "Hello, World!");
    }

    #[test]
    fn test_apply_update() {
        let doc1 = DocumentManager::new();
        let doc2 = DocumentManager::new();

        // doc1 に変更を加える
        {
            let text = doc1.doc.get_or_insert_text("test");
            let mut txn = doc1.doc.transact_mut();
            text.insert(&mut txn, 0, "Hello");
        }

        // doc1 の状態を doc2 に適用
        let update = doc1.encode_state();
        doc2.apply_update(&update).unwrap();

        // doc2 が同じ内容になっていることを確認
        let text = doc2.doc.get_or_insert_text("test");
        let txn = doc2.doc.transact();
        assert_eq!(text.get_string(&txn), "Hello");
    }

    #[test]
    fn test_encode_diff() {
        let doc1 = DocumentManager::new();
        let doc2 = DocumentManager::new();

        // 両方のドキュメントに同じ初期状態を設定
        {
            let text = doc1.doc.get_or_insert_text("test");
            let mut txn = doc1.doc.transact_mut();
            text.insert(&mut txn, 0, "Hello");
        }
        {
            let update = doc1.encode_state();
            doc2.apply_update(&update).unwrap();
        }

        // doc1 のみに追加変更
        {
            let text = doc1.doc.get_or_insert_text("test");
            let mut txn = doc1.doc.transact_mut();
            text.insert(&mut txn, 5, ", World!");
        }

        // 差分を計算
        let sv2 = doc2.state_vector();
        let diff = doc1.encode_diff(&sv2);

        // 差分を doc2 に適用
        doc2.apply_update(&diff).unwrap();

        // 同じ内容になっていることを確認
        let text = doc2.doc.get_or_insert_text("test");
        let txn = doc2.doc.transact();
        assert_eq!(text.get_string(&txn), "Hello, World!");
    }

    #[test]
    fn test_with_updates() {
        let doc1 = DocumentManager::new();

        // 複数の更新を作成
        // 各更新を作成するごとにその時点の全状態をスナップショットとして保存
        let mut updates = Vec::new();

        {
            let text = doc1.doc.get_or_insert_text("test");
            let mut txn = doc1.doc.transact_mut();
            text.insert(&mut txn, 0, "A");
        }
        // スナップショット: "A"
        let snapshot = doc1.encode_state();

        // 差分の開始点
        let sv_after_a = doc1.state_vector();

        {
            let text = doc1.doc.get_or_insert_text("test");
            let mut txn = doc1.doc.transact_mut();
            text.insert(&mut txn, 1, "B");
        }
        // 差分更新1: "A" -> "AB"
        updates.push(doc1.encode_diff(&sv_after_a));

        let sv_after_b = doc1.state_vector();

        {
            let text = doc1.doc.get_or_insert_text("test");
            let mut txn = doc1.doc.transact_mut();
            text.insert(&mut txn, 2, "C");
        }
        // 差分更新2: "AB" -> "ABC"
        updates.push(doc1.encode_diff(&sv_after_b));

        // スナップショットと更新ログから復元
        let restored = DocumentManager::with_updates(Some(&snapshot), &updates).unwrap();

        let text = restored.doc.get_or_insert_text("test");
        let txn = restored.doc.transact();
        assert_eq!(text.get_string(&txn), "ABC");
    }

    #[test]
    fn test_invalid_update() {
        let manager = DocumentManager::new();

        // 不正な更新データ
        let result = manager.apply_update(&[0xFF, 0xFF, 0xFF]);
        assert!(result.is_err());
    }

    #[test]
    fn test_empty_snapshot() {
        let manager = DocumentManager::with_snapshot(&[]).unwrap();
        assert!(manager.state_vector().is_empty());
    }
}
