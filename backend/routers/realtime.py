from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Interview, Question
from schemas import RealtimeOffer
from services.auth_dependencies import require_candidate
from services.realtime_service import create_realtime_call
from services.voice_provider import get_voice_provider

router = APIRouter(
    prefix="/realtime",
    tags=["Realtime Interview"],
)


@router.post("/interviews/{interview_id}/connect")
async def connect_realtime_interview(
    interview_id: int,
    offer: RealtimeOffer,
    db: Session = Depends(get_db),
    current_user=Depends(require_candidate),
):
    if get_voice_provider() != "openai":
        raise HTTPException(
            status_code=409,
            detail="OpenAI Realtime is disabled. Set VOICE_PROVIDER=openai to use it.",
        )

    user_id = current_user.id

    interview = (
        db.query(Interview)
        .filter(
            Interview.id == interview_id,
            Interview.user_id == user_id,
        )
        .first()
    )

    if not interview:
        raise HTTPException(
            status_code=404,
            detail="Interview not found.",
        )

    if interview.status not in {"ready", "in_progress"}:
        raise HTTPException(
            status_code=400,
            detail="Interview is not available.",
        )

    questions = (
        db.query(Question)
        .filter(
            Question.interview_id == interview.id
        )
        .order_by(Question.order_index)
        .all()
    )

    if not questions:
        raise HTTPException(
            status_code=400,
            detail="No interview questions found.",
        )

    try:
        answer_sdp = await create_realtime_call(
            sdp_offer=offer.sdp,
            interview=interview,
            questions=questions,
        )
    except RuntimeError as error:
        raise HTTPException(
            status_code=502,
            detail=str(error),
        )

    if interview.started_at is None:
        interview.started_at = datetime.now(timezone.utc)

    interview.status = "in_progress"

    db.commit()

    return {
        "sdp": answer_sdp,
    }