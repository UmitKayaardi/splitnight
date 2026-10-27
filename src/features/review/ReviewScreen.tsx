import { AlertTriangle, ArrowRight, Eye, EyeOff, Plus, Receipt } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../components/Layout';
import { MoneyInput } from '../../components/MoneyInput';
import { Banner, Button, Card, Field, inputClass } from '../../components/ui';
import { useMoney } from '../../lib/hooks';
import { addItem } from '../../state/actions';
import { useBill } from '../../state/bill';
import { reconcileBill } from '../../state/derive';
import { toast } from '../../state/toasts';
import { CurrencySelect } from '../extras/CurrencySelect';
import { ItemRow } from './ItemRow';

function AddItemForm({ autoFocus }: { autoFocus: boolean }) {
  const { t } = useTranslation();
  const { currency } = useMoney();
  const [name, setName] = useState('');
  const [price, setPrice] = useState<number | null>(null);
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({});
  const [resetKey, setResetKey] = useState(0);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = {
      name: name.trim() ? undefined : t('review.invalidName'),
      price: price !== null ? undefined : t('review.invalidPrice'),
    };
    setErrors(next);
    if (next.name || next.price || price === null) return;
    addItem(name, price);
    toast(t('review.added', { name: name.trim() }), { tone: 'success', undoable: true });
    setName('');
    setPrice(null);
    setResetKey((k) => k + 1);
    document.getElementById('new-item-name')?.focus();
  };

  return (
    <Card as="section" className="p-4">
      <h2 className="font-display text-lg font-semibold">{t('review.addItemTitle')}</h2>
      <p className="text-sm text-muted">{t('review.addItemHint')}</p>
      <form onSubmit={submit} className="mt-3 grid grid-cols-[1fr_7rem] gap-3" noValidate>
        <Field label={t('review.name')} htmlFor="new-item-name" error={errors.name}>
          <input
            id="new-item-name"
            className={inputClass}
            value={name}
            maxLength={80}
            autoFocus={autoFocus}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!errors.name || undefined}
          />
        </Field>
        <Field label={t('review.price')} htmlFor="new-item-price" error={errors.price}>
          <MoneyInput
            key={resetKey}
            id="new-item-price"
            currency={currency}
            valueMinor={price}
            onCommit={setPrice}
            invalid={!!errors.price}
            placeholder="0.00"
          />
        </Field>
        <Button
          type="submit"
          variant="secondary"
          className="col-span-2"
          icon={<Plus aria-hidden className="size-5" />}
        >
          {t('review.addItem')}
        </Button>
      </form>
    </Card>
  );
}

function ExtrasFound() {
  const { t } = useTranslation();
  const { format } = useMoney();
  const receipt = useBill((s) => s.data.receipt);
  const lines: Array<{ label: string; amount: number; negative?: boolean }> = [
    ...(receipt.serviceCharge
      ? [
          {
            label: t('review.serviceFound', { label: receipt.serviceCharge.label }),
            amount: receipt.serviceCharge.amountMinor,
          },
        ]
      : []),
    ...receipt.taxLines.map((tax) => ({
      label: tax.includedInPrices
        ? t('review.taxIncluded', { label: tax.label })
        : t('review.taxOnTop', { label: tax.label }),
      amount: tax.amountMinor,
    })),
    ...receipt.discounts.map((d) => ({
      label: t('review.discountFound', { label: d.label }),
      amount: d.amountMinor,
      negative: true,
    })),
    ...(receipt.tipMinor ? [{ label: t('review.tipFound'), amount: receipt.tipMinor }] : []),
  ];
  if (lines.length === 0 && receipt.totalMinor === undefined) return null;

  return (
    <Card as="section" className="p-4">
      <h2 className="font-display text-lg font-semibold">{t('review.extrasFound')}</h2>
      <dl className="mt-2 flex flex-col gap-1.5 text-sm">
        {lines.map((line) => (
          <div key={line.label} className="flex justify-between gap-3">
            <dt className="text-muted">{line.label}</dt>
            <dd className="tabular font-medium">
              {line.negative ? '−' : ''}
              {format(line.amount)}
            </dd>
          </div>
        ))}
        {receipt.totalMinor !== undefined && (
          <div className="mt-1 flex justify-between gap-3 border-t border-border pt-2 text-base">
            <dt className="font-semibold">{t('review.receiptTotal')}</dt>
            <dd className="tabular font-display font-semibold">{format(receipt.totalMinor)}</dd>
          </div>
        )}
      </dl>
    </Card>
  );
}

export function ReviewScreen() {
  const { t } = useTranslation();
  const { format, signed } = useMoney();
  const data = useBill((s) => s.data);
  const go = useBill((s) => s.go);
  const [showReceipt, setShowReceipt] = useState(false);
  const check = reconcileBill(data);
  const manual = data.source === 'manual';
  const itemsTotal = data.items.reduce((a, i) => a + i.lineTotalMinor, 0);

  return (
    <Screen
      step="review"
      title={manual ? t('review.manualTitle') : t('review.title')}
      subtitle={manual ? t('review.manualSubtitle') : t('review.subtitle')}
      actions={
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 text-sm">
            <p className="text-muted">{t('review.itemCount', { count: data.items.length })}</p>
            <p className="tabular font-display text-lg font-semibold">{format(itemsTotal)}</p>
          </div>
          <Button
            size="lg"
            disabled={data.items.length === 0}
            onClick={() => go('people')}
            icon={<ArrowRight aria-hidden className="order-last size-5" />}
          >
            {t('review.next')}
          </Button>
        </div>
      }
    >
      {!manual && (
        <div className="flex items-center gap-3">
          <Receipt aria-hidden className="size-6 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg leading-tight font-semibold">
              {data.receipt.merchant ?? t('review.merchantFallback')}
            </p>
            {data.source === 'sample' && (
              <span className="mt-0.5 inline-block rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
                {t('review.sampleBadge')}
              </span>
            )}
          </div>
          <CurrencySelect compact />
        </div>
      )}

      {data.sampleId && (
        <div>
          <Button
            variant="ghost"
            icon={
              showReceipt ? (
                <EyeOff aria-hidden className="size-4" />
              ) : (
                <Eye aria-hidden className="size-4" />
              )
            }
            onClick={() => setShowReceipt((v) => !v)}
            aria-expanded={showReceipt}
          >
            {showReceipt ? t('review.hideReceipt') : t('review.viewReceipt')}
          </Button>
          {showReceipt && (
            <img
              src={`/samples/${data.sampleId}.svg`}
              alt={t('review.receiptImageAlt', { name: data.receipt.merchant ?? '' })}
              className="mx-auto mt-2 w-full max-w-xs rounded-2xl border border-border bg-white shadow-card"
            />
          )}
        </div>
      )}

      {data.receipt.warnings.map((w) => (
        <Banner key={w} icon={<AlertTriangle aria-hidden className="size-5" />}>
          {t(`review.warnings.${w}`)}
        </Banner>
      ))}

      {!check.matches && check.receiptTotalMinor !== null && (
        <Banner
          tone="warning"
          icon={<AlertTriangle aria-hidden className="size-5" />}
          title={t('review.mismatchTitle')}
        >
          {t('review.mismatchBody', {
            expected: format(check.expectedMinor),
            total: format(check.receiptTotalMinor),
            difference: signed(check.differenceMinor),
          })}
        </Banner>
      )}

      {data.items.length === 0 ? (
        <p className="rounded-2xl bg-surface-2 p-4 text-center text-muted">{t('review.empty')}</p>
      ) : (
        <ul
          className="flex flex-col gap-3"
          aria-label={t('review.itemCount', { count: data.items.length })}
        >
          {data.items.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </ul>
      )}

      <AddItemForm autoFocus={manual && data.items.length === 0} />
      {!manual && <ExtrasFound />}
    </Screen>
  );
}
