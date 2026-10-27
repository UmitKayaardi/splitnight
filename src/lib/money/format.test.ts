import {
  formatMoney,
  formatMoneyShort,
  formatSigned,
  isValidCurrency,
  minorDigits,
  minorToInput,
  parseMoneyInput,
  toMinor,
} from './format';

describe('formatting', () => {
  it('formats in UK English by default', () => {
    expect(formatMoney(8640, 'GBP')).toBe('£86.40');
    expect(formatMoneyShort(100, 'GBP')).toBe('£1');
    expect(formatMoneyShort(50, 'GBP')).toBe('£0.50');
  });

  it('formats per UI language', () => {
    expect(formatMoney(123450, 'EUR', 'de')).toBe('1.234,50 €');
    expect(formatMoney(2500, 'TRY', 'tr')).toContain('25,00');
  });

  it('formats signed adjustments', () => {
    expect(formatSigned(6, 'GBP')).toBe('+£0.06');
    expect(formatSigned(-4, 'GBP')).toBe('−£0.04');
    expect(formatSigned(0, 'GBP')).toBe('£0.00');
  });

  it('knows minor digits', () => {
    expect(minorDigits('GBP')).toBe(2);
    expect(minorDigits('JPY')).toBe(0);
    expect(minorDigits('NOPE')).toBe(2);
    expect(isValidCurrency('USD')).toBe(true);
    expect(isValidCurrency('usd')).toBe(false);
  });

  it('converts decimals to minor units without float drift', () => {
    expect(toMinor(19.99, 'GBP')).toBe(1999);
    expect(toMinor(0.1 + 0.2, 'GBP')).toBe(30);
    expect(minorToInput(1250, 'GBP')).toBe('12.50');
  });
});

describe('parseMoneyInput', () => {
  it.each([
    ['12.50', 1250],
    ['12,50', 1250],
    ['12.5', 1250],
    ['£12', 1200],
    ['12.', 1200],
    ['.5', 50],
    ['1,234.50', 123450],
    ['1.234,50', 123450],
    ['1,234', 123400],
  ])('parses %s', (raw, expected) => {
    expect(parseMoneyInput(raw, 'GBP')).toBe(expected);
  });

  it.each(['', 'abc', '-5', '.'])('rejects "%s"', (raw) => {
    expect(parseMoneyInput(raw, 'GBP')).toBeNull();
  });
});
