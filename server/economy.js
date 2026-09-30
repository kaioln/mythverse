'use strict';
// Economia de dinheiro real: carteira de Gemas (100 Gemas = R$ 1,00), depósitos Pix, saques com revisão
// manual e o Mercado de Jogadores com custódia dos itens no servidor.
// Tudo que envolve dinheiro acontece em transação no banco e fica registrado no livro-caixa (wallet_ledger).
const sec = require('./security');
const game = require('./game');
const { createProvider, safeEqualHex } = require('./payments');

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));
function economyConfig(env = process.env, production = false) {
  return {
    enabled:env.RMT_ENABLED === '1' || env.RMT_ENABLED === 'true',
    feeBps:num(env.MARKET_FEE_BPS, 500), withdrawFeeBps:num(env.WITHDRAW_FEE_BPS, 200), withdrawMinFee:num(env.WITHDRAW_MIN_FEE, 100),
    minDeposit:num(env.MIN_DEPOSIT, 500), maxDeposit:num(env.MAX_DEPOSIT, 100000), minWithdraw:num(env.MIN_WITHDRAW, 2000), maxWithdrawDay:num(env.MAX_WITHDRAW_DAY, 500000),
    minPrice:num(env.MARKET_MIN_PRICE, 10), maxPrice:num(env.MARKET_MAX_PRICE, 5000000), maxOpen:num(env.MARKET_MAX_OPEN, 30), maxListDay:num(env.MARKET_MAX_LIST_DAY, 40),
    minItemAgeHours:num(env.MARKET_MIN_ITEM_AGE_HOURS, 24), minAccountDays:num(env.MARKET_MIN_ACCOUNT_DAYS, 3), listingDays:num(env.MARKET_LISTING_DAYS, 14),
    withdrawals:env.WITHDRAWALS_ENABLED !== '0', adminToken:env.ADMIN_TOKEN || '',
    // Mercado em ouro (sem dinheiro real): sempre ligado, com taxa de anúncio e imposto sobre a venda (ambos saem da economia).
    goldMarket:env.GOLD_MARKET_ENABLED !== '0', goldTaxBps:num(env.GOLD_MARKET_TAX_BPS, 500), goldListFeeBps:num(env.GOLD_MARKET_LIST_FEE_BPS, 100), goldListFeeMin:num(env.GOLD_MARKET_LIST_FEE_MIN, 50),
    goldMinPrice:num(env.GOLD_MARKET_MIN_PRICE, 100), goldMaxPrice:num(env.GOLD_MARKET_MAX_PRICE, 1e13), goldMinItemAgeHours:num(env.GOLD_MARKET_MIN_ITEM_AGE_HOURS, 1),
    // Controles do dinheiro real: retenção das vendas antes do saque, bloqueio de compra na mesma rede e alertas.
    holdHours:num(env.MARKET_HOLD_HOURS, 72), blockSameNetwork:env.MARKET_BLOCK_SAME_NETWORK !== '0', outlierX:num(env.MARKET_OUTLIER_X, 10), pairLimit:num(env.MARKET_PAIR_TRADES_WEEK, 3),
    // Defesas do dinheiro real (o que destruiu economias de MMO: lavagem, estorno, bots sacando, mulas e preço combinado).
    earnedOnly:env.WITHDRAW_EARNED_ONLY !== '0',                 // só saca Gemas ganhas vendendo; Gemas depositadas só compram (sem lavagem)
    wdMinAccountDays:num(env.WITHDRAW_MIN_ACCOUNT_DAYS, 30), wdMinLevel:num(env.WITHDRAW_MIN_LEVEL, 30), wdMinPlayHours:num(env.WITHDRAW_MIN_PLAY_HOURS, 20),
    pixRequireCpf:env.PIX_REQUIRE_CPF !== '0',                     // saque só para chave CPF válida, e um CPF por conta
    priceBandX:num(env.MARKET_PRICE_BAND_X, 5), priceFloorX:num(env.MARKET_PRICE_FLOOR_X, .25), // faixa dura contra preço combinado
    resaleLockDays:num(env.MARKET_RESALE_LOCK_DAYS, 7),           // item comprado com Gemas só volta ao mercado depois disso (sem corrente de mulas)
    newBuyerHoldDays:num(env.MARKET_NEW_BUYER_HOLD_DAYS, 7), newBuyerAccountDays:num(env.MARKET_NEW_BUYER_ACCOUNT_DAYS, 30), // estorno de Pix: segura mais a venda feita a conta nova
    paymentKind:env.PAYMENT_PROVIDER || '', mpAccessToken:env.MP_ACCESS_TOKEN || '', mpWebhookSecret:env.MP_WEBHOOK_SECRET || '', production
  };
}

function economy({ store, cfg, send, fail, readJson, readBody, limiter, clientIp, audit, log }) {
  const E = cfg.economy;
  const provider = createProvider({ ...E, paymentProvider:cfg.paymentProvider, publicOrigin:cfg.publicOrigin });
  const HOUR = 3600_000, DAY = 24 * HOUR;
  const publicConfig = () => ({ goldMarket:E.goldMarket, goldTaxBps:E.goldTaxBps, goldListFeeBps:E.goldListFeeBps, goldListFeeMin:E.goldListFeeMin, goldMinPrice:E.goldMinPrice, holdHours:E.holdHours, enabled:E.enabled, reason:E.enabled ? null : 'O Mercado de Jogadores e a carteira estão desativados neste servidor.', payments:E.enabled && provider.enabled, withdrawals:E.enabled && E.withdrawals,
    feeBps:E.feeBps, withdrawFeeBps:E.withdrawFeeBps, withdrawMinFee:E.withdrawMinFee, minDeposit:E.minDeposit, maxDeposit:E.maxDeposit, minWithdraw:E.minWithdraw, minPrice:E.minPrice, maxPrice:E.maxPrice, minItemAgeHours:E.minItemAgeHours });
  const feeOf = price => Math.ceil(price * E.feeBps / 10000);
  const goldTaxOf = price => Math.ceil(price * E.goldTaxBps / 10000);
  const goldListFee = price => Math.max(E.goldListFeeMin, Math.ceil(price * E.goldListFeeBps / 10000));
  const withdrawable = async uid => {
    const w = await store.wallet(uid), now = Date.now(), bal = Number(w.balance);
    const recent = (E.holdHours > 0 ? await store.recentCredits(uid, 'market_sale', now - E.holdHours * HOUR) : 0) + await store.recentCredits(uid, 'market_sale_slow', now - E.newBuyerHoldDays * DAY);
    if (!E.earnedOnly) return Math.max(0, bal - recent);
    const earned = await store.recentCredits(uid, 'market_sale', 0) + await store.recentCredits(uid, 'market_sale_slow', 0) - recent;
    const out = -(await store.recentCredits(uid, 'withdraw_hold', 0)) - await store.recentCredits(uid, 'withdraw_refund', 0) + await store.recentCredits(uid, 'chargeback', 0);
    return Math.max(0, Math.min(bal - recent, earned - out));
  };
  // CPF com dígitos verificadores (chave Pix de saque).
  const validCpf = v => { const d = String(v).replace(/\D/g, ''); if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false; const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; }; return dv(9) === Number(d[9]) && dv(10) === Number(d[10]); };
  // Só IPs públicos contam (atrás de um proxy sem TRUST_PROXY todos teriam o IP interno do proxy).
  const publicIp = ip => { const v = String(ip || '').replace(/^::ffff:/, ''); return !!v && v !== '?' && !/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|f[cd][0-9a-f]{2}:|fe80:)/i.test(v); };
  const median = arr => { const a = arr.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };
  const withdrawFee = amount => Math.max(E.withdrawMinFee, Math.ceil(amount * E.withdrawFeeBps / 10000));
  const intIn = (v, a, b) => Number.isSafeInteger(v) && v >= a && v <= b;
  const requireOn = res => { if (!E.enabled) { fail(res, 503, 'O Mercado de Jogadores está desativado neste servidor.'); return false; } return true; };
  async function eligible(res, s) {
    const u = await store.userById(s.user_id);
    if (!u || u.banned) { fail(res, 403, 'Conta sem permissão para negociar.'); return null; }
    if (Number(u.suspicious) >= 3) { fail(res, 403, 'Conta em revisão: negociação bloqueada. Fale com o suporte.'); return null; }
    if (Date.now() - Number(u.created_at) < E.minAccountDays * DAY) { fail(res, 403, `Contas precisam de ${E.minAccountDays} dia(s) para negociar.`); return null; }
    return u;
  }
  const credit = async (t, uid, amount, kind, ref, label, now) => { await t.walletLock(uid); if (!await t.walletMove(uid, amount, 0, now)) throw new Error('wallet_move'); await t.ledger(uid, amount, kind, ref, label, now); };

  const parseRow = r => ({ id:Number(r.id), sellerId:Number(r.seller_id), seller:r.seller_name, kind:r.kind, payload:JSON.parse(r.payload), price:Number(r.price), createdAt:Number(r.created_at), currency:r.currency || 'gems' });

  const routes = {
    'GET /api/time': async (req, res) => send(res, 200, { ok:true, time:Date.now() }),

    'GET /api/wallet': async (req, res, s) => {
      if (!s) return fail(res, 401, 'Não autenticado.');
      const w = await store.wallet(s.user_id);
      send(res, 200, { ok:true, balance:Number(w.balance), held:Number(w.held), withdrawable:await withdrawable(s.user_id), ledger:(await store.ledgerOf(s.user_id, 30)).map(l => ({ ...l, delta:Number(l.delta) })), withdrawals:await store.withdrawalsOf(s.user_id), config:publicConfig() });
    },

    'POST /api/wallet/deposit': async (req, res, s) => {
      if (!s) return fail(res, 401, 'Não autenticado.');
      if (!requireOn(res)) return;
      if (!provider.enabled) return fail(res, 503, 'Depósitos ainda não estão configurados neste servidor.');
      if (!limiter.allow(`dep:${s.user_id}`, 10, HOUR)) return fail(res, 429, 'Muitos pedidos de depósito. Aguarde.');
      const b = await readJson(req), amount = Number(b.amount);
      if (!intIn(amount, E.minDeposit, E.maxDeposit)) return fail(res, 400, `Valor entre R$ ${(E.minDeposit / 100).toFixed(2)} e R$ ${(E.maxDeposit / 100).toFixed(2)}.`);
      const u = await eligible(res, s); if (!u) return;
      if (provider.name === 'mercadopago' && !u.email) return fail(res, 400, 'Cadastre um e-mail na conta para depositar via Pix.');
      const now = Date.now();
      const id = await store.insertDeposit(s.user_id, amount, provider.name, `pending-${s.user_id}-${now}-${sec.newToken().slice(0, 8)}`, now);
      let px;
      try { px = await provider.createPix({ depositId:id, amount, email:u.email }); }
      catch (err) { log('deposit', err.message); return fail(res, 502, 'O provedor de pagamento não respondeu. Tente de novo.'); }
      await store.setDepositRef(id, px.ref);
      audit(s.user_id, 'deposit_created', req, `${id}:${amount}`);
      if (provider.instant) {
        await store.transaction(async t => { const dep = await t.depositByRef(provider.name, px.ref, true); if (dep && dep.status === 'pending' && await t.markDepositPaid(dep.id, now)) await credit(t, s.user_id, amount, 'deposit', `dep:${id}`, 'Depósito (teste)', now); });
        return send(res, 200, { ok:true, credited:true });
      }
      send(res, 200, { ok:true, depositId:id, pixCopyPaste:px.pixCopyPaste, checkoutUrl:px.checkoutUrl });
    },

    // Notificação do provedor. Assinatura verificada + pagamento consultado de novo na API antes de creditar.
    'POST /api/payments/webhook': async (req, res) => {
      await readBody(req).catch(() => '');
      const url = new URL(req.url, 'http://x');
      const payId = provider.verifyWebhook?.(req, url);
      if (!payId) { audit(null, 'webhook_rejected', req, provider.name); return fail(res, 401, 'Assinatura inválida.'); }
      let pay;
      try { pay = await provider.fetchPayment(payId); } catch (err) { log('webhook', err.message); return fail(res, 502, 'Falha ao consultar o provedor.'); }
      if (pay && pay.reversed) {
        const now2 = Date.now();
        const rev = await store.transaction(async t => {
          const dep = await t.depositByRef(provider.name, pay.ref, true);
          if (!dep || dep.status !== 'paid' || !await t.markDepositReversed(dep.id, now2)) return null;
          const uid = Number(dep.user_id), amount = Number(dep.amount);
          await t.walletLock(uid); await t.walletForce(uid, -amount, now2);
          await t.ledger(uid, -amount, 'chargeback', `dep:${dep.id}`, 'Depósito estornado pelo banco', now2);
          await t.flag('chargeback', uid, null, `depósito ${dep.id}: ${amount}`, now2);
          for (let i = 0; i < 3; i++) await t.flagSuspicious(uid);
          return dep;
        });
        if (rev) audit(Number(rev.user_id), 'deposit_reversed', req, `${rev.id}:${rev.amount}`);
        return send(res, 200, { ok:true, reversed:!!rev });
      }
      if (!pay || !pay.approved) return send(res, 200, { ok:true, ignored:true });
      const now = Date.now();
      const done = await store.transaction(async t => {
        const dep = await t.depositByRef(provider.name, pay.ref, true);
        if (!dep || dep.status !== 'pending' || Number(dep.amount) !== pay.amount || (pay.depositId && pay.depositId !== Number(dep.id))) return false;
        if (!await t.markDepositPaid(dep.id, now)) return false;
        await credit(t, Number(dep.user_id), Number(dep.amount), 'deposit', `dep:${dep.id}`, 'Depósito Pix', now);
        return dep;
      });
      if (done) audit(Number(done.user_id), 'deposit_paid', req, `${done.id}:${done.amount}`);
      send(res, 200, { ok:true });
    },

    'POST /api/wallet/withdraw': async (req, res, s) => {
      if (!s) return fail(res, 401, 'Não autenticado.');
      if (!requireOn(res)) return;
      if (!E.withdrawals) return fail(res, 503, 'Saques estão desativados neste servidor.');
      if (!limiter.allow(`wd:${s.user_id}`, 5, HOUR)) return fail(res, 429, 'Muitos pedidos de saque. Aguarde.');
      const b = await readJson(req), amount = Number(b.amount), pixKey = String(b.pixKey || '').trim().slice(0, 140);
      const u = await eligible(res, s); if (!u) return;
      if (!sec.verifySecret(String(b.password || ''), u.pass_hash)) return fail(res, 401, 'Senha incorreta.');
      if (!intIn(amount, E.minWithdraw, 1e10)) return fail(res, 400, `Saque mínimo de R$ ${(E.minWithdraw / 100).toFixed(2)}.`);
      if (pixKey.length < 5) return fail(res, 400, 'Informe uma chave Pix válida.');
      const prof = await store.publicProfile(s.user_id);
      if (Date.now() - Number(u.created_at) < E.wdMinAccountDays * DAY) return fail(res, 403, `Saques liberam com ${E.wdMinAccountDays} dias de conta (proteção contra bots e contas roubadas).`);
      if (Number(prof?.account_level || 0) < E.wdMinLevel) return fail(res, 403, `Saques liberam no nível ${E.wdMinLevel} da conta.`);
      if (Number(prof?.play_seconds || 0) < E.wdMinPlayHours * 3600) return fail(res, 403, `Saques liberam com ${E.wdMinPlayHours} horas de jogo.`);
      if (E.pixRequireCpf) {
        if (!validCpf(pixKey)) return fail(res, 400, 'Saques vão só para chave Pix CPF do titular da conta (CPF válido).');
        const others = (await store.pixKeyOwners(pixKey.replace(/\D/g, ''))).filter(id => id !== s.user_id);
        if (others.length) { await store.flag('pix_shared', s.user_id, others[0], 'mesmo CPF em outra conta', Date.now()); return fail(res, 403, 'Este CPF já recebe saques de outra conta. Uma conta por CPF.'); }
      }
      if (await store.withdrawalsToday(s.user_id, Date.now() - DAY) + amount > E.maxWithdrawDay) return fail(res, 400, 'Limite diário de saque atingido.');
      const fee = withdrawFee(amount), now = Date.now();
      if (fee >= amount) return fail(res, 400, 'Valor menor que a taxa de saque.');
      if (amount > await withdrawable(s.user_id)) return fail(res, 400, `Vendas no Mercado ficam ${E.holdHours}h em análise antes do saque. Valor disponível para saque: R$ ${((await withdrawable(s.user_id)) / 100).toFixed(2).replace('.', ',')}.`);
      const r = await store.transaction(async t => {
        await t.walletLock(s.user_id);
        if (!await t.walletMove(s.user_id, -amount, amount, now)) return { error:'Saldo insuficiente.' };
        const id = await t.insertWithdrawal(s.user_id, amount, fee, E.pixRequireCpf ? pixKey.replace(/\D/g, '') : pixKey, now);
        await t.ledger(s.user_id, -amount, 'withdraw_hold', `wd:${id}`, `Saque solicitado (taxa ${(fee / 100).toFixed(2).replace('.', ',')})`, now);
        return { id };
      });
      if (r.error) return fail(res, 400, r.error);
      audit(s.user_id, 'withdraw_request', req, `${r.id}:${amount}`);
      send(res, 200, { ok:true, id:r.id, fee, net:amount - fee });
    },

    // ---- administração (cabeçalho X-Admin-Token) ----
    // Painel econômico: estoque de ouro, Gemas em circulação, volume do mercado, taxas e alertas.
    'GET /api/admin/economy': async (req, res) => {
      if (!adminOk(req)) return fail(res, 403, 'Negado.');
      const now = Date.now(), st = await store.econStats(now - DAY, now - 7 * DAY), n = x => Number(x) || 0;
      send(res, 200, { ok:true, at:now, config:publicConfig(),
        gold:{ total:n(st.gold.total), saves:n(st.gold.saves), avg:Math.round(n(st.gold.avg)), max:n(st.gold.max), richest:st.rich.map(r => ({ name:r.name, gold:n(r.gold), power:n(r.power) })) },
        gems:{ balance:n(st.gems.balance), held:n(st.gems.held), deposits7d:{ total:n(st.dep.total), n:n(st.dep.n) }, withdrawals7d:{ total:n(st.wd.total), n:n(st.wd.n) }, fees7d:n(st.fees.total), houseTotal:await store.houseTotal() },
        market:{ volume:st.vol.map(v => ({ currency:v.currency, n7d:n(v.n), total7d:n(v.total), n24h:n(v.n1), total24h:n(v.total1) })), open:st.open.map(o => ({ currency:o.currency, n:n(o.n) })), top:st.top.map(t2 => ({ name:t2.name, currency:t2.currency, n:n(t2.n), lo:n(t2.lo), hi:n(t2.hi) })) },
        flags:(await store.flags(50)).map(f => ({ ...f, id:n(f.id), at:n(f.at) })) });
    },
    'GET /api/admin/withdrawals': async (req, res) => {
      if (!adminOk(req)) return fail(res, 403, 'Negado.');
      send(res, 200, { ok:true, pending:await store.pendingWithdrawals(), houseFees:await store.houseTotal() });
    },
    'POST /api/admin/withdrawals/decide': async (req, res) => {
      if (!adminOk(req)) return fail(res, 403, 'Negado.');
      const b = await readJson(req), id = Number(b.id), action = b.action, note = String(b.note || '').slice(0, 200), now = Date.now();
      if (!['paid', 'rejected'].includes(action)) return fail(res, 400, 'Ação inválida.');
      const r = await store.transaction(async t => {
        const w = await t.withdrawalLock(id); if (!w || w.status !== 'pending') return { error:'Saque não está pendente.' };
        const uid = Number(w.user_id), amount = Number(w.amount), fee = Number(w.fee);
        if (!await t.decideWithdrawal(id, action, note, now)) return { error:'Conflito.' };
        if (uid) await t.walletLock(uid);
        if (action === 'paid') { if (uid && !await t.walletMove(uid, 0, -amount, now)) throw new Error('held'); await t.ledger(null, fee, 'fee_withdraw', `wd:${id}`, 'Taxa de saque', now); }
        else { if (uid) { if (!await t.walletMove(uid, amount, -amount, now)) throw new Error('held'); await t.ledger(uid, amount, 'withdraw_refund', `wd:${id}`, `Saque recusado${note ? `: ${note}` : ''}`, now); } }
        return { ok:true };
      });
      if (r.error) return fail(res, 409, r.error);
      audit(null, `withdraw_${action}`, req, String(id));
      send(res, 200, { ok:true });
    },

    // ---- mercado ----
    'GET /api/market': async (req, res) => {
      const url = new URL(req.url, 'http://x'), qp = k => String(url.searchParams.get(k) || '').slice(0, 40);
      const type = qp('type'), slot = qp('slot'), rarity = qp('rarity'), seller = Number(qp('seller')) || null, currency = ['gold', 'gems'].includes(qp('currency')) ? qp('currency') : null;
      const narrow = (slot && slot !== 'all') || (rarity && rarity !== 'all');
      const rows = await store.openListings({ kind:['item', 'card', 'mat'].includes(type) ? type : null, q:qp('q'), sort:qp('sort'), sellerId:Number.isSafeInteger(seller) && seller > 0 ? seller : null, currency:!E.enabled ? 'gold' : currency, limit:narrow ? 300 : 60 });
      let listings = rows.map(parseRow);
      if (narrow) listings = listings.filter(l => l.kind === 'item' && (!slot || slot === 'all' || l.payload.slot === slot) && (!rarity || rarity === 'all' || l.payload.rarity === rarity)).slice(0, 60);
      send(res, 200, { ok:true, listings, config:publicConfig() });
    },
    // Perfil público (vendedores do mercado, ranking): só dados de vitrine, nunca e-mail, carteira ou save completo.
    'GET /api/profile': async (req, res) => {
      if (!limiter.allow(`profile:${clientIp(req)}`, 120, 60_000)) return fail(res, 429, 'Muitas consultas. Aguarde um pouco.');
      const id = Number(new URL(req.url, 'http://x').searchParams.get('id'));
      if (!Number.isSafeInteger(id) || id <= 0) return fail(res, 400, 'Perfil inválido.');
      const p = await store.publicProfile(id);
      if (!p || p.banned) return fail(res, 404, 'Jogador não encontrado.');
      let team = [];
      try {
        const save = await store.getSave(id), st = save ? JSON.parse(save.data) : null;
        if (st) team = (st.formation || []).map(uid => uid && (st.collection || []).find(h => h.uid === uid)).filter(Boolean).map(h => ({
          id:String(h.id), stars:Number(h.stars) || 1, level:Number(h.level) || 1, rarity:String(h.rarity || ''),
          gear:Object.values(h.equipped || {}).map(uid => (st.inventory || []).find(x => x.uid === uid)).filter(Boolean).map(x => ({ name:String(x.name || ''), rarity:String(x.rarity || ''), slot:String(x.slot || ''), plus:Number(x.plus) || 0 }))
        }));
      } catch (_) { team = []; }
      send(res, 200, { ok:true, profile:{ id, name:p.username, since:Number(p.created_at), power:Number(p.power) || 0, bossKills:Number(p.boss_kills) || 0, bestStage:Number(p.best_stage) || 0, riftBest:Number(p.rift_best) || 0, level:Number(p.account_level) || 1, playHours:Math.floor((Number(p.play_seconds) || 0) / 3600), sales:E.enabled ? await store.salesOf(id) : 0, open:E.enabled ? await store.countOpenOf(id) : 0, team } });
    },
    'GET /api/market/mine': async (req, res, s) => {
      if (!s) return fail(res, 401, 'Não autenticado.');
      send(res, 200, { ok:true, listings:(await store.listingsOf(s.user_id)).map(parseRow), mailbox:(await store.mailOf(s.user_id)).map(m => ({ id:Number(m.id), kind:m.kind, payload:JSON.parse(m.payload), reason:m.reason })) });
    },
    'GET /api/market/history': async (req, res) => {
      const u2 = new URL(req.url, 'http://x'), key = String(u2.searchParams.get('key') || '').slice(0, 80), cur = u2.searchParams.get('currency') === 'gold' ? 'gold' : 'gems';
      send(res, 200, { ok:true, currency:cur, sales:(await store.priceHistory(key, cur)).map(r => ({ price:Number(r.price), at:Number(r.closed_at) })) });
    },

    'POST /api/market/buy': async (req, res, s) => {
      if (!s) return fail(res, 401, 'Não autenticado.');
      if (!requireOn(res)) return;
      if (!limiter.allow(`buy:${s.user_id}`, 30, 10 * 60_000)) return fail(res, 429, 'Muitas compras em pouco tempo.');
      const u = await eligible(res, s); if (!u) return;
      const id = Number((await readJson(req)).id), now = Date.now(), ip = clientIp(req);
      const r = await store.transaction(async t => {
        const l = await t.listingLock(id);
        if (!l || l.status !== 'open') return { error:[404, 'Anúncio indisponível.'] };
        if ((l.currency || 'gems') !== 'gems') return { error:[400, 'Este anúncio é em ouro: compre pelo jogo.'] };
        const seller = Number(l.seller_id), price = Number(l.price), fee = feeOf(price);
        if (seller === s.user_id) return { error:[400, 'Você não pode comprar o próprio anúncio.'] };
        // Mesma rede do vendedor: bloqueia (contas múltiplas movendo dinheiro entre si).
        if (seller && E.blockSameNetwork && publicIp(ip) && (await t.recentIps(seller, now - 30 * DAY)).has(ip)) {
          await t.flag('same_network', s.user_id, seller, `anúncio ${id} · ${price} Gemas`, now);
          return { error:[403, 'Compra bloqueada: vendedor e comprador na mesma rede. Fale com o suporte se for um engano.'] };
        }
        // Alertas para revisão: preço muito acima da mediana e pares que negociam demais entre si.
        const hist = (await t.priceHistory(l.item_key, 'gems')).map(x => Number(x.price));
        if (hist.length >= 3 && (price > E.priceBandX * median(hist) || price < E.priceFloorX * median(hist))) {
          await t.flag('price_band', s.user_id, seller, `${l.name}: ${price} Gemas (mediana ${median(hist)})`, now);
          return { error:[400, `Preço fora da faixa de mercado (mediana ${median(hist)} Gemas). Compra bloqueada para evitar negociação combinada.`] };
        }
        const outlierRisk = hist.length >= 5 && price > E.outlierX * median(hist);
        const pairRisk = seller && await t.pairTrades(s.user_id, seller, now - 7 * DAY) >= E.pairLimit;
        if (outlierRisk) await t.flag('price_outlier', s.user_id, seller, `${l.name}: ${price} Gemas (mediana ${median(hist)})`, now);
        if (pairRisk) await t.flag('pair_trading', s.user_id, seller, `${l.name}: ${price} Gemas`, now);
        await t.walletLock(s.user_id);
        if (!await t.walletMove(s.user_id, -price, 0, now)) return { error:[400, 'Saldo de Gemas insuficiente.'] };
        await t.ledger(s.user_id, -price, 'market_buy', `l:${id}`, `Compra: ${l.name}`, now);
        const buyerNew = now - Number(u.created_at) < E.newBuyerAccountDays * DAY, review = buyerNew || pairRisk || outlierRisk;
        if (seller) await credit(t, seller, price - fee, review ? 'market_sale_slow' : 'market_sale', `l:${id}`, `Venda: ${l.name} (taxa ${fee})${review ? ` · liberada para saque em ${E.newBuyerHoldDays} dias (análise de risco)` : ''}`, now);
        await t.ledger(null, fee, 'fee_market', `l:${id}`, 'Taxa do mercado', now);
        if (!await t.closeListing(id, 'sold', s.user_id, now)) throw new Error('listing_race');
        let payload = l.payload;
        if (l.kind === 'item' && E.resaleLockDays > 0) { const it = JSON.parse(l.payload); it.tradeLockUntil = now + E.resaleLockDays * DAY; payload = JSON.stringify(it); }
        await t.insertMail(s.user_id, l.kind, payload, 'Compra no Mercado', now);
        return { ok:true, price, fee };
      });
      if (r.error) return fail(res, r.error[0], r.error[1]);
      audit(s.user_id, 'market_buy', req, `${id}:${r.price}`);
      send(res, 200, { ok:true });
    },

    'POST /api/market/cancel': async (req, res, s) => {
      if (!s) return fail(res, 401, 'Não autenticado.');
      const id = Number((await readJson(req)).id), now = Date.now();
      const r = await store.transaction(async t => {
        const l = await t.listingLock(id);
        if (!l || l.status !== 'open' || Number(l.seller_id) !== s.user_id) return { error:'Anúncio não encontrado.' };
        await t.closeListing(id, 'cancelled', null, now);
        await t.insertMail(s.user_id, l.kind, l.payload, 'Anúncio cancelado', now);
        return { ok:true };
      });
      if (r.error) return fail(res, 404, r.error);
      send(res, 200, { ok:true });
    }
  };

  // ---- operações que mexem no estado do jogador (chamadas pelo /api/sync, dentro da transação) ----
  async function listOnState(t, s, u0, data, b, now) {
    const currency = b.currency === 'gold' ? 'gold' : 'gems';
    if (currency === 'gems' && !E.enabled) return { error:'O Mercado com Gemas está desativado neste servidor.' };
    if (currency === 'gold' && !E.goldMarket) return { error:'O Mercado em ouro está desativado neste servidor.' };
    const u = await t.userById(s.user_id);
    if (!u || u.banned || Number(u.suspicious) >= 3) return { error:'Conta sem permissão para negociar.' };
    if (currency === 'gems' && now - Number(u.created_at) < E.minAccountDays * DAY) return { error:`Contas precisam de ${E.minAccountDays} dia(s) para negociar com Gemas.` };
    const price = Number(b.price), kind = b.kind;
    if (currency === 'gems' && !intIn(price, E.minPrice, E.maxPrice)) return { error:`Preço entre 💠 ${E.minPrice} e 💠 ${E.maxPrice}.` };
    if (currency === 'gold' && !intIn(price, E.goldMinPrice, E.goldMaxPrice)) return { error:`Preço entre ${E.goldMinPrice} e ${E.goldMaxPrice} de ouro.` };
    const listFee = currency === 'gold' ? goldListFee(price) : 0;
    if (listFee && Number(data.player?.gold || 0) < listFee) return { error:`A taxa de anúncio é de ${listFee} de ouro.` };
    if (!['item', 'card', 'mat'].includes(kind)) return { error:'Tipo inválido.' };
    if (await t.countOpenOf(s.user_id) >= E.maxOpen) return { error:`Limite de ${E.maxOpen} anúncios abertos.` };
    if (await t.countListedSince(s.user_id, now - DAY) >= E.maxListDay) return { error:'Limite diário de anúncios atingido.' };
    const minAge = (currency === 'gold' ? E.goldMinItemAgeHours : E.minItemAgeHours) * HOUR, ageH = currency === 'gold' ? E.goldMinItemAgeHours : E.minItemAgeHours;
    const band = async key => {
      if (currency !== 'gems') return null;
      const hist = (await t.priceHistory(key, 'gems')).map(x => Number(x.price)); if (hist.length < 3) return null;
      const m = median(hist); return price > E.priceBandX * m || price < E.priceFloorX * m ? `Preço fora da faixa de mercado: entre ${Math.ceil(E.priceFloorX * m)} e ${Math.floor(E.priceBandX * m)} Gemas.` : null;
    };
    const post = async (payload, key, name) => { if (listFee) data.player.gold -= listFee; return { result:{ id:await t.insertListing({ sellerId:s.user_id, sellerName:u.username, kind, payload, key, name, price, now, currency }), listFee } }; };
    if (kind === 'item') {
      const idx = (data.inventory || []).findIndex(x => x && x.uid === b.itemUid);
      if (idx < 0) return { error:'Item não encontrado.' };
      const it = data.inventory[idx];
      if (it.locked) return { error:'Destranque o item antes de anunciar.' };
      if (it.bound) return { error:'Este item está vinculado à sua conta e não pode ser vendido.' };
      if (currency === 'gems' && Number(it.tradeLockUntil || 0) > now) return { error:`Item comprado com Gemas só volta ao mercado em ${new Date(Number(it.tradeLockUntil)).toLocaleDateString('pt-BR')} (sem revenda em cadeia).` };
      if (game.equippedUids(data).has(it.uid)) return { error:'Desequipe o item antes de anunciar.' };
      const seen = await t.seenAt(s.user_id, `i:${it.uid}`);
      if (minAge > 0 && (!seen || now - Number(seen) < minAge)) return { error:`Itens recém-obtidos só podem ser vendidos após ${ageH}h.` };
      { const why = await band(game.itemKey(it)); if (why) return { error:why }; } // antes de tirar o item da bolsa
      data.inventory.splice(idx, 1);
      await t.forgetSeen(s.user_id, `i:${it.uid}`);
      const clean = { ...it, locked:false, isNew:true };
      return post(JSON.stringify(clean), game.itemKey(clean), String(clean.name || '').slice(0, 60));
    }
    if (kind === 'mat') {
      const mat = game.KT.Items.materials?.[b.matId], n = Math.floor(Number(b.qty));
      if (!mat || !mat.tradeable || !(n >= 1 && n <= 9999) || Number(data.mats?.[mat.key] || 0) < n) return { error:'Material ou quantidade inválida.' };
      { const why = await band(`m:${b.matId}`); if (why) return { error:why }; }
      data.mats[mat.key] -= n;
      return post(JSON.stringify({ id:b.matId, qty:n }), `m:${b.matId}`, `${mat.name} ×${n}`);
    }
    const card = game.KT.Items.cardById(String(b.cardId || '')), n = Number(data.cards?.[b.cardId] || 0);
    if (!card || n < 1) return { error:'Você não tem essa carta.' };
    const seen = await t.seenAt(s.user_id, `c:${card.id}:${n}`);
    if (minAge > 0 && (!seen || now - Number(seen) < minAge)) return { error:`Cartas recém-obtidas só podem ser vendidas após ${ageH}h.` };
    { const why = await band(`c:${card.id}`); if (why) return { error:why }; }
    data.cards[card.id] = n - 1;
    await t.forgetSeen(s.user_id, `c:${card.id}:${n}`);
    return post(JSON.stringify({ id:card.id, mvp:card.mvp }), `c:${card.id}`, card.name);
  }
  // Compra em ouro: o ouro sai do estado do comprador (dentro da transação do /api/sync), o item entra direto na
  // bolsa (ou no Correio, se a bolsa estiver cheia) e o vendedor recebe o valor menos o imposto pelo Correio.
  async function buyGoldOnState(t, s, data, id, now) {
    if (!E.goldMarket) return { error:'O Mercado em ouro está desativado neste servidor.' };
    const u = await t.userById(s.user_id);
    if (!u || u.banned || Number(u.suspicious) >= 3) return { error:'Conta sem permissão para negociar.' };
    const l = await t.listingLock(Number(id));
    if (!l || l.status !== 'open') return { error:'Anúncio indisponível.' };
    if ((l.currency || 'gems') !== 'gold') return { error:'Este anúncio é em Gemas.' };
    const seller = Number(l.seller_id), price = Number(l.price), tax = goldTaxOf(price);
    if (seller === s.user_id) return { error:'Você não pode comprar o próprio anúncio.' };
    if (!(Number(data.player?.gold) >= price)) return { error:'Ouro insuficiente.' };
    if (seller && await t.pairTrades(s.user_id, seller, now - 7 * DAY) >= E.pairLimit * 3) await t.flag('pair_trading_gold', s.user_id, seller, `${l.name}: ${price} ouro`, now);
    if (!await t.closeListing(Number(id), 'sold', s.user_id, now)) return { error:'Anúncio indisponível.' };
    data.player.gold -= price;
    if (seller) await t.insertMail(seller, 'gold', JSON.stringify({ amount:price - tax, name:l.name }), `Venda: ${l.name} (imposto ${tax})`, now);
    const payload = JSON.parse(l.payload); let delivered = 'mail';
    if (l.kind === 'item' && (data.inventory || []).length < Math.min(game.KT.Items.MAX_BAG || 400, Number(data.invCap) || 150) && !data.inventory.some(x => x.uid === payload.uid)) {
      data.inventory.unshift(payload); delivered = 'bag';
      await t.seeItems(s.user_id, [`i:${payload.uid}`], now); await t.resetSeen(s.user_id, `i:${payload.uid}`, now);
    } else if (l.kind === 'mat') {
      const mk = game.KT.Items.materials?.[payload.id]?.key || payload.id; data.mats = data.mats || {}; data.mats[mk] = Number(data.mats[mk] || 0) + Number(payload.qty || 0); delivered = 'bag';
    } else if (l.kind === 'card') {
      data.cards = data.cards || {}; const n = Number(data.cards[payload.id] || 0) + 1; data.cards[payload.id] = n; delivered = 'bag';
      await t.seeItems(s.user_id, [`c:${payload.id}:${n}`], now); await t.resetSeen(s.user_id, `c:${payload.id}:${n}`, now);
    } else await t.insertMail(s.user_id, l.kind, l.payload, 'Compra no Mercado', now);
    return { result:{ kind:l.kind, payload, price, delivered } };
  }
  async function claimOnState(t, uid, data, id, now) {
    const m = await t.mailLock(id, uid); if (!m) return { error:'Nada para resgatar.' };
    const payload = JSON.parse(m.payload);
    if (m.kind === 'item') {
      data.inventory = data.inventory || [];
      if (data.inventory.length >= Math.min(game.KT.Items.MAX_BAG || 400, Number(data.invCap) || 80)) return { error:'Bolsa cheia. Libere espaço para resgatar.' };
      if (data.inventory.some(x => x.uid === payload.uid)) return { error:'Item já está na bolsa.' };
      data.inventory.unshift(payload);
      await t.seeItems(uid, [`i:${payload.uid}`], now); await t.resetSeen(uid, `i:${payload.uid}`, now);
    } else if (m.kind === 'gold') {
      data.player.gold = Number(data.player.gold || 0) + Math.max(0, Math.floor(Number(payload.amount) || 0));
    } else if (m.kind === 'mat') {
      const mk = game.KT.Items.materials?.[payload.id]?.key || payload.id; data.mats = data.mats || {}; data.mats[mk] = Number(data.mats[mk] || 0) + Number(payload.qty || 0);
    } else {
      data.cards = data.cards || {}; const n = Number(data.cards[payload.id] || 0) + 1; data.cards[payload.id] = n;
      await t.seeItems(uid, [`c:${payload.id}:${n}`], now); await t.resetSeen(uid, `c:${payload.id}:${n}`, now);
    }
    if (!await t.claimMail(id, now)) return { error:'Já resgatado.' };
    return { result:{ kind:m.kind, payload } };
  }

  function adminOk(req) { const tok = String(req.headers['x-admin-token'] || ''); return !!E.adminToken && tok.length === E.adminToken.length && safeEqualHex(Buffer.from(tok).toString('hex'), Buffer.from(E.adminToken).toString('hex')); }

  // Chamado em toda gravação de save: remove itens que já saíram pelo mercado e registra a procedência.
  async function onSave(t, userId, data, now) {
    let stripped = 0;
    const out = await t.outUids(userId);
    if (out.size && Array.isArray(data.inventory)) { const before = data.inventory.length; data.inventory = data.inventory.filter(it => !out.has(it?.uid)); stripped = before - data.inventory.length; }
    await t.seeItems(userId, game.provenanceKeys(data), now);
    return stripped;
  }
  // Anúncios antigos voltam ao dono pelo Correio.
  async function expireListings() {
    const now = Date.now();
    for (const { id } of await store.staleListings(now - E.listingDays * DAY)) {
      await store.transaction(async t => { const l = await t.listingLock(Number(id)); if (!l || l.status !== 'open') return; await t.closeListing(Number(id), 'expired', null, now); if (l.seller_id) await t.insertMail(Number(l.seller_id), l.kind, l.payload, 'Anúncio expirou', now); });
    }
  }
  const hasFunds = async uid => { const w = await store.wallet(uid); return Number(w.balance) + Number(w.held) > 0 || (await store.countOpenOf(uid)) > 0 || (await store.mailOf(uid)).length > 0; };
  return { routes, onSave, expireListings, publicConfig, hasFunds, provider, listOnState, claimOnState, buyGoldOnState };
}

module.exports = { economy, economyConfig };
