import { describe, expect, it } from 'vitest';
import { createDeterministicRandom } from './deterministicRandom';

describe('createDeterministicRandom', () => {
  it('test_createDeterministicRandom_sameSeed_producesIdenticalSequences', () => {
    const a = createDeterministicRandom(42);
    const b = createDeterministicRandom(42);

    const sequenceA = Array.from({ length: 20 }, () => a.nextUint32());
    const sequenceB = Array.from({ length: 20 }, () => b.nextUint32());

    expect(sequenceA).toEqual(sequenceB);
  });

  it('test_createDeterministicRandom_differentSeeds_produceDifferentSequences', () => {
    const a = createDeterministicRandom(1);
    const b = createDeterministicRandom(2);

    const sequenceA = Array.from({ length: 20 }, () => a.nextUint32());
    const sequenceB = Array.from({ length: 20 }, () => b.nextUint32());

    expect(sequenceA).not.toEqual(sequenceB);
  });

  it('test_nextFloat_stayInZeroToOneRange_exclusiveOfOne', () => {
    const random = createDeterministicRandom(123);
    for (let i = 0; i < 1000; i += 1) {
      const value = random.nextFloat();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('test_nextInt_staysWithinInclusiveRange', () => {
    const random = createDeterministicRandom(7);
    for (let i = 0; i < 1000; i += 1) {
      const value = random.nextInt(3, 9);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(9);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('test_nextInt_minEqualsMax_alwaysReturnsThatValue', () => {
    const random = createDeterministicRandom(9);
    for (let i = 0; i < 10; i += 1) {
      expect(random.nextInt(5, 5)).toBe(5);
    }
  });

  it('test_nextInt_maxLessThanMin_throwsRangeError', () => {
    const random = createDeterministicRandom(9);
    expect(() => random.nextInt(5, 1)).toThrow(RangeError);
  });

  it('test_createDeterministicRandom_seedZero_doesNotGetStuckAtZero', () => {
    const random = createDeterministicRandom(0);
    const values = Array.from({ length: 5 }, () => random.nextUint32());
    expect(values.every((value) => value === 0)).toBe(false);
  });
});
