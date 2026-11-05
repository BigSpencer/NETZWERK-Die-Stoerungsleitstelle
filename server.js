'use strict';
// Startpunkt: node server.js [--demo]   (Umgebungsvariablen: PORT, HOST, DB_FILE)
const path = require('node:path');
const { createApp } = require('./app');
const { seedDemo } = require('./demo');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'hubwagen-erp.db');

const { server, db, api } = createApp(DB_FILE);
if (process.argv.includes('--demo')) {
  const n = db.prepare('SELECT COUNT(*) n FROM customers').get().n;
  if (n === 0) { seedDemo(api, db); console.log('Demodaten angelegt.'); }
  else console.log('Datenbank enthält bereits Daten – Demodaten werden nicht angelegt.');
}
server.listen(PORT, HOST, () => console.log(`Hubwagen-ERP läuft auf http://${HOST}:${PORT}  (Datenbank: ${DB_FILE})`));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { server.close(); db.close(); process.exit(0); });
