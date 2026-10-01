from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import (
    Interview,
    Evaluation,
    Question,
    Answer,
    User,
    Job,
)
from schemas import (
    CandidateEmailRequest,
    CandidateEmailResponse,
    HRInterviewDetailResponse,
    HRInterviewResponse,
    HREvaluationResultResponse,
)
from services.auth_dependencies import require_hr
from services.email_service import (
    EmailConfigurationError,
    EmailDeliveryError,
    send_candidate_email,
)
from services.evaluation_service import evaluate_interview

router = APIRouter(
    prefix="/hr",
    tags=["HR Dashboard"],
)


@router.get(
    "/interviews",
    response_model=list[HRInterviewResponse],
)
def get_hr_interviews(
    db: Session = Depends(get_db),
    current_user=Depends(require_hr),
):
    interviews = (
        db.query(Interview)
        .order_by(Interview.created_at.desc())
        .all()
    )

    results = []

    for interview in interviews:
        user = (
            db.query(User)
            .filter(User.id == interview.user_id)
            .first()
        )

        job = (
            db.query(Job)
            .filter(Job.id == interview.job_id)
            .first()
        )

        evaluation = (
            db.query(Evaluation)
            .filter(
                Evaluation.interview_id
                == interview.id
            )
            .first()
        )

        results.append(
            {
                "interview_id": interview.id,
                "candidate_email": (
                    user.email if user else "Unknown"
                ),
                "job_title": (
                    job.title if job else "Unknown"
                ),
                "status": interview.status,
                "created_at": interview.created_at,
                "overall_score": (
                    evaluation.overall_score
                    if evaluation
                    else None
                ),
                "passed": (
                    evaluation.passed
                    if evaluation
                    else None
                ),
                "feedback": (
                    evaluation.feedback
                    if evaluation
                    else None
                ),
            }
        )

    return results


@router.get(
    "/interviews/{interview_id}",
    response_model=HRInterviewDetailResponse,
)
def get_hr_interview_details(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_hr),
):
    interview = (
        db.query(Interview)
        .filter(
            Interview.id == interview_id
        )
        .first()
    )

    if not interview:
        raise HTTPException(
            status_code=404,
            detail="Interview not found.",
        )

    user = (
        db.query(User)
        .filter(User.id == interview.user_id)
        .first()
    )

    job = (
        db.query(Job)
        .filter(Job.id == interview.job_id)
        .first()
    )

    questions = (
        db.query(Question)
        .filter(
            Question.interview_id == interview.id
        )
        .order_by(Question.order_index)
        .all()
    )

    results = []

    for question in questions:
        answer = (
            db.query(Answer)
            .filter(
                Answer.question_id == question.id
            )
            .order_by(Answer.created_at.desc())
            .first()
        )

        results.append(
            {
                "question_id": question.id,
                "order_index": question.order_index,
                "question": question.text,
                "answer": (
                    answer.transcript
                    if answer
                    else None
                ),
            }
        )

    evaluation = (
        db.query(Evaluation)
        .filter(
            Evaluation.interview_id
            == interview.id
        )
        .first()
    )

    return {
        "interview_id": interview.id,
        "candidate_email": (
            user.email if user else "Unknown"
        ),
        "job_title": (
            job.title if job else "Unknown"
        ),
        "status": interview.status,
        "started_at": interview.started_at,
        "ended_at": interview.ended_at,
        "questions": results,
        "evaluation": (
            {
                "overall_score": evaluation.overall_score,
                "passed": evaluation.passed,
                "feedback": evaluation.feedback,
            }
            if evaluation
            else None
        ),
    }


@router.post(
    "/interviews/{interview_id}/evaluate",
    response_model=HREvaluationResultResponse,
)
def evaluate_completed_interview(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_hr),
):
    interview = (
        db.query(Interview)
        .filter(
            Interview.id == interview_id
        )
        .first()
    )

    if not interview:
        raise HTTPException(
            status_code=404,
            detail="Interview not found.",
        )

    if interview.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only completed interviews "
                "can be evaluated."
            ),
        )

    try:
        evaluation = evaluate_interview(
            db=db,
            interview=interview,
        )
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"Evaluation failed: {error}",
        )

    return {
        "message": "Interview evaluated successfully.",
        "evaluation": {
            "overall_score": evaluation.overall_score,
            "passed": evaluation.passed,
            "feedback": evaluation.feedback,
        },
    }


@router.post(
    "/interviews/{interview_id}/email",
    response_model=CandidateEmailResponse,
)
def email_candidate_interview_result(
    interview_id: int,
    data: CandidateEmailRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_hr),
):
    interview = (
        db.query(Interview)
        .filter(Interview.id == interview_id)
        .first()
    )
    if not interview:
        raise HTTPException(
            status_code=404,
            detail="Interview not found.",
        )

    if interview.status != "completed":
        raise HTTPException(
            status_code=400,
            detail="Only completed interviews can receive an outcome email.",
        )

    evaluation = (
        db.query(Evaluation)
        .filter(Evaluation.interview_id == interview.id)
        .first()
    )
    if not evaluation:
        raise HTTPException(
            status_code=400,
            detail="Evaluate the interview before emailing its outcome.",
        )

    candidate = (
        db.query(User)
        .filter(User.id == interview.user_id)
        .first()
    )
    if not candidate:
        raise HTTPException(
            status_code=404,
            detail="Candidate account not found.",
        )

    try:
        send_candidate_email(
            recipient=candidate.email,
            subject=data.subject,
            body=data.body,
        )
    except EmailConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except EmailDeliveryError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    return {
        "message": "Candidate email sent successfully.",
        "recipient": candidate.email,
    }