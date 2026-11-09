import json
import math
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
SPOTS_FILE = DATA_DIR / "spots.json"
FAUNA_FILE = DATA_DIR / "fauna.json"
KELOMPOK_FILE = DATA_DIR / "kelompok.json"


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Hitung jarak antara dua koordinat GPS dalam satuan meter."""
    R = 6371000  # Radius bumi dalam meter
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


class RAGService:
    def __init__(self):
        self.reload_data()

    def reload_data(self):
        self.spots: List[Dict[str, Any]] = self._read_json(SPOTS_FILE)
        self.fauna: List[Dict[str, Any]] = self._read_json(FAUNA_FILE)
        self.kelompok: List[Dict[str, Any]] = self._read_json(KELOMPOK_FILE)
        self._build_documents()

    def _read_json(self, path: Path) -> List[Dict[str, Any]]:
        if not path.exists():
            return []
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    def _build_documents(self):
        """Siapkan potongan dokumen terstruktur untuk dicari."""
        self.docs: List[Dict[str, Any]] = []

        for s in self.spots:
            facilities_str = ", ".join(s.get("facilities", []))
            text = (
                f"Lokasi: {s.get('name')}. Kategori: {s.get('category')}. "
                f"Fasilitas: {facilities_str}. Deskripsi: {s.get('description', '')}"
            )
            self.docs.append({
                "type": "spot",
                "id": s.get("id"),
                "name": s.get("name"),
                "text": text,
                "lat": s.get("lat"),
                "lng": s.get("lng")
            })

        for f in self.fauna:
            text = (
                f"Satwa: {f.get('name')}. Kategori: {f.get('category')}. "
                f"Lokasi ID: {f.get('location_id')}. Deskripsi: {f.get('description', '')} "
                f"Fakta: {f.get('fun_fact', '')}"
            )
            self.docs.append({
                "type": "fauna",
                "id": f.get("id"),
                "name": f.get("name"),
                "text": text,
                "location_id": f.get("location_id")
            })

        for k in self.kelompok:
            # Sembunyikan kata kunci dari dokumen LLM (anti-bocor)
            text = (
                f"Pos {k.get('post_id')}: {k.get('name')}. Judul: {k.get('title')}. "
                f"Tantangan: {k.get('description')}. Panduan rute: {k.get('route_guide', '')}"
            )
            self.docs.append({
                "type": "kelompok",
                "id": f"post_{k.get('post_id')}",
                "name": k.get("name"),
                "text": text,
                "lat": k.get("lat"),
                "lng": k.get("lng")
            })

    def find_nearest_spot(
        self, user_lat: Optional[float], user_lng: Optional[float]
    ) -> Optional[Tuple[Dict[str, Any], float]]:
        if user_lat is None or user_lng is None:
            return None

        best_spot = None
        min_dist = float("inf")
        for s in self.spots:
            lat = s.get("lat")
            lng = s.get("lng")
            if lat is not None and lng is not None:
                dist = haversine_distance_meters(user_lat, user_lng, lat, lng)
                if dist < min_dist:
                    min_dist = dist
                    best_spot = s

        if best_spot:
            return best_spot, round(min_dist, 1)
        return None

    def retrieve_context(
        self, query: str, user_lat: Optional[float] = None, user_lng: Optional[float] = None, top_k: int = 4
    ) -> Tuple[str, str]:
        """
        Mengembalikan (blok_lokasi, blok_konteks) sesuai PRD 12.4
        """
        # 1. Bangun blok lokasi
        nearest = self.find_nearest_spot(user_lat, user_lng)
        if nearest:
            spot, dist = nearest
            location_block = f"<lokasi>\nspot_terdekat: {spot.get('name')} (jarak {dist} m)\n</lokasi>"
        else:
            location_block = "<lokasi>\ntidak tersedia\n</lokasi>"

        # 2. Ranking dokumen dengan BM25/keyword scoring sederhana
        q_tokens = set(query.lower().split())
        scored: List[Tuple[float, Dict[str, Any]]] = []

        for doc in self.docs:
            d_text = doc["text"].lower()
            # Hitung frekuensi kata query yang cocok
            matches = sum(1 for t in q_tokens if t in d_text)
            if matches > 0:
                scored.append((matches, doc))

        # Sort berdasarkan kecocokan tertinggi
        scored.sort(key=lambda x: x[0], reverse=True)
        top_docs = [doc for _, doc in scored[:top_k]]

        # Deteksi sapaan / obrolan umum tanpa kata kunci khusus
        general_tokens = {"halo", "hai", "kabar", "siapa", "pagi", "siang", "sore", "malam", "terima", "makasih", "ok", "oke", "siap"}
        is_general_query = any(t in general_tokens for t in q_tokens) and not top_docs

        if is_general_query:
            context_block = (
                "<konteks>\n"
                "[1] Nesa adalah AI pemandu wisata virtual resmi di kawasan Hutan UNESA Lidah Wetan, Surabaya.\n"
                "[2] Nesa dapat memberikan panduan rute 20 spot dan fasilitas, informasi 8 jenis satwa konservasi, dan memandu 6 pos tantangan petualangan.\n"
                "</konteks>"
            )
            return location_block, context_block

        # Fallback jika query tidak cocok dengan dokumen khusus: ambil spot terdekat jika ada
        if not top_docs and nearest:
            nearest_spot = nearest[0]
            top_docs = [d for d in self.docs if d.get("id") == nearest_spot.get("id")]

        if not top_docs:
            context_block = "<konteks>\n[1] Informasi spesifik tidak ditemukan di dataset Hutan UNESA.\n</konteks>"
            return location_block, context_block

        context_lines = []
        for i, d in enumerate(top_docs, 1):
            context_lines.append(f"[{i}] {d['text']}")

        context_block = "<konteks>\n" + "\n".join(context_lines) + "\n</konteks>"
        return location_block, context_block


rag_service = RAGService()
