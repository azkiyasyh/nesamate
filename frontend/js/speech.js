/**
 * NesaMate - Voice Module (Browser Web Speech API: TTS & STT)
 * Suara Nesa si Rusa (Virtual Guide Kampus Hutan UNESA)
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

    // Callbacks UI
    this.onSpeakingStateChange = null;
    this.onListeningStateChange = null;
    this.onCallStateChange = null;
    this.onTranscriptResult = null;

    this.initTTS();
    this.initSTT();
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
    this.stopListening();

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

    utterance.pitch = 1.05;
    utterance.rate = 1.0;

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.stopListening();
      if (this.onSpeakingStateChange) this.onSpeakingStateChange(true);
      if (onStartCallback) onStartCallback();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      if (this.onSpeakingStateChange) this.onSpeakingStateChange(false);
      if (onEndCallback) onEndCallback();

      if (this.callMode) {
        this.scheduleRestartListening(350);
      }
    };

    utterance.onerror = (event) => {
      if (event.error === 'interrupted' || event.error === 'canceled') return;
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
    }
    this.isSpeaking = false;
    if (this.onSpeakingStateChange) this.onSpeakingStateChange(false);
    if (this.callMode) {
      this.scheduleRestartListening(300);
    }
  }

  initSTT() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'id-ID';
    this.recognition.continuous = false;
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
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        console.log('[NesaMate STT] Status/Error:', event.error);
      }
      this.isListening = false;
      if (this.onListeningStateChange) this.onListeningStateChange(false);

      if (event.error === 'not-allowed') {
        this.setCallMode(false);
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.onListeningStateChange) this.onListeningStateChange(false);

      if (this.callMode && !this.isSpeaking) {
        this.scheduleRestartListening(350);
      }
    };
  }

  startListening() {
    if (!this.recognition) return;
    if (this.isSpeaking || (this.synth && this.synth.speaking)) return;
    if (this.isListening) return;

    try {
      this.recognition.start();
    } catch (err) {
      if (err.name !== 'InvalidStateError') {
        console.warn('[NesaMate STT] Gagal start:', err);
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

  scheduleRestartListening(delayMs = 300) {
    this.clearRestartTimer();
    if (!this.callMode) return;

    this.restartTimer = setTimeout(() => {
      if (this.callMode && !this.isSpeaking) {
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

// Global Voice Singleton
window.nesaVoice = new NesaVoiceAssistant();
