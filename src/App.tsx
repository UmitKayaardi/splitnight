import { lazy, Suspense, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ToastHost } from './components/ToastHost';
import { TopBar } from './components/TopBar';
import { AssignScreen } from './features/assign/AssignScreen';
import { ExtrasScreen } from './features/extras/ExtrasScreen';
import { HomeScreen } from './features/home/HomeScreen';
import { PeopleScreen } from './features/people/PeopleScreen';
import { PrivacyDialog } from './features/privacy/PrivacyDialog';
import { ResultsScreen } from './features/results/ResultsScreen';
import { ReviewScreen } from './features/review/ReviewScreen';
import { ScanningScreen } from './features/scan/ScanningScreen';
import { useApplyTheme, useOnline } from './lib/hooks';
import { useBill } from './state/bill';
import type { Step } from './state/types';
import { useUi } from './state/ui';

const HistoryDialog = lazy(() => import('./features/history/HistoryDialog'));

const SCREENS: Record<Step, () => React.JSX.Element> = {
  home: HomeScreen,
  scanning: ScanningScreen,
  review: ReviewScreen,
  people: PeopleScreen,
  assign: AssignScreen,
  extras: ExtrasScreen,
  results: ResultsScreen,
};

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
        <Screen />
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
