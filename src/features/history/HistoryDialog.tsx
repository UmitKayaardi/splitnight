import { Crown, Dices, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog, Dialog } from '../../components/Dialog';
import { Button } from '../../components/ui';
import { formatMoney, localeTag } from '../../lib/money';
import { hallOfFame, useHistory, type HallOfFameEntry } from '../../state/history';
import { toast } from '../../state/toasts';
import { useUi } from '../../state/ui';
import { awardTitle } from '../results/awardText';

function Leaderboard({
  title,
  icon,
  entries,
}: {
  title: string;
  icon: React.ReactNode;
  entries: HallOfFameEntry[];
}) {
  const { t } = useTranslation();
  if (entries.length === 0) return null;
  return (
    <div className="rounded-2xl bg-surface-2 p-3">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </h4>
      <ol className="mt-2 flex flex-col gap-1">
        {entries.map((entry, i) => (
          <li key={entry.name} className="flex justify-between text-sm">
            <span>
              {['🥇', '🥈', '🥉'][i]} {entry.name}
            </span>
            <span className="text-muted">{t('history.times', { count: entry.count })}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Recent nights and the Hall of Fame — read from this device only. */
export default function HistoryDialog() {
  const { t, i18n } = useTranslation();
  const nights = useHistory((s) => s.nights);
  const clear = useHistory((s) => s.clear);
  const setOpen = useUi((s) => s.setHistoryOpen);
  const [confirming, setConfirming] = useState(false);
  const fame = hallOfFame(nights);
  const dateFormat = new Intl.DateTimeFormat(localeTag(i18n.language), { dateStyle: 'medium' });

  return (
    <>
      <Dialog open onClose={() => setOpen(false)} title={t('history.title')}>
        <p className="mb-3 text-sm text-muted">{t('history.localOnly')}</p>
        {nights.length === 0 ? (
          <p className="rounded-2xl bg-surface-2 p-4 text-center text-muted">
            {t('history.empty')}
          </p>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {nights.map((night) => (
                <li key={night.id} className="rounded-2xl border border-border p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-display font-semibold">
                      {dateFormat.format(new Date(night.date))}
                    </span>
                    <span className="text-sm text-muted">
                      {t('history.entry', {
                        count: night.friends,
                        total: formatMoney(night.totalMinor, night.currency, i18n.language),
                      })}
                    </span>
                  </div>
                  {night.awards.length > 0 && (
                    <p className="mt-1 text-sm text-muted">
                      {night.awards
                        .map((a) => `${awardTitle(t, a.id, a.dish)}: ${a.personName}`)
                        .join(' · ')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <h3 className="mt-5 mb-2 font-display text-lg font-semibold">
              {t('history.hallOfFame')}
            </h3>
            {fame.mostPicked.length === 0 && fame.mostBigSpender.length === 0 ? (
              <p className="text-sm text-muted">{t('history.hallEmpty')}</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <Leaderboard
                  title={t('history.mostPicked')}
                  icon={<Dices aria-hidden className="size-4 text-primary" />}
                  entries={fame.mostPicked}
                />
                <Leaderboard
                  title={t('history.mostBigSpender')}
                  icon={<Crown aria-hidden className="size-4 text-accent" />}
                  entries={fame.mostBigSpender}
                />
              </div>
            )}
            <Button
              variant="danger"
              block
              className="mt-5"
              icon={<Trash2 aria-hidden className="size-4" />}
              onClick={() => setConfirming(true)}
            >
              {t('history.clear')}
            </Button>
          </>
        )}
      </Dialog>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('history.clear')}
        body={t('history.clearConfirm')}
        confirmLabel={t('history.clear')}
        tone="danger"
        onConfirm={() => {
          clear();
          toast(t('history.cleared'), { tone: 'success' });
        }}
      />
    </>
  );
}
