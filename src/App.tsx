import { lazy, Suspense, useEffect, useRef, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { ToastHost } from './components/ToastHost';
import { TopBar } from './components/TopBar';
import { HomeScreen } from './features/home/HomeScreen';
import { PrivacyDialog } from './features/privacy/PrivacyDialog';
import { useApplyTheme, useOnline } from './lib/hooks';
import { useBill } from './state/bill';
import type { Step } from './state/types';
import { useUi } from './state/ui';

const HistoryDialog = lazy(() => import('./features/history/HistoryDialog'));

/** The home screen ships in the main bundle; the flow screens load (and prefetch) separately. */
const loaders = {
  scanning: () =>
    import('./features/scan/ScanningScreen').then((m) => ({ default: m.ScanningScreen })),
  review: () => import('./features/review/ReviewScreen').then((m) => ({ default: m.ReviewScreen })),
  people: () => import('./features/people/PeopleScreen').then((m) => ({ default: m.PeopleScreen })),
  assign: () => import('./features/assign/AssignScreen').then((m) => ({ default: m.AssignScreen })),
  extras: () => import('./features/extras/ExtrasScreen').then((m) => ({ default: m.ExtrasScreen })),
  results: () =>
    import('./features/results/ResultsScreen').then((m) => ({ default: m.ResultsScreen })),
};

const SCREENS: Record<Step, ComponentType> = {
  home: HomeScreen,
  scanning: lazy(loaders.scanning),
  review: lazy(loaders.review),
  people: lazy(loaders.people),
  assign: lazy(loaders.assign),
  extras: lazy(loaders.extras),
  results: lazy(loaders.results),
};

function usePrefetchScreens() {
  useEffect(() => {
    const prefetch = () => Object.values(loaders).forEach((load) => void load());
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(prefetch, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(prefetch, 1500);
    return () => clearTimeout(timer);
  }, []);
}

/** Keeps the phone's back button in step with the flow, without a router. */
function useBackButton() {
  const step = useBill((s) => s.step);
  const fromPop = useRef(false);

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const target = (e.state as { step?: Step } | null)?.step ?? 'home';
      fromPop.current = true;
      useBill.getState().go(target === 'scanning' ? 'home' : target);
    };
    window.addEventListener('popstate', onPop);
    window.history.replaceState({ step: useBill.getState().step }, '');
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (fromPop.current) {
      fromPop.current = false;
      return;
    }
    if ((window.history.state as { step?: Step } | null)?.step !== step) {
      window.history.pushState({ step }, '');
    }
    window.scrollTo({ top: 0 });
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [step]);
}

export default function App() {
  const { t } = useTranslation();
  const step = useBill((s) => s.step);
  const historyOpen = useUi((s) => s.historyOpen);
  const online = useOnline();
  useApplyTheme();
  useBackButton();
  usePrefetchScreens();
  const Screen = SCREENS[step];

  return (
    <div className="night-sky flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-xl bg-primary px-4 py-2 text-primary-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('app.skipToContent')}
      </a>
      <TopBar />
      {!online && (
        <p role="status" className="bg-warning-bg px-4 py-2 text-center text-sm text-warning-fg">
          {t('common.offline')}
        </p>
      )}
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
          <Screen />
        </Suspense>
      </main>
      <ToastHost />
      <PrivacyDialog />
      {historyOpen && (
        <Suspense fallback={null}>
          <HistoryDialog />
        </Suspense>
      )}
    </div>
  );
}
