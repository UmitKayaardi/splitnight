import { ParsedReceiptSchema } from '../../shared/schemas';
import { reconcile } from '../lib/money';
import { SAMPLES } from './samples';

describe.each(SAMPLES)('sample receipt $id', (sample) => {
  const r = sample.receipt;

  it('is a valid parsed receipt', () => {
    expect(() => ParsedReceiptSchema.parse(r)).not.toThrow();
  });

  it('has line totals that match quantity × unit price', () => {
    r.items.forEach((item) =>
      expect(item.unitPriceMinor * item.quantity).toBe(item.lineTotalMinor),
    );
  });

  it('adds up to its own subtotal and total', () => {
    const items = r.items.reduce((a, i) => a + i.lineTotalMinor, 0);
    expect(items).toBe(r.subtotalMinor);
    const check = reconcile({
      itemLineTotalsMinor: r.items.map((i) => i.lineTotalMinor),
      taxesOnTopMinor: r.taxLines.filter((t) => !t.includedInPrices).map((t) => t.amountMinor),
      serviceChargeMinor: r.serviceCharge?.amountMinor ?? 0,
      tipMinor: r.tipMinor ?? 0,
      discountsMinor: r.discounts.map((d) => d.amountMinor),
      receiptTotalMinor: r.totalMinor,
    });
    expect(check.matches).toBe(true);
  });

  it('has a demo crew and suggested sentences', () => {
    expect(sample.crew.length).toBeGreaterThanOrEqual(3);
    expect(sample.hints).toHaveLength(3);
  });
});
