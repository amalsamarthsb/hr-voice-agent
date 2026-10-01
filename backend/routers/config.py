from fastapi import APIRouter

from services.voice_provider import get_voice_provider


router = APIRouter(tags=["Configuration"])


@router.get("/config")
def get_public_config():
    return {"voice_provider": get_voice_provider()}
