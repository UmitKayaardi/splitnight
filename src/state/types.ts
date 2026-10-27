import type { ParsedReceipt, ReceiptItem, ReceiptWarning } from '../../shared/schemas';
import type { Assignments, RouletteOutcome, RoundingStep, TipSplit } from '../lib/money';
import type { SampleId } from '../samples/samples';

export interface BillItem extends ReceiptItem {
  /** Added by hand rather than read from the receipt. */
  custom?: boolean;
}

export interface Person {
  id: string;
  name: string;
  /** Index into PERSON_COLORS. */
  color: number;
  emoji?: string;
}

export type AmountMode = 'percent' | 'fixed';

export interface ExtrasSettings {
  service: { enabled: boolean; mode: AmountMode; ratePercent: number; amountMinor: number };
  tip: { mode: 'none' | AmountMode; ratePercent: number; amountMinor: number; split: TipSplit };
  discount: { mode: 'none' | AmountMode; ratePercent: number; amountMinor: number };
  rounding: RoundingStep;
  roundingCoverId: string | null;
}

export interface ReceiptMeta {
  merchant?: string;
  totalMinor?: number;
  subtotalMinor?: number;
  taxLines: ParsedReceipt['taxLines'];
  serviceCharge?: ParsedReceipt['serviceCharge'];
  tipMinor?: number;
  discounts: ParsedReceipt['discounts'];
  warnings: ReceiptWarning[];
}

export type BillSource = 'scan' | 'sample' | 'manual';

export interface BillData {
  source: BillSource;
  sampleId: SampleId | null;
  currency: string;
  /** True when the currency came from the receipt rather than the default. */
  currencyDetected: boolean;
  receipt: ReceiptMeta;
  items: BillItem[];
  people: Person[];
  assignments: Assignments;
  extras: ExtrasSettings;
  roulette: RouletteOutcome | null;
}

export type Step = 'home' | 'scanning' | 'review' | 'people' | 'assign' | 'extras' | 'results';

export const FLOW_STEPS = ['review', 'people', 'assign', 'extras', 'results'] as const;
export type FlowStep = (typeof FLOW_STEPS)[number];
