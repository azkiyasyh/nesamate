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
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
        self._load_system_prompt()
        self.client = None
        self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=4)

        if self.api_key and not self.api_key.startswith("your_"):
            try:
                from google import genai
                self.client = genai.Client(api_key=self.api_key)
            except Exception as e:
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

        def _call_gemini():
            return self.client.models.generate_content(
                model=self.model_name,
                contents=full_prompt,
                config={
                    "response_mime_type": "application/json",
                    "temperature": 0.4,
                    "max_output_tokens": 1024,
                }
            )

        try:
            future = self.executor.submit(_call_gemini)
            response = future.result(timeout=20.0)
            text = response.text.strip()
            return self._parse_json_response(text, user_name)
        except Exception as err:
            err_msg = repr(err) if not str(err) else str(err)
            print(f"[GeminiService] Fallback aktif (Gemini error: {err_msg})")
            return self._smart_fallback(user_name, clean_input, location_block, context_block, mode)

    def generate_speech_audio(self, text: str) -> Optional[str]:
        """
        Generate audio WAV dengan suara Kore (gemini-2.5-flash-preview-tts)
        dan simpan ke frontend/assets/audio/generated/.
        Memakai cache MD5 agar frasa yang sama langsung dimuat 0ms.
        """
        if os.getenv("ENVIRONMENT") == "test" or os.getenv("TESTING") == "1":
            return None
        if not self.client or not text:
            return None

        clean_text = text.strip()
        if not clean_text:
            return None

        try:
            import hashlib
            import wave
            from google.genai import types

            text_hash = hashlib.md5(clean_text.encode("utf-8")).hexdigest()[:16]
            filename = f"nesa_kore_{text_hash}.wav"
            out_dir = BASE_DIR.parent / "frontend" / "assets" / "audio" / "generated"
            out_dir.mkdir(parents=True, exist_ok=True)
            file_path = out_dir / filename

            # 1. Cek cache disk
            if file_path.exists():
                return f"/assets/audio/generated/{filename}"

            resp = self.client.models.generate_content(
                model="gemini-2.5-flash-preview-tts",
                contents=f"Ucapkan dengan nada ceria, ramah, bersahabat, dan fasih berbahasa Indonesia: {clean_text}",
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Kore")
                        )
                    )
                )
            )

            for part in resp.candidates[0].content.parts:
                if part.inline_data:
                    with wave.open(str(file_path), "wb") as wav_file:
                        wav_file.setnchannels(1)
                        wav_file.setsampwidth(2)
                        wav_file.setframerate(24000)
                        wav_file.writeframes(part.inline_data.data)

                    return f"/assets/audio/generated/{filename}"
        except Exception as e:
            print(f"[GeminiTTS] Error/Quota 429 ({e}), fallback otomatis ke Edge-TTS...")
            try:
                import asyncio
                import edge_tts
                mp3_filename = f"nesa_fallback_{text_hash}.mp3"
                mp3_path = out_dir / mp3_filename
                if not mp3_path.exists():
                    async def _run_edge():
                        comm = edge_tts.Communicate(clean_text, "id-ID-GadisNeural", rate="+6%", pitch="+6Hz")
                        await comm.save(str(mp3_path))
                    asyncio.run(_run_edge())
                return f"/assets/audio/generated/{mp3_filename}"
            except Exception as e2:
                print(f"[EdgeTTS] Error fallback: {e2}")
                return None
        return None

    def _parse_json_response(self, text: str, user_name: str) -> Dict[str, Any]:
        """Validasi dan sanitasi output JSON sesuai PRD 12.6."""
        # Bersihkan markdown formatting jika masih ada ```json
        cleaned = re.sub(r"^```json\s*", "", text, flags=re.MULTILINE)
        cleaned = re.sub(r"```$", "", cleaned, flags=re.MULTILINE).strip()

        try:
            data = json.loads(cleaned)
            if isinstance(data, list) and len(data) > 0:
                data = data[0]

            speech = data.get("speech") or data.get("message") or f"Halo {user_name}! Ada yang ingin kamu tanyakan tentang Hutan UNESA?"
            emotion = data.get("emotion", "neutral")
            if emotion not in ["happy", "neutral", "thinking", "confused"]:
                emotion = "neutral"

            action = data.get("action", "none")
            valid_actions = [
                "none", "show_map", "show_spot_detail", "show_chart",
                "start_challenge", "open_free_mode"
            ]
            if action not in valid_actions:
                action = "none"

            return {
                "speech": speech,
                "emotion": emotion,
                "action": action,
                "action_payload": data.get("action_payload") or {}
            }
        except Exception as e:
            print(f"[GeminiService] Gagal parse JSON ({e}), raw text: {text}")
            return {
                "speech": f"Halo {user_name}! Nesa siap memandumu di Hutan UNESA. Mau lihat peta atau ikut tantangan?",
                "emotion": "confused",
                "action": "none",
                "action_payload": {}
            }

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

        # 1. Deteksi spesifik Satwa & Hewan
        fauna_map = {
            "rusa totol": ("Rusa Totol", "Penangkaran Hewan (LOC007)", "LOC007", "Rusa Totol dilindungi di area Penangkaran Hewan. Hewan ini memiliki corak bintik putih alami."),
            "rusa": ("Rusa", "Kandang Rusa (LOC008)", "LOC008", "Satwa rusa berada di Kandang Rusa utama di area konservasi Hutan UNESA."),
            "ayam": ("Ayam", "Kandang Ayam (LOC002)", "LOC002", "Ayam berada di Kandang Ayam di kawasan Hutan UNESA."),
            "merak": ("Merak", "Zona Merak (LOC010)", "LOC010", "Burung merak berada di Zona Merak di jalur wisata Hutan UNESA."),
            "angsa": ("Angsa", "Zona Angsa dan Bebek (LOC012)", "LOC012", "Angsa dan bebek berada di Zona Angsa dan Bebek dekat perairan hutan."),
            "bebek": ("Bebek", "Zona Angsa dan Bebek (LOC012)", "LOC012", "Bebek dan angsa dapat dijumpai di Zona Angsa dan Bebek (LOC012)."),
            "merpati": ("Merpati", "Zona Merpati (LOC014)", "LOC014", "Kawanan burung merpati berada di Zona Merpati (LOC014)."),
            "iguana": ("Iguana", "Penangkaran Hewan (LOC007)", "LOC007", "Iguana dirawat di area Penangkaran Hewan (LOC007).")
        }
        for key, (f_name, spot_name, spot_id, desc) in fauna_map.items():
            if key in q:
                return {
                    "speech": f"{desc} Lokasinya ada di {spot_name}.",
                    "emotion": "neutral",
                    "action": "show_spot_detail",
                    "action_payload": {"spot_id": spot_id}
                }

        # 2. Deteksi fasilitas ibadah
        if any(w in q for w in ["musholla", "masjid", "sholat", "solat", "wudhu"]):
            return {
                "speech": "Masjid Baitul Makmur berada di dekat pintu masuk kampus, dan Musholla Rektorat ada di sayap timur Gedung Rektorat Lantai 1.",
                "emotion": "neutral",
                "action": "show_spot_detail",
                "action_payload": {"spot_id": "LOC017"}
            }

        # 3. Deteksi fasilitas toilet / wc
        if any(w in q for w in ["toilet", "wc", "kamar mandi", "buang air"]):
            return {
                "speech": "Fasilitas toilet tersedia di Shelter Hutan dan Danau, koridor Arboretum, dan di Gedung Rektorat.",
                "emotion": "neutral",
                "action": "show_spot_detail",
                "action_payload": {"spot_id": "LOC016"}
            }

        # 4. Deteksi danau
        if "danau" in q:
            return {
                "speech": "Terdapat Danau Bunga Kertas di LOC005 dan Danau Kecil UNESA di LOC009 yang menjadi penyejuk ekosistem hutan kampus.",
                "emotion": "neutral",
                "action": "show_spot_detail",
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


gemini_service = GeminiService()
