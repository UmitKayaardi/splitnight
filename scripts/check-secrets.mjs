// Fails if a Groq API key or a real receipt photo is tracked by git.
// Runs before every push and in CI. Cross-platform (plain Node, no shell tools).
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

// Built from parts so this file does not match its own pattern.
const KEY_PATTERN = new RegExp(['g', 's', 'k', '_'].join('') + '[A-Za-z0-9]{20,}');
const FORBIDDEN_PATHS = [/^test-receipts\//i, /^\.env($|\.(?!example$))/i, /^SPLITNIGHT_PLAN\.md$/i, /^FINAL_REPORT\.md$/i];

let files;
try {
  files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
} catch {
  console.error('check:secrets — not a git repository (nothing to check).');
  process.exit(0);
}

const problems = [];
for (const file of files) {
  if (FORBIDDEN_PATHS.some((re) => re.test(file))) {
    problems.push(`${file}: this file must never be tracked`);
    continue;
  }
  let stats;
  try {
    stats = statSync(file);
  } catch {
    continue; // deleted in the working tree
  }
  if (!stats.isFile() || stats.size > 5_000_000) continue;
  const text = readFileSync(file, 'latin1');
  if (KEY_PATTERN.test(text)) problems.push(`${file}: looks like it contains a Groq API key`);
}

if (problems.length > 0) {
  console.error('check:secrets FAILED');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`check:secrets passed (${files.length} tracked files scanned).`);
