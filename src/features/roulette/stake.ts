import type { TFunction } from 'i18next';
import type { RouletteStake } from '../../lib/money';

const KEYS = {
  all: 'roulette.stakeShortAll',
  tipService: 'roulette.stakeShortTipService',
  desserts: 'roulette.stakeShortDesserts',
} as const;

/** "the whole bill" / "the tip and service" / "the desserts". */
export function stakeShort(t: TFunction, stake: RouletteStake): string {
  return t(KEYS[stake]);
}
