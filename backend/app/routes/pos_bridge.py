import os
from typing import Optional
from urllib.parse import urlencode, urlparse, parse_qsl, urlunparse

from fastapi import APIRouter, Header, HTTPException

try:
    from backend.app.models.schemas import (
        AuthCheckEmailRequest,
        AuthLoginRequest,
        AuthRegisterRequest,
        CheckinRequest,
        CheckinResponse,
        PosEventRequest,
        PosEventResponse,
        PosVerifyRequest,
        PosVerifyResponse,
        VisitorCreateRequest,
        VisitorResponse,
    )
    from backend.app.services.rag import haversine_distance_meters
    from backend.app.services.supabase_service import supabase_service
except ImportError:
    from app.models.schemas import (
        AuthCheckEmailRequest,
        AuthLoginRequest,
        AuthRegisterRequest,
        CheckinRequest,
        CheckinResponse,
        PosEventRequest,
        PosEventResponse,
        PosVerifyRequest,
        PosVerifyResponse,
        VisitorCreateRequest,
        VisitorResponse,
    )
    from app.services.rag import haversine_distance_meters
    from app.services.supabase_service import supabase_service

router = APIRouter(prefix="/api", tags=["Pos Bridge"])


def _require_supabase():
    if not supabase_service.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Supabase belum dikonfigurasi (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
        )


def _authenticate_pos(x_pos_key: Optional[str]) -> int:
    _require_supabase()
    if not x_pos_key:
        raise HTTPException(status_code=401, detail="Header x-pos-key wajib disertakan.")

    key_hash = supabase_service.hash_api_key(x_pos_key)
    secret = supabase_service.get_post_secret_by_key_hash(key_hash)
    if not secret:
        raise HTTPException(status_code=401, detail="API key pos tidak valid.")
    return int(secret["post_id"])


def _append_token_query(external_url: Optional[str], token: str) -> Optional[str]:
    if not external_url:
        return None
    parsed = urlparse(external_url)
    query = dict(parse_qsl(parsed.query))
    query["t"] = token
    return urlunparse(parsed._replace(query=urlencode(query)))


@router.get("/config/public")
def get_public_config():
    """Mengembalikan konfigurasi publik Supabase (URL & Anon Key) untuk frontend."""
    return {
        "supabase_url": os.getenv("SUPABASE_URL", "").strip().rstrip("/"),
        "supabase_anon_key": os.getenv("SUPABASE_ANON_KEY", "").strip(),
    }


@router.post("/auth/check-email")
def check_auth_email(req: AuthCheckEmailRequest):
    """Periksa apakah email sudah terdaftar di Supabase Auth."""
    _require_supabase()
    clean_email = req.email.strip().lower()
    user = supabase_service.find_auth_user_by_email(clean_email)
    return {"email": clean_email, "registered": user is not None}


@router.post("/auth/register")
def register_auth_account(req: AuthRegisterRequest):
    """Daftarkan akun pengunjung baru memakai Gmail, nama panggilan, dan password."""
    _require_supabase()
    clean_email = req.email.strip().lower()
    if not clean_email.endswith("@gmail.com"):
        raise HTTPException(status_code=400, detail="Pendaftaran wajib menggunakan alamat Gmail (@gmail.com).")

    existing = supabase_service.find_auth_user_by_email(clean_email)
    if existing:
        raise HTTPException(status_code=409, detail="Email sudah terdaftar. Silakan langsung login.")

    user = supabase_service.create_auth_user(clean_email, req.password, req.nickname.strip())
    visitor = supabase_service.create_visitor(req.nickname.strip())
    return {
        "success": True,
        "user_id": user.get("id"),
        "email": clean_email,
        "nickname": req.nickname.strip(),
        "visitor_id": int(visitor["id"]),
    }


@router.post("/auth/login")
def login_auth_account(req: AuthLoginRequest):
    """Login via backend memakai SUPABASE_SERVICE_ROLE_KEY tanpa perlu Anon Key di frontend."""
    _require_supabase()
    clean_email = req.email.strip().lower()
    existing = supabase_service.find_auth_user_by_email(clean_email)
    if not existing:
        raise HTTPException(status_code=404, detail="Akun belum terdaftar.")

    try:
        session = supabase_service.sign_in_auth_user(clean_email, req.password)
    except ValueError as err:
        raise HTTPException(status_code=401, detail=str(err)) from err

    user = session.get("user") or existing
    meta = user.get("user_metadata") or {}
    nickname = (meta.get("nickname") or meta.get("full_name") or clean_email.split("@")[0]).strip()[:25]
    visitor = supabase_service.create_visitor(nickname)
    return {
        "success": True,
        "user_id": user.get("id"),
        "email": clean_email,
        "nickname": nickname,
        "visitor_id": int(visitor["id"]),
        "access_token": session.get("access_token"),
    }


@router.post("/visitors", response_model=VisitorResponse)
def create_visitor(req: VisitorCreateRequest):
    """Daftarkan pengunjung baru tanpa login dan kembalikan visitor_id."""
    _require_supabase()
    clean_name = (req.display_name or "").strip() or None
    row = supabase_service.create_visitor(clean_name)
    return VisitorResponse(
        visitor_id=int(row["id"]),
        display_name=row.get("display_name"),
        created_at=str(row["created_at"]),
    )


@router.post("/checkins", response_model=CheckinResponse)
def checkin_at_post(req: CheckinRequest):
    """
    Validasi kedatangan pengunjung (GPS atau QR) -> simpan check-in ->
    terbitkan token JWT berumur 5 menit dan redirect_url (?t=<token>).
    """
    _require_supabase()
    if not supabase_service.is_jwt_configured():
        raise HTTPException(status_code=503, detail="POS_JWT_SECRET belum dikonfigurasi.")

    visitor = supabase_service.get_visitor(req.visitor_id)
    if not visitor:
        raise HTTPException(status_code=404, detail="Pengunjung tidak ditemukan.")

    post = supabase_service.get_post(req.post_id)
    if not post:
        raise HTTPException(status_code=404, detail=f"Pos {req.post_id} tidak ditemukan di database.")

    if req.method == "gps":
        if req.lat is None or req.lng is None:
            raise HTTPException(status_code=400, detail="Koordinat lat dan lng wajib untuk metode GPS.")
        dist_m = haversine_distance_meters(req.lat, req.lng, float(post["lat"]), float(post["lng"]))
        radius_m = int(post.get("arrive_radius_m") or 30)
        if dist_m > radius_m:
            raise HTTPException(
                status_code=403,
                detail=f"Jarakmu masih {round(dist_m)}m dari pos (maksimal {radius_m}m).",
            )
    elif req.method == "qr":
        if not req.qr_token:
            raise HTTPException(status_code=400, detail="qr_token wajib untuk metode QR.")
        secret = supabase_service.get_post_secret(req.post_id)
        if not secret or req.qr_token.strip() != secret.get("qr_token"):
            raise HTTPException(status_code=403, detail="QR token pos tidak valid.")

    supabase_service.upsert_checkin(req.visitor_id, req.post_id, req.method)
    token = supabase_service.create_pos_token(
        req.visitor_id, req.post_id, ttl_seconds=300, email=req.email
    )
    redirect_url = _append_token_query(post.get("external_url"), token)

    return CheckinResponse(
        success=True,
        visitor_id=req.visitor_id,
        post_id=req.post_id,
        method=req.method,
        token=token,
        expires_in_seconds=300,
        redirect_url=redirect_url,
    )


@router.post("/pos/verify", response_model=PosVerifyResponse)
def verify_pos_token(req: PosVerifyRequest, x_pos_key: Optional[str] = Header(default=None)):
    """
    Dipanggil backend pos untuk memverifikasi tiket sementara (?t=<token>).
    Memeriksa header x-pos-key, tanda tangan JWT, masa berlaku, kecocokan post_id, dan check-in.
    """
    pos_id = _authenticate_pos(x_pos_key)

    try:
        claims = supabase_service.verify_pos_token(req.token)
    except ValueError as err:
        raise HTTPException(status_code=401, detail=str(err)) from err

    token_post_id = int(claims.get("post_id", -1))
    visitor_id = int(claims.get("visitor_id", -1))
    if token_post_id != pos_id:
        raise HTTPException(status_code=403, detail="Token bukan untuk pos ini.")

    checkin = supabase_service.get_checkin(visitor_id, pos_id)
    if not checkin:
        raise HTTPException(status_code=403, detail="Pengunjung belum melakukan check-in di pos ini.")

    visitor = supabase_service.get_visitor(visitor_id)
    if not visitor:
        raise HTTPException(status_code=404, detail="Data pengunjung tidak ditemukan.")

    return PosVerifyResponse(
        valid=True,
        visitor_id=visitor_id,
        post_id=pos_id,
        display_name=visitor.get("display_name"),
        email=claims.get("email"),
    )


@router.post("/pos/event", response_model=PosEventResponse)
def ingest_pos_event(req: PosEventRequest, x_pos_key: Optional[str] = Header(default=None)):
    """
    Dipanggil backend pos untuk melaporkan event (started, completed, dll) ke pos_events.
    Idempoten berdasarkan pasangan unik (post_id, event_id).
    """
    pos_id = _authenticate_pos(x_pos_key)

    visitor = supabase_service.get_visitor(req.visitor_id)
    if not visitor:
        raise HTTPException(status_code=404, detail="Pengunjung tidak ditemukan.")

    res = supabase_service.insert_pos_event(
        post_id=pos_id,
        visitor_id=req.visitor_id,
        event_id=req.event_id.strip(),
        event_type=req.event_type.strip(),
        score=req.score,
        duration_s=req.duration_s,
        payload=req.payload,
    )
    return PosEventResponse(
        success=True,
        post_id=pos_id,
        visitor_id=req.visitor_id,
        event_id=req.event_id.strip(),
        event_type=req.event_type.strip(),
        duplicate=not res["inserted"],
    )
