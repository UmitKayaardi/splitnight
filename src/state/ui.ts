import { create } from 'zustand';

interface UiState {
  privacyOpen: boolean;
  historyOpen: boolean;
  setPrivacyOpen: (open: boolean) => void;
  setHistoryOpen: (open: boolean) => void;
}

export const useUi = create<UiState>()((set) => ({
  privacyOpen: false,
  historyOpen: false,
  setPrivacyOpen: (privacyOpen) => set({ privacyOpen }),
  setHistoryOpen: (historyOpen) => set({ historyOpen }),
}));
