/**
 * "Recent nights": a small, local-only log of finished bills. Nothing here ever leaves the
 * device. Stores only the date, total, how many friends, first names and titles won.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { safeStorage, usePrefs } from './prefs';

export interface NightAward {
  id: string;
  personName: string;
  dish?: string;
}

export interface Night {
  id: string;
  /** ISO date string. */
  date: string;
  totalMinor: number;
  currency: string;
  friends: number;
  names: string[];
  awards: NightAward[];
  rouletteLoser?: string;
}

const MAX_NIGHTS = 20;

interface HistoryState {
  nights: Night[];
  /** Adds a night, or replaces it if the same bill is saved again (e.g. after an edit). */
  save: (night: Night) => void;
  clear: () => void;
}

export const useHistory = create<HistoryState>()(
  persist(
    (set) => ({
      nights: [],
      save: (night) =>
        set((s) => ({
          nights: [night, ...s.nights.filter((n) => n.id !== night.id)].slice(0, MAX_NIGHTS),
        })),
      clear: () => set({ nights: [] }),
    }),
    { name: 'splitnight-history', version: 1, storage: safeStorage },
  ),
);

export interface HallOfFameEntry {
  name: string;
  count: number;
}

function tally(names: string[]): HallOfFameEntry[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const name of names) {
    const key = name.toLocaleLowerCase();
    const entry = counts.get(key) ?? { name, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function hallOfFame(nights: readonly Night[]) {
  return {
    mostPicked: tally(nights.flatMap((n) => (n.rouletteLoser ? [n.rouletteLoser] : []))).slice(
      0,
      3,
    ),
    mostBigSpender: tally(
      nights.flatMap((n) =>
        n.awards.filter((a) => a.id === 'big_spender').map((a) => a.personName),
      ),
    ).slice(0, 3),
  };
}

/** "Clear my data": forgets preferences and recent nights on this device. */
export function clearLocalData() {
  useHistory.getState().clear();
  usePrefs.getState().resetPrefs();
  try {
    localStorage.removeItem('splitnight-history');
    localStorage.removeItem('splitnight-prefs');
  } catch {
    // Storage unavailable: the in-memory state above is already cleared.
  }
}
