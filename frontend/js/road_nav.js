/**
 * ============================================================================
 * NesaMate - 3D Road Mesh Navigation & Obstacle-Free A* (road_nav.js)
 * ============================================================================
 * Memuat graf jalan + bitgrid obstacle (bangunan mesh_23 & danau mesh_13..17)
 * yang diekstrak langsung dari 3d maps.glb dalam koordinat dunia Three.js.
 * Menjamin rute selalu menyusuri jaringan jalan dan tidak menabrak bangunan.
 */

class NesaRoadNav {
  constructor() {
    this.cell = 0.75;
    this.yRoad = 2.34;
    // Pusat & skala proyeksi terkalibrasi (harus identik dengan map3d.js)
    this.centerLat = -7.300757;
    this.centerLng = 112.671246;
    this.scale = 17000;
    this.nodes = [];       // [[x, z], ...]
    this.nodeKeyMap = new Map(); // "gx,gz" -> nodeIdx
    this.adj = [];         // [{ to, cost }, ...]
    this.grid = null;      // { minGx, minGz, nx, nz, bytes }
    this.isReady = false;
    this.loadPromise = null;
  }

  /**
   * Proyeksi GPS (lat, lng) -> ruang 3D [x, y, z].
   */
  gpsTo3D(lat, lng) {
    let x = (lng - this.centerLng) * this.scale;
    let z = -(lat - this.centerLat) * this.scale;
    x = Math.max(-72, Math.min(72, x));
    z = Math.max(-72, Math.min(72, z));
    return [x, this.yRoad, z];
  }

  /**
   * Proyeksi balik ruang 3D (x, z) -> GPS [lat, lng].
   */
  toGps(x, z) {
    return [
      this.centerLat - z / this.scale,
      this.centerLng + x / this.scale
    ];
  }

  /**
   * Menghitung rute satu sumber kebenaran (single source of truth) untuk 2D & 3D
   * langsung dari koordinat GPS awal & tujuan, mengembalikan [[lat, lng], ...].
   */
  findLatLngPath(startLat, startLng, endLat, endLng) {
    if (!this.isReady) return null;
    const s = this.gpsTo3D(startLat, startLng);
    const e = this.gpsTo3D(endLat, endLng);
    const pathXZ = this.findPath(s[0], s[2], e[0], e[2]);
    if (!pathXZ || pathXZ.length < 2) return null;
    return pathXZ.map(([x, z]) => this.toGps(x, z));
  }

  /**
   * Memuat road_navgraph.json secara asinkron (idempoten).
   */
  load() {
    if (this.isReady) return Promise.resolve(true);
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = fetch('assets/road_navgraph.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges) || !data.grid) {
          throw new Error('Format road_navgraph.json tidak valid');
        }
        this.cell = data.cell || 0.75;
        this.yRoad = data.yRoad || 2.34;
        this.nodes = data.nodes;
        this.nodeKeyMap.clear();

        for (let i = 0; i < this.nodes.length; i++) {
          const gx = Math.round(this.nodes[i][0] / this.cell);
          const gz = Math.round(this.nodes[i][1] / this.cell);
          this.nodeKeyMap.set(`${gx},${gz}`, i);
        }

        this.adj = Array.from({ length: this.nodes.length }, () => []);
        for (const [u, v, isBridge] of data.edges) {
          const nu = this.nodes[u];
          const nv = this.nodes[v];
          if (!nu || !nv) continue;
          const dist = Math.hypot(nv[0] - nu[0], nv[1] - nu[1]);
          // Penalti ringan (1.35x) untuk konektor non-aspal agar efisiensi jarak tetap diutamakan
          // dan jalur kecil/setapak dipilih bila lebih cepat/dekat
          const weight = isBridge ? dist * 1.35 : dist;
          this.adj[u].push({ to: v, cost: weight });
          this.adj[v].push({ to: u, cost: weight });
        }

        const binStr = atob(data.grid.b64);
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) {
          bytes[i] = binStr.charCodeAt(i);
        }
        this.grid = {
          minGx: data.grid.minGx,
          minGz: data.grid.minGz,
          nx: data.grid.nx,
          nz: data.grid.nz,
          bytes
        };

        this.isReady = true;
        console.log(`[NesaRoadNav] Graf jalan siap: ${this.nodes.length} node, ${data.edges.length} edge.`);
        return true;
      })
      .catch((err) => {
        console.warn('[NesaRoadNav] Gagal memuat road_navgraph.json:', err);
        this.isReady = false;
        return false;
      });

    return this.loadPromise;
  }

  _inBounds(gx, gz) {
    const ix = gx - this.grid.minGx;
    const iz = gz - this.grid.minGz;
    return ix >= 0 && ix < this.grid.nx && iz >= 0 && iz < this.grid.nz;
  }

  _cellFlags(gx, gz) {
    if (!this._inBounds(gx, gz)) return 1; // Di luar batas dianggap obstacle
    const ix = gx - this.grid.minGx;
    const iz = gz - this.grid.minGz;
    const pos = iz * this.grid.nx + ix;
    return (this.grid.bytes[pos >> 2] >> ((pos & 3) * 2)) & 3;
  }

  isObstacleCell(gx, gz) {
    return (this._cellFlags(gx, gz) & 1) !== 0;
  }

  isRoadCell(gx, gz) {
    return (this._cellFlags(gx, gz) & 2) !== 0;
  }

  /**
   * Memeriksa apakah segmen garis (x0,z0)->(x1,z1) bebas dari bangunan/danau.
   */
  isLineClear(x0, z0, x1, z1) {
    const dist = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.max(2, Math.ceil(dist / (this.cell * 0.35)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const gx = Math.round((x0 + t * (x1 - x0)) / this.cell);
      const gz = Math.round((z0 + t * (z1 - z0)) / this.cell);
      if (this.isObstacleCell(gx, gz)) return false;
    }
    return true;
  }

  /**
   * Jika titik berada di dalam footprint bangunan/danau, geser ke sel bebas terdekat.
   */
  _snapToWalkableCell(x, z) {
    const sx = Math.round(x / this.cell);
    const sz = Math.round(z / this.cell);
    if (!this.isObstacleCell(sx, sz)) return [sx, sz];

    const visited = new Set([`${sx},${sz}`]);
    const queue = [[sx, sz]];
    let head = 0;
    while (head < queue.length && head < 2500) {
      const [gx, gz] = queue[head++];
      for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
        const nx = gx + dx;
        const nz = gz + dz;
        const key = `${nx},${nz}`;
        if (visited.has(key) || !this._inBounds(nx, nz)) continue;
        if (!this.isObstacleCell(nx, nz)) {
          return [nx, nz];
        }
        visited.add(key);
        queue.push([nx, nz]);
      }
    }
    return [sx, sz];
  }

  /**
   * Mencari jalur bebas-obstacle dari sel awal (off-road) ke node graf jalan terdekat.
   * Mengembalikan { nodeIdx, pathXZ } atau null.
   */
  _approachRoadGraph(startGx, startGz) {
    const startKey = `${startGx},${startGz}`;
    if (this.nodeKeyMap.has(startKey)) {
      const idx = this.nodeKeyMap.get(startKey);
      return { nodeIdx: idx, pathXZ: [this.nodes[idx]] };
    }

    // BFS/Dijkstra ringan pada sel non-obstacle hingga menyentuh node graf jalan
    const dist = new Map([[startKey, 0]]);
    const prev = new Map();
    const coords = new Map([[startKey, [startGx, startGz]]]);
    const pq = [[0, startKey]];
    let expansions = 0;

    while (pq.length > 0 && expansions < 6000) {
      let bestPos = 0;
      for (let i = 1; i < pq.length; i++) {
        if (pq[i][0] < pq[bestPos][0]) bestPos = i;
      }
      const [d, key] = pq[bestPos];
      pq[bestPos] = pq[pq.length - 1];
      pq.pop();

      if (d > (dist.get(key) ?? Infinity)) continue;
      expansions++;

      if (this.nodeKeyMap.has(key)) {
        const nodeIdx = this.nodeKeyMap.get(key);
        const pathXZ = [];
        let cur = key;
        while (cur) {
          const [cx, cz] = coords.get(cur);
          pathXZ.push([cx * this.cell, cz * this.cell]);
          cur = prev.get(cur);
        }
        pathXZ.reverse();
        return { nodeIdx, pathXZ };
      }

      const [gx, gz] = coords.get(key);
      for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
        const nx = gx + dx;
        const nz = gz + dz;
        if (!this._inBounds(nx, nz) || this.isObstacleCell(nx, nz)) continue;
        if (dx !== 0 && dz !== 0 && (this.isObstacleCell(gx + dx, gz) || this.isObstacleCell(gx, gz + dz))) {
          continue;
        }
        const nKey = `${nx},${nz}`;
        const step = (dx !== 0 && dz !== 0) ? 1.4142 : 1.0;
        const nd = d + step;
        if (nd < (dist.get(nKey) ?? Infinity)) {
          dist.set(nKey, nd);
          prev.set(nKey, key);
          coords.set(nKey, [nx, nz]);
          pq.push([nd, nKey]);
        }
      }
    }
    return null;
  }

  /**
   * A* di atas graf jalan (nodes + adj).
   */
  _astarGraph(startIdx, goalIdx) {
    if (startIdx === goalIdx) return [this.nodes[startIdx]];

    const n = this.nodes.length;
    const gScore = new Float64Array(n).fill(Infinity);
    const fScore = new Float64Array(n).fill(Infinity);
    const cameFrom = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);

    const goal = this.nodes[goalIdx];
    const h = (idx) => Math.hypot(goal[0] - this.nodes[idx][0], goal[1] - this.nodes[idx][1]);

    gScore[startIdx] = 0;
    fScore[startIdx] = h(startIdx);
    const open = new Set([startIdx]);

    while (open.size > 0) {
      let current = -1;
      let bestF = Infinity;
      for (const idx of open) {
        if (fScore[idx] < bestF) {
          bestF = fScore[idx];
          current = idx;
        }
      }

      if (current === goalIdx) {
        const path = [];
        let cur = current;
        while (cur !== -1) {
          path.push(this.nodes[cur]);
          cur = cameFrom[cur];
        }
        path.reverse();
        return path;
      }

      open.delete(current);
      closed[current] = 1;

      const neighbors = this.adj[current];
      for (let i = 0; i < neighbors.length; i++) {
        const { to, cost } = neighbors[i];
        if (closed[to]) continue;
        const tentativeG = gScore[current] + cost;
        if (tentativeG < gScore[to]) {
          cameFrom[to] = current;
          gScore[to] = tentativeG;
          fScore[to] = tentativeG + h(to);
          open.add(to);
        }
      }
    }
    return null;
  }

  /**
   * Menyederhanakan zig-zag grid HANYA jika garis pintas bebas obstacle dan tetap di area jalan.
   */
  _stringPullSafe(pts) {
    if (pts.length <= 2) return pts;
    const out = [pts[0]];
    let anchorIdx = 0;

    while (anchorIdx < pts.length - 1) {
      let farthest = anchorIdx + 1;
      // Cek maksimal 6 langkah ke depan agar rute tetap menempel di belokan jalan
      const maxLook = Math.min(pts.length - 1, anchorIdx + 6);
      for (let test = maxLook; test > anchorIdx + 1; test--) {
        if (this._isSegmentOnWalkableCorridor(pts[anchorIdx], pts[test])) {
          farthest = test;
          break;
        }
      }
      out.push(pts[farthest]);
      anchorIdx = farthest;
    }
    return out;
  }

  _isSegmentOnWalkableCorridor(a, b) {
    const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(2, Math.ceil(dist / (this.cell * 0.4)));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const x = a[0] + t * (b[0] - a[0]);
      const z = a[1] + t * (b[1] - a[1]);
      const gx = Math.round(x / this.cell);
      const gz = Math.round(z / this.cell);
      if (this.isObstacleCell(gx, gz)) return false;
      // Pastikan tetap di sel jalan atau bertetangga langsung dengan sel jalan
      let nearRoad = this.isRoadCell(gx, gz);
      if (!nearRoad) {
        for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          if (this.isRoadCell(gx + dx, gz + dz)) {
            nearRoad = true;
            break;
          }
        }
      }
      if (!nearRoad) return false;
    }
    return true;
  }

  /**
   * Mencari rute bebas-tabrakan dari (startX, startZ) ke (goalX, goalZ) mengikuti mesh jalan.
   */
  findPath(startX, startZ, goalX, goalZ) {
    if (!this.isReady || this.nodes.length === 0) return null;

    const [sGx, sGz] = this._snapToWalkableCell(startX, startZ);
    const [gGx, gGz] = this._snapToWalkableCell(goalX, goalZ);

    const startApproach = this._approachRoadGraph(sGx, sGz);
    const goalApproach = this._approachRoadGraph(gGx, gGz);
    if (!startApproach || !goalApproach) return null;

    const roadPath = this._astarGraph(startApproach.nodeIdx, goalApproach.nodeIdx);
    if (!roadPath) return null;

    // Gabungkan: startApproach + roadPath + reverse(goalApproach)
    const combined = [];
    for (const pt of startApproach.pathXZ) combined.push(pt);
    for (let i = 1; i < roadPath.length; i++) combined.push(roadPath[i]);
    const revGoal = goalApproach.pathXZ.slice(0, -1).reverse();
    for (const pt of revGoal) combined.push(pt);

    // Deduplikasi titik berjarak sangat dekat (< 0.1)
    const dedup = [];
    for (const pt of combined) {
      if (dedup.length === 0 || Math.hypot(pt[0] - dedup[dedup.length - 1][0], pt[1] - dedup[dedup.length - 1][1]) > 0.1) {
        dedup.push(pt);
      }
    }

    return this._stringPullSafe(dedup);
  }

  /**
   * Mencari indeks node jalan terdekat dari koordinat (x, z).
   */
  findNearestNode(x, z) {
    let bestIdx = -1;
    let bestDistSq = Infinity;
    for (let i = 0; i < this.nodes.length; i++) {
      const dx = this.nodes[i][0] - x;
      const dz = this.nodes[i][1] - z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  /**
   * Menjaga urutan titik rute dari peta 2D tetap identik 1:1 di peta 3D,
   * sambil menggeser titik yang kebetulan masuk ke footprint bangunan ke sisi luar terdekat.
   */
  nudgeWaypointsOffObstacles(points3D, roadY = this.yRoad) {
    if (!this.isReady || !points3D || points3D.length < 2) return points3D;
    return points3D.map((pt) => {
      const gx = Math.round(pt[0] / this.cell);
      const gz = Math.round(pt[2] / this.cell);
      if (!this.isObstacleCell(gx, gz)) {
        return [pt[0], roadY, pt[2]];
      }
      const [wx, wz] = this._snapToWalkableCell(pt[0], pt[2]);
      return [wx * this.cell, roadY, wz * this.cell];
    });
  }

  /**
   * Menghitung rute mengikuti koridor waypoint dari peta 2D (points3D),
   * dengan menyaring checkpoint setiap ~12 unit ke node jalan 3D terdekat
   * agar arah rute sama persis dengan peta 2D namun tetap menempel di mesh jalan 3D.
   */
  findCorridorPath(points3D, roadY = this.yRoad) {
    if (!this.isReady || !points3D || points3D.length < 2) return null;
    if (points3D.length <= 4) {
      return this.findMultiStopPath(points3D, roadY);
    }

    // Ambil titik awal, checkpoint koridor berjarak >= 12 unit (di-snap ke node jalan), dan titik akhir
    const checkpoints = [points3D[0]];
    let lastKept = points3D[0];
    for (let i = 1; i < points3D.length - 1; i++) {
      const pt = points3D[i];
      const d = Math.hypot(pt[0] - lastKept[0], pt[2] - lastKept[2]);
      if (d >= 12.0) {
        const nodeIdx = this.findNearestNode(pt[0], pt[2]);
        if (nodeIdx >= 0) {
          const [nx, nz] = this.nodes[nodeIdx];
          checkpoints.push([nx, roadY, nz]);
          lastKept = [nx, roadY, nz];
        }
      }
    }
    checkpoints.push(points3D[points3D.length - 1]);

    return this.findMultiStopPath(checkpoints, roadY);
  }

  /**
   * Membangun rute 3D yang bersih & bebas tabrakan untuk rute yang berasal dari peta 2D.
   * Waypoint 2D (OSM / graf manual) TIDAK berada tepat di jalan model 3D, sehingga meng-
   * reroute tiap segmen pendeknya satu per satu menghasilkan jalur muter & belokan balik.
   * Karena itu hanya titik awal & tujuan yang dipakai, lalu A* pada graf jalan 3D.
   * Jika gagal, fallback ke waypoint 2D yang digeser keluar dari obstacle.
   */
  conformRouteToObstacles(points3D, roadY = this.yRoad) {
    if (!this.isReady || !points3D || points3D.length < 2) return points3D;
    const s = points3D[0];
    const e = points3D[points3D.length - 1];
    const direct = this.findPath(s[0], s[2], e[0], e[2]);
    if (direct && direct.length >= 2) {
      return direct.map(([x, z]) => [x, roadY, z]);
    }
    return this.nudgeWaypointsOffObstacles(points3D, roadY);
  }

  /**
   * Menghitung rute multi-segmen untuk daftar titik 3D [[x, y, z], ...].
   */
  findMultiStopPath(points3D, roadY = this.yRoad) {
    if (!this.isReady || !points3D || points3D.length < 2) return null;

    const combined = [];
    for (let i = 0; i < points3D.length - 1; i++) {
      const a = points3D[i];
      const b = points3D[i + 1];
      const seg = this.findPath(a[0], a[2], b[0], b[2]);
      if (!seg || seg.length === 0) return null;

      const startAt = i === 0 ? 0 : 1;
      for (let j = startAt; j < seg.length; j++) {
        combined.push([seg[j][0], roadY, seg[j][1]]);
      }
    }
    return combined.length >= 2 ? combined : null;
  }
}

window.nesaRoadNav = new NesaRoadNav();
window.nesaRoadNav.load();
