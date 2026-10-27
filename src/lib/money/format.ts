export const SUPPORTED_CURRENCIES = ['GBP', 'EUR', 'USD', 'TRY'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

const LOCALE_TAGS: Record<string, string> = {
  en: 'en-GB',
  tr: 'tr-TR',
  de: 'de-DE',
  fr: 'fr-FR',
  es: 'es-ES',
};

export function localeTag(language: string): string {
  return LOCALE_TAGS[language] ?? language;
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, language: string, compact: boolean): Intl.NumberFormat {
  const key = `${currency}|${language}|${compact}`;
  let f = formatterCache.get(key);
  if (!f) {
    const digits = minorDigits(currency);
    f = new Intl.NumberFormat(localeTag(language), {
      style: 'currency',
      currency,
      minimumFractionDigits: compact ? 0 : digits,
      maximumFractionDigits: digits,
    });
    formatterCache.set(key, f);
  }
  return f;
}

/** Number of decimal places the currency uses (2 for GBP, 0 for JPY …). */
export function minorDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

export function isValidCurrency(code: string): boolean {
  if (!/^[A-Z]{3}$/.test(code)) return false;
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency: code });
    return true;
  } catch {
    return false;
  }
}

export function toMajor(minor: number, currency: string): number {
  return minor / 10 ** minorDigits(currency);
}

/** Converts a decimal amount as printed (12.5) to integer minor units (1250). */
export function toMinor(major: number, currency: string): number {
  return Math.round(major * 10 ** minorDigits(currency));
}

export function formatMoney(minor: number, currency: string, language = 'en'): string {
  return formatter(currency, language, false).format(toMajor(minor, currency));
}

/** Like formatMoney but drops ".00" on whole amounts — for short labels like "£1". */
export function formatMoneyShort(minor: number, currency: string, language = 'en'): string {
  const whole = minor % 10 ** minorDigits(currency) === 0;
  return formatter(currency, language, whole).format(toMajor(minor, currency));
}

/** Signed variant for adjustments: "+£0.06" / "−£0.04". */
export function formatSigned(minor: number, currency: string, language = 'en'): string {
  const abs = formatMoney(Math.abs(minor), currency, language);
  if (minor > 0) return `+${abs}`;
  if (minor < 0) return `−${abs}`;
  return abs;
}

/**
 * Parses what a person types into a price field ("12.50", "12,50", "£12.5", "1.234,50")
 * into minor units. Returns null for anything that is not a non-negative amount.
 */
export function parseMoneyInput(raw: string, currency: string): number | null {
  const cleaned = raw.replace(/[^\d.,-]/g, '');
  if (cleaned === '' || cleaned.includes('-')) return null;
  const digits = minorDigits(currency);
  const lastSep = Math.max(cleaned.lastIndexOf('.'), cleaned.lastIndexOf(','));
  let integerPart = cleaned;
  let fraction = '';
  if (lastSep >= 0) {
    const after = cleaned.slice(lastSep + 1);
    // Up to `digits` digits after the last separator are decimals ("12,5", "12.50");
    // a longer group means the separator was a thousands separator ("1,234").
    if (after.length <= digits && after.length > 0) {
      integerPart = cleaned.slice(0, lastSep);
      fraction = after;
    } else if (after.length === 0) {
      integerPart = cleaned.slice(0, lastSep);
    }
  }
  integerPart = integerPart.replace(/[.,]/g, '');
  if (integerPart === '' && fraction === '') return null;
  if (!/^\d*$/.test(integerPart) || !/^\d*$/.test(fraction)) return null;
  const value =
    Number(integerPart || '0') * 10 ** digits + Number(fraction.padEnd(digits, '0') || '0');
  return Number.isSafeInteger(value) ? value : null;
}

/** Plain decimal string for editing inputs (1250 → "12.50"). */
export function minorToInput(minor: number, currency: string): string {
  return toMajor(minor, currency).toFixed(minorDigits(currency));
}
