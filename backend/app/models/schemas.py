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
        "navigate_to_spot",
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


class VisitorCreateRequest(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=60)


class VisitorResponse(BaseModel):
    visitor_id: int
    display_name: Optional[str] = None
    created_at: str


class CheckinRequest(BaseModel):
    visitor_id: int = Field(..., ge=1)
    post_id: int = Field(..., ge=1)
    method: Literal["gps", "qr", "manual"] = "gps"
    lat: Optional[float] = None
    lng: Optional[float] = None
    qr_token: Optional[str] = None
    email: Optional[str] = Field(default=None, max_length=120)


class CheckinResponse(BaseModel):
    success: bool
    visitor_id: int
    post_id: int
    method: str
    token: str
    expires_in_seconds: int = 300
    redirect_url: Optional[str] = None


class PosVerifyRequest(BaseModel):
    token: str = Field(..., min_length=10)


class PosVerifyResponse(BaseModel):
    valid: bool
    visitor_id: int
    post_id: int
    display_name: Optional[str] = None
    email: Optional[str] = None


class PosEventRequest(BaseModel):
    visitor_id: int = Field(..., ge=1)
    event_id: str = Field(..., min_length=1, max_length=120)
    event_type: str = Field(..., min_length=1, max_length=60)
    score: Optional[float] = None
    duration_s: Optional[int] = Field(default=None, ge=0)
    payload: Optional[Dict[str, Any]] = None


class PosEventResponse(BaseModel):
    success: bool
    post_id: int
    visitor_id: int
    event_id: str
    event_type: str
    duplicate: bool = False


class LiveLocationRequest(BaseModel):
    visitor_id: int = Field(..., ge=1)
    lat: float
    lng: float


class JoggingStartRequest(BaseModel):
    visitor_id: int = Field(..., ge=1)


class JoggingFinishRequest(BaseModel):
    session_id: int = Field(..., ge=1)
    distance_m: float = Field(..., ge=0)
    route: Optional[Dict[str, Any]] = None


class FeedbackRequest(BaseModel):
    visitor_id: int = Field(..., ge=1)
    post_id: int = Field(..., ge=1)
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=500)


class AuthCheckEmailRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=120)


class AuthRegisterRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=120)
    nickname: str = Field(..., min_length=1, max_length=25)
    password: str = Field(..., min_length=6, max_length=100)


class AuthLoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=120)
    password: str = Field(..., min_length=1, max_length=100)
