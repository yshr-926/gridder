-- Gridder Collaboration Database Schema
-- Version: 1.0.0
-- Description: Initial schema for real-time collaboration rooms

-- Rooms table: stores collaboration room metadata
CREATE TABLE rooms (
  id text PRIMARY KEY,
  name text,
  passphrase_hash text,
  created_at timestamp NOT NULL DEFAULT NOW(),
  last_accessed_at timestamp NOT NULL DEFAULT NOW(),
  expires_at timestamp
);

-- Index for expired room cleanup
CREATE INDEX idx_rooms_last_accessed_at ON rooms(last_accessed_at);

-- Room updates table: stores incremental Y.js updates
CREATE TABLE room_updates (
  id serial PRIMARY KEY,
  room_id text NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  update_data bytea NOT NULL,
  created_at timestamp NOT NULL DEFAULT NOW()
);

-- Index for efficient room_id lookups
CREATE INDEX idx_room_updates_room_id ON room_updates(room_id);

-- Room snapshots table: stores compressed Y.js state snapshots
CREATE TABLE room_snapshots (
  room_id text PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
  snapshot_data bytea NOT NULL,
  updated_at timestamp NOT NULL DEFAULT NOW()
);

-- Comment for documentation
COMMENT ON TABLE rooms IS 'Stores collaboration room metadata including passphrase and access timestamps';
COMMENT ON TABLE room_updates IS 'Stores incremental Y.js document updates for each room';
COMMENT ON TABLE room_snapshots IS 'Stores compressed Y.js document snapshots for efficient loading';
