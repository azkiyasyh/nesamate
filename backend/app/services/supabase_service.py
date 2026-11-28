import base64
import hashlib
import hmac
import json
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")
load_dotenv()


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


class SupabaseService:
    """Klien REST Supabase (service_role) + penandatangan JWT & SHA-256 API key pos."""

    def __init__(self):
        self.url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
        self.service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        self.jwt_secret = os.getenv("POS_JWT_SECRET", "").strip()
        self._client = httpx.Client(timeout=10.0)

    def is_configured(self) -> bool:
        return bool(self.url and self.service_key)

    def is_jwt_configured(self) -> bool:
        return bool(self.jwt_secret)

    def _headers(self, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json",
        }
        if extra:
            headers.update(extra)
        return headers

    def _request(
        self,
        method: str,
        table: str,
        params: Optional[Dict[str, str]] = None,
        json_body: Optional[Any] = None,
        extra_headers: Optional[Dict[str, str]] = None,
    ) -> Any:
        if not self.is_configured():
            raise RuntimeError("SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diset.")

        endpoint = f"{self.url}/rest/v1/{table}"
        resp = self._client.request(
            method=method,
            url=endpoint,
            params=params,
            json=json_body,
            headers=self._headers(extra_headers),
        )
        if resp.status_code >= 400:
            raise RuntimeError(f"Supabase error {resp.status_code}: {resp.text}")
        if not resp.text:
            return None
        return resp.json()

    # ------------------------------------------------------------------
    # Keamanan: SHA-256 API Key & JWT 5 Menit
    # ------------------------------------------------------------------

    @staticmethod
    def hash_api_key(raw_key: str) -> str:
        return hashlib.sha256((raw_key or "").strip().encode("utf-8")).hexdigest()

    def create_pos_token(
        self,
        visitor_id: int,
        post_id: int,
        ttl_seconds: int = 300,
        email: Optional[str] = None,
    ) -> str:
        if not self.jwt_secret:
            raise RuntimeError("POS_JWT_SECRET belum diset.")

        now = int(time.time())
        header = {"alg": "HS256", "typ": "JWT"}
        payload = {
            "visitor_id": int(visitor_id),
            "post_id": int(post_id),
            "iat": now,
            "exp": now + int(ttl_seconds),
        }
        if email:
            payload["email"] = email.strip().lower()
        h_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
        p_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
        signing_input = f"{h_b64}.{p_b64}".encode("ascii")
        sig = hmac.new(self.jwt_secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
        return f"{h_b64}.{p_b64}.{_b64url_encode(sig)}"

    def verify_pos_token(self, token: str) -> Dict[str, Any]:
        if not self.jwt_secret:
            raise RuntimeError("POS_JWT_SECRET belum diset.")
        parts = (token or "").strip().split(".")
        if len(parts) != 3:
            raise ValueError("Format token tidak valid.")

        h_b64, p_b64, sig_b64 = parts
        signing_input = f"{h_b64}.{p_b64}".encode("ascii")
        expected_sig = hmac.new(self.jwt_secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
        try:
            actual_sig = _b64url_decode(sig_b64)
        except Exception as err:
            raise ValueError("Tanda tangan token rusak.") from err

        if not hmac.compare_digest(expected_sig, actual_sig):
            raise ValueError("Tanda tangan token tidak cocok.")

        try:
            payload = json.loads(_b64url_decode(p_b64).decode("utf-8"))
        except Exception as err:
            raise ValueError("Payload token rusak.") from err

        exp = payload.get("exp")
        if not isinstance(exp, (int, float)) or int(time.time()) > int(exp):
            raise ValueError("Token sudah kedaluwarsa.")

        return payload

    # ------------------------------------------------------------------
    # Operasi Tabel Pusat
    # ------------------------------------------------------------------

    def create_visitor(self, display_name: Optional[str] = None) -> Dict[str, Any]:
        rows = self._request(
            "POST",
            "visitors",
            json_body={"display_name": display_name},
            extra_headers={"Prefer": "return=representation"},
        )
        return rows[0]

    def get_visitor(self, visitor_id: int) -> Optional[Dict[str, Any]]:
        rows = self._request(
            "GET",
            "visitors",
            params={"id": f"eq.{int(visitor_id)}", "select": "id,display_name,created_at", "limit": "1"},
        )
        return rows[0] if rows else None

    def get_post(self, post_id: int) -> Optional[Dict[str, Any]]:
        rows = self._request(
            "GET",
            "posts",
            params={"id": f"eq.{int(post_id)}", "select": "*", "limit": "1"},
        )
        return rows[0] if rows else None

    def get_post_secret(self, post_id: int) -> Optional[Dict[str, Any]]:
        rows = self._request(
            "GET",
            "post_secrets",
            params={"post_id": f"eq.{int(post_id)}", "select": "post_id,api_key_hash,qr_token", "limit": "1"},
        )
        return rows[0] if rows else None

    def get_post_secret_by_key_hash(self, api_key_hash: str) -> Optional[Dict[str, Any]]:
        rows = self._request(
            "GET",
            "post_secrets",
            params={"api_key_hash": f"eq.{api_key_hash}", "select": "post_id,api_key_hash", "limit": "1"},
        )
        return rows[0] if rows else None

    def upsert_checkin(self, visitor_id: int, post_id: int, method: str) -> Dict[str, Any]:
        rows = self._request(
            "POST",
            "checkins",
            params={"on_conflict": "visitor_id,post_id"},
            json_body={"visitor_id": int(visitor_id), "post_id": int(post_id), "method": method},
            extra_headers={"Prefer": "resolution=merge-duplicates,return=representation"},
        )
        return rows[0]

    def get_checkin(self, visitor_id: int, post_id: int) -> Optional[Dict[str, Any]]:
        rows = self._request(
            "GET",
            "checkins",
            params={
                "visitor_id": f"eq.{int(visitor_id)}",
                "post_id": f"eq.{int(post_id)}",
                "select": "id,visitor_id,post_id,method,created_at",
                "limit": "1",
            },
        )
        return rows[0] if rows else None

    def insert_pos_event(
        self,
        post_id: int,
        visitor_id: int,
        event_id: str,
        event_type: str,
        score: Optional[float] = None,
        duration_s: Optional[int] = None,
        payload: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        body: Dict[str, Any] = {
            "post_id": int(post_id),
            "visitor_id": int(visitor_id),
            "event_id": event_id,
            "event_type": event_type,
        }
        if score is not None:
            body["score"] = score
        if duration_s is not None:
            body["duration_s"] = int(duration_s)
        if payload is not None:
            body["payload"] = payload

        rows: List[Dict[str, Any]] = self._request(
            "POST",
            "pos_events",
            params={"on_conflict": "post_id,event_id"},
            json_body=body,
            extra_headers={"Prefer": "resolution=ignore-duplicates,return=representation"},
        )
        return {"inserted": len(rows) > 0, "event": rows[0] if rows else None}

    def upsert_live_location(self, visitor_id: int, lat: float, lng: float) -> Dict[str, Any]:
        from datetime import datetime, timezone

        rows = self._request(
            "POST",
            "live_locations",
            params={"on_conflict": "visitor_id"},
            json_body={
                "visitor_id": int(visitor_id),
                "lat": float(lat),
                "lng": float(lng),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            extra_headers={"Prefer": "resolution=merge-duplicates,return=representation"},
        )
        return rows[0]

    def start_jogging_session(self, visitor_id: int) -> Dict[str, Any]:
        rows = self._request(
            "POST",
            "jogging_sessions",
            json_body={"visitor_id": int(visitor_id)},
            extra_headers={"Prefer": "return=representation"},
        )
        return rows[0]

    def finish_jogging_session(
        self, session_id: int, distance_m: float, route: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        from datetime import datetime, timezone

        body: Dict[str, Any] = {
            "ended_at": datetime.now(timezone.utc).isoformat(),
            "distance_m": float(distance_m),
        }
        if route is not None:
            body["route"] = route

        rows = self._request(
            "PATCH",
            "jogging_sessions",
            params={"id": f"eq.{int(session_id)}"},
            json_body=body,
            extra_headers={"Prefer": "return=representation"},
        )
        if not rows:
            raise ValueError("Sesi jogging tidak ditemukan.")
        return rows[0]

    def insert_feedback(
        self, visitor_id: int, post_id: int, rating: int, comment: Optional[str] = None
    ) -> Dict[str, Any]:
        rows = self._request(
            "POST",
            "feedback",
            json_body={
                "visitor_id": int(visitor_id),
                "post_id": int(post_id),
                "rating": int(rating),
                "comment": comment,
            },
            extra_headers={"Prefer": "return=representation"},
        )
        return rows[0]

    # ------------------------------------------------------------------
    # Supabase Auth Admin (Cek Email & Daftar Akun Gmail)
    # ------------------------------------------------------------------

    def find_auth_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        if not self.is_configured():
            raise RuntimeError("SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diset.")
        clean_email = (email or "").strip().lower()
        resp = self._client.get(
            f"{self.url}/auth/v1/admin/users",
            params={"page": "1", "per_page": "50", "filter": clean_email},
            headers=self._headers(),
        )
        if resp.status_code >= 400:
            raise RuntimeError(f"Supabase Auth error {resp.status_code}: {resp.text}")
        users = (resp.json() or {}).get("users") or []
        for u in users:
            if (u.get("email") or "").strip().lower() == clean_email:
                return u
        return None

    def create_auth_user(self, email: str, password: str, nickname: str) -> Dict[str, Any]:
        if not self.is_configured():
            raise RuntimeError("SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diset.")
        clean_email = (email or "").strip().lower()
        clean_nick = (nickname or "").strip()
        resp = self._client.post(
            f"{self.url}/auth/v1/admin/users",
            json={
                "email": clean_email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {"nickname": clean_nick, "full_name": clean_nick},
            },
            headers=self._headers(),
        )
        if resp.status_code >= 400:
            raise RuntimeError(f"Gagal mendaftar akun ({resp.status_code}): {resp.text}")
        return resp.json()

    def sign_in_auth_user(self, email: str, password: str) -> Dict[str, Any]:
        if not self.is_configured():
            raise RuntimeError("SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diset.")
        clean_email = (email or "").strip().lower()
        resp = self._client.post(
            f"{self.url}/auth/v1/token",
            params={"grant_type": "password"},
            json={"email": clean_email, "password": password},
            headers=self._headers(),
        )
        if resp.status_code >= 400:
            raise ValueError("Password salah atau akun belum valid.")
        return resp.json()


supabase_service = SupabaseService()
