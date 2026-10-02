from sqlalchemy.orm import Session

from models import Interview, Job, Resume


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