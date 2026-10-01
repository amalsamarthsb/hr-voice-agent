from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Job, Resume, Interview, Question, Evaluation
from schemas import (
    CandidateInterviewResponse,
    InterviewCreate,
    InterviewResponse,
    QuestionResponse,
)
from services.auth_dependencies import require_candidate
from services.interview_service import create_interview
from services.groq_interview_service import generate_interview_questions

router = APIRouter(
    prefix="/interviews",
    tags=["Interviews"],
)


@router.post("/", response_model=InterviewResponse)
def create_candidate_interview(
    data: InterviewCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_candidate),
):
    user_id = current_user.id

    job = (
        db.query(Job)
        .filter(Job.id == data.job_id)
        .first()
    )

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job not found.",
        )

    resume = (
        db.query(Resume)
        .filter(
            Resume.id == data.resume_id,
            Resume.user_id == user_id,
        )
        .first()
    )

    if not resume:
        raise HTTPException(
            status_code=404,
            detail="Resume not found.",
        )

    interview = create_interview(
        db=db,
        user_id=user_id,
        job=job,
        resume=resume,
    )

    try:
        questions = generate_interview_questions(
            resume_text=resume.resume_text,
            job_title=job.title,
            job_description=job.description,
        )
    except Exception as error:
        db.delete(interview)
        db.commit()

        raise HTTPException(
            status_code=502,
            detail=f"Could not generate interview questions: {error}",
        )

    for index, question_text in enumerate(
        questions,
        start=1,
    ):
        db.add(
            Question(
                interview_id=interview.id,
                order_index=index,
                text=question_text,
            )
        )

    interview.status = "ready"

    db.commit()
    db.refresh(interview)

    return interview


@router.get(
    "/my",
    response_model=list[CandidateInterviewResponse],
)
def get_my_interviews(
    db: Session = Depends(get_db),
    current_user=Depends(require_candidate),
):
    rows = (
        db.query(Interview, Evaluation.passed)
        .outerjoin(
            Evaluation,
            Evaluation.interview_id == Interview.id,
        )
        .filter(Interview.user_id == current_user.id)
        .order_by(Interview.created_at.desc())
        .all()
    )
    return [
        {
            "id": interview.id,
            "job_id": interview.job_id,
            "resume_id": interview.resume_id,
            "status": interview.status,
            "passed": passed,
        }
        for interview, passed in rows
    ]


@router.get(
    "/{interview_id}/questions",
    response_model=list[QuestionResponse],
)
def get_interview_questions(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_candidate),
):
    interview = (
        db.query(Interview)
        .filter(
            Interview.id == interview_id,
            Interview.user_id == current_user.id,
        )
        .first()
    )

    if not interview:
        raise HTTPException(
            status_code=404,
            detail="Interview not found.",
        )

    questions = (
        db.query(Question)
        .filter(
            Question.interview_id == interview_id
        )
        .order_by(Question.order_index)
        .all()
    )
    return [
        {"id": question.id, "question": question.text}
        for question in questions
    ]


@router.post("/{interview_id}/complete")
@router.post("/{interview_id}/finish")
def finish_candidate_interview(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_candidate),
):
    interview = (
        db.query(Interview)
        .filter(
            Interview.id == interview_id,
            Interview.user_id == current_user.id,
        )
        .first()
    )

    if not interview:
        raise HTTPException(
            status_code=404,
            detail="Interview not found.",
        )

    if interview.status == "completed":
        return {
            "message": "Interview already submitted.",
            "status": "completed",
        }

    if interview.status not in {
        "ready",
        "in_progress",
    }:
        raise HTTPException(
            status_code=400,
            detail="Interview cannot be submitted in its current state.",
        )

    interview.status = "completed"
    interview.ended_at = datetime.now(timezone.utc)

    db.commit()

    return {
        "message": "Interview submitted successfully.",
        "status": "completed",
    }