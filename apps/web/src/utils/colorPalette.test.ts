import { describe, it, expect, beforeEach } from 'vitest';
import {
  OBJECT_COLOR_PALETTE,
  ColorPaletteManager,
  isPaletteColor,
  colorPaletteManager,
  getNextObjectColor,
} from './colorPalette';

describe('OBJECT_COLOR_PALETTE', () => {
  it('should have 12 colors', () => {
    expect(OBJECT_COLOR_PALETTE.length).toBe(12);
  });

  it('should have all unique colors', () => {
    const uniqueColors = new Set(OBJECT_COLOR_PALETTE);
    expect(uniqueColors.size).toBe(OBJECT_COLOR_PALETTE.length);
  });

  it('should have valid hex color format', () => {
    const hexColorRegex = /^#[0-9a-f]{6}$/i;
    for (const color of OBJECT_COLOR_PALETTE) {
      expect(color).toMatch(hexColorRegex);
    }
  });
});

describe('isPaletteColor', () => {
  it('should return true for palette colors', () => {
    expect(isPaletteColor('#3b82f6')).toBe(true);
    expect(isPaletteColor('#ef4444')).toBe(true);
  });

  it('should return false for non-palette colors', () => {
    expect(isPaletteColor('#000000')).toBe(false);
    expect(isPaletteColor('#ffffff')).toBe(false);
    expect(isPaletteColor('invalid')).toBe(false);
  });
});

describe('ColorPaletteManager', () => {
  let manager: ColorPaletteManager;

  beforeEach(() => {
    manager = new ColorPaletteManager();
  });

  describe('getNextColor', () => {
    it('should return the first color when no colors are used', () => {
      expect(manager.getNextColor()).toBe(OBJECT_COLOR_PALETTE[0]);
    });

    it('should return different colors on consecutive calls with recording', () => {
      const color1 = manager.getNextColor();
      manager.recordColorUsage(color1);

      const color2 = manager.getNextColor();
      manager.recordColorUsage(color2);

      expect(color1).not.toBe(color2);
    });

    it('should cycle through all colors before repeating', () => {
      const usedColors = new Set<string>();
      for (let i = 0; i < OBJECT_COLOR_PALETTE.length; i++) {
        const color = manager.getNextColor();
        manager.recordColorUsage(color);
        usedColors.add(color);
      }
      expect(usedColors.size).toBe(OBJECT_COLOR_PALETTE.length);
    });

    it('should return first color again after all colors are used once', () => {
      // Use all colors once
      for (let i = 0; i < OBJECT_COLOR_PALETTE.length; i++) {
        const color = manager.getNextColor();
        manager.recordColorUsage(color);
      }

      // Next color should be first color (all have usage count of 1)
      expect(manager.getNextColor()).toBe(OBJECT_COLOR_PALETTE[0]);
    });
  });

  describe('recordColorUsage', () => {
    it('should track color usage', () => {
      const color = OBJECT_COLOR_PALETTE[0];
      manager.recordColorUsage(color);
      manager.recordColorUsage(color);

      // First color has 2 usages, so next should be second color
      expect(manager.getNextColor()).toBe(OBJECT_COLOR_PALETTE[1]);
    });

    it('should not track non-palette colors', () => {
      manager.recordColorUsage('#000000');
      manager.recordColorUsage('#ffffff');

      // Non-palette colors should not affect next color selection
      expect(manager.getNextColor()).toBe(OBJECT_COLOR_PALETTE[0]);
    });
  });

  describe('releaseColor', () => {
    it('should decrement color usage count', () => {
      const color = OBJECT_COLOR_PALETTE[0];
      manager.recordColorUsage(color);
      manager.recordColorUsage(color);

      manager.releaseColor(color);

      // After release, first color has 1 usage
      // Second color has 0 usage, so it should be selected
      expect(manager.getNextColor()).toBe(OBJECT_COLOR_PALETTE[1]);
    });

    it('should not decrement below zero', () => {
      const color = OBJECT_COLOR_PALETTE[0];
      manager.releaseColor(color); // Already at 0
      manager.releaseColor(color); // Should not go negative

      const stats = manager.getUsageStats();
      expect(stats.get(color) ?? 0).toBe(0);
    });

    it('should allow released color to be reused', () => {
      // Use first 3 colors
      for (let i = 0; i < 3; i++) {
        const color = manager.getNextColor();
        manager.recordColorUsage(color);
      }

      // Release first color
      manager.releaseColor(OBJECT_COLOR_PALETTE[0]);

      // Next color should be first (0 usage) or fourth (0 usage)
      // First should be selected due to palette order priority
      expect(manager.getNextColor()).toBe(OBJECT_COLOR_PALETTE[0]);
    });

    it('should not track non-palette colors', () => {
      manager.releaseColor('#000000');
      // Should not throw and should not affect anything
      expect(manager.getNextColor()).toBe(OBJECT_COLOR_PALETTE[0]);
    });
  });

  describe('initializeFromObjects', () => {
    it('should initialize from objects array', () => {
      const objects = [
        { color: OBJECT_COLOR_PALETTE[0] },
        { color: OBJECT_COLOR_PALETTE[0] },
        { color: OBJECT_COLOR_PALETTE[1] },
      ];

      manager.initializeFromObjects(objects);

      // First color: 2 usages, Second color: 1 usage, Third color: 0 usages
      expect(manager.getNextColor()).toBe(OBJECT_COLOR_PALETTE[2]);
    });

    it('should reset before initializing', () => {
      // Pre-populate some usage
      manager.recordColorUsage(OBJECT_COLOR_PALETTE[5]);

      // Initialize with different objects
      const objects = [{ color: OBJECT_COLOR_PALETTE[0] }];
      manager.initializeFromObjects(objects);

      // Previous usage should be cleared
      const stats = manager.getUsageStats();
      expect(stats.get(OBJECT_COLOR_PALETTE[5])).toBeUndefined();
      expect(stats.get(OBJECT_COLOR_PALETTE[0])).toBe(1);
    });

    it('should ignore non-palette colors in objects', () => {
      const objects = [
        { color: '#000000' }, // Non-palette color
        { color: OBJECT_COLOR_PALETTE[0] },
      ];

      manager.initializeFromObjects(objects);

      const stats = manager.getUsageStats();
      expect(stats.get('#000000')).toBeUndefined();
      expect(stats.get(OBJECT_COLOR_PALETTE[0])).toBe(1);
    });

    it('should handle empty objects array', () => {
      manager.initializeFromObjects([]);
      expect(manager.getNextColor()).toBe(OBJECT_COLOR_PALETTE[0]);
    });
  });

  describe('reset', () => {
    it('should clear all usage data', () => {
      manager.recordColorUsage(OBJECT_COLOR_PALETTE[0]);
      manager.recordColorUsage(OBJECT_COLOR_PALETTE[1]);

      manager.reset();

      expect(manager.getNextColor()).toBe(OBJECT_COLOR_PALETTE[0]);
      expect(manager.getUsageStats().size).toBe(0);
    });
  });
});

describe('colorPaletteManager singleton', () => {
  beforeEach(() => {
    colorPaletteManager.reset();
  });

  it('should be a single instance', () => {
    expect(colorPaletteManager).toBeInstanceOf(ColorPaletteManager);
  });
});

describe('getNextObjectColor', () => {
  beforeEach(() => {
    colorPaletteManager.reset();
  });

  it('should return a color and record its usage', () => {
    const color1 = getNextObjectColor();
    expect(color1).toBe(OBJECT_COLOR_PALETTE[0]);

    const color2 = getNextObjectColor();
    expect(color2).toBe(OBJECT_COLOR_PALETTE[1]);
  });

  it('should cycle through all colors', () => {
    const colors = [];
    for (let i = 0; i < OBJECT_COLOR_PALETTE.length; i++) {
      colors.push(getNextObjectColor());
    }

    expect(new Set(colors).size).toBe(OBJECT_COLOR_PALETTE.length);
  });
});
