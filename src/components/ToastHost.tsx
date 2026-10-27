import { AnimatePresence, m } from 'framer-motion';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useBill } from '../state/bill';
import { useToasts } from '../state/toasts';

const DURATION_MS = 6000;

/** Bottom toast with an optional Undo action. Announced politely to screen readers. */
export function ToastHost() {
  const { t } = useTranslation();
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  const current = toasts.at(-1);

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => dismiss(current.id), DURATION_MS);
    return () => clearTimeout(timer);
  }, [current, dismiss]);

  const Icon =
    current?.tone === 'error' ? TriangleAlert : current?.tone === 'success' ? CheckCircle2 : Info;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 sm:bottom-8"
    >
      <AnimatePresence>
        {current && (
          <m.div
            key={current.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.18 }}
            role="status"
            className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-text py-2 pr-2 pl-4 text-bg shadow-card"
          >
            <Icon aria-hidden className="size-5 shrink-0" />
            <p className="min-w-0 flex-1 text-sm">{current.message}</p>
            {current.undoable && (
              <button
                type="button"
                onClick={() => {
                  useBill.getState().undo();
                  dismiss(current.id);
                }}
                className="min-h-11 rounded-xl px-3 font-display font-semibold text-bg underline-offset-4 hover:underline focus-visible:outline-bg"
              >
                {t('common.undo')}
              </button>
            )}
            <button
              type="button"
              aria-label={t('common.close')}
              onClick={() => dismiss(current.id)}
              className="flex size-11 items-center justify-center rounded-xl focus-visible:outline-bg"
            >
              <X aria-hidden className="size-4" />
            </button>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
