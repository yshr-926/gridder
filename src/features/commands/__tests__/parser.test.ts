import { describe, it, expect } from 'vitest';
import {
  parseCommand,
  parseCoordinate,
  parseRelativeCoordinate,
  resolveCoordinate,
  isCoordinateArg,
  isRelativeCoordinate,
} from '../parser';

describe('parser', () => {
  describe('parseCommand', () => {
    it('should parse a simple command', () => {
      const result = parseCommand('LINE');
      expect(result).toEqual({
        name: 'LINE',
        args: [],
        raw: 'LINE',
      });
    });

    it('should parse command with arguments', () => {
      const result = parseCommand('RECT 0,0 10,10');
      expect(result).toEqual({
        name: 'RECT',
        args: ['0,0', '10,10'],
        raw: 'RECT 0,0 10,10',
      });
    });

    it('should convert command name to uppercase', () => {
      const result = parseCommand('line 0,0 10,10');
      expect(result?.name).toBe('LINE');
    });

    it('should handle mixed case command names', () => {
      const result = parseCommand('LiNe');
      expect(result?.name).toBe('LINE');
    });

    it('should trim whitespace', () => {
      const result = parseCommand('  LINE 0,0  ');
      expect(result?.name).toBe('LINE');
      expect(result?.args).toEqual(['0,0']);
    });

    it('should return null for empty input', () => {
      expect(parseCommand('')).toBeNull();
      expect(parseCommand('   ')).toBeNull();
    });

    it('should parse numeric arguments', () => {
      const result = parseCommand('ZOOM 2');
      expect(result?.args).toEqual([2]);
    });

    it('should parse float arguments', () => {
      const result = parseCommand('SCALE 1.5');
      expect(result?.args).toEqual([1.5]);
    });

    it('should parse negative numbers', () => {
      const result = parseCommand('MOVE -5 -10');
      expect(result?.args).toEqual([-5, -10]);
    });

    it('should parse boolean arguments', () => {
      const result = parseCommand('GRID true');
      expect(result?.args).toEqual([true]);

      const result2 = parseCommand('SNAP FALSE');
      expect(result2?.args).toEqual([false]);
    });

    it('should handle multiple spaces between arguments', () => {
      const result = parseCommand('LINE   0,0    10,10');
      expect(result?.args).toEqual(['0,0', '10,10']);
    });

    it('should preserve coordinate strings', () => {
      const result = parseCommand('RECT 5,10 15,20');
      expect(result?.args).toEqual(['5,10', '15,20']);
    });

    it('should preserve relative coordinate strings', () => {
      const result = parseCommand('LINE 0,0 @10,5');
      expect(result?.args).toEqual(['0,0', '@10,5']);
    });
  });

  describe('parseCoordinate', () => {
    it('should parse valid coordinate string', () => {
      expect(parseCoordinate('5,10')).toEqual({ x: 5, y: 10 });
    });

    it('should parse negative coordinates', () => {
      expect(parseCoordinate('-5,-10')).toEqual({ x: -5, y: -10 });
    });

    it('should parse float coordinates', () => {
      expect(parseCoordinate('1.5,2.5')).toEqual({ x: 1.5, y: 2.5 });
    });

    it('should parse zero coordinates', () => {
      expect(parseCoordinate('0,0')).toEqual({ x: 0, y: 0 });
    });

    it('should return null for non-string arguments', () => {
      expect(parseCoordinate(42)).toBeNull();
      expect(parseCoordinate(true)).toBeNull();
    });

    it('should return null for relative coordinates', () => {
      expect(parseCoordinate('@5,10')).toBeNull();
    });

    it('should return null for invalid format', () => {
      expect(parseCoordinate('abc')).toBeNull();
      expect(parseCoordinate('5')).toBeNull();
      expect(parseCoordinate('5,10,15')).toBeNull();
    });

    it('should return null for NaN values', () => {
      expect(parseCoordinate('abc,10')).toBeNull();
      expect(parseCoordinate('5,xyz')).toBeNull();
    });

    it('should return null for infinity', () => {
      expect(parseCoordinate('Infinity,10')).toBeNull();
    });
  });

  describe('parseRelativeCoordinate', () => {
    const basePoint = { x: 10, y: 20 };

    it('should parse relative coordinate from base point', () => {
      expect(parseRelativeCoordinate('@5,10', basePoint)).toEqual({
        x: 15,
        y: 30,
      });
    });

    it('should handle negative relative values', () => {
      expect(parseRelativeCoordinate('@-5,-10', basePoint)).toEqual({
        x: 5,
        y: 10,
      });
    });

    it('should handle float relative values', () => {
      expect(parseRelativeCoordinate('@1.5,2.5', basePoint)).toEqual({
        x: 11.5,
        y: 22.5,
      });
    });

    it('should return null for non-relative strings', () => {
      expect(parseRelativeCoordinate('5,10', basePoint)).toBeNull();
    });

    it('should return null for non-string arguments', () => {
      expect(parseRelativeCoordinate(42, basePoint)).toBeNull();
    });

    it('should return null for invalid format', () => {
      expect(parseRelativeCoordinate('@abc', basePoint)).toBeNull();
      expect(parseRelativeCoordinate('@5', basePoint)).toBeNull();
    });

    it('should return null for NaN values', () => {
      expect(parseRelativeCoordinate('@abc,10', basePoint)).toBeNull();
    });
  });

  describe('resolveCoordinate', () => {
    const basePoint = { x: 10, y: 20 };

    it('should resolve absolute coordinates', () => {
      expect(resolveCoordinate('5,10', null)).toEqual({ x: 5, y: 10 });
      expect(resolveCoordinate('5,10', basePoint)).toEqual({ x: 5, y: 10 });
    });

    it('should resolve relative coordinates with base point', () => {
      expect(resolveCoordinate('@5,10', basePoint)).toEqual({
        x: 15,
        y: 30,
      });
    });

    it('should return null for relative coordinates without base point', () => {
      expect(resolveCoordinate('@5,10', null)).toBeNull();
    });

    it('should return null for non-string arguments', () => {
      expect(resolveCoordinate(42, basePoint)).toBeNull();
    });

    it('should return null for invalid formats', () => {
      expect(resolveCoordinate('invalid', basePoint)).toBeNull();
    });
  });

  describe('isCoordinateArg', () => {
    it('should return true for absolute coordinates', () => {
      expect(isCoordinateArg('5,10')).toBe(true);
      expect(isCoordinateArg('-5,-10')).toBe(true);
      expect(isCoordinateArg('1.5,2.5')).toBe(true);
    });

    it('should return true for relative coordinates', () => {
      expect(isCoordinateArg('@5,10')).toBe(true);
      expect(isCoordinateArg('@-5,-10')).toBe(true);
    });

    it('should return false for non-string arguments', () => {
      expect(isCoordinateArg(42)).toBe(false);
      expect(isCoordinateArg(true)).toBe(false);
    });

    it('should return false for non-coordinate strings', () => {
      expect(isCoordinateArg('abc')).toBe(false);
      expect(isCoordinateArg('42')).toBe(false);
    });
  });

  describe('isRelativeCoordinate', () => {
    it('should return true for relative coordinates', () => {
      expect(isRelativeCoordinate('@5,10')).toBe(true);
      expect(isRelativeCoordinate('@-5,-10')).toBe(true);
    });

    it('should return false for absolute coordinates', () => {
      expect(isRelativeCoordinate('5,10')).toBe(false);
    });

    it('should return false for non-string arguments', () => {
      expect(isRelativeCoordinate(42)).toBe(false);
      expect(isRelativeCoordinate(true)).toBe(false);
    });

    it('should return true for @ prefix even without valid coordinate format', () => {
      // isRelativeCoordinate only checks for @ prefix, not coordinate validity
      // Use parseRelativeCoordinate for actual coordinate parsing
      expect(isRelativeCoordinate('@abc')).toBe(true);
    });
  });
});
