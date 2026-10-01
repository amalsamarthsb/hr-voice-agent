import os
from typing import Any

from dotenv import load_dotenv
from groq import Groq, GroqError


load_dotenv()

MODEL_NAME = "whisper-large-v3-turbo"


def transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/wav") -> str:
    if not audio_bytes:
        raise ValueError("The recorded answer is empty.")
    if mime_type != "audio/wav":
        raise ValueError("Interview audio must be submitted as WAV.")

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not configured in backend/.env.")

    try:
        client = Groq(api_key=api_key)
        result: Any = client.audio.transcriptions.create(
            file=("answer.wav", audio_bytes, mime_type),
            model=MODEL_NAME,
            response_format="json",
        )
    except GroqError as error:
        message = getattr(error, "message", None) or str(error)
        raise RuntimeError(f"Groq transcription failed: {message}") from error

    transcript = getattr(result, "text", None)
    if not isinstance(transcript, str):
        raise RuntimeError("Groq returned an invalid transcription response.")
    return transcript.strip()
