'use strict';
// =====================================================================
//  Kartenansicht (Leaflet + OpenStreetMap)
// =====================================================================

const STAGE_COLORS = { 1: '#2f9e5b', 2: '#2f7fd8', 3: '#8a4fd1' };

const MapView = {
  map: null, ok: false, jobM: new Map(), vehM: new Map(), lines: new Map(),
  depotM: null, areaC: null, setupLayer: null, tilesLoaded: 0, noteShown: false,

  init() {
    if (!window.L) {
      document.getElementById('map').innerHTML =
        '<div class="map-fallback">Die Karte konnte nicht geladen werden.<br>Das Spiel funktioniert trotzdem – nutze die Listen links.</div>';
      return;
    }
    this.map = L.map('map', { zoomControl: true }).setView([51.2, 10.4], 6);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende',
    }).addTo(this.map);
    tiles.on('tileload', () => { this.tilesLoaded++; });
    tiles.on('tileerror', () => { if (!this.tilesLoaded) this.showTileNote(); });
    this.map.on('click', e => { if (this.onSetupClick) this.onSetupClick([e.latlng.lat, e.latlng.lng]); });
    this.ok = true;
  },

  showTileNote() {
    if (this.noteShown) return;
    this.noteShown = true;
    const el = document.createElement('div');
    el.className = 'map-note';
    el.innerHTML = 'Die Kartenbilder können hier nicht geladen werden (z. B. in der Vorschau auf claude.ai oder ohne Internet). '
      + 'Das Spiel funktioniert trotzdem. Mit Straßenkarte: über GitHub Pages oder einen lokalen Webserver spielen (siehe README).';
    document.getElementById('map').appendChild(el);
  },

  // Betriebshof und Einsatzgebiet der laufenden Partie anzeigen
  showCompany() {
    if (!this.ok) return;
    const c = city();
    if (this.depotM) this.depotM.remove();
    if (this.areaC) this.areaC.remove();
    this.areaC = L.circle(c.center, { radius: c.radiusKm * 1000, color: '#f0a500', weight: 1, opacity: 0.35, fill: false, dashArray: '6 6', interactive: false }).addTo(this.map);
    this.depotM = L.marker(c.depot, { icon: L.divIcon({ className: 'depot-icon', html: '🏭', iconSize: [30, 30] }), zIndexOffset: 1000 })
      .addTo(this.map).bindTooltip(c.depotName);
    this.map.setView(c.center, c.radiusKm > 5 ? 12 : 13);
  },

  // ---------- Standortwahl ----------
  startSetup(onPickCity, onClick) {
    if (!this.ok) return;
    this.reset();
    if (this.depotM) { this.depotM.remove(); this.depotM = null; }
    if (this.areaC) { this.areaC.remove(); this.areaC = null; }
    this.map.setView([51.2, 10.4], 6);
    this.setupLayer = L.layerGroup().addTo(this.map);
    for (const c of CITIES) {
      L.circleMarker(c.center, { radius: c.size === 'L' ? 7 : c.size === 'M' ? 5 : 4, color: '#f0a500', weight: 1.5, fillColor: '#f0a500', fillOpacity: 0.6 })
        .bindTooltip(c.name, { direction: 'top' })
        .on('click', ev => { L.DomEvent.stopPropagation(ev); onPickCity(c); })
        .addTo(this.setupLayer);
    }
    this.onSetupClick = onClick;
  },
  previewSetup(sel, depot) {
    if (!this.ok) return;
    if (this.areaC) this.areaC.remove();
    if (this.depotM) this.depotM.remove();
    this.areaC = L.circle(sel.center, { radius: sel.radiusKm * 1000, color: '#f0a500', weight: 2, fillColor: '#f0a500', fillOpacity: 0.08, interactive: false }).addTo(this.map);
    this.depotM = L.marker(depot, { draggable: true, icon: L.divIcon({ className: 'depot-icon', html: '🏭', iconSize: [30, 30] }), zIndexOffset: 1000 })
      .addTo(this.map).bindTooltip('Dein Betriebshof – verschieben per Klick in die Karte oder Ziehen');
    this.depotM.on('dragend', () => { const ll = this.depotM.getLatLng(); if (this.onSetupClick) this.onSetupClick([ll.lat, ll.lng], true); });
  },
  flyToArea(sel) { if (this.ok) this.map.flyTo(sel.center, sel.radiusKm > 5 ? 12 : 13, { duration: 0.8 }); },
  zoom() { return this.ok ? this.map.getZoom() : 13; },
  endSetup() {
    this.onSetupClick = null;
    if (this.setupLayer) { this.setupLayer.remove(); this.setupLayer = null; }
  },

  jobStyle(j) {
    const c = STAGE_COLORS[j.stage];
    if (j.status === 'offer') {
      const locked = !acceptableWays(JOB_TYPES[j.typeId]).length;
      return locked
        ? { key: 'locked', radius: 6, color: '#8a8f98', fillColor: '#8a8f98', fillOpacity: 0.25, weight: 1.5, dashArray: '3 3' }
        : { key: 'offer', radius: 8, color: c, fillColor: c, fillOpacity: 0.25, weight: 2, dashArray: '4 3' };
    }
    if (j.status === 'accepted') return { key: 'acc', radius: 9, color: '#fff', fillColor: '#f08c00', fillOpacity: 0.95, weight: 2 };
    if (j.status === 'decision' || (j.status === 'reinforce' && !j.reinforcement.dispatched))
      return { key: 'dec', radius: 10, color: '#fff', fillColor: '#e03131', fillOpacity: 0.95, weight: 3 };
    return { key: 'run', radius: 9, color: '#fff', fillColor: c, fillOpacity: 0.95, weight: 2 };
  },

  sync(t) {
    if (!this.ok) return;
    const S = Game.S;
    const seen = new Set();
    for (const j of S.jobs) {
      seen.add(j.id);
      const st = this.jobStyle(j);
      let m = this.jobM.get(j.id);
      if (!m) {
        m = L.circleMarker(j.pos, st).addTo(this.map);
        m.on('click', () => UI.focusJob(j.id));
        m.bindTooltip('');
        this.jobM.set(j.id, m);
      }
      if (m._key !== st.key) { m.setStyle(st); m.setRadius(st.radius); m._key = st.key; }
      const tip = `<b>S${j.stage} · ${j.name}</b><br>${j.addr}`;
      if (m._tip !== tip) { m.setTooltipContent(tip); m._tip = tip; }
    }
    for (const [id, m] of this.jobM) if (!seen.has(id)) { m.remove(); this.jobM.delete(id); }

    const vseen = new Set();
    for (const v of S.vehicles) {
      vseen.add(v.id);
      const pos = vehiclePosAt(v, t);
      let m = this.vehM.get(v.id);
      const key = v.state;
      if (!m) {
        m = L.marker(pos, { zIndexOffset: 500 }).addTo(this.map);
        m.on('click', () => { const j = v.jobId && jobById(v.jobId); if (j) UI.focusJob(j.id); });
        this.vehM.set(v.id, m);
      }
      if (m._key !== key) {
        m.setIcon(L.divIcon({ className: 'veh-wrap', iconSize: null,
          html: `<div class="veh st-${v.state}">${VEHICLE_TYPES[v.type].icon}<span>${v.name}</span></div>` }));
        m._key = key;
      }
      m.setLatLng(pos);
      // Parkende Fahrzeuge am Hof ausblenden (nur Hof-Symbol zeigen)
      const el = m.getElement(); if (el) el.style.display = v.state === 'depot' ? 'none' : '';
      let line = this.lines.get(v.id);
      if (v.state === 'toJob' && v.trip) {
        if (!line) { line = L.polyline([pos, v.trip.to], { color: '#f08c00', weight: 2, dashArray: '5 5', opacity: 0.8 }).addTo(this.map); this.lines.set(v.id, line); }
        line.setLatLngs([pos, v.trip.to]);
      } else if (line) { line.remove(); this.lines.delete(v.id); }
    }
    for (const [id, m] of this.vehM) if (!vseen.has(id)) { m.remove(); this.vehM.delete(id); }
    for (const [id, l] of this.lines) if (!vseen.has(id)) { l.remove(); this.lines.delete(id); }
  },

  flyTo(pos) { if (this.ok) this.map.flyTo(pos, Math.max(this.map.getZoom(), 14), { duration: 0.6 }); },
  reset() {
    if (!this.ok) return;
    for (const m of this.jobM.values()) m.remove();
    for (const m of this.vehM.values()) m.remove();
    for (const l of this.lines.values()) l.remove();
    this.jobM.clear(); this.vehM.clear(); this.lines.clear();
  },
};
