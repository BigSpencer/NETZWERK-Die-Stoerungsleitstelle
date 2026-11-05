'use strict';
// HTTP-Anwendung: REST-API + Auslieferung der Single-Page-App aus /public.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { open, tx } = require('./db');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
};
const SESSION_DAYS = 14;

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

// ---------------------------------------------------------------- Hilfsfunktionen
const today = () => new Date().toLocaleDateString('sv-SE'); // lokales Datum YYYY-MM-DD
function addDays(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function addMonths(iso, n) {
  const d = new Date(iso.slice(0, 10) + 'T12:00:00Z'); const day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last)); return d.toISOString().slice(0, 10);
}
const round2 = (n) => { const v = Number(n) || 0; return (Math.sign(v) * Math.round((Math.abs(v) + Number.EPSILON) * 100)) / 100; }; // kaufmännisch, symmetrisch

function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(pw, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(String(pw), salt, 64);
  const ref = Buffer.from(hash, 'hex');
  return ref.length === test.length && crypto.timingSafeEqual(ref, test);
}

// ---------------------------------------------------------------- Ressourcen-Definitionen
// Spaltenwhitelist pro Tabelle – nur diese Felder dürfen per API geschrieben werden.
const RES = {
  customers: {
    table: 'customers', prefix: 'K', yearly: false,
    cols: ['number', 'type', 'company', 'contact_person', 'email', 'phone', 'mobile', 'street', 'zip', 'city', 'vat_id', 'payment_days', 'source', 'notes'],
    required: ['company'],
    search: ['c.number', 'c.company', 'c.contact_person', 'c.city', 'c.email', 'c.phone'],
    filters: { type: 'c.type' },
    list: `SELECT c.*,
             (SELECT COUNT(*) FROM devices d WHERE d.customer_id = c.id AND d.status != 'stillgelegt') AS device_count,
             (SELECT MIN(d.next_inspection) FROM devices d WHERE d.customer_id = c.id AND d.status != 'stillgelegt') AS next_inspection,
             (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id AND o.status IN ('geplant','in Arbeit')) AS open_orders
           FROM customers c`,
    order: 'c.company COLLATE NOCASE',
  },
  activities: {
    table: 'activities',
    cols: ['customer_id', 'date', 'kind', 'subject', 'text', 'followup_date', 'done'],
    required: ['customer_id', 'date'],
    search: ['a.subject', 'a.text', 'c.company'],
    filters: { customer_id: 'a.customer_id', done: 'a.done', kind: 'a.kind' },
    list: `SELECT a.*, c.company FROM activities a JOIN customers c ON c.id = a.customer_id`,
    order: 'a.date DESC, a.id DESC',
  },
  devices: {
    table: 'devices', prefix: 'G', yearly: false,
    cols: ['customer_id', 'number', 'kind', 'manufacturer', 'model', 'serial', 'year', 'capacity_kg', 'location', 'interval_months', 'last_inspection', 'next_inspection', 'last_result', 'status', 'notes'],
    required: ['customer_id'],
    search: ['d.number', 'd.manufacturer', 'd.model', 'd.serial', 'd.location', 'c.company'],
    filters: { customer_id: 'd.customer_id', status: 'd.status', kind: 'd.kind' },
    list: `SELECT d.*, c.company, c.city FROM devices d JOIN customers c ON c.id = d.customer_id`,
    order: "COALESCE(d.next_inspection, '9999') , d.id",
  },
  articles: {
    table: 'articles', prefix: 'ART', yearly: false,
    cols: ['number', 'kind', 'name', 'unit', 'price', 'cost', 'stock', 'min_stock', 'supplier', 'notes'],
    required: ['name'],
    search: ['a.number', 'a.name', 'a.supplier'],
    filters: { kind: 'a.kind' },
    list: `SELECT a.* FROM articles a`,
    order: 'a.kind DESC, a.name COLLATE NOCASE',
  },
  orders: {
    table: 'orders', prefix: 'A', yearly: true, items: 'order_items', fk: 'order_id',
    cols: ['number', 'customer_id', 'device_id', 'type', 'status', 'scheduled_at', 'duration_min', 'description', 'findings', 'result', 'checklist', 'work_hours', 'travel_km', 'signed_by', 'completed_at'],
    required: ['customer_id'],
    search: ['o.number', 'o.description', 'c.company', 'd.serial', 'd.model'],
    filters: { customer_id: 'o.customer_id', device_id: 'o.device_id', status: 'o.status', type: 'o.type' },
    list: `SELECT o.*, c.company, c.city, c.street, c.zip, d.number AS device_number, d.kind AS device_kind,
             d.manufacturer, d.model, d.serial, inv.number AS invoice_number
           FROM orders o JOIN customers c ON c.id = o.customer_id
           LEFT JOIN devices d ON d.id = o.device_id
           LEFT JOIN documents inv ON inv.id = o.invoice_id`,
    order: "CASE WHEN o.status IN ('geplant','in Arbeit') THEN 0 ELSE 1 END, o.scheduled_at DESC, o.id DESC",
  },
  documents: {
    table: 'documents', items: 'document_items', fk: 'document_id',
    cols: ['kind', 'number', 'customer_id', 'order_id', 'date', 'service_date', 'due_date', 'valid_until', 'status', 'subject', 'intro', 'footer', 'tax_rate', 'paid_at', 'reminder_level'],
    required: ['kind', 'customer_id'],
    search: ['x.number', 'x.subject', 'c.company'],
    filters: { customer_id: 'x.customer_id', kind: 'x.kind', status: 'x.status', order_id: 'x.order_id' },
    list: `SELECT x.*, c.company, c.contact_person, c.street, c.zip, c.city, c.number AS customer_number, c.vat_id AS customer_vat_id,
             COALESCE((SELECT SUM(ROUND(i.qty * i.price, 2)) FROM document_items i WHERE i.document_id = x.id), 0) AS net
           FROM documents x JOIN customers c ON c.id = x.customer_id`,
    order: 'x.date DESC, x.id DESC',
  },
};
const ALIAS = { customers: 'c', activities: 'a', devices: 'd', articles: 'a', orders: 'o', documents: 'x' };
const ITEM_COLS = ['article_id', 'pos', 'description', 'qty', 'unit', 'price'];

// ---------------------------------------------------------------- Anwendung
function createApp(dbFile) {
  const db = open(dbFile);

  const getSetting = (k) => db.prepare('SELECT value FROM settings WHERE key = ?').get(k)?.value;
  const allSettings = () => Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]));
  const setSetting = (k, v) => db.prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, v == null ? '' : String(v));

  function nextNumber(prefix, yearly) {
    const year = new Date().getFullYear();
    const key = yearly ? `counter_${prefix}_${year}` : `counter_${prefix}`;
    const n = Number(getSetting(key) || (yearly ? 0 : 1000)) + 1;
    setSetting(key, n);
    return yearly ? `${prefix}-${year}-${String(n).padStart(4, '0')}` : `${prefix}-${n}`;
  }
  const docPrefix = (kind) => (kind === 'rechnung' ? 'RE' : kind === 'angebot' ? 'AN' : kind === 'storno' ? 'ST' : null);

  function pick(def, body) {
    const out = {};
    for (const c of def.cols) if (Object.prototype.hasOwnProperty.call(body, c)) {
      let v = body[c];
      if (v === '' ) v = null;
      if (c === 'checklist' && v != null && typeof v !== 'string') v = JSON.stringify(v);
      if (typeof v === 'boolean') v = v ? 1 : 0;
      out[c] = v;
    }
    return out;
  }

  function list(name, query) {
    const def = RES[name]; const al = ALIAS[name];
    const where = []; const args = [];
    if (query.q) {
      where.push('(' + def.search.map((s) => `${s} LIKE ?`).join(' OR ') + ')');
      def.search.forEach(() => args.push(`%${query.q}%`));
    }
    for (const [param, col] of Object.entries(def.filters || {})) {
      if (query[param] !== undefined && query[param] !== '') {
        const vals = String(query[param]).split(',');
        where.push(`${col} IN (${vals.map(() => '?').join(',')})`); args.push(...vals);
      }
    }
    if (name === 'devices' && query.due) { // fällig innerhalb von X Tagen (inkl. überfällig)
      where.push("d.status != 'stillgelegt' AND d.next_inspection IS NOT NULL AND d.next_inspection <= ?");
      args.push(addDays(today(), Number(query.due) || 0));
    }
    if (name === 'orders' && query.from) { where.push('o.scheduled_at >= ?'); args.push(query.from); }
    if (name === 'orders' && query.to) { where.push('o.scheduled_at < ?'); args.push(query.to); }
    if (name === 'documents' && query.overdue) {
      where.push("x.kind = 'rechnung' AND x.status = 'offen' AND x.due_date < ?"); args.push(today());
    }
    const limit = Math.min(Number(query.limit) || 500, 2000);
    const sql = `${def.list}${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY ${def.order} LIMIT ${limit}`;
    const rows = db.prepare(sql).all(...args);
    if (name === 'documents') rows.forEach(addTotals);
    return rows.map((r) => ({ ...r }));
  }

  function addTotals(doc) {
    doc.net = round2(doc.net);
    doc.tax = round2(doc.net * (Number(doc.tax_rate) || 0) / 100);
    doc.gross = round2(doc.net + doc.tax);
    return doc;
  }

  function get(name, id) {
    const def = RES[name]; const al = ALIAS[name];
    const row = db.prepare(`${def.list} WHERE ${al}.id = ?`).get(id);
    if (!row) throw new HttpError(404, 'Datensatz nicht gefunden');
    const out = { ...row };
    if (def.items) out.items = db.prepare(`SELECT * FROM ${def.items} WHERE ${def.fk} = ? ORDER BY pos, id`).all(id).map((r) => ({ ...r }));
    if (name === 'documents') addTotals(out);
    if (name === 'orders' && out.checklist) { try { out.checklist = JSON.parse(out.checklist); } catch { out.checklist = null; } }
    return out;
  }

  function saveItems(def, id, items) {
    if (!def.items || !Array.isArray(items)) return;
    db.prepare(`DELETE FROM ${def.items} WHERE ${def.fk} = ?`).run(id);
    const ins = db.prepare(`INSERT INTO ${def.items} (${def.fk}, ${ITEM_COLS.join(',')}) VALUES (?, ${ITEM_COLS.map(() => '?').join(',')})`);
    items.forEach((it, i) => {
      if (!it || !String(it.description || '').trim()) return;
      ins.run(id, it.article_id || null, i + 1, String(it.description), Number(it.qty) || 0, it.unit || 'Stk', round2(Number(it.price) || 0));
    });
  }

  function insertRow(table, data) {
    const keys = Object.keys(data);
    const r = db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map((k) => data[k]));
    return Number(r.lastInsertRowid);
  }
  function updateRow(table, id, data) {
    const keys = Object.keys(data); if (!keys.length) return;
    db.prepare(`UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => data[k]), id);
  }

  function create(name, body) {
    const def = RES[name]; const data = pick(def, body);
    for (const r of def.required) if (data[r] == null || data[r] === '') throw new HttpError(400, `Pflichtfeld fehlt: ${r}`);
    return tx(db, () => {
      if (name === 'documents') {
        if (!['angebot', 'rechnung'].includes(data.kind)) throw new HttpError(400, 'Ungültige Belegart');
        const s = allSettings();
        data.date = data.date || today();
        data.number = data.number || nextNumber(docPrefix(data.kind), true);
        if (data.tax_rate == null) data.tax_rate = s.small_business === '1' ? 0 : Number(s.tax_rate);
        if (data.kind === 'rechnung' && !data.due_date) {
          const cust = db.prepare('SELECT payment_days FROM customers WHERE id = ?').get(data.customer_id);
          data.due_date = addDays(data.date, Number(cust?.payment_days || s.payment_days || 14));
        }
        if (data.kind === 'angebot' && !data.valid_until) data.valid_until = addDays(data.date, Number(s.offer_valid_days || 30));
        if (data.footer == null) data.footer = data.kind === 'rechnung' ? s.invoice_footer : s.offer_footer;
      } else if (def.prefix && !data.number) {
        data.number = nextNumber(def.prefix, def.yearly);
      }
      if (name === 'devices') {
        if (data.interval_months == null) data.interval_months = Number(getSetting('default_interval_months') || 12);
        if (data.last_inspection && !data.next_inspection) data.next_inspection = addMonths(data.last_inspection, data.interval_months);
      }
      if (name === 'activities' && data.done == null) data.done = 0;
      const id = insertRow(def.table, data);
      saveItems(def, id, body.items);
      if (name === 'orders') afterOrderSave(id, null);
      return get(name, id);
    });
  }

  function update(name, id, body) {
    const def = RES[name];
    const before = get(name, id);
    let data = pick(def, body);
    return tx(db, () => {
      if (name === 'documents' && before.kind === 'rechnung' && before.status !== 'Entwurf') {
        // GoBD: festgeschriebene Rechnungen dürfen inhaltlich nicht mehr geändert werden.
        const allowed = ['status', 'paid_at', 'reminder_level'];
        const changed = Object.keys(data).filter((k) => !allowed.includes(k) && String(data[k] ?? '') !== String(before[k] ?? ''));
        if (changed.length || (Array.isArray(body.items) && itemsChanged(before.items, body.items)))
          throw new HttpError(409, 'Rechnung ist festgeschrieben und kann nicht mehr geändert werden. Bitte stornieren und neu erstellen.');
        data = Object.fromEntries(Object.entries(data).filter(([k]) => allowed.includes(k)));
        if (data.status === 'Entwurf') throw new HttpError(409, 'Festgeschriebene Rechnung kann nicht zurück in den Entwurf.');
        if (data.status === 'bezahlt' && !data.paid_at && !before.paid_at) data.paid_at = today();
        updateRow(def.table, id, data);
        return get(name, id);
      }
      if (name === 'documents' && data.status === 'bezahlt' && !data.paid_at) data.paid_at = today();
      if (name === 'devices' && ('last_inspection' in data || 'interval_months' in data) && !('next_inspection' in body)) {
        const last = data.last_inspection ?? before.last_inspection;
        const iv = data.interval_months ?? before.interval_months;
        if (last) data.next_inspection = addMonths(last, iv);
      }
      updateRow(def.table, id, data);
      saveItems(def, id, body.items);
      if (name === 'orders') afterOrderSave(id, before);
      return get(name, id);
    });
  }

  function itemsChanged(a, b) {
    const norm = (arr) => JSON.stringify((arr || []).filter((i) => String(i.description || '').trim())
      .map((i) => [String(i.description), Number(i.qty) || 0, i.unit || 'Stk', round2(Number(i.price) || 0)]));
    return norm(a) !== norm(b);
  }

  // Wenn ein Prüf-/Wartungsauftrag erledigt wird, Prüfdatum am Gerät fortschreiben + Lagerbestand buchen.
  function afterOrderSave(id, before) {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    const doneNow = ['erledigt', 'abgerechnet'].includes(o.status);
    const wasDone = before && ['erledigt', 'abgerechnet'].includes(before.status);
    if (doneNow && !o.completed_at) {
      db.prepare('UPDATE orders SET completed_at = ? WHERE id = ?').run((o.scheduled_at || today()).slice(0, 10), id);
      o.completed_at = (o.scheduled_at || today()).slice(0, 10);
    }
    if (doneNow && !wasDone) {
      if (o.device_id && ['UVV-Prüfung', 'Wartung'].includes(o.type)) {
        const dev = db.prepare('SELECT * FROM devices WHERE id = ?').get(o.device_id);
        if (dev) {
          const date = o.completed_at.slice(0, 10);
          const blocked = o.result && o.result.includes('nicht betriebssicher');
          if (o.type === 'UVV-Prüfung') {
            db.prepare('UPDATE devices SET last_inspection = ?, next_inspection = ?, last_result = ?, status = ? WHERE id = ?')
              .run(date, addMonths(date, dev.interval_months || 12), o.result || 'ohne Mängel', blocked ? 'gesperrt' : (dev.status === 'gesperrt' ? 'aktiv' : dev.status), dev.id);
          } else if (blocked) {
            db.prepare("UPDATE devices SET status = 'gesperrt', last_result = ? WHERE id = ?").run(o.result, dev.id);
          }
        }
      }
      // Ersatzteile vom Lager abbuchen
      const items = db.prepare('SELECT article_id, qty FROM order_items WHERE order_id = ? AND article_id IS NOT NULL').all(id);
      const upd = db.prepare("UPDATE articles SET stock = COALESCE(stock,0) - ? WHERE id = ? AND kind = 'Ersatzteil'");
      for (const it of items) upd.run(it.qty, it.article_id);
    } else if (!doneNow && wasDone) {
      // Rückbuchung, falls der Auftrag wieder geöffnet wird
      const items = db.prepare('SELECT article_id, qty FROM order_items WHERE order_id = ? AND article_id IS NOT NULL').all(id);
      const upd = db.prepare("UPDATE articles SET stock = COALESCE(stock,0) + ? WHERE id = ? AND kind = 'Ersatzteil'");
      for (const it of items) upd.run(it.qty, it.article_id);
      db.prepare('UPDATE orders SET completed_at = NULL WHERE id = ?').run(id);
    }
  }

  function remove(name, id) {
    const def = RES[name];
    const before = get(name, id);
    if (name === 'documents' && before.kind === 'rechnung' && before.status !== 'Entwurf')
      throw new HttpError(409, 'Festgeschriebene Rechnungen können nicht gelöscht werden (GoBD). Bitte stornieren.');
    if (name === 'customers') {
      const n = db.prepare('SELECT COUNT(*) n FROM documents WHERE customer_id = ?').get(id).n;
      if (n) throw new HttpError(409, `Kunde hat ${n} Beleg(e) und kann nicht gelöscht werden. Setzen Sie ihn stattdessen auf „Inaktiv“.`);
    }
    tx(db, () => {
      if (name === 'documents') db.prepare('UPDATE orders SET invoice_id = NULL, status = CASE WHEN status = \'abgerechnet\' THEN \'erledigt\' ELSE status END WHERE invoice_id = ?').run(id);
      db.prepare(`DELETE FROM ${def.table} WHERE id = ?`).run(id);
    });
    return { ok: true };
  }

  // Auftrag -> Rechnung
  function invoiceFromOrder(id) {
    const o = get('orders', id);
    if (o.invoice_id) throw new HttpError(409, `Auftrag wurde bereits abgerechnet (${o.invoice_number}).`);
    const s = allSettings();
    const items = [];
    const devLabel = [o.device_kind, o.manufacturer, o.model, o.serial ? `SN ${o.serial}` : null].filter(Boolean).join(' ');
    for (const it of o.items) items.push({ article_id: it.article_id, description: it.description, qty: it.qty, unit: it.unit, price: it.price });
    if (Number(o.work_hours) > 0) items.push({ description: `Arbeitszeit ${o.type}${devLabel ? ' – ' + devLabel : ''}`, qty: o.work_hours, unit: 'Std', price: Number(s.hourly_rate) });
    if (Number(o.travel_km) > 0) items.push({ description: 'Anfahrt', qty: o.travel_km, unit: 'km', price: Number(s.km_rate) });
    else if (Number(s.travel_flat) > 0) items.push({ description: 'Anfahrtspauschale', qty: 1, unit: 'psch', price: Number(s.travel_flat) });
    const date = (o.completed_at || o.scheduled_at || today()).slice(0, 10);
    const doc = create('documents', {
      kind: 'rechnung', customer_id: o.customer_id, order_id: o.id, status: 'Entwurf', service_date: date,
      subject: `${o.type} ${o.number}`,
      intro: `Für die am ${date.split('-').reverse().join('.')} durchgeführten Arbeiten (${o.type}${devLabel ? ', ' + devLabel : ''}) erlauben wir uns, wie folgt zu berechnen:`,
      items,
    });
    db.prepare("UPDATE orders SET invoice_id = ?, status = 'abgerechnet', completed_at = COALESCE(completed_at, ?) WHERE id = ?").run(doc.id, date, o.id);
    if (!['erledigt', 'abgerechnet'].includes(o.status)) afterOrderSave(o.id, o);
    return doc;
  }

  // Angebot -> Rechnung bzw. Rechnung stornieren
  function convertDocument(id, target) {
    const d = get('documents', id);
    if (target === 'rechnung') {
      if (d.kind !== 'angebot') throw new HttpError(400, 'Nur Angebote können in Rechnungen umgewandelt werden');
      const inv = create('documents', { kind: 'rechnung', customer_id: d.customer_id, order_id: d.order_id, subject: d.subject, intro: `Gemäß unserem Angebot ${d.number} vom ${d.date.split('-').reverse().join('.')} berechnen wir:`, items: d.items });
      db.prepare('UPDATE documents SET source_id = ? WHERE id = ?').run(d.id, inv.id);
      db.prepare("UPDATE documents SET status = 'angenommen' WHERE id = ?").run(d.id);
      return get('documents', inv.id);
    }
    if (target === 'storno') {
      if (d.kind !== 'rechnung' || d.status === 'Entwurf' || d.status === 'storniert') throw new HttpError(400, 'Nur festgeschriebene Rechnungen können storniert werden');
      return tx(db, () => {
        const sid = insertRow('documents', {
          kind: 'rechnung', number: nextNumber('ST', true), customer_id: d.customer_id, source_id: d.id, date: today(),
          status: 'bezahlt', paid_at: today(), tax_rate: d.tax_rate, subject: `Stornorechnung zu ${d.number}`,
          intro: `Hiermit stornieren wir die Rechnung ${d.number} vom ${d.date.split('-').reverse().join('.')} vollständig.`, footer: '',
        });
        saveItems(RES.documents, sid, d.items.map((i) => ({ ...i, qty: -i.qty })));
        db.prepare("UPDATE documents SET status = 'storniert' WHERE id = ?").run(d.id);
        db.prepare("UPDATE orders SET invoice_id = NULL, status = 'erledigt' WHERE invoice_id = ?").run(d.id);
        return get('documents', sid);
      });
    }
    if (target === 'copy') {
      return create('documents', { kind: d.kind, customer_id: d.customer_id, subject: d.subject, intro: d.intro, items: d.items });
    }
    throw new HttpError(400, 'Unbekannte Umwandlung');
  }

  function dashboard() {
    const t = today(); const s = allSettings();
    const warn = addDays(t, Number(s.reminder_days || 30));
    const year = t.slice(0, 4); const month = t.slice(0, 7);
    const revenue = (cond, ...a) => {
      const rows = db.prepare(`SELECT x.tax_rate, COALESCE((SELECT SUM(ROUND(i.qty*i.price,2)) FROM document_items i WHERE i.document_id = x.id),0) net
        FROM documents x WHERE x.kind = 'rechnung' AND x.status IN ('offen','bezahlt') AND x.number NOT LIKE 'ST-%' AND ${cond}`).all(...a);
      return round2(rows.reduce((s2, r) => s2 + r.net, 0));
    };
    const monthly = [];
    for (let m = 11; m >= 0; m--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - m);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthly.push({ month: key, net: revenue('substr(x.date,1,7) = ?', key) });
    }
    const overdueDevices = db.prepare("SELECT COUNT(*) n FROM devices WHERE status != 'stillgelegt' AND next_inspection < ?").get(t).n;
    const dueSoon = db.prepare("SELECT COUNT(*) n FROM devices WHERE status != 'stillgelegt' AND next_inspection >= ? AND next_inspection <= ?").get(t, warn).n;
    const openInv = list('documents', { kind: 'rechnung', status: 'offen' });
    return {
      kpi: {
        revenue_month: revenue("substr(x.date,1,7) = ?", month),
        revenue_year: revenue("substr(x.date,1,4) = ?", year),
        open_invoices: openInv.length,
        open_amount: round2(openInv.reduce((a, d) => a + d.gross, 0)),
        overdue_invoices: openInv.filter((d) => d.due_date && d.due_date < t).length,
        overdue_amount: round2(openInv.filter((d) => d.due_date && d.due_date < t).reduce((a, d) => a + d.gross, 0)),
        devices_overdue: overdueDevices,
        devices_due_soon: dueSoon,
        devices_total: db.prepare("SELECT COUNT(*) n FROM devices WHERE status != 'stillgelegt'").get().n,
        devices_blocked: db.prepare("SELECT COUNT(*) n FROM devices WHERE status = 'gesperrt'").get().n,
        customers: db.prepare("SELECT COUNT(*) n FROM customers WHERE type = 'Kunde'").get().n,
        leads: db.prepare("SELECT COUNT(*) n FROM customers WHERE type = 'Interessent'").get().n,
        orders_open: db.prepare("SELECT COUNT(*) n FROM orders WHERE status IN ('geplant','in Arbeit')").get().n,
        orders_to_invoice: db.prepare("SELECT COUNT(*) n FROM orders WHERE status = 'erledigt' AND invoice_id IS NULL").get().n,
      },
      monthly,
      due_devices: list('devices', { due: s.reminder_days || 30, limit: 15 }),
      upcoming_orders: db.prepare(`${RES.orders.list} WHERE o.status IN ('geplant','in Arbeit') ORDER BY o.scheduled_at LIMIT 10`).all().map((r) => ({ ...r })),
      to_invoice: db.prepare(`${RES.orders.list} WHERE o.status = 'erledigt' AND o.invoice_id IS NULL ORDER BY o.completed_at LIMIT 10`).all().map((r) => ({ ...r })),
      followups: db.prepare(`${RES.activities.list} WHERE a.done = 0 AND a.followup_date IS NOT NULL AND a.followup_date <= ? ORDER BY a.followup_date LIMIT 10`).all(warn).map((r) => ({ ...r })),
      low_stock: db.prepare("SELECT * FROM articles WHERE kind = 'Ersatzteil' AND min_stock > 0 AND stock <= min_stock ORDER BY name").all().map((r) => ({ ...r })),
      overdue_invoices: openInv.filter((d) => d.due_date && d.due_date < t),
    };
  }

  // Prüffällige Geräte eines Kunden -> Sammel-Angebot / Prüfaufträge
  function planInspections(body) {
    const ids = (body.device_ids || []).map(Number).filter(Boolean);
    if (!ids.length) throw new HttpError(400, 'Keine Geräte ausgewählt');
    const created = [];
    tx(db, () => {
      for (const did of ids) {
        const dev = db.prepare('SELECT * FROM devices WHERE id = ?').get(did);
        if (!dev) continue;
        const open = db.prepare("SELECT id FROM orders WHERE device_id = ? AND type = 'UVV-Prüfung' AND status IN ('geplant','in Arbeit')").get(did);
        if (open) continue;
        const id = insertRow('orders', {
          number: nextNumber('A', true), customer_id: dev.customer_id, device_id: did, type: 'UVV-Prüfung', status: 'geplant',
          scheduled_at: body.scheduled_at || null, duration_min: 45,
          description: `Wiederkehrende Prüfung nach DGUV Vorschrift 68 / BetrSichV – ${[dev.kind, dev.manufacturer, dev.model].filter(Boolean).join(' ')}`,
        });
        created.push(id);
      }
    });
    return { created: created.length, ids: created };
  }

  function exportAll() {
    const tables = ['settings', 'customers', 'activities', 'devices', 'articles', 'documents', 'document_items', 'orders', 'order_items'];
    const out = { app: 'hubwagen-erp', version: 1, exported_at: new Date().toISOString() };
    for (const t of tables) out[t] = db.prepare(`SELECT * FROM ${t}`).all().map((r) => ({ ...r }));
    out.settings = out.settings.filter((r) => r.key !== 'password_hash');
    return out;
  }
  function importAll(data) {
    if (!data || data.app !== 'hubwagen-erp') throw new HttpError(400, 'Keine gültige Sicherungsdatei');
    const order = ['customers', 'activities', 'devices', 'articles', 'documents', 'document_items', 'orders', 'order_items'];
    tx(db, () => {
      db.exec('PRAGMA defer_foreign_keys = ON');
      for (const t of [...order].reverse()) db.prepare(`DELETE FROM ${t}`).run();
      for (const t of order) for (const row of data[t] || []) insertRow(t, row);
      for (const r of data.settings || []) if (r.key !== 'password_hash') setSetting(r.key, r.value);
    });
    return { ok: true };
  }

  function csv(name) {
    const rows = list(name, { limit: 2000 });
    if (!rows.length) return '';
    const keys = Object.keys(rows[0]);
    const esc = (v) => { const s = v == null ? '' : String(v); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return '﻿' + [keys.join(';'), ...rows.map((r) => keys.map((k) => esc(r[k])).join(';'))].join('\r\n');
  }

  // ---------------------------------------------------------------- Auth
  function createSession() {
    const token = crypto.randomBytes(32).toString('hex');
    const exp = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
    db.prepare('INSERT INTO sessions(token, created_at, expires_at) VALUES (?, ?, ?)').run(token, new Date().toISOString(), exp);
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
    return token;
  }
  function validSession(req) {
    const m = /(?:^|;\s*)sid=([a-f0-9]{64})/.exec(req.headers.cookie || '');
    if (!m) return null;
    const s = db.prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > ?').get(m[1], new Date().toISOString());
    return s ? m[1] : null;
  }
  const cookie = (token, secure, maxAge = SESSION_DAYS * 86400) =>
    `sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;

  // ---------------------------------------------------------------- Router
  async function readBody(req) {
    const chunks = []; let size = 0;
    for await (const c of req) { size += c.length; if (size > 20 * 1024 * 1024) throw new HttpError(413, 'Anfrage zu groß'); chunks.push(c); }
    if (!chunks.length) return {};
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'Ungültiges JSON'); }
  }

  function send(res, status, data, headers = {}) {
    const body = typeof data === 'string' ? data : JSON.stringify(data);
    res.writeHead(status, { 'Content-Type': typeof data === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
    res.end(body);
  }

  function serveStatic(req, res, pathname) {
    let file = path.normalize(path.join(PUBLIC_DIR, decodeURIComponent(pathname)));
    if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, 'Verboten');
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC_DIR, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    const secure = req.headers['x-forwarded-proto'] === 'https' || !!req.socket.encrypted;
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    if (!p.startsWith('/api/')) return serveStatic(req, res, p);

    const query = Object.fromEntries(url.searchParams);
    const m = req.method;
    try {
      // CSRF-Schutz: schreibende Anfragen nur als JSON vom selben Ursprung
      if (m !== 'GET' && !(req.headers['content-type'] || '').includes('application/json')) throw new HttpError(415, 'Content-Type muss application/json sein');

      const hasPw = !!getSetting('password_hash');
      if (p === '/api/auth/status' && m === 'GET') return send(res, 200, { setup: !hasPw, loggedIn: !!validSession(req) });
      if (p === '/api/auth/setup' && m === 'POST') {
        if (hasPw) throw new HttpError(409, 'Bereits eingerichtet');
        const b = await readBody(req);
        if (!b.password || String(b.password).length < 8) throw new HttpError(400, 'Passwort muss mindestens 8 Zeichen haben');
        setSetting('password_hash', hashPassword(b.password));
        if (b.company_name) setSetting('company_name', b.company_name);
        if (b.owner) setSetting('owner', b.owner);
        return send(res, 200, { ok: true }, { 'Set-Cookie': cookie(createSession(), secure) });
      }
      if (p === '/api/auth/login' && m === 'POST') {
        const b = await readBody(req);
        if (!verifyPassword(b.password || '', getSetting('password_hash'))) {
          await new Promise((r) => setTimeout(r, 600));
          throw new HttpError(401, 'Falsches Passwort');
        }
        return send(res, 200, { ok: true }, { 'Set-Cookie': cookie(createSession(), secure) });
      }
      const token = validSession(req);
      if (p === '/api/auth/logout' && m === 'POST') {
        if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
        return send(res, 200, { ok: true }, { 'Set-Cookie': cookie('', secure, 0) });
      }
      if (!token) throw new HttpError(401, 'Nicht angemeldet');

      if (p === '/api/auth/password' && m === 'POST') {
        const b = await readBody(req);
        if (!verifyPassword(b.old_password || '', getSetting('password_hash'))) throw new HttpError(400, 'Altes Passwort ist falsch');
        if (!b.new_password || String(b.new_password).length < 8) throw new HttpError(400, 'Neues Passwort muss mindestens 8 Zeichen haben');
        setSetting('password_hash', hashPassword(b.new_password));
        db.prepare('DELETE FROM sessions WHERE token != ?').run(token);
        return send(res, 200, { ok: true });
      }
      if (p === '/api/dashboard' && m === 'GET') return send(res, 200, dashboard());
      if (p === '/api/settings') {
        if (m === 'GET') { const s = allSettings(); delete s.password_hash; return send(res, 200, s); }
        if (m === 'PUT') {
          const b = await readBody(req);
          for (const [k, v] of Object.entries(b)) if (k !== 'password_hash' && !k.startsWith('counter_')) setSetting(k, v);
          const s = allSettings(); delete s.password_hash; return send(res, 200, s);
        }
      }
      if (p === '/api/export' && m === 'GET') return send(res, 200, exportAll(), { 'Content-Disposition': `attachment; filename="hubwagen-erp-backup-${today()}.json"` });
      if (p === '/api/import' && m === 'POST') return send(res, 200, importAll(await readBody(req)));
      if (p === '/api/plan-inspections' && m === 'POST') return send(res, 200, planInspections(await readBody(req)));

      let mm;
      if ((mm = /^\/api\/csv\/(customers|devices|orders|documents|articles|activities)$/.exec(p)) && m === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${mm[1]}-${today()}.csv"` });
        return res.end(csv(mm[1]));
      }
      if ((mm = /^\/api\/orders\/(\d+)\/invoice$/.exec(p)) && m === 'POST') return send(res, 201, invoiceFromOrder(Number(mm[1])));
      if ((mm = /^\/api\/documents\/(\d+)\/(rechnung|storno|copy)$/.exec(p)) && m === 'POST') return send(res, 201, convertDocument(Number(mm[1]), mm[2]));

      if ((mm = /^\/api\/(customers|activities|devices|articles|orders|documents)(?:\/(\d+))?$/.exec(p))) {
        const [, name, idStr] = mm; const id = idStr ? Number(idStr) : null;
        if (!id && m === 'GET') return send(res, 200, list(name, query));
        if (!id && m === 'POST') return send(res, 201, create(name, await readBody(req)));
        if (id && m === 'GET') return send(res, 200, get(name, id));
        if (id && m === 'PUT') return send(res, 200, update(name, id, await readBody(req)));
        if (id && m === 'DELETE') return send(res, 200, remove(name, id));
      }
      throw new HttpError(404, 'Unbekannter Endpunkt');
    } catch (e) {
      const status = e.status || (/constraint/i.test(e.message) ? 409 : 500);
      if (status === 500) console.error(e);
      let msg = e.message;
      if (/UNIQUE constraint failed: (\w+)\.number/.test(msg)) msg = 'Diese Nummer ist bereits vergeben.';
      else if (/FOREIGN KEY/.test(msg)) msg = 'Datensatz wird noch von anderen Daten verwendet.';
      return send(res, status, { error: msg });
    }
  }

  const server = http.createServer((req, res) => { handle(req, res); });
  return { server, db, api: { create, update, get, list, remove, invoiceFromOrder, convertDocument, dashboard, setSetting, planInspections } };
}

module.exports = { createApp, addMonths, addDays };
