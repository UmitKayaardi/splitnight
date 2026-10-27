import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { usePrefs, type Language } from '../state/prefs';
import en from './locales/en';
import tr from './locales/tr';
import de from './locales/de';
import fr from './locales/fr';
import es from './locales/es';

export const resources = {
  en: { translation: en },
  tr: { translation: tr },
  de: { translation: de },
  fr: { translation: fr },
  es: { translation: es },
} as const;

const HTML_LANG: Record<Language, string> = {
  en: 'en-GB',
  tr: 'tr',
  de: 'de',
  fr: 'fr',
  es: 'es',
};

/** English on first visit — the app never auto-switches to the browser language. */
void i18n.use(initReactI18next).init({
  resources,
  lng: usePrefs.getState().language,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

function syncDocument(language: Language) {
  if (typeof document !== 'undefined') document.documentElement.lang = HTML_LANG[language];
}
syncDocument(usePrefs.getState().language);

usePrefs.subscribe((state, prev) => {
  if (state.language !== prev.language) {
    void i18n.changeLanguage(state.language);
    syncDocument(state.language);
  }
});

export default i18n;
