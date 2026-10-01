from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
)

from sqlalchemy.orm import Session

from database import get_db
from models import Resume

from schemas import ResumeResponse

from services.auth_dependencies import (
    require_candidate,
)

from services.resume_service import (
    extract_resume_text,
)


router = APIRouter(
    prefix="/resumes",
    tags=["Resumes"],
)
candidate_router = APIRouter(
    prefix="/candidate",
    tags=["Candidate Resumes"],
)


@router.post(
    "/upload",
    response_model=ResumeResponse,
)
@candidate_router.post(
    "/resume",
    response_model=ResumeResponse,
)
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_candidate),
):

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Resume filename is missing.",
        )

    filename = file.filename.lower()

    if not (
        filename.endswith(".pdf")
        or filename.endswith(".docx")
    ):
        raise HTTPException(
            status_code=400,
            detail="Only PDF and DOCX resumes are supported.",
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded resume is empty.",
        )

    try:
        resume_text = extract_resume_text(
            file.filename,
            file_bytes,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    resume = Resume(
        user_id=current_user.id,
        filename=file.filename,
        resume_text=resume_text,
    )

    db.add(resume)
    db.commit()
    db.refresh(resume)

    return {
        "id": resume.id,
        "filename": resume.filename,
        "message": "Resume uploaded successfully.",
    }


@candidate_router.get(
    "/resumes",
    response_model=list[ResumeResponse],
)
def get_candidate_resumes(
    db: Session = Depends(get_db),
    current_user=Depends(require_candidate),
):
    return (
        db.query(Resume)
        .filter(Resume.user_id == current_user.id)
        .order_by(Resume.created_at.desc())
        .all()
    )