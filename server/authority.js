'use strict';
// Servidor autoritativo. O estado do jogador só existe aqui: o navegador pede ações (/api/sync → act),
// recebe sementes para as lutas (start) e devolve os comandos que o jogador usou (finish). O servidor
// refaz cada luta com o mesmo motor do jogo e só então concede ouro, EXP, itens e cartas.
// Não há rota para o navegador gravar um save: não existe o que falsificar.
const crypto = require('node:crypto');
const game = require('./game');
const LEGACY = require('./legacy_ids');
const KT = game.KT;
const { DT, MAX_SPEED } = KT.State;

const cryptoRng = () => KT.Rng.seeded(crypto.randomInt(0, 2 ** 32));
const SLOT_KEYS = ['weapon', 'focus', 'seal', 'charm'];

// ---------------------------------------------------------------------------
// Ações permitidas: nome do método do motor → validação de cada argumento.
// ---------------------------------------------------------------------------
const V = {
  uid: v => typeof v === 'string' && v.length >= 3 && v.length <= 64 && /^[\w.-]+$/.test(v),
  int: (a, b) => v => Number.isInteger(v) && v >= a && v <= b,
  str: v => typeof v === 'string' && v.length <= 64 && /^[\w.-]+$/.test(v),
  slot: v => SLOT_KEYS.includes(v),
  attr: v => ['str', 'agi', 'vit', 'int', 'dex', 'luk'].includes(v),
  rarity: v => ['common', 'rare', 'epic', 'legendary'].includes(v),
  name: v => typeof v === 'string' && v.length <= 40,
  any: v => v === null || ['string', 'number', 'boolean'].includes(typeof v)
};
const OPS = {
  setParty:[V.int(0, 3), V.uid], removeFromParty:[V.uid],
  addAttr:[V.uid, V.attr, V.int(1, 500)], resetAttr:[V.uid], autoAttr:[V.uid], autoTalents:[V.uid], autoEquip:[V.uid], autoBuild:[V.uid],
  addHeroTalent:[V.uid, V.str], resetHeroTalents:[V.uid], jobChange:[V.uid], awaken:[V.uid], useScroll:[V.uid],
  equip:[V.uid, V.uid], unequip:[V.uid, V.slot], toggleLock:[V.uid], salvage:[V.uid], salvageMany:[V.rarity],
  upgradeItem:[V.uid, v => ['common', 'rare', 'epic', 'legendary'].includes(v)], enchantItem:[V.uid, V.int(0, 5)], socketCard:[V.uid, V.int(0, 3), V.str], unsocketCard:[V.uid, V.int(0, 3)], displayCard:[V.str, V.int(0, 5)], removeDisplay:[V.int(0, 5)],
  train:[V.str], upgradeBuilding:[V.str], buy:[V.str], buyMarket:[V.int(0, 20)], craft:[V.str], craftProf:[V.str, v => v === undefined || v === null || V.slot(v)],
  claimGuide:[], claimContract:[V.int(0, 9)], claimAchievement:[V.str], claimDaily:[V.int(0, 9)], claimLogin:[], claimChronicle:[],
  openBoxes:[V.int(1, 10)], setName:[V.name], setSetting:[V.str, V.any], markSeen:[V.str],
  takeOverflow:[V.uid], salvageOverflow:[V.rarity], useItem:[V.str],
  startExpedition:[V.str, V.int(1, 12), v => Array.isArray(v) && v.length >= 1 && v.length <= 3 && v.every(V.uid)], claimExpedition:[V.uid],
  acceptBounty:[V.int(0, 2)], abandonBounty:[], claimBounty:[], buyBountyItem:[V.str], ensureBounties:[]
};
const EXTRA_OPS = new Set(['marketList', 'marketClaim', 'marketBuyGold', 'goVillage', 'claimWorldBoss']);
// Invasão Mundial: chave da vida compartilhada (dia + janela + dificuldade).
const wbKey = (day, win, tier) => `${day}:${win}:${tier}`;
function wbUnitHp(bossId, tier) { const t = KT.Data.enemies[bossId], tr = KT.Data.worldBoss.tiers[tier]; return t.hp * (t.hpMul || 1.5) * tr.P; }

function authority({ store, cfg, send, fail, readJson, readBody, limiter, clientIp, audit, log, eco, sameOrigin }) {
  const OFFLINE_MIN_MS = 120_000;
  const clock = () => (cfg.now ? cfg.now() : Date.now()); // relógio injetável só para testes

  // Saves anteriores à troca do elenco usam os ids antigos dos heróis: troca cada id entre aspas pelo atual.
  const LEGACY_RE = new RegExp(`"(${Object.keys(LEGACY.HERO).join('|')})"`, 'g');
  const migrateLegacy = json => json.replace(LEGACY_RE, (_, id) => `"${LEGACY.HERO[id]}"`);
  async function loadState(t, uid, username) {
    let row = await t.getSave(uid, true), state;
    if (row) state = KT.State.mergeState(JSON.parse(migrateLegacy(row.data)));
    else { state = KT.State.createState(); state.player.name = String(username || 'Viajante').slice(0, 20); }
    return { row, state };
  }
  async function persist(t, uid, row, state, now, reason) {
    const v = game.validateSave(state);
    if (!v.ok) throw Object.assign(new Error(`estado inválido: ${v.reason}`), { status:500 });
    if (!row) { await t.insertSave(uid, v.json, now, v.summary); return 1; }
    const last = (await t.listHistory(uid))[0];
    if (!last || now - Number(last.created_at) > 10 * 60_000) { await t.insertHistory(uid, row.data, row.revision, now); await t.trimHistory(uid, store.historyPerUser); }
    if (!await t.updateSave(uid, v.json, now, v.summary, row.revision)) throw Object.assign(new Error('conflito'), { status:409 });
    return Number(row.revision) + 1;
  }
  // Progresso AFK: calculado aqui, com a hora do servidor, funciona com o computador desligado.
  function applyOffline(state, now) {
    const gap = now - Number(state.lastSeen || now);
    if (gap < OFFLINE_MIN_MS) return null;
    const eng = new KT.CombatEngine(state, {}); eng.fixedNow = now;
    const rep = KT.Rng.with(cryptoRng(), () => eng.offlineGains(now));
    return rep ? { seconds:rep.seconds, gold:rep.gold, xp:rep.xp, ore:rep.ore, dust:rep.dust, items:rep.items.map(i => ({ name:i.name, rarity:i.rarity })) } : null;
  }

  async function finishSegment(t, uid, state, fin, now, req) {
    const seg = await t.openSegment(uid);
    if (!seg || Number(seg.id) !== Number(fin?.segId)) return { status:'stale' };
    const endTick = Number(fin.endTick), inputs = Array.isArray(fin.inputs) ? fin.inputs : [];
    const okInputs = Number.isInteger(endTick) && endTick >= 0 && endTick <= 400000 && inputs.length <= 4000 && inputs.every(x => x && Number.isInteger(x.t) && typeof x.k === 'string' && x.k.length < 12 && V.any(x.a));
    if (!okInputs) { await t.closeSegment(seg.id, 'void'); audit(uid, 'segment_invalid', req); return { status:'invalid' }; }
    const wall = (now - Number(seg.at)) / 1000;
    if (endTick * DT > wall * MAX_SPEED + 3) { await t.closeSegment(seg.id, 'void'); await t.flagSuspicious(uid); audit(uid, 'segment_too_fast', req, `${endTick} passos em ${wall.toFixed(1)}s`); return { status:'too_fast' }; }
    const eng = new KT.CombatEngine(state, {});
    const out = eng.replaySegment({ id:Number(seg.id), seed:Number(seg.seed), at:Number(seg.at), zone:seg.zone, opts:JSON.parse(seg.opts) }, inputs, endTick);
    await t.closeSegment(seg.id, 'done');
    if (seg.zone === 'world_boss' && out.ended && state.worldBoss?.damage > 0 && !state.worldBoss.claimed) {
      const wb = state.worldBoss, key = wbKey(wb.day, wb.window, wb.tier);
      const user = await t.userById(uid);
      await t.wbEnsurePool(key, wb.boss, wb.tier, wbUnitHp(wb.boss, wb.tier) * (Number(process.env.WB_POOL_MULT) || KT.Data.worldBoss.tiers[wb.tier].pool), now);
      await t.wbAddHit(key, uid, user?.username || 'Viajante', wb.damage, now);
    }
    return { status:'ok', outcome:out.outcome, ended:out.ended };
  }
  async function startSegment(t, uid, state, start, now) {
    await t.closeOpenSegments(uid);
    if (!start || typeof start.zone !== 'string' || !KT.Data.zones[start.zone]) return { error:'Região inválida.' };
    const probe = new KT.CombatEngine(KT.State.mergeState(JSON.parse(JSON.stringify(state))), {}); probe.fixedNow = now;
    const opts = {}; ['stage', 'floor', 'tier'].forEach(k => { if (Number.isInteger(start.opts?.[k])) opts[k] = start.opts[k]; });
    if (!probe.prepareZone(start.zone, opts) || probe.zone.kind === 'village') return { error:'Região bloqueada.' };
    const seed = crypto.randomInt(1, 2 ** 31), clean = { ...probe.opts };
    if (start.zone === 'world_boss') {
      const w = probe.wbWindow(now), boss = probe.wbBossId(now), key = wbKey(w.day, w.index, clean.tier || 0);
      await t.wbEnsurePool(key, boss, clean.tier || 0, wbUnitHp(boss, clean.tier || 0) * (Number(process.env.WB_POOL_MULT) || KT.Data.worldBoss.tiers[clean.tier || 0].pool), w.end);
      const pool = await t.wbPool(key); clean.ally = KT.Data.worldBoss.tiers[clean.tier || 0].ally ? Number(pool?.participants || 0) : 0;
    }
    const id = await t.insertSegment(uid, seed, start.zone, JSON.stringify(clean), now);
    return { seg:{ id, seed, at:now, zone:start.zone, opts:clean } };
  }
  async function runAct(t, s, user, state, act, now) {
    const op = String(act?.op || ''), args = Array.isArray(act?.args) ? act.args : [];
    if (op === 'goVillage') { state.zone = 'village'; return { result:true }; }
    if (op === 'marketList') return eco.listOnState(t, s, user, state, args[0] || {}, now);
    if (op === 'marketClaim') return eco.claimOnState(t, s.user_id, state, Number(args[0]), now);
    if (op === 'marketBuyGold') return eco.buyGoldOnState(t, s, state, Number(args[0]), now);
    if (op === 'claimWorldBoss') {
      const wb = state.worldBoss; if (!wb?.day || wb.claimed) return { error:'Nenhuma recompensa de Invasão para resgatar.' };
      const pool = await t.wbPool(wbKey(wb.day, wb.window, wb.tier)); if (!pool) return { error:'Invasão não encontrada.' };
      const killed = Number(pool.damage) >= Number(pool.hp_total);
      if (!killed && now < Number(pool.ends_at)) return { error:'A recompensa sai quando a janela da Invasão terminar (ou quando o chefe cair).' };
      const ahead = await t.wbRank(wbKey(wb.day, wb.window, wb.tier), wb.damage), pct = pool.participants > 0 ? ahead / Number(pool.participants) : 1;
      const eng = new KT.CombatEngine(state, {}); eng.fixedNow = now;
      const result = KT.Rng.with(cryptoRng(), () => eng.grantWorldBoss({ killed, pct }));
      return result ? { result:{ ...result, rank:ahead + 1, participants:Number(pool.participants) } } : { error:'Nada para resgatar.' };
    }
    const spec = OPS[op];
    if (!spec || args.length > spec.length || !spec.every((chk, i) => i >= args.length ? true : chk(args[i]))) return { error:'Ação inválida.' };
    const eng = new KT.CombatEngine(state, {}); eng.fixedNow = now;
    const result = KT.Rng.with(cryptoRng(), () => eng[op](...args));
    if ((result === false || result === null) && eng.lastError) return { error:eng.lastError };
    return { result:JSON.parse(JSON.stringify(result ?? null)) };
  }

  async function sync(req, res, s, body, beacon = false) {
    const now = clock();
    const user = await store.userById(s.user_id);
    const r = await store.transaction(async t => {
      const { row, state } = await loadState(t, s.user_id, user.username);
      const out = {};
      if (body.finish) out.finish = await finishSegment(t, s.user_id, state, body.finish, now, req);
      else if (body.act || body.start) await t.closeOpenSegments(s.user_id); // nada fica pendente entre ações
      if (!beacon) out.offline = applyOffline(state, now);
      if (body.act && !beacon) { const a = await runAct(t, s, user, state, body.act, now); if (a.error) out.actError = a.error; else out.result = a.result ?? a; }
      if (body.start && !beacon) { const st = await startSegment(t, s.user_id, state, body.start, now); if (st.error) out.startError = st.error; else out.seg = st.seg; }
      state.lastSeen = now;
      out.revision = await persist(t, s.user_id, row, state, now);
      out.state = state;
      return out;
    });
    if (beacon) return send(res, 200, { ok:true });
    send(res, 200, { ok:true, ...r });
  }

  const routes = {
    'GET /api/worldboss': async (req, res, s) => {
      const now = clock(), probe = new KT.CombatEngine(KT.State.createState(), {}); probe.fixedNow = now; const w = probe.wbWindow(now), boss = probe.wbBossId(now);
      const tiers = [];
      for (const tr of KT.Data.worldBoss.tiers) {
        const key = wbKey(w.day, w.index, tr.id), pool = w.active ? await store.wbPool(key) : null;
        tiers.push({ tier:tr.id, name:tr.name, hp:pool ? Number(pool.hp_total) : wbUnitHp(boss, tr.id) * (Number(process.env.WB_POOL_MULT) || tr.pool), damage:pool ? Number(pool.damage) : 0, participants:pool ? Number(pool.participants) : 0, top:pool ? await store.wbTop(key, 5) : [] });
      }
      send(res, 200, { ok:true, now, active:w.active, window:w.index, ends:w.end, next:w.next, boss, tiers });
    },
    'GET /api/state': async (req, res, s) => {
      if (!s) return fail(res, 401, 'Não autenticado.');
      if (!limiter.allow(`state:${s.user_id}`, 30, 60_000)) return fail(res, 429, 'Muitas requisições.');
      return sync(req, res, s, {});
    },
    'POST /api/sync': async (req, res, s) => {
      if (!s) return fail(res, 401, 'Não autenticado.');
      if (!limiter.allow(`sync:${s.user_id}`, 150, 60_000)) return fail(res, 429, 'Muitas ações em pouco tempo.');
      const b = await readJson(req);
      if (b.act && !OPS[b.act.op] && !EXTRA_OPS.has(b.act.op)) return fail(res, 400, 'Ação desconhecida.');
      return sync(req, res, s, { finish:b.finish || null, act:b.act || null, start:b.start || null });
    },
    // Ao fechar a aba: entrega a luta em andamento para não perder o que já foi conquistado.
    'POST /api/sync/beacon': async (req, res, s) => {
      if (!s || !req.headers.origin || !sameOrigin(req)) return fail(res, 403, 'Negado.');
      if (!limiter.allow(`sync:${s.user_id}`, 150, 60_000)) return fail(res, 429, 'Muitas requisições.');
      let b; try { b = JSON.parse(await readBody(req)); } catch (_) { return fail(res, 400, 'JSON inválido.'); }
      return sync(req, res, s, { finish:b.finish || null }, true);
    }
  };
  return { routes, OPS };
}

module.exports = { authority, OPS };
