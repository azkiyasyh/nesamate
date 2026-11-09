from fastapi import APIRouter, HTTPException
from backend.app.services.rag import rag_service

router = APIRouter(prefix="/api", tags=["Data"])


@router.get("/spots")
def get_spots():
    """Mengembalikan daftar 20 titik spot dan fasilitas Hutan UNESA."""
    return {"spots": rag_service.spots, "total": len(rag_service.spots)}


@router.get("/spots/{spot_id}")
def get_spot_detail(spot_id: str):
    """Mengembalikan detail lengkap satu spot berdasarkan ID untuk Dynamic UI Panel."""
    clean_id = spot_id.strip().upper()
    for s in rag_service.spots:
        if s.get("id", "").upper() == clean_id:
            return s
    raise HTTPException(status_code=404, detail=f"Spot dengan ID {spot_id} tidak ditemukan")


@router.get("/fauna")
def get_fauna():
    """Mengembalikan daftar data satwa Hutan UNESA."""
    return {"fauna": rag_service.fauna, "total": len(rag_service.fauna)}


@router.get("/fauna/{fauna_id}")
def get_fauna_detail(fauna_id: str):
    """Mengembalikan detail lengkap satu satwa berdasarkan ID."""
    clean_id = fauna_id.strip().upper()
    for f in rag_service.fauna:
        if f.get("id", "").upper() == clean_id:
            return f
    raise HTTPException(status_code=404, detail=f"Satwa dengan ID {fauna_id} tidak ditemukan")


@router.get("/posts")
def get_posts():
    """
    Mengembalikan daftar pos challenge (kata kunci disembunyikan untuk keamanan).
    """
    safe_posts = []
    for p in rag_service.kelompok:
        p_copy = dict(p)
        p_copy.pop("keyword", None)  # Sembunyikan kata kunci dari frontend
        safe_posts.append(p_copy)
    return {"posts": safe_posts, "total": len(safe_posts)}


@router.post("/admin/reindex")
def reindex_dataset():
    """
    Reload dataset (spots.json, fauna.json, kelompok.json) langsung ke memori RAG
    tanpa perlu melakukan restart server (PRD Bagian 6).
    """
    rag_service.reload_data()
    return {
        "status": "success",
        "message": "Dataset berhasil di-reindex ulang.",
        "counts": {
            "spots": len(rag_service.spots),
            "fauna": len(rag_service.fauna),
            "kelompok": len(rag_service.kelompok),
            "documents": len(rag_service.docs)
        }
    }
