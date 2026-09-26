// Teste de fumaça: valida conteúdo, motor, progressão, itens, economia e telas sem navegador.
// Uso: node tests/smoke.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.resolve(__dirname, '..');
global.setTimeout = fn => { fn(); return 0; };
for (const f of ['src/data.js','src/utils.js','src/items.js','src/progression.js','src/roster.js','src/engine.js','src/assets.js','src/ui.js','src/panels.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename:f });
const { State, CombatEngine, Data:D, Items:I, Progression:PR } = global.KT;
let checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) throw new Error(msg); };

// ---------- conteúdo ----------
ok(D.roster.length === 60 && new Set(D.roster.map(h => h.id)).size === 60, '60 heróis únicos');
ok(new Set(D.roster.map(h => h.skill.name)).size === 60 && new Set(D.roster.map(h => h.ult.name)).size === 60, 'habilidades e ultimates únicas');
D.roster.forEach(h => { ok(h.passiveText && h.skillText && h.ultText, `kit descrito: ${h.id}`); ok(fs.existsSync(path.join(root, 'assets/sprites', `${h.sprite}.png`)) && fs.existsSync(path.join(root, 'assets/portraits', `${h.id}.png`)), `arte: ${h.id}`); });
ok(Object.keys(D.classes).every(c => D.roster.filter(h => h.cls === c).length >= 8), 'todas as classes têm heróis');
Object.values(D.enemies).forEach(e => ok(fs.existsSync(path.join(root, 'assets/sprites', `${e.sprite}.png`)), `sprite de monstro: ${e.sprite}`));
const zonePools = ['hunt','dungeon','hunt_tide','dungeon_tide'].map(z => new Set([...D.zones[z].pool, ...D.zones[z].elites.filter(x => x !== 'fox_specter')]));
ok(zonePools.every((a, i) => zonePools.every((b, j) => i === j || [...a].every(x => !b.has(x)))), 'monstros não se repetem entre regiões');
[...I.bases.map(b => [b.icon, b.hue]), ...I.uniques.map(q => [q.icon, q.hue]), ...I.sets.flatMap(s => Object.values(s.pieces).map(p => [p[1], p[2]]))].forEach(([icon, hue]) => ok(fs.existsSync(path.join(root, 'assets/icons', `${icon}${hue ? `_h${hue}` : ''}.png`)), `ícone ${icon} ${hue}`));
ok(I.bases.length >= 30 && I.uniques.length >= 15 && I.sets.length >= 7 && I.affixes.length >= 18, 'variedade de itens');
for (const id of Object.keys(D.zones)) ok(fs.existsSync(path.join(root, 'assets/scenes', `${id}.png`)), `cenário ${id}`);

// ---------- início ----------
const state = State.createState();
const events = { loot:0, results:[], dialogs:0 };
const engine = new CombatEngine(state, { onLoot(){ events.loot++; }, onResult(r){ events.results.push(r); }, onDialog(){ events.dialogs++; } });
ok(state.starterRolls === 10 && !state.collection.length && state.player.gold === 0, 'jornada começa vazia');
ok(engine.enterZone('hunt') === false, 'sem equipe não viaja');
for (let i = 0; i < 10; i++) ok(engine.openBox(true), 'convocação inicial');
ok(state.starterRolls === 0 && state.boxesOpened === 10, 'convocações consumidas');
const uniq = [...new Map(state.collection.map(r => [r.id, r])).values()];
while (uniq.length < 4) { const t = D.roster.find(h => !uniq.some(r => r.id === h.id)); const r = State.newHeroRecord(t, 'rare'); state.collection.push(r); uniq.push(r); }
const byCls = cls => D.roster.find(h => h.cls === cls);
// Equipe balanceada garantida para os testes.
['Vanguarda','Executor','Suporte','Arcanista'].forEach((cls, i) => { let r = state.collection.find(x => engine.template(x.id).cls === cls && !state.formation.includes(x.uid)); if (!r) { r = State.newHeroRecord(byCls(cls), 'epic'); state.collection.push(r); } ok(engine.setParty(i, r.uid), 'escalar herói'); });
ok(engine.heroes.length === 4 && engine.getPower() > 0, 'equipe formada com poder');
ok(!engine.setParty(1, state.formation[0]) || new Set(state.formation).size === 4, 'herói não duplica na formação');

// ---------- caçada ----------
ok(engine.enterZone('hunt', { stage:1 }) && engine.active && engine.enemies.length >= 2, 'caçada inicia');
ok(engine.zoneLock('dungeon').locked && engine.zoneLock('boss').locked, 'dungeon e chefe começam bloqueados');
const tick = sec => { for (let t = 0; t < sec; t += .05) engine.update(.05); };
const killWave = () => { engine.encounterUsed = true; engine.enemies.forEach(e => { e.hp = 1; }); engine.enemies.forEach(e => engine.hit(engine.party[0], e, 50, { kind:'skill' })); engine.checkOutcome(); };
for (let w = 0; w < 4; w++) { killWave(); if (engine.phase === 'between') { engine.timer = 0; engine.update(.01); } }
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
  if (engine.phase === 'between') { engine.timer = 0; engine.update(.01); }
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
const before = State.heroStats(state, r0);
const weapon = I.makeItem({ ilvl:10, rarity:'epic', slot:'weapon' }); state.inventory.push(weapon);
ok(engine.equip(r0.uid, weapon.uid) && State.heroStats(state, r0).atk > before.atk, 'arma aumenta ATK');
const r1 = engine.heroes[1]; engine.equip(r1.uid, weapon.uid);
ok(!r0.equipped.weapon && r1.equipped.weapon === weapon.uid, 'item não equipa em dois heróis');
state.player.gold = 1e7; state.player.ore = 1e4; state.player.dust = 1e4;
const up = engine.upgradeItem(weapon.uid); ok(up.ok && weapon.plus === 1, 'aprimoramento');
ok(engine.enchantItem(weapon.uid, 0), 'encantamento');
['weapon','focus'].forEach(slot => { const it = I.makeItem({ set:'eclipse', ilvl:14, slot }); state.inventory.push(it); engine.equip(r0.uid, it.uid); });
ok(State.heroStats(state, r0).sets.some(s => s.set.id === 'eclipse' && s.active.includes(2)), 'bônus de conjunto (2 peças)');
const junk = I.makeItem({ ilvl:1, rarity:'common' }); state.inventory.push(junk);
const sv = engine.salvage(junk.uid); ok(sv && sv.ore > 0 && !state.inventory.includes(junk), 'desmontar');
for (let i = 0; i < 40; i++) { const d = I.rollDrop('boss', D.zones.boss, 14, 1); ok(d && d.slot && I.itemScore(d) > 0, 'drop válido'); }

// ---------- progressão ----------
r0.level = 10; ok(engine.freeAttr(r0) === 9 * PR.ATTR_PER_LEVEL + 5, 'pontos de atributo');
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
ok(!engine.canJobChange(r0), 'mudança de classe exige nível 30');
r0.level = 30; state.player.gold = 1e8; state.player.crystal = 1e4;
const atkJob = State.heroStats(state, r0).atk;
ok(engine.jobChange(r0.uid) && r0.job === 1 && State.heroStats(state, r0).atk > atkJob, 'mudança de classe');
ok(engine.heroTalentPoints(r0) === 29 + 5 - t1.max, 'classe avançada dá +5 pontos');
const other = state.collection.find(h => h !== r0); ok(!Object.keys(other.talents || {}).length, 'talentos são individuais');
ok(engine.resetHeroTalents(r0.uid) && !Object.keys(r0.talents).length, 'redefinir talentos');
Object.keys(PR.classTrees).forEach(c => PR.classTrees[c].forEach(n => ok(PR.icons[n.icon], `ícone do talento ${n.id}`)));
// Cartas
ok(I.cards.length >= 30 && I.cards.filter(c => c.mvp).length === 3, 'cartas e cartas MVP');
const sock = I.makeItem({ unique:'muramasa', ilvl:10 }); state.inventory.push(sock); engine.equip(r0.uid, sock.uid);
ok(sock.cards.length === 2, 'mítico tem 2 slots');
state.cards.card_boss = 1; const atkCard = State.heroStats(state, r0).atk;
ok(engine.socketCard(sock.uid, 0, 'card_boss') && State.heroStats(state, r0).atk > atkCard && !state.cards.card_boss, 'encaixar carta MVP');
ok(engine.unsocketCard(sock.uid, 0) && state.cards.card_boss === 1, 'remover carta devolve');
ok(engine.train('atk') && state.training.atk === 1, 'treino da equipe');
ok(engine.upgradeBuilding('forge'), 'construção');
state.shards[r0.id] = 999; const st0 = r0.stars; ok(engine.awaken(r0.uid) && r0.stars === st0 + 1, 'despertar');
ok(engine.buy('potion') && state.consumables.potion === 1, 'loja em ouro');
state.player.crystal = 100; ok(engine.buy('key1') && state.player.keys >= 1, 'loja em cristais');
ok(engine.refreshMarket(true).length >= 3 && engine.buyMarket(0), 'mercado');
state.contracts[0].progress = state.contracts[0].n; ok(engine.claimContract(0) && state.contracts.length === 3, 'contratos');
ok(engine.claimGuide(), 'guia do viajante');
ok(typeof engine.event().name === 'string', 'evento mundial ativo');

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
const html = [ui.journeyPanel(), ui.destinationPanel('boss'), ui.destinationPanel('hunt'), ui.partyPanel(), ui.heroPanel(r0.uid, 'stats'), ui.heroPanel(r0.uid, 'kit'), ui.heroPanel(r0.uid, 'gear'), ui.collectionPanel(null, 'summon'), ui.inventoryPanel(), ui.talentPanel(r0.uid), ui.heroPanel(r0.uid, 'talents'), ui.rankingPanel(null, 'power'), ...['forge','workshop','cards','dojo','shrine','guild','buildings'].map(t => ui.cityPanel(null, t)), ...['gold','crystal','market','gems'].map(t => ui.shopPanel(null, t)), ...['guide','contracts','achievements'].map(t => ui.questPanel(null, t)), ...['start','combat','classes','elements','synergy','heroes','trees','items','cards','monsters','world','progress','economy'].map(t => ui.wikiPanel(null, t)), ui.recordPanel(), ui.helpPanel()];
html.forEach((h, i) => ok(h.length > 150, `tela ${i} renderiza (${h.length})`));
ok(html.join('').includes('Shirogane') && html.join('').includes('Muramasa Sedenta') && html.join('').includes('Rasenshuriken'), 'conteúdo das telas');
ok(ui.shopPanel(null, 'gems').includes('desativadas'), 'compras reais desativadas e sinalizadas');

console.log(JSON.stringify({ ok:true, checks, power:engine.getPower(), kills:state.stats.kills, loot:events.loot, inventory:state.inventory.length }, null, 2));
