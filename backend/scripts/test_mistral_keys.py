"""
Diagnostic script to test Mistral API keys from .env.
Checks authentication, rate limits, and model access against Mistral endpoints.
Keys are redacted for security.

Run from repo root or backend:
  .venv\\Scripts\\python scripts/test_mistral_keys.py
"""

import os
import sys
from pathlib import Path
import httpx
from dotenv import load_dotenv

# Load backend/.env
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path)

raw_keys = os.environ.get("MISTRAL_API_KEY", "")
keys = [k.strip() for k in raw_keys.split(",") if k.strip()]

if not keys:
    print("❌ No MISTRAL_API_KEY found in backend/.env")
    sys.exit(1)

print(f"🔍 Found {len(keys)} Mistral key(s) in .env\n")


def redact(k: str) -> str:
    if len(k) <= 8:
        return "****"
    return f"{k[:4]}...{k[-4:]}"


for idx, key in enumerate(keys, 1):
    tag = redact(key)
    print(f"==================================================")
    print(f"Testing Key #{idx}: {tag}")
    print(f"==================================================")

    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    # 1. Test GET /v1/models (Auth & permissions check)
    print("1. Checking GET https://api.mistral.ai/v1/models ...")
    try:
        resp = httpx.get("https://api.mistral.ai/v1/models", headers=headers, timeout=10.0)
        print(f"   Status Code: {resp.status_code}")
        if resp.status_code == 200:
            models_data = resp.json().get("data", [])
            model_ids = [m.get("id") for m in models_data]
            print(f"   ✅ Auth Success! {len(model_ids)} models available.")
            has_small = "mistral-small-latest" in model_ids
            has_medium = "mistral-medium-latest" in model_ids
            print(f"      - mistral-small-latest available: {has_small}")
            print(f"      - mistral-medium-latest available: {has_medium}")
        else:
            print(f"   ❌ Auth / Access Failed: {resp.text}")
    except Exception as e:
        print(f"   ❌ Connection error: {e}")

    # 2. Test POST /v1/chat/completions with mistral-small-latest
    print("\n2. Testing Chat Completion with 'mistral-small-latest' ...")
    try:
        resp = httpx.post(
            "https://api.mistral.ai/v1/chat/completions",
            headers=headers,
            json={
                "model": "mistral-small-latest",
                "messages": [{"role": "user", "content": "Hi"}],
                "max_tokens": 10,
            },
            timeout=15.0,
        )
        print(f"   Status Code: {resp.status_code}")
        if resp.status_code == 200:
            reply = resp.json()["choices"][0]["message"]["content"]
            print(f"   ✅ Success! Reply: {reply.strip()[:40]}")
        else:
            print(f"   ❌ Failed: {resp.text}")
    except Exception as e:
        print(f"   ❌ Error: {e}")

    print("\n")
