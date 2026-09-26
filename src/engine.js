(() => {
  const KT = globalThis.KT = globalThis.KT || {};
  const D = KT.Data, U = KT.Utils, I = KT.Items, PR = KT.Progression;
  const SAVE_KEY = 'mythverse-save-v1';
  let saveKey = SAVE_KEY;
  const setSaveKey = k => { saveKey = k || SAVE_KEY; };
  const ULT_COST = 100;
  const OFFENSIVE = new Set(['dmg','st']);
  const CC = new Set(['stun','freeze']);
  const DEBUFFS = new Set(['burn','poison','bleed','stun','freeze','slow','armorBreak','mark','weaken','silence']);
  const DOTS = new Set(['burn','poison','bleed']);
  const HERO_MAX_STARS = 6;

  // ===========================================================================
  // ESTADO
  // ===========================================================================
  function createState() {
    return {
      version:3,
      player:{ name:'Viajante', level:1, xp:0, gold:0, crystal:0, dust:0, ore:0, gems:0, keys:0 },
      starterRolls:10, boxesOpened:0, pity:0,
      formation:[null, null, null, null], collection:[], shards:{},
      inventory:[], invCap:80, consumables:{ potion:0, elixir:0, scroll:0 }, cards:{},
      progress:{ hunt:{ best:0, cur:1 }, hunt_tide:{ best:0, cur:1 }, dungeon:{ best:0, cur:1 }, dungeon_tide:{ best:0, cur:1 }, boss:{ kills:0, tier:0, tierKills:[0, 0, 0] }, boss_tide:{ kills:0, tier:0, tierKills:[0, 0, 0] }, boss_event:{ kills:0, tier:0, tierKills:[0, 0, 0] } },
      zone:'village', lastHunt:'hunt',
      settings:{ auto:true, autoAdvance:true, autoRepeat:true, speed:1, sound:false, autoSalvage:'none' },
      stats:{ kills:0, elites:0, bossKills:0, stages:0, floors:0, ults:0, manualUlts:0, loot:0, salvage:0, encounters:0, legendaries:0, maxUpgrade:0, upgrades:0, goldEarned:0, deaths:0 },
      talents:{}, training:{ atk:0, hp:0, def:0, crit:0 },
      buildings:{ forge:1, dojo:1, shrine:1, workshop:1, guild:1, market:1 },
      guide:{ claimed:{}, flags:{} }, contracts:[], achievements:{}, contractCounters:{},
      market:{ offers:[], refreshedAt:0 }, boostUntil:0, freeRespec:1,
      story:{ seen:{} }, codex:{ enemies:[] },
      lastSeen:Date.now(), totalPlaySeconds:0, created:Date.now()
    };
  }

  function newHeroRecord(template, rarity = 'rare') {
    const stars = { common:1, rare:2, epic:3, legendary:4 }[rarity] || 1;
    return { uid:U.uid('hero'), id:template.id, rarity, stars, level:1, xp:0, job:0, talents:{}, attr:{ str:0, agi:0, vit:0, int:0, dex:0, luk:0 }, equipped:{ weapon:null, focus:null, seal:null, charm:null } };
  }

  function mergeState(raw) {
    const fresh = createState();
    if (!raw || raw.version !== 3) return fresh;
    const s = { ...fresh, ...raw };
    for (const k of ['player','settings','stats','training','buildings','consumables','guide','market','story','codex']) s[k] = { ...fresh[k], ...(raw[k] || {}) };
    s.progress = { ...fresh.progress }; Object.keys(raw.progress || {}).forEach(k => { s.progress[k] = { ...(fresh.progress[k] || {}), ...raw.progress[k] }; });
    s.collection = (raw.collection || []).filter(h => D.roster.some(t => t.id === h.id)).map(h => ({ ...newHeroRecord(D.roster.find(t => t.id === h.id), h.rarity), ...h, attr:{ ...fresh.collection[0]?.attr, str:0, agi:0, vit:0, int:0, dex:0, luk:0, ...(h.attr || {}) }, equipped:{ weapon:null, focus:null, seal:null, charm:null, ...(h.equipped || {}) } }));
    const uids = new Set(s.collection.map(h => h.uid));
    s.formation = [0, 1, 2, 3].map(i => (raw.formation || [])[i] && uids.has(raw.formation[i]) ? raw.formation[i] : null);
    s.inventory = (raw.inventory || []).filter(it => it && it.slot && I.slots[it.slot]).map(it => ({ cards:[], ...it }));
    s.cards = { ...(raw.cards || {}) };
    s.collection.forEach(h => { h.talents = h.talents || {}; h.job = h.job || 0; });
    return s;
  }
  function loadState(raw) { try { if (raw === undefined) raw = U.safeStorage.get(saveKey); return mergeState(raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null); } catch (_) { return createState(); } }
  function saveState(state) { state.lastSeen = Date.now(); const json = JSON.stringify(state); const ok = U.safeStorage.set(saveKey, json); try { KT.Cloud?.onLocalSave?.(state, json); } catch (_) {} return ok; }

  // ===========================================================================
  // CURVAS
  // ===========================================================================
  const heroXpNext = lvl => Math.round(60 * lvl * Math.pow(1.14, lvl - 1));
  const accountXpNext = lvl => Math.round(250 * Math.pow(1.2, lvl - 1));
  const heroMaxLevel = stars => 12 + stars * 8;
  const awakenCost = (stars, shrineLv) => ({ shards:[0, 10, 20, 40, 70, 110][stars] || 999, gold:Math.round(1500 * Math.pow(2.2, stars - 1) * (1 - Math.min(.4, (shrineLv - 1) * .05))) });
  const zonePower = (zone, opts = {}) => {
    if (zone.kind === 'hunt') return zone.basePower * Math.pow(D.STAGE_GROWTH, (opts.stage || 1) - 1);
    if (zone.kind === 'dungeon') return zone.floorPower[(opts.floor || 1) - 1] || zone.floorPower[0];
    if (zone.kind === 'boss') return zone.power * (D.bossTiers[opts.tier || 0]?.mult || 1);
    return 1;
  };
  const itemLevelFor = (zone, opts = {}) => {
    if (zone.kind === 'hunt') return zone.ilvl + (opts.stage || 1) - 1;
    if (zone.kind === 'dungeon') return zone.ilvl + ((opts.floor || 1) - 1) * 3;
    if (zone.kind === 'boss') return zone.ilvl + (opts.tier || 0) * 5;
    return 1;
  };

  function activeEvent(now = Date.now()) {
    const idx = Math.floor(now / D.EVENT_BLOCK_MS) % D.worldEvents.length;
    const ends = (Math.floor(now / D.EVENT_BLOCK_MS) + 1) * D.EVENT_BLOCK_MS;
    const next = D.worldEvents[(idx + 1) % D.worldEvents.length];
    return { ...D.worldEvents[idx], ends, next };
  }

  // ===========================================================================
  // CÁLCULO DE ATRIBUTOS DOS HERÓIS
  // ===========================================================================
  function mergeStats(target, add, mult = 1) { Object.entries(add || {}).forEach(([k, v]) => { target[k] = (target[k] || 0) + v * mult; }); return target; }
  function teamContext(state, records) {
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
    return { teamStats, clsSyn, elSyn, bonds, elCount, clsCount };
  }

  function heroStats(state, rec, ctx) {
    const t = D.roster.find(x => x.id === rec.id), c = D.classes[t.cls];
    ctx = ctx || teamContext(state, formationRecords(state));
    const growth = Math.pow(1.065, rec.level - 1);
    const rar = D.heroRarities.find(r => r.id === rec.rarity)?.mult || 1;
    const star = 1 + (rec.stars - 1) * .12;
    const base = { hp:c.base.hp * (t.prof.hp || 1), atk:c.base.atk * (t.prof.atk || 1), def:c.base.def * (t.prof.def || 1) };
    const s = { spd:c.base.spd, crit:c.base.crit, critDmg:c.base.critDmg, dodge:c.base.dodge, lifesteal:0, dr:0, regen:0, healPow:0, dot:0, boss:0, pierce:0, skill:0, nrg:0, cdr:0, startNrg:0, elem:0, ultDmg:0, thorns:0, skillMastery:0 };
    const pctAdd = { hp:0, atk:0, def:0 }; const flat = { hp:0, atk:0, def:0 };
    const add = (stats, m = 1) => Object.entries(stats || {}).forEach(([k, v]) => {
      if (k === 'hpFlat') flat.hp += v * m; else if (k === 'atkFlat') flat.atk += v * m; else if (k === 'defFlat') flat.def += v * m;
      else if (k === 'hp' || k === 'atk' || k === 'def') pctAdd[k] += v * m;
      else if (k === 'spd') s.spd += c.base.spd * v * m;
      else if (k in s) s[k] += v * m;
    });
    add(c.traitStats);
    add(t.passive.hooks.stats);
    Object.entries(rec.attr || {}).forEach(([k, n]) => add(PR.attributes[k]?.per, n));
    add(ctx.teamStats);
    ctx.elSyn.forEach(e => e.tiers.forEach(tier => { if (tier.n === 4 || e.el === t.el) add(tier.stats); }));
    ctx.bonds.forEach(b => { if (b.ids.includes(t.id)) add(b.stats); });
    const tree = PR.classTrees[t.cls] || [], talentHooks = [];
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
    });
    const sets = [];
    Object.entries(setCount).forEach(([id, n]) => { const set = I.sets.find(x => x.id === id); if (!set) return; const active = []; if (n >= 2) { add(set.bonus2.stats); active.push(2); } if (n >= 4) { add(set.bonus4.stats); if (set.bonus4.hook) hooks.push(set.bonus4.hook); active.push(4); } sets.push({ set, n, active }); });
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
      this.ensureContracts();
    }
    emit(name, payload) { try { this.events?.[name]?.(payload); } catch (err) { console.warn(err); } }

    // ---------- conveniências ----------
    get heroes() { return formationRecords(this.state); }
    template(id) { return D.roster.find(t => t.id === id); }
    record(uid) { return this.state.collection.find(h => h.uid === uid); }
    ctx() { return teamContext(this.state, this.heroes); }
    heroStats(rec, ctx) { return heroStats(this.state, rec, ctx); }
    heroPower(rec, ctx) { return statPower(this.heroStats(rec, ctx)); }
    getPower() { const ctx = this.ctx(); return this.heroes.reduce((s, r) => s + statPower(heroStats(this.state, r, ctx)), 0); }
    event() { return activeEvent(); }
    mod(key) { const ev = activeEvent(); let v = ev.mods?.[key] || 0; if (key === 'gold' || key === 'xp') { v += this.state.boostUntil > Date.now() ? .5 : 0; } if (key === 'gold') v += (this.state.buildings.guild - 1) * .03; if (key === 'xp') v += (this.state.buildings.dojo - 1) * .04; if (key === 'drop') v += (this.stageMods.drop || 0); return v; }

    recommendedPower(zoneId, opts = {}) {
      const z = D.zones[zoneId]; if (!z || z.kind === 'village') return 0;
      const P = zonePower(z, opts);
      const ref = z.kind === 'boss' ? 3.1 : z.kind === 'dungeon' ? 1.35 : 1;
      return Math.round(6500 * P * Math.min(1, .25 + .1 * P) * ref / 100) * 100;
    }

    // ---------- desbloqueios ----------
    zoneLock(zoneId) {
      const z = D.zones[zoneId], s = this.state, reasons = [];
      if (!z) return { locked:true, reasons:['Região desconhecida'] };
      if (z.kind === 'village') return { locked:false, reasons };
      if (this.heroes.length < 4) reasons.push({ text:'Equipe com 4 heróis', met:false });
      Object.entries(z.unlock?.stage || {}).forEach(([id, n]) => reasons.push({ text:`Vencer ${D.zones[id].title} — estágio ${n}`, met:(s.progress[id]?.best || 0) >= n }));
      Object.entries(z.unlock?.floor || {}).forEach(([id, n]) => reasons.push({ text:`Conquistar ${D.zones[id].title} — andar ${['I','II','III'][n - 1]}`, met:(s.progress[id]?.best || 0) >= n }));
      Object.entries(z.unlock?.kills || {}).forEach(([id, n]) => reasons.push({ text:`Derrotar ${D.enemies[D.zones[id].enemy].name.split(',')[0]}`, met:(s.progress[id]?.kills || 0) >= n }));
      if (z.event) reasons.push({ text:`Evento ativo: ${D.worldEvents.find(e => e.id === z.event).name}`, met:activeEvent().id === z.event });
      return { locked:reasons.some(r => !r.met), reasons };
    }
    getZoneRequirements(zoneId) { return this.zoneLock(zoneId).reasons.map(r => ({ label:r.text, met:r.met })); }

    // ---------- entrar em região ----------
    enterZone(zoneId, opts = {}) {
      const z = D.zones[zoneId]; if (!z) return false;
      const lock = this.zoneLock(zoneId);
      if (lock.locked) { this.emit('onToast', `Bloqueado: ${lock.reasons.filter(r => !r.met).map(r => r.text).join(' · ')}.`); return false; }
      const p = this.state.progress[zoneId];
      if (z.kind === 'hunt') { const max = Math.min(z.stages, (p.best || 0) + 1); opts.stage = U.clamp(opts.stage || p.cur || 1, 1, max); p.cur = opts.stage; this.state.lastHunt = zoneId; }
      if (z.kind === 'dungeon') { opts.floor = U.clamp(opts.floor || p.cur || 1, 1, Math.min(z.floors, (p.best || 0) + 1)); p.cur = opts.floor; }
      if (z.kind === 'boss') { const unlockedTier = D.bossTiers.filter(t => !t.needKills || (p.kills || 0) >= t.needKills).length - 1; opts.tier = U.clamp(opts.tier ?? p.tier ?? 0, 0, unlockedTier); p.tier = opts.tier; }
      this.zone = z; this.opts = opts; this.state.zone = zoneId; this.zoneElapsed = 0;
      this.enemies = []; this.party = []; this.focusUid = null; this.pendingRoute = null; this.pendingEncounter = null;
      this.runLoot = []; this.runGold = 0; this.runXp = 0;
      if (!this.state.codex.discovered) this.state.codex.discovered = {};
      if (z.kind === 'village') { this.active = false; this.phase = 'idle'; this.emit('onZone', z); return true; }
      this.active = true;
      this.state.guide.flags[`entered_${zoneId}`] = true;
      this.emit('onZone', z);
      if (!this.state.story.seen[`zone_${zoneId}`] && D.story.zone[zoneId]) { this.state.story.seen[`zone_${zoneId}`] = true; this.emit('onDialog', D.story.zone[zoneId]); }
      this.startRun();
      return true;
    }

    startRun() {
      const ctx = this.ctx();
      this.party = this.state.formation.map((uid, slot) => { const rec = uid && this.record(uid); return rec ? this.makeHeroUnit(rec, slot, ctx) : null; }).filter(Boolean);
      this.wave = 0; this.room = 0; this.bossPhase = 0; this.stageMods = {}; this.encounterUsed = false; this.potionCd = 0; this.elixirCd = 0;
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
      const ev = activeEvent(); const atkMod = 1 + (ev.mods?.enemyAtk || 0);
      const lvl = Math.max(1, Math.round(1 + Math.log(P) / Math.log(1.065)));
      if (!this.state.codex.enemies.includes(id)) this.state.codex.enemies.push(id);
      const u = { uid:U.uid('en'), side:'enemy', id, name:t.name, sprite:t.sprite, el:t.el, cls:t.role, color:D.elements[t.el].color, t,
        st:{ atk:t.atk * (t.atkMul || 1) * P * atkMod, baseAtk:t.atk * P, def:t.def * P, spd:t.spd, crit:t.crit || .05, critDmg:1.5, dodge:t.dodge || 0, lifesteal:t.lifesteal || 0, dr:0, regen:t.regen || 0, healPow:0, dot:0, boss:0, pierce:0, skill:0, nrg:0, cdr:0, elem:0, ultDmg:0 },
        maxHp:Math.round(t.hp * (t.hpMul || 1) * P), hp:Math.round(t.hp * (t.hpMul || 1) * P), shield:0, shieldT:0, energy:0, atkCd:U.rand(.5, 1.2), skillCd:(t.skill?.cd || 99) * U.rand(.4, .8),
        effects:[], counters:{ atk:0 }, flags:{}, alive:true, thorns:t.thorns || 0, elite:!!t.elite, boss:!!t.boss, miniboss:!!t.miniboss, treasure:!!t.treasure, level:lvl, P,
        specials:[], windup:0, windupMax:0, windupSpecial:null, hooks:{}, spawnT:0, ...extra };
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
        const ids = [];
        if (guardian) {
          ids.push(z.elites[(stage - 1) % z.elites.length]);
          if (stage % 4 === 0 || stage >= 12) ids.push(z.elites[stage % z.elites.length]);
          while (ids.length < Math.min(4, count)) ids.push(U.pick(z.pool));
        } else for (let i = 0; i < count; i++) ids.push(U.pick(z.pool));
        this.enemies = ids.map((id, i) => this.makeEnemyUnit(id, P, { guardian:guardian && i === 0 }));
        this.emit('onWave', { label:guardian ? `Guardião do estágio ${stage}` : `Onda ${this.wave}/4`, detail:guardian ? this.enemies[0].name : `${ids.length} inimigos`, guardian });
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
        if (this.room === 3) { this.pendingRoute = 'dungeon'; this.emit('onChoice', { kind:'route', title:z.id === 'dungeon_tide' ? 'Encruzilhada do Arquivo' : 'Encruzilhada do Templo', options:[{ id:'risk', label:'Passagem Carmesim', desc:'Inimigos +20% fortes nas próximas salas, +60% chance de itens e baú extra.' }, { id:'safe', label:'Galeria Silenciosa', desc:'Recupera 35% do HP de todos e revive heróis caídos.' }] }); }
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

    chooseRoute(choice) {
      if (this.pendingRoute !== 'dungeon') return;
      this.state.routeChoice = choice;
      if (choice === 'safe') this.party.forEach(u => { if (!u.alive) { u.alive = true; u.hp = 1; } u.hp = Math.min(u.maxHp, u.hp + u.maxHp * .35); });
      else { this.stageMods.drop = (this.stageMods.drop || 0) + .6; this.enemies.forEach(e => { e.maxHp *= 1.2; e.hp *= 1.2; e.st.atk *= 1.2; }); }
      this.pendingRoute = null;
      this.emit('onLog', { text:choice === 'risk' ? 'A equipe entrou na Passagem Carmesim.' : 'A equipe descansou na Galeria Silenciosa.', type:'system' });
    }

    // ---------- loop principal ----------
    update(dtReal) {
      const dt = Math.min(.08, dtReal) * (this.state.settings.speed || 1);
      this.time += dt; this.state.totalPlaySeconds += dtReal;
      if (!this.active || this.paused || this.pendingRoute || this.pendingEncounter) return;
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
      if (this.zone.kind === 'boss') this.tickBossTimer(dt);
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
      if (boss.summon) { boss.summon.t -= dt; if (boss.summon.t <= 0) { boss.summon.t = boss.summon.every; const alive = this.enemies.filter(e => e.alive).length; const n = Math.min(boss.summon.n, 5 - alive); for (let k = 0; k < n; k++) this.enemies.push(this.makeEnemyUnit(boss.summon.id, boss.P * .55)); if (n > 0) this.emit('onLog', { text:`${boss.name.split(',')[0]} invocou reforços!`, type:'boss' }); } }
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
    canAct(u) { return u.alive && !u.effects.some(e => CC.has(e.s)); }
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
      if (u.cls === 'Suporte') this.party.forEach(h => { if (h !== u && h.alive) this.gainEnergy(h, 8); });
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
      this.execute(u, u.template.ult.eff, { isUlt:true });
      this.fire(u, 'onUlt', {});
      this.emit('onFx', { type:'hitstop', time:manual ? .12 : .06 });
      this.emit('onState');
      return true;
    }
    useSkill(i, manual = true) { return this.castUlt(i, manual); }

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
        const supportive = !(e.k === 'dmg' || e.k === 'st' || (e.k === 'nrg' && e.v < 0));
        if (e.k === 'dmg') {
          const hits = e.hits || 1;
          for (let h = 0; h < hits; h++) {
            const targets = this.resolve(u, e.to, ctx, false);
            targets.forEach(tg => { dealt += Math.max(0, this.hit(u, tg, e.m / (e.to === 'randEach' ? 1 : 1), { kind, pierce:e.pierce, crit:e.crit, exec:e.exec, dodgeable:e.to !== 'all' && kind === 'proc' })); });
            if (targets.length) ctx.target = ctx.target || targets[0];
          }
          if (kind !== 'proc') this.emit('onFx', { type:e.to === 'all' ? 'aoe' : 'burst', source:u.uid, target:(ctx.target || {}).uid, color:u.color });
          continue;
        }
        const targets = this.resolve(u, e.to || 'self', ctx, supportive);
        switch (e.k) {
          case 'st': targets.forEach(tg => this.applyStatus(u, tg, e)); break;
          case 'heal': targets.forEach(tg => this.heal(u, tg, (e.p ? tg.maxHp * e.p : this.stat(u, 'atk') * e.m) * (ctx.isSkill ? 1 + (u.st.skillMastery || 0) : 1))); break;
          case 'shield': targets.forEach(tg => { const amt = (e.p ? tg.maxHp * e.p : this.stat(u, 'atk') * e.m) * (1 + (u.st.healPow || 0)); tg.shield = Math.min(tg.maxHp * .7, tg.shield + amt); tg.shieldT = Math.max(tg.shieldT, e.d || 6); this.emit('onFx', { type:'shield', uid:tg.uid, value:Math.round(amt) }); }); break;
          case 'buff': targets.forEach(tg => this.addEffect(tg, { s:e.s, v:e.v, d:e.d, stackMax:e.stack, src:u })); break;
          case 'nrg': targets.forEach(tg => { if (tg.side === 'hero') tg.energy = U.clamp(tg.energy + e.v, 0, ULT_COST); }); break;
          case 'cleanse': targets.forEach(tg => { tg.effects = tg.effects.filter(x => !DEBUFFS.has(x.s)); this.emit('onFx', { type:'text', uid:tg.uid, text:'PURIFICADO', color:'#bff4ff' }); }); break;
          case 'taunt': this.addEffect(u, { s:'taunt', v:1, d:e.d, src:u }); break;
          case 'drain': if (dealt > 0) this.heal(u, u, dealt * e.v, true); break;
          case 'revive': { const dead = (u.side === 'hero' ? this.party : this.enemies).find(x => !x.alive && !x.fled); if (dead) { dead.alive = true; dead.hp = Math.round(dead.maxHp * e.p); dead.effects = []; this.emit('onFx', { type:'revive', uid:dead.uid }); this.emit('onLog', { text:`${dead.name} foi revivido!`, type:'skill' }); } break; }
          case 'cdr': targets.forEach(tg => { tg.skillCd = Math.max(0, tg.skillCd - e.v); }); break;
          case 'cdreset': u.skillCd = 0; break;
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
      if (!tg.alive || Math.random() > (e.ch ?? 1)) return;
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
      if (o.dodgeable && Math.random() < this.stat(tg, 'dodge')) {
        this.emit('onFx', { type:'text', uid:tg.uid, text:'ESQUIVA', color:'#9ce9cc' });
        this.fire(tg, 'onDodge', { attacker:src });
        return -1;
      }
      let raw = this.stat(src, 'atk') * mult;
      if (o.kind === 'skill' || o.kind === 'ult') raw *= 1 + (src.st.skill || 0);
      if (o.kind === 'skill') raw *= 1 + (src.st.skillMastery || 0);
      if (o.kind === 'ult') raw *= 1 + (src.st.ultDmg || 0);
      const critChance = this.stat(src, 'crit') + (o.crit || 0);
      const crit = Math.random() < critChance;
      if (crit) raw *= this.stat(src, 'critDmg') + (this.has(tg, 'bleed') ? .1 : 0);
      const em = this.elemMult(src.el, tg.el); raw *= em === 1.3 ? 1.3 + (src.st.elem || 0) : em;
      (src.hooks?.vs || []).forEach(v => { if (this.has(tg, v.s)) raw *= 1 + v.v; });
      if (tg.boss || tg.miniboss) raw *= 1 + (src.st.boss || 0);
      if (src.cls === 'Atirador' && src.row === 'back') raw *= 1.15;
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
      const final = this.applyRawDamage(tg, dmg, src, { crit, kind:o.kind, elem:em });
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
        if (killer.cls === 'Executor') this.gainEnergy(killer, 20);
      }
      this.rewardKill(tg);
    }

    fire(u, hook, ctx) {
      if (!u?.alive || !u.hooks) return;
      (u.hooks[hook] || []).forEach(h => { if (h.ch !== undefined && Math.random() > h.ch) return; this.execute(u, h.eff, { ...ctx, proc:true }); });
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
      if (!this.party.some(u => u.alive)) { this.onDefeat(); return; }
      if (this.enemies.some(e => e.alive)) return;
      const z = this.zone;
      if (z.kind === 'hunt') {
        if (this.wave < 4) {
          this.party.forEach(u => { if (u.alive) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * .08); });
          const chance = (.1 + (activeEvent().mods?.encounter ? .1 : 0));
          if (this.wave === 2 && !this.encounterUsed && Math.random() < chance) { this.encounterUsed = true; this.triggerEncounter(); return; }
          this.phase = 'between'; this.timer = 1.1;
        } else this.stageClear();
      } else if (z.kind === 'dungeon') {
        this.party.forEach(u => { if (u.alive) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * .1); });
        if (this.room < 5) { this.phase = 'between'; this.timer = 1.4; }
        else this.floorClear();
      } else if (z.kind === 'boss') this.bossClear();
    }

    stageClear() {
      const z = this.zone, p = this.state.progress[z.id], stage = this.opts.stage;
      this.state.stats.stages++; this.count('stages');
      const first = stage > (p.best || 0);
      const rewards = { gold:0, crystal:0, keys:0, items:[] };
      if (first) {
        p.best = stage;
        rewards.crystal = 5 + stage * 2 + (z.chapter - 1) * 20;
        rewards.gold = Math.round(150 * zonePower(z, { stage }));
        if (stage % 4 === 0) rewards.keys = 1;
        if (stage === z.stages) { rewards.keys += 1; rewards.items.push(I.rollDrop('guardian', z, itemLevelFor(z, { stage }) + 1, .5)); }
        this.grant(rewards);
      }
      this.emit('onStageClear', { zone:z, stage, first, rewards });
      this.phase = 'stageClear'; this.timer = 1.8;
      this.nextStage = this.state.settings.autoAdvance ? Math.min(z.stages, stage + 1) : stage;
    }
    afterStageClear() {
      const p = this.state.progress[this.zone.id];
      this.opts.stage = this.nextStage || this.opts.stage; p.cur = this.opts.stage;
      this.startRun();
    }
    floorClear() {
      const z = this.zone, p = this.state.progress[z.id], floor = this.opts.floor, ilvl = itemLevelFor(z, { floor });
      const first = floor > (p.best || 0);
      const items = [I.rollDrop('chest', z, ilvl, this.mod('drop'))];
      if (this.state.routeChoice === 'risk') items.push(I.rollDrop('chest', z, ilvl, this.mod('drop')));
      const rewards = { gold:Math.round(400 * zonePower(z, { floor })), crystal:first ? 30 + floor * 15 : 0, keys:first ? 1 : (Math.random() < .12 ? 1 : 0), items };
      if (first) p.best = floor;
      this.grant(rewards);
      this.state.stats.floors++; this.count('floors');
      this.state.routeChoice = null;
      this.showResult({ kind:'dungeon', zone:z, floor, first, rewards, loot:this.runLoot.slice(), gold:this.runGold, xp:this.runXp });
    }
    bossClear() {
      const z = this.zone, p = this.state.progress[z.id], tier = this.opts.tier || 0, tr = D.bossTiers[tier];
      const firstKill = (p.kills || 0) === 0;
      p.kills = (p.kills || 0) + 1; p.tierKills[tier] = (p.tierKills[tier] || 0) + 1;
      this.state.stats.bossKills++;
      const ilvl = itemLevelFor(z, this.opts);
      const items = [I.rollDrop('boss', z, ilvl, this.mod('drop') + tier * .5), I.rollDrop('boss', z, ilvl, this.mod('drop') + tier * .5)];
      if (tier > 0) items.push(I.rollDrop('boss', z, ilvl, 1));
      const rewards = { gold:Math.round(2500 * zonePower(z, this.opts) / 3 * tr.reward), crystal:Math.round((firstKill ? 150 : 25) * tr.reward), keys:z.id === 'boss_event' ? 1 : firstKill ? 2 : (Math.random() < .35 ? 1 : 0), items };
      this.grant(rewards);
      if (firstKill && D.story.bossWin[z.id]) this.emit('onDialog', D.story.bossWin[z.id]);
      this.showResult({ kind:'boss', zone:z, tier, first:firstKill, rewards, boss:D.enemies[z.enemy].name, loot:this.runLoot.slice(), gold:this.runGold, xp:this.runXp });
    }
    showResult(r) {
      this.phase = 'result'; this.timer = 5; this.lastResult = r;
      this.emit('onResult', r);
      if (this.state.settings.autoRepeat && r.kind !== 'defeat') this.autoAfterResult = () => this.repeatRun();
      else if (r.kind === 'defeat') this.autoAfterResult = () => this.fallbackToHunt();
      if (r.kind === 'defeat') this.timer = 8;
    }
    repeatRun() { this.emit('onResultClose'); this.runLoot = []; this.runGold = 0; this.runXp = 0; this.startRun(); }
    fallbackToHunt() { this.emit('onResultClose'); const h = this.state.lastHunt || 'hunt'; this.enterZone(h, { stage:Math.max(1, this.state.progress[h].best || 1) }); }
    onDefeat() {
      this.state.stats.deaths++;
      const z = this.zone;
      if (z.kind === 'hunt') {
        const stage = this.opts.stage, back = Math.max(1, stage - 1);
        this.phase = 'defeat'; this.timer = 3;
        this.nextStage = back;
        this.state.settings.autoAdvance = false;
        this.emit('onDefeatHunt', { stage, back });
        this.emit('onLog', { text:`A equipe caiu no estágio ${stage}. Recuando para o estágio ${back} para treinar.`, type:'system' });
      } else {
        this.showResult({ kind:'defeat', zone:z, room:this.room, loot:this.runLoot.slice(), gold:this.runGold, xp:this.runXp });
      }
    }
    afterDefeat() { const p = this.state.progress[this.zone.id]; this.opts.stage = this.nextStage; p.cur = this.nextStage; this.startRun(); }

    // ---------- encontros ----------
    triggerEncounter() {
      const enc = U.weighted(D.encounters, e => e.weight);
      this.state.stats.encounters++; this.count('encounters');
      const ilvl = itemLevelFor(this.zone, this.opts);
      if (enc.id === 'gold_fox') { this.enemies = [this.makeEnemyUnit('fox_gold', zonePower(this.zone, this.opts))]; this.phase = 'fight'; this.emit('onWave', { label:enc.name, detail:enc.text, special:true }); return; }
      if (enc.id === 'ambush') { const z = this.zone; const P = zonePower(z, this.opts) * 1.1; this.enemies = [z.elites[0], z.elites[1], U.pick(z.pool)].map(id => this.makeEnemyUnit(id, P, { ambush:true })); this.stageMods.drop = (this.stageMods.drop || 0) + .5; this.phase = 'fight'; this.emit('onWave', { label:enc.name, detail:enc.text, special:true }); return; }
      let options;
      if (enc.id === 'merchant') {
        const offers = [0, 1, 2].map(() => { const it = I.makeItem({ ilvl:ilvl + 1, rarity:Math.random() < .25 ? 'legendary' : Math.random() < .6 ? 'epic' : 'rare' }); return { item:it, price:Math.round(I.itemScore(it) * 3 + 200 * zonePower(this.zone, this.opts)) }; });
        options = offers.map((o, i) => ({ id:`buy${i}`, label:`${o.item.name}`, desc:`${D.rarities.find(r => r.id === o.item.rarity).label} · Nível ${o.item.ilvl} · ${o.price.toLocaleString('pt-BR')} ouro`, item:o.item, price:o.price })).concat([{ id:'leave', label:'Seguir viagem', desc:'Não comprar nada.' }]);
      } else if (enc.id === 'shrine') options = D.blessings.map(b => ({ id:b.id, label:b.name, desc:b.text }));
      else options = [{ id:'open', label:'Abrir o baú', desc:'Pode conter tesouros... ou não.' }, { id:'leave', label:'Deixar para lá', desc:'Seguir em segurança.' }];
      this.pendingEncounter = { enc, options };
      this.emit('onChoice', { kind:'encounter', title:enc.name, text:enc.text, options });
    }
    resolveEncounter(id) {
      const pe = this.pendingEncounter; if (!pe) return;
      this.pendingEncounter = null;
      const opt = pe.options.find(o => o.id === id);
      if (pe.enc.id === 'merchant' && opt?.item) {
        if (this.state.player.gold >= opt.price) { this.state.player.gold -= opt.price; this.addItem(opt.item); this.emit('onLoot', opt.item); this.emit('onToast', `Comprou ${opt.item.name}.`); }
        else this.emit('onToast', 'Ouro insuficiente.');
      } else if (pe.enc.id === 'shrine' && opt) {
        const b = D.blessings.find(x => x.id === id);
        if (b.stats) Object.entries(b.stats).forEach(([k, v]) => { this.stageMods[k] = (this.stageMods[k] || 0) + v; });
        if (b.mods?.drop) this.stageMods.drop = (this.stageMods.drop || 0) + b.mods.drop;
        if (b.instant === 'heal') this.party.forEach(u => { u.alive = true; u.hp = u.maxHp; u.effects = []; });
        this.emit('onToast', `${b.name} recebida.`);
      } else if (pe.enc.id === 'chest' && id === 'open') {
        if (Math.random() < .3) { this.enemies = [this.makeEnemyUnit('mimic', zonePower(this.zone, this.opts))]; this.phase = 'fight'; this.emit('onWave', { label:'Era um Mímico!', detail:'O baú tinha dentes...', special:true }); this.emit('onWarn', 'Era um Mímico!'); return; }
        const it = I.rollDrop('chest', this.zone, itemLevelFor(this.zone, this.opts) + 1, 1); this.addItem(it); this.emit('onLoot', it);
        const g = Math.round(200 * zonePower(this.zone, this.opts)); this.state.player.gold += g; this.emit('onToast', `O baú tinha ${it.name} e ${g.toLocaleString('pt-BR')} ouro!`);
      }
      this.phase = 'between'; this.timer = .8;
    }

    // ---------- recompensas ----------
    rewardKill(e) {
      const s = this.state, t = e.t;
      s.stats.kills++; this.count('kills');
      if (e.elite || e.boss) { s.stats.elites++; this.count('elites'); }
      const mult = e.ambush ? 2 : 1;
      const gold = Math.round(U.randInt(t.gold[0], t.gold[1]) * Math.pow(e.P, .85) * (1 + this.mod('gold')) * mult);
      const xp = Math.round(t.xp * Math.pow(e.P, .92) * (1 + this.mod('xp')) * mult);
      s.player.gold += gold; s.stats.goldEarned += gold; this.runGold += gold; this.runXp += xp;
      if (activeEvent().mods?.dust) s.player.dust += Math.random() < .3 ? 1 : 0;
      this.giveXp(xp);
      this.emit('onFx', { type:'reward', uid:e.uid, gold, xp });
      // Itens.
      const src = e.boss ? null : e.miniboss ? 'floorBoss' : e.guardian ? 'guardian' : e.elite ? 'elite' : e.treasure ? 'chest' : 'normal';
      if (src) {
        const chance = { normal:.05, elite:.3, guardian:1, floorBoss:1, chest:1 }[src] * (1 + this.mod('drop'));
        const n = src === 'floorBoss' ? 2 : 1;
        for (let i = 0; i < n; i++) if (Math.random() < chance) { const it = I.rollDrop(src, this.zone, itemLevelFor(this.zone, this.opts), this.mod('drop') + (activeEvent().mods?.rarity || 0)); it.fromUid = e.uid; this.addItem(it); this.emit('onLoot', it); }
        if (Math.random() < .12 * (e.elite ? 3 : 1)) { const c = Math.random() < .5 ? 'ore' : 'dust'; s.player[c] += e.elite ? 3 : 1; }
      }
      const card = I.cards.find(c => c.enemy === e.id);
      if (card && Math.random() < card.chance * (1 + this.mod('drop')) * (e.boss ? 1 + (this.opts.tier || 0) : 1)) { s.cards[card.id] = (s.cards[card.id] || 0) + 1; s.stats.cards = (s.stats.cards || 0) + 1; this.emit('onCard', { card, mvp:card.mvp }); this.emit('onLog', { text:`${card.mvp ? 'MVP! ' : ''}Obteve ${card.name}!`, type:'reward' }); }
      if (e.boss) this.emit('onToast', `<b>MVP!</b> ${e.name.split(',')[0]} derrotado.`);
      if (e.treasure) { s.player.gold += gold * 4; this.emit('onToast', `Raposa Dourada derrotada: +${(gold * 5).toLocaleString('pt-BR')} ouro!`); }
    }
    giveXp(xp) {
      const party = this.heroes; if (!party.length) return;
      const per = Math.max(1, Math.round(xp / party.length));
      const ups = [];
      party.forEach(r => { if (this.gainHeroXp(r, per)) { const u = this.party.find(x => x.recUid === r.uid); this.emit('onFx', { type:'levelUp', uid:r.uid }); ups.push(`${this.template(r.id).name} Nv.${r.level}`); if (u) this.refreshUnit(u, r); } });
      if (ups.length) this.emit('onToast', `<b>Nível up!</b> ${ups.join(' · ')} — +${PR.ATTR_PER_LEVEL} pontos de atributo cada (Equipe → Ficha).`);
      // Treino passivo do Dojo para quem está fora da equipe.
      const bench = this.state.collection.filter(h => !this.state.formation.includes(h.uid));
      const rate = .05 + this.state.buildings.dojo * .05;
      bench.forEach(r => this.gainHeroXp(r, Math.round(per * rate)));
      this.gainAccountXp(Math.round(xp * .35));
    }
    gainHeroXp(r, amount) {
      const cap = heroMaxLevel(r.stars); if (r.level >= cap) { r.xp = Math.min(r.xp + amount, heroXpNext(r.level)); return false; }
      r.xp += amount; let up = false;
      while (r.level < cap && r.xp >= heroXpNext(r.level)) { r.xp -= heroXpNext(r.level); r.level++; up = true; }
      return up;
    }
    refreshUnit(u, r) {
      const st = heroStats(this.state, r, this.ctx()); const ratio = u.hp / u.maxHp;
      u.st = st; u.maxHp = st.maxHp; u.hp = Math.round(st.maxHp * ratio); u.level = r.level;
    }
    gainAccountXp(xp) {
      const p = this.state.player; p.xp += xp;
      while (p.xp >= accountXpNext(p.level)) { p.xp -= accountXpNext(p.level); p.level++; p.crystal += 10; this.emit('onToast', `Conta nível ${p.level}! +1 ponto de talento e +10 cristais.`); this.emit('onAccountLevel', p.level); }
    }
    grant(r) {
      const p = this.state.player;
      if (r.gold) { p.gold += r.gold; this.runGold += r.gold; }
      if (r.crystal) p.crystal += r.crystal;
      if (r.keys) p.keys += r.keys;
      if (r.dust) p.dust += r.dust;
      if (r.ore) p.ore += r.ore;
      if (r.potion) this.state.consumables.potion += r.potion;
      if (r.elixir) this.state.consumables.elixir += r.elixir;
      (r.items || []).forEach(it => { this.addItem(it); this.emit('onLoot', it); });
      this.emit('onState');
    }
    addItem(item) {
      const s = this.state;
      s.stats.loot++; this.count('loot');
      if (['legendary','mythic'].includes(item.rarity)) s.stats.legendaries++;
      const auto = s.settings.autoSalvage;
      const order = ['common','rare','epic'];
      if (auto !== 'none' && order.indexOf(item.rarity) >= 0 && order.indexOf(item.rarity) <= order.indexOf(auto)) { const v = I.salvageValue(item); s.player.ore += v.ore; s.player.dust += v.dust; s.player.gold += v.gold; s.stats.salvage++; this.count('salvage'); item.autoSalvaged = true; this.runLoot.push(item); return; }
      if (s.inventory.length >= s.invCap) { const v = I.salvageValue(item); s.player.ore += v.ore; s.player.dust += v.dust; item.autoSalvaged = true; this.emit('onToast', 'Bolsa cheia! Item desmontado automaticamente.'); this.runLoot.push(item); return; }
      s.inventory.unshift(item); this.runLoot.push(item);
    }

    // ---------- convocação e heróis ----------
    openBox(silent = false) {
      const s = this.state;
      if (s.starterRolls < 1 && s.player.keys < 1) return null;
      const r = Math.random();
      const rarity = s.pity >= 29 ? 'legendary' : r < .03 ? 'legendary' : r < .15 ? 'epic' : r < .45 ? 'rare' : 'common';
      const t = U.pick(D.roster);
      if (s.starterRolls > 0) s.starterRolls--; else s.player.keys--;
      s.boxesOpened++; s.pity = rarity === 'legendary' ? 0 : s.pity + 1;
      const owned = s.collection.find(h => h.id === t.id);
      let result;
      if (owned) {
        const shards = D.heroRarities.find(x => x.id === rarity).shards;
        s.shards[t.id] = (s.shards[t.id] || 0) + shards;
        if (D.heroRarities.findIndex(x => x.id === rarity) > D.heroRarities.findIndex(x => x.id === owned.rarity)) { owned.rarity = rarity; }
        result = { ...owned, dupe:true, shardsGained:shards, rarityRolled:rarity };
      } else { const rec = newHeroRecord(t, rarity); s.collection.push(rec); result = { ...rec, dupe:false, rarityRolled:rarity }; }
      if (!silent) this.emit('onToast', `${t.name} ${result.dupe ? `(repetido: +${result.shardsGained} fragmentos)` : 'chegou à coleção!'}`);
      this.emit('onState');
      return result;
    }
    awaken(uid) {
      const r = this.record(uid); if (!r || r.stars >= HERO_MAX_STARS) return false;
      const c = awakenCost(r.stars, this.state.buildings.shrine), have = this.state.shards[r.id] || 0;
      if (have < c.shards || this.state.player.gold < c.gold) return false;
      this.state.shards[r.id] = have - c.shards; this.state.player.gold -= c.gold; r.stars++;
      this.emit('onToast', `${this.template(r.id).name} despertou para ${r.stars}★! Nível máximo agora é ${heroMaxLevel(r.stars)}.`);
      this.rebuildIfVillage(); this.emit('onState'); return true;
    }
    canEditParty() { return !this.active || this.zone.kind === 'village'; }
    setParty(slot, uid) {
      if (!this.canEditParty() || slot < 0 || slot > 3) return false;
      const r = this.record(uid); if (!r) return false;
      const f = this.state.formation;
      if (f.some((u, i) => u && i !== slot && this.record(u)?.id === r.id && u !== uid)) { this.emit('onToast', 'Esse herói já está na equipe.'); return false; }
      const prev = f.indexOf(uid);
      if (prev >= 0) { f[prev] = f[slot]; }
      f[slot] = uid;
      this.emit('onState'); return true;
    }
    removeFromParty(uid) { if (!this.canEditParty()) return false; const i = this.state.formation.indexOf(uid); if (i < 0) return false; this.state.formation[i] = null; this.emit('onState'); return true; }
    rebuildIfVillage() { }

    addAttr(uid, key, n = 1) {
      const r = this.record(uid); if (!r || !PR.attributes[key]) return false;
      const free = this.freeAttr(r); n = Math.min(n, free); if (n <= 0) return false;
      r.attr[key] = (r.attr[key] || 0) + n; this.emit('onState'); return true;
    }
    freeAttr(r) { return (r.level - 1) * PR.ATTR_PER_LEVEL + 5 - Object.values(r.attr || {}).reduce((a, b) => a + b, 0); }
    attrResetCost(r) { return Math.round(200 * r.level * r.level); }
    resetAttr(uid) { const r = this.record(uid); if (!r) return false; const c = this.attrResetCost(r); if (this.state.player.gold < c) return false; this.state.player.gold -= c; Object.keys(r.attr).forEach(k => r.attr[k] = 0); this.emit('onState'); return true; }
    useScroll(uid) { const r = this.record(uid); if (!r || this.state.consumables.scroll < 1) return false; this.state.consumables.scroll--; const amt = Math.round(heroXpNext(r.level) * .6); if (this.gainHeroXp(r, amt)) this.emit('onToast', `${this.template(r.id).name} alcançou o nível ${r.level}!`); this.emit('onState'); return true; }

    // ---------- talentos por herói e classe avançada ----------
    heroTalentPoints(r) { const spent = Object.values(r.talents || {}).reduce((a, b) => a + b, 0); return (r.level - 1) + (r.job ? 5 : 0) - spent; }
    talentPoints() { return this.heroes.reduce((s, r) => s + Math.max(0, this.heroTalentPoints(r)), 0); }
    treeSpent(r) { return Object.values(r.talents || {}).reduce((a, b) => a + b, 0); }
    talentState(r, id) {
      const tree = PR.classTrees[this.template(r.id).cls], n = tree.find(x => x.id === id); if (!n) return { ok:false, reason:'Nó inválido.' };
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
    canJobChange(r) { return !r.job && r.level >= PR.JOB_LEVEL && this.state.player.gold >= PR.jobCost.gold && this.state.player.crystal >= PR.jobCost.crystal; }
    jobChange(uid) {
      const r = this.record(uid); if (!r || !this.canJobChange(r)) return false;
      this.state.player.gold -= PR.jobCost.gold; this.state.player.crystal -= PR.jobCost.crystal; r.job = 1;
      this.emit('onToast', `<b>${this.template(r.id).name}</b> tornou-se <b>${PR.jobs[this.template(r.id).cls].name}</b>! +5 pontos de talento e o Círculo III foi liberado.`);
      this.refreshPartyUnits(); this.emit('onState'); return true;
    }
    refreshPartyUnits() { if (!this.party.length) return; const ctx = this.ctx(); this.party.forEach(u => { const r = this.record(u.recUid); if (r) { const st = heroStats(this.state, r, ctx); const ratio = u.hp / u.maxHp; u.st = st; u.maxHp = st.maxHp; u.hp = Math.max(u.alive ? 1 : 0, Math.round(st.maxHp * ratio)); } }); }

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
      const r = this.record(heroUid), it = this.state.inventory.find(x => x.uid === itemUid);
      if (!r || !it) return false;
      this.state.collection.forEach(h => { Object.keys(h.equipped).forEach(k => { if (h.equipped[k] === itemUid) h.equipped[k] = null; }); });
      r.equipped[it.slot] = itemUid; it.isNew = false;
      this.state.guide.flags.equipped = true;
      this.emit('onState'); return true;
    }
    unequip(heroUid, slot) { const r = this.record(heroUid); if (!r || !r.equipped[slot]) return false; r.equipped[slot] = null; this.emit('onState'); return true; }
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
    upgradeItem(itemUid) {
      const it = this.state.inventory.find(x => x.uid === itemUid); if (!it) return { ok:false, reason:'Item não encontrado.' };
      if ((it.plus || 0) >= I.maxPlus(this.state.buildings.forge)) return { ok:false, reason:`Limite +${I.maxPlus(this.state.buildings.forge)}. Melhore a Forja.` };
      const c = I.upgradeCost(it, this.state.buildings.forge);
      if (this.state.player.gold < c.gold || this.state.player.ore < c.ore) return { ok:false, reason:'Ouro ou Tamahagane insuficiente.' };
      this.state.player.gold -= c.gold; this.state.player.ore -= c.ore;
      if (Math.random() > c.chance) { this.emit('onState'); return { ok:false, failed:true, reason:'O aprimoramento falhou! (o item não foi perdido)' }; }
      it.plus = (it.plus || 0) + 1; this.state.stats.upgrades++; this.state.stats.maxUpgrade = Math.max(this.state.stats.maxUpgrade, it.plus);
      this.emit('onState'); return { ok:true, plus:it.plus };
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
    buildingCost(id) { const b = D.buildings[id], lv = this.state.buildings[id] || 1; return Math.round(b.baseCost * Math.pow(b.growth, lv - 1)); }
    buildingCap() { return 2 + Math.floor(this.state.player.level / 3); }
    upgradeBuilding(id) {
      const lv = this.state.buildings[id] || 1; if (lv >= this.buildingCap()) { this.emit('onToast', `Limite de nível ${this.buildingCap()} — suba o nível da conta.`); return false; }
      const cost = this.buildingCost(id); if (this.state.player.gold < cost) return false;
      this.state.player.gold -= cost; this.state.buildings[id] = lv + 1;
      this.emit('onToast', `${D.buildings[id].name} alcançou o nível ${lv + 1}.`); this.emit('onState'); return true;
    }

    // ---------- loja ----------
    shopPrice(offer) {
      if (!offer.scale) return offer.price;
      const best = Math.max(this.state.progress.hunt.best, this.state.progress.hunt_tide.best + 12);
      const m = 1 + best * .15;
      return Object.fromEntries(Object.entries(offer.price).map(([k, v]) => [k, Math.round(v * m)]));
    }
    buy(offerId) {
      const offer = [...PR.shop.gold, ...PR.shop.crystal].find(o => o.id === offerId); if (!offer) return false;
      const price = this.shopPrice(offer);
      if (Object.entries(price).some(([k, v]) => (this.state.player[k] || 0) < v)) return false;
      if (offer.give.invCap && this.state.invCap >= 200) return false;
      Object.entries(price).forEach(([k, v]) => { this.state.player[k] -= v; });
      Object.entries(offer.give).forEach(([k, v]) => {
        if (['potion','elixir','scroll'].includes(k)) this.state.consumables[k] += v;
        else if (k === 'invCap') this.state.invCap = Math.min(200, this.state.invCap + v);
        else if (k === 'boost') this.state.boostUntil = Math.max(Date.now(), this.state.boostUntil) + v * 1000;
        else if (k === 'respec') this.state.freeRespec++;
        else this.state.player[k] = (this.state.player[k] || 0) + v;
      });
      this.emit('onState'); return true;
    }
    refreshMarket(force = false) {
      const m = this.state.market, now = Date.now(), slot = Math.floor(now / (2 * 3600 * 1000));
      if (!force && m.slot === slot && m.offers.length) return m.offers;
      const lv = this.state.buildings.market;
      const ilvl = Math.max(1, Math.max(this.state.progress.hunt.best, this.state.progress.hunt_tide.best ? this.state.progress.hunt_tide.best + 13 : 0));
      const offers = [];
      for (let i = 0; i < 2 + lv; i++) {
        const roll = Math.random(), rarity = roll < .04 * lv ? 'legendary' : roll < .35 ? 'epic' : 'rare';
        const it = I.makeItem({ ilvl:ilvl + 1, rarity }); offers.push({ type:'item', item:it, price:Math.round(I.itemScore(it) * 4 + 300 * ilvl), sold:false });
      }
      const owned = this.state.collection.map(h => h.id);
      if (owned.length) offers.push({ type:'shards', heroId:U.pick(owned), n:5, price:Math.round(2000 * (1 + ilvl * .2)), sold:false });
      m.offers = offers; m.slot = slot; m.refreshedAt = now; return offers;
    }
    buyMarket(i) {
      const o = this.state.market.offers[i]; if (!o || o.sold || this.state.player.gold < o.price) return false;
      this.state.player.gold -= o.price; o.sold = true;
      if (o.type === 'item') { const it = { ...o.item, uid:U.uid('it') }; this.addItem(it); this.emit('onLoot', it); }
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
        const c = U.pick(pool.length ? pool : D.contracts), tier = U.randInt(0, 2);
        s.contracts.push({ id:c.id, tier, n:c.n[tier], progress:0 });
      }
    }
    count(type) { (this.state.contracts || []).forEach(c => { const def = D.contracts.find(d => d.id === c.id); if (def?.type === type) c.progress = Math.min(c.n, c.progress + 1); }); }
    contractReward(c) {
      const def = D.contracts.find(d => d.id === c.id), m = 1 + c.tier * .8, P = Math.max(1, zonePower(D.zones[this.state.lastHunt || 'hunt'], { stage:Math.max(1, this.state.progress[this.state.lastHunt || 'hunt'].best) }));
      const out = {}; Object.entries(def.reward).forEach(([k, v]) => { out[k] = Math.round(k === 'gold' ? v * 600 * P * m : v * m); }); return out;
    }
    claimContract(i) {
      const c = this.state.contracts[i]; if (!c || c.progress < c.n) return false;
      this.grant(this.contractReward(c)); this.state.contracts.splice(i, 1); this.ensureContracts();
      this.emit('onToast', 'Contrato concluído! Um novo contrato chegou.'); return true;
    }
    achievementValue(a) {
      const s = this.state;
      if (a.stat === 'unique') return new Set(s.collection.map(h => h.id)).size;
      if (a.stat === 'maxLevel') return Math.max(0, ...s.collection.map(h => h.level));
      if (a.stat === 'maxStars') return Math.max(0, ...s.collection.map(h => h.stars));
      if (a.stat === 'bondsActive') return this.ctx().bonds.length;
      return s.stats[a.stat] || 0;
    }
    claimAchievement(id) {
      const a = D.achievements.find(x => x.id === id); if (!a || this.state.achievements[id] || this.achievementValue(a) < a.n) return false;
      this.state.achievements[id] = true; const r = { ...a.reward }; if (r.key) { r.keys = r.key; delete r.key; } this.grant(r);
      this.emit('onToast', `Conquista: ${a.title}!`); return true;
    }

    // ---------- offline ----------
    offlineGains() {
      const s = this.state, elapsed = Math.max(0, Math.floor((Date.now() - (s.lastSeen || Date.now())) / 1000)), capped = Math.min(elapsed, 12 * 3600);
      if (capped < 120 || this.heroes.length < 4) return null;
      const zid = s.lastHunt || 'hunt', z = D.zones[zid], stage = Math.max(1, s.progress[zid].best || 1), P = zonePower(z, { stage });
      const killsPerSec = .22;
      const kills = Math.floor(capped * killsPerSec);
      const gold = Math.round(kills * 11 * Math.pow(P, .85) * .6 * (1 + this.mod('gold')));
      const xp = Math.round(kills * 14 * Math.pow(P, .92) * .5 * (1 + this.mod('xp')));
      s.player.gold += gold; s.stats.goldEarned += gold;
      this.giveXp(xp);
      const items = [];
      const nItems = Math.min(12, Math.floor(capped / 1200));
      for (let i = 0; i < nItems; i++) { const it = I.rollDrop(Math.random() < .15 ? 'elite' : 'normal', z, itemLevelFor(z, { stage }), 0); this.addItem(it); items.push(it); }
      const ore = Math.floor(capped / 600), dust = Math.floor(capped / 500);
      s.player.ore += ore; s.player.dust += dust;
      return { seconds:capped, gold, xp, items, ore, dust };
    }

    save() { return saveState(this.state); }
    resetSave() { U.safeStorage.remove(SAVE_KEY); }
  }

  KT.State = { setSaveKey, createState, loadState, saveState, mergeState, heroStats, statPower, teamContext, formationRecords, heroXpNext, accountXpNext, heroMaxLevel, awakenCost, zonePower, itemLevelFor, activeEvent, newHeroRecord, SAVE_KEY, ULT_COST };
  KT.CombatEngine = CombatEngine;
})();
