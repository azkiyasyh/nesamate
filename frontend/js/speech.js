/**
 * NesaMate - Voice Module (Browser Web Speech API: TTS & STT)
 * Suara Nesa si Rusa (Virtual Guide Kampus Hutan UNESA)
 * Mendukung Hands-Free Continuous Voice Interaction (Bebas Tekan Tombol)
 */

class NesaVoiceAssistant {
  constructor() {
    this.synth = window.speechSynthesis || null;
    this.recognition = null;
    this.isListening = false;
    this.isSpeaking = false;
    this.callMode = false;
    this.selectedVoice = null;
    this.voicesReady = false;
    this.restartTimer = null;
    this.speakingWatchdog = null;
    this.currentUtterance = null;
    this.keepAliveTimer = null;

    // Callbacks UI
    this.onSpeakingStateChange = null;
    this.onListeningStateChange = null;
    this.onCallStateChange = null;
    this.onTranscriptResult = null;

    this.initTTS();
    this.initSTT();
    this.initKeepAlive();
  }

  async requestMicrophonePermission() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch (err) {
        console.warn('[NesaMate Audio] Izin mic ditolak:', err);
        return false;
      }
    }
    return true;
  }

  initTTS() {
    if (!this.synth) return;

    const pickVoice = () => {
      const voices = this.synth.getVoices();
      if (!voices || voices.length === 0) return;

      let candidate = voices.find(v => v.lang === 'id-ID');
      if (!candidate) candidate = voices.find(v => v.lang && v.lang.startsWith('id'));
      if (!candidate) candidate = voices.find(v => v.name && v.name.toLowerCase().includes('indonesia'));

      this.selectedVoice = candidate || null;
      this.voicesReady = true;
    };

    pickVoice();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.addEventListener('voiceschanged', pickVoice);
    }
  }

  speak(text, onStartCallback = null, onEndCallback = null) {
    if (!this.synth) {
      if (onStartCallback) onStartCallback();
      if (onEndCallback) setTimeout(onEndCallback, 400);
      return;
    }

    this.clearRestartTimer();
    this.clearSpeakingWatchdog();

    // Hentikan sementara STT saat Nesa berbicara agar suara Nesa tidak ditranskrip sendiri (Acoustic Echo Prevention)
    if (this.recognition && this.isListening) {
      try {
        this.recognition.abort();
      } catch (e) {}
      this.isListening = false;
      if (this.onListeningStateChange) this.onListeningStateChange(false);
    }

    if (this.synth.speaking) {
      try {
        this.synth.cancel();
      } catch (e) {}
    }

    const cleanText = text.replace(/<[^>]*>/g, '').trim();
    if (!cleanText) {
      if (this.callMode) this.scheduleRestartListening(200);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    // Simpan referensi ke instance agar tidak di-garbage-collect oleh Chrome V8 saat bersuara panjang
    this.currentUtterance = utterance;

    utterance.lang = 'id-ID';

    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }

    utterance.pitch = 1.05;
    utterance.rate = 1.0;

    const finishSpeech = () => {
      this.clearSpeakingWatchdog();
      this.isSpeaking = false;
      this.currentUtterance = null;
      if (this.onSpeakingStateChange) this.onSpeakingStateChange(false);
      if (onEndCallback) onEndCallback();

      // Sambung kembali mikrofon otomatis setelah Nesa selesai berbicara (Hands-Free Continuous)
      if (this.callMode) {
        this.scheduleRestartListening(250);
      }
    };

    utterance.onstart = () => {
      this.isSpeaking = true;
      if (this.onSpeakingStateChange) this.onSpeakingStateChange(true);
      if (onStartCallback) onStartCallback();
    };

    utterance.onend = () => {
      finishSpeech();
    };

    utterance.onerror = (event) => {
      if (event.error === 'interrupted' || event.error === 'canceled') return;
      finishSpeech();
    };

    // Watchdog pengaman mengatasi bug Chrome di mana event onend tidak terpanggil
    const estimatedSec = Math.max(3, Math.ceil(cleanText.length / 9) + 2);
    this.speakingWatchdog = setTimeout(() => {
      if (this.isSpeaking) {
        console.log('[NesaMate Voice] Watchdog: menyelesaikan status TTS otomatis');
        finishSpeech();
      }
    }, estimatedSec * 1000);

    try {
      this.synth.speak(utterance);
    } catch (err) {
      console.warn('[NesaMate Voice] Gagal speak:', err);
      finishSpeech();
    }
  }

  stopSpeaking() {
    this.clearSpeakingWatchdog();
    if (this.synth && this.synth.speaking) {
      try {
        this.synth.cancel();
      } catch (e) {}
    }
    this.isSpeaking = false;
    this.currentUtterance = null;
    if (this.onSpeakingStateChange) this.onSpeakingStateChange(false);
    if (this.callMode) {
      this.scheduleRestartListening(200);
    }
  }

  initSTT() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'id-ID';
    // Aktifkan continuous agar mic tidak mati sendiri setelah kalimat pertama
    this.recognition.continuous = true;
    this.recognition.interimResults = false;

    this.recognition.onstart = () => {
      this.isListening = true;
      if (this.onListeningStateChange) this.onListeningStateChange(true);
    };

    this.recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      const clean = finalTranscript.trim();
      if (clean && this.onTranscriptResult) {
        this.onTranscriptResult(clean);
      }
    };

    this.recognition.onerror = (event) => {
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        console.log('[NesaMate STT] Status/Error:', event.error);
      }
      this.isListening = false;
      if (this.onListeningStateChange) this.onListeningStateChange(false);

      if (event.error === 'not-allowed') {
        console.warn('[NesaMate STT] Izin mic ditolak/diblokir oleh browser');
        this.setCallMode(false);
        if (window.nesaApp && window.nesaApp.showToast) {
          window.nesaApp.showToast('⚠️ Izin mic dibutuhkan di browser');
        }
      } else if (this.callMode && !this.isSpeaking) {
        // Otomatis sambungkan kembali STT jika timeout atau jeda hening
        this.scheduleRestartListening(300);
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.onListeningStateChange) this.onListeningStateChange(false);

      // Selama callMode aktif dan Nesa sedang tidak berbicara, mic wajib terus aktif
      if (this.callMode && !this.isSpeaking) {
        this.scheduleRestartListening(200);
      }
    };
  }

  initKeepAlive() {
    // Keep-alive heartbeat: memeriksa setiap 1.5 detik agar mic tidak pernah tertidur saat mode hands-free
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    this.keepAliveTimer = setInterval(() => {
      if (this.callMode && !this.isSpeaking && !this.isListening) {
        this.startListening();
      }
    }, 1500);
  }

  startListening() {
    if (!this.recognition) return;
    if (this.isSpeaking || (this.synth && this.synth.speaking)) return;
    if (this.isListening) return;

    try {
      this.recognition.start();
    } catch (err) {
      if (err.name !== 'InvalidStateError') {
        console.warn('[NesaMate STT] Status start listening:', err.message || err);
      }
    }
  }

  stopListening() {
    this.clearRestartTimer();
    if (!this.recognition || !this.isListening) return;

    try {
      this.recognition.stop();
    } catch (err) {}
    this.isListening = false;
    if (this.onListeningStateChange) this.onListeningStateChange(false);
  }

  setCallMode(active) {
    this.callMode = !!active;
    if (this.onCallStateChange) {
      this.onCallStateChange(this.callMode);
    }

    if (this.callMode) {
      if (!this.isSpeaking) {
        this.startListening();
      }
    } else {
      this.stopListening();
      this.stopSpeaking();
    }
  }

  toggleCallMode() {
    this.setCallMode(!this.callMode);
    return this.callMode;
  }

  scheduleRestartListening(delayMs = 250) {
    this.clearRestartTimer();
    if (!this.callMode) return;

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

  clearSpeakingWatchdog() {
    if (this.speakingWatchdog) {
      clearTimeout(this.speakingWatchdog);
      this.speakingWatchdog = null;
    }
  }
}

// Global Voice Singleton
window.nesaVoice = new NesaVoiceAssistant();
