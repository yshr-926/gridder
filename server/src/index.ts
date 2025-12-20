/**
 * Gridder Collaboration Server
 *
 * WebSocket server for real-time collaboration using Hocuspocus.
 * Provides:
 * - Y.js document synchronization
 * - PostgreSQL persistence
 * - Redis PubSub for horizontal scaling
 * - Passphrase authentication
 * - Automatic expired room cleanup
 */

import { Server } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { Redis } from '@hocuspocus/extension-redis';
import { Logger } from '@hocuspocus/extension-logger';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import express, { Application } from 'express';
import * as Y from 'yjs';
import { cleanupExpiredRooms } from './cleanup.js';
import {
  registerActiveRoom,
  unregisterActiveRoom,
  startKeepAlive,
  stopKeepAlive,
} from './keepAlive.js';
import { createPassphraseRouter } from './routes/passphrase.js';

/** Update log threshold for triggering snapshot compression */
const SNAPSHOT_THRESHOLD = 100;

/** Cleanup interval (24 hours in milliseconds) */
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Dummy hash for timing attack prevention */
const DUMMY_HASH =
  '$2b$10$CwTycUXWue0Thq9StjUM0uJ8xB4kz14oJmVchVTD0JZ4F1qF7F5eG';

/** WebSocket server port */
const WS_PORT = Number(process.env.WS_PORT) || 3001;

/** API server port */
const API_PORT = Number(process.env.API_PORT) || 3002;

// Database row types
interface RoomRow {
  passphrase_hash: string | null;
}

interface SnapshotRow {
  snapshot_data: Buffer;
}

interface UpdateRow {
  update_data: Buffer;
}

interface CountRow {
  count: string;
}

/**
 * Creates and configures the PostgreSQL connection pool
 */
const createPool = (): Pool => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.warn(
      '[Database] DATABASE_URL not set, using default connection string'
    );
  }

  return new Pool({
    connectionString:
      connectionString || 'postgresql://postgres:password@localhost:5432/gridder',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
};

/**
 * Creates the Express API application
 */
const createApiApp = (pool: Pool): Application => {
  const app = express();

  // Middleware
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Passphrase routes
  app.use('/api', createPassphraseRouter(pool));

  return app;
};

/**
 * Creates the Database extension for PostgreSQL persistence
 */
const createDatabaseExtension = (pool: Pool): Database => {
  return new Database({
    /**
     * Fetches document state from database
     * Combines snapshot (if exists) with subsequent updates
     */
    fetch: async ({ documentName }) => {
      try {
        // Try to get snapshot first
        const snapshot = await pool.query<SnapshotRow>(
          'SELECT snapshot_data FROM room_snapshots WHERE room_id = $1',
          [documentName]
        );

        // Get all updates (or updates after snapshot)
        const updates = await pool.query<UpdateRow>(
          `SELECT update_data FROM room_updates
           WHERE room_id = $1
           ORDER BY id`,
          [documentName]
        );

        if (!snapshot.rows[0] && updates.rows.length === 0) {
          return null;
        }

        // Merge snapshot and updates
        const buffers: Buffer[] = [];

        if (snapshot.rows[0]) {
          buffers.push(snapshot.rows[0].snapshot_data);
        }

        for (const row of updates.rows) {
          buffers.push(row.update_data);
        }

        return Buffer.concat(buffers);
      } catch (error) {
        console.error('[Database] Error fetching document:', error);
        throw error;
      }
    },

    /**
     * Stores document update to database
     * Triggers snapshot compression when update count exceeds threshold
     */
    store: async ({ documentName, state, document }) => {
      try {
        // Store update
        await pool.query(
          'INSERT INTO room_updates (room_id, update_data) VALUES ($1, $2)',
          [documentName, state]
        );

        // Check update count for snapshot trigger
        const count = await pool.query<CountRow>(
          'SELECT COUNT(*) FROM room_updates WHERE room_id = $1',
          [documentName]
        );

        if (Number(count.rows[0].count) > SNAPSHOT_THRESHOLD) {
          console.log(
            `[Database] Update count exceeded ${SNAPSHOT_THRESHOLD} for ${documentName}, creating snapshot`
          );

          // Create snapshot and clear updates in transaction
          const fullState = Y.encodeStateAsUpdate(document);
          const client = await pool.connect();

          try {
            await client.query('BEGIN');

            await client.query(
              `INSERT INTO room_snapshots (room_id, snapshot_data, updated_at)
               VALUES ($1, $2, NOW())
               ON CONFLICT (room_id) DO UPDATE SET snapshot_data = $2, updated_at = NOW()`,
              [documentName, Buffer.from(fullState)]
            );

            await client.query('DELETE FROM room_updates WHERE room_id = $1', [
              documentName,
            ]);

            await client.query('COMMIT');
            console.log(`[Database] Snapshot created for ${documentName}`);
          } catch (error) {
            await client.query('ROLLBACK');
            throw error;
          } finally {
            client.release();
          }
        }
      } catch (error) {
        console.error('[Database] Error storing document:', error);
        throw error;
      }
    },
  });
};

/** Hocuspocus Server type (extracted from configure return) */
type HocuspocusServer = ReturnType<typeof Server.configure>;

/**
 * Creates and starts the Hocuspocus server
 */
const createHocuspocusServer = (pool: Pool): HocuspocusServer => {
  // Build extensions array
  const loggerExtension = new Logger({
    onLoadDocument: true,
    onChange: false,
    onConnect: true,
    onDisconnect: true,
    onDestroy: true,
  });

  const databaseExtension = createDatabaseExtension(pool);

  // Add Redis extension if configured
  const redisHost = process.env.REDIS_HOST;
  let redisExtension: Redis | null = null;

  if (redisHost) {
    redisExtension = new Redis({
      host: redisHost,
      port: Number(process.env.REDIS_PORT) || 6379,
    });
    console.log(`[Redis] Connecting to ${redisHost}:${process.env.REDIS_PORT || 6379}`);
  } else {
    console.log('[Redis] REDIS_HOST not set, running without Redis PubSub');
  }

  // Configure server with explicit typing
  const serverConfig = {
    port: WS_PORT,

    /**
     * Called when a document is loaded
     */
    async onLoadDocument({ documentName }: { documentName: string }) {
      registerActiveRoom(documentName);
    },

    /**
     * Called after a document is unloaded (no more connections)
     */
    async afterUnloadDocument({ documentName }: { documentName: string }) {
      unregisterActiveRoom(documentName);
    },

    /**
     * Authentication hook
     * Validates passphrase and creates room if needed
     */
    async onAuthenticate({ documentName, token }: { documentName: string; token: string }) {
      try {
        // Create room if it doesn't exist
        await pool.query(
          `INSERT INTO rooms (id, created_at, last_accessed_at)
           VALUES ($1, NOW(), NOW())
           ON CONFLICT (id) DO NOTHING`,
          [documentName]
        );

        // Get room passphrase
        const room = await pool.query<RoomRow>(
          'SELECT passphrase_hash FROM rooms WHERE id = $1',
          [documentName]
        );

        if (!room.rows[0]) {
          throw new Error('Room not found');
        }

        // Validate passphrase if set
        if (room.rows[0].passphrase_hash) {
          // Use timing-safe comparison
          // Always run bcrypt.compare to prevent timing attacks
          const isValid = token
            ? await bcrypt.compare(token, room.rows[0].passphrase_hash)
            : await bcrypt.compare('dummy', DUMMY_HASH);

          if (!isValid) {
            throw new Error('Invalid passphrase');
          }
        }

        // Update last accessed timestamp
        await pool.query(
          'UPDATE rooms SET last_accessed_at = NOW() WHERE id = $1',
          [documentName]
        );

        // Return user context
        return { userId: nanoid() };
      } catch (error) {
        console.error('[Auth] Authentication failed:', error);
        throw error;
      }
    },

    extensions: redisExtension
      ? [loggerExtension, databaseExtension, redisExtension]
      : [loggerExtension, databaseExtension],
  };

  return Server.configure(serverConfig);
};

/**
 * Main server startup function
 */
const main = async (): Promise<void> => {
  console.log('[Server] Starting Gridder Collaboration Server...');

  // Create database pool
  const pool = createPool();

  // Test database connection
  try {
    await pool.query('SELECT 1');
    console.log('[Database] Connection successful');
  } catch (error) {
    console.error('[Database] Connection failed:', error);
    process.exit(1);
  }

  // Create and start API server
  const apiApp = createApiApp(pool);
  apiApp.listen(API_PORT, () => {
    console.log(`[API] Server running on port ${API_PORT}`);
  });

  // Create and start Hocuspocus server
  const hocuspocusServer = createHocuspocusServer(pool);
  hocuspocusServer.listen();
  console.log(`[WebSocket] Server running on port ${WS_PORT}`);

  // Run initial cleanup
  await cleanupExpiredRooms(pool);

  // Schedule periodic cleanup
  setInterval(() => cleanupExpiredRooms(pool), CLEANUP_INTERVAL_MS);
  console.log(
    `[Cleanup] Scheduled every ${CLEANUP_INTERVAL_MS / 1000 / 60 / 60} hours`
  );

  // Start keep-alive for active rooms
  startKeepAlive(pool);

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.log('[Server] Shutting down...');
    stopKeepAlive();
    await hocuspocusServer.destroy();
    await pool.end();
    console.log('[Server] Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

// Start server
main().catch((error) => {
  console.error('[Server] Fatal error:', error);
  process.exit(1);
});
