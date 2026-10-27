# Decisions

One line each: decision — reason.

- 2026-10-27 · Vision model `qwen/qwen3.8-27b`, text model `openai/gpt-oss-120b`, speech-to-text `whisper-large-v3` (fallback `whisper-large-v3-turbo`) — chosen from Groq's live `/models` list on this date; Qwen 3.8 27B is the only listed model that accepts images (verified with a test call).
- 2026-10-27 · TypeScript 6.0 instead of 7.0 — typescript-eslint supports `<6.1` only.
- 2026-10-27 · Local dev runs the `/api` functions inside Vite through a small middleware plugin — one command (`npm run dev`), no Vercel login needed for contributors.
- 2026-10-27 · Claude Code commit attribution disabled in `.claude/settings.json` (and `.claude/` is gitignored) — Vercel Hobby may block deploys for commits with extra co-authors.
- 2026-10-27 · No router: the flow is a single state machine (`useBill.step`), synced to `history.pushState` so the phone's back button works — fewer moving parts for a five-step wizard.
- 2026-10-27 · Undo/redo snapshots the whole bill (structuredClone) per commit, capped at 100 — the bill is tiny, so this is simpler and safer than inverse operations.
- 2026-10-27 · Bill data lives only in memory (not localStorage) — privacy; only preferences and recent-night summaries are persisted.
- 2026-10-27 · Dialogs use the native `<dialog>` element — focus trap, Escape and inert background for free, no extra library.
- 2026-10-27 · Drag-and-drop _adds_ the person to an item's sharers rather than replacing them; the tap sheet is the precise tool (weights, everyone, clear).
- 2026-10-27 · Rounding: everyone rounds to the step; the difference goes to the person who owes most (or a chosen person) so the total still matches. Rounding is skipped if it would make the cover person negative.
- 2026-10-27 · Dish award is "{{dish}} Royalty" rather than "King" — gender-neutral and still playful.
- 2026-10-27 · Leftover pennies on shared items rotate between sharers by item position — still deterministic, but no one systematically pays the extra penny.
- 2026-10-27 · Spend-based titles (Big Spender, Light Eater, Dessert Goblin) need a 5 % gap to the runner-up; Fair Share needs a 15 % spread — no titles over rounding pennies. Nights where everything was shared equally may get fewer than three titles, by design.
- 2026-10-27 · Roulette "Loser covers the desserts" moves the dessert _item_ amounts only; each person's share of service/tip stays proportional to what they ordered.
- 2026-10-27 · Titles are computed without the roulette transfer — they describe what people ordered, not who lost the game.
- 2026-10-27 · Only English ships in the main bundle; other languages are lazy-loaded chunks — every visitor starts in English anyway.
- 2026-10-27 · Flow screens are lazy chunks prefetched on idle; framer-motion uses `LazyMotion` + `m` — main bundle went from 216 KB to ~108 KB gzipped.
- 2026-10-27 · Only Latin/Latin-Ext font subsets are precached by the service worker (Turkish needs Latin-Ext); other subsets still load on demand.
- 2026-10-27 · `vite preview` serves the same security headers as `vercel.json`, so E2E tests run under the production CSP.
- 2026-10-27 · Translations are typed against the English source (`Translation` type) and tested for missing/extra keys and mismatched `{{placeholders}}`.
