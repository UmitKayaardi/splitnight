/**
 * Scores an /api/assign proposal: applies it with the app's own applyProposal() and
 * compares, per original receipt line, how many units each person ends up with.
 */
import type { ProposedAssignment } from '../../shared/schemas';
import { applyProposal } from '../../src/lib/assign/applyProposal';
import type { Assignments } from '../../src/lib/money';

export interface CaseItem {
  id: string;
  name: string;
  quantity: number;
}

/** itemId → personId → units (or weights, for `current`). */
export type UnitMap = Record<string, Record<string, number>>;

const TOLERANCE = 0.02;

export function toAssignments(current: UnitMap | undefined): Assignments {
  const out: Assignments = {};
  for (const [itemId, shares] of Object.entries(current ?? {})) {
    out[itemId] = Object.entries(shares).map(([personId, weight]) => ({ personId, weight }));
  }
  return out;
}

/** Applies the proposal and returns units per person for each original line. */
export function outcomeUnits(
  items: readonly CaseItem[],
  current: UnitMap | undefined,
  proposal: readonly ProposedAssignment[],
): UnitMap {
  let n = 0;
  const lines = items.map((i) => ({ ...i, unitPriceMinor: 100, lineTotalMinor: 100 * i.quantity }));
  const applied = applyProposal(
    lines,
    toAssignments(current),
    proposal,
    (from) => `${from}#${++n}`,
  );
  const units: UnitMap = {};
  for (const line of applied.items) {
    const origin = line.id.split('#')[0]!;
    const shares = (applied.assignments[line.id] ?? []).filter((s) => s.weight > 0);
    const total = shares.reduce((a, s) => a + s.weight, 0);
    for (const s of shares) {
      units[origin] ??= {};
      units[origin][s.personId] =
        (units[origin][s.personId] ?? 0) + (line.quantity * s.weight) / total;
    }
  }
  return units;
}

export function itemMatches(
  expected: Record<string, number> | undefined,
  actual: Record<string, number> | undefined,
): boolean {
  const people = new Set([...Object.keys(expected ?? {}), ...Object.keys(actual ?? {})]);
  for (const p of people) {
    if (Math.abs((expected?.[p] ?? 0) - (actual?.[p] ?? 0)) > TOLERANCE) return false;
  }
  return true;
}

export function scoreCase(items: readonly CaseItem[], expected: UnitMap, actual: UnitMap) {
  const correct = items.filter((i) => itemMatches(expected[i.id], actual[i.id])).length;
  return { itemsCorrect: correct, itemsTotal: items.length, exact: correct === items.length };
}
