import i18n from '../i18n';
import { computeSplit } from './money';
import { buildSummary } from './summary';

describe('buildSummary', () => {
  it('lists everyone with their totals, the roulette outcome and titles', () => {
    const result = computeSplit({
      people: ['a', 'b'],
      items: [
        { id: 'x', lineTotalMinor: 2410, category: 'main' },
        { id: 'y', lineTotalMinor: 6230, category: 'main' },
      ],
      assignments: { x: [{ personId: 'a', weight: 1 }], y: [{ personId: 'b', weight: 1 }] },
      discount: { mode: 'none' },
      serviceCharge: { mode: 'none' },
      tip: { mode: 'none' },
      tipSplit: 'proportional',
      taxesOnTopMinor: [],
      rounding: { step: 0 },
    });
    const text = buildSummary({
      t: i18n.t,
      language: 'en',
      currency: 'GBP',
      people: [
        { id: 'a', name: 'Ahmet' },
        { id: 'b', name: 'Ayşe' },
      ],
      result,
      awards: [{ id: 'big_spender', personId: 'b' }],
      rouletteText: '🎲 Ayşe covered the desserts',
    });
    expect(text).toBe(
      [
        'SplitNight — 2 friends — £86.40',
        '',
        'Ahmet £24.10',
        'Ayşe £62.30',
        '',
        '🎲 Ayşe covered the desserts',
        '',
        '🏅 Big Spender: Ayşe',
        '',
        'Split with SplitNight',
      ].join('\n'),
    );
  });
});
