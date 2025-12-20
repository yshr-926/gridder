/**
 * Expired room cleanup module
 *
 * Handles automatic deletion of rooms that haven't been accessed
 * within the configured expiry period (default: 7 days).
 */

import { Pool } from 'pg';

/** Default expiry period in days */
const ROOM_EXPIRY_DAYS = 7;

/**
 * Deletes expired rooms from the database
 *
 * Rooms are considered expired if their last_accessed_at timestamp
 * is older than ROOM_EXPIRY_DAYS days from now.
 *
 * Related data (room_updates, room_snapshots) will be automatically
 * deleted due to ON DELETE CASCADE constraints.
 *
 * @param pool - PostgreSQL connection pool
 * @returns Promise that resolves when cleanup is complete
 */
export const cleanupExpiredRooms = async (pool: Pool): Promise<void> => {
  try {
    const result = await pool.query(
      `DELETE FROM rooms
       WHERE last_accessed_at < NOW() - INTERVAL $1
       RETURNING id`,
      [`${ROOM_EXPIRY_DAYS} days`]
    );

    if (result.rowCount && result.rowCount > 0) {
      const deletedIds = result.rows.map((r: { id: string }) => r.id).join(', ');
      console.log(`[Cleanup] Deleted ${result.rowCount} expired rooms: ${deletedIds}`);
    } else {
      console.log('[Cleanup] No expired rooms found');
    }
  } catch (error) {
    console.error('[Cleanup] Failed to cleanup expired rooms:', error);
    throw error;
  }
};
