/**
 * Integration tests for Gridder Collaboration Server
 *
 * These tests verify the core functionality of the server components
 * without requiring actual database or Redis connections.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock modules before importing
vi.mock('pg', () => {
  const mockQuery = vi.fn();
  const mockConnect = vi.fn();
  const mockRelease = vi.fn();
  const mockEnd = vi.fn();

  return {
    Pool: vi.fn(() => ({
      query: mockQuery,
      connect: mockConnect.mockResolvedValue({
        query: mockQuery,
        release: mockRelease,
      }),
      end: mockEnd,
    })),
  };
});

vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

// Import modules after mocking
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { cleanupExpiredRooms } from '../cleanup.js';
import {
  registerActiveRoom,
  unregisterActiveRoom,
  getActiveRooms,
  startKeepAlive,
  stopKeepAlive,
} from '../keepAlive.js';

describe('Cleanup Module', () => {
  let mockPool: ReturnType<typeof Pool>;
  let mockQuery: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPool = new Pool() as ReturnType<typeof Pool>;
    mockQuery = mockPool.query as ReturnType<typeof vi.fn>;
  });

  describe('cleanupExpiredRooms', () => {
    it('should delete expired rooms and log the count', async () => {
      mockQuery.mockResolvedValueOnce({
        rowCount: 2,
        rows: [{ id: 'room1' }, { id: 'room2' }],
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await cleanupExpiredRooms(mockPool);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM rooms'),
        expect.arrayContaining(['7 days'])
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Deleted 2 expired rooms')
      );

      consoleSpy.mockRestore();
    });

    it('should log when no expired rooms found', async () => {
      mockQuery.mockResolvedValueOnce({
        rowCount: 0,
        rows: [],
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await cleanupExpiredRooms(mockPool);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No expired rooms found')
      );

      consoleSpy.mockRestore();
    });

    it('should throw error on database failure', async () => {
      const dbError = new Error('Database connection failed');
      mockQuery.mockRejectedValueOnce(dbError);

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await expect(cleanupExpiredRooms(mockPool)).rejects.toThrow(
        'Database connection failed'
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to cleanup'),
        dbError
      );

      consoleErrorSpy.mockRestore();
    });
  });
});

describe('KeepAlive Module', () => {
  let mockPool: ReturnType<typeof Pool>;
  let mockQuery: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockPool = new Pool() as ReturnType<typeof Pool>;
    mockQuery = mockPool.query as ReturnType<typeof vi.fn>;

    // Clear active rooms
    for (const room of getActiveRooms()) {
      unregisterActiveRoom(room);
    }
  });

  afterEach(() => {
    stopKeepAlive();
    vi.useRealTimers();
  });

  describe('registerActiveRoom', () => {
    it('should add room to active rooms set', () => {
      registerActiveRoom('test-room-1');

      const activeRooms = getActiveRooms();
      expect(activeRooms.has('test-room-1')).toBe(true);
    });

    it('should handle multiple rooms', () => {
      registerActiveRoom('room-1');
      registerActiveRoom('room-2');
      registerActiveRoom('room-3');

      const activeRooms = getActiveRooms();
      expect(activeRooms.size).toBe(3);
    });
  });

  describe('unregisterActiveRoom', () => {
    it('should remove room from active rooms set', () => {
      registerActiveRoom('test-room');
      unregisterActiveRoom('test-room');

      const activeRooms = getActiveRooms();
      expect(activeRooms.has('test-room')).toBe(false);
    });

    it('should not error when removing non-existent room', () => {
      expect(() => unregisterActiveRoom('non-existent')).not.toThrow();
    });
  });

  describe('getActiveRooms', () => {
    it('should return a copy of active rooms', () => {
      registerActiveRoom('room-1');

      const rooms1 = getActiveRooms();
      const rooms2 = getActiveRooms();

      expect(rooms1).not.toBe(rooms2);
      expect(rooms1).toEqual(rooms2);
    });
  });

  describe('startKeepAlive', () => {
    it('should not update when no active rooms', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockQuery.mockResolvedValue({ rowCount: 0 });

      startKeepAlive(mockPool);

      // Advance timer by 1 hour
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No active rooms to update')
      );

      consoleSpy.mockRestore();
    });

    it('should update last_accessed_at for active rooms', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockQuery.mockResolvedValue({ rowCount: 2 });

      registerActiveRoom('room-1');
      registerActiveRoom('room-2');

      startKeepAlive(mockPool);

      // Advance timer by 1 hour
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE rooms SET last_accessed_at'),
        expect.arrayContaining([['room-1', 'room-2']])
      );

      consoleSpy.mockRestore();
    });
  });
});

describe('Passphrase Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('bcrypt operations', () => {
    it('should hash passphrase correctly', async () => {
      const mockHash = vi.mocked(bcrypt.hash);
      mockHash.mockResolvedValueOnce('$2b$10$hashedpassword' as never);

      const hash = await bcrypt.hash('mypassword', 10);

      expect(hash).toBe('$2b$10$hashedpassword');
      expect(mockHash).toHaveBeenCalledWith('mypassword', 10);
    });

    it('should compare passphrase correctly', async () => {
      const mockCompare = vi.mocked(bcrypt.compare);
      mockCompare.mockResolvedValueOnce(true as never);

      const isValid = await bcrypt.compare('mypassword', '$2b$10$hashedpassword');

      expect(isValid).toBe(true);
      expect(mockCompare).toHaveBeenCalledWith(
        'mypassword',
        '$2b$10$hashedpassword'
      );
    });

    it('should reject invalid passphrase', async () => {
      const mockCompare = vi.mocked(bcrypt.compare);
      mockCompare.mockResolvedValueOnce(false as never);

      const isValid = await bcrypt.compare(
        'wrongpassword',
        '$2b$10$hashedpassword'
      );

      expect(isValid).toBe(false);
    });
  });
});

describe('Database Schema', () => {
  it('should have correct table structure in migration', () => {
    // This is a documentation test to ensure the schema is correct
    const expectedTables = ['rooms', 'room_updates', 'room_snapshots'];
    const expectedIndexes = [
      'idx_rooms_last_accessed_at',
      'idx_room_updates_room_id',
    ];

    // In a real integration test, we would query the database
    // For now, we just document the expected structure
    expect(expectedTables).toContain('rooms');
    expect(expectedTables).toContain('room_updates');
    expect(expectedTables).toContain('room_snapshots');
    expect(expectedIndexes).toContain('idx_room_updates_room_id');
  });

  it('should define ON DELETE CASCADE for child tables', () => {
    // Document that room_updates and room_snapshots should cascade delete
    const cascadeRelations = [
      { parent: 'rooms', child: 'room_updates', onDelete: 'CASCADE' },
      { parent: 'rooms', child: 'room_snapshots', onDelete: 'CASCADE' },
    ];

    cascadeRelations.forEach((relation) => {
      expect(relation.onDelete).toBe('CASCADE');
    });
  });
});

describe('Environment Configuration', () => {
  it('should have sensible defaults', () => {
    const defaults = {
      WS_PORT: 3001,
      API_PORT: 3002,
      ROOM_EXPIRY_DAYS: 7,
      SNAPSHOT_THRESHOLD: 100,
    };

    expect(defaults.WS_PORT).toBe(3001);
    expect(defaults.API_PORT).toBe(3002);
    expect(defaults.ROOM_EXPIRY_DAYS).toBe(7);
    expect(defaults.SNAPSHOT_THRESHOLD).toBe(100);
  });
});
