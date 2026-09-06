/**
 * Deterministic pseudo-random generator for benchmark fixture generation
 * (issue #57). `Math.random` produces a different fixture on every run, which
 * would make frame-time measurements impossible to compare across sessions —
 * this generator only ever depends on its `seed`, so the same seed always
 * lays out the same 500 shapes / 50,000 cells.
 *
 * xorshift32 (Marsaglia): small, fast, and good enough for laying out
 * benchmark geometry — no cryptographic property is required here.
 */
export interface DeterministicRandom {
  /** Next unsigned 32-bit integer. */
  nextUint32: () => number;
  /** Next float in [0, 1). */
  nextFloat: () => number;
  /** Next integer in [min, max] inclusive. */
  nextInt: (min: number, max: number) => number;
}

/** A seed of 0 would leave xorshift32 stuck at 0 forever; nudge it instead. */
const sanitizeSeed = (seed: number): number => {
  const truncated = Math.trunc(seed) >>> 0;
  return truncated === 0 ? 1 : truncated;
};

export const createDeterministicRandom = (seed: number): DeterministicRandom => {
  let state = sanitizeSeed(seed);

  const nextUint32 = (): number => {
    // xorshift32
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state;
  };

  const nextFloat = (): number => nextUint32() / 0x100000000;

  const nextInt = (min: number, max: number): number => {
    if (max < min) {
      throw new RangeError('nextInt: max must be >= min');
    }
    const span = max - min + 1;
    return min + Math.floor(nextFloat() * span);
  };

  return { nextUint32, nextFloat, nextInt };
};
