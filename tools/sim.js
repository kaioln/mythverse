// Simulador de progressão: um "jogador" automático joga sem interface e registra
// quanto tempo leva para cada marco. Uso: node tools/sim.js [horas] [semente]
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.resolve(__dirname, '..');
global.setTimeout = fn => fn();
let seed = Number(process.argv[3] || 7);
Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
for (const f of ['src/data.js','src/utils.js','src/items.js','src/progression.js','src/roster.js','src/builds.js','src/engine.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename:f });
const { State, CombatEngine, Data:D, Items:I, Progression:PR } = global.KT;

const HOURS = Number(process.argv[2] || 3);
const state = State.createState();
const log = [];
let t = 0;
const mark = txt => { log.push(`${(t / 60).toFixed(1).padStart(6)} min  ${txt}`); };
const lootBy = {}, hourly = [];
const engine = new CombatEngine(state, { onToast(){}, onLog(){}, onFx(){}, onLoot(it){ lootBy[it.rarity] = (lootBy[it.rarity] || 0) + 1; }, onZone(){}, onWave(){}, onState(){}, onChoice(c){ if (c.kind === 'route') setTimeout(() => engine.chooseRoute('safe')); else setTimeout(() => engine.resolveEncounter(c.options[0].id === 'buy0' ? 'leave' : c.options[0].id)); }, onResult(){}, onDialog(){}, onWarn(){}, onPhase(){}, onStageClear(){}, onDefeatHunt(){}, onAccountLevel(){} });

for (let i = 0; i < 10; i++) engine.openBox(true);
const hint = { Vanguarda:['vit','str'], Executor:['str','dex','luk'], Arcanista:['int','luk'], Atirador:['agi','dex'], Suporte:['int','vit'] };
function pickTeam() {
  const ctx = State.teamContext(state, []);
  const scored = state.collection.map(r => ({ r, t:D.roster.find(x => x.id === r.id), p:State.statPower(State.heroStats(state, r, ctx)) })).sort((a, b) => b.p - a.p);
  const pick = []; const add = x => { if (x && !pick.includes(x) && pick.length < 4) pick.push(x); };
  add(scored.find(x => x.t.cls === 'Vanguarda')); add(scored.find(x => x.t.cls === 'Suporte'));
  scored.forEach(add);
  const front = pick.filter(x => ['Vanguarda','Executor'].includes(x.t.cls)); const back = pick.filter(x => !front.includes(x));
  const order = [...front, ...back];
  state.formation = [0, 1, 2, 3].map(i => order[i]?.r.uid || null);
}
pickTeam();
const talentPath = ['root','b1','b1','b1','a1','a1','g1','g1','g2','g2','b2','b2','b4','b4','b3','b3','bN1','a2','a2','g3','g3','b5','b5','bN2','b6','e1','e1','g4','g4','gN1'];
function manage() {
  const ctx = engine.ctx();
  engine.heroes.forEach(r => { engine.autoAttr(r.uid); engine.autoEquip(r.uid); }); // o simulador escolhe equipamentos como um jogador atento
  // Desmontar lixo.
  engine.salvageMany('rare');
  // Gastar ouro.
  for (let k = 0; k < 20; k++) {
    const opts = [];
    Object.keys(PR.training).forEach(key => { const lv = state.training[key]; if (lv < PR.trainingCap(state.buildings.dojo)) opts.push({ c:PR.trainingCost(lv), f:() => engine.train(key) }); });
    ['forge','dojo','guild'].forEach(b => { if (state.buildings[b] < engine.buildingCap()) opts.push({ c:engine.buildingCost(b) * 1.5, f:() => engine.upgradeBuilding(b) }); });
    engine.heroes.forEach(r => Object.values(r.equipped).forEach(uid => { const it = state.inventory.find(x => x.uid === uid); if (it && it.plus < I.maxPlus(state.buildings.forge)) { const c = I.upgradeCost(it, state.buildings.forge); if (state.player.ore >= c.ore) opts.push({ c:c.gold, f:() => engine.upgradeItem(uid) }); } }));
    engine.heroes.forEach(r => { const c = State.awakenCost(r.stars, state.buildings.shrine); if ((state.shards[r.id] || 0) >= c.shards) opts.push({ c:c.gold * .5, f:() => engine.awaken(r.uid) }); });
    opts.sort((a, b) => a.c - b.c);
    const o = opts[0]; if (!o || state.player.gold < o.c) break; o.f();
  }
  while (state.player.keys > 0) engine.openBox(true);
  while (state.player.crystal >= 150) engine.buy('key1');
  engine.heroes.forEach(r => { engine.autoTalents(r.uid); if (engine.canJobChange(r)) engine.jobChange(r.uid); });
  while (engine.claimGuide());
  engine.claimLogin(); state.daily.list.forEach((d, i) => engine.claimDaily(i)); while (engine.claimChronicle());
  for (let i = 2; i >= 0; i--) engine.claimContract(i);
  D.achievements.forEach(a => engine.claimAchievement(a.id));
  if (state.consumables.potion < 3 && state.player.gold > 5000) engine.buy('potion');
}

const seen = {};
function milestones() {
  const p = state.progress;
  for (const z of ['hunt','hunt_tide']) { const b = p[z].best; if (b && seen[z] !== b) { seen[z] = b; mark(`${D.zones[z].title} estágio ${b} · poder ${engine.getPower().toLocaleString()} · rec ${engine.recommendedPower(z, { stage:b + 1 }).toLocaleString()} · nível médio ${(engine.heroes.reduce((s, r) => s + r.level, 0) / 4).toFixed(1)}`); } }
  for (const z of ['dungeon','dungeon_tide']) { const b = p[z].best; if (b && seen[z] !== b) { seen[z] = b; mark(`${D.zones[z].title} andar ${b}`); } }
  for (const z of ['boss','boss_tide']) { const k = p[z].kills; if (k && seen[z] !== k) { seen[z] = k; mark(`*** ${D.zones[z].title} derrotado (${k}) · tempo de luta ${engine.bossTimer?.toFixed(0)}s`); } }
}
let attempts = {};
function decide() {
  const p = state.progress, pow = engine.getPower();
  const tryZone = (id, opts) => { const rec = engine.recommendedPower(id, opts); const key = id + JSON.stringify(opts); if (!engine.zoneLock(id).locked && pow >= rec * .9 && (attempts[key] || 0) < 3 + Math.floor(t / 1800)) { attempts[key] = (attempts[key] || 0) + 1; return engine.enterZone(id, opts); } return false; };
  if (state.zone.startsWith('hunt')) {
    const c2 = !engine.zoneLock('hunt_tide').locked;
    if (!c2) {
      if (p.dungeon.best < 3 && tryZone('dungeon', { floor:p.dungeon.best + 1 })) return;
      if (tryZone('boss', { tier:0 })) return;
    } else {
      if (state.zone === 'hunt') { engine.enterZone('hunt_tide', { stage:Math.max(1, p.hunt_tide.best) }); state.settings.autoAdvance = true; return; }
      if (p.dungeon_tide.best < 3 && tryZone('dungeon_tide', { floor:p.dungeon_tide.best + 1 })) return;
      if (tryZone('boss_tide', { tier:0 })) return;
    }
    if (!state.settings.autoAdvance && pow > engine.recommendedPower(state.zone, { stage:(p[state.zone].best || 0) + 1 }) * 1.0) { state.settings.autoAdvance = true; }
  }
}
engine.events.onResult = r => { if (r.kind === 'defeat' || r.kind === 'boss') mark(`${r.kind === 'defeat' ? 'DERROTA' : 'vitória'} em ${r.zone.title}${r.floor ? ' andar ' + r.floor : ''} · poder ${engine.getPower().toLocaleString()} · rec ${engine.recommendedPower(r.zone.id, engine.opts).toLocaleString()}${engine.bossTimer ? ' · luta ' + engine.bossTimer.toFixed(0) + 's' : ''}`); };
engine.enterZone('hunt', { stage:1 });
let deaths = 0; engine.events.onDefeatHunt = () => deaths++;
const DT = .08, END = HOURS * 3600;
let manageT = 0;
while (t < END) {
  engine.update(DT); t += DT; manageT += DT;
  if (engine.phase === 'result' && !engine.autoAfterResult) { engine.fallbackToHunt(); }
  if (engine.phase === 'result' && engine.lastResult?.kind !== 'defeat') { engine.autoAfterResult = null; engine.fallbackToHunt(); }
  if (manageT > 30) { manageT = 0; manage(); milestones(); if (engine.phase !== 'fight' || state.zone.startsWith('hunt')) decide(); }
  if (Math.floor(t / 3600) > hourly.length - 1 && t >= 3600 * hourly.length) hourly.push({ h:hourly.length, goldEarned:state.stats.goldEarned, kills:state.stats.kills, cards:state.stats.cards || 0, star:state.mats?.star || 0, ori:state.mats?.ori || 0, zone:state.zone, stage:engine.opts.stage || engine.opts.floor || 0 });
}
milestones();
console.log(log.join('\n'));
console.log(`\nFim: ${HOURS}h · conta nv ${state.player.level} · heróis ${engine.heroes.map(r => `${D.roster.find(x => x.id === r.id).name} nv${r.level} ${r.stars}★`).join(', ')}`);
console.log(`Ouro ${state.player.gold.toLocaleString()} · itens ${state.inventory.length} · derrotas em caçada ${deaths} · kills ${state.stats.kills} · treino ${JSON.stringify(state.training)} · prédios ${JSON.stringify(state.buildings)}`);
console.log('Por hora (acumulado): h | ouro ganho | abates | cartas | Aço Estelar | Oricalco | onde');
hourly.forEach((x, i) => { const prev = hourly[i - 1] || { goldEarned:0, kills:0 }; console.log(`${String(x.h).padStart(2)}h | +${Math.round((x.goldEarned - prev.goldEarned) / 1000)}k ouro/h | ${x.kills - prev.kills} abates/h | cartas ${x.cards} | estelar ${x.star} | oricalco ${x.ori} | ${x.zone} ${x.stage}`); });
console.log('Itens obtidos por raridade:', JSON.stringify(lootBy), '· ouro total ganho', state.stats.goldEarned.toLocaleString(), '· cartas', state.stats.cards || 0);
