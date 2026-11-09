/**
 * NesaMate - Web Speech API Module (TTS & STT)
 * Suara Nesa si Rusa (Virtual Guide Kampus Hutan UNESA)
 * 
 * Fitur:
 * - TTS Bahasa Indonesia (id-ID) natural, ramah, dan fasih
 * - STT Web Speech Recognition Bahasa Indonesia (id-ID)
 * - Komunikasi Suara 2 Arah Otomatis (Hands-Free Real-Time Audio Call):
 *   * Meminta izin mic via navigator.mediaDevices.getUserMedia() sejak onboarding
 *   * Anti-Echo/Loopback: STT dimatikan saat Nesa mulai bicara (utterance.onstart)
 *   * Auto-Resume: STT otomatis dinyalakan kembali saat Nesa selesai bicara (utterance.onend)
 *   * Recursive loop: Jika STT timeout/onend, otomatis restart selama mode call aktif
 */

class NesaVoiceAssistant {
  constructor() {
    this.synth = window.speechSynthesis || null;
    this.recognition = null;
    this.isListening = false;
    this.isSpeaking = false;
    this.callMode = false; // Hands-Free 2-Way Audio Call State
    this.selectedVoice = null;
    this.voicesReady = false;
    this.restartTimer = null;

    // Callbacks UI
    this.onSpeakingStateChange = null;
    this.onListeningStateChange = null;
    this.onCallStateChange = null;
    this.onTranscriptResult = null;

    this.initTTS();
    this.initSTT();
  }

  /**
   * Permintaan izin mikrofon dari awal (Landing / Onboarding)
   * menggunakan navigator.mediaDevices.getUserMedia
   */
  async requestMicrophonePermission() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Lepas tracks segera agar SpeechRecognition memiliki akses penuh ke hardware audio
        stream.getTracks().forEach(track => track.stop());
        console.log('[NesaMate Audio] Izin mikrofon berhasil diperoleh.');
        return true;
      } catch (err) {
        console.warn('[NesaMate Audio] Izin mikrofon ditolak atau tidak didukung:', err);
        return false;
      }
    }
    return true;
  }

  /**
   * Inisialisasi Text-to-Speech (TTS) dengan voice Bahasa Indonesia (id-ID).
   */
  initTTS() {
    if (!this.synth) return;

    const pickVoice = () => {
      const voices = this.synth.getVoices();
      if (!voices || voices.length === 0) return;

      // Prioritas 1: Exact match id-ID
      let candidate = voices.find(v => v.lang === 'id-ID');

      // Prioritas 2: Prefix match id (menangkap 'id', 'id_ID', dll.)
      if (!candidate) {
        candidate = voices.find(v => v.lang.startsWith('id'));
      }

      // Prioritas 3: Nama voice mengandung 'indonesia'
      if (!candidate) {
        candidate = voices.find(v => v.name.toLowerCase().includes('indonesia'));
      }

      this.selectedVoice = candidate || null;
      this.voicesReady = true;

      console.log(
        '[NesaMate TTS] Voice terpilih:',
        this.selectedVoice
          ? `${this.selectedVoice.name} (${this.selectedVoice.lang})`
          : 'Menggunakan fallback utterance.lang id-ID'
      );
    };

    pickVoice();

    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.addEventListener('voiceschanged', pickVoice);
    }
  }

  /**
   * Ucapkan teks dalam Bahasa Indonesia dengan karakter ramah Nesa.
   * Penanganan Anti-Echo/Loopback: STT dimatikan saat Nesa mulai bicara,
   * dan otomatis dinyalakan kembali saat Nesa selesai bicara.
   */
  speak(text, onStartCallback = null, onEndCallback = null) {
    if (!this.synth) {
      if (onStartCallback) onStartCallback();
      if (onEndCallback) setTimeout(onEndCallback, 1000);
      return;
    }

    // Bersihkan timer restart STT sebelum mulai berbicara
    this.clearRestartTimer();

    // Hentikan STT agar speaker tidak memicu mic (Anti-Echo/Loopback)
    this.stopListening();

    // Batalkan ucapan sebelumnya jika masih aktif
    if (this.synth.speaking) {
      this.synth.cancel();
    }

    const cleanText = text.replace(/<[^>]*>/g, '').trim();
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'id-ID';

    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }

    // Parameter nada & tempo ramah
    utterance.pitch = 1.1;
    utterance.rate  = 1.0;

    // Saat Nesa MULAI bicara: Pause pengenal suara
    utterance.onstart = () => {
      this.isSpeaking = true;
      this.stopListening();
      if (this.onSpeakingStateChange) this.onSpeakingStateChange(true);
      if (onStartCallback) onStartCallback();
    };

    // Saat Nesa SELESAI bicara: Otomatis nyalakan kembali pengenal suara
    utterance.onend = () => {
      this.isSpeaking = false;
      if (this.onSpeakingStateChange) this.onSpeakingStateChange(false);
      if (onEndCallback) onEndCallback();

      // Siklus Hands-Free: Otomatis dengarkan user kembali
      if (this.callMode) {
        this.scheduleRestartListening(350);
      }
    };

    utterance.onerror = (event) => {
      console.warn('[NesaMate TTS] Error:', event.error);
      this.isSpeaking = false;
      if (this.onSpeakingStateChange) this.onSpeakingStateChange(false);
      if (onEndCallback) onEndCallback();

      if (this.callMode) {
        this.scheduleRestartListening(400);
      }
    };

    this.synth.speak(utterance);
  }

  stopSpeaking() {
    if (this.synth && this.synth.speaking) {
      this.synth.cancel();
      this.isSpeaking = false;
      if (this.onSpeakingStateChange) this.onSpeakingStateChange(false);
      if (this.callMode) {
        this.scheduleRestartListening(300);
      }
    }
  }

  /**
   * Inisialisasi Speech-to-Text (STT) Bahasa Indonesia
   */
  initSTT() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'id-ID';
    this.recognition.continuous = false; // Single-turn dengan recursive loop paling stabil di Chrome
    this.recognition.interimResults = false;

    this.recognition.onstart = () => {
      this.isListening = true;
      if (this.onListeningStateChange) this.onListeningStateChange(true);
    };

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (this.onTranscriptResult) {
        this.onTranscriptResult(transcript);
      }
    };

    this.recognition.onerror = (event) => {
      console.log('[NesaMate STT] Status/Error:', event.error);
      this.isListening = false;
      if (this.onListeningStateChange) this.onListeningStateChange(false);

      if (event.error === 'not-allowed') {
        // Izin mic dicabut: matikan call mode
        this.setCallMode(false);
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.onListeningStateChange) this.onListeningStateChange(false);

      // Recursive Always-On Loop:
      // Pada recognition.onend, otomatis panggil recognition.start()
      // jika mode call aktif dan Nesa sedang tidak bicara
      if (this.callMode && !this.isSpeaking) {
        this.scheduleRestartListening(250);
      }
    };
  }

  startListening() {
    if (!this.recognition) return;

    // Jangan mulai mendengarkan jika Nesa sedang berbicara
    if (this.isSpeaking) return;

    // Hindari duplikasi start jika sudah mendengarkan
    if (this.isListening) return;

    try {
      this.recognition.start();
    } catch (err) {
      if (err.name !== 'InvalidStateError') {
        console.warn('STT start error:', err);
      }
    }
  }

  stopListening() {
    this.clearRestartTimer();
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (err) {}
      this.isListening = false;
      if (this.onListeningStateChange) this.onListeningStateChange(false);
    }
  }

  /**
   * Mengatur Hands-Free Real-Time Audio Call Mode
   */
  setCallMode(enable) {
    this.callMode = !!enable;

    if (this.onCallStateChange) {
      this.onCallStateChange(this.callMode);
    }

    if (this.callMode) {
      if (!this.isSpeaking && !this.isListening) {
        this.startListening();
      }
    } else {
      this.clearRestartTimer();
      this.stopListening();
    }
  }

  toggleCallMode() {
    this.setCallMode(!this.callMode);
    return this.callMode;
  }

  scheduleRestartListening(delayMs = 300) {
    this.clearRestartTimer();
    this.restartTimer = setTimeout(() => {
      if (this.callMode && !this.isSpeaking && !this.isListening) {
        this.startListening();
      }
    }, delayMs);
  }

  clearRestartTimer() {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }
}

const nesaVoice = new NesaVoiceAssistant();
