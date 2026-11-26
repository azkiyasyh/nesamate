import os
import json
import re
import concurrent.futures
from pathlib import Path
from typing import Dict, Any, Optional

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")
load_dotenv()
PROMPT_FILE = BASE_DIR.parent / "docs" / "prompts" / "nesa_system_v1.txt"
if not PROMPT_FILE.exists():
    # Fallback path if docs is at root
    PROMPT_FILE = BASE_DIR / "docs" / "prompts" / "nesa_system_v1.txt"


class GeminiService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "").strip()
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest").strip() or "gemini-flash-lite-latest"
        self._load_system_prompt()
        self.client = None
        self.init_error: Optional[str] = None
        self.last_error: Optional[str] = None
        self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=4)

        if not self.api_key:
            self.init_error = "GEMINI_API_KEY tidak ditemukan di environment"
        elif self.api_key.startswith("your_"):
            self.init_error = "GEMINI_API_KEY masih menggunakan placeholder"
        else:
            try:
                from google import genai
                self.client = genai.Client(api_key=self.api_key)
            except Exception as e:
                self.init_error = str(e)
                print(f"[GeminiService] Gagal inisialisasi Gemini Client: {e}")
                self.client = None

    def _load_system_prompt(self):
        if PROMPT_FILE.exists():
            with open(PROMPT_FILE, "r", encoding="utf-8") as f:
                self.system_prompt_template = f.read()
        else:
            self.system_prompt_template = (
                "Kamu adalah Nesa, pemandu wisata virtual ramah di Hutan UNESA Lidah Wetan. "
                "Jawab singkat, santai, dan hanya berdasarkan konteks yang diberikan. "
                "Format output harus JSON valid dengan kunci speech, emotion, action, action_payload."
            )

    def generate_response(
        self,
        user_name: str,
        user_message: str,
        location_block: str,
        context_block: str,
        mode: str = "none",
        progress_info: str = "0/6 pos selesai",
        history_block: str = "<riwayat>\nbelum ada percakapan\n</riwayat>"
    ) -> Dict[str, Any]:
        """
        Menyusun prompt berlapis L1-L6 dan memanggil Gemini API atau fallback.
        """
        # Reload prompt agar update nesa_system_v1.txt langsung aktif
        self._load_system_prompt()

        # 1. Bersihkan & potong input user (max 300 karakter)
        clean_input = (user_message or "").strip()[:300]

        # 2. Jika mode testing atau tidak ada client, gunakan Smart Fallback
        if os.getenv("ENVIRONMENT") == "test" or os.getenv("TESTING") == "1" or not self.client:
            return self._smart_fallback(user_name, clean_input, location_block, context_block, mode)

        # 3. Rakit prompt berlapis
        system_prompt = self.system_prompt_template.replace("{{nama}}", user_name)

        session_block = (
            f"<sesi>\n"
            f"nama: {user_name}\n"
            f"mode: {mode}\n"
            f"progress: {progress_info}\n"
            f"</sesi>"
        )

        full_prompt = (
            f"{system_prompt}\n\n"
            f"{session_block}\n"
            f"{history_block}\n"
            f"{location_block}\n"
            f"{context_block}\n"
            f"<pesan_pengguna>\n{clean_input}\n</pesan_pengguna>\n"
        )

        candidate_models = []
        for m in (self.model_name, "gemini-flash-lite-latest", "gemini-2.5-flash-lite"):
            if m and m not in candidate_models:
                candidate_models.append(m)

        import time
        deadline = time.time() + 5.0
        last_err = None
        for model_id in candidate_models:
            remaining = deadline - time.time()
            if remaining <= 0.1:
                break

            def _call_gemini(target_model=model_id):
                return self.client.models.generate_content(
                    model=target_model,
                    contents=full_prompt,
                    config={
                        "response_mime_type": "application/json",
                        "temperature": 0.4,
                        "max_output_tokens": 1024,
                    }
                )

            try:
                future = self.executor.submit(_call_gemini)
                response = future.result(timeout=remaining)
                text = response.text.strip()
                if model_id != self.model_name:
                    print(f"[GeminiService] Berhasil memakai model cadangan: {model_id}", flush=True)
                return self._parse_json_response(
                    text, user_name, clean_input,
                    fallback_args=(location_block, context_block, mode)
                )
            except Exception as err:
                last_err = err
                err_msg = repr(err) if not str(err) else str(err)
                self.last_error = f"{model_id}: {err_msg}"
                print(f"[GeminiService] Model {model_id} gagal ({err_msg}), mencoba cadangan berikutnya...", flush=True)

        print(f"[GeminiService] Semua model gagal, fallback lokal aktif (last error: {last_err})")
        return self._smart_fallback(user_name, clean_input, location_block, context_block, mode)

    def generate_response_stream(
        self,
        user_name: str,
        user_message: str,
        location_block: str,
        context_block: str,
        mode: str = "none",
        progress_info: str = "0/6 pos selesai",
        history_block: str = "<riwayat>\nbelum ada percakapan\n</riwayat>"
    ):
        """
        Streaming generator yang mengirim potongan teks 'speech' secara real-time,
        lalu mengirim event 'done' berisi payload JSON lengkap.
        """
        import time
        self._load_system_prompt()
        clean_input = (user_message or "").strip()[:300]

        if os.getenv("ENVIRONMENT") == "test" or os.getenv("TESTING") == "1" or not self.client:
            yield {"type": "done", "data": self._smart_fallback(user_name, clean_input, location_block, context_block, mode)}
            return

        system_prompt = self.system_prompt_template.replace("{{nama}}", user_name)
        session_block = (
            f"<sesi>\n"
            f"nama: {user_name}\n"
            f"mode: {mode}\n"
            f"progress: {progress_info}\n"
            f"</sesi>"
        )
        full_prompt = (
            f"{system_prompt}\n\n"
            f"{session_block}\n"
            f"{history_block}\n"
            f"{location_block}\n"
            f"{context_block}\n"
            f"<pesan_pengguna>\n{clean_input}\n</pesan_pengguna>\n"
        )

        candidate_models = []
        for m in (self.model_name, "gemini-flash-lite-latest", "gemini-2.5-flash-lite"):
            if m and m not in candidate_models:
                candidate_models.append(m)

        deadline = time.time() + 5.0
        for model_id in candidate_models:
            if deadline - time.time() <= 0.1:
                break
            try:
                raw_buf = ""
                last_sent_speech = ""
                stream = self.client.models.generate_content_stream(
                    model=model_id,
                    contents=full_prompt,
                    config={
                        "response_mime_type": "application/json",
                        "temperature": 0.4,
                        "max_output_tokens": 1024,
                    }
                )
                for chunk in stream:
                    if time.time() > deadline and not raw_buf:
                        raise TimeoutError("Stream deadline exceeded")
                    if getattr(chunk, "text", None):
                        raw_buf += chunk.text
                        m_speech = re.search(r'"speech"\s*:\s*"((?:[^"\\]|\\.)*)', raw_buf)
                        if m_speech:
                            partial = m_speech.group(1).replace('\\"', '"').replace("\\n", " ")
                            if len(partial) > len(last_sent_speech):
                                last_sent_speech = partial
                                yield {"type": "chunk", "speech": partial}

                parsed = self._parse_json_response(
                    raw_buf.strip(), user_name, clean_input,
                    fallback_args=(location_block, context_block, mode)
                )
                yield {"type": "done", "data": parsed}
                return
            except Exception as err:
                err_msg = repr(err) if not str(err) else str(err)
                self.last_error = f"stream {model_id}: {err_msg}"
                print(f"[GeminiService] Stream {model_id} gagal ({err_msg})", flush=True)

        yield {"type": "done", "data": self._smart_fallback(user_name, clean_input, location_block, context_block, mode)}

    def generate_speech_audio(self, text: str) -> Optional[str]:
        """
        Generate audio TTS murni menggunakan Edge-TTS (id-ID-GadisNeural),
        dengan dukungan cache lokal (/assets/audio/generated/) maupun serverless Vercel (/tmp + Base64 Data URI).
        """
        if os.getenv("ENVIRONMENT") == "test" or os.getenv("TESTING") == "1":
            return None
        if not text:
            return None

        clean_text = text.strip()
        if not clean_text:
            return None

        import asyncio
        import base64
        import hashlib
        import tempfile

        is_serverless = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
        local_out_dir = BASE_DIR.parent / "frontend" / "assets" / "audio" / "generated"
        tmp_out_dir = Path(tempfile.gettempdir()) / "nesamate_tts"

        def _get_cache_dir() -> tuple[Path, bool]:
            """Return (cache_dir, use_data_uri)."""
            if not is_serverless:
                try:
                    local_out_dir.mkdir(parents=True, exist_ok=True)
                    return local_out_dir, False
                except OSError:
                    pass
            tmp_out_dir.mkdir(parents=True, exist_ok=True)
            return tmp_out_dir, True

        def _format_audio_output(file_path: Path, filename: str, use_data_uri: bool) -> str:
            if not use_data_uri:
                return f"/assets/audio/generated/{filename}"
            b64 = base64.b64encode(file_path.read_bytes()).decode("ascii")
            return f"data:audio/mpeg;base64,{b64}"

        out_dir, use_data_uri = _get_cache_dir()
        text_hash = hashlib.md5(clean_text.encode("utf-8")).hexdigest()[:16]
        mp3_filename = f"nesa_edge_{text_hash}.mp3"
        mp3_path = out_dir / mp3_filename

        try:
            import edge_tts

            static_path = local_out_dir / mp3_filename
            if static_path.exists() and static_path.stat().st_size >= 100:
                return _format_audio_output(static_path, mp3_filename, use_data_uri)

            if not mp3_path.exists() or mp3_path.stat().st_size < 100:
                async def _run_edge():
                    comm = edge_tts.Communicate(clean_text, "id-ID-GadisNeural", rate="+6%", pitch="+6Hz")
                    await comm.save(str(mp3_path))
                asyncio.run(_run_edge())

            if mp3_path.exists() and mp3_path.stat().st_size >= 100:
                return _format_audio_output(mp3_path, mp3_filename, use_data_uri)
            if mp3_path.exists():
                mp3_path.unlink(missing_ok=True)
            return None
        except Exception as e2:
            print(f"[EdgeTTS] Error: {e2}", flush=True)
            return None

    def _parse_json_response(
        self,
        text: str,
        user_name: str,
        query: str = "",
        fallback_args: Optional[tuple] = None
    ) -> Dict[str, Any]:
        """Validasi dan sanitasi output JSON sesuai PRD 12.6."""
        # Bersihkan markdown formatting jika masih ada ```json
        cleaned = re.sub(r"^```json\s*", "", text, flags=re.MULTILINE)
        cleaned = re.sub(r"```$", "", cleaned, flags=re.MULTILINE).strip()

        def _normalize_action(raw_action: str) -> str:
            valid_actions = [
                "none", "show_map", "show_spot_detail", "navigate_to_spot", "show_chart",
                "start_challenge", "open_free_mode"
            ]
            if raw_action not in valid_actions:
                return "none"
            if self._is_route_query(query):
                if raw_action == "show_spot_detail":
                    return "navigate_to_spot"
            elif raw_action == "navigate_to_spot":
                return "show_spot_detail"
            return raw_action

        try:
            data = json.loads(cleaned)
            if isinstance(data, list) and len(data) > 0:
                data = data[0]

            speech = data.get("speech") or data.get("message") or f"Halo {user_name}! Ada yang ingin kamu tanyakan tentang Hutan UNESA?"
            emotion = data.get("emotion", "neutral")
            if emotion not in ["happy", "neutral", "thinking", "confused"]:
                emotion = "neutral"

            action = _normalize_action(data.get("action", "none"))

            return {
                "speech": speech,
                "emotion": emotion,
                "action": action,
                "action_payload": data.get("action_payload") or {}
            }
        except Exception as e:
            print(f"[GeminiService] Gagal parse JSON ({e}), raw text: {text}")
            # Coba ekstrak field "speech" dari JSON yang terpotong agar jawaban AI tetap tersampaikan
            m_speech = re.search(r'"speech"\s*:\s*"((?:[^"\\]|\\.)+)', cleaned)
            if m_speech:
                recovered_speech = m_speech.group(1).replace('\\"', '"').replace("\\n", " ").strip()
                if len(recovered_speech) >= 5:
                    m_emotion = re.search(r'"emotion"\s*:\s*"([^"]+)"', cleaned)
                    m_action = re.search(r'"action"\s*:\s*"([^"]+)"', cleaned)
                    emotion = m_emotion.group(1) if m_emotion and m_emotion.group(1) in ["happy", "neutral", "thinking", "confused"] else "neutral"
                    action = _normalize_action(m_action.group(1) if m_action else "none")
                    return {
                        "speech": recovered_speech,
                        "emotion": emotion,
                        "action": action,
                        "action_payload": {}
                    }

            if fallback_args and len(fallback_args) == 3:
                return self._smart_fallback(user_name, query, fallback_args[0], fallback_args[1], fallback_args[2])
            return self._smart_fallback(user_name, query, "", "", "none")

    def _smart_fallback(
        self,
        user_name: str,
        query: str,
        location_block: str,
        context_block: str,
        mode: str
    ) -> Dict[str, Any]:
        """
        Fallback cerdas berbasis dataset saat kuota API Gemini habis/limit.
        Jawaban netral, lugas, akurat, dan tanpa repetisi template.
        """
        q = query.lower()
        wants_route = self._is_route_query(q)

        # 1. Deteksi spesifik Satwa & Hewan
        fauna_map = {
            "rusa totol": ("Rusa Totol", "Penangkaran Hewan (LOC007)", "LOC007", "Rusa totol adalah mamalia berbintik putih yang dilindungi di area penangkaran Hutan UNESA."),
            "rusa": ("Rusa", "Kandang Rusa (LOC008)", "LOC008", "Rusa adalah mamalia pemakan tumbuhan yang hidup di kawasan konservasi Hutan UNESA."),
            "ayam": ("Ayam", "Kandang Ayam (LOC002)", "LOC002", "Ayam adalah unggas peliharaan yang dirawat di kandang khusus kawasan Hutan UNESA."),
            "merak": ("Merak", "Zona Merak (LOC010)", "LOC010", "Merak adalah burung dengan bulu ekor bermotif mata yang berada di Zona Merak Hutan UNESA."),
            "angsa": ("Angsa", "Zona Angsa dan Bebek (LOC012)", "LOC012", "Angsa adalah unggas air berleher panjang yang hidup di zona perairan Hutan UNESA."),
            "bebek": ("Bebek", "Zona Angsa dan Bebek (LOC012)", "LOC012", "Bebek adalah unggas air yang hidup berdampingan dengan angsa di zona kolam Hutan UNESA."),
            "merpati": ("Merpati", "Zona Merpati (LOC014)", "LOC014", "Merpati adalah burung jinak pemakan biji-bijian yang berkumpul di Zona Merpati."),
            "iguana": ("Iguana", "Penangkaran Hewan (LOC007)", "LOC007", "Iguana adalah reptil herbivora yang dirawat di area penangkaran Hutan UNESA.")
        }
        for key, (f_name, spot_name, spot_id, desc) in fauna_map.items():
            if key in q:
                speech = (
                    f"{desc} Lokasinya ada di {spot_name}."
                    if wants_route else desc
                )
                action = (
                    "navigate_to_spot"
                    if wants_route
                    else ("none" if self._is_definition_query(q) else "show_spot_detail")
                )
                return {
                    "speech": speech,
                    "emotion": "neutral",
                    "action": action,
                    "action_payload": {"spot_id": spot_id}
                }

        # 1b. Pertanyaan daftar hewan secara umum (mis. "Hewan apa aja yg ada di unesa?")
        if any(k in q for k in ("hewan", "satwa", "binatang", "fauna")):
            return {
                "speech": "Di Hutan UNESA ada beberapa satwa yang bisa kamu temui, yaitu Rusa, Rusa Totol, Merak, Iguana, Angsa, Bebek, Merpati, dan Ayam.",
                "emotion": "happy",
                "action": "none",
                "action_payload": {}
            }

        # 2. Deteksi fasilitas ibadah
        if any(w in q for w in ["musholla", "masjid", "sholat", "solat", "wudhu"]):
            return {
                "speech": "Masjid Baitul Makmur berada di dekat pintu masuk kampus, dan Musholla Rektorat ada di sayap timur Gedung Rektorat Lantai 1.",
                "emotion": "neutral",
                "action": "navigate_to_spot" if wants_route else "show_spot_detail",
                "action_payload": {"spot_id": "LOC017"}
            }

        # 3. Deteksi fasilitas toilet / wc
        if any(w in q for w in ["toilet", "wc", "kamar mandi", "buang air"]):
            return {
                "speech": "Fasilitas toilet tersedia di Shelter Hutan dan Danau, koridor Arboretum, dan di Gedung Rektorat.",
                "emotion": "neutral",
                "action": "navigate_to_spot" if wants_route else "show_spot_detail",
                "action_payload": {"spot_id": "LOC016"}
            }

        # 4. Deteksi danau
        if "danau" in q:
            return {
                "speech": "Terdapat Danau Bunga Kertas di LOC005 dan Danau Kecil UNESA di LOC009 yang menjadi penyejuk ekosistem hutan kampus.",
                "emotion": "neutral",
                "action": "navigate_to_spot" if wants_route else "show_spot_detail",
                "action_payload": {"spot_id": "LOC005"}
            }

        # 5. Deteksi tantangan / pos petualangan
        if any(w in q for w in ["tantangan", "pos", "challenge", "misi"]):
            return {
                "speech": "Ada 6 pos tantangan petualangan di kawasan kampus dan Hutan UNESA. Selesaikan tugas di setiap pos untuk mendapatkan kode validasi.",
                "emotion": "neutral",
                "action": "start_challenge",
                "action_payload": {}
            }

        # 6. Deteksi permintaan peta eksplisit
        if any(w in q for w in ["buka peta", "lihat peta", "tampilkan peta", "denah"]):
            return {
                "speech": "Menampilkan peta navigasi Hutan UNESA.",
                "emotion": "neutral",
                "action": "show_map",
                "action_payload": {}
            }

        # 7. Sapaan / Perkenalan
        if any(w in q for w in ["halo", "hai", "kabar", "siapa kamu", "kamu siapa"]):
            return {
                "speech": "Halo. Saya Nesa, pemandu wisata virtual resmi di kawasan Hutan UNESA Lidah Wetan. Silakan tanyakan informasi seputar satwa, lokasi, atau pos tantangan.",
                "emotion": "neutral",
                "action": "none",
                "action_payload": {}
            }

        # 8. Coba jawab dari konteks RAG yang tersedia
        if context_block and "[1]" in context_block and "tidak ditemukan" not in context_block:
            first_line = context_block.split("\n")[1].replace("[1]", "").strip()
            return {
                "speech": first_line,
                "emotion": "neutral",
                "action": "none",
                "action_payload": {}
            }

        # 9. Default netral
        return {
            "speech": "Informasi tersebut belum tercatat di data Hutan UNESA. Anda dapat menanyakan tentang satwa, fasilitas, atau pos tantangan kampus.",
            "emotion": "neutral",
            "action": "none",
            "action_payload": {}
        }

    @staticmethod
    def _is_route_query(query: str) -> bool:
        route_terms = (
            "rute",
            "arah",
            "jalan ke",
            "menuju",
            "antar",
            "navigasi",
            "cara ke",
            "bagaimana ke",
        )
        normalized_query = query.lower().strip()
        return any(term in normalized_query for term in route_terms)

    @staticmethod
    def _is_definition_query(query: str) -> bool:
        definition_terms = (
            "apa itu",
            "apa yang dimaksud",
            "jelaskan",
            "pengertian",
            "maksudnya apa",
        )
        normalized_query = query.lower().strip()
        return any(term in normalized_query for term in definition_terms)

    @staticmethod
    def _contains_fauna_query(query: str) -> bool:
        fauna_terms = (
            "rusa totol",
            "rusa",
            "ayam",
            "merak",
            "angsa",
            "bebek",
            "merpati",
            "iguana",
        )
        normalized_query = query.lower().strip()
        return any(term in normalized_query for term in fauna_terms)


gemini_service = GeminiService()
