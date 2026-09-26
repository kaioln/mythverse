'use strict';
// Camada de dados do MYTHVERSE.
//  • SQLite (padrão, sem dependências): arquivo local em DATA_DIR, WAL + backups.
//  • PostgreSQL (DATABASE_URL, ex.: Supabase/Neon): para hospedagens sem disco permanente (Koyeb, Render free…).
// O mesmo repositório de consultas roda nos dois; o SQL usa "?" e o prefixo ${T} (schema no Postgres).
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

// ---------------------------------------------------------------------------
// Compressão dos saves (JSON → gzip → base64). Reduz ~10× o espaço usado.
// ---------------------------------------------------------------------------
const pack = json => `gz:${zlib.gzipSync(Buffer.from(json, 'utf8'), { level:6 }).toString('base64')}`;
const unpack = data => (typeof data === 'string' && data.startsWith('gz:')) ? zlib.gunzipSync(Buffer.from(data.slice(3), 'base64')).toString('utf8') : data;

// ---------------------------------------------------------------------------
// Migrações por dialeto
// ---------------------------------------------------------------------------
const SQLITE_MIGRATIONS = [
  `CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE COLLATE NOCASE, email TEXT UNIQUE COLLATE NOCASE, pass_hash TEXT NOT NULL, recovery_hash TEXT NOT NULL, created_at INTEGER NOT NULL, last_login INTEGER, banned INTEGER NOT NULL DEFAULT 0, suspicious INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, ip TEXT, user_agent TEXT);
   CREATE INDEX idx_sessions_user ON sessions(user_id);
   CREATE INDEX idx_sessions_expires ON sessions(expires_at);
   CREATE TABLE saves (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL, revision INTEGER NOT NULL, updated_at INTEGER NOT NULL, play_seconds REAL NOT NULL DEFAULT 0, display_name TEXT, power INTEGER NOT NULL DEFAULT 0, boss_kills INTEGER NOT NULL DEFAULT 0, best_stage INTEGER NOT NULL DEFAULT 0, account_level INTEGER NOT NULL DEFAULT 1);
   CREATE INDEX idx_saves_power ON saves(power DESC);
   CREATE INDEX idx_saves_bosses ON saves(boss_kills DESC);
   CREATE TABLE save_history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL, revision INTEGER NOT NULL, created_at INTEGER NOT NULL);
   CREATE INDEX idx_history_user ON save_history(user_id, id DESC);
   CREATE TABLE audit (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, event TEXT NOT NULL, detail TEXT, ip TEXT, at INTEGER NOT NULL);
   CREATE INDEX idx_audit_user ON audit(user_id, at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_users_lname ON users(lower(username));
   CREATE INDEX IF NOT EXISTS idx_users_lemail ON users(lower(email));
   CREATE INDEX IF NOT EXISTS idx_audit_at ON audit(at);`,
  // Economia real (Gemas), Mercado de Jogadores e procedência de itens.
  `ALTER TABLE saves ADD COLUMN rift_best INTEGER NOT NULL DEFAULT 0;
   CREATE INDEX idx_saves_rift ON saves(rift_best DESC);
   CREATE TABLE wallets (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0), held INTEGER NOT NULL DEFAULT 0 CHECK (held >= 0), updated_at INTEGER NOT NULL);
   CREATE TABLE wallet_ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, delta INTEGER NOT NULL, kind TEXT NOT NULL, ref TEXT, label TEXT, at INTEGER NOT NULL);
   CREATE INDEX idx_ledger_user ON wallet_ledger(user_id, id DESC);
   CREATE TABLE deposits (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, amount INTEGER NOT NULL, status TEXT NOT NULL, provider TEXT NOT NULL, provider_ref TEXT, created_at INTEGER NOT NULL, paid_at INTEGER);
   CREATE UNIQUE INDEX idx_deposits_ref ON deposits(provider, provider_ref);
   CREATE TABLE withdrawals (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, amount INTEGER NOT NULL, fee INTEGER NOT NULL, pix_key TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL, decided_at INTEGER, note TEXT);
   CREATE INDEX idx_withdrawals_status ON withdrawals(status, id);
   CREATE TABLE listings (id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER REFERENCES users(id) ON DELETE SET NULL, seller_name TEXT, kind TEXT NOT NULL, payload TEXT NOT NULL, item_key TEXT NOT NULL, name TEXT NOT NULL, price INTEGER NOT NULL, status TEXT NOT NULL, buyer_id INTEGER, created_at INTEGER NOT NULL, closed_at INTEGER);
   CREATE INDEX idx_listings_open ON listings(status, id DESC);
   CREATE INDEX idx_listings_key ON listings(item_key, status, closed_at DESC);
   CREATE TABLE mailbox (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, payload TEXT NOT NULL, reason TEXT, created_at INTEGER NOT NULL, claimed_at INTEGER);
   CREATE INDEX idx_mailbox_user ON mailbox(user_id, claimed_at);
   CREATE TABLE item_seen (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, item_key TEXT NOT NULL, first_seen INTEGER NOT NULL, PRIMARY KEY (user_id, item_key));
   CREATE TABLE item_out (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, item_uid TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (user_id, item_uid));`,
  // Servidor autoritativo: segmentos de luta com semente, reproduzidos no servidor.
  `CREATE TABLE segments (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, seed INTEGER NOT NULL, zone TEXT NOT NULL, opts TEXT NOT NULL, at INTEGER NOT NULL, status TEXT NOT NULL);
   CREATE INDEX idx_segments_user ON segments(user_id, status);`,
  `CREATE TABLE wb_pools (pool_key TEXT PRIMARY KEY, boss TEXT NOT NULL, tier INTEGER NOT NULL, hp_total REAL NOT NULL, damage REAL NOT NULL DEFAULT 0, participants INTEGER NOT NULL DEFAULT 0, ends_at INTEGER NOT NULL);
   CREATE TABLE wb_hits (pool_key TEXT NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT, damage REAL NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (pool_key, user_id));
   CREATE INDEX idx_wb_hits_rank ON wb_hits(pool_key, damage DESC);`,
  // Economia: mercado em ouro, ouro/equipe no resumo do save (painel e ranking) e alertas econômicos.
  `ALTER TABLE listings ADD COLUMN currency TEXT NOT NULL DEFAULT 'gems';
   ALTER TABLE saves ADD COLUMN gold REAL NOT NULL DEFAULT 0;
   ALTER TABLE saves ADD COLUMN team TEXT;
   CREATE TABLE econ_flags (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, user_id INTEGER, other_id INTEGER, detail TEXT, at INTEGER NOT NULL);
   CREATE INDEX idx_econ_flags_at ON econ_flags(at DESC);
   CREATE INDEX idx_listings_sold ON listings(status, closed_at);`
];

const PG_SCHEMA = 'mythverse';
const PG_MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS ${PG_SCHEMA}.users (id BIGSERIAL PRIMARY KEY, username TEXT NOT NULL, email TEXT, pass_hash TEXT NOT NULL, recovery_hash TEXT NOT NULL, created_at BIGINT NOT NULL, last_login BIGINT, banned INTEGER NOT NULL DEFAULT 0, suspicious INTEGER NOT NULL DEFAULT 0);
   CREATE UNIQUE INDEX IF NOT EXISTS users_lname_uq ON ${PG_SCHEMA}.users (lower(username));
   CREATE UNIQUE INDEX IF NOT EXISTS users_lemail_uq ON ${PG_SCHEMA}.users (lower(email));
   CREATE TABLE IF NOT EXISTS ${PG_SCHEMA}.sessions (token_hash TEXT PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES ${PG_SCHEMA}.users(id) ON DELETE CASCADE, created_at BIGINT NOT NULL, expires_at BIGINT NOT NULL, last_seen BIGINT NOT NULL, ip TEXT, user_agent TEXT);
   CREATE INDEX IF NOT EXISTS sessions_user_idx ON ${PG_SCHEMA}.sessions(user_id);
   CREATE INDEX IF NOT EXISTS sessions_exp_idx ON ${PG_SCHEMA}.sessions(expires_at);
   CREATE TABLE IF NOT EXISTS ${PG_SCHEMA}.saves (user_id BIGINT PRIMARY KEY REFERENCES ${PG_SCHEMA}.users(id) ON DELETE CASCADE, data TEXT NOT NULL, revision INTEGER NOT NULL, updated_at BIGINT NOT NULL, play_seconds DOUBLE PRECISION NOT NULL DEFAULT 0, display_name TEXT, power BIGINT NOT NULL DEFAULT 0, boss_kills INTEGER NOT NULL DEFAULT 0, best_stage INTEGER NOT NULL DEFAULT 0, account_level INTEGER NOT NULL DEFAULT 1);
   CREATE INDEX IF NOT EXISTS saves_power_idx ON ${PG_SCHEMA}.saves(power DESC);
   CREATE INDEX IF NOT EXISTS saves_bosses_idx ON ${PG_SCHEMA}.saves(boss_kills DESC);
   CREATE TABLE IF NOT EXISTS ${PG_SCHEMA}.save_history (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES ${PG_SCHEMA}.users(id) ON DELETE CASCADE, data TEXT NOT NULL, revision INTEGER NOT NULL, created_at BIGINT NOT NULL);
   CREATE INDEX IF NOT EXISTS history_user_idx ON ${PG_SCHEMA}.save_history(user_id, id DESC);
   CREATE TABLE IF NOT EXISTS ${PG_SCHEMA}.audit (id BIGSERIAL PRIMARY KEY, user_id BIGINT, event TEXT NOT NULL, detail TEXT, ip TEXT, at BIGINT NOT NULL);
   CREATE INDEX IF NOT EXISTS audit_user_idx ON ${PG_SCHEMA}.audit(user_id, at DESC);
   CREATE INDEX IF NOT EXISTS audit_at_idx ON ${PG_SCHEMA}.audit(at);
   ALTER TABLE ${PG_SCHEMA}.users ENABLE ROW LEVEL SECURITY;
   ALTER TABLE ${PG_SCHEMA}.sessions ENABLE ROW LEVEL SECURITY;
   ALTER TABLE ${PG_SCHEMA}.saves ENABLE ROW LEVEL SECURITY;
   ALTER TABLE ${PG_SCHEMA}.save_history ENABLE ROW LEVEL SECURITY;
   ALTER TABLE ${PG_SCHEMA}.audit ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE ${PG_SCHEMA}.saves ADD COLUMN IF NOT EXISTS rift_best INTEGER NOT NULL DEFAULT 0;
   CREATE INDEX IF NOT EXISTS saves_rift_idx ON ${PG_SCHEMA}.saves(rift_best DESC);
   CREATE TABLE IF NOT EXISTS ${PG_SCHEMA}.wallets (user_id BIGINT PRIMARY KEY REFERENCES ${PG_SCHEMA}.users(id) ON DELETE CASCADE, balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0), held BIGINT NOT NULL DEFAULT 0 CHECK (held >= 0), updated_at BIGINT NOT NULL);
   CREATE TABLE IF NOT EXISTS ${PG_SCHEMA}.wallet_ledger (id BIGSERIAL PRIMARY KEY, user_id BIGINT, delta BIGINT NOT NULL, kind TEXT NOT NULL, ref TEXT, label TEXT, at BIGINT NOT NULL);
   CREATE INDEX IF NOT EXISTS ledger_user_idx ON ${PG_SCHEMA}.wallet_ledger(user_id, id DESC);
   CREATE TABLE IF NOT EXISTS ${PG_SCHEMA}.deposits (id BIGSERIAL PRIMARY KEY, user_id BIGINT REFERENCES ${PG_SCHEMA}.users(id) ON DELETE SET NULL, amount BIGINT NOT NULL, status TEXT NOT NULL, provider TEXT NOT NULL, provider_ref TEXT, created_at BIGINT NOT NULL, paid_at BIGINT);
   CREATE UNIQUE INDEX IF NOT EXISTS deposits_ref_uq ON ${PG_SCHEMA}.deposits(provider, provider_ref);
   CREATE TABLE IF NOT EXISTS ${PG_SCHEMA}.withdrawals (id BIGSERIAL PRIMARY KEY, user_id BIGINT REFERENCES ${PG_SCHEMA}.users(id) ON DELETE SET NULL, amount BIGINT NOT NULL, fee BIGINT NOT NULL, pix_key TEXT NOT NULL, status TEXT NOT NULL, created_at BIGINT NOT NULL, decided_at BIGINT, note TEXT);
   CREATE INDEX IF NOT EXISTS withdrawals_status_idx ON ${PG_SCHEMA}.withdrawals(status, id);
   CREATE TABLE IF NOT EXISTS ${PG_SCHEMA}.listings (id BIGSERIAL PRIMARY KEY, seller_id BIGINT REFERENCES ${PG_SCHEMA}.users(id) ON DELETE SET NULL, seller_name TEXT, kind TEXT NOT NULL, payload TEXT NOT NULL, item_key TEXT NOT NULL, name TEXT NOT NULL, price BIGINT NOT NULL, status TEXT NOT NULL, buyer_id BIGINT, created_at BIGINT NOT NULL, closed_at BIGINT);
   CREATE INDEX IF NOT EXISTS listings_open_idx ON ${PG_SCHEMA}.listings(status, id DESC);
   CREATE INDEX IF NOT EXISTS listings_key_idx ON ${PG_SCHEMA}.listings(item_key, status, closed_at DESC);
   CREATE TABLE IF NOT EXISTS ${PG_SCHEMA}.mailbox (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES ${PG_SCHEMA}.users(id) ON DELETE CASCADE, kind TEXT NOT NULL, payload TEXT NOT NULL, reason TEXT, created_at BIGINT NOT NULL, claimed_at BIGINT);
   CREATE INDEX IF NOT EXISTS mailbox_user_idx ON ${PG_SCHEMA}.mailbox(user_id, claimed_at);
   CREATE TABLE IF NOT EXISTS ${PG_SCHEMA}.item_seen (user_id BIGINT NOT NULL REFERENCES ${PG_SCHEMA}.users(id) ON DELETE CASCADE, item_key TEXT NOT NULL, first_seen BIGINT NOT NULL, PRIMARY KEY (user_id, item_key));
   CREATE TABLE IF NOT EXISTS ${PG_SCHEMA}.item_out (user_id BIGINT NOT NULL REFERENCES ${PG_SCHEMA}.users(id) ON DELETE CASCADE, item_uid TEXT NOT NULL, at BIGINT NOT NULL, PRIMARY KEY (user_id, item_uid));
   ALTER TABLE ${PG_SCHEMA}.wallets ENABLE ROW LEVEL SECURITY;
   ALTER TABLE ${PG_SCHEMA}.wallet_ledger ENABLE ROW LEVEL SECURITY;
   ALTER TABLE ${PG_SCHEMA}.deposits ENABLE ROW LEVEL SECURITY;
   ALTER TABLE ${PG_SCHEMA}.withdrawals ENABLE ROW LEVEL SECURITY;
   ALTER TABLE ${PG_SCHEMA}.listings ENABLE ROW LEVEL SECURITY;
   ALTER TABLE ${PG_SCHEMA}.mailbox ENABLE ROW LEVEL SECURITY;
   ALTER TABLE ${PG_SCHEMA}.item_seen ENABLE ROW LEVEL SECURITY;
   ALTER TABLE ${PG_SCHEMA}.item_out ENABLE ROW LEVEL SECURITY`,
  `CREATE TABLE IF NOT EXISTS ${PG_SCHEMA}.segments (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES ${PG_SCHEMA}.users(id) ON DELETE CASCADE, seed BIGINT NOT NULL, zone TEXT NOT NULL, opts TEXT NOT NULL, at BIGINT NOT NULL, status TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS segments_user_idx ON ${PG_SCHEMA}.segments(user_id, status);
   ALTER TABLE ${PG_SCHEMA}.segments ENABLE ROW LEVEL SECURITY`,
  `CREATE TABLE IF NOT EXISTS ${PG_SCHEMA}.wb_pools (pool_key TEXT PRIMARY KEY, boss TEXT NOT NULL, tier INTEGER NOT NULL, hp_total DOUBLE PRECISION NOT NULL, damage DOUBLE PRECISION NOT NULL DEFAULT 0, participants INTEGER NOT NULL DEFAULT 0, ends_at BIGINT NOT NULL);
   CREATE TABLE IF NOT EXISTS ${PG_SCHEMA}.wb_hits (pool_key TEXT NOT NULL, user_id BIGINT NOT NULL REFERENCES ${PG_SCHEMA}.users(id) ON DELETE CASCADE, name TEXT, damage DOUBLE PRECISION NOT NULL, at BIGINT NOT NULL, PRIMARY KEY (pool_key, user_id));
   CREATE INDEX IF NOT EXISTS wb_hits_rank_idx ON ${PG_SCHEMA}.wb_hits(pool_key, damage DESC);
   ALTER TABLE ${PG_SCHEMA}.wb_pools ENABLE ROW LEVEL SECURITY;
   ALTER TABLE ${PG_SCHEMA}.wb_hits ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE ${PG_SCHEMA}.listings ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'gems';
   ALTER TABLE ${PG_SCHEMA}.saves ADD COLUMN IF NOT EXISTS gold DOUBLE PRECISION NOT NULL DEFAULT 0;
   ALTER TABLE ${PG_SCHEMA}.saves ADD COLUMN IF NOT EXISTS team TEXT;
   CREATE TABLE IF NOT EXISTS ${PG_SCHEMA}.econ_flags (id BIGSERIAL PRIMARY KEY, kind TEXT NOT NULL, user_id BIGINT, other_id BIGINT, detail TEXT, at BIGINT NOT NULL);
   CREATE INDEX IF NOT EXISTS econ_flags_at_idx ON ${PG_SCHEMA}.econ_flags(at DESC);
   CREATE INDEX IF NOT EXISTS listings_sold_idx ON ${PG_SCHEMA}.listings(status, closed_at);
   ALTER TABLE ${PG_SCHEMA}.econ_flags ENABLE ROW LEVEL SECURITY`
];

// ---------------------------------------------------------------------------
// Drivers: all(sql, params) → linhas · run(sql, params) → nº de linhas afetadas · tx(fn)
// ---------------------------------------------------------------------------
class SqliteDriver {
  constructor(file) {
    const { DatabaseSync } = require('node:sqlite');
    this.kind = 'sqlite'; this.prefix = ''; this.forUpdate = ''; this.file = file;
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive:true });
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    this.cache = new Map();
    this.inTx = false;
  }
  stmt(sql) { let s = this.cache.get(sql); if (!s) { s = this.db.prepare(sql); this.cache.set(sql, s); } return s; }
  async all(sql, params = []) { return this.stmt(sql).all(...params); }
  async run(sql, params = []) { return Number(this.stmt(sql).run(...params).changes); }
  async exec(sql) { this.db.exec(sql); }
  // node:sqlite é síncrono: o corpo da transação só aguarda promessas já resolvidas, então
  // nenhuma outra requisição consegue se intercalar entre o BEGIN e o COMMIT.
  async tx(fn) {
    if (this.inTx) return fn(this);
    this.db.exec('BEGIN IMMEDIATE'); this.inTx = true;
    try { const out = await fn(this); this.db.exec('COMMIT'); return out; }
    catch (err) { try { this.db.exec('ROLLBACK'); } catch (_) {} throw err; }
    finally { this.inTx = false; }
  }
  async migrate() {
    this.db.exec('CREATE TABLE IF NOT EXISTS schema_version (v INTEGER NOT NULL)');
    let row = this.db.prepare('SELECT v FROM schema_version').get();
    if (!row) { this.db.prepare('INSERT INTO schema_version (v) VALUES (0)').run(); row = { v:0 }; }
    for (let v = row.v; v < SQLITE_MIGRATIONS.length; v++) await this.tx(async () => { this.db.exec(SQLITE_MIGRATIONS[v]); this.db.prepare('UPDATE schema_version SET v = ?').run(v + 1); });
    const check = this.db.prepare('PRAGMA quick_check').get();
    if (check && Object.values(check)[0] !== 'ok') throw new Error(`Banco de dados corrompido: ${JSON.stringify(check)}`);
  }
  backup(dir, keep) {
    if (this.file === ':memory:') return null;
    fs.mkdirSync(dir, { recursive:true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const target = path.join(dir, `mythverse-${stamp}.db`);
    this.db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
    const files = fs.readdirSync(dir).filter(f => /^mythverse-.*\.db$/.test(f)).sort();
    while (files.length > keep) fs.unlinkSync(path.join(dir, files.shift()));
    return target;
  }
  async close() { try { this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch (_) {} this.db.close(); }
}

// Converte "?" em "$1, $2…" (os textos SQL deste arquivo não usam "?" dentro de strings).
const toPg = sql => { let i = 0; return sql.replace(/\?/g, () => `$${++i}`); };

class PgDriver {
  constructor(url, opts = {}) {
    const pg = require('pg');
    pg.types.setTypeParser(20, v => (v === null ? null : Number(v)));   // BIGINT → number
    pg.types.setTypeParser(1700, v => (v === null ? null : Number(v))); // NUMERIC → number
    this.kind = 'postgres'; this.prefix = `${PG_SCHEMA}.`; this.forUpdate = ' FOR UPDATE';
    const ssl = opts.ssl ?? sslFor(url);
    this.pool = new pg.Pool({ connectionString:url, ssl, max:Number(process.env.PG_POOL_MAX || 5), idleTimeoutMillis:30_000, connectionTimeoutMillis:10_000, keepAlive:true });
    this.pool.on('error', err => console.error('PostgreSQL (conexão ociosa):', err.message));
  }
  async all(sql, params = []) { return (await this.pool.query(toPg(sql), params)).rows; }
  async run(sql, params = []) { return (await this.pool.query(toPg(sql), params)).rowCount; }
  async exec(sql) { await this.pool.query(sql); }
  async tx(fn) {
    const client = await this.pool.connect();
    const scoped = { kind:this.kind, prefix:this.prefix, forUpdate:this.forUpdate,
      all:async (sql, p = []) => (await client.query(toPg(sql), p)).rows,
      run:async (sql, p = []) => (await client.query(toPg(sql), p)).rowCount };
    scoped.tx = f => f(scoped);
    try { await client.query('BEGIN'); const out = await fn(scoped); await client.query('COMMIT'); return out; }
    catch (err) { try { await client.query('ROLLBACK'); } catch (_) {} throw err; }
    finally { client.release(); }
  }
  async migrate() { await migratePg(this); }
  backup() { return null; } // No Supabase/Neon os backups são feitos pelo provedor.
  async close() { await this.pool.end(); }
}

// Mesmo dialeto do Postgres, sobre PGlite (Postgres em WebAssembly), usado nos testes.
class PgliteDriver {
  constructor(db) { this.db = db; this.kind = 'postgres'; this.prefix = `${PG_SCHEMA}.`; this.forUpdate = ' FOR UPDATE'; }
  async all(sql, params = []) { return normalize((await this.db.query(toPg(sql), params)).rows); }
  async run(sql, params = []) { return (await this.db.query(toPg(sql), params)).affectedRows ?? 0; }
  async exec(sql) { await this.db.exec(sql); }
  async tx(fn) {
    return this.db.transaction(async t => {
      const scoped = { kind:this.kind, prefix:this.prefix, forUpdate:this.forUpdate,
        all:async (sql, p = []) => normalize((await t.query(toPg(sql), p)).rows),
        run:async (sql, p = []) => (await t.query(toPg(sql), p)).affectedRows ?? 0 };
      scoped.tx = f => f(scoped);
      return fn(scoped);
    });
  }
  async migrate() { await migratePg(this); }
  backup() { return null; }
  async close() { await this.db.close(); }
}
const normalize = rows => rows.map(r => { const o = {}; for (const [k, v] of Object.entries(r)) o[k] = typeof v === 'bigint' ? Number(v) : v; return o; });

async function migratePg(d) {
  await d.exec(`CREATE SCHEMA IF NOT EXISTS ${PG_SCHEMA}`);
  await d.exec(`CREATE TABLE IF NOT EXISTS ${PG_SCHEMA}.schema_version (v INTEGER NOT NULL)`);
  await d.tx(async t => {
    let rows = await t.all(`SELECT v FROM ${PG_SCHEMA}.schema_version`);
    if (!rows.length) { await t.run(`INSERT INTO ${PG_SCHEMA}.schema_version (v) VALUES (0)`); rows = [{ v:0 }]; }
    for (let v = rows[0].v; v < PG_MIGRATIONS.length; v++) {
      for (const stmt of PG_MIGRATIONS[v].split(';').map(x => x.trim()).filter(Boolean)) await t.run(stmt);
      await t.run(`UPDATE ${PG_SCHEMA}.schema_version SET v = ?`, [v + 1]);
    }
  });
  await d.exec(`ALTER TABLE ${PG_SCHEMA}.schema_version ENABLE ROW LEVEL SECURITY`);
}

// Supabase, Neon e afins exigem TLS. DATABASE_CA (certificado PEM) ativa a verificação completa.
function sslFor(url) {
  if (process.env.PGSSL === '0' || /sslmode=disable/.test(url) || /@(localhost|127\.0\.0\.1)[:/]/.test(url)) return false;
  if (process.env.DATABASE_CA) return { ca:process.env.DATABASE_CA.replace(/\\n/g, '\n'), rejectUnauthorized:true };
  return { rejectUnauthorized:false };
}

// ---------------------------------------------------------------------------
// Repositório (todas as consultas do jogo)
// ---------------------------------------------------------------------------
function repo(d) {
  const T = d.prefix;
  const one = async (sql, p) => (await d.all(sql, p))[0] || null;
  return {
    counts: async () => one(`SELECT (SELECT COUNT(*) FROM ${T}users) AS users, (SELECT COUNT(*) FROM ${T}sessions) AS sessions, (SELECT COUNT(*) FROM ${T}saves) AS saves`),
    userByName: u => one(`SELECT * FROM ${T}users WHERE lower(username) = lower(?)`, [u]),
    userByEmail: e => one(`SELECT * FROM ${T}users WHERE lower(email) = lower(?)`, [e]),
    userById: id => one(`SELECT * FROM ${T}users WHERE id = ?`, [id]),
    insertUser: async (username, email, passHash, recHash, now) => Number((await one(`INSERT INTO ${T}users (username, email, pass_hash, recovery_hash, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id`, [username, email, passHash, recHash, now])).id),
    setPassword: (id, h) => d.run(`UPDATE ${T}users SET pass_hash = ? WHERE id = ?`, [h, id]),
    setRecovery: (id, h) => d.run(`UPDATE ${T}users SET recovery_hash = ? WHERE id = ?`, [h, id]),
    touchLogin: (id, now) => d.run(`UPDATE ${T}users SET last_login = ? WHERE id = ?`, [now, id]),
    flagSuspicious: id => d.run(`UPDATE ${T}users SET suspicious = suspicious + 1 WHERE id = ?`, [id]),
    deleteUser: id => d.run(`DELETE FROM ${T}users WHERE id = ?`, [id]),
    insertSession: (hash, uid, now, exp, ip, ua) => d.run(`INSERT INTO ${T}sessions (token_hash, user_id, created_at, expires_at, last_seen, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)`, [hash, uid, now, exp, now, ip, ua]),
    sessionByHash: (hash, now) => one(`SELECT s.*, u.username, u.banned FROM ${T}sessions s JOIN ${T}users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`, [hash, now]),
    touchSession: (now, exp, hash) => d.run(`UPDATE ${T}sessions SET last_seen = ?, expires_at = ? WHERE token_hash = ?`, [now, exp, hash]),
    deleteSession: hash => d.run(`DELETE FROM ${T}sessions WHERE token_hash = ?`, [hash]),
    deleteUserSessions: uid => d.run(`DELETE FROM ${T}sessions WHERE user_id = ?`, [uid]),
    deleteOtherSessions: (uid, hash) => d.run(`DELETE FROM ${T}sessions WHERE user_id = ? AND token_hash <> ?`, [uid, hash]),
    purgeSessions: now => d.run(`DELETE FROM ${T}sessions WHERE expires_at <= ?`, [now]),
    purgeAudit: before => d.run(`DELETE FROM ${T}audit WHERE at < ?`, [before]),
    getSave: async (uid, lock = false) => { const r = await one(`SELECT * FROM ${T}saves WHERE user_id = ?${lock ? d.forUpdate : ''}`, [uid]); if (r) r.data = unpack(r.data); return r; },
    insertSave: (uid, json, now, s) => d.run(`INSERT INTO ${T}saves (user_id, data, revision, updated_at, play_seconds, display_name, power, boss_kills, best_stage, account_level, rift_best, gold, team) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [uid, pack(json), now, s.playSeconds, s.name, s.power, s.bossKills, s.bestStage, s.accountLevel, s.riftBest || 0, s.gold || 0, s.team || null]),
    updateSave: (uid, json, now, s, revision) => d.run(`UPDATE ${T}saves SET data = ?, revision = revision + 1, updated_at = ?, play_seconds = ?, display_name = ?, power = ?, boss_kills = ?, best_stage = ?, account_level = ?, rift_best = ?, gold = ?, team = ? WHERE user_id = ? AND revision = ?`, [pack(json), now, s.playSeconds, s.name, s.power, s.bossKills, s.bestStage, s.accountLevel, s.riftBest || 0, s.gold || 0, s.team || null, uid, revision]),
    insertHistory: (uid, json, revision, now) => d.run(`INSERT INTO ${T}save_history (user_id, data, revision, created_at) VALUES (?, ?, ?, ?)`, [uid, pack(json), revision, now]),
    trimHistory: (uid, keep) => d.run(`DELETE FROM ${T}save_history WHERE user_id = ? AND id NOT IN (SELECT id FROM ${T}save_history WHERE user_id = ? ORDER BY id DESC LIMIT ?)`, [uid, uid, keep]),
    listHistory: uid => d.all(`SELECT id, revision, created_at FROM ${T}save_history WHERE user_id = ? ORDER BY id DESC`, [uid]),
    getHistory: async (id, uid) => { const r = await one(`SELECT * FROM ${T}save_history WHERE id = ? AND user_id = ?`, [id, uid]); if (r) r.data = unpack(r.data); return r; },
    audit: (uid, event, detail, ip, at) => d.run(`INSERT INTO ${T}audit (user_id, event, detail, ip, at) VALUES (?, ?, ?, ?, ?)`, [uid, event, detail, ip, at]),
    leaderboard: (type, limit) => {
      const order = type === 'bosses' ? 's.boss_kills DESC, s.power DESC' : type === 'stage' ? 's.best_stage DESC, s.power DESC' : type === 'rift' ? 's.rift_best DESC, s.power DESC' : 's.power DESC';
      return d.all(`SELECT s.user_id AS id, s.display_name AS name, s.team, s.power, s.boss_kills, s.best_stage, s.rift_best, s.account_level FROM ${T}saves s JOIN ${T}users u ON u.id = s.user_id WHERE u.banned = 0 AND u.suspicious < 3 ORDER BY ${order} LIMIT ?`, [limit]);
    },
    // ---- carteira (valores em centavos = Gemas) ----
    wallet: async uid => (await one(`SELECT balance, held FROM ${T}wallets WHERE user_id = ?`, [uid])) || { balance:0, held:0 },
    walletLock: async uid => { await d.run(`INSERT INTO ${T}wallets (user_id, balance, held, updated_at) VALUES (?, 0, 0, ?) ON CONFLICT (user_id) DO NOTHING`, [uid, Date.now()]); return one(`SELECT balance, held FROM ${T}wallets WHERE user_id = ?${d.forUpdate}`, [uid]); },
    // Muda saldo (e/ou reserva) só se não ficar negativo. Devolve true/false.
    walletMove: async (uid, dBalance, dHeld, now) => (await d.run(`UPDATE ${T}wallets SET balance = balance + ?, held = held + ?, updated_at = ? WHERE user_id = ? AND balance + ? >= 0 AND held + ? >= 0`, [dBalance, dHeld, now, uid, dBalance, dHeld])) === 1,
    ledger: (uid, delta, kind, ref, label, at) => d.run(`INSERT INTO ${T}wallet_ledger (user_id, delta, kind, ref, label, at) VALUES (?, ?, ?, ?, ?, ?)`, [uid, delta, kind, ref, label, at]),
    ledgerOf: (uid, limit) => d.all(`SELECT delta, kind, label, at FROM ${T}wallet_ledger WHERE user_id = ? ORDER BY id DESC LIMIT ?`, [uid, limit]),
    houseTotal: async () => Number((await one(`SELECT COALESCE(SUM(delta), 0) AS t FROM ${T}wallet_ledger WHERE user_id IS NULL`)).t),
    insertDeposit: async (uid, amount, provider, ref, now) => Number((await one(`INSERT INTO ${T}deposits (user_id, amount, status, provider, provider_ref, created_at) VALUES (?, ?, 'pending', ?, ?, ?) RETURNING id`, [uid, amount, provider, ref, now])).id),
    depositByRef: (provider, ref, lock = false) => one(`SELECT * FROM ${T}deposits WHERE provider = ? AND provider_ref = ?${lock ? d.forUpdate : ''}`, [provider, ref]),
    setDepositRef: (id, ref) => d.run(`UPDATE ${T}deposits SET provider_ref = ? WHERE id = ?`, [ref, id]),
    markDepositPaid: (id, now) => d.run(`UPDATE ${T}deposits SET status = 'paid', paid_at = ? WHERE id = ? AND status = 'pending'`, [now, id]),
    insertWithdrawal: async (uid, amount, fee, key, now) => Number((await one(`INSERT INTO ${T}withdrawals (user_id, amount, fee, pix_key, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?) RETURNING id`, [uid, amount, fee, key, now])).id),
    withdrawalsOf: uid => d.all(`SELECT id, amount, fee, status, created_at, decided_at FROM ${T}withdrawals WHERE user_id = ? ORDER BY id DESC LIMIT 10`, [uid]),
    withdrawalsToday: async (uid, since) => Number((await one(`SELECT COALESCE(SUM(amount), 0) AS t FROM ${T}withdrawals WHERE user_id = ? AND created_at >= ? AND status <> 'rejected'`, [uid, since])).t),
    pendingWithdrawals: () => d.all(`SELECT w.*, u.username FROM ${T}withdrawals w LEFT JOIN ${T}users u ON u.id = w.user_id WHERE w.status = 'pending' ORDER BY w.id`),
    withdrawalLock: id => one(`SELECT * FROM ${T}withdrawals WHERE id = ?${d.forUpdate}`, [id]),
    decideWithdrawal: (id, status, note, now) => d.run(`UPDATE ${T}withdrawals SET status = ?, note = ?, decided_at = ? WHERE id = ? AND status = 'pending'`, [status, note, now, id]),
    // ---- mercado ----
    insertListing: async (l) => Number((await one(`INSERT INTO ${T}listings (seller_id, seller_name, kind, payload, item_key, name, price, status, created_at, currency) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?) RETURNING id`, [l.sellerId, l.sellerName, l.kind, l.payload, l.key, l.name, l.price, l.now, l.currency || 'gems'])).id),
    openListings: ({ kind, q, sort, limit, sellerId, currency }) => {
      const where = [`status = 'open'`], p = [];
      if (currency) { where.push('currency = ?'); p.push(currency); }
      if (kind) { where.push('kind = ?'); p.push(kind); }
      if (sellerId) { where.push('seller_id = ?'); p.push(sellerId); }
      if (q) { where.push('lower(name) LIKE ?'); p.push(`%${q.toLowerCase().replace(/[%_]/g, '')}%`); }
      const order = sort === 'price' ? 'price ASC, id DESC' : sort === '-price' ? 'price DESC, id DESC' : 'id DESC';
      return d.all(`SELECT id, seller_id, seller_name, kind, payload, price, created_at, currency FROM ${T}listings WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ?`, [...p, limit]);
    },
    publicProfile: uid => one(`SELECT u.id, u.username, u.created_at, u.banned, s.power, s.boss_kills, s.best_stage, s.rift_best, s.account_level, s.play_seconds FROM ${T}users u LEFT JOIN ${T}saves s ON s.user_id = u.id WHERE u.id = ?`, [uid]),
    salesOf: async uid => Number((await one(`SELECT COUNT(*) AS n FROM ${T}listings WHERE seller_id = ? AND status = 'sold'`, [uid])).n),
    listingsOf: uid => d.all(`SELECT id, seller_id, seller_name, kind, payload, price, created_at, currency FROM ${T}listings WHERE seller_id = ? AND status = 'open' ORDER BY id DESC`, [uid]),
    countOpenOf: async uid => Number((await one(`SELECT COUNT(*) AS n FROM ${T}listings WHERE seller_id = ? AND status = 'open'`, [uid])).n),
    countListedSince: async (uid, since) => Number((await one(`SELECT COUNT(*) AS n FROM ${T}listings WHERE seller_id = ? AND created_at >= ?`, [uid, since])).n),
    listingLock: id => one(`SELECT * FROM ${T}listings WHERE id = ?${d.forUpdate}`, [id]),
    closeListing: (id, status, buyer, now) => d.run(`UPDATE ${T}listings SET status = ?, buyer_id = ?, closed_at = ? WHERE id = ? AND status = 'open'`, [status, buyer, now, id]),
    staleListings: before => d.all(`SELECT id FROM ${T}listings WHERE status = 'open' AND created_at < ?`, [before]),
    priceHistory: (key, currency = 'gems') => d.all(`SELECT price, closed_at FROM ${T}listings WHERE item_key = ? AND currency = ? AND status = 'sold' ORDER BY closed_at DESC LIMIT 20`, [key, currency]),
    // ---- controle econômico ----
    flag: (kind, uid, other, detail, at) => d.run(`INSERT INTO ${T}econ_flags (kind, user_id, other_id, detail, at) VALUES (?, ?, ?, ?, ?)`, [kind, uid, other, String(detail || '').slice(0, 300), at]),
    flags: limit => d.all(`SELECT f.id, f.kind, f.user_id, f.other_id, f.detail, f.at, u.username AS user_name, o.username AS other_name FROM ${T}econ_flags f LEFT JOIN ${T}users u ON u.id = f.user_id LEFT JOIN ${T}users o ON o.id = f.other_id ORDER BY f.id DESC LIMIT ?`, [limit]),
    pairTrades: async (a, b, since) => Number((await one(`SELECT COUNT(*) AS n FROM ${T}listings WHERE status = 'sold' AND closed_at >= ? AND ((seller_id = ? AND buyer_id = ?) OR (seller_id = ? AND buyer_id = ?))`, [since, a, b, b, a])).n),
    recentIps: async (uid, since) => new Set((await d.all(`SELECT DISTINCT ip FROM ${T}audit WHERE user_id = ? AND at >= ? AND ip IS NOT NULL AND event IN ('login', 'register', 'market_buy', 'deposit_created', 'withdraw_request')`, [uid, since])).map(r => r.ip)),
    recentCredits: async (uid, kind, since) => Number((await one(`SELECT COALESCE(SUM(delta), 0) AS t FROM ${T}wallet_ledger WHERE user_id = ? AND kind = ? AND at >= ?`, [uid, kind, since])).t),
    econStats: async (since1, since7) => {
      const v = async (sql, p = []) => (await one(sql, p)) || {};
      const gold = await v(`SELECT COALESCE(SUM(gold), 0) AS total, COUNT(*) AS saves, COALESCE(AVG(gold), 0) AS avg, COALESCE(MAX(gold), 0) AS max FROM ${T}saves`);
      const gems = await v(`SELECT COALESCE(SUM(balance), 0) AS balance, COALESCE(SUM(held), 0) AS held FROM ${T}wallets`);
      const vol = await d.all(`SELECT currency, COUNT(*) AS n, COALESCE(SUM(price), 0) AS total, SUM(CASE WHEN closed_at >= ? THEN 1 ELSE 0 END) AS n1, COALESCE(SUM(CASE WHEN closed_at >= ? THEN price ELSE 0 END), 0) AS total1 FROM ${T}listings WHERE status = 'sold' AND closed_at >= ? GROUP BY currency`, [since1, since1, since7]);
      const open = await d.all(`SELECT currency, COUNT(*) AS n FROM ${T}listings WHERE status = 'open' GROUP BY currency`);
      const top = await d.all(`SELECT name, currency, COUNT(*) AS n, MIN(price) AS lo, MAX(price) AS hi FROM ${T}listings WHERE status = 'sold' AND closed_at >= ? GROUP BY name, currency ORDER BY n DESC LIMIT 15`, [since7]);
      const dep = await v(`SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS n FROM ${T}deposits WHERE status = 'paid' AND paid_at >= ?`, [since7]);
      const wd = await v(`SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS n FROM ${T}withdrawals WHERE status = 'paid' AND decided_at >= ?`, [since7]);
      const fees = await v(`SELECT COALESCE(SUM(delta), 0) AS total FROM ${T}wallet_ledger WHERE user_id IS NULL AND at >= ?`, [since7]);
      const rich = await d.all(`SELECT s.display_name AS name, s.gold, s.power FROM ${T}saves s ORDER BY s.gold DESC LIMIT 10`);
      return { gold, gems, vol, open, top, dep, wd, fees, rich };
    },
    insertMail: (uid, kind, payload, reason, now) => d.run(`INSERT INTO ${T}mailbox (user_id, kind, payload, reason, created_at) VALUES (?, ?, ?, ?, ?)`, [uid, kind, payload, reason, now]),
    mailOf: uid => d.all(`SELECT id, kind, payload, reason, created_at FROM ${T}mailbox WHERE user_id = ? AND claimed_at IS NULL ORDER BY id`, [uid]),
    mailLock: (id, uid) => one(`SELECT * FROM ${T}mailbox WHERE id = ? AND user_id = ? AND claimed_at IS NULL${d.forUpdate}`, [id, uid]),
    claimMail: (id, now) => d.run(`UPDATE ${T}mailbox SET claimed_at = ? WHERE id = ? AND claimed_at IS NULL`, [now, id]),
    // ---- procedência: quando cada item apareceu no save do servidor, e quais saíram pelo mercado ----
    seeItems: async (uid, keys, now) => {
      for (let i = 0; i < keys.length; i += 100) {
        const chunk = keys.slice(i, i + 100);
        await d.run(`INSERT INTO ${T}item_seen (user_id, item_key, first_seen) VALUES ${chunk.map(() => '(?, ?, ?)').join(', ')} ON CONFLICT (user_id, item_key) DO NOTHING`, chunk.flatMap(k => [uid, k, now]));
      }
    },
    seenAt: async (uid, key) => (await one(`SELECT first_seen FROM ${T}item_seen WHERE user_id = ? AND item_key = ?`, [uid, key]))?.first_seen ?? null,
    resetSeen: (uid, key, now) => d.run(`UPDATE ${T}item_seen SET first_seen = ? WHERE user_id = ? AND item_key = ?`, [now, uid, key]),
    forgetSeen: (uid, key) => d.run(`DELETE FROM ${T}item_seen WHERE user_id = ? AND item_key = ?`, [uid, key]),
    markOut: (uid, itemUid, now) => d.run(`INSERT INTO ${T}item_out (user_id, item_uid, at) VALUES (?, ?, ?) ON CONFLICT (user_id, item_uid) DO NOTHING`, [uid, itemUid, now]),
    unmarkOut: (uid, itemUid) => d.run(`DELETE FROM ${T}item_out WHERE user_id = ? AND item_uid = ?`, [uid, itemUid]),
    outUids: async uid => new Set((await d.all(`SELECT item_uid FROM ${T}item_out WHERE user_id = ?`, [uid])).map(r => r.item_uid)),
    // ---- segmentos de luta ----
    openSegment: uid => one(`SELECT * FROM ${T}segments WHERE user_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1`, [uid]),
    insertSegment: async (uid, seed, zone, opts, at) => Number((await one(`INSERT INTO ${T}segments (user_id, seed, zone, opts, at, status) VALUES (?, ?, ?, ?, ?, 'open') RETURNING id`, [uid, seed, zone, opts, at])).id),
    closeSegment: (id, status) => d.run(`UPDATE ${T}segments SET status = ? WHERE id = ? AND status = 'open'`, [status, id]),
    closeOpenSegments: uid => d.run(`UPDATE ${T}segments SET status = 'void' WHERE user_id = ? AND status = 'open'`, [uid]),
    purgeSegments: before => d.run(`DELETE FROM ${T}segments WHERE at < ?`, [before]),
    // ---- Invasão Mundial ----
    wbPool: key => one(`SELECT * FROM ${T}wb_pools WHERE pool_key = ?`, [key]),
    wbEnsurePool: (key, boss, tier, hp, endsAt) => d.run(`INSERT INTO ${T}wb_pools (pool_key, boss, tier, hp_total, damage, participants, ends_at) VALUES (?, ?, ?, ?, 0, 0, ?) ON CONFLICT (pool_key) DO NOTHING`, [key, boss, tier, hp, endsAt]),
    wbAddHit: async (key, uid, name, dmg, at) => {
      const n = await d.run(`INSERT INTO ${T}wb_hits (pool_key, user_id, name, damage, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (pool_key, user_id) DO NOTHING`, [key, uid, name, dmg, at]);
      if (n) await d.run(`UPDATE ${T}wb_pools SET damage = damage + ?, participants = participants + 1 WHERE pool_key = ?`, [dmg, key]);
      return n;
    },
    wbTop: (key, limit) => d.all(`SELECT name, damage FROM ${T}wb_hits WHERE pool_key = ? ORDER BY damage DESC LIMIT ?`, [key, limit]),
    wbRank: async (key, dmg) => Number((await one(`SELECT COUNT(*) AS n FROM ${T}wb_hits WHERE pool_key = ? AND damage > ?`, [key, dmg])).n),
    rankOf: async power => Number((await one(`SELECT COUNT(*) + 1 AS rank FROM ${T}saves s JOIN ${T}users u ON u.id = s.user_id WHERE u.banned = 0 AND u.suspicious < 3 AND s.power > ?`, [power])).rank)
  };
}

class Store {
  constructor(driver, opts = {}) {
    this.d = driver; this.kind = driver.kind;
    this.backupDir = opts.backupDir; this.keepBackups = opts.keepBackups || 14;
    this.historyPerUser = opts.historyPerUser || Number(process.env.HISTORY_PER_USER) || (driver.kind === 'postgres' ? 8 : 20);
    Object.assign(this, repo(driver));
  }
  async init() { await this.d.migrate(); return this; }
  transaction(fn) { return this.d.tx(td => fn(repo(td))); }
  backup() { return this.d.backup(this.backupDir, this.keepBackups); }
  close() { return this.d.close(); }
}

// Escolhe o banco pelo ambiente: DATABASE_URL → PostgreSQL; senão SQLite em DATA_DIR.
async function openStore({ databaseUrl, dbFile, dataDir, pglite } = {}) {
  let driver;
  if (pglite) driver = new PgliteDriver(pglite);
  else if (databaseUrl) driver = new PgDriver(databaseUrl);
  else driver = new SqliteDriver(dbFile || path.join(dataDir, 'mythverse.db'));
  const store = new Store(driver, { backupDir:path.join(dataDir || '.', 'backups') });
  return store.init();
}

module.exports = { openStore, Store, SqliteDriver, PgDriver, PgliteDriver, pack, unpack, toPg };
