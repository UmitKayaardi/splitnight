import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { usePrefs, type Language } from '../state/prefs';
import en, { type Translation } from './locales/en';

/** English ships in the main bundle; the other languages load when picked. */
const loaders: Record<Exclude<Language, 'en'>, () => Promise<{ default: Translation }>> = {
  tr: () => import('./locales/tr'),
  de: () => import('./locales/de'),
  fr: () => import('./locales/fr'),
  es: () => import('./locales/es'),
};

const HTML_LANG: Record<Language, string> = {
  en: 'en-GB',
  tr: 'tr',
  de: 'de',
  fr: 'fr',
  es: 'es',
};

export async function loadLanguage(language: Language): Promise<void> {
  if (language !== 'en' && !i18n.hasResourceBundle(language, 'translation')) {
    const { default: strings } = await loaders[language]();
    i18n.addResourceBundle(language, 'translation', strings);
  }
  await i18n.changeLanguage(language);
  if (typeof document !== 'undefined') document.documentElement.lang = HTML_LANG[language];
}

/** English on first visit — the app never auto-switches to the browser language. */
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

const saved = usePrefs.getState().language;
if (saved !== 'en') void loadLanguage(saved);

usePrefs.subscribe((state, prev) => {
  if (state.language !== prev.language) void loadLanguage(state.language);
});

export default i18n;
