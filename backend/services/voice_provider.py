import os

from dotenv import load_dotenv


load_dotenv()


def get_voice_provider() -> str:
    provider = os.getenv("VOICE_PROVIDER", "groq").strip().lower()
    if provider not in {"groq", "openai"}:
        raise RuntimeError(
            "VOICE_PROVIDER must be either 'groq' or 'openai'."
        )
    return provider
