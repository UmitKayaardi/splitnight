import type { TFunction } from 'i18next';
import type { Award } from './awards';
import { formatMoney, type SplitResult } from './money';

interface SummaryPerson {
  id: string;
  name: string;
}

/** Clean plain-text summary for "Copy summary" and the Web Share API. */
export function buildSummary({
  t,
  language,
  currency,
  people,
  result,
  awards,
  rouletteText,
}: {
  t: TFunction;
  language: string;
  currency: string;
  people: readonly SummaryPerson[];
  result: SplitResult;
  awards: readonly Award[];
  rouletteText?: string | null;
}): string {
  const money = (minor: number) => formatMoney(minor, currency, language);
  const lines = [
    t('results.summaryHeader', { count: people.length, total: money(result.billTotalMinor) }),
    '',
    ...people.map((p) => {
      const total = result.people.find((b) => b.personId === p.id)?.totalMinor ?? 0;
      return `${p.name} ${money(total)}`;
    }),
  ];
  if (rouletteText) lines.push('', rouletteText);
  if (awards.length > 0) {
    lines.push('');
    for (const award of awards) {
      const name = people.find((p) => p.id === award.personId)?.name ?? '';
      const title = t(`awards.${award.id}.title` as 'awards.big_spender.title', {
        dish: award.dish ?? '',
      });
      lines.push(`🏅 ${title}: ${name}`);
    }
  }
  lines.push('', t('results.summaryFooter'));
  return lines.join('\n');
}
