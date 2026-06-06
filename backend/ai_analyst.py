import os
import json
import httpx
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

# Config
AI_PROVIDER = os.getenv("AI_PROVIDER", "groq").lower()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY")

SYSTEM_PROMPT = (
    "You are 'CyberOracle AI', an elite cybersecurity analyst. "
    "Your job is to analyze threat intelligence, explain vulnerabilities, "
    "and provide actionable security recommendations. "
    "Keep your answers concise, highly technical, and professional."
)

def _get_groq_client():
    if not GROQ_API_KEY:
        return None
    return Groq(api_key=GROQ_API_KEY)

def analyze_threat(query: str, context_data: str = "") -> str:
    """Synchronous non-streaming threat analysis call."""
    system = SYSTEM_PROMPT
    if context_data:
        system += f"\n\nContext Data to reference:\n{context_data}"

    # --- 1. Groq Provider ---
    if AI_PROVIDER == "groq":
        client = _get_groq_client()
        if not client:
            return "⚠️ GROQ_API_KEY not configured. Set it in your .env file."
        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": query},
                ],
                temperature=0.2,
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"Error connecting to Groq: {e}"

    # --- 2. Gemini Provider ---
    elif AI_PROVIDER == "gemini":
        if not GEMINI_API_KEY:
            return "⚠️ GEMINI_API_KEY not configured. Set it in your .env file."
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
        payload = {
            "contents": [
                {"role": "user", "parts": [{"text": f"System Guidelines: {system}\n\nUser Query: {query}"}]}
            ],
            "generationConfig": {"temperature": 0.2}
        }
        try:
            r = httpx.post(url, json=payload, timeout=30.0)
            if r.status_code == 200:
                res_data = r.json()
                return res_data['candidates'][0]['content']['parts'][0]['text']
            else:
                return f"Gemini API returned error code {r.status_code}: {r.text}"
        except Exception as e:
            return f"Error connecting to Gemini: {e}"

    # --- 3. Claude Provider ---
    elif AI_PROVIDER == "claude":
        if not CLAUDE_API_KEY:
            return "⚠️ CLAUDE_API_KEY not configured. Set it in your .env file."
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": CLAUDE_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        payload = {
            "model": "claude-3-5-sonnet-20241022",
            "max_tokens": 4000,
            "system": system,
            "messages": [
                {"role": "user", "content": query}
            ],
            "temperature": 0.2
        }
        try:
            r = httpx.post(url, headers=headers, json=payload, timeout=30.0)
            if r.status_code == 200:
                return r.json()['content'][0]['text']
            else:
                return f"Claude API error {r.status_code}: {r.text}"
        except Exception as e:
            return f"Error connecting to Claude: {e}"

    return "⚠️ Unknown AI_PROVIDER specified in environment variables."

def analyze_threat_stream(query: str, context_data: str = ""):
    """Streams response tokens from the selected provider."""
    system = SYSTEM_PROMPT
    if context_data:
        system += f"\n\nContext Data to reference:\n{context_data}"

    # --- 1. Groq Streaming ---
    if AI_PROVIDER == "groq":
        client = _get_groq_client()
        if not client:
            yield "⚠️ GROQ_API_KEY not configured in .env."
            return
        try:
            stream = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": query},
                ],
                temperature=0.2,
                stream=True
            )
            for chunk in stream:
                token = chunk.choices[0].delta.content
                if token:
                    yield token
        except Exception as e:
            yield f"Error streaming from Groq: {str(e)}"

    # --- 2. Gemini Streaming ---
    elif AI_PROVIDER == "gemini":
        if not GEMINI_API_KEY:
            yield "⚠️ GEMINI_API_KEY not configured in .env."
            return
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key={GEMINI_API_KEY}"
        payload = {
            "contents": [
                {"role": "user", "parts": [{"text": f"System Guidelines: {system}\n\nUser Query: {query}"}]}
            ],
            "generationConfig": {"temperature": 0.2}
        }
        try:
            with httpx.stream("POST", url, json=payload, timeout=30.0) as r:
                if r.status_code != 200:
                    yield f"Error initiating Gemini stream (code {r.status_code})"
                    return
                
                # Gemini returns line-delimited JSON chunks wrapped inside a list: `[ { ... }, { ... } ]`
                # Often the API streams as a sequence of events.
                buffer = ""
                for chunk in r.iter_text():
                    buffer += chunk
                    while True:
                        start = buffer.find('{')
                        if start == -1:
                            buffer = ""
                            break
                        depth = 0
                        end = -1
                        in_string = False
                        escape = False
                        for i in range(start, len(buffer)):
                            char = buffer[i]
                            if escape:
                                escape = False
                                continue
                            if char == '\\':
                                escape = True
                                continue
                            if char == '"':
                                in_string = not in_string
                                continue
                            if not in_string:
                                if char == '{':
                                    depth += 1
                                elif char == '}':
                                    depth -= 1
                                    if depth == 0:
                                        end = i
                                        break
                        if end != -1:
                            obj_str = buffer[start:end+1]
                            buffer = buffer[end+1:]
                            try:
                                data = json.loads(obj_str)
                                candidates = data.get('candidates', [])
                                if candidates:
                                    parts = candidates[0].get('content', {}).get('parts', [])
                                    if parts:
                                        token = parts[0].get('text', '')
                                        if token:
                                            yield token
                            except Exception:
                                pass
                        else:
                            break
        except Exception as e:
            yield f"Error streaming from Gemini: {e}"

    # --- 3. Claude Streaming ---
    elif AI_PROVIDER == "claude":
        if not CLAUDE_API_KEY:
            yield "⚠️ CLAUDE_API_KEY not configured in .env."
            return
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": CLAUDE_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        payload = {
            "model": "claude-3-5-sonnet-20241022",
            "max_tokens": 4000,
            "system": system,
            "messages": [{"role": "user", "content": query}],
            "temperature": 0.2,
            "stream": True
        }
        try:
            with httpx.stream("POST", url, headers=headers, json=payload, timeout=30.0) as r:
                if r.status_code != 200:
                    yield f"Error initiating Claude stream (code {r.status_code})"
                    return
                for line in r.iter_lines():
                    if line.startswith("data:"):
                        data_str = line[5:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            event = json.loads(data_str)
                            if event.get("type") == "content_block_delta":
                                token = event['delta'].get('text', '')
                                if token:
                                    yield token
                        except Exception:
                            pass
        except Exception as e:
            yield f"Error streaming from Claude: {e}"
            
    else:
        yield "⚠️ Unknown AI_PROVIDER specified in environment variables."
