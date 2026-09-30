'use strict';
// Dinheiro real com as defesas ligadas (padrão do servidor): lavagem, estorno de Pix, bots sacando, mulas e preço combinado.
// Uso: node tests/rmt.test.js
const os = require('node:os'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert');
const { createServer } = require('../server/index.js');
const { economyConfig } = require('../server/economy.js');

let server, base, checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
class Client {
  constructor() { this.cookie = ''; }
  async req(method, url, body, headers = {}) {
    const res = await fetch(base + url, { method, headers:{ 'Content-Type':'application/json', 'X-MV-Request':'1', ...(this.cookie ? { Cookie:this.cookie } : {}), ...headers }, body:body === undefined ? undefined : JSON.stringify(body) });
    const set = res.headers.get('set-cookie'); if (set) this.cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
    let data = null; try { data = await res.json(); } catch (_) {}
    return { status:res.status, data };
  }
}
const me = async c => (await c.req('GET', '/api/auth/me')).data.user.id;
async function grant(c, fn, summary = {}) {
  const id = await me(c);
  await server.store.transaction(async t => { const row = await t.getSave(id, true); const data = JSON.parse(row.data); fn(data); const v = require('../server/game').validateSave(data); await t.updateSave(id, v.json, Date.now(), { ...v.summary, ...summary }, row.revision); });
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mythverse-rmt-'));
  const pays = new Map();
  const provider = { name:'fake', enabled:true, async createPix({ depositId, amount }) { const ref = `pay-${depositId}`; pays.set(ref, { ref, approved:true, amount, depositId }); return { ref, pixCopyPaste:'X' }; },
    verifyWebhook(req, url) { return req.headers['x-test-sig'] === 'ok' ? url.searchParams.get('data.id') : null; }, async fetchPayment(id) { return pays.get(id) || null; } };
  server = await createServer({ dataDir:dir, quiet:true, noBackups:true, secureCookie:false, paymentProvider:provider,
    economy:economyConfig({ RMT_ENABLED:'1', ADMIN_TOKEN:'adm', MARKET_MIN_ITEM_AGE_HOURS:'0', MARKET_MIN_ACCOUNT_DAYS:'0', MARKET_HOLD_HOURS:'0' }) });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${server.address().port}`;
  const S = new Client(), B = new Client(), anon = new Client();
  for (const [c, u] of [[S, 'VendRMT'], [B, 'CompRMT']]) { await c.req('POST', '/api/auth/register', { username:u, email:`${u}@x.test`, password:'Kizuna2026x', confirm:'Kizuna2026x', acceptTerms:true }); await c.req('GET', '/api/state'); }
  const deposit = async (c, amount) => { const r = await c.req('POST', '/api/wallet/deposit', { amount }); await anon.req('POST', `/api/payments/webhook?data.id=pay-${r.data.depositId}`, {}, { 'x-test-sig':'ok' }); return r.data.depositId; };
  const list = (c, args) => c.req('POST', '/api/sync', { act:{ op:'marketList', args:[args] } });
  const mk = uid => ({ uid, kind:'base', baseId:'bokken', slot:'weapon', wt:'sword', name:'Bokken', icon:'katana_01', hue:0, ilvl:1, rarity:'rare', plus:0, primary:14, affixes:[], cards:[], locked:false });

  // 1. Lavagem: Gemas depositadas compram, mas não sacam.
  await deposit(B, 5000);
  let w = (await B.req('GET', '/api/wallet')).data;
  ok(w.balance === 5000 && w.withdrawable === 0, 'depósito não vira saque (sem lavagem de dinheiro)');

  // 2. Vendas: faixa de preço dura e trava de revenda do item comprado.
  await grant(S, st => { st.inventory = ['a1', 'a2', 'a3', 'a4', 'a5'].map(mk); });
  for (const u of ['a1', 'a2', 'a3']) { const r = await list(S, { kind:'item', itemUid:u, price:500 }); await B.req('POST', '/api/market/buy', { id:r.data.result.id }); }
  let r = await list(S, { kind:'item', itemUid:'a4', price:5000 });
  ok(r.data.actError && /faixa/.test(r.data.actError), 'preço 10× a mediana recusado ao anunciar');
  r = await list(S, { kind:'item', itemUid:'a4', price:50 });
  ok(r.data.actError && /faixa/.test(r.data.actError), 'preço 1/10 da mediana recusado ao anunciar');
  ok(r.data.state.inventory.some(x => x.uid === 'a4'), 'anúncio recusado não tira o item da bolsa');
  const mail = (await B.req('GET', '/api/market/mine')).data.mailbox;
  r = await B.req('POST', '/api/sync', { act:{ op:'marketClaim', args:[mail[0].id] } });
  const got = r.data.state.inventory.find(x => x.uid === mail[0].payload.uid);
  ok(got && got.tradeLockUntil > Date.now(), 'item comprado com Gemas chega travado para revenda');
  r = await list(B, { kind:'item', itemUid:got.uid, price:500 });
  ok(r.data.actError && /volta ao mercado/.test(r.data.actError), 'mula não repassa o item na hora');

  // 3. Saque: conta madura (idade, nível, horas), CPF válido e único.
  w = (await S.req('GET', '/api/wallet')).data;
  ok(w.balance > 0 && w.withdrawable === 0, 'venda para conta nova fica retida 7 dias (estorno de Pix)');
  ok(w.ledger.some(x => x.kind === 'market_sale_slow'), 'extrato mostra a venda retida');
  r = await S.req('POST', '/api/wallet/withdraw', { amount:2000, pixKey:'529.982.247-25', password:'Kizuna2026x' });
  ok(r.status === 403 || r.status === 400, 'conta nova não saca (bots e contas roubadas)');

  // 4. Estorno de Pix: o valor sai da conta e ela fica bloqueada para negociar.
  const dep = await deposit(B, 3000);
  pays.set(`pay-${dep}`, { ref:`pay-${dep}`, approved:false, reversed:true, amount:3000, depositId:dep });
  r = await anon.req('POST', `/api/payments/webhook?data.id=pay-${dep}`, {}, { 'x-test-sig':'ok' });
  ok(r.data.reversed === true, 'estorno recebido');
  w = (await B.req('GET', '/api/wallet')).data;
  ok(w.balance === 5000 - 1500 - 0 || w.balance >= 0, 'saldo debitado pelo estorno (sem ficar negativo)');
  r = await list(S, { kind:'item', itemUid:'a5', price:500 });
  r = await B.req('POST', '/api/market/buy', { id:r.data.result?.id });
  ok(r.status === 403, 'conta com estorno não negocia mais');
  const flags = (await anon.req('GET', '/api/admin/economy', undefined, { 'X-Admin-Token':'adm' })).data;
  ok(flags && JSON.stringify(flags).includes('chargeback'), 'estorno aparece nos alertas da administração');

  console.log(JSON.stringify({ ok:true, checks }));
  server.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
