# Decisions

One line each: decision — reason.

- 2026-10-27 · Vision model `qwen/qwen3.8-27b`, text model `openai/gpt-oss-120b`, speech-to-text `whisper-large-v3` (fallback `whisper-large-v3-turbo`) — chosen from Groq's live `/models` list on this date; Qwen 3.8 27B is the only listed model that accepts images (verified with a test call).
- 2026-10-27 · TypeScript 6.0 instead of 7.0 — typescript-eslint supports `<6.1` only.
- 2026-10-27 · Local dev runs the `/api` functions inside Vite through a small middleware plugin — one command (`npm run dev`), no Vercel login needed for contributors.
- 2026-10-27 · Claude Code commit attribution disabled in `.claude/settings.json` (and `.claude/` is gitignored) — Vercel Hobby may block deploys for commits with extra co-authors.
