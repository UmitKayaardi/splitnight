import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useBill } from '../state/bill';
import { usePrefs } from '../state/prefs';
import { formatMoney, formatMoneyShort, formatSigned } from './money';

/** Formatters bound to the bill's currency and the UI language. */
export function useMoney() {
  const currency = useBill((s) => s.data.currency);
  const { i18n } = useTranslation();
  const language = i18n.language;
  return {
    currency,
    format: useCallback(
      (minor: number) => formatMoney(minor, currency, language),
      [currency, language],
    ),
    short: useCallback(
      (minor: number) => formatMoneyShort(minor, currency, language),
      [currency, language],
    ),
    signed: useCallback(
      (minor: number) => formatSigned(minor, currency, language),
      [currency, language],
    ),
  };
}

function subscribeMedia(query: string) {
  return (callback: () => void) => {
    if (typeof window === 'undefined' || !window.matchMedia) return () => {};
    const mq = window.matchMedia(query);
    mq.addEventListener('change', callback);
    return () => mq.removeEventListener('change', callback);
  };
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    subscribeMedia(query),
    () =>
      typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false,
    () => false,
  );
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/** Applies the light/dark/system preference to <html> and the browser chrome colour. */
export function useApplyTheme(): boolean {
  const pref = usePrefs((s) => s.theme);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const dark = pref === 'dark' || (pref === 'system' && systemDark);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', dark ? '#110c26' : '#fbf7f1');
      meta.removeAttribute('media');
    });
  }, [dark]);
  return dark;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
