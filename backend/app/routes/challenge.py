from fastapi import APIRouter, HTTPException
from backend.app.models.schemas import ValidateCodeRequest, ValidateCodeResponse
from backend.app.services.challenge import challenge_service

router = APIRouter(prefix="/api/challenge", tags=["Challenge"])


@router.post("/validate", response_model=ValidateCodeResponse)
def validate_pos_code(req: ValidateCodeRequest):
    """
    Memvalidasi kata kunci pos challenge pengunjung.
    Tanpa OTP, case-insensitive, batas salah 5 kali (cooldown 1 menit).
    """
    success, message, progress, is_completed = challenge_service.validate_code(
        session_id=req.session_id,
        post_id=req.post_id,
        code=req.code
    )
    return ValidateCodeResponse(
        success=success,
        post_id=req.post_id,
        message=message,
        progress=progress,
        total_posts=len(challenge_service.posts),
        completed=is_completed
    )


@router.get("/progress")
def get_session_progress(session_id: str):
    """Mengembalikan status kemajuan pos untuk session_id pengunjung."""
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id wajib disertakan")
    return challenge_service.get_progress(session_id)
