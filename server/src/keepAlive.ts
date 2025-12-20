/**
 * Keep-alive module for long-running connections
 *
 * Periodically updates the last_accessed_at timestamp for rooms
 * with active connections to prevent them from being deleted
 * by the cleanup process.
 */

import { Pool } from 'pg';

/** Interval for updating last_accessed_at (1 hour in milliseconds) */
const KEEP_ALIVE_INTERVAL_MS = 60 * 60 * 1000;

/** Set of currently active room IDs */
const activeRooms = new Set<string>();

/** Timer reference for cleanup on shutdown */
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Registers a room as active (has connected clients)
 *
 * @param roomId - The room ID to register
 */
export const registerActiveRoom = (roomId: string): void => {
  activeRooms.add(roomId);
  console.log(`[KeepAlive] Registered active room: ${roomId}`);
};

/**
 * Unregisters a room (no more connected clients)
 *
 * @param roomId - The room ID to unregister
 */
export const unregisterActiveRoom = (roomId: string): void => {
  activeRooms.delete(roomId);
  console.log(`[KeepAlive] Unregistered room: ${roomId}`);
};

/**
 * Gets the current set of active rooms
 *
 * @returns A copy of the active rooms set
 */
export const getActiveRooms = (): Set<string> => {
  return new Set(activeRooms);
};

/**
 * Starts the keep-alive timer that periodically updates
 * last_accessed_at for all active rooms.
 *
 * @param pool - PostgreSQL connection pool
 */
export const startKeepAlive = (pool: Pool): void => {
  if (keepAliveTimer) {
    console.warn('[KeepAlive] Timer already running');
    return;
  }

  keepAliveTimer = setInterval(async () => {
    if (activeRooms.size === 0) {
      console.log('[KeepAlive] No active rooms to update');
      return;
    }

    const roomIds = Array.from(activeRooms);

    try {
      const result = await pool.query(
        `UPDATE rooms SET last_accessed_at = NOW() WHERE id = ANY($1)`,
        [roomIds]
      );

      console.log(
        `[KeepAlive] Updated last_accessed_at for ${result.rowCount} active rooms`
      );
    } catch (error) {
      console.error('[KeepAlive] Failed to update active rooms:', error);
    }
  }, KEEP_ALIVE_INTERVAL_MS);

  console.log(
    `[KeepAlive] Started with interval: ${KEEP_ALIVE_INTERVAL_MS / 1000}s`
  );
};

/**
 * Stops the keep-alive timer
 */
export const stopKeepAlive = (): void => {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
    console.log('[KeepAlive] Stopped');
  }
};
