/**
 * Receipt-reading benchmark. Runs every photo in test-receipts/ (gitignored, the owner's
 * real receipts) through the same code path as the app:
 *   browser-style downscale (Chromium canvas, 1600 px, JPEG 0.8) → parseReceiptImage()
 * and compares the result with test-receipts/ground-truth.json.
 *
 * Only aggregate numbers go to docs/BENCHMARK.md. Per-receipt output stays in
 * test-receipts/benchmark-output/. Usage: npm run benchmark:receipts
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createGroqClient } from '../server/ai';
import { getConfig } from '../server/config';
import { ApiError } from '../server/errors';
import { parseReceiptImage } from '../server/receipt/parse';
import { minorDigits } from '../src/lib/money/format';
import { loadEnv, pct, ROOT, sleep, writeBenchmarkSection } from './lib/bench';
import { scoreReceipt, type ReceiptScore, type ScoreItem } from './lib/receiptScore';

interface Truth {
  currency: string;
  items: ScoreItem[];
  total: number | null;
}

const DIR = resolve(ROOT, 'test-receipts');
const OUT = resolve(DIR, 'benchmark-output');
const PAUSE_MS = 20_000; // Groq's free tier allows only a few vision calls per minute.

loadEnv();
const config = getConfig();
if (!config.apiKey) {
  console.error('GROQ_API_KEY is not set in .env');
  process.exit(1);
}
const ai = createGroqClient(config);
const truth = JSON.parse(readFileSync(resolve(DIR, 'ground-truth.json'), 'utf8'))
  .receipts as Record<string, Truth>;
const files = readdirSync(DIR).filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && truth[f]);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

/** Exactly the app's client-side preparation, run in a real browser canvas. */
async function prepare(file: string): Promise<Uint8Array> {
  const base64 = readFileSync(resolve(DIR, file)).toString('base64');
  const out: string = await page.evaluate(async (data) => {
    const blob = await (await fetch(`data:image/jpeg;base64,${data}`)).blob();
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8).split(',')[1]!;
  }, base64);
  return new Uint8Array(Buffer.from(out, 'base64'));
}

interface Row {
  file: string;
  ok: boolean;
  error?: string;
  latencyMs?: number;
  score?: ReceiptScore;
}

const rows: Row[] = [];
for (const [index, file] of files.entries()) {
  if (index > 0) await sleep(PAUSE_MS);
  const image = await prepare(file);
  let attempt = 0;
  for (;;) {
    attempt++;
    const started = performance.now();
    try {
      const receipt = await parseReceiptImage(image, 'image/jpeg', { ai, config });
      const latencyMs = Math.round(performance.now() - started);
      const factor = 10 ** minorDigits(receipt.currency);
      const predicted = {
        items: receipt.items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          lineTotal: i.lineTotalMinor / factor,
        })),
        total: receipt.totalMinor === undefined ? null : receipt.totalMinor / factor,
      };
      const score = scoreReceipt(truth[file]!, predicted);
      writeFileSync(
        resolve(OUT, `${file}.json`),
        JSON.stringify({ latencyMs, receipt, score }, null, 2),
      );
      rows.push({ file, ok: true, latencyMs, score });
      console.log(`${file}: F1 ${score.f1.toFixed(2)}, total ${score.totalMatch}, ${latencyMs} ms`);
      break;
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'ERROR';
      if ((code === 'RATE_LIMITED' || code === 'TIMEOUT') && attempt < 5) {
        console.log(`${file}: ${code}, waiting before retry ${attempt}`);
        await sleep(30_000);
        continue;
      }
      rows.push({ file, ok: false, error: code });
      console.log(`${file}: failed (${code})`);
      break;
    }
  }
}
await browser.close();

const scored = rows.filter((r) => r.ok && r.score).map((r) => r.score!);
const withTotal = scored.filter((s) => s.totalMatch !== null);
const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);
const tp = sum(scored, (s) => s.truePositives);
const microP =
  tp /
  Math.max(
    1,
    sum(scored, (s) => s.predictedItems),
  );
const microR =
  tp /
  Math.max(
    1,
    sum(scored, (s) => s.truthItems),
  );
const microF1 = microP + microR === 0 ? 0 : (2 * microP * microR) / (microP + microR);
const errors = scored.map((s) => s.meanAbsPriceError).filter((e): e is number => e !== null);
const latencies = rows
  .filter((r) => r.latencyMs)
  .map((r) => r.latencyMs!)
  .sort((a, b) => a - b);
const median = latencies.length ? latencies[Math.floor(latencies.length / 2)]! : 0;

const date = new Date().toISOString().slice(0, 10);
writeBenchmarkSection(
  'receipts',
  `## Receipt reading

Run on ${date} with \`${config.models.vision}\` (repair pass: \`${config.models.text}\`).

| Metric | Result |
| --- | --- |
| Receipts tested | ${files.length} (${rows.filter((r) => r.ok).length} parsed, ${rows.filter((r) => !r.ok).length} failed) |
| Total amount exactly right | ${withTotal.filter((s) => s.totalMatch).length} / ${withTotal.length} (${pct(withTotal.filter((s) => s.totalMatch).length / Math.max(1, withTotal.length))}) |
| Item count exactly right | ${scored.filter((s) => s.itemCountMatch).length} / ${scored.length} (${pct(scored.filter((s) => s.itemCountMatch).length / Math.max(1, scored.length))}) |
| Item precision (name + exact price) | ${pct(microP)} |
| Item recall (name + exact price) | ${pct(microR)} |
| Item F1 | ${pct(microF1)} |
| Mean absolute price error (matched names) | ${errors.length ? (sum(errors, (e) => e) / errors.length).toFixed(2) : 'n/a'} (in each receipt's currency) |
| Median latency per receipt | ${(median / 1000).toFixed(1)} s |

How it is measured: each photo is downscaled in Chromium exactly as the app does it, then sent through the same server function (\`parseReceiptImage\`). Lines with the same name are merged on both sides; an item counts as correct when its name fuzzily matches (character-bigram similarity ≥ 0.55) **and** its line total is exactly right. Precision/recall are micro-averaged over all items. Receipts whose total is cut off in the photo are left out of the total-amount metric.`,
);
console.log('\nWrote docs/BENCHMARK.md (receipts section).');
