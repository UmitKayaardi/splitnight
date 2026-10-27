import { sum } from './allocate';

export interface ReconcileInput {
  itemLineTotalsMinor: readonly number[];
  taxesOnTopMinor: readonly number[];
  serviceChargeMinor: number;
  tipMinor: number;
  discountsMinor: readonly number[];
  receiptTotalMinor: number | null | undefined;
}

export interface Reconciliation {
  expectedMinor: number;
  receiptTotalMinor: number | null;
  /** receipt total − what the items add up to. Positive means items are missing. */
  differenceMinor: number;
  matches: boolean;
}

/** Tolerance of one minor unit absorbs the receipt's own rounding. */
export const RECONCILE_TOLERANCE_MINOR = 1;

export function reconcile(input: ReconcileInput): Reconciliation {
  const expected =
    sum(input.itemLineTotalsMinor) +
    sum(input.taxesOnTopMinor) +
    input.serviceChargeMinor +
    input.tipMinor -
    sum(input.discountsMinor.map((d) => Math.abs(d)));
  if (input.receiptTotalMinor === null || input.receiptTotalMinor === undefined) {
    return { expectedMinor: expected, receiptTotalMinor: null, differenceMinor: 0, matches: true };
  }
  const difference = input.receiptTotalMinor - expected;
  return {
    expectedMinor: expected,
    receiptTotalMinor: input.receiptTotalMinor,
    differenceMinor: difference,
    matches: Math.abs(difference) <= RECONCILE_TOLERANCE_MINOR,
  };
}
