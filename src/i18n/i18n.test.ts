import en from './locales/en';
import tr from './locales/tr';
import de from './locales/de';
import fr from './locales/fr';
import es from './locales/es';

const resources = {
  en: { translation: en },
  tr: { translation: tr },
  de: { translation: de },
  fr: { translation: fr },
  es: { translation: es },
};

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') acc[path] = value;
    else Object.assign(acc, flatten(value, path));
    return acc;
  }, {});
}

const placeholders = (text: string) =>
  [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort();

const english = flatten(resources.en.translation as unknown as Tree);
const others = (Object.keys(resources) as Array<keyof typeof resources>).filter((l) => l !== 'en');

describe.each(others)('%s translation', (language) => {
  const strings = flatten(resources[language].translation as unknown as Tree);

  it('has every English key', () => {
    const missing = Object.keys(english).filter((key) => !(key in strings));
    expect(missing).toEqual([]);
  });

  it('has no keys that English does not have', () => {
    const extra = Object.keys(strings).filter((key) => !(key in english));
    expect(extra).toEqual([]);
  });

  it('has no empty strings', () => {
    expect(Object.entries(strings).filter(([, v]) => v.trim() === '')).toEqual([]);
  });

  it('uses the same placeholders as English', () => {
    const mismatched = Object.keys(english).filter(
      (key) =>
        strings[key] !== undefined &&
        placeholders(strings[key]).join() !== placeholders(english[key]!).join(),
    );
    expect(mismatched).toEqual([]);
  });
});

describe('English source', () => {
  it('uses UK spelling for common words', () => {
    const text = Object.values(english).join(' ');
    expect(text).not.toMatch(/\b(color|favorite|center|organize|analyze|canceled)\b/i);
  });
});
