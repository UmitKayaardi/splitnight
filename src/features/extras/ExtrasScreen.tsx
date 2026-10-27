import { ArrowRight } from 'lucide-react';
import { useId, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../components/Layout';
import { MoneyInput } from '../../components/MoneyInput';
import { Avatar } from '../../components/Person';
import { Button, Card, Segmented, Switch, inputBase, inputClass } from '../../components/ui';
import { useMoney } from '../../lib/hooks';
import type { RoundingStep } from '../../lib/money';
import { updateExtras } from '../../state/actions';
import { useBill } from '../../state/bill';
import { computeBill, taxesOnTop } from '../../state/derive';
import type { AmountMode } from '../../state/types';
import { CurrencySelect } from './CurrencySelect';

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card as="section" className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </Card>
  );
}

function RateInput({
  value,
  onCommit,
  label,
}: {
  value: number;
  onCommit: (rate: number) => void;
  label: string;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm text-muted">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        max={100}
        step={0.5}
        defaultValue={value}
        key={value}
        onBlur={(e) => {
          const rate = Number(e.target.value.replace(',', '.'));
          if (Number.isFinite(rate) && rate >= 0 && rate <= 100 && rate !== value) onCommit(rate);
          else e.target.value = String(value);
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className={`${inputBase} tabular w-24 text-right`}
      />
    </div>
  );
}

function AmountEditor({
  mode,
  ratePercent,
  amountMinor,
  onRate,
  onAmount,
}: {
  mode: AmountMode;
  ratePercent: number;
  amountMinor: number;
  onRate: (rate: number) => void;
  onAmount: (amount: number) => void;
}) {
  const { t } = useTranslation();
  const { currency } = useMoney();
  const id = useId();
  return mode === 'percent' ? (
    <RateInput value={ratePercent} onCommit={onRate} label={t('extras.rate')} />
  ) : (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm text-muted">
        {t('extras.amount')}
      </label>
      <MoneyInput
        id={id}
        className="w-28"
        currency={currency}
        valueMinor={amountMinor}
        onCommit={(m) => onAmount(m ?? 0)}
      />
    </div>
  );
}

export function ExtrasScreen() {
  const { t } = useTranslation();
  const { format, short } = useMoney();
  const data = useBill((s) => s.data);
  const go = useBill((s) => s.go);
  const { extras, receipt, people } = data;
  const result = useMemo(() => computeBill(data), [data]);
  const taxTop = taxesOnTop(data).reduce((a, b) => a + b, 0);

  const steps: RoundingStep[] = [0, 10, 50, 100];

  return (
    <Screen
      step="extras"
      title={t('extras.title')}
      subtitle={t('extras.subtitle')}
      actions={
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 text-sm">
            <p className="text-muted">{t('extras.billTotal')}</p>
            <p className="tabular font-display text-lg font-semibold">
              {format(result.billTotalMinor)}
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => go('results')}
            icon={<ArrowRight aria-hidden className="order-last size-5" />}
          >
            {t('extras.next')}
          </Button>
        </div>
      }
    >
      <Section
        title={t('extras.service')}
        aside={
          <Switch
            label={t('extras.service')}
            checked={extras.service.enabled}
            onChange={(enabled) => updateExtras((x) => void (x.service.enabled = enabled))}
          />
        }
      >
        {receipt.serviceCharge && (
          <p className="text-sm text-muted">
            {t('extras.serviceFromReceipt', { amount: format(receipt.serviceCharge.amountMinor) })}
          </p>
        )}
        {extras.service.enabled && (
          <>
            <Segmented
              name="service-mode"
              label={t('extras.service')}
              value={extras.service.mode}
              onChange={(mode) => updateExtras((x) => void (x.service.mode = mode))}
              options={[
                { value: 'percent', label: t('extras.percent') },
                { value: 'fixed', label: t('extras.fixed') },
              ]}
            />
            <AmountEditor
              mode={extras.service.mode}
              ratePercent={extras.service.ratePercent}
              amountMinor={extras.service.amountMinor}
              onRate={(rate) => updateExtras((x) => void (x.service.ratePercent = rate))}
              onAmount={(amount) => updateExtras((x) => void (x.service.amountMinor = amount))}
            />
          </>
        )}
      </Section>

      <Section title={t('extras.tip')}>
        <Segmented
          name="tip-mode"
          label={t('extras.tip')}
          value={extras.tip.mode}
          onChange={(mode) => updateExtras((x) => void (x.tip.mode = mode))}
          options={[
            { value: 'none', label: t('extras.tipNone') },
            { value: 'percent', label: t('extras.percent') },
            { value: 'fixed', label: t('extras.fixed') },
          ]}
        />
        {extras.tip.mode !== 'none' && (
          <>
            <AmountEditor
              mode={extras.tip.mode}
              ratePercent={extras.tip.ratePercent}
              amountMinor={extras.tip.amountMinor}
              onRate={(rate) => updateExtras((x) => void (x.tip.ratePercent = rate))}
              onAmount={(amount) => updateExtras((x) => void (x.tip.amountMinor = amount))}
            />
            <p className="text-sm font-medium text-muted">{t('extras.tipSplit')}</p>
            <Segmented
              name="tip-split"
              label={t('extras.tipSplit')}
              value={extras.tip.split}
              onChange={(split) => updateExtras((x) => void (x.tip.split = split))}
              options={[
                { value: 'proportional', label: t('extras.proportional') },
                { value: 'equal', label: t('extras.equal') },
              ]}
            />
          </>
        )}
      </Section>

      <Section title={t('extras.discount')}>
        {receipt.discounts.length > 0 && (
          <p className="text-sm text-muted">
            {t('extras.discountFromReceipt', {
              amount: format(receipt.discounts.reduce((a, d) => a + d.amountMinor, 0)),
            })}
          </p>
        )}
        <Segmented
          name="discount-mode"
          label={t('extras.discount')}
          value={extras.discount.mode}
          onChange={(mode) => updateExtras((x) => void (x.discount.mode = mode))}
          options={[
            { value: 'none', label: t('extras.discountNone') },
            { value: 'percent', label: t('extras.percent') },
            { value: 'fixed', label: t('extras.fixed') },
          ]}
        />
        {extras.discount.mode !== 'none' && (
          <AmountEditor
            mode={extras.discount.mode}
            ratePercent={extras.discount.ratePercent}
            amountMinor={extras.discount.amountMinor}
            onRate={(rate) => updateExtras((x) => void (x.discount.ratePercent = rate))}
            onAmount={(amount) => updateExtras((x) => void (x.discount.amountMinor = amount))}
          />
        )}
      </Section>

      <Section title={t('extras.rounding')}>
        <Segmented
          name="rounding"
          label={t('extras.rounding')}
          value={String(extras.rounding) as `${RoundingStep}`}
          onChange={(value) =>
            updateExtras((x) => void (x.rounding = Number(value) as RoundingStep))
          }
          options={steps.map((step) => ({
            value: String(step) as `${RoundingStep}`,
            label:
              step === 0 ? t('extras.roundingNone') : t('extras.roundingTo', { step: short(step) }),
          }))}
        />
        {extras.rounding > 0 && (
          <>
            <p className="text-sm text-muted">{t('extras.roundingHint')}</p>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
              {t('extras.roundingCover')}
              <select
                className={inputClass}
                value={extras.roundingCoverId ?? ''}
                onChange={(e) =>
                  updateExtras((x) => void (x.roundingCoverId = e.target.value || null))
                }
              >
                <option value="">{t('extras.roundingCoverAuto')}</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </Section>

      <Section title={t('extras.currency')}>
        <CurrencySelect />
        {taxTop > 0 && (
          <p className="text-sm text-muted">{t('extras.taxOnTop', { amount: format(taxTop) })}</p>
        )}
      </Section>

      <Section title={t('extras.preview')}>
        <ul className="flex flex-col divide-y divide-border" aria-live="polite">
          {result.people.map((b) => {
            const person = people.find((p) => p.id === b.personId)!;
            return (
              <li key={b.personId} className="flex items-center gap-3 py-2">
                <Avatar person={person} />
                <span className="min-w-0 flex-1 truncate font-medium">{person.name}</span>
                <span className="tabular font-display text-lg font-semibold">
                  {format(b.totalMinor)}
                </span>
              </li>
            );
          })}
        </ul>
      </Section>
    </Screen>
  );
}
