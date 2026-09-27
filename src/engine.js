(() => {
  const KT = globalThis.KT = globalThis.KT || {};
  const D = KT.Data, U = KT.Utils, I = KT.Items, PR = KT.Progression;
  const SAVE_KEY = 'mythverse-save-v1';
  let saveKey = SAVE_KEY;
  let saveGeneration = 0;
  const setSaveKey = k => { saveKey = k || SAVE_KEY; };
  const ULT_COST = 100;
  const OFFENSIVE = new Set(['dmg','st','dispel','delay','execute','chain']);
  const CC = new Set(['stun','freeze']);
  const DEBUFFS = new Set(['burn','poison','bleed','stun','freeze','slow','armorBreak','mark','weaken','silence']);
  const DOTS = new Set(['burn','poison','bleed']);
  const HERO_MAX_STARS = 6;
  const HERO_LEVEL_CAP = 100;
  const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const CHOICE_WAIT = 120; // segundos até a escolha recomendada ser feita sozinha (AUTO desligado)
  const DT = .05;           // passo fixo da simulação (20 passos por segundo de jogo)
  const MAX_SPEED = 3;
  const INPUT_KINDS = new Set(['ult', 'potion', 'elixir', 'focus', 'choice', 'auto', 'advance']);
  // Quebra de postura (elites e chefes) e Elo Kizuna (ultimates encadeadas).
  const BREAK = { gain:5, max:100, grow:1.3, time:4, dmg:.35, kindMult:{ ult:2.2, skill:1.5, basic:1, proc:.6 } };
  const CHAIN = { window:4, per:.15, finale:4, finaleMult:.9 };
  // Economia: chefes dão espólio completo só nas primeiras vitórias do dia (como o bloqueio de raide do WoW);
  // Oricalco e Adamantina de fontes repetíveis (Fenda, masmorras, guardiões) têm teto diário.
  const BOSS_LOOT_PER_DAY = 3;
  const DAILY_MAT_CAP = { ori:3, adam:1 };
  const RARITY_RANK = { common:0, rare:1, epic:2, set:3, legendary:3, mythic:4 };

  // ===========================================================================
  // ESTADO
  // ===========================================================================
  function createState() {
    return {
      version:3,
      player:{ name:'Viajante', level:1, xp:0, gold:0, crystal:0, dust:0, ore:0, gems:0, keys:0 },
      starterRolls:10, boxesOpened:0, pity:0,
      formation:[null, null, null, null], collection:[], shards:{},
      inventory:[], invCap:150, overflow:[], storage:[], decor:{}, mats:{ star:0, ori:0, adam:0 }, buffs:{}, shopDaily:{ date:'', bought:{} },
      consumables:{ potion:0, elixir:0, scroll:0, onigiri:0, ramen:0, tea:0, luck:0, flask_fury:0, flask_stone:0, flask_sage:0, flask_fortune:0 },
      prof:{ lv:{ mining:1, herbalism:1, essence:1, alchemy:1, smithing:1 }, xp:{ mining:0, herbalism:0, essence:0, alchemy:0, smithing:0 }, mats:{} }, cards:{},
      progress:Object.fromEntries(Object.values(D.zones).filter(z => z.kind !== 'village').map(z => [z.id, z.kind === 'boss' ? { kills:0, tier:0, tierKills:[0, 0, 0] } : { best:0, cur:1 }])),
      zone:'village', lastHunt:'hunt',
      settings:{ auto:true, autoAdvance:true, autoRepeat:true, speed:1, sound:false, autoSalvage:'none' },
      stats:{ kills:0, elites:0, bossKills:0, stages:0, floors:0, ults:0, manualUlts:0, loot:0, salvage:0, encounters:0, legendaries:0, maxUpgrade:0, upgrades:0, upgradeTries:0, goldEarned:0, deaths:0, cards:0, alphas:0, autoChoices:0 },
      talents:{}, training:{ atk:0, hp:0, def:0, crit:0 },
      buildings:{ forge:1, dojo:1, shrine:1, workshop:1, guild:1, market:1, house:1 }, house:{ display:[], seen:{} }, paragon:{ lv:0, xp:0 },
      guide:{ claimed:{}, flags:{} }, contracts:[], achievements:{}, contractCounters:{},
      market:{ offers:[], refreshedAt:0 }, boostUntil:0, freeRespec:1,
      story:{ seen:{} }, codex:{ enemies:[] }, bestiary:{},
      guildRank:{ lv:1, xp:0 }, chronicle:null, daily:{ date:'', list:[] }, login:{ last:'', streak:0, claimed:'' }, stuck:{ key:'', n:0 },
      worldBoss:{ day:'', window:-1, boss:'', tier:0, damage:0, claimed:true }, bossLoot:{ date:'', n:{} }, matDaily:{ date:'', ori:0, adam:0 }, expeditions:[], bounty:{ active:null, offers:[], points:0, done:0 }, crafted:{ date:'', n:{} },
      lastSeen:Date.now(), totalPlaySeconds:0, created:Date.now()
    };
  }

  function newHeroRecord(template, rarity = 'rare') {
    const stars = { common:1, rare:2, epic:3, legendary:4 }[rarity] || 1;
    return { uid:U.uid('hero'), id:template.id, rarity, stars, level:1, xp:0, classLevel:1, classXp:0, job:0, talents:{}, attr:{ str:0, agi:0, vit:0, int:0, dex:0, luk:0 }, equipped:{ weapon:null, focus:null, seal:null, charm:null } };
  }

  function mergeState(raw) {
    const fresh = createState();
    if (!raw || raw.version !== 3) return fresh;
    const s = { ...fresh, ...raw };
    for (const k of ['player','settings','stats','training','buildings','consumables','guide','market','story','codex','bestiary','guildRank','daily','login','stuck','mats','buffs','shopDaily','worldBoss','bounty','crafted','house','paragon','bossLoot','matDaily','prof']) s[k] = { ...fresh[k], ...(raw[k] || {}) };
    s.expeditions = Array.isArray(raw.expeditions) ? raw.expeditions.filter(x => x && D.zones[x.zone]) : [];
    s.invCap = Math.max(fresh.invCap, Number(raw.invCap) || 0);
    s.overflow = (raw.overflow || []).filter(it => it && it.slot && I.slots[it.slot]).map(it => ({ cards:[], ...it }));
    s.storage = (Array.isArray(raw.storage) ? raw.storage : []).filter(it => it && it.slot && I.slots[it.slot]).map(it => ({ cards:[], ...it }));
    s.decor = Object.fromEntries(Object.keys(raw.decor || {}).filter(id => D.STORAGE.decor.some(d => d.id === id)).map(id => [id, 1]));
    s.progress = { ...fresh.progress }; Object.keys(raw.progress || {}).forEach(k => { s.progress[k] = { ...(fresh.progress[k] || {}), ...raw.progress[k] }; });
    // Heróis da primeira versão da temporada viram as formas despertadas correspondentes.
    const ren = D.SEASON?.renamed || {};
    (raw.collection || []).forEach(h => { if (h && ren[h.id]) h.id = ren[h.id]; });
    Object.keys(raw.shards || {}).forEach(k => { if (ren[k]) { raw.shards[ren[k]] = (raw.shards[ren[k]] || 0) + raw.shards[k]; delete raw.shards[k]; } });
    s.shards = { ...(raw.shards || {}) };
    s.collection = (raw.collection || []).filter(h => D.roster.some(t => t.id === h.id)).map(h => ({ ...newHeroRecord(D.roster.find(t => t.id === h.id), h.rarity), ...h, attr:{ ...fresh.collection[0]?.attr, str:0, agi:0, vit:0, int:0, dex:0, luk:0, ...(h.attr || {}) }, equipped:{ weapon:null, focus:null, seal:null, charm:null, ...(h.equipped || {}) } }));
    const uids = new Set(s.collection.map(h => h.uid));
    s.formation = [0, 1, 2, 3].map(i => (raw.formation || [])[i] && uids.has(raw.formation[i]) ? raw.formation[i] : null);
    s.inventory = (raw.inventory || []).filter(it => it && it.slot && I.slots[it.slot]).map(it => ({ cards:[], ...it }));
    s.cards = { ...(raw.cards || {}) };
    s.prof.lv = { ...fresh.prof.lv, ...(raw.prof?.lv || {}) }; s.prof.xp = { ...fresh.prof.xp, ...(raw.prof?.xp || {}) }; s.prof.mats = { ...(raw.prof?.mats || {}) };
    s.house.display = (Array.isArray(s.house.display) ? s.house.display : []).slice(0, 6).map(id => (id && I.cardById(id) ? id : null));
    s.house.seen = { ...(s.house.seen || {}) }; albumIds(s).forEach(id => { s.house.seen[id] = 1; });
    s.collection.forEach(h => {
      h.talents = h.talents || {}; h.job = h.job || 0; h.level = U.clamp(Math.floor(Number(h.level) || 1), 1, HERO_LEVEL_CAP); h.classLevel = U.clamp(Math.floor(Number(h.classLevel) || 1), 1, PR.CLASS_LEVEL_CAP);
      const next = heroXpNext(h.level), oldNext = Math.round(60 * h.level * Math.pow(1.14, h.level - 1));
      if (h.level >= HERO_LEVEL_CAP || !Number.isFinite(h.xp) || h.xp < 0) h.xp = 0;
      else if (h.xp >= next) h.xp = Math.min(next - 1, Math.round(next * U.clamp(h.xp / Math.max(1, oldNext), 0, .999)));
      h.classXp = h.classLevel >= PR.CLASS_LEVEL_CAP ? 0 : U.clamp(Number(h.classXp) || 0, 0, classXpNext(h.classLevel) - 1);
      // Integridade: nada de poder impossível vindo de bug antigo ou save editado.
      h.stars = U.clamp(Math.floor(Number(h.stars) || 1), 1, HERO_MAX_STARS);
      if (!D.heroRarities.some(r => r.id === h.rarity)) h.rarity = 'common';
      if (h.job && (h.level < PR.JOB_LEVEL)) h.job = 0;
      const attrs = Object.keys(PR.attributes), attrSum = attrs.reduce((a, k) => a + Math.max(0, Math.floor(Number(h.attr[k]) || 0)), 0);
      attrs.forEach(k => { h.attr[k] = Math.max(0, Math.floor(Number(h.attr[k]) || 0)); });
      Object.keys(h.attr).forEach(k => { if (!PR.attributes[k]) delete h.attr[k]; });
      if (attrSum > (h.level - 1) * PR.ATTR_PER_LEVEL + 5) attrs.forEach(k => { h.attr[k] = 0; });
      const tree = PR.treeFor ? PR.treeFor(h.id) : [];
      if (tree.length) {
        const clean = {}; let spent = 0;
        Object.entries(h.talents).forEach(([id, rk]) => { const n = tree.find(x => x.id === id); rk = Math.floor(Number(rk) || 0); if (n && rk > 0) { clean[id] = Math.min(rk, n.max); spent += clean[id]; } });
        h.talents = spent > (h.level - 1) + (h.job ? 5 : 0) ? {} : clean;
      }
    });
    const tcap = PR.trainingCap(s.buildings.dojo || 1);
    Object.keys(s.training).forEach(k => { s.training[k] = U.clamp(Math.floor(Number(s.training[k]) || 0), 0, tcap); });
    s.paragon.lv = U.clamp(Math.floor(Number(s.paragon.lv) || 0), 0, D.PARAGON.cap); s.paragon.xp = Math.max(0, Number(s.paragon.xp) || 0);
    s.house.display = s.house.display.map((id, i, a) => (id && a.indexOf(id) === i ? id : null));
    ['keys', 'gold', 'crystal', 'dust', 'ore'].forEach(k => { s.player[k] = Math.max(0, Math.floor(Number(s.player[k]) || 0)); });
    s.pityBy = { ...(raw.pityBy || {}) };
    // Regras de tipo por classe: itens que a classe não usa (saves antigos) voltam para a bolsa.
    s.collection.forEach(h => Object.entries(h.equipped).forEach(([k, uid]) => { const it = uid && s.inventory.find(x => x.uid === uid); if (uid && (!it || !I.equipCheck(it, h.id).ok)) h.equipped[k] = null; }));
    return s;
  }
  // Cartas que a conta já teve (Álbum): registradas, na bolsa, encaixadas ou expostas na Casa do Time.
  function albumIds(state) {
    const ids = new Set(Object.keys(state.house?.seen || {}));
    Object.entries(state.cards || {}).forEach(([id, n]) => { if (n > 0) ids.add(id); });
    (state.inventory || []).forEach(it => (it.cards || []).forEach(id => { if (id) ids.add(id); }));
    (state.house?.display || []).forEach(id => { if (id) ids.add(id); });
    return [...ids].filter(id => I.cardById(id));
  }
  // Bônus da Casa do Time (Galeria + Álbum) e do Paragão: valem para toda a equipe.
  function houseStats(state) {
    const out = {};
    (state.house?.display || []).forEach(id => { const cd = id && I.cardById(id); if (cd) mergeStats(out, cd.stats, D.HOUSE.displayShare); });
    const n = albumIds(state).length;
    D.HOUSE.album.forEach(m => { if (n >= m.n) mergeStats(out, m.stats); });
    const pl = Math.min(D.PARAGON.cap, Number(state.paragon?.lv) || 0);
    if (pl) mergeStats(out, { atk:pl * D.PARAGON.per, hp:pl * D.PARAGON.per, def:pl * D.PARAGON.per });
    return out;
  }
  function parseSave(raw) { try { const v = typeof raw === 'string' ? JSON.parse(raw) : raw; return v && v.version === 3 ? v : null; } catch (_) { return null; } }
  function loadState(raw) {
    if (raw !== undefined) { const parsed = parseSave(raw); saveGeneration = Math.max(saveGeneration, Number(parsed?.saveGeneration) || 0); return mergeState(parsed); }
    const candidates = [saveKey, `${saveKey}:a`, `${saveKey}:b`].map(k => parseSave(U.safeStorage.get(k))).filter(Boolean);
    candidates.sort((a, b) => (Number(b.saveGeneration) || 0) - (Number(a.saveGeneration) || 0) || (Number(b.totalPlaySeconds) || 0) - (Number(a.totalPlaySeconds) || 0) || (Number(b.lastSeen) || 0) - (Number(a.lastSeen) || 0));
    const best = candidates[0] || null;
    saveGeneration = Math.max(saveGeneration, Number(best?.saveGeneration) || 0);
    return mergeState(best);
  }
  function saveState(state) {
    state.lastSeen = KT.Clock.now();
    state.saveGeneration = saveGeneration = Math.max(saveGeneration, Number(state.saveGeneration) || 0) + 1;
    const json = JSON.stringify(state), pointerKey = `${saveKey}:active`, active = U.safeStorage.get(pointerKey);
    const target = active === 'a' ? 'b' : 'a', targetKey = `${saveKey}:${target}`;
    const ok = U.safeStorage.set(targetKey, json);
    if (ok) { U.safeStorage.set(pointerKey, target); U.safeStorage.remove(saveKey); }
    try { KT.Cloud?.onLocalSave?.(state, json); } catch (_) {}
    return ok;
  }

  // ===========================================================================
  // CURVAS
  // ===========================================================================
  // EXP por nível. Até o 32 a curva antiga (60·N^1,9); depois ela acompanha o crescimento exponencial da EXP dos
  // inimigos (1,065^0,92 por nível de inimigo) para que cada nível custe um pouco MAIS abates que o anterior
  // (≈2.050 abates no 32 → ≈3.750 no 99, com a equipe no nível da região). Antes, o fim ficava mais rápido que o meio.
  const XP_SHARE = lvl => 3.5 * Math.pow(1.065, .92 * (lvl - 1));
  const heroXpNext = lvl => { lvl = Math.max(1, lvl); return lvl <= 32 ? Math.round(60 * Math.pow(lvl, 1.9)) : Math.round((2050 + 25 * (lvl - 32)) * XP_SHARE(lvl)); };
  // Nível de um inimigo a partir do poder da região (o mesmo número mostrado na luta).
  const enemyLevel = P => Math.max(1, Math.round(1 + Math.log(Math.max(1, P)) / Math.log(1.065)));
  // Travas de EXP: herói muito abaixo do inimigo (carregado por uma equipe forte) ou muito acima (farm de mapa fácil)
  // ganha menos, e um único abate nunca rende mais que 5% de um nível. O nível do inimigo conta até o teto dos heróis.
  const XP_RULES = { under:15, underSlope:.04, over:8, overSlope:.1, floor:.1, perKill:.05 };
  function xpFactor(heroLv, enemyLv) {
    if (!enemyLv) return 1;
    const d = Math.min(HERO_LEVEL_CAP, enemyLv) - heroLv;
    if (d > XP_RULES.under) return Math.max(XP_RULES.floor, 1 - (d - XP_RULES.under) * XP_RULES.underSlope);
    if (-d > XP_RULES.over) return Math.max(XP_RULES.floor, 1 - (-d - XP_RULES.over) * XP_RULES.overSlope);
    return 1;
  }
  const classXpNext = lvl => Math.round(100 * Math.pow(Math.max(1, lvl), 1.65));
  const accountXpNext = lvl => Math.round(250 * Math.pow(1.2, lvl - 1));
  const heroMaxLevel = () => HERO_LEVEL_CAP;
  const awakenCost = (stars, shrineLv) => ({ shards:[0, 15, 30, 60, 100, 160][stars] || 999, gold:Math.round(2500 * Math.pow(2.3, stars - 1) * (1 - Math.min(.4, (shrineLv - 1) * .05))) });
  const zonePower = (zone, opts = {}) => {
    if (zone.kind === 'hunt') return zone.basePower * Math.pow(zone.growth || D.STAGE_GROWTH, (opts.stage || 1) - 1);
    if (zone.kind === 'dungeon') return zone.floorPower[(opts.floor || 1) - 1] || zone.floorPower[0];
    if (zone.kind === 'boss') return zone.power * (D.bossTiers[opts.tier || 0]?.mult || 1);
    if (zone.kind === 'rift') return D.RIFT.base * Math.pow(D.RIFT.growth, (opts.floor || 1) - 1);
    return 1;
  };
  const itemLevelFor = (zone, opts = {}) => {
    if (zone.kind === 'hunt') return zone.ilvl + (opts.stage || 1) - 1;
    if (zone.kind === 'dungeon') return zone.ilvl + ((opts.floor || 1) - 1) * 3;
    if (zone.kind === 'boss') return zone.ilvl + (opts.tier || 0) * 5;
    if (zone.kind === 'rift') return zone.ilvl + Math.floor((opts.floor || 1) * .9);
    return 1;
  };

  // Datas no fuso de Brasília (UTC−3, sem horário de verão).
  const TZ_MS = D.EVENT_TZ_OFFSET_MIN * 60000;
  const localDate = ms => new Date(ms + TZ_MS);
  const dayKey = (ms = KT.Clock.now()) => localDate(ms).toISOString().slice(0, 10);
  // Janelas de evento de um dia (início/fim em ms UTC reais).
  function windowsOfDay(dayStartUtc) {
    const dow = localDate(dayStartUtc).getUTCDay();
    return D.eventSchedule.filter(w => w.days.includes(dow)).map(w => ({ id:w.id, start:dayStartUtc + w.from * 3600000, end:dayStartUtc + w.to * 3600000 }));
  }
  function dayStart(ms) { const l = localDate(ms); return Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()) - TZ_MS; }
  function upcomingEvents(now = KT.Clock.now(), days = 7) {
    const out = [], d0 = dayStart(now);
    for (let d = -1; d <= days; d++) windowsOfDay(d0 + d * 86400000).forEach(w => { if (w.end > now) out.push({ ...D.worldEvents.find(e => e.id === w.id), start:w.start, end:w.end }); });
    return out.sort((x, y) => x.start - y.start);
  }
  function activeEvent(now = KT.Clock.now()) {
    const list = upcomingEvents(now, 2);
    const cur = list.find(w => w.start <= now && w.end > now);
    const next = list.find(w => w.start > now) || null;
    if (cur) return { ...cur, ends:cur.end, next };
    return { ...D.calmEvent, ends:next ? next.start : now + 3600000, next };
  }

  // ===========================================================================
  // CÁLCULO DE ATRIBUTOS DOS HERÓIS
  // ===========================================================================
  function mergeStats(target, add, mult = 1) { Object.entries(add || {}).forEach(([k, v]) => { target[k] = (target[k] || 0) + v * mult; }); return target; }
  // Buffs de comida ativos (dependem da hora: a luta usa a hora fixada pelo servidor).
  function buffStats(state, now) {
    const out = {};
    Object.entries(state.buffs || {}).forEach(([id, until]) => { const b = PR.buffs?.[id]; if (b?.stats && until > now) Object.entries(b.stats).forEach(([k, v]) => { out[k] = (out[k] || 0) + v; }); });
    return out;
  }
  function teamContext(state, records, now = KT.Clock.now()) {
    const team = records.filter(Boolean);
    const templates = team.map(r => D.roster.find(t => t.id === r.id));
    const clsCount = {}, elCount = {};
    templates.forEach(t => { clsCount[t.cls] = (clsCount[t.cls] || 0) + 1; elCount[t.el] = (elCount[t.el] || 0) + 1; });
    const ids = new Set(templates.map(t => t.id));
    const bonds = D.bonds.filter(b => b.ids.every(id => ids.has(id)));
    const teamStats = {}; const clsSyn = [];
    Object.entries(clsCount).forEach(([cls, n]) => { const tiers = D.classes[cls].synergy.filter(s => n >= s.n); if (tiers.length) { tiers.forEach(t => mergeStats(teamStats, t.stats)); clsSyn.push({ cls, n, tiers }); } });
    const elSyn = [];
    Object.entries(elCount).forEach(([el, n]) => { const tiers = D.elementSynergy.filter(s => n >= s.n); if (tiers.length) elSyn.push({ el, n, tiers }); });
    // Auras (passivas e itens únicos) valem para a equipe inteira.
    team.forEach((r, i) => {
      const t = templates[i]; if (t.passive.hooks.aura) mergeStats(teamStats, t.passive.hooks.aura);
      Object.values(r.equipped || {}).forEach(uid => { const it = state.inventory.find(x => x.uid === uid); if (it?.kind === 'unique') { const q = I.uniques.find(u => u.id === it.uniqueId); if (q?.hook?.aura) mergeStats(teamStats, q.hook.aura); } });
    });
    mergeStats(teamStats, buffStats(state, now));
    mergeStats(teamStats, houseStats(state));
    return { teamStats, clsSyn, elSyn, bonds, elCount, clsCount };
  }

  function heroStats(state, rec, ctx) {
    const t = D.roster.find(x => x.id === rec.id), c = D.classes[t.cls];
    ctx = ctx || teamContext(state, formationRecords(state));
    const levels = Math.max(0, rec.level - 1);
    const growth = 1 + levels * .05 + levels * levels * .0007;
    const rar = D.heroRarities.find(r => r.id === rec.rarity)?.mult || 1;
    const star = 1 + (rec.stars - 1) * .12;
    const base = { hp:c.base.hp * (t.prof.hp || 1), atk:c.base.atk * (t.prof.atk || 1), def:c.base.def * (t.prof.def || 1) };
    const s = { spd:c.base.spd, crit:c.base.crit, critDmg:c.base.critDmg, dodge:c.base.dodge, lifesteal:0, dr:0, regen:0, healPow:0, dot:0, boss:0, pierce:0, skill:0, nrg:0, cdr:0, startNrg:0, elem:0, ultDmg:0, thorns:0, skillMastery:0, breakPow:0, chainPow:0 };
    const pctAdd = { hp:0, atk:0, def:0 }; const flat = { hp:0, atk:0, def:0 };
    const add = (stats, m = 1) => Object.entries(stats || {}).forEach(([k, v]) => {
      if (k === 'hpFlat') flat.hp += v * m; else if (k === 'atkFlat') flat.atk += v * m; else if (k === 'defFlat') flat.def += v * m;
      else if (k === 'hp' || k === 'atk' || k === 'def') pctAdd[k] += v * m;
      else if (k === 'spd') s.spd += c.base.spd * v * m;
      else if (k in s) s[k] += v * m;
    });
    add(c.baseBonus);
    add(t.passive.hooks.stats);
    Object.entries(rec.attr || {}).forEach(([k, n]) => add(PR.attributes[k]?.per, n));
    add(ctx.teamStats);
    ctx.elSyn.forEach(e => e.tiers.forEach(tier => { if (tier.n === 4 || e.el === t.el) add(tier.stats); }));
    ctx.bonds.forEach(b => { if (b.ids.includes(t.id)) add(b.stats); });
    const tree = PR.treeFor(t.id), talentHooks = [];
    Object.entries(rec.talents || {}).forEach(([id, rank]) => { const n = tree.find(x => x.id === id); if (!n || !rank) return; add(n.stats, rank); if (n.hook) talentHooks.push(n.hook(rank)); });
    if (rec.job) { pctAdd.hp += .10; pctAdd.atk += .10; pctAdd.def += .10; }
    Object.entries(state.training || {}).forEach(([k, lv]) => { const tr = PR.training[k]; if (tr && lv) add({ [tr.stat]:tr.per * lv }); });
    // Equipamentos e conjuntos.
    const setCount = {}; const hooks = [...talentHooks];
    Object.values(rec.equipped || {}).forEach(uid => {
      const it = state.inventory.find(x => x.uid === uid); if (!it) return;
      add(I.itemStats(it));
      if (it.kind === 'set') setCount[it.setId] = (setCount[it.setId] || 0) + 1;
      if (it.kind === 'unique') { const q = I.uniques.find(u => u.id === it.uniqueId); if (q?.hook) hooks.push(q.hook); }
      (it.cards || []).forEach(cid => { const cd = cid && I.cardById(cid); if (cd?.hook) hooks.push(cd.hook); });
    });
    const sets = [];
    Object.entries(setCount).forEach(([id, n]) => { const set = I.sets.find(x => x.id === id); if (!set) return; const active = []; if (n >= 2) { add(set.bonus2.stats); active.push(2); } if (n >= 4) { add(set.bonus4.stats); if (set.bonus4.hook) hooks.push(set.bonus4.hook); active.push(4); } sets.push({ set, n, active }); });
    // Retorno decrescente: bônus percentuais somados acima de +200% valem metade (atributos, treino, Paragão,
    // cartas, conjuntos e comidas empilhados não multiplicam o poder sem limite).
    ['hp', 'atk', 'def'].forEach(k => { if (pctAdd[k] > 2) pctAdd[k] = 2 + (pctAdd[k] - 2) * .5; });
    const maxHp = Math.round((base.hp * growth * rar * star + flat.hp) * (1 + pctAdd.hp));
    const atk = Math.round((base.atk * growth * rar * star + flat.atk) * (1 + pctAdd.atk));
    const def = Math.round((base.def * growth * rar * star + flat.def) * (1 + pctAdd.def));
    s.crit = U.clamp(s.crit, 0, .85); s.dodge = U.clamp(s.dodge, 0, .6); s.dr = U.clamp(s.dr, -.5, .6);
    return { maxHp, atk, def, baseAtk:base.atk * growth * rar * star, ...s, hooks, sets, template:t };
  }

  function statPower(st) {
    const offense = st.atk * (1 + st.crit * (st.critDmg - 1)) * st.spd * (1 + st.skill * .4) * (1 + st.pierce * .5);
    const defense = st.maxHp * (1 + st.def / 400) * (1 + st.dodge) / Math.max(.3, 1 - st.dr);
    return Math.round(offense * 3.2 + defense * .32);
  }
  // Poder exibido (compacto): a força bruta cresce multiplicando muitos fatores e chegava a dezenas de milhões.
  // O Poder mostrado é força^0,7 (mesma ordem, escala humana: ~400 no começo, ~80 mil no chefe final).
  // A força bruta continua sendo a base de todas as comparações internas.
  const POWER_EXP = .7;
  const powerScore = raw => Math.round(Math.pow(Math.max(0, Number(raw) || 0), POWER_EXP));
  // Poder de um herói: a parte dele numa equipe de 4 iguais (4 heróis iguais somam o Poder da equipe).
  const heroScore = raw => Math.round(powerScore(4 * raw) / 4);
  function formationRecords(state) { return state.formation.map(uid => uid && state.collection.find(h => h.uid === uid)).filter(Boolean); }

  // ===========================================================================
  // MOTOR
  // ===========================================================================
  class CombatEngine {
    constructor(state, events = {}) {
      this.state = state; this.events = events;
      this.zone = D.zones.village; this.opts = {};
      this.party = []; this.enemies = []; this.active = false; this.phase = 'idle'; this.timer = 0;
      this.time = 0; this.zoneElapsed = 0; this.wave = 0; this.room = 0; this.pendingRoute = null; this.pendingEncounter = null;
      this.focusUid = null; this.bossPhase = 0; this.paused = false; this.stageMods = {}; this.encounterUsed = false;
      this.potionCd = 0; this.elixirCd = 0; this.runLoot = []; this.runGold = 0; this.runXp = 0;
      this.acc = 0; this.seg = null; this.segWaiting = false; this.replay = false; this.fixedNow = null; this.segmentProvider = null;
      this.ensureContracts(); this.ensureDaily();
    }
    // Eventos para a interface nunca consomem o gerador da luta (o servidor não tem interface).
    emit(name, payload) { const h = this.events?.[name]; if (!h) return; KT.Rng.with(null, () => { try { h(payload); } catch (err) { console.warn(err); } }); }
    now() { return this.fixedNow ?? KT.Clock.now(); }

    // ---------- conveniências ----------
    get heroes() { return formationRecords(this.state); }
    template(id) { return D.roster.find(t => t.id === id); }
    record(uid) { return this.state.collection.find(h => h.uid === uid); }
    ctx() { return teamContext(this.state, this.heroes, this.now()); }
    heroStats(rec, ctx) { return heroStats(this.state, rec, ctx); }
    heroPower(rec, ctx) { return heroScore(statPower(this.heroStats(rec, ctx))); }
    getPowerRaw() { const ctx = this.ctx(); return this.heroes.reduce((s, r) => s + statPower(heroStats(this.state, r, ctx)), 0); }
    getPower() { return powerScore(this.getPowerRaw()); }
    event() { return activeEvent(this.now()); }
    mod(key) { const ev = activeEvent(this.now()); let v = ev.mods?.[key] || 0; if (key === 'gold' || key === 'xp') { v += this.state.boostUntil > this.now() ? .20 : 0; } Object.entries(this.state.buffs || {}).forEach(([id, until]) => { const b = PR.buffs?.[id]; if (b?.mods?.[key] && until > this.now()) v += b.mods[key]; }); if (key === 'gold') v += (this.state.buildings.guild - 1) * .03; D.GUILD.perks.forEach(p => { if ((this.state.social?.guildLevel || 0) >= p.lv && p.mods[key]) v += p.mods[key]; }); if (key === 'xp') v += (this.state.buildings.dojo - 1) * .04; if (key === 'drop') v += (this.stageMods.drop || 0); return key === 'xp' || key === 'gold' ? Math.min(.50, v) : v; }

    recommendedPower(zoneId, opts = {}) { const r = this.recommendedPowerRaw(zoneId, opts); return r ? Math.max(10, Math.round(powerScore(r) / 10) * 10) : 0; }
    recommendedPowerRaw(zoneId, opts = {}) {
      const z = D.zones[zoneId]; if (!z || z.kind === 'village') return 0;
      const P = zonePower(z, opts);
      const ref = z.kind === 'boss' ? 3.1 : z.kind === 'dungeon' || z.kind === 'rift' ? 1.35 : 1;
      return Math.round(6500 * P * Math.min(1, .25 + .1 * P) * ref / 100) * 100;
    }

    // ---------- desbloqueios ----------
    zoneLock(zoneId) {
      const z = D.zones[zoneId], s = this.state, reasons = [];
      if (!z) return { locked:true, reasons:['Região desconhecida'] };
      if (z.kind === 'village') return { locked:false, reasons };
      if (this.heroes.length < 4) reasons.push({ text:'Equipe com 4 heróis', met:false });
      Object.entries(z.unlock?.stage || {}).forEach(([id, n]) => reasons.push({ text:`Vencer ${D.zones[id].title}, estágio ${n}`, met:(s.progress[id]?.best || 0) >= n }));
      Object.entries(z.unlock?.floor || {}).forEach(([id, n]) => reasons.push({ text:`Conquistar ${D.zones[id].title}, andar ${['I','II','III'][n - 1] || n}`, met:(s.progress[id]?.best || 0) >= n }));
      Object.entries(z.unlock?.kills || {}).forEach(([id, n]) => reasons.push({ text:`Derrotar ${D.enemies[D.zones[id].enemy].name.split(',')[0]}`, met:(s.progress[id]?.kills || 0) >= n }));
      if (z.event) reasons.push({ text:`Evento ativo: ${D.worldEvents.find(e => e.id === z.event).name}`, met:activeEvent(this.now()).id === z.event });
      if (z.kind === 'worldboss') { const w = this.wbWindow(); reasons.push({ text:`Janela aberta (${D.worldBoss.windows.map(x => x.label).join(' ou ')})`, met:w.active }); reasons.push({ text:'Uma investida por dia', met:s.worldBoss.day !== dayKey(this.now()) }); }
      return { locked:reasons.some(r => !r.met), reasons };
    }
    getZoneRequirements(zoneId) { return this.zoneLock(zoneId).reasons.map(r => ({ label:r.text, met:r.met })); }

    // ---------- entrar em região ----------
    // Valida e posiciona a equipe numa região (mesma regra no navegador e no servidor).
    prepareZone(zoneId, opts = {}) {
      const z = D.zones[zoneId]; if (!z) return false;
      if (z.kind === 'arena' && !this.arenaFoe) return false;
      const lock = this.zoneLock(zoneId);
      if (lock.locked) { this.emit('onToast', `Bloqueado: ${lock.reasons.filter(r => !r.met).map(r => r.text).join(' · ')}.`); return false; }
      opts = { ...opts };
      const p = this.state.progress[zoneId];
      if (z.kind === 'hunt') { const max = Math.min(z.stages, (p.best || 0) + 1); opts.stage = U.clamp(opts.stage || p.cur || 1, 1, max); p.cur = opts.stage; this.state.lastHunt = zoneId; }
      if (z.kind === 'dungeon') { opts.floor = U.clamp(opts.floor || p.cur || 1, 1, Math.min(z.floors, (p.best || 0) + 1)); p.cur = opts.floor; }
      if (z.kind === 'rift') { opts.floor = U.clamp(opts.floor || p.cur || 1, 1, (p.best || 0) + 1); p.cur = opts.floor; }
      if (z.kind === 'boss') { const unlockedTier = D.bossTiers.filter(t => !t.needKills || (p.kills || 0) >= t.needKills).length - 1; opts.tier = U.clamp(opts.tier ?? p.tier ?? 0, 0, unlockedTier); p.tier = opts.tier; }
      if (z.kind === 'worldboss') { opts.tier = U.clamp(Number(opts.tier) || 0, 0, D.worldBoss.tiers.length - 1); if (this.getPower() < D.worldBoss.tiers[opts.tier].minPower) opts.tier = 0; opts.ally = U.clamp(Number(opts.ally) || 0, 0, 500); }
      this.zone = z; this.opts = opts; this.state.zone = zoneId; this.zoneElapsed = 0;
      this.enemies = []; this.party = []; this.focusUid = null; this.pendingRoute = null; this.pendingEncounter = null; this.pendingChoice = null;
      this.runLoot = []; this.runGold = 0; this.runXp = 0;
      if (!this.state.codex.discovered) this.state.codex.discovered = {};
      if (z.kind === 'village') { this.active = false; this.phase = 'idle'; return true; }
      this.active = true;
      this.state.guide.flags[`entered_${zoneId}`] = true;
      const firstVisit = !this.state.story.seen[`zone_${zoneId}`] && D.story.zone[zoneId];
      if (firstVisit) this.state.story.seen[`zone_${zoneId}`] = true;
      return { firstVisit };
    }
    enterZone(zoneId, opts = {}) {
      if (this.seg) this.abortSegment();
      const r = this.prepareZone(zoneId, opts); if (!r) return false;
      this.emit('onZone', this.zone);
      if (this.zone.kind === 'village') { this.segmentProvider?.flush?.(); return true; }
      if (r.firstVisit) this.emit('onDialog', D.story.zone[zoneId]);
      this.startRun();
      return true;
    }

    // ---------- segmentos de luta (reproduzíveis pelo servidor) ----------
    // Um segmento vai do início de um estágio/andar/luta até vitória ou derrota. No modo online o
    // servidor fornece a semente; o navegador grava os comandos do jogador (ultimates, poções, alvo,
    // escolhas) com o passo em que aconteceram, e o servidor refaz a luta para calcular as recompensas.
    startRun() {
      if (this.zone.kind === 'arena') { this.beginSegment({ id:null, seed:this.arenaFoe.seed, at:null }); return; }
      if (this.segmentProvider && !this.replay) { this.phase = 'waiting'; this.segWaiting = true; this.enemies = []; this.segmentProvider.request({ zone:this.zone.id, opts:{ ...this.opts } }); return; }
      this.beginSegment(null);
    }
    beginSegment(seg) {
      this.seg = { id:seg?.id ?? null, seed:seg?.seed ?? null, at:seg?.at ?? null, tick:0, inputs:[], rng:seg ? KT.Rng.seeded(seg.seed) : null };
      if (seg?.opts && typeof seg.opts === 'object') this.opts = { ...seg.opts };
      this.fixedNow = seg?.at ?? null; this.segWaiting = false; this.acc = 0;
      KT.Rng.with(this.seg.rng, () => this.startRunCore());
    }
    // Encerra o segmento (vitória/derrota) e entrega o que o servidor precisa para conferir.
    endSegment(outcome) {
      const seg = this.seg; if (!seg) return;
      this.seg = null; this.fixedNow = null;
      if (seg.id !== null && !this.replay) this.segmentProvider?.finished?.({ segId:seg.id, endTick:seg.tick, inputs:seg.inputs, outcome });
      this.lastOutcome = outcome;
    }
    // Interrompe no meio (trocar de região, equipar, etc.): o servidor paga o que já foi feito.
    abortSegment() {
      const seg = this.seg; if (!seg) return null;
      this.seg = null; this.fixedNow = null;
      const fin = seg.id !== null ? { segId:seg.id, endTick:seg.tick, inputs:seg.inputs, outcome:'abort' } : null;
      if (fin && !this.replay) this.segmentProvider?.finished?.(fin);
      this.enemies = []; this.phase = 'idle';
      return fin;
    }
    // Comando do jogador durante a luta: executa com o gerador da luta e fica gravado.
    input(kind, arg) {
      if (!INPUT_KINDS.has(kind)) return false;
      const seg = this.seg;
      const run = () => this.applyInput({ k:kind, a:arg });
      const ok = seg ? KT.Rng.with(seg.rng, run) : run();
      if (seg && ok !== false && !this.replay && seg.inputs.length < 4000) seg.inputs.push({ t:seg.tick, k:kind, a:arg });
      return ok;
    }
    applyInput(inp) {
      switch (inp.k) {
        case 'ult': return this.castUlt(Number(inp.a), true);
        case 'potion': return this.usePotion();
        case 'elixir': return this.useElixir();
        case 'focus': return this.setFocus(String(inp.a || '')) !== undefined;
        case 'choice': { const c = this.pendingChoice; if (!c || !c.options.some(o => o.id === inp.a)) return false; this.resolveChoice(c, inp.a, false); return true; }
        case 'auto': this.state.settings.auto = !!inp.a; return true;
        case 'advance': this.state.settings.autoAdvance = !!inp.a; return true;
      }
      return false;
    }
    // Reprodução no servidor: mesma semente, mesmos comandos, mesmo resultado.
    replaySegment(seg, inputs = [], endTick = 0) {
      this.replay = true; this.fixedNow = seg.at ?? null;
      const prep = this.prepareZone(seg.zone, seg.opts || {}); if (!prep || this.zone.kind === 'village') return { ok:false, reason:'zone' };
      this.beginSegment(seg);
      const list = (inputs || []).filter(x => x && INPUT_KINDS.has(x.k) && Number.isInteger(x.t) && x.t >= 0).sort((a, b) => a.t - b.t).slice(0, 4000);
      let i = 0, guard = 0;
      while (this.seg && this.seg.tick < endTick && guard++ < 400000) {
        while (i < list.length && list[i].t < this.seg.tick) i++;
        while (this.seg && i < list.length && list[i].t === this.seg.tick) { KT.Rng.with(this.seg.rng, () => this.applyInput(list[i])); i++; }
        if (!this.seg) break;
        if (this.pendingRoute || this.pendingEncounter) break; // escolha sem resposta: para aqui
        this.tick();
      }
      return { ok:true, ended:!this.seg, outcome:this.lastOutcome || (this.seg ? 'partial' : 'end'), tick:this.seg ? this.seg.tick : endTick };
    }
    tick() {
      const seg = this.seg;
      if (seg) { seg.tick++; KT.Rng.with(seg.rng, () => this.step(DT)); }
      else this.step(DT);
    }

    startRunCore() {
      const ctx = this.ctx();
      this.party = this.state.formation.map((uid, slot) => { const rec = uid && this.record(uid); return rec ? this.makeHeroUnit(rec, slot, ctx) : null; }).filter(Boolean);
      this.wave = 0; this.room = 0; this.bossPhase = 0; this.ultChain = 0; this.lastUltAt = -99; this.lastUltHero = -1; this.chainBonus = 0; this.stageMods = {}; this.encounterUsed = false; this.potionCd = 0; this.elixirCd = 0;
      if (this.zone.kind === 'arena') this.party.forEach(u => { u.maxHp = Math.round(u.maxHp * D.PVP.hpParty); u.hp = u.maxHp; });
      this.nextWave();
    }

    makeHeroUnit(rec, slot, ctx) {
      const st = heroStats(this.state, rec, ctx), t = st.template;
      const hooks = {}; const addHooks = h => Object.entries(h || {}).forEach(([k, v]) => { (hooks[k] = hooks[k] || []).push(v); });
      addHooks(t.passive.hooks); st.hooks.forEach(addHooks);
      return { uid:rec.uid, recUid:rec.uid, side:'hero', slot, row:slot < 2 ? 'front' : 'back', name:t.name, sprite:t.sprite, el:t.el, cls:t.cls, color:t.color, template:t,
        st, hooks, maxHp:st.maxHp, hp:st.maxHp, shield:0, shieldT:0, energy:Math.min(ULT_COST, st.startNrg), atkCd:U.rand(.2, .7), skillCd:t.skill.cd * .45, skillHeld:0, ultHeld:0,
        effects:[], counters:{ atk:0 }, flags:{}, alive:true, thorns:(st.thorns || 0) + (hooks.thorns ? hooks.thorns.reduce((a, b) => a + b, 0) : 0), cleave:hooks.cleave ? Math.max(...hooks.cleave) : 0, level:rec.level };
    }

    makeEnemyUnit(id, P, extra = {}) {
      const t = D.enemies[id] || D.enemies.fox;
      const ev = activeEvent(this.now()); const atkMod = 1 + (ev.mods?.enemyAtk || 0);
      const lvl = enemyLevel(P);
      if (!this.state.codex.enemies.includes(id)) this.state.codex.enemies.push(id);
      const u = { uid:U.uid('en'), side:'enemy', id, name:t.name, sprite:t.sprite, el:t.el, cls:t.role, color:D.elements[t.el].color, t,
        st:{ atk:t.atk * (t.atkMul || 1) * P * atkMod, baseAtk:t.atk * P, def:t.def * P, spd:t.spd, crit:t.crit || .05, critDmg:1.5, dodge:t.dodge || 0, lifesteal:t.lifesteal || 0, dr:0, regen:t.regen || 0, healPow:0, dot:0, boss:0, pierce:0, skill:0, nrg:0, cdr:0, elem:0, ultDmg:0 },
        maxHp:Math.round(t.hp * (t.hpMul || 1) * P), hp:Math.round(t.hp * (t.hpMul || 1) * P), shield:0, shieldT:0, energy:0, atkCd:U.rand(.5, 1.2), skillCd:(t.skill?.cd || 99) * U.rand(.4, .8),
        effects:[], counters:{ atk:0 }, flags:{}, alive:true, thorns:t.thorns || 0, elite:!!t.elite, boss:!!t.boss, miniboss:!!t.miniboss, treasure:!!t.treasure, level:lvl, P,
        specials:[], windup:0, windupMax:0, windupSpecial:null, hooks:{}, spawnT:0, breakG:0, breakMax:BREAK.max, broken:0, ...extra };
      if (t.specials) u.specials = t.specials.map(s => ({ ...s, t:s.cd * .6 }));
      if (t.boss) this.applyBossPhase(u, 0, true);
      return u;
    }

    applyBossPhase(boss, idx, initial = false) {
      const ph = boss.t.phases[idx]; if (!ph) return;
      boss.phaseIdx = idx; this.bossPhase = idx;
      boss.specials = ph.specials.map(s => ({ ...s, t:s.cd * (initial ? .55 : .4) }));
      boss.summon = ph.summon ? { ...ph.summon, t:6 } : null;
      if (ph.buff) Object.entries(ph.buff).forEach(([k, v]) => { if (k === 'spd') boss.st.spd *= 1 + v; else if (k === 'atk') boss.st.atk *= 1 + v; else if (k === 'dodge') boss.st.dodge += v; });
      if (ph.heal) { boss.hp = Math.min(boss.maxHp, boss.hp + boss.maxHp * ph.heal); }
      if (!initial) { this.emit('onPhase', { name:boss.name, idx, text:ph.text }); this.emit('onLog', { text:`${boss.name}: ${ph.text}!`, type:'boss' }); boss.effects = boss.effects.filter(e => !DEBUFFS.has(e.s) || !CC.has(e.s)); }
    }

    // ---------- ondas ----------
    nextWave() {
      const z = this.zone;
      this.enemies = []; this.focusUid = null;
      if (z.kind === 'hunt') {
        this.wave++;
        const stage = this.opts.stage, P = zonePower(z, { stage });
        const guardian = this.wave === 4;
        const count = Math.min(4, 2 + Math.floor((stage + 1) / 4));
        // Cada estágio e onda tem uma criatura "em destaque" e um formato de grupo diferente.
        const featured = z.pool[(stage - 1 + this.wave - 1) % z.pool.length];
        const pattern = guardian ? 'guard' : U.pick(['misto', 'misto', 'matilha', 'par']);
        const partner = U.pick(z.pool.filter(x => x !== featured));
        const ids = [];
        if (guardian) {
          ids.push(z.elites[(stage - 1) % z.elites.length]);
          if (stage % 4 === 0 || stage >= z.stages) ids.push(z.elites[stage % z.elites.length]);
          while (ids.length < Math.min(4, count)) ids.push(U.pick(z.pool));
        } else for (let i = 0; i < count; i++) ids.push(pattern === 'matilha' ? featured : pattern === 'par' ? (i % 2 ? partner : featured) : U.weighted(z.pool, x => x === featured ? 2 : 1));
        this.enemies = ids.map((id, i) => this.spawnEnemy(id, P, { guardian:guardian && i === 0, alpha:!guardian && U.random() < D.ALPHA.chance * (1 + (activeEvent(this.now()).mods?.encounter ? .5 : 0)) }));
        const alpha = this.enemies.find(e => e.alpha);
        if (alpha) { this.emit('onWarn', `${alpha.name} apareceu! Loot garantido.`); this.emit('onLog', { text:`Uma variante rara surgiu: ${alpha.name}.`, type:'boss' }); }
        this.emit('onWave', { label:guardian ? `Guardião do estágio ${stage}` : `Onda ${this.wave}/4`, detail:guardian ? this.enemies[0].name : pattern === 'matilha' ? `Matilha: ${ids.length}× ${D.enemies[featured].name}` : `${ids.length} inimigos`, guardian });
      } else if (z.kind === 'dungeon') {
        this.room++;
        const floor = this.opts.floor, P = zonePower(z, { floor });
        let ids;
        if (this.room === 1) ids = [U.pick(z.pool), U.pick(z.pool), U.pick(z.pool)];
        else if (this.room === 2) ids = [U.pick(z.pool), U.pick(z.pool), U.pick(z.pool), U.pick(z.pool)];
        else if (this.room === 3) ids = [z.elites[0], U.pick(z.pool), U.pick(z.pool)];
        else if (this.room === 4) ids = [z.elites[1], z.elites[0], U.pick(z.pool)];
        else ids = [z.floorBoss, U.pick(z.pool), U.pick(z.pool)];
        const riskMult = this.state.routeChoice === 'risk' && this.room >= 3 ? 1.2 : 1;
        this.enemies = ids.map(id => this.makeEnemyUnit(id, P * riskMult));
        this.emit('onWave', { label:`Sala ${this.room}/5`, detail:this.room === 5 ? `Chefe do andar: ${this.enemies[0].name}` : this.room === 3 ? 'Encruzilhada' : 'Avance pelas câmaras' });
        if (this.room === 3) { this.pendingRoute = 'dungeon'; this.offerChoice({ kind:'route', title:`Encruzilhada: ${z.title}`, options:[{ id:'risk', label:'Passagem Carmesim', desc:'Inimigos +20% fortes nas próximas salas, +60% chance de itens e baú extra.' }, { id:'safe', label:'Galeria Silenciosa', desc:'Recupera 35% do HP de todos e revive heróis caídos.' }] }); }
      } else if (z.kind === 'rift') {
        this.room++;
        const floor = this.opts.floor, P = zonePower(z, { floor }), mut = this.riftMutation(floor);
        const pool = z.pool, elites = z.elites, bosses = [z.floorBoss];
        let ids;
        if (this.room === 1) ids = Array.from({ length:floor >= 10 ? 4 : 3 }, () => U.pick(pool));
        else if (this.room === 2) ids = [U.pick(elites), U.pick(pool), U.pick(pool), U.pick(pool)];
        else ids = floor % 5 === 0 && bosses.length ? [U.pick(bosses), U.pick(pool), U.pick(pool)] : [U.pick(elites), U.pick(elites), U.pick(pool)];
        this.enemies = ids.map(id => this.spawnEnemy(id, P, { alpha:this.room === 1 && U.random() < D.ALPHA.chance * 2 }));
        this.enemies.forEach(e => { const m = mut.enemy || {}; if (m.hp) { e.maxHp = Math.round(e.maxHp * (1 + m.hp)); e.hp = e.maxHp; } if (m.atk) e.st.atk *= 1 + m.atk; if (m.spd) e.st.spd *= 1 + m.spd; if (m.lifesteal) e.st.lifesteal += m.lifesteal; if (m.thorns) e.thorns += m.thorns; });
        if (mut.reward?.drop) this.stageMods.drop = Math.max(this.stageMods.drop || 0, mut.reward.drop);
        this.emit('onWave', { label:`Andar ${floor} · Sala ${this.room}/${D.RIFT.rooms}`, detail:this.room === D.RIFT.rooms ? (floor % 5 === 0 ? `Guardião do abismo: ${this.enemies[0].name}` : 'Sala dos guardiões') : `Mutação: ${mut.name}. ${mut.text}` });
      } else if (z.kind === 'arena') {
        this.wave = 1; this.arenaTime = 0;
        this.enemies = (this.arenaFoe.defense || []).slice(0, 4).map((h, i) => this.makeRivalUnit(h, i)).filter(Boolean);
        this.emit('onWave', { label:`Arena · ${this.arenaFoe.name}`, detail:`${this.enemies.length} heróis rivais · ${D.PVP.time}s`, boss:true });
      } else if (z.kind === 'worldboss') {
        this.wave = 1; const tier = D.worldBoss.tiers[this.opts.tier || 0], id = this.wbBossId();
        this.enemies = [this.makeEnemyUnit(id, tier.P, { worldBoss:true })];
        this.bossTimer = 0; this.enrageStacks = 0; this.wbDamage = 0;
        this.emit('onWave', { label:this.enemies[0].name, detail:`Invasão Mundial · ${tier.name} · ${D.worldBoss.duration}s`, boss:true });
      } else if (z.kind === 'boss') {
        this.wave = 1;
        const P = zonePower(z, this.opts);
        this.enemies = [this.makeEnemyUnit(z.enemy, P)];
        this.bossTimer = 0; this.enrageStacks = 0;
        this.emit('onWave', { label:this.enemies[0].name, detail:`Dificuldade: ${D.bossTiers[this.opts.tier || 0].name}`, boss:true });
      }
      this.phase = 'fight';
      this.party.forEach(u => { u.flags.lowWave = false; u.flags.allyLowWave = false; if (u.alive) this.fire(u, 'start', {}); });
    }

    // Herói rival (defesa de outro jogador): atributos já calculados no jogo dele; age pela IA,
    // usa a habilidade própria e solta a ultimate como ataque telegrafado.
    makeRivalUnit(h, slot) {
      const t = this.template(h?.id); if (!t || !h.st) return null;
      const num = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
      const st = { atk:num(h.st.atk, 100), baseAtk:num(h.st.atk, 100), def:num(h.st.def), spd:num(h.st.spd, 1), crit:U.clamp(num(h.st.crit, .05), 0, .85), critDmg:num(h.st.critDmg, 1.5), dodge:U.clamp(num(h.st.dodge), 0, .6),
        lifesteal:num(h.st.lifesteal), dr:U.clamp(num(h.st.dr), -.5, .6), regen:num(h.st.regen), healPow:num(h.st.healPow), dot:num(h.st.dot), boss:0, pierce:num(h.st.pierce), skill:num(h.st.skill), nrg:0, cdr:num(h.st.cdr), elem:num(h.st.elem), ultDmg:num(h.st.ultDmg), breakPow:0, chainPow:0 };
      const hp = Math.max(1, Math.round(num(h.maxHp, 1000) * D.PVP.hpRival));
      const pseudo = { name:t.name, role:t.cls, skill:{ name:t.skill.name, cd:t.skill.cd, eff:t.skill.eff }, specials:[{ name:t.ult.name, cd:D.PVP.ultCd + slot * 1.5, windup:D.PVP.ultWindup, eff:t.ult.eff }] };
      const hooks = {}; [t.passive.hooks, ...(Array.isArray(h.hooks) ? h.hooks : [])].forEach(hk => Object.entries(hk || {}).forEach(([k, v]) => { if (k !== 'stats' && k !== 'aura') (hooks[k] = hooks[k] || []).push(v); }));
      const u = { uid:`rv_${slot}_${t.id}`, side:'enemy', id:t.id, name:t.name, sprite:t.sprite, el:t.el, cls:t.cls, color:t.color, t:pseudo, st, maxHp:hp, hp, shield:0, shieldT:0, energy:0,
        atkCd:U.rand(.3, .8), skillCd:t.skill.cd * .5, effects:[], counters:{ atk:0 }, flags:{}, alive:true, thorns:num(h.st.thorns), level:num(h.level, 1), P:1,
        specials:pseudo.specials.map(s => ({ ...s, t:s.cd * .7 })), windup:0, windupMax:0, windupSpecial:null, hooks, spawnT:0, breakG:0, breakMax:BREAK.max, broken:0, rival:true, stars:num(h.stars, 1) };
      return u;
    }
    // Instantâneo da equipe para a defesa no PvP (só números e efeitos, sem funções).
    pvpSnapshot() {
      const ctx = this.ctx();
      return this.heroes.map(r => { const st = heroStats(this.state, r, ctx); const clean = {}; Object.entries(st).forEach(([k, v]) => { if (typeof v === 'number') clean[k] = Math.round(v * 10000) / 10000; });
        return { id:r.id, level:r.level, stars:r.stars, rarity:r.rarity, maxHp:st.maxHp, st:clean, hooks:st.hooks || [] }; });
    }
    // Fim da luta de arena: entrega semente/comandos para o registro e volta para a caçada.
    arenaEnd(won, reason = '') {
      if (this.phase !== 'fight') return;
      const seg = this.seg, rec = { won, inputs:seg ? seg.inputs.slice() : [], endTick:seg ? seg.tick : 0, foe:this.arenaFoe, reason };
      this.endSegment(won ? 'clear' : 'defeat');
      this.phase = 'result'; this.timer = 6; this.lastResult = { kind:'arena', won, zone:this.zone, foe:this.arenaFoe?.name, reason };
      this.autoAfterResult = () => { this.emit('onResultClose'); this.arenaFoe = null; this.fallbackToHunt(); };
      this.emit('onArena', rec);
      this.emit('onResult', this.lastResult);
    }

    // Cada andar da Fenda tem uma mutação fixa (a mesma para todos os jogadores).
    riftMutation(floor) { return D.riftMutations[(floor * 7 + 3) % D.riftMutations.length]; }
    riftZones(floor) { return ['rift']; }
    spawnEnemy(id, P, extra = {}) {
      const u = this.makeEnemyUnit(id, P, extra);
      if (extra.alpha) { u.maxHp = Math.round(u.maxHp * D.ALPHA.hp); u.hp = u.maxHp; u.st.atk *= D.ALPHA.atk; u.name = `${u.name} ${D.ALPHA.prefix}`; u.elite = true; }
      return u;
    }

    // ---------- escolhas (rotas e encontros) ----------
    // Com AUTO ligado a melhor opção é escolhida na hora. Com AUTO desligado a escolha aparece
    // para o jogador; se ninguém escolher em 2 minutos (ex.: fora da tela), a recomendada é usada.
    offerChoice(c) {
      c.recommended = this.recommendChoice(c);
      if (this.state.settings.auto) { this.resolveChoice(c, c.recommended, true); return; }
      this.pendingChoice = { ...c, wait:0 };
      this.emit('onChoice', { ...c, deadline:CHOICE_WAIT });
    }
    resolveChoice(c, id, auto = false) {
      this.pendingChoice = null;
      const opt = c.options.find(o => o.id === id) || c.options[c.options.length - 1];
      if (auto) { this.state.stats.autoChoices = (this.state.stats.autoChoices || 0) + 1; this.emit('onLog', { text:`Escolha automática: ${opt.label}.`, type:'system' }); this.emit('onToast', `<b>${c.title}</b>: escolhido automaticamente “${opt.label}”.`); }
      this.emit('onChoiceResolved', { id:opt.id, auto });
      if (c.kind === 'route') this.chooseRoute(opt.id); else this.resolveEncounter(opt.id);
    }
    partyHealth() { const all = this.party; if (!all.length) return { ratio:0, dead:false }; return { ratio:all.reduce((a, u) => a + (u.alive ? u.hp / u.maxHp : 0), 0) / all.length, dead:all.some(u => !u.alive) }; }
    powerRatio() { const rec = this.recommendedPowerRaw(this.zone.id, this.opts); return rec ? this.getPowerRaw() / rec : 1; }
    recommendChoice(c) {
      const h = this.partyHealth(), pr = this.powerRatio();
      if (c.kind === 'route') return h.dead || h.ratio < .6 || pr < .9 ? 'safe' : 'risk';
      const enc = this.pendingEncounter?.enc?.id;
      if (enc === 'shrine') return h.dead || h.ratio < .45 ? 'renewal' : pr >= 1.25 ? 'fortune' : 'might';
      if (enc === 'chest') return h.ratio >= .6 && pr >= .9 ? 'open' : 'leave';
      if (enc === 'merchant') {
        let best = null, bestGain = 0;
        c.options.filter(o => o.item).forEach(o => {
          if (this.state.player.gold < o.price * 2.5) return;
          this.heroes.forEach(r => { const g = this.itemGain(r, o.item) || 0; if (g > bestGain) { bestGain = g; best = o.id; } });
        });
        return best || 'leave';
      }
      return c.options[0].id;
    }

    chooseRoute(choice) {
      if (this.pendingRoute !== 'dungeon') return;
      this.pendingChoice = null;
      this.state.routeChoice = choice;
      if (choice === 'safe') this.party.forEach(u => { if (!u.alive) { u.alive = true; u.hp = 1; } u.hp = Math.min(u.maxHp, u.hp + u.maxHp * .35); });
      else { this.stageMods.drop = (this.stageMods.drop || 0) + .6; this.enemies.forEach(e => { e.maxHp *= 1.2; e.hp *= 1.2; e.st.atk *= 1.2; }); }
      this.pendingRoute = null;
      this.emit('onLog', { text:choice === 'risk' ? 'A equipe entrou na Passagem Carmesim.' : 'A equipe descansou na Galeria Silenciosa.', type:'system' });
    }

    // ---------- loop principal ----------
    update(dtReal) {
      dtReal = Math.min(dtReal, 1);
      this.time += dtReal; this.state.totalPlaySeconds += dtReal;
      if (!this.segmentProvider) { this.dailyClock = (this.dailyClock || 0) + dtReal; if (this.dailyClock > 20) { this.dailyClock = 0; this.ensureDaily(); } }
      if (this.pendingChoice && !this.paused) {
        this.pendingChoice.wait += dtReal;
        if (this.state.settings.auto || this.pendingChoice.wait >= CHOICE_WAIT) { const c = this.pendingChoice; this.input('choice', c.recommended); if (this.pendingChoice === c) this.resolveChoice(c, c.recommended, true); }
      }
      if (!this.active || this.paused) return;
      this.acc = Math.min(this.acc + dtReal * U.clamp(this.state.settings.speed || 1, 1, MAX_SPEED), DT * 80);
      let n = 0;
      while (this.acc >= DT && n++ < 160) {
        if (this.pendingRoute || this.pendingEncounter || this.segWaiting || !this.active) { this.acc = 0; break; }
        this.acc -= DT;
        this.tick();
      }
    }
    step(dt) {
      if (!this.active || this.pendingRoute || this.pendingEncounter) return;
      this.zoneElapsed += dt;
      this.potionCd = Math.max(0, this.potionCd - dt); this.elixirCd = Math.max(0, this.elixirCd - dt);
      if (this.phase === 'between') { this.timer -= dt; if (this.timer <= 0) this.nextWave(); return; }
      if (this.phase === 'stageClear') { this.timer -= dt; if (this.timer <= 0) this.afterStageClear(); return; }
      if (this.phase === 'defeat') { this.timer -= dt; if (this.timer <= 0) this.afterDefeat(); return; }
      if (this.phase === 'result') { this.timer -= dt; if (this.timer <= 0 && this.autoAfterResult) { const f = this.autoAfterResult; this.autoAfterResult = null; f(); } return; }
      if (this.phase !== 'fight') return;
      const all = [...this.party, ...this.enemies];
      all.forEach(u => this.tickEffects(u, dt));
      this.party.forEach((u, i) => this.actHero(u, i, dt));
      this.enemies.forEach(u => this.actEnemy(u, dt));
      this.enemies.forEach(e => { if (e.treasure && e.alive) { e.fleeT = (e.fleeT || 0) + dt; if (e.fleeT > 12) { e.alive = false; e.fled = true; this.emit('onFx', { type:'text', uid:e.uid, text:'FUGIU!', color:'#ffd76a' }); this.emit('onLog', { text:'A Raposa Dourada fugiu!', type:'system' }); } } });
      if (this.zone.kind === 'boss' || this.zone.kind === 'worldboss') this.tickBossTimer(dt);
      if (this.zone.kind === 'worldboss' && this.phase === 'fight' && this.zoneElapsedFight() >= D.worldBoss.duration) { this.wbFinish(); return; }
      if (this.zone.kind === 'arena' && this.phase === 'fight') {
        this.arenaTime = (this.arenaTime || 0) + dt;
        if (this.arenaTime >= D.PVP.time) { const frac = list => list.reduce((a, u) => a + Math.max(0, u.hp) / u.maxHp, 0) / Math.max(1, list.length); this.arenaEnd(frac(this.party) > frac(this.enemies), 'Tempo esgotado: vence quem tem mais vida.'); return; }
      }
      this.checkOutcome();
    }

    tickBossTimer(dt) {
      const boss = this.enemies.find(e => e.boss && e.alive); if (!boss) return;
      this.bossTimer += dt;
      const limit = boss.t.enrage || 150;
      if (this.bossTimer > limit) {
        const stacks = 1 + Math.floor((this.bossTimer - limit) / 10);
        if (stacks > this.enrageStacks) { this.enrageStacks = stacks; boss.st.atk *= 1.25; this.emit('onWarn', `${boss.name.split(',')[0]} está em FÚRIA! (+25% ATK a cada 10s)`); }
      }
      // Fases.
      const pct = boss.hp / boss.maxHp, phases = boss.t.phases;
      for (let i = phases.length - 1; i > (boss.phaseIdx || 0); i--) if (pct <= phases[i].at) { this.applyBossPhase(boss, i); break; }
      // Invocações.
      if (boss.summon) { boss.summon.t -= dt; if (boss.summon.t <= 0) { boss.summon.t = boss.summon.every; const alive = this.enemies.filter(e => e.alive).length; const n = Math.min(boss.summon.n, 5 - alive); for (let k = 0; k < n; k++) this.enemies.push(this.makeEnemyUnit(boss.summon.id, boss.P * .55, { summoned:true })); if (n > 0) this.emit('onLog', { text:`${boss.name.split(',')[0]} invocou reforços!`, type:'boss' }); } }
    }

    // ---------- efeitos e atributos ----------
    eff(u, s) { return u.effects.filter(e => e.s === s).reduce((a, e) => a + e.v * (e.stack || 1), 0); }
    has(u, s) { return u.effects.some(e => e.s === s); }
    stat(u, k) {
      const st = u.st;
      switch (k) {
        case 'atk': return st.atk * Math.max(.2, 1 + this.eff(u, 'atk') - this.eff(u, 'weaken'));
        case 'def': return st.def * Math.max(0, 1 + this.eff(u, 'def') - this.eff(u, 'armorBreak'));
        case 'spd': return st.spd * Math.max(.25, 1 + this.eff(u, 'spd') - this.eff(u, 'slow'));
        case 'crit': return U.clamp(st.crit + this.eff(u, 'crit'), 0, .9);
        case 'critDmg': return st.critDmg + this.eff(u, 'critDmg');
        case 'dodge': return U.clamp(st.dodge + this.eff(u, 'dodge'), 0, .65);
        case 'lifesteal': return st.lifesteal + this.eff(u, 'lifesteal');
        case 'dr': return U.clamp(st.dr + this.eff(u, 'dr'), -.5, .8);
        default: return st[k] || 0;
      }
    }

    tickEffects(u, dt) {
      if (!u.alive) return;
      if (u.broken > 0) { u.broken -= dt; if (u.broken <= 0) { u.broken = 0; this.emit('onFx', { type:'text', uid:u.uid, text:'RECOMPOSTO', color:'#c9c4e6' }); } }
      if (u.shieldT > 0) { u.shieldT -= dt; if (u.shieldT <= 0) u.shield = 0; }
      let regen = u.st.regen + this.eff(u, 'regen');
      if (u.hooks?.lowRegen && u.hp / u.maxHp < .5) regen += Math.max(...u.hooks.lowRegen);
      if (regen > 0 && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * regen * dt);
      u.dotAcc = (u.dotAcc || 0) + dt;
      const tick = u.dotAcc >= 1; if (tick) u.dotAcc -= 1;
      for (const e of u.effects) {
        e.d -= dt;
        if (tick && DOTS.has(e.s) && u.alive) {
          let dmg = e.srcAtk * e.v * (e.stack || 1);
          if (u.boss && e.s === 'poison') dmg *= .6;
          dmg = Math.max(1, Math.round(dmg * (1 + this.eff(u, 'mark'))));
          this.applyRawDamage(u, dmg, e.src, { kind:'dot', color:D.statusInfo[e.s].color });
        }
      }
      u.effects = u.effects.filter(e => e.d > 0);
    }

    // ---------- ações ----------
    canAct(u) { return u.alive && !(u.broken > 0) && !u.effects.some(e => CC.has(e.s)); }
    actHero(u, i, dt) {
      if (!this.canAct(u)) return;
      const living = this.enemies.filter(e => e.alive); if (!living.length) return;
      u.atkCd -= dt * this.stat(u, 'spd');
      u.skillCd -= dt * (1 + u.st.cdr);
      const silenced = this.has(u, 'silence');
      if (!silenced && u.energy >= ULT_COST && this.state.settings.auto && this.shouldUlt(u)) { this.castUlt(i, false); return; }
      if (!silenced && u.skillCd <= 0) { if (this.shouldSkill(u, dt)) { this.castSkill(u); return; } }
      if (u.atkCd <= 0) { this.basicAttack(u); u.atkCd = 1.5; }
    }
    actEnemy(u, dt) {
      if (!this.canAct(u)) return;
      if (u.spawnT < .5) { u.spawnT += dt; return; }
      const living = this.party.filter(h => h.alive); if (!living.length) return;
      if (u.windup > 0) { u.windup -= dt; if (u.windup <= 0) { const sp = u.windupSpecial; u.windupSpecial = null; this.emit('onFx', { type:'bossBurst', uid:u.uid, color:u.color }); this.emit('onLog', { text:`${u.name.split(',')[0]} usou ${sp.name}!`, type:'boss' }); this.execute(u, sp.eff, { isSkill:true }); } return; }
      u.atkCd -= dt * this.stat(u, 'spd'); u.skillCd -= dt;
      for (const sp of u.specials || []) { sp.t -= dt; }
      const ready = (u.specials || []).find(sp => sp.t <= 0);
      if (ready && !this.has(u, 'silence')) { ready.t = ready.cd; u.windup = ready.windup; u.windupMax = ready.windup; u.windupSpecial = ready; this.emit('onFx', { type:'bossWindup', uid:u.uid, time:ready.windup }); this.emit('onWarn', `${u.name.split(',')[0]} prepara ${ready.name}!`); return; }
      if (u.t.skill && u.skillCd <= 0 && !this.has(u, 'silence')) { u.skillCd = u.t.skill.cd; this.emit('onFx', { type:'cast', source:u.uid, name:u.t.skill.name, color:u.color, enemy:true }); this.execute(u, u.t.skill.eff, { isSkill:true }); return; }
      if (u.atkCd <= 0 && !u.treasure) { u.atkCd = 1.5; const tgt = this.pickTarget(u); if (!tgt) return; this.emit('onFx', { type:'enemyAttack', source:u.uid, target:tgt.uid }); this.hit(u, tgt, 1, { kind:'basic', dodgeable:true }); }
    }

    shouldSkill(u, dt) {
      const effs = u.template.skill.eff, offensive = effs.some(e => OFFENSIVE.has(e.k));
      if (offensive) return true;
      const hurt = this.party.some(h => h.alive && h.hp / h.maxHp < .85) || this.enemies.some(e => e.windup > 0);
      u.skillHeld += dt;
      if (hurt || u.skillHeld > 6) { u.skillHeld = 0; return true; }
      return false;
    }
    shouldUlt(u) {
      const effs = u.template.ult.eff, offensive = effs.some(e => OFFENSIVE.has(e.k));
      if (effs.some(e => e.k === 'revive')) return this.party.some(h => !h.alive) || this.party.some(h => h.alive && h.hp / h.maxHp < .4);
      if (!offensive) { u.ultHeld += .016; return this.party.some(h => h.alive && h.hp / h.maxHp < .55) || this.enemies.some(e => e.windup > 0) || u.ultHeld > 8; }
      return true;
    }

    basicAttack(u) {
      const tgt = this.pickTarget(u); if (!tgt) return;
      u.counters.atk++;
      this.emit('onFx', { type:'attack', source:u.uid, target:tgt.uid, role:u.cls, color:u.color });
      const dealt = this.hit(u, tgt, 1, { kind:'basic', dodgeable:true });
      if (u.cleave) this.enemies.filter(e => e.alive && e !== tgt).forEach(e => this.hit(u, e, u.cleave, { kind:'proc' }));
      this.gainEnergy(u, 10);
      if (dealt >= 0 && tgt) {
        this.fire(u, 'onAtk', { target:tgt });
        (u.hooks.every || []).forEach(h => { if (u.counters.atk % h.n === 0) this.execute(u, h.eff, { target:tgt, proc:true }); });
      }
    }
    castSkill(u) {
      const t = u.template;
      u.skillCd = t.skill.cd;
      this.emit('onFx', { type:'cast', source:u.uid, name:t.skill.name, color:u.color, kind:t.skill.fx });
      this.execute(u, t.skill.eff, { isSkill:true });
      this.fire(u, 'onSkill', {});
      this.emit('onState');
    }
    castUlt(i, manual = true) {
      const u = this.party[i];
      if (!u || !u.alive || !this.active || this.phase !== 'fight' || this.pendingRoute || this.pendingEncounter || u.energy < ULT_COST || this.has(u, 'silence') || !this.canAct(u)) return false;
      if (!this.enemies.some(e => e.alive)) return false;
      u.energy = 0; u.ultHeld = 0;
      this.state.stats.ults++; this.count('ults');
      if (manual) { this.state.stats.manualUlts++; }
      this.emit('onFx', { type:'cast', source:u.uid, heroIndex:i, manual, ult:true, name:u.template.ult.name, color:u.color, kind:'ult' });
      // Elo Kizuna: ultimates de heróis diferentes em sequência rápida se fortalecem.
      this.ultChain = this.zoneElapsed - this.lastUltAt <= CHAIN.window + 1e-6 && this.lastUltHero !== i ? this.ultChain + 1 : 1;
      this.lastUltAt = this.zoneElapsed; this.lastUltHero = i; this.chainBonus = (this.ultChain - 1) * (CHAIN.per + (u.st.chainPow || 0));
      if (this.ultChain > 1) { this.emit('onFx', { type:'chain', n:this.ultChain, uid:u.uid, color:u.color }); this.state.stats.chains = Math.max(this.state.stats.chains || 0, this.ultChain); }
      this.execute(u, u.template.ult.eff, { isUlt:true, manual });
      this.chainBonus = 0;
      if (this.ultChain >= CHAIN.finale) this.kizunaFinale();
      this.fire(u, 'onUlt', {});
      this.emit('onFx', { type:'hitstop', time:manual ? .12 : .06 });
      this.emit('onState');
      return true;
    }
    useSkill(i, manual = true) { return this.castUlt(i, manual); }
    // Quatro ultimates encadeadas: toda a equipe ataca junta todos os inimigos.
    kizunaFinale() {
      this.ultChain = 0; this.lastUltAt = -99; this.lastUltHero = -1;
      this.emit('onFx', { type:'finale' }); this.emit('onLog', { text:'ELO KIZUNA! A equipe inteira golpeia junta.', type:'skill' });
      this.party.filter(h => h.alive).forEach(h => this.enemies.filter(e => e.alive).forEach(e => this.hit(h, e, CHAIN.finaleMult, { kind:'ult', pierce:.3 })));
      this.emit('onFx', { type:'hitstop', time:.18 });
    }
    // Quebra de postura: dano em elites/chefes enche a barra; cheia, o inimigo fica atordoado e vulnerável.
    addBreak(src, tg, final, kind, em) {
      if (src.side !== 'hero' || tg.side !== 'enemy' || !(tg.elite || tg.boss || tg.miniboss || tg.guardian) || tg.broken > 0 || !tg.alive) return;
      tg.breakG += final / tg.maxHp * 100 * BREAK.gain * (BREAK.kindMult[kind] || 1) * (em === 1.3 ? 1.5 : 1) * (1 + (src.st.breakPow || 0));
      if (tg.breakG < tg.breakMax) return;
      tg.breakG = 0; tg.breakMax *= BREAK.grow; tg.broken = BREAK.time;
      const canceled = !!tg.windupSpecial; tg.windup = 0; tg.windupSpecial = null;
      this.state.stats.breaks = (this.state.stats.breaks || 0) + 1;
      this.emit('onFx', { type:'break', uid:tg.uid, canceled, color:tg.color });
      this.emit('onLog', { text:`${tg.name.split(',')[0]} teve a postura QUEBRADA${canceled ? ' e perdeu o ataque preparado' : ''}!`, type:'skill' });
    }

    // ---------- alvos ----------
    opponents(u) { const list = (u.side === 'hero' ? this.enemies : this.party).filter(x => x.alive); const vis = list.filter(x => !this.has(x, 'stealth')); return vis.length ? vis : list; }
    allies(u) { return (u.side === 'hero' ? this.party : this.enemies).filter(x => x.alive); }
    pickTarget(u) {
      const opp = this.opponents(u); if (!opp.length) return null;
      const taunters = opp.filter(x => this.has(x, 'taunt'));
      if (taunters.length) return U.pick(taunters);
      if (u.side === 'hero') {
        const f = this.focusUid && opp.find(e => e.uid === this.focusUid); if (f) return f;
        if (u.cls === 'Executor') return opp.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (u.cls === 'Atirador') return opp.slice().sort((a, b) => (b.elite || b.boss) - (a.elite || a.boss) || b.hp - a.hp)[0];
        return opp[0];
      }
      return U.weighted(opp, h => (h.row === 'front' ? 3 : 1) * (h.cls === 'Vanguarda' ? 2 : 1));
    }
    resolve(u, to, ctx, supportive) {
      const opp = this.opponents(u), own = this.allies(u);
      const pool = supportive ? own : opp;
      switch (to) {
        case 'tgt': return supportive ? [u] : [ctx.target?.alive ? ctx.target : this.pickTarget(u)].filter(Boolean);
        case 'all': return supportive ? own : opp;
        case 'allies': return own;
        case 'self': return [u];
        case 'low': return pool.length ? [pool.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]] : [];
        case 'high': return pool.length ? [pool.slice().sort((a, b) => b.hp - a.hp)[0]] : [];
        case 'rand': case 'randEach': return pool.length ? [U.pick(pool)] : [];
        case 'back': { const back = pool.filter(x => x.side === 'hero' ? x.row === 'back' : this.enemies.indexOf(x) >= 2); return back.length ? (supportive ? back : [U.pick(back)]) : (pool.length ? [U.pick(pool)] : []); }
        case 'front': { const front = pool.filter(x => x.side === 'hero' ? x.row === 'front' : this.enemies.indexOf(x) < 2); return front.length ? front : pool; }
        case 'attacker': return ctx.attacker?.alive ? [ctx.attacker] : [];
        case 'lowAlly': return own.length ? [own.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]] : [];
        case 'atkAlly': { const others = own.filter(x => x !== u); return others.length ? [others.sort((a, b) => this.stat(b, 'atk') - this.stat(a, 'atk'))[0]] : [u]; }
        default: return [];
      }
    }

    // ---------- execução de efeitos ----------
    execute(u, effs, ctx = {}) {
      let dealt = 0;
      const kind = ctx.isUlt ? 'ult' : ctx.isSkill ? 'skill' : 'proc';
      for (const e of effs || []) {
        if (!u.alive && e.k !== 'revive') break;
        const supportive = !(e.k === 'dmg' || e.k === 'st' || e.k === 'dispel' || e.k === 'delay' || e.k === 'execute' || e.k === 'chain' || (e.k === 'nrg' && e.v < 0));
        if (e.k === 'dmg') {
          const hits = e.hits || 1;
          for (let h = 0; h < hits; h++) {
            const targets = this.resolve(u, e.to, ctx, false);
            targets.forEach(tg => { dealt += Math.max(0, this.hit(u, tg, e.m, { kind, manual:ctx.manual, pierce:e.pierce, crit:e.crit, exec:e.exec, dodgeable:e.to !== 'all' && kind === 'proc' })); });
            if (targets.length) ctx.target = ctx.target || targets[0];
          }
          if (kind !== 'proc') this.emit('onFx', { type:e.to === 'all' ? 'aoe' : 'burst', source:u.uid, target:(ctx.target || {}).uid, color:u.color });
          continue;
        }
        const targets = this.resolve(u, e.to || 'self', ctx, supportive);
        switch (e.k) {
          case 'st': targets.forEach(tg => this.applyStatus(u, tg, e)); break;
          case 'heal': targets.forEach(tg => this.heal(u, tg, (e.p ? tg.maxHp * e.p : this.stat(u, 'atk') * e.m) * (ctx.isSkill ? 1 + (u.st.skillMastery || 0) : 1) * (ctx.isUlt && ctx.manual ? 1.25 : 1))); break;
          case 'shield': targets.forEach(tg => { const amt = (e.p ? tg.maxHp * e.p : this.stat(u, 'atk') * e.m) * (1 + (u.st.healPow || 0)) * (ctx.isUlt && ctx.manual ? 1.25 : 1); tg.shield = Math.min(tg.maxHp * .7, tg.shield + amt); tg.shieldT = Math.max(tg.shieldT, e.d || 6); this.emit('onFx', { type:'shield', uid:tg.uid, value:Math.round(amt) }); }); break;
          case 'buff': targets.forEach(tg => this.addEffect(tg, { s:e.s, v:e.v, d:e.d, stackMax:e.stack, src:u })); break;
          case 'nrg': targets.forEach(tg => { if (tg.side === 'hero') tg.energy = U.clamp(tg.energy + e.v, 0, ULT_COST); }); break;
          case 'cleanse': targets.forEach(tg => { tg.effects = tg.effects.filter(x => !DEBUFFS.has(x.s)); this.emit('onFx', { type:'text', uid:tg.uid, text:'PURIFICADO', color:'#bff4ff' }); }); break;
          case 'taunt': this.addEffect(u, { s:'taunt', v:1, d:e.d, src:u }); break;
          case 'drain': if (dealt > 0) this.heal(u, u, dealt * e.v, true); break;
          case 'revive': { const dead = (u.side === 'hero' ? this.party : this.enemies).find(x => !x.alive && !x.fled); if (dead) { dead.alive = true; dead.hp = Math.round(dead.maxHp * e.p); dead.effects = []; this.emit('onFx', { type:'revive', uid:dead.uid }); this.emit('onLog', { text:`${dead.name} foi revivido!`, type:'skill' }); } break; }
          case 'cdr': targets.forEach(tg => { tg.skillCd = Math.max(0, tg.skillCd - e.v); }); break;
          case 'cdreset': u.skillCd = 0; break;
          // Remove escudos e bônus do alvo.
          case 'dispel': targets.forEach(tg => { tg.shield = 0; tg.effects = tg.effects.filter(x => DEBUFFS.has(x.s)); this.emit('onFx', { type:'text', uid:tg.uid, text:'DISSIPADO', color:'#bff4ff' }); }); break;
          // Atrasa as habilidades (e ataques preparados) do alvo.
          case 'delay': targets.forEach(tg => { tg.skillCd = (tg.skillCd || 0) + e.v; (tg.specials || []).forEach(sp => { sp.t += e.v; }); if (tg.windup > 0) tg.windup += e.v * .5; }); break;
          // Finaliza quem está abaixo do limite de HP (chefes e chefes de andar resistem).
          case 'execute': targets.forEach(tg => { if (!tg.boss && !tg.miniboss && tg.alive && tg.hp / tg.maxHp <= e.th) { this.emit('onFx', { type:'text', uid:tg.uid, text:'EXECUTADO', color:'#ff5d6c' }); this.applyRawDamage(tg, tg.hp + tg.shield + 1, u, { kind:'skill' }); } }); break;
          // Dano que salta entre inimigos, perdendo força a cada salto.
          case 'chain': { let m = e.m, last = null; const pool = this.opponents(u); for (let j = 0; j < (e.n || 3) && pool.some(x => x.alive); j++) { const opts = pool.filter(x => x.alive && x !== last); const tg = j === 0 && ctx.target?.alive ? ctx.target : opts.length ? U.pick(opts) : null; if (!tg) break; dealt += Math.max(0, this.hit(u, tg, m, { kind })); last = tg; m *= (e.fall || .7); } break; }
          case 'hp': u.hp = Math.max(1, u.hp + u.maxHp * e.p); this.emit('onFx', { type:'damage', uid:u.uid, value:Math.round(-u.maxHp * e.p), side:u.side, color:'#ff9aa4' }); break;
        }
      }
      return dealt;
    }

    addEffect(tg, e) {
      if (!tg.alive) return;
      const ex = tg.effects.find(x => x.s === e.s && x.src === e.src);
      if (ex) { ex.d = Math.max(ex.d, e.d); if (e.stackMax) ex.stack = Math.min(e.stackMax, (ex.stack || 1) + 1); else ex.v = Math.max(ex.v, e.v); return; }
      tg.effects.push({ s:e.s, v:e.v, d:e.d, src:e.src, stack:e.stackMax ? 1 : undefined, srcAtk:e.srcAtk });
    }

    applyStatus(src, tg, e) {
      if (!tg.alive || U.random() > (e.ch ?? 1)) return;
      let d = e.d;
      if (tg.boss && (CC.has(e.s) || e.s === 'silence')) d *= .4;
      else if ((tg.miniboss || tg.elite) && CC.has(e.s)) d *= .7;
      if (tg.treasure && CC.has(e.s)) d *= .5;
      if (DOTS.has(e.s)) {
        const srcAtk = this.stat(src, 'atk') * (1 + (src.st.dot || 0));
        if (e.s === 'poison') { const ex = tg.effects.find(x => x.s === 'poison'); if (ex) { ex.stack = Math.min(5, (ex.stack || 1) + 1); ex.d = Math.max(ex.d, d); ex.srcAtk = Math.max(ex.srcAtk, srcAtk); return; } tg.effects.push({ s:'poison', v:e.v, d, src, stack:1, srcAtk }); }
        else { const ex = tg.effects.find(x => x.s === e.s && x.src === src); if (ex) { ex.d = Math.max(ex.d, d); ex.srcAtk = srcAtk; ex.v = Math.max(ex.v, e.v); } else tg.effects.push({ s:e.s, v:e.v, d, src, srcAtk }); }
      } else this.addEffect(tg, { s:e.s, v:e.v, d, src });
      if (CC.has(e.s)) this.emit('onFx', { type:'text', uid:tg.uid, text:D.statusInfo[e.s].name.toUpperCase(), color:D.statusInfo[e.s].color });
    }

    gainEnergy(u, v) { if (u.side !== 'hero' || !u.alive) return; u.energy = Math.min(ULT_COST, u.energy + v * (1 + (u.st.nrg || 0))); }

    elemMult(a, b) {
      const A = D.elements[a], B = D.elements[b];
      if (A?.strong.includes(b)) return 1.3;
      if (B?.strong.includes(a)) return .8;
      return 1;
    }

    hit(src, tg, mult, o = {}) {
      if (!tg || !tg.alive) return -1;
      if (o.dodgeable && U.random() < this.stat(tg, 'dodge')) {
        this.emit('onFx', { type:'text', uid:tg.uid, text:'ESQUIVA', color:'#9ce9cc' });
        this.fire(tg, 'onDodge', { attacker:src });
        return -1;
      }
      let raw = this.stat(src, 'atk') * mult;
      if (o.kind === 'skill' || o.kind === 'ult') raw *= 1 + (src.st.skill || 0);
      if (o.kind === 'skill') raw *= 1 + (src.st.skillMastery || 0);
      if (o.kind === 'ult') raw *= 1 + (src.st.ultDmg || 0);
      if (o.kind === 'ult' && o.manual) raw *= 1.25; // comando manual: ultimate no momento certo rende mais
      if (o.kind === 'ult' && this.chainBonus) raw *= 1 + this.chainBonus;
      if (tg.broken > 0) raw *= 1 + BREAK.dmg;
      if (src.side === 'hero' && tg.worldBoss && this.opts.ally) raw *= 1 + Math.min(.5, this.opts.ally * .02); // Bênção da Aliança
      const critChance = this.stat(src, 'crit') + (o.crit || 0);
      const crit = U.random() < critChance;
      if (crit) raw *= this.stat(src, 'critDmg') + (this.has(tg, 'bleed') ? .1 : 0);
      const em = this.elemMult(src.el, tg.el); raw *= em === 1.3 ? 1.3 + (src.st.elem || 0) : em;
      (src.hooks?.vs || []).forEach(v => { if (this.has(tg, v.s)) raw *= 1 + v.v; });
      if (tg.boss || tg.miniboss) raw *= 1 + (src.st.boss || 0);
      if (src.side === 'hero' && tg.side === 'enemy') { const rl = this.research(tg.id); if (rl) raw *= 1 + rl * D.RESEARCH.dmg; }
      if (o.exec) raw *= 1 + o.exec * (1 - tg.hp / tg.maxHp);
      if (this.has(tg, 'freeze')) raw *= 1.2;
      const pierce = Math.min(1, (o.pierce || 0) + (src.st.pierce || 0));
      const def = this.stat(tg, 'def') * (1 - pierce);
      raw *= 1 - def / (def + 2.2 * (src.st.baseAtk || src.st.atk));
      raw *= (1 + this.eff(tg, 'mark')) * (1 - this.stat(tg, 'dr'));
      if (src.side === 'hero' && this.stageMods.atk) raw *= 1 + this.stageMods.atk;
      if (tg.side === 'hero' && this.stageMods.dr) raw *= 1 - this.stageMods.dr;
      raw *= U.rand(.92, 1.08);
      const dmg = Math.max(1, Math.round(raw));
      const final = this.applyRawDamage(tg, dmg, src, { crit, kind:o.kind, elem:em, broken:tg.broken > 0 });
      this.addBreak(src, tg, final, o.kind, em);
      if (o.kind !== 'dot' && tg.thorns > 0 && src.alive) this.applyRawDamage(src, Math.max(1, Math.round(final * tg.thorns)), tg, { kind:'thorns', color:'#d8ad6a' });
      const ls = this.stat(src, 'lifesteal');
      if (ls > 0 && o.kind !== 'dot') this.heal(src, src, final * ls, true);
      if (crit) this.fire(src, 'onCrit', { target:tg });
      if (crit && src.side === 'hero') this.emit('onFx', { type:'hitstop', time:.04 });
      return final;
    }

    applyRawDamage(tg, dmg, src, o = {}) {
      if (!tg.alive) return 0;
      let rest = dmg;
      if (tg.shield > 0) { const ab = Math.min(tg.shield, rest); tg.shield -= ab; rest -= ab; if (tg.side === 'hero') this.emit('onFx', { type:'shieldHit', uid:tg.uid }); }
      tg.hp -= rest;
      if (tg.worldBoss) { if (src?.side === 'hero') this.wbDamage = (this.wbDamage || 0) + dmg; if (tg.hp < tg.maxHp * .05) tg.hp = tg.maxHp * .05; }
      this.emit('onFx', { type:'damage', uid:tg.uid, value:dmg, crit:o.crit, side:tg.side, kind:o.kind, color:o.color || (o.elem === 1.3 ? '#ffe28a' : o.elem === .8 ? '#aab4c8' : null), weak:o.elem === 1.3, resist:o.elem === .8 });
      if (tg.side === 'hero' && src) { this.gainEnergy(tg, 3 + 40 * dmg / tg.maxHp); }
      if (o.kind !== 'dot' && o.kind !== 'thorns' && src) this.fire(tg, 'onHurt', { attacker:src });
      if (tg.hp <= 0) this.kill(tg, src);
      else {
        (tg.hooks?.low || []).forEach((h, idx) => { const key = `low${idx}`; if (tg.hp / tg.maxHp < h.th && !tg.flags[key] && !(h.once && tg.flags[`${key}once`])) { tg.flags[key] = true; if (h.once) tg.flags[`${key}once`] = true; this.execute(tg, h.eff, {}); this.emit('onFx', { type:'text', uid:tg.uid, text:'DESPERTAR!', color:'#ffd76a' }); } });
        if (tg.side === 'hero') this.party.forEach(al => { if (al === tg || !al.alive) return; (al.hooks.allyLow || []).forEach(h => { if (tg.hp / tg.maxHp < h.th && !al.flags.allyLowWave) { al.flags.allyLowWave = true; this.execute(al, h.eff, { target:tg }); } }); });
      }
      return dmg;
    }

    heal(src, tg, amount, silent = false) {
      if (!tg.alive) return 0;
      const amt = Math.round(amount * (silent ? 1 : 1 + (src.st.healPow || 0)));
      const real = Math.min(tg.maxHp - tg.hp, amt); tg.hp += real;
      if (!silent || real > tg.maxHp * .03) this.emit('onFx', { type:'heal', uid:tg.uid, value:real, color:'#7dffa8' });
      return real;
    }

    kill(tg, killer) {
      const phoenix = tg.hooks?.phoenix && !tg.flags.phoenixUsed;
      if (phoenix) { tg.flags.phoenixUsed = true; tg.hp = Math.round(tg.maxHp * Math.max(...tg.hooks.phoenix)); this.emit('onFx', { type:'revive', uid:tg.uid }); this.emit('onLog', { text:`${tg.name} renasceu das cinzas!`, type:'skill' }); return; }
      tg.alive = false; tg.hp = 0; tg.shield = 0; tg.effects = [];
      if (tg.side === 'hero') { this.emit('onFx', { type:'heroDown', uid:tg.uid }); this.emit('onLog', { text:`${tg.name} foi nocauteado!`, type:'enemy' }); return; }
      this.emit('onFx', { type:'death', uid:tg.uid, boss:tg.boss });
      if (this.focusUid === tg.uid) this.focusUid = null;
      if (killer?.side === 'hero') {
        this.fire(killer, 'onKill', { target:tg });
      }
      if (tg.rival) return;
      this.rewardKill(tg);
    }

    fire(u, hook, ctx) {
      if (!u?.alive || !u.hooks) return;
      (u.hooks[hook] || []).forEach(h => { if (h.ch !== undefined && U.random() > h.ch) return; this.execute(u, h.eff, { ...ctx, proc:true }); });
    }

    // ---------- consumíveis em combate ----------
    usePotion() {
      if (!this.active || this.phase !== 'fight' || this.potionCd > 0 || (this.state.consumables.potion || 0) < 1) return false;
      this.state.consumables.potion--; this.potionCd = 20;
      this.party.forEach(u => { if (u.alive) this.heal(u, u, u.maxHp * .35, true); this.emit('onFx', { type:'heal', uid:u.uid, value:0, color:'#7dffa8' }); });
      this.emit('onLog', { text:'Poção de Cura usada: +35% HP na equipe.', type:'skill' }); this.emit('onState'); return true;
    }
    useElixir() {
      if (!this.active || this.phase !== 'fight' || this.elixirCd > 0 || (this.state.consumables.elixir || 0) < 1) return false;
      this.state.consumables.elixir--; this.elixirCd = 30;
      this.party.forEach(u => this.gainEnergy(u, 50 / (1 + (u.st.nrg || 0))));
      this.emit('onLog', { text:'Elixir de Energia: +50 de energia para a equipe.', type:'skill' }); this.emit('onState'); return true;
    }
    setFocus(uid) { const e = this.enemies.find(x => x.uid === uid && x.alive); this.focusUid = e && this.focusUid !== uid ? uid : null; return this.focusUid; }

    // ---------- resultado de onda / estágio ----------
    checkOutcome() {
      if (this.phase !== 'fight') return;
      if (this.zone.kind === 'worldboss') { if (!this.party.some(u => u.alive)) this.wbFinish(); return; }
      if (this.zone.kind === 'arena') { if (!this.party.some(u => u.alive)) this.arenaEnd(false); else if (!this.enemies.some(e => e.alive)) this.arenaEnd(true); return; }
      if (!this.party.some(u => u.alive)) { this.onDefeat(); return; }
      if (this.enemies.some(e => e.alive)) return;
      const z = this.zone;
      if (z.kind === 'hunt') {
        if (this.wave < 4) {
          this.gather();
          this.party.forEach(u => { if (u.alive) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * .08); });
          const chance = (.1 + (activeEvent(this.now()).mods?.encounter ? .1 : 0));
          if (this.wave === 2 && !this.encounterUsed && U.random() < chance) { this.encounterUsed = true; this.triggerEncounter(); return; }
          this.phase = 'between'; this.timer = 1.1;
        } else this.stageClear();
      } else if (z.kind === 'dungeon') {
        this.gather();
        this.party.forEach(u => { if (u.alive) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * .1); });
        if (this.room < 5) { this.phase = 'between'; this.timer = 1.4; }
        else this.floorClear();
      } else if (z.kind === 'rift') {
        this.party.forEach(u => { if (u.alive) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * .06); });
        if (this.room < D.RIFT.rooms) { this.phase = 'between'; this.timer = 1.2; }
        else this.riftClear();
      } else if (z.kind === 'boss') this.bossClear();
    }
    riftClear() {
      const z = this.zone, p = this.state.progress.rift, floor = this.opts.floor, P = zonePower(z, { floor }), ilvl = itemLevelFor(z, { floor });
      const first = floor > (p.best || 0);
      const items = U.random() < .5 + Math.min(.4, floor * .01) ? [this.drop('chest', z, ilvl, this.mod('drop'))] : [];
      const mutGold = 1 + (this.riftMutation(floor).reward?.gold || 0);
      const rewards = { gold:Math.round(260 * Math.pow(P, .85) * mutGold), ore:2 + Math.floor(floor / 4), crystal:first ? 1 + Math.floor(floor / 5) : 0, keys:first && floor % 5 === 0 ? (floor % 10 === 0 ? 2 : 1) : 0, items };
      if (first) p.best = floor;
      this.grant(rewards); this.dropMats('rift');
      this.state.stats.floors++; this.count('floors');
      this.emit('onStageClear', { zone:z, stage:floor, first, rewards, rift:true });
      this.phase = 'stageClear'; this.timer = 1.8;
      this.nextStage = this.state.settings.autoAdvance ? floor + 1 : floor;
      this.endSegment('clear');
    }

    stageClear() {
      const z = this.zone, p = this.state.progress[z.id], stage = this.opts.stage;
      this.state.stats.stages++; this.count('stages');
      const first = stage > (p.best || 0);
      const rewards = { gold:0, crystal:0, keys:0, items:[] };
      if (first) {
        p.best = stage;
        rewards.crystal = 2 + stage + (z.chapter - 1) * 6;
        rewards.gold = Math.round(120 * zonePower(z, { stage }));
        if (stage === z.stages && !z.side) rewards.keys = 1;
        else if (stage % 4 === 0) rewards.keys = 1;
        if (stage === z.stages) rewards.items.push(this.drop('guardian', z, itemLevelFor(z, { stage }) + 1, .5));
        this.grant(rewards);
      }
      this.emit('onStageClear', { zone:z, stage, first, rewards });
      this.phase = 'stageClear'; this.timer = 1.8;
      this.nextStage = this.state.settings.autoAdvance ? Math.min(z.stages, stage + 1) : stage;
      this.endSegment('clear');
    }
    afterStageClear() {
      const p = this.state.progress[this.zone.id], key = this.zone.kind === 'rift' ? 'floor' : 'stage';
      this.opts[key] = this.nextStage || this.opts[key]; p.cur = this.opts[key];
      this.startRun();
    }
    floorClear() {
      const z = this.zone, p = this.state.progress[z.id], floor = this.opts.floor, ilvl = itemLevelFor(z, { floor });
      const first = floor > (p.best || 0);
      const items = [this.drop('chest', z, ilvl, this.mod('drop'))];
      if (this.state.routeChoice === 'risk') items.push(this.drop('chest', z, ilvl, this.mod('drop')));
      this.dropMats('chest');
      const rewards = { gold:Math.round(320 * zonePower(z, { floor })), crystal:first ? 12 + floor * 8 : 0, keys:first && floor === z.floors ? 1 : (U.random() < .01 ? 1 : 0), items };
      if (first) p.best = floor;
      this.grant(rewards);
      this.state.stats.floors++; this.count('floors');
      this.state.routeChoice = null;
      this.showResult({ kind:'dungeon', zone:z, floor, first, rewards, loot:this.runLoot.slice(), gold:this.runGold, xp:this.runXp });
      this.endSegment('clear');
    }
    // Vitórias com espólio que ainda restam hoje contra este chefe nesta dificuldade.
    bossLootLeft(zoneId = this.zone.id, tier = this.opts.tier || 0) {
      const b = this.state.bossLoot || (this.state.bossLoot = { date:'', n:{} }), key = dayKey(this.now());
      if (b.date !== key) { b.date = key; b.n = {}; }
      return Math.max(0, BOSS_LOOT_PER_DAY - (b.n[`${zoneId}:${tier}`] || 0));
    }
    bossClear() {
      const z = this.zone, p = this.state.progress[z.id], tier = this.opts.tier || 0, tr = D.bossTiers[tier];
      const firstKill = (p.kills || 0) === 0, loot = firstKill || this.bossLootLeft(z.id, tier) > 0;
      p.kills = (p.kills || 0) + 1; p.tierKills[tier] = (p.tierKills[tier] || 0) + 1;
      this.state.stats.bossKills++;
      if (loot) this.state.bossLoot.n[`${z.id}:${tier}`] = (this.state.bossLoot.n[`${z.id}:${tier}`] || 0) + 1;
      const ilvl = itemLevelFor(z, this.opts);
      const items = loot ? [this.drop('boss', z, ilvl, this.mod('drop') + tier * .5)] : [];
      if (loot && tier > 0) items.push(this.drop('boss', z, ilvl, .5 + tier * .5));
      if (loot) this.dropMats('boss');
      else this.emit('onToast', `<b>Espólio de hoje esgotado</b> contra ${esc(D.enemies[z.enemy].name.split(',')[0])}: a vitória rende só ouro e EXP até a meia-noite (Brasília).`);
      const rewards = { gold:Math.round(2000 * zonePower(z, this.opts) / 3 * tr.reward * (loot ? 1 : .4)), crystal:loot ? Math.round((firstKill ? 80 : 6) * tr.reward) : 0, keys:!loot ? 0 : z.id === 'boss_event' ? (U.random() < .5 ? 1 : 0) : firstKill ? 1 : (U.random() < .08 * tr.reward ? 1 : 0), items };
      this.grant(rewards);
      if (firstKill && D.story.bossWin[z.id]) this.emit('onDialog', D.story.bossWin[z.id]);
      this.showResult({ kind:'boss', zone:z, tier, first:firstKill, lootLocked:!loot, lootLeft:this.bossLootLeft(z.id, tier), rewards, boss:D.enemies[z.enemy].name, loot:this.runLoot.slice(), gold:this.runGold, xp:this.runXp });
      this.endSegment('clear');
    }
    showResult(r) {
      this.phase = 'result'; this.timer = 5; this.lastResult = r;
      this.emit('onResult', r);
      if (this.state.settings.autoRepeat && r.kind !== 'defeat') this.autoAfterResult = () => this.repeatRun();
      else if (r.kind === 'defeat') this.autoAfterResult = () => this.fallbackToHunt();
      if (r.kind === 'defeat') this.timer = 8;
    }
    repeatRun() { this.emit('onResultClose'); this.runLoot = []; this.runGold = 0; this.runXp = 0; this.startRun(); }
    drop(src, zone, ilvl, luck = 0) { return I.rollDrop(src, zone, ilvl, luck, this.preferWT()); }
    preferWT() { return [...new Set(this.heroes.flatMap(r => I.allowedWeaponTypes(r.id)).filter(w => w !== 'relic'))]; }
    fallbackToHunt() { this.emit('onResultClose'); const h = this.state.lastHunt || 'hunt'; this.enterZone(h, { stage:Math.max(1, this.state.progress[h].best || 1) }); }
    onDefeat() {
      this.state.stats.deaths++;
      const z = this.zone;
      const p = this.state.progress[z.id] || {};
      const lvl = z.kind === 'hunt' ? this.opts.stage : z.kind === 'boss' ? `t${this.opts.tier || 0}` : this.opts.floor;
      const frontier = z.kind === 'boss' ? !(p.tierKills?.[this.opts.tier || 0]) : (this.opts.stage || this.opts.floor) > (p.best || 0);
      this.trackStuck(`${z.id}:${lvl}`, frontier);
      if (z.kind === 'hunt' || z.kind === 'rift') {
        const key = z.kind === 'rift' ? 'floor' : 'stage', stage = this.opts[key], back = Math.max(1, stage - 1);
        this.phase = 'defeat'; this.timer = 3;
        this.nextStage = back;
        this.state.settings.autoAdvance = false;
        this.emit('onDefeatHunt', { stage, back, rift:z.kind === 'rift' });
        this.emit('onLog', { text:`A equipe caiu no ${z.kind === 'rift' ? 'andar' : 'estágio'} ${stage}. Recuando para o ${back} para treinar.`, type:'system' });
      } else {
        this.showResult({ kind:'defeat', zone:z, room:this.room, loot:this.runLoot.slice(), gold:this.runGold, xp:this.runXp });
      }
      this.endSegment('defeat');
    }
    afterDefeat() { const p = this.state.progress[this.zone.id], key = this.zone.kind === 'rift' ? 'floor' : 'stage'; this.opts[key] = this.nextStage; p.cur = this.nextStage; this.startRun(); }
    // Duas derrotas seguidas no mesmo desafio inédito → o Conselheiro aparece com um plano.
    trackStuck(key, frontier) {
      const st = this.state.stuck;
      if (!frontier) { st.key = ''; st.n = 0; return; }
      if (st.key === key) st.n++; else { st.key = key; st.n = 1; }
      if (st.n >= 2 && st.n % 2 === 0) this.emit('onStuck', { key, tips:this.advice() });
    }

    // ---------- encontros ----------
    triggerEncounter() {
      const enc = U.weighted(D.encounters, e => e.weight);
      this.state.stats.encounters++; this.count('encounters');
      const ilvl = itemLevelFor(this.zone, this.opts);
      if (enc.id === 'gold_fox') { this.enemies = [this.makeEnemyUnit('fox_gold', zonePower(this.zone, this.opts))]; this.phase = 'fight'; this.emit('onWave', { label:enc.name, detail:enc.text, special:true }); return; }
      if (enc.id === 'ambush') { const z = this.zone; const P = zonePower(z, this.opts) * 1.1; this.enemies = [z.elites[0], z.elites[1], U.pick(z.pool)].map(id => this.makeEnemyUnit(id, P, { ambush:true })); this.stageMods.drop = (this.stageMods.drop || 0) + .5; this.phase = 'fight'; this.emit('onWave', { label:enc.name, detail:enc.text, special:true }); return; }
      let options;
      if (enc.id === 'merchant') {
        const offers = [0, 1, 2].map(() => { const it = I.makeItem({ ilvl:ilvl + 1, rarity:U.random() < .08 ? 'legendary' : U.random() < .45 ? 'epic' : 'rare', prefer:this.preferWT() }); return { item:it, price:Math.round(I.itemScore(it) * 5 + 400 * zonePower(this.zone, this.opts)) }; });
        options = offers.map((o, i) => ({ id:`buy${i}`, label:`${o.item.name}`, desc:`${D.rarities.find(r => r.id === o.item.rarity).label} · Nível ${o.item.ilvl} · ${o.price.toLocaleString('pt-BR')} ouro`, item:o.item, price:o.price })).concat([{ id:'leave', label:'Seguir viagem', desc:'Não comprar nada.' }]);
      } else if (enc.id === 'shrine') options = D.blessings.map(b => ({ id:b.id, label:b.name, desc:b.text }));
      else options = [{ id:'open', label:'Abrir o baú', desc:'Pode conter tesouros... ou não.' }, { id:'leave', label:'Deixar para lá', desc:'Seguir em segurança.' }];
      this.pendingEncounter = { enc, options };
      this.offerChoice({ kind:'encounter', title:enc.name, text:enc.text, options });
    }
    resolveEncounter(id) {
      const pe = this.pendingEncounter; if (!pe) return;
      this.pendingEncounter = null; this.pendingChoice = null;
      const opt = pe.options.find(o => o.id === id);
      if (pe.enc.id === 'merchant' && opt?.item) {
        if (this.state.player.gold >= opt.price) { this.state.player.gold -= opt.price; opt.item.bound = true; this.addItem(opt.item); this.emit('onLoot', opt.item); this.emit('onToast', `Comprou ${opt.item.name}.`); }
        else this.emit('onToast', 'Ouro insuficiente.');
      } else if (pe.enc.id === 'shrine' && opt) {
        const b = D.blessings.find(x => x.id === id);
        if (b.stats) Object.entries(b.stats).forEach(([k, v]) => { this.stageMods[k] = (this.stageMods[k] || 0) + v; });
        if (b.mods?.drop) this.stageMods.drop = (this.stageMods.drop || 0) + b.mods.drop;
        if (b.instant === 'heal') this.party.forEach(u => { u.alive = true; u.hp = u.maxHp; u.effects = []; });
        this.emit('onToast', `${b.name} recebida.`);
      } else if (pe.enc.id === 'chest' && id === 'open') {
        if (U.random() < .3) { this.enemies = [this.makeEnemyUnit('mimic', zonePower(this.zone, this.opts))]; this.phase = 'fight'; this.emit('onWave', { label:'Era um Mímico!', detail:'O baú tinha dentes...', special:true }); this.emit('onWarn', 'Era um Mímico!'); return; }
        const it = this.drop('chest', this.zone, itemLevelFor(this.zone, this.opts) + 1, 1); this.addItem(it); this.emit('onLoot', it);
        const g = this.goldIn(200 * zonePower(this.zone, this.opts)); this.state.player.gold += g; this.emit('onToast', `O baú tinha ${it.name} e ${g.toLocaleString('pt-BR')} ouro!`);
      }
      this.phase = 'between'; this.timer = .8;
    }

    // ---------- recompensas ----------
    rewardKill(e) {
      const s = this.state, t = e.t;
      s.stats.kills++; this.count('kills');
      if (e.elite || e.boss) { s.stats.elites++; this.count('elites'); }
      const mult = (e.ambush ? 2 : 1) * (e.alpha ? 4 : 1) * (e.summoned ? .25 : 1);
      // Chefe já sem espólio hoje: a EXP também cai (antes rendia EXP cheia e virava o melhor farm do jogo).
      const lootOk = !e.boss || this.zone.kind !== 'boss' || this.bossLootLeft() > 0 || !(this.state.progress[this.zone.id]?.kills);
      if (e.alpha) s.stats.alphas = (s.stats.alphas || 0) + 1;
      if (s.bounty?.active && s.bounty.active.enemy === e.id) s.bounty.active.progress = Math.min(s.bounty.active.n, s.bounty.active.progress + 1);
      const research = this.research(e.id); s.bestiary[e.id] = (s.bestiary[e.id] || 0) + 1;
      if (this.research(e.id) > research) this.emit('onToast', `<b>Bestiário:</b> ${esc(t.name)}, pesquisa nível ${this.research(e.id)} (+${Math.round(this.research(e.id) * D.RESEARCH.dmg * 100)}% de dano contra ela).`);
      const gold = this.goldIn(U.randInt(t.gold[0], t.gold[1]) * Math.pow(e.P, .85) * (1 + this.mod('gold')) * mult * .8);
      const xp = Math.round(t.xp * Math.pow(e.P, .92) * (1 + this.mod('xp')) * mult * (lootOk ? 1 : .3));
      s.player.gold += gold; s.stats.goldEarned += gold; this.runGold += gold; this.runXp += xp;
      if (activeEvent(this.now()).mods?.dust) s.player.dust += U.random() < .3 ? 1 : 0;
      this.giveXp(xp, e.level);
      this.emit('onFx', { type:'reward', uid:e.uid, gold, xp });
      // Itens.
      const src = e.boss || e.summoned ? null : e.miniboss ? 'floorBoss' : e.alpha || e.guardian ? 'guardian' : e.elite ? 'elite' : e.treasure ? 'chest' : 'normal';
      if (src) {
        const chance = e.alpha ? 1 : { normal:.03, elite:.12, guardian:.25, floorBoss:1, chest:1 }[src] * (1 + this.mod('drop'));
        const n = 1;
        for (let i = 0; i < n; i++) if (U.random() < chance) { const it = this.drop(src, this.zone, itemLevelFor(this.zone, this.opts) + (e.alpha ? 2 : 0), this.mod('drop') + (activeEvent(this.now()).mods?.rarity || 0) + (e.alpha ? .8 : 0)); it.fromUid = e.uid; this.addItem(it); this.emit('onLoot', it); }
        if (U.random() < .07 * (e.elite ? 3 : 1)) { const c = U.random() < .5 ? 'ore' : 'dust'; s.player[c] += e.elite ? 2 : 1; }
        this.dropMats(src, e.alpha);
      }
      const card = I.cards.find(c => c.enemy === e.id);
      const cardMult = (1 + this.mod('drop')) * (e.boss ? 1 + (this.opts.tier || 0) : 1) * (e.alpha ? 3 : 1) * (1 + this.research(e.id) * D.RESEARCH.card);
      if (card && !e.summoned && lootOk && U.random() < card.chance * cardMult) { s.cards[card.id] = (s.cards[card.id] || 0) + 1; if (s.house) s.house.seen[card.id] = 1; s.stats.cards = (s.stats.cards || 0) + 1; this.emit('onCard', { card, mvp:card.mvp }); this.emit('onLog', { text:`${card.mvp ? 'MVP! ' : ''}Obteve ${card.name}!`, type:'reward' }); }
      if (e.boss) this.emit('onToast', `<b>MVP!</b> ${e.name.split(',')[0]} derrotado.`);
      if (e.treasure) { s.player.gold += gold * 4; this.emit('onToast', `Raposa Dourada derrotada: +${(gold * 5).toLocaleString('pt-BR')} ouro!`); }
    }
    // Materiais raros de refino: Aço Estelar (elites e chefes), Oricalco (chefes), Adamantina (chefes difíceis e eventos).
    dropMats(src, alpha = false) {
      const m = this.state.mats, tier = this.opts.tier || 0, deep = this.zone.kind === 'rift' ? (this.opts.floor || 1) : 0, got = {};
      const md = this.state.matDaily || (this.state.matDaily = { date:'', ori:0, adam:0 }), today = dayKey(this.now());
      if (md.date !== today) { md.date = today; md.ori = 0; md.adam = 0; }
      const give = (k, n) => {
        if (n > 0 && src !== 'boss' && DAILY_MAT_CAP[k] !== undefined) { n = Math.min(n, DAILY_MAT_CAP[k] - (md[k] || 0)); if (n > 0) md[k] = (md[k] || 0) + n; }
        if (n > 0) { m[k] = (m[k] || 0) + n; got[k] = (got[k] || 0) + n; }
      };
      const r = () => U.random();
      if (src === 'elite' && r() < .003) give('star', 1);
      if (src === 'guardian' && r() < (alpha ? .12 : .008)) give('star', 1);
      if (src === 'guardian' && r() < .0005) give('ori', 1);
      if (src === 'floorBoss') { if (r() < .12) give('star', 1); if (r() < .01) give('ori', 1); }
      if (src === 'boss') { give('star', 1 + (r() < .5 ? 1 : 0)); if (r() < .12 + tier * .08) give('ori', 1); if (tier >= 1 && r() < .02 * tier) give('adam', 1); }
      if (src === 'chest' && r() < .03) give('star', 1);
      if (src === 'rift') { if (r() < .06) give('star', 1); if (deep >= 10 && r() < .02) give('ori', 1); if (deep >= 25 && r() < .004) give('adam', 1); }
      Object.entries(got).forEach(([k, n]) => this.emit('onToast', `Material raro: <b>+${n} ${esc(Object.values(I.materials).find(x => x.key === k)?.name || k)}</b>!`));
      return got;
    }
    // ---------- Invasão Mundial ----------
    wbWindow(now = this.now()) {
      const l = new Date(now + D.EVENT_TZ_OFFSET_MIN * 60000), h = l.getUTCHours() + l.getUTCMinutes() / 60;
      const idx = D.worldBoss.windows.findIndex(w => h >= w.from && h < w.to);
      const day0 = Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()) - D.EVENT_TZ_OFFSET_MIN * 60000;
      const next = [0, 1].flatMap(d => D.worldBoss.windows.map((w, i) => ({ i, start:day0 + d * 86400000 + w.from * 3600000, end:day0 + d * 86400000 + w.to * 3600000 }))).find(w => w.end > now && w.start > now);
      return { active:idx >= 0, index:idx, end:idx >= 0 ? day0 + D.worldBoss.windows[idx].to * 3600000 : null, next, day:dayKey(now) };
    }
    wbBossId(now = this.now()) { return D.worldBoss.byDay[new Date(now + D.EVENT_TZ_OFFSET_MIN * 60000).getUTCDay()]; }
    zoneElapsedFight() { return this.bossTimer || 0; }
    wbFinish() {
      if (this.phase !== 'fight') return;
      const w = this.wbWindow(), dmg = Math.round(this.wbDamage || 0);
      this.state.worldBoss = { day:w.day, window:w.index, boss:this.wbBossId(), tier:this.opts.tier || 0, damage:dmg, claimed:false };
      this.state.stats.worldBoss = (this.state.stats.worldBoss || 0) + 1;
      this.showResult({ kind:'worldboss', zone:this.zone, tier:this.opts.tier || 0, damage:dmg, boss:D.enemies[this.wbBossId()].name, loot:[], gold:0, xp:0 });
      this.autoAfterResult = () => this.fallbackToHunt();
      this.endSegment('clear');
    }
    // Recompensa da Invasão (o servidor informa se a comunidade derrubou o chefe e a posição do jogador).
    grantWorldBoss(info = {}) {
      const w = this.state.worldBoss; if (!w || w.claimed || !w.day) return false;
      const tier = D.worldBoss.tiers[w.tier || 0], m = tier.reward * (info.killed ? 1.6 : 1) * (1 + Math.max(0, .5 - (info.pct ?? 1)) );
      const P = Math.max(1, this.farmPower());
      const r = { gold:Math.round(3000 * P * m), crystal:Math.round((info.killed ? 25 : 10) * tier.reward), items:[] };
      const g = this.state.mats;
      g.star += 1 + Math.floor(m); if (U.random() < .35 * m) g.ori += 1; if (U.random() < (info.killed ? .06 : .02) * tier.reward) g.adam += 1;
      const ilvl = Math.max(10, itemLevelFor(D.zones[this.state.lastHunt || 'hunt'], { stage:Math.max(1, this.state.progress[this.state.lastHunt || 'hunt']?.best || 1) }) + 4);
      const legChance = (info.killed ? .12 : .04) * tier.reward;
      r.items.push(I.makeItem({ ilvl, rarity:U.random() < legChance ? 'legendary' : U.random() < .5 ? 'epic' : 'rare', prefer:this.preferWT() }));
      if (info.killed && U.random() < .01 * tier.reward) r.items.push(I.makeItem({ unique:U.pick(I.uniques).id, ilvl }));
      const card = I.cardById(`card_${w.boss}`); if (card && info.killed && U.random() < .004 * tier.reward) { this.state.cards[card.id] = (this.state.cards[card.id] || 0) + 1; this.state.stats.cards = (this.state.stats.cards || 0) + 1; r.card = card.name; }
      w.claimed = true; w.reward = { gold:r.gold, crystal:r.crystal, items:r.items.map(i => i.name) };
      this.grant(r); return { ...w.reward, killed:!!info.killed };
    }

    // ---------- Expedições (AFK de verdade: contam pelo relógio do servidor) ----------
    expeditionSlots() { return Math.min(4, 1 + Math.floor((this.state.buildings.guild || 1) / 3)); }
    startExpedition(zoneId, hours, uids) {
      const z = D.zones[zoneId], s = this.state;
      if (!z || z.kind !== 'hunt' || this.zoneLock(zoneId).locked || !(s.progress[zoneId]?.best > 0)) { this.lastError = 'Escolha uma caçada já vencida ao menos uma vez.'; return false; }
      if (!D.expeditions.durations.includes(hours)) { this.lastError = 'Duração inválida.'; return false; }
      if (s.expeditions.length >= this.expeditionSlots()) { this.lastError = 'Todas as vagas de expedição estão ocupadas (melhore a Guilda para ter mais).'; return false; }
      uids = [...new Set(uids || [])].slice(0, D.expeditions.maxHeroes);
      const busy = new Set(s.expeditions.flatMap(x => x.uids));
      if (!uids.length || uids.some(u => !this.record(u) || s.formation.includes(u) || busy.has(u))) { this.lastError = 'Use heróis fora da equipe e que não estejam em outra expedição.'; return false; }
      s.expeditions.push({ id:U.uid('exp'), zone:zoneId, hours, uids, start:this.now() });
      this.emit('onState'); return true;
    }
    claimExpedition(id) {
      const s = this.state, i = s.expeditions.findIndex(x => x.id === id); if (i < 0) return false;
      const x = s.expeditions[i]; if (this.now() < x.start + x.hours * 3600000) { this.lastError = 'A expedição ainda não voltou.'; return false; }
      const z = D.zones[x.zone], P = zonePower(z, { stage:Math.max(1, s.progress[x.zone]?.best || 1) }), n = x.uids.length;
      const r = { gold:Math.round(700 * x.hours * Math.pow(P, .8) * n / 3), ore:x.hours * 2 * n, dust:x.hours * 3 * n, items:[] };
      // EXP de expedição: equivale a caçar a região em ritmo lento e nunca leva o herói além do nível dela.
      const zl = Math.min(HERO_LEVEL_CAP, enemyLevel(P));
      x.uids.forEach(uid => { const h = this.record(uid); if (!h || h.level >= zl) return; const amt = Math.round(x.hours * 540 * 14 * Math.pow(P, .92) * .15 * xpFactor(h.level, zl));
        this.gainHeroXp(h, Math.min(amt, this.xpToLevel(h, zl))); });
      for (let k = 0; k < Math.floor(x.hours / 2) * n; k++) r.items.push(I.rollDrop('normal', z, itemLevelFor(z, { stage:Math.max(1, s.progress[x.zone]?.best || 1) }), 0, this.preferWT()));
      if (U.random() < 1 - Math.pow(.97, x.hours * n)) s.mats.star += 1;
      s.expeditions.splice(i, 1); s.stats.expeditions = (s.stats.expeditions || 0) + 1;
      this.grant(r); return { gold:r.gold, ore:r.ore, dust:r.dust, items:r.items.map(it => it.name) };
    }

    // ---------- Quadro de Recompensas (caça a um monstro) ----------
    ensureBounties() {
      const b = this.state.bounty; if (b.offers?.length) return b.offers;
      const zones = Object.values(D.zones).filter(z => (z.kind === 'hunt' || z.kind === 'dungeon') && (this.state.progress[z.id]?.best || 0) > 0);
      const mons = [...new Set(zones.flatMap(z => z.pool || []))];
      if (!mons.length) return [];
      b.offers = Array.from({ length:3 }, () => { const id = U.pick(mons), n = U.pick([150, 250, 400, 600]); return { enemy:id, n, points:Math.round(n / 12) }; });
      return b.offers;
    }
    acceptBounty(i) { const b = this.state.bounty; if (b.active) { this.lastError = 'Conclua ou abandone a caçada atual.'; return false; } const o = this.ensureBounties()[i]; if (!o) return false; b.active = { ...o, progress:0 }; b.offers = []; this.emit('onState'); return true; }
    abandonBounty() { const b = this.state.bounty; if (!b.active) return false; b.active = null; b.offers = []; return true; }
    claimBounty() {
      const b = this.state.bounty; if (!b.active || b.active.progress < b.active.n) return false;
      const P = this.farmPower(); b.points += b.active.points; b.done++;
      this.grant({ gold:Math.round(b.active.n * 40 * Math.pow(P, .8)) }); const out = { points:b.active.points }; b.active = null; b.offers = [];
      return out;
    }
    buyBountyItem(id) {
      const o = D.bountyShop.find(x => x.id === id), b = this.state.bounty; if (!o || b.points < o.cost) return false;
      b.points -= o.cost; const g = o.give;
      if (g.star || g.ori) Object.entries(g).forEach(([k, v]) => { this.state.mats[k] += v; });
      if (g.luck) this.state.consumables.luck += g.luck;
      if (g.keys) this.state.player.keys += g.keys;
      if (g.box) { const hz = D.zones[this.state.lastHunt || 'hunt']; const bi = I.makeItem({ ilvl:itemLevelFor(hz, { stage:Math.max(1, this.state.progress[hz.id]?.best || 1) }), rarity:g.box, prefer:this.preferWT() }); bi.bound = true; this.addItem(bi); }
      this.emit('onState'); return true;
    }

    // ---------- Oficina: culinária e transmutação de materiais (limites diários) ----------
    recipes() {
      const w = this.state.buildings.workshop, d = 1 - Math.min(.4, (w - 1) * .05);
      return [
        { id:'potion', name:'Poção de Cura', give:{ potion:1 }, cost:{ gold:180, dust:3 } },
        { id:'elixir', name:'Elixir de Energia', give:{ elixir:1 }, cost:{ gold:300, dust:6 } },
        { id:'onigiri', name:'Onigiri do Viajante', give:{ onigiri:1 }, cost:{ gold:500, dust:8 } },
        { id:'ramen', name:'Ramen Picante', give:{ ramen:1 }, cost:{ gold:650, dust:10 } },
        { id:'tea', name:'Chá de Jasmim', give:{ tea:1 }, cost:{ gold:800, dust:12 } },
        { id:'star', name:'Transmutar Aço Estelar', give:{ star:1 }, cost:{ gold:20000, ore:60, dust:20 }, limit:3 },
        { id:'ori', name:'Transmutar Oricalco', give:{ ori:1 }, cost:{ gold:150000, star:6, dust:60 }, limit:1 }
      ].map(r => ({ ...r, cost:Object.fromEntries(Object.entries(r.cost).map(([k, v]) => [k, k === 'gold' || k === 'dust' ? Math.max(1, Math.round(v * d)) : v])) }));
    }
    craftedToday(id) { const c = this.state.crafted, key = dayKey(this.now()); if (c.date !== key) { c.date = key; c.n = {}; } return c.n[id] || 0; }
    have(k) { return k === 'gold' || k === 'dust' || k === 'ore' ? this.state.player[k] : k in (this.state.mats || {}) ? this.state.mats[k] : 0; }
    research(id) { const k = this.state.bestiary?.[id] || 0; return D.RESEARCH.levels.filter(n => k >= n).length; }
    researchTotal() { return Object.keys(this.state.bestiary || {}).reduce((a, id) => a + this.research(id), 0); }
    // enemyLv: nível dos inimigos que deram a EXP; kills: quantos abates ela representa (teto de 5% de nível por abate).
    giveXp(xp, enemyLv = 0, kills = 1) {
      const party = this.heroes; if (!party.length) return;
      const per = Math.max(1, Math.round(xp / party.length));
      const ups = [];
      party.forEach(r => {
        let amt = per * xpFactor(r.level, enemyLv);
        if (enemyLv && r.level < HERO_LEVEL_CAP) amt = Math.min(amt, heroXpNext(r.level) * XP_RULES.perKill * Math.max(1, kills));
        amt = Math.max(1, Math.round(amt));
        this.gainClassXp(r, Math.max(1, Math.round(amt * .20))); if (this.gainHeroXp(r, amt)) { const u = this.party.find(x => x.recUid === r.uid); this.emit('onFx', { type:'levelUp', uid:r.uid }); ups.push(`${this.template(r.id).name} Nv.${r.level}`); if (u) this.refreshUnit(u, r); } });
      if (ups.length) this.emit('onToast', `<b>Nível up!</b> ${ups.join(' · ')}, +${PR.ATTR_PER_LEVEL} pontos de atributo cada (Equipe → Ficha).`);
      // Só quem está na equipe ganha EXP de combate; heróis do banco evoluem apenas em expedições.
      this.gainAccountXp(Math.round(xp * .35));
    }
    gainHeroXp(r, amount) {
      if (r.level >= HERO_LEVEL_CAP) { r.level = HERO_LEVEL_CAP; r.xp = 0; this.gainParagonXp(amount); return false; }
      r.xp += amount; let up = false;
      while (r.level < HERO_LEVEL_CAP && r.xp >= heroXpNext(r.level)) { r.xp -= heroXpNext(r.level); r.level++; up = true; }
      if (r.level >= HERO_LEVEL_CAP && r.xp > 0) { this.gainParagonXp(r.xp); r.xp = 0; }
      return up;
    }
    // EXP que falta para o herói chegar ao nível lv (0 se já chegou).
    xpToLevel(r, lv) { let need = -(r.xp || 0); for (let l = r.level; l < Math.min(lv, HERO_LEVEL_CAP); l++) need += heroXpNext(l); return Math.max(0, need); }
    gainClassXp(r, amount) {
      r.classLevel = U.clamp(r.classLevel || 1, 1, PR.CLASS_LEVEL_CAP); if (r.classLevel >= PR.CLASS_LEVEL_CAP) { r.classXp = 0; return false; }
      r.classXp = (r.classXp || 0) + amount; let up = false;
      while (r.classLevel < PR.CLASS_LEVEL_CAP && r.classXp >= classXpNext(r.classLevel)) { r.classXp -= classXpNext(r.classLevel); r.classLevel++; up = true; }
      if (r.classLevel >= PR.CLASS_LEVEL_CAP) r.classXp = 0;
      return up;
    }
    // Paragão: a EXP recebida no nível 100 alimenta uma progressão longa da conta.
    gainParagonXp(amount) {
      const p = this.state.paragon || (this.state.paragon = { lv:0, xp:0 }); if (p.lv >= D.PARAGON.cap) return;
      p.xp += amount; let up = 0;
      while (p.lv < D.PARAGON.cap && p.xp >= D.PARAGON.next(p.lv)) { p.xp -= D.PARAGON.next(p.lv); p.lv++; up++; }
      if (up) { this.emit('onToast', `<b>Paragão ${p.lv}!</b> +${(D.PARAGON.per * 100).toFixed(1).replace('.', ',')}% de ATK, HP e DEF para toda a equipe.`); this.refreshPartyUnits(); }
    }
    refreshUnit(u, r) {
      const st = heroStats(this.state, r, this.ctx()); const ratio = u.hp / u.maxHp;
      u.st = st; u.maxHp = st.maxHp; u.hp = Math.round(st.maxHp * ratio); u.level = r.level;
    }
    gainAccountXp(xp) {
      const p = this.state.player; p.xp += xp;
      while (p.xp >= accountXpNext(p.level)) { p.xp -= accountXpNext(p.level); p.level++; p.crystal += 3; const k = p.level % 5 === 0 ? 1 : 0; p.keys += k; this.emit('onToast', `Conta nível ${p.level}! +3 cristais${k ? ' e 1 Chave de Convocação' : ''}.`); this.emit('onAccountLevel', p.level); }
    }
    // Torneira única de ouro: toda recompensa passa por aqui (base do jogo × ajuste do Tesouro Imperial).
    goldIn(n) { return Math.max(0, Math.round(n * D.ECON.faucet * U.clamp(Number(this.state.econ?.faucet) || 1, D.ECON.faucetMin, D.ECON.faucetMax))); }
    grant(r) {
      const p = this.state.player, s = this.state;
      if (r.gold) { r.gold = this.goldIn(r.gold); p.gold += r.gold; this.runGold += r.gold; s.stats.goldEarned += r.gold; }
      if (r.crystal) p.crystal += r.crystal;
      if (r.keys) p.keys += r.keys;
      if (r.dust) p.dust += r.dust;
      if (r.ore) p.ore += r.ore;
      if (r.potion) this.state.consumables.potion += r.potion;
      if (r.elixir) this.state.consumables.elixir += r.elixir;
      (r.items || []).forEach(it => { this.addItem(it); this.emit('onLoot', it); });
      this.emit('onState');
    }
    // Espaço da bolsa: itens equipados não contam (ficam com o herói).
    bagCount() { const eq = new Set(this.state.collection.flatMap(h => Object.values(h.equipped).filter(Boolean))); return this.state.inventory.filter(x => !eq.has(x.uid)).length; }
    bagFull() { return this.bagCount() >= Math.min(this.state.invCap, I.MAX_BAG); }
    addItem(item) {
      const s = this.state;
      s.stats.loot++; this.count('loot');
      if (['legendary','mythic'].includes(item.rarity)) s.stats.legendaries++;
      const auto = s.settings.autoSalvage;
      const order = ['common','rare','epic'];
      if (auto !== 'none' && order.indexOf(item.rarity) >= 0 && order.indexOf(item.rarity) <= order.indexOf(auto)) { const v = I.salvageValue(item); s.player.ore += v.ore; s.player.dust += v.dust; s.player.gold += v.gold; s.stats.salvage++; this.count('salvage'); item.autoSalvaged = true; this.runLoot.push(item); return; }
      // Bolsa cheia: nada se perde. O item vai para o Baú de Excedentes; se o baú também lotar,
      // só o item COMUM de menor valor é desmontado para abrir espaço.
      if (this.bagFull() && (RARITY_RANK[item.rarity] || 0) >= 2) {
        // Item valioso com a bolsa cheia: o item comum/raro mais fraco (livre e destrancado) cede a vaga e vai para os Excedentes.
        const weak = s.inventory.filter(x => (RARITY_RANK[x.rarity] || 0) <= 1 && !x.locked && !this.ownerOf(x.uid)).sort((a, b) => (RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity]) || I.itemScore(a) - I.itemScore(b))[0];
        if (weak) { s.inventory.splice(s.inventory.indexOf(weak), 1); s.overflow = s.overflow || []; s.overflow.unshift(weak); weak.inOverflow = true; }
      }
      if (this.bagFull()) {
        s.overflow = s.overflow || [];
        if (s.overflow.length >= I.OVERFLOW_CAP) {
          const commons = s.overflow.map((x, i) => [x, i]).filter(([x]) => x.rarity === 'common').sort((a, b) => I.itemScore(a[0]) - I.itemScore(b[0]));
          if (commons.length) { const [junk, idx] = commons[0]; s.overflow.splice(idx, 1); const v = I.salvageValue(junk); s.player.ore += v.ore; s.player.dust += v.dust; }
          else if ((RARITY_RANK[item.rarity] || 0) <= 1) {
            // Baú cheio só de itens bons: um raro mais fraco dá lugar, ou o próprio item comum/raro é desmontado. Épicos ou melhores nunca somem.
            const rares = s.overflow.map((x, i) => [x, i]).filter(([x]) => x.rarity === 'rare').sort((a, b) => I.itemScore(a[0]) - I.itemScore(b[0]));
            const victim = item.rarity === 'rare' && rares.length && I.itemScore(rares[0][0]) < I.itemScore(item) ? rares[0] : null;
            if (victim) { s.overflow.splice(victim[1], 1); const v = I.salvageValue(victim[0]); s.player.ore += v.ore; s.player.dust += v.dust; }
            else { const v = I.salvageValue(item); s.player.ore += v.ore; s.player.dust += v.dust; item.autoSalvaged = true; this.runLoot.push(item); return; }
          }
        }
        s.overflow.unshift(item); item.inOverflow = true; this.runLoot.push(item);
        if (!this.overflowWarned) { this.overflowWarned = true; this.emit('onToast', 'Bolsa cheia! Novos itens estão indo para o <b>Baú de Excedentes</b> (Bolsa → Excedentes).'); }
        return;
      }
      s.inventory.unshift(item); this.runLoot.push(item);
    }
    // Traz itens do Baú de Excedentes para a bolsa (quantos couberem).
    takeOverflow(uid = null) {
      const s = this.state; let n = 0;
      const list = uid ? s.overflow.filter(x => x.uid === uid) : s.overflow.slice();
      for (const it of list) { if (this.bagFull()) break; s.overflow.splice(s.overflow.indexOf(it), 1); delete it.inOverflow; s.inventory.unshift(it); n++; }
      this.emit('onState'); return n;
    }
    salvageOverflow(maxRarity = 'rare') {
      const order = ['common','rare','epic','legendary'], lim = order.indexOf(maxRarity), tot = { ore:0, dust:0, gold:0, n:0 };
      this.state.overflow = this.state.overflow.filter(it => { if (it.locked || order.indexOf(it.rarity) < 0 || order.indexOf(it.rarity) > lim) return true; const v = I.salvageValue(it); tot.ore += v.ore; tot.dust += v.dust; tot.gold += v.gold; tot.n++; return false; });
      this.state.player.ore += tot.ore; this.state.player.dust += tot.dust; this.state.player.gold += tot.gold; this.emit('onState'); return tot;
    }

    // ---------- convocação e heróis ----------
    seasonOpen(now = this.now()) { return now < Date.parse(D.SEASON.ends); }
    boxDef(id) { return D.BOXES.find(b => b.id === id) || null; }
    boxPity(box) { return box.id === 'worlds' ? (this.state.pity || 0) : (this.state.pityBy?.[box.id] || 0); }
    // Heróis que a caixa pode sortear (a de temporada separa o destaque do restante).
    boxPool(box, cls) {
      const season = new Set(D.SEASON.heroes), open = this.seasonOpen();
      const base = D.roster.filter(h => !(open && season.has(h.id)));
      if (box.pool === 'class') return base.filter(h => h.cls === cls);
      if (box.pool === 'all') return D.roster.slice();
      return base;
    }
    boxCost(box) { return box.cost; }
    canOpenBox(boxId = 'worlds', n = 1, cls) {
      const box = this.boxDef(boxId); if (!box) return 'Caixa inválida.';
      if (box.pool === 'season' && !this.seasonOpen()) return 'A temporada terminou.';
      if (box.pool === 'class' && !D.classes[cls]) return 'Escolha uma classe.';
      if (boxId === 'worlds' && this.state.starterRolls > 0) return null;
      if (this.state.player.keys < box.cost * n) return `Faltam chaves: essa caixa custa ${box.cost} por convocação.`;
      return null;
    }
    openBox(silent = false, boxId = 'worlds', cls = null, forceMin = null) {
      const s = this.state, box = this.boxDef(boxId); if (!box) return null;
      if (this.canOpenBox(boxId, 1, cls)) return null;
      const starter = boxId === 'worlds' && s.starterRolls > 0;
      const order = ['common', 'rare', 'epic', 'legendary'], r = U.random(), pity = this.boxPity(box);
      let acc = 0, rarity = 'common';
      for (const id of ['legendary', 'epic', 'rare', 'common']) { acc += box.rates[id] || 0; if (r < acc) { rarity = id; break; } }
      if (!box.rates.common && rarity === 'common') rarity = 'rare';
      const pityHit = pity >= box.pity - 1;
      if (pityHit) rarity = 'legendary';
      if (forceMin && order.indexOf(rarity) < order.indexOf(forceMin)) rarity = forceMin;
      let pool = this.boxPool(box, cls);
      if (box.pool === 'season') {
        const feat = D.roster.filter(h => D.SEASON.heroes.includes(h.id));
        pool = pityHit || U.random() < box.featured ? feat : this.boxPool(this.boxDef('worlds'));
      }
      let t = U.pick(pool.length ? pool : D.roster);
      if (starter) {
        // Convocações iniciais: nunca repetem e garantem ao menos 1 herói de cada classe.
        const owned = new Set(s.collection.map(h => h.id)), have = new Set(s.collection.map(h => this.template(h.id).cls));
        const missing = Object.keys(D.classes).filter(c => !have.has(c));
        const pool = this.boxPool(box).filter(h => !owned.has(h.id) && (missing.length >= s.starterRolls ? missing.includes(h.cls) : true));
        if (pool.length) t = U.pick(pool);
      }
      if (starter) s.starterRolls--; else s.player.keys -= box.cost;
      s.boxesOpened++;
      const np = rarity === 'legendary' ? 0 : pity + 1;
      if (box.id === 'worlds') s.pity = np; else (s.pityBy || (s.pityBy = {}))[box.id] = np;
      const owned = s.collection.find(h => h.id === t.id);
      let result;
      if (owned) {
        const shards = D.heroRarities.find(x => x.id === rarity).shards;
        s.shards[t.id] = (s.shards[t.id] || 0) + shards;
        if (D.heroRarities.findIndex(x => x.id === rarity) > D.heroRarities.findIndex(x => x.id === owned.rarity)) { owned.rarity = rarity; }
        result = { ...owned, dupe:true, shardsGained:shards, rarityRolled:rarity };
      } else { const rec = newHeroRecord(t, rarity); s.collection.push(rec); result = { ...rec, dupe:false, rarityRolled:rarity }; }
      result.box = box.id; result.season = D.SEASON.heroes.includes(t.id);
      if (!silent) this.emit('onToast', `${t.name} ${result.dupe ? `(repetido: +${result.shardsGained} fragmentos)` : 'chegou à coleção!'}`);
      this.emit('onState');
      return result;
    }
    // 10 de uma vez garante ao menos um Épico (a última convocação sobe de raridade se nenhuma veio).
    openBoxes(n = 1, boxId = 'worlds', cls = null) {
      n = U.clamp(Math.floor(Number(n) || 1), 1, 10); const got = [];
      if (!this.boxDef(boxId)) { this.lastError = 'Caixa inválida.'; return got; }
      for (let i = 0; i < n; i++) {
        const need = n === 10 && i === 9 && !got.some(h => ['epic', 'legendary'].includes(h.rarityRolled)) ? 'epic' : null;
        const h = this.openBox(true, boxId, cls, need); if (!h) { if (!got.length) this.lastError = this.canOpenBox(boxId, 1, cls) || 'Não foi possível convocar.'; break; } got.push(h);
      }
      if (got.length) this.emit('onState');
      return got;
    }
    // Receitas da Oficina (antes calculadas na interface).
    craft(id) {
      const r = this.recipes().find(x => x.id === id); if (!r) return false;
      if (r.limit && this.craftedToday(id) >= r.limit) { this.lastError = `Limite diário de ${r.limit} atingido.`; return false; }
      if (Object.entries(r.cost).some(([k, v]) => this.have(k) < v)) { this.lastError = 'Recursos insuficientes.'; return false; }
      Object.entries(r.cost).forEach(([k, v]) => { if (k in this.state.player) this.state.player[k] -= v; else this.state.mats[k] -= v; });
      Object.entries(r.give).forEach(([k, v]) => { if (k in this.state.mats) this.state.mats[k] += v; else this.state.consumables[k] = (this.state.consumables[k] || 0) + v; });
      if (r.limit) this.state.crafted.n[id] = this.craftedToday(id) + 1;
      this.emit('onState'); return true;
    }
    setName(name) { const n = String(name || '').normalize('NFKC').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 20); if (!n) return false; this.state.player.name = n; return true; }
    setSetting(key, value) {
      const st = this.state.settings;
      if (key === 'auto' || key === 'autoAdvance' || key === 'autoRepeat') { st[key] = !!value; return true; }
      if (key === 'autoSalvage' && ['none', 'common', 'rare', 'epic'].includes(value)) { st.autoSalvage = value; return true; }
      return false;
    }
    markSeen(key) { if (!['intro', 'intro2', 'team', 'formation'].includes(key)) return false; this.state.story.seen[key] = true; return true; }
    awaken(uid) {
      const r = this.record(uid); if (!r || r.stars >= HERO_MAX_STARS) return false;
      const c = awakenCost(r.stars, this.state.buildings.shrine), have = this.state.shards[r.id] || 0;
      if (have < c.shards || this.state.player.gold < c.gold) return false;
      this.state.shards[r.id] = have - c.shards; this.state.player.gold -= c.gold; r.stars++;
      this.emit('onToast', `${this.template(r.id).name} elevou a qualidade para ${r.stars}★! +12% em HP, ATK e DEF.`);
      this.rebuildIfVillage(); this.emit('onState'); return true;
    }
    canEditParty() { return !this.active || this.zone.kind === 'village'; }
    setParty(slot, uid) {
      if (!this.canEditParty() || slot < 0 || slot > 3) return false;
      const r = this.record(uid); if (!r) return false;
      const f = this.state.formation;
      const baseOf = id => this.template(id)?.base || id;
      if (f.some((u, i) => u && i !== slot && u !== uid && baseOf(this.record(u)?.id) === baseOf(r.id))) { this.emit('onToast', 'Esse personagem (ou outra forma dele) já está na equipe.'); return false; }
      const prev = f.indexOf(uid), out = f[slot];
      if (prev >= 0) { f[prev] = f[slot]; }
      f[slot] = uid;
      if (out && out !== uid && !f.includes(out)) this.stashHeroGear(out);
      this.emit('onState'); return true;
    }
    removeFromParty(uid) { if (!this.canEditParty()) return false; const i = this.state.formation.indexOf(uid); if (i < 0) return false; this.state.formation[i] = null; this.stashHeroGear(uid); this.emit('onState'); return true; }
    // Herói que sai da equipe devolve os itens ao Armazém (protegidos da desmontagem e sem ocupar a bolsa).
    stashHeroGear(uid) { const r = this.record(uid); if (!r) return 0; let n = 0; Object.keys(r.equipped).forEach(k => { const it = r.equipped[k]; if (!it) return; r.equipped[k] = null; if (this.stashItem(it)) n++; }); return n; }
    rebuildIfVillage() { }

    addAttr(uid, key, n = 1) {
      const r = this.record(uid); if (!r || !PR.attributes[key]) return false;
      const free = this.freeAttr(r); n = Math.min(n, free); if (n <= 0) return false;
      r.attr[key] = (r.attr[key] || 0) + n; this.emit('onState'); return true;
    }
    freeAttr(r) { return (r.level - 1) * PR.ATTR_PER_LEVEL + 5 - Object.values(r.attr || {}).reduce((a, b) => a + b, 0); }
    attrResetCost(r) { return Math.round(200 * r.level * r.level); }
    resetAttr(uid) { const r = this.record(uid); if (!r) return false; const c = this.attrResetCost(r); if (this.state.player.gold < c) return false; this.state.player.gold -= c; Object.keys(r.attr).forEach(k => r.attr[k] = 0); this.emit('onState'); return true; }
    useScroll(uid) { const r = this.record(uid); if (!r || r.level >= HERO_LEVEL_CAP || this.state.consumables.scroll < 1 || this.shopBoughtToday('scroll_use') >= 3) return false; this.state.consumables.scroll--; this.state.shopDaily.bought.scroll_use = this.shopBoughtToday('scroll_use') + 1; const amt = Math.max(10, Math.round(heroXpNext(r.level) * .08)); if (this.gainHeroXp(r, amt)) this.emit('onToast', `${this.template(r.id).name} alcançou o nível ${r.level}!`); this.emit('onState'); return true; }

    // ---------- talentos por herói e classe avançada ----------
    heroTalentPoints(r) { const spent = Object.values(r.talents || {}).reduce((a, b) => a + b, 0); return (r.level - 1) + (r.job ? 5 : 0) - spent; }
    talentPoints() { return this.heroes.reduce((s, r) => s + Math.max(0, this.heroTalentPoints(r)), 0); }
    treeSpent(r) { return Object.values(r.talents || {}).reduce((a, b) => a + b, 0); }
    talentState(r, id) {
      const tree = PR.treeFor(r.id), n = tree.find(x => x.id === id); if (!n) return { ok:false, reason:'Nó inválido.' };
      const rank = r.talents?.[id] || 0;
      if (rank >= n.max) return { ok:false, reason:'Rank máximo.', n, rank };
      if (n.tier === 2 && !r.job) return { ok:false, reason:`Requer a classe avançada (${PR.jobs[this.template(r.id).cls].name}).`, n, rank };
      if (this.treeSpent(r) < PR.TIER_REQ[n.tier]) return { ok:false, reason:`Requer ${PR.TIER_REQ[n.tier]} pontos investidos nesta árvore.`, n, rank };
      if (n.req.length && !n.req.every(q => q.split('|').some(x => (r.talents?.[x] || 0) > 0))) return { ok:false, reason:'Aprenda o talento anterior primeiro.', n, rank };
      if (this.heroTalentPoints(r) < 1) return { ok:false, reason:'Sem pontos de talento (1 por nível).', n, rank };
      return { ok:true, n, rank };
    }
    addHeroTalent(uid, id) { const r = this.record(uid); if (!r) return false; const st = this.talentState(r, id); if (!st.ok) return false; r.talents[id] = (r.talents[id] || 0) + 1; this.refreshPartyUnits(); this.emit('onState'); return true; }
    talentResetCost(r) { return Math.round(300 * r.level * r.level); }
    resetHeroTalents(uid) {
      const r = this.record(uid); if (!r || !this.treeSpent(r)) return false;
      if (this.state.freeRespec > 0) this.state.freeRespec--; else { const c = this.talentResetCost(r); if (this.state.player.gold < c) return false; this.state.player.gold -= c; }
      r.talents = {}; this.refreshPartyUnits(); this.emit('onState'); return true;
    }
    canJobChange(r) { return !r.job && r.level >= PR.JOB_LEVEL && (r.classLevel || 1) >= PR.JOB_CLASS_LEVEL && this.state.player.gold >= PR.jobCost.gold && this.state.player.crystal >= PR.jobCost.crystal; }
    jobChange(uid) {
      const r = this.record(uid); if (!r || !this.canJobChange(r)) return false;
      this.state.player.gold -= PR.jobCost.gold; this.state.player.crystal -= PR.jobCost.crystal; r.job = 1;
      this.emit('onToast', `<b>${this.template(r.id).name}</b> tornou-se <b>${PR.jobs[this.template(r.id).cls].name}</b>! +5 pontos de talento e o Círculo III foi liberado.`);
      this.refreshPartyUnits(); this.emit('onState'); return true;
    }
    refreshPartyUnits() { if (!this.party.length) return; const ctx = this.ctx(); this.party.forEach(u => { const r = this.record(u.recUid); if (r) { const st = heroStats(this.state, r, ctx); const ratio = u.hp / u.maxHp; u.st = st; u.maxHp = st.maxHp; u.hp = Math.max(u.alive ? 1 : 0, Math.round(st.maxHp * ratio)); } }); }

    // ---------- Mercado de Jogadores no modo Neon (a escrow fica no banco; aqui só entra/sai do save) ----------
    marketTake(kind, arg, qty = 1) {
      const s = this.state;
      if (kind === 'item') {
        const i = s.inventory.findIndex(x => x.uid === arg), it = s.inventory[i];
        if (!it) { this.lastError = 'Item não encontrado.'; return null; }
        if (it.locked) { this.lastError = 'Destranque o item antes de anunciar.'; return null; }
        if (it.bound) { this.lastError = 'Este item está vinculado à sua conta e não pode ser vendido.'; return null; }
        if (this.ownerOf(it.uid)) { this.lastError = 'Desequipe o item antes de anunciar.'; return null; }
        s.inventory.splice(i, 1); return { ...it, locked:false, isNew:true };
      }
      if (kind === 'card') { if (!I.cardById(arg) || (s.cards[arg] || 0) < 1) { this.lastError = 'Você não tem essa carta livre.'; return null; } s.cards[arg]--; return { id:arg }; }
      if (kind === 'mat') {
        const m = I.matInfo(arg); qty = Math.floor(qty);
        if (!m || !(qty > 0) || m.have(s) < qty) { this.lastError = 'Quantidade de material indisponível.'; return null; }
        m.add(s, -qty); return { id:arg, qty };
      }
      return null;
    }
    marketReceive(kind, payload) {
      const s = this.state;
      if (kind === 'gold') { const n = Math.max(0, Math.floor(Number(payload?.amount) || 0)); s.player.gold += n; return n > 0; }
      if (kind === 'item' && payload?.slot && I.slots[payload.slot]) { const it = { cards:[], ...payload, locked:false }; if (s.inventory.some(x => x.uid === it.uid)) it.uid = U.uid('it'); this.addItem(it); return true; }
      if (kind === 'card' && I.cardById(payload?.id)) { s.cards[payload.id] = (s.cards[payload.id] || 0) + Math.min(50, Math.max(1, Math.floor(Number(payload.qty) || 1))); if (s.house) s.house.seen[payload.id] = 1; return true; }
      if (kind === 'mat' && I.matInfo(payload?.id)) { I.matInfo(payload.id).add(s, Math.max(0, Math.floor(Number(payload.qty) || 0))); return true; }
      // Presentes da administração (só chegam pelo correio do banco).
      if (kind === 'keys') { const n = U.clamp(Math.floor(Number(payload?.n) || 0), 0, 100000); s.player.keys += n; return n > 0; }
      if (kind === 'hero') {
        const t = D.roster.find(h => h.id === payload?.id), rarity = D.heroRarities.some(r => r.id === payload?.rarity) ? payload.rarity : 'common'; if (!t) return false;
        const owned = s.collection.find(h => h.id === t.id), order = D.heroRarities.map(r => r.id);
        if (!owned) s.collection.push(newHeroRecord(t, rarity));
        else { if (order.indexOf(rarity) > order.indexOf(owned.rarity)) owned.rarity = rarity; s.shards[t.id] = (s.shards[t.id] || 0) + D.heroRarities.find(r => r.id === rarity).shards; }
        return true;
      }
      return false;
    }

    // ---------- Profissões ----------
    profXp(id, amount) {
      const p = this.state.prof; let up = false;
      if ((p.lv[id] || 1) >= D.PROF.maxLevel) return false;
      p.xp[id] = (p.xp[id] || 0) + amount;
      while ((p.lv[id] || 1) < D.PROF.maxLevel && p.xp[id] >= D.PROF.next(p.lv[id] || 1)) { p.xp[id] -= D.PROF.next(p.lv[id] || 1); p.lv[id] = (p.lv[id] || 1) + 1; up = true; }
      if (up) this.emit('onToast', `<b>${esc((D.PROF.gather[id] || D.PROF.craft[id]).name)}</b> nível ${p.lv[id]}!`);
      return up;
    }
    // Coleta: entre ondas, chance de achar um veio, erva ou essência do nível do capítulo.
    gather() {
      const z = this.zone; if (!(z.kind === 'hunt' || z.kind === 'dungeon') || U.random() >= D.PROF.gatherChance) return null;
      const s = this.state, prof = U.pick(Object.keys(D.PROF.gather)), lv = s.prof.lv[prof] || 1, tier = U.clamp(z.chapter || 1, 1, 4);
      const rare = U.random() < D.PROF.rareChance + lv * .0004;
      const mat = D.PROF_MATS.find(m => m.prof === prof && (rare ? m.rare : m.tier === tier));
      const qty = rare ? 1 : 1 + Math.floor(lv / 20);
      s.prof.mats[mat.id] = (s.prof.mats[mat.id] || 0) + qty;
      this.profXp(prof, rare ? 40 : 8 * tier);
      this.emit('onLog', { text:`${D.PROF.gather[prof].icon} Coletou ${qty}× ${mat.name}.`, type:'reward' });
      if (rare) this.emit('onToast', `Coleta rara: <b>${esc(mat.name)}</b>!`);
      return { id:mat.id, qty };
    }
    profHave(k) { return k === 'gold' ? this.state.player.gold : this.state.prof.mats[k] || 0; }
    // Criação: consome materiais e ouro. Artesania gera equipamento negociável com raridade pela habilidade.
    craftProf(recipeId, slot) {
      const r = D.PROF_RECIPES.find(x => x.id === recipeId), s = this.state; if (!r) return false;
      if ((s.prof.lv[r.prof] || 1) < r.lv) { this.lastError = `Requer ${D.PROF.craft[r.prof].name} nível ${r.lv}.`; return false; }
      const cost = { ...r.cost, gold:Math.round((r.cost.gold || 0) * this.priceMult()) };
      if (Object.entries(cost).some(([k, v]) => this.profHave(k) < v)) { this.lastError = 'Materiais ou ouro insuficientes.'; return false; }
      if (r.gear && !I.slots[slot]) { this.lastError = 'Escolha o espaço do equipamento.'; return false; }
      Object.entries(cost).forEach(([k, v]) => { if (k === 'gold') s.player.gold -= v; else s.prof.mats[k] -= v; });
      let out;
      if (r.gear) {
        const lv = s.prof.lv.smithing || 1, roll = U.random();
        const rarity = r.masterwork ? (roll < .25 ? 'legendary' : 'epic') : roll < .002 + lv * .0002 ? 'legendary' : roll < .05 + lv * .004 ? 'epic' : 'rare';
        const it = I.makeItem({ ilvl:D.PROF.tierIlvl[r.gear] + Math.floor(lv / 5), rarity, slot, prefer:this.preferWT() });
        it.crafter = String(s.player.name || 'Viajante').slice(0, 20); this.addItem(it); this.emit('onLoot', it); out = it.name;
      } else Object.entries(r.give).forEach(([k, v]) => { s.consumables[k] = (s.consumables[k] || 0) + v; out = r.name; });
      this.profXp(r.prof, r.xp);
      this.emit('onState'); return { name:out };
    }

    // ---------- Loja de Honra (PvP) ----------
    pvpGrant(itemId) {
      const s = this.state, hz = D.zones[s.lastHunt || 'hunt'] || D.zones.hunt, ilvl = Math.max(10, itemLevelFor(hz, { stage:Math.max(1, s.progress[hz.id]?.best || 1) }));
      if (itemId === 'star') { s.mats.star += 1; return 'Aço Estelar'; }
      if (itemId === 'ori') { s.mats.ori += 1; return 'Oricalco'; }
      if (itemId === 'elixir') { s.consumables.elixir += 3; return '3 Elixires de Energia'; }
      if (itemId === 'key') { s.player.keys += 1; return 'Chave de Convocação'; }
      if (itemId === 'glad_box') { const it = I.makeItem({ ilvl, rarity:'epic', prefer:this.preferWT() }); this.addItem(it); this.emit('onLoot', it); return it.name; }
      const slot = { glad_weapon:'weapon', glad_focus:'focus', glad_seal:'seal', glad_charm:'charm' }[itemId];
      if (slot) { const it = I.makeItem({ ilvl, set:'gladiator', slot }); this.addItem(it); this.emit('onLoot', it); return it.name; }
      return null;
    }

    // ---------- Casa do Time ----------
    houseSlots() { return D.HOUSE.slots(this.state.buildings.house || 1); }
    albumCount() { return albumIds(this.state).length; }
    displayCard(cardId, slot) {
      const h = this.state.house, n = this.houseSlots();
      if (!Number.isInteger(slot) || slot < 0 || slot >= n) { this.lastError = 'Espaço da Galeria bloqueado (melhore a Casa do Time).'; return false; }
      if (!I.cardById(cardId) || (this.state.cards[cardId] || 0) < 1) { this.lastError = 'Você não tem essa carta livre.'; return false; }
      if (h.display.includes(cardId)) { this.lastError = 'Essa carta já está exposta.'; return false; }
      while (h.display.length < n) h.display.push(null);
      if (h.display[slot]) this.state.cards[h.display[slot]] = (this.state.cards[h.display[slot]] || 0) + 1;
      this.state.cards[cardId]--; h.display[slot] = cardId; h.seen[cardId] = 1;
      this.refreshPartyUnits(); this.emit('onState'); return true;
    }
    removeDisplay(slot) {
      const h = this.state.house, id = h.display?.[slot]; if (!id) return false;
      this.state.cards[id] = (this.state.cards[id] || 0) + 1; h.display[slot] = null;
      this.refreshPartyUnits(); this.emit('onState'); return true;
    }

    // ---------- cartas ----------
    socketCard(itemUid, idx, cardId) {
      const it = this.state.inventory.find(x => x.uid === itemUid); if (!it || !it.cards || idx >= it.cards.length || it.cards[idx]) return false;
      if ((this.state.cards[cardId] || 0) < 1 || !I.cardById(cardId)) return false;
      this.state.cards[cardId]--; it.cards[idx] = cardId; this.refreshPartyUnits(); this.emit('onState'); return true;
    }
    unsocketCard(itemUid, idx) {
      const it = this.state.inventory.find(x => x.uid === itemUid); if (!it?.cards?.[idx] || this.state.player.crystal < 30) return false;
      this.state.player.crystal -= 30; this.state.cards[it.cards[idx]] = (this.state.cards[it.cards[idx]] || 0) + 1; it.cards[idx] = null; this.refreshPartyUnits(); this.emit('onState'); return true;
    }

    train(key) {
      const lv = this.state.training[key] || 0, cap = PR.trainingCap(this.state.buildings.dojo), cost = PR.trainingCost(lv);
      if (lv >= cap || this.state.player.gold < cost) return false;
      this.state.player.gold -= cost; this.state.training[key] = lv + 1; this.emit('onState'); return true;
    }

    // ---------- itens ----------
    equip(heroUid, itemUid) {
      const s = this.state, r = this.record(heroUid);
      let it = s.inventory.find(x => x.uid === itemUid), fromStorage = false;
      if (!it) { it = s.storage.find(x => x.uid === itemUid); fromStorage = !!it; }
      if (!r || !it) return false;
      const chk = I.equipCheck(it, r);
      if (!chk.ok) { this.lastError = chk.reason; this.emit('onToast', esc(chk.reason)); return false; }
      if (fromStorage) { s.storage.splice(s.storage.indexOf(it), 1); s.inventory.unshift(it); }
      s.collection.forEach(h => { Object.keys(h.equipped).forEach(k => { if (h.equipped[k] === itemUid) h.equipped[k] = null; }); });
      const prev = r.equipped[it.slot]; r.equipped[it.slot] = itemUid; it.isNew = false;
      if (prev && prev !== itemUid) this.stashItem(prev);
      this.state.guide.flags.equipped = true;
      this.emit('onState'); return true;
    }
    unequip(heroUid, slot) { const r = this.record(heroUid); if (!r || !r.equipped[slot]) return false; const uid = r.equipped[slot]; r.equipped[slot] = null; this.stashItem(uid); this.refreshPartyUnits(); this.emit('onState'); return true; }
    // ---------- Armazém do Tanuki ----------
    storageCap() { return D.STORAGE.base + D.STORAGE.decor.filter(d => this.state.decor?.[d.id]).reduce((a, d) => a + d.slots, 0); }
    // Item que ninguém usa mais vai para o Armazém (se houver espaço); se não, fica na bolsa.
    stashItem(itemUid) {
      const s = this.state, i = s.inventory.findIndex(x => x.uid === itemUid); if (i < 0 || this.ownerOf(itemUid)) return false;
      if (s.storage.length >= this.storageCap()) return false;
      const [it] = s.inventory.splice(i, 1); s.storage.unshift(it); return true;
    }
    storeItem(itemUid) {
      const s = this.state, it = s.inventory.find(x => x.uid === itemUid); if (!it) return false;
      if (s.storage.length >= this.storageCap()) { this.lastError = 'O Armazém está cheio. Enfeites do Armazém aumentam o espaço.'; return false; }
      const owner = this.ownerOf(itemUid); if (owner) { Object.keys(owner.equipped).forEach(k => { if (owner.equipped[k] === itemUid) owner.equipped[k] = null; }); this.refreshPartyUnits(); }
      s.inventory.splice(s.inventory.indexOf(it), 1); s.storage.unshift(it); this.emit('onState'); return true;
    }
    // Guarda de uma vez os itens livres da bolsa a partir de uma raridade (padrão: épicos ou melhores).
    storeMany(minRarity = 'epic') {
      const min = RARITY_RANK[minRarity] ?? 2; let n = 0;
      this.state.inventory.slice().forEach(it => { if ((RARITY_RANK[it.rarity] || 0) >= min && !this.ownerOf(it.uid) && this.state.storage.length < this.storageCap()) { this.state.inventory.splice(this.state.inventory.indexOf(it), 1); this.state.storage.unshift(it); n++; } });
      if (n) this.emit('onState'); return n;
    }
    retrieveItem(itemUid) {
      const s = this.state, it = s.storage.find(x => x.uid === itemUid); if (!it) return false;
      if (this.bagFull()) { this.lastError = 'A bolsa está cheia.'; return false; }
      s.storage.splice(s.storage.indexOf(it), 1); s.inventory.unshift(it); this.emit('onState'); return true;
    }
    buyDecor(id) {
      const d = D.STORAGE.decor.find(x => x.id === id), s = this.state; if (!d || s.decor[id]) return false;
      if (s.player.crystal < d.price.crystal) { this.lastError = `Faltam cristais (${d.price.crystal}).`; return false; }
      s.player.crystal -= d.price.crystal; s.decor[id] = 1; this.emit('onToast', `<b>${esc(d.name)}</b> enfeita o Armazém: +${d.slots} espaços.`); this.emit('onState'); return true;
    }
    ownerOf(itemUid) { return this.state.collection.find(h => Object.values(h.equipped).includes(itemUid)); }
    salvage(itemUid) {
      const i = this.state.inventory.findIndex(x => x.uid === itemUid); if (i < 0) return null;
      const it = this.state.inventory[i]; if (it.locked || this.ownerOf(itemUid)) return null;
      const v = I.salvageValue(it); this.state.inventory.splice(i, 1);
      this.state.player.ore += v.ore; this.state.player.dust += v.dust; this.state.player.gold += v.gold;
      this.state.stats.salvage++; this.count('salvage'); this.emit('onState'); return v;
    }
    salvageMany(maxRarity) {
      const order = ['common','rare','epic','legendary'], lim = order.indexOf(maxRarity); const tot = { ore:0, dust:0, gold:0, n:0 };
      this.state.inventory.slice().forEach(it => { if (order.indexOf(it.rarity) >= 0 && order.indexOf(it.rarity) <= lim && !it.locked && !this.ownerOf(it.uid)) { const v = this.salvage(it.uid); if (v) { tot.ore += v.ore; tot.dust += v.dust; tot.gold += v.gold; tot.n++; } } });
      return tot;
    }
    // REFINO com materiais: Tamahagane (comum), Aço Estelar (raro), Oricalco (épico), Adamantina (lendário).
    upgradeItem(itemUid, matId = 'common') {
      const s = this.state, it = s.inventory.find(x => x.uid === itemUid); if (!it) return { ok:false, reason:'Item não encontrado.' };
      if ((it.plus || 0) >= 15) return { ok:false, reason:'O item já está no refino máximo (+15).' };
      if ((it.plus || 0) >= I.maxPlus(s.buildings.forge)) return { ok:false, reason:`Limite +${I.maxPlus(s.buildings.forge)}. Melhore a Forja.` };
      const c = I.upgradeCost(it, s.buildings.forge, matId);
      if (!c.allowed) return { ok:false, reason:c.reason };
      const have = c.key === 'ore' ? s.player.ore : (s.mats?.[c.key] || 0);
      if (s.player.gold < c.gold || have < c.qty) return { ok:false, reason:`Precisa de ${U.fmt(c.gold)} ouro e ${c.qty} ${I.materials[matId].name}.` };
      s.player.gold -= c.gold; if (c.key === 'ore') s.player.ore -= c.qty; else s.mats[c.key] -= c.qty;
      s.stats.upgradeTries = (s.stats.upgradeTries || 0) + 1; this.count('upgrades');
      if (U.random() > c.chance) {
        if (c.onFail === 'break') {
          const owner = this.ownerOf(it.uid); if (owner) Object.keys(owner.equipped).forEach(k => { if (owner.equipped[k] === it.uid) owner.equipped[k] = null; });
          s.inventory.splice(s.inventory.indexOf(it), 1); s.stats.broken = (s.stats.broken || 0) + 1;
          this.refreshPartyUnits(); this.emit('onState');
          return { ok:false, failed:true, broken:true, reason:`O refino falhou e ${it.name} QUEBROU.` };
        }
        if (c.onFail === 'regress' && it.plus > 0) { it.plus--; this.refreshPartyUnits(); this.emit('onState'); return { ok:false, failed:true, reason:`O refino falhou e o item voltou para +${it.plus}.` }; }
        this.emit('onState'); return { ok:false, failed:true, reason:'O refino falhou (o item continua igual).' };
      }
      it.plus = (it.plus || 0) + 1; s.stats.upgrades++; s.stats.maxUpgrade = Math.max(s.stats.maxUpgrade, it.plus);
      if (it.plus >= 10) this.emit('onToast', `<b>${esc(it.name)} +${it.plus}!</b> Um refino desse nível é raríssimo.`);
      this.refreshPartyUnits(); this.emit('onState'); return { ok:true, plus:it.plus };
    }
    enchantItem(itemUid, idx) {
      const it = this.state.inventory.find(x => x.uid === itemUid); if (!it || !it.affixes?.[idx]) return false;
      const c = I.enchantCost(it, this.state.buildings.workshop);
      if (this.state.player.dust < c.dust || this.state.player.gold < c.gold) return false;
      this.state.player.dust -= c.dust; this.state.player.gold -= c.gold;
      const others = it.affixes.filter((_, i) => i !== idx).map(a => a.id);
      it.affixes[idx] = I.rollAffix(it.ilvl, others); this.emit('onState'); return true;
    }
    toggleLock(itemUid) { const it = this.state.inventory.find(x => x.uid === itemUid); if (it) { it.locked = !it.locked; this.emit('onState'); } }

    // ---------- cidade ----------
    // Multiplicador de preços de NPC e obras definido pelo Tesouro Imperial (inflação alta = mais caro).
    priceMult() { return U.clamp(Number(this.state.econ?.price) || 1, D.ECON.priceMin, D.ECON.priceMax); }
    buildingCost(id) { const b = D.buildings[id], lv = this.state.buildings[id] || 1; return Math.round(b.baseCost * Math.pow(b.growth, lv - 1) * this.priceMult()); }
    buildingCap() { return 2 + Math.floor(this.state.player.level / 3); }
    upgradeBuilding(id) {
      const lv = this.state.buildings[id] || 1; if (lv >= this.buildingCap()) { this.emit('onToast', `Limite de nível ${this.buildingCap()}, suba o nível da conta.`); return false; }
      const cost = this.buildingCost(id); if (this.state.player.gold < cost) return false;
      this.state.player.gold -= cost; this.state.buildings[id] = lv + 1;
      this.emit('onToast', `${D.buildings[id].name} alcançou o nível ${lv + 1}.`); this.emit('onState'); return true;
    }

    // ---------- loja ----------
    shopPrice(offer) {
      if (!offer.scale) return offer.price;
      const best = Math.max(this.state.progress.hunt.best, this.state.progress.hunt_tide.best + 12, (this.state.progress.hunt_desert?.best || 0) + 24, (this.state.progress.hunt_sky?.best || 0) + 36);
      const m = Math.min(6, 1 + best * .12);
      return Object.fromEntries(Object.entries(offer.price).map(([k, v]) => [k, Math.round(v * m)]));
    }
    // Limite diário por oferta (renova à meia-noite de Brasília).
    shopBoughtToday(id) { const sd = this.state.shopDaily, key = dayKey(this.now()); if (sd.date !== key) { sd.date = key; sd.bought = {}; } return sd.bought[id] || 0; }
    offerPrice(offer) {
      if (offer.give.invCap) { const n = Math.max(0, Math.round((this.state.invCap - 150) / 25)); return { crystal:100 + n * 40 }; }
      const p = this.shopPrice(offer), m = this.priceMult();
      return m === 1 ? p : Object.fromEntries(Object.entries(p).map(([k, v]) => [k, k === 'gold' ? Math.round(v * m) : v]));
    }
    buy(offerId) {
      const offer = [...PR.shop.gold, ...PR.shop.crystal].find(o => o.id === offerId); if (!offer) return false;
      const price = this.offerPrice(offer);
      if (Object.entries(price).some(([k, v]) => (this.state.player[k] || 0) < v)) return false;
      if (offer.give.invCap && this.state.invCap >= I.MAX_BAG) return false;
      if (offer.limit && this.shopBoughtToday(offer.id) >= offer.limit) return false;
      Object.entries(price).forEach(([k, v]) => { this.state.player[k] -= v; });
      if (offer.limit) this.state.shopDaily.bought[offer.id] = this.shopBoughtToday(offer.id) + 1;
      Object.entries(offer.give).forEach(([k, v]) => {
        if (k in (this.state.consumables || {}) || ['potion','elixir','scroll','onigiri','ramen','tea','luck'].includes(k)) this.state.consumables[k] = (this.state.consumables[k] || 0) + v;
        else if (['star','ori','adam'].includes(k)) this.state.mats[k] = (this.state.mats[k] || 0) + v;
        else if (k === 'invCap') this.state.invCap = Math.min(I.MAX_BAG, this.state.invCap + v);
        else if (k === 'boost') this.state.boostUntil = Math.max(this.now(), this.state.boostUntil) + v * 1000;
        else if (k === 'respec') this.state.freeRespec++;
        else this.state.player[k] = (this.state.player[k] || 0) + v;
      });
      this.emit('onState'); return true;
    }
    // Usa um consumível de buff (comida, pergaminho). Duração acumula.
    useItem(id) {
      const b = PR.buffs?.[id], c = this.state.consumables; if (!b || (c[id] || 0) < 1) return false;
      c[id]--; this.state.buffs[id] = Math.max(this.now(), this.state.buffs[id] || 0) + b.dur * 1000;
      this.refreshPartyUnits(); this.emit('onToast', `<b>${esc(b.name)}</b> ativo: ${esc(b.text)}`); this.emit('onState'); return true;
    }
    // Ofertas do Mercado do Porto: sorteadas por uma semente da conta + janela de 2h, então o navegador
    // e o servidor mostram exatamente as mesmas ofertas.
    refreshMarket(force = false) {
      const m = this.state.market, now = this.now(), slot = Math.floor(now / (2 * 3600 * 1000));
      if (!force && m.slot === slot && m.offers.length) return m.offers;
      return KT.Rng.with(KT.Rng.seeded(KT.Rng.hash(`${this.state.created}:${slot}:${this.state.buildings.market}`)), () => this.rollMarket(m, slot, now));
    }
    rollMarket(m, slot, now) {
      const lv = this.state.buildings.market;
      const ilvl = Math.max(1, ...Object.values(D.zones).filter(z => z.kind === 'hunt').map(z => (this.state.progress[z.id]?.best || 0) ? itemLevelFor(z, { stage:this.state.progress[z.id].best }) : 0));
      const offers = [];
      for (let i = 0; i < 2 + lv; i++) {
        const roll = U.random(), rarity = roll < .012 * lv ? 'legendary' : roll < .25 ? 'epic' : 'rare';
        const it = I.makeItem({ ilvl:ilvl + 1, rarity, prefer:this.preferWT() }); offers.push({ type:'item', item:it, price:Math.round(I.itemScore(it) * 7 + 500 * ilvl), sold:false });
      }
      const owned = this.state.collection.map(h => h.id);
      if (owned.length) offers.push({ type:'shards', heroId:U.pick(owned), n:3, price:Math.round(6000 * (1 + ilvl * .25)), sold:false });
      m.offers = offers; m.slot = slot; m.refreshedAt = now; return offers;
    }
    buyMarket(i) {
      const o = this.state.market.offers[i]; if (!o || o.sold || this.state.player.gold < o.price) return false;
      this.state.player.gold -= o.price; o.sold = true;
      if (o.type === 'item') { const it = { ...o.item, uid:U.uid('it'), bound:true }; this.addItem(it); this.emit('onLoot', it); }
      if (o.type === 'shards') this.state.shards[o.heroId] = (this.state.shards[o.heroId] || 0) + o.n;
      this.emit('onState'); return true;
    }

    // ---------- guia, contratos e conquistas ----------
    guideStep() { return D.guide.find(g => !this.state.guide.claimed[g.id]) || null; }
    guideDone(g) {
      const c = g.cond, s = this.state;
      if (c.boxes) return s.boxesOpened >= c.boxes || s.starterRolls === 0;
      if (c.team) return this.heroes.length >= c.team;
      if (c.entered) return !!s.guide.flags[`entered_${c.entered}`];
      if (c.stage) return (s.progress[c.stage[0]]?.best || 0) >= c.stage[1];
      if (c.floor) return (s.progress[c.floor[0]]?.best || 0) >= c.floor[1];
      if (c.kills) return (s.progress[c.kills[0]]?.kills || 0) >= c.kills[1];
      if (c.equipped) return !!s.guide.flags.equipped;
      if (c.ults) return s.stats.manualUlts >= c.ults;
      if (c.upgrades) return s.stats.upgrades >= c.upgrades;
      if (c.tierKill) return ['boss','boss_tide','boss_event'].some(id => (s.progress[id]?.tierKills?.[1] || 0) + (s.progress[id]?.tierKills?.[2] || 0) >= 1);
      return false;
    }
    claimGuide() {
      const g = this.guideStep(); if (!g || !this.guideDone(g)) return false;
      this.state.guide.claimed[g.id] = true;
      const r = { ...g.reward, items:[] };
      if (g.reward.item) { r.items.push(I.makeItem({ ilvl:Math.max(2, this.state.progress.hunt.best + 2), rarity:g.reward.item })); delete r.item; }
      if (g.reward.key) { r.keys = g.reward.key; delete r.key; }
      this.grant(r);
      this.emit('onToast', `Guia concluído: ${g.title}!`);
      if (g.id === 'g_team' && !this.state.story.seen.team) { this.state.story.seen.team = true; this.emit('onDialog', D.story.team); }
      return true;
    }
    ensureContracts() {
      const s = this.state; if (!s.contracts) s.contracts = [];
      while (s.contracts.length < 3) {
        const used = s.contracts.map(c => c.id); const pool = D.contracts.filter(c => !used.includes(c.id));
        const rank = s.guildRank?.lv || 1, tier = U.weighted([0, 1, 2], x => [5, 3 + rank * .3, 1 + rank * .4][x]);
        const c = U.pick(pool.length ? pool : D.contracts);
        s.contracts.push({ id:c.id, tier, n:Math.round(c.n[tier] * (1 + .3 * (rank - 1))), progress:0, rank });
      }
    }
    count(type) {
      (this.state.contracts || []).forEach(c => { const def = D.contracts.find(d => d.id === c.id); if (def?.type === type) c.progress = Math.min(c.n, c.progress + 1); });
      (this.state.daily?.list || []).forEach(d => { const def = D.dailies.find(x => x.id === d.id); if (def?.type === type && !d.claimed) d.progress = Math.min(d.n, d.progress + 1); });
    }
    farmPower() { const z = D.zones[this.state.lastHunt || 'hunt'] || D.zones.hunt; return Math.max(1, zonePower(z, { stage:Math.max(1, this.state.progress[z.id]?.best || 1) })); }
    contractReward(c) {
      const def = D.contracts.find(d => d.id === c.id), rank = c.rank || this.state.guildRank?.lv || 1, m = (1 + c.tier * .8) * (1 + .12 * (rank - 1)), P = this.farmPower();
      const out = {}; Object.entries(def.reward).forEach(([k, v]) => { out[k] = Math.round(k === 'gold' ? v * 450 * P * m : k === 'crystal' ? v * .5 * m : v * m); }); return out;
    }
    // Rank da Guilda: sobe sem limite; contratos ficam maiores e mais valiosos a cada rank.
    guildNeed(lv = this.state.guildRank.lv) { return 3 + lv * 2; }
    claimContract(i) {
      const c = this.state.contracts[i]; if (!c || c.progress < c.n) return false;
      this.grant(this.contractReward(c)); this.state.contracts.splice(i, 1);
      const g = this.state.guildRank; g.xp += 1 + c.tier;
      while (g.xp >= this.guildNeed(g.lv)) { g.xp -= this.guildNeed(g.lv); g.lv++; this.emit('onToast', `<b>Rank da Guilda ${g.lv}!</b> Contratos maiores e recompensas melhores.`); }
      this.ensureContracts();
      this.emit('onToast', 'Contrato concluído! Um novo contrato chegou.'); return true;
    }

    // ---------- missões diárias e login ----------
    ensureDaily() {
      const d = this.state.daily, key = dayKey(this.now()); if (d.date === key && d.list?.length) return;
      let seed = [...key].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 2147483647, 7);
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const pool = D.dailies.slice().sort(() => rnd() - .5).slice(0, 4);
      d.date = key; d.list = pool.map(x => ({ id:x.id, n:x.n, progress:0, claimed:false }));
    }
    dailyReward(dd) { const def = D.dailies.find(x => x.id === dd.id), P = this.farmPower(), out = {}; Object.entries(def.reward).forEach(([k, v]) => { out[k] = k === 'gold' ? Math.round(v * 500 * P) : v; }); return out; }
    claimDaily(i) {
      const dd = this.state.daily.list[i]; if (!dd || dd.claimed || dd.progress < dd.n) return false;
      dd.claimed = true; this.grant(this.dailyReward(dd));
      if (this.state.daily.list.every(x => x.claimed)) { this.grant({ crystal:5, ore:10, keys:1 }); this.emit('onToast', '<b>Todas as diárias concluídas!</b> Bônus: 5 cristais, 10 Tamahagane e 1 Chave de Convocação.'); }
      else this.emit('onToast', 'Missão diária concluída!');
      return true;
    }
    loginStatus() {
      const l = this.state.login, today = dayKey(this.now()), yesterday = dayKey(this.now() - 86400000);
      const streak = l.claimed === today ? l.streak : l.last === yesterday ? l.streak + 1 : 1;
      return { available:l.claimed !== today, streak, day:((streak - 1) % 7) + 1, reward:D.loginRewards[(streak - 1) % 7] };
    }
    claimLogin() {
      const st = this.loginStatus(); if (!st.available) return null;
      const l = this.state.login; l.streak = st.streak; l.last = dayKey(this.now()); l.claimed = l.last;
      this.grant({ ...st.reward }); return st;
    }

    // ---------- crônicas (metas infinitas depois do Guia) ----------
    riftBest() { return this.state.progress.rift?.best || 0; }
    chronicleValue(c) {
      const s = this.state;
      if (c.type === 'power') return this.getPower();
      if (c.type === 'rift') return this.riftBest();
      if (c.type === 'kills') return s.stats.kills;
      if (c.type === 'upgrade') return s.stats.upgradeTries || 0;
      if (c.type === 'bossKills') return s.stats.bossKills;
      if (c.type === 'research') return this.researchTotal();
      return 0;
    }
    ensureChronicle() {
      if (this.guideStep()) return null;
      const ch = this.state.chronicle;
      if (!ch) this.newChronicle(1);
      else if (ch.type === 'power' && ch.target > Math.max(1000, this.getPower() * 3)) this.newChronicle(ch.k);
      return this.state.chronicle;
    }
    newChronicle(k) {
      const def = D.chronicles[(k - 1) % D.chronicles.length], s = this.state;
      const cur = this.chronicleValue(def);
      const target = def.type === 'power' ? Math.ceil(cur * 1.12 / 50) * 50 : def.type === 'rift' ? Math.max(5, cur + 3) : def.type === 'kills' ? cur + 400 + k * 120
        : def.type === 'upgrade' ? cur + 3 + Math.floor(k / 3) : def.type === 'bossKills' ? cur + 1 + Math.floor(k / 8) : cur + 2;
      s.chronicle = { k, type:def.type, title:`${def.title} ${k}`, text:def.text.replace('{n}', U.fmt(def.type === 'kills' || def.type === 'upgrade' || def.type === 'bossKills' ? target - cur : target)), start:cur, target };
    }
    chronicleReward(c) { return { gold:Math.round(800 * this.farmPower() * (1 + c.k * .05)), ore:10 + c.k * 2, crystal:Math.min(25, 4 + Math.floor(c.k / 2)), ...(c.k % 10 === 0 ? { keys:1 } : {}) }; }
    claimChronicle() {
      const c = this.state.chronicle; if (!c || this.chronicleValue(c) < c.target) return false;
      this.grant(this.chronicleReward(c)); this.emit('onToast', `Crônica concluída: ${c.title}!`); this.newChronicle(c.k + 1); return true;
    }

    // ---------- builds recomendadas ----------
    autoAttr(uid) {
      const r = this.record(uid); if (!r) return 0;
      const w = KT.Builds.buildFor(r.id).attr, keys = Object.keys(w); let free = this.freeAttr(r), n = 0;
      while (free > 0) { const k = keys.slice().sort((a, b) => (r.attr[a] || 0) / w[a] - (r.attr[b] || 0) / w[b])[0]; r.attr[k] = (r.attr[k] || 0) + 1; free--; n++; }
      if (n) { this.refreshPartyUnits(); this.emit('onState'); }
      return n;
    }
    autoTalents(uid) {
      const r = this.record(uid); if (!r) return 0;
      const path = KT.Builds.buildFor(r.id).talents; let n = 0, progress = true;
      while (progress && this.heroTalentPoints(r) > 0) { progress = false; for (const id of path) { if (this.talentState(r, id).ok) { r.talents[id] = (r.talents[id] || 0) + 1; n++; progress = true; break; } } }
      if (n) { this.refreshPartyUnits(); this.emit('onState'); }
      return n;
    }
    // Valor exato do herói com um item no espaço dele: recalcula os atributos completos (o conjunto que se forma
    // ou se desfaz, cartas, refino, talentos, sinergias e buffs) e mede pelo papel da classe. null = não pode usar.
    itemValue(r, item) {
      if (!r || !item || !I.equipCheck(item, r).ok) return null;
      const s = this.state, slot = item.slot, prev = r.equipped[slot], temp = !s.inventory.some(x => x.uid === item.uid);
      const ctx = teamContext(s, formationRecords(s).filter(x => x !== r).concat(r), this.now());
      if (temp) s.inventory.push(item);
      r.equipped[slot] = item.uid;
      try { return KT.Builds.heroValue(this.template(r.id).cls, heroStats(s, r, ctx)); }
      finally { r.equipped[slot] = prev; if (temp) s.inventory.splice(s.inventory.indexOf(item), 1); }
    }
    heroValueNow(r) { const s = this.state; return KT.Builds.heroValue(this.template(r.id).cls, heroStats(s, r, teamContext(s, formationRecords(s).filter(x => x !== r).concat(r), this.now()))); }
    // Ganho relativo (0,12 = +12%) de trocar o item atual daquele espaço por este.
    itemGain(r, item) { const v = this.itemValue(r, item); if (v === null) return null; return v / Math.max(1e-9, this.heroValueNow(r)) - 1; }
    bestItemFor(r, slot, taken = new Set()) {
      const cur = this.state.inventory.find(x => x.uid === r.equipped[slot]);
      let best = null, bestScore = this.heroValueNow(r) * 1.0005;
      [...this.state.inventory, ...(this.state.storage || [])].forEach(it => {
        if (it.slot !== slot || it === cur || taken.has(it.uid)) return;
        const owner = this.ownerOf(it.uid); if (owner && owner !== r && this.state.formation.includes(owner.uid)) return;
        const sc = this.itemValue(r, it); if (sc !== null && sc > bestScore) { best = it; bestScore = sc; }
      });
      return best;
    }
    autoEquip(uid) {
      const r = this.record(uid); if (!r) return 0; let n = 0;
      Object.keys(I.slots).forEach(slot => { const it = this.bestItemFor(r, slot); if (it && this.equip(r.uid, it.uid)) n++; });
      if (n) this.refreshPartyUnits();
      return n;
    }
    autoBuild(uid) { return { attr:this.autoAttr(uid), talents:this.autoTalents(uid), items:0 }; }
    // Modo offline: sem comunidade, a Invasão rende a recompensa básica depois da janela.
    claimWorldBoss() { const w = this.wbWindow(), wb = this.state.worldBoss; if (!wb.day || wb.claimed) return false; if (w.active && w.day === wb.day && w.index === wb.window) { this.lastError = 'A recompensa sai quando a janela terminar.'; return false; } return this.grantWorldBoss({ killed:false, pct:.5 }); }

    // ---------- conselheiro: o que fazer quando a equipe travar ----------
    advice() {
      const s = this.state, tips = [], add = (prio, text, action = null, extra = {}) => tips.push({ prio, text, action, ...extra });
      const ctx = this.ctx(), zone = this.zone.kind !== 'village' ? this.zone : D.zones[s.lastHunt || 'hunt'];
      this.heroes.forEach(r => {
        const name = esc(this.template(r.id).name), fa = this.freeAttr(r), tp = this.heroTalentPoints(r);
        if (fa > 0) add(10, `<b>${name}</b> tem ${fa} ponto(s) de atributo livres.`, 'autoAttr', { uid:r.uid, label:'Distribuir (build recomendada)' });
        if (tp > 0) add(9, `<b>${name}</b> tem ${tp} ponto(s) de talento livres.`, 'autoTalents', { uid:r.uid, label:'Aprender (build recomendada)' });
        if (this.canJobChange(r)) add(8, `<b>${name}</b> pode mudar de classe (+10% atributos e Círculo III).`, 'open', { go:'hero', uid:r.uid, label:'Ver ficha' });
        const aw = awakenCost(r.stars, s.buildings.shrine);
        if (r.stars < HERO_MAX_STARS && (s.shards[r.id] || 0) >= aw.shards && s.player.gold >= aw.gold) add(8, `<b>${name}</b> pode elevar a qualidade para ${r.stars + 1}★.`, 'awaken', { uid:r.uid, label:'Elevar qualidade' });
      });
      if (!ctx.clsCount.Suporte) add(7, 'A equipe não tem <b>Suporte</b>: sem cura, lutas longas e chefes ficam muito difíceis.', 'open', { go:'party', label:'Mudar formação' });
      if (!ctx.clsCount.Vanguarda) add(7, 'A equipe não tem <b>Vanguarda</b>: o dano cai direto nos heróis frágeis.', 'open', { go:'party', label:'Mudar formação' });
      s.formation.forEach((uid, i) => { const r = uid && this.record(uid); if (!r) return; const t = this.template(r.id); if (i < 2 && ['Arcanista','Suporte','Atirador'].includes(t.cls)) add(6, `${esc(t.name)} (${t.cls}) está na linha de frente, troque com alguém mais resistente.`, 'open', { go:'party', label:'Mudar formação' }); });
      const weak = zone?.weakTo || [];
      if (weak.length) { const inTeam = this.heroes.filter(r => weak.includes(this.template(r.id).el)).length; const bench = s.collection.filter(r => !s.formation.includes(r.uid) && weak.includes(this.template(r.id).el)); if (inTeam < 2 && bench.length) add(5, `${esc(zone.title)} é fraco contra ${weak.join(', ')}. Você tem ${bench.map(r => esc(this.template(r.id).name)).slice(0, 3).join(', ')} no banco (+30% de dano).`, 'open', { go:'party', label:'Ver equipe' }); }
      const cheapTrain = Object.keys(PR.training).filter(k => (s.training[k] || 0) < PR.trainingCap(s.buildings.dojo) && s.player.gold >= PR.trainingCost(s.training[k] || 0));
      if (cheapTrain.length) add(6, `Dá para treinar a equipe no Dojo agora (${cheapTrain.map(k => PR.training[k].name).join(', ')}).`, 'open', { go:'city:dojo', label:'Ir ao Dojo' });
      const up = this.heroes.flatMap(r => Object.values(r.equipped)).map(uid => s.inventory.find(x => x.uid === uid)).filter(it => it && (it.plus || 0) < I.maxPlus(s.buildings.forge) && (() => { const c = I.upgradeCost(it, s.buildings.forge); return s.player.gold >= c.gold && s.player.ore >= c.ore; })());
      if (up.length) add(5, `${up.length} equipamento(s) da equipe podem ser aprimorados na Forja agora.`, 'open', { go:'city:forge', label:'Ir à Forja' });
      // Onde treinar com segurança.
      const hz = D.zones[s.lastHunt || 'hunt'], pow = this.getPower();
      if (hz?.kind === 'hunt') { let safe = 1; for (let n = 1; n <= Math.min(hz.stages, (s.progress[hz.id]?.best || 0) + 1); n++) if (this.recommendedPower(hz.id, { stage:n }) <= pow * 1.05) safe = n; add(4, `Treine no <b>estágio ${safe}</b> de ${esc(hz.title)} (poder seguro) com o Avanço desligado para juntar EXP, ouro e itens.`, 'farm', { zone:hz.id, stage:safe, label:`Treinar no ${safe}` }); }
      Object.values(D.zones).filter(z => (z.kind === 'hunt' || z.kind === 'dungeon') && z.side && !this.zoneLock(z.id).locked && (s.progress[z.id]?.best || 0) < (z.stages || z.floors)).slice(0, 2)
        .forEach(z => add(3, `Explore <b>${esc(z.title)}</b>: monstros diferentes e um conjunto próprio (${esc(I.sets.find(st => st.source.includes(z.title.split(' ').pop()))?.name || 'itens novos')}).`, 'open', { go:`destination:${z.id}`, label:'Ver região' }));
      if (!this.zoneLock('rift').locked) add(2, 'A <b>Fenda Abissal</b> dá Tamahagane e itens em qualquer andar, ótima para fortalecer sem travar.', 'open', { go:'destination:rift', label:'Ver Fenda' });
      if (s.settings.auto) add(2, 'Com o <b>AUTO</b> desligado você decide a hora das ultimates, guarde escudos e curas para quando o chefe mostrar ⚠.');
      return tips.sort((a, b) => b.prio - a.prio);
    }
    applyAdvice(tip) {
      if (!tip) return false;
      if (tip.action === 'autoAttr') return this.autoAttr(tip.uid) > 0;
      if (tip.action === 'autoTalents') return this.autoTalents(tip.uid) > 0;
      if (tip.action === 'autoEquip') return this.autoEquip(tip.uid) > 0;
      if (tip.action === 'awaken') return this.awaken(tip.uid);
      if (tip.action === 'farm') { this.state.settings.autoAdvance = false; return this.enterZone(tip.zone, { stage:tip.stage }); }
      return false;
    }
    achievementValue(a) {
      const s = this.state;
      if (a.stat === 'unique') return new Set(s.collection.map(h => h.id)).size;
      if (a.stat === 'maxLevel') return Math.max(0, ...s.collection.map(h => h.level));
      if (a.stat === 'maxStars') return Math.max(0, ...s.collection.map(h => h.stars));
      if (a.stat === 'bondsActive') return this.ctx().bonds.length;
      if (a.stat === 'riftBest') return this.riftBest();
      if (a.stat === 'research') return this.researchTotal();
      return s.stats[a.stat] || 0;
    }
    claimAchievement(id) {
      const a = D.achievements.find(x => x.id === id); if (!a || this.state.achievements[id] || this.achievementValue(a) < a.n) return false;
      this.state.achievements[id] = true; const r = { ...a.reward }; if (r.key) { r.keys = r.key; delete r.key; } this.grant(r);
      this.emit('onToast', `Conquista: ${a.title}!`); return true;
    }

    // ---------- offline ----------
    offlineGains(now = KT.Clock.now()) {
      const s = this.state, elapsed = Math.max(0, Math.floor((now - (s.lastSeen || now)) / 1000)), capped = Math.min(elapsed, 12 * 3600);
      if (capped < 120 || this.heroes.length < 4) return null;
      const zid = D.zones[s.lastHunt]?.kind === 'hunt' ? s.lastHunt : 'hunt', z = D.zones[zid], stage = Math.max(1, s.progress[zid]?.best || 1), P = zonePower(z, { stage });
      const killsPerSec = .16; // AFK rende bem menos que jogar (ativo: ~0,5 a 1 abate/s)
      const kills = Math.floor(capped * killsPerSec);
      const gold = this.goldIn(kills * 11 * Math.pow(P, .85) * .35 * (1 + this.mod('gold')));
      const xp = Math.round(kills * 14 * Math.pow(P, .92) * .3 * (1 + this.mod('xp')));
      s.player.gold += gold; s.stats.goldEarned += gold;
      this.giveXp(xp, enemyLevel(P), kills);
      const items = [];
      const nItems = Math.min(6, Math.floor(capped / 2400));
      for (let i = 0; i < nItems; i++) { const it = I.rollDrop(U.random() < .15 ? 'elite' : 'normal', z, itemLevelFor(z, { stage }), 0, this.preferWT()); this.addItem(it); items.push(it); }
      const ore = Math.floor(capped / 900), dust = Math.floor(capped / 800);
      s.player.ore += ore; s.player.dust += dust;
      return { seconds:capped, gold, xp, items, ore, dust };
    }

    save() { return saveState(this.state); }
    resetSave() { [saveKey, `${saveKey}:a`, `${saveKey}:b`, `${saveKey}:active`].forEach(k => U.safeStorage.remove(k)); }
  }

  KT.State = { itemLevelFor:itemLevelFor, BOSS_LOOT_PER_DAY, DAILY_MAT_CAP, BREAK, CHAIN, houseStats, albumIds, buffStats, DT, MAX_SPEED, setSaveKey, createState, loadState, saveState, mergeState, heroStats, statPower, teamContext, formationRecords, powerScore, heroScore, POWER_EXP, heroXpNext, classXpNext, accountXpNext, enemyLevel, xpFactor, XP_RULES, heroMaxLevel, awakenCost, zonePower, itemLevelFor, activeEvent, upcomingEvents, dayKey, CHOICE_WAIT, newHeroRecord, SAVE_KEY, ULT_COST };
  KT.CombatEngine = CombatEngine;
})();
