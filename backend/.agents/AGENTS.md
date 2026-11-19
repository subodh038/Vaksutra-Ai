# Vocalyze AI Backend — Agent Rules

<!-- Edit this file to add rules I must ALWAYS follow for this workspace. -->

## How to use this file

Write plain English rules below. I will read and obey them on every request for this workspace.

---

## Your Rules

<!-- ↓ Add your rules here ↓ -->

### LLD first

- Before writing any non-trivial function or endpoint, write a short LLD: inputs/outputs, data shape, error cases, which file it belongs in. A few lines, not a document. Skip only for one-line changes.
- Never write placeholder/demo/stub code silently. If genuinely blocked, stop and flag it in `Backlog.md` instead of faking it.
- If a request changes the design and is ambiguous, ask instead of guessing. Minor details: pick a default, note the assumption.

### Documentation

- `decision.md` = cross-cutting, finalized decisions only. One line each: what, why.
- Feature-specific detail (design, tests, open questions) goes in its own named `*.md` — not `decision.md`. Use `Architecture.md`, `Backlog.md`, or a new file.
- Update relevant `*.md` files automatically, no need to ask first — but always say in chat which file changed and why.
- Never leave two `.md` files contradicting each other. Update all affected files in the same pass.

### Code quality

- Type everything. Python: type hints + Pydantic models everywhere, no bare `dict`/`Any`. TypeScript: no `any`.
- No `print()` — use `logging`.
- No bare `except:`. Catch specific exceptions, log, re-raise or degrade explicitly. Never fail silently.

### Security

- No secrets, API keys, or environment-specific URLs in code — `.env` only, keep `.env.example` current.
- Never log secrets, full auth headers, or raw user audio/video content.
- Validate and size-limit every upload (`audio`, `frame_data`) — reject oversized or malformed input before processing, not deep inside the pipeline.
- Sanitize anything that reaches a shell command, file path, or query string — no raw user input passed through directly.
- CORS stays explicit (named origins only) — never `allow_origins=["*"]` once this leaves localhost.
- Dependencies: no unpinned versions in `requirements.txt` for anything touching auth, crypto, or file parsing.

### External services & resilience

- Every external API call (Groq Whisper, Llama-3, etc.) needs a timeout and explicit error handling.
- Decide graceful degradation per call: partial result, fallback, or clear error — never an opaque 500 because one optional AI call failed.

### Testing

- Log untested/unwired code in `Backlog.md` until it's verified.

### API contracts

- Backend model changes → check if frontend `src/lib/api.ts` types need the same update, and say so.
- Never rename/restructure a field without checking what consumes it first.
