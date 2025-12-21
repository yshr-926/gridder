import { describe, it, expect } from 'vitest';
import { generateId } from './id';

describe('generateId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateId('test');
    const id2 = generateId('test');
    expect(id1).not.toBe(id2);
  });

  it('should include prefix', () => {
    const id = generateId('obj');
    expect(id.startsWith('obj-')).toBe(true);
  });

  it('should use default prefix when not specified', () => {
    const id = generateId();
    expect(id.startsWith('obj-')).toBe(true);
  });
});
