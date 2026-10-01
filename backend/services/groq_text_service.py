import json
import os
import re
from typing import Any

from dotenv import load_dotenv
from groq import Groq, GroqError


load_dotenv()

MODEL_NAME = os.getenv("GROQ_TEXT_MODEL", "openai/gpt-oss-120b")


def generate_json_response(prompt: str) -> Any:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not configured in backend/.env.")

    try:
        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {
                    "role": "system",
                    "content": "Follow the user's task and return valid JSON only.",
                },
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
        )
    except GroqError as error:
        message = getattr(error, "message", None) or str(error)
        raise RuntimeError(f"Groq text generation failed: {message}") from error

    choices = getattr(response, "choices", None)
    if not choices:
        raise RuntimeError("Groq returned no completion choices.")

    content = choices[0].message.content
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("Groq returned an empty response.")

    cleaned = re.sub(
        r"^```(?:json)?\s*|\s*```$",
        "",
        content.strip(),
        flags=re.IGNORECASE,
    )
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as error:
        raise RuntimeError("Groq returned invalid JSON.") from error
