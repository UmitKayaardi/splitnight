/**
 * Bill Roulette rules, kept free of UI so they can be tested. All draws go through the
 * unbiased helpers in ./random.
 */
import { randomInt, rollDie, type RandomSource } from './random';

export type GameMode = 'wheel' | 'cards' | 'coin' | 'dice';

export function availableModes(players: number): GameMode[] {
  return players === 2 ? ['wheel', 'cards', 'coin', 'dice'] : ['wheel', 'cards', 'dice'];
}

/** Wheel and coin: one uniform draw decides the round. */
export function drawLoser(playerIds: readonly string[], source?: RandomSource): string {
  return playerIds[randomInt(playerIds.length, source)]!;
}

/** Hidden cards: the position of the "you're it" card among n face-down cards. */
export function placeLosingCard(cards: number, source?: RandomSource): number {
  return randomInt(cards, source);
}

/** Dice: everyone in `playerIds` rolls once. */
export function rollAll(
  playerIds: readonly string[],
  source?: RandomSource,
): Record<string, number> {
  return Object.fromEntries(playerIds.map((id) => [id, rollDie(source)]));
}

/** Everyone tied for the lowest roll. One id means the round is decided. */
export function lowestRollers(rolls: Record<string, number>): string[] {
  const values = Object.values(rolls);
  if (values.length === 0) return [];
  const lowest = Math.min(...values);
  return Object.keys(rolls).filter((id) => rolls[id] === lowest);
}

/** Best of 3: the first person to lose two rounds covers it. */
export function bestOfThreeLoser(losses: Record<string, number>): string | null {
  return Object.keys(losses).find((id) => (losses[id] ?? 0) >= 2) ?? null;
}

/**
 * Wheel geometry: the rotation (degrees, clockwise) that brings the middle of slice `index`
 * under a pointer at the top, after a few full spins.
 */
export function wheelRotation(index: number, slices: number, fullSpins = 5, jitter = 0): number {
  const slice = 360 / slices;
  const centre = index * slice + slice / 2;
  // Keep the pointer inside the slice even with jitter.
  const offset = Math.max(-0.35, Math.min(0.35, jitter)) * slice;
  return fullSpins * 360 + (360 - centre) - offset;
}
