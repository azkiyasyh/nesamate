# Ringkasan Proyek NesaMate

## Gambaran Umum

NesaMate adalah aplikasi web pemandu wisata virtual untuk Hutan Kota UNESA Lidah Wetan, Surabaya. Pengunjung dapat menjelajahi lokasi melalui peta, bertanya kepada asisten AI bernama Nesa, mengikuti tantangan di stan proyek, atau melihat panduan rute jogging.

Aplikasi dirancang dengan pendekatan mobile-first dan tampilan portrait. Nesa ditampilkan sebagai avatar Live2D untuk membuat pengalaman pemanduan terasa lebih interaktif.

## Fitur

- **Mode Eksplorasi:** menampilkan peta interaktif, titik lokasi, dan fasilitas. Pengunjung dapat meminta informasi mengenai lokasi, flora, dan fauna melalui chat.
- **Mode Berpetualang:** berisi enam pos tantangan. Pengunjung melihat petunjuk lokasi, memasukkan kode pos, dan memantau progres.
- **Mode Jogging:** menampilkan panduan rute lari beserta instruksi navigasi dan suara.
- **Percakapan dan suara:** chat dapat menerima pertanyaan teks; fitur suara memanfaatkan kemampuan browser.
- **Avatar Nesa:** model Live2D ditampilkan sebagai pemandu virtual.

## Enam Pos Tantangan

Data tantangan saat ini berisi stan:

1. Pixora — tantangan foto AI artistik.
2. BIOVA — eksplorasi proyek BIOVA.
3. Wildex — eksplorasi satwa.
4. BioSphere — sensor lingkungan berbasis IoT.
5. Animora — pengalaman augmented reality hewan.
6. SmartPark Vision — deteksi aktivitas dan kepadatan pengunjung.

Data lengkap pos, termasuk deskripsi dan koordinat, tersimpan di `backend/data/kelompok.json`.

## Struktur Folder

```text
nesamate/
├── backend/
│   ├── app/
│   │   ├── models/       # Skema request dan response
│   │   ├── routes/       # Endpoint API
│   │   ├── services/     # Logika AI, RAG, dan tantangan
│   │   └── main.py       # Aplikasi FastAPI
│   ├── data/             # Dataset JSON
│   ├── tests/            # Pengujian backend
│   ├── .env.example      # Contoh konfigurasi environment
│   └── requirements.txt  # Dependency Python
├── frontend/
│   ├── assets/           # Gambar, model avatar, dan audio
│   ├── css/              # Styling antarmuka
│   ├── js/               # Logika aplikasi, peta, dan suara
│   └── index.html        # Halaman utama
├── docs/                 # PRD dan dokumentasi proyek
├── README.md
├── RINGKASAN_PROYEK.md
└── vercel.json           # Konfigurasi deployment Vercel
```

## Teknologi dan Arsitektur

- **Frontend:** HTML, CSS, dan JavaScript.
- **Peta:** Leaflet dan layanan peta berbasis web.
- **Avatar:** Live2D Cubism dan PixiJS.
- **Backend:** Python dengan FastAPI dan Uvicorn.
- **AI:** Gemini API dengan layanan retrieval-augmented generation (RAG) yang menggunakan data proyek sebagai konteks. Backend menyediakan jawaban fallback saat Gemini tidak tersedia.
- **Data:** file JSON untuk lokasi, flora/fauna, dan tantangan.

Frontend berada di `frontend/`. Backend dan API berada di `backend/app/`. Aplikasi FastAPI mendaftarkan endpoint API dan juga menyajikan file frontend statis.

## Menjalankan Secara Lokal

Dari folder utama proyek, jalankan perintah berikut di PowerShell:

```powershell
& "backend\venv\Scripts\python.exe" -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

Kemudian buka `http://127.0.0.1:8000` di browser. Status backend dapat diperiksa di `http://127.0.0.1:8000/api/health`.

Untuk memakai jawaban AI Gemini, isi `GEMINI_API_KEY` di `backend/.env`. Jangan membagikan atau mengunggah isi file `.env`.

## Pengujian

Jalankan pengujian backend dari folder utama proyek:

```powershell
& "backend\venv\Scripts\python.exe" -m pytest backend/tests
```
