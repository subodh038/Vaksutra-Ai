import sys
import os
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.append(str(backend_dir))

try:
    from dotenv import load_dotenv
    load_dotenv(backend_dir / '.env')
    from groq import Groq
except ImportError:
    print("Could not import required modules. Make sure you have 'groq' installed.")
    sys.exit(1)


# Mocking the actual topic generator prompt logic
mode = "impromptu"
category = "technology and society"
recent_topics = [
    "Should AI replace human teachers?",
    "Is social media ruining our attention spans?"
]
soul_context = """recurring weaknesses: Uses filler words ('um', 'ah'), speaks too fast under pressure
recurring strengths: Good eye contact, clear structure
coach notes: The speaker is improving but struggles with pausing for emphasis. Need prompts that encourage thoughtful, slower speech."""

avoid_block = (
    "\n\nDo NOT generate any of these topics — they were recently given to this user:\n"
    + "\n".join(f"- {t}" for t in recent_topics)
)

personalize_block = (
    "\n\nAbout this speaker (use to personalise difficulty/type, do not mention in the topic):\n"
    + soul_context
)

PROMPT = f"""You are generating a single impromptu speaking prompt for a public speaking practice app.

Mode: {mode}
Category hint: {category}{avoid_block}{personalize_block}

Requirements:
- ONE topic only — no list, no numbering, no options.
- EXTREME BREVITY: The topic MUST be a SINGLE SENTENCE of NO MORE THAN 15 WORDS.
- GENERAL & ACCESSIBLE: The topic must be understandable and approachable by ANY user.
- DISTINCT CONCEPTS: Do NOT repeat the concepts, themes, or "angles" of the avoided topics above.
- Output ONLY a valid JSON object with a single key "topic".

Example:
{{
  "topic": "What is the most important invention of the 21st century?"
}}"""

import time

def test_model(client, model_name: str):
    print(f"\n==================================================")
    print(f"Testing Model: {model_name}")
    print(f"==================================================")
    
    try:
        print("Sending realistic topic prompt via Groq SDK...")
        start_time = time.perf_counter()
        completion = client.chat.completions.create(
            model=model_name,
            messages=[
                {
                    "role": "user",
                    "content": PROMPT
                }
            ],
            response_format={"type": "json_object"}
        )
        duration = time.perf_counter() - start_time
        
        choice = completion.choices[0]
        content = choice.message.content
        
        print(f"Time Taken: {duration:.2f} seconds")
        
        if content is None:
            print("Content is explicitly 'null'.")
            print(f"Finish Reason: {choice.finish_reason}")
            if hasattr(choice.message, 'reasoning') and choice.message.reasoning:
                print(f"Hidden Reasoning: {choice.message.reasoning}")
        elif content == "":
            print("Content is an EMPTY STRING ('').")
            print(f"Finish Reason: {choice.finish_reason}")
            if hasattr(choice.message, 'reasoning') and choice.message.reasoning:
                print(f"Hidden Reasoning: {choice.message.reasoning}")
        else:
            print(f"SUCCESS! Output:\n{content}")
            if hasattr(choice.message, 'reasoning') and choice.message.reasoning:
                print(f"Hidden Reasoning: {choice.message.reasoning}")

    except Exception as e:
        print(f"ERROR: {e}")

def main():
    if not os.environ.get("GROQ_API_KEY"):
        raw = os.environ.get("GROQ_API_KEYS", "")
        keys = [k.strip() for k in raw.split(",") if k.strip()]
        if keys:
            os.environ["GROQ_API_KEY"] = keys[0]
        else:
            print("No Groq API keys found in backend/.env!")
            return
            
    print(f"Using Groq Key: {os.environ.get('GROQ_API_KEY')[:8]}...")
    
    client = Groq()
    
    test_model(client, "openai/gpt-oss-20b")
    test_model(client, "openai/gpt-oss-120b")

if __name__ == "__main__":
    main()
