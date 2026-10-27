import { Minus, Plus, Users, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../../components/Dialog';
import { Avatar } from '../../components/Person';
import { Button, IconButton } from '../../components/ui';
import { useMoney } from '../../lib/hooks';
import type { Share } from '../../lib/money';
import { setShares } from '../../state/actions';
import { useBill } from '../../state/bill';
import type { BillItem } from '../../state/types';

/** Tap-to-assign: the keyboard- and screen-reader-friendly alternative to drag and drop. */
export function ItemSheet({ item, onClose }: { item: BillItem; onClose: () => void }) {
  const { t } = useTranslation();
  const { format } = useMoney();
  const people = useBill((s) => s.data.people);
  const current = useBill((s) => s.data.assignments[item.id]);
  const [draft, setDraft] = useState<Record<string, number>>(() =>
    Object.fromEntries((current ?? []).map((s) => [s.personId, s.weight])),
  );

  const close = () => {
    const shares: Share[] = people
      .filter((p) => (draft[p.id] ?? 0) > 0)
      .map((p) => ({ personId: p.id, weight: draft[p.id]! }));
    const before = JSON.stringify(current ?? []);
    if (JSON.stringify(shares) !== before) setShares(item.id, shares);
    onClose();
  };

  const setWeight = (personId: string, weight: number) =>
    setDraft((d) => {
      const next = { ...d };
      if (weight <= 0) delete next[personId];
      else next[personId] = Math.min(20, weight);
      return next;
    });

  const totalWeight = Object.values(draft).reduce((a, b) => a + b, 0);

  return (
    <Dialog
      open
      onClose={close}
      title={t('assign.sheetTitle', { item: item.name })}
      footer={
        <Button block onClick={close}>
          {t('common.done')}
        </Button>
      }
    >
      <p className="tabular -mt-1 mb-3 text-muted">
        {item.quantity !== 1 ? `${item.quantity} × ` : ''}
        {format(item.lineTotalMinor)}
      </p>
      <div className="mb-3 flex gap-2">
        <Button
          variant="secondary"
          className="flex-1"
          icon={<Users aria-hidden className="size-4" />}
          onClick={() => setDraft(Object.fromEntries(people.map((p) => [p.id, 1])))}
        >
          {t('assign.everyoneShared')}
        </Button>
        <Button
          variant="ghost"
          icon={<X aria-hidden className="size-4" />}
          onClick={() => setDraft({})}
        >
          {t('assign.clear')}
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        {people.map((person) => {
          const weight = draft[person.id] ?? 0;
          const checked = weight > 0;
          return (
            <li
              key={person.id}
              className={`flex items-center gap-2 rounded-2xl border p-1.5 pl-3 ${
                checked ? 'border-primary bg-surface-2' : 'border-border'
              }`}
            >
              <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--primary)]"
                  checked={checked}
                  onChange={(e) => setWeight(person.id, e.target.checked ? 1 : 0)}
                />
                <Avatar person={person} />
                <span className="font-medium">{person.name}</span>
              </label>
              {checked && (
                <div
                  className="flex items-center"
                  role="group"
                  aria-label={`${t('assign.shares')}: ${person.name}`}
                >
                  <IconButton
                    label={t('assign.lessShare', { name: person.name })}
                    onClick={() => setWeight(person.id, weight - 1)}
                  >
                    <Minus aria-hidden className="size-4" />
                  </IconButton>
                  <span className="tabular w-6 text-center font-semibold" aria-live="polite">
                    {weight}
                  </span>
                  <IconButton
                    label={t('assign.moreShare', { name: person.name })}
                    onClick={() => setWeight(person.id, weight + 1)}
                  >
                    <Plus aria-hidden className="size-4" />
                  </IconButton>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {totalWeight > 0 && <p className="mt-3 text-sm text-muted">{t('assign.sharesHint')}</p>}
    </Dialog>
  );
}
