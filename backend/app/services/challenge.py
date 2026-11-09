import json
import time
from pathlib import Path
from typing import Dict, Set, Optional, Tuple

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
KELOMPOK_FILE = DATA_DIR / "kelompok.json"


class ChallengeService:
    def __init__(self):
        self._load_posts()
        # session_id -> Set[post_id]
        self._completed_posts: Dict[str, Set[int]] = {}
        # (session_id, post_id) -> {"count": int, "locked_until": float}
        self._attempts: Dict[Tuple[str, int], Dict[str, float]] = {}

    def _load_posts(self):
        if KELOMPOK_FILE.exists():
            with open(KELOMPOK_FILE, "r", encoding="utf-8") as f:
                self.posts = json.load(f)
        else:
            self.posts = []
        # Map post_id -> normalized keyword
        self.keywords: Dict[int, str] = {
            p["post_id"]: str(p.get("keyword", "")).strip().upper()
            for p in self.posts
        }

    def get_progress(self, session_id: str) -> Dict[str, any]:
        completed = sorted(list(self._completed_posts.get(session_id, set())))
        total = len(self.posts)
        return {
            "session_id": session_id,
            "progress": len(completed),
            "total_posts": total,
            "completed_posts": completed,
            "is_all_completed": len(completed) >= total and total > 0
        }

    def validate_code(
        self, session_id: str, post_id: int, code: str
    ) -> Tuple[bool, str, int, bool]:
        """
        Returns: (success, message, current_progress, is_all_completed)
        """
        now = time.time()
        attempt_key = (session_id, post_id)
        attempt_info = self._attempts.get(attempt_key, {"count": 0, "locked_until": 0.0})

        # Cek cooldown 1 menit jika salah >= 5 kali
        if attempt_info["locked_until"] > now:
            remaining = int(attempt_info["locked_until"] - now)
            return (
                False,
                f"Terlalu banyak percobaan salah. Coba lagi dalam {remaining} detik.",
                len(self._completed_posts.get(session_id, set())),
                False
            )

        # Cek apakah pos sudah pernah selesai
        completed_set = self._completed_posts.setdefault(session_id, set())
        if post_id in completed_set:
            return (
                True,
                "Pos ini sudah kamu selesaikan sebelumnya!",
                len(completed_set),
                len(completed_set) >= len(self.posts)
            )

        # Cek ketersediaan pos
        expected_keyword = self.keywords.get(post_id)
        if not expected_keyword:
            return (
                False,
                "Pos tidak ditemukan di sistem.",
                len(completed_set),
                False
            )

        # Validasi kata kunci (case-insensitive & stripped)
        input_cleaned = (code or "").strip().upper()
        if input_cleaned == expected_keyword:
            # Berhasil
            completed_set.add(post_id)
            # Reset attempts
            self._attempts.pop(attempt_key, None)
            total = len(self.posts)
            is_all = len(completed_set) >= total
            msg = "Selamat! Jawabanmu benar. Pos berhasil diselesaikan."
            if is_all:
                msg = "Hebat! Semua 6 pos petualangan telah selesai kamu taklukkan!"
            return True, msg, len(completed_set), is_all
        else:
            # Salah
            new_count = attempt_info["count"] + 1
            locked_until = 0.0
            if new_count >= 5:
                locked_until = now + 60.0  # Cooldown 60 detik
                msg = "Kata kunci salah 5 kali. Silakan tunggu 1 menit sebelum mencoba lagi."
            else:
                remaining_tries = 5 - new_count
                msg = f"Kata kunci salah. Sisa kesempatan: {remaining_tries} kali."

            self._attempts[attempt_key] = {"count": new_count, "locked_until": locked_until}
            return False, msg, len(completed_set), False


challenge_service = ChallengeService()
