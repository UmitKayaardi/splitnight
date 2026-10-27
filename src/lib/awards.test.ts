import { computeAwards, dishName, type AwardItem } from './awards';
import { computeSplit, type Assignments } from './money';

const people = ['ahmet', 'ayse', 'can', 'sam'];
const items: AwardItem[] = [
  {
    id: 'meze',
    name: 'Mixed Meze Platter',
    quantity: 1,
    lineTotalMinor: 1250,
    category: 'starter',
  },
  { id: 'kebab', name: 'Adana Kebab', quantity: 2, lineTotalMinor: 3100, category: 'main' },
  { id: 'shish', name: 'Chicken Shish', quantity: 1, lineTotalMinor: 1995, category: 'main' },
  { id: 'salad', name: 'Shepherd Salad', quantity: 1, lineTotalMinor: 650, category: 'side' },
  { id: 'baklava', name: 'Baklava', quantity: 1, lineTotalMinor: 695, category: 'dessert' },
  { id: 'lager', name: 'Lager (pint)', quantity: 3, lineTotalMinor: 1620, category: 'drink' },
  { id: 'cola', name: 'Cola', quantity: 1, lineTotalMinor: 320, category: 'drink' },
];
const assignments: Assignments = {
  meze: people.map((personId) => ({ personId, weight: 1 })),
  kebab: [{ personId: 'ayse', weight: 2 }],
  shish: [{ personId: 'sam', weight: 1 }],
  salad: [{ personId: 'ahmet', weight: 1 }],
  baklava: [{ personId: 'can', weight: 1 }],
  lager: [{ personId: 'sam', weight: 1 }],
  cola: [{ personId: 'ahmet', weight: 1 }],
};

function run(a: Assignments = assignments, p = people) {
  const split = computeSplit({
    people: p,
    items,
    assignments: a,
    discount: { mode: 'none' },
    serviceCharge: { mode: 'none' },
    tip: { mode: 'none' },
    tipSplit: 'proportional',
    taxesOnTopMinor: [],
    rounding: { step: 0 },
  });
  return computeAwards(p, items, a, split);
}

describe('computeAwards', () => {
  it('hands out 3 to 5 titles with clear winners', () => {
    const awards = run();
    expect(awards.length).toBeGreaterThanOrEqual(3);
    expect(awards.length).toBeLessThanOrEqual(5);
    expect(awards[0]).toEqual({ id: 'big_spender', personId: 'sam' });
    expect(awards).toContainEqual({ id: 'dish_royalty', personId: 'sam', dish: 'Lager' });
  });

  it('never gives one person more than two titles when others can win', () => {
    const counts = new Map<string, number>();
    for (const a of run()) counts.set(a.personId, (counts.get(a.personId) ?? 0) + 1);
    counts.forEach((c) => expect(c).toBeLessThanOrEqual(2));
  });

  it('is deterministic', () => {
    expect(run()).toEqual(run());
  });

  it('skips ties', () => {
    const tied: Assignments = {
      meze: [{ personId: 'a', weight: 1 }],
      salad: [{ personId: 'b', weight: 1 }],
    };
    const awards = computeAwards(
      ['a', 'b'],
      [
        { id: 'meze', name: 'Meze', quantity: 1, lineTotalMinor: 500, category: 'starter' },
        { id: 'salad', name: 'Salad', quantity: 1, lineTotalMinor: 500, category: 'side' },
      ],
      tied,
      computeSplit({
        people: ['a', 'b'],
        items: [
          { id: 'meze', lineTotalMinor: 500, category: 'starter' },
          { id: 'salad', lineTotalMinor: 500, category: 'side' },
        ],
        assignments: tied,
        discount: { mode: 'none' },
        serviceCharge: { mode: 'none' },
        tip: { mode: 'none' },
        tipSplit: 'proportional',
        taxesOnTopMinor: [],
        rounding: { step: 0 },
      }),
    );
    expect(awards.find((a) => a.id === 'big_spender')).toBeUndefined();
  });

  it('gives nothing to a party of one', () => {
    expect(run(assignments, ['ahmet'])).toEqual([]);
  });
});

describe('dishName', () => {
  it('cleans up receipt names', () => {
    expect(dishName('Lager (pint)')).toBe('Lager');
    expect(dishName('2x Adana Kebab')).toBe('Adana Kebab');
  });
});

describe('award margins', () => {
  it('does not crown anyone over a few pennies of rounding', () => {
    const ids = ['a', 'b', 'c'];
    const even: AwardItem[] = [
      { id: 'pizza', name: 'Pizza', quantity: 1, lineTotalMinor: 1001, category: 'main' },
    ];
    const shared: Assignments = { pizza: ids.map((personId) => ({ personId, weight: 1 })) };
    const split = computeSplit({
      people: ids,
      items: even,
      assignments: shared,
      discount: { mode: 'none' },
      serviceCharge: { mode: 'none' },
      tip: { mode: 'none' },
      tipSplit: 'proportional',
      taxesOnTopMinor: [],
      rounding: { step: 0 },
    });
    const awards = computeAwards(ids, even, shared, split);
    expect(awards.map((a) => a.id)).not.toContain('big_spender');
    expect(awards.map((a) => a.id)).not.toContain('light_eater');
    expect(awards.map((a) => a.id)).not.toContain('fair_share');
  });
});
