import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { inputBase } from '../../components/ui';
import { SUPPORTED_CURRENCIES } from '../../lib/money';
import { setCurrency } from '../../state/actions';
import { useBill } from '../../state/bill';

const SYMBOLS: Record<string, string> = { GBP: '£', EUR: '€', USD: '$', TRY: '₺' };

export function CurrencySelect({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const id = useId();
  const currency = useBill((s) => s.data.currency);
  const detected = useBill((s) => s.data.currencyDetected);
  const options = (SUPPORTED_CURRENCIES as readonly string[]).includes(currency)
    ? [...SUPPORTED_CURRENCIES]
    : [currency, ...SUPPORTED_CURRENCIES];

  return (
    <div className={compact ? 'flex items-center gap-2' : 'flex flex-col gap-1.5'}>
      <label htmlFor={id} className={compact ? 'sr-only' : 'text-sm font-medium text-muted'}>
        {t('extras.currency')}
      </label>
      <select
        id={id}
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        className={`${inputBase} ${compact ? 'w-auto pr-8' : 'w-full'}`}
      >
        {options.map((code) => (
          <option key={code} value={code}>
            {SYMBOLS[code] ? `${SYMBOLS[code]} ${code}` : code}
            {detected && code === currency ? ` (${t('extras.currencyDetected')})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
