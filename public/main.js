/* Hubwagen-ERP – Single-Page-App (Vanilla JS, keine Abhängigkeiten) */
'use strict';

// ============================================================== Grundlagen
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl2br = (v) => esc(v).replace(/\n/g, '<br>');
const todayISO = () => new Date().toLocaleDateString('sv-SE');
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE'); };
const daysUntil = (iso) => Math.round((new Date(iso.slice(0, 10) + 'T12:00:00') - new Date(todayISO() + 'T12:00:00')) / 864e5);
const fmtD = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('.') : '–');
const fmtDT = (iso) => (iso ? fmtD(iso) + (iso.length > 10 ? ' ' + iso.slice(11, 16) : '') : '–');
const EUR = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const eur = (n) => EUR.format(Number(n) || 0);
const num = (n, d = 2) => (Number(n) || 0).toLocaleString('de-DE', { maximumFractionDigits: d });
const round2 = (n) => { const v = Number(n) || 0; return (Math.sign(v) * Math.round((Math.abs(v) + Number.EPSILON) * 100)) / 100; }; // kaufmännisch, symmetrisch
const view = () => $('#view');
let S = {}; // Einstellungen

async function api(method, url, body) {
  const res = await fetch('/api' + url, {
    method, credentials: 'same-origin',
    headers: body !== undefined || method !== 'GET' ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : method !== 'GET' ? '{}' : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.startsWith('/auth/')) { showLogin(); throw new Error('Nicht angemeldet'); }
  if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
  return data;
}
const qs = (o) => { const p = new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v != null)); const s = p.toString(); return s ? '?' + s : ''; };

function toast(msg, err = false) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = 'toast'), err ? 5000 : 2500);
}
const fail = (e) => toast(e.message || String(e), true);

// ============================================================== Stammdaten-Konstanten
const CUSTOMER_TYPES = ['Kunde', 'Interessent', 'Inaktiv'];
const DEVICE_KINDS = ['Handhubwagen', 'Elektro-Hubwagen', 'Scherenhubwagen', 'Wiegehubwagen', 'Edelstahl-Hubwagen', 'Niederhubwagen (Mitfahrer)', 'Deichselstapler', 'Hochhubwagen', 'Gabelstapler', 'Sonstiges'];
const ELECTRIC = ['Elektro-Hubwagen', 'Niederhubwagen (Mitfahrer)', 'Deichselstapler', 'Hochhubwagen', 'Gabelstapler'];
const DEVICE_STATUS = ['aktiv', 'gesperrt', 'stillgelegt'];
const ORDER_TYPES = ['UVV-Prüfung', 'Wartung', 'Reparatur', 'Notdienst', 'Lieferung', 'Beratung'];
const ORDER_STATUS = ['geplant', 'in Arbeit', 'erledigt', 'abgerechnet', 'storniert'];
const RESULTS = ['ohne Mängel', 'geringe Mängel – Betrieb möglich', 'Mängel behoben', 'Mängel – nicht betriebssicher'];
const ACT_KINDS = ['Anruf', 'E-Mail', 'Besuch', 'Notiz', 'Wiedervorlage'];
const UNITS = ['Stk', 'Std', 'km', 'psch', 'Satz', 'l', 'm', 'kg'];

// Prüfpunkte angelehnt an DGUV Vorschrift 68 / DGUV Grundsatz 308-002 (Prüfung von Flurförderzeugen)
const CHECK_BASE = [
  ['Kennzeichnung', 'Typenschild, Tragfähigkeitsangabe, Herstellerangaben lesbar'],
  ['Kennzeichnung', 'Betriebsanleitung vorhanden'],
  ['Rahmen', 'Rahmen / Fahrgestell: Verformung, Risse, Schweißnähte'],
  ['Lastaufnahme', 'Gabelzinken: Verformung, Risse, Verschleiß, Parallelität'],
  ['Lastaufnahme', 'Gabelspitzen / Einfahrrollen, Ausfahrrollen'],
  ['Fahrwerk', 'Lenkräder: Zustand, Lager, Befestigung'],
  ['Fahrwerk', 'Lastrollen / Tandemrollen: Zustand, Lager, Achsen'],
  ['Lenkung', 'Deichsel: Lenkfunktion, Rückstellung, Griff, Bedienhebel'],
  ['Hydraulik', 'Hydraulik: Dichtheit Pumpe / Zylinder, Ölstand'],
  ['Hydraulik', 'Heben / Senken / Neutralstellung, Absenkgeschwindigkeit'],
  ['Hydraulik', 'Überlastventil / Druckbegrenzung'],
  ['Mechanik', 'Gestänge, Bolzen, Sicherungselemente, Schmierung'],
  ['Funktion', 'Funktionsprüfung mit Last / Probefahrt'],
];
const CHECK_ELECTRIC = [
  ['Elektrik', 'Batterie, Batteriestecker, Ladegerät, Kabel'],
  ['Elektrik', 'Not-Aus-Schalter, Schlüsselschalter / Zugangscode'],
  ['Sicherheit', 'Bauchtaster / Kollisionsschutz, Fahrschalter'],
  ['Sicherheit', 'Betriebs- und Feststellbremse'],
  ['Sicherheit', 'Hupe, Warn- und Anzeigeeinrichtungen'],
  ['Hubgerüst', 'Hubgerüst, Ketten, Kettenrollen (bei Hochhub)'],
];
const buildChecklist = (kind) => [...CHECK_BASE, ...(ELECTRIC.includes(kind) ? CHECK_ELECTRIC : [])].map(([group, label]) => ({ group, label, state: '', note: '' }));

function badge(text, cls = '') { return `<span class="badge ${cls}">${esc(text)}</span>`; }
function statusBadge(s) {
  const map = { geplant: 'info', 'in Arbeit': 'warn', erledigt: 'ok', abgerechnet: '', storniert: 'bad',
    Entwurf: '', offen: 'warn', bezahlt: 'ok', angenommen: 'ok', abgelehnt: 'bad',
    aktiv: 'ok', gesperrt: 'bad', stillgelegt: '', Kunde: 'ok', Interessent: 'info', Inaktiv: '' };
  return badge(s || '–', map[s] ?? '');
}
function dueBadge(iso, status) {
  if (status === 'stillgelegt') return badge('stillgelegt');
  if (!iso) return badge('kein Prüfdatum', 'warn');
  const d = daysUntil(iso); const warn = Number(S.reminder_days || 30);
  if (d < 0) return badge(`überfällig seit ${-d} T.`, 'bad');
  if (d === 0) return badge('heute fällig', 'warn');
  if (d <= warn) return badge(`fällig in ${d} T.`, 'warn');
  return badge(fmtD(iso), 'ok');
}
function resultBadge(r) { if (!r) return ''; return badge(r, r.includes('nicht betriebssicher') ? 'bad' : r.startsWith('ohne') || r.includes('behoben') ? 'ok' : 'warn'); }
const deviceLabel = (d) => [d.kind || d.device_kind, d.manufacturer, d.model].filter(Boolean).join(' ') + (d.serial ? ` · SN ${d.serial}` : '');

// ============================================================== Formulare & Modal
function fieldHTML(f, data) {
  const v = data[f.name] ?? f.default ?? '';
  const id = 'f_' + f.name; const req = f.required ? 'required' : '';
  const span = f.span ? `f-${f.span}` : 'f';
  let input;
  if (f.type === 'select') {
    const opts = (typeof f.options === 'function' ? f.options() : f.options).map((o) => (Array.isArray(o) ? o : [o, o]));
    input = `<select id="${id}" name="${f.name}" ${req}>${f.empty !== undefined ? `<option value="">${esc(f.empty)}</option>` : ''}${opts.map(([val, lab]) => `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select>`;
  } else if (f.type === 'textarea') input = `<textarea id="${id}" name="${f.name}" ${req} rows="${f.rows || 3}">${esc(v)}</textarea>`;
  else if (f.type === 'checkbox') return `<div class="${span}"><label class="check"><input type="checkbox" id="${id}" name="${f.name}" ${Number(v) ? 'checked' : ''}> ${esc(f.label)}</label></div>`;
  else input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" ${req} ${f.step ? `step="${f.step}"` : f.type === 'number' ? 'step="any"' : ''} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''}>`;
  return `<div class="${span}"><label for="${id}">${esc(f.label)}${f.required ? ' *' : ''}</label>${input}</div>`;
}
const formHTML = (fields, data = {}) => `<div class="form-grid">${fields.map((f) => fieldHTML(f, data)).join('')}</div>`;
function readForm(root, fields) {
  const out = {};
  for (const f of fields) {
    const el = root.querySelector(`[name="${f.name}"]`); if (!el) continue;
    if (f.type === 'checkbox') out[f.name] = el.checked ? 1 : 0;
    else if (f.type === 'number') out[f.name] = el.value === '' ? null : Number(el.value);
    else out[f.name] = el.value.trim();
  }
  return out;
}

function modal({ title, body, onSubmit, submitLabel = 'Speichern', onDelete, wide }) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-back"><form class="modal" style="${wide ? 'max-width:1000px' : ''}" novalidate>
    <header><h2>${esc(title)}</h2><button type="button" class="icon-btn" style="display:block" data-close aria-label="Schließen">✕</button></header>
    <div class="body">${body}</div>
    <footer>${onDelete ? '<button type="button" class="btn btn-danger" data-del style="margin-right:auto">Löschen</button>' : ''}
      <button type="button" class="btn" data-close>Abbrechen</button>${onSubmit ? `<button class="btn btn-primary" type="submit">${esc(submitLabel)}</button>` : ''}</footer>
  </form></div>`;
  const form = $('form', root); const close = () => (root.innerHTML = '');
  $$('[data-close]', root).forEach((b) => (b.onclick = close));
  $('.modal-back', root).addEventListener('mousedown', (e) => { if (e.target.classList.contains('modal-back')) close(); });
  document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', k); } });
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const btn = $('[type=submit]', form); btn.disabled = true;
    try { if ((await onSubmit(form)) !== false) close(); } catch (err) { fail(err); } finally { btn.disabled = false; }
  };
  if (onDelete) $('[data-del]', root).onclick = async () => { if (!confirm('Wirklich löschen?')) return; try { await onDelete(); close(); } catch (err) { fail(err); } };
  setTimeout(() => form.querySelector('input:not([type=hidden]),select,textarea')?.focus(), 30);
  return { form, close };
}

let customersCache = null;
async function customerOptions(force) {
  if (!customersCache || force) customersCache = await api('GET', '/customers?limit=2000');
  return customersCache.map((c) => [c.id, `${c.company}${c.city ? ' (' + c.city + ')' : ''}${c.type !== 'Kunde' ? ' – ' + c.type : ''}`]);
}

const CUSTOMER_FIELDS = [
  { name: 'company', label: 'Firma / Name', required: true, span: 8 },
  { name: 'type', label: 'Status', type: 'select', options: CUSTOMER_TYPES, span: 4 },
  { name: 'contact_person', label: 'Ansprechpartner' },
  { name: 'email', label: 'E-Mail', type: 'email' },
  { name: 'phone', label: 'Telefon', type: 'tel' },
  { name: 'mobile', label: 'Mobil', type: 'tel' },
  { name: 'street', label: 'Straße, Nr.', span: 12 },
  { name: 'zip', label: 'PLZ', span: 4 },
  { name: 'city', label: 'Ort', span: 8 },
  { name: 'vat_id', label: 'USt-IdNr.', span: 4 },
  { name: 'payment_days', label: 'Zahlungsziel (Tage)', type: 'number', span: 4 },
  { name: 'source', label: 'Quelle', type: 'select', empty: '–', options: ['Empfehlung', 'Website', 'Telefon', 'Messe', 'Kaltakquise', 'Bestandskunde', 'Sonstiges'], span: 4 },
  { name: 'notes', label: 'Notizen', type: 'textarea', span: 12 },
];
const deviceFields = (customers) => [
  { name: 'customer_id', label: 'Kunde', type: 'select', options: customers, required: true, span: 8 },
  { name: 'status', label: 'Status', type: 'select', options: DEVICE_STATUS, span: 4 },
  { name: 'kind', label: 'Gerätetyp', type: 'select', options: DEVICE_KINDS, span: 4 },
  { name: 'manufacturer', label: 'Hersteller', span: 4 },
  { name: 'model', label: 'Modell / Typ', span: 4 },
  { name: 'serial', label: 'Seriennummer', span: 4 },
  { name: 'year', label: 'Baujahr', type: 'number', step: 1, span: 4 },
  { name: 'capacity_kg', label: 'Tragfähigkeit (kg)', type: 'number', step: 1, span: 4 },
  { name: 'location', label: 'Standort / Inventar-Nr.', span: 8 },
  { name: 'interval_months', label: 'Prüfintervall (Monate)', type: 'number', step: 1, span: 4 },
  { name: 'last_inspection', label: 'Letzte Prüfung', type: 'date', span: 4 },
  { name: 'next_inspection', label: 'Nächste Prüfung (leer = automatisch)', type: 'date', span: 4 },
  { name: 'notes', label: 'Notizen', type: 'textarea', span: 12 },
];
const ARTICLE_FIELDS = [
  { name: 'name', label: 'Bezeichnung', required: true, span: 8 },
  { name: 'kind', label: 'Art', type: 'select', options: ['Ersatzteil', 'Leistung'], span: 4 },
  { name: 'number', label: 'Artikelnummer (leer = automatisch)', span: 4 },
  { name: 'unit', label: 'Einheit', type: 'select', options: UNITS, span: 4 },
  { name: 'price', label: 'VK netto (€)', type: 'number', step: '0.01', span: 4 },
  { name: 'cost', label: 'EK netto (€)', type: 'number', step: '0.01', span: 4 },
  { name: 'stock', label: 'Lagerbestand', type: 'number', span: 4 },
  { name: 'min_stock', label: 'Mindestbestand', type: 'number', span: 4 },
  { name: 'supplier', label: 'Lieferant', span: 12 },
  { name: 'notes', label: 'Notizen', type: 'textarea', span: 12 },
];
const activityFields = (customers) => [
  ...(customers ? [{ name: 'customer_id', label: 'Kunde', type: 'select', options: customers, required: true, span: 12 }] : []),
  { name: 'date', label: 'Datum', type: 'date', required: true, span: 4 },
  { name: 'kind', label: 'Art', type: 'select', options: ACT_KINDS, span: 4 },
  { name: 'followup_date', label: 'Wiedervorlage am', type: 'date', span: 4 },
  { name: 'subject', label: 'Betreff', span: 12 },
  { name: 'text', label: 'Notiz', type: 'textarea', span: 12, rows: 4 },
  { name: 'done', label: 'Wiedervorlage erledigt', type: 'checkbox', span: 12 },
];

async function editCustomer(c = {}, after) {
  modal({
    title: c.id ? `Kunde bearbeiten – ${c.number}` : 'Neuer Kunde / Interessent',
    body: formHTML(CUSTOMER_FIELDS, { type: 'Kunde', payment_days: S.payment_days, ...c }),
    onSubmit: async (f) => {
      const data = readForm(f, CUSTOMER_FIELDS);
      const r = c.id ? await api('PUT', `/customers/${c.id}`, data) : await api('POST', '/customers', data);
      customersCache = null; toast('Gespeichert'); after ? after(r) : route();
    },
    onDelete: c.id ? async () => { await api('DELETE', `/customers/${c.id}`); customersCache = null; toast('Gelöscht'); location.hash = '#/kunden'; } : null,
  });
}
async function editDevice(d = {}, after) {
  const fields = deviceFields(await customerOptions());
  modal({
    title: d.id ? `Gerät bearbeiten – ${d.number}` : 'Neues Gerät',
    body: formHTML(fields, { kind: 'Handhubwagen', status: 'aktiv', interval_months: S.default_interval_months || 12, ...d }),
    onSubmit: async (f) => {
      const data = readForm(f, fields);
      if (!data.next_inspection) delete data.next_inspection;
      const r = d.id ? await api('PUT', `/devices/${d.id}`, data) : await api('POST', '/devices', data);
      toast('Gespeichert'); after ? after(r) : route();
    },
    onDelete: d.id ? async () => { await api('DELETE', `/devices/${d.id}`); toast('Gelöscht'); history.back(); } : null,
  });
}
function editArticle(a = {}) {
  modal({
    title: a.id ? `Artikel bearbeiten – ${a.number}` : 'Neuer Artikel',
    body: formHTML(ARTICLE_FIELDS, { kind: 'Ersatzteil', unit: 'Stk', ...a }),
    onSubmit: async (f) => { const data = readForm(f, ARTICLE_FIELDS); a.id ? await api('PUT', `/articles/${a.id}`, data) : await api('POST', '/articles', data); toast('Gespeichert'); route(); },
    onDelete: a.id ? async () => { await api('DELETE', `/articles/${a.id}`); toast('Gelöscht'); route(); } : null,
  });
}
async function editActivity(a = {}, fixedCustomer) {
  const fields = activityFields(fixedCustomer ? null : await customerOptions());
  modal({
    title: a.id ? 'Kontakt bearbeiten' : 'Neuer Kontakt / Notiz',
    body: formHTML(fields, { date: todayISO(), kind: 'Anruf', ...a }),
    onSubmit: async (f) => {
      const data = readForm(f, fields); if (fixedCustomer) data.customer_id = fixedCustomer;
      a.id ? await api('PUT', `/activities/${a.id}`, data) : await api('POST', '/activities', data); toast('Gespeichert'); route();
    },
    onDelete: a.id ? async () => { await api('DELETE', `/activities/${a.id}`); toast('Gelöscht'); route(); } : null,
  });
}

// ============================================================== Tabellen-Helfer
function table(cols, rows, { onRow, empty = 'Keine Einträge vorhanden.' } = {}) {
  if (!rows.length) return `<div class="empty">${esc(empty)}</div>`;
  return `<div class="table-wrap"><table><thead><tr>${cols.map((c) => `<th class="${c.num ? 'num' : ''}">${esc(c.label)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r, i) => `<tr class="${onRow ? 'clickable' : ''}" data-i="${i}">${cols.map((c) => `<td class="${c.num ? 'num' : ''}">${c.html ? c.html(r) : esc(r[c.key] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function bindRows(root, rows, onRow) {
  $$('tbody tr.clickable', root).forEach((tr) => tr.addEventListener('click', (e) => { if (e.target.closest('a,button,input,select,label')) return; onRow(rows[tr.dataset.i]); }));
}
function pageHead(title, actions = '', sub = '') {
  return `<div class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<small>${sub}</small>` : ''}</div><div class="actions">${actions}</div></div>`;
}

// ============================================================== Seiten: Übersicht
async function pageDashboard() {
  const d = await api('GET', '/dashboard'); const k = d.kpi;
  const max = Math.max(1, ...d.monthly.map((m) => m.net));
  const curMonth = todayISO().slice(0, 7);
  const monthName = (m) => new Date(m + '-15').toLocaleDateString('de-DE', { month: 'short' });
  view().innerHTML = pageHead(`Guten ${new Date().getHours() < 12 ? 'Morgen' : new Date().getHours() < 18 ? 'Tag' : 'Abend'}${S.owner ? ', ' + esc(S.owner.split(' ')[0]) : ''}`, `<a class="btn" href="#/kunden?neu=1">+ Kunde</a><a class="btn" href="#/geraete?filter=faellig">Prüfungen planen</a><a class="btn btn-primary" href="#/rechnungen/neu">+ Rechnung</a>`, new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) + `
    <div class="kpis">
      <a class="kpi ${k.devices_overdue ? 'bad' : 'ok'}" href="#/geraete?filter=ueberfaellig"><div class="label">Prüfungen überfällig</div><div class="value">${k.devices_overdue}</div><div class="sub">${k.devices_due_soon} fällig in ${esc(S.reminder_days || 30)} Tagen · ${k.devices_total} Geräte</div></a>
      <a class="kpi warn" href="#/auftraege?status=geplant,in Arbeit"><div class="label">Offene Aufträge</div><div class="value">${k.orders_open}</div><div class="sub">${k.orders_to_invoice} erledigt, nicht abgerechnet</div></a>
      <a class="kpi ${k.overdue_invoices ? 'bad' : ''}" href="#/rechnungen?status=offen"><div class="label">Offene Posten</div><div class="value">${eur(k.open_amount)}</div><div class="sub">${k.open_invoices} Rechnungen · ${k.overdue_invoices} überfällig (${eur(k.overdue_amount)})</div></a>
      <a class="kpi ok" href="#/rechnungen"><div class="label">Umsatz ${new Date().toLocaleDateString('de-DE', { month: 'long' })} (netto)</div><div class="value">${eur(k.revenue_month)}</div><div class="sub">Jahr ${new Date().getFullYear()}: ${eur(k.revenue_year)}</div></a>
      <a class="kpi" href="#/kunden"><div class="label">Kunden</div><div class="value">${k.customers}</div><div class="sub">${k.leads} Interessenten · ${k.devices_blocked} Geräte gesperrt</div></a>
    </div>
    <div class="grid grid-2">
      <div class="card flush"><h2>Fällige Prüfungen</h2>${table([
        { label: 'Gerät', html: (r) => `<a href="#/geraete/${r.id}">${esc(r.number)}</a><br><small>${esc(deviceLabel(r))}</small>` },
        { label: 'Kunde', html: (r) => `<a href="#/kunden/${r.customer_id}">${esc(r.company)}</a><br><small>${esc(r.city || '')}</small>` },
        { label: 'Fällig', html: (r) => dueBadge(r.next_inspection, r.status) },
      ], d.due_devices, { empty: 'Keine Prüfungen in nächster Zeit fällig. 👍' })}
      ${d.due_devices.length ? '<div style="padding:.8rem 1.2rem"><a class="btn btn-sm" href="#/geraete?filter=faellig">Alle fälligen Geräte & Prüfaufträge anlegen →</a></div>' : ''}</div>
      <div class="card flush"><h2>Nächste Termine</h2>${table([
        { label: 'Termin', html: (r) => `<strong>${fmtDT(r.scheduled_at)}</strong>` },
        { label: 'Auftrag', html: (r) => `<a href="#/auftraege/${r.id}">${esc(r.number)}</a> ${badge(r.type)}<br><small>${esc(r.company)}${r.city ? ', ' + esc(r.city) : ''}</small>` },
        { label: 'Status', html: (r) => statusBadge(r.status) },
      ], d.upcoming_orders, { empty: 'Keine offenen Aufträge.' })}</div>
      <div class="card"><h2>Umsatz der letzten 12 Monate (netto)</h2>
        <div class="bars">${d.monthly.map((m) => `<div class="bar ${m.month === curMonth ? 'cur' : ''}" title="${esc(monthName(m.month))}: ${eur(m.net)}"><i style="height:${(m.net / max) * 100}%"></i><small>${esc(monthName(m.month))}</small></div>`).join('')}</div>
      </div>
      <div class="card flush"><h2>Zu erledigen</h2>
        ${d.to_invoice.length ? `<h3 style="padding:0 1.2rem">Abrechnen</h3>${table([{ label: 'Auftrag', html: (r) => `<a href="#/auftraege/${r.id}">${esc(r.number)}</a> · ${esc(r.type)}` }, { label: 'Kunde', key: 'company' }, { label: '', html: (r) => `<button class="btn btn-sm btn-accent" data-invoice="${r.id}">Rechnung erstellen</button>` }], d.to_invoice)}` : ''}
        ${d.overdue_invoices.length ? `<h3 style="padding:0 1.2rem">Überfällige Rechnungen</h3>${table([{ label: 'Rechnung', html: (r) => `<a href="#/belege/${r.id}">${esc(r.number)}</a>` }, { label: 'Kunde', key: 'company' }, { label: 'Fällig', html: (r) => badge(fmtD(r.due_date), 'bad') }, { label: 'Betrag', num: 1, html: (r) => eur(r.gross) }], d.overdue_invoices)}` : ''}
        ${d.followups.length ? `<h3 style="padding:0 1.2rem">Wiedervorlagen</h3>${table([{ label: 'Datum', html: (r) => badge(fmtD(r.followup_date), r.followup_date < todayISO() ? 'bad' : 'warn') }, { label: 'Kunde', html: (r) => `<a href="#/kunden/${r.customer_id}/kontakte">${esc(r.company)}</a>` }, { label: 'Betreff', key: 'subject' }], d.followups)}` : ''}
        ${d.low_stock.length ? `<h3 style="padding:0 1.2rem">Mindestbestand unterschritten</h3>${table([{ label: 'Artikel', html: (r) => `${esc(r.number)} – ${esc(r.name)}` }, { label: 'Bestand', num: 1, html: (r) => `${num(r.stock)} / ${num(r.min_stock)} ${esc(r.unit)}` }], d.low_stock)}` : ''}
        ${!d.to_invoice.length && !d.overdue_invoices.length && !d.followups.length && !d.low_stock.length ? '<div class="empty">Alles erledigt. 🎉</div>' : ''}
      </div>
    </div>`;
  $$('[data-invoice]').forEach((b) => (b.onclick = () => createInvoiceFromOrder(b.dataset.invoice)));
}

async function createInvoiceFromOrder(id) {
  try { const doc = await api('POST', `/orders/${id}/invoice`); toast(`Rechnung ${doc.number} als Entwurf erstellt`); location.hash = `#/belege/${doc.id}`; } catch (e) { fail(e); }
}

// ============================================================== Kunden
async function pageCustomers(_, q) {
  const filter = { q: q.q || '', type: q.type ?? 'Kunde,Interessent' };
  const rows = await api('GET', '/customers' + qs(filter));
  view().innerHTML = pageHead('Kunden & Interessenten', `<a class="btn" href="/api/csv/customers">CSV-Export</a><button class="btn btn-primary" id="new">+ Neu</button>`) + `
    <div class="toolbar"><input type="search" id="q" placeholder="Suchen …" value="${esc(filter.q)}">
      <select id="type">${[['Kunde,Interessent', 'Kunden & Interessenten'], ['Kunde', 'Nur Kunden'], ['Interessent', 'Nur Interessenten'], ['Inaktiv', 'Inaktiv'], ['', 'Alle']].map(([v, l]) => `<option value="${v}" ${v === filter.type ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <small>${rows.length} Einträge</small></div>
    <div class="card flush">${table([
      { label: 'Nr.', key: 'number' },
      { label: 'Firma', html: (r) => `<strong>${esc(r.company)}</strong>${r.contact_person ? `<br><small>${esc(r.contact_person)}</small>` : ''}` },
      { label: 'Ort', html: (r) => esc([r.zip, r.city].filter(Boolean).join(' ')) },
      { label: 'Kontakt', html: (r) => `${r.phone ? `<a href="tel:${esc(r.phone)}">${esc(r.phone)}</a><br>` : ''}${r.email ? `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>` : ''}` },
      { label: 'Status', html: (r) => statusBadge(r.type) },
      { label: 'Geräte', num: 1, key: 'device_count' },
      { label: 'Nächste Prüfung', html: (r) => (r.device_count ? dueBadge(r.next_inspection) : '') },
      { label: 'Offene Aufträge', num: 1, key: 'open_orders' },
    ], rows, { onRow: 1, empty: 'Noch keine Kunden angelegt.' })}</div>`;
  bindRows(view(), rows, (r) => (location.hash = `#/kunden/${r.id}`));
  const apply = () => (location.hash = '#/kunden' + qs({ q: $('#q').value, type: $('#type').value }));
  $('#q').addEventListener('change', apply); $('#type').onchange = apply;
  $('#new').onclick = () => editCustomer({}, (c) => (location.hash = `#/kunden/${c.id}`));
  if (q.neu) $('#new').click();
}

async function pageCustomer([id, tab = 'uebersicht']) {
  const c = await api('GET', `/customers/${id}`);
  const tabs = [['uebersicht', 'Übersicht'], ['geraete', `Geräte (${c.device_count})`], ['auftraege', 'Aufträge'], ['belege', 'Angebote & Rechnungen'], ['kontakte', 'Kontaktverlauf']];
  let body = '';
  if (tab === 'uebersicht') {
    const [acts, docs] = await Promise.all([api('GET', `/activities?customer_id=${id}&limit=5`), api('GET', `/documents?customer_id=${id}`)]);
    const revenue = docs.filter((d) => d.kind === 'rechnung' && ['offen', 'bezahlt'].includes(d.status) && !d.number.startsWith('ST-')).reduce((a, d) => a + d.net, 0);
    const open = docs.filter((d) => d.kind === 'rechnung' && d.status === 'offen').reduce((a, d) => a + d.gross, 0);
    body = `<div class="grid grid-2"><div class="card"><h2>Stammdaten</h2><dl class="props">
      <dt>Kundennr.</dt><dd>${esc(c.number)}</dd><dt>Status</dt><dd>${statusBadge(c.type)}</dd>
      <dt>Ansprechpartner</dt><dd>${esc(c.contact_person || '–')}</dd>
      <dt>Adresse</dt><dd>${esc(c.street || '')}<br>${esc([c.zip, c.city].filter(Boolean).join(' '))}${c.street || c.city ? `<br><a target="_blank" rel="noopener" href="https://www.openstreetmap.org/search?query=${encodeURIComponent([c.street, c.zip, c.city].filter(Boolean).join(', '))}">Karte / Route ↗</a>` : ''}</dd>
      <dt>Telefon</dt><dd>${c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : '–'}${c.mobile ? ` · <a href="tel:${esc(c.mobile)}">${esc(c.mobile)}</a>` : ''}</dd>
      <dt>E-Mail</dt><dd>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '–'}</dd>
      <dt>USt-IdNr.</dt><dd>${esc(c.vat_id || '–')}</dd><dt>Zahlungsziel</dt><dd>${esc(c.payment_days ?? S.payment_days)} Tage</dd>
      <dt>Quelle</dt><dd>${esc(c.source || '–')}</dd><dt>Kunde seit</dt><dd>${fmtD(c.created_at)}</dd></dl>
      ${c.notes ? `<h3>Notizen</h3><p>${nl2br(c.notes)}</p>` : ''}</div>
      <div><div class="kpis" style="grid-template-columns:1fr 1fr">
        <div class="kpi ok"><div class="label">Umsatz gesamt (netto)</div><div class="value">${eur(revenue)}</div></div>
        <div class="kpi ${open ? 'warn' : ''}"><div class="label">Offene Posten</div><div class="value">${eur(open)}</div></div>
        <div class="kpi"><div class="label">Geräte</div><div class="value">${c.device_count}</div><div class="sub">nächste Prüfung: ${fmtD(c.next_inspection)}</div></div>
        <div class="kpi"><div class="label">Offene Aufträge</div><div class="value">${c.open_orders}</div></div></div>
      <div class="card"><h2>Letzte Kontakte</h2>${acts.length ? acts.map((a) => `<p><strong>${fmtD(a.date)}</strong> · ${badge(a.kind)} ${esc(a.subject || '')}<br><small>${esc((a.text || '').slice(0, 160))}</small></p>`).join('') : '<p class="muted">Noch keine Kontakte erfasst.</p>'}</div></div></div>`;
  } else if (tab === 'geraete') {
    const rows = await api('GET', `/devices?customer_id=${id}`);
    body = `<div class="toolbar"><button class="btn btn-primary" id="newdev">+ Gerät</button><button class="btn" id="plan">Prüfaufträge für Auswahl anlegen</button><button class="btn" id="offer">Prüfangebot für Auswahl</button></div>
      <div class="card flush">${deviceTable(rows, true)}</div>`;
    setTimeout(() => {
      bindRows(view(), rows, (r) => (location.hash = `#/geraete/${r.id}`));
      $('#newdev').onclick = () => editDevice({ customer_id: c.id });
      bindDeviceSelection(rows, c.id);
    });
  } else if (tab === 'auftraege') {
    const rows = await api('GET', `/orders?customer_id=${id}`);
    body = `<div class="toolbar"><a class="btn btn-primary" href="#/auftraege/neu?customer_id=${id}">+ Auftrag</a></div><div class="card flush">${orderTable(rows)}</div>`;
    setTimeout(() => bindRows(view(), rows, (r) => (location.hash = `#/auftraege/${r.id}`)));
  } else if (tab === 'belege') {
    const rows = await api('GET', `/documents?customer_id=${id}`);
    body = `<div class="toolbar"><a class="btn" href="#/angebote/neu?customer_id=${id}">+ Angebot</a><a class="btn btn-primary" href="#/rechnungen/neu?customer_id=${id}">+ Rechnung</a></div><div class="card flush">${docTable(rows, true)}</div>`;
    setTimeout(() => bindRows(view(), rows, (r) => (location.hash = `#/belege/${r.id}`)));
  } else if (tab === 'kontakte') {
    const rows = await api('GET', `/activities?customer_id=${id}`);
    body = `<div class="toolbar"><button class="btn btn-primary" id="newact">+ Kontakt / Notiz</button></div><div class="card flush">${activityTable(rows, false)}</div>`;
    setTimeout(() => { bindRows(view(), rows, (r) => editActivity(r, c.id)); $('#newact').onclick = () => editActivity({}, c.id); bindActivityDone(); });
  }
  view().innerHTML = pageHead(c.company, `<button class="btn" id="edit">Bearbeiten</button><button class="btn" id="act">+ Kontakt</button><a class="btn btn-accent" href="#/auftraege/neu?customer_id=${c.id}">+ Auftrag</a>`, `${esc(c.number)} · ${esc([c.zip, c.city].filter(Boolean).join(' '))}`) +
    `<nav class="tabs">${tabs.map(([k, l]) => `<a href="#/kunden/${id}/${k}" class="${k === tab ? 'active' : ''}">${esc(l)}</a>`).join('')}</nav>` + body;
  $('#edit').onclick = () => editCustomer(c);
  $('#act').onclick = () => editActivity({}, c.id);
}

// ============================================================== Geräte
function deviceTable(rows, selectable) {
  return table([
    ...(selectable ? [{ label: '', html: (r) => `<input type="checkbox" class="sel" value="${r.id}" style="width:auto">` }] : []),
    { label: 'Nr.', html: (r) => `<a href="#/geraete/${r.id}">${esc(r.number)}</a>` },
    { label: 'Gerät', html: (r) => `<strong>${esc(r.kind)}</strong><br><small>${esc([r.manufacturer, r.model].filter(Boolean).join(' '))}</small>` },
    { label: 'Seriennr.', key: 'serial' },
    { label: 'Kunde', html: (r) => `<a href="#/kunden/${r.customer_id}">${esc(r.company)}</a><br><small>${esc(r.location || '')}</small>` },
    { label: 'Tragf.', num: 1, html: (r) => (r.capacity_kg ? num(r.capacity_kg, 0) + ' kg' : '') },
    { label: 'Letzte Prüfung', html: (r) => `${fmtD(r.last_inspection)}<br>${resultBadge(r.last_result)}` },
    { label: 'Nächste Prüfung', html: (r) => dueBadge(r.next_inspection, r.status) },
    { label: 'Status', html: (r) => statusBadge(r.status) },
  ], rows, { onRow: 1, empty: 'Keine Geräte gefunden.' });
}
function bindDeviceSelection(rows, customerId) {
  const sel = () => $$('.sel:checked').map((c) => Number(c.value));
  $('#plan').onclick = async () => {
    const ids = sel(); if (!ids.length) return toast('Bitte Geräte auswählen', true);
    modal({
      title: `${ids.length} Prüfauftrag/-aufträge anlegen`,
      body: `<p>Für jedes ausgewählte Gerät wird ein Auftrag „UVV-Prüfung“ angelegt (Geräte mit bereits offenem Prüfauftrag werden übersprungen).</p>${formHTML([{ name: 'scheduled_at', label: 'Termin (optional)', type: 'datetime-local', span: 12 }])}`,
      submitLabel: 'Anlegen',
      onSubmit: async (f) => { const r = await api('POST', '/plan-inspections', { device_ids: ids, scheduled_at: f.scheduled_at.value }); toast(`${r.created} Auftrag/Aufträge angelegt`); route(); },
    });
  };
  $('#offer').onclick = async () => {
    const ids = sel(); if (!ids.length) return toast('Bitte Geräte auswählen', true);
    const devs = rows.filter((r) => ids.includes(r.id));
    const cust = customerId || devs[0].customer_id;
    if (devs.some((d) => d.customer_id !== cust)) return toast('Bitte nur Geräte eines Kunden auswählen', true);
    const arts = await api('GET', '/articles?kind=Leistung');
    const pickArt = (d) => arts.find((a) => (ELECTRIC.includes(d.kind) ? /elektro|deichsel/i : /handhub/i).test(a.name)) || arts.find((a) => /uvv|prüf/i.test(a.name));
    const items = devs.map((d) => { const a = pickArt(d); return { article_id: a?.id || null, description: `UVV-Prüfung ${deviceLabel(d)}`, qty: 1, unit: 'Stk', price: a?.price || 0 }; });
    if (Number(S.travel_flat) > 0) items.push({ description: 'Anfahrtspauschale', qty: 1, unit: 'psch', price: Number(S.travel_flat) });
    const doc = await api('POST', '/documents', { kind: 'angebot', customer_id: cust, subject: 'Wiederkehrende Prüfung Ihrer Flurförderzeuge (DGUV V68)', intro: 'gerne bieten wir Ihnen die fällige Prüfung folgender Geräte an:', items });
    toast(`Angebot ${doc.number} erstellt`); location.hash = `#/belege/${doc.id}`;
  };
}

async function pageDevices(_, q) {
  const filter = q.filter || 'alle';
  const params = { q: q.q || '' };
  if (filter === 'ueberfaellig') params.due = -1;
  if (filter === 'faellig') params.due = S.reminder_days || 30;
  if (filter === 'gesperrt') params.status = 'gesperrt';
  if (filter === 'alle') params.status = 'aktiv,gesperrt';
  const rows = await api('GET', '/devices' + qs(params));
  view().innerHTML = pageHead('Geräte & Prüffristen', `<a class="btn" href="/api/csv/devices">CSV-Export</a><button class="btn btn-primary" id="new">+ Gerät</button>`, 'Flurförderzeuge Ihrer Kunden mit Prüfintervall (DGUV Vorschrift 68 § 37: mind. jährliche Prüfung durch befähigte Person)') + `
    <div class="toolbar"><input type="search" id="q" placeholder="Seriennr., Hersteller, Kunde …" value="${esc(params.q)}">
      <nav class="tabs" style="margin:0;border:0">${[['alle', 'Aktive'], ['faellig', `Fällig ≤ ${S.reminder_days || 30} Tage`], ['ueberfaellig', 'Überfällig'], ['gesperrt', 'Gesperrt'], ['inkl', 'Alle inkl. stillgelegt']].map(([k, l]) => `<a href="#/geraete${qs({ filter: k, q: params.q })}" class="${k === filter ? 'active' : ''}">${l}</a>`).join('')}</nav></div>
    <div class="toolbar"><label class="check"><input type="checkbox" id="all"> alle wählen</label><button class="btn btn-sm" id="plan">Prüfaufträge für Auswahl anlegen</button><button class="btn btn-sm" id="offer">Prüfangebot für Auswahl (ein Kunde)</button><small>${rows.length} Geräte</small></div>
    <div class="card flush">${deviceTable(rows, true)}</div>`;
  bindRows(view(), rows, (r) => (location.hash = `#/geraete/${r.id}`));
  bindDeviceSelection(rows);
  $('#all').onchange = (e) => $$('.sel').forEach((c) => (c.checked = e.target.checked));
  $('#q').onchange = () => (location.hash = '#/geraete' + qs({ filter, q: $('#q').value }));
  $('#new').onclick = () => editDevice({}, (d) => (location.hash = `#/geraete/${d.id}`));
}

async function pageDevice([id]) {
  const d = await api('GET', `/devices/${id}`);
  const orders = await api('GET', `/orders?device_id=${id}`);
  const lastInsp = orders.find((o) => o.type === 'UVV-Prüfung' && ['erledigt', 'abgerechnet'].includes(o.status));
  view().innerHTML = pageHead(`${d.number} · ${d.kind}`, `<button class="btn" id="edit">Bearbeiten</button>${lastInsp ? `<a class="btn" href="#/druck/protokoll/${lastInsp.id}">Letztes Prüfprotokoll</a>` : ''}<a class="btn btn-accent" href="#/auftraege/neu?customer_id=${d.customer_id}&device_id=${d.id}&type=UVV-Prüfung">+ Prüfung / Auftrag</a>`, `<a href="#/kunden/${d.customer_id}">${esc(d.company)}</a>`) + `
    ${d.status === 'gesperrt' ? `<div class="notice bad">⚠ Gerät ist gesperrt – letzte Prüfung: ${esc(d.last_result || 'nicht betriebssicher')}. Nicht in Betrieb nehmen, bis die Mängel behoben sind.</div>` : ''}
    <div class="grid grid-2"><div class="card"><h2>Gerätedaten</h2><dl class="props">
      <dt>Gerätetyp</dt><dd>${esc(d.kind)}</dd><dt>Hersteller / Modell</dt><dd>${esc([d.manufacturer, d.model].filter(Boolean).join(' ') || '–')}</dd>
      <dt>Seriennummer</dt><dd>${esc(d.serial || '–')}</dd><dt>Baujahr</dt><dd>${esc(d.year || '–')}</dd>
      <dt>Tragfähigkeit</dt><dd>${d.capacity_kg ? num(d.capacity_kg, 0) + ' kg' : '–'}</dd><dt>Standort</dt><dd>${esc(d.location || '–')}</dd>
      <dt>Status</dt><dd>${statusBadge(d.status)}</dd></dl>${d.notes ? `<h3>Notizen</h3><p>${nl2br(d.notes)}</p>` : ''}</div>
      <div class="card"><h2>Prüfung</h2><dl class="props">
      <dt>Prüfintervall</dt><dd>${esc(d.interval_months)} Monate</dd><dt>Letzte Prüfung</dt><dd>${fmtD(d.last_inspection)} ${resultBadge(d.last_result)}</dd>
      <dt>Nächste Prüfung</dt><dd>${dueBadge(d.next_inspection, d.status)} ${d.next_inspection ? fmtD(d.next_inspection) : ''}</dd></dl>
      ${d.next_inspection ? `<div style="margin-top:1rem;display:flex;gap:1rem;align-items:center"><div class="plakette" style="width:90px;height:90px;border-width:5px"><small>nächste Prüfung</small><span class="y" style="font-size:14pt">${esc(d.next_inspection.slice(5, 7))}/${esc(d.next_inspection.slice(0, 4))}</span></div><small>Angabe für die Prüfplakette</small></div>` : ''}</div></div>
    <div class="card flush"><h2>Service-Historie</h2>${orderTable(orders)}</div>`;
  bindRows(view(), orders, (r) => (location.hash = `#/auftraege/${r.id}`));
  $('#edit').onclick = () => editDevice(d);
}

// ============================================================== Aufträge
function orderTable(rows) {
  return table([
    { label: 'Nr.', html: (r) => `<a href="#/auftraege/${r.id}">${esc(r.number)}</a>` },
    { label: 'Termin', html: (r) => fmtDT(r.scheduled_at) },
    { label: 'Art', html: (r) => badge(r.type) },
    { label: 'Kunde', html: (r) => `${esc(r.company)}<br><small>${esc(r.city || '')}</small>` },
    { label: 'Gerät', html: (r) => (r.device_id ? `${esc(r.device_number)}<br><small>${esc(deviceLabel(r))}</small>` : '<small>–</small>') },
    { label: 'Ergebnis', html: (r) => resultBadge(r.result) },
    { label: 'Status', html: (r) => statusBadge(r.status) + (r.invoice_number ? `<br><small>${esc(r.invoice_number)}</small>` : '') },
  ], rows, { onRow: 1, empty: 'Keine Aufträge vorhanden.' });
}
async function pageOrders(_, q) {
  const filter = { q: q.q || '', status: q.status ?? '', type: q.type || '' };
  const rows = await api('GET', '/orders' + qs(filter));
  view().innerHTML = pageHead('Serviceaufträge', `<a class="btn" href="/api/csv/orders">CSV-Export</a><a class="btn btn-primary" href="#/auftraege/neu">+ Auftrag</a>`) + `
    <div class="toolbar"><input type="search" id="q" placeholder="Suchen …" value="${esc(filter.q)}">
      <select id="status"><option value="">Alle Status</option>${[['geplant,in Arbeit', 'Offen (geplant / in Arbeit)'], ...ORDER_STATUS.map((s) => [s, s])].map(([v, l]) => `<option value="${esc(v)}" ${v === filter.status ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <select id="type"><option value="">Alle Arten</option>${ORDER_TYPES.map((t) => `<option ${t === filter.type ? 'selected' : ''}>${t}</option>`).join('')}</select><small>${rows.length} Aufträge</small></div>
    <div class="card flush">${orderTable(rows)}</div>`;
  bindRows(view(), rows, (r) => (location.hash = `#/auftraege/${r.id}`));
  const apply = () => (location.hash = '#/auftraege' + qs({ q: $('#q').value, status: $('#status').value, type: $('#type').value }));
  $('#q').onchange = apply; $('#status').onchange = apply; $('#type').onchange = apply;
}

// ---- Positionseditor (für Aufträge und Belege)
function itemsEditor(items, articles, { readonly, tax } = {}) {
  const row = (it = {}) => `<tr>
    <td><input name="description" value="${esc(it.description || '')}" placeholder="Beschreibung" ${readonly ? 'disabled' : ''}><input type="hidden" name="article_id" value="${esc(it.article_id || '')}"></td>
    <td class="c-qty"><input name="qty" type="number" step="any" value="${esc(it.qty ?? 1)}" ${readonly ? 'disabled' : ''}></td>
    <td class="c-unit"><select name="unit" ${readonly ? 'disabled' : ''}>${[...new Set([...UNITS, it.unit || 'Stk'])].map((u) => `<option ${u === (it.unit || 'Stk') ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></td>
    <td class="c-price"><input name="price" type="number" step="0.01" value="${esc(it.price ?? 0)}" ${readonly ? 'disabled' : ''}></td>
    <td class="c-sum num" data-sum></td>
    <td class="c-del">${readonly ? '' : '<button type="button" class="btn btn-sm btn-danger" data-rm title="Position entfernen">✕</button>'}</td></tr>`;
  const html = `<div class="table-wrap"><table class="items"><thead><tr><th>Beschreibung</th><th>Menge</th><th>Einheit</th><th class="num">Preis netto</th><th class="num">Gesamt</th><th></th></tr></thead>
    <tbody>${items.map(row).join('')}</tbody></table></div>
    ${readonly ? '' : `<div class="toolbar" style="margin-top:.6rem"><select id="add-art" style="max-width:420px"><option value="">+ Artikel / Leistung hinzufügen …</option>${articles.map((a) => `<option value="${a.id}">${esc(a.number)} – ${esc(a.name)} (${eur(a.price)}${a.kind === 'Ersatzteil' ? `, Bestand ${num(a.stock)}` : ''})</option>`).join('')}</select><button type="button" class="btn btn-sm" id="add-free">+ Freie Position</button></div>`}
    <table class="totals"><tbody><tr><td>Summe netto</td><td class="num" id="t-net"></td></tr>${tax !== undefined ? `<tr><td id="t-taxl"></td><td class="num" id="t-tax"></td></tr><tr class="grand"><td>Gesamt</td><td class="num" id="t-gross"></td></tr>` : ''}</tbody></table>`;
  function bind(root, getTax) {
    const tbody = $('table.items tbody', root);
    const recalc = () => {
      let net = 0;
      $$('tr', tbody).forEach((tr) => { const s = round2((Number($('[name=qty]', tr).value) || 0) * (Number($('[name=price]', tr).value) || 0)); net += s; $('[data-sum]', tr).textContent = eur(s); });
      $('#t-net', root).textContent = eur(net);
      if (getTax) { const t = Number(getTax()) || 0; const tx = round2(net * t / 100); $('#t-taxl', root).textContent = t ? `zzgl. ${num(t)} % USt.` : 'USt. (0 %)'; $('#t-tax', root).textContent = eur(tx); $('#t-gross', root).textContent = eur(net + tx); }
    };
    tbody.addEventListener('input', recalc);
    tbody.addEventListener('click', (e) => { if (e.target.closest('[data-rm]')) { e.target.closest('tr').remove(); recalc(); } });
    const add = (it) => { tbody.insertAdjacentHTML('beforeend', row(it)); recalc(); };
    if (!readonly) {
      $('#add-art', root).onchange = (e) => { const a = articles.find((x) => String(x.id) === e.target.value); if (a) add({ article_id: a.id, description: a.name, qty: 1, unit: a.unit, price: a.price }); e.target.value = ''; };
      $('#add-free', root).onclick = () => { add({}); $$('tr', tbody).pop().querySelector('input').focus(); };
    }
    recalc();
    return { recalc, read: () => $$('tr', tbody).map((tr) => ({ article_id: Number($('[name=article_id]', tr).value) || null, description: $('[name=description]', tr).value.trim(), qty: Number($('[name=qty]', tr).value) || 0, unit: $('[name=unit]', tr).value, price: Number($('[name=price]', tr).value) || 0 })).filter((i) => i.description) };
  }
  return { html, bind };
}

async function pageOrder([id], q) {
  const isNew = id === 'neu';
  const [o, customers, articles] = await Promise.all([
    isNew ? Promise.resolve({ customer_id: q.customer_id || '', device_id: q.device_id || '', type: q.type || 'UVV-Prüfung', status: 'geplant', scheduled_at: q.date ? q.date + 'T08:00' : '', duration_min: 60, items: [], work_hours: 0, travel_km: 0 }) : api('GET', `/orders/${id}`),
    customerOptions(), api('GET', '/articles'),
  ]);
  let devices = o.customer_id ? await api('GET', `/devices?customer_id=${o.customer_id}`) : [];
  const locked = o.status === 'abgerechnet';
  const head = [
    { name: 'customer_id', label: 'Kunde', type: 'select', options: customers, empty: '– Kunde wählen –', required: true, span: 8 },
    { name: 'type', label: 'Auftragsart', type: 'select', options: ORDER_TYPES, span: 4 },
    { name: 'device_id', label: 'Gerät', type: 'select', options: () => devices.map((d) => [d.id, `${d.number} – ${deviceLabel(d)}`]), empty: '– ohne Gerät –', span: 8 },
    { name: 'status', label: 'Status', type: 'select', options: ORDER_STATUS, span: 4 },
    { name: 'scheduled_at', label: 'Termin', type: 'datetime-local', span: 4 },
    { name: 'duration_min', label: 'Dauer (Min.)', type: 'number', step: 5, span: 4 },
    { name: 'signed_by', label: 'Abgenommen von (Kunde)', span: 4 },
    { name: 'description', label: 'Auftrag / Fehlerbeschreibung', type: 'textarea', span: 12 },
  ];
  const result = [
    { name: 'findings', label: 'Befund / durchgeführte Arbeiten', type: 'textarea', span: 12, rows: 4 },
    { name: 'result', label: 'Prüfergebnis', type: 'select', options: RESULTS, empty: '–', span: 6 },
    { name: 'work_hours', label: `Arbeitszeit (Std. à ${eur(S.hourly_rate)})`, type: 'number', step: '0.25', span: 3 },
    { name: 'travel_km', label: `Anfahrt km (à ${eur(S.km_rate)})`, type: 'number', step: 1, span: 3 },
  ];
  const ed = itemsEditor(o.items || [], articles, { readonly: locked });
  view().innerHTML = pageHead(isNew ? 'Neuer Serviceauftrag' : `Auftrag ${o.number}`, isNew ? '' : `
      <a class="btn" href="#/druck/protokoll/${o.id}">${o.type === 'UVV-Prüfung' ? 'Prüfprotokoll' : 'Arbeitsbericht'} drucken</a>
      ${o.invoice_id ? `<a class="btn" href="#/belege/${o.invoice_id}">Rechnung ${esc(o.invoice_number)}</a>` : `<button class="btn btn-accent" id="inv">Rechnung erstellen</button>`}
      <button class="btn btn-danger" id="del">Löschen</button>`, isNew ? '' : `${esc(o.company)} · ${statusBadge(o.status)}`) + `
    ${locked ? '<div class="notice info">Dieser Auftrag ist abgerechnet. Positionen sind gesperrt – Befund und Status können weiterhin gepflegt werden.</div>' : ''}
    <form id="of" novalidate>
      <div class="card"><h2>Auftrag</h2>${formHTML(head, o)}</div>
      <div class="card" id="cl-card"><h2>Prüf-Checkliste <small class="muted" style="font-weight:400">(DGUV V68 / DGUV G 308-002)</small></h2><div id="cl"></div></div>
      <div class="card"><h2>Befund & Ergebnis</h2>${formHTML(result, o)}</div>
      <div class="card"><h2>Material & Leistungen</h2>${ed.html}</div>
      <div class="toolbar"><button class="btn btn-primary" type="submit">Speichern</button><button class="btn" type="button" id="done">Speichern & als erledigt markieren</button><a class="btn" href="#/auftraege">Zurück</a></div>
    </form>`;
  const form = $('#of');
  const items = ed.bind(form);
  let checklist = Array.isArray(o.checklist) ? o.checklist : null;
  const selDev = () => devices.find((d) => String(d.id) === form.device_id.value);
  function renderChecklist() {
    const show = ['UVV-Prüfung', 'Wartung'].includes(form.type.value);
    $('#cl-card').style.display = show ? '' : 'none';
    if (!show) return;
    if (!checklist) checklist = buildChecklist(selDev()?.kind);
    $('#cl').innerHTML = `<div class="toolbar"><button type="button" class="btn btn-sm" id="all-ok">Alle offenen Punkte „i.O.“</button><button type="button" class="btn btn-sm" id="cl-reset">Checkliste neu laden (Gerätetyp)</button></div>
      <div class="table-wrap"><table class="checklist"><thead><tr><th>Prüfpunkt</th><th>Bewertung</th><th>Bemerkung</th></tr></thead><tbody>${checklist.map((c, i) => `<tr>
        <td><small class="muted">${esc(c.group)}</small><br>${esc(c.label)}</td>
        <td><div class="seg">${[['ok', 'i.O.', 's-ok'], ['bad', 'n.i.O.', 's-bad'], ['na', 'n.z.', '']].map(([v, l, cls]) => `<label class="${cls}"><input type="radio" name="cl_${i}" value="${v}" ${c.state === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></td>
        <td><input data-note="${i}" value="${esc(c.note || '')}" placeholder="Bemerkung"></td></tr>`).join('')}</tbody></table></div>`;
    $('#all-ok').onclick = () => { readChecklist(); checklist.forEach((c) => { if (!c.state) c.state = 'ok'; }); renderChecklist(); };
    $('#cl-reset').onclick = () => { if (confirm('Checkliste zurücksetzen?')) { checklist = buildChecklist(selDev()?.kind); renderChecklist(); } };
  }
  function readChecklist() {
    if (!checklist || $('#cl-card').style.display === 'none') return;
    checklist.forEach((c, i) => { c.state = form.querySelector(`[name=cl_${i}]:checked`)?.value || ''; c.note = form.querySelector(`[data-note="${i}"]`).value.trim(); });
  }
  renderChecklist();
  form.type.onchange = renderChecklist;
  form.customer_id.onchange = async () => {
    devices = form.customer_id.value ? await api('GET', `/devices?customer_id=${form.customer_id.value}`) : [];
    form.device_id.innerHTML = `<option value="">– ohne Gerät –</option>` + devices.map((d) => `<option value="${d.id}">${esc(d.number)} – ${esc(deviceLabel(d))}</option>`).join('');
  };
  form.device_id.onchange = () => { if (checklist && !checklist.some((c) => c.state)) { checklist = null; renderChecklist(); } };

  async function save(markDone, noRoute) {
    if (!form.reportValidity()) return false;
    readChecklist();
    const data = { ...readForm(form, [...head, ...result]), checklist: $('#cl-card').style.display === 'none' ? null : checklist };
    if (!locked) data.items = items.read();
    if (markDone) {
      if (data.type === 'UVV-Prüfung' && checklist && checklist.some((c) => !c.state) && !confirm('Nicht alle Prüfpunkte sind bewertet. Trotzdem abschließen?')) return;
      if (data.type === 'UVV-Prüfung' && !data.result) data.result = checklist?.some((c) => c.state === 'bad') ? 'Mängel – nicht betriebssicher' : 'ohne Mängel';
      if (!['erledigt', 'abgerechnet'].includes(data.status)) data.status = 'erledigt';
    }
    try {
      const r = isNew ? await api('POST', '/orders', data) : await api('PUT', `/orders/${o.id}`, data);
      toast(markDone && r.device_id && r.type === 'UVV-Prüfung' ? 'Gespeichert – Prüfdatum am Gerät aktualisiert' : 'Gespeichert');
      if (isNew) location.hash = `#/auftraege/${r.id}`; else if (!noRoute) route();
      return true;
    } catch (e) { fail(e); return false; }
  }
  form.onsubmit = (e) => { e.preventDefault(); save(false); };
  $('#done').onclick = () => save(true);
  if (!isNew) {
    $('#del').onclick = async () => { if (confirm('Auftrag wirklich löschen?')) { try { await api('DELETE', `/orders/${o.id}`); toast('Gelöscht'); location.hash = '#/auftraege'; } catch (e) { fail(e); } } };
    if ($('#inv')) $('#inv').onclick = async () => { if (await save(false, true)) createInvoiceFromOrder(o.id); };
  }
}

// ============================================================== Kalender
async function pageCalendar(_, q) {
  const base = q.m ? new Date(q.m + '-01T12:00:00') : new Date();
  const y = base.getFullYear(); const m = base.getMonth();
  const first = new Date(y, m, 1, 12); const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d.toLocaleDateString('sv-SE'); });
  const [orders, acts, devs] = await Promise.all([
    api('GET', '/orders' + qs({ from: days[0], to: addDays(days[41], 1), limit: 2000 })),
    api('GET', '/activities?done=0&limit=2000'),
    api('GET', '/devices?status=aktiv,gesperrt&limit=2000'),
  ]);
  const by = {};
  const push = (d, html) => (by[d] = by[d] || []).push(html);
  orders.filter((o) => o.status !== 'storniert').forEach((o) => push(o.scheduled_at.slice(0, 10), `<a class="ev ${['erledigt', 'abgerechnet'].includes(o.status) ? 'done' : ''}" href="#/auftraege/${o.id}" title="${esc(o.type + ' – ' + o.company)}">${esc(o.scheduled_at.slice(11, 16))} ${esc(o.type)} · ${esc(o.company)}</a>`));
  acts.filter((a) => a.followup_date).forEach((a) => push(a.followup_date, `<a class="ev fu" href="#/kunden/${a.customer_id}/kontakte" title="Wiedervorlage">↻ ${esc(a.company)}: ${esc(a.subject || a.kind)}</a>`));
  devs.filter((d) => d.next_inspection).forEach((d) => push(d.next_inspection, `<a class="ev due" href="#/geraete/${d.id}" title="Prüfung fällig">⚑ Prüfung ${esc(d.number)} · ${esc(d.company)}</a>`));
  const ym = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  const prev = ym(new Date(y, m - 1, 1)); const next = ym(new Date(y, m + 1, 1));
  view().innerHTML = pageHead(base.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }), `<a class="btn" href="#/kalender?m=${prev}">‹</a><a class="btn" href="#/kalender">Heute</a><a class="btn" href="#/kalender?m=${next}">›</a>`, 'Klick auf einen Tag legt einen neuen Auftrag an · <span class="badge info">Auftrag</span> <span class="badge ok">erledigt</span> <span class="badge warn">Wiedervorlage</span> <span class="badge bad">Prüfung fällig</span>') + `
    <div class="card flush"><div class="cal">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => `<div class="dow">${d}</div>`).join('')}
    ${days.map((d) => `<div class="day ${d.slice(5, 7) !== String(m + 1).padStart(2, '0') ? 'other' : ''} ${d === todayISO() ? 'today' : ''}" data-day="${d}"><span class="dnum">${Number(d.slice(8))}</span>${(by[d] || []).join('')}</div>`).join('')}</div></div>`;
  $$('.day').forEach((el) => el.addEventListener('click', (e) => { if (!e.target.closest('a')) location.hash = `#/auftraege/neu?date=${el.dataset.day}`; }));
}

// ============================================================== Belege (Angebote / Rechnungen)
function docTable(rows, showKind) {
  return table([
    { label: 'Nr.', html: (r) => `<a href="#/belege/${r.id}">${esc(r.number)}</a>` },
    ...(showKind ? [{ label: 'Art', html: (r) => badge(r.number.startsWith('ST-') ? 'Storno' : r.kind === 'rechnung' ? 'Rechnung' : 'Angebot') }] : []),
    { label: 'Datum', html: (r) => fmtD(r.date) },
    { label: 'Kunde', html: (r) => esc(r.company) },
    { label: 'Betreff', key: 'subject' },
    { label: 'Fällig / gültig', html: (r) => (r.kind === 'rechnung' ? (r.status === 'offen' && r.due_date < todayISO() ? badge(fmtD(r.due_date), 'bad') : fmtD(r.due_date)) : fmtD(r.valid_until)) },
    { label: 'Netto', num: 1, html: (r) => eur(r.net) },
    { label: 'Brutto', num: 1, html: (r) => `<strong>${eur(r.gross)}</strong>` },
    { label: 'Status', html: (r) => statusBadge(r.status) + (r.reminder_level ? ` ${badge(r.reminder_level + '. Mahnung', 'bad')}` : '') },
  ], rows, { onRow: 1, empty: 'Keine Belege vorhanden.' });
}
async function pageDocuments(kind, q) {
  const filter = { kind, q: q.q || '', status: q.status || '' };
  const rows = await api('GET', '/documents' + qs(filter));
  const statuses = kind === 'rechnung' ? ['Entwurf', 'offen', 'bezahlt', 'storniert'] : ['Entwurf', 'offen', 'angenommen', 'abgelehnt'];
  const sum = rows.filter((r) => r.status !== 'storniert' && r.status !== 'Entwurf');
  const title = kind === 'rechnung' ? 'Rechnungen' : 'Angebote';
  view().innerHTML = pageHead(title, `<a class="btn" href="/api/csv/documents">CSV-Export</a><a class="btn btn-primary" href="#/${kind === 'rechnung' ? 'rechnungen' : 'angebote'}/neu">+ ${kind === 'rechnung' ? 'Rechnung' : 'Angebot'}</a>`) + `
    <div class="toolbar"><input type="search" id="q" placeholder="Suchen …" value="${esc(filter.q)}">
      <select id="status"><option value="">Alle Status</option>${statuses.map((s) => `<option ${s === filter.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <small>${rows.length} Belege · Summe (ohne Entwürfe/Stornos): netto ${eur(sum.reduce((a, r) => a + r.net, 0))} / brutto ${eur(sum.reduce((a, r) => a + r.gross, 0))}</small></div>
    <div class="card flush">${docTable(rows, kind === 'rechnung')}</div>`;
  bindRows(view(), rows, (r) => (location.hash = `#/belege/${r.id}`));
  const apply = () => (location.hash = `#/${kind === 'rechnung' ? 'rechnungen' : 'angebote'}` + qs({ q: $('#q').value, status: $('#status').value }));
  $('#q').onchange = apply; $('#status').onchange = apply;
}

async function pageDocument([id], q, newKind) {
  const isNew = !!newKind;
  const [d, customers, articles] = await Promise.all([
    isNew ? Promise.resolve({ kind: newKind, customer_id: q.customer_id || '', date: todayISO(), status: 'Entwurf', items: [], tax_rate: S.small_business === '1' ? 0 : Number(S.tax_rate) }) : api('GET', `/documents/${id}`),
    customerOptions(), api('GET', '/articles'),
  ]);
  const isInv = d.kind === 'rechnung';
  const locked = isInv && d.status !== 'Entwurf';
  const label = d.number?.startsWith('ST-') ? 'Stornorechnung' : isInv ? 'Rechnung' : 'Angebot';
  const fields = [
    { name: 'customer_id', label: 'Kunde', type: 'select', options: customers, empty: '– Kunde wählen –', required: true, span: 8 },
    { name: 'date', label: `${label}sdatum`, type: 'date', required: true, span: 4 },
    { name: 'subject', label: 'Betreff', span: 8 },
    isInv ? { name: 'due_date', label: 'Fällig am (leer = Zahlungsziel)', type: 'date', span: 4 } : { name: 'valid_until', label: 'Gültig bis', type: 'date', span: 4 },
    ...(isInv ? [{ name: 'service_date', label: 'Leistungsdatum (leer = Rechnungsdatum)', type: 'date', span: 4 }] : []),
    { name: 'intro', label: 'Einleitungstext', type: 'textarea', span: 12, rows: 2 },
    { name: 'footer', label: 'Schlusstext', type: 'textarea', span: 8, rows: 2 },
    { name: 'tax_rate', label: 'USt.-Satz (%)', type: 'number', step: '0.1', span: 4 },
  ];
  const ed = itemsEditor(d.items || [], articles, { readonly: locked, tax: true });
  const actions = isNew ? '' : [
    `<a class="btn" href="#/druck/beleg/${d.id}">Drucken / PDF</a>`,
    isInv && d.status === 'Entwurf' ? '<button class="btn btn-accent" data-act="finalize">Festschreiben & versenden</button>' : '',
    isInv && d.status === 'offen' ? '<button class="btn btn-accent" data-act="paid">Als bezahlt markieren</button>' : '',
    isInv && d.status === 'offen' && d.due_date < todayISO() ? `<button class="btn" data-act="remind">${(d.reminder_level || 0) + 1}. Mahnung drucken</button>` : '',
    isInv && ['offen', 'bezahlt'].includes(d.status) && !d.number.startsWith('ST-') ? '<button class="btn btn-danger" data-act="storno">Stornieren</button>' : '',
    !isInv && ['Entwurf', 'offen'].includes(d.status) ? '<button class="btn" data-act="sent">Als versendet markieren</button>' : '',
    !isInv && d.status !== 'abgelehnt' ? '<button class="btn btn-accent" data-act="toinvoice">In Rechnung umwandeln</button>' : '',
    !isInv && ['offen', 'Entwurf'].includes(d.status) ? '<button class="btn" data-act="reject">Abgelehnt</button>' : '',
    '<button class="btn" data-act="copy">Kopieren</button>',
    !locked ? '<button class="btn btn-danger" data-act="del">Löschen</button>' : '',
  ].join('');
  view().innerHTML = pageHead(isNew ? `Neue${isInv ? ' Rechnung' : 's Angebot'}` : `${label} ${d.number}`, actions, isNew ? '' : `${esc(d.company)} · ${statusBadge(d.status)}${d.paid_at ? ' bezahlt am ' + fmtD(d.paid_at) : ''}${d.order_id ? ` · <a href="#/auftraege/${d.order_id}">zum Auftrag</a>` : ''}`) + `
    ${locked ? '<div class="notice info">Diese Rechnung ist festgeschrieben (GoBD) und kann inhaltlich nicht mehr geändert werden. Korrekturen bitte per Storno und neuer Rechnung.</div>' : ''}
    ${S.small_business === '1' ? '<div class="notice">Kleinunternehmerregelung aktiv: Auf Belegen wird der Hinweis nach § 19 UStG gedruckt.</div>' : ''}
    <form id="df" novalidate><fieldset ${locked ? 'disabled' : ''} style="border:0;padding:0;margin:0">
      <div class="card"><h2>Kopfdaten</h2>${formHTML(fields, d)}</div>
      <div class="card"><h2>Positionen</h2>${ed.html}</div></fieldset>
      ${locked ? '' : '<div class="toolbar"><button class="btn btn-primary" type="submit">Speichern</button></div>'}
    </form>`;
  const form = $('#df');
  const items = ed.bind(form, () => form.tax_rate.value);
  form.tax_rate.addEventListener('input', items.recalc);
  const save = async () => {
    const data = readForm(form, fields); data.items = items.read(); data.kind = d.kind;
    if (!data.items.length) throw new Error('Bitte mindestens eine Position erfassen');
    return isNew ? api('POST', '/documents', data) : api('PUT', `/documents/${d.id}`, data);
  };
  form.onsubmit = async (e) => { e.preventDefault(); if (!form.reportValidity()) return; try { const r = await save(); toast('Gespeichert'); if (isNew) location.hash = `#/belege/${r.id}`; else route(); } catch (err) { fail(err); } };
  $$('[data-act]').forEach((b) => (b.onclick = async () => {
    const act = b.dataset.act;
    try {
      if (act === 'finalize') {
        if (!confirm('Rechnung festschreiben? Danach sind keine inhaltlichen Änderungen mehr möglich.')) return;
        await save(); await api('PUT', `/documents/${d.id}`, { status: 'offen' }); toast('Rechnung festgeschrieben'); location.hash = `#/druck/beleg/${d.id}`;
      } else if (act === 'paid') {
        modal({ title: 'Zahlungseingang erfassen', body: formHTML([{ name: 'paid_at', label: 'Bezahlt am', type: 'date', required: true, span: 12 }], { paid_at: todayISO() }), onSubmit: async (f) => { await api('PUT', `/documents/${d.id}`, { status: 'bezahlt', paid_at: f.paid_at.value }); toast('Zahlung erfasst'); route(); } });
      } else if (act === 'remind') {
        await api('PUT', `/documents/${d.id}`, { reminder_level: (d.reminder_level || 0) + 1 }); location.hash = `#/druck/beleg/${d.id}?mahnung=1`;
      } else if (act === 'storno') {
        if (!confirm(`Rechnung ${d.number} stornieren? Es wird eine Stornorechnung erzeugt.`)) return;
        const s = await api('POST', `/documents/${d.id}/storno`); toast(`Stornorechnung ${s.number} erstellt`); location.hash = `#/belege/${s.id}`;
      } else if (act === 'sent') { await save(); await api('PUT', `/documents/${d.id}`, { status: 'offen' }); toast('Als versendet markiert'); route(); }
      else if (act === 'reject') { await api('PUT', `/documents/${d.id}`, { status: 'abgelehnt' }); route(); }
      else if (act === 'toinvoice') { if (!locked) await save(); const r = await api('POST', `/documents/${d.id}/rechnung`); toast(`Rechnung ${r.number} erstellt`); location.hash = `#/belege/${r.id}`; }
      else if (act === 'copy') { const r = await api('POST', `/documents/${d.id}/copy`); toast(`Kopie ${r.number} erstellt`); location.hash = `#/belege/${r.id}`; }
      else if (act === 'del') { if (!confirm('Beleg löschen?')) return; await api('DELETE', `/documents/${d.id}`); toast('Gelöscht'); location.hash = isInv ? '#/rechnungen' : '#/angebote'; }
    } catch (e) { fail(e); }
  }));
}

// ============================================================== Artikel
async function pageArticles(_, q) {
  const filter = { q: q.q || '', kind: q.kind || '' };
  const rows = await api('GET', '/articles' + qs(filter));
  view().innerHTML = pageHead('Artikel & Lager', `<a class="btn" href="/api/csv/articles">CSV-Export</a><button class="btn btn-primary" id="new">+ Artikel</button>`, 'Ersatzteile (mit Lagerbestand) und Dienstleistungen – Ersatzteile werden beim Abschließen eines Auftrags automatisch abgebucht.') + `
    <div class="toolbar"><input type="search" id="q" placeholder="Suchen …" value="${esc(filter.q)}"><select id="kind"><option value="">Alle</option><option ${filter.kind === 'Ersatzteil' ? 'selected' : ''}>Ersatzteil</option><option ${filter.kind === 'Leistung' ? 'selected' : ''}>Leistung</option></select></div>
    <div class="card flush">${table([
      { label: 'Nr.', key: 'number' }, { label: 'Bezeichnung', html: (r) => `<strong>${esc(r.name)}</strong>${r.supplier ? `<br><small>${esc(r.supplier)}</small>` : ''}` },
      { label: 'Art', html: (r) => badge(r.kind, r.kind === 'Leistung' ? 'info' : '') },
      { label: 'VK netto', num: 1, html: (r) => `${eur(r.price)} / ${esc(r.unit)}` },
      { label: 'EK', num: 1, html: (r) => (r.cost ? eur(r.cost) : '') },
      { label: 'Marge', num: 1, html: (r) => (r.cost && r.price ? `${num(((r.price - r.cost) / r.price) * 100, 0)} %` : '') },
      { label: 'Bestand', num: 1, html: (r) => (r.kind === 'Ersatzteil' ? (r.min_stock > 0 && r.stock <= r.min_stock ? badge(`${num(r.stock)} ${r.unit}`, 'bad') : `${num(r.stock)} ${esc(r.unit)}`) : '') },
    ], rows, { onRow: 1, empty: 'Noch keine Artikel angelegt.' })}</div>`;
  bindRows(view(), rows, (r) => editArticle(r));
  const apply = () => (location.hash = '#/artikel' + qs({ q: $('#q').value, kind: $('#kind').value }));
  $('#q').onchange = apply; $('#kind').onchange = apply;
  $('#new').onclick = () => editArticle();
}

// ============================================================== CRM-Aktivitäten
function activityTable(rows, showCustomer = true) {
  return table([
    { label: 'Datum', html: (r) => fmtD(r.date) }, { label: 'Art', html: (r) => badge(r.kind) },
    ...(showCustomer ? [{ label: 'Kunde', html: (r) => `<a href="#/kunden/${r.customer_id}/kontakte">${esc(r.company)}</a>` }] : []),
    { label: 'Betreff / Notiz', html: (r) => `<strong>${esc(r.subject || '')}</strong><br><small>${esc((r.text || '').slice(0, 200))}</small>` },
    { label: 'Wiedervorlage', html: (r) => (r.followup_date ? (r.done ? badge('erledigt', 'ok') : badge(fmtD(r.followup_date), r.followup_date <= todayISO() ? 'bad' : 'warn')) : '') },
    { label: '', html: (r) => (r.followup_date && !r.done ? `<button class="btn btn-sm" data-done="${r.id}">✓ erledigt</button>` : '') },
  ], rows, { onRow: 1, empty: 'Keine Kontakte erfasst.' });
}
function bindActivityDone() { $$('[data-done]').forEach((b) => (b.onclick = async () => { await api('PUT', `/activities/${b.dataset.done}`, { done: 1 }).catch(fail); route(); })); }
async function pageCRM(_, q) {
  const mode = q.f || 'offen';
  const rows = await api('GET', '/activities' + qs({ done: mode === 'offen' ? 0 : '', q: q.q || '' }));
  const shown = mode === 'offen' ? rows.filter((r) => r.followup_date).sort((a, b) => a.followup_date.localeCompare(b.followup_date)) : rows;
  view().innerHTML = pageHead('Kontakte & Wiedervorlagen', `<button class="btn btn-primary" id="new">+ Kontakt / Notiz</button>`) + `
    <div class="toolbar"><input type="search" id="q" placeholder="Suchen …" value="${esc(q.q || '')}"><nav class="tabs" style="margin:0;border:0"><a href="#/crm?f=offen" class="${mode === 'offen' ? 'active' : ''}">Offene Wiedervorlagen</a><a href="#/crm?f=alle" class="${mode === 'alle' ? 'active' : ''}">Alle Kontakte</a></nav></div>
    <div class="card flush">${activityTable(shown)}</div>`;
  bindRows(view(), shown, (r) => editActivity(r));
  bindActivityDone();
  $('#new').onclick = () => editActivity();
  $('#q').onchange = () => (location.hash = '#/crm' + qs({ f: mode, q: $('#q').value }));
}

// ============================================================== Suche
async function pageSearch(_, q) {
  const term = q.q || '';
  const [c, d, o, x] = await Promise.all(['customers', 'devices', 'orders', 'documents'].map((r) => api('GET', `/${r}?limit=20&q=${encodeURIComponent(term)}${r === 'customers' ? '&type=' : ''}`)));
  const sec = (title, rows, html) => `<div class="card"><h2>${title} (${rows.length})</h2>${rows.length ? rows.map(html).join('') : '<p class="muted">Keine Treffer</p>'}</div>`;
  view().innerHTML = pageHead(`Suche: „${esc(term)}“`) + `<div class="grid grid-2">
    ${sec('Kunden', c, (r) => `<p><a href="#/kunden/${r.id}"><strong>${esc(r.company)}</strong></a> · ${esc(r.number)} · ${esc(r.city || '')}</p>`)}
    ${sec('Geräte', d, (r) => `<p><a href="#/geraete/${r.id}"><strong>${esc(r.number)}</strong></a> · ${esc(deviceLabel(r))} · ${esc(r.company)}</p>`)}
    ${sec('Aufträge', o, (r) => `<p><a href="#/auftraege/${r.id}"><strong>${esc(r.number)}</strong></a> · ${esc(r.type)} · ${esc(r.company)} · ${statusBadge(r.status)}</p>`)}
    ${sec('Belege', x, (r) => `<p><a href="#/belege/${r.id}"><strong>${esc(r.number)}</strong></a> · ${esc(r.company)} · ${eur(r.gross)} · ${statusBadge(r.status)}</p>`)}</div>`;
}

// ============================================================== Einstellungen
const SETTINGS_FIELDS = [
  { name: 'company_name', label: 'Firmenname', span: 8 }, { name: 'owner', label: 'Inhaber', span: 4 },
  { name: 'street', label: 'Straße, Nr.', span: 6 }, { name: 'zip', label: 'PLZ', span: 2 }, { name: 'city', label: 'Ort', span: 4 },
  { name: 'phone', label: 'Telefon', span: 4 }, { name: 'email', label: 'E-Mail', span: 4 }, { name: 'website', label: 'Website', span: 4 },
  { name: 'tax_number', label: 'Steuernummer', span: 4 }, { name: 'vat_id', label: 'USt-IdNr.', span: 4 }, { name: 'small_business', label: 'Kleinunternehmer nach § 19 UStG (keine USt.)', type: 'checkbox', span: 4 },
  { name: 'bank_name', label: 'Bank', span: 4 }, { name: 'iban', label: 'IBAN', span: 5 }, { name: 'bic', label: 'BIC', span: 3 },
];
const RATE_FIELDS = [
  { name: 'tax_rate', label: 'Standard-USt.-Satz (%)', type: 'number', span: 3 }, { name: 'hourly_rate', label: 'Stundensatz netto (€)', type: 'number', span: 3 },
  { name: 'km_rate', label: 'km-Satz Anfahrt (€)', type: 'number', span: 3 }, { name: 'travel_flat', label: 'Anfahrtspauschale (€, wenn keine km)', type: 'number', span: 3 },
  { name: 'payment_days', label: 'Zahlungsziel (Tage)', type: 'number', span: 3 }, { name: 'offer_valid_days', label: 'Angebot gültig (Tage)', type: 'number', span: 3 },
  { name: 'default_interval_months', label: 'Standard-Prüfintervall (Monate)', type: 'number', span: 3 }, { name: 'reminder_days', label: 'Vorwarnzeit Prüfungen (Tage)', type: 'number', span: 3 },
  { name: 'invoice_footer', label: 'Standard-Schlusstext Rechnung', type: 'textarea', span: 6 }, { name: 'offer_footer', label: 'Standard-Schlusstext Angebot', type: 'textarea', span: 6 },
];
async function pageSettings() {
  S = await api('GET', '/settings');
  view().innerHTML = pageHead('Einstellungen') + `
    <form id="sf" class="card"><h2>Firmendaten (erscheinen auf Belegen)</h2>${formHTML(SETTINGS_FIELDS, S)}
      <h2 style="margin-top:1.5rem">Preise, Fristen & Texte</h2>${formHTML(RATE_FIELDS, S)}
      <div class="toolbar" style="margin-top:1rem"><button class="btn btn-primary">Speichern</button></div></form>
    <div class="grid grid-2">
      <div class="card"><h2>Datensicherung</h2><p class="muted">Sichern Sie Ihre Daten regelmäßig. Die Sicherung enthält alle Kunden, Geräte, Aufträge, Belege und Einstellungen (ohne Passwort).</p>
        <div class="toolbar"><a class="btn btn-primary" href="/api/export">Sicherung herunterladen (JSON)</a><label class="btn" style="margin:0;font-weight:500">Sicherung einspielen<input type="file" id="imp" accept=".json,application/json" hidden></label></div>
        <h3>CSV-Export (Excel)</h3><div class="toolbar">${['customers:Kunden', 'devices:Geräte', 'orders:Aufträge', 'documents:Belege', 'articles:Artikel', 'activities:Kontakte'].map((s) => { const [k, l] = s.split(':'); return `<a class="btn btn-sm" href="/api/csv/${k}">${l}</a>`; }).join('')}</div></div>
      <form id="pf" class="card"><h2>Passwort ändern</h2>${formHTML([{ name: 'old_password', label: 'Aktuelles Passwort', type: 'password', required: true, span: 12 }, { name: 'new_password', label: 'Neues Passwort (min. 8 Zeichen)', type: 'password', required: true, span: 12 }])}
        <div class="toolbar" style="margin-top:1rem"><button class="btn">Passwort ändern</button></div></form></div>`;
  $('#sf').onsubmit = async (e) => {
    e.preventDefault();
    try { const data = readForm(e.target, [...SETTINGS_FIELDS, ...RATE_FIELDS]); for (const k in data) if (data[k] == null) data[k] = ''; S = await api('PUT', '/settings', data); applyBranding(); toast('Einstellungen gespeichert'); } catch (err) { fail(err); }
  };
  $('#pf').onsubmit = async (e) => {
    e.preventDefault(); if (!e.target.reportValidity()) return;
    try { await api('POST', '/auth/password', { old_password: e.target.old_password.value, new_password: e.target.new_password.value }); e.target.reset(); toast('Passwort geändert'); } catch (err) { fail(err); }
  };
  $('#imp').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (!confirm('ACHTUNG: Alle aktuellen Daten werden durch die Sicherung ersetzt. Fortfahren?')) return;
    try { await api('POST', '/import', JSON.parse(await file.text())); customersCache = null; S = await api('GET', '/settings'); toast('Sicherung eingespielt'); location.hash = '#/'; } catch (err) { fail(err); }
  };
}

// ============================================================== Druckansichten
function sheetHeader(cust) {
  return `<div class="head"><div><div class="sender-line">${esc([S.company_name, S.street, [S.zip, S.city].join(' ')].filter(Boolean).join(' · '))}</div>
      <div class="addr">${esc(cust.company)}<br>${cust.contact_person ? esc(cust.contact_person) + '<br>' : ''}${esc(cust.street || '')}<br>${esc([cust.zip, cust.city].filter(Boolean).join(' '))}</div></div>
    <div class="logo"><img src="icon.svg" width="48" height="48" alt=""><strong>${esc(S.company_name)}</strong>${esc(S.owner || '')}<br>${esc(S.street || '')}<br>${esc([S.zip, S.city].join(' '))}<br>${S.phone ? 'Tel. ' + esc(S.phone) + '<br>' : ''}${esc(S.email || '')}<br>${esc(S.website || '')}</div></div>`;
}
const sheetFooter = () => `<div class="foot"><div><strong>${esc(S.company_name)}</strong><br>Inhaber: ${esc(S.owner || '')}<br>${esc(S.street || '')}, ${esc([S.zip, S.city].join(' '))}</div>
  <div>Tel. ${esc(S.phone || '')}<br>${esc(S.email || '')}<br>Steuernr.: ${esc(S.tax_number || '')}${S.vat_id ? '<br>USt-IdNr.: ' + esc(S.vat_id) : ''}</div>
  <div>${esc(S.bank_name || '')}<br>IBAN: ${esc(S.iban || '')}<br>BIC: ${esc(S.bic || '')}</div></div>`;
const printBar = (back) => `<div class="print-bar"><button class="btn btn-primary" onclick="window.print()">🖨 Drucken / als PDF speichern</button><a class="btn" href="${back}">Zurück</a></div>`;

async function printDocument([id], q) {
  const d = await api('GET', `/documents/${id}`);
  const isInv = d.kind === 'rechnung'; const storno = d.number.startsWith('ST-');
  const dun = q.mahnung && d.reminder_level;
  const title = dun ? (d.reminder_level === 1 ? 'Zahlungserinnerung' : `${d.reminder_level}. Mahnung`) : storno ? 'Stornorechnung' : isInv ? 'Rechnung' : 'Angebot';
  view().innerHTML = printBar(`#/belege/${d.id}`) + `<div class="sheet">${sheetHeader(d)}
    <div class="meta"><h1>${title}</h1><table><tbody>
      <tr><td>${isInv ? 'Rechnungsnr.' : 'Angebotsnr.'}</td><td><strong>${esc(d.number)}</strong></td></tr>
      <tr><td>Datum</td><td>${fmtD(dun ? todayISO() : d.date)}</td></tr>${dun ? `<tr><td>Rechnungsdatum</td><td>${fmtD(d.date)}</td></tr>` : ''}
      <tr><td>Kundennr.</td><td>${esc(d.customer_number)}</td></tr>${d.customer_vat_id ? `<tr><td>USt-IdNr. Kunde</td><td>${esc(d.customer_vat_id)}</td></tr>` : ''}
      ${isInv && !storno ? `<tr><td>Leistungsdatum</td><td>${fmtD(d.service_date || d.date)}</td></tr>` : ''}</tbody></table></div>
    ${d.subject ? `<p><strong>${esc(d.subject)}</strong></p>` : ''}
    <p>Sehr geehrte Damen und Herren,</p>
    ${dun ? `<p>sicher ist es Ihrer Aufmerksamkeit entgangen, dass die folgende Rechnung vom ${fmtD(d.date)}, fällig am ${fmtD(d.due_date)}, noch offen ist. Wir bitten um Ausgleich des Betrags von <strong>${eur(d.gross)}</strong> bis zum <strong>${fmtD(addDays(todayISO(), 7))}</strong>. Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.</p>` : d.intro ? `<p>${nl2br(d.intro)}</p>` : ''}
    <table class="pos"><thead><tr><th>Pos.</th><th>Beschreibung</th><th class="num">Menge</th><th>Einh.</th><th class="num">Einzelpreis</th><th class="num">Gesamt</th></tr></thead><tbody>
      ${d.items.map((it, i) => `<tr><td>${i + 1}</td><td>${nl2br(it.description)}</td><td class="num">${num(it.qty)}</td><td>${esc(it.unit)}</td><td class="num">${eur(it.price)}</td><td class="num">${eur(round2(it.qty * it.price))}</td></tr>`).join('')}</tbody></table>
    <table class="totals"><tbody><tr><td>Summe netto</td><td class="num">${eur(d.net)}</td></tr>
      ${d.tax_rate ? `<tr><td>zzgl. ${num(d.tax_rate)} % USt.</td><td class="num">${eur(d.tax)}</td></tr>` : ''}
      <tr class="grand"><td>${isInv ? 'Rechnungsbetrag' : 'Angebotssumme'}</td><td class="num">${eur(d.gross)}</td></tr></tbody></table>
    ${!d.tax_rate && S.small_business === '1' ? '<p><small>Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.</small></p>' : ''}
    ${isInv && !storno && !dun ? `<p>Zahlbar bis <strong>${fmtD(d.due_date)}</strong> ohne Abzug auf das unten angegebene Konto, Verwendungszweck: ${esc(d.number)}.</p>` : ''}
    ${!isInv && d.valid_until ? `<p>Dieses Angebot ist gültig bis ${fmtD(d.valid_until)}.</p>` : ''}
    ${d.footer && !dun ? `<p>${nl2br(d.footer)}</p>` : ''}<p>Mit freundlichen Grüßen<br><br>${esc(S.owner || S.company_name)}</p>
    ${sheetFooter()}</div>`;
}

async function printProtocol([id]) {
  const o = await api('GET', `/orders/${id}`);
  const dev = o.device_id ? await api('GET', `/devices/${o.device_id}`) : null;
  const isInsp = o.type === 'UVV-Prüfung';
  const date = (o.completed_at || o.scheduled_at || todayISO()).slice(0, 10);
  const stateTxt = { ok: '✔ i.O.', bad: '✘ n.i.O.', na: 'n.z.', '': '–' };
  view().innerHTML = printBar(`#/auftraege/${o.id}`) + `<div class="sheet">
    <div class="head"><div><h1 style="font-size:15pt">${isInsp ? 'Prüfprotokoll Flurförderzeug' : 'Arbeits-/Servicebericht'}</h1>
      <div>${isInsp ? 'Wiederkehrende Prüfung gem. DGUV Vorschrift 68 § 37, BetrSichV §§ 3, 14' : esc(o.type)}</div>
      <div style="margin-top:2mm">Auftrag <strong>${esc(o.number)}</strong> · Datum <strong>${fmtD(date)}</strong></div></div>
      <div class="logo"><img src="icon.svg" width="40" height="40" alt=""><strong>${esc(S.company_name)}</strong>${esc(S.street || '')}, ${esc([S.zip, S.city].join(' '))}<br>${esc(S.phone || '')}</div></div>
    <div class="grid grid-2" style="margin:6mm 0;gap:6mm">
      <div><strong>Betreiber</strong><br>${esc(o.company)}<br>${esc(o.street || '')}<br>${esc([o.zip, o.city].filter(Boolean).join(' '))}</div>
      <div><strong>Gerät</strong>${dev ? `<br>${esc(dev.kind)} · ${esc([dev.manufacturer, dev.model].filter(Boolean).join(' '))}<br>Seriennr.: ${esc(dev.serial || '–')} · Baujahr: ${esc(dev.year || '–')}<br>Tragfähigkeit: ${dev.capacity_kg ? num(dev.capacity_kg, 0) + ' kg' : '–'} · Standort: ${esc(dev.location || '–')}<br>Geräte-Nr.: ${esc(dev.number)}` : '<br>–'}</div></div>
    ${o.description ? `<p><strong>Auftrag:</strong> ${nl2br(o.description)}</p>` : ''}
    ${Array.isArray(o.checklist) && o.checklist.length ? `<table class="pos checklist"><thead><tr><th>Baugruppe</th><th>Prüfpunkt</th><th>Ergebnis</th><th>Bemerkung</th></tr></thead><tbody>
      ${o.checklist.map((c) => `<tr><td>${esc(c.group)}</td><td>${esc(c.label)}</td><td style="white-space:nowrap;font-weight:600;color:${c.state === 'bad' ? '#b42318' : '#111'}">${stateTxt[c.state || '']}</td><td>${esc(c.note || '')}</td></tr>`).join('')}</tbody></table>
      <p><small>i.O. = in Ordnung · n.i.O. = nicht in Ordnung · n.z. = nicht zutreffend</small></p>` : ''}
    ${o.findings ? `<p><strong>Befund / durchgeführte Arbeiten:</strong><br>${nl2br(o.findings)}</p>` : ''}
    ${o.items.length ? `<p><strong>Verwendetes Material:</strong> ${o.items.map((i) => `${num(i.qty)} ${esc(i.unit)} ${esc(i.description)}`).join('; ')}</p>` : ''}
    ${o.work_hours ? `<p><strong>Arbeitszeit:</strong> ${num(o.work_hours)} Std.${o.travel_km ? ` · Anfahrt ${num(o.travel_km, 0)} km` : ''}</p>` : ''}
    ${isInsp ? `<div class="result-box">Prüfergebnis: ${esc(o.result || '–')}${o.result && o.result.includes('nicht betriebssicher') ? '<br>Das Gerät darf bis zur Mängelbeseitigung nicht weiter betrieben werden.' : ''}</div>
      <div style="display:flex;gap:8mm;align-items:center">${dev && !(o.result || '').includes('nicht betriebssicher') ? `<div class="plakette"><small>Nächste Prüfung</small><span class="y">${esc((dev.next_inspection || '').slice(5, 7))}/${esc((dev.next_inspection || '').slice(0, 4))}</span><small>${esc(S.company_name)}</small></div>` : ''}
      <p>Die Prüfung wurde durch eine befähigte Person im Sinne der BetrSichV / TRBS 1203 durchgeführt.${dev?.next_inspection ? ` Nächste wiederkehrende Prüfung spätestens: <strong>${fmtD(dev.next_inspection)}</strong>.` : ''}</p></div>` : o.result ? `<div class="result-box">Ergebnis: ${esc(o.result)}</div>` : ''}
    <div class="sig"><div>Datum, Unterschrift befähigte Person<br>${esc(S.owner || '')}</div><div>Datum, Unterschrift Betreiber${o.signed_by ? '<br>' + esc(o.signed_by) : ''}</div></div>
    ${sheetFooter()}</div>`;
}

// ============================================================== Login
function showLogin(setup) {
  $('#app').style.display = 'none'; $('#modal-root').innerHTML = '';
  let el = $('#login'); if (!el) { el = document.createElement('div'); el.id = 'login'; document.body.appendChild(el); }
  el.innerHTML = `<div class="login"><form class="card" novalidate><div class="brand"><img src="icon.svg" width="40" height="40" alt=""><div><strong>Hubwagen-ERP</strong><small>Service · Prüfung · Wartung</small></div></div>
    ${setup ? `<p>Willkommen! Bitte richten Sie Ihren Zugang ein.</p>${formHTML([{ name: 'company_name', label: 'Firmenname', span: 12 }, { name: 'owner', label: 'Ihr Name', span: 12 }, { name: 'password', label: 'Passwort (min. 8 Zeichen)', type: 'password', required: true, span: 12 }, { name: 'password2', label: 'Passwort wiederholen', type: 'password', required: true, span: 12 }])}`
      : formHTML([{ name: 'password', label: 'Passwort', type: 'password', required: true, span: 12 }])}
    <div id="lerr"></div><button class="btn btn-primary" style="width:100%;justify-content:center">${setup ? 'Einrichten & starten' : 'Anmelden'}</button></form></div>`;
  const f = $('form', el); setTimeout(() => f.querySelector('input').focus(), 20);
  f.onsubmit = async (e) => {
    e.preventDefault();
    try {
      if (setup) {
        if (f.password.value !== f.password2.value) throw new Error('Passwörter stimmen nicht überein');
        await api('POST', '/auth/setup', { password: f.password.value, company_name: f.company_name.value, owner: f.owner.value });
      } else await api('POST', '/auth/login', { password: f.password.value });
      el.remove(); $('#app').style.display = ''; await start();
    } catch (err) { $('#lerr').innerHTML = `<div class="notice bad">${esc(err.message)}</div>`; }
  };
}

// ============================================================== Router
const ROUTES = [
  [/^\/?$/, pageDashboard, 'dashboard'],
  [/^\/kunden$/, pageCustomers, 'kunden'],
  [/^\/kunden\/(\d+)(?:\/(\w+))?$/, pageCustomer, 'kunden'],
  [/^\/geraete$/, pageDevices, 'geraete'],
  [/^\/geraete\/(\d+)$/, pageDevice, 'geraete'],
  [/^\/auftraege$/, pageOrders, 'auftraege'],
  [/^\/auftraege\/(\d+|neu)$/, pageOrder, 'auftraege'],
  [/^\/kalender$/, pageCalendar, 'kalender'],
  [/^\/angebote$/, (p, q) => pageDocuments('angebot', q), 'angebote'],
  [/^\/rechnungen$/, (p, q) => pageDocuments('rechnung', q), 'rechnungen'],
  [/^\/angebote\/neu$/, (p, q) => pageDocument(p, q, 'angebot'), 'angebote'],
  [/^\/rechnungen\/neu$/, (p, q) => pageDocument(p, q, 'rechnung'), 'rechnungen'],
  [/^\/belege\/(\d+)$/, (p, q) => pageDocument(p, q), 'rechnungen'],
  [/^\/artikel$/, pageArticles, 'artikel'],
  [/^\/crm$/, pageCRM, 'crm'],
  [/^\/suche$/, pageSearch, ''],
  [/^\/einstellungen$/, pageSettings, 'einstellungen'],
  [/^\/druck\/beleg\/(\d+)$/, printDocument, ''],
  [/^\/druck\/protokoll\/(\d+)$/, printProtocol, 'auftraege'],
];
async function route() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  const q = Object.fromEntries(new URLSearchParams(query));
  $('#sidebar').classList.remove('open');
  for (const [re, fn, nav] of ROUTES) {
    const m = re.exec(path);
    if (!m) continue;
    $$('#nav a[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === nav));
    try { await fn(m.slice(1), q); } catch (e) { if (e.message !== 'Nicht angemeldet') view().innerHTML = `<div class="notice bad">${esc(e.message)}</div>`; }
    window.scrollTo(0, 0);
    return;
  }
  view().innerHTML = '<div class="empty">Seite nicht gefunden. <a href="#/">Zur Übersicht</a></div>';
}
function applyBranding() { $('#brand-name').textContent = S.company_name || 'Hubwagen-ERP'; document.title = `${S.company_name || 'Hubwagen-ERP'} – ERP/CRM`; }
async function start() { S = await api('GET', '/settings'); applyBranding(); await route(); }

window.addEventListener('hashchange', route);
$('#menu-btn').onclick = () => $('#sidebar').classList.toggle('open');
$('#logout').onclick = async (e) => { e.preventDefault(); await api('POST', '/auth/logout').catch(() => {}); showLogin(false); };
$('#global-search').onsubmit = (e) => { e.preventDefault(); const v = $('#global-q').value.trim(); if (v) location.hash = '#/suche?q=' + encodeURIComponent(v); };
(async () => {
  const st = await api('GET', '/auth/status');
  if (st.setup) return showLogin(true);
  if (!st.loggedIn) return showLogin(false);
  start();
})();
