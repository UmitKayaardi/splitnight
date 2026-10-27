/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PERSON_COLORS } from '../lib/people';
import { contrastRatio } from './contrast';

const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`\n${selector} {`);
  const block = start >= 0 ? css.slice(start, css.indexOf('}', start)) : '';
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!]),
  );
}

/** [foreground, background] pairs that appear together in the UI. */
const PAIRS: Array<[string, string]> = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'surface-2'],
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['muted', 'surface-2'],
  ['primary-fg', 'primary'],
  ['primary-fg', 'primary-hover'],
  ['primary', 'surface'],
  ['primary', 'bg'],
  ['accent', 'surface'],
  ['accent', 'accent-soft'],
  ['success', 'surface'],
  ['success', 'success-soft'],
  ['warning-fg', 'warning-bg'],
  ['danger', 'surface'],
  ['danger', 'danger-soft'],
];

describe.each([
  ['light', ':root'],
  ['dark', '.dark'],
])('%s theme', (_name, selector) => {
  const t = tokens(selector);

  it.each(PAIRS)('%s on %s passes WCAG AA (4.5:1)', (fg, bg) => {
    expect(t[fg], `missing --${fg}`).toBeDefined();
    expect(t[bg], `missing --${bg}`).toBeDefined();
    expect(contrastRatio(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(4.5);
  });

  it('focus ring is visible against the background (3:1)', () => {
    expect(contrastRatio(t.ring!, t.bg!)).toBeGreaterThanOrEqual(3);
  });

  it.each(PERSON_COLORS)('name tag %s is readable', (color) => {
    expect(contrastRatio(t['person-fg']!, color)).toBeGreaterThanOrEqual(4.5);
  });
});
