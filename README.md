# 🌿 NesaMate - AI Virtual Tour Guide & Navigasi Hutan UNESA Lidah Wetan

**NesaMate** adalah aplikasi web frontend mobile-first (rasio 9:16) berestetika modern safari-natural yang telah direfaktor total dengan struktur **Anti-Bertumpuk (Uncluttered & Spacious)** sesuai mockup user flow. Menghadirkan maskot **Nesa si Rusa** sebagai pemandu wisata virtual interaktif di Hutan Kampus Universitas Negeri Surabaya (UNESA) Lidah Wetan.

---

## 🎨 Palet Warna Resmi (Design System)
- **Primary Dark Forest (`#1E3B2F`)**: Warna utama navbar, header, tombol primer, pos misi aktif/selesai.
- **Secondary Sage (`#7F8C6A`)**: Warna rute jogging track, badge, indikator aktif, aksen hutan.
- **Muted Gold / Sand (`#C8B48A`)**: Warna highlight, progress bar misi, emblem safari Nesa.
- **Off-White Cream (`#F5F0E6`)**: Warna background utama, card background, bubble chat.
- **Accent & Borders (`#1E3B2F` / `#1A1A1A`)**: Garis batas tajam dan kontras berkesan premium.
- **Shapes**: Rounded Pill Buttons (`border-radius: 999px`) & Rounded Card Containers (`16px`).

---

## 📱 User Flow 5 Layar (Sesuai Mockup & Bebas Bertumpuk)

### 1. LAYAR 1: LANDING PAGE (ONBOARDING)
- Tampilan super bersih dengan latar belakang Off-White Cream (`#F5F0E6`).
- Logo Bold **"NesaMate"** di bagian atas berwarna Dark Forest (`#1E3B2F`).
- Teaser maskot 2D Nesa si Rusa di dalam lingkaran emas.
- Form input Pill Gray/Soft: *"Masukkan Nama Anda..."*.
- Tombol Pill Bold: **"START"** (`#1E3B2F` dengan teks Muted Gold `#C8B48A`).

### 2. LAYAR 2: GREETING & PILIH MODE (MAIN ONBOARDING)
- Avatar **Nesa si Rusa** tampil **BESAR** dan ramah di tengah layar:
  `<!-- TODO: REPLACE WITH LIVE2D CUBISM SDK & PIXIJS CANVAS HERE -->`
- Floating Speech Bubble di atas kepala Nesa:
  > *"Halo [Nama User]! Aku Nesa si Rusa, pemandu wisatamu hari ini di Hutan Kota UNESA. Mau mulai dari mana?"*
- Sapaan suara otomatis via Web Speech API (TTS berbahasa Indonesia).
- 3 Tombol Pill di bagian bawah:
  - `[ 🌿 Mode Eksplorasi ]`
  - `[ 🎯 Mode Berpetualang ]`
  - `[ 🏃 Mode Jogging ]`

### 3. LAYAR 3: FREE MODE (MODE EKSPLORASI BEBAS & MAPS)
- Peta Leaflet.js memenuhi latar belakang penuh (**Full Screen**).
- Top bar minimalis: Tombol kembali `[ ← ]`, badge judul, tombol recenter, dan Filter Chip POI:
  - `[ 🌲 Spot Hutan ]` (Pintu Masuk Hutan, Jalur Setapak Trekking, Observasi Flora, Shelter)
  - `[ 🕌 Musholla ]` (Masjid Baitul Makmur, Musholla Rektorat Lt. 1, FIP, FBS)
  - `[ 🅿️ Parkiran ]` (Parkir Utama Rektorat, Parkir Terpadu Hutan, Parkir Barat)
  - `[ 🚻 Toilet ]` (Toilet Shelter Hutan & Danau, Toilet Rektorat, Arboretum)
- **Bottom Left**: Mini Avatar Thumbnail Nesa di dalam kotak rounded melayang.
- **Bottom Right**: Floating Action Button (FAB) Mikrofon Melayang (Web Speech STT).
- **Bottom Navigation Bar**: Tab `[ 📍 Peta ]` | Tab `[ ✨ AI Guide ]`.
- Drawer / Bottom Sheet ramping yang muncul saat tab AI Guide / Avatar ditekan tanpa menutupi seluruh peta.

### 4. LAYAR 4: CHALLENGE MODE (MODE BERPETUALANG / MISI)
- Header atas dengan tombol kembali `[ ← ]` dan Progress Bar *"Misi Tercapai (X/6)"* berwarna Muted Gold.
- Daftar Card Pos 1 sampai Pos 6 yang tersusun rapi:
  - **Pos yang SUDAH selesai**: Card Dark Forest (`#1E3B2F`) Solid dengan badge *"✓ Tercapai"*.
  - **Pos yang AKTIF**: Card Cream (`#F5F0E6`) dengan border tegas Dark Forest, deskripsi singkat, hint penjaga pos, Form Input Pill *"Kata Kunci"*, dan tombol *"Input"*.
  - **Pos yang TERKUNCI**: Card abu-abu halus bergaris putus-putus dengan ikon 🔒.
- **Bottom Navigation Bar**: Tab `[ 🎯 Misi ]` | Tab `[ 📍 Peta Rute ]`.

### 5. LAYAR 5: JOGGING MODE (TRACK GUIDE & AUDIO NAVIGATION)
- Visualisasi rute lintasan lari Hutan UNESA di atas peta Leaflet.js dengan garis rute **Secondary Sage (`#7F8C6A`)** sejauh 2.35 km.
- **Floating Running Widget** di atas: Menampilkan Estimasi Jarak Loop, Estimasi Waktu (16 Menit), dan Kalori Terbakar (175 kkal).
- **Floating Audio Navigation Widget** di bawah:
  - Instruksi belokan turn-by-turn (misal: *"Di pertigaan depan, ambil arah kiri menuju area danau"*).
  - Kontrol navigasi: `◀ Belokan Lalu`, `🔊 Panduan Suara` (memicu TTS suara Nesa), dan `Belokan Depan ▶`.
- **Bottom Navigation Bar**: Tab `[ 📍 Track Lari ]` | Tab `[ 🔊 Panduan Suara ]`.

---

## 🚀 Cara Menjalankan Proyek
1. Buka file `index.html` langsung di browser modern (Google Chrome atau Microsoft Edge).
2. Atau klik kanan `index.html` > pilih **"Open with Live Server"** di VS Code.
