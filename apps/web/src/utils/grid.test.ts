import { describe, it, expect } from 'vitest';
import { snapToGrid, pixelToCell, cellToPixel } from './grid';

describe('snapToGrid', () => {
  it('should snap position to nearest grid point', () => {
    const result = snapToGrid({ x: 23, y: 37 }, 20);
    expect(result).toEqual({ x: 20, y: 40 });
  });

  it('should handle exact grid positions', () => {
    const result = snapToGrid({ x: 40, y: 60 }, 20);
    expect(result).toEqual({ x: 40, y: 60 });
  });
});

describe('pixelToCell', () => {
  it('should convert pixel position to cell coordinates', () => {
    const result = pixelToCell({ x: 45, y: 67 }, 20);
    expect(result).toEqual({ x: 2, y: 3 });
  });
});

describe('cellToPixel', () => {
  it('should convert cell coordinates to pixel position', () => {
    const result = cellToPixel({ x: 2, y: 3 }, 20);
    expect(result).toEqual({ x: 40, y: 60 });
  });
});
