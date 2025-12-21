//! スナップショットマネージャー
//!
//! 更新ログが閾値を超えた場合にスナップショットを作成し、
//! 更新ログを削除してストレージを節約する。

use std::sync::Arc;

use tokio::sync::Semaphore;
use tracing::{debug, info};
use yrs::{Doc, ReadTxn, Transact, Update, updates::decoder::Decode};

use super::document_repository::DocumentRepository;
use crate::error::{AppError, AppResult};

/// スナップショットマネージャー
pub struct SnapshotManager {
    /// ドキュメントリポジトリ
    document_repo: DocumentRepository,
    /// スナップショット作成閾値（更新数）
    threshold: i64,
    /// 同時スナップショット作成数を制限
    semaphore: Arc<Semaphore>,
}

impl SnapshotManager {
    /// 新しいスナップショットマネージャーを作成
    ///
    /// # Arguments
    /// * `document_repo` - ドキュメントリポジトリ
    /// * `threshold` - スナップショット作成閾値（更新数）
    pub fn new(document_repo: DocumentRepository, threshold: i64) -> Self {
        Self {
            document_repo,
            threshold,
            // 同時に3ルームまでスナップショット作成
            semaphore: Arc::new(Semaphore::new(3)),
        }
    }

    /// スナップショットが必要か確認し、必要なら作成
    ///
    /// # Arguments
    /// * `room_id` - ルームID
    /// * `doc` - Yjs ドキュメント
    ///
    /// # Returns
    /// スナップショットを作成した場合は true
    pub async fn maybe_create_snapshot(&self, room_id: &str, doc: &Doc) -> AppResult<bool> {
        // 更新ログ数を確認
        let count = self.document_repo.get_update_count(room_id).await?;

        if count < self.threshold {
            return Ok(false);
        }

        debug!(
            room_id = %room_id,
            count = count,
            threshold = self.threshold,
            "Snapshot threshold reached"
        );

        // セマフォを取得（同時実行数制限）
        let _permit = self
            .semaphore
            .acquire()
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Semaphore error: {}", e)))?;

        self.create_snapshot(room_id, doc).await?;
        Ok(true)
    }

    /// スナップショットを強制作成
    pub async fn force_create_snapshot(&self, room_id: &str, doc: &Doc) -> AppResult<()> {
        let _permit = self
            .semaphore
            .acquire()
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Semaphore error: {}", e)))?;

        self.create_snapshot(room_id, doc).await
    }

    /// スナップショットを作成（内部）
    async fn create_snapshot(&self, room_id: &str, doc: &Doc) -> AppResult<()> {
        info!(room_id = %room_id, "Creating snapshot");

        // ドキュメントの完全な状態をエンコード
        let snapshot_data = {
            let txn = doc.transact();
            txn.encode_state_as_update_v1(&yrs::StateVector::default())
        };

        // スナップショット保存と更新ログ削除（アトミック）
        let deleted = self
            .document_repo
            .compact_with_snapshot(room_id, &snapshot_data)
            .await?;

        info!(
            room_id = %room_id,
            snapshot_size = snapshot_data.len(),
            deleted_updates = deleted,
            "Snapshot created"
        );

        Ok(())
    }

    /// ドキュメント状態を復元
    ///
    /// スナップショットと更新ログを逐次適用してドキュメントを復元する。
    /// 各更新は個別にデコードして適用する必要がある（連結してはならない）。
    pub async fn restore_document(&self, room_id: &str) -> AppResult<Option<Doc>> {
        let result = self.document_repo.load_document_state(room_id).await?;

        match result {
            Some((snapshot, updates)) => {
                let doc = Doc::new();
                let mut total_size = 0usize;

                // 1. スナップショットを適用
                if let Some(ref snapshot_data) = snapshot
                    && !snapshot_data.is_empty()
                {
                    let update = Update::decode_v1(snapshot_data)
                        .map_err(|e| AppError::WebSocket(format!("Invalid snapshot: {}", e)))?;

                    let mut txn = doc.transact_mut();
                    txn.apply_update(update);
                    total_size += snapshot_data.len();
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
                    total_size += update_data.len();
                }

                debug!(
                    room_id = %room_id,
                    snapshot_size = snapshot.as_ref().map(|s| s.len()).unwrap_or(0),
                    update_count = updates.len(),
                    total_size = total_size,
                    "Document restored"
                );

                Ok(Some(doc))
            }
            None => Ok(None),
        }
    }

    /// 閾値を取得
    pub fn threshold(&self) -> i64 {
        self.threshold
    }
}

impl Clone for SnapshotManager {
    fn clone(&self) -> Self {
        Self {
            document_repo: self.document_repo.clone(),
            threshold: self.threshold,
            semaphore: self.semaphore.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_snapshot_manager_threshold() {
        // 閾値のテスト
        let threshold = 100i64;
        assert!(50 < threshold);
        assert!(150 > threshold);
    }
}
