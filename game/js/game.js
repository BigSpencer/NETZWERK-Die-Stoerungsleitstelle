'use strict';
// =====================================================================
//  Spiellogik und Simulation (1 Schritt = 1 Spielminute)
// =====================================================================

const SAVE_KEY = 'netzwerk_save_v1';
const Game = { S: null, dirty: true, speed: 1, paused: false, autoPaused: false, frac: 0 };

function markDirty() { Game.dirty = true; }
function city() { return (Game.S && Game.S.city) || DEFAULT_CITY; }
function nowT() { return Game.S.time + (Game.paused || Game.S.gameOver ? 0 : Game.frac); }

// ---------- Hilfsfunktionen ----------
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const pad = n => String(n).padStart(2, '0');
const sum = arr => arr.reduce((s, x) => s + x, 0);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function countBy(arr) { const o = {}; for (const x of arr) o[x] = (o[x] || 0) + 1; return o; }
function weightedPick(items, wfn) {
  const tot = sum(items.map(wfn));
  let r = Math.random() * tot;
  for (const i of items) { r -= wfn(i); if (r <= 0) return i; }
  return items[items.length - 1];
}
function haversine(a, b) {
  const R = 6371, k = Math.PI / 180;
  const dLat = (b[0] - a[0]) * k, dLng = (b[1] - a[1]) * k;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * k) * Math.cos(b[0] * k) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function randomPointAround(c, rKm) {
  const r = rKm * Math.sqrt(Math.random()), a = Math.random() * 2 * Math.PI;
  return [c[0] + (r * Math.cos(a)) / 111.32, c[1] + (r * Math.sin(a)) / (111.32 * Math.cos(c[0] * Math.PI / 180))];
}
const lerpPos = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
const fmtEur = n => Math.round(n).toLocaleString('de-DE') + ' €';
const hourOf = t => Math.floor((t % 1440) / 60);
function fmtClock(t) { const m = Math.floor(t) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
function fmtDay(t) { return 'Tag ' + (Math.floor(t / 1440) + 1); }
function fmtDur(min) {
  min = Math.max(0, Math.round(min));
  if (min < 60) return min + ' min';
  const h = Math.floor(min / 60), m = min % 60;
  return h + ' h' + (m ? ' ' + pad(m) + ' min' : '');
}

const staffById = id => Game.S.staff.find(p => p.id === id);
const vehicleById = id => Game.S.vehicles.find(v => v.id === id);
const jobById = id => Game.S.jobs.find(j => j.id === id);
function uid() { return Game.S.seq++; }

function notify(text, kind = 'info') {
  const S = Game.S;
  S.log.unshift({ t: S.time, text, kind });
  if (S.log.length > 150) S.log.length = 150;
  if (typeof UI !== 'undefined' && UI.toast) UI.toast(text, kind);
  markDirty();
}
function spend(amount, what) { Game.S.cash -= amount; if (what) Game.S.stats[what] = (Game.S.stats[what] || 0) + amount; }
function earn(amount) { Game.S.cash += amount; Game.S.stats.earned += amount; }
function changeRep(d) { Game.S.rep = clamp(Game.S.rep + d, 0, 100); }

// ---------- Neues Spiel / Speichern ----------
function newGame(cityCfg) {
  Game.S = {
    version: 1, city: cityCfg || DEFAULT_CITY, time: 7 * 60, seq: 1, cash: 15000, rep: 50,
    done: { 1: 0, 2: 0, 3: 0 }, staff: [], vehicles: [], jobs: [], history: [], log: [],
    receivables: [], contracts: {}, market: { candidates: [] }, vehCount: {},
    nextOfferAt: 7 * 60 + 3,
    stats: { earned: 0, wages: 0, upkeep: 0, fuel: 0, penalties: 0, invest: 0, training: 0, interest: 0 },
    settings: { pauseOnDecision: true }, gameOver: false,
  };
  for (const id in CONTRACTS) Game.S.contracts[id] = { status: 'locked', results: [], warnings: 0, nextJobAt: 0 };
  Game.S.staff.push(makePerson(1), makePerson(1));
  addVehicle('TRANS');
  refreshCandidates();
  for (let i = 0; i < 3; i++) genOffer();
  notify(`Dein Betrieb in ${city().name} ist eröffnet: 2 Monteure, 1 Transporter. Viel Erfolg!`, 'good');
  markDirty();
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(Game.S)); } catch (e) { /* ignorieren */ } }
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const S = JSON.parse(raw);
    if (!S || S.version !== 1) return false;
    Game.S = S; markDirty();
    return true;
  } catch (e) { return false; }
}

// ---------- Personal ----------
function makePerson(level) {
  const exp = { 1: level >= 2 ? rndi(8, 20) : 0, 2: level >= 3 ? rndi(6, 15) : 0, 3: 0 };
  return {
    id: uid(), name: pick(FIRST_NAMES) + ' ' + pick(LAST_NAMES), level,
    wage: QUALS[level].wage + rndi(-2, 3), done: exp,
    state: 'depot', vehicleId: null, trainingUntil: 0, trainingTo: 0,
  };
}
function refreshCandidates() {
  const c = [];
  const n = rndi(2, 4);
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    const lvl = r < 0.08 ? 3 : r < 0.33 ? 2 : 1;
    const p = makePerson(lvl);
    p.fee = [0, 400, 1200, 3000][lvl];
    c.push(p);
  }
  Game.S.market.candidates = c;
  markDirty();
}
function hire(id) {
  const S = Game.S, i = S.market.candidates.findIndex(c => c.id === id);
  if (i < 0) return;
  const p = S.market.candidates[i];
  if (S.cash < p.fee) return notify('Nicht genug Geld für die Vermittlungsgebühr.', 'bad');
  spend(p.fee, 'invest');
  delete p.fee;
  S.staff.push(p); S.market.candidates.splice(i, 1);
  notify(`${p.name} (${QUALS[p.level].name}) eingestellt.`, 'good');
}
function severance(p) { return p.wage * 8; }
function fire(id) {
  const S = Game.S, p = staffById(id);
  if (!p || p.state !== 'depot') return;
  spend(severance(p), 'wages');
  S.staff = S.staff.filter(x => x.id !== id);
  notify(`${p.name} hat den Betrieb verlassen.`, 'info');
}
function trainingInfo(p) {
  const tr = TRAININGS[p.level + 1];
  if (!tr) return null;
  const have = p.done[tr.needStage] || 0;
  return { tr, have, expOk: have >= tr.needCount, ok: have >= tr.needCount && p.state === 'depot' && Game.S.cash >= tr.cost };
}
function startTraining(id) {
  const p = staffById(id); const info = p && trainingInfo(p);
  if (!info || !info.ok) return;
  spend(info.tr.cost, 'training');
  p.state = 'training'; p.trainingTo = p.level + 1; p.trainingUntil = Game.S.time + info.tr.hours * 60;
  notify(`${p.name} beginnt: ${info.tr.name} (${info.tr.hours} h).`, 'info');
}
function finishTraining(p) {
  const old = p.level;
  p.level = p.trainingTo; p.state = 'depot';
  p.wage += QUALS[p.level].wage - QUALS[old].wage;
  notify(`🎓 ${p.name} ist jetzt ${QUALS[p.level].name}!`, 'good');
}

// ---------- Fuhrpark ----------
function addVehicle(type) {
  const S = Game.S;
  S.vehCount[type] = (S.vehCount[type] || 0) + 1;
  const v = {
    id: uid(), type, name: VEHICLE_TYPES[type].short + ' ' + S.vehCount[type],
    state: 'depot', pos: city().depot.slice(), trip: null, jobId: null, crew: [], arrivedAt: 0, hist: [],
  };
  S.vehicles.push(v);
  return v;
}
function buyVehicle(type) {
  const T = VEHICLE_TYPES[type];
  if (Game.S.cash < T.price) return notify('Nicht genug Geld für ' + T.name + '.', 'bad');
  spend(T.price, 'invest');
  const v = addVehicle(type);
  notify(`${T.icon} ${v.name} gekauft.`, 'good');
}
function sellVehicle(id) {
  const S = Game.S, v = vehicleById(id);
  if (!v || v.state !== 'depot') return;
  const val = Math.round(VEHICLE_TYPES[v.type].price * 0.5);
  earn(val);
  S.vehicles = S.vehicles.filter(x => x.id !== id);
  notify(`${v.name} für ${fmtEur(val)} verkauft.`, 'info');
}
function vehiclePosAt(v, t) {
  if (!v.trip) return v.pos;
  const f = clamp((t - v.trip.t0) / Math.max(1, v.trip.t1 - v.trip.t0), 0, 1);
  return lerpPos(v.trip.from, v.trip.to, f);
}
function travelFactor(t) {
  const h = hourOf(t);
  if ((h >= 7 && h < 9) || (h >= 16 && h < 18)) return 1.35;   // Berufsverkehr
  if (h >= 22 || h < 5) return 0.85;
  return 1;
}
function travelMin(from, to, speed, fromDepot) {
  const km = haversine(from, to) * 1.35;
  return Math.max(1, Math.round(km / speed * 60 * travelFactor(Game.S.time) + (fromDepot ? 3 : 0)));
}
function etaFor(v, pos) { return travelMin(vehiclePosAt(v, Game.S.time), pos, VEHICLE_TYPES[v.type].speed, v.state === 'depot'); }
function pushHist(v, start, end, kind, label) {
  v.hist.push({ s: start, e: end, kind, label: label || '' });
  v.hist = v.hist.filter(h => h.e > Game.S.time - 180);
}
const availableVehicles = () => Game.S.vehicles.filter(v => v.state === 'depot' || v.state === 'returning');
const availableDepotStaff = () => Game.S.staff.filter(p => p.state === 'depot');

// ---------- Befähigungen ----------
function staffAssign(pool, req) {
  const avail = [...pool].sort((a, b) => a.level - b.level);
  const used = new Set(), missing = {}, picked = [];
  let ok = true;
  for (const lvl of Object.keys(req).map(Number).sort((a, b) => b - a)) {
    for (let k = 0; k < req[lvl]; k++) {
      const p = avail.find(x => !used.has(x.id) && x.level >= lvl);
      if (p) { used.add(p.id); picked.push(p); } else { missing[lvl] = (missing[lvl] || 0) + 1; ok = false; }
    }
  }
  return { ok, missing, picked };
}
function vehiclesMissing(have, need) {
  const h = countBy(have), n = countBy(need), miss = [];
  for (const t in n) for (let i = (h[t] || 0); i < n[t]; i++) miss.push(t);
  return miss;
}
function wayOwnedOk(way) {
  return staffAssign(Game.S.staff, way.staff).ok && vehiclesMissing(Game.S.vehicles.map(v => v.type), way.vehicles).length === 0;
}
function wayMissing(way) {
  const parts = [];
  const r = staffAssign(Game.S.staff, way.staff);
  for (const lvl in r.missing) parts.push(`${r.missing[lvl]}× ${QUALS[lvl].name}`);
  for (const t of vehiclesMissing(Game.S.vehicles.map(v => v.type), way.vehicles)) parts.push(VEHICLE_TYPES[t].name);
  return parts;
}
function acceptableWays(T) { return T.ways.map((w, i) => i).filter(i => wayOwnedOk(T.ways[i])); }
function maxCapableStage() {
  let m = 0;
  for (const id in JOB_TYPES) { const T = JOB_TYPES[id]; if (T.weight > 0 && acceptableWays(T).length) m = Math.max(m, T.stage); }
  return m;
}
function getWay(job) { return JOB_TYPES[job.typeId].ways[job.wayIdx || 0]; }
function getTwist(job) { const T = JOB_TYPES[job.typeId], w = getWay(job); return w.twist !== undefined ? w.twist : T.twist; }

// ---------- Aufträge ----------
function randomAddr() { return pick(STREETS) + ' ' + rndi(1, 120); }
function createJob(typeId, opts = {}) {
  const S = Game.S, T = JOB_TYPES[typeId];
  const base = Math.round(rnd(T.pay[0], T.pay[1]) * (0.85 + S.rep / 333) / 10) * 10;
  return {
    id: uid(), typeId, stage: T.stage, name: T.name, addr: opts.addr || randomAddr(),
    pos: opts.pos || randomPointAround(city().center, city().radiusKm), base, status: 'offer',
    createdAt: S.time, expiresAt: S.time + (opts.expires || rndi(45, 100)), acceptedAt: null,
    reactionDue: null, completionDue: null, contractId: null, units: [], staffIds: [], wayIdx: null,
    firstArrival: null, reactionMissed: false, phases: null, phaseIdx: 0, phaseEnd: 0,
    payAdd: 0, twistDone: false, reinforcement: null, workStart: null,
  };
}
function genOffer() {
  const S = Game.S;
  const cap = maxCapableStage();
  const types = Object.keys(JOB_TYPES).filter(id => JOB_TYPES[id].weight > 0 && JOB_TYPES[id].stage <= cap + 1);
  if (!types.length) return;
  const id = weightedPick(types, t => {
    const T = JOB_TYPES[t];
    if (T.stage === cap + 1) return T.weight * 0.45;   // gesperrte Vorschau
    if (T.stage < cap) return T.weight * 0.6;
    return T.weight;
  });
  const job = createJob(id);
  S.jobs.push(job);
  markDirty();
}
function acceptJob(job) {
  const T = JOB_TYPES[job.typeId], S = Game.S;
  job.status = 'accepted'; job.acceptedAt = S.time;
  job.reactionDue = S.time + T.reaction; job.completionDue = S.time + T.completion;
  markDirty();
}
function acceptOffer(id) {
  const job = jobById(id);
  if (!job || job.status !== 'offer') return false;
  if (!acceptableWays(JOB_TYPES[job.typeId]).length) return false;
  acceptJob(job);
  notify(`Auftrag angenommen: ${job.name}, ${job.addr}`, 'info');
  return true;
}
function declineOffer(id) { Game.S.jobs = Game.S.jobs.filter(j => j.id !== id); markDirty(); }

function sendHome(v) {
  const S = Game.S, from = vehiclePosAt(v, S.time);
  if (v.state === 'toJob' && v.trip) pushHist(v, v.trip.t0, S.time, 'drive');
  if (v.state === 'atJob') pushHist(v, v.arrivedAt, S.time, 'work', JOB_TYPES[jobById(v.jobId)?.typeId]?.short);
  v.state = 'returning'; v.jobId = null; v.pos = from;
  v.trip = { from, to: city().depot, t0: S.time, t1: S.time + travelMin(from, city().depot, VEHICLE_TYPES[v.type].speed, false) };
}
function removeJob(job) { Game.S.jobs = Game.S.jobs.filter(j => j.id !== job.id); markDirty(); }

function giveBack(id) {
  const job = jobById(id);
  if (!job || job.status === 'offer') return;
  for (const vid of job.units) { const v = vehicleById(vid); if (v && v.jobId === job.id) sendHome(v); }
  changeRep(-4);
  if (job.contractId) recordSla(job.contractId, false);
  removeJob(job);
  notify(`Auftrag zurückgegeben: ${job.name}. Ruf −4.`, 'bad');
}

// Prüft eine Auswahl gegen eine Anforderung { staff, vehicles }
function checkDispatch(req, vehicleIds, staffIds) {
  const vehicles = vehicleIds.map(vehicleById).filter(Boolean);
  const staff = staffIds.map(staffById).filter(Boolean);
  const items = [];
  const have = countBy(vehicles.map(v => v.type)), need = countBy(req.vehicles);
  for (const t in need) items.push({ label: `${need[t] > 1 ? need[t] + '× ' : ''}${VEHICLE_TYPES[t].name}`, ok: (have[t] || 0) >= need[t] });
  const r = staffAssign(staff, req.staff);
  for (const lvl of Object.keys(req.staff).map(Number).sort((a, b) => b - a)) {
    items.push({ label: `${req.staff[lvl]}× ${QUALS[lvl].name}${lvl < 3 ? ' (oder höher)' : ''}`, ok: !r.missing[lvl] });
  }
  const seats = sum(vehicles.map(v => VEHICLE_TYPES[v.type].seats));
  items.push({ label: `Sitzplätze: ${staff.length} / ${seats}`, ok: staff.length <= seats && staff.length > 0 });
  items.push({ label: 'Jedes Fahrzeug hat einen Fahrer', ok: vehicles.length > 0 && staff.length >= vehicles.length });
  return { ok: items.every(i => i.ok), items };
}

// Automatischer Vorschlag: nächstgelegene Fahrzeuge, niedrigste ausreichende Qualifikation
function suggest(req, pos) {
  const avail = availableVehicles();
  const chosen = [];
  for (const type of req.vehicles) {
    const c = avail.filter(v => v.type === type && !chosen.includes(v)).sort((a, b) => etaFor(a, pos) - etaFor(b, pos));
    if (!c.length) return null;
    chosen.push(c[0]);
  }
  const staff = chosen.flatMap(v => v.crew).map(staffById).filter(Boolean);
  const depot = availableDepotStaff().sort((a, b) => a.level - b.level || a.wage - b.wage);
  const used = new Set(staff.map(p => p.id));
  const r = staffAssign(staff, req.staff);
  for (const lvl of Object.keys(r.missing).map(Number).sort((a, b) => b - a)) {
    for (let k = 0; k < r.missing[lvl]; k++) {
      const p = depot.find(x => !used.has(x.id) && x.level >= lvl);
      if (p) { used.add(p.id); staff.push(p); }
    }
  }
  while (staff.length < chosen.length) {
    const p = depot.find(x => !used.has(x.id));
    if (!p) break;
    used.add(p.id); staff.push(p);
  }
  let seats = sum(chosen.map(v => VEHICLE_TYPES[v.type].seats));
  if (staff.length > seats) {
    const extra = avail.filter(v => v.type === 'TRANS' && !chosen.includes(v) && v.crew.length === 0).sort((a, b) => etaFor(a, pos) - etaFor(b, pos))[0];
    if (extra) chosen.push(extra);
  }
  return { vehicleIds: chosen.map(v => v.id), staffIds: staff.map(p => p.id) };
}

function dispatch(job, vehicleIds, staffIds, wayIdx) {
  const S = Game.S, reinf = job.status === 'reinforce';
  const vehicles = vehicleIds.map(vehicleById).filter(v => v && (v.state === 'depot' || v.state === 'returning'));
  const queue = staffIds.map(staffById).filter(p => p && p.state === 'depot');
  for (const v of vehicles) if (v.crew.length === 0 && queue.length) v.crew.push(queue.shift().id);
  for (const v of vehicles) while (queue.length && v.crew.length < VEHICLE_TYPES[v.type].seats) v.crew.push(queue.shift().id);
  for (const v of vehicles) {
    const from = vehiclePosAt(v, S.time);
    if (v.state === 'returning' && v.trip) pushHist(v, v.trip.t0, S.time, 'return');
    const dur = travelMin(from, job.pos, VEHICLE_TYPES[v.type].speed, v.state === 'depot');
    v.trip = { from, to: job.pos, t0: S.time, t1: S.time + dur };
    v.state = 'toJob'; v.jobId = job.id; v.pos = from;
    for (const sid of v.crew) {
      const p = staffById(sid); if (!p) continue;
      p.state = 'out'; p.vehicleId = v.id;
      if (!job.staffIds.includes(sid)) job.staffIds.push(sid);
    }
    job.units.push(v.id);
    spend(haversine(from, job.pos) * 2.7 * 0.35, 'fuel');   // hin + zurück, ca. 0,35 €/km
  }
  if (reinf) job.reinforcement.dispatched = true;
  else { job.wayIdx = wayIdx; job.status = 'enroute'; }
  markDirty();
}

function expectedPhaseDurs(job) {
  if (job.phases) return job.phases.map(p => p.dur);
  const T = JOB_TYPES[job.typeId], way = T.ways[job.wayIdx || 0];
  return (way.phases || T.phases).map(d => (d.min + d.max) / 2 * (d.search ? (way.searchMul || 1) : 1));
}
function estFinish(job, now) {
  const d = expectedPhaseDurs(job);
  switch (job.status) {
    case 'enroute': {
      const arr = Math.max(now, ...job.units.map(id => vehicleById(id)?.trip?.t1 || now));
      return arr + sum(d);
    }
    case 'working': return Math.max(now, job.phaseEnd) + sum(d.slice(job.phaseIdx + 1));
    case 'decision': case 'reinforce': return now + 20 + sum(d.slice(job.phaseIdx));
    default: return now + sum(d);
  }
}

function startWork(job) {
  const S = Game.S, T = JOB_TYPES[job.typeId], way = getWay(job);
  let mul = way.searchMul || 1;
  const crewMax = Math.max(0, ...job.staffIds.map(id => staffById(id)?.level || 0));
  const reqMax = Math.max(...Object.keys(way.staff).map(Number));
  const bonus = crewMax > reqMax;
  if (bonus) mul *= 0.8;
  job.phases = (way.phases || T.phases).map(d => ({ name: d.name, dur: Math.max(1, Math.round(rnd(d.min, d.max) * (d.search ? mul : 1))) }));
  job.phaseIdx = 0; job.phaseEnd = S.time + job.phases[0].dur; job.status = 'working'; job.workStart = S.time;
  job.qualBonus = bonus;
  markDirty();
}
function advancePhase(job) {
  const S = Game.S;
  job.phaseIdx++;
  if (job.phaseIdx === 1 && !job.twistDone) {
    job.twistDone = true;
    const tw = getTwist(job);
    if (tw && Math.random() < tw.p) {
      job.status = 'decision';
      notify(`⚠ ${job.name}: ${tw.title} – Entscheidung nötig!`, 'warn');
      if (S.settings.pauseOnDecision && !Game.paused) { Game.paused = true; Game.autoPaused = true; }
      if (typeof UI !== 'undefined') UI.onDecision(job.id);
      return;
    }
  }
  if (job.phaseIdx >= job.phases.length) return completeJob(job);
  job.phaseEnd = S.time + job.phases[job.phaseIdx].dur;
  markDirty();
}
function resolveTwist(jobId, optIdx) {
  const S = Game.S, job = jobById(jobId);
  if (!job || job.status !== 'decision') return;
  const o = getTwist(job).options[optIdx];
  job.payAdd += o.payAdd || 0;
  if (o.rep) changeRep(o.rep);
  if (o.needVehicle) {
    job.status = 'reinforce';
    job.reinforcement = { vehicle: o.needVehicle, staff: o.needStaff || { 1: 1 }, extraMin: o.extraMin || 0, searchMin: o.searchMin || [15, 30], dispatched: false };
  } else {
    job.phases[job.phaseIdx].dur += o.extraMin || 0;
    job.status = 'working';
    job.phaseEnd = S.time + job.phases[job.phaseIdx].dur;
  }
  markDirty();
}
function resumeAfterReinforcement(job) {
  const r = job.reinforcement;
  job.phases[job.phaseIdx].dur = rndi(r.searchMin[0], r.searchMin[1]) + r.extraMin;
  job.status = 'working';
  job.phaseEnd = Game.S.time + job.phases[job.phaseIdx].dur;
  notify(`${job.name}: Nachforderung eingetroffen, Arbeit läuft weiter.`, 'info');
}
function onArrival(v) {
  const S = Game.S, job = jobById(v.jobId);
  if (!job) return sendHome(v);
  if (job.firstArrival == null) {
    job.firstArrival = S.time;
    if (!job.reactionMissed) notify(`📍 ${v.name} ist vor Ort: ${job.addr} – Reaktionsfrist eingehalten.`, 'good');
  }
  const allThere = job.units.every(id => vehicleById(id)?.state === 'atJob');
  if (job.status === 'enroute' && allThere) startWork(job);
  else if (job.status === 'reinforce' && job.reinforcement.dispatched && allThere) resumeAfterReinforcement(job);
}

function completeJob(job) {
  const S = Game.S, T = JOB_TYPES[job.typeId], way = getWay(job);
  const pay = Math.round(job.base * (way.factor || 1) * (1 + job.payAdd));
  const lateMin = S.time - job.completionDue;
  const lateH = lateMin > 0 ? Math.ceil(lateMin / 60) : 0;
  const penalty = lateH * Math.round(job.base * 0.1) + (job.reactionMissed ? Math.round(job.base * 0.1) : 0);
  const ok = !job.reactionMissed && lateH === 0;
  const fast = ok && (S.time - job.acceptedAt) <= T.completion * 0.5;
  const bonus = fast ? Math.round(pay * 0.15) : 0;
  const net = pay + bonus - penalty;
  if (net >= 0) S.receivables.push({ amount: net, due: S.time + 240, text: job.name });
  else spend(-net);
  S.stats.penalties += penalty;
  changeRep(ok ? (fast ? 2 : 1) : -3);
  S.done[job.stage] = (S.done[job.stage] || 0) + 1;
  for (const id of job.staffIds) { const p = staffById(id); if (p) p.done[job.stage] = (p.done[job.stage] || 0) + 1; }
  if (job.contractId) recordSla(job.contractId, ok);
  for (const vid of job.units) { const v = vehicleById(vid); if (v && v.jobId === job.id) sendHome(v); }
  S.history.unshift({ name: job.name, addr: job.addr, stage: job.stage, t: S.time, pay, bonus, penalty, net, ok, contract: !!job.contractId, way: way.name });
  if (S.history.length > 40) S.history.length = 40;
  removeJob(job);
  let txt = `✔ ${job.name} erledigt: ${fmtEur(net)}`;
  if (bonus) txt += ` (inkl. Schnelligkeitsbonus ${fmtEur(bonus)})`;
  if (penalty) txt += ` (Vertragsstrafe −${fmtEur(penalty)})`;
  notify(txt + ' – Zahlung in 4 h.', ok ? 'good' : 'warn');
  if (way.followUp) {
    if (Math.random() < 0.5) {
      const f = createJob(way.followUp, { pos: job.pos, addr: job.addr, expires: 240 });
      S.jobs.push(f);
      notify(`📄 Folgeauftrag ausgeschrieben: ${f.name}.`, 'info');
    } else {
      notify(`Die endgültige Instandsetzung (${job.addr}) wurde an einen Mitbewerber vergeben.`, 'warn');
    }
  }
}

// ---------- Rahmenverträge ----------
function contractReqs(D) {
  const S = Game.S, out = [];
  for (const st in D.reqs.refs) out.push({ label: `${D.reqs.refs[st]} erledigte Aufträge der Stufe ${st}`, have: S.done[st] || 0, need: D.reqs.refs[st] });
  out.push({ label: `Ruf mindestens ${D.reqs.rep}`, have: Math.round(S.rep), need: D.reqs.rep });
  for (const lvl in D.reqs.staff) out.push({ label: `${D.reqs.staff[lvl]}× ${QUALS[lvl].name} im Betrieb`, have: S.staff.filter(p => p.level >= lvl).length, need: D.reqs.staff[lvl] });
  for (const t of D.reqs.vehicles) out.push({ label: VEHICLE_TYPES[t].name, have: S.vehicles.filter(v => v.type === t).length, need: 1 });
  for (const r of out) r.ok = r.have >= r.need;
  return out;
}
function acceptContract(id) {
  const c = Game.S.contracts[id], D = CONTRACTS[id];
  if (c.status !== 'offered' || !contractReqs(D).every(r => r.ok)) return;
  c.status = 'active'; c.results = []; c.warnings = 0;
  c.nextJobAt = Game.S.time + rndi(20, 50);
  notify(`🤝 ${D.name} mit ${D.client} abgeschlossen!`, 'good');
}
function cancelContract(id) {
  const c = Game.S.contracts[id];
  if (c.status !== 'active') return;
  c.status = 'offered';
  changeRep(-5);
  notify(`${CONTRACTS[id].name} gekündigt. Ruf −5.`, 'bad');
}
function recordSla(id, ok) {
  const c = Game.S.contracts[id], D = CONTRACTS[id];
  if (!c || c.status !== 'active') return;
  c.results.push(ok);
  if (c.results.length > 10) c.results.shift();
  if (c.results.length >= 8) {
    const rate = c.results.filter(Boolean).length / c.results.length;
    if (rate < D.sla) {
      c.warnings++; c.results = [];
      if (c.warnings >= 2) {
        c.status = 'terminated'; changeRep(-10);
        notify(`❌ ${D.client} hat den ${D.name} fristlos gekündigt (SLA verfehlt). Ruf −10.`, 'bad');
      } else {
        notify(`⚠ Abmahnung von ${D.client}: Fristtreue unter ${Math.round(D.sla * 100)} %!`, 'bad');
      }
    }
  }
  markDirty();
}
function contractsTick() {
  const S = Game.S;
  for (const id in CONTRACTS) {
    const c = S.contracts[id], D = CONTRACTS[id];
    if (c.status === 'locked' && contractReqs(D).every(r => r.ok)) {
      c.status = 'offered';
      notify(`📄 ${D.client} bietet dir einen ${D.name} an! (Reiter „Verträge“)`, 'good');
    }
    if (c.status === 'active' && S.time >= c.nextJobAt) {
      c.nextJobAt = S.time + rndi(D.interval[0], D.interval[1]);
      const types = D.jobTypes.filter(t => acceptableWays(JOB_TYPES[t]).length);
      if (!types.length) continue;
      const job = createJob(weightedPick(types, t => JOB_TYPES[t].weight));
      job.contractId = id;
      job.base = Math.round(job.base * D.payFactor / 10) * 10;
      acceptJob(job);
      S.jobs.push(job);
      notify(`📥 Vertragsauftrag (${D.client}): ${job.name}, ${job.addr}`, 'warn');
    }
  }
}

// ---------- Zeittakt ----------
function vehicleTick(v) {
  const S = Game.S;
  if (!v.trip || S.time < v.trip.t1) return;
  const trip = v.trip;
  v.pos = trip.to; v.trip = null;
  if (v.state === 'toJob') {
    v.state = 'atJob'; v.arrivedAt = S.time;
    pushHist(v, trip.t0, trip.t1, 'drive');
    onArrival(v);
  } else if (v.state === 'returning') {
    v.state = 'depot';
    pushHist(v, trip.t0, trip.t1, 'return');
    for (const sid of v.crew) { const p = staffById(sid); if (p) { p.state = 'depot'; p.vehicleId = null; } }
    v.crew = []; v.jobId = null;
  }
  markDirty();
}
function jobTick(job) {
  const S = Game.S;
  if (job.status === 'offer') { if (S.time >= job.expiresAt) removeJob(job); return; }
  if (job.firstArrival == null && !job.reactionMissed && S.time > job.reactionDue) {
    job.reactionMissed = true;
    notify(`⏰ Reaktionsfrist verpasst: ${job.name}, ${job.addr}`, 'bad');
  }
  if (job.status === 'working' && S.time >= job.phaseEnd) advancePhase(job);
}
function hourly() {
  const S = Game.S;
  spend(sum(S.staff.map(p => p.wage)), 'wages');
  if (S.cash < 0) spend(Math.round(-S.cash * 0.002), 'interest');
}
function daily() {
  const S = Game.S;
  spend(sum(S.vehicles.map(v => VEHICLE_TYPES[v.type].upkeep)), 'upkeep');
  for (const id in CONTRACTS) if (S.contracts[id].status === 'active') earn(CONTRACTS[id].daily);
  notify(`🗓 ${fmtDay(S.time)} beginnt. Kontostand: ${fmtEur(S.cash)}.`, 'info');
}
function offerFactor(t) { const h = hourOf(t); return (h < 6 || h >= 22) ? 2.2 : 1; }

function step() {
  const S = Game.S;
  if (S.gameOver) return;
  S.time++;
  for (const v of S.vehicles) vehicleTick(v);
  for (const j of [...S.jobs]) jobTick(j);
  for (const p of S.staff) if (p.state === 'training' && S.time >= p.trainingUntil) finishTraining(p);
  if (S.receivables.some(r => r.due <= S.time)) {
    for (const r of S.receivables.filter(r => r.due <= S.time)) earn(r.amount);
    S.receivables = S.receivables.filter(r => r.due > S.time);
  }
  if (S.time % 60 === 0) hourly();
  if (S.time % 1440 === 0) daily();
  if (S.time % 1440 === 6 * 60) refreshCandidates();
  if (S.time % 60 === 30) save();
  if (S.time >= S.nextOfferAt) {
    if (S.jobs.filter(j => j.status === 'offer').length < 9) genOffer();
    S.nextOfferAt = S.time + Math.round(rnd(12, 28) * offerFactor(S.time));
  }
  contractsTick();
  if (S.cash < -25000) {
    S.gameOver = true; save();
    if (typeof UI !== 'undefined') UI.gameOver();
  }
}
