'use strict';
// Backup manual do banco SQLite: `npm run backup` cria data/backups/mythverse-<data>.db.
// Com DATABASE_URL (PostgreSQL) o backup fica com o provedor; no Neon, use a restauração no painel.
const path = require('node:path');
const { createStore } = require('./db');

if (process.env.DATABASE_URL) {
  console.log('Usando PostgreSQL (DATABASE_URL): faça o backup pelo painel do provedor (no Neon: Backup & Restore).');
} else {
  const store = createStore({ file:path.resolve(process.env.DATA_DIR || 'data', 'mythverse.db') });
  store.backup().then(file => { console.log(file); return store.close(); }).catch(err => { console.error(err); process.exit(1); });
}
