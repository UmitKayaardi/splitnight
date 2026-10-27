// @vitest-environment node
import { mergeByName, nameSimilarity, normaliseName, scoreReceipt } from './receiptScore';

describe('receipt scoring', () => {
  it('normalises names', () => {
    expect(normaliseName('  Çay (Büyük)!  ')).toBe('cay buyuk');
  });

  it('scores similar names highly and unrelated ones low', () => {
    expect(nameSimilarity('Margarita Pizza', 'MARGARITA PIZZA')).toBe(1);
    expect(nameSimilarity('Coca Cola', 'Coca-Cola Light')).toBeGreaterThan(0.55);
    expect(nameSimilarity('Salmon Fillet', 'Beach Towel')).toBeLessThan(0.3);
  });

  it('merges repeated lines', () => {
    expect(
      mergeByName([
        { name: 'Coke', quantity: 1, lineTotal: 2 },
        { name: 'COKE', quantity: 1, lineTotal: 2 },
      ]),
    ).toEqual([{ name: 'Coke', quantity: 2, lineTotal: 4 }]);
  });

  it('counts exact-price name matches as true positives', () => {
    const score = scoreReceipt(
      {
        items: [
          { name: 'Pizza', quantity: 1, lineTotal: 10 },
          { name: 'Wine', quantity: 1, lineTotal: 20 },
        ],
        total: 30,
      },
      {
        items: [
          { name: 'pizza', quantity: 1, lineTotal: 10 },
          { name: 'Wine', quantity: 1, lineTotal: 21 },
          { name: 'Bread', quantity: 1, lineTotal: 3 },
        ],
        total: 30,
      },
    );
    expect(score.truePositives).toBe(1);
    expect(score.precision).toBeCloseTo(1 / 3);
    expect(score.recall).toBeCloseTo(1 / 2);
    expect(score.itemCountMatch).toBe(false);
    expect(score.totalMatch).toBe(true);
    expect(score.meanAbsPriceError).toBeCloseTo(0.5);
  });

  it('skips the total when the receipt has none', () => {
    expect(scoreReceipt({ items: [], total: null }, { items: [], total: 5 }).totalMatch).toBeNull();
  });
});
