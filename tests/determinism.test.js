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
    if (eng.seg && r() < .05) eng.input('skill', Math.floor(r() * 4));                 // ordem fora de hora: ignorada
    if (eng.seg && r() < .02) eng.input('guard');
    if (eng.seg && r() < .003) eng.input('mode', ['auto', 'semi', 'manual'][Math.floor(r() * 3)]);
    if (eng.seg && eng.awaiting !== null && r() < .4) { const x = r(); if (x < .45) eng.input('act', `attack:${Math.floor(r() * 3)}`); else if (x < .55) eng.input('act', 'defend'); else eng.input('skill', `${eng.awaiting}:${Math.floor(r() * 3)}:${Math.floor(r() * 3)}`); }
    if (eng.seg && r() < .02) eng.input('act', 'allout');
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

// Regras de luta: kit de três habilidades, Pontos de Técnica, a vez de uma ação, Quebra em pontos para todos, intenção,
// reações elementais, Assalto Total, golpe cronometrado, guarda e Aparo.
{
  const gs = client.State.createState(), g0 = new client.CombatEngine(gs, {});
  for (let i = 0; i < 10; i++) g0.openBox(true); [0, 1, 2, 3].forEach(i => g0.setParty(i, gs.collection[i].uid));
  gs.collection.forEach(r => { r.level = 30; });
  const g = new client.CombatEngine(gs, {}), T = client.State.TOUGH, SP = client.State.SP;
  ok(g.setMode('manual') && g.mode === 'manual' && gs.settings.auto === false && gs.settings.autoSkill === false, 'modo MANUAL: a equipe espera as ordens');
  ok(!g.setMode('turbo') && g.setSetting('mode', 'semi') && g.mode === 'semi', 'modo inválido é recusado; no SEMI a equipe age sozinha');
  g.setMode('manual');
  g.enterZone('hunt', { stage:1 });
  for (let i = 0; i < 400 && !(g.phase === 'fight' && g.enemies.some(e => e.alive && e.spawnT >= .5)); i++) g.tick();
  ok(g.phase === 'fight', 'luta de teste começou');
  const hero = g.party[0], foe = g.enemies.find(e => e.alive);
  // Luta parada para medir uma regra de cada vez: ninguém age, ninguém morre, ninguém quebra por acaso.
  const calm = () => {
    g.awaiting = null; g.allOut = false; g.allOutSpent = false;
    g.party.forEach(u => { u.atkCd = 50; u.inTurn = false; u.hp = u.maxHp; u.shield = 0; u.energy = 0; u.defend = false; u.effects = []; u.st.cdr = 0; u.st.crit = 0; u.st.breakPow = 0; u.hooks = {}; u.skills.forEach(k => { k.tcd = 0; }); });
    g.enemies.forEach(e => { e.maxHp = e.hp = 1e12; e.alive = true; e.atkCd = 50; e.skillCd = 50; e.spawnT = 1; e.broken = 0; e.toughMax = e.tough = 99; e.elMark = null; e.effects = []; e.weakCls = null; e.el = hero.el; e.thorns = 0; });
  };
  ok(hero.skills.length === 3 && hero.skills.every(k => !k.locked) && new Set(hero.skills.map(k => k.def.name)).size === 3, 'herói de nível 30 tem as três habilidades do kit');
  ok(g.sp === SP.start, 'a luta começa com 3 Pontos de Técnica');
  { const low = client.State.createState(), l0 = new client.CombatEngine(low, {}); for (let i = 0; i < 10; i++) l0.openBox(true); [0, 1, 2, 3].forEach(i => l0.setParty(i, low.collection[i].uid));
    const le = new client.CombatEngine(low, {}); le.enterZone('hunt', { stage:1 });
    ok(le.party[0].skills[0].locked === false && le.party[0].skills[1].locked && le.party[0].skills[2].locked && le.skillState(le.party[0], 1) === 'locked', 'no nível 1 só a habilidade I está aprendida (II no 6, III no 16)'); }

  // A vez do herói: a luta espera a ordem; o golpe básico é a ação da vez e rende 1 PT.
  calm(); hero.atkCd = 0; g.tick();
  ok(g.awaiting === 0, 'no comando MANUAL a vez do herói espera a ordem');
  const atkBefore = hero.counters.atk; g.tick(); g.tick();
  ok(hero.counters.atk === atkBefore, 'enquanto espera, o herói não age sozinho');
  const sp0 = g.sp;
  ok(g.input('act', 'attack') === true && g.awaiting === null && hero.counters.atk === atkBefore + 1 && hero.atkCd > 1, 'golpe básico é a ação da vez');
  ok(g.sp === Math.min(SP.max, sp0 + 1), 'golpe básico rende 1 PT');
  ok(g.input('act', 'attack') === false, 'ordem fora da vez é recusada');

  // Habilidade: custa PT, é a ação da vez e descansa em vezes do herói.
  calm(); g.sp = 6; hero.atkCd = 0; g.tick();
  const def3 = hero.skills[2].def, back = def3.eff.filter(e => e.k === 'sp').reduce((a, e) => a + e.v, 0);
  ok(g.input('skill', '0:2:0') === true && g.sp === Math.min(SP.max, 6 - def3.cost + back) && hero.skills[2].tcd === def3.tcd && hero.atkCd > 0 && gs.stats.manualSkills === 1, `habilidade III (${def3.name}) gasta ${def3.cost} PT, descansa e encerra a vez`);
  ok(g.input('skill', '0:2') === false && gs.stats.manualSkills === 1, 'habilidade fora da vez é recusada');
  calm(); g.sp = 6; hero.skills[2].tcd = 3; hero.atkCd = 0; g.tick();
  ok(hero.skills[2].tcd === 2 && g.skillState(hero, 2) === 'rest' && g.input('skill', '0:2') === false, 'habilidade descansando não sai; o descanso conta em vezes do herói');
  g.sp = 0; ok(g.skillState(hero, 0) === 'sp' && g.input('skill', '0:0') === false, 'sem PT a habilidade não sai');
  ok(g.input('act', 'defend') === true && hero.defend === true && g.sp === 1 && hero.atkCd > 1, 'defender encerra a vez e rende 1 PT');

  // Guarda, Aparo e defesa.
  calm();
  const avg = (o, n = 60) => { let t = 0; for (let i = 0; i < n; i++) { hero.hp = hero.maxHp; hero.shield = 0; t += g.hit(foe, hero, 1, o); } return t / n; };
  const plain = avg({ kind:'basic' });
  ok(g.input('guard') === true && g.guardT > 0, 'guarda erguida');
  ok(g.input('guard') === false, 'guarda em recarga não repete');
  g.guardAge = 9; const guarded = avg({ kind:'basic' });
  ok(guarded < plain * .6 && guarded > plain * .4, `guarda corta metade do dano (${plain.toFixed(1)} → ${guarded.toFixed(1)})`);
  const before = gs.stats.parries || 0, spP = g.sp = 2;
  g.guardAge = 0; g.lastParry = -1; const parried = avg({ kind:'skill', special:true });
  ok(parried < plain * .3 && (gs.stats.parries || 0) === before + 1 && g.sp === spP + 1 && foe.tough === 99 - T.parry, `aparo no tempo certo corta 80%, conta uma vez por golpe, rende 1 PT e abala a Resistência (${parried.toFixed(1)})`);
  g.guardAge = 9; const late = avg({ kind:'skill', special:true });
  ok(late > parried * 1.8 && (gs.stats.parries || 0) === before + 1, 'guarda atrasada não vira aparo');
  g.guardT = 0; const open = avg({ kind:'skill', special:true });
  ok(open > late * 1.6, 'sem guarda o golpe preparado entra inteiro');
  hero.defend = true; const defended = avg({ kind:'basic' }); hero.defend = false;
  ok(defended < plain * .6 && defended > plain * .4, 'defender corta metade do dano até a próxima vez do herói');

  // Dano devolvido por inimigos (espinhos, escamas de chefe): teto por golpe e nunca nocauteia.
  calm(); foe.thorns = 50;
  g.hit(hero, foe, .2, { kind:'skill' });
  ok(hero.maxHp - hero.hp <= Math.round(hero.maxHp * client.State.THORN_CAP) && hero.hp < hero.maxHp, `dano devolvido limitado a 0,5% da vida por golpe (${hero.maxHp - hero.hp} de ${hero.maxHp})`);
  hero.hp = 1; g.hit(hero, foe, .2, { kind:'skill' });
  ok(hero.alive && hero.hp >= 1, 'dano devolvido nunca nocauteia');

  // Quebra em pontos, para todos os inimigos.
  calm(); foe.toughMax = foe.tough = T.normal;
  ok(g.enemies.every(e => e.toughMax > 0) && g.weakness(hero, foe) === 1, 'todo inimigo tem Resistência');
  g.hit(hero, foe, 1, { kind:'basic', act:{ kind:'basic' } });
  ok(foe.tough === T.normal - 1, 'golpe básico tira 1 de Resistência');
  { const act = { kind:'skill' }; g.hit(hero, foe, 1, { kind:'skill', act }); g.hit(hero, foe, 1, { kind:'skill', act }); }
  ok(foe.tough === T.normal - 3, 'habilidade tira 2, uma vez por alvo por ação');
  g.hit(hero, foe, 1, { kind:'proc' }); ok(foe.tough === T.normal - 3, 'efeito passivo não tira Resistência');
  foe.weakCls = hero.cls; ok(g.weakness(hero, foe) === T.weak, 'a classe fraca da família conta como fraqueza');
  g.sp = 2; const br0 = gs.stats.breaks || 0, hp0 = foe.hp;
  g.hit(hero, foe, 1, { kind:'basic', act:{ kind:'basic' } });
  ok(foe.broken > 0 && foe.tough === 0 && g.sp === 3 && (gs.stats.breaks || 0) === br0 + 1 && hp0 - foe.hp > foe.maxHp * T.burst.base * .99, 'Resistência zerada: QUEBRA, com dano de quebra e +1 PT');
  { const frail = { kind:'basic' }; let a = 0, b = 0; for (let i = 0; i < 80; i++) a += g.hit(hero, foe, 1, frail); foe.broken = 0; for (let i = 0; i < 80; i++) b += g.hit(hero, foe, 1, frail); foe.broken = 3;
    ok(a > b * 1.25 && a < b * 1.45, 'inimigo quebrado recebe +35% de dano'); }

  // Assalto Total: todos os inimigos quebrados ao mesmo tempo.
  g.enemies.forEach(e => { if (e.alive) e.broken = 3; }); g.checkAllOut();
  ok(g.allOut === true, 'todos quebrados: Assalto Total disponível');
  const ao = gs.stats.allOuts || 0;
  ok(g.input('act', 'allout') === true && g.allOut === false && (gs.stats.allOuts || 0) === ao + 1, 'Assalto Total sai por ordem');
  g.checkAllOut(); ok(g.allOut === false && g.input('act', 'allout') === false, 'uma vez por janela de quebra');
  foe.broken = .01; g.tick();
  ok(foe.broken === 0 && Math.abs(foe.toughMax - T.normal * T.grow) < .11 && foe.tough === foe.toughMax, 'ao se recompor, a Resistência volta maior');

  // Intenção: o alvo do próximo golpe é escolhido antes.
  calm(); foe.nextTgt = null; foe.atkCd = 5; g.tick();
  { const it = g.intentOf(foe); ok(!!foe.nextTgt && it.kind === 'attack' && it.target === foe.nextTgt, 'o inimigo mostra em quem vai bater'); const want = foe.nextTgt; foe.atkCd = 0; const victim = g.party.find(h => h.uid === want); victim.st.dodge = 0; victim.shield = 0;   // sem esquiva nem escudo: o teste é sobre o alvo, não sobre o sorteio
    g.tick(); ok(victim.hp < victim.maxHp, 'e bate em quem mostrou'); }

  // Marca elemental e reação.
  calm(); const other = g.party[1]; other.el = hero.el === 'Fogo' ? 'Gelo' : 'Fogo'; foe.el = 'Luz'; hero.el = hero.el === 'Luz' || hero.el === 'Sombra' ? 'Vento' : hero.el;
  const rx0 = gs.stats.reactions || 0;
  g.hit(hero, foe, 1, { kind:'skill', act:{ kind:'skill' } });
  ok(foe.elMark && foe.elMark.el === hero.el, 'habilidade deixa a marca do elemento do herói');
  g.hit(hero, foe, 1, { kind:'basic', act:{ kind:'basic' } });
  ok(foe.elMark && (gs.stats.reactions || 0) === rx0, 'golpe do mesmo elemento não reage');
  g.hit(other, foe, 1, { kind:'basic', act:{ kind:'basic' } });
  ok(!foe.elMark && (gs.stats.reactions || 0) === rx0 + 1 && !!client.Data.reaction(other.el, hero.el), 'golpe de outro elemento consome a marca e dispara a reação');
  ok(client.Data.reaction('Fogo', 'Gelo').id === 'melt' && client.Data.reaction('Gelo', 'Fogo').id === 'melt' && client.Data.reaction('Terra', 'Luz').id === 'shatter' && client.Data.reaction('Fogo', 'Fogo') === null, 'tabela de reações cobre os pares nas duas ordens');

  // Golpe cronometrado.
  calm();
  { const mean = act => { let t = 0; for (let i = 0; i < 120; i++) { foe.elMark = null; foe.tough = 99; foe.broken = 0; t += g.hit(hero, foe, 1, { kind:'basic', act:{ ...act } }); } return t / 120; };
    const base = mean({ kind:'basic' }), good = mean({ kind:'basic', q:1 }), perfect = mean({ kind:'basic', q:2 });
    ok(good > base * 1.07 && good < base * 1.17 && perfect > base * 1.24 && perfect < base * 1.36, `golpe cronometrado: bom +12%, perfeito +30% (${base.toFixed(0)} → ${good.toFixed(0)} → ${perfect.toFixed(0)})`); }
  foe.toughMax = foe.tough = 4; g.hit(hero, foe, 1, { kind:'basic', act:{ kind:'basic', q:2 } });
  ok(foe.tough === 2, 'golpe perfeito tira 1 ponto a mais de Resistência');

  // No AUTO a equipe escolhe sozinha e gasta os PT com habilidades.
  calm(); g.setMode('auto'); g.sp = 6; const used = gs.stats.manualSkills;
  let casts = 0; const ev = g.events; g.events = { onFx(fx) { if (fx.type === 'cast' && !fx.ult && !fx.enemy) casts++; } };
  g.party.forEach(u => { u.atkCd = 0; }); for (let i = 0; i < 12; i++) g.tick();
  g.events = ev;
  ok(casts >= 1 && g.sp < 6 && gs.stats.manualSkills === used && g.awaiting === null, `no AUTO os heróis usam habilidades sozinhos (${casts} em 4 vezes) e a luta não espera ordem`);
  g.setMode('manual'); calm(); hero.atkCd = 0; g.tick(); ok(g.awaiting === 0, 'de volta ao MANUAL, espera a ordem');
  g.setMode('semi'); ok(g.awaiting === null, 'trocar de comando com um herói esperando não trava a luta');
  const order = g.turnOrder(8); ok(order.length > 0 && order.every((o, n) => !n || o.t >= order[n - 1].t), 'linha do tempo em ordem');

  // Golpe preparado em dois tempos: bote (janela do Aparo) e, no passo seguinte, o impacto.
  g.setMode('manual'); calm(); const en = g.enemies.find(e => e.alive), special = { name:'Teste', cd:9, windup:.1, eff:[{ k:'dmg', m:1, to:'all' }] };
  en.windup = .05; en.windupMax = .1; en.windupSpecial = special; en.striking = false; g.guardCd = 0; g.guardT = 0;
  g.tick(); ok(en.striking === true && en.windupSpecial === special, 'primeiro o bote');
  ok(g.input('guard', 1) === true, 'guarda no anel dourado'); const p0 = gs.stats.parries || 0;
  g.tick(); ok(!en.striking && en.windupSpecial === null && (gs.stats.parries || 0) === p0 + 1, 'depois o impacto, aparado');
}
console.log(JSON.stringify({ ok:true, checks }));
