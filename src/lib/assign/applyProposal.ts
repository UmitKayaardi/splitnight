import type { ProposedAssignment } from '../../../shared/schemas';
import { allocate, type Assignments, type Share } from '../money';

export interface ProposalItem {
  id: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
}

export interface AppliedProposal<T extends ProposalItem> {
  items: T[];
  assignments: Assignments;
  /** Ids of the lines that now carry the proposed shares. */
  changedItemIds: string[];
}

/**
 * Splits `units` off a multi-quantity line. The split-off part gets a new id; the remainder
 * keeps the original id (and its current shares). Line totals are split by quantity with
 * the largest-remainder method, so the two parts always add up to the original line.
 */
export function splitLine<T extends ProposalItem>(item: T, units: number, newId: string): [T, T] {
  const [partTotal, restTotal] = allocate(item.lineTotalMinor, [units, item.quantity - units]);
  const part = { ...item, id: newId, quantity: units, lineTotalMinor: partTotal! };
  const rest = { ...item, quantity: item.quantity - units, lineTotalMinor: restTotal! };
  return [part, rest];
}

/**
 * Applies an /api/assign proposal on top of the current state. Each entry replaces the
 * shares of its item. An entry with `units` smaller than the line quantity splits the line
 * first, so "Ahmet had two of the three beers" leaves the third beer as it was.
 */
export function applyProposal<T extends ProposalItem>(
  items: readonly T[],
  assignments: Assignments,
  proposal: readonly ProposedAssignment[],
  newId: () => string,
): AppliedProposal<T> {
  const nextItems = [...items];
  const next: Assignments = { ...assignments };
  const changed: string[] = [];

  for (const entry of proposal) {
    const index = nextItems.findIndex((i) => i.id === entry.itemId);
    if (index < 0) continue;
    const item = nextItems[index]!;
    const shares: Share[] = entry.shares.map((s) => ({ ...s }));
    const partial =
      entry.units !== undefined &&
      Number.isInteger(item.quantity) &&
      entry.units >= 1 &&
      entry.units < item.quantity;

    if (!partial) {
      next[item.id] = shares;
      changed.push(item.id);
      continue;
    }
    const [part, rest] = splitLine(item, entry.units!, newId());
    nextItems.splice(index, 1, part, rest);
    next[part.id] = shares;
    changed.push(part.id);
  }

  return { items: nextItems, assignments: next, changedItemIds: [...new Set(changed)] };
}

/** Each person's fraction of a line, used to compare outcomes (tests and benchmark). */
export function fractions(shares: readonly Share[] | undefined): Record<string, number> {
  const valid = (shares ?? []).filter((s) => s.weight > 0);
  const total = valid.reduce((a, s) => a + s.weight, 0);
  const out: Record<string, number> = {};
  for (const s of valid) out[s.personId] = (out[s.personId] ?? 0) + s.weight / total;
  return out;
}
