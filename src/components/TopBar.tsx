import { Globe, Monitor, Moon, Redo2, Sun, Undo2, Volume2, VolumeX } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBill } from '../state/bill';
import { LANGUAGES, usePrefs, type ThemePref } from '../state/prefs';
import { Dialog } from './Dialog';
import { Logo, Wordmark } from './Logo';
import { IconButton } from './ui';

const NEXT_THEME: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' };

export function TopBar() {
  const { t } = useTranslation();
  const step = useBill((s) => s.step);
  const canUndo = useBill((s) => s.past.length > 0);
  const canRedo = useBill((s) => s.future.length > 0);
  const { undo, redo, go } = useBill.getState();
  const { theme, sound, language, setTheme, setSound, setLanguage } = usePrefs();
  const [languageOpen, setLanguageOpen] = useState(false);

  const inFlow = step !== 'home' && step !== 'scanning';
  const themeLabel = {
    system: t('topbar.themeSystem'),
    light: t('topbar.themeLight'),
    dark: t('topbar.themeDark'),
  }[theme];
  const ThemeIcon = theme === 'system' ? Monitor : theme === 'light' ? Sun : Moon;

  return (
    <header className="sticky top-0 z-30 bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-3xl items-center gap-1 px-2 sm:px-4">
        <button
          type="button"
          onClick={() => go('home')}
          className="flex min-h-11 items-center gap-2 rounded-2xl px-2"
          aria-label={t('topbar.home')}
        >
          <Logo size={36} />
          <Wordmark className={`text-xl ${inFlow ? 'hidden min-[420px]:inline' : ''}`} />
        </button>
        <div className="flex-1" />
        {inFlow && (
          <>
            <IconButton label={t('common.undo')} onClick={undo} disabled={!canUndo}>
              <Undo2 aria-hidden className="size-5" />
            </IconButton>
            <IconButton label={t('common.redo')} onClick={redo} disabled={!canRedo}>
              <Redo2 aria-hidden className="size-5" />
            </IconButton>
            <span aria-hidden className="mx-0.5 h-6 w-px bg-border" />
          </>
        )}
        <IconButton
          label={`${t('topbar.language')}: ${t(`languages.${language}`)}`}
          onClick={() => setLanguageOpen(true)}
        >
          <Globe aria-hidden className="size-5" />
        </IconButton>
        <IconButton
          label={`${t('topbar.theme')}: ${themeLabel}`}
          onClick={() => setTheme(NEXT_THEME[theme])}
        >
          <ThemeIcon aria-hidden className="size-5" />
        </IconButton>
        <IconButton
          label={sound ? t('topbar.soundOn') : t('topbar.soundOff')}
          aria-pressed={sound}
          onClick={() => setSound(!sound)}
        >
          {sound ? (
            <Volume2 aria-hidden className="size-5" />
          ) : (
            <VolumeX aria-hidden className="size-5" />
          )}
        </IconButton>
      </div>

      <Dialog
        open={languageOpen}
        onClose={() => setLanguageOpen(false)}
        title={t('topbar.language')}
        variant="center"
      >
        <ul className="flex flex-col gap-1" role="radiogroup" aria-label={t('topbar.language')}>
          {LANGUAGES.map((code) => (
            <li key={code}>
              <button
                type="button"
                role="radio"
                aria-checked={code === language}
                lang={code}
                onClick={() => {
                  setLanguage(code);
                  setLanguageOpen(false);
                }}
                className={`flex min-h-12 w-full items-center justify-between rounded-2xl px-4 text-left text-base ${
                  code === language
                    ? 'bg-primary text-primary-fg font-semibold'
                    : 'hover:bg-surface-2'
                }`}
              >
                {t(`languages.${code}`)}
                <span aria-hidden className="text-sm opacity-80">
                  {code.toUpperCase()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Dialog>
    </header>
  );
}
