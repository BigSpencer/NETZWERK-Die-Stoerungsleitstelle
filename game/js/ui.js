'use strict';
// =====================================================================
//  Benutzeroberfläche
// =====================================================================

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const stageBadge = s => `<span class="stage s${s}">S${s}</span>`;
const until = (t, cls = '') => `<span class="cd ${cls}" data-until="${t}"></span>`;

function wayLabel(w) {
  const parts = [];
  for (const lvl of Object.keys(w.staff).map(Number).sort((a, b) => b - a)) parts.push(`${w.staff[lvl]}× ${QUALS[lvl].short}`);
  const vc = countBy(w.vehicles);
  for (const t in vc) parts.push(`${vc[t] > 1 ? vc[t] + '× ' : ''}${VEHICLE_TYPES[t].short}`);
  let s = parts.join(' + ');
  if (w.factor && w.factor < 1) s += ` <em>(${Math.round(w.factor * 100)} % Vergütung)</em>`;
  return s;
}
function stateLabelStaff(p) {
  if (p.state === 'depot') return '<span class="ok">am Hof</span>';
  if (p.state === 'training') return `🎓 Schulung bis ${fmtClock(p.trainingUntil)}`;
  const v = vehicleById(p.vehicleId);
  return v ? `${v.state === 'returning' ? 'Rückfahrt' : 'im Einsatz'} (${esc(v.name)})` : 'unterwegs';
}
function stateLabelVehicle(v) {
  return { depot: '<span class="ok">am Hof</span>', toJob: 'Anfahrt', atJob: 'vor Ort', returning: 'Rückfahrt' }[v.state];
}

const UI = {
  tab: 'jobs', lastPanel: 0, lastGantt: 0, pointerDown: false, modal: null, highlight: null,

  init() {
    document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => {
      this.tab = b.dataset.tab; this.syncTabs(); markDirty();
    }));
    const body = $('#panel-body');
    body.addEventListener('pointerdown', () => { this.pointerDown = true; });
    window.addEventListener('pointerup', () => { setTimeout(() => { this.pointerDown = false; }, 0); });
    body.addEventListener('click', e => {
      const el = e.target.closest('[data-act]');
      if (el && !el.disabled) this.act(el.dataset.act, el.dataset);
    });
    const modal = $('#modal');
    modal.addEventListener('click', e => { if (this.modal?.onClick) this.modal.onClick(e); });
    modal.addEventListener('change', e => { if (this.modal?.onChange) this.modal.onChange(e); });
    $('#modal-backdrop').addEventListener('click', e => { if (e.target.id === 'modal-backdrop' && this.modal?.dismissable) this.closeModal(); });
    document.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => setSpeed(Number(b.dataset.speed))));
    $('#btn-pause').addEventListener('click', togglePause);
    $('#btn-new').addEventListener('click', () => this.confirmNewGame());
    $('#btn-help').addEventListener('click', () => this.showIntro());
    document.addEventListener('keydown', e => {
      if (e.code === 'Space' && !this.modal && !['INPUT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName)) { e.preventDefault(); togglePause(); }
      if (e.key === 'Escape' && this.modal?.dismissable) this.closeModal();
    });
    this.syncTabs();
  },

  syncTabs() { document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === this.tab)); },

  // ---------- Frame-Update ----------
  frame(realNow) {
    const t = nowT();
    if (Game.dirty && !this.pointerDown && realNow - this.lastPanel > 200) {
      Game.dirty = false; this.lastPanel = realNow; this.renderPanel();
    }
    this.updateTop(t);
    this.updateCountdowns(t);
    MapView.sync(t);
    if (realNow - this.lastGantt > 400) { this.lastGantt = realNow; this.renderGantt(t); }
    if (this.modal?.live && realNow - (this.modal.lastLive || 0) > 500) { this.modal.lastLive = realNow; this.modal.live(); }
  },

  updateTop(t) {
    const S = Game.S;
    $('#clock').textContent = `${fmtDay(t)} · ${fmtClock(t)}`;
    const cash = $('#cash'); cash.textContent = fmtEur(S.cash); cash.classList.toggle('neg', S.cash < 0);
    $('#recv').textContent = fmtEur(sum(S.receivables.map(r => r.amount)));
    $('#rep').textContent = Math.round(S.rep);
    $('#refs').textContent = `${S.done[1] || 0} / ${S.done[2] || 0} / ${S.done[3] || 0}`;
    $('#btn-pause').textContent = Game.paused ? '▶' : '❚❚';
    $('#btn-pause').classList.toggle('active', Game.paused);
    document.querySelectorAll('[data-speed]').forEach(b => b.classList.toggle('active', !Game.paused && Number(b.dataset.speed) === Game.speed));
  },

  updateCountdowns(t) {
    document.querySelectorAll('[data-until]').forEach(el => {
      const left = Number(el.dataset.until) - t;
      const txt = left >= 0 ? fmtDur(Math.ceil(left)) : 'überfällig ' + fmtDur(-left);
      if (el.textContent !== txt) el.textContent = txt;
      el.classList.toggle('late', left < 0);
      el.classList.toggle('warn', left >= 0 && left < 20);
    });
    document.querySelectorAll('[data-prog]').forEach(el => {
      const job = jobById(Number(el.dataset.prog));
      if (!job || !job.phases) return;
      const tot = sum(job.phases.map(p => p.dur));
      const doneD = sum(job.phases.slice(0, job.phaseIdx).map(p => p.dur));
      const cur = job.status === 'working' ? clamp(job.phases[job.phaseIdx].dur - (job.phaseEnd - t), 0, job.phases[job.phaseIdx].dur) : 0;
      el.style.width = clamp((doneD + cur) / tot * 100, 0, 100) + '%';
    });
  },

  // ---------- Aktionen ----------
  act(a, d) {
    const id = Number(d.id);
    switch (a) {
      case 'accept': if (acceptOffer(id)) this.openDispatch(id); break;
      case 'decline': declineOffer(id); break;
      case 'dispatch': this.openDispatch(id); break;
      case 'giveback': this.confirm('Auftrag zurückgeben?', 'Der Auftrag wird zurückgegeben. Keine Vertragsstrafe, aber Ruf −4 (bei Rahmenverträgen zählt er als verfehlt).', () => giveBack(id)); break;
      case 'decide': this.openDecision(id); break;
      case 'focus': { const j = jobById(id); if (j) MapView.flyTo(j.pos); break; }
      case 'train': startTraining(id); break;
      case 'hire': hire(id); break;
      case 'fire': { const p = staffById(id); if (p) this.confirm(`${p.name} entlassen?`, `Abfindung: ${fmtEur(severance(p))}.`, () => fire(id)); break; }
      case 'buy': buyVehicle(d.type); break;
      case 'sell': { const v = vehicleById(id); if (v) this.confirm(`${v.name} verkaufen?`, `Erlös: ${fmtEur(VEHICLE_TYPES[v.type].price * 0.5)}.`, () => sellVehicle(id)); break; }
      case 'c-accept': acceptContract(d.cid); break;
      case 'c-cancel': this.confirm('Vertrag kündigen?', 'Laufende Vertragsaufträge bleiben bestehen. Ruf −5.', () => cancelContract(d.cid)); break;
      case 'set-pause': Game.S.settings.pauseOnDecision = !Game.S.settings.pauseOnDecision; break;
      case 'tab': this.tab = d.tab; this.syncTabs(); break;
    }
    markDirty();
  },

  focusJob(id) {
    this.tab = 'jobs'; this.syncTabs(); this.highlight = id; this.renderPanel();
    const el = document.querySelector(`[data-card="${id}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const j = jobById(id);
    if (j && (j.status === 'decision')) this.openDecision(id);
  },

  // ---------- Panel ----------
  renderPanel() {
    const html = {
      jobs: () => this.renderJobs(), staff: () => this.renderStaff(), fleet: () => this.renderFleet(),
      caps: () => this.renderCaps(), contracts: () => this.renderContracts(), log: () => this.renderLog(),
    }[this.tab]();
    $('#panel-body').innerHTML = html;
    const S = Game.S;
    const needs = S.jobs.filter(j => j.status === 'decision' || (j.status === 'reinforce' && !j.reinforcement.dispatched) || j.status === 'accepted').length;
    $('#badge-jobs').textContent = needs || '';
    $('#badge-contracts').textContent = Object.values(S.contracts).filter(c => c.status === 'offered').length ? '!' : '';
    $('#badge-staff').textContent = S.staff.some(p => p.state === 'depot' && trainingInfo(p)?.ok) ? '🎓' : '';
  },

  jobCard(j) {
    const T = JOB_TYPES[j.typeId];
    const hl = this.highlight === j.id ? ' highlight' : '';
    const contract = j.contractId ? `<span class="tag">Vertrag · ${esc(CONTRACTS[j.contractId].client)}</span>` : '';
    let meta = '', status = '', actions = '', extra = '';
    if (j.status === 'offer') {
      const ways = acceptableWays(T);
      const locked = ways.length === 0;
      meta = `Reaktion ${fmtDur(T.reaction)} · Erledigung ${fmtDur(T.completion)} · läuft ab in ${until(j.expiresAt)}`;
      extra = `<div class="req">Benötigt: ${T.ways.map(w => (T.ways.length > 1 ? `<b>${esc(w.name)}:</b> ` : '') + wayLabel(w)).join('<br><span class="or">oder</span> ')}</div>`;
      if (locked) {
        extra += `<div class="lock">🔒 Dir fehlt: ${T.ways.map(w => esc(wayMissing(w).join(' + '))).join(' <b>oder</b> ')}</div>`;
        actions = `<button class="ghost" data-act="tab" data-tab="caps">Befähigungen ansehen</button>`;
      } else {
        actions = `<button data-act="accept" data-id="${j.id}">Annehmen</button><button class="ghost" data-act="decline" data-id="${j.id}">Ablehnen</button>`;
      }
      return `<div class="card job ${locked ? 'locked' : ''}${hl}" data-card="${j.id}">
        <div class="card-h">${stageBadge(j.stage)}<b data-act="focus" data-id="${j.id}" class="link">${esc(j.name)}</b><span class="pay">${fmtEur(j.base)}</span></div>
        <div class="sub">${esc(j.addr)}</div><div class="meta">${meta}</div>${extra}<div class="actions">${actions}</div></div>`;
    }
    const due = `Reaktion: ${j.firstArrival != null ? '<span class="ok">✓ vor Ort</span>' : until(j.reactionDue)} · Erledigung: ${until(j.completionDue)}`;
    switch (j.status) {
      case 'accepted':
        status = '<span class="st st-acc">Nicht disponiert</span>';
        actions = `<button data-act="dispatch" data-id="${j.id}">Disponieren</button><button class="ghost" data-act="giveback" data-id="${j.id}">Zurückgeben</button>`;
        break;
      case 'enroute': {
        const arr = Math.max(...j.units.map(id => vehicleById(id)?.trip?.t1 || 0));
        status = `<span class="st st-run">Anfahrt</span> Ankunft in ${until(arr)}`;
        actions = `<button class="ghost" data-act="giveback" data-id="${j.id}">Zurückgeben</button>`;
        break;
      }
      case 'working': {
        const ph = j.phases[j.phaseIdx];
        status = `<span class="st st-run">Phase ${j.phaseIdx + 1}/${j.phases.length}</span> ${esc(ph.name)} – noch ${until(j.phaseEnd)}`;
        extra = `<div class="bar"><div data-prog="${j.id}"></div></div>`;
        actions = `<button class="ghost" data-act="giveback" data-id="${j.id}">Zurückgeben</button>`;
        break;
      }
      case 'decision':
        status = `<span class="st st-dec">Entscheidung nötig</span> ${esc(getTwist(j).title)}`;
        actions = `<button class="warn" data-act="decide" data-id="${j.id}">Entscheiden</button>`;
        break;
      case 'reinforce':
        if (!j.reinforcement.dispatched) {
          status = `<span class="st st-dec">Nachforderung</span> ${esc(VEHICLE_TYPES[j.reinforcement.vehicle].name)} benötigt`;
          actions = `<button class="warn" data-act="dispatch" data-id="${j.id}">Nachforderung disponieren</button><button class="ghost" data-act="giveback" data-id="${j.id}">Zurückgeben</button>`;
        } else status = '<span class="st st-run">Nachforderung unterwegs</span>';
        break;
    }
    const units = j.units.map(id => vehicleById(id)).filter(v => v && v.jobId === j.id).map(v => esc(v.name)).join(', ');
    const way = j.wayIdx != null && T.ways.length > 1 ? ` · Weg: ${esc(getWay(j).name)}` : '';
    return `<div class="card job active${hl}" data-card="${j.id}">
      <div class="card-h">${stageBadge(j.stage)}<b data-act="focus" data-id="${j.id}" class="link">${esc(j.name)}</b><span class="pay">${fmtEur(j.base)}</span></div>
      <div class="sub">${esc(j.addr)} ${contract}</div>
      <div class="meta">${status}</div><div class="meta">${due}</div>${extra}
      ${units ? `<div class="meta">Einheiten: ${units}${way}</div>` : ''}
      ${j.reactionMissed ? '<div class="lock">⏰ Reaktionsfrist verpasst</div>' : ''}
      <div class="actions">${actions}</div></div>`;
  },

  renderJobs() {
    const S = Game.S;
    const by = f => S.jobs.filter(f);
    const needs = by(j => j.status === 'decision' || (j.status === 'reinforce' && !j.reinforcement.dispatched));
    const pending = by(j => j.status === 'accepted').sort((a, b) => a.reactionDue - b.reactionDue);
    const running = by(j => ['enroute', 'working'].includes(j.status) || (j.status === 'reinforce' && j.reinforcement.dispatched));
    const offers = by(j => j.status === 'offer');
    const open = offers.filter(j => acceptableWays(JOB_TYPES[j.typeId]).length).sort((a, b) => b.stage - a.stage || a.expiresAt - b.expiresAt);
    const locked = offers.filter(j => !acceptableWays(JOB_TYPES[j.typeId]).length);
    const sec = (title, list, empty) => `<h3>${title} <small>${list.length}</small></h3>` + (list.length ? list.map(j => this.jobCard(j)).join('') : `<p class="empty">${empty}</p>`);
    return (needs.length ? sec('⚠ Entscheidung nötig', needs, '') : '')
      + sec('Angenommen – warten auf Disposition', pending, 'Keine.')
      + sec('Laufende Aufträge', running, 'Keine Einheiten im Einsatz.')
      + sec('Auftragsbörse', open, 'Gerade keine passenden Angebote – neue kommen laufend.')
      + (locked.length ? sec('🔒 Noch nicht befähigt', locked, '') : '')
      + `<label class="setting"><input type="checkbox" data-act="set-pause" ${S.settings.pauseOnDecision ? 'checked' : ''}> Bei Entscheidungen automatisch pausieren</label>`;
  },

  renderStaff() {
    const S = Game.S;
    const wages = sum(S.staff.map(p => p.wage));
    let h = `<h3>Mitarbeiter <small>${S.staff.length} · ${fmtEur(wages)}/h</small></h3>`;
    for (const p of [...S.staff].sort((a, b) => b.level - a.level)) {
      const info = trainingInfo(p);
      let tr = '';
      if (p.state === 'training') tr = `<div class="meta">🎓 ${esc(TRAININGS[p.trainingTo].name)} – fertig in ${until(p.trainingUntil)}</div>`;
      else if (info) {
        const pct = clamp(info.have / info.tr.needCount * 100, 0, 100);
        tr = `<div class="train"><div class="meta">Nächste Stufe: <b>${esc(info.tr.name)}</b> · ${info.tr.hours} h · ${fmtEur(info.tr.cost)}</div>
          <div class="meta">Praxis: ${info.have}/${info.tr.needCount} Aufträge Stufe ${info.tr.needStage}</div>
          <div class="bar small"><div style="width:${pct}%"></div></div>
          <button data-act="train" data-id="${p.id}" ${info.ok ? '' : 'disabled'}>Weiterbilden</button></div>`;
      } else tr = '<div class="meta">Höchste Qualifikation erreicht.</div>';
      h += `<div class="card"><div class="card-h"><span class="q q${p.level}">${QUALS[p.level].short}</span><b>${esc(p.name)}</b><span class="pay">${fmtEur(p.wage)}/h</span></div>
        <div class="meta">${stateLabelStaff(p)} · Erfahrung S1: ${p.done[1] || 0} · S2: ${p.done[2] || 0} · S3: ${p.done[3] || 0}</div>${tr}
        ${p.state === 'depot' ? `<div class="actions"><button class="ghost small" data-act="fire" data-id="${p.id}">Entlassen</button></div>` : ''}</div>`;
    }
    h += `<h3>Bewerber <small>neue täglich um 06:00</small></h3>`;
    if (!S.market.candidates.length) h += '<p class="empty">Aktuell keine Bewerbungen.</p>';
    for (const c of S.market.candidates) {
      h += `<div class="card"><div class="card-h"><span class="q q${c.level}">${QUALS[c.level].short}</span><b>${esc(c.name)}</b><span class="pay">${fmtEur(c.wage)}/h</span></div>
        <div class="meta">${QUALS[c.level].name} · Erfahrung S1: ${c.done[1]} · S2: ${c.done[2]}${c.fee ? ` · Vermittlung ${fmtEur(c.fee)}` : ''}</div>
        <div class="actions"><button data-act="hire" data-id="${c.id}" ${S.cash >= c.fee ? '' : 'disabled'}>Einstellen</button></div></div>`;
    }
    return h;
  },

  renderFleet() {
    const S = Game.S;
    let h = `<h3>Eigener Fuhrpark <small>${S.vehicles.length}</small></h3>`;
    for (const v of S.vehicles) {
      const T = VEHICLE_TYPES[v.type];
      const crew = v.crew.map(id => staffById(id)?.name).filter(Boolean).join(', ');
      h += `<div class="card"><div class="card-h"><span class="vicon">${T.icon}</span><b>${esc(v.name)}</b><span class="sub">${esc(T.name)}</span></div>
        <div class="meta">${stateLabelVehicle(v)}${crew ? ' · ' + esc(crew) : ''} · ${T.seats} Sitze · Unterhalt ${fmtEur(T.upkeep)}/Tag</div>
        ${v.state === 'depot' ? `<div class="actions"><button class="ghost small" data-act="sell" data-id="${v.id}">Verkaufen (${fmtEur(T.price * 0.5)})</button></div>` : ''}</div>`;
    }
    h += '<h3>Fahrzeuge kaufen</h3>';
    for (const type in VEHICLE_TYPES) {
      const T = VEHICLE_TYPES[type];
      const uses = Object.values(JOB_TYPES).filter(J => J.ways.some(w => w.vehicles.includes(type)) || (J.twist?.options || []).some(o => o.needVehicle === type));
      h += `<div class="card"><div class="card-h"><span class="vicon">${T.icon}</span><b>${esc(T.name)}</b><span class="pay">${fmtEur(T.price)}</span></div>
        <div class="meta">${T.seats} Sitze · ${T.speed} km/h · Unterhalt ${fmtEur(T.upkeep)}/Tag</div>
        <div class="req">Nötig für: ${uses.map(J => `${stageBadge(J.stage)} ${esc(J.short)}`).join(' ')}</div>
        <div class="actions"><button data-act="buy" data-type="${type}" ${S.cash >= T.price ? '' : 'disabled'}>Kaufen</button></div></div>`;
    }
    return h;
  },

  renderCaps() {
    const S = Game.S;
    let h = `<h3>Befähigungen deines Betriebs</h3>
      <p class="hint">Welche Aufträge du annehmen kannst, hängt von den <b>Qualifikationen</b> deiner Leute und deinem <b>Fuhrpark</b> ab. Manche Aufträge haben zwei Wege – Ausbildung <i>oder</i> Spezialfahrzeug.</p>
      <div class="refs">Erledigte Aufträge (Referenzen): ${[1, 2, 3].map(s => `${stageBadge(s)} ${S.done[s] || 0}`).join(' ')}</div>`;
    for (const st of [1, 2, 3]) {
      h += `<h3>Stufe ${st}</h3>`;
      for (const id in JOB_TYPES) {
        const T = JOB_TYPES[id];
        if (T.stage !== st) continue;
        const ways = T.ways.map(w => {
          const ok = wayOwnedOk(w);
          return `<div class="way-line ${ok ? 'ok' : 'no'}">${ok ? '✓' : '🔒'} ${T.ways.length > 1 ? `<b>${esc(w.name)}:</b> ` : ''}${wayLabel(w)}${ok ? '' : `<br><small>fehlt: ${esc(wayMissing(w).join(' + '))}</small>`}</div>`;
        }).join('<span class="or">oder</span>');
        h += `<div class="card ${acceptableWays(T).length ? '' : 'locked'}"><div class="card-h">${stageBadge(T.stage)}<b>${esc(T.name)}</b><span class="pay">${fmtEur(T.pay[0])}–${fmtEur(T.pay[1])}</span></div>${ways}
          ${T.weight === 0 ? '<div class="meta">Nur als Folgeauftrag nach einer Notstrom-Überbrückung.</div>' : ''}</div>`;
      }
    }
    return h;
  },

  renderContracts() {
    const S = Game.S;
    let h = `<h3>Rahmenverträge</h3><p class="hint">Börsenaufträge <b>nimmst</b> du an, sobald du befähigt bist. Rahmenverträge <b>erhältst</b> du erst, wenn du deine Befähigung nachgewiesen hast: Referenzen, Ruf und genug Fachpersonal.</p>`;
    for (const id in CONTRACTS) {
      const D = CONTRACTS[id], c = S.contracts[id];
      const reqs = contractReqs(D);
      const label = { locked: 'Noch nicht angeboten', offered: 'Angebot liegt vor', active: 'Aktiv', terminated: 'Gekündigt' }[c.status];
      let body = `<div class="meta">${esc(D.desc)}</div>
        <div class="meta">Pauschale ${fmtEur(D.daily)}/Tag · Vergütung +${Math.round((D.payFactor - 1) * 100)} % · Mindest-Fristtreue ${Math.round(D.sla * 100)} %</div>
        <div class="meta">Auftragsarten: ${D.jobTypes.map(t => `${stageBadge(JOB_TYPES[t].stage)} ${esc(JOB_TYPES[t].short)}`).join(' ')}</div>`;
      if (c.status !== 'active') body += '<ul class="checks">' + reqs.map(r => `<li class="${r.ok ? 'ok' : 'no'}">${r.ok ? '✓' : '✗'} ${esc(r.label)} <small>(${r.have}/${r.need})</small></li>`).join('') + '</ul>';
      if (c.status === 'active') {
        const rate = c.results.length ? c.results.filter(Boolean).length / c.results.length : 1;
        body += `<div class="meta">Fristtreue (letzte ${c.results.length}): <b class="${rate < D.sla ? 'bad' : 'ok'}">${Math.round(rate * 100)} %</b> · Abmahnungen: ${c.warnings}/2</div>
          <div class="bar small"><div style="width:${rate * 100}%" class="${rate < D.sla ? 'bad' : ''}"></div></div>
          <p class="hint">Vertragsaufträge sind verpflichtend und erscheinen direkt unter „Angenommen“.</p>
          <div class="actions"><button class="ghost small" data-act="c-cancel" data-cid="${id}">Kündigen</button></div>`;
      }
      if (c.status === 'offered') body += `<div class="actions"><button data-act="c-accept" data-cid="${id}" ${reqs.every(r => r.ok) ? '' : 'disabled'}>Vertrag abschließen</button></div>`;
      if (c.status === 'terminated') body += '<p class="lock">Der Auftraggeber arbeitet nicht mehr mit dir zusammen.</p>';
      h += `<div class="card"><div class="card-h"><b>${esc(D.name)}</b><span class="tag">${label}</span></div><div class="sub">${esc(D.client)}</div>${body}</div>`;
    }
    return h;
  },

  renderLog() {
    const S = Game.S, st = S.stats;
    const rows = [['Einnahmen', st.earned], ['Löhne', -st.wages], ['Fahrzeugunterhalt', -st.upkeep], ['Kraftstoff', -st.fuel],
      ['Weiterbildung', -st.training], ['Investitionen', -st.invest], ['Zinsen', -st.interest]];
    let h = `<h3>Finanzen (gesamt)</h3><table class="fin">${rows.map(([k, v]) => `<tr><td>${k}</td><td class="${v < 0 ? 'bad' : 'ok'}">${fmtEur(v)}</td></tr>`).join('')}
      <tr><td>davon Vertragsstrafen</td><td class="bad">${fmtEur(-st.penalties)}</td></tr></table>
      <p class="hint">Offene Forderungen: ${S.receivables.map(r => `${esc(r.text)} ${fmtEur(r.amount)} (in ${until(r.due)})`).join(', ') || 'keine'}</p>`;
    h += '<h3>Letzte Aufträge</h3>' + (S.history.length ? '<table class="hist">' + S.history.slice(0, 15).map(x =>
      `<tr><td>${stageBadge(x.stage)}</td><td>${esc(x.name)}<br><small>${fmtDay(x.t)} ${fmtClock(x.t)}${x.contract ? ' · Vertrag' : ''}</small></td><td class="${x.ok ? 'ok' : 'bad'}">${fmtEur(x.net)}</td></tr>`).join('') + '</table>' : '<p class="empty">Noch keine.</p>');
    h += '<h3>Protokoll</h3><ul class="log">' + S.log.slice(0, 60).map(l => `<li class="${l.kind}"><small>${fmtClock(l.t)}</small> ${esc(l.text)}</li>`).join('') + '</ul>';
    return h;
  },

  // ---------- Zeitleiste ----------
  renderGantt(now) {
    const S = Game.S;
    const w0 = now - 60, w1 = now + 540, span = w1 - w0;
    const x = t => clamp((t - w0) / span * 100, 0, 100);
    const seg = (s, e, cls, label, title) => {
      if (e <= w0 || s >= w1) return '';
      const l = x(s), w = Math.max(0.4, x(e) - l);
      return `<div class="seg ${cls}" style="left:${l}%;width:${w}%" title="${esc(title || label || '')}">${w > 6 ? esc(label || '') : ''}</div>`;
    };
    let ticks = '';
    for (let t = Math.ceil(w0 / 60) * 60; t < w1; t += 60) ticks += `<div class="tick" style="left:${x(t)}%">${fmtClock(t)}</div>`;
    let rows = '';
    for (const v of S.vehicles) {
      let segs = v.hist.map(h => seg(h.s, h.e, h.kind, h.kind === 'work' ? h.label : '')).join('');
      const job = v.jobId ? jobById(v.jobId) : null;
      if (job) {
        const T = JOB_TYPES[job.typeId];
        const fin = estFinish(job, now);
        const back = travelMin(job.pos, CITY.depot, VEHICLE_TYPES[v.type].speed, false);
        const cls = `work s${job.stage}` + (job.status === 'decision' || job.status === 'reinforce' ? ' wait' : '');
        if (v.state === 'toJob') {
          segs += seg(v.trip.t0, v.trip.t1, 'drive', '', 'Anfahrt');
          segs += seg(v.trip.t1, Math.max(v.trip.t1 + 5, fin), cls + ' proj', T.short, `${T.name} (geschätzt)`);
        } else {
          segs += seg(v.arrivedAt, Math.max(now, fin), cls, T.short, `${T.name} – Ende ca. ${fmtClock(fin)}`);
        }
        segs += seg(Math.max(now, fin), Math.max(now, fin) + back, 'return proj', '', 'Rückfahrt (geschätzt)');
        segs += `<div class="deadline" style="left:${x(job.completionDue)}%" title="Erledigungsfrist ${fmtClock(job.completionDue)}"></div>`;
      } else if (v.state === 'returning' && v.trip) {
        segs += seg(v.trip.t0, v.trip.t1, 'return', '', 'Rückfahrt');
      }
      rows += `<div class="g-row"><div class="g-label">${VEHICLE_TYPES[v.type].icon} ${esc(v.name)}</div><div class="g-track">${segs}</div></div>`;
    }
    const pend = S.jobs.filter(j => j.status === 'accepted' || (j.status === 'reinforce' && !j.reinforcement.dispatched));
    const marks = pend.map(j => `<div class="g-mark ${j.reactionDue < now ? 'late' : ''}" style="left:${x(j.reactionDue)}%" title="${esc(j.name)} – Reaktionsfrist ${fmtClock(j.reactionDue)}">◆</div>`).join('');
    rows += `<div class="g-row pend"><div class="g-label">⏳ Offen (${pend.length})</div><div class="g-track">${marks}</div></div>`;
    const trainees = S.staff.filter(p => p.state === 'training');
    if (trainees.length) rows += `<div class="g-row"><div class="g-label">🎓 Schulung</div><div class="g-track">${trainees.map(p => seg(now - 1, p.trainingUntil, 'train', p.name.split(' ')[0])).join('')}</div></div>`;
    $('#gantt').innerHTML = `<div class="g-head"><div class="g-label">Disposition</div><div class="g-track">${ticks}<div class="now" style="left:${x(now)}%"></div></div></div>
      <div class="g-body">${rows}<div class="now-line" style="left:calc(var(--label-w) + (100% - var(--label-w)) * ${x(now) / 100})"></div></div>`;
  },

  // ---------- Modals ----------
  openModal(m) { this.modal = m; $('#modal-backdrop').hidden = false; this.refreshModal(); },
  refreshModal() { if (this.modal) $('#modal').innerHTML = this.modal.render(); },
  closeModal() { this.modal = null; $('#modal-backdrop').hidden = true; $('#modal').innerHTML = ''; markDirty(); },

  confirm(title, text, onYes) {
    this.openModal({
      dismissable: true,
      render: () => `<h2>${esc(title)}</h2><p>${esc(text)}</p><div class="actions right"><button class="ghost" data-m="no">Abbrechen</button><button data-m="yes">Ja</button></div>`,
      onClick: e => { const b = e.target.closest('[data-m]'); if (!b) return; this.closeModal(); if (b.dataset.m === 'yes') onYes(); markDirty(); },
    });
  },

  onDecision(jobId) { if (!this.modal) this.openDecision(jobId); },

  openDecision(jobId) {
    const job = jobById(jobId);
    if (!job || job.status !== 'decision') return;
    const tw = getTwist(job);
    const owned = new Set(Game.S.vehicles.map(v => v.type));
    this.openModal({
      dismissable: true,
      render: () => `<h2>⚠ ${esc(tw.title)}</h2><div class="sub">${stageBadge(job.stage)} ${esc(job.name)} · ${esc(job.addr)}</div>
        <p>${esc(tw.text)}</p><p class="meta">Erledigungsfrist: ${until(job.completionDue)} – die Uhr läuft weiter.</p>
        <div class="options">${tw.options.map((o, i) => {
          const dis = o.needVehicle && !owned.has(o.needVehicle);
          return `<button class="option" data-opt="${i}" ${dis ? 'disabled' : ''}><b>${esc(o.label)}</b><small>${esc(o.info || '')}${dis ? ` – 🔒 kein ${esc(VEHICLE_TYPES[o.needVehicle].name)} im Fuhrpark` : ''}</small></button>`;
        }).join('')}</div>`,
      onClick: e => {
        const b = e.target.closest('[data-opt]'); if (!b || b.disabled) return;
        const o = tw.options[Number(b.dataset.opt)];
        resolveTwist(jobId, Number(b.dataset.opt));
        this.closeModal();
        if (Game.autoPaused) { Game.paused = false; Game.autoPaused = false; }
        if (o.needVehicle) this.openDispatch(jobId);
        else { const next = Game.S.jobs.find(j => j.status === 'decision'); if (next) this.openDecision(next.id); }
      },
      live: () => { if (jobById(jobId)?.status !== 'decision') return this.closeModal(); this.updateCountdowns(nowT()); },
    });
  },

  openDispatch(jobId) {
    const job = jobById(jobId);
    if (!job) return;
    const T = JOB_TYPES[job.typeId];
    const reinf = job.status === 'reinforce';
    if (!(job.status === 'accepted' || (reinf && !job.reinforcement.dispatched))) return;
    const reqs = reinf ? [{ name: 'Nachforderung', staff: job.reinforcement.staff, vehicles: [job.reinforcement.vehicle], factor: 1 }] : T.ways;
    const usable = i => reinf || wayOwnedOk(reqs[i]);
    const st = { wayIdx: 0, veh: new Set(), staff: new Set() };
    const applySuggest = () => {
      const s = suggest(reqs[st.wayIdx], job.pos);
      st.veh = new Set(s ? s.vehicleIds : []);
      st.staff = new Set(s ? s.staffIds.filter(id => staffById(id)?.state === 'depot') : []);
    };
    let first = -1;
    for (let i = 0; i < reqs.length && first < 0; i++) {
      if (!usable(i)) continue;
      const s = suggest(reqs[i], job.pos);
      if (s && checkDispatch(reqs[i], s.vehicleIds, s.staffIds).ok) first = i;
    }
    st.wayIdx = first >= 0 ? first : Math.max(0, reqs.findIndex((w, i) => usable(i)));
    applySuggest();

    const selection = () => {
      const avail = availableVehicles();
      const selV = [...st.veh].map(vehicleById).filter(v => v && avail.includes(v));
      const forced = selV.flatMap(v => v.crew).map(staffById).filter(Boolean);
      const selS = [...st.staff].map(staffById).filter(p => p && p.state === 'depot');
      return { avail, selV, forced, selS, all: [...forced, ...selS] };
    };

    const render = () => {
      const req = reqs[st.wayIdx];
      const { avail, selV, forced, selS, all } = selection();
      const chk = checkDispatch(req, selV.map(v => v.id), all.map(p => p.id));
      const etas = selV.map(v => etaFor(v, job.pos));
      const arr = etas.length ? Math.max(...etas) : null;
      const busyV = Game.S.vehicles.length - avail.length;
      const depotStaff = availableDepotStaff().sort((a, b) => b.level - a.level);
      const outStaff = Game.S.staff.filter(p => p.state !== 'depot').length;

      const waysHtml = reinf ? `<p class="meta">Nachforderung: <b>${wayLabel(req)}</b></p>` : `<div class="ways">${reqs.map((w, i) => `
        <label class="way ${usable(i) ? '' : 'disabled'}"><input type="radio" name="way" value="${i}" ${i === st.wayIdx ? 'checked' : ''} ${usable(i) ? '' : 'disabled'}>
        <span><b>${esc(w.name)}</b>: ${wayLabel(w)}${usable(i) ? '' : `<br><small>🔒 fehlt: ${esc(wayMissing(w).join(' + '))}</small>`}${w.followUp ? '<br><small>Endgültige Reparatur wird als Folgeauftrag neu vergeben.</small>' : ''}</span></label>`).join('')}</div>`;

      const vehHtml = avail.length ? avail.map(v => {
        const crew = v.crew.map(id => staffById(id)).filter(Boolean);
        return `<label class="pickrow"><input type="checkbox" data-kind="veh" value="${v.id}" ${st.veh.has(v.id) ? 'checked' : ''}>
          <span class="vicon">${VEHICLE_TYPES[v.type].icon}</span><span class="grow"><b>${esc(v.name)}</b> <small>${VEHICLE_TYPES[v.type].seats} Sitze · ${stateLabelVehicle(v)}</small>
          ${crew.length ? `<br><small>Besatzung fährt mit: ${crew.map(p => `${esc(p.name)} (${QUALS[p.level].short})`).join(', ')}</small>` : ''}</span>
          <span class="eta">${etaFor(v, job.pos)} min</span></label>`;
      }).join('') : '<p class="empty">Kein Fahrzeug verfügbar.</p>';

      const staffHtml = depotStaff.length ? depotStaff.map(p => `<label class="pickrow"><input type="checkbox" data-kind="staff" value="${p.id}" ${st.staff.has(p.id) ? 'checked' : ''}>
          <span class="q q${p.level}">${QUALS[p.level].short}</span><span class="grow">${esc(p.name)}</span><small>${fmtEur(p.wage)}/h</small></label>`).join('')
        : '<p class="empty">Niemand am Hof.</p>';

      let timing = '';
      if (arr != null && !reinf && job.firstArrival == null) {
        const okR = Game.S.time + arr <= job.reactionDue;
        timing = `<p class="${okR ? 'ok' : 'bad'}">Ankunft voraussichtlich ${fmtClock(Game.S.time + arr)} (in ${arr} min) – Reaktionsfrist ${okR ? 'wird eingehalten ✓' : 'wird überschritten ✗'}</p>`;
      } else if (arr != null) timing = `<p>Ankunft voraussichtlich in ${arr} min</p>`;

      return `<h2>${reinf ? 'Nachforderung' : 'Disposition'}: ${esc(job.name)}</h2>
        <div class="sub">${stageBadge(job.stage)} ${esc(job.addr)} · ${fmtEur(job.base)} · Reaktion ${job.firstArrival != null ? '✓' : until(job.reactionDue)} · Erledigung ${until(job.completionDue)}</div>
        ${waysHtml}
        <div class="cols">
          <div><h4>Fahrzeuge <small>${busyV ? busyV + ' im Einsatz' : ''}</small></h4>${vehHtml}</div>
          <div><h4>Personal am Hof <small>${outStaff ? outStaff + ' unterwegs/Schulung' : ''}</small></h4>${staffHtml}</div>
        </div>
        <ul class="checks">${chk.items.map(i => `<li class="${i.ok ? 'ok' : 'no'}">${i.ok ? '✓' : '✗'} ${esc(i.label)}</li>`).join('')}</ul>
        ${timing}
        <div class="actions right"><button class="ghost" data-m="suggest">Vorschlag</button><button class="ghost" data-m="cancel">Später</button>
        <button data-m="go" ${chk.ok ? '' : 'disabled'}>Losschicken</button></div>`;
    };

    this.openModal({
      dismissable: true,
      render,
      live: () => {
        const j = jobById(jobId);
        if (!j || !(j.status === 'accepted' || (j.status === 'reinforce' && !j.reinforcement.dispatched))) return this.closeModal();
        this.updateCountdowns(nowT());
      },
      onChange: e => {
        const el = e.target;
        if (el.name === 'way') { st.wayIdx = Number(el.value); applySuggest(); }
        else if (el.dataset.kind === 'veh') { const id = Number(el.value); el.checked ? st.veh.add(id) : st.veh.delete(id); }
        else if (el.dataset.kind === 'staff') { const id = Number(el.value); el.checked ? st.staff.add(id) : st.staff.delete(id); }
        this.refreshModal();
      },
      onClick: e => {
        const b = e.target.closest('[data-m]'); if (!b || b.disabled) return;
        if (b.dataset.m === 'cancel') return this.closeModal();
        if (b.dataset.m === 'suggest') { applySuggest(); return this.refreshModal(); }
        if (b.dataset.m === 'go') {
          const cur = jobById(jobId);
          const { selV, all, selS } = selection();
          if (!cur || !checkDispatch(reqs[st.wayIdx], selV.map(v => v.id), all.map(p => p.id)).ok) return this.refreshModal();
          dispatch(cur, selV.map(v => v.id), selS.map(p => p.id), st.wayIdx);
          notify(`🚐 ${selV.map(v => v.name).join(', ')} → ${cur.addr}`, 'info');
          this.closeModal();
        }
      },
    });
  },

  showIntro() {
    this.openModal({
      dismissable: true,
      render: () => `<h2>NETZWERK – Die Störungsleitstelle</h2>
        <p>Du leitest einen kleinen <b>Entstörungsdienst für Elektro-Infrastruktur</b> in ${esc(CITY.name)}. Aufträge kommen von der Auftragsbörse oder später aus Rahmenverträgen – jeder mit <b>Reaktionsfrist</b>, <b>Erledigungsfrist</b> und Vergütung.</p>
        <ol>
          <li><b>Annehmen:</b> Wähle in der Auftragsbörse einen Auftrag, den dein Betrieb leisten kann.</li>
          <li><b>Disponieren:</b> Wähle Fahrzeuge und Personal. Der Vorschlag passt meist schon.</li>
          <li><b>Entscheiden:</b> Vor Ort kann sich die Lage ändern – Nachtrag, Nachforderung oder Abkürzung?</li>
          <li><b>Kassieren:</b> Pünktlich = Bonus und Ruf. Zu spät = Vertragsstrafe.</li>
          <li><b>Wachsen:</b> Bilde Monteure weiter, kaufe Spezialfahrzeuge und schalte so wertvollere Aufträge frei – bis zur Trafostation.</li>
        </ol>
        <p class="hint">Löhne laufen stündlich, Fahrzeugunterhalt täglich. Bei −25.000 € ist der Betrieb insolvent. Leertaste = Pause. Der Spielstand wird automatisch im Browser gespeichert.</p>
        <div class="actions right"><button data-m="ok">Los geht's</button></div>`,
      onClick: e => { if (e.target.closest('[data-m]')) this.closeModal(); },
    });
  },

  confirmNewGame() {
    this.confirm('Neues Spiel starten?', 'Der aktuelle Spielstand wird überschrieben.', () => {
      MapView.reset(); newGame(); save(); this.showIntro();
    });
  },

  gameOver() {
    const S = Game.S;
    this.openModal({
      dismissable: false,
      render: () => `<h2>💸 Insolvenz</h2><p>Dein Betrieb ist zahlungsunfähig (${fmtEur(S.cash)}).</p>
        <p>Du hast ${sum(Object.values(S.done))} Aufträge erledigt und bis ${fmtDay(S.time)} durchgehalten.</p>
        <div class="actions right"><button data-m="new">Neues Spiel</button></div>`,
      onClick: e => { if (e.target.closest('[data-m]')) { this.closeModal(); MapView.reset(); newGame(); save(); } },
    });
  },

  toast(text, kind) {
    const box = $('#toasts');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = text;
    box.prepend(el);
    while (box.children.length > 4) box.lastChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 4500);
  },
};
