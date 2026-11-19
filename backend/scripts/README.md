# Backend Scripts & Diagnostic Tools

This directory contains standalone diagnostics, smoke tests, and manual verification scripts.
Automated pytest suites remain in `backend/tests/unit/` and `backend/tests/integration/`.

---

## Available Scripts

### 1. `test_mistral_keys.py`
Tests Mistral API keys configured in `backend/.env` against `/v1/models` and `/v1/chat/completions`.
All keys are safely redacted in output.
```powershell
.venv\Scripts\python scripts/test_mistral_keys.py
```

### 2. `smoke_test.py`
Quick sanity check for pipeline scoring, route registration, and duration plumbing without needing the browser.
```powershell
.venv\Scripts\python scripts/smoke_test.py
```

### 3. `contract_check.py`
Validates that TypeScript interfaces (`frontend/src/lib/videoAnalysis.ts`) and backend models (`backend/models/schemas.py`) are 100% in sync with zero missing fields.
```powershell
.venv\Scripts\python scripts/contract_check.py
```

### 4. `test_oss_models.py`
Directly verifies Groq OSS reasoning models (`openai/gpt-oss-20b` and `openai/gpt-oss-120b`) using the current prompt structures.
```powershell
.venv\Scripts\python scripts/test_oss_models.py
```
