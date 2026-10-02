import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import (
    auth,
    jobs,
    resumes,
    interviews,
    answers,
    realtime,
    hr,
    config,
    voice,
)
from routers.resumes import candidate_router
from routers.jobs import hr_jobs_router

load_dotenv()

app = FastAPI(
    title="HR Voice Agent API",
    version="1.0.0"
)

local_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
frontend_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv("FRONTEND_URL", "").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=local_origins + frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)
app.include_router(jobs.router)
app.include_router(hr_jobs_router)
app.include_router(resumes.router)
app.include_router(candidate_router)
app.include_router(interviews.router)
app.include_router(answers.router)
app.include_router(realtime.router)
app.include_router(hr.router)
app.include_router(config.router)
app.include_router(voice.router)


@app.get("/")
def home():

    return {
        "message": "HR Voice Agent is running"
    }


@app.get("/health")
def health():
    return {"status": "ok"}