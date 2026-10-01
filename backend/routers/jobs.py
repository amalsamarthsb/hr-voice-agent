from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import Job
from schemas import JobCreate, JobResponse
from services.auth_dependencies import require_candidate, require_hr

router = APIRouter(prefix="/jobs", tags=["Jobs"])
hr_jobs_router = APIRouter(prefix="/hr/jobs", tags=["HR Jobs"])


@router.get("/", response_model=list[JobResponse])
def get_jobs(
    db: Session = Depends(get_db),
    current_user=Depends(require_candidate),
):
    return db.query(Job).order_by(Job.created_at.desc()).all()


@router.get("/{job_id}", response_model=JobResponse)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_candidate),
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job


@hr_jobs_router.get("/", response_model=list[JobResponse])
def get_hr_jobs(
    db: Session = Depends(get_db),
    current_user=Depends(require_hr),
):
    return db.query(Job).order_by(Job.created_at.desc()).all()


@hr_jobs_router.post(
    "/",
    response_model=JobResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_hr_job(
    data: JobCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_hr),
):
    job = Job(
        title=data.title,
        description=data.description,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job
