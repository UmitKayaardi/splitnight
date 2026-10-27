import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  /** Shows an Undo button that reverts the last commit. */
  undoable?: boolean;
  tone?: 'info' | 'success' | 'error';
}

interface ToastState {
  toasts: Toast[];
  show: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}

let counter = 0;

export const useToasts = create<ToastState>()((set) => ({
  toasts: [],
  show: (toast) => {
    const id = ++counter;
    // Only the newest toast is shown; older ones are replaced.
    set({ toasts: [{ ...toast, id }] });
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (message: string, options: Omit<Toast, 'id' | 'message'> = {}) =>
  useToasts.getState().show({ message, ...options });
