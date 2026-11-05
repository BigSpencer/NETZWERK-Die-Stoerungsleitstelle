'use strict';
// Demodaten für einen ersten Eindruck (node server.js --demo).
const { addMonths, addDays } = require('./app');

function seedDemo(api) {
  const t = new Date().toLocaleDateString('sv-SE');
  const art = (a) => api.create('articles', a);
  const A = {
    uvv: art({ kind: 'Leistung', number: 'L-UVV', name: 'UVV-Prüfung Handhubwagen inkl. Prüfplakette und Protokoll', unit: 'Stk', price: 29 }),
    uvvE: art({ kind: 'Leistung', number: 'L-UVV-E', name: 'UVV-Prüfung Elektro-Hubwagen / Deichselstapler inkl. Plakette', unit: 'Stk', price: 59 }),
    wart: art({ kind: 'Leistung', number: 'L-WART', name: 'Wartung Hydraulik (Öl prüfen/auffüllen, Entlüften, Abschmieren)', unit: 'Stk', price: 35 }),
    pump: art({ kind: 'Ersatzteil', number: 'ET-1001', name: 'Hydraulik-Dichtungssatz Pumpe universal', unit: 'Satz', price: 38.5, cost: 14.2, stock: 6, min_stock: 3, supplier: 'Flurförder-Teile GmbH' }),
    lenk: art({ kind: 'Ersatzteil', number: 'ET-2001', name: 'Lenkrad Polyurethan 200x50 mm mit Kugellager', unit: 'Stk', price: 42, cost: 17.9, stock: 4, min_stock: 4, supplier: 'Flurförder-Teile GmbH' }),
    tand: art({ kind: 'Ersatzteil', number: 'ET-2002', name: 'Tandem-Lastrolle Polyurethan 80x70 mm', unit: 'Stk', price: 18.9, cost: 6.5, stock: 16, min_stock: 8, supplier: 'Flurförder-Teile GmbH' }),
    oel: art({ kind: 'Ersatzteil', number: 'ET-3001', name: 'Hydrauliköl HLP 32', unit: 'l', price: 7.5, cost: 2.9, stock: 20, min_stock: 5, supplier: 'Schmierstoffe Nord' }),
    bat: art({ kind: 'Ersatzteil', number: 'ET-4001', name: 'Antriebsbatterie 24 V / 100 Ah Gel', unit: 'Stk', price: 489, cost: 310, stock: 1, min_stock: 1, supplier: 'Batterie-Profi' }),
  };

  const cust = [
    { company: 'Logistik Weber GmbH', contact_person: 'Sabine Weber', email: 'einkauf@weber-logistik.example', phone: '0451 112233', street: 'Hafenstraße 12', zip: '23552', city: 'Lübeck', source: 'Empfehlung', payment_days: 14 },
    { company: 'Getränke Hansen KG', contact_person: 'Jens Hansen', email: 'info@hansen-getraenke.example', phone: '04331 4455', street: 'Brunnenweg 3', zip: '24768', city: 'Rendsburg', source: 'Website', payment_days: 10 },
    { company: 'Baumarkt Nordlicht', contact_person: 'Petra Lorenz', email: 'p.lorenz@nordlicht.example', phone: '0431 987654', street: 'Gewerbering 44', zip: '24145', city: 'Kiel', source: 'Kaltakquise', payment_days: 30 },
    { company: 'Tischlerei Brandt', contact_person: 'Ole Brandt', email: 'ole@tischlerei-brandt.example', phone: '04521 7788', street: 'Dorfstraße 8', zip: '23701', city: 'Eutin', source: 'Empfehlung', payment_days: 14 },
  ].map((c) => api.create('customers', c));
  const lead = api.create('customers', { type: 'Interessent', company: 'Frischemarkt Ostsee e.K.', contact_person: 'Murat Yilmaz', phone: '0461 556677', city: 'Flensburg', source: 'Messe', notes: 'Ca. 12 Handhubwagen + 2 Elektro-Hubwagen, bisher ohne Prüfdienst.' });

  const dev = (customer_id, d) => api.create('devices', { customer_id, ...d });
  const d1 = dev(cust[0].id, { kind: 'Handhubwagen', manufacturer: 'Jungheinrich', model: 'AM 22', serial: 'JH-88213', year: 2017, capacity_kg: 2200, location: 'Halle 1', last_inspection: addMonths(t, -11) });
  dev(cust[0].id, { kind: 'Handhubwagen', manufacturer: 'Jungheinrich', model: 'AM 22', serial: 'JH-88214', year: 2017, capacity_kg: 2200, location: 'Halle 1', last_inspection: addMonths(t, -11) });
  const d3 = dev(cust[0].id, { kind: 'Elektro-Hubwagen', manufacturer: 'Linde', model: 'T20', serial: 'LT20-55102', year: 2020, capacity_kg: 2000, location: 'Wareneingang', last_inspection: addMonths(t, -13) });
  const d4 = dev(cust[1].id, { kind: 'Handhubwagen', manufacturer: 'Pfaff', model: 'silverline HU 25', serial: 'PF-1203', year: 2019, capacity_kg: 2500, location: 'Leergut', last_inspection: addMonths(t, -12) });
  dev(cust[1].id, { kind: 'Wiegehubwagen', manufacturer: 'Pfaff', model: 'HU 20-115 WS', serial: 'PF-WS-77', year: 2021, capacity_kg: 2000, location: 'Versand', last_inspection: addMonths(t, -6) });
  dev(cust[2].id, { kind: 'Scherenhubwagen', manufacturer: 'Ameise', model: 'PTM 1.0', serial: 'AM-4410', year: 2016, capacity_kg: 1000, location: 'Gartencenter', last_inspection: addMonths(t, -3) });
  dev(cust[2].id, { kind: 'Deichselstapler', manufacturer: 'Still', model: 'EXV 14', serial: 'ST-EXV-9931', year: 2018, capacity_kg: 1400, location: 'Lager Nord', last_inspection: addMonths(t, -12), interval_months: 12 });
  dev(cust[3].id, { kind: 'Handhubwagen', manufacturer: 'Noname', model: 'Standard 2500', serial: '—', year: 2012, capacity_kg: 2500, location: 'Werkstatt', last_inspection: addMonths(t, -2) });

  // Abgeschlossener + abgerechneter Auftrag
  const o1 = api.create('orders', {
    customer_id: cust[1].id, device_id: d4.id, type: 'Reparatur', status: 'erledigt', scheduled_at: addDays(t, -20) + 'T09:00',
    description: 'Hubwagen senkt selbstständig ab', findings: 'Pumpendichtungen verschlissen, Öl verloren. Dichtungssatz erneuert, Öl aufgefüllt, entlüftet. Funktionsprüfung i.O.',
    result: 'Mängel behoben', work_hours: 1.5, travel_km: 46, signed_by: 'J. Hansen',
    items: [{ article_id: A.pump.id, description: A.pump.name, qty: 1, unit: 'Satz', price: A.pump.price }, { article_id: A.oel.id, description: A.oel.name, qty: 1, unit: 'l', price: A.oel.price }],
  });
  const inv1 = api.invoiceFromOrder(o1.id);
  api.update('documents', inv1.id, { status: 'offen' });
  api.update('documents', inv1.id, { status: 'bezahlt', paid_at: addDays(t, -10) });

  const o2 = api.create('orders', {
    customer_id: cust[2].id, type: 'UVV-Prüfung', status: 'erledigt', scheduled_at: addDays(t, -40) + 'T08:00',
    description: 'Jahresprüfung Scherenhubwagen', result: 'ohne Mängel', work_hours: 0, travel_km: 0,
    items: [{ article_id: A.uvv.id, description: A.uvv.name, qty: 1, unit: 'Stk', price: A.uvv.price }],
  });
  const inv2 = api.invoiceFromOrder(o2.id);
  api.update('documents', inv2.id, { date: addDays(t, -40), due_date: addDays(t, -10) });
  api.update('documents', inv2.id, { status: 'offen' }); // überfällige Rechnung

  // Erledigt, noch nicht abgerechnet
  api.create('orders', {
    customer_id: cust[0].id, device_id: d3.id, type: 'Wartung', status: 'erledigt', scheduled_at: addDays(t, -2) + 'T13:00',
    description: 'Lenkrad ausgeschlagen', findings: 'Lenkrad getauscht, Gelenke abgeschmiert.', result: 'Mängel behoben', work_hours: 1, travel_km: 30,
    items: [{ article_id: A.lenk.id, description: A.lenk.name, qty: 1, unit: 'Stk', price: A.lenk.price }],
  });

  // Geplante Termine
  api.create('orders', { customer_id: cust[0].id, device_id: d1.id, type: 'UVV-Prüfung', status: 'geplant', scheduled_at: addDays(t, 3) + 'T08:30', description: 'Jahresprüfung nach DGUV V68', items: [{ article_id: A.uvv.id, description: A.uvv.name, qty: 1, unit: 'Stk', price: A.uvv.price }] });
  api.create('orders', { customer_id: cust[2].id, type: 'Notdienst', status: 'geplant', scheduled_at: addDays(t, 1) + 'T14:00', description: 'Deichselstapler fährt nicht – Batterie?' });

  // Angebot an Interessent
  api.create('documents', {
    kind: 'angebot', customer_id: lead.id, status: 'offen', subject: 'Prüfvertrag Flurförderzeuge',
    intro: 'Vielen Dank für das nette Gespräch auf der Messe. Gerne bieten wir Ihnen die jährliche Prüfung Ihrer Flurförderzeuge an:',
    items: [
      { article_id: A.uvv.id, description: A.uvv.name, qty: 12, unit: 'Stk', price: 26 },
      { article_id: A.uvvE.id, description: A.uvvE.name, qty: 2, unit: 'Stk', price: 55 },
      { description: 'Anfahrtspauschale', qty: 1, unit: 'psch', price: 35 },
    ],
  });

  // CRM-Aktivitäten
  api.create('activities', { customer_id: lead.id, date: addDays(t, -7), kind: 'Besuch', subject: 'Messegespräch', text: 'Interesse an jährlichem Prüfvertrag. Angebot zugesagt.', followup_date: addDays(t, 2) });
  api.create('activities', { customer_id: cust[0].id, date: addDays(t, -2), kind: 'Anruf', subject: 'Terminabstimmung UVV', text: 'Frau Weber bestätigt Termin, Zugang über Tor 3.' });
  api.create('activities', { customer_id: cust[3].id, date: addDays(t, -30), kind: 'E-Mail', subject: 'Anfrage Ersatzhubwagen', text: 'Fragt nach Angebot für neuen Handhubwagen 2,5 t.', followup_date: addDays(t, -1) });
}

module.exports = { seedDemo };
