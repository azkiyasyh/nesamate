import time
import uuid
from typing import Dict, List
from fastapi import APIRouter, HTTPException, status

from backend.app.models.schemas import (
    SessionCreateRequest,
    SessionResponse,
    ChatRequest,
    ChatResponse,
    TTSRequest,
    TTSResponse
)
from backend.app.services.rag import rag_service
from backend.app.services.gemini import gemini_service
from backend.app.services.challenge import challenge_service

router = APIRouter(prefix="/api", tags=["Chat & Session"])

SESSION_TTL_SECONDS = 24 * 60 * 60  # 24 jam (PRD FR-25)
CHAT_RATE_LIMIT = 20  # Max 20 pesan per menit per sesi (PRD Bagian 7)

# Sesi pengunjung: session_id -> { "user_name": str, "created_at": float, "last_active": float, "mode": str }
ACTIVE_SESSIONS: Dict[str, Dict[str, any]] = {}

# Rate limit tracker: session_id -> List[float (timestamp)]
CHAT_TIMESTAMPS: Dict[str, List[float]] = {}


def _cleanup_expired_sessions():
    """Hapus sesi yang lebih dari 24 jam tidak aktif."""
    now = time.time()
    expired = [
        sid for sid, data in ACTIVE_SESSIONS.items()
        if now - data.get("last_active", data.get("created_at", now)) > SESSION_TTL_SECONDS
    ]
    for sid in expired:
        ACTIVE_SESSIONS.pop(sid, None)
        CHAT_TIMESTAMPS.pop(sid, None)


def _check_rate_limit(session_id: str):
    """Batas 20 pesan per menit per sesi."""
    now = time.time()
    window_start = now - 60.0
    timestamps = CHAT_TIMESTAMPS.setdefault(session_id, [])
    # Hapus timestamp di luar window 60 detik
    timestamps = [t for t in timestamps if t > window_start]
    if len(timestamps) >= CHAT_RATE_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Terlalu banyak pertanyaan. Mohon tunggu beberapa saat sebelum bertanya lagi."
        )
    timestamps.append(now)
    CHAT_TIMESTAMPS[session_id] = timestamps


@router.post("/session", response_model=SessionResponse)
def create_session(req: SessionCreateRequest):
    """Mendaftarkan nama panggilan pengunjung dan membuat session_id baru."""
    _cleanup_expired_sessions()
    clean_name = req.user_name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Nama panggilan tidak boleh kosong")

    session_id = str(uuid.uuid4())
    now = time.time()
    ACTIVE_SESSIONS[session_id] = {
        "user_name": clean_name,
        "created_at": now,
        "last_active": now,
        "mode": "none"
    }
    return SessionResponse(
        session_id=session_id,
        user_name=clean_name,
        created_at=now
    )


@router.post("/chat", response_model=ChatResponse)
def handle_chat(req: ChatRequest):
    """
    Endpoint utama tanya jawab dengan Nesa Virtual Guide:
    1. Validasi sesi dan rate limit per menit.
    2. Hitung lokasi terdekat (GPS Haversine) dan ambil konteks RAG dataset.
    3. Panggil Gemini (atau Fallback cerdas) untuk output JSON terstruktur.
    """
    _cleanup_expired_sessions()
    _check_rate_limit(req.session_id)

    session = ACTIVE_SESSIONS.get(req.session_id)
    if session:
        session["last_active"] = time.time()
        if req.mode != "none":
            session["mode"] = req.mode
        user_name = session["user_name"]
    else:
        user_name = "Teman"

    # Koordinat lokasi jika tersedia
    lat = req.location.lat if req.location else None
    lng = req.location.lng if req.location else None

    t_start = time.time()

    # 1. Ambil konteks lokasi dan RAG
    t_rag_0 = time.time()
    loc_block, ctx_block = rag_service.retrieve_context(
        query=req.message,
        user_lat=lat,
        user_lng=lng
    )
    rag_ms = round((time.time() - t_rag_0) * 1000, 1)

    # Ambil progress challenge jika sesi ada
    progress_data = challenge_service.get_progress(req.session_id)
    progress_info = f"{progress_data['progress']}/{progress_data['total_posts']} pos selesai"

    # Format riwayat percakapan (PRD L5)
    history = session.setdefault("history", []) if session else []
    history_lines = []
    for h in history[-6:]:
        prefix = "Pengguna" if h["role"] == "user" else "Nesa"
        history_lines.append(f"{prefix}: {h['text']}")
    history_block = "<riwayat>\n" + ("\n".join(history_lines) if history_lines else "belum ada percakapan sebelumnya") + "\n</riwayat>"

    # 2. Generate teks jawaban dari Gemini/Fallback
    t_llm_0 = time.time()
    result = gemini_service.generate_response(
        user_name=user_name,
        user_message=req.message,
        location_block=loc_block,
        context_block=ctx_block,
        mode=req.mode,
        progress_info=progress_info,
        history_block=history_block
    )
    llm_ms = round((time.time() - t_llm_0) * 1000, 1)

    # Simpan giliran ke riwayat sesi
    if session:
        history.append({"role": "user", "text": req.message})
        history.append({"role": "nesa", "text": result["speech"]})
        if len(history) > 10:
            session["history"] = history[-10:]

    # Audio generation dinonaktifkan (pakai browser voice langsung, latensi ultra-cepat)
    audio_url = None
    tts_ms = 0.0

    total_ms = round((time.time() - t_start) * 1000, 1)

    benchmarks = {
        "rag_ms": rag_ms,
        "llm_ms": llm_ms,
        "tts_ms": tts_ms,
        "total_ms": total_ms
    }
    print(f"[BENCHMARK CHAT] Total: {total_ms}ms | RAG: {rag_ms}ms | LLM: {llm_ms}ms | TTS: {tts_ms}ms")

    return ChatResponse(
        speech=result["speech"],
        emotion=result["emotion"],
        action=result["action"],
        action_payload=result["action_payload"],
        audio_url=audio_url,
        benchmarks=benchmarks
    )


@router.post("/tts", response_model=TTSResponse)
def text_to_speech(req: TTSRequest):
    """
    Sintesis suara Kore untuk teks apa pun (Greeting, tips mode, panduan rute).
    Mendukung cache instan untuk performa tinggi.
    """
    t0 = time.time()
    audio_url = gemini_service.generate_speech_audio(req.text)
    tts_ms = round((time.time() - t0) * 1000, 1)
    benchmarks = {"tts_ms": tts_ms}
    print(f"[BENCHMARK TTS] TTS: {tts_ms}ms | URL: {audio_url}")
    return TTSResponse(audio_url=audio_url, cached=bool(audio_url), benchmarks=benchmarks)
