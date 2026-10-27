import { reconcile } from './reconcile';

describe('reconcile', () => {
  const base = { taxesOnTopMinor: [], serviceChargeMinor: 0, tipMinor: 0, discountsMinor: [] };

  it('matches when items add up to the receipt total', () => {
    const r = reconcile({ ...base, itemLineTotalsMinor: [500, 700], receiptTotalMinor: 1200 });
    expect(r.matches).toBe(true);
  });

  it('tolerates one penny of receipt rounding', () => {
    const r = reconcile({ ...base, itemLineTotalsMinor: [500, 700], receiptTotalMinor: 1201 });
    expect(r.matches).toBe(true);
  });

  it('reports the difference when something is missing', () => {
    const r = reconcile({ ...base, itemLineTotalsMinor: [500], receiptTotalMinor: 1200 });
    expect(r.matches).toBe(false);
    expect(r.differenceMinor).toBe(700);
  });

  it('includes service, tax on top, tip and discounts', () => {
    const r = reconcile({
      itemLineTotalsMinor: [1000],
      taxesOnTopMinor: [80],
      serviceChargeMinor: 125,
      tipMinor: 100,
      discountsMinor: [-200],
      receiptTotalMinor: 1105,
    });
    expect(r.matches).toBe(true);
  });

  it('always matches when the receipt has no total', () => {
    const r = reconcile({ ...base, itemLineTotalsMinor: [1], receiptTotalMinor: null });
    expect(r.matches).toBe(true);
  });
});
