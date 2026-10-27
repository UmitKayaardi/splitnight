import { allocate, allocateEqually, assertMinor, percentOf, roundToStep, sum } from './allocate';
import type {
  Adjustment,
  PersonBreakdown,
  RoundingSummary,
  Share,
  SplitInput,
  SplitResult,
} from './types';

function adjustmentAmount(adjustment: Adjustment, baseMinor: number): number {
  switch (adjustment.mode) {
    case 'none':
      return 0;
    case 'percent':
      return percentOf(baseMinor, adjustment.ratePercent);
    case 'fixed':
      assertMinor(adjustment.amountMinor);
      return Math.max(0, adjustment.amountMinor);
  }
}

/** Shares that point at real people with a positive weight. */
function validShares(shares: readonly Share[] | undefined, people: ReadonlySet<string>): Share[] {
  if (!shares) return [];
  const merged = new Map<string, number>();
  for (const share of shares) {
    if (!people.has(share.personId) || !(share.weight > 0) || !Number.isFinite(share.weight)) {
      continue;
    }
    merged.set(share.personId, (merged.get(share.personId) ?? 0) + share.weight);
  }
  return [...merged].map(([personId, weight]) => ({ personId, weight }));
}

/** Allocates an extra in proportion to item subtotals; equally if nobody has items yet. */
function proportional(total: number, subtotals: readonly number[]): number[] {
  if (subtotals.length === 0) return [];
  return sum(subtotals) > 0 ? allocate(total, subtotals) : allocateEqually(total, subtotals.length);
}

/**
 * Computes what everyone owes. Pure and deterministic.
 *
 * Order: items → discount (on the item total) → service and tip (on the discounted total)
 * → taxes added on top → Bill Roulette transfer → rounding.
 * Every extra is spread with the largest-remainder method, so nothing is lost or invented:
 * the person totals always add up to the bill total minus any unassigned items.
 */
export function computeSplit(input: SplitInput): SplitResult {
  const peopleIds = [...input.people];
  const peopleSet = new Set(peopleIds);
  const index = new Map(peopleIds.map((id, i) => [id, i]));

  const breakdowns: PersonBreakdown[] = peopleIds.map((personId) => ({
    personId,
    items: [],
    itemsMinor: 0,
    discountMinor: 0,
    serviceMinor: 0,
    tipMinor: 0,
    taxMinor: 0,
    rouletteMinor: 0,
    roundingMinor: 0,
    totalMinor: 0,
  }));
  const dessertParts = peopleIds.map(() => 0);

  let itemsTotal = 0;
  let unassigned = 0;
  const unassignedItemIds: string[] = [];

  input.items.forEach((item, itemIndex) => {
    assertMinor(item.lineTotalMinor, `item ${item.id}`);
    itemsTotal += item.lineTotalMinor;
    // Leftover pennies go to the first sharers in line; rotating the line per item spreads
    // them fairly instead of always charging the same person (still fully deterministic).
    const valid = validShares(input.assignments[item.id], peopleSet);
    const offset = valid.length > 0 ? itemIndex % valid.length : 0;
    const shares = [...valid.slice(offset), ...valid.slice(0, offset)];
    if (shares.length === 0) {
      unassigned += item.lineTotalMinor;
      unassignedItemIds.push(item.id);
      return;
    }
    const totalWeight = sum(shares.map((s) => s.weight));
    const parts = allocate(
      item.lineTotalMinor,
      shares.map((s) => s.weight),
    );
    shares.forEach((share, i) => {
      const personIndex = index.get(share.personId)!;
      const part = parts[i] ?? 0;
      const breakdown = breakdowns[personIndex]!;
      breakdown.items.push({
        itemId: item.id,
        amountMinor: part,
        weight: share.weight,
        totalWeight,
      });
      breakdown.itemsMinor += part;
      if (item.category === 'dessert') dessertParts[personIndex]! += part;
    });
  });

  const subtotals = breakdowns.map((b) => b.itemsMinor);
  const hasPeople = peopleIds.length > 0;

  const discount = hasPeople
    ? Math.min(Math.max(0, itemsTotal), adjustmentAmount(input.discount, Math.max(0, itemsTotal)))
    : 0;
  const discountedBase = Math.max(0, itemsTotal - discount);
  const service = hasPeople ? adjustmentAmount(input.serviceCharge, discountedBase) : 0;
  const tip = hasPeople ? adjustmentAmount(input.tip, discountedBase) : 0;
  const tax = hasPeople ? sum(input.taxesOnTopMinor.map((t) => Math.max(0, t))) : 0;

  const discountParts = proportional(discount, subtotals);
  const serviceParts = proportional(service, subtotals);
  const tipParts =
    input.tipSplit === 'equal'
      ? allocateEqually(tip, peopleIds.length)
      : proportional(tip, subtotals);
  const taxParts = proportional(tax, subtotals);

  breakdowns.forEach((b, i) => {
    b.discountMinor = discountParts[i] ?? 0;
    b.serviceMinor = serviceParts[i] ?? 0;
    b.tipMinor = tipParts[i] ?? 0;
    b.taxMinor = taxParts[i] ?? 0;
    b.totalMinor = b.itemsMinor - b.discountMinor + b.serviceMinor + b.tipMinor + b.taxMinor;
  });

  applyRoulette(input, breakdowns, index, dessertParts);

  const billTotal = itemsTotal - discount + service + tip + tax;
  const rounding = applyRounding(input, breakdowns, index);

  return {
    people: breakdowns,
    itemsTotalMinor: itemsTotal,
    discountMinor: discount,
    serviceMinor: service,
    tipMinor: tip,
    taxMinor: tax,
    billTotalMinor: billTotal,
    unassignedMinor: unassigned,
    unassignedItemIds,
    rounding,
  };
}

/** Moves the chosen portion of everyone else's total onto the Bill Roulette loser. */
function applyRoulette(
  input: SplitInput,
  breakdowns: PersonBreakdown[],
  index: ReadonlyMap<string, number>,
  dessertParts: readonly number[],
): void {
  const roulette = input.roulette;
  if (!roulette) return;
  const loserIndex = index.get(roulette.loserId);
  if (loserIndex === undefined) return;
  const loser = breakdowns[loserIndex]!;

  breakdowns.forEach((b, i) => {
    if (i === loserIndex) return;
    let portion: number;
    switch (roulette.stake) {
      case 'all':
        portion = b.totalMinor;
        break;
      case 'tipService':
        portion = b.serviceMinor + b.tipMinor;
        break;
      case 'desserts':
        portion = dessertParts[i] ?? 0;
        break;
    }
    portion = Math.max(0, Math.min(portion, b.totalMinor));
    b.rouletteMinor -= portion;
    b.totalMinor -= portion;
    loser.rouletteMinor += portion;
    loser.totalMinor += portion;
  });
}

/**
 * Rounds everyone to a neat amount. The rounding difference goes to one person (by default
 * whoever owes the most) so the grand total still matches the bill exactly.
 */
function applyRounding(
  input: SplitInput,
  breakdowns: PersonBreakdown[],
  index: ReadonlyMap<string, number>,
): RoundingSummary {
  const step = input.rounding.step;
  const none: RoundingSummary = { step, applied: false, coverPersonId: null, differenceMinor: 0 };
  if (step === 0 || breakdowns.length === 0) return none;

  let coverIndex = input.rounding.coverPersonId
    ? (index.get(input.rounding.coverPersonId) ?? -1)
    : -1;
  if (coverIndex < 0) {
    coverIndex = 0;
    breakdowns.forEach((b, i) => {
      if (b.totalMinor > breakdowns[coverIndex]!.totalMinor) coverIndex = i;
    });
  }

  const before = breakdowns.map((b) => b.totalMinor);
  const rounded = before.map((t) => roundToStep(Math.max(0, t), step));
  const difference = sum(before) - sum(rounded);
  rounded[coverIndex] = rounded[coverIndex]! + difference;
  if (rounded[coverIndex]! < 0) return none;

  breakdowns.forEach((b, i) => {
    const adjusted = rounded[i]!;
    b.roundingMinor = adjusted - before[i]!;
    b.totalMinor = adjusted;
  });
  return {
    step,
    applied: true,
    coverPersonId: breakdowns[coverIndex]!.personId,
    differenceMinor: difference,
  };
}
