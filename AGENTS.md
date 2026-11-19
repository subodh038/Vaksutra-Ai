# AGENTS.md — Global Rules for AI Agents (Hermes)

> This file defines hard rules for ANY AI agent working in this repository
> (Hermes, Claude, Cursor, Codex, etc.). Read this file BEFORE making changes.
> These rules exist to protect a LIVE product with real users.

---

## 🚫 Never Allowed (hard blocks)

1. **Never commit or print secrets.** `.env`, `frontend/.env.local`, API keys
   (GROQ_API_KEYS, MISTRAL_API_KEY, SUPABASE_*), tokens, passwords. If you see
   one in output, redact it. Never echo env values into logs, chats, or commits.
2. **Never run git network/state commands — no `commit`, `push`, `pull`, or
   `merge`.** The owner handles ALL git operations personally. The agent's job
   is to make changes, then TELL the owner what to commit and suggest a
   commit message. Staging (`git add`) is allowed; committing/pushing/
   pulling/merging is not.
3. **Never run destructive git commands**: `push --force`, `reset --hard`,
   history rewrites, branch deletion.
4. **Never touch production data.** Do not INSERT/UPDATE/DELETE rows in the
   live Supabase DB (sessions, profiles, auth users). Read-only queries for
   metrics are allowed with the service key, but never write and never export
   user PII (emails, transcripts, videos) outside the project.
5. **Never disable or bypass security checks**: auth dependencies on routes,
   RLS policies, rate limiters, path validation (`_validate_path`), CORS
   allowlist, input schema bounds (`allow_inf_nan=False`).
6. **Never fabricate results.** If a build/test/deploy fails, report the real
   error. Made-up success is the worst possible failure mode here.
7. **Never install new dependencies or change models/endpoints without asking**
   (no new pip/npm packages, no swapping Groq/Mistral models, no new external
   APIs) — cost and supply-chain risk.
8. **Never post publicly on behalf of the owner** (Reddit, X, LinkedIn,
   Product Hunt, WhatsApp) without an explicit per-post approval.

## ⚠️ Ask First

- Any edit to `backend/core/pipeline.py` scoring logic or prompt text in
  `llm_coach.py` / `linguistics.py` — this directly changes user-facing scores.
- Schema changes to Supabase tables (migrations need owner-run SQL).
- Refactors spanning 3+ files; drive-by reformatting is forbidden.
- Deleting anything ("dead code" may be load-bearing).
- Anything touching `graft/` (mirror directory — confirm intent first).

## ✅ Expected Behavior

- **Verify before claiming done**: run `pytest tests/ -q` (backend, use
  `backend/.venv`) and `npx tsc --noEmit` (frontend) after code changes.
- **Match existing style**: routes in `api/routes/`, logic in `services/`,
  analysis math in `core/`, DB access only via `db/repositories/`.
- Keep the degradation contract: visual analysis may fail → audio-only must
  still work. Never let one stage crash the pipeline silently.
- User-scoped data access always filters by `user_id`; storage paths stay
  namespaced `{user_id}/{filename}`.
- Log honestly: errors are errors (not warnings), no PII in log lines.
- After fixing a bug, check sibling call paths for the same flaw.

## 📌 Project Context (stable facts)

- Product: VakSutra AI — AI impromptu-speaking coach. Live at
  https://vaksutra-ai.vercel.app (frontend) and
  https://vocalyze-ai-backend.onrender.com (FastAPI).
- Stack: Next.js 15/React 19/Tailwind 4 + MediaPipe in-browser; FastAPI +
  Groq (Whisper + LLM fallback) + Mistral (primary coach LLM) + Supabase
  (auth, DB, video storage). Both Mistral and Groq keys accept
  comma-separated rotation lists by design.
- Growth plan lives in `LAUNCH.md`. Weekly growth monitor runs Mondays.
