import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemePref = 'system' | 'light' | 'dark';
export type MicMode = 'hold' | 'tap';
export const LANGUAGES = ['en', 'tr', 'de', 'fr', 'es'] as const;
export type Language = (typeof LANGUAGES)[number];

interface PrefsState {
  language: Language;
  theme: ThemePref;
  sound: boolean;
  micMode: MicMode;
  setLanguage: (language: Language) => void;
  setTheme: (theme: ThemePref) => void;
  setSound: (sound: boolean) => void;
  setMicMode: (mode: MicMode) => void;
  resetPrefs: () => void;
}

const DEFAULTS = {
  language: 'en' as Language,
  theme: 'system' as ThemePref,
  sound: true,
  micMode: 'hold' as MicMode,
};

/** localStorage can throw (private mode, blocked storage); fall back to memory. */
const safeStorage = createJSONStorage(() => {
  try {
    const probe = '__splitnight__';
    localStorage.setItem(probe, probe);
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    const memory = new Map<string, string>();
    return {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => void memory.set(k, v),
      removeItem: (k: string) => void memory.delete(k),
    };
  }
});

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
      setSound: (sound) => set({ sound }),
      setMicMode: (micMode) => set({ micMode }),
      resetPrefs: () => set(DEFAULTS),
    }),
    { name: 'splitnight-prefs', version: 1, storage: safeStorage },
  ),
);

export { safeStorage };
