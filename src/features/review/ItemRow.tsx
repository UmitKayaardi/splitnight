import { Minus, Plus, Scissors, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MoneyInput } from '../../components/MoneyInput';
import { IconButton } from '../../components/ui';
import { useMoney } from '../../lib/hooks';
import { deleteItem, splitItemIntoUnits, updateItem } from '../../state/actions';
import { toast } from '../../state/toasts';
import type { BillItem } from '../../state/types';

export const LOW_CONFIDENCE = 0.7;

export function ItemRow({ item }: { item: BillItem }) {
  const { t } = useTranslation();
  const { currency, format } = useMoney();
  const id = useId();
  const [name, setName] = useState(item.name);
  const [shownName, setShownName] = useState(item.name);
  if (shownName !== item.name) {
    setShownName(item.name);
    setName(item.name);
  }

  const unsure = item.confidence < LOW_CONFIDENCE;
  const canSplit = Number.isInteger(item.quantity) && item.quantity >= 2 && item.quantity <= 30;

  const commitName = () => {
    const clean = name.trim();
    if (!clean) setName(item.name);
    else if (clean !== item.name) updateItem(item.id, { name: clean });
  };

  const setQuantity = (quantity: number) => {
    if (quantity >= 1 && quantity <= 99) updateItem(item.id, { quantity });
  };

  return (
    <li
      className={`rounded-3xl border bg-surface p-3 shadow-card ${
        unsure
          ? 'border-[var(--glow-2)] ring-2 ring-[color-mix(in_srgb,var(--glow-2)_35%,transparent)]'
          : 'border-border'
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${id}-name`} className="sr-only">
            {t('review.name')}
          </label>
          <input
            id={`${id}-name`}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="min-h-11 w-full rounded-xl border border-transparent bg-transparent px-2 font-display text-lg font-semibold hover:border-border focus:border-ring focus:outline-none"
          />
          {unsure && (
            <span
              className="ml-2 inline-flex items-center gap-1 rounded-full bg-warning-bg px-2.5 py-0.5 text-xs font-semibold text-warning-fg"
              title={t('review.checkThisHint')}
            >
              {t('review.checkThis')}
              <span className="sr-only">: {t('review.checkThisHint')}</span>
            </span>
          )}
        </div>
        <p
          className="tabular pt-2.5 font-display text-lg font-semibold"
          aria-label={t('review.lineTotal')}
        >
          {format(item.lineTotalMinor)}
        </p>
        <IconButton
          label={t('review.deleteItem', { name: item.name })}
          tone="danger"
          onClick={() => {
            deleteItem(item.id);
            toast(t('review.deleted', { name: item.name }), { undoable: true });
          }}
        >
          <Trash2 aria-hidden className="size-5" />
        </IconButton>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div
          className="flex items-center rounded-2xl bg-surface-2"
          role="group"
          aria-label={t('review.quantity')}
        >
          <IconButton
            label={t('review.quantityDown', { name: item.name })}
            onClick={() => setQuantity(item.quantity - 1)}
            disabled={item.quantity <= 1}
          >
            <Minus aria-hidden className="size-4" />
          </IconButton>
          <span className="tabular min-w-7 text-center font-semibold" aria-live="polite">
            {item.quantity}
          </span>
          <IconButton
            label={t('review.quantityUp', { name: item.name })}
            onClick={() => setQuantity(item.quantity + 1)}
          >
            <Plus aria-hidden className="size-4" />
          </IconButton>
        </div>
        <span aria-hidden className="text-muted">
          ×
        </span>
        <label htmlFor={`${id}-price`} className="sr-only">
          {t('review.unitPrice')}
        </label>
        <MoneyInput
          id={`${id}-price`}
          className="w-24"
          currency={currency}
          valueMinor={item.unitPriceMinor}
          onCommit={(minor) => {
            if (minor !== null && minor !== item.unitPriceMinor)
              updateItem(item.id, { unitPriceMinor: minor });
          }}
        />
        {canSplit && (
          <IconButton
            className="ml-auto"
            label={t('review.split', { count: item.quantity })}
            onClick={() => {
              splitItemIntoUnits(item.id);
              toast(t('review.splitDone', { name: item.name, count: item.quantity }), {
                undoable: true,
              });
            }}
          >
            <Scissors aria-hidden className="size-5" />
          </IconButton>
        )}
      </div>
    </li>
  );
}
