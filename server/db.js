'use strict';
// Camada de banco de dados — SQLite embutido do Node (node:sqlite), sem dependências.
// WAL + synchronous=NORMAL: resistente a quedas; backups periódicos com VACUUM INTO.
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const MIGRATIONS = [
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

class Store {
  constructor(file, opts = {}) {
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
    this.prepare();
  }

  migrate() {
    this.db.exec('CREATE TABLE IF NOT EXISTS schema_version (v INTEGER NOT NULL)');
    const row = this.db.prepare('SELECT v FROM schema_version').get();
    let v = row ? row.v : 0;
    if (!row) this.db.prepare('INSERT INTO schema_version (v) VALUES (0)').run();
    for (; v < MIGRATIONS.length; v++) {
      this.tx(() => { this.db.exec(MIGRATIONS[v]); this.db.prepare('UPDATE schema_version SET v = ?').run(v + 1); });
    }
  }

  tx(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const out = fn(); this.db.exec('COMMIT'); return out; }
    catch (err) { try { this.db.exec('ROLLBACK'); } catch (_) {} throw err; }
  }

  prepare() {
    const q = sql => this.db.prepare(sql);
    this.q = {
      userByName: q('SELECT * FROM users WHERE username = ?'),
      userByEmail: q('SELECT * FROM users WHERE email = ?'),
      userById: q('SELECT * FROM users WHERE id = ?'),
      insertUser: q('INSERT INTO users (username, email, pass_hash, recovery_hash, created_at) VALUES (?, ?, ?, ?, ?)'),
      setPassword: q('UPDATE users SET pass_hash = ? WHERE id = ?'),
      setRecovery: q('UPDATE users SET recovery_hash = ? WHERE id = ?'),
      touchLogin: q('UPDATE users SET last_login = ? WHERE id = ?'),
      flagSuspicious: q('UPDATE users SET suspicious = suspicious + 1 WHERE id = ?'),
      deleteUser: q('DELETE FROM users WHERE id = ?'),
      insertSession: q('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)'),
      sessionByHash: q('SELECT s.*, u.username, u.banned FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?'),
      touchSession: q('UPDATE sessions SET last_seen = ?, expires_at = ? WHERE token_hash = ?'),
      deleteSession: q('DELETE FROM sessions WHERE token_hash = ?'),
      deleteUserSessions: q('DELETE FROM sessions WHERE user_id = ?'),
      deleteOtherSessions: q('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?'),
      purgeSessions: q('DELETE FROM sessions WHERE expires_at <= ?'),
      getSave: q('SELECT * FROM saves WHERE user_id = ?'),
      insertSave: q('INSERT INTO saves (user_id, data, revision, updated_at, play_seconds, display_name, power, boss_kills, best_stage, account_level) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)'),
      updateSave: q('UPDATE saves SET data = ?, revision = revision + 1, updated_at = ?, play_seconds = ?, display_name = ?, power = ?, boss_kills = ?, best_stage = ?, account_level = ? WHERE user_id = ? AND revision = ?'),
      insertHistory: q('INSERT INTO save_history (user_id, data, revision, created_at) VALUES (?, ?, ?, ?)'),
      trimHistory: q('DELETE FROM save_history WHERE user_id = ? AND id NOT IN (SELECT id FROM save_history WHERE user_id = ? ORDER BY id DESC LIMIT ?)'),
      listHistory: q('SELECT id, revision, created_at FROM save_history WHERE user_id = ? ORDER BY id DESC'),
      getHistory: q('SELECT * FROM save_history WHERE id = ? AND user_id = ?'),
      audit: q('INSERT INTO audit (user_id, event, detail, ip, at) VALUES (?, ?, ?, ?, ?)'),
      leaderboardPower: q('SELECT s.display_name AS name, s.power, s.boss_kills, s.best_stage, s.account_level FROM saves s JOIN users u ON u.id = s.user_id WHERE u.banned = 0 AND u.suspicious < 3 ORDER BY s.power DESC LIMIT ?'),
      leaderboardBosses: q('SELECT s.display_name AS name, s.power, s.boss_kills, s.best_stage, s.account_level FROM saves s JOIN users u ON u.id = s.user_id WHERE u.banned = 0 AND u.suspicious < 3 ORDER BY s.boss_kills DESC, s.power DESC LIMIT ?'),
      leaderboardStage: q('SELECT s.display_name AS name, s.power, s.boss_kills, s.best_stage, s.account_level FROM saves s JOIN users u ON u.id = s.user_id WHERE u.banned = 0 AND u.suspicious < 3 ORDER BY s.best_stage DESC, s.power DESC LIMIT ?'),
      rankOf: q('SELECT COUNT(*) + 1 AS rank FROM saves s JOIN users u ON u.id = s.user_id WHERE u.banned = 0 AND u.suspicious < 3 AND s.power > ?'),
      counts: q('SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM sessions) AS sessions, (SELECT COUNT(*) FROM saves) AS saves')
    };
  }

  backup() {
    if (this.file === ':memory:') return null;
    fs.mkdirSync(this.backupDir, { recursive:true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const target = path.join(this.backupDir, `mythverse-${stamp}.db`);
    this.db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
    const files = fs.readdirSync(this.backupDir).filter(f => /^mythverse-.*\.db$/.test(f)).sort();
    while (files.length > this.keepBackups) fs.unlinkSync(path.join(this.backupDir, files.shift()));
    return target;
  }

  close() { try { this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch (_) {} this.db.close(); }
}

module.exports = { Store };
