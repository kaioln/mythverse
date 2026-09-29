// Ouro por hora de farm ativo por nível: equipe de referência (tools/balance.js) no estágio do seu nível,
// repetindo o estágio por N minutos de jogo. Compara com os preços dos sumidouros (refino, Dojo, construções).
// Uso: node tools/goldrate.js [minutos]
const { referenceState, State, D } = require('./balance.js');
const I = global.KT.Items, PR = global.KT.Progression;
const MIN = Number(process.argv[2] || 10);
const hunts = Object.values(D.zones).filter(z => z.kind === 'hunt' && z.chapter <= 4);
console.log('nv  região            ouro/h      +10 (Tamah.)  Dojo nv atual→+1   cap Dojo');
for (const z of hunts) for (const stage of [1, z.stages]) {
  const opts = { stage }, L = Math.min(100, State.enemyLevel(State.zonePower(z, opts)));
  const { s, e } = referenceState(L, z, opts);
  Object.keys(s.progress).forEach(k => { s.progress[k].best = 99; s.progress[k].kills = 9; });
  s.settings.autoRepeat = true;
  e.events = { onChoice(c) { if (c.kind === 'route') e.chooseRoute('safe'); else e.resolveEncounter(c.options[0].id === 'buy0' ? 'leave' : c.options[0].id); } };
  const g0 = s.player.gold; e.enterZone(z.id, opts);
  for (let t = 0; t < MIN * 60; t += .1) { e.update(.1); if (e.phase === 'stageClear' || e.phase === 'defeat') e.enterZone(z.id, opts); }
  const gph = (s.player.gold - g0) * 60 / MIN;
  const ilvl = State.itemLevelFor(z, opts); let r10 = 0; for (let p = 0; p < 10; p++) r10 += I.upgradeCost({ ilvl, rarity:'epic', plus:p }, Math.floor(L / 8)).gold / Math.max(.25, I.REFINE_CHANCE[p + 1]);
  const tl = s.training.atk || 0;
  console.log(`${String(L).padStart(3)} ${`${z.id}:${stage}`.padEnd(17)} ${Math.round(gph).toLocaleString('pt-BR').padStart(11)} ${Math.round(r10).toLocaleString('pt-BR').padStart(13)}  ${tl}→${PR.trainingCost(tl).toLocaleString('pt-BR').padStart(12)}  ${PR.trainingCap(s.buildings.dojo)}`);
}
