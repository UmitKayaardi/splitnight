import {
  availableModes,
  bestOfThreeLoser,
  drawLoser,
  lowestRollers,
  placeLosingCard,
  rollAll,
  wheelRotation,
} from './roulette';

describe('roulette rules', () => {
  it('offers the coin only to exactly two players', () => {
    expect(availableModes(2)).toContain('coin');
    expect(availableModes(3)).not.toContain('coin');
  });

  it('draws every player roughly equally often', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const counts: Record<string, number> = {};
    for (let i = 0; i < 40_000; i++) {
      const id = drawLoser(ids);
      counts[id] = (counts[id] ?? 0) + 1;
    }
    ids.forEach((id) => expect(Math.abs(counts[id]! - 10_000)).toBeLessThan(500));
  });

  it('places the losing card on a valid position', () => {
    for (let i = 0; i < 200; i++) {
      const p = placeLosingCard(5);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(5);
    }
  });

  it('finds the lowest dice rolls, including ties', () => {
    expect(lowestRollers({ a: 3, b: 1, c: 5 })).toEqual(['b']);
    expect(lowestRollers({ a: 2, b: 2, c: 5 })).toEqual(['a', 'b']);
    expect(lowestRollers({})).toEqual([]);
    const rolls = rollAll(['a', 'b']);
    Object.values(rolls).forEach((v) => expect(v).toBeGreaterThanOrEqual(1));
  });

  it('ends best of 3 when someone loses twice', () => {
    expect(bestOfThreeLoser({ a: 1, b: 1 })).toBeNull();
    expect(bestOfThreeLoser({ a: 1, b: 2 })).toBe('b');
  });

  it('lands the wheel pointer inside the chosen slice', () => {
    for (let slices = 2; slices <= 8; slices++) {
      for (let index = 0; index < slices; index++) {
        const rotation = wheelRotation(index, slices, 5, 0.3);
        // The slice under the top pointer after rotating clockwise by `rotation`.
        const pointerAngle = (360 - (rotation % 360) + 360) % 360;
        expect(Math.floor(pointerAngle / (360 / slices))).toBe(index);
      }
    }
  });
});
