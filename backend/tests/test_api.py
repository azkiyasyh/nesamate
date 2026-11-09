import os
os.environ["TESTING"] = "1"

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_get_data_endpoints():
    # Spots
    r_spots = client.get("/api/spots")
    assert r_spots.status_code == 200
    assert len(r_spots.json()["spots"]) >= 20

    # Spot by ID
    r_spot1 = client.get("/api/spots/LOC001")
    assert r_spot1.status_code == 200
    assert r_spot1.json()["name"] == "Pusat Observasi Flora & Burung"

    r_spot_none = client.get("/api/spots/NOT_EXIST")
    assert r_spot_none.status_code == 404

    # Fauna
    r_fauna = client.get("/api/fauna")
    assert r_fauna.status_code == 200
    assert len(r_fauna.json()["fauna"]) >= 8

    # Fauna by ID
    r_fauna1 = client.get("/api/fauna/HWN001")
    assert r_fauna1.status_code == 200
    assert r_fauna1.json()["name"] == "Ayam"

    # Posts (safe: without keyword)
    r_posts = client.get("/api/posts")
    assert r_posts.status_code == 200
    posts = r_posts.json()["posts"]
    assert len(posts) == 6
    for p in posts:
        assert "keyword" not in p


def test_reindex_dataset():
    r_reindex = client.post("/api/admin/reindex")
    assert r_reindex.status_code == 200
    data = r_reindex.json()
    assert data["status"] == "success"
    assert data["counts"]["spots"] >= 20


def test_session_and_chat():
    # Buat session
    r_sess = client.post("/api/session", json={"user_name": "Azkiya"})
    assert r_sess.status_code == 200
    sess_data = r_sess.json()
    assert sess_data["user_name"] == "Azkiya"
    session_id = sess_data["session_id"]

    # Chat tanya hewan rusa
    r_chat = client.post("/api/chat", json={
        "session_id": session_id,
        "message": "Ada rusa di mana ya?",
        "location": {"lat": -7.3006, "lng": 112.6708},
        "mode": "free"
    })
    assert r_chat.status_code == 200
    chat_data = r_chat.json()
    assert "speech" in chat_data
    assert "rusa" in chat_data["speech"].lower()
    assert chat_data["emotion"] in ["happy", "neutral", "thinking", "confused"]

    # Chat tanya peta
    r_map = client.post("/api/chat", json={
        "session_id": session_id,
        "message": "Bisa tolong lihat peta?",
        "mode": "free"
    })
    assert r_map.status_code == 200
    assert r_map.json()["action"] == "show_map"


def test_chat_rate_limiter():
    r_sess = client.post("/api/session", json={"user_name": "Spammer"})
    session_id = r_sess.json()["session_id"]

    # Kirim 20 request chat (diperbolehkan)
    for _ in range(20):
        res = client.post("/api/chat", json={
            "session_id": session_id,
            "message": "Halo",
            "mode": "free"
        })
        assert res.status_code == 200

    # Request ke-21 dalam 1 menit harus ditolak dengan HTTP 429
    res_limit = client.post("/api/chat", json={
        "session_id": session_id,
        "message": "Halo lagi",
        "mode": "free"
    })
    assert res_limit.status_code == 429
    assert "terlalu banyak" in res_limit.json()["detail"].lower()


def test_challenge_validation_flow():
    session_id = "test-session-challenge-456"

    # Progress awal = 0
    r_prog = client.get(f"/api/challenge/progress?session_id={session_id}")
    assert r_prog.status_code == 200
    assert r_prog.json()["progress"] == 0

    # Validasi salah
    r_wrong = client.post("/api/challenge/validate", json={
        "session_id": session_id,
        "post_id": 1,
        "code": "SALAH_KODE"
    })
    assert r_wrong.status_code == 200
    assert r_wrong.json()["success"] is False
    assert "sisa kesempatan" in r_wrong.json()["message"].lower()

    # Validasi benar (pos 1 = NESA1)
    r_correct = client.post("/api/challenge/validate", json={
        "session_id": session_id,
        "post_id": 1,
        "code": "nesa1"  # test case-insensitive
    })
    assert r_correct.status_code == 200
    assert r_correct.json()["success"] is True
    assert r_correct.json()["progress"] == 1

    # Cek progress naik ke 1
    r_prog2 = client.get(f"/api/challenge/progress?session_id={session_id}")
    assert r_prog2.json()["progress"] == 1
    assert 1 in r_prog2.json()["completed_posts"]
