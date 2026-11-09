from typing import Literal, Optional, Any, Dict
from pydantic import BaseModel, Field


class SessionCreateRequest(BaseModel):
    user_name: str = Field(..., min_length=1, max_length=20)


class SessionResponse(BaseModel):
    session_id: str
    user_name: str
    created_at: float


class ChatLocation(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None


class ChatRequest(BaseModel):
    session_id: str
    message: str = Field(..., max_length=300)
    location: Optional[ChatLocation] = None
    mode: Literal["free", "challenge", "none"] = "none"


class LLMActionPayload(BaseModel):
    spot_id: Optional[str] = None
    post_id: Optional[int] = None
    extra: Optional[Dict[str, Any]] = None


class ChatResponse(BaseModel):
    speech: str
    emotion: Literal["happy", "neutral", "thinking", "confused"] = "neutral"
    action: Literal[
        "none",
        "show_map",
        "show_spot_detail",
        "show_chart",
        "start_challenge",
        "open_free_mode"
    ] = "none"
    action_payload: Optional[Dict[str, Any]] = None
    audio_url: Optional[str] = None
    benchmarks: Optional[Dict[str, float]] = None


class AdminCodeGenerateRequest(BaseModel):
    admin_pin: str
    post_id: int = Field(..., ge=1, le=6)


class AdminCodeResponse(BaseModel):
    post_id: int
    code: str
    expires_in_seconds: int = 120


class ValidateCodeRequest(BaseModel):
    session_id: str
    post_id: int = Field(..., ge=1, le=6)
    code: str = Field(..., min_length=4, max_length=10)
    user_lat: Optional[float] = None
    user_lng: Optional[float] = None


class ValidateCodeResponse(BaseModel):
    success: bool
    post_id: int
    message: str
    progress: int
    total_posts: int = 6
    completed: bool = False


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)


class TTSResponse(BaseModel):
    audio_url: Optional[str] = None
    cached: bool = False
    benchmarks: Optional[Dict[str, float]] = None
