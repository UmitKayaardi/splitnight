/**
 * Scores a parsed receipt against hand-labelled ground truth.
 * Lines with the same name are merged on both sides first, so "2 × Coke" and two
 * separate "Coke" lines count as the same thing.
 */

export interface ScoreItem {
  name: string;
  quantity: number;
  /** Decimal amount as printed, e.g. 12.5. */
  lineTotal: number;
}

export interface ReceiptScore {
  truthItems: number;
  predictedItems: number;
  truePositives: number;
  precision: number;
  recall: number;
  f1: number;
  itemCountMatch: boolean;
  totalMatch: boolean | null;
  /** Mean absolute line-price error over items whose names matched. */
  meanAbsPriceError: number | null;
}

export function normaliseName(name: string): string {
  return name
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bigrams(text: string): Map<string, number> {
  const s = text.replace(/ /g, '');
  const grams = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    grams.set(g, (grams.get(g) ?? 0) + 1);
  }
  return grams;
}

/** Sørensen–Dice similarity of character bigrams, 0–1. */
export function nameSimilarity(a: string, b: string): number {
  const x = normaliseName(a);
  const y = normaliseName(b);
  if (x === y) return 1;
  if (!x || !y) return 0;
  if (x.length > 3 && y.length > 3 && (x.includes(y) || y.includes(x))) return 0.9;
  const ga = bigrams(x);
  const gb = bigrams(y);
  let overlap = 0;
  for (const [g, n] of ga) overlap += Math.min(n, gb.get(g) ?? 0);
  const total = [...ga.values(), ...gb.values()].reduce((s, n) => s + n, 0);
  return total === 0 ? 0 : (2 * overlap) / total;
}

export function mergeByName(items: readonly ScoreItem[]): ScoreItem[] {
  const merged = new Map<string, ScoreItem>();
  for (const item of items) {
    const key = normaliseName(item.name);
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += item.quantity;
      existing.lineTotal = Math.round((existing.lineTotal + item.lineTotal) * 100) / 100;
    } else {
      merged.set(key, { ...item });
    }
  }
  return [...merged.values()];
}

const MATCH_THRESHOLD = 0.55;

export function scoreReceipt(
  truth: { items: ScoreItem[]; total: number | null },
  predicted: { items: ScoreItem[]; total: number | null | undefined },
): ReceiptScore {
  const t = mergeByName(truth.items);
  const p = mergeByName(predicted.items);

  // Greedy matching on name similarity, best pairs first.
  const pairs: Array<{ ti: number; pi: number; sim: number }> = [];
  t.forEach((ti, i) =>
    p.forEach((pi, j) => {
      const sim = nameSimilarity(ti.name, pi.name);
      if (sim >= MATCH_THRESHOLD) pairs.push({ ti: i, pi: j, sim });
    }),
  );
  pairs.sort((a, b) => b.sim - a.sim);
  const usedT = new Set<number>();
  const usedP = new Set<number>();
  const matches: Array<[ScoreItem, ScoreItem]> = [];
  for (const pair of pairs) {
    if (usedT.has(pair.ti) || usedP.has(pair.pi)) continue;
    usedT.add(pair.ti);
    usedP.add(pair.pi);
    matches.push([t[pair.ti]!, p[pair.pi]!]);
  }

  const truePositives = matches.filter(
    ([a, b]) => Math.abs(a.lineTotal - b.lineTotal) < 0.005,
  ).length;
  const precision = p.length === 0 ? 0 : truePositives / p.length;
  const recall = t.length === 0 ? 0 : truePositives / t.length;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  const errors = matches.map(([a, b]) => Math.abs(a.lineTotal - b.lineTotal));

  return {
    truthItems: t.length,
    predictedItems: p.length,
    truePositives,
    precision,
    recall,
    f1,
    itemCountMatch: t.length === p.length,
    totalMatch:
      truth.total === null
        ? null
        : predicted.total !== null &&
          predicted.total !== undefined &&
          Math.abs(truth.total - predicted.total) < 0.005,
    meanAbsPriceError: errors.length ? errors.reduce((a, b) => a + b, 0) / errors.length : null,
  };
}
