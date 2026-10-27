/**
 * Fair randomness for Bill Roulette: crypto.getRandomValues with rejection sampling,
 * so every outcome is exactly equally likely (no modulo bias).
 */

export type RandomSource = (buffer: Uint32Array<ArrayBuffer>) => Uint32Array<ArrayBuffer>;

const cryptoSource: RandomSource = (buffer) => {
  crypto.getRandomValues(buffer);
  return buffer;
};

const RANGE = 2 ** 32;

/** A uniformly random integer in [0, n). */
export function randomInt(n: number, source: RandomSource = cryptoSource): number {
  if (!Number.isInteger(n) || n <= 0 || n > RANGE) throw new RangeError(`Invalid range ${n}`);
  // Largest multiple of n that fits in 32 bits; values at or above it are rejected.
  const limit = RANGE - (RANGE % n);
  const buffer = new Uint32Array(1);
  for (;;) {
    const value = source(buffer)[0]!;
    if (value < limit) return value % n;
  }
}

export function pick<T>(items: readonly T[], source?: RandomSource): T {
  if (items.length === 0) throw new RangeError('Nothing to pick from');
  return items[randomInt(items.length, source)]!;
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(items: readonly T[], source?: RandomSource): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, source);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** A die roll, 1–6. */
export function rollDie(source?: RandomSource): number {
  return randomInt(6, source) + 1;
}
