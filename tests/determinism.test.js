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
    if (eng.seg && r() < .05) eng.input('skill', Math.floor(r() * 4));
    if (eng.seg && r() < .02) eng.input('guard');
    if (eng.seg && r() < .003) eng.input('mode', ['auto', 'semi', 'manual'][Math.floor(r() * 3)]);
    if (eng.seg && eng.awaiting !== null && r() < .35) eng.input('act', r() < .75 ? 'attack' : 'defend');
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

// Comandos de luta: habilidade à mão respeita a recarga, a guarda corta o dano e o Aparo exige o tempo certo.
{
  const gs = client.State.createState(), g0 = new client.CombatEngine(gs, {});
  for (let i = 0; i < 10; i++) g0.openBox(true); [0, 1, 2, 3].forEach(i => g0.setParty(i, gs.collection[i].uid));
  gs.collection.forEach(r => { r.level = 30; });
  const g = new client.CombatEngine(gs, {});
  ok(g.setMode('manual') && g.mode === 'manual' && gs.settings.auto === false && gs.settings.autoSkill === false, 'modo MANUAL desliga habilidades e ultimates automáticas');
  ok(!g.setMode('turbo') && g.setSetting('mode', 'semi') && g.mode === 'semi', 'modo inválido é recusado; SEMI mantém as habilidades automáticas');
  g.setMode('manual');
  g.enterZone('hunt', { stage:1 });
  for (let i = 0; i < 400 && !(g.phase === 'fight' && g.enemies.some(e => e.alive && e.spawnT >= .5)); i++) g.tick();
  ok(g.phase === 'fight', 'luta de teste começou');
  const hero = g.party[0], foe = g.enemies.find(e => e.alive);
  for (let i = 0; i < 400 && g.party.some(u => u.skillCd > 0); i++) { g.enemies.forEach(e => { e.hp = e.maxHp; }); g.party.forEach(u => { u.hp = u.maxHp; }); g.tick(); }
  ok(g.party.every(u => u.skillCd <= 0) && !gs.stats.manualSkills, 'no modo MANUAL a habilidade fica pronta esperando o comando');
  ok(g.input('skill', 0) === true && hero.skillCd > 0 && gs.stats.manualSkills === 1, 'habilidade comandada entra em recarga');
  ok(g.input('skill', 0) === false && gs.stats.manualSkills === 1, 'habilidade em recarga é ignorada');
  const avg = o => { let t = 0; for (let i = 0; i < 60; i++) { hero.hp = hero.maxHp; hero.shield = 0; foe.hp = foe.maxHp; foe.alive = true; t += g.hit(foe, hero, 1, o); } return t / 60; };
  const plain = avg({ kind:'basic' });
  ok(g.input('guard') === true && g.guardT > 0, 'guarda erguida');
  ok(g.input('guard') === false, 'guarda em recarga não repete');
  g.guardAge = 9; const guarded = avg({ kind:'basic' });
  ok(guarded < plain * .6 && guarded > plain * .4, `guarda corta metade do dano (${plain.toFixed(1)} → ${guarded.toFixed(1)})`);
  const before = gs.stats.parries || 0;
  g.guardAge = 0; g.lastParry = -1; const parried = avg({ kind:'skill', special:true });
  ok(parried < plain * .3 && (gs.stats.parries || 0) === before + 1, `aparo no tempo certo corta 80% e conta uma vez por golpe (${parried.toFixed(1)})`);
  g.guardAge = 9; const late = avg({ kind:'skill', special:true });
  ok(late > parried * 1.8 && (gs.stats.parries || 0) === before + 1, 'guarda atrasada não vira aparo');
  g.guardT = 0; const open = avg({ kind:'skill', special:true });
  ok(open > late * 1.6, 'sem guarda o golpe preparado entra inteiro');
  // Dano devolvido por inimigos (espinhos, escamas de chefe): teto por golpe e nunca nocauteia.
  { const th = foe.thorns; foe.thorns = 50; hero.hp = hero.maxHp; hero.shield = 0; foe.hp = foe.maxHp; foe.alive = true;
    g.hit(hero, foe, .2, { kind:'skill' });
    ok(hero.maxHp - hero.hp <= Math.round(hero.maxHp * client.State.THORN_CAP) && hero.hp < hero.maxHp, `dano devolvido limitado a 0,5% da vida por golpe (${hero.maxHp - hero.hp} de ${hero.maxHp})`);
    hero.hp = 1; foe.hp = foe.maxHp; foe.alive = true; g.hit(hero, foe, .2, { kind:'skill' });
    ok(hero.alive && hero.hp >= 1, 'dano devolvido nunca nocauteia'); foe.thorns = th; hero.hp = hero.maxHp; foe.hp = foe.maxHp; foe.alive = true; }
  // Vez do herói no comando MANUAL: com técnica pronta a luta espera a ordem; atacar segue, defender corta o dano.
  g.guardCd = 0; g.awaiting = null; g.party.forEach(u => { u.skillCd = 0; u.atkCd = 5; u.go = false; u.hp = u.maxHp; }); g.enemies.forEach(e => { e.hp = e.maxHp; e.alive = true; e.atkCd = 50; e.skillCd = 50; });
  hero.atkCd = 0; g.tick();
  ok(g.awaiting === 0, 'na vez do herói com técnica pronta a luta espera a ordem');
  const atkBefore = hero.counters.atk; g.tick(); g.tick();
  ok(hero.counters.atk === atkBefore, 'enquanto espera, o herói não age sozinho');
  ok(g.input('act', 'attack') === true && g.awaiting === null, 'ordem de atacar aceita');
  g.tick(); ok(hero.counters.atk === atkBefore + 1 && hero.atkCd > 0, 'depois da ordem o golpe básico sai');
  hero.atkCd = 0; g.tick(); ok(g.awaiting === 0 && g.input('act', 'defend') === true && hero.defend === true && hero.atkCd > 1, 'ordem de defender troca o golpe pela defesa');
  const defended = avg({ kind:'basic' }); ok(defended < plain * .6 && defended > plain * .4, 'defender corta metade do dano até a próxima vez do herói');
  hero.defend = false; ok(g.input('act', 'attack') === false, 'ordem fora da vez é recusada');
  const order = g.turnOrder(8); ok(order.length > 0 && order.every((o, n) => !n || o.t >= order[n - 1].t), 'linha do tempo em ordem');
  // Golpe preparado em dois tempos: bote (janela do Aparo) e, no passo seguinte, o impacto.
  g.party.forEach(u => { u.skillCd = 99; u.atkCd = 99; u.energy = 0; }); const en = g.enemies.find(e => e.alive); const special = { name:'Teste', cd:9, windup:.1, eff:[{ k:'dmg', m:1, to:'all' }] };
  en.windup = .05; en.windupMax = .1; en.windupSpecial = special; en.striking = false; en.spawnT = 1;
  g.tick(); ok(en.striking === true && en.windupSpecial === special, 'primeiro o bote');
  ok(g.input('guard', 1) === true, 'guarda no anel dourado'); const p0 = gs.stats.parries || 0;
  g.tick(); ok(!en.striking && en.windupSpecial === null && (gs.stats.parries || 0) === p0 + 1, 'depois o impacto, aparado');
}
console.log(JSON.stringify({ ok:true, checks }));
