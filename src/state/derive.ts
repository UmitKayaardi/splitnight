import { computeSplit, reconcile, type Adjustment, type SplitResult } from '../lib/money';
import type { BillData } from './types';

interface AdjustmentSetting {
  mode: 'none' | 'percent' | 'fixed';
  ratePercent: number;
  amountMinor: number;
}

function toAdjustment(setting: AdjustmentSetting): Adjustment {
  switch (setting.mode) {
    case 'none':
      return { mode: 'none' };
    case 'percent':
      return { mode: 'percent', ratePercent: setting.ratePercent };
    case 'fixed':
      return { mode: 'fixed', amountMinor: setting.amountMinor };
  }
}

export function taxesOnTop(data: BillData): number[] {
  return data.receipt.taxLines.filter((t) => !t.includedInPrices).map((t) => t.amountMinor);
}

export function computeBill(data: BillData): SplitResult {
  const { extras } = data;
  return computeSplit({
    people: data.people.map((p) => p.id),
    items: data.items,
    assignments: data.assignments,
    discount: toAdjustment(extras.discount),
    serviceCharge: extras.service.enabled ? toAdjustment(extras.service) : { mode: 'none' },
    tip: toAdjustment(extras.tip),
    tipSplit: extras.tip.split,
    taxesOnTopMinor: taxesOnTop(data),
    rounding: { step: extras.rounding, coverPersonId: extras.roundingCoverId },
    roulette: data.roulette,
  });
}

/** Compares the current items (plus the extras printed on the receipt) with its total. */
export function reconcileBill(data: BillData) {
  return reconcile({
    itemLineTotalsMinor: data.items.map((i) => i.lineTotalMinor),
    taxesOnTopMinor: taxesOnTop(data),
    serviceChargeMinor: data.receipt.serviceCharge?.amountMinor ?? 0,
    tipMinor: data.receipt.tipMinor ?? 0,
    discountsMinor: data.receipt.discounts.map((d) => d.amountMinor),
    receiptTotalMinor: data.receipt.totalMinor,
  });
}

export function unassignedItems(data: BillData) {
  const people = new Set(data.people.map((p) => p.id));
  return data.items.filter(
    (item) =>
      !(data.assignments[item.id] ?? []).some((s) => people.has(s.personId) && s.weight > 0),
  );
}

export function hasDesserts(data: BillData): boolean {
  return data.items.some((i) => i.category === 'dessert');
}
