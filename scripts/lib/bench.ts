/** Small helpers shared by the benchmark scripts (local use only, never in CI). */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '../..');

/** Loads .env into process.env without printing anything. */
export function loadEnv(): void {
  const file = resolve(ROOT, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '');
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const pct = (x: number) => `${(x * 100).toFixed(1)} %`;

/**
 * docs/BENCHMARK.md is shared by both benchmarks: each one rewrites only the text
 * between its own markers.
 */
export function writeBenchmarkSection(name: 'receipts' | 'assign', content: string): void {
  const file = resolve(ROOT, 'docs/BENCHMARK.md');
  const start = `<!-- ${name}:start -->`;
  const end = `<!-- ${name}:end -->`;
  let doc = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const block = `${start}\n${content.trim()}\n${end}`;
  if (doc.includes(start) && doc.includes(end)) {
    doc = doc.slice(0, doc.indexOf(start)) + block + doc.slice(doc.indexOf(end) + end.length);
  } else {
    doc = `${doc.trimEnd()}\n\n${block}\n`;
  }
  writeFileSync(file, doc);
}
