/**
 * Name-tag colours: bright enough to read dark text on in both themes
 * (checked for WCAG AA in src/theme/contrast.test.ts).
 */
export const PERSON_COLORS = [
  '#ff9ec0',
  '#ffc56b',
  '#7ee2b8',
  '#8ecbff',
  '#c8a8ff',
  '#ffab85',
  '#b9e36f',
  '#71dbe6',
  '#f5a8e4',
  '#e9d46b',
] as const;

export const PERSON_EMOJIS = [
  '🌙',
  '⭐',
  '🍕',
  '🌮',
  '🍣',
  '🍔',
  '🥗',
  '🍰',
  '🍹',
  '🎉',
  '🦊',
  '🐸',
];

function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text.toLocaleLowerCase()) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic colour from the name, moving to the next free colour if another
 * person at the table already has it.
 */
export function pickColor(name: string, taken: readonly number[]): number {
  const start = hash(name) % PERSON_COLORS.length;
  for (let i = 0; i < PERSON_COLORS.length; i++) {
    const candidate = (start + i) % PERSON_COLORS.length;
    if (!taken.includes(candidate)) return candidate;
  }
  return start;
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters =
    words.length === 1 ? [...words[0]!].slice(0, 2) : [[...words[0]!][0], [...words[1]!][0]];
  return letters.join('').toLocaleUpperCase();
}

export function normaliseName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, 24);
}

/** "Sam" → "Sam 2" if a Sam is already at the table (case-insensitive). */
export function uniqueName(name: string, existing: readonly string[]): string {
  const clean = normaliseName(name);
  const lower = new Set(existing.map((n) => n.toLocaleLowerCase()));
  if (!lower.has(clean.toLocaleLowerCase())) return clean;
  let n = 2;
  while (lower.has(`${clean} ${n}`.toLocaleLowerCase())) n++;
  return `${clean} ${n}`;
}

export function personColor(person: { color: number }): string {
  return PERSON_COLORS[person.color % PERSON_COLORS.length]!;
}
