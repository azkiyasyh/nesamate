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
    guide: 'Arahkan langkahmu ke stan Pixora di kawasan Hutan UNESA. Coba transformasi potret wajah AI dan minta kata kunci dari tim penjaga.',
    shortHint: 'Stan Projek TRM Pixora'
  },
  2: {
    guide: 'Berjalanlah menuju stan BIOVA di kawasan Hutan UNESA. Temui tim penjaga untuk menyelesaikan tantangan dan mendapatkan kata kunci.',
    shortHint: 'Stan Projek TRM BIOVA'
  },
  3: {
    guide: 'Menujulah ke stan Wildex di Hutan UNESA. Coba Mode Explore atau Mode Quest pendeteksi satwa bersama tim penjaga.',
    shortHint: 'Stan Projek TRM Wildex'
  },
  4: {
    guide: 'Arahkan langkahmu ke stan BioSphere di Hutan UNESA. Amati data sensor IoT suhu, kelembapan, dan pH air bersama tim.',
    shortHint: 'Stan Projek TRM BioSphere'
  },
  5: {
    guide: 'Berjalanlah ke stan Animora di Hutan UNESA. Pindai kartu hewan AR 3D dan jawab kuisnya untuk meraih kata kunci.',
    shortHint: 'Stan Projek TRM Animora'
  },
  6: {
    guide: 'Arahkan langkahmu ke stan SmartPark Vision di sisi utara Hutan Kota Unesa. Lihat live feed deteksi aktivitas YOLOv8 bersama tim.',
    shortHint: 'Stan Projek TRM SmartPark Vision'
  }
};

// ========================================================
// LIVE2D AVATAR CONTROLLER (PixiJS v6.5.8 + Cubism v4)
// ========================================================
let pixiApp = null;
let nesaModel = null;
let isModelLoading = false;

let _avatarCurrentState = 'full'; // 'full' | 'pip'
let _avatarLastFullSlot = null;   // Menyimpan slot elemen tempat avatar saat mode full

function _rescaleAvatarForPip(size = 96) {
  if (!pixiApp || !nesaModel) return;
  try {
    pixiApp.renderer.resize(size, size);
    nesaModel.anchor.set(0.5, 0.5);
    nesaModel.x = size / 2;

    // Zoom 1.7x agar menampilkan setengah badan (antlers, kepala, wajah, & dada/vest) seperti video call
    const baseW = nesaModel.internalModel?.originalWidth || nesaModel.width || 400;
    const baseH = nesaModel.internalModel?.originalHeight || nesaModel.height || 400;
    const baseScale = Math.min((size - 4) / baseW, (size - 4) / baseH);
    const zoomHalfBody = 1.7;
    const scale = baseScale * zoomHalfBody;
    nesaModel.scale.set(scale, scale);

    // Naikkan posisi vertikal agar avatar tidak tenggelam:
    // Tanduk & kepala berada manis di atas, wajah & rompi dada tampil jelas di tengah frame
    nesaModel.y = Math.round(size * 0.54); // ~52px pada canvas 96px
  } catch (e) {}
}

function _rescaleAvatarForFull() {
  if (!pixiApp || !nesaModel) return;
  try {
    const canvasSize = 400;
    const targetRenderDim = 385;
    pixiApp.renderer.resize(canvasSize, canvasSize);
    nesaModel.anchor.set(0.5, 0.5);
    nesaModel.x = canvasSize / 2;
    nesaModel.y = canvasSize / 2 + 10;
    const baseW = nesaModel.internalModel?.originalWidth || nesaModel.width || 400;
    const baseH = nesaModel.internalModel?.originalHeight || nesaModel.height || 400;
    const scale = Math.min(targetRenderDim / baseW, targetRenderDim / baseH);
    nesaModel.scale.set(scale, scale);
  } catch (e) {}
}

function setAvatarState(state) {
  const avatarContainer = document.getElementById('nesa-avatar-container');
  const pipContainer = document.getElementById('nesa-pip-container');
  const pipFrame = pipContainer ? pipContainer.querySelector('.nesa-pip-video-frame') : null;

  if (!avatarContainer) return;

  // Normalisasi 'compact' → 'pip'
  if (state === 'compact') state = 'pip';

  const currentScreen = window.nesaApp ? window.nesaApp.currentScreen : 'screen-landing';
  const challengeIsInIntro = window.nesaApp?.challengeState?.isInIntro;

  // Layar yang force-PiP: free mode, jogging, challenge setelah intro selesai
  const isForceMapScreen = currentScreen === 'screen-free-mode' ||
                           currentScreen === 'screen-jogging-mode' ||
                           (currentScreen === 'screen-challenge-mode' && !challengeIsInIntro);

  // Jika state 'full' dipanggil saat di layar peta, paksa jadi 'pip'
  // 'hidden' dibiarkan apa adanya (saat modal pilih pos terbuka)
  if (state === 'full' && isForceMapScreen) {
    state = 'pip';
  }

  _avatarCurrentState = state;

  if (state === 'pip') {
    // Mode PiP: Avatar mengecil di pojok kiri bawah (Video Call Style)
    if (pipContainer && pipFrame) {
      if (!pipFrame.contains(avatarContainer)) {
        if (avatarContainer.parentElement && avatarContainer.parentElement !== pipFrame) {
          _avatarLastFullSlot = avatarContainer.parentElement;
        }
        pipFrame.appendChild(avatarContainer);
      }
      pipContainer.classList.add('is-pip-active');
      _rescaleAvatarForPip(96);
    }
  } else if (state === 'full') {
    // Mode Full: Avatar kembali ke slot utama layar
    if (pipContainer) pipContainer.classList.remove('is-pip-active');
    const challengeSlot = document.getElementById('challenge-intro-avatar-slot');
    const targetSlot = (currentScreen === 'screen-challenge-mode' && challengeSlot)
                       ? challengeSlot
                       : (_avatarLastFullSlot ||
                          document.getElementById('greeting-avatar-slot') ||
                          document.getElementById('landing-avatar-slot'));
    if (targetSlot && !targetSlot.contains(avatarContainer)) {
      targetSlot.appendChild(avatarContainer);
    }
    _rescaleAvatarForFull();
  } else {
    // Mode 'hidden': Sembunyikan PiP, avatar tidak muncul di manapun
    if (pipContainer) pipContainer.classList.remove('is-pip-active');
  }
}
window.setAvatarState = setAvatarState;

function attachAvatarToScreen(screenId) {
  const container = document.getElementById('nesa-avatar-container');
  if (!container) return;

  // Jangan paksa pindah jika sedang PiP atau hidden
  if (_avatarCurrentState === 'pip' || _avatarCurrentState === 'hidden') return;

  if (screenId === 'screen-landing') {
    const landingSlot = document.getElementById('landing-avatar-slot');
    if (landingSlot && !landingSlot.contains(container)) {
      _avatarLastFullSlot = landingSlot;
      landingSlot.appendChild(container);
    }
  } else if (screenId === 'screen-greeting') {
    const greetingSlot = document.getElementById('greeting-avatar-slot');
    if (greetingSlot && !greetingSlot.contains(container)) {
      _avatarLastFullSlot = greetingSlot;
      greetingSlot.appendChild(container);
    }
  } else if (screenId === 'screen-challenge-mode') {
    const challengeSlot = document.getElementById('challenge-intro-avatar-slot');
    if (challengeSlot && !challengeSlot.contains(container)) {
      _avatarLastFullSlot = challengeSlot;
      challengeSlot.appendChild(container);
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

  // Resolusi kanvas virtual 1:1 sempurna agar avatar selalu proporsional (anti-penyet)
  const canvasSize = 400;
  const targetRenderDim = 385; // Target ukuran proporsional Nesa

  // Jika model & pixiApp sudah ada dan terpasang aktif di canvas
  if (pixiApp && nesaModel && pixiApp.view === canvas && canvas.parentElement) {
    try {
      pixiApp.renderer.resize(canvasSize, canvasSize);
      nesaModel.anchor.set(0.5, 0.5);
      nesaModel.x = canvasSize / 2;
      nesaModel.y = canvasSize / 2 + 10;
      const baseW = nesaModel.internalModel?.originalWidth || nesaModel.width || 400;
      const baseH = nesaModel.internalModel?.originalHeight || nesaModel.height || 400;
      const scale = Math.min(targetRenderDim / baseW, targetRenderDim / baseH);
      nesaModel.scale.set(scale, scale);
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
      width: canvasSize,
      height: canvasSize
    });

    // 2. Load model Live2D Nesa langsung dari assets utama
    let loadedModel = null;
    try {
      loadedModel = await PIXI.live2d.Live2DModel.from('assets/AVA Nesa.model3.json', { autoInteract: false });
    } catch (e1) {
      console.error('[Live2D] Gagal memuat AVA Nesa.model3.json:', e1);
    }

    if (!loadedModel) {
      throw new Error('Model Live2D tidak dapat dimuat dari assets');
    }

    nesaModel = loadedModel;
    pixiApp.stage.addChild(nesaModel);

    // 3. KUNCI POSISI DI TENGAH (Anchor & Alignment rapi)
    nesaModel.anchor.set(0.5, 0.5);
    nesaModel.x = canvasSize / 2;
    nesaModel.y = canvasSize / 2 + 10; // Posisi manis tepat di tengah simetris

    // 4. KUNCI SKALA 100% PROPORSIONAL (Skala X dan Y identik sempurna)
    const baseW = nesaModel.internalModel?.originalWidth || nesaModel.width || 400;
    const baseH = nesaModel.internalModel?.originalHeight || nesaModel.height || 400;
    const scale = Math.min(
      targetRenderDim / baseW,
      targetRenderDim / baseH
    );
    nesaModel.scale.set(scale, scale);

    nesaModel.interactive = true;
    window.nesaModel = nesaModel;
    window.pixiApp = pixiApp;

    // Bersihkan fallback image jika ada
    const existingFallback = document.getElementById('nesa-avatar-fallback');
    if (existingFallback) existingFallback.remove();

    console.log("SUCCESS: Live2D Nesa berhasil dipasang besar dan proporsional simetris!");

    // Sesuaikan skala jika model selesai dimuat dalam state PiP
    if (_avatarCurrentState === 'pip') {
      _rescaleAvatarForPip(96);
    }
  } catch (err) {
    console.error("Gagal load Live2D Nesa:", err);
    // Tampilkan avatar fallback tekstur jika Live2D gagal agar tampilan tidak kosong
    if (!nesaModel && container) {
      let fallbackImg = document.getElementById('nesa-avatar-fallback');
      if (!fallbackImg) {
        fallbackImg = document.createElement('img');
        fallbackImg.id = 'nesa-avatar-fallback';
        fallbackImg.src = 'assets/AVA Nesa.2048/texture_00.png';
        fallbackImg.style.width = '320px';
        fallbackImg.style.height = '320px';
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

// Listener resize window/orientasi layar agar avatar selalu 1:1 proporsional
window.addEventListener('resize', () => {
  if (pixiApp && nesaModel) {
    if (_avatarCurrentState === 'pip') {
      _rescaleAvatarForPip(96);
    } else {
      _rescaleAvatarForFull();
    }
  }
});

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
    this.currentMapView = '2d'; // '2d' | '3d' — Mode tampilan peta di Free Mode
    this.routeRequestId = 0;

    // Challenge Mode State
    this.challengeState = {
      isInIntro: true,
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
    this.currentScreen = screenId;

    const container = document.querySelector('.mobile-device-container');
    if (container) {
      container.classList.toggle('is-onboarding', screenId === 'screen-landing');
    }

    const pipContainer = document.getElementById('nesa-pip-container');
    if (pipContainer) {
      pipContainer.classList.remove('is-drawer-open');
    }

    // Layar yang menampilkan peta: avatar tetap tampil, mengecil dan menepi di kiri bawah (PiP Video Call)
    // Layar non-peta (landing / greeting / challenge intro): avatar kembali tampil besar di tengah slot layar
    const mapScreens = ['screen-free-mode', 'screen-jogging-mode'];

    if (mapScreens.includes(screenId)) {
      this.setAvatarState('pip');
    } else if (screenId === 'screen-challenge-mode') {
      if (this.challengeState.isInIntro) {
        this.setAvatarState('full');
      } else {
        this.setAvatarState('pip');
      }
    } else {
      this.setAvatarState('full');
    }

    const allScreens = document.querySelectorAll('.screen-view');
    allScreens.forEach(s => s.classList.remove('is-active'));

    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('is-active');
    }

    // Pindahkan container avatar ke slot layar jika mode full
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
      // Pastikan tampilan 3D berhenti jika screen meninggalkan free mode sebelumnya
      if (window.nesa3DMap && this.currentMapView !== '2d') {
        // Jangan ubah mode — user mungkin sengaja di 3D
      }
      // Jika sebelumnya di mode 3D namun baru pertama kali masuk, default ke 2D
      if (!this.currentMapView) {
        this.currentMapView = '2d';
      }
      setTimeout(() => {
        // Hanya init Leaflet jika tampilan aktif adalah 2D
        if (this.currentMapView === '2d') {
          nesaMap.initMap('free-map-container');
          if (nesaMap.map) nesaMap.map.invalidateSize();
        } else if (this.currentMapView === '3d') {
          // Re-trigger render loop 3D saat kembali ke layar
          if (window.nesa3DMap) window.nesa3DMap.show();
        }
      }, 150);
    } else if (screenId === 'screen-challenge-mode') {
      if (window.nesaMap) {
        window.nesaMap.clearJoggingTrack();
      }
      this.renderChallengeCards();
      if (this.challengeState.isInIntro) {
        this.showChallengeIntro();
      }
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
        this.challengeState.isInIntro = true;
        this.showScreen('screen-challenge-mode');
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
        if (this.currentMapView === '3d' && window.nesa3DMap) {
          window.nesa3DMap.focusOnUser();
          this.showToast('📍 Memfokuskan 3D ke posisi GPS Anda');
        } else {
          nesaMap.recenterCampus();
          this.showToast('📍 Menampilkan kawasan Hutan UNESA');
        }
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

    // Interaksi klik avatar PiP (Video Call Style)
    const pipContainer = document.getElementById('nesa-pip-container');
    if (pipContainer) {
      pipContainer.addEventListener('click', () => {
        if (this.currentScreen === 'screen-free-mode') {
          this.openDrawer();
          this.showToast('✨ Nesa siap membantu!');
        } else if (this.currentScreen === 'screen-challenge-mode') {
          this.speakActiveChallengeRoute();
        } else if (this.currentScreen === 'screen-jogging-mode') {
          this.speakJoggingCue();
        } else {
          this.showToast('✨ Nesa (Live Tour Guide)');
        }
      });
    }

    // Tombol tutup rute navigasi di floating banner
    if (btnCancelNav) {
      btnCancelNav.addEventListener('click', () => {
        if (window.nesaMap) window.nesaMap.clearRoute();
        // Juga bersihkan rute di tampilan 3D jika aktif
        if (window.nesa3DMap && this.currentMapView === '3d') window.nesa3DMap.clearRoute();
        const navCard = document.getElementById('free-nav-active-card');
        if (navCard) navCard.classList.remove('is-active');
        this.setAvatarState('pip');
        this.showToast('🧭 Navigasi rute ditutup');
      });
    }

    // -----------------------------------------------------------------
    // MAP VIEW TOGGLE: 2D ↔ 3D (Tombol Toggle di Top Bar Free Mode)
    // -----------------------------------------------------------------
    const btn2D = document.getElementById('btn-view-2d');
    const btn3D = document.getElementById('btn-view-3d');

    if (btn2D) {
      btn2D.addEventListener('click', () => {
        this.setMapViewMode('2d');
      });
    }

    if (btn3D) {
      btn3D.addEventListener('click', () => {
        this.setMapViewMode('3d');
      });
    }

    // 3D Quick Controls
    const btnResetView = document.getElementById('btn-3d-reset-view');
    if (btnResetView) {
      btnResetView.addEventListener('click', () => {
        if (window.nesa3DMap) {
          window.nesa3DMap.resetView();
          this.showToast('🎯 Sudut pandang kamera direset');
        }
      });
    }

    const selectRoute = document.getElementById('select-3d-route');
    if (selectRoute) {
      selectRoute.addEventListener('change', (e) => {
        const val = e.target.value;
        if (window.nesa3DMap) {
          window.nesa3DMap.setScenicRoute(val);
          this.showToast(`🗺️ Jalur "${e.target.options[e.target.selectedIndex].text}" diaktifkan`);
        }
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
        const modal = document.getElementById('challenge-start-modal');
        if (modal && modal.classList.contains('is-open')) {
          modal.classList.remove('is-open');
          if (this.challengeState.isInIntro) {
            this.showChallengeIntro();
            return;
          }
        }
        this.showScreen('screen-greeting');
      });
    }

    // Tombol di dalam intro: "Pilih Pos Petualangan"
    const btnStartChoose = document.getElementById('btn-challenge-start-choose');
    if (btnStartChoose) {
      btnStartChoose.addEventListener('click', () => {
        this.openChallengeStartSelector();
      });
    }

    // Tabs Subview: Tab Misi vs Tab Peta Rute
    const navTabMisi = document.getElementById('nav-tab-challenge-misi');
    const navTabMap = document.getElementById('nav-tab-challenge-map');
    const cardsContainer = document.getElementById('challenge-cards-container');
    const mapContainer = document.getElementById('challenge-map-subview');

    if (navTabMisi) {
      navTabMisi.addEventListener('click', () => {
        // User request: avatar PiP muncul di map dan section misi
        this.setAvatarState('pip');
        navTabMisi.classList.add('is-active');
        navTabMap.classList.remove('is-active');
        if (cardsContainer) cardsContainer.style.display = 'flex';
        if (mapContainer) mapContainer.classList.remove('is-visible');
      });
    }

    if (cardsContainer) {
      cardsContainer.addEventListener('focusin', (event) => {
        if (event.target.matches('.passcode-pill-input')) this.setAvatarState('pip');
      });
      cardsContainer.addEventListener('focusout', (event) => {
        if (!event.target.matches('.passcode-pill-input')) return;
        setTimeout(() => {
          if (!cardsContainer.querySelector('.passcode-pill-input:focus')) this.setAvatarState('pip');
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
        if (this.challengeState.isInIntro) {
          this.showChallengeIntro();
        } else {
          this.setAvatarState('pip');
        }
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
   * Tampilkan subview INTRO Mode Berpetualang:
   * Avatar full menyapa & menjelaskan, lalu muncul tombol "Pilih Pos"
   */
  showChallengeIntro() {
    this.challengeState.isInIntro = true;

    // Sembunyikan progress bar, kartu misi, peta, bottom nav → tampilkan intro
    const introSubview   = document.getElementById('challenge-intro-subview');
    const progressBanner = document.querySelector('#screen-challenge-mode .challenge-progress-banner');
    const cardsContainer = document.getElementById('challenge-cards-container');
    const mapContainer   = document.getElementById('challenge-map-subview');
    const bottomNav      = document.querySelector('#screen-challenge-mode .bottom-nav-bar');

    if (introSubview)   introSubview.style.display   = 'flex';
    if (progressBanner) progressBanner.style.display = 'none';
    if (cardsContainer) cardsContainer.style.display = 'none';
    if (mapContainer)   mapContainer.classList.remove('is-visible');
    if (bottomNav)      bottomNav.style.display      = 'none';

    // Avatar tampil FULL di slot intro (bukan PiP)
    const avatarContainer = document.getElementById('nesa-avatar-container');
    const pipContainer    = document.getElementById('nesa-pip-container');
    const introSlot       = document.getElementById('challenge-intro-avatar-slot');

    if (pipContainer) pipContainer.classList.remove('is-pip-active');
    if (introSlot && avatarContainer && !introSlot.contains(avatarContainer)) {
      _avatarLastFullSlot = introSlot;
      introSlot.appendChild(avatarContainer);
    }
    _avatarCurrentState = 'full';
    _rescaleAvatarForFull();

    // Ucapkan sapaan intro
  // Ucapkan sapaan intro
      const greeting = `Halo ${this.userName || 'Petualang'}! Di Mode Berpetualang, kamu bisa berkeliling dan menyelesaikan misi di setiap pos nya. Mau mulai dari pos mana dulu?`;
      nesaVoice.speak(greeting);

      const introText = document.getElementById('challenge-intro-speech-text');
      if (introText) {
        introText.textContent = `"${greeting}"`;
      }
    }

  /**
   * Dialog: Tampilkan modal pilihan pos (avatar TERSEMBUNYI saat modal terbuka)
   */
  openChallengeStartSelector() {
    // Sembunyikan avatar sepenuhnya saat user memilih pos (tidak PiP, tidak full)
    const pipContainer    = document.getElementById('nesa-pip-container');
    const avatarContainer = document.getElementById('nesa-avatar-container');
    if (pipContainer)    pipContainer.classList.remove('is-pip-active');
    if (avatarContainer) {
      _avatarLastFullSlot = avatarContainer.parentElement || document.getElementById('challenge-intro-avatar-slot');
    }
    _avatarCurrentState = 'hidden';

    const modal = document.getElementById('challenge-start-modal');
    if (modal) modal.classList.add('is-open');
    this.renderChallengePosSelectionList();
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

    // Keluar dari mode intro → sekarang masuk ke map/misi (PiP aktif)
    this.challengeState.isInIntro = false;

    // Sembunyikan intro subview, tampilkan kembali progress bar & bottom nav
    const introSubview   = document.getElementById('challenge-intro-subview');
    const progressBanner = document.querySelector('#screen-challenge-mode .challenge-progress-banner');
    const bottomNav      = document.querySelector('#screen-challenge-mode .bottom-nav-bar');
    if (introSubview)   introSubview.style.display   = 'none';
    if (progressBanner) progressBanner.style.display = '';
    if (bottomNav)      bottomNav.style.display      = '';

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
    // Avatar tampil kecil (PiP video call) di map & section misi
    this.setAvatarState('pip');
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
    this.setAvatarState('pip');
    const drawerAiGuide = document.getElementById('drawer-ai-guide');
    const pipContainer = document.getElementById('nesa-pip-container');
    const navTabFreeGuide = document.getElementById('nav-tab-free-guide');
    const navTabFreeMap = document.getElementById('nav-tab-free-map');
    if (drawerAiGuide) drawerAiGuide.classList.add('is-open');
    if (pipContainer) pipContainer.classList.add('is-drawer-open');
    if (navTabFreeGuide) navTabFreeGuide.classList.add('is-active');
    if (navTabFreeMap) navTabFreeMap.classList.remove('is-active');
  }

  closeDrawer() {
    const drawerAiGuide = document.getElementById('drawer-ai-guide');
    const pipContainer = document.getElementById('nesa-pip-container');
    const navTabFreeGuide = document.getElementById('nav-tab-free-guide');
    const navTabFreeMap = document.getElementById('nav-tab-free-map');
    if (drawerAiGuide) drawerAiGuide.classList.remove('is-open');
    if (pipContainer) pipContainer.classList.remove('is-drawer-open');
    if (navTabFreeGuide) navTabFreeGuide.classList.remove('is-active');
    if (navTabFreeMap) navTabFreeMap.classList.add('is-active');

    // Di mode peta (screen-free-mode / screen-jogging-mode), avatar tetap di mode PiP video call
    if (this.currentScreen === 'screen-free-mode' || this.currentScreen === 'screen-jogging-mode') {
      this.setAvatarState('pip');
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
        const hint = activeRoute.turnHint ? ` • ${activeRoute.turnHint}` : '';
        distEl.textContent = `~${activeRoute.distMeters || 120} m (±${activeRoute.estMinutes || 2} mnt)${hint}`;
      }
      navCard.classList.add('is-active');
    }
  }

  // ================================================================
  // KONTROL TAMPILAN 2D / 3D DIGITAL TWIN MAP (Free Mode only)
  // ================================================================

  /**
   * Beralih antara tampilan peta 2D (Leaflet) dan 3D (Three.js Digital Twin).
   * Menyembunyikan tampilan sebelumnya tanpa reload atau kehilangan state.
   * @param {'2d'|'3d'} mode
   */
  setMapViewMode(mode) {
    this.currentMapView = mode;

    const container2D = document.getElementById('free-map-container');
    const container3D = document.getElementById('free-map-3d-container');
    const btn2D = document.getElementById('btn-view-2d');
    const btn3D = document.getElementById('btn-view-3d');
    const quickControls = document.getElementById('map-3d-quick-controls');
    const poiFilterWrap = document.querySelector('.poi-filter-scroll-wrapper');
    const recenterBtn = document.getElementById('btn-free-recenter');

    if (mode === '3d') {
      // ───── Aktifkan 3D, Sembunyikan 2D ─────
      if (container2D) container2D.style.display = 'none';
      if (container3D) container3D.style.display = 'block';
      if (quickControls) quickControls.style.display = 'flex';
      // Sembunyikan filter POI yang khusus 2D
      if (poiFilterWrap) poiFilterWrap.style.display = 'none';
      if (recenterBtn) recenterBtn.style.display = '';

      // Update status tombol toggle
      if (btn2D) { btn2D.classList.remove('is-active'); }
      if (btn3D) { btn3D.classList.add('is-active'); }

      // Inisialisasi atau tampilkan kembali 3D map
      if (window.nesa3DMap) {
        // Hanya init jika belum pernah — renderer dipertahankan antar pergantian tampilan
        if (!window.nesa3DMap.renderer) {
          window.nesa3DMap.init('free-map-3d-container');
        } else {
          window.nesa3DMap.show();
        }
      }

      this.showToast('🌐 Tampilan Digital Twin 3D aktif');

    } else {
      // ───── Aktifkan 2D, Sembunyikan 3D ─────
      if (container2D) container2D.style.display = 'block';
      if (container3D) container3D.style.display = 'none';
      if (quickControls) quickControls.style.display = 'none';
      if (poiFilterWrap) poiFilterWrap.style.display = 'block';
      if (recenterBtn) recenterBtn.style.display = '';

      // Update status tombol toggle
      if (btn2D) { btn2D.classList.add('is-active'); }
      if (btn3D) { btn3D.classList.remove('is-active'); }

      // Hentikan render loop 3D saat tidak dipakai
      if (window.nesa3DMap) {
        window.nesa3DMap.hide();
      }

      // Pastikan Leaflet menyesuaikan ukuran setelah container kembali terlihat
      if (window.nesaMap && window.nesaMap.map) {
        setTimeout(() => {
          window.nesaMap.map.invalidateSize();
        }, 100);
      }

      this.showToast('📍 Tampilan Peta 2D aktif');
    }
  }

  /**
   * Menampilkan kartu navigasi floating di UI (digunakan oleh map3d.js)
   */
  showActiveNavCard(destinationName, distanceText) {
    const navCard = document.getElementById('free-nav-active-card');
    const destNameEl = document.getElementById('free-nav-dest-name');
    const distEl = document.getElementById('free-nav-dest-distance');
    if (navCard) navCard.classList.add('is-active');
    if (destNameEl) destNameEl.textContent = destinationName;
    if (distEl && distanceText) distEl.textContent = distanceText;
  }

  /**
   * Navigasi langsung ke titik POI di peta
   */
  routeToPoint(lat, lng, name, shouldSpeak = true) {
    const requestId = ++this.routeRequestId;

    if (this.currentScreen !== 'screen-free-mode') {
      this.showScreen('screen-free-mode');
    }

    // Selalu tutup drawer AI Guide agar peta dan garis navigasi tampil penuh dan jelas
    this.closeDrawer();

    const executeRoute = () => {
      if (requestId !== this.routeRequestId) return;
      if (window.nesaMap) {
        if (!window.nesaMap.map || window.nesaMap.currentContainerId !== 'free-map-container') {
          window.nesaMap.initMap('free-map-container');
        }
        const activeRoute = window.nesaMap.drawRouteTo(lat, lng, name);
        this.showNavigationFloatingCard(name, activeRoute);
      }
      // Sinkronisasi rute ke tampilan 3D jika model sudah dimuat (ikuti waypoints peta 2D 1:1)
      if (window.nesa3DMap && window.nesa3DMap.isLoaded) {
        const activeRoute = window.nesaMap?.activeRoute;
        if (activeRoute && Array.isArray(activeRoute.waypoints) && activeRoute.waypoints.length > 1) {
          window.nesa3DMap.drawRouteFromGPS(activeRoute.waypoints, name, true);
        } else if (window.nesaMap?.userCoordinates) {
          window.nesa3DMap.drawRouteFromGPS([window.nesaMap.userCoordinates, [lat, lng]], name, false);
        }
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
    if (text.includes('pos 1') || text.includes('pos satu') || text.includes('pixora')) {
      if (this.currentScreen !== 'screen-challenge-mode') this.showScreen('screen-challenge-mode');
      this.selectStartingPos(1);
      return;
    } else if (text.includes('pos 2') || text.includes('pos dua') || text.includes('biova')) {
      if (this.currentScreen !== 'screen-challenge-mode') this.showScreen('screen-challenge-mode');
      this.selectStartingPos(2);
      return;
    } else if (text.includes('pos 3') || text.includes('pos tiga') || text.includes('wildex')) {
      if (this.currentScreen !== 'screen-challenge-mode') this.showScreen('screen-challenge-mode');
      this.selectStartingPos(3);
      return;
    } else if (text.includes('pos 4') || text.includes('pos empat') || text.includes('biosphere')) {
      if (this.currentScreen !== 'screen-challenge-mode') this.showScreen('screen-challenge-mode');
      this.selectStartingPos(4);
      return;
    } else if (text.includes('pos 5') || text.includes('pos lima') || text.includes('animora')) {
      if (this.currentScreen !== 'screen-challenge-mode') this.showScreen('screen-challenge-mode');
      this.selectStartingPos(5);
      return;
    } else if (text.includes('pos 6') || text.includes('pos enam') || text.includes('smartpark')) {
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

    // Jika pertanyaan bersifat edukasi/definisi (mis. "apa itu rusa"), langsung kirim ke AI
    const isDefinitionQuery = /\b(apa itu|apakah|jelaskan|ceritakan|tentang|kenapa|mengapa|siapa)\b/.test(text);
    if (isDefinitionQuery) {
      this.askNesaAI(transcript);
      return;
    }

    if (targetAnimalSpot) {
      this.highlightSpotById(targetAnimalSpot.id, true);
      reply = `Rute menuju ${targetAnimalSpot.name} telah ditampilkan di peta. Silakan ikuti garis panduannya.`;
      if (bubble) bubble.textContent = `Nesa: "${reply}"`;
      nesaVoice.speak(reply);
      return;
    }

    // Pencarian Fasilitas Kampus & Hutan UNESA
    if (text.includes('musholla') || text.includes('masjid') || text.includes('sholat')) {
      const item = NESA_DATA.poi.musholla[0];
      this.highlightSpotById(item.id, true);
      reply = `Aku telah menunjukkan rute ke ${item.name} di peta.`;
    } else if (text.includes('toilet') || text.includes('kamar mandi') || text.includes('wc')) {
      const item = NESA_DATA.poi.toilet[0];
      this.highlightSpotById(item.id, true);
      reply = `Toilet terdekat ada di ${item.name}. Rutenya sudah tampil di peta!`;
    } else if (text.includes('parkir') || text.includes('motor') || text.includes('mobil')) {
      const item = NESA_DATA.poi.parkiran[0];
      this.highlightSpotById(item.id, true);
      reply = `Lokasi ${item.name} telah dipetakan untukmu.`;
    } else if (text.includes('hutan') || text.includes('trekking') || text.includes('pohon')) {
      const item = NESA_DATA.poi.hutan[0];
      this.highlightSpotById(item.id, true);
      reply = `Menuju ke ${item.name}. Nikmati kesegaran udara kanopi Hutan UNESA!`;
    } else if (text.includes('gerbang') || text.includes('pintu masuk') || text.includes('gate')) {
      const item = NESA_DATA.poi.gerbang[0];
      this.highlightSpotById(item.id, true);
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

      const res = await fetch(`${API_BASE_URL}/chat/stream`, {
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

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let data = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === 'chunk' && evt.speech && bubble) {
              bubble.textContent = `Nesa: "${evt.speech}"`;
            } else if (evt.type === 'done') {
              data = evt.data;
            }
          } catch (e) {}
        }
      }

      if (!data) throw new Error('Stream selesai tanpa payload final');

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
      console.log('[NesaMate AI] Response action:', {
        query,
        speech: reply,
        action: data.action || 'none',
        actionPayload: data.action_payload || {},
        routeRequested: data.action === 'navigate_to_spot'
      });
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
        this.highlightSpotById(data.action_payload.spot_id, false);
      } else if (data.action === 'navigate_to_spot' && data.action_payload && data.action_payload.spot_id) {
        if (this.currentScreen !== 'screen-free-mode') this.showScreen('screen-free-mode');
        this.highlightSpotById(data.action_payload.spot_id, true);
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

    if (!drawRoute && window.nesaMap) {
      this.routeRequestId += 1;
      window.nesaMap.clearRoute();
      const navCard = document.getElementById('free-nav-active-card');
      if (navCard) navCard.classList.remove('is-active');
    }

    const spot = window.nesaMap ? window.nesaMap.findSpotAnywhere(cleanId) : null;
    console.log('[NesaMate AI] Spot detail:', {
      spotId: cleanId,
      drawRoute,
      spotFound: Boolean(spot)
    });
    if (spot && drawRoute) {
      this.routeToPoint(spot.lat, spot.lng, spot.name, false);
    }

    if (!drawRoute) {
      setTimeout(() => {
        if (window.nesaMap) {
          window.nesaMap.highlightSpot(cleanId);
        }
      }, 350);
    }
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
