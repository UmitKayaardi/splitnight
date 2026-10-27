# Progress

Resume from the first phase that is not marked done. Run `npm run verify` before each commit.

| Phase | Status |
| --- | --- |
| 0 — Setup & verification | done |
| 1 — Money engine | done (property-tested, ~99% line coverage) |
| 2 — API functions | done (live-tested locally: health, parse-receipt, assign, transcribe) |
| 3 — Core flow UI | done |
| 4 — Voice | done |
| 5 — Fun layer | done (awards, confetti, sounds, haptics, share text/PNG/Web Share, Bill Roulette) |
| 6 — Language, PWA, samples, polish | done (5 languages, PWA icons, CSP, code splitting) |
| 7 — Benchmarks | IN PROGRESS — see below |
| 8 — E2E & performance | not started |
| 9 — Documentation | not started |
| 10 — Deploy | not started |
| 11 — Recent nights | store + HistoryDialog exist; saving a night when Results opens is NOT wired yet |
| 12 — Final report | not started |

## Phase 7 status (resume here)
- Done: `test-receipts/ground-truth.json` (13 receipts, labelled + subtotal-checked), scoring libs with tests
  (`scripts/lib/receiptScore.ts`, `scripts/lib/assignScore.ts`), runners `scripts/benchmark-receipts.ts`
  and `scripts/benchmark-assign.ts`, dataset `benchmarks/assign-cases.json` (60 EN + 10 each TR/DE/FR/ES).
- A receipt benchmark run was started at the end of the session; if `docs/BENCHMARK.md` has no receipts
  section, re-run `npm run benchmark:receipts` (~6 min; pauses for free-tier limits).
- Next: `npm run benchmark:assign` (~20 min). Free-tier daily token budget for `openai/gpt-oss-120b`
  is roughly 200K tokens; one full run uses most of it, so iterate on failures with `-- --only en04,en10`.
- Then: improve the prompt if English is weak, note iterations in docs/BENCHMARK.md, commit.

## Known issues
- None blocking. CI runs e2e with `--pass-with-no-tests` until Phase 8 adds Playwright specs (remove the flag then).
