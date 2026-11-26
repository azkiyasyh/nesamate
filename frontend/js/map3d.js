/**
 * NesaMate - 3D Map & Digital Twin Manager (Three.js + GLTFLoader + OrbitControls)
 * Menangani visualisasi 3D model lingkungan taman Hutan UNESA, OrbitControls kamera,
 * penunjuk jalan/rute navigasi interaktif, dan sinkronisasi dengan tampilan 2D.
 */

class Nesa3DMapManager {
  constructor() {
    this.container = null;
    this.containerId = 'free-map-3d-container';
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.model = null;

    this.isLoaded = false;
    this.isLoading = false;
    this.isActive = false;
    this.loadError = null;

    this.animationId = null;
    this.clock = null;

    // Groups for modular scene organization
    this.modelGroup = null;
    this.routeGroup = null;
    this.poiGroup = null;

    // Navigation & route animation state
    this.activeRoute = null;
    this.routeTubeMesh = null;
    this.routePulseMeshes = [];
    this.destPinMesh = null;
    this.animatedDashes = [];

    // Raycaster for 3D POI interaction
    this.raycaster = null;
    this.mouse = null;
    this.poiSprites = [];

    // Rute taman bawaan berbasis koordinat GPS dataset resmi (spots.json)
    // Dikonversi otomatis ke ruang 3D menggunakan gpsTo3D()
    this.scenicRoutesGPS = {
      'hutan-loop': {
        name: 'Jalur Utama Konservasi Hutan',
        desc: 'Rute teduh mengitari vegetasi alami dan pepohonan rindang Hutan UNESA.',
        gpsPoints: [
          [-7.300793, 112.671071], // LOC011 Tugu Taman
          [-7.300756, 112.670951], // LOC008 Kandang Rusa
          [-7.300416, 112.670883], // LOC007 Penangkaran Hewan
          [-7.300440, 112.671475], // LOC004 Gazeboo 2
          [-7.300744, 112.671448], // LOC003 Gazeboo 1
          [-7.301034, 112.671424], // LOC002 Kandang Ayam
          [-7.301325, 112.671791]  // LOC001 Pusat Observasi Flora & Burung
        ]
      },
      'danau-loop': {
        name: 'Jalur Pejalan Kaki Tepi Danau',
        desc: 'Rute santai tepi air dengan panorama danau kampus yang asri.',
        gpsPoints: [
          [-7.300828, 112.670299], // LOC009 Danau Kecil Unesa
          [-7.300517, 112.670652], // LOC012 Zona Angsa & Bebek
          [-7.300744, 112.671448], // LOC003 Gazeboo 1
          [-7.300294, 112.671901], // LOC005 Danau Bunga Kertas
          [-7.300170, 112.671744]  // LOC006 Taman Jalan Setapak
        ]
      },
      'trekking-rimbun': {
        name: 'Jalur Trekking & Shelter Jagawana',
        desc: 'Rute eksplorasi dari kawasan FIP menuju pos observasi hayati dan danau.',
        gpsPoints: [
          [-7.301643, 112.670476], // LOC022 Mushola FIP
          [-7.301325, 112.671791], // LOC001 Pusat Observasi Flora & Burung
          [-7.301034, 112.671424], // LOC002 Kandang Ayam
          [-7.300294, 112.671901], // LOC005 Danau Bunga Kertas
          [-7.300500, 112.672600]  // LOC017 Toilet Gedung Rektorat
        ]
      }
    };
  }

  /**
   * Inisialisasi Scene Three.js, Kamera, Kontrol, dan Pencahayaan
   */
  init(containerId = 'free-map-3d-container') {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);

    if (!this.container) {
      console.warn(`[Nesa3D] Container #${containerId} tidak ditemukan di DOM.`);
      return;
    }

    // Periksa ketersediaan library Three.js
    if (typeof THREE === 'undefined') {
      console.error('[Nesa3D] Three.js belum dimuat. Pastikan script Three.js diimpor di index.html.');
      this.showErrorUI('Pustaka Three.js belum terdeteksi. Silakan periksa koneksi internet atau muat ulang halaman.');
      return;
    }

    // Jika renderer sudah pernah dibuat, cukup reset ukuran & refresh
    if (this.renderer) {
      this.handleResize();
      return;
    }

    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x13241b); // Nuansa tema Dark Forest Nesa
    this.scene.fog = new THREE.FogExp2(0x13241b, 0.0035);

    // 2. Camera: Posisi isometrik alami melihat seluruh kawasan taman
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 85, 105);

    // 3. Renderer dengan antialias dan adaptasi DPR
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    // Bersihkan container dari konten lama dan masukkan kanvas renderer
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.06;
      this.controls.screenSpacePanning = true;
      this.controls.minDistance = 15;
      this.controls.maxDistance = 240;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.04; // Batasi kamera agar tidak masuk ke bawah tanah
      this.controls.target.set(0, 2, 0);
      this.controls.update();
    } else {
      console.warn('[Nesa3D] OrbitControls tidak ditemukan. Navigasi mouse/sentuh terbatas.');
    }

    // 5. Pencahayaan (Lighting)
    this.setupLighting();

    // 6. Kelompok Objek (Groups)
    this.modelGroup = new THREE.Group();
    this.routeGroup = new THREE.Group();
    this.poiGroup = new THREE.Group();
    this.userGroup = new THREE.Group();

    this.scene.add(this.modelGroup);
    this.scene.add(this.routeGroup);
    this.scene.add(this.poiGroup);
    this.scene.add(this.userGroup);

    // 6b. Buat penanda lokasi GPS pengguna 3D (Live User Radar Beacon)
    this.initUserBeacon();
    if (window.nesaMap && window.nesaMap.userCoordinates) {
      this.updateUserLocation(window.nesaMap.userCoordinates[0], window.nesaMap.userCoordinates[1]);
    }

    // 7. Event Listeners (Resize & Interaksi)
    this.setupEvents();

    // 8. Muat model GLB 3D
    this.loadModel();

    // 9. Aktifkan render loop & sinkronisasi sejak pembukaan pertama (anti-stuck)
    this.isActive = true;
    this.handleResize();
    this.syncFrom2DMap();
    this.startAnimationLoop();
  }

  /**
   * Konfigurasi sistem pencahayaan taman agar seluruh kontur dan pohon terlihat natural
   */
  setupLighting() {
    // Ambient Light lembut
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambientLight);

    // Hemisphere Light (Cahaya kubah langit sage hangat & pantulan bawah tanah forest)
    const hemiLight = new THREE.HemisphereLight(0xe8f2ea, 0x1e3025, 0.7);
    hemiLight.position.set(0, 100, 0);
    this.scene.add(hemiLight);

    // Directional Sunlight (Cahaya matahari sudut tinggi)
    const sunLight = new THREE.DirectionalLight(0xfffaec, 1.1);
    sunLight.position.set(65, 110, 50);
    this.scene.add(sunLight);

    // Secondary fill light untuk sisi bayangan
    const fillLight = new THREE.DirectionalLight(0xbad4c5, 0.4);
    fillLight.position.set(-65, 60, -50);
    this.scene.add(fillLight);
  }

  /**
   * Menampilkan UI Loading di atas kanvas 3D
   */
  showLoadingUI(message = 'Memuat Model 3D Taman UNESA...') {
    let loaderEl = this.container.querySelector('.map3d-loading-overlay');
    if (!loaderEl) {
      loaderEl = document.createElement('div');
      loaderEl.className = 'map3d-loading-overlay';
      this.container.appendChild(loaderEl);
    }
    loaderEl.innerHTML = `
      <div class="map3d-spinner-box">
        <div class="map3d-spinner"></div>
        <p class="map3d-loading-text">${message}</p>
        <span class="map3d-loading-sub">Three.js Digital Twin Engine</span>
      </div>
    `;
    loaderEl.style.display = 'flex';
  }

  /**
   * Menyembunyikan UI Loading
   */
  hideLoadingUI() {
    const loaderEl = this.container.querySelector('.map3d-loading-overlay');
    if (loaderEl) {
      loaderEl.style.display = 'none';
    }
  }

  /**
   * Menampilkan UI Pesan Error jika file gagal dimuat
   */
  showErrorUI(errorMessage) {
    let errorEl = this.container.querySelector('.map3d-error-overlay');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.className = 'map3d-error-overlay';
      this.container.appendChild(errorEl);
    }
    errorEl.innerHTML = `
      <div class="map3d-error-box">
        <div class="map3d-error-icon">⚠️</div>
        <h4>Gagal Memuat Model 3D</h4>
        <p class="map3d-error-desc">${errorMessage}</p>
        <div class="map3d-error-actions">
          <button class="map3d-retry-btn" onclick="window.nesa3DMap.loadModel()">
            🔄 Coba Muat Ulang
          </button>
          <button class="map3d-fallback-btn" onclick="window.nesaApp && window.nesaApp.setMapViewMode('2d')">
            📍 Kembali ke Peta 2D
          </button>
        </div>
      </div>
    `;
    errorEl.style.display = 'flex';
  }

  /**
   * Memuat file model 3D (3d maps.glb) dengan GLTFLoader
   */
  loadModel() {
    if (typeof THREE.GLTFLoader === 'undefined') {
      console.error('[Nesa3D] GLTFLoader belum tersedia.');
      this.showErrorUI('GLTFLoader belum tersedia. Pastikan script GLTFLoader telah dimuat.');
      return;
    }

    if (this.isLoading) return;
    this.isLoading = true;
    this.loadError = null;

    // Bersihkan error overlay lama jika ada
    const errEl = this.container.querySelector('.map3d-error-overlay');
    if (errEl) errEl.style.display = 'none';

    this.showLoadingUI('Memuat Model Digital Twin Taman...');

    const loader = new THREE.GLTFLoader();

    // Path asset sebenarnya di dalam project website
    // Gunakan URL encoding yang aman untuk spasi
    const assetPath = 'assets/3d%20maps.glb';
    const fallbackPath = 'assets/3d maps.glb';

    const loadAttempt = (path) => {
      loader.load(
        path,
        (gltf) => {
          this.isLoading = false;
          this.isLoaded = true;
          this.hideLoadingUI();

          // Bersihkan model lama jika ada
          while (this.modelGroup.children.length > 0) {
            this.modelGroup.remove(this.modelGroup.children[0]);
          }

          this.model = gltf.scene;

          // Hitung Bounding Box untuk memastikan posisi dan orientasi optimal
          const box = new THREE.Box3().setFromObject(this.model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());

          // Posisikan pusat model tepat di titik tengah origin (0, 0, 0)
          this.model.position.x = -center.x;
          this.model.position.y = -box.min.y; // Letakkan dasar tanah di Y = 0
          this.model.position.z = -center.z;

          // Tingkatkan material dan ketajaman permukaan
          this.model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.material) {
                child.material.roughness = Math.max(child.material.roughness || 0.6, 0.45);
              }
            }
          });

          this.modelGroup.add(this.model);

          // Pasang marker POI 3D dan rute default
          this.renderPOIMarkers();

          // Tampilkan rute default konservasi hutan jika belum ada rute navigasi aktif
          if (!this.activeRoute) {
            this.setScenicRoute('hutan-loop');
          }

          console.log(`[Nesa3D] Model 3D berhasil dimuat. Dimensi: X=${size.x.toFixed(1)}, Y=${size.y.toFixed(1)}, Z=${size.z.toFixed(1)}`);

          // Render satu frame pertama
          if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
          }
        },
        (xhr) => {
          if (xhr.lengthComputable && xhr.total > 0) {
            const percent = Math.round((xhr.loaded / xhr.total) * 100);
            this.showLoadingUI(`Memuat Model 3D Taman UNESA (${percent}%)...`);
          }
        },
        (error) => {
          console.warn(`[Nesa3D] Gagal memuat dari ${path}:`, error);
          if (path === assetPath && path !== fallbackPath) {
            console.log(`[Nesa3D] Mencoba jalur fallback: ${fallbackPath}`);
            loadAttempt(fallbackPath);
          } else {
            this.isLoading = false;
            this.loadError = error;
            this.hideLoadingUI();
            this.showErrorUI('Gagal memuat file "3d maps.glb". Pastikan file model 3D tersedia di folder "assets/".');
          }
        }
      );
    };

    loadAttempt(assetPath);
  }

  /**
   * Menampilkan marker POI 3D berupa pin terapung langsung dari dataset resmi (NESA_DATA.spots)
   */
  renderPOIMarkers() {
    while (this.poiGroup.children.length > 0) {
      this.poiGroup.remove(this.poiGroup.children[0]);
    }
    this.poiSprites = [];

    const spots = (typeof NESA_DATA !== 'undefined' && Array.isArray(NESA_DATA.spots))
      ? NESA_DATA.spots
      : [];

    spots.forEach((spot) => {
      const pos3D = this.gpsTo3D(spot.lat, spot.lng);
      const pinObj = this.createFloatingPin(spot.name, spot.icon || '📍', spot.category || 'wisata');
      pinObj.position.set(pos3D[0], pos3D[1] + 3.2, pos3D[2]);
      pinObj.userData = { id: spot.id, ...spot, pos: pos3D };

      this.poiGroup.add(pinObj);
      this.poiSprites.push(pinObj);
    });
  }

  /**
   * Membuat 3D Billboard Pin dengan ikon & label nama yang selalu menghadap kamera
   */
  createFloatingPin(title, iconSymbol, category) {
    const group = new THREE.Group();

    // Canvas untuk menggambar pin badge bernuansa safari/forest
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Warna tema
    let bgColor = '#1E3B2F'; // Dark Forest
    if (category === 'musholla') bgColor = '#1E3B2F';
    else if (category === 'parkiran') bgColor = '#7F8C6A'; // Sage
    else if (category === 'danau') bgColor = '#186391'; // Danau biru
    else if (category === 'gerbang') bgColor = '#8B5E3C'; // Warm brown

    // Gambar rounded pill background
    ctx.fillStyle = bgColor;
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;
    this.roundRect(ctx, 16, 16, 224, 76, 38);
    ctx.fill();

    // Border emas halus
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#C8B48A';
    ctx.stroke();

    // Icon & Label
    ctx.shadowColor = 'transparent';
    ctx.font = '32px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(iconSymbol, 32, 54);

    ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#F5F0E6';
    const cleanTitle = title.length > 13 ? title.substring(0, 12) + '..' : title;
    ctx.fillText(cleanTitle, 76, 54);

    // Segitiga penunjuk ke bawah
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.moveTo(116, 92);
    ctx.lineTo(140, 92);
    ctx.lineTo(128, 112);
    ctx.closePath();
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    });

    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(8.5, 4.25, 1);
    group.add(sprite);

    // Tiang vertikal transparan penunjuk tanah
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 3.0, 8);
    const poleMat = new THREE.MeshBasicMaterial({ color: 0xC8B48A, transparent: true, opacity: 0.75 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = -1.6;
    group.add(pole);

    // Titik tumpu di tanah
    const dotGeo = new THREE.RingGeometry(0.1, 0.55, 16);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xC8B48A, side: THREE.DoubleSide });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.rotation.x = -Math.PI / 2;
    dot.position.y = -3.1;
    group.add(dot);

    return group;
  }

  /**
   * Helper utility gambar rounded rectangle di canvas 2D
   */
  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /**
   * Menggambar jalur navigasi (Penunjuk Jalan) 3D di atas permukaan model taman
   * @param {Array<Array<number>>} points Array koordinat [[x, y, z], ...]
   * @param {string} routeName Nama rute / destinasi
   */
  drawRoute(points, routeName = 'Rute Navigasi Taman') {
    if (!points || points.length < 2) return;

    this.clearRoute();
    this.activeRoute = { name: routeName, points: points };

    // 1. Bangun CurvePath berbasis LineCurve3 dengan bevel sudut kecil agar tidak melebar menabrak bangunan
    const routeY = 2.34;
    const vectors = points.map(p => new THREE.Vector3(p[0], (p[1] !== undefined ? p[1] : routeY) + 0.25, p[2]));
    const curve = this._buildSafeCurvePath(vectors);

    // 2. Buat geometri tabung (TubeGeometry) yang presisi di atas permukaan jalan
    const segments = Math.max(vectors.length * 6, 40);
    const tubeGeometry = new THREE.TubeGeometry(curve, segments, 0.30, 8, false);

    // Material garis penunjuk jalan dengan nuansa cerah (Emerald Glowing & Gold Accent)
    const tubeMaterial = new THREE.MeshStandardMaterial({
      color: 0x22c55e,        // Emerald luminous
      emissive: 0x15803d,     // Pendaran hijau neon
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.1
    });

    this.routeTubeMesh = new THREE.Mesh(tubeGeometry, tubeMaterial);
    this.routeGroup.add(this.routeTubeMesh);

    // 3. Titik-titik waypoint (Waypoint spheres) sepanjang rute
    const wayGeo = new THREE.SphereGeometry(0.65, 12, 12);
    const wayMat = new THREE.MeshStandardMaterial({
      color: 0xffd166,        // Kuning emas penanda
      emissive: 0xd97706,
      emissiveIntensity: 0.8
    });

    let lastSpherePt = null;
    points.forEach((pt, idx) => {
      if (idx !== 0 && idx !== points.length - 1 && lastSpherePt) {
        if (Math.hypot(pt[0] - lastSpherePt[0], pt[2] - lastSpherePt[2]) < 6) {
          return;
        }
      }
      const sphere = new THREE.Mesh(wayGeo, wayMat);
      sphere.position.set(pt[0], (pt[1] !== undefined ? pt[1] : 2.35) + 0.3, pt[2]);
      this.routeGroup.add(sphere);
      lastSpherePt = pt;
    });

    // 4. Pin Destinasi Akhir yang berdenyut (Pulsing Pin)
    const endPoint = points[points.length - 1];
    this.createDestinationPin(endPoint[0], (endPoint[1] !== undefined ? endPoint[1] : 2.35) + 0.4, endPoint[2], routeName);

    // 5. Partikel pulsa animasi berjalan di sepanjang rute
    this.createAnimatedPulses(curve);

    // Arahkan kamera dengan mulus agar mencakup rute navigasi
    this.focusOnPoints(points);
  }

  /**
   * Membuat pin destinasi akhir dengan efek ring berdenyut
   */
  createDestinationPin(x, y, z, title) {
    const pinGroup = new THREE.Group();
    pinGroup.position.set(x, y, z);

    // Diamond / Kerucut terbalik
    const coneGeo = new THREE.ConeGeometry(1.2, 2.5, 6);
    coneGeo.rotateX(Math.PI);
    const coneMat = new THREE.MeshStandardMaterial({
      color: 0xef4444, // Merah destinasi terang
      emissive: 0xb91c1c,
      emissiveIntensity: 0.8
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.y = 3.5;
    pinGroup.add(cone);

    // Bola puncak
    const topSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6 })
    );
    topSphere.position.y = 4.8;
    pinGroup.add(topSphere);

    // Cincin dasar di tanah (Pulsing ring)
    const ringGeo = new THREE.RingGeometry(0.8, 1.4, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    pinGroup.add(ring);

    this.destPinMesh = { group: pinGroup, ring: ring, cone: cone };
    this.routeGroup.add(pinGroup);
  }

  /**
   * Membuat bola-bola pulsa cahaya yang bergerak mengalir menyusuri jalur
   */
  createAnimatedPulses(curve) {
    this.routePulseMeshes = [];
    const pulseCount = 5;
    const pulseGeo = new THREE.SphereGeometry(0.55, 10, 10);
    const pulseMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95
    });

    for (let i = 0; i < pulseCount; i++) {
      const mesh = new THREE.Mesh(pulseGeo, pulseMat);
      this.routeGroup.add(mesh);
      this.routePulseMeshes.push({
        mesh: mesh,
        curve: curve,
        progress: i / pulseCount
      });
    }
  }

  /**
   * Menghapus seluruh elemen rute navigasi dari scene 3D
   */
  clearRoute() {
    while (this.routeGroup.children.length > 0) {
      const obj = this.routeGroup.children[0];
      if (obj.geometry) obj.geometry.dispose();
      this.routeGroup.remove(obj);
    }
    this.routeTubeMesh = null;
    this.routePulseMeshes = [];
    this.destPinMesh = null;
    this.activeRoute = null;
  }

  /**
   * Pilih salah satu rute taman bawaan (Preset Scenic Routes berbasis koordinat GPS dataset)
   */
  setScenicRoute(key) {
    const route = this.scenicRoutesGPS[key];
    if (!route || !route.gpsPoints) return;
    this.drawRouteFromGPS(route.gpsPoints, route.name);
  }

  /**
   * Mengonversi koordinat GPS 2D (lat, lng) ke ruang koordinat model 3D (x, y, z)
   * Terkalibrasi dengan geometri 3d maps.glb (Danau Kecil mesh_14 & Danau Bunga Kertas mesh_16)
   */
  gpsTo3D(lat, lng) {
    // Pusat acuan terkalibrasi terhadap mesh danau & hutan pada 3d maps.glb
    const centerLat = -7.300757;
    const centerLng = 112.671246;

    // Skala konversi derajat ke unit koordinat 3D model (155x155 unit)
    const scaleX = 17000;
    const scaleZ = 17000;

    let x = (lng - centerLng) * scaleX;
    let z = -(lat - centerLat) * scaleZ;

    // Batasi dalam rentang model agar tidak keluar dari visual taman
    x = Math.max(-72, Math.min(72, x));
    z = Math.max(-72, Math.min(72, z));

    return [x, 2.35, z];
  }

  /**
   * Menggambar rute berdasarkan array koordinat GPS [lat, lng].
   * Jika follow2D=true (berasal dari activeRoute.waypoints peta 2D), rute 3D mengikuti
   * jalur 2D secara 1:1 agar tidak pernah berbeda arah dari peta 2D.
   */
  drawRouteFromGPS(gpsPoints, destinationName = 'Destinasi Terpilih', follow2D = false) {
    if (!gpsPoints || gpsPoints.length < 2) return;

    const points3D = gpsPoints.map(pt => {
      const lat = Array.isArray(pt) ? pt[0] : pt.lat;
      const lng = Array.isArray(pt) ? pt[1] : pt.lng;
      return this.gpsTo3D(lat, lng);
    });

    const roadNav = window.nesaRoadNav;
    if (follow2D) {
      if (roadNav) {
        if (roadNav.isReady) {
          this.drawRoute(roadNav.conformRouteToObstacles(points3D, 2.34), destinationName);
        } else {
          roadNav.load().then((ok) => {
            this.drawRoute(ok ? roadNav.conformRouteToObstacles(points3D, 2.34) : points3D, destinationName);
          });
        }
      } else {
        this.drawRoute(points3D, destinationName);
      }
      return;
    }

    if (roadNav) {
      if (roadNav.isReady) {
        const roadPath = roadNav.findMultiStopPath(points3D, 2.34);
        if (roadPath) {
          this.drawRoute(roadPath, destinationName);
          return;
        }
        console.warn('[Nesa3D] Pathfinding jalan 3D gagal, fallback ke titik GPS.');
      } else {
        roadNav.load().then((ok) => {
          const roadPath = ok ? roadNav.findMultiStopPath(points3D, 2.34) : null;
          this.drawRoute(roadPath || points3D, destinationName);
        });
        return;
      }
    }

    this.drawRoute(points3D, destinationName);
  }

  /**
   * Membangun CurvePath dari segmen lurus dengan bevel sudut ketat (0.25 unit)
   * agar garis rute tidak melebar/memotong sudut bangunan saat berbelok.
   */
  _buildSafeCurvePath(vectors) {
    const path = new THREE.CurvePath();
    if (vectors.length < 2) return path;
    if (vectors.length === 2) {
      path.add(new THREE.LineCurve3(vectors[0], vectors[1]));
      return path;
    }

    const beveled = [vectors[0]];
    const cornerOffset = 0.25;
    for (let i = 1; i < vectors.length - 1; i++) {
      const prev = vectors[i - 1];
      const curr = vectors[i];
      const next = vectors[i + 1];
      const d1 = curr.distanceTo(prev);
      const d2 = next.distanceTo(curr);
      if (d1 > cornerOffset * 2.5 && d2 > cornerOffset * 2.5) {
        const pIn = curr.clone().lerp(prev, cornerOffset / d1);
        const pOut = curr.clone().lerp(next, cornerOffset / d2);
        beveled.push(pIn, pOut);
      } else {
        beveled.push(curr);
      }
    }
    beveled.push(vectors[vectors.length - 1]);

    for (let i = 0; i < beveled.length - 1; i++) {
      if (beveled[i].distanceToSquared(beveled[i + 1]) > 1e-6) {
        path.add(new THREE.LineCurve3(beveled[i], beveled[i + 1]));
      }
    }
    return path;
  }

  /**
   * Arahkan kamera dan kontrol ke sekumpulan titik agar tampak terpusat
   */
  focusOnPoints(points) {
    if (!this.controls || !points || points.length === 0) return;

    let avgX = 0, avgZ = 0;
    points.forEach(p => {
      avgX += p[0];
      avgZ += p[2];
    });
    avgX /= points.length;
    avgZ /= points.length;

    // Animasi pergeseran target controls secara halus
    this.controls.target.set(avgX, 2, avgZ);
    this.controls.update();
  }

  /**
   * Reset posisi kamera ke sudut pandang bird's eye default
   */
  resetView() {
    if (!this.camera || !this.controls) return;
    this.camera.position.set(0, 85, 105);
    this.controls.target.set(0, 2, 0);
    this.controls.update();
  }

  /**
   * Inisialisasi penanda lokasi pengguna 3D (Live GPS User Beacon)
   */
  initUserBeacon() {
    if (!this.userGroup) return;
    while (this.userGroup.children.length > 0) {
      this.userGroup.remove(this.userGroup.children[0]);
    }

    const beaconGroup = new THREE.Group();

    // Titik inti pengguna (Biru GPS terang dengan ring putih)
    const coreGeo = new THREE.SphereGeometry(1.1, 16, 16);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.9,
      roughness: 0.2
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = 1.2;
    beaconGroup.add(core);

    // Lingkaran radar berdenyut di permukaan tanah
    const pulseGeo = new THREE.RingGeometry(1.2, 2.2, 24);
    const pulseMat = new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65
    });
    const pulseRing = new THREE.Mesh(pulseGeo, pulseMat);
    pulseRing.rotation.x = -Math.PI / 2;
    pulseRing.position.y = 0.15;
    beaconGroup.add(pulseRing);

    this.userBeacon = { group: beaconGroup, core, ring: pulseRing };
    this.userGroup.add(beaconGroup);
  }

  /**
   * Memperbarui posisi penanda pengguna 3D berdasarkan koordinat GPS real-time
   */
  updateUserLocation(lat, lng) {
    if (!this.userBeacon || !this.userBeacon.group) return;
    const pos3D = this.gpsTo3D(lat, lng);
    this.userBeacon.group.position.set(pos3D[0], pos3D[1], pos3D[2]);
  }

  /**
   * Memfokuskan kamera 3D ke posisi GPS pengguna saat ini
   */
  focusOnUser() {
    if (!this.controls || !this.userBeacon || !this.userBeacon.group) return;
    const p = this.userBeacon.group.position;
    this.controls.target.set(p.x, 2, p.z);
    if (this.camera) {
      this.camera.position.set(p.x, 55, p.z + 65);
    }
    this.controls.update();
  }

  /**
   * Setup Event Listener (Resize jendela & sentuhan/klik POI)
   */
  setupEvents() {
    window.addEventListener('resize', () => this.handleResize());

    // Gunakan ResizeObserver pada container agar selalu presisi jika layout bergeser
    if (window.ResizeObserver && this.container) {
      const ro = new ResizeObserver(() => {
        this.handleResize();
      });
      ro.observe(this.container);
    }

    // Event klik pada kanvas untuk mendeteksi klik pin landmark 3D
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.addEventListener('click', (e) => this.onCanvasClick(e));
    }
  }

  /**
   * Penanganan klik raycasting pada marker landmark 3D
   */
  onCanvasClick(event) {
    if (!this.camera || !this.poiSprites || this.poiSprites.length === 0) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.poiGroup.children, true);

    if (intersects.length > 0) {
      // Cari objek root pin yang memiliki userData
      let obj = intersects[0].object;
      while (obj && !obj.userData?.id && obj.parent) {
        obj = obj.parent;
      }

      if (obj && obj.userData?.id) {
        const poi = obj.userData;
        console.log(`[Nesa3D] Marker diklik: ${poi.name}`);

        // Arahkan rute dari posisi GPS pengguna (atau Tugu Taman) ke landmark tersebut
        if (window.nesaApp && typeof window.nesaApp.routeToPoint === 'function' && poi.lat && poi.lng) {
          window.nesaApp.routeToPoint(poi.lat, poi.lng, poi.name, false);
        } else {
          const targetPoint = [poi.pos[0], poi.pos[1], poi.pos[2]];
          const startPoint = (this.userBeacon && this.userBeacon.group)
            ? [this.userBeacon.group.position.x, 2.35, this.userBeacon.group.position.z]
            : [-3.0, 2.35, 0.6];
          this.drawRoute([startPoint, targetPoint], poi.name);
          if (window.nesaApp && typeof window.nesaApp.showActiveNavCard === 'function') {
            window.nesaApp.showActiveNavCard(poi.name, 'Rute 3D Aktif');
          }
        }
      }
    }
  }

  /**
   * Menyesuaikan ukuran kanvas saat jendela / container berubah ukuran
   */
  handleResize() {
    if (!this.container || !this.renderer || !this.camera) return;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  /**
   * Memindahkan kanvas renderer 3D ke container mode tertentu (Eksplorasi / Berpetualang / Jogging)
   * tanpa memuat ulang model GLB maupun membuat konteks WebGL baru.
   */
  attachTo(containerId) {
    const target = document.getElementById(containerId);
    if (!target) {
      console.warn(`[Nesa3D] Container #${containerId} tidak ditemukan.`);
      return;
    }

    if (!this.renderer) {
      this.init(containerId);
      return;
    }

    if (this.container && this.container !== target) {
      this.container.style.display = 'none';
    }

    this.containerId = containerId;
    this.container = target;
    this.container.style.display = 'block';

    if (this.renderer.domElement.parentNode !== this.container) {
      this.container.appendChild(this.renderer.domElement);
    }

    this.isActive = true;
    this.handleResize();
    if (!this.isLoaded && !this.isLoading) {
      this.loadModel();
    }
    this.startAnimationLoop();
  }

  /**
   * Menampilkan tampilan 3D dan memulai render loop
   */
  show() {
    if (!this.container) {
      this.init(this.containerId);
      return;
    }

    if (this.container) {
      this.container.style.display = 'block';
    }

    this.isActive = true;
    this.handleResize();

    // Pastikan model sudah mulai dimuat
    if (!this.isLoaded && !this.isLoading) {
      this.loadModel();
    }

    // Sinkronkan rute aktif dari peta 2D jika ada
    this.syncFrom2DMap();

    // Mulai animasi loop
    this.startAnimationLoop();
  }

  /**
   * Menyembunyikan tampilan 3D dan menghentikan render loop demi efisiensi baterai/CPU
   */
  hide() {
    this.isActive = false;
    this.stopAnimationLoop();

    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  /**
   * Sinkronisasi rute aktif & posisi GPS dari instance peta 2D (Leaflet) ke 3D
   */
  syncFrom2DMap() {
    if (!window.nesaMap) return;

    // 1. Sinkronisasi posisi GPS pengguna saat ini
    if (window.nesaMap.userCoordinates && Array.isArray(window.nesaMap.userCoordinates)) {
      this.updateUserLocation(window.nesaMap.userCoordinates[0], window.nesaMap.userCoordinates[1]);
    }

    // 2. Jika di Leaflet 2D ada rute aktif yang sedang dipandu
    const route = window.nesaMap.activeRoute;
    if (route) {
      const destName = route.destinationName || 'Rute Navigasi Aktif';
      if (Array.isArray(route.waypoints) && route.waypoints.length > 1) {
        this.drawRouteFromGPS(route.waypoints, destName, true);
      } else if (route.start && route.end) {
        this.drawRouteFromGPS([route.start, route.end], destName, false);
      }
    }
  }

  /**
   * Memulai animation frame loop
   */
  startAnimationLoop() {
    if (this.animationId !== null) return;

    const animate = () => {
      if (!this.isActive) return;

      this.animationId = requestAnimationFrame(animate);

      const delta = this.clock ? this.clock.getDelta() : 0.016;
      const elapsed = this.clock ? this.clock.getElapsedTime() : 0;

      // 1. Update OrbitControls damping
      if (this.controls) {
        this.controls.update();
      }

      // 2. Animasi pulsa partikel mengalir di sepanjang rute navigasi
      if (this.routePulseMeshes && this.routePulseMeshes.length > 0) {
        this.routePulseMeshes.forEach(p => {
          p.progress = (p.progress + delta * 0.35) % 1.0;
          const pos = p.curve.getPointAt(p.progress);
          if (pos) {
            p.mesh.position.copy(pos);
            p.mesh.position.y += 0.2;
          }
        });
      }

      // 3. Animasi pin destinasi berputar & berdenyut lembut
      if (this.destPinMesh) {
        if (this.destPinMesh.cone) {
          this.destPinMesh.cone.rotation.y += delta * 1.5;
        }
        if (this.destPinMesh.ring) {
          const scale = 1.0 + Math.sin(elapsed * 4) * 0.25;
          this.destPinMesh.ring.scale.set(scale, scale, scale);
        }
      }

      // 3b. Animasi radar GPS pengguna berdenyut lembut
      if (this.userBeacon && this.userBeacon.ring) {
        const uScale = 1.0 + (Math.sin(elapsed * 3) + 1) * 0.45;
        this.userBeacon.ring.scale.set(uScale, uScale, uScale);
        this.userBeacon.ring.material.opacity = Math.max(0.15, 0.75 - (uScale - 1.0) * 0.6);
      }

      // 4. Render frame
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };

    this.animationId = requestAnimationFrame(animate);
  }

  /**
   * Menghentikan animation loop saat tampilan 3D tidak aktif
   */
  stopAnimationLoop() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}

// Inisialisasi instance global singleton
window.nesa3DMap = new Nesa3DMapManager();
