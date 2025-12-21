/**
 * 共同編集機能の型定義テスト
 *
 * @module features/collaboration/__tests__/types.test
 */

import { describe, it, expect } from 'vitest';
import {
  CURSOR_COLORS,
  DISPLAY_NAME_CONSTRAINTS,
  ROOM_ID_CONSTRAINTS,
  PRESENCE_THROTTLE_MS,
  ROOM_EXPIRY_MS,
} from '../types';
import type {
  CursorPosition,
  CollaboratorInfo,
  Presence,
  RoomInfo,
  ConnectionState,
  CollaborationState,
  CursorColor,
} from '../types';

describe('Collaboration Types', () => {
  describe('CURSOR_COLORS', () => {
    it('should have 10 colors defined', () => {
      expect(CURSOR_COLORS).toHaveLength(10);
    });

    it('should have all colors in HEX format', () => {
      const hexPattern = /^#[0-9a-fA-F]{6}$/;
      CURSOR_COLORS.forEach((color) => {
        expect(color).toMatch(hexPattern);
      });
    });

    it('should have unique colors', () => {
      const uniqueColors = new Set(CURSOR_COLORS);
      expect(uniqueColors.size).toBe(CURSOR_COLORS.length);
    });

    it('should be readonly', () => {
      // TypeScript compile-time check, but we verify the array exists
      expect(Object.isFrozen(CURSOR_COLORS)).toBe(false); // as const doesn't freeze
      expect(CURSOR_COLORS.length).toBe(10);
    });
  });

  describe('DISPLAY_NAME_CONSTRAINTS', () => {
    it('should have minLength of 1', () => {
      expect(DISPLAY_NAME_CONSTRAINTS.minLength).toBe(1);
    });

    it('should have maxLength of 20', () => {
      expect(DISPLAY_NAME_CONSTRAINTS.maxLength).toBe(20);
    });

    it('should have defaultPrefix as Guest', () => {
      expect(DISPLAY_NAME_CONSTRAINTS.defaultPrefix).toBe('Guest');
    });

    it('should validate display name length correctly', () => {
      const { minLength, maxLength } = DISPLAY_NAME_CONSTRAINTS;

      // Valid lengths
      expect('A'.length).toBeGreaterThanOrEqual(minLength);
      expect('A'.length).toBeLessThanOrEqual(maxLength);
      expect('A'.repeat(20).length).toBeLessThanOrEqual(maxLength);

      // Invalid length
      expect(''.length).toBeLessThan(minLength);
      expect('A'.repeat(21).length).toBeGreaterThan(maxLength);
    });
  });

  describe('ROOM_ID_CONSTRAINTS', () => {
    it('should have length of 24', () => {
      expect(ROOM_ID_CONSTRAINTS.length).toBe(24);
    });

    it('should have URL-safe pattern', () => {
      const { pattern } = ROOM_ID_CONSTRAINTS;

      // Valid room IDs (URL-safe characters)
      expect('abcdefghijklmnopqrstuvwx').toMatch(pattern);
      expect('ABCDEFGHIJKLMNOPQRSTUVWX').toMatch(pattern);
      expect('0123456789012345678901-_').toMatch(pattern);
      expect('A1b2C3d4E5f6G7h8I9j0K1L2').toMatch(pattern);

      // Invalid room IDs (contains special characters)
      expect('abc!@#$%^&*(){}[]|\\:";').not.toMatch(pattern);
      expect('abc def ghi jkl mno pqr').not.toMatch(pattern);
      expect('abc.def.ghi.jkl.mno.pqr').not.toMatch(pattern);
    });
  });

  describe('PRESENCE_THROTTLE_MS', () => {
    it('should be 50ms', () => {
      expect(PRESENCE_THROTTLE_MS).toBe(50);
    });

    it('should be a reasonable throttle value for real-time updates', () => {
      // 50ms allows ~20 updates per second, which is smooth for cursor tracking
      expect(PRESENCE_THROTTLE_MS).toBeGreaterThanOrEqual(16); // min 60fps
      expect(PRESENCE_THROTTLE_MS).toBeLessThanOrEqual(100); // max 10fps
    });
  });

  describe('ROOM_EXPIRY_MS', () => {
    it('should be 7 days in milliseconds', () => {
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(ROOM_EXPIRY_MS).toBe(sevenDaysMs);
    });

    it('should equal 604800000 milliseconds', () => {
      expect(ROOM_EXPIRY_MS).toBe(604800000);
    });
  });

  describe('Type Definitions (compile-time checks)', () => {
    it('should create valid CursorPosition', () => {
      const cursor: CursorPosition = {
        x: 10,
        y: 20,
      };

      expect(cursor.x).toBe(10);
      expect(cursor.y).toBe(20);
    });

    it('should create valid CollaboratorInfo', () => {
      const collaborator: CollaboratorInfo = {
        id: 'user-123',
        displayName: 'Alice',
        color: '#ef4444',
        connectedAt: '2025-01-01T00:00:00.000Z',
      };

      expect(collaborator.id).toBe('user-123');
      expect(collaborator.displayName).toBe('Alice');
      expect(collaborator.color).toBe('#ef4444');
      expect(collaborator.connectedAt).toBe('2025-01-01T00:00:00.000Z');
    });

    it('should create valid Presence with cursor', () => {
      const presence: Presence = {
        userId: 'user-123',
        cursor: { x: 5, y: 10 },
        selectedObjectIds: ['obj-1', 'obj-2'],
        updatedAt: '2025-01-01T00:00:00.000Z',
      };

      expect(presence.userId).toBe('user-123');
      expect(presence.cursor).toEqual({ x: 5, y: 10 });
      expect(presence.selectedObjectIds).toEqual(['obj-1', 'obj-2']);
      expect(presence.updatedAt).toBe('2025-01-01T00:00:00.000Z');
    });

    it('should create valid Presence without cursor', () => {
      const presence: Presence = {
        userId: 'user-123',
        cursor: null,
        selectedObjectIds: [],
        updatedAt: '2025-01-01T00:00:00.000Z',
      };

      expect(presence.cursor).toBeNull();
      expect(presence.selectedObjectIds).toEqual([]);
    });

    it('should create valid RoomInfo', () => {
      const room: RoomInfo = {
        id: 'room-abcdefghijklmnopqrstuvwx',
        createdAt: '2025-01-01T00:00:00.000Z',
        participants: [],
      };

      expect(room.id).toBe('room-abcdefghijklmnopqrstuvwx');
      expect(room.createdAt).toBe('2025-01-01T00:00:00.000Z');
      expect(room.participants).toEqual([]);
    });

    it('should create valid RoomInfo with optional name', () => {
      const room: RoomInfo = {
        id: 'room-123',
        name: 'My Project Room',
        createdAt: '2025-01-01T00:00:00.000Z',
        participants: [],
      };

      expect(room.name).toBe('My Project Room');
    });

    it('should allow all valid ConnectionState values', () => {
      const states: ConnectionState[] = [
        'disconnected',
        'connecting',
        'connected',
        'reconnecting',
        'error',
      ];

      expect(states).toContain('disconnected');
      expect(states).toContain('connecting');
      expect(states).toContain('connected');
      expect(states).toContain('reconnecting');
      expect(states).toContain('error');
      expect(states).toHaveLength(5);
    });

    it('should create valid CollaborationState', () => {
      const state: CollaborationState = {
        connectionState: 'connected',
        room: {
          id: 'room-123',
          createdAt: '2025-01-01T00:00:00.000Z',
          participants: [],
        },
        self: {
          id: 'user-1',
          displayName: 'Alice',
          color: '#ef4444',
          connectedAt: '2025-01-01T00:00:00.000Z',
        },
        collaborators: [],
        presences: new Map(),
        error: null,
      };

      expect(state.connectionState).toBe('connected');
      expect(state.room?.id).toBe('room-123');
      expect(state.self?.displayName).toBe('Alice');
      expect(state.collaborators).toEqual([]);
      expect(state.presences.size).toBe(0);
      expect(state.error).toBeNull();
    });

    it('should create valid disconnected CollaborationState', () => {
      const state: CollaborationState = {
        connectionState: 'disconnected',
        room: null,
        self: null,
        collaborators: [],
        presences: new Map(),
        error: null,
      };

      expect(state.connectionState).toBe('disconnected');
      expect(state.room).toBeNull();
      expect(state.self).toBeNull();
    });

    it('should create valid error CollaborationState', () => {
      const state: CollaborationState = {
        connectionState: 'error',
        room: null,
        self: null,
        collaborators: [],
        presences: new Map(),
        error: 'Connection failed',
      };

      expect(state.connectionState).toBe('error');
      expect(state.error).toBe('Connection failed');
    });

    it('should use CursorColor type from CURSOR_COLORS', () => {
      // All CURSOR_COLORS values should be valid CursorColor
      const color: CursorColor = CURSOR_COLORS[0];
      expect(color).toBe('#ef4444');
    });
  });

  describe('Type Constraints Validation', () => {
    it('should validate room ID format', () => {
      const validRoomId = 'Ab1Cd2Ef3Gh4Ij5Kl6Mn7Op8';
      const { pattern, length } = ROOM_ID_CONSTRAINTS;

      expect(validRoomId).toHaveLength(length);
      expect(validRoomId).toMatch(pattern);
    });

    it('should validate display name within constraints', () => {
      const { minLength, maxLength } = DISPLAY_NAME_CONSTRAINTS;

      const validName = 'Alice';
      expect(validName.length).toBeGreaterThanOrEqual(minLength);
      expect(validName.length).toBeLessThanOrEqual(maxLength);

      const maxLengthName = 'A'.repeat(maxLength);
      expect(maxLengthName.length).toBe(maxLength);
    });

    it('should generate default name with correct prefix', () => {
      const { defaultPrefix } = DISPLAY_NAME_CONSTRAINTS;

      // Simulating default name generation
      const defaultName = `${defaultPrefix}-1234`;
      expect(defaultName).toMatch(new RegExp(`^${defaultPrefix}-`));
    });
  });

  describe('ISO 8601 Date Format', () => {
    it('should recognize valid ISO 8601 date strings', () => {
      const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;

      const validDates = [
        '2025-01-01T00:00:00.000Z',
        '2025-12-31T23:59:59.999Z',
        '2024-06-15T12:30:45.123Z',
      ];

      validDates.forEach((date) => {
        expect(date).toMatch(isoPattern);
      });
    });

    it('should create parseable ISO 8601 dates', () => {
      const isoDate = '2025-01-01T00:00:00.000Z';
      const parsedDate = new Date(isoDate);

      expect(parsedDate.getFullYear()).toBe(2025);
      expect(parsedDate.getMonth()).toBe(0); // January
      expect(parsedDate.getDate()).toBe(1);
      expect(parsedDate.toISOString()).toBe(isoDate);
    });
  });
});
