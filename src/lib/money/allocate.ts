/**
 * Integer allocation primitives. Every amount is an integer number of minor units
 * (pence, cents, kuruş). Nothing here uses floating-point money.
 */

const WEIGHT_SCALE = 1_000_000;

export function assertMinor(value: number, label = 'amount'): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer of minor units, got ${value}`);
  }
}

/** Converts weights to non-negative BigInts, scaling fractional weights such as 0.5 or 1.5. */
function toIntegerWeights(weights: readonly number[]): bigint[] {
  for (const w of weights) {
    if (!Number.isFinite(w) || w < 0) throw new RangeError(`Invalid weight ${w}`);
  }
  const allIntegers = weights.every((w) => Number.isInteger(w));
  return weights.map((w) => BigInt(allIntegers ? w : Math.round(w * WEIGHT_SCALE)));
}

/**
 * Splits `total` across `weights` with the largest-remainder method.
 * The parts always sum exactly to `total`. Ties go to the earlier index, so the
 * result is deterministic. If every weight is zero the total is split equally.
 */
export function allocate(total: number, weights: readonly number[]): number[] {
  assertMinor(total, 'total');
  if (weights.length === 0) {
    if (total !== 0) throw new RangeError('Cannot allocate a non-zero total to nobody');
    return [];
  }
  if (total < 0) return allocate(-total, weights).map((part) => (part === 0 ? 0 : -part));

  let intWeights = toIntegerWeights(weights);
  let sum = intWeights.reduce((a, b) => a + b, 0n);
  if (sum === 0n) {
    intWeights = intWeights.map(() => 1n);
    sum = BigInt(intWeights.length);
  }

  const bigTotal = BigInt(total);
  const parts = intWeights.map((w) => (bigTotal * w) / sum);
  const remainders = intWeights.map((w, index) => ({ index, rem: (bigTotal * w) % sum }));
  let left = bigTotal - parts.reduce((a, b) => a + b, 0n);

  remainders.sort((a, b) => (a.rem === b.rem ? a.index - b.index : a.rem > b.rem ? -1 : 1));
  for (const { index } of remainders) {
    if (left === 0n) break;
    parts[index] = (parts[index] ?? 0n) + 1n;
    left -= 1n;
  }
  return parts.map((p) => Number(p));
}

/** Splits `total` equally across `count` people (largest remainder, earlier people first). */
export function allocateEqually(total: number, count: number): number[] {
  return allocate(
    total,
    Array.from({ length: count }, () => 1),
  );
}

/** Rounds a non-negative rational `numerator / denominator` half-up to an integer. */
export function divideRoundHalfUp(numerator: number, denominator: number): number {
  if (denominator <= 0) throw new RangeError('Denominator must be positive');
  const n = BigInt(numerator);
  const d = BigInt(denominator);
  const negative = n < 0n;
  const abs = negative ? -n : n;
  const q = (abs * 2n + d) / (2n * d);
  return Number(negative ? -q : q);
}

/** A percentage of an amount, rounded half-up. Rates are kept to 2 decimal places (12.5 → 1250 bp). */
export function percentOf(amountMinor: number, ratePercent: number): number {
  assertMinor(amountMinor);
  if (!Number.isFinite(ratePercent) || ratePercent < 0) throw new RangeError('Invalid rate');
  const basisPoints = Math.round(ratePercent * 100);
  return divideRoundHalfUp(amountMinor * basisPoints, 10_000);
}

/** Rounds a non-negative amount to the nearest multiple of `step` (half-up). */
export function roundToStep(amountMinor: number, step: number): number {
  if (step <= 1) return amountMinor;
  return divideRoundHalfUp(amountMinor, step) * step;
}

export function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
