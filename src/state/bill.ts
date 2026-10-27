import { create } from 'zustand';
import type { ParsedReceipt } from '../../shared/schemas';
import { isValidCurrency } from '../lib/money';
import type { SampleId } from '../samples/samples';
import type { BillData, BillSource, ExtrasSettings, ReceiptMeta, Step } from './types';

const HISTORY_LIMIT = 100;

export const DEFAULT_CURRENCY = 'GBP';

export function defaultExtras(receipt?: ReceiptMeta): ExtrasSettings {
  const service = receipt?.serviceCharge;
  const discountTotal = (receipt?.discounts ?? []).reduce((a, d) => a + d.amountMinor, 0);
  return {
    service: service
      ? {
          enabled: true,
          mode: 'fixed',
          ratePercent: service.ratePercent ?? 12.5,
          amountMinor: service.amountMinor,
        }
      : { enabled: false, mode: 'percent', ratePercent: 12.5, amountMinor: 0 },
    tip: receipt?.tipMinor
      ? { mode: 'fixed', ratePercent: 10, amountMinor: receipt.tipMinor, split: 'proportional' }
      : { mode: 'none', ratePercent: 10, amountMinor: 0, split: 'proportional' },
    discount:
      discountTotal > 0
        ? { mode: 'fixed', ratePercent: 10, amountMinor: discountTotal }
        : { mode: 'none', ratePercent: 10, amountMinor: 0 },
    rounding: 0,
    roundingCoverId: null,
  };
}

export function emptyBill(source: BillSource = 'manual'): BillData {
  const receipt: ReceiptMeta = { taxLines: [], discounts: [], warnings: [] };
  return {
    source,
    sampleId: null,
    currency: DEFAULT_CURRENCY,
    currencyDetected: false,
    receipt,
    items: [],
    people: [],
    assignments: {},
    extras: defaultExtras(receipt),
    roulette: null,
  };
}

export function billFromReceipt(
  parsed: ParsedReceipt,
  source: BillSource,
  sampleId: SampleId | null = null,
): BillData {
  const receipt: ReceiptMeta = {
    merchant: parsed.merchant,
    totalMinor: parsed.totalMinor,
    subtotalMinor: parsed.subtotalMinor,
    taxLines: parsed.taxLines,
    serviceCharge: parsed.serviceCharge,
    tipMinor: parsed.tipMinor,
    discounts: parsed.discounts,
    warnings: parsed.warnings,
  };
  const detected = isValidCurrency(parsed.currency);
  return {
    ...emptyBill(source),
    sampleId,
    currency: detected ? parsed.currency : DEFAULT_CURRENCY,
    currencyDetected: detected && source === 'scan',
    receipt,
    items: parsed.items.map((item) => ({ ...item })),
    extras: defaultExtras(receipt),
  };
}

interface BillState {
  step: Step;
  data: BillData;
  past: BillData[];
  future: BillData[];
  /** The photo being read on the scanning screen. Kept in memory only. */
  pendingImage: File | null;
  /** Increases with every new photo, so the scanning screen can start fresh. */
  scanAttempt: number;
  /** True once the user has reached the results for this bill (for recent nights). */
  savedToHistory: boolean;

  go: (step: Step) => void;
  /** Applies a change as one undoable step. The recipe edits a copy of the data. */
  commit: (recipe: (draft: BillData) => void) => void;
  undo: () => void;
  redo: () => void;
  start: (data: BillData, step: Step) => void;
  scan: (file: File) => void;
  reset: () => void;
  markSaved: () => void;
}

export const useBill = create<BillState>()((set, get) => ({
  step: 'home',
  data: emptyBill(),
  past: [],
  future: [],
  pendingImage: null,
  scanAttempt: 0,
  savedToHistory: false,

  go: (step) => set({ step }),

  commit: (recipe) => {
    const { data, past } = get();
    const draft = structuredClone(data);
    recipe(draft);
    set({ data: draft, past: [...past, data].slice(-HISTORY_LIMIT), future: [] });
  },

  undo: () => {
    const { past, data, future } = get();
    const previous = past.at(-1);
    if (!previous) return;
    set({ data: previous, past: past.slice(0, -1), future: [data, ...future] });
  },

  redo: () => {
    const { past, data, future } = get();
    const next = future[0];
    if (!next) return;
    set({ data: next, past: [...past, data], future: future.slice(1) });
  },

  start: (data, step) =>
    set({ data, step, past: [], future: [], pendingImage: null, savedToHistory: false }),

  scan: (file) =>
    set((s) => ({ pendingImage: file, step: 'scanning', scanAttempt: s.scanAttempt + 1 })),

  reset: () =>
    set({
      data: emptyBill(),
      step: 'home',
      past: [],
      future: [],
      pendingImage: null,
      savedToHistory: false,
    }),

  markSaved: () => set({ savedToHistory: true }),
}));

/** A bill is "in progress" once it has items or people worth coming back to. */
export function hasBillInProgress(data: BillData): boolean {
  return data.items.length > 0 || data.people.length > 0;
}
