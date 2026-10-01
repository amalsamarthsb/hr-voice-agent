from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Answer, Interview, Question, User
from schemas import AnswerCreate
from services.auth_dependencies import require_candidate

router = APIRouter(tags=["Interview Answers"])


def _save_answer(
    interview_id: int,
    data: AnswerCreate,
    db: Session,
    current_user: User,
):
    interview = (
        db.query(Interview)
        .filter(
            Interview.id == interview_id,
            Interview.user_id == current_user.id,
        )
        .first()
    )
    if interview is None:
        raise HTTPException(status_code=404, detail="Interview not found.")

    question = (
        db.query(Question)
        .filter(
            Question.id == data.question_id,
            Question.interview_id == interview_id,
        )
        .first()
    )
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found.")

    transcript = data.transcript.strip()
    if not transcript:
        raise HTTPException(
            status_code=400,
            detail="Transcript cannot be empty.",
        )

    answer = Answer(question_id=question.id, transcript=transcript)
    db.add(answer)
    interview.status = "in_progress"
    db.commit()
    db.refresh(answer)
    return {"message": "Answer saved.", "answer_id": answer.id}


@router.post("/answers/interviews/{interview_id}")
def save_answer(
    interview_id: int,
    data: AnswerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_candidate),
):
    return _save_answer(interview_id, data, db, current_user)


@router.post("/interviews/answer")
def save_answer_from_frontend(
    data: AnswerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_candidate),
):
    if data.interview_id is None:
        raise HTTPException(
            status_code=422,
            detail="interview_id is required.",
        )
    return _save_answer(data.interview_id, data, db, current_user)
