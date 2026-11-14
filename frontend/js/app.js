/**
 * NesaMate - Core Controller & Navigation Flow
 * Mengatur alur 5 layar (Landing, Greeting & Mode, Free Mode, Challenge Mode, Jogging Mode)
 */

// ========================================================
// API CONFIGURATION (Dinamis Lokal vs Vercel Production)
// ========================================================
const API_BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
  ? 'http://127.0.0.1:8000/api'
  : '/api';
window.API_BASE_URL = API_BASE_URL;

const CHALLENGE_ROUTE_GUIDES = {
  1: {
    guide: 'Arahkan langkahmu ke area Plaza depan Gedung Rektorat UNESA. Cari tim penjaga yang membawa sensor mikroklimat udara di pelataran utama.',
    shortHint: 'Plaza Depan Gedung Rektorat'
  },
  2: {
    guide: 'Berjalanlah ke arah selatan menuju tepian Danau UNESA. Di dekat dermaga danau, temui tim penguji ekosistem air.',
    shortHint: 'Dermaga Danau UNESA'
  },
  3: {
    guide: 'Menujulah ke sisi barat kampus di Pintu Masuk Hutan UNESA. Di sana kamu akan menemukan gerbang rimbun dan pohon Trembesi tertua bersama pemandu rimba.',
    shortHint: 'Pintu Masuk Barat Hutan UNESA'
  },
  4: {
    guide: 'Masuklah ke jalur setapak hutan menuju Pusat Observasi Flora dan Burung. Dengarkan kicauan satwa alami di bawah kanopi rindang.',
    shortHint: 'Observasi Flora & Satwa'
  },
  5: {
    guide: 'Ambil jalur setapak melintasi pepohonan menuju Shelter Jagawana. Cari tempat pilah botol otomatis untuk tantangan Zero Waste.',
    shortHint: 'Shelter Peristirahatan Jagawana'
  },
  6: {
    guide: 'Arahkan langkahmu ke kompleks Gelora Kampus Hijau di sisi utara kampus. Di sana ada ubin konversi energi kinetik ramah lingkungan.',
    shortHint: 'Kompleks Gelora UNESA'
  }
};

// ========================================================
// LIVE2D AVATAR CONTROLLER (PixiJS v6.5.8 + Cubism v4)
// ========================================================
let pixiApp = null;
let nesaModel = null;
let isModelLoading = false;

function setAvatarState(state) {
  // Safe helper jika dipanggil oleh modul lain
}
window.setAvatarState = setAvatarState;

function attachAvatarToScreen(screenId) {
  const container = document.getElementById('nesa-avatar-container');
  if (!container) return;

  if (screenId === 'screen-landing') {
    const landingSlot = document.getElementById('landing-avatar-slot');
    if (landingSlot && !landingSlot.contains(container)) {
      landingSlot.appendChild(container);
    }
  } else if (screenId === 'screen-greeting') {
    const greetingSlot = document.getElementById('greeting-avatar-slot');
    if (greetingSlot && !greetingSlot.contains(container)) {
      greetingSlot.appendChild(container);
    }
  }
}
window.attachAvatarToScreen = attachAvatarToScreen;

async function initLive2DAvatar() {
  const container = document.getElementById('nesa-avatar-container');
  if (!container) return;

  // Pastikan elemen canvas selalu ada di DOM
  let canvas = document.getElementById('canvas-live2d');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'canvas-live2d';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.pointerEvents = 'none';
    container.appendChild(canvas);
  }

  // Jika sedang proses memuat, tunggu hingga selesai
  if (isModelLoading) return;

  // Jika model & pixiApp sudah ada dan terpasang aktif di canvas
  if (pixiApp && nesaModel && pixiApp.view === canvas && canvas.parentElement) {
    try {
      pixiApp.renderer.resize(260, 260);
      nesaModel.anchor.set(0.5, 0.5);
      nesaModel.x = 130;
      nesaModel.y = 145;
      const baseW = nesaModel.internalModel?.originalWidth || nesaModel.width || 400;
      const baseH = nesaModel.internalModel?.originalHeight || nesaModel.height || 400;
      const scale = Math.min((260 * 0.65) / baseW, (260 * 0.65) / baseH);
      nesaModel.scale.set(scale);
      return;
    } catch (e) {}
  }

  // Cek apakah PixiJS dan Live2D display library sudah tersedia
  if (typeof PIXI === 'undefined' || !PIXI.live2d || !PIXI.live2d.Live2DModel) {
    console.warn('[Live2D] Library PIXI atau pixi-live2d belum siap, mencoba lagi...');
    setTimeout(initLive2DAvatar, 200);
    return;
  }

  // Hapus instance Pixi lama TANPA menghapus elemen canvas dari DOM
  if (pixiApp) {
    try {
      pixiApp.destroy(false);
    } catch (e) {}
    pixiApp = null;
    nesaModel = null;
  }

  isModelLoading = true;

  try {
    // 1. Register Ticker Pixi (WAJIB agar model terupdate pada render loop)
    if (PIXI.live2d.Live2DModel.registerTicker) {
      PIXI.live2d.Live2DModel.registerTicker(PIXI.Ticker);
    }

    pixiApp = new PIXI.Application({
      view: canvas,
      transparent: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      width: 260,
      height: 260
    });

    // 2. Load model Live2D Nesa (dukung path primer & fallback)
    let loadedModel = null;
    try {
      loadedModel = await PIXI.live2d.Live2DModel.from('assets/live2d/nesa/nesa.model3.json', { autoInteract: false });
    } catch (e1) {
      console.warn('[Live2D] Path primer nesa.model3.json gagal, mencoba fallback path:', e1);
      try {
        loadedModel = await PIXI.live2d.Live2DModel.from('assets/AVA Nesa.model3.json', { autoInteract: false });
      } catch (e2) {
        console.error('[Live2D] Path fallback juga gagal:', e2);
      }
    }

    if (!loadedModel) {
      throw new Error('Model Live2D tidak dapat dimuat dari assets');
    }

    nesaModel = loadedModel;
    pixiApp.stage.addChild(nesaModel);

    // 3. KUNCI POSISI DI TENGAH (Anchor & Alignment)
    nesaModel.anchor.set(0.5, 0.5);
    nesaModel.x = 130; // Setengah dari lebar 260px
    nesaModel.y = 145; // Posisi pas di tengah, tidak melongok close-up

    // 4. KUNCI SKALA PRESISI (0.65 dari container 260px)
    const baseW = nesaModel.internalModel?.originalWidth || nesaModel.width || 400;
    const baseH = nesaModel.internalModel?.originalHeight || nesaModel.height || 400;
    const scale = Math.min(
      (260 * 0.65) / baseW,
      (260 * 0.65) / baseH
    );
    nesaModel.scale.set(scale);

    nesaModel.interactive = true;
    window.nesaModel = nesaModel;
    window.pixiApp = pixiApp;

    // Bersihkan fallback image jika ada
    const existingFallback = document.getElementById('nesa-avatar-fallback');
    if (existingFallback) existingFallback.remove();

    console.log("SUCCESS: Live2D Nesa berhasil dipasang proporsional!");
  } catch (err) {
    console.error("Gagal load Live2D Nesa:", err);
    // Tampilkan avatar fallback tekstur jika Live2D gagal agar tampilan tidak kosong
    if (!nesaModel && container) {
      let fallbackImg = document.getElementById('nesa-avatar-fallback');
      if (!fallbackImg) {
        fallbackImg = document.createElement('img');
        fallbackImg.id = 'nesa-avatar-fallback';
        fallbackImg.src = 'assets/live2d/nesa/nesa.2048/texture_00.png';
        fallbackImg.style.width = '180px';
        fallbackImg.style.height = '180px';
        fallbackImg.style.objectFit = 'contain';
        fallbackImg.style.pointerEvents = 'none';
        container.appendChild(fallbackImg);
      }
    }
  } finally {
    isModelLoading = false;
  }
}

window.initLive2DAvatar = initLive2DAvatar;

// Jalankan otomatis saat web siap
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initLive2DAvatar();
} else {
  document.addEventListener('DOMContentLoaded', initLive2DAvatar);
}

class NesaApp {
  constructor() {
    this.userName = localStorage.getItem('nesamate_user_name') || '';
    this.sessionId = localStorage.getItem('nesamate_session_id') || '';
    this.currentScreen = 'screen-landing';
    this.activeMapMode = null; // 'free' | 'challenge' | 'jogging'

    // Challenge Mode State
    this.challengeState = {
      activePosIndex: 1, // 1 to 6
      positions: JSON.parse(JSON.stringify(NESA_DATA.challengePositions)).map(p => ({
        ...p,
        completed: false
      }))
    };

    // Jogging Mode State
    this.joggingState = {
      currentStepIndex: 0
    };

    this.init();
  }

  init() {
    initLive2DAvatar();
    this.setupSpeechListeners();
    this.setupEventListeners();

    // Jika sudah ada nama tersimpan, isi form
    const nameInput = document.getElementById('input-user-name');
    if (nameInput && this.userName) {
      nameInput.value = this.userName;
    }
  }

  setAvatarState(state) {
    return setAvatarState(state);
  }

  /**
   * Menampilkan layar tertentu secara bersih tanpa bertumpuk
   */
  showScreen(screenId) {
    const container = document.querySelector('.mobile-device-container');
    if (container) {
      container.classList.toggle('is-onboarding', screenId === 'screen-landing');
    }

    // DEFAULT STATE: Avatar Nesa HARUS TAMPIL BESAR dan jelas di layar utama pada Mode Eksplorasi, Mode Jogging, maupun Mode Tantangan (Challenge Mode).
    // Avatar TIDAK BOLEH otomatis mengecil hanya karena berpindah mode atau saat Nesa sedang berbicara biasa.
    if (screenId !== 'screen-landing') {
      this.setAvatarState('full');
    }

    const allScreens = document.querySelectorAll('.screen-view');
    allScreens.forEach(s => s.classList.remove('is-active'));

    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('is-active');
      this.currentScreen = screenId;
    }

    // Pindahkan container avatar ke slot layar aktif jika perlu
    attachAvatarToScreen(screenId);

    // Tangani inisialisasi dan isolasi peta per layar
    if (screenId === 'screen-greeting' || screenId === 'screen-landing') {
      setTimeout(() => {
        initLive2DAvatar();
      }, 50);
    } else if (screenId === 'screen-free-mode') {
      this.activeMapMode = 'free';
      if (window.nesaMap) {
        window.nesaMap.clearJoggingTrack();
      }
      setTimeout(() => {
        nesaMap.initMap('free-map-container');
        if (nesaMap.map) nesaMap.map.invalidateSize();
      }, 150);
    } else if (screenId === 'screen-challenge-mode') {
      if (window.nesaMap) {
        window.nesaMap.clearJoggingTrack();
      }
      this.renderChallengeCards();
    } else if (screenId === 'screen-jogging-mode') {
      this.activeMapMode = 'jogging';
      if (window.nesaMap) {
        window.nesaMap.clearRoute();
      }
      const navCard = document.getElementById('free-nav-active-card');
      if (navCard) navCard.classList.remove('is-active');

      setTimeout(() => {
        nesaMap.initMap('jogging-map-container');
        nesaMap.showJoggingTrack();
        this.updateJoggingStepUI();
        if (nesaMap.map) nesaMap.map.invalidateSize();
      }, 150);
    } else {
      // Screen greeting, landing, dll: bersihkan jogging track & rute lama
      if (window.nesaMap) {
        window.nesaMap.clearJoggingTrack();
      }
      const navCard = document.getElementById('free-nav-active-card');
      if (navCard) navCard.classList.remove('is-active');
    }
  }

  /**
   * Setup Web Speech Listener & Feedback UI (Hands-Free Real-Time Audio Call)
   */
  setupSpeechListeners() {
    const drawerBubble = document.getElementById('drawer-chat-bubble');

    // Hasil transkrip suara pengguna (Hands-Free Call)
    nesaVoice.onTranscriptResult = (transcript) => {
      console.log('[NesaMate STT] Pengguna berkata:', transcript);
      if (drawerBubble) {
        drawerBubble.textContent = `Anda: "${transcript}"`;
      }
      this.handleUserVoiceQuery(transcript);
    };

    window.handleUserAudioQuery = (text) => {
      console.log('[NesaMate AudioQuery] User Input:', text);
      if (drawerBubble) {
        drawerBubble.textContent = `Anda: "${text}"`;
      }
      this.handleUserVoiceQuery(text);
    };
  }

  /**
   * Event Listeners Seluruh Layar
   */
  setupEventListeners() {
    // -----------------------------------------------------------------
    // LAYAR 1: LANDING PAGE
    // -----------------------------------------------------------------
    const startBtn = document.getElementById('btn-start') || document.getElementById('start-btn') || document.querySelector('.btn-start');
    const nameInput = document.getElementById('input-user-name');

    const handleStart = async (e) => {
      if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
      console.log("Tombol Start diklik!");

      const val = (nameInput ? nameInput.value.trim() : '') || this.userName || 'Teman';
      this.userName = val;
      localStorage.setItem('nesamate_user_name', val);

      // Registrasi sesi ke backend (non-blocking agar transisi lancar)
      fetch(`${API_BASE_URL}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_name: val })
      }).then(res => res.json()).then(sData => {
        if (sData && sData.session_id) {
          this.sessionId = sData.session_id;
          localStorage.setItem('nesamate_session_id', sData.session_id);
        }
      }).catch(err => {
        console.warn('[NesaMate API] Session API offline, menggunakan sesi lokal:', err);
      });

      // Unmute/resume audio context & Web Speech API dari gesture klik pengguna
      if (window.speechSynthesis && typeof window.speechSynthesis.resume === 'function') {
        window.speechSynthesis.resume();
      }

      // Permintaan izin mic (non-blocking)
      try {
        if (window.nesaVoice) {
          nesaVoice.requestMicrophonePermission().catch(() => {});
          nesaVoice.setCallMode(true);
        }
      } catch (err) {}

      // Pindah dari Landing Page ke Main Screen / Menu Mode
      const landingScreen = document.getElementById('screen-landing');
      const mainScreen = document.getElementById('screen-greeting') || document.getElementById('screen-main');
      if (landingScreen) landingScreen.classList.remove('is-active');
      if (mainScreen) mainScreen.classList.add('is-active');

      this.showScreen('screen-greeting');
      initLive2DAvatar();

      // Update Sapaan Nesa sesuai PRD & Mockup
      const greetingText = `Halo ${this.userName}! Aku Nesa si Rusa, pemandu wisatamu hari ini di Hutan Kota UNESA. Mau mulai dari eksplorasi bebas, berpetualang, atau jogging?`;
      const greetingEl = document.getElementById('greeting-speech-text');
      if (greetingEl) {
        greetingEl.textContent = `"${greetingText}"`;
      }

      // Mainkan suara ramah Nesa (Web Speech API)
      setTimeout(() => {
        if (window.nesaVoice) {
          nesaVoice.speak(greetingText);
        }
      }, 300);
    };

    if (startBtn) {
      startBtn.addEventListener('click', handleStart);
    }
    if (nameInput) {
      nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleStart(e);
      });
    }

    // -----------------------------------------------------------------
    // LAYAR 2: GREETING & PILIH MODE
    // -----------------------------------------------------------------
    const btnFreeMode = document.getElementById('btn-select-free-mode');
    const btnChallengeMode = document.getElementById('btn-select-challenge-mode');
    const btnJoggingMode = document.getElementById('btn-select-jogging-mode');

    if (btnFreeMode) {
      btnFreeMode.addEventListener('click', () => {
        this.showScreen('screen-free-mode');
        const tip = `Mode Eksplorasi Bebas aktif! Anda dapat melihat seluruh Musholla, Parkiran, dan Toilet di Hutan UNESA.`;
        nesaVoice.speak(tip);
      });
    }

    if (btnChallengeMode) {
      btnChallengeMode.addEventListener('click', () => {
        this.showScreen('screen-challenge-mode');
        setTimeout(() => {
          this.openChallengeStartSelector();
        }, 300);
      });
    }

    if (btnJoggingMode) {
      btnJoggingMode.addEventListener('click', () => {
        this.showScreen('screen-jogging-mode');
        const tip = `Mode Jogging Hutan UNESA siap! Jalur 2,3 kilometer telah dipetakan mengitari danau dan kanopi rimbun.`;
        nesaVoice.speak(tip);
      });
    }

    // -----------------------------------------------------------------
    // LAYAR 3: FREE MODE
    // -----------------------------------------------------------------
    const btnFreeBack = document.getElementById('btn-free-back');
    if (btnFreeBack) {
      btnFreeBack.addEventListener('click', () => {
        this.showScreen('screen-greeting');
      });
    }

    const btnFreeRecenter = document.getElementById('btn-free-recenter');
    if (btnFreeRecenter) {
      btnFreeRecenter.addEventListener('click', () => {
        nesaMap.recenterCampus();
        this.showToast('📍 Menampilkan kawasan Hutan UNESA');
      });
    }

    // POI Filter Chips
    const filterChips = document.querySelectorAll('.pill-chip-filter');
    filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const cat = chip.dataset.category;
        const isActive = nesaMap.togglePOILayer(cat);
        if (isActive) {
          chip.classList.add('is-active');
          this.showToast(`Menampilkan ikon ${cat}`);
        } else {
          chip.classList.remove('is-active');
          this.showToast(`Menyembunyikan ikon ${cat}`);
        }
      });
    });

    // Drawer / Bottom Sheet AI Guide Trigger
    const btnMiniAvatar = document.getElementById('btn-mini-avatar-trigger');
    const navTabFreeGuide = document.getElementById('nav-tab-free-guide');
    const navTabFreeMap = document.getElementById('nav-tab-free-map');
    const btnCloseDrawer = document.getElementById('btn-close-drawer');
    const btnCancelNav = document.getElementById('btn-cancel-free-nav');

    if (btnMiniAvatar) btnMiniAvatar.addEventListener('click', () => this.openDrawer());
    if (navTabFreeGuide) navTabFreeGuide.addEventListener('click', () => this.openDrawer());
    if (navTabFreeMap) navTabFreeMap.addEventListener('click', () => this.closeDrawer());
    if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', () => this.closeDrawer());

    // Interaksi klik avatar: jika compact, kembalikan ke full
    const avatarContainer = document.getElementById('nesa-avatar-container');
    if (avatarContainer) {
      avatarContainer.addEventListener('click', () => {
        if (avatarContainer.classList.contains('avatar-compact')) {
          this.setAvatarState('full');
          this.showToast('✨ Avatar Nesa diperbesar');
        }
      });
    }

    // Tombol tutup rute navigasi di floating banner
    if (btnCancelNav) {
      btnCancelNav.addEventListener('click', () => {
        if (window.nesaMap) window.nesaMap.clearRoute();
        const navCard = document.getElementById('free-nav-active-card');
        if (navCard) navCard.classList.remove('is-active');
        this.setAvatarState('full');
        this.showToast('🧭 Navigasi rute ditutup');
      });
    }

    // Kirim pesan teks di Drawer
    const btnDrawerSend = document.getElementById('btn-drawer-send');
    const inputDrawerUser = document.getElementById('drawer-user-input');

    const sendDrawerQuery = () => {
      const q = inputDrawerUser.value.trim();
      if (!q) return;
      inputDrawerUser.value = '';
      this.handleUserVoiceQuery(q);
    };

    if (btnDrawerSend) btnDrawerSend.addEventListener('click', sendDrawerQuery);
    if (inputDrawerUser) {
      inputDrawerUser.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendDrawerQuery();
      });
    }

    // -----------------------------------------------------------------
    // LAYAR 4: CHALLENGE MODE
    // -----------------------------------------------------------------
    const btnChallengeBack = document.getElementById('btn-challenge-back');
    if (btnChallengeBack) {
      btnChallengeBack.addEventListener('click', () => {
        this.showScreen('screen-greeting');
      });
    }

    // Tabs Subview: Tab Misi vs Tab Peta Rute
    const navTabMisi = document.getElementById('nav-tab-challenge-misi');
    const navTabMap = document.getElementById('nav-tab-challenge-map');
    const cardsContainer = document.getElementById('challenge-cards-container');
    const mapContainer = document.getElementById('challenge-map-subview');

    if (navTabMisi) {
      navTabMisi.addEventListener('click', () => {
        this.setAvatarState('full');
        navTabMisi.classList.add('is-active');
        navTabMap.classList.remove('is-active');
        if (cardsContainer) cardsContainer.style.display = 'flex';
        if (mapContainer) mapContainer.classList.remove('is-visible');
      });
    }

    if (cardsContainer) {
      cardsContainer.addEventListener('focusin', (event) => {
        if (event.target.matches('.passcode-pill-input')) this.setAvatarState('compact');
      });
      cardsContainer.addEventListener('focusout', (event) => {
        if (!event.target.matches('.passcode-pill-input')) return;
        setTimeout(() => {
          if (!cardsContainer.querySelector('.passcode-pill-input:focus')) this.setAvatarState('full');
        }, 150);
      });
    }

    if (navTabMap) {
      navTabMap.addEventListener('click', () => {
        this.showChallengeMapSubView(false);
      });
    }

    // Tombol di dalam floating route guide card
    const btnReselectPos = document.getElementById('btn-reselect-challenge-pos');
    if (btnReselectPos) {
      btnReselectPos.addEventListener('click', () => {
        this.openChallengeStartSelector();
      });
    }

    const btnChallengeHearCue = document.getElementById('btn-challenge-hear-cue');
    if (btnChallengeHearCue) {
      btnChallengeHearCue.addEventListener('click', () => {
        this.speakActiveChallengeRoute();
      });
    }

    const btnChallengeOpenMission = document.getElementById('btn-challenge-open-mission');
    if (btnChallengeOpenMission) {
      btnChallengeOpenMission.addEventListener('click', () => {
        this.showChallengePosCard(this.challengeState.activePosIndex);
      });
    }

    const modalBackdrop = document.getElementById('challenge-modal-backdrop');
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', () => {
        const modal = document.getElementById('challenge-start-modal');
        if (modal) modal.classList.remove('is-open');
      });
    }

    // -----------------------------------------------------------------
    // LAYAR 5: JOGGING MODE
    // -----------------------------------------------------------------
    const btnJoggingBack = document.getElementById('btn-jogging-back');
    if (btnJoggingBack) {
      btnJoggingBack.addEventListener('click', () => {
        if (window.nesaMap) {
          window.nesaMap.clearJoggingTrack();
        }
        this.showScreen('screen-greeting');
      });
    }

    const btnPrevStep = document.getElementById('btn-jogging-prev-step');
    const btnNextStep = document.getElementById('btn-jogging-next-step');
    const btnVoiceCue = document.getElementById('btn-jogging-voice-cue');

    if (btnPrevStep) {
      btnPrevStep.addEventListener('click', () => this.navigateJoggingStep(-1));
    }
    if (btnNextStep) {
      btnNextStep.addEventListener('click', () => this.navigateJoggingStep(1));
    }
    if (btnVoiceCue) {
      btnVoiceCue.addEventListener('click', () => this.speakJoggingCue());
    }

    const navTabJoggingTrack = document.getElementById('nav-tab-jogging-track');
    const navTabJoggingAudio = document.getElementById('nav-tab-jogging-audio');

    if (navTabJoggingTrack) {
      navTabJoggingTrack.addEventListener('click', () => {
        navTabJoggingTrack.classList.add('is-active');
        if (navTabJoggingAudio) navTabJoggingAudio.classList.remove('is-active');
        nesaMap.recenterCampus();
      });
    }

    if (navTabJoggingAudio) {
      navTabJoggingAudio.addEventListener('click', () => {
        navTabJoggingAudio.classList.add('is-active');
        if (navTabJoggingTrack) navTabJoggingTrack.classList.remove('is-active');
        this.speakJoggingCue();
      });
    }
  }

  /**
   * Render List Card Pos 1 sampai Pos 6 (Challenge Mode)
   */
  renderChallengeCards() {
    const container = document.getElementById('challenge-cards-container');
    if (!container) return;

    const completedCount = this.challengeState.positions.filter(p => p.completed).length;
    const totalCount = this.challengeState.positions.length;
    const percent = Math.round((completedCount / totalCount) * 100);

    const progressFill = document.getElementById('challenge-progress-fill');
    const progressText = document.getElementById('challenge-progress-text');
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressText) progressText.textContent = `${completedCount}/${totalCount} Selesai`;

    container.innerHTML = '';

    this.challengeState.positions.forEach(pos => {
      const isCompleted = pos.completed;
      const isActive = (pos.index === this.challengeState.activePosIndex);

      if (isCompleted) {
        // State 1: Pos SUDAH Selesai (Dark Forest #1E3B2F Solid)
        const card = document.createElement('div');
        card.className = 'pos-card-completed';
        card.innerHTML = `
          <div>
            <div class="pos-completed-title">${pos.name}</div>
            <div class="pos-completed-sub">${pos.title}</div>
          </div>
          <div class="badge-tercapai">✓ Tercapai</div>
        `;
        container.appendChild(card);
      } else if (isActive) {
        // State 2: Pos AKTIF (Card Cream #F5F0E6 + Border Tegas + Input)
        const card = document.createElement('div');
        card.className = 'pos-card-active';
        card.innerHTML = `
          <div class="pos-active-header">
            <span class="pos-active-title">${pos.name}</span>
            <span class="badge-pos-active">Misi Aktif</span>
          </div>
          <div style="font-size:13px; font-weight:700; color:#1E3B2F;">${pos.title}</div>
          <p class="pos-active-desc">${pos.desc}</p>
          <div class="pos-input-group">
            <input type="text" id="input-passcode-${pos.id}" class="passcode-pill-input" placeholder="KATA KUNCI..." />
            <button class="btn-pill-submit-pos" onclick="window.nesaApp.submitPasscode('${pos.id}')">Input</button>
          </div>
          <button class="btn-pill-submit-pos" style="background:#FAF7F0; color:var(--color-primary); border: 1.5px solid var(--color-primary); width:100%; margin-top:6px; display:flex; justify-content:center; align-items:center; gap:6px;" onclick="window.nesaApp.showChallengeMapSubView(true)">
            🗺️ Panduan Rute di Peta
          </button>
        `;
        container.appendChild(card);
      } else {
        // State 3: Pos TERKUNCI (Muted Grey)
        const card = document.createElement('div');
        card.className = 'pos-card-locked';
        card.innerHTML = `
          <div>
            <div class="pos-locked-title">${pos.name}</div>
            <div style="font-size:11.5px; color:#788079;">${pos.title}</div>
          </div>
          <span style="font-size:14px;">🔒</span>
        `;
        container.appendChild(card);
      }
    });
  }

  /**
   * Validasi kata kunci pos dari input pengguna
   */
  async submitPasscode(posId) {
    const pos = this.challengeState.positions.find(p => p.id === posId);
    if (!pos) return;

    const input = document.getElementById(`input-passcode-${pos.id}`);
    if (!input) return;

    const entered = input.value.trim().toUpperCase();
    if (!entered) {
      input.focus();
      return;
    }

    let isSuccess = false;
    let customMessage = '';

    // Validasi via Backend API jika online
    try {
      const vRes = await fetch(`${API_BASE_URL}/challenge/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId || 'local-session',
          post_id: pos.index,
          code: entered
        })
      });

      if (vRes.ok) {
        const vData = await vRes.json();
        isSuccess = vData.success;
        customMessage = vData.message;
      } else {
        // Fallback local check jika server offline
        isSuccess = (entered === pos.passcode.toUpperCase());
      }
    } catch (err) {
      // Offline fallback
      isSuccess = (entered === pos.passcode.toUpperCase());
    }

    if (isSuccess) {
      pos.completed = true;
      this.showToast(`🎉 Hebat! Misi ${pos.name} Tercapai!`);

      // Cari pos berikutnya yang belum selesai
      const nextPos = this.challengeState.positions.find(p => !p.completed);
      if (nextPos) {
        this.challengeState.activePosIndex = nextPos.index;
        const nextGuide = CHALLENGE_ROUTE_GUIDES[nextPos.index] || { guide: nextPos.desc };
        const msg = customMessage || `Luar biasa! Misi ${pos.name} selesai. Target selanjutnya adalah ${nextPos.name}. ${nextGuide.guide} Ikuti rutenya di peta!`;
        nesaVoice.speak(msg);
        this.renderChallengeCards();
        this.updateChallengeRouteGuideCard(nextPos, nextGuide);
      } else {
        const msg = `Selamat ${this.userName}! Anda telah menuntaskan seluruh 6 Pos Misi di Hutan UNESA! Anda berhak menjadi Duta Kelestarian Hutan UNESA!`;
        nesaVoice.speak(msg);
        this.showToast('🏆 SEMUA 6/6 MISI TERCAPAI!');
        this.renderChallengeCards();
      }
    } else {
      alert(customMessage || `Kata kunci salah! Pastikan bertanya ke penjaga pos.`);
      input.focus();
    }
  }

  showChallengePosCard(index) {
    const navTabMisi = document.getElementById('nav-tab-challenge-misi');
    const navTabMap = document.getElementById('nav-tab-challenge-map');
    const cardsContainer = document.getElementById('challenge-cards-container');
    const mapContainer = document.getElementById('challenge-map-subview');

    if (navTabMisi) navTabMisi.classList.add('is-active');
    if (navTabMap) navTabMap.classList.remove('is-active');
    if (cardsContainer) cardsContainer.style.display = 'flex';
    if (mapContainer) mapContainer.classList.remove('is-visible');

    this.challengeState.activePosIndex = index;
    this.renderChallengeCards();

    // Scroll ke card aktif jika memungkinkan
    setTimeout(() => {
      const activeInput = document.getElementById(`input-passcode-${this.challengeState.positions[index - 1]?.id}`);
      if (activeInput) {
        activeInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        activeInput.focus();
      }
    }, 200);
  }

  /**
   * Dialog: Nesa bertanya mau mulai dari pos mana saat masuk Mode Berpetualang
   */
  openChallengeStartSelector() {
    const modal = document.getElementById('challenge-start-modal');
    if (modal) {
      modal.classList.add('is-open');
    }
    this.renderChallengePosSelectionList();

    const askText = `Halo ${this.userName || 'Petualang'}! Di Mode Berpetualang, kamu mau mulai dari pos mana dulu? Pilih pos pertamamu dan aku akan langsung memandu rutenya!`;
    nesaVoice.speak(askText);
  }

  /**
   * Render daftar pilihan pos 1 sampai 6 di dalam modal
   */
  renderChallengePosSelectionList() {
    const listContainer = document.getElementById('challenge-pos-selection-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    this.challengeState.positions.forEach(pos => {
      const btn = document.createElement('button');
      btn.className = `challenge-pos-select-btn ${pos.index === 1 ? 'is-suggested' : ''}`;
      
      const guide = CHALLENGE_ROUTE_GUIDES[pos.index];
      const hint = guide ? guide.shortHint : pos.title;

      btn.innerHTML = `
        <div class="pos-btn-num-badge">${pos.index}</div>
        <div class="pos-btn-info">
          <div class="pos-btn-name-row">
            <span class="pos-btn-name">${pos.name}</span>
            ${pos.index === 1 ? '<span class="badge-rekomendasi">Disarankan</span>' : ''}
          </div>
          <div class="pos-btn-sub">${pos.title} • ${hint}</div>
        </div>
      `;

      btn.addEventListener('click', () => {
        this.selectStartingPos(pos.index);
      });

      listContainer.appendChild(btn);
    });
  }

  /**
   * Eksekusi pemilihan pos awal:
   * 1. Tutup modal
   * 2. Set pos aktif
   * 3. Beralih ke peta rute
   * 4. Gambar rute dan jelaskan rute via TTS otomatis
   */
  selectStartingPos(posIndex) {
    const modal = document.getElementById('challenge-start-modal');
    if (modal) modal.classList.remove('is-open');

    this.challengeState.activePosIndex = posIndex;
    this.renderChallengeCards();

    // Beralih ke tampilan Peta Rute otomatis
    this.showChallengeMapSubView(false);

    const pos = this.challengeState.positions.find(p => p.index === posIndex);
    if (!pos) return;

    const guideInfo = CHALLENGE_ROUTE_GUIDES[posIndex] || {
      guide: pos.desc,
      shortHint: pos.name
    };

    // Update floating guide card di peta
    this.updateChallengeRouteGuideCard(pos, guideInfo);

    // Suara Nesa menjelaskan rute ke pos pertama secara otomatis
    const routeExplanation = `Bagus ${this.userName || ''}! Kita mulai petualangan dari ${pos.name}. ${guideInfo.guide} Rutenya sudah tampil di peta. Ikuti garis panduan menuju ke sana ya!`;
    nesaVoice.speak(routeExplanation);

    this.showToast(`🎯 Rute ke ${pos.name}`);
  }

  /**
   * Tampilkan subview peta rute pos dan gambar jalurnya
   */
  showChallengeMapSubView(speakGuide = false) {
    this.setAvatarState('compact');
    const navTabMisi = document.getElementById('nav-tab-challenge-misi');
    const navTabMap = document.getElementById('nav-tab-challenge-map');
    const cardsContainer = document.getElementById('challenge-cards-container');
    const mapContainer = document.getElementById('challenge-map-subview');

    if (navTabMap) navTabMap.classList.add('is-active');
    if (navTabMisi) navTabMisi.classList.remove('is-active');
    if (cardsContainer) cardsContainer.style.display = 'none';
    if (mapContainer) mapContainer.classList.add('is-visible');

    const activePos = this.challengeState.positions.find(p => p.index === this.challengeState.activePosIndex) || this.challengeState.positions[0];
    const guideInfo = CHALLENGE_ROUTE_GUIDES[activePos.index] || { guide: activePos.desc, shortHint: activePos.name };

    this.updateChallengeRouteGuideCard(activePos, guideInfo);

    if (speakGuide) {
      this.speakActiveChallengeRoute();
    }

    setTimeout(() => {
      nesaMap.initMap('challenge-map-container');
      nesaMap.renderChallengeMarkers(
        this.challengeState.positions,
        this.challengeState.activePosIndex,
        (pos) => {
          this.showChallengePosCard(pos.index);
        }
      );

      // Gambar rute ke pos aktif
      if (activePos) {
        nesaMap.drawRouteTo(activePos.lat, activePos.lng, activePos.name);
      }
      if (nesaMap.map) nesaMap.map.invalidateSize();
    }, 150);
  }

  /**
   * Perbarui card informasi panduan rute melayang di peta
   */
  updateChallengeRouteGuideCard(pos, guideInfo) {
    const badgeEl = document.getElementById('challenge-guide-pos-badge');
    const nameEl = document.getElementById('challenge-guide-pos-name');
    const missionEl = document.getElementById('challenge-guide-mission-title');
    const descEl = document.getElementById('challenge-guide-route-desc');

    if (badgeEl) badgeEl.textContent = `Pos ${pos.index}`;
    if (nameEl) nameEl.textContent = pos.name.replace(/^Pos \d+:\s*/, '');
    if (missionEl) missionEl.textContent = pos.title;
    if (descEl) descEl.textContent = guideInfo.guide;
  }

  /**
   * Ucapkan kembali panduan rute pos aktif
   */
  speakActiveChallengeRoute() {
    const pos = this.challengeState.positions.find(p => p.index === this.challengeState.activePosIndex);
    if (!pos) return;

    const guideInfo = CHALLENGE_ROUTE_GUIDES[pos.index] || { guide: pos.desc };
    const speech = `Panduan rute menuju ${pos.name}: ${guideInfo.guide}. Ikuti garis petunjuk arah di peta.`;
    nesaVoice.speak(speech);
  }

  /**
   * Update UI Step Navigasi Suara Jogging
   */
  updateJoggingStepUI() {
    const steps = NESA_DATA.joggingTrack.voiceSteps;
    const curIdx = this.joggingState.currentStepIndex;
    const currentStep = steps[curIdx];

    const badge = document.getElementById('jogging-nav-step-badge');
    const title = document.getElementById('jogging-nav-step-title');
    const prompt = document.getElementById('jogging-nav-prompt-text');

    if (badge) badge.textContent = `Langkah ${curIdx + 1}/${steps.length}`;
    if (title) title.textContent = currentStep.title;
    if (prompt) prompt.textContent = `"${currentStep.prompt}"`;

    // Perbarui posisi titik avatar pengguna ke koordinat checkpoint
    const coords = NESA_DATA.joggingTrack.coordinates;
    const targetCoord = coords[Math.min(curIdx, coords.length - 1)];
    nesaMap.updateUserPosition(targetCoord[0], targetCoord[1]);
  }

  navigateJoggingStep(delta) {
    const steps = NESA_DATA.joggingTrack.voiceSteps;
    const newIdx = this.joggingState.currentStepIndex + delta;

    if (newIdx >= 0 && newIdx < steps.length) {
      this.joggingState.currentStepIndex = newIdx;
      this.updateJoggingStepUI();
      this.speakJoggingCue();
    }
  }

  speakJoggingCue() {
    const steps = NESA_DATA.joggingTrack.voiceSteps;
    const currentStep = steps[this.joggingState.currentStepIndex];
    if (currentStep) {
      nesaVoice.speak(currentStep.prompt);
    }
  }

  openDrawer() {
    this.setAvatarState('compact');
    const drawerAiGuide = document.getElementById('drawer-ai-guide');
    const navTabFreeGuide = document.getElementById('nav-tab-free-guide');
    const navTabFreeMap = document.getElementById('nav-tab-free-map');
    if (drawerAiGuide) drawerAiGuide.classList.add('is-open');
    if (navTabFreeGuide) navTabFreeGuide.classList.add('is-active');
    if (navTabFreeMap) navTabFreeMap.classList.remove('is-active');
  }

  closeDrawer() {
    const drawerAiGuide = document.getElementById('drawer-ai-guide');
    const navTabFreeGuide = document.getElementById('nav-tab-free-guide');
    const navTabFreeMap = document.getElementById('nav-tab-free-map');
    if (drawerAiGuide) drawerAiGuide.classList.remove('is-open');
    if (navTabFreeGuide) navTabFreeGuide.classList.remove('is-active');
    if (navTabFreeMap) navTabFreeMap.classList.add('is-active');

    const navCard = document.getElementById('free-nav-active-card');
    if (!navCard || !navCard.classList.contains('is-active')) {
      this.setAvatarState('full');
    }
  }

  showNavigationFloatingCard(name, activeRoute) {
    this.setAvatarState('compact');
    const navCard = document.getElementById('free-nav-active-card');
    const titleEl = document.getElementById('free-nav-dest-name');
    const distEl = document.getElementById('free-nav-dest-distance');
    if (navCard && titleEl) {
      titleEl.textContent = name;
      if (distEl && activeRoute) {
        distEl.textContent = `~${activeRoute.distMeters || 120} m (±${activeRoute.estMinutes || 2} mnt)`;
      }
      navCard.classList.add('is-active');
    }
  }

  /**
   * Navigasi langsung ke titik POI di peta
   */
  routeToPoint(lat, lng, name, shouldSpeak = true) {
    if (this.currentScreen !== 'screen-free-mode') {
      this.showScreen('screen-free-mode');
    }

    // Selalu tutup drawer AI Guide agar peta dan garis navigasi tampil penuh dan jelas
    this.closeDrawer();

    const executeRoute = () => {
      if (window.nesaMap) {
        if (!window.nesaMap.map || window.nesaMap.currentContainerId !== 'free-map-container') {
          window.nesaMap.initMap('free-map-container');
        }
        const activeRoute = window.nesaMap.drawRouteTo(lat, lng, name);
        this.showNavigationFloatingCard(name, activeRoute);
      }
    };

    // Beri sedikit jeda transisi rendering map
    setTimeout(executeRoute, 120);

    if (shouldSpeak) {
      const msg = `Menampilkan rute menuju ${name}. Ikuti garis panduan di peta.`;
      nesaVoice.speak(msg);
    }
    this.showToast(`🧭 Rute ke ${name} aktif`);
  }

  /**
   * Handler pertanyaan teks / suara pengguna
   */
  handleUserVoiceQuery(transcript) {
    const text = transcript.toLowerCase().trim();
    const bubble = document.getElementById('drawer-chat-bubble');

    let reply = '';

    // Perintah suara untuk menghentikan / menjeda mode hands-free audio call
    if (text.includes('stop') || text.includes('berhenti') || text.includes('cukup') || text.includes('diam') || text.includes('matikan suara') || text.includes('matikan mic') || text.includes('matikan audio')) {
      nesaVoice.setCallMode(false);
      reply = 'Baik, mode audio dua arah telah dijeda. Ketuk tombol audio di kanan bawah kapan saja jika ingin berbicara lagi ya!';
      if (bubble) bubble.textContent = `Nesa: "${reply}"`;
      nesaVoice.speak(reply);
      return;
    }

    // Navigasi Mode via Suara Real-time (dari Layar Greeting atau layar manapun)
    if (text.includes('eksplorasi') || text.includes('bebas') || text.includes('mode satu') || text.includes('peta kampus')) {
      this.showScreen('screen-free-mode');
      reply = 'Mode Eksplorasi Bebas aktif! Anda dapat melihat seluruh Musholla, Parkiran, Toilet, dan Gerbang di Hutan UNESA.';
      if (bubble) bubble.textContent = `Nesa: "${reply}"`;
      nesaVoice.speak(reply);
      return;
    }

    if (text.includes('berpetualang') || text.includes('petualang') || text.includes('tantangan') || text.includes('misi') || text.includes('mode dua')) {
      this.showScreen('screen-challenge-mode');
      this.openChallengeStartSelector();
      return;
    }

    if (text.includes('jogging') || text.includes('lari') || text.includes('olahraga') || text.includes('mode tiga') || text.includes('track')) {
      this.showScreen('screen-jogging-mode');
      reply = 'Mode Jogging Hutan UNESA siap! Jalur 2,3 kilometer telah dipetakan mengitari danau dan kanopi rimbun.';
      if (bubble) bubble.textContent = `Nesa: "${reply}"`;
      nesaVoice.speak(reply);
      return;
    }

    // Kembali ke Menu Utama
    if (text.includes('kembali') || text.includes('menu utama') || text.includes('pilih mode')) {
      this.showScreen('screen-greeting');
      reply = 'Kembali ke menu utama. Mau mulai dari eksplorasi bebas, berpetualang, atau jogging?';
      if (bubble) bubble.textContent = `Nesa: "${reply}"`;
      nesaVoice.speak(reply);
      return;
    }

    // Navigasi Pos di Mode Berpetualang
    if (text.includes('pos 1') || text.includes('pos satu') || text.includes('rektorat')) {
      if (this.currentScreen !== 'screen-challenge-mode') this.showScreen('screen-challenge-mode');
      this.selectStartingPos(1);
      return;
    } else if (text.includes('pos 2') || text.includes('pos dua') || text.includes('danau')) {
      if (this.currentScreen !== 'screen-challenge-mode') this.showScreen('screen-challenge-mode');
      this.selectStartingPos(2);
      return;
    } else if (text.includes('pos 3') || text.includes('pos tiga')) {
      if (this.currentScreen !== 'screen-challenge-mode') this.showScreen('screen-challenge-mode');
      this.selectStartingPos(3);
      return;
    } else if (text.includes('pos 4') || text.includes('pos empat')) {
      if (this.currentScreen !== 'screen-challenge-mode') this.showScreen('screen-challenge-mode');
      this.selectStartingPos(4);
      return;
    } else if (text.includes('pos 5') || text.includes('pos lima')) {
      if (this.currentScreen !== 'screen-challenge-mode') this.showScreen('screen-challenge-mode');
      this.selectStartingPos(5);
      return;
    } else if (text.includes('pos 6') || text.includes('pos enam') || text.includes('gelora')) {
      if (this.currentScreen !== 'screen-challenge-mode') this.showScreen('screen-challenge-mode');
      this.selectStartingPos(6);
      return;
    }

    // Kontrol Jogging via Suara
    if (this.currentScreen === 'screen-jogging-mode') {
      if (text.includes('lanjut') || text.includes('depan') || text.includes('berikutnya')) {
        this.navigateJoggingStep(1);
        return;
      }
      if (text.includes('sebelumnya') || text.includes('lalu') || text.includes('mundur')) {
        this.navigateJoggingStep(-1);
        return;
      }
      if (text.includes('dengar') || text.includes('ulang')) {
        this.speakJoggingCue();
        return;
      }
    }

    // Deteksi Spesifik Lokasi Satwa & Kandang Hewan (Langsung buat rute di peta)
    const animalSpotMap = [
      { keys: ['rusa totol', 'iguana', 'penangkaran'], id: 'LOC007' },
      { keys: ['rusa'], id: 'LOC008' },
      { keys: ['ayam', 'kandang ayam'], id: 'LOC002' },
      { keys: ['merak', 'kandang merak'], id: 'LOC010' },
      { keys: ['angsa', 'bebek'], id: 'LOC012' },
      { keys: ['merpati', 'burung dara'], id: 'LOC014' },
      { keys: ['observasi burung', 'flora'], id: 'LOC001' },
      { keys: ['danau bunga', 'danau bunga kertas'], id: 'LOC005' },
      { keys: ['danau kecil'], id: 'LOC009' }
    ];

    let targetAnimalSpot = null;
    for (const item of animalSpotMap) {
      if (item.keys.some(k => text.includes(k))) {
        targetAnimalSpot = (NESA_DATA.spots || []).find(s => s.id === item.id);
        if (targetAnimalSpot) break;
      }
    }

    if (targetAnimalSpot) {
      this.routeToPoint(targetAnimalSpot.lat, targetAnimalSpot.lng, targetAnimalSpot.name, false);
      this.highlightSpotById(targetAnimalSpot.id, false);
      reply = `Rute menuju ${targetAnimalSpot.name} telah ditampilkan di peta. Silakan ikuti garis panduannya.`;
      if (bubble) bubble.textContent = `Nesa: "${reply}"`;
      nesaVoice.speak(reply);
      return;
    }

    // Pencarian Fasilitas Kampus & Hutan UNESA
    if (text.includes('musholla') || text.includes('masjid') || text.includes('sholat')) {
      const item = NESA_DATA.poi.musholla[0];
      this.routeToPoint(item.lat, item.lng, item.name, false);
      this.highlightSpotById(item.id, false);
      reply = `Aku telah menunjukkan rute ke ${item.name} di peta.`;
    } else if (text.includes('toilet') || text.includes('kamar mandi') || text.includes('wc')) {
      const item = NESA_DATA.poi.toilet[0];
      this.routeToPoint(item.lat, item.lng, item.name, false);
      this.highlightSpotById(item.id, false);
      reply = `Toilet terdekat ada di ${item.name}. Rutenya sudah tampil di peta!`;
    } else if (text.includes('parkir') || text.includes('motor') || text.includes('mobil')) {
      const item = NESA_DATA.poi.parkiran[0];
      this.routeToPoint(item.lat, item.lng, item.name, false);
      this.highlightSpotById(item.id, false);
      reply = `Lokasi ${item.name} telah dipetakan untukmu.`;
    } else if (text.includes('hutan') || text.includes('trekking') || text.includes('pohon')) {
      const item = NESA_DATA.poi.hutan[0];
      this.routeToPoint(item.lat, item.lng, item.name, false);
      this.highlightSpotById(item.id, false);
      reply = `Menuju ke ${item.name}. Nikmati kesegaran udara kanopi Hutan UNESA!`;
    } else if (text.includes('gerbang') || text.includes('pintu masuk') || text.includes('gate')) {
      const item = NESA_DATA.poi.gerbang[0];
      this.routeToPoint(item.lat, item.lng, item.name, false);
      this.highlightSpotById(item.id, false);
      reply = `Menampilkan rute ke ${item.name}. Selamat datang di kampus UNESA!`;
    } else {
      // Pertanyaan edukasi/flora/fauna/arah dialirkan ke Gemini AI via backend
      this.askNesaAI(transcript);
      return;
    }

    if (bubble) {
      bubble.textContent = `Nesa: "${reply}"`;
    }
    nesaVoice.speak(reply);
  }

  /**
   * Tanya jawab cerdas ke Gemini AI backend (RAG + Lokasi)
   */
  async askNesaAI(query) {
    const bubble = document.getElementById('drawer-chat-bubble');
    if (bubble) {
      bubble.textContent = 'Nesa: "Sedang berpikir... ✨"';
    }

    try {
      const mode = (this.currentScreen === 'screen-free-mode') ? 'free'
                 : (this.currentScreen === 'screen-challenge-mode' ? 'challenge' : 'none');

      const userCoords = nesaMap?.userCoordinates;
      const location = (userCoords && Array.isArray(userCoords)) ? { lat: userCoords[0], lng: userCoords[1] } : null;

      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId || 'guest',
          message: query,
          mode: mode,
          location: location
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Debug Benchmark Latency Display
      if (data.benchmarks) {
        const b = data.benchmarks;
        const totalSec = (b.total_ms / 1000).toFixed(2);
        const llmSec = (b.llm_ms / 1000).toFixed(2);
        const ttsSec = (b.tts_ms / 1000).toFixed(2);
        console.log(`[AI Latency] Total: ${totalSec}s | LLM: ${llmSec}s | TTS: ${ttsSec}s | RAG: ${b.rag_ms}ms`);

        const badge = document.getElementById('ai-latency-badge');
        const badgeText = document.getElementById('ai-latency-text');
        if (badge && badgeText) {
          badge.style.display = 'block';
          badgeText.textContent = `Total: ${totalSec}s (LLM: ${llmSec}s, TTS: ${ttsSec}s)`;
        }
      }

      const reply = data.speech || 'Halo, ada yang ingin kamu tanyakan tentang Hutan UNESA?';
      if (bubble) {
        bubble.textContent = `Nesa: "${reply}"`;
      }
      nesaVoice.speak(reply);

      // Jalankan aksi responsif dari AI
      if (data.action === 'show_map') {
        if (this.currentScreen !== 'screen-free-mode') this.showScreen('screen-free-mode');
      } else if (data.action === 'start_challenge') {
        if (this.currentScreen !== 'screen-challenge-mode') this.showScreen('screen-challenge-mode');
      } else if (data.action === 'show_spot_detail' && data.action_payload && data.action_payload.spot_id) {
        if (this.currentScreen !== 'screen-free-mode') this.showScreen('screen-free-mode');
        this.highlightSpotById(data.action_payload.spot_id);
      } else if (['show_chart', 'show_data_panel', 'show_image', 'show_visual'].includes(data.action)) {
        this.setAvatarState('compact');
      }
    } catch (err) {
      console.warn('[NesaMate AI] Error pemanggilan API chat:', err);
      const fallbackReply = `Aku mendengar "${query}". Mau menjelajahi peta hutan atau ikut tantangan seru?`;
      if (bubble) {
        bubble.textContent = `Nesa: "${fallbackReply}"`;
      }
      nesaVoice.speak(fallbackReply);
    }
  }

  /**
   * Sorot titik spot di peta Leaflet berdasarkan spot_id dari AI & gambar rute
   */
  highlightSpotById(spotId, drawRoute = true) {
    if (!spotId) return;
    const cleanId = String(spotId).toUpperCase();

    // Beralih ke layar peta Free Mode jika sedang di layar lain
    if (this.currentScreen !== 'screen-free-mode') {
      this.showScreen('screen-free-mode');
    }
    this.closeDrawer();

    const spot = window.nesaMap ? window.nesaMap.findSpotAnywhere(cleanId) : null;
    if (spot && drawRoute) {
      this.routeToPoint(spot.lat, spot.lng, spot.name, false);
    }

    setTimeout(() => {
      if (window.nesaMap) {
        window.nesaMap.highlightSpot(cleanId);
      }
    }, 350);
  }

  /**
   * Toast notification pill
   */
  showToast(message) {
    const toast = document.getElementById('nesa-toast-pill');
    if (toast) {
      toast.textContent = message;
      toast.classList.add('is-show');
      setTimeout(() => {
        toast.classList.remove('is-show');
      }, 2400);
    }
  }
}

// Inisialisasi aplikasi dan render Live2D saat DOM siap (Landing Page)
window.addEventListener('DOMContentLoaded', () => {
  initLive2DAvatar();
  window.nesaApp = new NesaApp();
});
