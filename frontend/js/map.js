/**
 * NesaMate - Map & Routing Manager (Leaflet.js + Leaflet Routing Machine + Geolocation)
 * Menangani peta presisi Kampus & Hutan UNESA Lidah Wetan, marker POI kustom, rute tantangan, dan track lari.
 */

class NesaMapManager {
  constructor() {
    this.map = null;
    this.userMarker = null;
    this.userCoordinates = NESA_DATA.campusCenter;
    this.watchId = null;

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

    this.routingControl = null;
    this.activePolyline = null;
    this.joggingLine = null;
  }

  /**
   * Inisialisasi peta Leaflet
   */
  initMap(containerId = 'free-map-container') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (this.map) {
      try {
        this.map.remove();
      } catch (err) {}
      this.map = null;
    }

    // Set view peta otomatis berada tepat di tengah koordinat Hutan UNESA (-7.3005, 112.6740)
    this.map = L.map(containerId, {
      center: NESA_DATA.campusCenter,
      zoom: NESA_DATA.zoomDefault,
      zoomControl: false, // Hilangkan zoom bawaan di atas agar tidak menabrak header bar
      attributionControl: false
    });

    // 1. Esri World Street Map: stabil, tanpa watermark API key, dan bebas blokir HTTP 403 di Chrome
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19
    }).addTo(this.map);

    // Tambahkan layer POI ke map
    this.layers.hutan.addTo(this.map);
    this.layers.musholla.addTo(this.map);
    this.layers.parkiran.addTo(this.map);
    this.layers.toilet.addTo(this.map);
    this.layers.gerbang.addTo(this.map);
    this.layers.challenge.addTo(this.map);
    this.layers.jogging.addTo(this.map);

    // Render semua POI
    this.renderAllPOIs();

    // Pasang titik lokasi pengguna
    this.initUserMarker();

    // Invalidate size bertahap agar tiles Leaflet tidak abu-abu saat transisi layar
    [100, 300, 600].forEach(delay => {
      setTimeout(() => {
        if (this.map) this.map.invalidateSize();
      }, delay);
    });
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
   * Render semua titik POI (Spot Hutan Kota UNESA, Musholla, Parkiran, Toilet)
   */
  renderAllPOIs() {
    this.layers.hutan.clearLayers();
    this.layers.musholla.clearLayers();
    this.layers.parkiran.clearLayers();
    this.layers.toilet.clearLayers();
    this.layers.gerbang.clearLayers();

    // 1. Spot Hutan Kota UNESA
    NESA_DATA.poi.hutan.forEach(item => {
      const icon = this.createPinIcon('hutan', item.icon);
      const marker = L.marker([item.lat, item.lng], { icon });
      marker.bindPopup(`
        <div class="map-popup-card">
          <span class="popup-tag-forest">🌲 Spot Hutan Kota UNESA</span>
          <h4 class="popup-title">${item.name}</h4>
          <p class="popup-desc">${item.desc}</p>
          <div class="popup-badge">${item.highlight}</div>
          <button class="popup-nav-btn" onclick="window.nesaApp.routeToPoint(${item.lat}, ${item.lng}, '${item.name}')">
            🧭 Petunjuk Arah
          </button>
        </div>
      `);
      this.layers.hutan.addLayer(marker);
    });

    // 2. Musholla
    NESA_DATA.poi.musholla.forEach(item => {
      const icon = this.createPinIcon('musholla', item.icon);
      const marker = L.marker([item.lat, item.lng], { icon });
      marker.bindPopup(`
        <div class="map-popup-card">
          <span class="popup-tag-musholla">🕌 Fasilitas Ibadah</span>
          <h4 class="popup-title">${item.name}</h4>
          <p class="popup-desc">${item.desc}</p>
          <div class="popup-badge">${item.highlight}</div>
          <button class="popup-nav-btn" onclick="window.nesaApp.routeToPoint(${item.lat}, ${item.lng}, '${item.name}')">
            🧭 Petunjuk Arah
          </button>
        </div>
      `);
      this.layers.musholla.addLayer(marker);
    });

    // 3. Parkiran
    NESA_DATA.poi.parkiran.forEach(item => {
      const icon = this.createPinIcon('parkiran', item.icon);
      const marker = L.marker([item.lat, item.lng], { icon });
      marker.bindPopup(`
        <div class="map-popup-card">
          <span class="popup-tag-sage">🅿️ Area Parkir UNESA</span>
          <h4 class="popup-title">${item.name}</h4>
          <p class="popup-desc">${item.desc}</p>
          <div class="popup-badge">${item.highlight}</div>
          <button class="popup-nav-btn" onclick="window.nesaApp.routeToPoint(${item.lat}, ${item.lng}, '${item.name}')">
            🧭 Petunjuk Arah
          </button>
        </div>
      `);
      this.layers.parkiran.addLayer(marker);
    });

    // 4. Toilet
    NESA_DATA.poi.toilet.forEach(item => {
      const icon = this.createPinIcon('toilet', item.icon);
      const marker = L.marker([item.lat, item.lng], { icon });
      marker.bindPopup(`
        <div class="map-popup-card">
          <span class="popup-tag-sage">🚻 Fasilitas Sanitasi</span>
          <h4 class="popup-title">${item.name}</h4>
          <p class="popup-desc">${item.desc}</p>
          <div class="popup-badge">${item.highlight}</div>
          <button class="popup-nav-btn" onclick="window.nesaApp.routeToPoint(${item.lat}, ${item.lng}, '${item.name}')">
            🧭 Petunjuk Arah
          </button>
        </div>
      `);
      this.layers.toilet.addLayer(marker);
    });

    // 5. Gerbang Masuk
    NESA_DATA.poi.gerbang.forEach(item => {
      const icon = this.createPinIcon('gerbang', item.icon);
      const marker = L.marker([item.lat, item.lng], { icon });
      marker.bindPopup(`
        <div class="map-popup-card">
          <span class="popup-tag-forest">🚪 Gerbang Masuk Kampus</span>
          <h4 class="popup-title">${item.name}</h4>
          <p class="popup-desc">${item.desc}</p>
          <div class="popup-badge">${item.highlight}</div>
          <button class="popup-nav-btn" onclick="window.nesaApp.routeToPoint(${item.lat}, ${item.lng}, '${item.name}')">
            🧭 Petunjuk Arah
          </button>
        </div>
      `);
      this.layers.gerbang.addLayer(marker);
    });
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
   * Marker lokasi pengguna dengan radar pulsing
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

    this.userCoordinates = [-7.3002, 112.6738];
    this.userMarker = L.marker(this.userCoordinates, { icon: userIcon, zIndexOffset: 1000 }).addTo(this.map);

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.userCoordinates = [pos.coords.latitude, pos.coords.longitude];
          if (this.userMarker) {
            this.userMarker.setLatLng(this.userCoordinates);
          }
        },
        () => {
          // Fallback ke posisi default kampus UNESA
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }
  }

  updateUserPosition(lat, lng) {
    this.userCoordinates = [lat, lng];
    if (this.userMarker) {
      this.userMarker.setLatLng(this.userCoordinates);
    }
  }

  recenterCampus() {
    if (this.map) {
      this.map.flyTo(NESA_DATA.campusCenter, NESA_DATA.zoomDefault, { duration: 1.0 });
    }
  }

  recenterUser() {
    if (this.map && this.userCoordinates) {
      this.map.flyTo(this.userCoordinates, 17.5, { duration: 1.0 });
    }
  }

  /**
   * Gambar garis rute navigasi (Leaflet Routing Machine dengan fallback polyline lembut)
   */
  drawRouteTo(targetLat, targetLng, destinationName = 'Destinasi') {
    this.clearRoute();

    const start = L.latLng(this.userCoordinates[0], this.userCoordinates[1]);
    const end = L.latLng(targetLat, targetLng);

    const drawPolylineFallback = () => {
      if (this.activePolyline) return;
      const midLat = (start.lat + end.lat) / 2 + 0.0002;
      const midLng = (start.lng + end.lng) / 2 - 0.0002;

      this.activePolyline = L.polyline([start, [midLat, midLng], end], {
        color: '#1E3B2F',
        weight: 5,
        opacity: 0.9,
        dashArray: '8, 6'
      }).addTo(this.map);

      this.map.fitBounds([start, end], { padding: [70, 70], maxZoom: 17 });
    };

    if (typeof L.Routing !== 'undefined' && L.Routing.control) {
      try {
        this.routingControl = L.Routing.control({
          waypoints: [start, end],
          routeWhileDragging: false,
          showAlternatives: false,
          addWaypoints: false,
          draggableWaypoints: false,
          fitSelectedRoutes: true,
          lineOptions: {
            styles: [
              { color: '#1E3B2F', opacity: 0.85, weight: 6 },
              { color: '#C8B48A', opacity: 0.9, weight: 3, dashArray: '8, 8' }
            ]
          },
          createMarker: () => null
        }).addTo(this.map);

        this.routingControl.on('routingerror', () => {
          this.clearRoute();
          drawPolylineFallback();
        });

        const container = this.routingControl.getContainer();
        if (container) container.style.display = 'none';
        return;
      } catch (e) {
        drawPolylineFallback();
      }
    } else {
      drawPolylineFallback();
    }
  }

  clearRoute() {
    if (this.routingControl) {
      try { this.map.removeControl(this.routingControl); } catch (e) {}
      this.routingControl = null;
    }
    if (this.activePolyline) {
      this.map.removeLayer(this.activePolyline);
      this.activePolyline = null;
    }
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

      const icon = L.divIcon({
        className: 'nesa-challenge-pin-wrap',
        html: `
          <div class="challenge-map-pin ${isActive ? 'is-active' : ''} ${isCompleted ? 'is-completed' : ''}">
            <span>${badgeText}</span>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -34]
      });

      const marker = L.marker([pos.lat, pos.lng], { icon });
      marker.bindPopup(`
        <div class="map-popup-card">
          <span class="popup-tag-gold">${isCompleted ? '✅ Selesai' : isActive ? '🎯 Pos Aktif' : '🔒 Pos Misi'}</span>
          <h4 class="popup-title">${pos.name}</h4>
          <p class="popup-desc">${pos.desc}</p>
          <button class="popup-nav-btn" onclick="window.nesaApp.showChallengePosCard(${pos.index})">
            📝 Buka Form Passcode
          </button>
        </div>
      `);

      if (onPosClick) {
        marker.on('click', () => onPosClick(pos));
      }

      this.layers.challenge.addLayer(marker);
    });
  }

  /**
   * Visualisasi Rute Jogging Track (Secondary Sage #7F8C6A)
   */
  showJoggingTrack() {
    this.clearJoggingTrack();
    const coords = NESA_DATA.joggingTrack.coordinates;

    // Outer glow track
    const glow = L.polyline(coords, {
      color: '#1E3B2F',
      weight: 10,
      opacity: 0.25,
      lineCap: 'round',
      lineJoin: 'round'
    });

    // Main line tegas berwarna Secondary Sage (#7F8C6A)
    this.joggingLine = L.polyline(coords, {
      color: '#7F8C6A',
      weight: 5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
      dashArray: '10, 4'
    });

    this.layers.jogging.addLayer(glow);
    this.layers.jogging.addLayer(this.joggingLine);

    // Tandai titik start
    const startIcon = this.createPinIcon('jogging', '🚩');
    const startMarker = L.marker(coords[0], { icon: startIcon }).bindPopup('<b>Start / Finish Loop Lari</b>');
    this.layers.jogging.addLayer(startMarker);

    this.map.fitBounds(this.joggingLine.getBounds(), { padding: [50, 50] });
  }

  clearJoggingTrack() {
    this.layers.jogging.clearLayers();
    this.joggingLine = null;
  }
}

const nesaMap = new NesaMapManager();
