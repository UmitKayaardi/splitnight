/**
 * "Titles of the night", worked out from categories and amounts with plain code (never AI).
 * Only clear, untied winners get a title, and nobody collects more than two.
 */
import type { Category } from '../../shared/schemas';
import type { Assignments, SplitResult } from './money';

export const AWARD_IDS = [
  'big_spender',
  'dish_royalty',
  'dessert_goblin',
  'drink_champion',
  'sharing_is_caring',
  'starter_pack',
  'main_character',
  'side_quest',
  'lone_wolf',
  'variety_pack',
  'light_eater',
  'fair_share',
] as const;
export type AwardId = (typeof AWARD_IDS)[number];

export interface Award {
  id: AwardId;
  personId: string;
  /** For dish_royalty: the dish's display name. */
  dish?: string;
}

export interface AwardItem {
  id: string;
  name: string;
  quantity: number;
  lineTotalMinor: number;
  category: Category;
}

interface Stats {
  spend: number;
  dessertSpend: number;
  drinkUnits: number;
  starterUnits: number;
  sideUnits: number;
  shared: number;
  solo: number;
  distinct: number;
  priciestMain: number;
  dishes: Map<string, { name: string; units: number }>;
}

/** "Lager (pint)" → "Lager", "2x Adana Kebab" → "Adana Kebab". */
export function dishName(name: string): string {
  return name
    .replace(/\(.*?\)/g, '')
    .replace(/^\s*\d+\s*[x×]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The single person with the strictly highest positive score, or null on a tie. */
function uniqueTop(scores: Array<[string, number]>, lowest = false): string | null {
  const valid = scores.filter(([, v]) => v > 0);
  if (valid.length === 0) return null;
  const sorted = [...valid].sort((a, b) => (lowest ? a[1] - b[1] : b[1] - a[1]));
  if (sorted.length > 1 && Math.abs(sorted[0]![1] - sorted[1]![1]) < 1e-9) return null;
  return sorted[0]![0];
}

export function computeAwards(
  people: readonly string[],
  items: readonly AwardItem[],
  assignments: Assignments,
  split: SplitResult,
): Award[] {
  if (people.length < 2) return [];
  const stats = new Map<string, Stats>(
    people.map((id) => [
      id,
      {
        spend: split.people.find((p) => p.personId === id)?.itemsMinor ?? 0,
        dessertSpend: 0,
        drinkUnits: 0,
        starterUnits: 0,
        sideUnits: 0,
        shared: 0,
        solo: 0,
        distinct: 0,
        priciestMain: 0,
        dishes: new Map(),
      },
    ]),
  );

  for (const item of items) {
    const shares = (assignments[item.id] ?? []).filter(
      (s) => s.weight > 0 && stats.has(s.personId),
    );
    const total = shares.reduce((a, s) => a + s.weight, 0);
    if (total === 0) continue;
    for (const share of shares) {
      const s = stats.get(share.personId)!;
      const fraction = share.weight / total;
      const units = item.quantity * fraction;
      const amount = item.lineTotalMinor * fraction;
      if (item.category === 'dessert') s.dessertSpend += amount;
      if (item.category === 'drink') s.drinkUnits += units;
      if (item.category === 'starter') s.starterUnits += units;
      if (item.category === 'side') s.sideUnits += units;
      if (shares.length > 1) s.shared += 1;
      else s.solo += 1;
      if (item.category === 'main' && fraction >= 0.5) {
        s.priciestMain = Math.max(s.priciestMain, item.lineTotalMinor / item.quantity);
      }
      const key = dishName(item.name).toLocaleLowerCase();
      if (key) {
        const dish = s.dishes.get(key) ?? { name: dishName(item.name), units: 0 };
        dish.units += units;
        s.dishes.set(key, dish);
      }
    }
  }
  for (const s of stats.values()) s.distinct = s.dishes.size;

  const by = (pick: (s: Stats) => number) =>
    people.map((id): [string, number] => [id, pick(stats.get(id)!)]);
  const candidates: Award[] = [];
  const add = (id: AwardId, personId: string | null, dish?: string) => {
    if (personId) candidates.push({ id, personId, ...(dish ? { dish } : {}) });
  };

  add('big_spender', uniqueTop(by((s) => s.spend)));

  // Dish royalty: the most units of a single dish (at least two), clear winner only.
  let best: { personId: string; name: string; units: number } | null = null;
  let tied = false;
  for (const id of people) {
    for (const dish of stats.get(id)!.dishes.values()) {
      if (dish.units < 2) continue;
      if (!best || dish.units > best.units + 1e-9) {
        best = { personId: id, name: dish.name, units: dish.units };
        tied = false;
      } else if (Math.abs(dish.units - best.units) < 1e-9) {
        tied = true;
      }
    }
  }
  if (best && !tied) add('dish_royalty', best.personId, best.name);

  add('dessert_goblin', uniqueTop(by((s) => s.dessertSpend)));
  add('drink_champion', uniqueTop(by((s) => s.drinkUnits)));
  add('sharing_is_caring', uniqueTop(by((s) => s.shared)));
  add('starter_pack', uniqueTop(by((s) => s.starterUnits)));
  add('main_character', uniqueTop(by((s) => s.priciestMain)));
  add('side_quest', uniqueTop(by((s) => s.sideUnits)));

  const anyShared = people.some((id) => stats.get(id)!.shared > 0);
  const loners = people.filter((id) => stats.get(id)!.shared === 0 && stats.get(id)!.solo > 0);
  if (anyShared && loners.length === 1) add('lone_wolf', loners[0]!);

  add('variety_pack', uniqueTop(by((s) => s.distinct)));
  if (people.length >= 3) {
    add(
      'light_eater',
      uniqueTop(
        by((s) => s.spend),
        true,
      ),
    );
    const average = people.reduce((a, id) => a + stats.get(id)!.spend, 0) / people.length;
    add(
      'fair_share',
      uniqueTop(by((s) => (s.spend > 0 ? 1 / (1 + Math.abs(s.spend - average)) : 0))),
    );
  }

  const pick = (cap: number) => {
    const chosen: Award[] = [];
    const count = new Map<string, number>();
    for (const award of candidates) {
      if (chosen.length >= 5) break;
      if ((count.get(award.personId) ?? 0) >= cap) continue;
      if (chosen.some((c) => c.id === award.id)) continue;
      chosen.push(award);
      count.set(award.personId, (count.get(award.personId) ?? 0) + 1);
    }
    return chosen;
  };
  const chosen = pick(2);
  return chosen.length >= 3 ? chosen : pick(3);
}
