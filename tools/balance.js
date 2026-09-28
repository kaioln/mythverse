// Balanceamento de mapas por combate real: uma equipe de referência no nível dos inimigos luta cada
// estágio/andar/chefe com o motor do jogo. Mede vitória, tempo e HP restante.
// Uso: node tools/balance.js [lutas por ponto] [nível extra da equipe]
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.resolve(__dirname, '..');
global.setTimeout = fn => fn();
let seed = 11;
Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
for (const f of ['src/data.js', 'src/utils.js', 'src/items.js', 'src/progression.js', 'src/roster.js', 'src/builds.js', 'src/engine.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename:f });
const { State, CombatEngine, Data:D, Items:I, Progression:PR } = global.KT;
const RUNS = Number(process.argv[2] || 2), EXTRA = Number(process.argv[3] || 0);
const TEAM = (process.env.TEAM || 'hayato,aurelia,kenji,sora').split(','); // padrão: Vanguarda, Suporte, Executor, Arcanista

// Equipe de referência para o nível L numa região: itens raros/épicos do nível do mapa, refino típico,
// atributos e talentos automáticos, treino e qualidade compatíveis com o ponto da campanha.
function referenceState(L, zone, opts) {
  const s = State.createState();
  const ilvl = State.itemLevelFor(zone, opts), plus = Math.min(12, Math.floor(L / 9)), stars = L < 30 ? 2 : L < 60 ? 3 : L < 85 ? 4 : 5;
  s.collection = TEAM.map(id => ({ ...State.newHeroRecord(D.roster.find(t => t.id === id), L < 40 ? 'rare' : 'epic'), level:L, stars, job:L >= 60 ? 2 : L >= 30 ? 1 : 0, classLevel:Math.min(50, Math.round(L / 2)) }));
  s.formation = s.collection.map(h => h.uid);
  s.buildings.dojo = Math.max(1, Math.min(20, Math.floor(L / 5))); s.buildings.forge = Math.max(1, Math.floor(L / 8)); s.buildings.house = 1;
  Object.keys(PR.training).forEach(k => { s.training[k] = Math.min(PR.trainingCap(s.buildings.dojo), Math.floor(L * .45)); });
  s.player.level = Math.round(L * 1.1); s.consumables.potion = 5; s.consumables.elixir = 3;
  const e = new CombatEngine(s, {});
  s.collection.forEach(h => {
    Object.keys(I.slots).forEach(slot => {
      let it = null;
      for (let k = 0; k < 60; k++) { const c = I.makeItem({ ilvl, rarity:L < 45 ? 'rare' : 'epic', slot, prefer:I.allowedTypes(h.id) }); if (I.canEquip(c, h.id)) { it = c; break; } }
      if (!it) return; it.plus = plus; s.inventory.push(it);
    });
    e.autoAttr(h.uid); e.autoTalents(h.uid);
    s.inventory.filter(it => !e.ownerOf(it.uid)).forEach(it => { if (I.equipCheck(it, h).ok && !h.equipped[it.slot]) h.equipped[it.slot] = it.uid; });
  });
  s.settings.auto = true; s.settings.autoAdvance = false; s.settings.autoRepeat = false; s.story.seen.intro = s.story.seen.intro2 = true;
  return { s, e };
}

function fight(zoneId, opts) {
  const z = D.zones[zoneId], L = Math.min(100, State.enemyLevel(State.zonePower(z, opts))) + EXTRA;
  const { s, e } = referenceState(Math.max(1, Math.min(100, L)), z, opts);
  Object.keys(s.progress).forEach(k => { s.progress[k].best = 99; s.progress[k].kills = 9; });
  e.events = { onChoice(c) { if (c.kind === 'route') setTimeout(() => e.chooseRoute('safe')); else setTimeout(() => e.resolveEncounter(c.options[0].id === 'buy0' ? 'leave' : c.options[0].id)); } };
  e.enterZone(zoneId, opts);
  let t = 0; const LIMIT = z.kind === 'boss' ? 240 : 420;
  while (t < LIMIT) {
    e.update(.1); t += .1;
    if (e.phase === 'stageClear' || e.phase === 'defeat' || (e.phase === 'result' && e.lastResult)) break; // derrota encerra (antes o estágio recomeçava e contava como vitória)
  }
  const won = e.phase !== 'defeat' && s.stats.deaths === 0 && (e.phase === 'stageClear' || (e.phase === 'result' && e.lastResult && e.lastResult.kind !== 'defeat'));
  const hp = e.party.length ? e.party.reduce((a, u) => a + Math.max(0, u.hp) / u.maxHp, 0) / e.party.length : 0;
  return { won, t, hp, L, power:e.getPower(), rec:e.recommendedPower(zoneId, opts) };
}

module.exports = { fight, referenceState, State, D };
if (require.main === module) {
const points = [];
Object.values(D.zones).filter(z => ['hunt', 'dungeon', 'boss'].includes(z.kind) && z.chapter <= 4).forEach(z => {
  if (z.kind === 'hunt') [1, Math.ceil(z.stages / 2), z.stages].forEach(stage => points.push([z.id, { stage }]));
  if (z.kind === 'dungeon') [1, z.floors].forEach(floor => points.push([z.id, { floor }]));
  if (z.kind === 'boss') points.push([z.id, { tier:0 }]);
});
console.log('região            ponto        nv  vitórias  tempo   HP   Poder / recomendado');
for (const [id, o] of points) {
  const rs = Array.from({ length:RUNS }, () => fight(id, o));
  const w = rs.filter(r => r.won).length, avg = k => rs.reduce((a, r) => a + r[k], 0) / rs.length;
  console.log(`${id.padEnd(17)} ${JSON.stringify(o).padEnd(12)} ${String(rs[0].L).padStart(3)}  ${w}/${RUNS}      ${avg('t').toFixed(0).padStart(4)}s  ${(avg('hp') * 100).toFixed(0).padStart(3)}%  ${Math.round(avg('power')).toLocaleString('pt-BR')} / ${rs[0].rec.toLocaleString('pt-BR')}`);
}
}
