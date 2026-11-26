/**
 * NesaMate - Map & Routing Manager (Leaflet.js + Geolocation)
 * Menangani peta presisi Kampus & Hutan UNESA Lidah Wetan, marker POI kustom, rute navigasi mandiri, dan track lari.
 */

// Variabel global marker pengguna & lingkaran akurasi real-time GPS
var userMarker = null;
var userAccuracyCircle = null;
window.userMarker = null;
window.userAccuracyCircle = null;

class NesaMapManager {
  constructor() {
    this.map = null;
    this.currentContainerId = null;
    this.userMarker = null;
    this.userAccuracyCircle = null;
    this.isAutoFollow = true; // Auto-follow pergerakan GPS pengguna
    this.userCoordinates = [-7.3002, 112.6738]; // Titik default kawasan Hutan UNESA
    this.watchId = null;
    this.spotMarkers = {};
    this.pendingRoute = null;
    this.pendingHighlight = null;

    // Layer groups untuk POI filter
    this.layers = {
      hutan: L.layerGroup(),
      musholla: L.layerGroup(),
      parkiran: L.layerGroup(),
      toilet: L.layerGroup(),
      gerbang: L.layerGroup(),
      challenge: L.layerGroup(),
      jogging: L.layerGroup()
    };

    this.activeFilter = {
      hutan: true,
      musholla: true,
      parkiran: true,
      toilet: true,
      gerbang: true
    };

    this.routeLayers = [];
    this.destMarker = null;
    this.walkNodes = null;
    this.walkAdj = null;
    this.loadWalkableNetwork();
    this.activeRoute = null;
    this.joggingLine = null;
  }

  /**
   * Inisialisasi peta Leaflet
   */
  initMap(containerId = 'free-map-container') {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Jika peta sudah ada di container ini, sesuaikan layer berdasarkan kontainer
    if (this.map && this.currentContainerId === containerId) {
      this.configureLayersForContainer(containerId);
      this.map.invalidateSize();
      if (this.pendingRoute) {
        const pr = this.pendingRoute;
        this.pendingRoute = null;
        this.drawRouteTo(pr.targetLat, pr.targetLng, pr.destinationName);
      }
      if (this.pendingHighlight) {
        const ph = this.pendingHighlight;
        this.pendingHighlight = null;
        this.highlightSpot(ph);
      }
      return;
    }

    if (this.map) {
      try {
        this.map.remove();
      } catch (err) {}
      this.map = null;
    }
    this.currentContainerId = containerId;

    // Set view peta otomatis berada tepat di tengah koordinat Hutan UNESA (-7.3005, 112.6740)
    this.map = L.map(containerId, {
      center: NESA_DATA.campusCenter,
      zoom: NESA_DATA.zoomDefault,
      zoomControl: false, // Hilangkan zoom bawaan di atas agar tidak menabrak header bar
      attributionControl: false
    });

    // Kontrol auto-follow: nonaktifkan saat user menggeser peta secara manual
    this.map.on('dragstart', () => {
      this.isAutoFollow = false;
    });

    // 1. OpenStreetMap Tile Layer (Default Bawaan Leaflet.js)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.map);

    // 2. Konfigurasi layer khusus per mode kontainer (Free Mode vs Jogging Mode vs Challenge Mode)
    this.configureLayersForContainer(containerId);

    // 3. Pasang titik lokasi pengguna
    this.initUserMarker();

    // Invalidate size bertahap agar tiles Leaflet tidak abu-abu saat transisi layar
    [100, 250, 500].forEach(delay => {
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
          if (this.pendingRoute) {
            const pr = this.pendingRoute;
            this.pendingRoute = null;
            this.drawRouteTo(pr.targetLat, pr.targetLng, pr.destinationName);
          }
          if (this.pendingHighlight) {
            const ph = this.pendingHighlight;
            this.pendingHighlight = null;
            this.highlightSpot(ph);
          }
        }
      }, delay);
    });
  }

  /**
   * Mengatur layer secara terisolasi sesuai kontainer mode layar
   * (Eksplorasi Bebas vs Jogging Track vs Tantangan Misi)
   */
  configureLayersForContainer(containerId) {
    if (!this.map) return;

    if (containerId === 'free-map-container') {
      // 🌿 1. MODE EKSPLORASI BEBAS
      // Bersihkan dan lepaskan jogging track dan challenge marker agar peta bersih
      this.clearJoggingTrack();
      if (this.map.hasLayer(this.layers.challenge)) {
        this.map.removeLayer(this.layers.challenge);
      }

      // Pastikan hanya layer POI resmi Hutan UNESA yang aktif
      const poiKeys = ['hutan', 'musholla', 'parkiran', 'toilet', 'gerbang'];
      poiKeys.forEach(k => {
        if (this.activeFilter[k]) {
          this.layers[k].addTo(this.map);
        } else if (this.map.hasLayer(this.layers[k])) {
          this.map.removeLayer(this.layers[k]);
        }
      });
      this.renderAllPOIs();

    } else if (containerId === 'jogging-map-container') {
      // 🏃 2. MODE JOGGING TRACK
      // Sembunyikan seluruh POI dan Challenge agar fokus penuh pada rute lari
      const nonJoggingKeys = ['hutan', 'musholla', 'parkiran', 'toilet', 'gerbang', 'challenge'];
      nonJoggingKeys.forEach(k => {
        if (this.map.hasLayer(this.layers[k])) {
          this.map.removeLayer(this.layers[k]);
        }
      });

      // Tambahkan hanya layer jogging track
      this.layers.jogging.addTo(this.map);

    } else if (containerId === 'challenge-map-container') {
      // 🎯 3. MODE BERPETUALANG / TANTANGAN
      this.clearJoggingTrack();
      const nonChallengeKeys = ['hutan', 'musholla', 'parkiran', 'toilet', 'gerbang', 'jogging'];
      nonChallengeKeys.forEach(k => {
        if (this.map.hasLayer(this.layers[k])) {
          this.map.removeLayer(this.layers[k]);
        }
      });

      // Tambahkan layer marker pos challenge
      this.layers.challenge.addTo(this.map);
    }
  }

  /**
   * Pembuat marker pin SVG kustom berdesain modern & bernuansa safari
   */
  createPinIcon(type, iconSymbol) {
    let bgColor = '#1E3B2F'; // Dark Forest
    if (type === 'parkiran' || type === 'toilet') {
      bgColor = '#7F8C6A'; // Sage
    } else if (type === 'challenge') {
      bgColor = '#C8B48A'; // Muted Gold
    } else if (type === 'gerbang') {
      bgColor = '#8B5E3C'; // Warm Brown
    } else if (type === 'fauna') {
      bgColor = '#A0522D'; // Sienna Safari Animal
    }

    const html = `
      <div class="custom-pin-marker" style="background-color: ${bgColor};">
        <span class="pin-icon">${iconSymbol}</span>
      </div>
    `;

    return L.divIcon({
      className: 'nesa-custom-pin-wrap',
      html: html,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -32]
    });
  }

  /**
   * Render semua titik POI berdasarkan dataset resmi (NESA_DATA.spots / spots.json)
   * serta Gerbang Masuk agar koordinat peta 2D akurat sesuai dataset.
   */
  renderAllPOIs() {
    this.layers.hutan.clearLayers();
    this.layers.musholla.clearLayers();
    this.layers.parkiran.clearLayers();
    this.layers.toilet.clearLayers();
    this.layers.gerbang.clearLayers();
    this.spotMarkers = {};

    const registerMarker = (id, marker) => {
      if (!id) return;
      this.spotMarkers[String(id).toUpperCase()] = marker;
    };

    // 1. Render 30 Spot Resmi dari Dataset (NESA_DATA.spots / spots.json)
    if (NESA_DATA.spots && Array.isArray(NESA_DATA.spots)) {
      NESA_DATA.spots.forEach(item => {
        const cat = (item.category || '').toLowerCase();
        let targetLayer = this.layers.hutan;
        let pinType = cat || 'hutan';

        if (cat === 'musholla') {
          targetLayer = this.layers.musholla;
        } else if (cat === 'parkiran') {
          targetLayer = this.layers.parkiran;
        } else if (cat === 'toilet') {
          targetLayer = this.layers.toilet;
        } else if (cat === 'gerbang') {
          targetLayer = this.layers.gerbang;
        }

        const icon = this.createPinIcon(pinType, item.icon);
        const marker = L.marker([item.lat, item.lng], { icon });
        marker.bindPopup(`
          <div class="map-popup-card">
            <span class="popup-tag-forest">${item.tag || '🌿 Spot Hutan UNESA'}</span>
            <h4 class="popup-title">${item.name}</h4>
            <p class="popup-desc">${item.desc}</p>
            <button class="popup-nav-btn" onclick="window.nesaApp.routeToPoint(${item.lat}, ${item.lng}, '${item.name.replace(/'/g, "\\'")}')">
              🧭 Petunjuk Arah
            </button>
          </div>
        `);
        targetLayer.addLayer(marker);
        registerMarker(item.id, marker);
      });
    }

    // 2. Render Gerbang Masuk (tidak ada di spots.json)
    (NESA_DATA.poi.gerbang || []).forEach(item => {
      const icon = this.createPinIcon('gerbang', item.icon);
      const marker = L.marker([item.lat, item.lng], { icon });
      marker.bindPopup(`
        <div class="map-popup-card">
          <span class="popup-tag-forest">🚪 Gerbang Masuk Kampus</span>
          <h4 class="popup-title">${item.name}</h4>
          <p class="popup-desc">${item.desc}</p>
          <div class="popup-badge">${item.highlight || 'Akses Masuk'}</div>
          <button class="popup-nav-btn" onclick="window.nesaApp.routeToPoint(${item.lat}, ${item.lng}, '${item.name.replace(/'/g, "\\'")}')">
            🧭 Petunjuk Arah
          </button>
        </div>
      `);
      this.layers.gerbang.addLayer(marker);
      registerMarker(item.id, marker);
    });
  }

  /**
   * Cari data spot berdasarkan ID atau Nama di seluruh dataset
   */
  findSpotAnywhere(identifier) {
    if (!identifier) return null;
    const clean = String(identifier).trim().toUpperCase();

    // 1. Cek NESA_DATA.spots (LOC001..LOC020)
    let found = (NESA_DATA.spots || []).find(s => s.id.toUpperCase() === clean || s.name.toUpperCase().includes(clean));
    if (found) return found;

    // 2. Cek POI groups (hutan, musholla, parkiran, toilet, gerbang)
    const poiKeys = ['hutan', 'musholla', 'parkiran', 'toilet', 'gerbang'];
    for (const key of poiKeys) {
      const list = NESA_DATA.poi[key] || [];
      found = list.find(s => s.id.toUpperCase() === clean || s.name.toUpperCase().includes(clean));
      if (found) return found;
    }

    // 3. Cek Challenge Positions (Pos 1 s/d 6)
    found = (NESA_DATA.challengePositions || []).find(p => p.id.toUpperCase() === clean || String(p.index) === clean || p.name.toUpperCase().includes(clean));
    if (found) return found;

    return null;
  }

  /**
   * Sorot titik spot tertentu di peta dan buka popup-nya
   */
  highlightSpot(spotId) {
    if (!spotId) return;
    const cleanId = String(spotId).toUpperCase();
    if (!this.map) {
      this.pendingHighlight = cleanId;
      return;
    }

    const spot = this.findSpotAnywhere(cleanId);
    if (spot && this.map) {
      // Jika tidak ada rute aktif, baru flyTo. Jika rute aktif, pertahankan bounds agar garis rute terlihat utuh!
      if (!this.activeRoute) {
        this.map.flyTo([spot.lat, spot.lng], 17.5, { duration: 0.8 });
      }
      const marker = this.spotMarkers[cleanId] || this.spotMarkers[spot.id?.toUpperCase()];
      if (marker) {
        setTimeout(() => {
          marker.openPopup();
        }, 400);
      }
    }
  }

  /**
   * Filter layer POI On/Off
   */
  togglePOILayer(category) {
    if (this.activeFilter[category] !== undefined) {
      this.activeFilter[category] = !this.activeFilter[category];
      if (this.activeFilter[category]) {
        this.map.addLayer(this.layers[category]);
      } else {
        this.map.removeLayer(this.layers[category]);
      }
      return this.activeFilter[category];
    }
    return false;
  }

  /**
   * Inisialisasi marker lokasi pengguna & lingkaran akurasi real-time GPS
   */
  initUserMarker() {
    const userIcon = L.divIcon({
      className: 'user-radar-div-icon',
      html: `
        <div class="user-radar-beacon">
          <div class="user-radar-center"></div>
        </div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });

    // Posisi awal default di kawasan Hutan UNESA
    if (!this.userCoordinates || !Array.isArray(this.userCoordinates)) {
      this.userCoordinates = [-7.3002, 112.6738];
    }

    // 1. Inisialisasi Lingkaran Akurasi GPS (Palet Natural Sage #7F8C6A)
    if (!this.userAccuracyCircle) {
      this.userAccuracyCircle = L.circle(this.userCoordinates, {
        radius: 15,
        color: '#7F8C6A',
        weight: 1.5,
        opacity: 0.65,
        fillColor: '#7F8C6A',
        fillOpacity: 0.12,
        interactive: false
      });
      userAccuracyCircle = this.userAccuracyCircle;
      window.userAccuracyCircle = this.userAccuracyCircle;
    }
    if (this.map) {
      if (this.userAccuracyCircle._map && this.userAccuracyCircle._map !== this.map) {
        try { this.userAccuracyCircle.removeFrom(this.userAccuracyCircle._map); } catch (e) {}
      }
      if (!this.map.hasLayer(this.userAccuracyCircle)) {
        this.userAccuracyCircle.addTo(this.map);
      }
    }

    // 2. Inisialisasi User Marker Radar
    if (!this.userMarker) {
      this.userMarker = L.marker(this.userCoordinates, { icon: userIcon, zIndexOffset: 1000 });
      userMarker = this.userMarker;
      window.userMarker = this.userMarker;
    }
    if (this.map) {
      if (this.userMarker._map && this.userMarker._map !== this.map) {
        try { this.userMarker.removeFrom(this.userMarker._map); } catch (e) {}
      }
      if (!this.map.hasLayer(this.userMarker)) {
        this.userMarker.addTo(this.map);
      }
    }

    // 3. Pasang Real-Time GPS Tracking via navigator.geolocation.watchPosition
    this.startLocationWatch();
  }

  /**
   * Mengaktifkan pelacakan posisi GPS secara Real-Time (watchPosition)
   */
  startLocationWatch() {
    if (!('geolocation' in navigator)) {
      console.warn('[NesaMate GPS] Browser tidak mendukung navigator.geolocation.');
      return;
    }

    if (this.watchId !== null) {
      // Watcher sudah aktif, tidak perlu membuat duplikasi
      return;
    }

    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy || 10;

        this.onLocationUpdate(lat, lng, accuracy);
      },
      (err) => {
        console.warn(`[NesaMate GPS] watchPosition notice (${err.code}): ${err.message}`);
      },
      geoOptions
    );
  }

  /**
   * Dipanggil setiap kali ada koordinat baru dari watchPosition
   */
  onLocationUpdate(lat, lng, accuracy = 10) {
    this.userCoordinates = [lat, lng];

    // Geser posisi marker pengguna secara real-time tanpa render ulang peta
    if (this.userMarker) {
      this.userMarker.setLatLng([lat, lng]);
    }
    if (window.userMarker && window.userMarker !== this.userMarker) {
      window.userMarker.setLatLng([lat, lng]);
    }

    // Perbarui posisi & radius lingkaran akurasi GPS
    if (this.userAccuracyCircle) {
      this.userAccuracyCircle.setLatLng([lat, lng]);
      if (typeof accuracy === 'number' && accuracy > 0) {
        this.userAccuracyCircle.setRadius(accuracy);
      }
    }
    if (window.userAccuracyCircle && window.userAccuracyCircle !== this.userAccuracyCircle) {
      window.userAccuracyCircle.setLatLng([lat, lng]);
      if (typeof accuracy === 'number' && accuracy > 0) {
        window.userAccuracyCircle.setRadius(accuracy);
      }
    }

    // Auto-follow: peta mengikuti pergerakan user secara otomatis (panTo) jika tidak digeser manual
    if (this.isAutoFollow && this.map) {
      this.map.panTo([lat, lng], { animate: true });
    }

    // Sinkronisasi navigasi & jarak rute secara real-time
    this.updateActiveNavigationProgress(lat, lng);

    // Sinkronisasi posisi GPS pengguna ke peta 3D jika tersedia
    if (window.nesa3DMap && typeof window.nesa3DMap.updateUserLocation === 'function') {
      window.nesa3DMap.updateUserLocation(lat, lng);
    }
  }

  /**
   * Sinkronisasi jarak real-time & rute aktif menyusuri destinasi (Haversine & auto-arrive)
   */
  updateActiveNavigationProgress(lat, lng) {
    if (!this.activeRoute) return;

    const targetLat = this.activeRoute.targetLat;
    const targetLng = this.activeRoute.targetLng;
    const destName = this.activeRoute.destinationName || 'Destinasi';

    // Hitung jarak Haversine (meter)
    const dLat = (targetLat - lat) * (Math.PI / 180);
    const dLng = (targetLng - lng) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat * (Math.PI / 180)) * Math.cos(targetLat * (Math.PI / 180)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distMeters = Math.round(6371000 * c);

    // KONDISI TIBA DI TUJUAN: Jarak <= 12 meter
    if (distMeters <= 12) {
      console.log(`[NesaMate GPS] Tiba di tujuan: ${destName} (${distMeters} m)`);

      // Bersihkan garis rute aktif & marker tujuan
      this.clearRoute();

      // Sembunyikan floating banner / card navigasi jika ada di DOM
      const navCard = document.getElementById('free-nav-active-card');
      if (navCard) {
        navCard.classList.remove('is-active');
      }
      if (typeof window.setAvatarState === 'function') {
        window.setAvatarState('full');
      }

      // Berikan suara sambutan ramah Nesa jika tersedia
      const arrivalMsg = `Hore! Kamu sudah tiba di ${destName}. Selamat menjelajahi Hutan UNESA!`;
      if (window.nesaVoice && typeof window.nesaVoice.speak === 'function') {
        window.nesaVoice.speak(arrivalMsg);
      }

      if (window.nesaApp && typeof window.nesaApp.showToast === 'function') {
        window.nesaApp.showToast(`🎉 Tiba di ${destName}!`);
      }
      return;
    }

    // Belum sampai: Perbarui status jarak & waktu estimasi pada activeRoute
    const estMinutes = Math.max(1, Math.round(distMeters / 70));
    this.activeRoute.distMeters = distMeters;
    this.activeRoute.estMinutes = estMinutes;
    this.activeRoute.start = L.latLng(lat, lng);

    // Perbarui teks jarak pada UI floating card
    const distEl = document.getElementById('free-nav-dest-distance');
    if (distEl) {
      distEl.textContent = `~${distMeters} m (±${estMinutes} mnt)`;
    }

    // Perbarui titik awal dan koordinat polyline rute secara otomatis
    const start = L.latLng(lat, lng);
    const end = L.latLng(targetLat, targetLng);
    const newWaypoints = this.generateCampusWaypoints(start, end);
    this.activeRoute.waypoints = newWaypoints;

    if (Array.isArray(this.routeLayers) && this.routeLayers.length > 0) {
      this.routeLayers.forEach(layer => {
        if (layer && typeof layer.setLatLngs === 'function') {
          layer.setLatLngs(newWaypoints);
        }
      });
    }

    if (window.nesa3DMap && window.nesa3DMap.isLoaded && window.nesa3DMap.isActive) {
      window.nesa3DMap.drawRouteFromGPS(newWaypoints, destName, true);
    }
  }

  updateUserPosition(lat, lng) {
    this.onLocationUpdate(lat, lng, 10);
  }

  recenterUser() {
    this.isAutoFollow = true;
    if (this.map && this.userCoordinates) {
      this.map.flyTo(this.userCoordinates, 17.5, { duration: 0.8 });
    }
  }

  recenterCampus() {
    this.isAutoFollow = true;
    if (this.map) {
      if (this.userCoordinates) {
        this.map.flyTo(this.userCoordinates, 17.5, { duration: 0.8 });
      } else {
        this.map.flyTo(NESA_DATA.campusCenter, NESA_DATA.zoomDefault, { duration: 0.8 });
      }
    }
  }

  /**
   * Menghitung jalur lekukan natural pedestrian untuk rute Hutan UNESA
   */
  haversineMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  calculateBearing(lat1, lng1, lat2, lng2) {
    const toRad = d => d * (Math.PI / 180);
    const toDeg = r => r * (180 / Math.PI);
    const dLng = toRad(lng2 - lng1);
    const y = Math.sin(dLng) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
              Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  computeTurnHint(waypoints) {
    if (!Array.isArray(waypoints) || waypoints.length < 3) {
      return 'Ikuti jalur lurus';
    }
    let accDist = 0;
    for (let i = 1; i < waypoints.length - 1; i++) {
      const prev = waypoints[i - 1];
      const curr = waypoints[i];
      const next = waypoints[i + 1];
      accDist += this.haversineMeters(prev.lat, prev.lng, curr.lat, curr.lng);
      if (accDist < 12) continue;
      const b1 = this.calculateBearing(prev.lat, prev.lng, curr.lat, curr.lng);
      const b2 = this.calculateBearing(curr.lat, curr.lng, next.lat, next.lng);
      let diff = ((b2 - b1 + 540) % 360) - 180;
      if (Math.abs(diff) >= 35) {
        const arah = diff > 0 ? 'belok kanan' : 'belok kiri';
        return `Lurus ${Math.round(accDist)}m lalu ${arah}`;
      }
    }
    return 'Lurus mengikuti jalur setapak';
  }

  async loadWalkableNetwork() {
    try {
      const res = await fetch('/assets/walkable_network.json?v=2.4.8', { cache: 'no-store' });
      if (!res.ok) return;
      const net = await res.json();
      const nodes = net.nodes || {};
      const adj = {};
      const customWays = [];
      (net.ways || []).forEach(way => {
        const wNodes = way.nodes || [];
        if (Number(way.id) >= 1561513534) {
          customWays.push(wNodes);
        }
        for (let i = 0; i < wNodes.length - 1; i++) {
          const u = String(wNodes[i]);
          const v = String(wNodes[i + 1]);
          if (!nodes[u] || !nodes[v]) continue;
          const d = this.haversineMeters(nodes[u].lat, nodes[u].lon, nodes[v].lat, nodes[v].lon);
          if (!adj[u]) adj[u] = [];
          if (!adj[v]) adj[v] = [];
          adj[u].push({ to: v, w: d });
          adj[v].push({ to: u, w: d });
        }
      });
      this.walkNodes = nodes;
      this.walkAdj = adj;
      if (this.map && customWays.length > 0) {
        if (this.customFootpathLayer) {
          this.map.removeLayer(this.customFootpathLayer);
        }
        const lines = customWays.map(wNodes => {
          const pts = wNodes.map(id => nodes[String(id)]).filter(Boolean).map(n => [n.lat, n.lon]);
          return pts.length > 1
            ? L.polyline(pts, { color: '#e07a5f', weight: 2.5, opacity: 0.88, dashArray: '4, 6' })
            : null;
        }).filter(Boolean);
        this.customFootpathLayer = L.layerGroup(lines).addTo(this.map);
      }
      console.log(`[NesaMate Map] Walkable OSM network loaded: ${Object.keys(adj).length} connected nodes`);
    } catch (e) {
      console.warn('[NesaMate Map] Gagal memuat walkable_network.json:', e);
    }
  }

  findWalkablePath(start, end) {
    if (!this.walkNodes || !this.walkAdj) return null;
    const connectedIds = Object.keys(this.walkAdj);
    if (connectedIds.length === 0) return null;

    const findNearest = (lat, lng) => {
      let bestId = null;
      let bestDist = Infinity;
      for (const id of connectedIds) {
        const n = this.walkNodes[id];
        const d = this.haversineMeters(lat, lng, n.lat, n.lon);
        if (d < bestDist) {
          bestDist = d;
          bestId = id;
        }
      }
      return bestId;
    };

    const startId = findNearest(start.lat, start.lng);
    const goalId = findNearest(end.lat, end.lng);
    if (!startId || !goalId) return null;

    const goalNode = this.walkNodes[goalId];
    const gScore = { [startId]: 0 };
    const fScore = { [startId]: this.haversineMeters(this.walkNodes[startId].lat, this.walkNodes[startId].lon, goalNode.lat, goalNode.lon) };
    const cameFrom = {};
    const openSet = new Set([startId]);
    const closedSet = new Set();

    while (openSet.size > 0) {
      let current = null;
      let lowestF = Infinity;
      for (const id of openSet) {
        const f = fScore[id] ?? Infinity;
        if (f < lowestF) {
          lowestF = f;
          current = id;
        }
      }
      if (!current) break;
      if (current === goalId) {
        const path = [];
        let curr = current;
        while (curr) {
          const n = this.walkNodes[curr];
          path.unshift(L.latLng(n.lat, n.lon));
          curr = cameFrom[curr];
        }
        return [start, ...path, end];
      }
      openSet.delete(current);
      closedSet.add(current);

      for (const edge of (this.walkAdj[current] || [])) {
        if (closedSet.has(edge.to)) continue;
        const tentativeG = (gScore[current] ?? Infinity) + edge.w;
        if (tentativeG < (gScore[edge.to] ?? Infinity)) {
          cameFrom[edge.to] = current;
          gScore[edge.to] = tentativeG;
          const neighbor = this.walkNodes[edge.to];
          fScore[edge.to] = tentativeG + this.haversineMeters(neighbor.lat, neighbor.lon, goalNode.lat, goalNode.lon);
          openSet.add(edge.to);
        }
      }
    }
    return null;
  }

  /**
   * Menghitung rute jalan kaki mengikuti jaringan jalur setapak & jalan kampus UNESA (A* OSM)
   */
  generateCampusWaypoints(start, end) {
    const osmPath = this.findWalkablePath(start, end);
    if (osmPath && osmPath.length >= 2) {
      return osmPath;
    }
    const nodes = {
      east_entry: [-7.3002, 112.6738],
      east_road: [-7.3005, 112.6726],
      south_east: [-7.30168, 112.67238],
      park_se_corner: [-7.30165, 112.67210],
      flora: [-7.30143, 112.67172],
      ayam: [-7.30112, 112.67134],
      tugu_bend: [-7.30092, 112.67106],
      tugu: [-7.30085, 112.67096],
      pond_east: [-7.30063, 112.67098],
      rusa: [-7.300756, 112.670951],
      penangkaran: [-7.300416, 112.670883],
      angsa: [-7.300517, 112.670652],
      merak: [-7.300464, 112.670441],
      merpati: [-7.300471, 112.670307],
      bugar: [-7.300548, 112.670248],
      danau_kecil: [-7.300733, 112.670126],
      gazebo1: [-7.300744, 112.671448],
      gazebo2: [-7.30044, 112.671475],
      setapak_utara: [-7.30017, 112.671744],
      danau_bunga: [-7.300294, 112.671901],
      shelter_selatan: [-7.3018, 112.6726],
      arboretum: [-7.3028, 112.6738],
      gelora: [-7.2988, 112.6720],
      tpst: [-7.302821, 112.668399]
    };

    const edges = [
      ['east_entry', 'east_road'],
      ['east_road', 'danau_bunga'],
      ['danau_bunga', 'setapak_utara'],
      ['setapak_utara', 'gazebo2'],
      ['gazebo2', 'gazebo1'],
      ['gazebo1', 'ayam'],
      ['gazebo2', 'penangkaran'],
      ['penangkaran', 'angsa'],
      ['angsa', 'merak'],
      ['merak', 'merpati'],
      ['merpati', 'bugar'],
      ['bugar', 'danau_kecil'],
      ['east_road', 'south_east'],
      ['south_east', 'park_se_corner'],
      ['park_se_corner', 'flora'],
      ['flora', 'ayam'],
      ['ayam', 'tugu_bend'],
      ['tugu_bend', 'tugu'],
      ['tugu', 'pond_east'],
      ['pond_east', 'rusa'],
      ['pond_east', 'penangkaran'],
      ['rusa', 'danau_kecil'],
      ['south_east', 'shelter_selatan'],
      ['shelter_selatan', 'arboretum'],
      ['east_entry', 'gelora'],
      ['gelora', 'setapak_utara'],
      ['danau_kecil', 'tpst']
    ];

    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

    // Bangun adjacency list
    const adj = {};
    Object.keys(nodes).forEach(k => { adj[k] = []; });
    edges.forEach(([u, v]) => {
      const w = dist(nodes[u], nodes[v]);
      adj[u].push({ to: v, w });
      adj[v].push({ to: u, w });
    });

    const startArr = [start.lat, start.lng];
    const endArr = [end.lat, end.lng];

    // Jika sangat dekat (< 35m), hubungkan langsung
    if (dist(startArr, endArr) < 0.00032) {
      return [start, end];
    }

    const findNearestNode = (pt) => {
      let best = null;
      let bestD = Infinity;
      for (const [k, coords] of Object.entries(nodes)) {
        const d = dist(pt, coords);
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }
      return best;
    };

    const startNode = findNearestNode(startArr);
    const endNode = findNearestNode(endArr);

    // Dijkstra shortest path
    const dMap = {};
    const prev = {};
    const visited = new Set();
    Object.keys(nodes).forEach(k => { dMap[k] = Infinity; });
    dMap[startNode] = 0;

    while (visited.size < Object.keys(nodes).length) {
      let curr = null;
      let currD = Infinity;
      for (const k of Object.keys(nodes)) {
        if (!visited.has(k) && dMap[k] < currD) {
          currD = dMap[k];
          curr = k;
        }
      }
      if (!curr || curr === endNode) break;
      visited.add(curr);
      for (const edge of adj[curr]) {
        const nd = currD + edge.w;
        if (nd < dMap[edge.to]) {
          dMap[edge.to] = nd;
          prev[edge.to] = curr;
        }
      }
    }

    const pathNodes = [];
    let trace = endNode;
    while (trace) {
      pathNodes.unshift(L.latLng(nodes[trace][0], nodes[trace][1]));
      if (trace === startNode) break;
      trace = prev[trace];
    }

    const waypoints = [start];
    pathNodes.forEach(pt => {
      const last = waypoints[waypoints.length - 1];
      if (last.distanceTo(pt) > 8) {
        waypoints.push(pt);
      }
    });
    if (waypoints[waypoints.length - 1].distanceTo(end) > 5) {
      waypoints.push(end);
    }
    return waypoints;
  }

  /**
   * Gambar garis rute navigasi mandiri berdesain Safari-Natural presisi (Anti 404)
   */
  drawRouteTo(targetLat, targetLng, destinationName = 'Destinasi') {
    if (typeof window.setAvatarState === 'function') {
      window.setAvatarState('compact');
    }

    if (!this.map) {
      this.pendingRoute = { targetLat, targetLng, destinationName };
      return;
    }

    this.clearRoute();
    if (this.map) {
      this.map.closePopup();
    }

    const start = L.latLng(this.userCoordinates[0], this.userCoordinates[1]);
    const end = L.latLng(targetLat, targetLng);

    // Hitung jarak Haversine (meter)
    const dLat = (end.lat - start.lat) * (Math.PI / 180);
    const dLng = (end.lng - start.lng) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(start.lat * (Math.PI / 180)) * Math.cos(end.lat * (Math.PI / 180)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distMeters = Math.round(6371000 * c);
    const estMinutes = Math.max(1, Math.round(distMeters / 70)); // Estimasi jalan kaki santai 70m/menit

    let polylineLayers = [];
    const renderWaypoints = (waypoints) => {
      if (!this.map) return;
      polylineLayers.forEach(layer => {
        try { this.map.removeLayer(layer); } catch (e) {}
      });
      polylineLayers = [];

      // 1. Lapisan Glow Luar (Ambient Safari Trail)
      const glowPoly = L.polyline(waypoints, {
        color: '#1E3B2F',
        weight: 12,
        opacity: 0.22,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(this.map);
      polylineLayers.push(glowPoly);
      this.routeLayers.push(glowPoly);

      // 2. Lapisan Jalur Utama (Dark Forest Solid)
      const mainPoly = L.polyline(waypoints, {
        color: '#1E3B2F',
        weight: 6,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(this.map);
      polylineLayers.push(mainPoly);
      this.routeLayers.push(mainPoly);

      // 3. Lapisan Garis Panduan Aksen Putus-Putus Emas (Pulsing Gold Trail)
      const dashPoly = L.polyline(waypoints, {
        color: '#C8B48A',
        weight: 3,
        opacity: 0.98,
        dashArray: '8, 8',
        lineCap: 'round'
      }).addTo(this.map);
      polylineLayers.push(dashPoly);
      this.routeLayers.push(dashPoly);

      this.map.fitBounds(mainPoly.getBounds(), { padding: [70, 70], maxZoom: 18 });
    };

    const routeWaypoints = this.generateCampusWaypoints(start, end);
    renderWaypoints(routeWaypoints);

    let pathDist = 0;
    for (let i = 0; i < routeWaypoints.length - 1; i++) {
      pathDist += this.haversineMeters(
        routeWaypoints[i].lat, routeWaypoints[i].lng,
        routeWaypoints[i + 1].lat, routeWaypoints[i + 1].lng
      );
    }
    const finalDistMeters = Math.max(distMeters, Math.round(pathDist));
    const finalEstMinutes = Math.max(1, Math.round(finalDistMeters / 70));
    const turnHint = this.computeTurnHint(routeWaypoints);

    // 4. Marker Destinasi Khusus Navigasi (Pin Bendera Safari)
    const destIcon = L.divIcon({
      className: 'dest-flag-div-icon',
      html: `
        <div class="dest-flag-pin">
          <span class="dest-flag-emoji">🏁</span>
          <span class="dest-flag-text">${destinationName}</span>
        </div>
      `,
      iconSize: [120, 36],
      iconAnchor: [60, 36]
    });
    this.destMarker = L.marker(end, { icon: destIcon, zIndexOffset: 2500 }).addTo(this.map);

    this.activeRoute = {
      start,
      end,
      targetLat,
      targetLng,
      destinationName,
      distMeters: finalDistMeters,
      estMinutes: finalEstMinutes,
      turnHint,
      waypoints: routeWaypoints
    };

    // Fit view peta secara proporsional dengan padding asimetris
    // (Atas diberi ruang 130px untuk Header & Banner Navigasi, Bawah 80px untuk kontrol)
    const bounds = L.latLngBounds([start, end]);
    this.map.fitBounds(bounds, {
      paddingTopLeft: [24, 130],
      paddingBottomRight: [24, 80],
      maxZoom: 17.5
    });

    return this.activeRoute;
  }

  /**
   * Hapus garis rute aktif dan marker tujuan
   */
  clearRoute() {
    this.pendingRoute = null;
    this.routeLayers.forEach(layer => {
      try { this.map.removeLayer(layer); } catch (e) {}
    });
    this.routeLayers = [];

    if (this.destMarker) {
      try { this.map.removeLayer(this.destMarker); } catch (e) {}
      this.destMarker = null;
    }

    this.activeRoute = null;
  }

  /**
   * Render Marker Pos Challenge (Pos 1 s/d Pos 6)
   */
  renderChallengeMarkers(positions, activeIndex = 1, onPosClick = null) {
    this.layers.challenge.clearLayers();

    positions.forEach(pos => {
      const isCompleted = pos.completed;
      const isActive = (pos.index === activeIndex);

      let badgeText = `${pos.index}`;
      if (isCompleted) badgeText = '✓';

      let pinClass = 'challenge-map-pin';
      if (isCompleted) pinClass += ' is-completed';
      if (isActive) pinClass += ' is-active';

      const icon = L.divIcon({
        className: 'nesa-challenge-div-icon',
        html: `
          <div class="${pinClass}">
            <span>${badgeText}</span>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -20]
      });

      const marker = L.marker([pos.lat, pos.lng], { icon, zIndexOffset: isActive ? 1200 : 800 });
      marker.bindPopup(`
        <div class="map-popup-card">
          <span class="popup-tag-gold">🎯 Pos Tantangan ${pos.index}/6</span>
          <h4 class="popup-title">${pos.name}</h4>
          <p class="popup-desc">${pos.desc}</p>
          <div class="popup-badge">${pos.badge || 'Tantangan Petualang'}</div>
          <button class="popup-nav-btn" onclick="window.nesaApp.selectStartingPos(${pos.index})">
            🗺️ Rute ke Pos Ini
          </button>
        </div>
      `);

      if (onPosClick) {
        marker.on('click', () => onPosClick(pos));
      }

      this.layers.challenge.addLayer(marker);
      this.spotMarkers[`POS-${pos.index}`] = marker;
      this.spotMarkers[pos.id?.toUpperCase()] = marker;
    });
  }

  /**
   * Visualisasi Rute Jogging Track (Secondary Sage #7F8C6A)
   */
  showJoggingTrack() {
    this.clearJoggingTrack();
    if (!this.map) return;

    // Pastikan layer jogging aktif pada map mode jogging
    this.layers.jogging.addTo(this.map);

    const coords = NESA_DATA.joggingTrack.coordinates;

    // Outer glow track
    L.polyline(coords, {
      color: '#1E3B2F',
      weight: 10,
      opacity: 0.25,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.layers.jogging);

    // Inner main route track
    this.joggingLine = L.polyline(coords, {
      color: '#7F8C6A',
      weight: 5.5,
      opacity: 0.95,
      dashArray: '10, 6',
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.layers.jogging);

    if (this.map && this.joggingLine) {
      this.map.fitBounds(this.joggingLine.getBounds(), { padding: [40, 40] });
    }
  }

  clearJoggingTrack() {
    this.layers.jogging.clearLayers();
    this.joggingLine = null;
    if (this.map && this.map.hasLayer(this.layers.jogging)) {
      try {
        this.map.removeLayer(this.layers.jogging);
      } catch (e) {}
    }
  }
}

// Global Map Singleton
window.nesaMap = new NesaMapManager();
