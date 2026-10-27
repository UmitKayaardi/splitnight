import { Dices, RotateCcw, ShieldCheck, Undo2 } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../../components/Dialog';
import { Screen } from '../../components/Layout';
import { Banner, Button, Card } from '../../components/ui';
import { computeAwards } from '../../lib/awards';
import { feedback } from '../../lib/feedback';
import { useMoney, usePrefersReducedMotion } from '../../lib/hooks';
import { buildSummary } from '../../lib/summary';
import { setRoulette } from '../../state/actions';
import { useBill } from '../../state/bill';
import { useHistory } from '../../state/history';
import { computeBill } from '../../state/derive';
import { toast } from '../../state/toasts';
import { stakeShort } from '../roulette/stake';
import { Awards } from './Awards';
import { PersonResult } from './PersonResult';
import { ShareActions } from './ShareActions';

const RouletteDialog = lazy(() => import('../roulette/RouletteDialog'));

async function celebrate() {
  const { default: confetti } = await import('canvas-confetti');
  const colors = ['#ff4f8b', '#ffb547', '#7c5cff', '#7ee2b8', '#fff4dc'];
  void confetti({
    particleCount: 90,
    spread: 75,
    origin: { y: 0.35 },
    colors,
    disableForReducedMotion: true,
  });
  setTimeout(
    () =>
      void confetti({
        particleCount: 50,
        spread: 110,
        origin: { y: 0.3 },
        colors,
        disableForReducedMotion: true,
      }),
    250,
  );
}

export function ResultsScreen() {
  const { t, i18n } = useTranslation();
  const { format, signed, currency } = useMoney();
  const data = useBill((s) => s.data);
  const reset = useBill((s) => s.reset);
  const reduced = usePrefersReducedMotion();
  const [confirmNew, setConfirmNew] = useState(false);
  const [rouletteOpen, setRouletteOpen] = useState(false);
  const celebrated = useRef(false);

  const result = useMemo(() => computeBill(data), [data]);
  // Titles are about what people ordered, so they ignore any roulette transfer.
  const awards = useMemo(
    () =>
      computeAwards(
        data.people.map((p) => p.id),
        data.items,
        data.assignments,
        computeBill({ ...data, roulette: null }),
      ),
    [data],
  );
  const sum = result.people.reduce((a, p) => a + p.totalMinor, 0);
  const cover = data.people.find((p) => p.id === result.rounding.coverPersonId);
  const loser = data.people.find((p) => p.id === data.roulette?.loserId);
  const rouletteLine =
    data.roulette && loser
      ? t('results.summaryRoulette', {
          name: loser.name,
          stake: stakeShort(t, data.roulette.stake),
        })
      : null;
  const summary = buildSummary({
    t,
    language: i18n.language,
    currency,
    people: data.people,
    result,
    awards,
    rouletteText: rouletteLine,
  });

  // "Recent nights" lives only in this browser. Revisiting or editing updates the same entry.
  const billId = useBill((s) => s.billId);
  useEffect(() => {
    useHistory.getState().save({
      id: billId,
      date: new Date().toISOString(),
      totalMinor: result.billTotalMinor,
      currency,
      friends: data.people.length,
      names: data.people.map((p) => p.name),
      awards: awards.map((a) => ({
        id: a.id,
        personName: data.people.find((p) => p.id === a.personId)?.name ?? '',
        ...(a.dish ? { dish: a.dish } : {}),
      })),
      ...(loser ? { rouletteLoser: loser.name } : {}),
    });
  }, [billId, result.billTotalMinor, currency, data.people, awards, loser]);

  useEffect(() => {
    if (celebrated.current) return;
    celebrated.current = true;
    feedback('success');
    if (!reduced) void celebrate();
  }, [reduced]);

  return (
    <Screen step="results" title={t('results.title')} subtitle={t('results.subtitle')}>
      <Card as="section" className="night-sky relative overflow-hidden p-5 text-center">
        <p className="text-sm font-medium text-muted">{t('results.billTotal')}</p>
        <p className="tabular font-display text-5xl font-bold">{format(result.billTotalMinor)}</p>
        <p className="mt-1 text-muted">{t('results.friends', { count: data.people.length })}</p>
      </Card>

      {data.roulette && loser && (
        <Banner
          tone="info"
          icon={<Dices aria-hidden className="size-5 text-primary" />}
          action={
            <Button
              variant="secondary"
              icon={<Undo2 aria-hidden className="size-4" />}
              onClick={() => {
                setRoulette(null);
                toast(t('results.rouletteUndone'), { undoable: true });
              }}
            >
              {t('results.undoRoulette')}
            </Button>
          }
        >
          {t('results.rouletteApplied', {
            name: loser.name,
            stake: stakeShort(t, data.roulette.stake),
          })}
        </Banner>
      )}

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

      <ShareActions
        summary={summary}
        people={data.people}
        result={result}
        awards={awards}
        currency={currency}
        rouletteLine={rouletteLine}
      />

      <Button
        size="lg"
        variant="secondary"
        block
        icon={<Dices aria-hidden className="size-6 text-primary" />}
        onClick={() => setRouletteOpen(true)}
      >
        {t('results.roulette')}
      </Button>

      <Awards awards={awards} people={data.people} />

      <Button
        variant="ghost"
        icon={<RotateCcw aria-hidden className="size-4" />}
        onClick={() => setConfirmNew(true)}
      >
        {t('results.newBill')}
      </Button>

      {rouletteOpen && (
        <Suspense fallback={null}>
          <RouletteDialog onClose={() => setRouletteOpen(false)} />
        </Suspense>
      )}

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
