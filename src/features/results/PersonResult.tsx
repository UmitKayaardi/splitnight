import { AnimatePresence, m } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../../components/Person';
import { useMoney } from '../../lib/hooks';
import type { PersonBreakdown } from '../../lib/money';
import type { BillItem, Person } from '../../state/types';

export function PersonResult({
  person,
  breakdown,
  items,
  highlight,
}: {
  person: Person;
  breakdown: PersonBreakdown;
  items: readonly BillItem[];
  highlight?: boolean;
}) {
  const { t } = useTranslation();
  const { format, signed } = useMoney();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const extras = [
    { label: t('results.discountLine'), amount: -breakdown.discountMinor },
    { label: t('results.serviceLine'), amount: breakdown.serviceMinor },
    { label: t('results.tipLine'), amount: breakdown.tipMinor },
    { label: t('results.taxLine'), amount: breakdown.taxMinor },
    { label: t('results.rouletteLine'), amount: breakdown.rouletteMinor },
    { label: t('results.roundingLine'), amount: breakdown.roundingMinor },
  ].filter((line) => line.amount !== 0);

  return (
    <li
      className={`overflow-hidden rounded-3xl border bg-surface shadow-card ${
        highlight ? 'border-primary ring-2 ring-primary/40' : 'border-border'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={
          open
            ? t('results.hideBreakdown', { name: person.name })
            : t('results.showBreakdown', { name: person.name })
        }
        className="flex min-h-16 w-full items-center gap-3 p-3 text-left"
      >
        <Avatar person={person} size="lg" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-xl font-semibold">{person.name}</span>
          {breakdown.totalMinor === 0 && (
            <span className="block text-sm text-muted">{t('results.nothingOwed')}</span>
          )}
        </span>
        <span className="tabular font-display text-2xl font-bold">
          {format(breakdown.totalMinor)}
        </span>
        <ChevronDown
          aria-hidden
          className={`size-5 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <dl className="flex flex-col gap-1.5 border-t border-border px-4 py-3 text-sm">
              {breakdown.items.map((part) => {
                const item = items.find((i) => i.id === part.itemId);
                const shared = part.weight !== part.totalWeight;
                return (
                  <div key={part.itemId} className="flex justify-between gap-3">
                    <dt className="min-w-0">
                      <span className="block truncate">
                        {item && item.quantity !== 1 ? `${item.quantity} × ` : ''}
                        {item?.name}
                      </span>
                      {shared && (
                        <span className="block text-xs text-muted">
                          {t('results.shareOf', { weight: part.weight, total: part.totalWeight })}
                        </span>
                      )}
                    </dt>
                    <dd className="tabular shrink-0">{format(part.amountMinor)}</dd>
                  </div>
                );
              })}
              {extras.map((line) => (
                <div key={line.label} className="flex justify-between gap-3 text-muted">
                  <dt>{line.label}</dt>
                  <dd className="tabular">{signed(line.amount)}</dd>
                </div>
              ))}
              <div className="mt-1 flex justify-between gap-3 border-t border-border pt-2 font-semibold">
                <dt>{t('common.total')}</dt>
                <dd className="tabular">{format(breakdown.totalMinor)}</dd>
              </div>
            </dl>
          </m.div>
        )}
      </AnimatePresence>
    </li>
  );
}
