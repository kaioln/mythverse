// Testes do servidor: contas, sessões, CSRF, limites, saves com revisão, histórico, ranking e exclusão.
// Uso: node tests/server.test.js   (SQLite temporário)
//      TEST_DATABASE_URL=postgresql://… node tests/server.test.js   (PostgreSQL, num schema temporário apagado no fim)
'use strict';
const os = require('node:os'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert');
const { createServer } = require('../server/index.js');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mythverse-test-'));
const pgUrl = process.env.TEST_DATABASE_URL || '';
const schema = `mythverse_test_${process.pid}_${Date.now()}`;
const server = createServer({ dataDir:dir, databaseUrl:pgUrl, dbSchema:pgUrl ? schema : undefined, quiet:true, noBackups:true, secureCookie:false });
let base, checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };

class Client {
  constructor() { this.cookie = ''; }
  async req(method, url, body, headers = {}) {
    const res = await fetch(base + url, { method, headers:{ 'Content-Type':'application/json', 'X-MV-Request':'1', ...(this.cookie ? { Cookie:this.cookie } : {}), ...headers }, body:body === undefined ? undefined : JSON.stringify(body) });
    const set = res.headers.get('set-cookie'); if (set) this.cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
    let data = null; try { data = await res.json(); } catch (_) {}
    return { status:res.status, data, headers:res.headers };
  }
}

function saveFor(name, extra = {}) {
  const fsx = require('node:fs'), vm = require('node:vm');
  const ctx = { console, Math, JSON, Date }; ctx.globalThis = ctx; vm.createContext(ctx);
  for (const f of ['src/data.js','src/utils.js','src/items.js','src/progression.js','src/roster.js','src/engine.js']) vm.runInContext(fsx.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx);
  const st = ctx.KT.State.createState(); st.player.name = name;
  const eng = new ctx.KT.CombatEngine(st, {}); for (let i = 0; i < 10; i++) eng.openBox(true);
  const uniq = [...new Map(st.collection.map(r => [r.id, r])).values()].slice(0, 4); uniq.forEach((r, i) => { st.formation[i] = r.uid; });
  Object.assign(st, extra); return JSON.parse(JSON.stringify(st));
}

async function cleanup() {
  if (pgUrl && server.store.pool && !server.store.closed) await server.store.pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => {});
  await server.shutdown();
  fs.rmSync(dir, { recursive:true, force:true });
}

(async () => {
  await server.ready;
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  const a = new Client(), b = new Client(), anon = new Client();

  // Estáticos e cabeçalhos
  let r = await fetch(base + '/'); ok(r.status === 200 && r.headers.get('content-security-policy'), 'index com CSP');
  r = await fetch(base + '/server/db.js'); ok(r.status === 404, 'código do servidor não é público');
  r = await fetch(base + '/../package.json'); ok(r.status === 404 || r.status === 400, 'path traversal bloqueado');
  r = await fetch(base + '/data/mythverse.db'); ok(r.status === 404, 'banco não é público');
  r = await anon.req('GET', '/api/health'); ok(r.data.ok && r.data.db === (pgUrl ? 'postgres' : 'sqlite') && r.data.users === 0, 'health');

  // Cadastro
  ok((await a.req('POST', '/api/auth/register', { username:'ab', password:'senha1234', confirm:'senha1234', acceptTerms:true })).status === 400, 'nome curto rejeitado');
  ok((await a.req('POST', '/api/auth/register', { username:'Heroi01', password:'fraca', confirm:'fraca', acceptTerms:true })).status === 400, 'senha fraca rejeitada');
  ok((await a.req('POST', '/api/auth/register', { username:'Heroi01', password:'Kizuna2026x', confirm:'Kizuna2026y', acceptTerms:true })).status === 400, 'confirmação diferente');
  ok((await a.req('POST', '/api/auth/register', { username:'Heroi01', password:'Kizuna2026x', confirm:'Kizuna2026x' })).status === 400, 'termos obrigatórios');
  r = await a.req('POST', '/api/auth/register', { username:'Heroi01', email:'heroi@example.com', password:'Kizuna2026x', confirm:'Kizuna2026x', acceptTerms:true });
  ok(r.status === 201 && r.data.recoveryCode && a.cookie.startsWith('mv_session='), 'cadastro cria sessão e código de recuperação');
  const recovery = r.data.recoveryCode;
  const sess = await server.store.q.sessionByHash.get(require('../server/security').sha256(a.cookie.split('=')[1]), 0);
  ok(sess && sess.last_seen === sess.created_at && sess.ip === '127.0.0.1', 'sessão grava last_seen e IP nas colunas certas');
  ok((await b.req('POST', '/api/auth/register', { username:'heroi01', password:'Outra2026x', confirm:'Outra2026x', acceptTerms:true })).status === 409, 'usuário duplicado (sem diferenciar maiúsculas)');
  ok((await a.req('GET', '/api/auth/me')).data.user.username === 'Heroi01', 'me');

  // CSRF
  r = await a.req('PUT', '/api/save', { save:{}, revision:0 }, { 'X-MV-Request':'' }); ok(r.status === 403, 'sem cabeçalho CSRF bloqueado');
  r = await a.req('PUT', '/api/save', { save:{}, revision:0 }, { Origin:'https://evil.example' }); ok(r.status === 403, 'origem estranha bloqueada');

  // Saves
  ok((await anon.req('GET', '/api/save')).status === 401, 'save exige login');
  ok((await a.req('GET', '/api/save')).data.save === null, 'conta nova sem save');
  ok((await a.req('PUT', '/api/save', { save:{ version:1 }, revision:0 })).status === 422, 'save inválido rejeitado');
  ok((await a.req('PUT', '/api/save', { save:saveFor('Heroi', { player:{ ...saveFor('x').player, gold:-5 } }), revision:0 })).status === 422, 'ouro negativo rejeitado');
  const s1 = saveFor('Heroi Um');
  r = await a.req('PUT', '/api/save', { save:s1, revision:0 }); ok(r.status === 200 && r.data.revision === 1 && r.data.power > 0, 'primeiro save com poder calculado no servidor');
  r = await a.req('PUT', '/api/save', { save:{ ...s1, totalPlaySeconds:30 }, revision:1 }); ok(r.data.revision === 2, 'save incremental');
  r = await a.req('PUT', '/api/save', { save:{ ...s1, totalPlaySeconds:10 }, revision:1 }); ok(r.status === 409 && r.data.revision === 2 && r.data.save, 'conflito de revisão devolve a versão do servidor');
  r = await a.req('PUT', '/api/save', { save:{ ...s1, totalPlaySeconds:40 }, revision:1, force:true }); ok(r.status === 200 && r.data.revision === 3, 'forçar sobrescrita');
  r = await a.req('GET', '/api/save'); ok(r.data.revision === 3 && r.data.save.player.name === 'Heroi Um', 'carregar save');
  r = await a.req('GET', '/api/save/history'); ok(r.data.history.length >= 1, 'histórico de cópias');
  r = await a.req('POST', '/api/save/restore', { id:r.data.history[0].id }); ok(r.status === 200 && r.data.revision === 4, 'restaurar cópia');
  r = await a.req('POST', '/api/save/beacon', { save:{ ...s1, totalPlaySeconds:50 }, revision:4 }, { Origin:base, 'X-MV-Request':'' }); ok(r.status === 200, 'beacon com mesma origem');

  // Login, sessão e ranking
  ok((await b.req('POST', '/api/auth/login', { login:'Heroi01', password:'errada123' })).status === 401, 'senha errada');
  r = await b.req('POST', '/api/auth/login', { login:'heroi@example.com', password:'Kizuna2026x' }); ok(r.status === 200 && b.cookie, 'login por e-mail');
  r = await b.req('GET', '/api/leaderboard?type=power'); ok(r.data.rows.length === 1 && r.data.rows[0].name === 'Heroi Um' && r.data.me.rank === 1, 'ranking');
  ok(!JSON.stringify(r.data).includes('example.com'), 'ranking não expõe e-mail');

  // Troca de senha derruba outras sessões
  r = await a.req('POST', '/api/auth/password', { current:'Kizuna2026x', next:'NovaSenha2027' }); ok(r.status === 200, 'troca de senha');
  ok((await b.req('GET', '/api/auth/me')).status === 401, 'outras sessões encerradas');
  ok((await a.req('GET', '/api/auth/me')).status === 200, 'sessão atual continua');

  // Recuperação
  const c = new Client();
  ok((await c.req('POST', '/api/auth/recover', { username:'Heroi01', recoveryCode:'AAAA-BBBB-CCCC-DDDD', newPassword:'Recuperada2027' })).status === 401, 'código errado');
  r = await c.req('POST', '/api/auth/recover', { username:'Heroi01', recoveryCode:recovery.toLowerCase(), newPassword:'Recuperada2027' });
  ok(r.status === 200 && r.data.recoveryCode && r.data.recoveryCode !== recovery, 'recuperação gera novo código');
  ok((await a.req('GET', '/api/auth/me')).status === 401, 'recuperação encerra sessões antigas');

  // Limite de tentativas
  const d = new Client(); let limited = false;
  for (let i = 0; i < 12; i++) { const x = await d.req('POST', '/api/auth/login', { login:'Heroi01', password:`tentativa${i}` }); if (x.status === 429) { limited = true; break; } }
  ok(limited, 'força bruta limitada');

  // Exportação e exclusão (LGPD)
  r = await c.req('GET', '/api/account/export'); ok(r.status === 200 && r.data.account.username === 'Heroi01' && r.data.save, 'exportar dados');
  ok((await c.req('POST', '/api/account/delete', { password:'Recuperada2027', confirm:'outro' })).status === 400, 'exclusão exige confirmação');
  r = await c.req('POST', '/api/account/delete', { password:'Recuperada2027', confirm:'Heroi01' }); ok(r.status === 200, 'conta excluída');
  ok((await c.req('GET', '/api/save')).status === 401 && (await anon.req('GET', '/api/leaderboard')).data.rows.length === 0, 'dados removidos');

  // Logout
  const e = new Client(); await e.req('POST', '/api/auth/register', { username:'Outro_2', password:'Kizuna2026x', confirm:'Kizuna2026x', acceptTerms:true });
  await e.req('POST', '/api/auth/logout'); ok((await e.req('GET', '/api/auth/me')).status === 401, 'logout');

  // Saves simultâneos da mesma conta: um grava, o outro recebe conflito (nunca erro interno).
  const f = new Client(); await f.req('POST', '/api/auth/register', { username:'Paralelo', password:'Kizuna2026x', confirm:'Kizuna2026x', acceptTerms:true });
  const sp = saveFor('Paralelo');
  let both = await Promise.all([f.req('PUT', '/api/save', { save:sp, revision:0 }), f.req('PUT', '/api/save', { save:sp, revision:0 })]);
  ok(both.every(x => x.status === 200 || x.status === 409) && both.some(x => x.status === 200), 'primeiro save simultâneo sem erro');
  const rev = (await f.req('GET', '/api/save')).data.revision;
  both = await Promise.all([f.req('PUT', '/api/save', { save:sp, revision:rev }), f.req('PUT', '/api/save', { save:sp, revision:rev })]);
  ok(both.filter(x => x.status === 200).length === 1 && both.filter(x => x.status === 409).length === 1, 'saves simultâneos: um grava, outro tem conflito');

  // Backup (no PostgreSQL fica com o provedor)
  const file = await server.store.backup(); ok(pgUrl ? file === null : fs.existsSync(file), 'backup do banco');

  await cleanup();
  console.log(JSON.stringify({ ok:true, checks, db:pgUrl ? 'postgres' : 'sqlite' }));
})().catch(async err => { console.error(err); try { await cleanup(); } catch (_) {} process.exit(1); });
