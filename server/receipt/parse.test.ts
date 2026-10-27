// @vitest-environment node
import { normaliseReceipt, RawReceiptSchema } from './parse';
import { extractJson } from '../ai';

const ids = (i: number) => `r${i + 1}`;

describe('normaliseReceipt', () => {
  it('accepts numbers written as strings and fills in missing prices', () => {
    const raw = RawReceiptSchema.parse({
      currency: '€',
      items: [
        {
          name: 'Cappuccino',
          quantity: '2',
          unitPrice: '3,20',
          lineTotal: null,
          category: 'drink',
        },
        { name: 'Croissant', lineTotal: 2.5, category: 'pastry', confidence: 1.4 },
      ],
      total: '8,90',
    });
    const receipt = normaliseReceipt(raw, ids);
    expect(receipt.currency).toBe('EUR');
    expect(receipt.items).toEqual([
      {
        id: 'r1',
        name: 'Cappuccino',
        quantity: 2,
        unitPriceMinor: 320,
        lineTotalMinor: 640,
        category: 'drink',
        confidence: 0.5,
      },
      {
        id: 'r2',
        name: 'Croissant',
        quantity: 1,
        unitPriceMinor: 250,
        lineTotalMinor: 250,
        category: 'other',
        confidence: 1,
      },
    ]);
    expect(receipt.totalMinor).toBe(890);
  });

  it('moves negative lines into discounts and drops total/payment lines', () => {
    const raw = RawReceiptSchema.parse({
      currency: 'GBP',
      items: [
        { name: 'Pizza', lineTotal: 12 },
        { name: 'Happy hour', lineTotal: -2 },
        { name: 'Subtotal', lineTotal: 10 },
        { name: 'Card ending 4242', lineTotal: 10 },
        { name: '4929 1234 5678 9012', lineTotal: 10 },
      ],
      discounts: [{ label: 'Student', amount: -1 }],
    });
    const receipt = normaliseReceipt(raw, ids);
    expect(receipt.items.map((i) => i.name)).toEqual(['Pizza']);
    expect(receipt.discounts).toEqual([
      { label: 'Happy hour', amountMinor: 200 },
      { label: 'Student', amountMinor: 100 },
    ]);
  });

  it('lowers confidence when quantity × unit price does not match the line', () => {
    const raw = RawReceiptSchema.parse({
      currency: 'GBP',
      items: [{ name: 'Beer', quantity: 3, unitPrice: 5, lineTotal: 12, confidence: 0.99 }],
    });
    expect(normaliseReceipt(raw, ids).items[0]!.confidence).toBe(0.5);
  });

  it('defaults to GBP and assumes US tax is added on top', () => {
    expect(
      normaliseReceipt(RawReceiptSchema.parse({ currency: '??', items: [] }), ids).currency,
    ).toBe('GBP');
    const us = normaliseReceipt(
      RawReceiptSchema.parse({
        currency: 'USD',
        items: [],
        taxLines: [{ label: 'Sales tax', amount: 2.1 }],
      }),
      ids,
    );
    expect(us.taxLines).toEqual([
      { label: 'Sales tax', amountMinor: 210, includedInPrices: false },
    ]);
  });
});

describe('extractJson', () => {
  it('handles fences and thinking blocks', () => {
    expect(extractJson('<think>hmm</think>```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here: {"a":2} thanks')).toEqual({ a: 2 });
    expect(() => extractJson('nothing')).toThrow();
  });
});
