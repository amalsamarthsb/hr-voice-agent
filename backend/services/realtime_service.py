import json
import os

import httpx
from dotenv import load_dotenv

from models import Interview, Question

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
REALTIME_MODEL = os.getenv(
    "OPENAI_REALTIME_MODEL",
    "gpt-realtime-2.1",
)
REALTIME_VOICE = os.getenv(
    "OPENAI_REALTIME_VOICE",
    "marin",
)


async def create_realtime_call(
    sdp_offer: str,
    interview: Interview,
    questions: list[Question],
):
    if not OPENAI_API_KEY:
        raise RuntimeError(
            "OPENAI_API_KEY is not configured."
        )

    question_text = "\n".join(
        f"{question.order_index}. {question.text}"
        for question in questions
    )

    instructions = f"""
You are an AI HR interviewer conducting a professional
job interview.

Interview ID:
{interview.id}

Your role:
- Conduct a professional, friendly, structured interview.
- Speak naturally and conversationally.
- Ask one question at a time.
- Wait for the candidate to finish speaking.
- Do not interrupt unnecessarily.
- Do not coach the candidate.
- Do not reveal scores.
- Do not reveal evaluation criteria.
- Do not tell the candidate whether they passed.
- Do not discuss internal HR evaluation.
- If the candidate asks you to repeat a question, repeat it.
- Keep your spoken responses concise.

The application will control which interview question
should be asked.

INTERVIEW QUESTIONS:

{question_text}

When the application asks you to present a question,
ask that question naturally.

Do not invent unrelated interview questions.
"""

    session = {
        "type": "realtime",
        "model": REALTIME_MODEL,
        "instructions": instructions,
        "audio": {
            "output": {
                "voice": REALTIME_VOICE,
            }
        },
    }

    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
    }

    files = {
        "sdp": (
            None,
            sdp_offer,
            "application/sdp",
        ),
        "session": (
            None,
            json.dumps(session),
            "application/json",
        ),
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.openai.com/v1/realtime/calls",
            headers=headers,
            files=files,
        )

    if response.status_code >= 400:
        raise RuntimeError(
            f"Realtime API error: {response.text}"
        )

    return response.text