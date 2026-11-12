/**
 * NesaMate - Live2D Rendering & Avatar Controller
 * Mengintegrasikan Cubism v4 + PixiJS v7 + pixi-live2d-display
 */

(function () {
  function initLive2D() {
    const avatarContainer = document.getElementById('nesa-avatar-container');
    if (!avatarContainer) {
      console.warn('[Live2D] Container #nesa-avatar-container tidak ditemukan.');
      return;
    }

    // Pastikan library Live2D dan PixiJS sudah tersedia di browser
    if (typeof PIXI === 'undefined' || !PIXI.live2d || !PIXI.live2d.Live2DModel) {
      console.warn('[Live2D] Library PixiJS atau pixi-live2d-display belum siap. Menampilkan fallback avatar.');
      avatarContainer.innerHTML = `<img src="assets/AVA Nesa.2048/texture_00.png" class="w-full h-full object-cover rounded-full" alt="Nesa Avatar" />`;
      return;
    }

    try {
      // 1. Register Ticker Pixi (WAJIB agar model terupdate & ter-render pada frame loop)
      PIXI.live2d.Live2DModel.registerTicker(PIXI.Ticker);

      // 2. Inisialisasi Canvas Container
      avatarContainer.innerHTML = '<canvas id="live2d-canvas" style="width: 100%; height: 100%; display: block;"></canvas>';

      const canvas = document.getElementById('live2d-canvas');
      const app = new PIXI.Application({
        view: canvas,
        transparent: true,
        backgroundAlpha: 0,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
        resizeTo: avatarContainer
      });
      window.pixiApp = app;

      // 3. Load model Live2D dari struktur folder terorganisir
      const modelPath = 'assets/live2d/nesa/nesa.model3.json';

      PIXI.live2d.Live2DModel.from(modelPath, { autoInteract: false })
        .then((model) => {
          console.log('[Live2D] ✅ Live2D Nesa berhasil dimuat!');
          app.stage.addChild(model);

          // Simpan dimensi model murni tanpa skala
          model._baseWidth = model.internalModel?.originalWidth || model.width || 400;
          model._baseHeight = model.internalModel?.originalHeight || model.height || 400;

          // Helper fungsi penataan posisi & skala model
          function fitModel() {
            app.resize();
            const w = app.screen.width || avatarContainer.clientWidth || 145;
            const h = app.screen.height || avatarContainer.clientHeight || 145;

            model.anchor.set(0.5, 0.5);
            model.x = w / 2;
            model.y = h / 2;

            const scaleX = (w * 0.8) / model._baseWidth;
            const scaleY = (h * 0.8) / model._baseHeight;
            const finalScale = Math.min(scaleX, scaleY);
            model.scale.set(finalScale);
          }

          // Terapkan penataan awal
          fitModel();

          // Simpan instance ke global agar bisa diakses oleh speech & resize
          window.nesaModel = model;
          window.resizeNesaModel = fitModel;

          // Interaktivitas mengikuti kursor / sentuhan pengguna
          model.interactive = true;
          model.on('pointermove', (e) => {
            if (!window.nesaModel) return;
            const rect = canvas.getBoundingClientRect();
            if (!rect || rect.width === 0 || rect.height === 0) return;
            const x = (e.data.global.x - rect.width / 2) / (rect.width / 2);
            const y = (e.data.global.y - rect.height / 2) / (rect.height / 2);
            window.nesaModel.focus(
              x * rect.width + rect.width / 2,
              y * rect.height + rect.height / 2
            );
          });

          // Listener resize
          window.addEventListener('resize', fitModel);
          if (typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(fitModel).observe(avatarContainer);
          }
        })
        .catch((err) => {
          console.error('[Live2D] Gagal memuat Live2D Nesa:', err);
          // 4. Fallback jika gagal: tampilkan gambar static texture_00.png di dalam lingkaran avatar
          avatarContainer.innerHTML = `<img src="assets/live2d/nesa/nesa.2048/texture_00.png" class="w-full h-full object-cover rounded-full" alt="Nesa Avatar" />`;
        });
    } catch (e) {
      console.error('[Live2D] Error inisialisasi Pixi:', e);
      avatarContainer.innerHTML = `<img src="assets/live2d/nesa/nesa.2048/texture_00.png" class="w-full h-full object-cover rounded-full" alt="Nesa Avatar" />`;
    }
  }

  // 5. Lip Sync untuk animasi mulut saat Nesa berbicara via Web Speech API (TTS)
  function setNesaMouthSpeaking(talking) {
    const model = window.nesaModel;
    if (!model) return;

    if (talking) {
      if (window._nesaSpeakInterval) return;
      window._nesaSpeakInterval = setInterval(() => {
        try {
          const core = model.internalModel?.coreModel;
          if (core) {
            core.setParameterValueById('ParamMouthOpenY', Math.random() * 0.9 + 0.1);
          }
        } catch (e) {}
      }, 120);
    } else {
      if (window._nesaSpeakInterval) {
        clearInterval(window._nesaSpeakInterval);
        window._nesaSpeakInterval = null;
      }
      try {
        const core = model.internalModel?.coreModel;
        if (core) core.setParameterValueById('ParamMouthOpenY', 0);
      } catch (e) {}
    }
  }

  window.setNesaMouthSpeaking = setNesaMouthSpeaking;
  window.initLive2D = initLive2D;

  // Jalankan saat DOM telah siap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLive2D);
  } else {
    initLive2D();
  }
})();
