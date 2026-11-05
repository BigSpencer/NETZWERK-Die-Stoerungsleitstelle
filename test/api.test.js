'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, addMonths } = require('../app');

let base; let cookie = ''; let app;
async function call(method, url, body) {
  const res = await fetch(base + url, {
    method, headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: body === undefined ? (method === 'GET' ? undefined : '{}') : JSON.stringify(body),
  });
  const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

test.before(async () => {
  app = createApp(':memory:');
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}/api`;
});
test.after(() => app.server.close());

test('Auth: Einrichtung, Schutz, Login', async () => {
  assert.equal((await call('GET', '/customers')).status, 401);
  assert.equal((await call('GET', '/auth/status')).data.setup, true);
  assert.equal((await call('POST', '/auth/setup', { password: 'kurz' })).status, 400);
  assert.equal((await call('POST', '/auth/setup', { password: 'geheim123', company_name: 'Test-Service' })).status, 200);
  assert.equal((await call('POST', '/auth/setup', { password: 'nochmal123' })).status, 409);
  assert.equal((await call('GET', '/customers')).status, 200);
  await call('POST', '/auth/logout');
  cookie = '';
  assert.equal((await call('POST', '/auth/login', { password: 'falsch' })).status, 401);
  assert.equal((await call('POST', '/auth/login', { password: 'geheim123' })).status, 200);
  assert.equal((await call('GET', '/settings')).data.company_name, 'Test-Service');
  assert.equal((await call('GET', '/settings')).data.password_hash, undefined);
});

test('Workflow: Kunde → Gerät → UVV-Prüfung → Rechnung → Storno', async () => {
  const c = (await call('POST', '/customers', { company: 'Lager AG', city: 'Kiel', payment_days: 10 })).data;
  assert.match(c.number, /^K-\d+$/);
  const art = (await call('POST', '/articles', { name: 'Lastrolle', kind: 'Ersatzteil', price: 20, stock: 10 })).data;

  const d = (await call('POST', '/devices', { customer_id: c.id, kind: 'Handhubwagen', serial: 'X1', last_inspection: '2025-03-31' })).data;
  assert.equal(d.next_inspection, '2026-03-31');
  assert.equal(addMonths('2025-01-31', 1), '2025-02-28');

  const due = (await call('GET', '/devices?due=30')).data;
  assert.ok(due.some((x) => x.id === d.id), 'überfälliges Gerät erscheint in Fälligkeitsliste');

  const plan = (await call('POST', '/plan-inspections', { device_ids: [d.id] })).data;
  assert.equal(plan.created, 1);
  assert.equal((await call('POST', '/plan-inspections', { device_ids: [d.id] })).data.created, 0, 'keine doppelten Prüfaufträge');

  const o = (await call('GET', `/orders/${plan.ids[0]}`)).data;
  assert.match(o.number, /^A-\d{4}-0001$/);
  const upd = (await call('PUT', `/orders/${o.id}`, {
    status: 'erledigt', scheduled_at: '2026-04-10T09:00', result: 'ohne Mängel', work_hours: 0.5, travel_km: 10,
    checklist: [{ group: 'Rahmen', label: 'Risse', state: 'ok', note: '' }],
    items: [{ article_id: art.id, description: 'Lastrolle', qty: 2, unit: 'Stk', price: 20 }],
  })).data;
  assert.equal(upd.completed_at, '2026-04-10');
  assert.equal(upd.checklist[0].state, 'ok');
  const d2 = (await call('GET', `/devices/${d.id}`)).data;
  assert.equal(d2.last_inspection, '2026-04-10');
  assert.equal(d2.next_inspection, '2027-04-10');
  assert.equal((await call('GET', `/articles/${art.id}`)).data.stock, 8, 'Lager abgebucht');

  const inv = (await call('POST', `/orders/${o.id}/invoice`)).data;
  assert.match(inv.number, /^RE-\d{4}-0001$/);
  assert.equal(inv.status, 'Entwurf');
  // 2 × 20 + 0,5 Std × 65 + 10 km × 0,60 = 40 + 32,5 + 6 = 78,50
  assert.equal(inv.net, 78.5);
  assert.equal(inv.tax, 14.92);
  assert.equal(inv.gross, 93.42);
  assert.equal((await call('POST', `/orders/${o.id}/invoice`)).status, 409, 'nicht doppelt abrechnen');
  assert.equal((await call('GET', `/orders/${o.id}`)).data.status, 'abgerechnet');

  assert.equal((await call('PUT', `/documents/${inv.id}`, { status: 'offen' })).data.status, 'offen');
  const locked = await call('PUT', `/documents/${inv.id}`, { items: [{ description: 'Neu', qty: 1, price: 1 }] });
  assert.equal(locked.status, 409, 'festgeschriebene Rechnung unveränderlich');
  assert.equal((await call('DELETE', `/documents/${inv.id}`)).status, 409);
  assert.equal((await call('DELETE', `/customers/${c.id}`)).status, 409, 'Kunde mit Belegen nicht löschbar');

  const dash = (await call('GET', '/dashboard')).data;
  assert.equal(dash.kpi.open_invoices, 1);
  assert.equal(dash.kpi.open_amount, 93.42);

  const st = (await call('POST', `/documents/${inv.id}/storno`)).data;
  assert.match(st.number, /^ST-/);
  assert.equal(st.gross, -93.42);
  assert.equal((await call('GET', `/documents/${inv.id}`)).data.status, 'storniert');
  assert.equal((await call('GET', `/orders/${o.id}`)).data.status, 'erledigt', 'Auftrag nach Storno wieder abrechenbar');
  assert.equal((await call('GET', '/dashboard')).data.kpi.open_invoices, 0);
});

test('Mangelhaftes Gerät wird gesperrt, Angebot → Rechnung', async () => {
  const c = (await call('POST', '/customers', { company: 'Getränke GmbH' })).data;
  const d = (await call('POST', '/devices', { customer_id: c.id, kind: 'Elektro-Hubwagen' })).data;
  await call('POST', '/orders', { customer_id: c.id, device_id: d.id, type: 'UVV-Prüfung', status: 'erledigt', scheduled_at: '2026-05-01T10:00', result: 'Mängel – nicht betriebssicher' });
  assert.equal((await call('GET', `/devices/${d.id}`)).data.status, 'gesperrt');

  const an = (await call('POST', '/documents', { kind: 'angebot', customer_id: c.id, items: [{ description: 'Reparatur', qty: 1, price: 100 }] })).data;
  assert.match(an.number, /^AN-/);
  assert.ok(an.valid_until);
  const re = (await call('POST', `/documents/${an.id}/rechnung`)).data;
  assert.equal(re.kind, 'rechnung');
  assert.equal(re.net, 100);
  assert.equal((await call('GET', `/documents/${an.id}`)).data.status, 'angenommen');
});

test('Export/Import, CSV, Validierung', async () => {
  assert.equal((await call('POST', '/customers', {})).status, 400);
  const res = await fetch(base + '/csv/customers', { headers: { Cookie: cookie } });
  assert.match(await res.text(), /company/);
  const dump = (await call('GET', '/export')).data;
  assert.ok(dump.customers.length >= 2);
  assert.ok(!dump.settings.some((s) => s.key === 'password_hash'));
  assert.equal((await call('POST', '/import', dump)).status, 200);
  assert.equal((await call('GET', '/customers')).data.length, dump.customers.length);
  const r = await fetch(base + '/customers', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'text/plain' }, body: '{}' });
  assert.equal(r.status, 415, 'CSRF-Schutz');
});
