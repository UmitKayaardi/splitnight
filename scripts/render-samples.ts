/**
 * Renders the built-in fictional sample receipts (src/samples/samples.ts) as SVG images
 * into public/samples/. Run with `npm run samples:render` after changing a sample.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SAMPLES, type SampleReceipt } from '../src/samples/samples';

const WIDTH = 340;
const PAD = 22;
const LINE = 20;
const FONT = "'Courier New', Courier, 'Liberation Mono', monospace";

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = (minor: number) => (minor / 100).toFixed(2);

export function renderReceipt(sample: SampleReceipt): string {
  const r = sample.receipt;
  const rows: string[] = [];
  let y = 46;

  const text = (
    x: number,
    value: string,
    opts: { anchor?: string; size?: number; weight?: number } = {},
  ) =>
    rows.push(
      `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${opts.size ?? 13}" font-weight="${opts.weight ?? 400}" text-anchor="${opts.anchor ?? 'start'}" fill="#2b2622">${esc(value)}</text>`,
    );
  const center = (value: string, opts: { size?: number; weight?: number } = {}) =>
    text(WIDTH / 2, value, { ...opts, anchor: 'middle' });
  const pair = (left: string, right: string, weight = 400) => {
    text(PAD, left, { weight });
    text(WIDTH - PAD, right, { anchor: 'end', weight });
  };
  const rule = () => {
    rows.push(
      `<line x1="${PAD}" y1="${y - 8}" x2="${WIDTH - PAD}" y2="${y - 8}" stroke="#8a8178" stroke-width="1" stroke-dasharray="4 3"/>`,
    );
    y += 6;
  };

  center(r.merchant.toUpperCase(), { size: 18, weight: 700 });
  y += LINE + 2;
  for (const line of sample.address) {
    center(line, { size: 12 });
    y += 16;
  }
  y += 8;
  pair(sample.date, sample.time);
  y += 18;
  center(sample.table, { size: 12 });
  y += LINE;
  rule();

  for (const item of r.items) {
    const name = item.name.length > 24 ? `${item.name.slice(0, 23)}…` : item.name;
    pair(`${item.quantity} ${name}`, money(item.lineTotalMinor));
    y += item.quantity > 1 ? 15 : LINE;
    if (item.quantity > 1) {
      text(PAD + 16, `@ ${money(item.unitPriceMinor)}`, { size: 11 });
      y += LINE - 4;
    }
  }
  rule();
  pair('Subtotal', money(r.subtotalMinor ?? 0));
  y += LINE;
  for (const d of r.discounts) {
    pair(d.label.length > 28 ? `${d.label.slice(0, 27)}…` : d.label, `-${money(d.amountMinor)}`);
    y += LINE;
  }
  if (r.serviceCharge) {
    pair(r.serviceCharge.label, money(r.serviceCharge.amountMinor));
    y += LINE;
  }
  y += 4;
  pair('TOTAL', `£${money(r.totalMinor ?? 0)}`, 700);
  y += LINE + 6;
  for (const tax of r.taxLines) {
    pair(tax.label, money(tax.amountMinor));
    y += LINE;
  }
  rule();
  for (const line of sample.footer) {
    center(line, { size: 12 });
    y += 16;
  }
  y += 10;
  // Decorative barcode (not a real code).
  const bars: string[] = [];
  let x = WIDTH / 2 - 70;
  const pattern = sample.id.split('').map((c) => c.charCodeAt(0));
  for (let i = 0; i < 46; i++) {
    const w = ((pattern[i % pattern.length]! + i * 7) % 3) + 1;
    if (i % 2 === 0) bars.push(`<rect x="${x}" y="${y}" width="${w}" height="34" fill="#2b2622"/>`);
    x += w + 1;
  }
  rows.push(...bars);
  y += 52;

  const height = y + 10;
  // Paper with a torn, zig-zag bottom edge.
  const teeth = Math.ceil(WIDTH / 14);
  const edge = Array.from({ length: teeth + 1 }, (_, i) => {
    const x = Math.max(0, WIDTH - i * 14);
    return `L${x} ${height - (i % 2 === 0 ? 0 : 8)}`;
  }).join(' ');
  const paper = `M0 8 L${WIDTH} 8 L${WIDTH} ${height} ${edge} Z`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${height + 4}" width="${WIDTH}" height="${height + 4}" role="img" aria-label="Sample receipt from ${esc(r.merchant)}">
  <rect width="100%" height="100%" fill="#f4efe6"/>
  <path d="${paper}" fill="#fffdf8" stroke="#e4dacb"/>
  ${rows.join('\n  ')}
</svg>
`;
}

const outDir = resolve(import.meta.dirname, '../public/samples');
mkdirSync(outDir, { recursive: true });
for (const sample of SAMPLES) {
  writeFileSync(resolve(outDir, `${sample.id}.svg`), renderReceipt(sample));
  console.log(`wrote public/samples/${sample.id}.svg`);
}
