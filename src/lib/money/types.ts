export type Category = 'starter' | 'main' | 'side' | 'dessert' | 'drink' | 'other';

export interface SplitItem {
  id: string;
  lineTotalMinor: number;
  category: Category;
}

export interface Share {
  personId: string;
  weight: number;
}

/** itemId → who shares it and in what proportion. Missing or empty means unassigned. */
export type Assignments = Record<string, Share[]>;

export type Adjustment =
  | { mode: 'none' }
  | { mode: 'percent'; ratePercent: number }
  | { mode: 'fixed'; amountMinor: number };

export type TipSplit = 'proportional' | 'equal';

export type RouletteStake = 'all' | 'tipService' | 'desserts';

export interface RouletteOutcome {
  loserId: string;
  stake: RouletteStake;
}

/** 0 = no rounding; otherwise round each person to a multiple of this many minor units. */
export type RoundingStep = 0 | 10 | 50 | 100;

export interface SplitInput {
  /** Person ids in display order. */
  people: readonly string[];
  items: readonly SplitItem[];
  assignments: Assignments;
  discount: Adjustment;
  serviceCharge: Adjustment;
  tip: Adjustment;
  tipSplit: TipSplit;
  /** Taxes printed on the receipt that are added on top of prices (e.g. US sales tax). */
  taxesOnTopMinor: readonly number[];
  rounding: { step: RoundingStep; coverPersonId?: string | null };
  roulette?: RouletteOutcome | null;
}

export interface ItemPart {
  itemId: string;
  amountMinor: number;
  weight: number;
  totalWeight: number;
}

export interface PersonBreakdown {
  personId: string;
  items: ItemPart[];
  itemsMinor: number;
  /** Positive number, subtracted from the total. */
  discountMinor: number;
  serviceMinor: number;
  tipMinor: number;
  taxMinor: number;
  /** Signed: positive for the roulette loser, negative for everyone they cover. */
  rouletteMinor: number;
  /** Signed rounding adjustment. */
  roundingMinor: number;
  totalMinor: number;
}

export interface RoundingSummary {
  step: RoundingStep;
  applied: boolean;
  coverPersonId: string | null;
  /** What the cover person pays on top of their own rounded total (may be negative). */
  differenceMinor: number;
}

export interface SplitResult {
  people: PersonBreakdown[];
  itemsTotalMinor: number;
  discountMinor: number;
  serviceMinor: number;
  tipMinor: number;
  taxMinor: number;
  billTotalMinor: number;
  unassignedMinor: number;
  unassignedItemIds: string[];
  rounding: RoundingSummary;
}
