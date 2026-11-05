'use strict';
// =====================================================================
//  Straßennetz aus OpenStreetMap (Overpass-API) und Routing (A*)
// =====================================================================

// Richtgeschwindigkeit je Straßenklasse in km/h
const ROAD_SPEEDS = {
  motorway: 90, motorway_link: 50, trunk: 70, trunk_link: 45, primary: 50, primary_link: 40,
  secondary: 45, secondary_link: 35, tertiary: 40, tertiary_link: 30,
  unclassified: 35, residential: 30, living_street: 10,
};
// Auf diesen Straßen entstehen Aufträge (keine Autobahnen)
const JOB_ROADS = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street']);
const OVERPASS_URLS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

// ---------- IndexedDB-Zwischenspeicher, damit das Netz nur einmal geladen wird ----------
function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('netzwerk', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('roads');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(key) {
  try {
    const db = await idbOpen();
    return await new Promise(res => {
      const q = db.transaction('roads').objectStore('roads').get(key);
      q.onsuccess = () => res(q.result || null);
      q.onerror = () => res(null);
    });
  } catch (e) { return null; }
}
async function idbPut(key, val) {
  try { const db = await idbOpen(); db.transaction('roads', 'readwrite').objectStore('roads').put(val, key); } catch (e) { /* egal */ }
}

const Roads = {
  g: null, status: 'none', error: '', key: null, cache: new Map(), token: 0,

  cacheKey(c) { return `v1:${c.center[0].toFixed(3)},${c.center[1].toFixed(3)},${c.radiusKm}`; },
  ready() { return this.status === 'ready' && !!this.g; },

  async load(c) {
    const key = this.cacheKey(c);
    if (this.ready() && this.key === key) return true;
    const tok = ++this.token;
    this.status = 'loading'; this.g = null; this.cache.clear(); this.error = '';
    try {
      let g = await idbGet(key);
      if (!g) {
        const data = await this.fetchOverpass(c);
        g = this.build(data);
        if (!g) throw new Error('Für dieses Gebiet wurden keine Straßen gefunden.');
        idbPut(key, { lat: g.lat, lng: g.lng, eFrom: g.eFrom, eTo: g.eTo, eW: g.eW, names: g.names, cand: g.cand });
      }
      if (tok !== this.token) return false;   // inzwischen anderes Spiel gestartet
      this.prepare(g);
      this.g = g; this.key = key; this.status = 'ready';
      return true;
    } catch (e) {
      if (tok !== this.token) return false;
      this.status = 'failed';
      this.error = (e && e.name === 'AbortError') ? 'Zeitüberschreitung beim Laden.' : (e && e.message) || String(e);
      return false;
    }
  },

  async fetchOverpass(c) {
    const r = Math.round((c.radiusKm + 1.5) * 1000);
    const q = `[out:json][timeout:90];way["highway"~"^(${Object.keys(ROAD_SPEEDS).join('|')})$"](around:${r},${c.center[0].toFixed(5)},${c.center[1].toFixed(5)});out body geom qt;`;
    let lastErr = null;
    for (const url of OVERPASS_URLS) {
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 100000);
        const res = await fetch(url, {
          method: 'POST', body: 'data=' + encodeURIComponent(q),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`Overpass-Server antwortet mit Fehler ${res.status}.`);
        return await res.json();
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('Overpass-Server nicht erreichbar.');
  },

  // Overpass-Antwort -> kompakter Graph (gerichtete Kanten, Gewicht in Sekunden)
  build(data) {
    const idx = new Map(), lat = [], lng = [], eFrom = [], eTo = [], eW = [];
    const names = [], nameIdx = new Map(), cand = [];
    const nodeOf = (id, p) => {
      let i = idx.get(id);
      if (i === undefined) { i = lat.length; idx.set(id, i); lat.push(p.lat); lng.push(p.lon); }
      return i;
    };
    for (const w of (data && data.elements) || []) {
      if (w.type !== 'way' || !w.geometry || !w.nodes) continue;
      const t = w.tags || {}, hw = t.highway;
      let sp = ROAD_SPEEDS[hw];
      if (!sp) continue;
      if (t.access === 'no' || t.access === 'private' || t.motor_vehicle === 'no' || t.motorcar === 'no') continue;
      const ms = parseInt(t.maxspeed, 10);
      if (ms > 0) sp = Math.min(sp, ms);
      const ow = t.oneway;
      const fwdOnly = ow === 'yes' || ow === 'true' || ow === '1' || t.junction === 'roundabout' || t.junction === 'circular' || hw === 'motorway';
      const revOnly = ow === '-1';
      const ids = w.nodes.map((id, k) => (w.geometry[k] ? nodeOf(id, w.geometry[k]) : -1));
      let nid = -1;
      if (t.name && JOB_ROADS.has(hw)) {
        nid = nameIdx.get(t.name);
        if (nid === undefined) { nid = names.length; names.push(t.name); nameIdx.set(t.name, nid); }
      }
      for (let k = 0; k < ids.length - 1; k++) {
        const a = ids[k], b = ids[k + 1];
        if (a < 0 || b < 0 || a === b) continue;
        const s = haversine([lat[a], lng[a]], [lat[b], lng[b]]) * 1000 / (sp / 3.6);
        if (!revOnly) { eFrom.push(a); eTo.push(b); eW.push(s); }
        if (!fwdOnly) { eFrom.push(b); eTo.push(a); eW.push(s); }
      }
      if (nid >= 0) for (const i of ids) if (i >= 0) cand.push(i, nid);
    }
    if (!lat.length || !eFrom.length) return null;
    return {
      lat: Float64Array.from(lat), lng: Float64Array.from(lng),
      eFrom: Int32Array.from(eFrom), eTo: Int32Array.from(eTo), eW: Float32Array.from(eW),
      names, cand: Int32Array.from(cand),
    };
  },

  // Adjazenzliste, größte zusammenhängende Komponente, Raster für Nächster-Knoten-Suche
  prepare(g) {
    const N = g.lat.length, E = g.eFrom.length;
    const start = new Int32Array(N + 1);
    for (let i = 0; i < E; i++) start[g.eFrom[i] + 1]++;
    for (let i = 0; i < N; i++) start[i + 1] += start[i];
    const to = new Int32Array(E), w = new Float32Array(E), fill = start.slice(0, N);
    for (let i = 0; i < E; i++) { const p = fill[g.eFrom[i]]++; to[p] = g.eTo[i]; w[p] = g.eW[i]; }
    g.start = start; g.to = to; g.w = w;

    const par = new Int32Array(N);
    for (let i = 0; i < N; i++) par[i] = i;
    const find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    for (let i = 0; i < E; i++) { const a = find(g.eFrom[i]), b = find(g.eTo[i]); if (a !== b) par[a] = b; }
    const size = new Int32Array(N);
    let best = 0;
    for (let i = 0; i < N; i++) { const r = find(i); size[r]++; if (size[r] > size[best]) best = r; }
    g.main = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (find(i) === best) g.main[i] = 1;

    g.cell = 0.004;
    g.grid = new Map();
    for (let i = 0; i < N; i++) {
      if (!g.main[i]) continue;
      const k = Math.floor(g.lat[i] / g.cell) + ':' + Math.floor(g.lng[i] / g.cell);
      let b = g.grid.get(k); if (!b) g.grid.set(k, b = []); b.push(i);
    }
    const cn = [], cm = [];
    for (let i = 0; i < g.cand.length; i += 2) if (g.main[g.cand[i]]) { cn.push(g.cand[i]); cm.push(g.cand[i + 1]); }
    g.candNode = Int32Array.from(cn); g.candName = Int32Array.from(cm);
  },

  nearest(pos) {
    const g = this.g; if (!g) return null;
    const ci = Math.floor(pos[0] / g.cell), cj = Math.floor(pos[1] / g.cell);
    const cos = Math.cos(pos[0] * Math.PI / 180);
    let best = null, bd = Infinity;
    for (let r = 0; r <= 8; r++) {
      for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const b = g.grid.get((ci + di) + ':' + (cj + dj)); if (!b) continue;
        for (const n of b) {
          const dy = g.lat[n] - pos[0], dx = (g.lng[n] - pos[1]) * cos, d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = n; }
        }
      }
      if (best !== null && r >= 1) break;
    }
    return best;
  },
  coord(n) { return [this.g.lat[n], this.g.lng[n]]; },

  // Zufälliger Punkt an einer benannten Straße im Einsatzgebiet
  randomSpot(center, radiusKm) {
    const g = this.g; if (!g || !g.candNode.length) return null;
    for (let k = 0; k < 40; k++) {
      const i = Math.floor(Math.random() * g.candNode.length);
      const p = this.coord(g.candNode[i]);
      if (haversine(p, center) <= radiusKm) return { pos: p, street: g.names[g.candName[i]] };
    }
    return null;
  },

  // A*-Suche: liefert Knotenfolge und kumulierte Fahrzeit in Sekunden
  route(a, b) {
    const g = this.g; if (!g || a == null || b == null) return null;
    if (a === b) return { nodes: [a], cum: [0], sec: 0 };
    const key = a + '>' + b;
    if (this.cache.has(key)) return this.cache.get(key);
    const N = g.lat.length;
    if (!this.gs || this.gs.length !== N) {
      this.gs = new Float64Array(N); this.prev = new Int32Array(N); this.stamp = new Int32Array(N); this.done = new Int32Array(N); this.run = 0;
    }
    const gs = this.gs, prev = this.prev, stamp = this.stamp, done = this.done;
    const run = ++this.run;
    const tl = g.lat[b], tg = g.lng[b], cos = Math.cos(tl * Math.PI / 180), vmax = 100 / 3.6;
    const h = n => Math.sqrt(((g.lat[n] - tl) * 110540) ** 2 + ((g.lng[n] - tg) * cos * 111320) ** 2) / vmax;
    const hf = [], hn = [];
    const push = (f, n) => {
      let i = hf.length; hf.push(f); hn.push(n);
      while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= f) break; hf[i] = hf[p]; hn[i] = hn[p]; i = p; }
      hf[i] = f; hn[i] = n;
    };
    const pop = () => {
      const n = hn[0], lf = hf.pop(), ln = hn.pop();
      if (hf.length) {
        let i = 0; const L = hf.length;
        for (;;) {
          let c = 2 * i + 1; if (c >= L) break;
          if (c + 1 < L && hf[c + 1] < hf[c]) c++;
          if (hf[c] >= lf) break;
          hf[i] = hf[c]; hn[i] = hn[c]; i = c;
        }
        hf[i] = lf; hn[i] = ln;
      }
      return n;
    };
    stamp[a] = run; gs[a] = 0; prev[a] = -1; push(h(a), a);
    let found = false, expanded = 0;
    while (hf.length) {
      const n = pop();
      if (done[n] === run) continue;
      done[n] = run;
      if (n === b) { found = true; break; }
      if (++expanded > 400000) break;
      for (let e = g.start[n]; e < g.start[n + 1]; e++) {
        const m = g.to[e], ng = gs[n] + g.w[e];
        if (stamp[m] !== run || ng < gs[m]) { stamp[m] = run; gs[m] = ng; prev[m] = n; push(ng + h(m), m); }
      }
    }
    let res = null;
    if (found) {
      const nodes = [];
      for (let n = b; n !== -1; n = prev[n]) nodes.push(n);
      nodes.reverse();
      res = { nodes, cum: nodes.map(n => gs[n]), sec: gs[b] };
    }
    if (this.cache.size > 1500) this.cache.clear();
    this.cache.set(key, res);
    return res;
  },
};

// =====================================================================
//  Öffentlicher Routing-Server (OSRM) – überbrückt die Zeit, bis das
//  Straßennetz geladen ist. Höchstens 1 Anfrage pro Sekunde.
// =====================================================================
const OSRM_URL = 'https://router.project-osrm.org';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const Osrm = {
  fails: 0, queue: [], busy: false, last: 0, cache: new Map(), pending: new Map(),

  enabled() { return this.fails < 4; },
  key(a, b) { return a[0].toFixed(4) + ',' + a[1].toFixed(4) + '>' + b[0].toFixed(4) + ',' + b[1].toFixed(4); },
  cached(a, b) { return this.cache.get(this.key(a, b)) || null; },

  request(url) {
    if (!this.enabled()) return Promise.resolve(null);
    return new Promise(res => { this.queue.push({ url, res }); this.pump(); });
  },
  async pump() {
    if (this.busy) return;
    this.busy = true;
    while (this.queue.length) {
      const wait = this.last + 1050 - Date.now();
      if (wait > 0) await sleep(wait);
      const { url, res } = this.queue.shift();
      this.last = Date.now();
      if (!this.enabled()) { res(null); continue; }
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 8000);
        const r = await fetch(url, { signal: ctl.signal });
        clearTimeout(timer);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        if (j.code !== 'Ok') throw new Error(j.code);
        this.fails = 0;
        res(j);
      } catch (e) { this.fails++; res(null); }
    }
    this.busy = false;
  },

  // Route holen (mit Zwischenspeicher); Ergebnis: { path, cum (Sekunden je Punkt), sec }
  route(a, b) {
    const k = this.key(a, b);
    if (this.cache.has(k)) return Promise.resolve(this.cache.get(k));
    if (this.pending.has(k)) return this.pending.get(k);
    const url = `${OSRM_URL}/route/v1/driving/${a[1].toFixed(5)},${a[0].toFixed(5)};${b[1].toFixed(5)},${b[0].toFixed(5)}?overview=full&geometries=geojson&annotations=duration`;
    const p = this.request(url).then(j => {
      this.pending.delete(k);
      const r = j && j.routes && j.routes[0];
      if (!r) return null;
      const path = r.geometry.coordinates.map(([x, y]) => [Math.round(y * 1e5) / 1e5, Math.round(x * 1e5) / 1e5]);
      const segs = (r.legs[0] && r.legs[0].annotation && r.legs[0].annotation.duration) || [];
      const cum = [0];
      for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + (segs.length === path.length - 1 ? segs[i - 1] : r.duration / (path.length - 1)));
      const val = { path, cum, sec: cum[cum.length - 1] || r.duration };
      if (this.cache.size > 500) this.cache.clear();
      this.cache.set(k, val);
      return val;
    });
    this.pending.set(k, p);
    return p;
  },

  // Nächste Straße zu einem Punkt: { pos, name, dist (m) }
  nearest(p) {
    return this.request(`${OSRM_URL}/nearest/v1/driving/${p[1].toFixed(5)},${p[0].toFixed(5)}?number=1`).then(j => {
      const w = j && j.waypoints && j.waypoints[0];
      return w ? { pos: [w.location[1], w.location[0]], name: w.name, dist: w.distance } : null;
    });
  },
};
