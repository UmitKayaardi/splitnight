import { RotateCcw, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../../components/Dialog';
import { Screen } from '../../components/Layout';
import { Banner, Button, Card } from '../../components/ui';
import { useMoney } from '../../lib/hooks';
import { useBill } from '../../state/bill';
import { computeBill } from '../../state/derive';
import { PersonResult } from './PersonResult';

export function ResultsScreen() {
  const { t } = useTranslation();
  const { format, signed } = useMoney();
  const data = useBill((s) => s.data);
  const reset = useBill((s) => s.reset);
  const [confirmNew, setConfirmNew] = useState(false);
  const result = useMemo(() => computeBill(data), [data]);
  const sum = result.people.reduce((a, p) => a + p.totalMinor, 0);
  const cover = data.people.find((p) => p.id === result.rounding.coverPersonId);

  return (
    <Screen step="results" title={t('results.title')} subtitle={t('results.subtitle')}>
      <Card as="section" className="night-sky relative overflow-hidden p-5 text-center">
        <p className="text-sm font-medium text-muted">{t('results.billTotal')}</p>
        <p className="tabular font-display text-5xl font-bold">{format(result.billTotalMinor)}</p>
        <p className="mt-1 text-muted">{t('results.friends', { count: data.people.length })}</p>
      </Card>

      <ul className="flex flex-col gap-3">
        {data.people.map((person) => {
          const breakdown = result.people.find((b) => b.personId === person.id)!;
          return (
            <PersonResult
              key={person.id}
              person={person}
              breakdown={breakdown}
              items={data.items}
              highlight={data.roulette?.loserId === person.id}
            />
          );
        })}
      </ul>

      {result.rounding.applied && result.rounding.differenceMinor !== 0 && cover && (
        <Banner tone="info">
          {result.rounding.differenceMinor > 0
            ? t('results.roundingCovered', {
                amount: signed(result.rounding.differenceMinor),
                name: cover.name,
              })
            : t('results.roundingLess', {
                amount: signed(result.rounding.differenceMinor),
                name: cover.name,
              })}
        </Banner>
      )}

      <p className="flex items-center justify-center gap-2 text-sm text-muted">
        <ShieldCheck aria-hidden className="size-4 text-success" />
        {t('results.sumCheck', { total: format(sum) })}
      </p>

      <Button
        variant="ghost"
        icon={<RotateCcw aria-hidden className="size-4" />}
        onClick={() => setConfirmNew(true)}
      >
        {t('results.newBill')}
      </Button>

      <ConfirmDialog
        open={confirmNew}
        onClose={() => setConfirmNew(false)}
        title={t('results.newBillTitle')}
        body={t('results.newBillBody')}
        confirmLabel={t('results.newBill')}
        onConfirm={reset}
      />
    </Screen>
  );
}
