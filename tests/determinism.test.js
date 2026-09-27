// Garante que o servidor reproduz exatamente a luta jogada no navegador: mesma semente +
// mesmos comandos (com o passo em que aconteceram) = mesmo estado final, item por item.
// Uso: node tests/determinism.test.js
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const root = path.resolve(__dirname, '..');
const FILES = ['src/data.js','src/utils.js','src/items.js','src/progression.js','src/roster.js','src/builds.js','src/engine.js'];
function load() { const ctx = { console, Math, JSON, Date, Number, String, Array, Object, Map, Set, Promise }; ctx.globalThis = ctx; vm.createContext(ctx); FILES.forEach(f => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename:f })); return ctx.KT; }
const client = load(), server = load();

let checks = 0; const ok = (c, m) => { checks++; assert.ok(c, m); };
let seedCounter = 1000;
const strip = st => { const o = JSON.parse(JSON.stringify(st)); delete o.totalPlaySeconds; delete o.lastSeen; if (o.settings) delete o.settings.speed; return JSON.stringify(o); };

function scenario(zone, opts, segments, manual) {
  // Estado inicial comum.
  const st = client.State.createState();
  const e0 = new client.CombatEngine(st, {});
  for (let i = 0; i < 10; i++) e0.openBox(true);
  ['Vanguarda','Executor','Suporte','Arcanista'].forEach((cls, i) => { const r = st.collection.find(x => e0.template(x.id).cls === cls); if (r) e0.setParty(i, r.uid); });
  st.collection.forEach(r => { r.level = 18; });
  e0.autoBuild && st.formation.forEach(uid => uid && e0.autoBuild(uid));
  st.progress.hunt.best = 12; st.progress.dungeon.best = 3; st.progress.hunt_swamp.best = 8;
  st.consumables.potion = 20; st.consumables.elixir = 20; st.player.gold = 5e6;
  st.settings.auto = !manual;
  const base = JSON.stringify(st);

  // "Navegador": joga com dt irregular, velocidades e comandos aleatórios.
  const cState = client.State.mergeState(JSON.parse(base));
  const eng = new client.CombatEngine(cState, {});
  const log = [];
  let rnd = 7; const r = () => { rnd = (rnd * 48271) % 2147483647; return rnd / 2147483647; };
  eng.segmentProvider = { request(start) { const seg = { id:++seedCounter, seed:seedCounter * 7919, at:Date.parse('2026-09-26T13:00:00-03:00'), ...start }; log.push({ seg }); eng.beginSegment(seg); }, finished(f) { log[log.length - 1].fin = f; }, flush() {} };
  eng.enterZone(zone, opts);
  let frames = 0;
  while (log.filter(x => x.fin).length < segments && frames++ < 60000) {
    cState.settings.speed = [1, 2, 3][Math.floor(r() * 3)];
    eng.update(.016 + r() * .05);
    if (eng.seg && r() < .03) eng.input('ult', Math.floor(r() * 4));
    if (eng.seg && r() < .004) eng.input('potion');
    if (eng.seg && r() < .004) eng.input('elixir');
    if (eng.seg && r() < .01 && eng.enemies.length) eng.input('focus', eng.enemies[Math.floor(r() * eng.enemies.length)].uid);
    if (eng.pendingChoice && r() < .05) eng.input('choice', eng.pendingChoice.options[Math.floor(r() * eng.pendingChoice.options.length)].id);
    if (eng.seg && r() < .002) eng.input('auto', r() < .5);
  }
  const done = log.filter(x => x.fin);
  ok(done.length >= 1, `${zone}: segmentos concluídos`);

  // "Servidor": parte do mesmo estado e refaz cada segmento só com semente + comandos.
  const sState = server.State.mergeState(JSON.parse(base));
  done.forEach(({ seg, fin }) => {
    const se = new server.CombatEngine(sState, {});
    const out = se.replaySegment(seg, JSON.parse(JSON.stringify(fin.inputs)), fin.endTick);
    ok(out.ok && out.ended === (fin.outcome !== 'abort'), `${zone}: segmento ${seg.id} reproduzido (${fin.outcome}); replay=${JSON.stringify(out)}, endTick=${fin.endTick}`);
  });
  // Compara estados só até o último segmento concluído: o navegador pode estar no meio do próximo.
  const cmp = client.State.mergeState(JSON.parse(base));
  const ce = new client.CombatEngine(cmp, {});
  done.forEach(({ seg, fin }) => { const x = new client.CombatEngine(cmp, {}); x.replaySegment(seg, fin.inputs, fin.endTick); });
  ok(strip(cmp) === strip(sState), `${zone}: estado do servidor idêntico ao reproduzido no navegador`);
  // E o navegador ao vivo (antes de começar o próximo segmento) bate com o servidor em ouro, EXP, itens e progresso.
  return { cState, sState, done };
}

// Estado ao vivo × servidor: rodamos até exatamente o fim de N segmentos.
function liveMatch(zone, opts, manual) {
  const st = client.State.createState(); const e0 = new client.CombatEngine(st, {});
  for (let i = 0; i < 10; i++) e0.openBox(true);
  ['Vanguarda','Executor','Suporte','Arcanista'].forEach((cls, i) => { const r = st.collection.find(x => e0.template(x.id).cls === cls); if (r) e0.setParty(i, r.uid); });
  st.collection.forEach(r => { r.level = 16; }); st.progress.hunt.best = 12; st.progress.dungeon.best = 3; st.settings.auto = !manual; st.consumables.potion = 5;
  const base = JSON.stringify(st);
  const cState = client.State.mergeState(JSON.parse(base)), eng = new client.CombatEngine(cState, {});
  let fin = null, seg = null;
  eng.segmentProvider = { request(start) { if (seg) return; seg = { id:1, seed:424242, at:Date.parse('2026-09-26T21:00:00-03:00'), ...start }; eng.beginSegment(seg); }, finished(f) { fin = f; }, flush() {} };
  eng.enterZone(zone, opts);
  let rnd = 3; const r = () => { rnd = (rnd * 48271) % 2147483647; return rnd / 2147483647; };
  for (let i = 0; i < 40000 && !fin; i++) { eng.update(.02 + r() * .04); if (eng.seg && r() < .02) eng.input('ult', Math.floor(r() * 4)); if (eng.pendingChoice && r() < .1) eng.input('choice', eng.pendingChoice.recommended); }
  ok(fin, `${zone}: luta terminou`);
  const sState = server.State.mergeState(JSON.parse(base));
  new server.CombatEngine(sState, {}).replaySegment(seg, fin.inputs, fin.endTick);
  ok(strip(cState) === strip(sState), `${zone}: navegador ao vivo idêntico ao servidor (${fin.outcome}, ${fin.endTick} passos, ${fin.inputs.length} comandos)`);
}

scenario('hunt', { stage:3 }, 4, false);
scenario('hunt', { stage:9 }, 3, true);
scenario('hunt_swamp', { stage:5 }, 3, true);
scenario('dungeon', { floor:2 }, 1, true);
scenario('boss', { tier:0 }, 1, true);
liveMatch('hunt', { stage:4 }, true);
liveMatch('dungeon', { floor:1 }, true);
liveMatch('boss', { tier:0 }, false);

// Comando adulterado não muda nada que o jogador não pudesse fazer: ultimate sem energia é ignorada.
const st = server.State.createState(); const e = new server.CombatEngine(st, {});
for (let i = 0; i < 10; i++) e.openBox(true); [0, 1, 2, 3].forEach(i => e.setParty(i, st.collection[i].uid));
const out = new server.CombatEngine(st, {}).replaySegment({ id:9, seed:9, at:Date.now(), zone:'hunt', opts:{ stage:1 } }, Array.from({ length:500 }, (_, t) => ({ t, k:'ult', a:0 })), 400);
ok(out.ok && st.stats.ults < 20, 'ultimates forjadas sem energia são ignoradas');
console.log(JSON.stringify({ ok:true, checks }));
