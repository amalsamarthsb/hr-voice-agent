from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database import get_db
from models import Answer, Interview, Job, Question, Resume
from schemas import VoiceTurnRequest
from services.auth_dependencies import require_candidate
from services.groq_interview_service import process_answer_turn
from services.groq_transcription_service import transcribe_audio
from services.voice_provider import get_voice_provider


router = APIRouter(prefix="/voice", tags=["Voice Interview"])
MAX_AUDIO_BYTES = 10 * 1024 * 1024


@router.post("/interviews/{interview_id}/transcribe")
def transcribe_candidate_answer(
    interview_id: int,
    question_id: int = Form(...),
    audio: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_candidate),
):
    if get_voice_provider() != "groq":
        raise HTTPException(
            status_code=409,
            detail="Audio transcription is only available in Groq voice mode.",
        )

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
    if interview.status not in {"ready", "in_progress"}:
        raise HTTPException(
            status_code=400,
            detail="Interview is not available.",
        )

    question = (
        db.query(Question)
        .filter(
            Question.id == question_id,
            Question.interview_id == interview.id,
        )
        .first()
    )
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found.")
    if audio.content_type != "audio/wav":
        raise HTTPException(
            status_code=415,
            detail="Recorded answers must be uploaded as WAV audio.",
        )

    audio_bytes = audio.file.read(MAX_AUDIO_BYTES + 1)
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Recorded audio is empty.")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Recorded answer is too large. Please record a shorter answer.",
        )

    try:
        transcript = transcribe_audio(audio_bytes, audio.content_type)
    except (RuntimeError, ValueError) as error:
        raise HTTPException(
            status_code=502,
            detail=f"Could not transcribe your answer: {error}",
        ) from error

    if not transcript:
        raise HTTPException(
            status_code=422,
            detail="No speech could be heard. Check your microphone and try again.",
        )
    return {"transcript": transcript}


@router.post("/interviews/{interview_id}/turn")
def process_groq_turn(
    interview_id: int,
    data: VoiceTurnRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_candidate),
):
    if get_voice_provider() != "groq":
        raise HTTPException(
            status_code=409,
            detail="Interview turns are handled by OpenAI Realtime in the current voice mode.",
        )

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
    if interview.status not in {"ready", "in_progress"}:
        raise HTTPException(
            status_code=400,
            detail="Interview is not available.",
        )

    question = (
        db.query(Question)
        .filter(
            Question.id == data.question_id,
            Question.interview_id == interview.id,
        )
        .first()
    )
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found.")

    answer = (
        db.query(Answer)
        .filter(Answer.question_id == question.id)
        .order_by(Answer.created_at.desc(), Answer.id.desc())
        .first()
    )
    if answer is None or not answer.transcript.strip():
        raise HTTPException(
            status_code=400,
            detail="Save a non-empty answer before requesting the next question.",
        )

    job = db.query(Job).filter(Job.id == interview.job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")

    resume = (
        db.query(Resume)
        .filter(Resume.id == interview.resume_id)
        .first()
        if interview.resume_id is not None
        else None
    )
    resume_text = interview.resume_text or (
        resume.resume_text if resume else ""
    )

    next_question = None
    next_question_row = None
    if data.next_question_id is not None:
        next_question_row = (
            db.query(Question)
            .filter(
                Question.id == data.next_question_id,
                Question.interview_id == interview.id,
                Question.order_index > question.order_index,
            )
            .first()
        )
        if next_question_row is None:
            raise HTTPException(
                status_code=400,
                detail="The next question does not belong to this interview.",
            )

    previous_rows = (
        db.query(Question, Answer.transcript)
        .outerjoin(Answer, Answer.question_id == Question.id)
        .filter(Question.interview_id == interview.id)
        .order_by(Question.order_index, Answer.created_at, Answer.id)
        .all()
    )
    conversation_by_question: dict[int, dict[str, str]] = {}
    for item, transcript in previous_rows:
        entry = conversation_by_question.setdefault(
            item.id,
            {"question": item.text, "answer": ""},
        )
        if transcript:
            entry["answer"] = transcript
    conversation = list(conversation_by_question.values())

    try:
        turn_result = process_answer_turn(
            question=question.text,
            answer=answer.transcript,
            resume_text=resume_text,
            job_title=job.title,
            job_description=job.description,
            conversation=conversation,
            has_next_question=next_question_row is not None,
        )
        answer.score = turn_result["score"]

        if next_question_row is not None:
            generated_question = turn_result["next_question"]
            if isinstance(generated_question, str) and generated_question.strip():
                next_question_row.text = generated_question.strip()
            next_question = next_question_row.text
    except (RuntimeError, ValueError) as error:
        db.rollback()
        raise HTTPException(
            status_code=502,
            detail=f"Groq could not process the interview answer: {error}",
        ) from error

    if interview.started_at is None:
        interview.started_at = datetime.now(timezone.utc)
    interview.status = "in_progress"
    db.commit()

    return {"next_question": next_question}
