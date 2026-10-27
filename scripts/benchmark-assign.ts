/**
 * Sentence-understanding benchmark for /api/assign. Sends every case in
 * benchmarks/assign-cases.json through the same server logic the app uses
 * (proposeAssignments), applies the result with the app's applyProposal(), and checks
 * who ends up with how many units of each line.
 *
 * Usage:
 *   npm run benchmark:assign                 full run, writes docs/BENCHMARK.md
 *   npm run benchmark:assign -- --only en04  just some cases (no report written)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AssignRequestSchema } from '../shared/schemas';
import { createGroqClient } from '../server/ai';
import { proposeAssignments } from '../server/assign/assign';
import { getConfig } from '../server/config';
import { ApiError } from '../server/errors';
import { loadEnv, pct, ROOT, sleep, writeBenchmarkSection } from './lib/bench';
import {
  outcomeUnits,
  scoreCase,
  toAssignments,
  type CaseItem,
  type UnitMap,
} from './lib/assignScore';

interface Case {
  id: string;
  lang: string;
  menu: string;
  utterance: string;
  current?: UnitMap;
  expected: UnitMap;
}

const data = JSON.parse(readFileSync(resolve(ROOT, 'benchmarks/assign-cases.json'), 'utf8')) as {
  menus: Record<string, { items: CaseItem[]; people: Array<{ id: string; name: string }> }>;
  cases: Case[];
};

const onlyArg = process.argv.indexOf('--only');
const only = onlyArg > 0 ? new Set(process.argv[onlyArg + 1]!.split(',')) : null;
const cases = only ? data.cases.filter((c) => only.has(c.id) || only.has(c.lang)) : data.cases;

loadEnv();
const config = getConfig();
if (!config.apiKey) {
  console.error('GROQ_API_KEY is not set in .env');
  process.exit(1);
}
const ai = createGroqClient(config);
const RAW = resolve(ROOT, 'benchmarks/raw');
mkdirSync(RAW, { recursive: true });
const PAUSE_MS = 9_000; // Stay under the free tier's tokens-per-minute limit.

interface Result {
  id: string;
  lang: string;
  exact: boolean;
  itemsCorrect: number;
  itemsTotal: number;
  latencyMs: number;
  error?: string;
}

const results: Result[] = [];
for (const [index, c] of cases.entries()) {
  if (index > 0) await sleep(PAUSE_MS);
  const menu = data.menus[c.menu]!;
  const input = AssignRequestSchema.parse({
    utterance: c.utterance,
    items: menu.items,
    people: menu.people,
    currentAssignments: toAssignments(c.current),
    language: 'en',
  });
  let attempt = 0;
  for (;;) {
    attempt++;
    const started = performance.now();
    try {
      const proposal = await proposeAssignments(input, { ai, config });
      const latencyMs = Math.round(performance.now() - started);
      const actual = outcomeUnits(menu.items, c.current, proposal.assignments);
      const score = scoreCase(menu.items, c.expected, actual);
      results.push({ id: c.id, lang: c.lang, latencyMs, ...score });
      writeFileSync(
        resolve(RAW, `${c.id}.json`),
        JSON.stringify({ case: c, proposal, actual, score }, null, 2),
      );
      console.log(
        `${c.id} ${score.exact ? 'OK  ' : 'MISS'} ${score.itemsCorrect}/${score.itemsTotal}  ${c.utterance}`,
      );
      break;
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'ERROR';
      if ((code === 'RATE_LIMITED' || code === 'TIMEOUT') && attempt < 6) {
        await sleep(30_000);
        continue;
      }
      results.push({
        id: c.id,
        lang: c.lang,
        exact: false,
        itemsCorrect: 0,
        itemsTotal: menu.items.length,
        latencyMs: 0,
        error: code,
      });
      console.log(`${c.id} ERROR ${code}`);
      break;
    }
  }
}

const languages = ['en', 'tr', 'de', 'fr', 'es'] as const;
const names: Record<string, string> = {
  en: 'English',
  tr: 'Turkish',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
};
const rows = languages
  .map((lang) => {
    const r = results.filter((x) => x.lang === lang);
    if (r.length === 0) return null;
    const exact = r.filter((x) => x.exact).length;
    const items = r.reduce((a, x) => a + x.itemsCorrect, 0);
    const total = r.reduce((a, x) => a + x.itemsTotal, 0);
    return `| ${names[lang]} | ${r.length} | ${exact} / ${r.length} (${pct(exact / r.length)}) | ${pct(items / total)} |`;
  })
  .filter(Boolean);
const all = results.filter((r) => !r.error);
const latencies = all.map((r) => r.latencyMs).sort((a, b) => a - b);
const median = latencies.length ? latencies[Math.floor(latencies.length / 2)]! : 0;
const failed = results.filter((r) => !r.exact).map((r) => r.id);
console.log(
  `\nExact: ${results.length - failed.length}/${results.length}. Misses: ${failed.join(', ') || 'none'}`,
);

if (!only) {
  const date = new Date().toISOString().slice(0, 10);
  writeBenchmarkSection(
    'assign',
    `## Sentence understanding

Run on ${date} with \`${config.models.text}\` on ${results.length} synthetic cases (\`benchmarks/assign-cases.json\`; fictional menus and names).

| Language | Cases | Every line exactly right | Lines right |
| --- | --- | --- | --- |
${rows.join('\n')}

Median latency: ${(median / 1000).toFixed(1)} s per sentence.${results.some((r) => r.error) ? ` ${results.filter((r) => r.error).length} case(s) failed with an API error and count as wrong.` : ''}

How it is measured: each sentence goes through the same server code as the app (\`proposeAssignments\`), the proposal is applied with the app's own \`applyProposal\` (including line splitting for "two of the three beers"), and the outcome is compared line by line: how many units of each receipt line each person ends up with (±0.02). A case only counts as right when **every** line on the receipt is right — including lines the sentence should leave alone. Cases cover shared items, quantity splits, "everyone", "everyone except", "the rest", corrections of earlier assignments, nicknames and missing diacritics, synonyms ("coke", "fizzy water", "fry-up"), several sentences at once, speech-style filler words, and people or dishes that are not on the bill.

Voice is not benchmarked with audio files: speech-to-text is Groq's Whisper, and this benchmark measures what happens after the words are known.`,
  );
  console.log('Wrote docs/BENCHMARK.md (assign section).');
}
