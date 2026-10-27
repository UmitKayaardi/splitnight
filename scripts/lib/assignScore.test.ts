// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { itemMatches, outcomeUnits, scoreCase, type CaseItem } from './assignScore';

const items: CaseItem[] = [
  { id: 'i1', name: 'Lager', quantity: 3 },
  { id: 'i2', name: 'Salad', quantity: 1 },
];

describe('assign scoring', () => {
  it('traces split lines back to the original line', () => {
    const units = outcomeUnits(items, { i1: { p9: 1 } }, [
      { itemId: 'i1', units: 2, shares: [{ personId: 'p1', weight: 1 }] },
    ]);
    expect(units.i1).toEqual({ p1: 2, p9: 1 });
  });

  it('counts uneven weights as units', () => {
    const units = outcomeUnits(items, {}, [
      {
        itemId: 'i1',
        shares: [
          { personId: 'p1', weight: 2 },
          { personId: 'p2', weight: 1 },
        ],
      },
      {
        itemId: 'i2',
        shares: [
          { personId: 'p1', weight: 1 },
          { personId: 'p2', weight: 1 },
        ],
      },
    ]);
    expect(units).toEqual({ i1: { p1: 2, p2: 1 }, i2: { p1: 0.5, p2: 0.5 } });
    expect(scoreCase(items, { i1: { p1: 2, p2: 1 }, i2: { p1: 0.5, p2: 0.5 } }, units).exact).toBe(
      true,
    );
  });

  it('treats a missing expected line as "must stay unassigned"', () => {
    expect(itemMatches(undefined, { p1: 1 })).toBe(false);
    expect(itemMatches({ p1: 0.3333 }, { p1: 1 / 3 })).toBe(true);
  });

  it('has a well-formed dataset with enough cases per language', () => {
    const data = JSON.parse(
      readFileSync(resolve(__dirname, '../../benchmarks/assign-cases.json'), 'utf8'),
    ) as {
      menus: Record<string, { items: CaseItem[]; people: Array<{ id: string }> }>;
      cases: Array<{
        id: string;
        lang: string;
        menu: string;
        expected: Record<string, Record<string, number>>;
      }>;
    };
    const perLang = (lang: string) => data.cases.filter((c) => c.lang === lang).length;
    expect(perLang('en')).toBeGreaterThanOrEqual(60);
    for (const lang of ['tr', 'de', 'fr', 'es']) expect(perLang(lang)).toBeGreaterThanOrEqual(10);
    expect(new Set(data.cases.map((c) => c.id)).size).toBe(data.cases.length);
    for (const c of data.cases) {
      const menu = data.menus[c.menu]!;
      for (const [itemId, shares] of Object.entries(c.expected)) {
        const item = menu.items.find((i) => i.id === itemId);
        expect(item, `${c.id}: ${itemId}`).toBeDefined();
        const units = Object.values(shares).reduce((a, b) => a + b, 0);
        expect(units, `${c.id}: ${itemId} units`).toBeLessThanOrEqual(item!.quantity + 0.01);
        for (const p of Object.keys(shares))
          expect(
            menu.people.some((x) => x.id === p),
            `${c.id}: ${p}`,
          ).toBe(true);
      }
    }
  });
});
