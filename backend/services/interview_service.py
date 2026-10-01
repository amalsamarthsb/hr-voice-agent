import json
import os

from openai import OpenAI
from sqlalchemy.orm import Session

from models import Interview, Job, Resume


client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY")
)


def create_interview(
    db: Session,
    user_id: int,
    job: Job,
    resume: Resume,
) -> Interview:
    interview = Interview(
        user_id=user_id,
        job_id=job.id,
        resume_id=resume.id,
        resume_text=resume.resume_text,
        status="created",
    )
    db.add(interview)
    db.commit()
    db.refresh(interview)
    return interview


def generate_interview_questions(
    resume_text: str,
    job_title: str,
    job_description: str,
    number_of_questions: int = 5
):

    prompt = f"""
You are an expert technical HR interviewer.

Create {number_of_questions} interview questions
for the candidate below.

JOB TITLE:
{job_title}

JOB DESCRIPTION:
{job_description}

CANDIDATE RESUME:
{resume_text}

Requirements:

1. Questions must be based on the job.
2. Questions must reference the candidate's actual resume
   where appropriate.
3. Include technical and behavioral questions.
4. Do not invent experience that is not in the resume.
5. Questions should work well in a spoken interview.
6. Keep each question concise.
7. Return ONLY valid JSON.

Format:

{{
    "questions": [
        "Question 1",
        "Question 2",
        "Question 3",
        "Question 4",
        "Question 5"
    ]
}}
"""

    response = client.responses.create(
        model="gpt-5.6-luna",
        input=prompt
    )

    text = response.output_text.strip()

    data = json.loads(text)

    return data["questions"]