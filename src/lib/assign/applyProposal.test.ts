import { applyProposal, fractions, splitLine } from './applyProposal';

const beers = { id: 'beer', name: 'Lager', quantity: 3, unitPriceMinor: 540, lineTotalMinor: 1620 };
const salad = { id: 'salad', name: 'Salad', quantity: 1, unitPriceMinor: 650, lineTotalMinor: 650 };

function ids() {
  let n = 0;
  return () => `new${++n}`;
}

describe('applyProposal', () => {
  it('replaces shares for whole lines', () => {
    const result = applyProposal(
      [beers, salad],
      { salad: [{ personId: 'b', weight: 1 }] },
      [{ itemId: 'salad', shares: [{ personId: 'a', weight: 1 }] }],
      ids(),
    );
    expect(result.assignments.salad).toEqual([{ personId: 'a', weight: 1 }]);
    expect(result.items).toHaveLength(2);
    expect(result.changedItemIds).toEqual(['salad']);
  });

  it('splits a line when only some units are covered', () => {
    const result = applyProposal(
      [beers],
      { beer: [{ personId: 'z', weight: 1 }] },
      [{ itemId: 'beer', units: 2, shares: [{ personId: 'a', weight: 1 }] }],
      ids(),
    );
    expect(result.items).toEqual([
      { ...beers, id: 'new1', quantity: 2, lineTotalMinor: 1080 },
      { ...beers, quantity: 1, lineTotalMinor: 540 },
    ]);
    expect(result.assignments.new1).toEqual([{ personId: 'a', weight: 1 }]);
    expect(result.assignments.beer).toEqual([{ personId: 'z', weight: 1 }]);
  });

  it('handles two partial entries for the same line', () => {
    const result = applyProposal(
      [beers],
      {},
      [
        { itemId: 'beer', units: 2, shares: [{ personId: 'a', weight: 1 }] },
        { itemId: 'beer', units: 1, shares: [{ personId: 'c', weight: 1 }] },
      ],
      ids(),
    );
    expect(result.items.map((i) => i.quantity)).toEqual([2, 1]);
    expect(result.assignments.new1).toEqual([{ personId: 'a', weight: 1 }]);
    expect(result.assignments.beer).toEqual([{ personId: 'c', weight: 1 }]);
  });

  it('ignores unknown items', () => {
    const result = applyProposal(
      [salad],
      {},
      [{ itemId: 'nope', shares: [{ personId: 'a', weight: 1 }] }],
      ids(),
    );
    expect(result.changedItemIds).toEqual([]);
  });
});

describe('splitLine', () => {
  it('keeps the line total exact', () => {
    const [a, b] = splitLine({ ...beers, lineTotalMinor: 1000 }, 1, 'x');
    expect(a.lineTotalMinor + b.lineTotalMinor).toBe(1000);
  });
});

describe('fractions', () => {
  it('normalises weights', () => {
    expect(
      fractions([
        { personId: 'a', weight: 2 },
        { personId: 'b', weight: 1 },
        { personId: 'a', weight: 1 },
      ]),
    ).toEqual({
      a: 0.75,
      b: 0.25,
    });
    expect(fractions(undefined)).toEqual({});
  });
});
