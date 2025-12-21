-- ============================================================
-- Gridder Database Initialization Script
-- ============================================================
-- This script runs on first container initialization
-- For migrations, see apps/backend/migrations/
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant privileges (if needed)
GRANT ALL PRIVILEGES ON DATABASE gridder TO gridder;

-- Note: The actual schema is created by SQLx migrations
-- This file is for initial database setup and extensions only
