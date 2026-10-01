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


app = FastAPI(
    title="HR Voice Agent API",
    version="1.0.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):517[3-9]$",
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