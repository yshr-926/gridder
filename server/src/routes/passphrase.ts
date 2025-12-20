/**
 * Passphrase management API routes
 *
 * Provides endpoints for setting and checking room passphrases.
 * Passphrases are hashed using bcrypt before storage.
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { Pool } from 'pg';

/** Number of bcrypt rounds for password hashing */
const BCRYPT_ROUNDS = 10;

/** Maximum passphrase length */
const MAX_PASSPHRASE_LENGTH = 128;

/** Minimum passphrase length */
const MIN_PASSPHRASE_LENGTH = 4;

interface SetPassphraseBody {
  passphrase?: string;
  currentToken?: string;
}

interface RoomRow {
  passphrase_hash: string | null;
}

interface HasPassphraseRow {
  has_passphrase: boolean;
}

/**
 * Creates the passphrase router with all endpoints
 *
 * @param pool - PostgreSQL connection pool
 * @returns Express router with passphrase endpoints
 */
export const createPassphraseRouter = (pool: Pool): Router => {
  const router = Router();

  /**
   * POST /rooms/:roomId/passphrase
   *
   * Sets or removes a passphrase for a room.
   *
   * Body:
   * - passphrase: New passphrase (empty/null to remove)
   * - currentToken: Current passphrase (required if room already has one)
   *
   * Responses:
   * - 200: Success
   * - 400: Invalid passphrase format
   * - 403: Current passphrase required or invalid
   * - 404: Room not found
   * - 500: Server error
   */
  router.post(
    '/rooms/:roomId/passphrase',
    async (req: Request<{ roomId: string }, unknown, SetPassphraseBody>, res: Response): Promise<void> => {
      const { roomId } = req.params;
      const { passphrase, currentToken } = req.body;

      // Validate passphrase format
      if (passphrase) {
        if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
          res.status(400).json({
            error: `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters`,
          });
          return;
        }
        if (passphrase.length > MAX_PASSPHRASE_LENGTH) {
          res.status(400).json({
            error: `Passphrase must be at most ${MAX_PASSPHRASE_LENGTH} characters`,
          });
          return;
        }
      }

      try {
        // Check if room exists
        const room = await pool.query<RoomRow>(
          'SELECT passphrase_hash FROM rooms WHERE id = $1',
          [roomId]
        );

        if (!room.rows[0]) {
          res.status(404).json({ error: 'Room not found' });
          return;
        }

        // Verify current passphrase if one exists
        if (room.rows[0].passphrase_hash) {
          if (!currentToken) {
            res.status(403).json({ error: 'Current passphrase required' });
            return;
          }
          const isValid = await bcrypt.compare(
            currentToken,
            room.rows[0].passphrase_hash
          );
          if (!isValid) {
            res.status(403).json({ error: 'Current passphrase invalid' });
            return;
          }
        }

        // Hash new passphrase or set to null to remove
        const hash = passphrase
          ? await bcrypt.hash(passphrase, BCRYPT_ROUNDS)
          : null;

        await pool.query('UPDATE rooms SET passphrase_hash = $1 WHERE id = $2', [
          hash,
          roomId,
        ]);

        res.json({ success: true, hasPassphrase: !!passphrase });
      } catch (error) {
        console.error('[Passphrase] Error setting passphrase:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  /**
   * GET /rooms/:roomId/has-passphrase
   *
   * Checks if a room has a passphrase set.
   *
   * Responses:
   * - 200: { hasPassphrase: boolean }
   * - 404: Room not found
   * - 500: Server error
   */
  router.get(
    '/rooms/:roomId/has-passphrase',
    async (req: Request<{ roomId: string }>, res: Response): Promise<void> => {
      const { roomId } = req.params;

      try {
        const room = await pool.query<HasPassphraseRow>(
          'SELECT passphrase_hash IS NOT NULL AS has_passphrase FROM rooms WHERE id = $1',
          [roomId]
        );

        if (!room.rows[0]) {
          res.status(404).json({ error: 'Room not found' });
          return;
        }

        res.json({ hasPassphrase: room.rows[0].has_passphrase });
      } catch (error) {
        console.error('[Passphrase] Error checking passphrase:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  return router;
};
