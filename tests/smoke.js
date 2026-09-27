// Teste de fumaça: valida conteúdo, motor, progressão, itens, economia e telas sem navegador.
// Uso: node tests/smoke.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.resolve(__dirname, '..');
global.setTimeout = fn => { fn(); return 0; };
for (const f of ['src/data.js','src/utils.js','src/items.js','src/progression.js','src/roster.js','src/builds.js','src/engine.js','src/assets.js','src/ui.js','src/panels.js','src/economy-ui.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename:f });
const { State, CombatEngine, Data:D, Items:I, Progression:PR } = global.KT;
let checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) throw new Error(msg); };

// ---------- conteúdo ----------
ok(D.roster.length === 60 + D.SEASON.heroes.length && new Set(D.roster.map(h => h.id)).size === D.roster.length && D.SEASON.heroes.every(id => D.roster.some(h => h.id === id)), '60 heróis + temporada, todos únicos');
ok(D.roster.find(h => h.id === 'solen').name === 'Goku' && D.roster.find(h => h.id === 'sienna').name === 'Erza Scarlet', 'nomes originais dos personagens de anime');
ok(new Set(D.roster.map(h => h.skill.name)).size === D.roster.length && new Set(D.roster.map(h => h.ult.name)).size === D.roster.length, 'habilidades e ultimates únicas');
D.roster.forEach(h => { ok(h.passiveText && h.skillText && h.ultText, `kit descrito: ${h.id}`); ok(fs.existsSync(path.join(root, 'assets/sprites', `${h.sprite}.png`)) && fs.existsSync(path.join(root, 'assets/portraits', `${h.id}.png`)), `arte: ${h.id}`); });
ok(Object.keys(D.classes).every(c => D.roster.filter(h => h.cls === c).length >= 8), 'todas as classes têm heróis');
Object.values(D.enemies).forEach(e => ok(fs.existsSync(path.join(root, 'assets/sprites', `${e.sprite}.png`)), `sprite de monstro: ${e.sprite}`));
const zonePools = Object.values(D.zones).filter(z => z.pool).map(z => new Set([...z.pool, ...z.elites.filter(x => x !== 'fox_specter'), ...(z.floorBoss ? [z.floorBoss] : [])]));
ok(zonePools.length >= 11, 'regiões com monstros próprios');
ok(zonePools.every((a, i) => zonePools.every((b, j) => i === j || [...a].every(x => !b.has(x)))), 'monstros não se repetem entre regiões');
[...I.bases.map(b => [b.icon, b.hue]), ...I.uniques.map(q => [q.icon, q.hue]), ...I.sets.flatMap(s => Object.values(s.pieces).map(p => [p[1], p[2]]))].forEach(([icon, hue]) => ok(fs.existsSync(path.join(root, 'assets/icons', `${icon}${hue ? `_h${hue}` : ''}.png`)), `ícone ${icon} ${hue}`));
[...PR.shop.gold, ...PR.shop.crystal].forEach(o => ok(fs.existsSync(path.join(root, 'assets/icons', `${o.icon}${o.hue ? `_h${o.hue}` : ''}.png`)), `ícone da loja ${o.id}`));
JSON.parse(fs.readFileSync(path.join(root, 'assets/anim/index.json'), 'utf8')).forEach(id => { ok(fs.existsSync(path.join(root, 'assets/anim', `${id}.json`)), `metadados de animação ${id}`); ok(fs.existsSync(path.join(root, 'assets/anim', `${id}.webp`)), `folha de animação ${id}`); });
ok(I.bases.length >= 30 && I.uniques.length >= 15 && I.sets.length >= 7 && I.affixes.length >= 18, 'variedade de itens');
for (const z of Object.values(D.zones)) ok(fs.existsSync(path.join(root, 'assets/scenes', `${z.scene || z.id}.png`)), `cenário ${z.id}`);
Object.values(D.zones).filter(z => z.pool).forEach(z => [...z.pool, ...z.elites, ...(z.floorBoss ? [z.floorBoss] : [])].forEach(id => ok(D.enemies[id], `monstro ${id} de ${z.id}`)));
Object.values(D.enemies).forEach(e => ok(!e.skill || new Set(Object.values(D.enemies).filter(o => o.skill).map(o => o.skill.name)).size > 70, 'habilidades de monstros variadas'));
ok(I.cards.length === Object.keys(D.enemies).length, 'toda criatura tem carta');
{ const renderer = fs.readFileSync(path.join(root, 'src/renderer.js'), 'utf8'); ok(renderer.includes('U.clamp(1 - e.windup') && renderer.includes('Math.max(0, zn.rx * p)'), 'área de perigo nunca envia raio negativo ao Canvas'); }
// Armas por classe
ok(Object.keys(I.itemTypes).length >= 12 && Object.keys(I.itemTypes).filter(k => k !== 'relic').every(w => [1, 12, 24, 36, 46].every(l => I.bases.some(b => b.wt === w && b.minIlvl <= l))), 'todo tipo de item tem bases em todos os níveis');
D.roster.forEach(h => ['weapon','focus','seal'].forEach(sl => ok(I.allowedTypes(h.id).some(t => I.itemTypes[t].slot === sl), `${h.id} tem ${sl} próprio`)));
D.roster.forEach(h => { const al = I.allowedWeaponTypes(h.id); ok(al.length >= 2 && al.includes('relic'), `${h.id} tem armas`); });
ok(I.canEquip(I.makeItem({ ilvl:5, slot:'weapon', wt:'ranged', rarity:'rare' }), 'bjorn') && !I.canEquip(I.makeItem({ ilvl:5, slot:'weapon', wt:'ranged', rarity:'rare' }), 'hayato'), 'exceções de arma por personagem');
ok(I.itemStats(I.makeItem({ ilvl:10, slot:'weapon', wt:'holy', rarity:'common' })).healPow > 0, 'arma sagrada tem atributo implícito de cura');
// Builds e Essências
D.roster.forEach(h => { const b = KT.Builds.buildFor(h.id); ok(b && KT.Builds.essences[h.id] && PR.treeFor(h.id).find(n => n.id === 'ess').name !== 'Essência', `build e essência de ${h.id}`); ok(b.allowedWeapons.includes(b.weapon), `arma recomendada válida: ${h.id}`); });
ok(new Set(Object.values(KT.Builds.essences).map(e => e.name)).size === D.roster.length, 'essências únicas');
// Eventos por calendário (data e hora de Brasília)
const evAt = (iso) => State.activeEvent(Date.parse(iso));
ok(evAt('2026-09-26T23:30:00-03:00').id === 'bloodmoon' && evAt('2026-09-26T20:00:00-03:00').id === 'festival' && evAt('2026-09-24T07:00:00-03:00').id === 'calm' && evAt('2026-09-24T20:30:00-03:00').id === 'oninight' && evAt('2026-09-25T15:00:00-03:00').id === 'sakura' && evAt('2026-09-23T21:00:00-03:00').id === 'festival', 'calendário de eventos');
ok(evAt('2026-09-26T12:10:00-03:00').ends === Date.parse('2026-09-26T14:00:00-03:00'), 'evento termina na hora marcada');
ok(State.upcomingEvents(Date.parse('2026-09-26T12:00:00-03:00')).length >= 20, 'agenda da semana');

// ---------- início ----------
const state = State.createState();
const events = { loot:0, results:[], dialogs:0 };
const engine = new CombatEngine(state, { onLoot(){ events.loot++; }, onResult(r){ events.results.push(r); }, onDialog(){ events.dialogs++; } });
ok(state.starterRolls === 10 && !state.collection.length && state.player.gold === 0, 'jornada começa vazia');
ok(engine.enterZone('hunt') === false, 'sem equipe não viaja');
for (let i = 0; i < 10; i++) ok(engine.openBox(true), 'convocação inicial');
ok(state.starterRolls === 0 && state.boxesOpened === 10, 'convocações consumidas');
ok(new Set(state.collection.map(r => r.id)).size === 10, 'convocações iniciais não repetem');
ok(Object.keys(D.classes).every(c => state.collection.some(r => engine.template(r.id).cls === c)), 'ao menos 1 herói de cada classe');
const uniq = [...new Map(state.collection.map(r => [r.id, r])).values()];
while (uniq.length < 4) { const t = D.roster.find(h => !uniq.some(r => r.id === h.id)); const r = State.newHeroRecord(t, 'rare'); state.collection.push(r); uniq.push(r); }
const byCls = cls => D.roster.find(h => h.cls === cls);
// Equipe balanceada garantida para os testes.
['Vanguarda','Executor','Suporte','Arcanista'].forEach((cls, i) => { let r = state.collection.find(x => engine.template(x.id).cls === cls && !state.formation.includes(x.uid)); if (!r) { r = State.newHeroRecord(byCls(cls), 'epic'); state.collection.push(r); } ok(engine.setParty(i, r.uid), 'escalar herói'); });
ok(engine.heroes.length === 4 && engine.getPower() > 0, 'equipe formada com poder');
ok(!engine.setParty(1, state.formation[0]) || new Set(state.formation).size === 4, 'herói não duplica na formação');
{ const reserve = State.newHeroRecord(D.roster.find(h => !state.collection.some(r => r.id === h.id)), 'rare'); state.collection.push(reserve); const xp0 = reserve.xp, lv0 = reserve.level, cl0 = reserve.classXp; engine.giveXp(5000); ok(reserve.xp === xp0 && reserve.level === lv0 && reserve.classXp === cl0, 'herói do banco não ganha EXP de nível nem de classe em combate'); }
ok(engine.heroes.every(r => r.classLevel > 1 || r.classXp > 0), 'equipe ganha EXP de classe em combate');
// Casa do Time: Galeria (25% dos atributos da carta para a equipe), Álbum e Paragão.
{ const p0 = engine.getPower(), cd = I.cards.find(c => c.stats.atk); state.cards[cd.id] = (state.cards[cd.id] || 0) + 1;
  ok(!engine.displayCard(cd.id, 5), 'espaço bloqueado da Galeria recusa carta');
  ok(engine.displayCard(cd.id, 0) && state.house.display[0] === cd.id, 'carta exposta na Galeria');
  ok(engine.getPower() > p0, 'carta exposta fortalece a equipe');
  ok(!engine.displayCard(cd.id, 0), 'mesma carta não é exposta duas vezes');
  ok(engine.albumCount() >= 1 && State.albumIds(State.mergeState(JSON.parse(JSON.stringify(state)))).includes(cd.id), 'Álbum lembra a carta após salvar');
  ok(engine.removeDisplay(0) && state.cards[cd.id] >= 1 && !state.house.display[0], 'carta volta da Galeria para a coleção');
  const r = engine.heroes[0], lvl = r.level, xp0 = r.xp, pl = state.paragon.lv, px = state.paragon.xp; r.level = 99; r.xp = 0; engine.gainHeroXp(r, State.heroXpNext(99) + D.PARAGON.next(pl) + 1);
  ok(r.level === 100 && state.paragon.lv === pl + 1, 'nível trava em 100 e EXP excedente vira Paragão'); state.paragon.lv = pl; state.paragon.xp = px; r.level = lvl; r.xp = xp0;
  const capped = State.newHeroRecord(D.roster[0], 'rare'); capped.level = 100; capped.xp = 0; const sv = State.createState(); sv.collection = [capped]; const validateSave = require('../server/game').validateSave; ok(validateSave(sv).ok, 'servidor aceita nível 100'); capped.level = 101; ok(!validateSave(sv).ok, 'servidor rejeita nível acima de 100');
  const old = State.mergeState({ version:3, player:{}, collection:[], formation:[null,null,null,null], inventory:[], cards:{ card_fox:1 } });
  ok(old.buildings.house === 1 && Array.isArray(old.house.display) && old.house.seen.card_fox, 'saves antigos ganham Casa do Time e Álbum');
  ok(I.cards.every(c => c.chance <= 1 / 1500), 'cartas continuam raríssimas'); }
// Quebra de postura e Elo Kizuna.
{ const e2 = new CombatEngine(State.mergeState(JSON.parse(JSON.stringify(state))), {});
  ok(e2.enterZone('hunt', { stage:1 }), 'entra na caçada para testar o combate');
  const boss = e2.makeEnemyUnit('golem_elder', 1), hero = e2.party[0];
  boss.windup = 2; boss.windupSpecial = { name:'Teste', eff:[] };
  for (let k = 0; k < 400 && !(boss.broken > 0); k++) { boss.hp = boss.maxHp; e2.addBreak(hero, boss, boss.maxHp * .02, 'ult', 1); }
  ok(boss.broken > 0 && !boss.windupSpecial && boss.windup === 0, 'postura cheia atordoa e cancela o ataque preparado');
  ok(!e2.canAct(boss) && boss.breakMax > State.BREAK.max, 'inimigo quebrado não age e a próxima quebra exige mais');
  const minion = e2.makeEnemyUnit('fox', 1); e2.addBreak(hero, minion, minion.maxHp, 'ult', 1.3);
  ok(!(minion.broken > 0), 'monstros comuns não têm postura');
  e2.enemies = [Object.assign(e2.makeEnemyUnit('golem_elder', 1), { maxHp:1e12, hp:1e12 })]; e2.phase = 'fight'; e2.party.forEach(u => { u.energy = 100; });
  e2.castUlt(0, true); e2.zoneElapsed += 1; e2.castUlt(1, true);
  ok(e2.ultChain === 2, 'duas ultimates seguidas de heróis diferentes formam Elo ×2');
  e2.zoneElapsed += 1; e2.party[2].energy = 100; e2.castUlt(2, true); e2.zoneElapsed += 1; e2.party[3].energy = 100; e2.castUlt(3, true);
  ok(e2.ultChain === 0 && (e2.state.stats.chains || 0) >= 4, 'quatro elos disparam o golpe final da equipe');
  e2.enemies = [e2.makeEnemyUnit('golem_elder', 1)]; e2.party.forEach(u => { u.alive = true; u.hp = u.maxHp; u.effects = []; }); e2.party[0].energy = 100; e2.zoneElapsed += 10; e2.castUlt(0, true); ok(e2.ultChain === 1, 'elo reinicia depois da janela de 4s'); }
// Economia: bolsa cheia não esconde itens valiosos; chefes e materiais raros têm limite diário.
{ const st = State.mergeState(JSON.parse(JSON.stringify(state))), e3 = new CombatEngine(st, {});
  st.inventory = []; st.overflow = []; while (st.inventory.length < st.invCap) st.inventory.push(I.makeItem({ ilvl:5, rarity:'common' }));
  const leg = I.makeItem({ ilvl:20, rarity:'legendary' }); e3.addItem(leg);
  ok(st.inventory.includes(leg) && !leg.inOverflow && st.overflow.length === 1 && st.inventory.length === st.invCap, 'lendário com bolsa cheia fica na bolsa e o comum mais fraco vai para os Excedentes');
  st.overflow = Array.from({ length:I.OVERFLOW_CAP }, () => I.makeItem({ ilvl:20, rarity:'epic' })); st.inventory.forEach(x => { x.locked = true; });
  const leg2 = I.makeItem({ ilvl:20, rarity:'legendary' }); e3.addItem(leg2); ok(st.overflow.includes(leg2), 'épico ou melhor nunca é destruído, mesmo com tudo cheio');
  const common = I.makeItem({ ilvl:20, rarity:'common' }); const n0 = st.overflow.length; e3.addItem(common); ok(common.autoSalvaged && st.overflow.length === n0, 'baú cheio só de itens bons desmonta o comum novo');
  st.progress.boss.kills = 5; e3.zone = D.zones.boss; e3.opts = { tier:0 }; e3.runLoot = [];
  const left0 = e3.bossLootLeft('boss', 0); for (let k = 0; k < State.BOSS_LOOT_PER_DAY; k++) e3.bossClear();
  ok(left0 === State.BOSS_LOOT_PER_DAY && e3.bossLootLeft('boss', 0) === 0, 'espólio de chefe conta por dia');
  const star0 = st.mats.star, keys0 = st.player.keys, inv0 = st.stats.loot; e3.bossClear();
  ok(e3.lastResult.lootLocked && st.mats.star === star0 && st.player.keys === keys0 && st.stats.loot === inv0 && e3.lastResult.rewards.gold > 0, 'depois do limite o chefe rende só ouro e EXP');
  st.bossLoot.date = '1999-01-01'; ok(e3.bossLootLeft('boss', 0) === State.BOSS_LOOT_PER_DAY, 'espólio renova no dia seguinte');
  e3.zone = D.zones.rift; e3.opts = { floor:30 }; const ori0 = st.mats.ori, adam0 = st.mats.adam;
  const rng = Math.random; Math.random = () => 0; for (let k = 0; k < 50; k++) e3.dropMats('rift'); Math.random = rng;
  ok(st.mats.ori - ori0 === State.DAILY_MAT_CAP.ori && st.mats.adam - adam0 === State.DAILY_MAT_CAP.adam, 'Oricalco e Adamantina de fontes repetíveis respeitam o teto diário'); }
// Arena PvP: luta completa contra a defesa (instantâneo) de outro jogador, reprodutível pela semente.
{ const snap = JSON.parse(JSON.stringify(new CombatEngine(State.mergeState(JSON.parse(JSON.stringify(state))), {}).pvpSnapshot()));
  ok(snap.length === 4 && snap.every(h => h.id && h.st && h.st.atk > 0 && h.maxHp > 0 && !h.st.template), 'instantâneo de defesa só com números');
  const duel = (inputs = []) => { const st = State.mergeState(JSON.parse(JSON.stringify(state))); const rec = []; const e = new CombatEngine(st, { onArena:r => rec.push(r) });
    e.arenaFoe = { name:'Rival', mmr:1000, defense:snap, seed:4242 };
    const gold0 = st.player.gold, kills0 = st.stats.kills; ok(e.enterZone('arena'), 'entra na Arena com defesa rival');
    ok(e.enemies.length === 4 && e.enemies.every(u => u.rival && u.side === 'enemy' && u.specials.length), 'rivais são heróis com habilidade e ultimate telegrafada');
    let guard = 0; while (!rec.length && guard++ < 4000) { inputs.filter(x => x.t === e.seg?.tick).forEach(x => e.input(x.k, x.a)); e.tick(); }
    ok(rec.length === 1 && typeof rec[0].won === 'boolean' && rec[0].endTick > 0, 'a luta termina e entrega o resultado');
    ok(st.player.gold === gold0 && st.stats.kills === kills0, 'arena não dá ouro nem conta abates de PvE');
    return rec[0]; };
  const a = duel(), b = duel(); ok(a.won === b.won && a.endTick === b.endTick, 'mesma semente e mesmos comandos: mesmo resultado');
  ok(!new CombatEngine(State.mergeState(JSON.parse(JSON.stringify(state))), {}).enterZone('arena'), 'sem defesa rival não há arena');
  const e5 = new CombatEngine(State.mergeState(JSON.parse(JSON.stringify(state))), {}), star0 = e5.state.mats.star, inv0 = e5.state.inventory.length;
  ok(e5.pvpGrant('star') && e5.state.mats.star === star0 + 1 && e5.pvpGrant('glad_weapon') && e5.state.inventory.length === inv0 + 1 && e5.state.inventory[0].setId === 'gladiator', 'Loja de Honra entrega material e peça do Gladiador');
  ok(D.PVP_SHOP.every(o => fs.readFileSync(path.join(root, 'tools/neon_social.sql'), 'utf8').includes(`('${o.id}', ${o.price}, ${o.limit})`)), 'preços da Loja de Honra batem com o banco'); }
// Profissões: coleta entre ondas, criação e comércio dos materiais.
{ const st = State.mergeState(JSON.parse(JSON.stringify(state))), e6 = new CombatEngine(st, {});
  ok(st.prof.lv.mining === 1 && st.consumables.flask_fury === 0, 'saves antigos ganham profissões e frascos');
  e6.zone = D.zones.hunt_tide; let got = 0; for (let k = 0; k < 400; k++) if (e6.gather()) got++;
  ok(got > 60 && got < 200 && Object.keys(st.prof.mats).some(id => D.PROF_MATS.find(m => m.id === id)?.tier === 2), 'coleta ~30% das vezes, no nível do capítulo');
  e6.zone = D.zones.boss; ok(!e6.gather(), 'não há coleta em chefes');
  st.prof.mats = { herb1:3, ess1:1, ore1:8, ess1b:0 }; st.prof.mats.ess1 = 3; st.player.gold = 1e7;
  const pots = st.consumables.potion; ok(e6.craftProf('potion_plus') && st.consumables.potion === pots + 3 && st.prof.mats.herb1 === 0, 'Alquimia cria poções consumindo materiais');
  ok(!e6.craftProf('flask_sage') && /nível/.test(e6.lastError), 'receita exige nível da profissão');
  const inv = st.inventory.length; ok(e6.craftProf('forge_t1', 'weapon') && st.inventory.length === inv + 1 && st.inventory[0].crafter && st.inventory[0].slot === 'weapon' && !st.inventory[0].bound, 'Artesania forja item negociável assinado');
  ok(!e6.craftProf('forge_t1', 'nada'), 'Artesania exige espaço válido');
  st.prof.mats.ore2 = 5; const pay = e6.marketTake('mat', 'ore2', 3); ok(pay && st.prof.mats.ore2 === 2, 'material de coleta sai para o mercado');
  e6.marketReceive('mat', { id:'ore2', qty:4 }); ok(st.prof.mats.ore2 === 6 && I.matInfo('ore2').name === 'Prata das Marés', 'material de coleta chega pelo mercado');
  ok(D.PROF_RECIPES.every(r => Object.keys(r.cost).every(k => k === 'gold' || D.PROF_MATS.some(m => m.id === k))), 'receitas só usam materiais existentes'); }
// Capítulo IV
['hunt_sky','hunt_sakura','dungeon_sky','boss_sky'].forEach(id => ok(D.zones[id] && fs.existsSync(path.join(root, 'assets/scenes', id + '.png')), 'região do Capítulo IV: ' + id));
ok(D.zones.hunt_sky.unlock.kills.boss_sand === 1 && D.enemies.boss_sky.boss && D.guide.some(g => g.id === 'g_raijin'), 'Capítulo IV liberado depois de Apep, com chefe e guia');
ok(['sakura','oninight','aether'].every(id => D.worldEvents.some(w => w.id === id) && D.eventSchedule.some(w => w.id === id)), 'eventos novos no calendário');

// ---------- caçada ----------
ok(engine.enterZone('hunt', { stage:1 }) && engine.active && engine.enemies.length >= 2, 'caçada inicia');
ok(engine.zoneLock('dungeon').locked && engine.zoneLock('boss').locked, 'dungeon e chefe começam bloqueados');
const tick = sec => { for (let t = 0; t < sec; t += .05) engine.update(.05); };
const killWave = () => { engine.encounterUsed = true; engine.enemies.forEach(e => { e.hp = 1; }); engine.enemies.forEach(e => engine.hit(engine.party[0], e, 50, { kind:'skill' })); engine.checkOutcome(); };
for (let w = 0; w < 4; w++) { killWave(); if (engine.phase === 'between') { engine.timer = 0; engine.tick(); } }
ok(state.progress.hunt.best === 1 && state.stats.kills >= 8, 'estágio 1 vencido');
ok(state.player.gold > 0 && state.player.crystal > 0, 'recompensas de estágio');
tick(3);
ok(engine.opts.stage === 2, 'avanço automático para o estágio 2');
// Derrota recua um estágio e mantém a caçada.
engine.party.forEach(u => { u.hp = 1; }); engine.party.forEach(u => engine.applyRawDamage(u, 999999, engine.enemies[0], {})); engine.checkOutcome();
ok(engine.phase === 'defeat' && !state.settings.autoAdvance, 'derrota detectada');
tick(4);
ok(state.zone === 'hunt' && engine.opts.stage === 1 && engine.phase === 'fight', 'derrota recua e continua lutando');
ok(engine.opts.stage <= D.zones.hunt.stages, 'estágios limitados');

// ---------- dungeon ----------
state.progress.hunt.best = 5;
ok(!engine.zoneLock('dungeon').locked, 'dungeon desbloqueia no estágio 5');
engine.enterZone('dungeon', { floor:1 });
for (let room = 1; room <= 5; room++) {
  if (engine.pendingRoute) engine.chooseRoute(room % 2 ? 'safe' : 'risk');
  killWave();
  if (engine.phase === 'between') { engine.timer = 0; engine.tick(); }
}
ok(state.progress.dungeon.best === 1 && events.results.some(r => r.kind === 'dungeon'), 'andar I conquistado');

// ---------- chefe ----------
state.progress.hunt.best = 12; state.progress.dungeon.best = 3;
ok(!engine.zoneLock('boss').locked, 'chefe desbloqueia');
ok(engine.zoneLock('hunt_tide').locked, 'capítulo 2 bloqueado antes do chefe');
engine.enterZone('boss', { tier:0 });
const boss = engine.enemies[0];
ok(boss.boss && boss.maxHp > 500000, 'chefe tem muito HP');
boss.hp = boss.maxHp * .5; engine.tickBossTimer(.1);
ok(engine.bossPhase === 1, 'chefe muda de fase');
boss.spawnT = 1; boss.effects = []; boss.specials[0].t = 0; engine.party.forEach(u => { u.hp = u.maxHp; });
engine.actEnemy(boss, .01);
ok(boss.windup > 0, 'ataque especial é telegrafado');
boss.hp = 1; engine.hit(engine.party[0], boss, 50, { kind:'skill' }); engine.checkOutcome();
ok(state.progress.boss.kills === 1 && !engine.zoneLock('hunt_tide').locked, 'chefe derrotado libera o capítulo 2');
ok(events.dialogs > 0, 'diálogo de história');
ok(engine.enterZone('boss', { tier:1 }) && engine.opts.tier === 1, 'dificuldade Pesadelo libera');

// ---------- itens ----------
const r0 = engine.heroes[0];
r0.level = 30; engine.heroes.forEach(h => { h.level = 30; h.attr = { str:40, agi:10, vit:40, int:40, dex:40, luk:0 }; });
const lowLv = engine.heroes[1], heavyW = I.makeItem({ ilvl:40, rarity:'legendary', slot:'weapon', wt:'sword' }); state.inventory.push(heavyW);
ok(!engine.equip(lowLv.uid, heavyW.uid) && /Requer nível/.test(I.equipCheck(heavyW, lowLv).reason), 'requisito de nível para equipar');
const before = State.heroStats(state, r0);
const weapon = I.makeItem({ ilvl:10, rarity:'epic', slot:'weapon', wt:'sword' }); state.inventory.push(weapon);
ok(engine.equip(r0.uid, weapon.uid) && State.heroStats(state, r0).atk > before.atk, 'arma aumenta ATK');
const r1 = engine.heroes[1]; engine.equip(r1.uid, weapon.uid);
ok(!r0.equipped.weapon && r1.equipped.weapon === weapon.uid, 'item não equipa em dois heróis');
state.player.gold = 1e7; state.player.ore = 1e4; state.player.dust = 1e4;
const up = engine.upgradeItem(weapon.uid); ok(up.ok && weapon.plus === 1, 'aprimoramento');
ok(engine.enchantItem(weapon.uid, 0), 'encantamento');
const clsR0 = engine.template(r0.id).cls, goodSet = I.sets.find(st => st.classes && st.classes.includes(clsR0)), badSet = I.sets.find(st => st.classes && !st.classes.includes(clsR0));
['weapon','focus'].forEach(slot => { const it = I.makeItem({ set:goodSet.id, ilvl:14, slot }); state.inventory.push(it); engine.equip(r0.uid, it.uid); });
ok(State.heroStats(state, r0).sets.some(s => s.set.id === goodSet.id && s.active.includes(2)), 'bônus de conjunto (2 peças)');
const wrongSet = I.makeItem({ set:badSet.id, ilvl:14, slot:'charm' }); state.inventory.push(wrongSet); ok(!engine.equip(r0.uid, wrongSet.uid), 'conjunto só serve às classes dele');
const junk = I.makeItem({ ilvl:1, rarity:'common' }); state.inventory.push(junk);
const sv = engine.salvage(junk.uid); ok(sv && sv.ore > 0 && !state.inventory.includes(junk), 'desmontar');
for (let i = 0; i < 40; i++) { const d = I.rollDrop('boss', D.zones.boss, 14, 1); ok(d && d.slot && I.itemScore(d) > 0, 'drop válido'); }

// ---------- progressão ----------
r0.level = 10; r0.attr = { str:0, agi:0, vit:0, int:0, dex:0, luk:0 }; ok(engine.freeAttr(r0) === 9 * PR.ATTR_PER_LEVEL + 5, 'pontos de atributo');
const atkBefore = State.heroStats(state, r0).atk; engine.addAttr(r0.uid, 'str', 5);
ok(State.heroStats(state, r0).atk > atkBefore, 'Força aumenta ATK');
// Talentos por herói
const cls0 = engine.template(r0.id).cls, tree0 = PR.classTrees[cls0];
r0.talents = {}; r0.level = 10;
ok(engine.heroTalentPoints(r0) === 9, '1 ponto de talento por nível');
const t1 = tree0.find(n => n.tier === 0), t2 = tree0.find(n => n.tier === 1 && n.req.length), t3 = tree0.find(n => n.tier === 2);
ok(!engine.addHeroTalent(r0.uid, t2.id), 'círculo II exige pontos investidos');
const hpBeforeT = State.heroStats(state, r0);
for (let i = 0; i < t1.max; i++) ok(engine.addHeroTalent(r0.uid, t1.id), 'aprende talento');
ok(!engine.addHeroTalent(r0.uid, t1.id), 'rank máximo');
ok(JSON.stringify(State.heroStats(state, r0)) !== JSON.stringify(hpBeforeT), 'talento altera atributos');
ok(!engine.addHeroTalent(r0.uid, t3.id), 'círculo III exige classe avançada');
ok(!engine.canJobChange(r0), 'mudança de classe exige nível e classe');
r0.level = 30; r0.classLevel = PR.JOB_CLASS_LEVEL; state.player.gold = 1e8; state.player.crystal = 1e4;
const atkJob = State.heroStats(state, r0).atk;
ok(engine.jobChange(r0.uid) && r0.job === 1 && State.heroStats(state, r0).atk > atkJob, 'mudança de classe');
ok(engine.heroTalentPoints(r0) === 29 + 5 - t1.max, 'classe avançada dá +5 pontos');
const other = state.collection.find(h => h !== r0); ok(!Object.keys(other.talents || {}).length, 'talentos são individuais');
ok(engine.resetHeroTalents(r0.uid) && !Object.keys(r0.talents).length, 'redefinir talentos');
Object.keys(PR.classTrees).forEach(c => PR.classTrees[c].forEach(n => ok(PR.icons[n.icon], `ícone do talento ${n.id}`)));
// Cartas
ok(I.cards.length >= 30 && I.cards.filter(c => c.mvp).length >= 8, 'cartas e cartas MVP');
r0.level = Math.max(r0.level, 30); r0.attr.str = Math.max(r0.attr.str || 0, 30); const sock = I.makeItem({ unique:'muramasa', ilvl:10 }); state.inventory.push(sock); engine.equip(r0.uid, sock.uid);
ok(sock.cards.length === 2, 'mítico tem 2 slots');
state.cards.card_boss = 1; const atkCard = State.heroStats(state, r0).atk;
ok(engine.socketCard(sock.uid, 0, 'card_boss') && State.heroStats(state, r0).atk > atkCard && !state.cards.card_boss, 'encaixar carta MVP');
ok(engine.unsocketCard(sock.uid, 0) && state.cards.card_boss === 1, 'remover carta devolve');
ok(engine.train('atk') && state.training.atk === 1, 'treino da equipe');
ok(engine.upgradeBuilding('forge'), 'construção');
state.shards[r0.id] = 999; const st0 = r0.stars; ok(engine.awaken(r0.uid) && r0.stars === st0 + 1, 'despertar');
{ const scroll = PR.shop.gold.find(o => o.id === 'scroll'); ok(scroll.limit === 3 && scroll.give.scroll === 1, 'Pergaminho de Estudo tem limite diário'); state.consumables.scroll = 5; state.shopDaily = { date:'', bought:{} }; const before = r0.xp, gain = Math.round(State.heroXpNext(r0.level) * .08); ok(engine.useScroll(r0.uid) && r0.xp === before + gain, 'pergaminho concede somente 8% do nível'); ok(engine.useScroll(r0.uid) && engine.useScroll(r0.uid) && !engine.useScroll(r0.uid), 'uso do pergaminho limitado a 3 por dia'); }
ok(Object.values(PR.buffs).every(b => !b.mods?.xp || b.mods.xp <= .15), 'nenhum consumível dá bônus excessivo de EXP');
{ state.boostUntil = engine.now() + 60000; Object.keys(PR.buffs).forEach(id => { if (PR.buffs[id].mods?.xp) state.buffs[id] = engine.now() + 60000; }); ok(engine.mod('xp') <= .50, 'bônus acumulado de EXP tem teto'); state.boostUntil = 0; state.buffs = {}; }
{ const rr = State.newHeroRecord(D.roster[0], 'rare'); rr.level = 50; const p50 = State.statPower(State.heroStats(state, rr)); rr.level = 100; const p100 = State.statPower(State.heroStats(state, rr)); ok(p100 < p50 * 4, 'Poder desacelera em níveis altos'); }
ok(engine.buy('potion') && state.consumables.potion === 1, 'loja em ouro');
state.player.crystal = 200; ok(engine.buy('key1') && state.player.keys >= 1, 'loja em cristais');
ok(engine.refreshMarket(true).length >= 3 && engine.buyMarket(0), 'mercado');
state.contracts[0].progress = state.contracts[0].n; ok(engine.claimContract(0) && state.contracts.length === 3, 'contratos');
ok(engine.claimGuide(), 'guia do viajante');
ok(typeof engine.event().name === 'string', 'evento mundial ativo');

// ---------- sistemas novos ----------
// Armas por classe
const bow = I.makeItem({ ilvl:10, slot:'weapon', wt:'ranged', rarity:'rare' }); state.inventory.push(bow);
const vanguard = engine.heroes.find(r => engine.template(r.id).cls === 'Vanguarda');
ok(!engine.equip(vanguard.uid, bow.uid) && vanguard.equipped.weapon !== bow.uid, 'Vanguarda não empunha arco');
// Escolhas: AUTO ligado resolve sozinho; desligado espera e resolve em 2 minutos
state.progress.dungeon.best = 3; state.settings.auto = true;
engine.enterZone('dungeon', { floor:1 }); engine.room = 2; engine.nextWave();
ok(!engine.pendingChoice && !engine.pendingRoute && state.routeChoice, 'AUTO escolhe a rota sozinho');
state.settings.auto = false; engine.enterZone('dungeon', { floor:1 }); engine.room = 2; engine.nextWave();
ok(engine.pendingChoice && engine.pendingRoute && ['risk','safe'].includes(engine.pendingChoice.recommended), 'AUTO desligado mostra a escolha com recomendação');
engine.update(.05); ok(engine.pendingChoice, 'escolha espera o jogador');
engine.pendingChoice.wait = State.CHOICE_WAIT - .01; engine.update(.05);
ok(!engine.pendingChoice && !engine.pendingRoute, 'após 2 minutos a recomendada é escolhida');
state.settings.auto = true;
// Fenda Abissal infinita
ok(!engine.zoneLock('rift').locked && engine.enterZone('rift', { floor:1 }) && engine.enemies.length >= 3, 'Fenda abre após Shirogane');
for (let room = 1; room <= D.RIFT.rooms; room++) { killWave(); if (engine.phase === 'between') { engine.timer = 0; engine.tick(); } }
ok(state.progress.rift.best === 1, 'andar 1 da Fenda vencido');
ok(State.zonePower(D.zones.rift, { floor:100 }) > State.zonePower(D.zones.rift, { floor:99 }) && engine.riftMutation(7).name, 'Fenda escala sem limite e tem mutações');
// Variante Alfa e bestiário
const alpha = engine.spawnEnemy('fox', 1, { alpha:true }); ok(alpha.name.includes('Alfa') && alpha.maxHp > D.enemies.fox.hp * 2, 'variante Alfa');
state.bestiary.fox = 99; ok(engine.research('fox') === 1, 'pesquisa do bestiário');
// Diárias, login, guilda, crônicas
engine.ensureDaily(); ok(state.daily.list.length === 4 && state.daily.date === State.dayKey(), 'missões diárias do dia');
const dd = state.daily.list[0]; dd.progress = dd.n; ok(engine.claimDaily(0) && dd.claimed && !engine.claimDaily(0), 'resgatar diária uma vez');
ok(engine.loginStatus().available && engine.claimLogin() && !engine.loginStatus().available, 'login diário');
const g0 = state.guildRank.lv; for (let i = 0; i < 12; i++) { state.contracts[0].progress = state.contracts[0].n; engine.claimContract(0); }
ok(state.guildRank.lv > g0, 'rank da guilda sobe');
Object.keys(state.guide.claimed).length; D.guide.forEach(g => { state.guide.claimed[g.id] = true; });
const ch = engine.ensureChronicle(); ok(ch && ch.k === 1 && ch.target > 0, 'crônica infinita começa após o guia');
state.stats.kills += 1e6; state.progress.rift.best = 999; state.stats.upgradeTries = 1e6; state.stats.bossKills += 1e4; Object.keys(D.enemies).forEach(id => { state.bestiary[id] = 1e6; });
state.player.gold = 1e9;
let kk = 0; const types = new Set(); for (let i = 0; i < 6; i++) { types.add(state.chronicle.type); ok(!engine.claimChronicle() || true, 'x'); state.chronicle.target = Math.min(state.chronicle.target, engine.chronicleValue(state.chronicle)); if (engine.claimChronicle()) kk++; }
ok(types.size === 6, 'crônicas variam de tipo');
ok(kk >= 5 && state.chronicle.k > 5, 'crônicas se renovam sem fim');
// Conselheiro e build recomendada
const hr = engine.heroes[0]; hr.level = 20; hr.attr = { str:0, agi:0, vit:0, int:0, dex:0, luk:0 }; hr.talents = {};
const tips = engine.advice(); ok(tips.length && tips.some(t => t.action === 'autoAttr'), 'conselheiro aponta pontos livres');
const hb = State.statPower(State.heroStats(state, hr)); engine.autoBuild(hr.uid);
ok(engine.freeAttr(hr) === 0 && State.statPower(State.heroStats(state, hr)) > hb && (hr.talents.ess || 0) > 0, 'build recomendada aplica atributos e talentos (incluindo a Essência)');
let stuck = 0; engine.events.onStuck = () => stuck++; engine.trackStuck('hunt:9', true); engine.trackStuck('hunt:9', true); ok(stuck === 1, 'conselheiro abre após 2 derrotas no mesmo desafio');
// Refino com materiais (regras: comum até +10 com volta/quebra; raro até +8 seguro e quebra em +9/+10;
// épico até +15 com volta acima de +10; lendário até +15 sem volta)
state.buildings.forge = 10; state.player.gold = 1e12; state.player.ore = 1e7; state.mats = { star:1e4, ori:1e4, adam:1e4 };
const refineUntil = (mat, from, want) => { const it = I.makeItem({ ilvl:10, rarity:'epic', slot:'seal' }); it.plus = from; state.inventory.push(it); for (let i = 0; i < 400; i++) { const r = engine.upgradeItem(it.uid, mat); if (want(r, it)) return true; if (!state.inventory.includes(it)) { it.plus = from; state.inventory.push(it); } if (it.plus !== from) it.plus = from; } return false; };
ok(!engine.upgradeItem(I.makeItem({ ilvl:10, rarity:'epic', slot:'seal' }).uid, 'common').ok, 'item fora da bolsa não refina');
const cm = I.makeItem({ ilvl:10, rarity:'epic', slot:'seal' }); cm.plus = 10; state.inventory.push(cm); ok(/só refina até \+10/.test(engine.upgradeItem(cm.uid, 'common').reason), 'Tamahagane para em +10');
ok(refineUntil('common', 6, (r, it) => r.failed && it.plus === 5), 'comum: falha entre +5 e +8 volta um nível');
ok(refineUntil('common', 9, r => r.broken), 'comum: falha em +10 quebra o item');
ok(!refineUntil('rare', 6, (r, it) => r.failed && it.plus < 6), 'raro: até +8 nunca perde nível');
ok(refineUntil('rare', 9, r => r.broken), 'raro: +9 para +10 pode quebrar');
ok(refineUntil('epic', 12, (r, it) => r.failed && it.plus === 11), 'épico: falha acima de +10 volta 1 nível');
ok(!refineUntil('legendary', 13, (r, it) => r.failed && (it.plus < 13 || !state.inventory.includes(it))), 'lendário: nunca volta nem quebra');
const r15 = I.makeItem({ ilvl:20, rarity:'legendary', slot:'weapon', wt:'sword' }), s0 = I.itemStats(r15).atkFlat; r15.plus = 15; { const k = I.itemStats(r15).atkFlat / s0; ok(k > 2.6 && k < 3.5, 'refino +15 multiplica o ataque da arma por ~3 (antes 4,25: poder exagerado)'); }
// Bolsa cheia: nada se perde
const bagState = State.createState(), be = new CombatEngine(bagState, {}); bagState.invCap = 150;
for (let i = 0; i < 160; i++) be.addItem(I.makeItem({ ilvl:5, rarity:i % 2 ? 'rare' : 'common' }));
ok(bagState.inventory.length === 150 && bagState.overflow.length === 10 && bagState.overflow.some(x => x.rarity === 'rare'), 'bolsa cheia manda itens ao Baú de Excedentes');
bagState.inventory.splice(0, 5); ok(be.takeOverflow() === 5 && bagState.overflow.length === 5, 'trazer do Baú de Excedentes');
// Cartas: raras e fortes, com tiers
ok(I.cards.every(c => c.chance <= 1 / 900) && I.cards.filter(c => c.tier === 'mvp').every(c => c.effect), 'cartas raríssimas; MVP com efeito especial');

// ---------- kits: toda habilidade e ultimate executam ----------
for (const t of D.roster) {
  const rec = State.newHeroRecord(t, 'rare'); state.collection.push(rec); state.formation[0] = rec.uid;
  engine.enterZone('hunt', { stage:3 });
  const u = engine.party[0]; engine.execute(u, t.skill.eff, { isSkill:true }); u.energy = 100;
  ok(engine.castUlt(0, true), `ultimate de ${t.id}`);
}

// ---------- save / load / offline ----------
const store = new Map(); global.localStorage = { getItem:k => store.get(k) || null, setItem:(k, v) => store.set(k, v), removeItem:k => store.delete(k) };
engine.save(); const loaded = State.loadState();
ok(loaded.collection.length === state.collection.length && loaded.formation[0] === state.formation[0] && loaded.progress.boss.kills === 1, 'save/load');
loaded.lastSeen = Date.now() - 3 * 3600 * 1000; loaded.formation = state.formation.slice();
const e2 = new CombatEngine(loaded, {}); const off = e2.offlineGains();
ok(off && off.gold > 0 && off.xp > 0, 'progresso offline');

// ---------- telas ----------
const ui = Object.create(KT.UIController.prototype); ui.state = state; ui.engine = engine; ui.view = {}; ui.invFilter = { slot:'all', sort:'rarity' }; ui.selectedSlot = 0; ui.assets = { spriteImage:() => null };
ui.renderResources = () => {}; ui.session = { mode:'offline' };
const html = [ui.journeyPanel(), ui.destinationPanel('boss'), ui.destinationPanel('hunt'), ui.partyPanel(), ui.heroPanel(r0.uid, 'stats'), ui.heroPanel(r0.uid, 'kit'), ui.heroPanel(r0.uid, 'gear'), ui.collectionPanel(null, 'summon'), ui.inventoryPanel(), ui.talentPanel(r0.uid), ui.heroPanel(r0.uid, 'talents'), ui.rankingPanel(null, 'power'), ...['forge','workshop','cards','dojo','shrine','guild','buildings'].map(t => ui.cityPanel(null, t)), ...['gold','crystal','market','gems'].map(t => ui.shopPanel(null, t)), ...['guide','contracts','achievements'].map(t => ui.questPanel(null, t)), ...['start','combat','classes','elements','synergy','heroes','trees','items','cards','monsters','world','progress','economy'].map(t => ui.wikiPanel(null, t)), ui.recordPanel(), ui.helpPanel()];
html.forEach((h, i) => ok(h.length > 150, `tela ${i} renderiza (${h.length})`));
ok(html.join('').includes('Shirogane') && html.join('').includes('Muramasa Sedenta') && html.join('').includes('Ciclone Cortante'), 'conteúdo das telas');
ok(ui.shopPanel(null, 'gems').includes('servidor oficial') && ui.shopPanel(null, 'p2p').includes('servidor oficial'), 'carteira e mercado de jogadores só com conta');
['daily','advisor'].forEach(t => ok(ui.questPanel(null, t).length > 150, `missões: ${t}`));
['builds','weapons','events','market'].forEach(t => ok(ui.wikiPanel(null, t).length > 300, `wiki: ${t}`));
ok(ui.heroPanel(r0.uid, 'build').includes('Aplicar build completa'), 'aba de build recomendada');
ok(ui.destinationPanel('rift').includes('Recorde'), 'tela da Fenda');
['refine','systems','cards','items','start','combat'].forEach(t => ok(ui.wikiPanel(null, t).length > 300, `wiki: ${t}`));
ok(!fs.readFileSync(path.join(root, 'src/panels.js'), 'utf8').includes("['security','Segurança']"), 'aba Segurança removida da wiki');
ok(ui.wikiPanel(null, 'refine').includes('quebra') && ui.wikiPanel(null, 'refine').includes('−1 nível'), 'wiki de refino mostra regressão e quebra');
['today','expeditions','bounty'].forEach(t => ok(ui.adventurePanel(null, t).length > 150, `aventuras: ${t}`));
ok(ui.inventoryPanel().length > 300, 'tela da bolsa');
ok(ui.profilePanel(1).includes('servidor oficial'), 'perfil público só com conta');
ok(ui.helpPanel().includes('Invasão Mundial'), 'ajuda atualizada');

// ---------- telas online (modo servidor) não podem cair no aviso de "só com conta" ----------
{
  const s0 = ui.session, lm = ui.loadMarket;
  ui.session = { mode:'cloud', user:{ id:1 } }; ui.loadMarket = () => {};
  ui.marketCfg = { enabled:true, goldMarket:true, feeBps:500, goldTaxBps:500, goldListFeeBps:100, goldListFeeMin:50, goldMinPrice:100, holdHours:72 };
  ui.wallet = { balance:0, held:0, withdrawable:0 }; ui.myMkt = { listings:[], mailbox:[{ id:1, kind:'gold', payload:{ amount:4750 }, reason:'Venda' }] };
  const lst = { id:9, sellerId:2, seller:'Outro', kind:'item', payload:state.inventory[0], price:5000, currency:'gold' };
  ui.mktList = [lst, { ...lst, id:10, currency:'gems' }]; ui.mktFilter = { type:'all', sort:'recent', q:'', slot:'all', rarity:'all', currency:'gold' };
  const p2p = ui.p2pPanel();
  ok(!p2p.includes('servidor oficial') && p2p.includes('Anunciar em ouro') && p2p.includes('data-buy-gold="9"') && !p2p.includes('data-buy-listing="10"'), 'mercado online em ouro mostra só anúncios em ouro');
  ok(p2p.includes('4.750') && p2p.includes('coin-ic'), 'ouro no Correio');
  ui.mktFilter.currency = 'gems'; ok(ui.p2pPanel().includes('data-buy-listing="10"'), 'aba de Gemas');
  ui.rankCache = { power:{ at:Date.now(), data:{ ok:true, me:null, rows:[{ id:1, name:'Eu', power:900, team:JSON.stringify([{ id:D.roster[0].id, stars:2 }]), account_level:5 }, { id:2, name:'Outro', power:800, team:null, account_level:4 }, { id:3, name:'C', power:700, team:null, account_level:3 }, { id:4, name:'D', power:100, team:null, account_level:2 }] } } };
  const rk = ui.rankingPanel(null, 'power');
  ok(rk.includes('rk-pod p1 me') && rk.includes('rk-row') && rk.includes('Sua posição em poder'), 'ranking com pódio e posição');
  ui.session = s0; ui.loadMarket = lm;
}
ok(new Set(D.roster.map(h => KT.UIController.helpers.skillGlyph(h))).size >= 8, 'glifos de ultimate variados');
{
  const bs = State.createState(), be = new CombatEngine(bs, {});
  bs.bounty = { offers:[], active:null, points:500, done:0 }; be.buyBountyItem(D.bountyShop.find(x => x.give.box).id);
  ok(bs.inventory.concat(bs.overflow || []).some(x => x.bound), 'baú das Marcas é vinculado');
}

// ---------- melhores itens: valor exato pelos atributos finais do herói ----------
{
  const bs = State.createState(), be = new CombatEngine(bs, {});
  const mk = (cls) => { const t = D.roster.find(h => h.cls === cls); const r = State.newHeroRecord(t, 'epic'); r.level = 40; bs.collection.push(r); return r; };
  const sup = mk('Suporte'), exe = mk('Executor'); bs.formation = [exe.uid, null, sup.uid, null];
  const charm = (stat, v) => { const it = I.makeItem({ slot:'charm', rarity:'rare', ilvl:1 }); it.affixes = [{ id:stat, stat, v, roll:.5 }]; bs.inventory.push(it); return it; };
  const heal = charm('healPow', .18), crit = charm('crit', .06);
  ok(be.itemGain(sup, heal) > be.itemGain(sup, crit), 'Suporte valoriza cura acima de crítico');
  ok(be.itemGain(exe, crit) > be.itemGain(exe, heal), 'Executor valoriza crítico acima de cura');
  be.equip(exe.uid, crit.uid); ok(Math.abs(be.itemGain(exe, crit)) < 1e-9, 'item já equipado não muda nada');
  const refined = JSON.parse(JSON.stringify(crit)); refined.uid = 'it_refined'; refined.plus = 10; bs.inventory.push(refined);
  ok(be.itemGain(exe, refined) > 0 && be.bestItemFor(exe, 'charm') === refined, 'refino alto vence a mesma peça sem refino');
  const heavy = I.makeItem({ slot:'weapon', wt:'heavy', rarity:'epic', ilvl:60 }); bs.inventory.push(heavy); const low = mk('Executor'); low.level = 1;
  ok(be.itemGain(low, heavy) === null && be.bestItemFor(low, 'weapon') !== heavy, 'requisito não atendido fica fora da escolha');
  const n0 = bs.inventory.length; be.itemGain(exe, I.makeItem({ slot:'charm', rarity:'rare', ilvl:1 })); ok(bs.inventory.length === n0, 'avaliar item de fora (mercador) não mexe na bolsa');
}

// ---------- kits únicos e monstros próprios de cada região ----------
{
  const strip = o => JSON.stringify(o, (k, v) => ['name','text','desc','icon','color','anim','fx','sfx','vfx','line','quote'].includes(k) ? undefined : v);
  for (const part of ['skill','ult','passive']) { const sigs = D.roster.map(h => strip(h[part])); ok(new Set(sigs).size === sigs.length, `nenhum herói repete ${part}`); }
  const owner = new Map(); let shared = 0;
  Object.values(D.zones).forEach(z => [...(z.pool || []), ...(z.elites || [])].forEach(id => { if (owner.has(id) && owner.get(id) !== z.id) shared++; else owner.set(id, z.id); }));
  ok(shared === 0, 'cada caçada/dungeon tem monstros próprios');
  ok(Object.values(D.classes).every(c => !c.traitStats), 'classes sem passiva compartilhada');
}

// ---------- Invasão Mundial, expedições e recompensas ----------
{
  const at = (h, m = 0) => Date.UTC(2026, 8, 26, h + 3, m); // horário de Brasília → UTC
  ok(engine.wbWindow(at(13)).active && engine.wbWindow(at(21)).active, 'invasão ativa às 13h e às 21h');
  const off = engine.wbWindow(at(15)); ok(!off.active && off.next && off.next.start === at(20, 30), 'fora da janela mostra a próxima (20h30)');
  ok(engine.wbBossId(at(13)) === D.worldBoss.byDay[6], 'chefe mundial muda pelo dia da semana');
  const hz = Object.values(D.zones).find(z => z.kind === 'hunt' && (state.progress[z.id]?.best || 0) > 0);
  const free = state.collection.filter(h => !state.formation.includes(h.uid)).slice(0, 2).map(h => h.uid);
  if (hz && free.length) {
    state.expeditions = [];
    ok(!engine.startExpedition(hz.id, 3, free), 'duração de expedição inválida');
    ok(engine.startExpedition(hz.id, 1, free), 'expedição começa');
    const x = state.expeditions[0]; ok(!engine.claimExpedition(x.id), 'expedição não volta antes da hora');
    x.start -= 3600000 + 1000; const g0 = state.player.gold; const res = engine.claimExpedition(x.id);
    ok(res && state.player.gold > g0 && !state.expeditions.length, 'expedição rende ouro e libera a vaga');
  }
  state.bounty = { offers:[], active:null, points:0, done:0 };
  const offers = engine.ensureBounties(); ok(offers.length === 3, 'quadro oferece 3 caçadas');
  ok(engine.acceptBounty(0) && !engine.acceptBounty(1), 'uma caçada de recompensa por vez');
  state.bounty.active.progress = state.bounty.active.n; const got = engine.claimBounty(); ok(got && state.bounty.points === got.points && state.bounty.done === 1, 'recompensa entregue com Marcas');
  state.bounty.points = 100; const star0 = state.mats.star; ok(engine.buyBountyItem('b_star') && state.mats.star === star0 + 1 && state.bounty.points === 60, 'loja de Marcas');
  ok(!engine.buyBountyItem('nao_existe'), 'item inexistente na loja de Marcas');
}

// ---------- Travas de EXP, caixas de convocação, presentes e Banco Kogane ----------
{
  const X = KT.State;
  ok(X.heroXpNext(33) > X.heroXpNext(32) && X.heroXpNext(99) / X.heroXpNext(98) > 1.05, 'curva de EXP sempre cresce, inclusive no fim');
  const kills = L => X.heroXpNext(L) / (3.5 * Math.pow(1.065, .92 * (L - 1)));
  ok(kills(99) > kills(60) && kills(60) > kills(40), 'níveis altos custam mais abates que os do meio (antes ficavam mais rápidos)');
  ok(X.xpFactor(10, 60) <= .1 && X.xpFactor(50, 55) === 1 && X.xpFactor(90, 20) <= .1, 'EXP cai para herói carregado muito abaixo e para farm de mapa fácil');
  ok(X.xpFactor(100, 150) === 1, 'inimigos acima do nível 100 não punem heróis no teto');
  const st = X.createState(), en = new CombatEngine(st, {});
  for (let i = 0; i < 10; i++) en.openBox(true);
  [0, 1, 2, 3].forEach(i => en.setParty(i, st.collection[i].uid));
  const h = en.heroes[0]; h.level = 1; h.xp = 0;
  en.giveXp(1e9, 80, 1);
  ok(h.level <= 2, 'um abate nunca rende mais que 5% de um nível (sem power-leveling)');
  // Expedição não passa do nível da região.
  st.progress.hunt.best = 12; const bench = st.collection.find(r => !st.formation.includes(r.uid)); bench.level = 1; bench.xp = 0;
  st.expeditions = [{ id:'x1', zone:'hunt', hours:12, uids:[bench.uid], start:en.now() - 13 * 3600000 }];
  en.claimExpedition('x1');
  const zl = X.enemyLevel(X.zonePower(D.zones.hunt, { stage:12 }));
  ok(bench.level > 1 && bench.level <= zl, `expedição dá EXP mas para no nível da região (${bench.level}/${zl})`);
  // Caixas.
  ok(D.BOXES.length >= 4 && D.BOXES.every(b => Math.abs(Object.values(b.rates).reduce((a, v) => a + v, 0) - 1) < 1e-9), 'caixas com chances somando 100%');
  st.player.keys = 0; ok(!en.openBoxes(1, 'astral').length && /chaves/.test(en.lastError), 'sem chaves não convoca');
  st.player.keys = 1000;
  const ten = en.openBoxes(10, 'astral'); ok(ten.length === 10 && st.player.keys === 900 && ten.every(r => r.rarityRolled !== 'common'), 'Caixa Astral: 10 chaves cada, sem comuns');
  let seasonHits = 0; for (let k = 0; k < 10; k++) seasonHits += en.openBoxes(10, 'season').filter(r => r.season).length;
  ok(seasonHits > 35, `Caixa da Temporada prioriza heróis novos (${seasonHits}/100)`);
  const cls = en.openBoxes(10, 'class', 'Suporte'); ok(cls.every(r => D.roster.find(t => t.id === r.id).cls === 'Suporte'), 'Caixa de Classe só sorteia a classe escolhida');
  ok(!en.openBoxes(10, 'worlds').some(r => D.SEASON.heroes.includes(r.id)), 'heróis da temporada não saem na Caixa dos Mundos durante a temporada');
  st.pityBy.season = 19; const pityRoll = en.openBoxes(1, 'season')[0]; ok(pityRoll.rarityRolled === 'legendary' && pityRoll.season, 'garantia da temporada entrega lendário da temporada');
  for (let k = 0; k < 20; k++) { const r10 = en.openBoxes(10, 'worlds'); if (!r10.length) break; ok(r10.some(r => ['epic', 'legendary'].includes(r.rarityRolled)), '10× garante um Épico'); }
  // Presentes do correio.
  const st2 = X.createState(), e2 = new CombatEngine(st2, {});
  ok(e2.marketReceive('keys', { n:1000 }) && st2.player.keys === 1000, 'presente de 1000 chaves');
  ok(e2.marketReceive('hero', { id:'vegeta_ego', rarity:'legendary' }) && st2.collection.some(r => r.id === 'vegeta_ego' && r.rarity === 'legendary'), 'presente de herói lendário');
  ok(D.roster.find(t => t.id === 'vegeta_ego').cls === 'Executor', 'Vegeta Ultra Ego é Executor');
  ok(!e2.marketReceive('hero', { id:'nao_existe', rarity:'legendary' }), 'herói inexistente é recusado');
  // Save adulterado volta ao possível.
  const bad = JSON.parse(JSON.stringify(st2)); bad.collection[0].stars = 99; bad.collection[0].attr.str = 9999; bad.collection[0].talents = { v1:99 }; bad.training.atk = 9999; bad.paragon.lv = 9999; bad.player.keys = -5;
  const fixed = X.mergeState(bad);
  ok(fixed.collection[0].stars === 6 && fixed.collection[0].attr.str === 0 && !Object.keys(fixed.collection[0].talents).length && fixed.training.atk <= 10 && fixed.paragon.lv <= D.PARAGON.cap && fixed.player.keys === 0, 'saves impossíveis são corrigidos ao carregar');
  // Telas.
  ui.session = { mode:'offline' };
  const sum = ui.collectionPanel(null, 'summon'); ok(D.BOXES.every(b => sum.includes(`data-open-box="${b.id}"`)) && sum.includes('Temporada'), 'tela de convocação mostra as quatro caixas');
  ui.session = { mode:'neon' }; KT.NeonMarket = { econ:{ index:1.2, faucet:.97, price:1.03, taxBps:550, perPlayer:900000, target:1200000, income:200000, players:2, money:5e6, volume24:0, trades24:0, listings:0, orders:0, growth24:null,
    history:[{ at:'2026-09-27T10:00:00Z', index:1, raw:1, faucet:1, perPlayer:8e5, target:1e6 }, { at:'2026-09-27T10:20:00Z', index:1.2, raw:1.6, faucet:.97, perPlayer:9e5, target:1.2e6 }], prices:{}, asks:{}, bids:{}, rarity:{} }, economy:() => Promise.resolve() };
  const bank = ui.bankPanel(null, 'overview'); ok(bank.includes('Banco Kogane') || bank.includes('BANCO KOGANE'), 'Banco Kogane com identidade própria');
  ok((bank.match(/<svg viewBox/g) || []).length === 2 && !bank.includes('preserveAspectRatio="none"'), 'gráficos com escala e sem distorção');
  const q = ui.bankPanel(null, 'quotes'); ok(!/<em>–<\/em>/.test(q) && q.includes('estimativa do Banco'), 'cotações nunca ficam vazias (estimativa quando não há vendas)');
  ui.session = { mode:'offline' };
}

{
  const X = KT.State, st = X.createState(); const e = new CombatEngine(st, {});
  const old = JSON.parse(JSON.stringify(st)); old.collection = [X.newHeroRecord(D.roster.find(t => t.id === 'tobias'), 'rare'), { ...X.newHeroRecord(D.roster.find(t => t.id === 'tobias'), 'epic'), uid:'hero_old_asta', id:'asta' }]; old.shards = { asta:12 };
  const m = X.mergeState(old); ok(m.collection.some(h => h.uid === 'hero_old_asta' && h.id === 'luffy_gear5') && m.shards.luffy_gear5 === 12 && !m.shards.asta, 'ids antigos da temporada migram para as formas despertadas');
  const e2 = new CombatEngine(m, {}); ok(e2.setParty(0, m.collection[0].uid) && !e2.setParty(1, 'hero_old_asta'), 'forma despertada e original não entram juntos na equipe');
  ok(D.SEASON.heroes.every(id => { const t = D.roster.find(h => h.id === id); return t.base !== id && D.roster.some(h => h.id === t.base); }), 'toda forma despertada aponta para o herói original');
}

{
  const X = KT.State, st = X.createState(), e = new CombatEngine(st, {});
  for (let i = 0; i < 10; i++) e.openBox(true); [0, 1, 2, 3].forEach(i => e.setParty(i, st.collection[i].uid));
  const h = e.heroes[0]; h.level = 40; Object.keys(h.attr).forEach(k => { h.attr[k] = 19; }); let it; for (let k = 0; k < 50 && !(it && I.equipCheck(it, h).ok); k++) it = I.makeItem({ ilvl:10, rarity:'epic', slot:'weapon', prefer:I.allowedTypes(h.id) }); e.addItem(it);
  ok(e.equip(h.uid, it.uid) && e.bagCount() === 0 && st.inventory.length === 1, 'item equipado não ocupa a bolsa');
  ok(e.unequip(h.uid, 'weapon') && st.storage.some(x => x.uid === it.uid) && !st.inventory.some(x => x.uid === it.uid), 'desequipar manda o item ao Armazém');
  ok(!e.salvageMany('legendary').n && st.storage.length === 1, 'desmontar em massa nunca toca o Armazém');
  ok(e.equip(h.uid, it.uid) && !st.storage.length && h.equipped.weapon === it.uid, 'equipar direto do Armazém');
  ok(e.removeFromParty(h.uid) && st.storage.some(x => x.uid === it.uid) && !h.equipped.weapon, 'herói que sai da equipe devolve os itens ao Armazém');
  const it2 = I.makeItem({ ilvl:10, rarity:'legendary', slot:'charm' }); e.addItem(it2); ok(e.storeMany('epic') >= 1 && st.storage.some(x => x.uid === it2.uid), 'guardar épicos+ em massa');
  ok(e.retrieveItem(it2.uid) && st.inventory.some(x => x.uid === it2.uid), 'trazer do Armazém para a bolsa');
  const cap0 = e.storageCap(); st.player.crystal = 5000; ok(e.buyDecor('lanterns') && e.storageCap() === cap0 + 50 && !e.buyDecor('lanterns'), 'enfeite do Armazém aumenta o espaço (compra única)');
  ok(X.mergeState(JSON.parse(JSON.stringify(st))).storage.length === st.storage.length && X.mergeState(JSON.parse(JSON.stringify(st))).decor.lanterns, 'Armazém e enfeites persistem no save');
  // Poder compacto.
  ok(X.powerScore(5000) > 500 && X.powerScore(5000) < 1000 && X.powerScore(27e6) > 300000 && X.powerScore(27e6) < 800000 && X.powerScore(2e6) > X.powerScore(1e6), 'Poder exibido: ~700 no começo, centenas de milhares no nível 100, mesma ordem');
  const recs = [['hunt', { stage:1 }], ['hunt', { stage:12 }], ['hunt_tide', { stage:12 }], ['hunt_desert', { stage:12 }], ['hunt_sky', { stage:12 }]].map(([z, o]) => e.recommendedPower(z, o));
  ok(recs.every((v, i) => !i || v > recs[i - 1]) && recs[0] < 1000 && recs[4] < 500000, `mapas crescem sem saltos exagerados (${recs.join(' → ')})`);
  ok(D.levelOfPower(D.levelPower(77)) > 76.9 && D.levelOfPower(D.levelPower(77)) < 77.1 && Math.abs(D.levelPower(33) - Math.pow(1.065, 32)) < 1e-9, 'curva de nível ↔ força é inversível e o Capítulo I não mudou');
  ok(Math.abs(X.rewardPower(D.levelPower(80)) - Math.pow(1.065, 79)) < 1e-6 * Math.pow(1.065, 79), 'ouro e EXP seguem o nível do inimigo, não a força');
  const oldIt = { slot:'weapon', ilvl:50, rarity:'epic', primary:14 * Math.pow(1.12, 49) * 1.55 }; I.normalizeItemPrimary(oldIt); ok(Math.abs(oldIt.primary - 14 * I.ilvlGrowth(50) * 1.55) < 1e-6 && oldIt.pv === 2 && I.makeItem({ ilvl:50, rarity:'epic', slot:'weapon' }).pv === 2, 'itens antigos acima do nível 30 são recalculados uma vez; itens novos já vêm na curva nova');
}

{ const v = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8')).v, cfg = fs.readFileSync(path.join(root, 'src/config.js'), 'utf8'), html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  ok(cfg.includes(`KT.VERSION = '${v}'`) && html.includes(`?v=${v}`), 'version.json, KT.VERSION e o cache do index.html na mesma versão (atualização automática)'); }

console.log(JSON.stringify({ ok:true, checks, power:engine.getPower(), kills:state.stats.kills, loot:events.loot, inventory:state.inventory.length }, null, 2));
