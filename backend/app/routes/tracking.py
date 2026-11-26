from fastapi import APIRouter, HTTPException

try:
    from backend.app.models.schemas import (
        FeedbackRequest,
        JoggingFinishRequest,
        JoggingStartRequest,
        LiveLocationRequest,
    )
    from backend.app.services.supabase_service import supabase_service
except ImportError:
    from app.models.schemas import (
        FeedbackRequest,
        JoggingFinishRequest,
        JoggingStartRequest,
        LiveLocationRequest,
    )
    from app.services.supabase_service import supabase_service

router = APIRouter(prefix="/api", tags=["Tracking"])


def _require_supabase():
    if not supabase_service.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Supabase belum dikonfigurasi (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
        )


@router.post("/live-location")
def update_live_location(req: LiveLocationRequest):
    """Upsert koordinat live pengunjung ke tabel live_locations."""
    _require_supabase()
    row = supabase_service.upsert_live_location(req.visitor_id, req.lat, req.lng)
    return {"success": True, "location": row}


@router.post("/jogging/start")
def start_jogging(req: JoggingStartRequest):
    """Mulai sesi jogging baru di tabel jogging_sessions."""
    _require_supabase()
    row = supabase_service.start_jogging_session(req.visitor_id)
    return {"success": True, "session": row}


@router.post("/jogging/finish")
def finish_jogging(req: JoggingFinishRequest):
    """Akhiri sesi jogging beserta jarak dan rute GeoJSON LineString."""
    _require_supabase()
    try:
        row = supabase_service.finish_jogging_session(req.session_id, req.distance_m, req.route)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err
    return {"success": True, "session": row}


@router.post("/feedback")
def submit_feedback(req: FeedbackRequest):
    """Simpan rating & komentar pengunjung terhadap pos."""
    _require_supabase()
    row = supabase_service.insert_feedback(req.visitor_id, req.post_id, req.rating, req.comment)
    return {"success": True, "feedback": row}
