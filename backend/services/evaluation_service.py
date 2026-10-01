import json

from models import Answer, Interview, Job, Question, Evaluation
from services.groq_text_service import generate_json_response


def evaluate_interview(
    db,
    interview: Interview,
):
    job = (
        db.query(Job)
        .filter(Job.id == interview.job_id)
        .first()
    )

    if not job:
        raise ValueError("Job not found.")

    questions = (
        db.query(Question)
        .filter(
            Question.interview_id == interview.id
        )
        .order_by(Question.order_index)
        .all()
    )

    if not questions:
        raise ValueError(
            "No interview questions found."
        )

    question_ids = [
        question.id
        for question in questions
    ]

    answers = (
        db.query(Answer)
        .filter(
            Answer.question_id.in_(question_ids)
        )
        .order_by(Answer.created_at)
        .all()
    )

    if not answers:
        raise ValueError(
            "No candidate answers found."
        )

    answer_map = {
        answer.question_id: answer.transcript
        for answer in answers
    }

    interview_content = []

    for question in questions:
        answer = answer_map.get(
            question.id,
            "[No answer recorded]",
        )

        interview_content.append(
            {
                "question": question.text,
                "answer": answer,
            }
        )

    prompt = f"""
You are an expert HR interview evaluator.

Evaluate the completed interview objectively.

JOB TITLE:
{job.title}

JOB DESCRIPTION:
{job.description}

CANDIDATE RESUME:
{interview.resume_text}

INTERVIEW:
{json.dumps(interview_content, indent=2)}

Evaluate the candidate based on:

1. Technical knowledge
2. Understanding of their own projects and experience
3. Relevance to the job
4. Problem-solving ability
5. Communication
6. Practical understanding
7. Accuracy of answers

Important:
- Do not invent candidate experience.
- Do not judge based on protected personal characteristics.
- Base the evaluation only on the resume, job description,
  questions and answers.
- Keep the evaluation professional and evidence-based.
- The evaluation is INTERNAL HR DATA.
- Do not write anything addressed directly to the candidate.

Return ONLY valid JSON:

{{
    "overall_score": 0,
    "passed": false,
    "feedback": "Concise professional evaluation for HR."
}}

overall_score must be between 0 and 100.

Use 60 as the internal passing threshold.
"""

    result = generate_json_response(prompt)
    if not isinstance(result, dict):
        raise ValueError("Groq returned an invalid interview evaluation.")

    try:
        overall_score = float(result["overall_score"])
        passed = result["passed"]
        feedback = result["feedback"]
    except (KeyError, TypeError, ValueError) as error:
        raise ValueError("Groq returned an incomplete interview evaluation.") from error

    if not isinstance(passed, bool) or not isinstance(feedback, str):
        raise ValueError("Groq returned an invalid interview evaluation.")
    feedback = feedback.strip()

    if not 0 <= overall_score <= 100:
        raise ValueError(
            "AI returned an invalid score."
        )

    existing = (
        db.query(Evaluation)
        .filter(
            Evaluation.interview_id == interview.id
        )
        .first()
    )

    if existing:
        existing.overall_score = overall_score
        existing.passed = passed
        existing.feedback = feedback

        evaluation = existing
    else:
        evaluation = Evaluation(
            interview_id=interview.id,
            overall_score=overall_score,
            passed=passed,
            feedback=feedback,
        )

        db.add(evaluation)

    db.commit()
    db.refresh(evaluation)

    return evaluation