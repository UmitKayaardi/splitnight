import fc from 'fast-check';
import { allocate, allocateEqually, divideRoundHalfUp, percentOf, roundToStep } from './allocate';

describe('allocate', () => {
  it('splits evenly when it can', () => {
    expect(allocate(900, [1, 1, 1])).toEqual([300, 300, 300]);
  });

  it('gives leftover pennies to the largest remainders, earlier first on ties', () => {
    expect(allocate(1000, [1, 1, 1])).toEqual([334, 333, 333]);
    expect(allocate(100, [1, 2])).toEqual([33, 67]);
  });

  it('respects weights such as 2:1', () => {
    expect(allocate(1550, [2, 1])).toEqual([1033, 517]);
  });

  it('supports fractional weights', () => {
    expect(allocate(1000, [0.5, 0.5])).toEqual([500, 500]);
    expect(allocate(999, [1.5, 1.5])).toEqual([500, 499]);
  });

  it('handles negative totals symmetrically', () => {
    expect(allocate(-1000, [1, 1, 1])).toEqual([-334, -333, -333]);
  });

  it('splits equally when all weights are zero', () => {
    expect(allocate(10, [0, 0])).toEqual([5, 5]);
  });

  it('rejects bad input', () => {
    expect(() => allocate(1.5, [1])).toThrow(RangeError);
    expect(() => allocate(10, [-1, 2])).toThrow(RangeError);
    expect(() => allocate(10, [])).toThrow(RangeError);
    expect(allocate(0, [])).toEqual([]);
  });

  it('always sums exactly to the total and is deterministic (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10_000_000, max: 10_000_000 }),
        fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 1, maxLength: 12 }),
        (total, weights) => {
          const parts = allocate(total, weights);
          expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
          expect(allocate(total, weights)).toEqual(parts);
          const weightSum = weights.reduce((a, b) => a + b, 0);
          if (weightSum > 0) {
            parts.forEach((p, i) => {
              const exact = (total * weights[i]!) / weightSum;
              expect(Math.abs(p - exact)).toBeLessThan(1);
            });
          }
        },
      ),
    );
  });

  it('allocateEqually spreads remainders over the first people', () => {
    expect(allocateEqually(10, 3)).toEqual([4, 3, 3]);
  });
});

describe('integer helpers', () => {
  it('rounds half up', () => {
    expect(divideRoundHalfUp(5, 2)).toBe(3);
    expect(divideRoundHalfUp(4, 3)).toBe(1);
    expect(divideRoundHalfUp(-5, 2)).toBe(-3);
    expect(() => divideRoundHalfUp(1, 0)).toThrow();
  });

  it('computes percentages like a UK service charge', () => {
    expect(percentOf(8640, 12.5)).toBe(1080);
    expect(percentOf(1999, 12.5)).toBe(250);
    expect(percentOf(1000, 0)).toBe(0);
    expect(() => percentOf(1000, -1)).toThrow();
  });

  it('rounds to a step', () => {
    expect(roundToStep(2412, 10)).toBe(2410);
    expect(roundToStep(2415, 10)).toBe(2420);
    expect(roundToStep(2425, 50)).toBe(2450);
    expect(roundToStep(2449, 100)).toBe(2400);
    expect(roundToStep(2449, 0)).toBe(2449);
  });
});
