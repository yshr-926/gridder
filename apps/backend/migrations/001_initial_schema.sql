-- Gridder Initial Schema
-- ルームと Yjs ドキュメントの永続化用テーブル

-- ============================================================
-- rooms テーブル
-- ============================================================

CREATE TABLE IF NOT EXISTS rooms (
    -- ルームID（nanoid形式）
    id TEXT PRIMARY KEY,
    -- ルーム名（オプション）
    name TEXT,
    -- パスフレーズハッシュ（bcrypt）
    passphrase_hash TEXT,
    -- 作成日時
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    -- 最終アクセス日時（クリーンアップ用）
    last_accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    -- 有効期限（オプション）
    expires_at TIMESTAMP WITH TIME ZONE
);

-- クリーンアップ用インデックス
CREATE INDEX IF NOT EXISTS idx_rooms_last_accessed_at ON rooms(last_accessed_at);

-- 期限インデックス（部分インデックス）
CREATE INDEX IF NOT EXISTS idx_rooms_expires_at ON rooms(expires_at)
    WHERE expires_at IS NOT NULL;

-- ============================================================
-- room_updates テーブル (Yjs 更新ログ)
-- ============================================================

CREATE TABLE IF NOT EXISTS room_updates (
    -- シーケンシャルID
    id SERIAL PRIMARY KEY,
    -- ルームへの外部キー
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    -- Yjs Update バイナリデータ
    update_data BYTEA NOT NULL,
    -- 作成日時
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- room_id インデックス（更新取得用）
CREATE INDEX IF NOT EXISTS idx_room_updates_room_id ON room_updates(room_id);

-- room_id + id 複合インデックス（順序付き取得用）
CREATE INDEX IF NOT EXISTS idx_room_updates_room_id_id ON room_updates(room_id, id);

-- ============================================================
-- room_snapshots テーブル (Yjs スナップショット)
-- ============================================================

CREATE TABLE IF NOT EXISTS room_snapshots (
    -- room_id を主キーとする（1ルーム1スナップショット）
    room_id TEXT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
    -- スナップショットバイナリデータ（zstd圧縮）
    snapshot_data BYTEA NOT NULL,
    -- 更新日時
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- クリーンアップ関数
-- ============================================================

-- 期限切れルームを削除する関数
CREATE OR REPLACE FUNCTION cleanup_expired_rooms(expiry_days INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM rooms
        WHERE last_accessed_at < NOW() - (expiry_days || ' days')::INTERVAL
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 明示的な期限が過ぎたルームを削除する関数
CREATE OR REPLACE FUNCTION cleanup_explicitly_expired_rooms()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM rooms
        WHERE expires_at IS NOT NULL AND expires_at < NOW()
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
