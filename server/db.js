'use strict';
// Camada de banco de dados com dois motores e a mesma interface assíncrona:
//  - SQLite embutido do Node (node:sqlite), padrão e sem dependências. WAL + synchronous=NORMAL:
//    resistente a quedas; backups periódicos com VACUUM INTO. Precisa de disco persistente.
//  - PostgreSQL (ex.: Neon), quando há DATABASE_URL. Usa o pacote `pg`; os backups ficam com o provedor.
// Uso: const store = createStore({ file }) ou createStore({ databaseUrl }); await store.ready;
//      await store.q.userById.get(id); await store.tx(async q => { ... }).
const fs = require('node:fs');
const path = require('node:path');

const SQLITE_MIGRATIONS = [
  `CREATE TABLE users (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     username TEXT NOT NULL UNIQUE COLLATE NOCASE,
     email TEXT UNIQUE COLLATE NOCASE,
     pass_hash TEXT NOT NULL,
     recovery_hash TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     last_login INTEGER,
     banned INTEGER NOT NULL DEFAULT 0,
     suspicious INTEGER NOT NULL DEFAULT 0
   );
   CREATE TABLE sessions (
     token_hash TEXT PRIMARY KEY,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at INTEGER NOT NULL,
     expires_at INTEGER NOT NULL,
     last_seen INTEGER NOT NULL,
     ip TEXT, user_agent TEXT
   );
   CREATE INDEX idx_sessions_user ON sessions(user_id);
   CREATE INDEX idx_sessions_expires ON sessions(expires_at);
   CREATE TABLE saves (
     user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     data TEXT NOT NULL,
     revision INTEGER NOT NULL,
     updated_at INTEGER NOT NULL,
     play_seconds REAL NOT NULL DEFAULT 0,
     display_name TEXT,
     power INTEGER NOT NULL DEFAULT 0,
     boss_kills INTEGER NOT NULL DEFAULT 0,
     best_stage INTEGER NOT NULL DEFAULT 0,
     account_level INTEGER NOT NULL DEFAULT 1
   );
   CREATE INDEX idx_saves_power ON saves(power DESC);
   CREATE INDEX idx_saves_bosses ON saves(boss_kills DESC);
   CREATE TABLE save_history (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     data TEXT NOT NULL,
     revision INTEGER NOT NULL,
     created_at INTEGER NOT NULL
   );
   CREATE INDEX idx_history_user ON save_history(user_id, id DESC);
   CREATE TABLE audit (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id INTEGER,
     event TEXT NOT NULL,
     detail TEXT,
     ip TEXT,
     at INTEGER NOT NULL
   );
   CREATE INDEX idx_audit_user ON audit(user_id, at DESC);`
];

// Mesmo esquema no PostgreSQL. Datas em milissegundos (BIGINT); nome de usuário único sem diferenciar maiúsculas.
const PG_MIGRATIONS = [
  `CREATE TABLE users (
     id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
     username TEXT NOT NULL,
     email TEXT UNIQUE,
     pass_hash TEXT NOT NULL,
     recovery_hash TEXT NOT NULL,
     created_at BIGINT NOT NULL,
     last_login BIGINT,
     banned INTEGER NOT NULL DEFAULT 0,
     suspicious INTEGER NOT NULL DEFAULT 0
   );
   CREATE UNIQUE INDEX idx_users_username ON users (lower(username));
   CREATE TABLE sessions (
     token_hash TEXT PRIMARY KEY,
     user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at BIGINT NOT NULL,
     expires_at BIGINT NOT NULL,
     last_seen BIGINT NOT NULL,
     ip TEXT, user_agent TEXT
   );
   CREATE INDEX idx_sessions_user ON sessions(user_id);
   CREATE INDEX idx_sessions_expires ON sessions(expires_at);
   CREATE TABLE saves (
     user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     data TEXT NOT NULL,
     revision INTEGER NOT NULL,
     updated_at BIGINT NOT NULL,
     play_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
     display_name TEXT,
     power BIGINT NOT NULL DEFAULT 0,
     boss_kills INTEGER NOT NULL DEFAULT 0,
     best_stage INTEGER NOT NULL DEFAULT 0,
     account_level INTEGER NOT NULL DEFAULT 1
   );
   CREATE INDEX idx_saves_power ON saves(power DESC);
   CREATE INDEX idx_saves_bosses ON saves(boss_kills DESC);
   CREATE TABLE save_history (
     id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
     user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     data TEXT NOT NULL,
     revision INTEGER NOT NULL,
     created_at BIGINT NOT NULL
   );
   CREATE INDEX idx_history_user ON save_history(user_id, id DESC);
   CREATE TABLE audit (
     id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
     user_id BIGINT,
     event TEXT NOT NULL,
     detail TEXT,
     ip TEXT,
     at BIGINT NOT NULL
   );
   CREATE INDEX idx_audit_user ON audit(user_id, at DESC);`
];

// Consultas escritas com `?`; no PostgreSQL viram $1, $2… Onde a sintaxe difere, há uma versão própria.
const QUERIES = {
  userByName: 'SELECT * FROM users WHERE username = ?',
  userByEmail: 'SELECT * FROM users WHERE email = ?',
  userById: 'SELECT * FROM users WHERE id = ?',
  insertUser: 'INSERT INTO users (username, email, pass_hash, recovery_hash, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id',
  setPassword: 'UPDATE users SET pass_hash = ? WHERE id = ?',
  setRecovery: 'UPDATE users SET recovery_hash = ? WHERE id = ?',
  touchLogin: 'UPDATE users SET last_login = ? WHERE id = ?',
  flagSuspicious: 'UPDATE users SET suspicious = suspicious + 1 WHERE id = ?',
  deleteUser: 'DELETE FROM users WHERE id = ?',
  insertSession: 'INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
  sessionByHash: 'SELECT s.*, u.username, u.banned FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?',
  touchSession: 'UPDATE sessions SET last_seen = ?, expires_at = ? WHERE token_hash = ?',
  deleteSession: 'DELETE FROM sessions WHERE token_hash = ?',
  deleteUserSessions: 'DELETE FROM sessions WHERE user_id = ?',
  deleteOtherSessions: 'DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?',
  purgeSessions: 'DELETE FROM sessions WHERE expires_at <= ?',
  getSave: 'SELECT * FROM saves WHERE user_id = ?',
  getSaveForUpdate: 'SELECT * FROM saves WHERE user_id = ?',
  insertSave: 'INSERT INTO saves (user_id, data, revision, updated_at, play_seconds, display_name, power, boss_kills, best_stage, account_level) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (user_id) DO NOTHING',
  updateSave: 'UPDATE saves SET data = ?, revision = revision + 1, updated_at = ?, play_seconds = ?, display_name = ?, power = ?, boss_kills = ?, best_stage = ?, account_level = ? WHERE user_id = ? AND revision = ?',
  insertHistory: 'INSERT INTO save_history (user_id, data, revision, created_at) VALUES (?, ?, ?, ?)',
  trimHistory: 'DELETE FROM save_history WHERE user_id = ? AND id NOT IN (SELECT id FROM save_history WHERE user_id = ? ORDER BY id DESC LIMIT ?)',
  listHistory: 'SELECT id, revision, created_at FROM save_history WHERE user_id = ? ORDER BY id DESC',
  getHistory: 'SELECT * FROM save_history WHERE id = ? AND user_id = ?',
  audit: 'INSERT INTO audit (user_id, event, detail, ip, at) VALUES (?, ?, ?, ?, ?)',
  leaderboardPower: 'SELECT s.display_name AS name, s.power, s.boss_kills, s.best_stage, s.account_level FROM saves s JOIN users u ON u.id = s.user_id WHERE u.banned = 0 AND u.suspicious < 3 ORDER BY s.power DESC LIMIT ?',
  leaderboardBosses: 'SELECT s.display_name AS name, s.power, s.boss_kills, s.best_stage, s.account_level FROM saves s JOIN users u ON u.id = s.user_id WHERE u.banned = 0 AND u.suspicious < 3 ORDER BY s.boss_kills DESC, s.power DESC LIMIT ?',
  leaderboardStage: 'SELECT s.display_name AS name, s.power, s.boss_kills, s.best_stage, s.account_level FROM saves s JOIN users u ON u.id = s.user_id WHERE u.banned = 0 AND u.suspicious < 3 ORDER BY s.best_stage DESC, s.power DESC LIMIT ?',
  rankOf: 'SELECT COUNT(*) + 1 AS rank FROM saves s JOIN users u ON u.id = s.user_id WHERE u.banned = 0 AND u.suspicious < 3 AND s.power > ?',
  counts: 'SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM sessions) AS sessions, (SELECT COUNT(*) FROM saves) AS saves'
};
const PG_QUERIES = {
  userByName: 'SELECT * FROM users WHERE lower(username) = lower(?)',
  getSaveForUpdate: 'SELECT * FROM saves WHERE user_id = ? FOR UPDATE'
};

// Cada consulta vira { get, all, run }, todas assíncronas; run devolve { changes }.
function bindQueries(sqlFor, exec) {
  const q = {};
  for (const name of Object.keys(QUERIES)) {
    const sql = sqlFor(name);
    q[name] = { get:(...a) => exec(sql, a, 'get'), all:(...a) => exec(sql, a, 'all'), run:(...a) => exec(sql, a, 'run') };
  }
  return q;
}

// ---------------------------------------------------------------------------
// SQLite
// ---------------------------------------------------------------------------
class SqliteStore {
  constructor(file, opts = {}) {
    const { DatabaseSync } = require('node:sqlite');
    this.kind = 'sqlite';
    this.file = file;
    this.backupDir = opts.backupDir || path.join(path.dirname(file), 'backups');
    this.keepBackups = opts.keepBackups || 14;
    this.historyPerUser = opts.historyPerUser || 20;
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive:true });
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    this.migrate();
    const check = this.db.prepare('PRAGMA quick_check').get();
    if (check && Object.values(check)[0] !== 'ok') throw new Error(`Banco de dados corrompido: ${JSON.stringify(check)}`);
    const stmts = {};
    for (const name of Object.keys(QUERIES)) stmts[QUERIES[name]] ||= this.db.prepare(QUERIES[name]);
    const run = (sql, a, mode) => { const out = stmts[sql][mode](...a); return mode === 'run' ? { changes:Number(out.changes) } : out; };
    // A conexão é única: enquanto uma transação está aberta, as outras consultas esperam ela terminar.
    this.busy = null;
    this.txq = bindQueries(n => QUERIES[n], async (sql, a, mode) => run(sql, a, mode));
    this.q = bindQueries(n => QUERIES[n], async (sql, a, mode) => { while (this.busy) await this.busy; return run(sql, a, mode); });
    this.ready = Promise.resolve(this);
  }

  migrate() {
    this.db.exec('CREATE TABLE IF NOT EXISTS schema_version (v INTEGER NOT NULL)');
    const row = this.db.prepare('SELECT v FROM schema_version').get();
    let v = row ? row.v : 0;
    if (!row) this.db.prepare('INSERT INTO schema_version (v) VALUES (0)').run();
    for (; v < SQLITE_MIGRATIONS.length; v++) {
      this.db.exec('BEGIN IMMEDIATE');
      try { this.db.exec(SQLITE_MIGRATIONS[v]); this.db.prepare('UPDATE schema_version SET v = ?').run(v + 1); this.db.exec('COMMIT'); }
      catch (err) { try { this.db.exec('ROLLBACK'); } catch (_) {} throw err; }
    }
  }

  async tx(fn) {
    while (this.busy) await this.busy;
    let release; this.busy = new Promise(r => { release = r; });
    try {
      this.db.exec('BEGIN IMMEDIATE');
      try { const out = await fn(this.txq); this.db.exec('COMMIT'); return out; }
      catch (err) { try { this.db.exec('ROLLBACK'); } catch (_) {} throw err; }
    } finally { this.busy = null; release(); }
  }

  async backup() {
    if (this.file === ':memory:') return null;
    while (this.busy) await this.busy;
    fs.mkdirSync(this.backupDir, { recursive:true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const target = path.join(this.backupDir, `mythverse-${stamp}.db`);
    this.db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
    const files = fs.readdirSync(this.backupDir).filter(f => /^mythverse-.*\.db$/.test(f)).sort();
    while (files.length > this.keepBackups) fs.unlinkSync(path.join(this.backupDir, files.shift()));
    return target;
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    try { this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch (_) {}
    this.db.close();
  }
}

// ---------------------------------------------------------------------------
// PostgreSQL (Neon, Supabase, Render Postgres…)
// ---------------------------------------------------------------------------
// Aceita a URL como o painel do Neon entrega (…?sslmode=require&channel_binding=require).
function pgConfig(databaseUrl) {
  let url;
  try { url = new URL(databaseUrl); } catch (_) { throw new Error('DATABASE_URL inválida: copie a "connection string" completa do Neon (postgresql://…).'); }
  const sslmode = url.searchParams.get('sslmode');
  const binding = url.searchParams.get('channel_binding');
  url.searchParams.delete('sslmode'); url.searchParams.delete('channel_binding');
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
  // Sem sslmode, só conexões locais dispensam TLS. Com TLS o certificado é sempre verificado.
  const ssl = sslmode === 'disable' || (!sslmode && local) ? false : { rejectUnauthorized:true };
  return { connectionString:url.toString(), ssl, enableChannelBinding:binding === 'require' || binding === 'prefer' };
}

class PgStore {
  constructor(databaseUrl, opts = {}) {
    const pg = require('pg');
    this.kind = 'postgres';
    this.historyPerUser = opts.historyPerUser || 20;
    const int8 = pg.types.builtins.INT8;
    // `schema` (só para testes) isola as tabelas num schema próprio.
    if (opts.schema && !/^[a-z_][a-z0-9_]*$/.test(opts.schema)) throw new Error('Nome de schema inválido.');
    this.schemaSql = opts.schema ? `CREATE SCHEMA IF NOT EXISTS ${opts.schema}` : '';
    this.pool = new pg.Pool({
      ...pgConfig(databaseUrl),
      ...(opts.schema ? { options:`-c search_path=${opts.schema}` } : {}),
      max:opts.poolSize || 5,
      idleTimeoutMillis:30_000,
      connectionTimeoutMillis:20_000,
      // BIGINT (datas em ms, contagens) volta como número, igual ao SQLite.
      types:{ getTypeParser:(oid, format) => oid === int8 && format !== 'binary' ? Number : pg.types.getTypeParser(oid, format) }
    });
    // O Neon desliga o banco ocioso; a conexão parada cai e o pool abre outra na próxima consulta.
    this.pool.on('error', err => { if (opts.log) opts.log('postgres: conexão ociosa encerrada', err.message); });
    const sqlFor = name => { let i = 0; return (PG_QUERIES[name] || QUERIES[name]).replace(/\?/g, () => `$${++i}`); };
    const exec = client => async (sql, a, mode) => {
      const r = await client.query(sql, a);
      return mode === 'get' ? r.rows[0] : mode === 'all' ? r.rows : { changes:r.rowCount };
    };
    this.bind = client => bindQueries(sqlFor, exec(client));
    this.q = this.bind(this.pool);
    this.ready = this.migrate().then(() => this);
    this.ready.catch(() => {});
  }

  async migrate() {
    const client = await this.pool.connect();
    try {
      if (this.schemaSql) await client.query(this.schemaSql);
      await client.query('BEGIN');
      // Trava para duas instâncias iniciando juntas não aplicarem a mesma migração.
      await client.query('SELECT pg_advisory_xact_lock(424242)');
      await client.query('CREATE TABLE IF NOT EXISTS schema_version (v INTEGER NOT NULL)');
      const row = (await client.query('SELECT v FROM schema_version')).rows[0];
      let v = row ? row.v : 0;
      if (!row) await client.query('INSERT INTO schema_version (v) VALUES (0)');
      for (; v < PG_MIGRATIONS.length; v++) {
        await client.query(PG_MIGRATIONS[v]);
        await client.query('UPDATE schema_version SET v = $1', [v + 1]);
      }
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK').catch(() => {}); throw err; }
    finally { client.release(); }
  }

  async tx(fn) {
    const client = await this.pool.connect();
    let broken = false;
    try {
      await client.query('BEGIN');
      const out = await fn(this.bind(client));
      await client.query('COMMIT');
      return out;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) { broken = true; }
      throw err;
    } finally { client.release(broken); }
  }

  // Backups ficam com o provedor (no Neon: restauração por ponto no tempo, no painel).
  async backup() { return null; }

  async close() { if (!this.closed) { this.closed = true; await this.pool.end(); } }
}

function createStore(opts = {}) {
  return opts.databaseUrl ? new PgStore(opts.databaseUrl, opts) : new SqliteStore(opts.file, opts);
}

// Nome de usuário ou e-mail repetido (SQLite: "UNIQUE constraint failed"; PostgreSQL: código 23505).
const isUniqueViolation = err => err?.code === '23505' || /UNIQUE/.test(String(err?.message));

module.exports = { createStore, isUniqueViolation, pgConfig, SqliteStore, PgStore };
