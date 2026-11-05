'use strict';
// Datenbankschicht – nutzt das in Node.js eingebaute SQLite (node:sqlite), keine externen Abhängigkeiten.
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, created_at TEXT NOT NULL, expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT UNIQUE,
  type TEXT NOT NULL DEFAULT 'Kunde',            -- Kunde | Interessent | Inaktiv
  company TEXT NOT NULL,
  contact_person TEXT, email TEXT, phone TEXT, mobile TEXT,
  street TEXT, zip TEXT, city TEXT,
  vat_id TEXT, payment_days INTEGER DEFAULT 14,
  source TEXT,                                   -- Empfehlung, Website, Messe ...
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'Notiz',            -- Anruf | E-Mail | Besuch | Notiz | Wiedervorlage
  subject TEXT, text TEXT,
  followup_date TEXT, done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  number TEXT UNIQUE,
  kind TEXT NOT NULL DEFAULT 'Handhubwagen',
  manufacturer TEXT, model TEXT, serial TEXT, year INTEGER,
  capacity_kg INTEGER, location TEXT,
  interval_months INTEGER NOT NULL DEFAULT 12,
  last_inspection TEXT, next_inspection TEXT, last_result TEXT,
  status TEXT NOT NULL DEFAULT 'aktiv',          -- aktiv | gesperrt | stillgelegt
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT UNIQUE,
  kind TEXT NOT NULL DEFAULT 'Ersatzteil',       -- Ersatzteil | Leistung
  name TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'Stk',
  price REAL NOT NULL DEFAULT 0, cost REAL DEFAULT 0,
  stock REAL DEFAULT 0, min_stock REAL DEFAULT 0,
  supplier TEXT, notes TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  device_id INTEGER REFERENCES devices(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'UVV-Prüfung',      -- UVV-Prüfung | Wartung | Reparatur | Notdienst | Lieferung
  status TEXT NOT NULL DEFAULT 'geplant',        -- geplant | in Arbeit | erledigt | abgerechnet | storniert
  scheduled_at TEXT, duration_min INTEGER DEFAULT 60,
  description TEXT, findings TEXT,
  result TEXT,                                   -- ohne Mängel | Mängel behoben | Mängel – nicht betriebssicher
  checklist TEXT,                                -- JSON
  work_hours REAL DEFAULT 0, travel_km REAL DEFAULT 0,
  signed_by TEXT, completed_at TEXT,
  invoice_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL,
  pos INTEGER, description TEXT NOT NULL, qty REAL NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'Stk', price REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,                            -- angebot | rechnung
  number TEXT UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  source_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  date TEXT NOT NULL, service_date TEXT, due_date TEXT, valid_until TEXT,
  status TEXT NOT NULL DEFAULT 'Entwurf',        -- Entwurf | offen | bezahlt | storniert | angenommen | abgelehnt
  subject TEXT, intro TEXT, footer TEXT,
  tax_rate REAL NOT NULL DEFAULT 19,
  paid_at TEXT, reminder_level INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS document_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL,
  pos INTEGER, description TEXT NOT NULL, qty REAL NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'Stk', price REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_devices_customer ON devices(customer_id);
CREATE INDEX IF NOT EXISTS ix_devices_next ON devices(next_inspection);
CREATE INDEX IF NOT EXISTS ix_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS ix_orders_sched ON orders(scheduled_at);
CREATE INDEX IF NOT EXISTS ix_docs_customer ON documents(customer_id);
CREATE INDEX IF NOT EXISTS ix_act_customer ON activities(customer_id);
`;

const DEFAULT_SETTINGS = {
  company_name: 'Hubwagen-Service Mustermann',
  owner: 'Max Mustermann',
  street: 'Industriestraße 1',
  zip: '12345',
  city: 'Musterstadt',
  phone: '+49 123 456789',
  email: 'info@hubwagen-service.example',
  website: 'www.hubwagen-service.example',
  tax_number: '123/456/78901',
  vat_id: '',
  bank_name: 'Musterbank',
  iban: 'DE00 0000 0000 0000 0000 00',
  bic: 'MUSTDEXXX',
  small_business: '0',          // Kleinunternehmerregelung § 19 UStG
  tax_rate: '19',
  hourly_rate: '65',
  km_rate: '0.60',
  travel_flat: '0',
  payment_days: '14',
  offer_valid_days: '30',
  default_interval_months: '12',
  reminder_days: '30',           // Vorwarnzeit für fällige Prüfungen
  invoice_footer: 'Vielen Dank für Ihren Auftrag! Bitte überweisen Sie den Rechnungsbetrag innerhalb des Zahlungsziels unter Angabe der Rechnungsnummer.',
  offer_footer: 'Wir freuen uns auf Ihren Auftrag. Alle Preise verstehen sich zzgl. gesetzlicher MwSt., sofern nicht anders angegeben.',
};

function open(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  // Migrationen für ältere Datenbanken
  const docCols = db.prepare('PRAGMA table_info(documents)').all().map((c) => c.name);
  if (!docCols.includes('service_date')) db.exec('ALTER TABLE documents ADD COLUMN service_date TEXT');
  const ins = db.prepare('INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) ins.run(k, v);
  return db;
}

function tx(db, fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}

module.exports = { open, tx, DEFAULT_SETTINGS };
