import { pick, randomInt, rollDie, shuffle, type RandomSource } from './random';

function sequence(values: number[]): RandomSource {
  let i = 0;
  return (buffer) => {
    buffer[0] = values[i++ % values.length]!;
    return buffer;
  };
}

describe('randomInt', () => {
  it('rejects values in the biased tail instead of using them', () => {
    // For n = 3, the limit is 2^32 - (2^32 mod 3) = 4294967295; that value must be skipped.
    const source = sequence([4294967295, 7]);
    expect(randomInt(3, source)).toBe(7 % 3);
  });

  it('validates its range', () => {
    expect(() => randomInt(0)).toThrow(RangeError);
    expect(() => randomInt(1.5)).toThrow(RangeError);
    expect(randomInt(1)).toBe(0);
  });

  it('is roughly uniform (chi-squared test, 6 outcomes)', () => {
    const n = 6;
    const draws = 60_000;
    const counts = new Array<number>(n).fill(0);
    for (let i = 0; i < draws; i++) counts[randomInt(n)]!++;
    const expected = draws / n;
    const chi = counts.reduce((acc, c) => acc + (c - expected) ** 2 / expected, 0);
    // Critical value for 5 degrees of freedom at p = 0.001 is 20.52.
    expect(chi).toBeLessThan(20.52);
  });

  it('gives every person a fair chance in a group of 7', () => {
    const counts = new Array<number>(7).fill(0);
    for (let i = 0; i < 70_000; i++) counts[randomInt(7)]!++;
    counts.forEach((c) => expect(Math.abs(c - 10_000)).toBeLessThan(600));
  });
});

describe('helpers', () => {
  it('picks, shuffles and rolls within range', () => {
    expect(['a', 'b', 'c']).toContain(pick(['a', 'b', 'c']));
    expect(() => pick([])).toThrow();
    const shuffled = shuffle([1, 2, 3, 4, 5]);
    expect([...shuffled].sort()).toEqual([1, 2, 3, 4, 5]);
    for (let i = 0; i < 100; i++) {
      const r = rollDie();
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(6);
    }
  });
});
