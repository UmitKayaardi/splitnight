import fc from 'fast-check';
import { computeSplit } from './split';
import type { Adjustment, Assignments, Category, SplitInput } from './types';

const base: Omit<SplitInput, 'people' | 'items' | 'assignments'> = {
  discount: { mode: 'none' },
  serviceCharge: { mode: 'none' },
  tip: { mode: 'none' },
  tipSplit: 'proportional',
  taxesOnTopMinor: [],
  rounding: { step: 0 },
  roulette: null,
};

const item = (id: string, lineTotalMinor: number, category: Category = 'main') => ({
  id,
  lineTotalMinor,
  category,
});

const totalsOf = (input: SplitInput) => computeSplit(input).people.map((p) => p.totalMinor);

describe('computeSplit', () => {
  const people = ['ahmet', 'ayse', 'can'];
  const items = [item('salad', 650, 'side'), item('kebab', 3100), item('baklava', 595, 'dessert')];
  const assignments: Assignments = {
    salad: [{ personId: 'ahmet', weight: 1 }],
    kebab: [
      { personId: 'ayse', weight: 1 },
      { personId: 'can', weight: 1 },
    ],
    baklava: [{ personId: 'can', weight: 1 }],
  };
  const simple: SplitInput = { ...base, people, items, assignments };

  it('splits items by their shares', () => {
    expect(totalsOf(simple)).toEqual([650, 1550, 2145]);
  });

  it('adds a percentage service charge in proportion to what people ordered', () => {
    const result = computeSplit({
      ...simple,
      serviceCharge: { mode: 'percent', ratePercent: 12.5 },
    });
    expect(result.serviceMinor).toBe(543);
    expect(result.billTotalMinor).toBe(4345 + 543);
    expect(result.people.map((p) => p.serviceMinor)).toEqual([81, 194, 268]);
    expect(result.people.reduce((a, p) => a + p.totalMinor, 0)).toBe(result.billTotalMinor);
  });

  it('applies discounts before service and tip', () => {
    const result = computeSplit({
      ...simple,
      discount: { mode: 'percent', ratePercent: 10 },
      serviceCharge: { mode: 'percent', ratePercent: 10 },
    });
    expect(result.discountMinor).toBe(435);
    expect(result.serviceMinor).toBe(391);
    expect(result.billTotalMinor).toBe(4345 - 435 + 391);
  });

  it('caps a fixed discount at the item total', () => {
    const result = computeSplit({ ...simple, discount: { mode: 'fixed', amountMinor: 999_999 } });
    expect(result.billTotalMinor).toBe(0);
    result.people.forEach((p) => expect(p.totalMinor).toBe(0));
  });

  it('can split the tip equally', () => {
    const result = computeSplit({
      ...simple,
      tip: { mode: 'fixed', amountMinor: 1000 },
      tipSplit: 'equal',
    });
    expect(result.people.map((p) => p.tipMinor)).toEqual([334, 333, 333]);
  });

  it('adds taxes that are printed on top of prices', () => {
    const result = computeSplit({ ...simple, taxesOnTopMinor: [348] });
    expect(result.taxMinor).toBe(348);
    expect(result.billTotalMinor).toBe(4345 + 348);
  });

  it('reports unassigned items without charging anyone for them', () => {
    const result = computeSplit({ ...simple, assignments: { salad: assignments.salad! } });
    expect(result.unassignedItemIds).toEqual(['kebab', 'baklava']);
    expect(result.unassignedMinor).toBe(3695);
    expect(result.people[0]!.totalMinor).toBe(650);
  });

  it('ignores shares for unknown people and non-positive weights', () => {
    const result = computeSplit({
      ...base,
      people,
      items: [item('x', 1000)],
      assignments: {
        x: [
          { personId: 'ghost', weight: 1 },
          { personId: 'ahmet', weight: 0 },
          { personId: 'ayse', weight: 1 },
        ],
      },
    });
    expect(result.people[1]!.totalMinor).toBe(1000);
  });

  it('merges duplicate shares for the same person', () => {
    const result = computeSplit({
      ...base,
      people: ['a', 'b'],
      items: [item('x', 900)],
      assignments: {
        x: [
          { personId: 'a', weight: 1 },
          { personId: 'a', weight: 1 },
          { personId: 'b', weight: 1 },
        ],
      },
    });
    expect(result.people.map((p) => p.totalMinor)).toEqual([600, 300]);
  });

  it('spreads extras equally when nobody has items yet', () => {
    const result = computeSplit({
      ...base,
      people: ['a', 'b'],
      items: [],
      assignments: {},
      tip: { mode: 'fixed', amountMinor: 501 },
    });
    expect(result.people.map((p) => p.totalMinor)).toEqual([251, 250]);
  });

  it('charges nothing when there are no people', () => {
    const result = computeSplit({
      ...simple,
      people: [],
      tip: { mode: 'fixed', amountMinor: 100 },
    });
    expect(result.people).toEqual([]);
    expect(result.unassignedMinor).toBe(4345);
    expect(result.tipMinor).toBe(0);
  });

  describe('rounding', () => {
    it('rounds everyone and gives the difference to the biggest spender', () => {
      const result = computeSplit({ ...simple, rounding: { step: 50 } });
      // 650 and 1550 are already round; Can (2145 → 2150) is the cover person and absorbs −5p.
      expect(result.rounding.applied).toBe(true);
      expect(result.rounding.coverPersonId).toBe('can');
      expect(result.rounding.differenceMinor).toBe(-5);
      expect(result.people.map((p) => p.totalMinor)).toEqual([650, 1550, 2145]);
    });

    it('lets a chosen person cover the rounding', () => {
      const result = computeSplit({
        ...base,
        people,
        items: [item('a', 1012), item('b', 1013), item('c', 1013)],
        assignments: {
          a: [{ personId: 'ahmet', weight: 1 }],
          b: [{ personId: 'ayse', weight: 1 }],
          c: [{ personId: 'can', weight: 1 }],
        },
        rounding: { step: 100, coverPersonId: 'ahmet' },
      });
      expect(result.people.map((p) => p.totalMinor)).toEqual([1038, 1000, 1000]);
      expect(result.rounding.differenceMinor).toBe(38);
      expect(result.people[0]!.roundingMinor).toBe(26);
    });

    it('skips rounding when it would make someone negative', () => {
      const result = computeSplit({
        ...base,
        people: ['a', 'b', 'c'],
        items: [item('x', 60), item('y', 60)],
        assignments: {
          x: [{ personId: 'a', weight: 1 }],
          y: [{ personId: 'b', weight: 1 }],
        },
        // a and b would both round up to £1, so c (who owes nothing) would get −80p.
        rounding: { step: 100, coverPersonId: 'c' },
      });
      expect(result.rounding.applied).toBe(false);
      expect(result.people.map((p) => p.totalMinor)).toEqual([60, 60, 0]);
    });
  });

  describe('Bill Roulette', () => {
    const withExtras: SplitInput = {
      ...simple,
      serviceCharge: { mode: 'percent', ratePercent: 12.5 },
      tip: { mode: 'fixed', amountMinor: 300 },
    };

    it('loser pays the whole bill', () => {
      const result = computeSplit({ ...withExtras, roulette: { loserId: 'ayse', stake: 'all' } });
      expect(result.people.map((p) => p.totalMinor)).toEqual([0, result.billTotalMinor, 0]);
    });

    it('loser pays the tip and service charge', () => {
      const plain = computeSplit(withExtras);
      const result = computeSplit({
        ...withExtras,
        roulette: { loserId: 'ahmet', stake: 'tipService' },
      });
      const [ahmet, ayse] = plain.people;
      expect(result.people[1]!.totalMinor).toBe(
        ayse!.totalMinor - ayse!.serviceMinor - ayse!.tipMinor,
      );
      expect(result.people[0]!.totalMinor).toBe(
        ahmet!.itemsMinor + plain.serviceMinor + plain.tipMinor,
      );
    });

    it('loser pays the desserts', () => {
      expect(totalsOf({ ...simple, roulette: { loserId: 'ahmet', stake: 'desserts' } })).toEqual([
        650 + 595,
        1550,
        1550,
      ]);
    });

    it('ignores an unknown loser', () => {
      expect(totalsOf({ ...simple, roulette: { loserId: 'x', stake: 'all' } })).toEqual([
        650, 1550, 2145,
      ]);
    });
  });
});

const categoryArb = fc.constantFrom<Category>(
  'starter',
  'main',
  'side',
  'dessert',
  'drink',
  'other',
);

const adjustmentArb = (maxRateBp: number, maxFixed: number): fc.Arbitrary<Adjustment> =>
  fc.oneof(
    fc.constant<Adjustment>({ mode: 'none' }),
    fc
      .integer({ min: 0, max: maxRateBp })
      .map((bp): Adjustment => ({ mode: 'percent', ratePercent: bp / 100 })),
    fc
      .integer({ min: 0, max: maxFixed })
      .map((amountMinor): Adjustment => ({ mode: 'fixed', amountMinor })),
  );

const inputArb = fc
  .record({
    peopleCount: fc.integer({ min: 1, max: 8 }),
    items: fc.array(
      fc.record({
        lineTotalMinor: fc.integer({ min: 0, max: 50_000 }),
        category: categoryArb,
        shareSeeds: fc.array(fc.tuple(fc.nat(), fc.integer({ min: 1, max: 5 })), {
          minLength: 1,
          maxLength: 4,
        }),
      }),
      { maxLength: 15 },
    ),
    discount: adjustmentArb(10_000, 100_000),
    service: adjustmentArb(2_500, 10_000),
    tip: adjustmentArb(3_000, 10_000),
    tipSplit: fc.constantFrom('proportional' as const, 'equal' as const),
    taxes: fc.array(fc.integer({ min: 0, max: 5_000 }), { maxLength: 2 }),
    step: fc.constantFrom(0 as const, 10 as const, 50 as const, 100 as const),
    coverSeed: fc.option(fc.nat(), { nil: null }),
    roulette: fc.option(
      fc.record({
        loserSeed: fc.nat(),
        stake: fc.constantFrom('all' as const, 'tipService' as const, 'desserts' as const),
      }),
      { nil: null },
    ),
  })
  .map((r): SplitInput => {
    const people = Array.from({ length: r.peopleCount }, (_, i) => `p${i}`);
    const pick = (seed: number) => people[seed % people.length]!;
    const assignments: Assignments = {};
    const items = r.items.map((it, i) => {
      assignments[`i${i}`] = it.shareSeeds.map(([seed, weight]) => ({
        personId: pick(seed),
        weight,
      }));
      return { id: `i${i}`, lineTotalMinor: it.lineTotalMinor, category: it.category };
    });
    return {
      people,
      items,
      assignments,
      discount: r.discount,
      serviceCharge: r.service,
      tip: r.tip,
      tipSplit: r.tipSplit,
      taxesOnTopMinor: r.taxes,
      rounding: { step: r.step, coverPersonId: r.coverSeed === null ? null : pick(r.coverSeed) },
      roulette: r.roulette
        ? { loserId: pick(r.roulette.loserSeed), stake: r.roulette.stake }
        : null,
    };
  });

describe('computeSplit invariants (property-based)', () => {
  it('person totals always add up to the bill total', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const result = computeSplit(input);
        expect(result.unassignedMinor).toBe(0);
        expect(result.people.reduce((a, p) => a + p.totalMinor, 0)).toBe(result.billTotalMinor);
      }),
      { numRuns: 500 },
    );
  });

  it('nobody ever owes a negative amount', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        computeSplit(input).people.forEach((p) => expect(p.totalMinor).toBeGreaterThanOrEqual(0));
      }),
      { numRuns: 500 },
    );
  });

  it('each breakdown adds up to its own total', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        computeSplit(input).people.forEach((p) => {
          expect(
            p.itemsMinor -
              p.discountMinor +
              p.serviceMinor +
              p.tipMinor +
              p.taxMinor +
              p.rouletteMinor +
              p.roundingMinor,
          ).toBe(p.totalMinor);
          expect(p.items.reduce((a, it) => a + it.amountMinor, 0)).toBe(p.itemsMinor);
        });
      }),
      { numRuns: 300 },
    );
  });

  it('is deterministic', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        expect(computeSplit(input)).toEqual(computeSplit(input));
      }),
      { numRuns: 200 },
    );
  });

  it('rounded totals land on the step for everyone except the cover person', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const result = computeSplit(input);
        if (!result.rounding.applied) return;
        result.people
          .filter((p) => p.personId !== result.rounding.coverPersonId)
          .forEach((p) => expect(p.totalMinor % input.rounding.step).toBe(0));
      }),
      { numRuns: 300 },
    );
  });
});
