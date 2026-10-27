import { m } from 'framer-motion';
import { Check, MessageSquareText, Pencil, Sparkles, Undo2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AssignResponse } from '../../../shared/schemas';
import { AvatarStack } from '../../components/Person';
import { Button, Card } from '../../components/ui';
import { useBill } from '../../state/bill';
import type { BillItem } from '../../state/types';

export interface ProposalState {
  utterance: string;
  result: AssignResponse;
  /** Items as they were when the sentence was sent (applying may split lines). */
  items: BillItem[];
  /** Undo-history length right after it was applied, so Undo only reverts this proposal. */
  appliedAt: number | null;
}

export function ProposalPanel({
  proposal,
  onApply,
  onEdit,
  onDismiss,
}: {
  proposal: ProposalState;
  onApply: () => void;
  onEdit: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const people = useBill((s) => s.data.people);
  const historyLength = useBill((s) => s.past.length);
  const { result, utterance, appliedAt, items } = proposal;
  const applied = appliedAt !== null;
  const canUndo = applied && historyLength === appliedAt;
  const nothing = result.assignments.length === 0;

  const rows = result.assignments.flatMap((a) => {
    const item = items.find((i) => i.id === a.itemId);
    if (!item) return [];
    const sharers = a.shares
      .map((s) => people.find((p) => p.id === s.personId))
      .filter((p): p is NonNullable<typeof p> => !!p);
    const everyone = sharers.length === people.length && people.length > 2;
    const uneven = new Set(a.shares.map((s) => s.weight)).size > 1;
    const named = a.shares.flatMap((s) => {
      const p = people.find((person) => person.id === s.personId);
      return p ? [uneven ? `${p.name} ×${s.weight}` : p.name] : [];
    });
    const name = item?.name ?? '';
    return [
      {
        key: `${a.itemId}-${a.units ?? 'all'}`,
        label:
          a.units && item
            ? `${name} (${t('assign.units', { count: a.units, total: item.quantity })})`
            : name,
        sharers,
        who: everyone && !uneven ? t('assign.everyone') : named.join(', '),
      },
    ];
  });

  return (
    <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card as="section" className="overflow-hidden">
        <div className="flex items-center gap-2 bg-surface-2 px-4 py-2.5">
          <Sparkles aria-hidden className="size-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">{t('assign.previewTitle')}</h2>
        </div>
        <div className="flex flex-col gap-3 p-4" aria-live="polite">
          <p className="flex gap-2 text-sm text-muted">
            <MessageSquareText aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>{t('assign.youSaid', { text: utterance })}</span>
          </p>
          {nothing ? (
            <p>{t('assign.nothing')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {rows.map((row) => (
                <li key={row.key} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{row.label}</span>
                    <span className="block text-sm text-muted">{row.who}</span>
                  </span>
                  <AvatarStack people={row.sharers} />
                </li>
              ))}
            </ul>
          )}
          {result.notes.length > 0 && !nothing && (
            <p className="text-sm text-muted">{result.notes.join(' ')}</p>
          )}
          {result.unmatched.length > 0 && (
            <p className="rounded-xl bg-warning-bg px-3 py-2 text-sm text-warning-fg">
              {t('assign.unmatched', { phrases: result.unmatched.map((p) => `“${p}”`).join(', ') })}
            </p>
          )}
          {applied ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="flex flex-1 items-center gap-2 text-sm font-medium text-success">
                <Check aria-hidden className="size-4" />
                {t('assign.applied')}
              </p>
              {canUndo && (
                <Button
                  variant="secondary"
                  icon={<Undo2 aria-hidden className="size-4" />}
                  onClick={() => useBill.getState().undo()}
                >
                  {t('common.undo')}
                </Button>
              )}
              <Button variant="ghost" onClick={onDismiss} aria-label={t('assign.dismiss')}>
                <X aria-hidden className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {!nothing && (
                <Button
                  className="flex-1"
                  icon={<Check aria-hidden className="size-4" />}
                  onClick={onApply}
                >
                  {t('assign.apply')}
                </Button>
              )}
              <Button
                variant="secondary"
                icon={<Pencil aria-hidden className="size-4" />}
                onClick={onEdit}
              >
                {t('assign.editSentence')}
              </Button>
              <Button variant="ghost" onClick={onDismiss}>
                {t('assign.dismiss')}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </m.div>
  );
}
