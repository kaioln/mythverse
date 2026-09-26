'use strict';
// MYTHVERSE — servidor de jogo.
// Node 22.13+ (recomendado 24). Banco: SQLite embutido (padrão) ou PostgreSQL com DATABASE_URL (pacote `pg`).
// Variáveis: PORT, HOST, DATA_DIR, DATABASE_URL, NODE_ENV, TRUST_PROXY, SESSION_DAYS, BACKUP_HOURS, PUBLIC_ORIGIN
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { createStore, isUniqueViolation } = require('./db');
const sec = require('./security');
const game = require('./game');

const ROOT = path.resolve(__dirname, '..');
const CONFIG = {
  port:Number(process.env.PORT || 8080),
  host:process.env.HOST || '0.0.0.0',
  dataDir:path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data')),
  databaseUrl:process.env.DATABASE_URL || '',
  production:process.env.NODE_ENV === 'production',
  trustProxy:process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true',
  sessionDays:Number(process.env.SESSION_DAYS || 30),
  backupHours:Number(process.env.BACKUP_HOURS || 6),
  publicOrigin:process.env.PUBLIC_ORIGIN || '',
  secureCookie:process.env.SECURE_COOKIE ? process.env.SECURE_COOKIE === '1' : process.env.NODE_ENV === 'production'
};
const COOKIE = 'mv_session';
const MAX_JSON = 2.5 * 1024 * 1024;

function createServer(options = {}) {
  const cfg = { ...CONFIG, ...options };
  const log = cfg.quiet ? () => {} : (...a) => console.log(new Date().toISOString(), ...a);
  const store = createStore({ databaseUrl:cfg.databaseUrl, schema:cfg.dbSchema, file:cfg.dbFile || path.join(cfg.dataDir, 'mythverse.db'), backupDir:path.join(cfg.dataDir, 'backups'), log });
  const limiter = new sec.RateLimiter();

  // ---------------------------------------------------------------------------
  // utilidades HTTP
  // ---------------------------------------------------------------------------
  const clientIp = req => (cfg.trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';
  const securityHeaders = {
    'X-Content-Type-Options':'nosniff',
    'X-Frame-Options':'DENY',
    'Referrer-Policy':'strict-origin-when-cross-origin',
    'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy':'same-origin',
    'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
  };
  function send(res, status, body, headers = {}) {
    const isObj = body !== null && typeof body === 'object' && !Buffer.isBuffer(body);
    const payload = isObj ? JSON.stringify(body) : body ?? '';
    res.writeHead(status, { ...securityHeaders, 'Cache-Control':'no-store', ...(isObj ? { 'Content-Type':'application/json; charset=utf-8' } : {}), ...headers });
    res.end(payload);
  }
  const fail = (res, status, error, extra = {}) => send(res, status, { ok:false, error, ...extra });
  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on('data', c => { size += c.length; if (size > MAX_JSON) { reject(Object.assign(new Error('too_large'), { status:413 })); req.destroy(); } else chunks.push(c); });
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });
  }
  async function readJson(req) { const raw = await readBody(req); if (!raw) return {}; try { return JSON.parse(raw); } catch (_) { throw Object.assign(new Error('bad_json'), { status:400 }); } }
  function parseCookies(req) { const out = {}; String(req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); }); return out; }
  function sessionCookie(token, maxAgeSec) { return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${cfg.secureCookie ? '; Secure' : ''}`; }
  // Proteção CSRF: toda alteração exige cabeçalho próprio (não enviável por outro site sem CORS) e Origin compatível.
  function sameOrigin(req) {
    const origin = req.headers.origin; if (!origin) return true;
    const host = req.headers['x-forwarded-host'] && cfg.trustProxy ? req.headers['x-forwarded-host'] : req.headers.host;
    try { const o = new URL(origin); return o.host === host || (cfg.publicOrigin && origin === cfg.publicOrigin); } catch (_) { return false; }
  }
  const csrfOk = req => req.headers['x-mv-request'] === '1' && sameOrigin(req);

  async function currentSession(req) {
    const token = parseCookies(req)[COOKIE]; if (!token || token.length > 100) return null;
    const hash = sec.sha256(token), now = Date.now();
    const s = await store.q.sessionByHash.get(hash, now); if (!s || s.banned) return null;
    if (now - s.last_seen > 5 * 60_000) await store.q.touchSession.run(now, now + cfg.sessionDays * 86400_000, hash);
    return { ...s, token, hash };
  }
  async function startSession(req, res, userId) {
    const token = sec.newToken(), now = Date.now(), exp = now + cfg.sessionDays * 86400_000;
    await store.q.insertSession.run(sec.sha256(token), userId, now, exp, now, clientIp(req), String(req.headers['user-agent'] || '').slice(0, 200));
    await store.q.touchLogin.run(now, userId);
    return sessionCookie(token, cfg.sessionDays * 86400);
  }
  // Auditoria nunca derruba a requisição.
  const audit = (userId, event, req, detail = '') => store.q.audit.run(userId, event, String(detail).slice(0, 300), clientIp(req), Date.now()).catch(() => {});
  const publicUser = u => ({ id:u.id, username:u.username, email:u.email ? u.email.replace(/^(.).*(@.*)$/, '$1***$2') : null, createdAt:u.created_at });

  // ---------------------------------------------------------------------------
  // API
  // ---------------------------------------------------------------------------
  const routes = {
    'GET /api/health': async (req, res) => send(res, 200, { ok:true, name:'Mythverse', time:Date.now(), db:store.kind, ...await store.q.counts.get() }),

    'POST /api/auth/register': async (req, res) => {
      if (!limiter.allow(`reg-try:${clientIp(req)}`, 30, 60 * 60_000)) return fail(res, 429, 'Muitas tentativas de cadastro. Tente mais tarde.');
      const b = await readJson(req);
      const username = sec.validateUsername(b.username);
      if (!username) return fail(res, 400, 'Nome de usuário: 3 a 20 letras, números, ponto, hífen ou sublinhado.');
      const email = sec.validateEmail(b.email);
      if (email === null) return fail(res, 400, 'E-mail inválido.');
      const problem = sec.passwordProblem(b.password, username); if (problem) return fail(res, 400, problem);
      if (b.password !== b.confirm) return fail(res, 400, 'As senhas não conferem.');
      if (!b.acceptTerms) return fail(res, 400, 'É preciso aceitar os Termos de Uso e a Política de Privacidade.');
      if (await store.q.userByName.get(username)) return fail(res, 409, 'Esse nome de usuário já está em uso.');
      if (email && await store.q.userByEmail.get(email)) return fail(res, 409, 'Esse e-mail já está cadastrado.');
      if (!limiter.allow(`reg-ok:${clientIp(req)}`, 5, 60 * 60_000)) return fail(res, 429, 'Muitas contas criadas deste endereço. Tente mais tarde.');
      const recovery = sec.newRecoveryCode();
      let id;
      try { id = Number((await store.q.insertUser.get(username, email || null, sec.hashSecret(b.password), sec.hashSecret(recovery), Date.now())).id); }
      catch (err) { if (isUniqueViolation(err)) return fail(res, 409, 'Usuário ou e-mail já cadastrado.'); throw err; }
      audit(id, 'register', req);
      const cookie = await startSession(req, res, id);
      send(res, 201, { ok:true, user:publicUser(await store.q.userById.get(id)), recoveryCode:recovery }, { 'Set-Cookie':cookie });
    },

    'POST /api/auth/login': async (req, res) => {
      const b = await readJson(req);
      const login = String(b.login || '').normalize('NFKC').trim().slice(0, 254);
      if (!limiter.allow(`login-ip:${clientIp(req)}`, 20, 15 * 60_000) || !limiter.allow(`login-user:${login.toLowerCase()}`, 8, 15 * 60_000)) return fail(res, 429, 'Muitas tentativas. Aguarde 15 minutos.');
      const user = login.includes('@') ? await store.q.userByEmail.get(login.toLowerCase()) : await store.q.userByName.get(login);
      const valid = sec.verifySecret(String(b.password || ''), user ? user.pass_hash : sec.DUMMY_HASH);
      if (!user || !valid) { audit(user?.id ?? null, 'login_fail', req, login); return fail(res, 401, 'Usuário ou senha incorretos.'); }
      if (user.banned) return fail(res, 403, 'Conta suspensa. Entre em contato com o suporte.');
      audit(user.id, 'login', req);
      send(res, 200, { ok:true, user:publicUser(user) }, { 'Set-Cookie':await startSession(req, res, user.id) });
    },

    'POST /api/auth/logout': async (req, res, s) => { if (s) await store.q.deleteSession.run(s.hash); send(res, 200, { ok:true }, { 'Set-Cookie':sessionCookie('', 0) }); },

    'GET /api/auth/me': async (req, res, s) => { if (!s) return fail(res, 401, 'Não autenticado.'); send(res, 200, { ok:true, user:publicUser(await store.q.userById.get(s.user_id)) }); },

    'POST /api/auth/password': async (req, res, s) => {
      if (!s) return fail(res, 401, 'Não autenticado.');
      if (!limiter.allow(`pw:${s.user_id}`, 6, 15 * 60_000)) return fail(res, 429, 'Muitas tentativas.');
      const b = await readJson(req), user = await store.q.userById.get(s.user_id);
      if (!sec.verifySecret(String(b.current || ''), user.pass_hash)) return fail(res, 401, 'Senha atual incorreta.');
      const problem = sec.passwordProblem(b.next, user.username); if (problem) return fail(res, 400, problem);
      await store.q.setPassword.run(sec.hashSecret(b.next), user.id);
      await store.q.deleteOtherSessions.run(user.id, s.hash);
      audit(user.id, 'password_change', req);
      send(res, 200, { ok:true });
    },

    'POST /api/auth/recover': async (req, res) => {
      if (!limiter.allow(`rec:${clientIp(req)}`, 6, 60 * 60_000)) return fail(res, 429, 'Muitas tentativas. Tente em 1 hora.');
      const b = await readJson(req);
      const user = await store.q.userByName.get(String(b.username || '').normalize('NFKC').trim());
      const code = String(b.recoveryCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/(.{4})(?=.)/g, '$1-');
      const valid = sec.verifySecret(code, user ? user.recovery_hash : sec.DUMMY_HASH);
      if (!user || !valid) { audit(user?.id ?? null, 'recover_fail', req); return fail(res, 401, 'Usuário ou código de recuperação incorretos.'); }
      const problem = sec.passwordProblem(b.newPassword, user.username); if (problem) return fail(res, 400, problem);
      const recovery = sec.newRecoveryCode();
      await store.tx(async q => { await q.setPassword.run(sec.hashSecret(b.newPassword), user.id); await q.setRecovery.run(sec.hashSecret(recovery), user.id); await q.deleteUserSessions.run(user.id); });
      audit(user.id, 'recover', req);
      send(res, 200, { ok:true, recoveryCode:recovery }, { 'Set-Cookie':await startSession(req, res, user.id) });
    },

    'POST /api/auth/recovery-code': async (req, res, s) => {
      if (!s) return fail(res, 401, 'Não autenticado.');
      const b = await readJson(req), user = await store.q.userById.get(s.user_id);
      if (!sec.verifySecret(String(b.password || ''), user.pass_hash)) return fail(res, 401, 'Senha incorreta.');
      const recovery = sec.newRecoveryCode(); await store.q.setRecovery.run(sec.hashSecret(recovery), user.id);
      audit(user.id, 'recovery_regen', req); send(res, 200, { ok:true, recoveryCode:recovery });
    },

    'POST /api/auth/logout-all': async (req, res, s) => { if (!s) return fail(res, 401, 'Não autenticado.'); await store.q.deleteOtherSessions.run(s.user_id, s.hash); audit(s.user_id, 'logout_all', req); send(res, 200, { ok:true }); },

    'POST /api/account/delete': async (req, res, s) => {
      if (!s) return fail(res, 401, 'Não autenticado.');
      const b = await readJson(req), user = await store.q.userById.get(s.user_id);
      if (!sec.verifySecret(String(b.password || ''), user.pass_hash)) return fail(res, 401, 'Senha incorreta.');
      if (b.confirm !== user.username) return fail(res, 400, 'Digite o nome de usuário para confirmar.');
      await store.q.deleteUser.run(user.id); audit(null, 'account_deleted', req, user.username);
      send(res, 200, { ok:true }, { 'Set-Cookie':sessionCookie('', 0) });
    },

    'GET /api/account/export': async (req, res, s) => {
      if (!s) return fail(res, 401, 'Não autenticado.');
      const user = await store.q.userById.get(s.user_id), save = await store.q.getSave.get(s.user_id);
      const body = JSON.stringify({ exportedAt:new Date().toISOString(), account:{ username:user.username, email:user.email, createdAt:new Date(user.created_at).toISOString(), lastLogin:user.last_login ? new Date(user.last_login).toISOString() : null }, save:save ? JSON.parse(save.data) : null }, null, 2);
      send(res, 200, body, { 'Content-Type':'application/json; charset=utf-8', 'Content-Disposition':`attachment; filename="mythverse-${user.username}.json"` });
    },

    'GET /api/save': async (req, res, s) => {
      if (!s) return fail(res, 401, 'Não autenticado.');
      const row = await store.q.getSave.get(s.user_id);
      if (!row) return send(res, 200, { ok:true, save:null, revision:0 });
      send(res, 200, { ok:true, save:JSON.parse(row.data), revision:row.revision, updatedAt:row.updated_at });
    },

    'PUT /api/save': async (req, res, s) => {
      if (!s) return fail(res, 401, 'Não autenticado.');
      if (!limiter.allow(`save:${s.user_id}`, 40, 60_000)) return fail(res, 429, 'Salvando rápido demais.');
      const raw = await readBody(req); let b;
      try { b = JSON.parse(raw); } catch (_) { return fail(res, 400, 'JSON inválido.'); }
      return writeSave(req, res, s, b.save, Number(b.revision) || 0, !!b.force);
    },

    // navigator.sendBeacon ao fechar a aba (sem cabeçalhos próprios: exige Origin do mesmo site).
    'POST /api/save/beacon': async (req, res, s) => {
      if (!s || !req.headers.origin || !sameOrigin(req)) return fail(res, 403, 'Negado.');
      if (!limiter.allow(`save:${s.user_id}`, 40, 60_000)) return fail(res, 429, 'Salvando rápido demais.');
      const raw = await readBody(req); let b; try { b = JSON.parse(raw); } catch (_) { return fail(res, 400, 'JSON inválido.'); }
      return writeSave(req, res, s, b.save, Number(b.revision) || 0, false);
    },

    'GET /api/save/history': async (req, res, s) => { if (!s) return fail(res, 401, 'Não autenticado.'); send(res, 200, { ok:true, history:await store.q.listHistory.all(s.user_id) }); },

    'POST /api/save/restore': async (req, res, s) => {
      if (!s) return fail(res, 401, 'Não autenticado.');
      const b = await readJson(req), id = Number(b.id);
      const h = Number.isSafeInteger(id) ? await store.q.getHistory.get(id, s.user_id) : null;
      if (!h) return fail(res, 404, 'Cópia não encontrada.');
      const cur = await store.q.getSave.get(s.user_id);
      return writeSave(req, res, s, JSON.parse(h.data), cur ? cur.revision : 0, true, 'restore');
    },

    'GET /api/leaderboard': async (req, res, s) => {
      const url = new URL(req.url, 'http://x'), type = url.searchParams.get('type') || 'power';
      const q = type === 'bosses' ? store.q.leaderboardBosses : type === 'stage' ? store.q.leaderboardStage : store.q.leaderboardPower;
      const rows = await q.all(50);
      let me = null;
      if (s) { const mine = await store.q.getSave.get(s.user_id); if (mine) me = { name:mine.display_name, power:mine.power, boss_kills:mine.boss_kills, best_stage:mine.best_stage, rank:(await store.q.rankOf.get(mine.power)).rank }; }
      send(res, 200, { ok:true, type, rows, me });
    }
  };

  async function writeSave(req, res, s, save, revision, force, reason = 'save') {
    const v = game.validateSave(save);
    if (!v.ok) { audit(s.user_id, 'save_rejected', req, v.reason); return fail(res, 422, v.reason); }
    const now = Date.now(), sm = v.summary;
    const result = await store.tx(async q => {
      const cur = await q.getSaveForUpdate.get(s.user_id);
      if (!cur) {
        const ins = await q.insertSave.run(s.user_id, v.json, now, sm.playSeconds, sm.name, sm.power, sm.bossKills, sm.bestStage, sm.accountLevel);
        return ins.changes ? { revision:1 } : { conflict:true, cur:await q.getSave.get(s.user_id) };
      }
      if (!force && revision !== cur.revision) return { conflict:true, cur };
      const prevSummary = { playSeconds:cur.play_seconds, accountLevel:cur.account_level, power:cur.power };
      const flag = game.suspicious(prevSummary, sm, now - cur.updated_at);
      if (flag) await q.flagSuspicious.run(s.user_id);
      // Guarda a versão anterior no histórico (no máximo uma a cada 10 minutos, últimas 20).
      const last = (await q.listHistory.all(s.user_id))[0];
      if (!last || now - last.created_at > 10 * 60_000 || reason === 'restore') { await q.insertHistory.run(s.user_id, cur.data, cur.revision, now); await q.trimHistory.run(s.user_id, s.user_id, store.historyPerUser); }
      const upd = await q.updateSave.run(v.json, now, sm.playSeconds, sm.name, sm.power, sm.bossKills, sm.bestStage, sm.accountLevel, s.user_id, cur.revision);
      if (!upd.changes) return { conflict:true, cur:await q.getSave.get(s.user_id) };
      return { revision:cur.revision + 1, flag };
    });
    if (result.flag) audit(s.user_id, 'suspicious', req, result.flag);
    if (result.conflict) return fail(res, 409, 'Outro dispositivo salvou um progresso diferente.', { revision:result.cur.revision, updatedAt:result.cur.updated_at, playSeconds:result.cur.play_seconds, save:JSON.parse(result.cur.data) });
    if (reason === 'restore') audit(s.user_id, 'save_restore', req);
    send(res, 200, { ok:true, revision:result.revision, updatedAt:now, power:sm.power });
  }

  // ---------------------------------------------------------------------------
  // Arquivos estáticos
  // ---------------------------------------------------------------------------
  const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.json':'application/json', '.ico':'image/x-icon', '.webp':'image/webp', '.txt':'text/plain; charset=utf-8', '.md':'text/markdown; charset=utf-8' };
  const PUBLIC = ['/index.html', '/styles.css', '/src/', '/assets/', '/legal/', '/manifest.webmanifest'];
  function serveStatic(req, res) {
    let urlPath;
    try { urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (_) { return fail(res, 400, 'URL inválida.'); }
    if (urlPath === '/') urlPath = '/index.html';
    if (!PUBLIC.some(p => urlPath === p || (p.endsWith('/') && urlPath.startsWith(p)))) return fail(res, 404, 'Não encontrado.');
    const file = path.normalize(path.join(ROOT, urlPath));
    if (!file.startsWith(ROOT + path.sep)) return fail(res, 403, 'Negado.');
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) return fail(res, 404, 'Não encontrado.');
      const ext = path.extname(file).toLowerCase();
      const etag = `"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
      const cache = ext === '.png' || ext === '.jpg' || ext === '.webp' ? 'public, max-age=604800' : 'public, max-age=0, must-revalidate';
      if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ...securityHeaders, ETag:etag, 'Cache-Control':cache }); return res.end(); }
      const headers = { ...securityHeaders, 'Content-Type':MIME[ext] || 'application/octet-stream', 'Cache-Control':cache, ETag:etag };
      const compressible = /\.(html|js|css|json|svg|md|txt)$/.test(ext) && /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''));
      if (compressible) { headers['Content-Encoding'] = 'gzip'; headers.Vary = 'Accept-Encoding'; res.writeHead(200, headers); fs.createReadStream(file).pipe(zlib.createGzip()).pipe(res); }
      else { headers['Content-Length'] = st.size; res.writeHead(200, headers); if (req.method === 'HEAD') return res.end(); fs.createReadStream(file).pipe(res); }
    });
  }

  // ---------------------------------------------------------------------------
  const server = http.createServer(async (req, res) => {
    const started = Date.now();
    if (req.url.startsWith('/api/') && !cfg.quiet) res.on('finish', () => log(req.method, req.url.split('?')[0], res.statusCode, `${Date.now() - started}ms`));
    try {
      const url = new URL(req.url, 'http://x');
      if (url.pathname.startsWith('/api/')) {
        const key = `${req.method} ${url.pathname}`, handler = routes[key];
        if (!handler) return fail(res, 404, 'Rota não encontrada.');
        if (!limiter.allow(`api:${clientIp(req)}`, 300, 60_000)) return fail(res, 429, 'Muitas requisições.');
        if (req.method !== 'GET' && key !== 'POST /api/save/beacon' && !csrfOk(req)) return fail(res, 403, 'Requisição bloqueada (CSRF).');
        await store.ready;
        const session = await currentSession(req);
        await handler(req, res, session);
      } else if (req.method === 'GET' || req.method === 'HEAD') serveStatic(req, res);
      else fail(res, 405, 'Método não permitido.');
    } catch (err) {
      if (err.status) fail(res, err.status, err.message === 'too_large' ? 'Requisição grande demais.' : 'Requisição inválida.');
      else { log('ERRO', req.method, req.url, err.stack || err); if (!res.headersSent) fail(res, 500, 'Erro interno. Tente novamente.'); }
    }
  });
  server.headersTimeout = 20_000; server.requestTimeout = 30_000; server.keepAliveTimeout = 5_000;

  const timers = [];
  timers.push(setInterval(() => { store.q.purgeSessions.run(Date.now()).catch(e => log('purge', e)); }, 3600_000));
  // No PostgreSQL os backups ficam com o provedor (ex.: restauração por ponto no tempo do Neon).
  if (store.kind === 'sqlite' && cfg.backupHours > 0 && !cfg.noBackups) timers.push(setInterval(() => { store.backup().then(f => log('backup', f), e => log('backup falhou', e)); }, cfg.backupHours * 3600_000));
  timers.forEach(t => t.unref());

  server.store = store;
  server.ready = store.ready;
  server.shutdown = () => new Promise(resolve => {
    const done = () => store.close().catch(() => {}).then(resolve);
    timers.forEach(clearInterval); server.close(done); setTimeout(done, 5000).unref();
  });
  return server;
}

if (require.main === module) {
  const server = createServer();
  const where = server.store.kind === 'postgres' ? `PostgreSQL em ${new URL(CONFIG.databaseUrl).hostname}` : `SQLite em ${CONFIG.dataDir}`;
  server.ready.then(() => {
    server.listen(CONFIG.port, CONFIG.host, () => console.log(`Mythverse rodando em http://${CONFIG.host === '0.0.0.0' ? 'localhost' : CONFIG.host}:${CONFIG.port} (dados: ${where}${CONFIG.production ? ', produção' : ''})`));
    if (CONFIG.production && server.store.kind === 'sqlite') server.store.backup().then(f => console.log('Backup inicial:', f), e => console.error('Backup inicial falhou', e));
  }, err => { console.error(`Não foi possível abrir o banco (${where}):`, err.message); process.exit(1); });
  const stop = sig => { console.log(`${sig}: encerrando…`); server.shutdown().then(() => process.exit(0)); };
  process.on('SIGINT', () => stop('SIGINT')); process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('unhandledRejection', err => console.error('unhandledRejection', err));
}

module.exports = { createServer };
