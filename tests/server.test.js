// Testes do servidor: contas, sessões, CSRF, limites, saves com revisão, histórico, ranking e exclusão.
// Uso: node tests/server.test.js
'use strict';
const os = require('node:os'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert');
const { createServer } = require('../server/index.js');
const { economyConfig } = require('../server/economy.js');
const { mercadoPago } = require('../server/payments.js');
const crypto = require('node:crypto');

let server, dir, base, checks = 0, label = '';
const ok = (c, m) => { checks++; if (process.env.TRACE) console.log(checks, label, m); assert.ok(c, `[${label}] ${m}`); };

class Client {
  constructor() { this.cookie = ''; }
  async req(method, url, body, headers = {}) {
    const res = await fetch(base + url, { method, headers:{ 'Content-Type':'application/json', 'X-MV-Request':'1', ...(this.cookie ? { Cookie:this.cookie } : {}), ...headers }, body:body === undefined ? undefined : JSON.stringify(body) });
    const set = res.headers.get('set-cookie'); if (set) this.cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
    let data = null; try { data = await res.json(); } catch (_) {}
    return { status:res.status, data, headers:res.headers };
  }
}

// Ajuste direto no banco (só nos testes), para simular itens obtidos jogando.
async function grant(c, fn) {
  const me = (await c.req('GET', '/api/auth/me')).data.user;
  await server.store.transaction(async t => { const row = await t.getSave(me.id, true); const data = JSON.parse(row.data); fn(data); const v = require('../server/game').validateSave(data); await t.updateSave(me.id, v.json, Date.now(), v.summary, row.revision); });
}
function saveFor(name, extra = {}) {
  const fsx = require('node:fs'), vm = require('node:vm');
  const ctx = { console, Math, JSON, Date }; ctx.globalThis = ctx; vm.createContext(ctx);
  for (const f of ['src/data.js','src/utils.js','src/items.js','src/progression.js','src/roster.js','src/builds.js','src/engine.js']) vm.runInContext(fsx.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx);
  const st = ctx.KT.State.createState(); st.player.name = name;
  const eng = new ctx.KT.CombatEngine(st, {}); for (let i = 0; i < 10; i++) eng.openBox(true);
  const uniq = [...new Map(st.collection.map(r => [r.id, r])).values()].slice(0, 4); uniq.forEach((r, i) => { st.formation[i] = r.uid; });
  Object.assign(st, extra); return JSON.parse(JSON.stringify(st));
}

async function suite(name, opts) {
  label = name;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mythverse-test-'));
  const webhookPays = new Map();
  const fakeProvider = { name:'fake', enabled:true, async createPix({ depositId, amount }) { const ref = `pay-${depositId}`; webhookPays.set(ref, { ref, approved:true, amount, depositId }); return { ref, pixCopyPaste:'000201-FAKE' }; },
    verifyWebhook(req, url) { return req.headers['x-test-sig'] === 'ok' ? url.searchParams.get('data.id') : null; }, async fetchPayment(id) { return webhookPays.get(id) || null; } };
  server = await createServer({ dataDir:dir, quiet:true, noBackups:true, secureCookie:false, paymentProvider:fakeProvider,
    economy:economyConfig({ RMT_ENABLED:'1', ADMIN_TOKEN:'admin-secret-token', MARKET_MIN_ITEM_AGE_HOURS:'0', GOLD_MARKET_MIN_ITEM_AGE_HOURS:'0', MARKET_MIN_ACCOUNT_DAYS:'0' }), ...opts });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  const a = new Client(), b = new Client(), anon = new Client();

  // Estáticos e cabeçalhos
  let r = await fetch(base + '/'); ok(r.status === 200 && r.headers.get('content-security-policy'), 'index com CSP');
  r = await fetch(base + '/favicon.ico'); ok(r.status === 200 && r.headers.get('content-type') === 'image/png', 'favicon sem 404');
  r = await fetch(base + '/server/db.js'); ok(r.status === 404, 'código do servidor não é público');
  r = await fetch(base + '/../package.json'); ok(r.status === 404 || r.status === 400, 'path traversal bloqueado');
  r = await fetch(base + '/data/mythverse.db'); ok(r.status === 404, 'banco não é público');
  ok((await anon.req('GET', '/api/health')).data.ok, 'health');

  // Cadastro
  ok((await a.req('POST', '/api/auth/register', { username:'ab', password:'senha1234', confirm:'senha1234', acceptTerms:true })).status === 400, 'nome curto rejeitado');
  ok((await a.req('POST', '/api/auth/register', { username:'Heroi01', password:'fraca', confirm:'fraca', acceptTerms:true })).status === 400, 'senha fraca rejeitada');
  ok((await a.req('POST', '/api/auth/register', { username:'Heroi01', password:'Kizuna2026x', confirm:'Kizuna2026y', acceptTerms:true })).status === 400, 'confirmação diferente');
  ok((await a.req('POST', '/api/auth/register', { username:'Heroi01', password:'Kizuna2026x', confirm:'Kizuna2026x' })).status === 400, 'termos obrigatórios');
  r = await a.req('POST', '/api/auth/register', { username:'Heroi01', email:'heroi@example.com', password:'Kizuna2026x', confirm:'Kizuna2026x', acceptTerms:true });
  ok(r.status === 201 && r.data.recoveryCode && a.cookie.startsWith('mv_session='), 'cadastro cria sessão e código de recuperação');
  const recovery = r.data.recoveryCode;
  ok((await b.req('POST', '/api/auth/register', { username:'heroi01', password:'Outra2026x', confirm:'Outra2026x', acceptTerms:true })).status === 409, 'usuário duplicado (sem diferenciar maiúsculas)');
  ok((await a.req('GET', '/api/auth/me')).data.user.username === 'Heroi01', 'me');

  // CSRF
  r = await a.req('POST', '/api/sync', { act:{ op:'claimLogin', args:[] } }, { 'X-MV-Request':'' }); ok(r.status === 403, 'sem cabeçalho CSRF bloqueado');
  r = await a.req('POST', '/api/sync', { act:{ op:'claimLogin', args:[] } }, { Origin:'https://evil.example' }); ok(r.status === 403, 'origem estranha bloqueada');

  // Servidor autoritativo: o navegador não grava save, só pede ações e entrega comandos de luta.
  ok((await anon.req('GET', '/api/state')).status === 401, 'estado exige login');
  ok((await a.req('PUT', '/api/save', { save:saveFor('x'), revision:0 })).status === 404, 'não existe rota para gravar save pelo navegador');
  r = await a.req('GET', '/api/state'); ok(r.status === 200 && r.data.state.version === 3 && r.data.state.starterRolls === 10 && r.data.revision === 1, 'conta nova recebe estado inicial do servidor');
  r = await a.req('POST', '/api/sync', { act:{ op:'openBoxes', args:[10] } }); ok(r.data.result.length === 10 && r.data.state.collection.length === 10, 'convocações sorteadas no servidor');
  const team = r.data.state.collection;
  for (let i = 0; i < 4; i++) r = await a.req('POST', '/api/sync', { act:{ op:'setParty', args:[i, team[i].uid] } });
  ok(r.data.state.formation.every(Boolean), 'formação via ações');
  ok((await a.req('POST', '/api/sync', { act:{ op:'hackGold', args:[] } })).status === 400, 'ação desconhecida recusada');
  r = await a.req('POST', '/api/sync', { act:{ op:'addAttr', args:[team[0].uid, 'str', 999] } }); ok(r.data.state.collection[0].attr.str <= 5, 'não gasta pontos que não tem');
  r = await a.req('POST', '/api/sync', { act:{ op:'setName', args:['Heroi Um'] } }); ok(r.data.state.player.name === 'Heroi Um', 'renomear');
  // Luta: semente do servidor, comandos do navegador, recompensa calculada no servidor.
  r = await a.req('POST', '/api/sync', { start:{ zone:'hunt', opts:{ stage:1 } } }); ok(r.data.seg && r.data.seg.seed > 0 && r.data.seg.opts.stage === 1, 'servidor fornece a semente da luta');
  const seg = r.data.seg, gold0 = r.data.state.player.gold;
  ok((await a.req('POST', '/api/sync', { start:{ zone:'boss', opts:{} } })).data.startError, 'região bloqueada não começa');
  r = await a.req('POST', '/api/sync', { start:{ zone:'hunt', opts:{ stage:1 } } }); const seg2 = r.data.seg;
  r = await a.req('POST', '/api/sync', { finish:{ segId:seg2.id, endTick:20000, inputs:[] } }); ok(r.data.finish.status === 'too_fast' && r.data.state.player.gold === gold0, 'luta acelerada além do limite é anulada');
  r = await a.req('POST', '/api/sync', { start:{ zone:'hunt', opts:{ stage:1 } } }); const seg3 = r.data.seg;
  await new Promise(res => setTimeout(res, 1200));
  r = await a.req('POST', '/api/sync', { finish:{ segId:seg3.id, endTick:60, inputs:[{ t:5, k:'ult', a:0 }] } });
  ok(r.data.finish.status === 'ok' && r.data.state.stats.kills >= 0, 'luta reproduzida no servidor');
  ok((await a.req('POST', '/api/sync', { finish:{ segId:seg3.id, endTick:60, inputs:[] } })).data.finish.status === 'stale', 'a mesma luta não paga duas vezes');
  r = await a.req('GET', '/api/save/history'); ok(r.data.history.length >= 0, 'histórico de cópias');
  r = await a.req('POST', '/api/sync/beacon', { finish:{ segId:1, endTick:1, inputs:[] } }, { Origin:base, 'X-MV-Request':'' }); ok(r.status === 200, 'beacon com mesma origem');

  // ---------- Economia: carteira, Pix, mercado e saque ----------
  label = `${name}/economia`;
  const sellerC = new Client(), buyerC = new Client();
  await sellerC.req('POST', '/api/auth/register', { username:'Vendedor1', email:'v@example.com', password:'Kizuna2026x', confirm:'Kizuna2026x', acceptTerms:true });
  await buyerC.req('POST', '/api/auth/register', { username:'Comprador1', email:'c@example.com', password:'Kizuna2026x', confirm:'Kizuna2026x', acceptTerms:true });
  const item = { uid:'it_test_1', kind:'base', baseId:'bokken', slot:'weapon', wt:'sword', name:'Bokken de Treino', icon:'katana_01', hue:160, ilvl:1, rarity:'rare', plus:0, primary:14, affixes:[], cards:[], locked:false };
  await sellerC.req('GET', '/api/state'); await buyerC.req('GET', '/api/state');
  await grant(sellerC, st => { st.inventory = [item]; st.cards = { card_fox:1 }; });
  r = await sellerC.req('GET', '/api/wallet'); ok(r.data.balance === 0 && r.data.config.enabled, 'carteira começa zerada');
  const list = (c2, args) => c2.req('POST', '/api/sync', { act:{ op:'marketList', args:[args] } });
  ok((await list(sellerC, { kind:'item', itemUid:item.uid, price:5 })).data.actError, 'preço mínimo');
  r = await list(sellerC, { kind:'item', itemUid:item.uid, price:500 });
  ok(r.status === 200 && r.data.result.id && !r.data.state.inventory.some(x => x.uid === item.uid), 'anunciar item remove do estado');
  const listingId = r.data.result.id;
  ok((await list(sellerC, { kind:'item', itemUid:item.uid, price:500 })).data.actError, 'não anuncia o mesmo item duas vezes');
  r = await list(sellerC, { kind:'card', cardId:'card_fox', price:300 }); ok(r.data.result?.id, 'anunciar carta');
  r = await anon.req('GET', '/api/market?type=all&sort=price'); ok(r.data.listings.length === 2 && r.data.listings[0].price === 300 && r.data.listings[0].seller === 'Vendedor1', 'lista pública do mercado com o vendedor');
  ok((await buyerC.req('POST', '/api/market/buy', { id:listingId })).status === 400, 'sem saldo não compra');
  r = await buyerC.req('POST', '/api/wallet/deposit', { amount:100 }); ok(r.status === 400, 'depósito mínimo');
  r = await buyerC.req('POST', '/api/wallet/deposit', { amount:1000 }); ok(r.status === 200 && r.data.pixCopyPaste, 'gera Pix');
  const payRef = `pay-${r.data.depositId}`;
  ok((await anon.req('POST', `/api/payments/webhook?data.id=${payRef}`, {}, { 'X-MV-Request':'' })).status === 401, 'webhook sem assinatura recusado');
  ok((await anon.req('POST', `/api/payments/webhook?data.id=${payRef}`, {}, { 'x-test-sig':'ok' })).status === 200, 'webhook assinado');
  await anon.req('POST', `/api/payments/webhook?data.id=${payRef}`, {}, { 'x-test-sig':'ok' });
  r = await buyerC.req('GET', '/api/wallet'); ok(r.data.balance === 1000, 'depósito creditado uma única vez');
  ok((await sellerC.req('POST', '/api/market/buy', { id:listingId })).status === 400, 'não compra o próprio anúncio');
  r = await buyerC.req('POST', '/api/market/buy', { id:listingId }); ok(r.status === 200, 'compra');
  ok((await buyerC.req('POST', '/api/market/buy', { id:listingId })).status === 404, 'anúncio vendido some');
  ok((await buyerC.req('GET', '/api/wallet')).data.balance === 500 && (await sellerC.req('GET', '/api/wallet')).data.balance === 475, 'vendedor recebe menos 5% de taxa');
  r = await buyerC.req('GET', '/api/market/history?key=b:bokken:rare'); ok(r.data.sales[0].price === 500, 'histórico de preço');
  r = await buyerC.req('GET', '/api/market/mine'); ok(r.data.mailbox.length === 1, 'item no correio');
  r = await buyerC.req('POST', '/api/sync', { act:{ op:'marketClaim', args:[r.data.mailbox[0].id] } }); ok(r.data.result?.payload?.uid === item.uid && r.data.state.inventory.some(x => x.uid === item.uid), 'resgatar do correio para o estado');
  r = await sellerC.req('GET', '/api/market/mine'); const cardListing = r.data.listings[0];
  ok((await sellerC.req('POST', '/api/market/cancel', { id:cardListing.id })).status === 200 && (await sellerC.req('GET', '/api/market/mine')).data.mailbox.length === 1, 'cancelar devolve ao correio');
  ok((await sellerC.req('POST', '/api/wallet/withdraw', { amount:475, pixKey:'v@example.com', password:'Kizuna2026x' })).status === 400, 'saque mínimo');
  ok((await buyerC.req('POST', '/api/account/delete', { password:'Kizuna2026x', confirm:'Comprador1' })).status === 400, 'não exclui conta com saldo');
  r = await buyerC.req('POST', '/api/wallet/deposit', { amount:3000 }); await anon.req('POST', `/api/payments/webhook?data.id=pay-${r.data.depositId}`, {}, { 'x-test-sig':'ok' });
  ok((await buyerC.req('GET', '/api/wallet')).data.balance === 3500, 'segundo depósito');
  ok((await buyerC.req('POST', '/api/wallet/withdraw', { amount:2500, pixKey:'c@example.com', password:'errada' })).status === 401, 'saque exige senha');
  r = await buyerC.req('POST', '/api/wallet/withdraw', { amount:2500, pixKey:'c@example.com', password:'Kizuna2026x' }); ok(r.status === 200 && r.data.fee === 100, 'saque solicitado com taxa');
  r = await buyerC.req('GET', '/api/wallet'); ok(r.data.balance === 1000 && r.data.held === 2500, 'valor fica reservado');
  ok((await anon.req('GET', '/api/admin/withdrawals')).status === 403, 'admin exige token');
  r = await anon.req('GET', '/api/admin/withdrawals', undefined, { 'X-Admin-Token':'admin-secret-token' }); ok(r.data.pending.length === 1, 'fila de saques');
  const wid = r.data.pending[0].id;
  ok((await anon.req('POST', '/api/admin/withdrawals/decide', { id:wid, action:'rejected', note:'teste' }, { 'X-Admin-Token':'admin-secret-token' })).status === 200, 'recusar saque');
  r = await buyerC.req('GET', '/api/wallet'); ok(r.data.balance === 3500 && r.data.held === 0, 'recusa devolve o valor');
  r = await buyerC.req('POST', '/api/wallet/withdraw', { amount:2000, pixKey:'c@example.com', password:'Kizuna2026x' });
  await anon.req('POST', '/api/admin/withdrawals/decide', { id:r.data.id, action:'paid' }, { 'X-Admin-Token':'admin-secret-token' });
  r = await buyerC.req('GET', '/api/wallet'); ok(r.data.balance === 1500 && r.data.held === 0, 'saque pago baixa a reserva');
  r = await anon.req('GET', '/api/admin/withdrawals', undefined, { 'X-Admin-Token':'admin-secret-token' }); ok(r.data.houseFees === 25 + 100, 'taxas registradas no caixa');
  // Save antigo (ids de heróis anteriores à troca do elenco) é migrado ao carregar
  {
    const me = (await sellerC.req('GET', '/api/auth/me')).data.user;
    await server.store.transaction(async t => {
      const row = await t.getSave(me.id, true), data = JSON.parse(row.data), v = require('../server/game').validateSave(data);
      const rec = { uid:'hero_legacy', id:'solen', rarity:'rare', stars:2, level:3, xp:0, job:0, talents:{}, attr:{ str:0, agi:0, vit:0, int:0, dex:0, luk:0 }, equipped:{ weapon:null, focus:null, seal:null, charm:null } };
      data.collection.push(rec); data.shards = { ...(data.shards || {}), solen:7 };
      await t.updateSave(me.id, JSON.stringify(data).replace(/"solen"/g, '"goku"'), Date.now(), v.summary, row.revision);
    });
    r = await sellerC.req('GET', '/api/state');
    ok(r.data.state.collection.some(h => h.uid === 'hero_legacy' && h.id === 'solen') && r.data.state.shards.solen === 7 && !JSON.stringify(r.data.state).includes('"goku"'), 'save antigo migra os ids dos heróis');
  }
  // Materiais negociáveis, filtros do mercado e perfil público do vendedor
  await grant(sellerC, st => { st.mats = { ...(st.mats || {}), star:20 }; });
  ok((await list(sellerC, { kind:'mat', matId:'common', qty:5, price:200 })).data.actError, 'Tamahagane não é negociável');
  ok((await list(sellerC, { kind:'mat', matId:'rare', qty:50, price:200 })).data.actError, 'não anuncia mais material do que tem');
  r = await list(sellerC, { kind:'mat', matId:'rare', qty:5, price:200 }); ok(r.data.result?.id && r.data.state.mats.star === 15, 'anunciar material desconta do estado');
  const matListing = r.data.result.id;
  r = await anon.req('GET', '/api/market?type=mat'); ok(r.data.listings.length === 1 && r.data.listings[0].payload.qty === 5, 'filtro de materiais');
  const sellerId = r.data.listings[0].sellerId;
  r = await anon.req('GET', '/api/market?type=item&rarity=legendary'); ok(r.data.listings.every(l => l.kind === 'item' && l.payload.rarity === 'legendary'), 'filtro por raridade');
  r = await anon.req('GET', `/api/market?seller=${sellerId}`); ok(r.data.listings.length >= 1 && r.data.listings.every(l => l.sellerId === sellerId), 'anúncios de um vendedor');
  ok((await buyerC.req('POST', '/api/market/buy', { id:matListing })).status === 200, 'compra de material');
  r = await buyerC.req('GET', '/api/market/mine'); const matMail = r.data.mailbox.find(m => m.kind === 'mat');
  r = await buyerC.req('POST', '/api/sync', { act:{ op:'marketClaim', args:[matMail.id] } }); ok(r.data.state.mats.star === 5, 'material resgatado vai para o estoque certo');
  r = await anon.req('GET', `/api/profile?id=${sellerId}`);
  ok(r.status === 200 && r.data.profile.name === 'Vendedor1' && r.data.profile.sales >= 2 && Array.isArray(r.data.profile.team) && !JSON.stringify(r.data).includes('example.com'), 'perfil público sem dados privados');
  // Mercado em ouro: taxa de anúncio e imposto saem da economia; o item vai direto para a bolsa do comprador
  {
    const gItem = { uid:'it_gold_1', kind:'base', baseId:'bokken', slot:'weapon', wt:'sword', name:'Bokken de Ouro', icon:'katana_01', hue:40, ilvl:1, rarity:'rare', plus:0, primary:14, affixes:[], cards:[], locked:false };
    await grant(sellerC, st => { st.inventory.push(gItem); st.player.gold = 10000; });
    await grant(buyerC, st => { st.player.gold = 500; });
    r = await list(sellerC, { kind:'item', itemUid:gItem.uid, price:5000, currency:'gold' });
    ok(r.data.result?.id && r.data.result.listFee === 50 && r.data.state.player.gold === 9950, 'anúncio em ouro cobra taxa de 1% (mín. 50)');
    const gid = r.data.result.id;
    r = await anon.req('GET', '/api/market?currency=gold'); ok(r.data.listings.length === 1 && r.data.listings[0].currency === 'gold', 'filtro por moeda');
    ok((await buyerC.req('POST', '/api/market/buy', { id:gid })).status === 400, 'anúncio em ouro não é comprado com Gemas');
    const buyGold = (c2, id) => c2.req('POST', '/api/sync', { act:{ op:'marketBuyGold', args:[id] } });
    ok((await buyGold(buyerC, gid)).data.actError, 'ouro insuficiente');
    ok((await buyGold(sellerC, gid)).data.actError, 'não compra o próprio anúncio em ouro');
    await grant(buyerC, st => { st.player.gold = 8000; });
    r = await buyGold(buyerC, gid);
    ok(r.data.result?.delivered === 'bag' && r.data.state.player.gold === 3000 && r.data.state.inventory.some(x => x.uid === gItem.uid), 'compra em ouro entrega na bolsa');
    ok((await buyGold(buyerC, gid)).data.actError, 'anúncio vendido não é comprado de novo');
    r = await sellerC.req('GET', '/api/market/mine'); const gm = r.data.mailbox.find(m => m.kind === 'gold');
    ok(gm && gm.payload.amount === 4750, 'vendedor recebe o valor menos 5% de imposto');
    r = await sellerC.req('POST', '/api/sync', { act:{ op:'marketClaim', args:[gm.id] } }); ok(r.data.state.player.gold === 9950 + 4750, 'ouro resgatado do Correio');
    r = await buyerC.req('GET', `/api/market/history?key=b:bokken:rare&currency=gold`); ok(r.data.sales[0]?.price === 5000 && r.data.currency === 'gold', 'histórico de preço por moeda');
    r = await sellerC.req('GET', '/api/wallet'); ok(r.data.balance >= 475 && r.data.withdrawable === r.data.balance - 475 - 190, 'vendas em Gemas ficam retidas antes do saque');
    ok((await anon.req('GET', '/api/admin/economy')).status === 403, 'painel econômico exige token');
    r = await anon.req('GET', '/api/admin/economy', undefined, { 'X-Admin-Token':'admin-secret-token' });
    ok(r.data.gold.total > 0 && r.data.market.volume.some(v => v.currency === 'gold' && v.n7d === 1) && Array.isArray(r.data.flags), 'painel econômico com ouro, volume e alertas');
  }
  ok((await anon.req('GET', '/api/profile?id=abc')).status === 400 && (await anon.req('GET', '/api/profile?id=999999')).status === 404, 'perfil inválido ou inexistente');
  ok((await anon.req('GET', '/api/time')).data.time > 0, 'hora do servidor');
  label = name;

  // Login, sessão e ranking
  ok((await b.req('POST', '/api/auth/login', { login:'Heroi01', password:'errada123' })).status === 401, 'senha errada');
  r = await b.req('POST', '/api/auth/login', { login:'heroi@example.com', password:'Kizuna2026x' }); ok(r.status === 200 && b.cookie, 'login por e-mail');
  r = await b.req('GET', '/api/leaderboard?type=power'); ok(r.data.rows.length === 3 && r.data.rows.some(x => x.name === 'Heroi Um') && r.data.me.rank >= 1, 'ranking');
  ok((await b.req('GET', '/api/leaderboard?type=rift')).data.type === 'rift', 'ranking da Fenda');
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
  ok((await c.req('GET', '/api/state')).status === 401 && !(await anon.req('GET', '/api/leaderboard')).data.rows.some(x => x.name === 'Heroi Um'), 'dados removidos');

  // Logout
  const e = new Client(); await e.req('POST', '/api/auth/register', { username:'Outro_2', password:'Kizuna2026x', confirm:'Kizuna2026x', acceptTerms:true });
  await e.req('POST', '/api/auth/logout'); ok((await e.req('GET', '/api/auth/me')).status === 401, 'logout');

  // Backup (SQLite), no Postgres os backups ficam a cargo do provedor.
  if (server.store.kind === 'sqlite') { const file = server.store.backup(); ok(fs.existsSync(file), 'backup do banco'); }
  const h = await (await fetch(base + '/api/health')).json(); ok(h.db === server.store.kind, 'health informa o banco');

  await server.shutdown();
  fs.rmSync(dir, { recursive:true, force:true });
}

// Assinatura do webhook do Mercado Pago (HMAC-SHA256).
function mpSignatureTest() {
  label = 'mercadopago';
  const mp = mercadoPago({ accessToken:'x', webhookSecret:'segredo' }), ts = String(Math.floor(Date.now() / 1000));
  const v1 = crypto.createHmac('sha256', 'segredo').update(`id:123;request-id:req-1;ts:${ts};`).digest('hex');
  const url = new URL('http://x/api/payments/webhook?data.id=123');
  ok(mp.verifyWebhook({ headers:{ 'x-signature':`ts=${ts},v1=${v1}`, 'x-request-id':'req-1' } }, url) === '123', 'assinatura válida');
  ok(mp.verifyWebhook({ headers:{ 'x-signature':`ts=${ts},v1=${'0'.repeat(64)}`, 'x-request-id':'req-1' } }, url) === null, 'assinatura falsa recusada');
  ok(mp.verifyWebhook({ headers:{ 'x-signature':`ts=1000,v1=${v1}`, 'x-request-id':'req-1' } }, url) === null, 'assinatura velha recusada');
}

// Invasão Mundial: janela por horário, 1 investida por dia, vida compartilhada e recompensa conferida.
async function worldBossSuite() {
  label = 'invasão';
  let fake = Date.parse('2026-09-26T13:00:00-03:00'); const t0 = Date.now();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mythverse-wb-'));
  server = await createServer({ dataDir:dir, quiet:true, noBackups:true, secureCookie:false, now:() => fake + (Date.now() - t0) });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${server.address().port}`;
  const p1 = new Client(), p2 = new Client();
  for (const [c, n] of [[p1, 'Invasor1'], [p2, 'Invasor2']]) {
    await c.req('POST', '/api/auth/register', { username:n, password:'Kizuna2026x', confirm:'Kizuna2026x', acceptTerms:true });
    let r = await c.req('GET', '/api/state'); r = await c.req('POST', '/api/sync', { act:{ op:'openBoxes', args:[10] } });
    for (let i = 0; i < 4; i++) await c.req('POST', '/api/sync', { act:{ op:'setParty', args:[i, r.data.state.collection[i].uid] } });
    await grant(c, st => { st.progress.boss.kills = 1; st.collection.forEach(h => { h.level = 20; }); });
  }
  let r = await p1.req('GET', '/api/worldboss'); ok(r.data.active && r.data.boss === 'wb_storm_kitsune', 'janela aberta e chefe do dia (sábado)');
  r = await p1.req('POST', '/api/sync', { start:{ zone:'world_boss', opts:{ tier:0 } } }); const seg = r.data.seg; ok(seg && seg.opts.tier === 0, 'investida começa');
  await new Promise(res => setTimeout(res, 1200));
  r = await p1.req('POST', '/api/sync', { finish:{ segId:seg.id, endTick:60, inputs:[] } }); ok(r.data.finish.status === 'ok', 'investida conferida');
  // Só termina de verdade ao fim dos 90s; simulamos uma investida completa com tempo suficiente.
  fake += 60000;
  r = await p1.req('POST', '/api/sync', { start:{ zone:'world_boss', opts:{ tier:0 } } }); const seg2 = r.data.seg;
  fake += 40000;
  r = await p1.req('POST', '/api/sync', { finish:{ segId:seg2.id, endTick:1900, inputs:[] } });
  ok(r.data.state.worldBoss.damage > 0 && r.data.state.worldBoss.day === '2026-09-26', 'dano registrado na investida');
  ok((await p1.req('POST', '/api/sync', { start:{ zone:'world_boss', opts:{ tier:0 } } })).data.startError, 'só uma investida por dia');
  r = await p2.req('POST', '/api/sync', { start:{ zone:'world_boss', opts:{ tier:0 } } }); ok(r.data.seg, 'outro jogador investe na mesma janela');
  r = await p1.req('GET', '/api/worldboss'); ok(r.data.tiers[0].participants === 1 && r.data.tiers[0].damage > 0 && r.data.tiers[0].top[0].name === 'Invasor1', 'vida compartilhada e ranking da janela');
  ok((await p1.req('POST', '/api/sync', { act:{ op:'claimWorldBoss', args:[] } })).data.actError, 'recompensa só depois da janela');
  fake = Date.parse('2026-09-26T14:05:00-03:00');
  const gold0 = (await p1.req('GET', '/api/state')).data.state.player.gold;
  r = await p1.req('POST', '/api/sync', { act:{ op:'claimWorldBoss', args:[] } }); ok(r.data.result && r.data.result.rank === 1 && r.data.state.player.gold > gold0, 'recompensa da Invasão resgatada');
  ok((await p1.req('POST', '/api/sync', { act:{ op:'claimWorldBoss', args:[] } })).data.actError, 'não resgata duas vezes');
  r = await p1.req('GET', '/api/worldboss'); ok(!r.data.active && r.data.next, 'fora da janela mostra a próxima');
  await server.shutdown(); fs.rmSync(dir, { recursive:true, force:true });
}

(async () => {
  mpSignatureTest();
  await worldBossSuite();
  await suite('sqlite', {});
  const { PGlite } = await import('@electric-sql/pglite');
  await suite('postgres', { pglite:new PGlite() });
  console.log(JSON.stringify({ ok:true, checks, bancos:['sqlite', 'postgres'] }));
})().catch(async err => { console.error(err); try { await server?.shutdown(); } catch (_) {} process.exit(1); });
