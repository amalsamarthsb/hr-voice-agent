from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator


class UserRegister(BaseModel):
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    role: str


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str] = None


class JobCreate(BaseModel):
    title: str
    description: str

    @field_validator("title", "description")
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("This field cannot be blank.")
        return cleaned


class ResumeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    message: Optional[str] = None


class InterviewCreate(BaseModel):
    job_id: int
    resume_id: int


class InterviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_id: int
    resume_id: Optional[int] = None
    status: str


class CandidateInterviewResponse(BaseModel):
    id: int
    job_id: int
    resume_id: Optional[int] = None
    status: str
    passed: Optional[bool] = None


class QuestionResponse(BaseModel):
    id: int
    question: str


class AnswerCreate(BaseModel):
    interview_id: Optional[int] = None
    question_id: int
    transcript: str


class RealtimeOffer(BaseModel):
    sdp: str


class VoiceTurnRequest(BaseModel):
    question_id: int
    next_question_id: Optional[int] = None


class HRInterviewResponse(BaseModel):
    interview_id: int
    candidate_email: str
    job_title: str
    status: str
    created_at: Optional[datetime] = None
    overall_score: Optional[float] = None
    passed: Optional[bool] = None
    feedback: Optional[str] = None


class HRQuestionAnswerResponse(BaseModel):
    question_id: int
    order_index: int
    question: str
    answer: Optional[str] = None


class HREvaluationResponse(BaseModel):
    overall_score: float
    passed: bool
    feedback: Optional[str] = None


class HRInterviewDetailResponse(BaseModel):
    interview_id: int
    candidate_email: str
    job_title: str
    status: str
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    questions: list[HRQuestionAnswerResponse]
    evaluation: Optional[HREvaluationResponse] = None


class HREvaluationResultResponse(BaseModel):
    message: str
    evaluation: HREvaluationResponse


class CandidateEmailRequest(BaseModel):
    subject: str
    body: str

    @field_validator("subject", "body")
    @classmethod
    def reject_blank_email_content(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("This field cannot be blank.")
        return cleaned

    @field_validator("subject")
    @classmethod
    def reject_subject_newlines(cls, value: str) -> str:
        if "\r" in value or "\n" in value:
            raise ValueError("Email subject must be a single line.")
        if len(value) > 255:
            raise ValueError("Email subject must be 255 characters or fewer.")
        return value

    @field_validator("body")
    @classmethod
    def limit_email_body(cls, value: str) -> str:
        if len(value) > 10000:
            raise ValueError("Email body must be 10,000 characters or fewer.")
        return value


class CandidateEmailResponse(BaseModel):
    message: str
    recipient: EmailStr
