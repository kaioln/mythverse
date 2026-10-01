const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, 'src', name), 'utf8');
const missing = vm.createContext({});
vm.runInContext(source('town.js'), missing);
assert.equal(missing.KT.TownMap.isWalk(560, 430), false, 'sem mapa não se caminha pela arte inteira');
assert.equal(missing.KT.TownMap.route(560, 430, 770, 372), null);

const game = vm.createContext({});
vm.runInContext(source('town-walk.js'), game);
vm.runInContext(source('town.js'), game);
const { TownLife, TownMap } = game.KT;
assert.equal(TownMap.isWalk(-1, 430), false);
assert.equal(TownMap.isWalk(1280, 430), false);
for (const p of [[350,435],[382,432],[150,245],[770,330],[870,600],[890,615],[600,285]]) {
  assert.equal(TownMap.isWalk(...p), false, `telhado, barraca ou água não é piso: ${p}`);
}
const visitor = new TownLife(); visitor.sync([]);
const renji = visitor.agents.find(a => a.name === 'Renji');
assert.ok(renji.y > 460, 'vendedor à frente da barraca, não dentro do telhado');
assert.ok(visitor.talk(renji)); const firstLine = renji.speech;
assert.ok(visitor.talk(renji)); assert.notEqual(renji.speech, firstLine);
assert.ok(renji.manualSpeech && renji.speechFor > 0);
for (const spot of TownMap.SPOTS) assert.ok(TownMap.route(...TownMap.at('plaza'), ...TownMap.at(spot.node)), `rota para ${spot.node}`);
vm.runInContext('Math.random = () => ((globalThis.__seed = (globalThis.__seed * 1664525 + 1013904223) >>> 0) / 4294967296)', game);

for (const seed of [1, 7, 14, 21, 32, 39, 45, 64]) {
  game.__seed = seed;
  const life = new TownLife();
  life.sync(Array.from({ length:4 }, (_, i) => ({ uid:String(i), sprite:String(i), name:`H${i}` })));
  const previous = life.agents.map(a => [a.x, a.y]);
  const idle = new Map(life.agents.map(a => [a, 0]));
  const speakers = new Set();
  for (let frame = 0; frame < 3600; frame++) {
    life.update(1 / 30);
    for (let i = 0; i < life.agents.length; i++) {
      const a = life.agents[i], p = previous[i], moved = Math.hypot(a.x - p[0], a.y - p[1]);
      if (moved) {
        assert.ok(TownMap.isWalk(a.x, a.y), `${a.name} saiu do caminho no quadro ${frame}`);
        const steps = Math.ceil(moved);
        for (let n = 1; n < steps; n++) assert.ok(TownMap.isWalk(p[0] + (a.x - p[0]) * n / steps, p[1] + (a.y - p[1]) * n / steps), `${a.name} cruzou chão proibido`);
        p[0] = a.x; p[1] = a.y; idle.set(a, 0);
      } else if (!a.fixed) {
        idle.set(a, idle.get(a) + 1 / 30);
        assert.ok(idle.get(a) < 11, `${a.name} ficou travado por ${idle.get(a).toFixed(1)}s (cenário ${seed})`);
      }
      if (a.speechFor > 0) speakers.add(a.name);
      for (let j = i + 1; j < life.agents.length; j++) {
        const b = life.agents[j];
        assert.ok(Math.hypot(a.x - b.x, (a.y - b.y) * 1.55) >= 15.9, `${a.name} e ${b.name} se sobrepuseram`);
      }
    }
  }
  for (const a of life.agents.filter(a => !a.fixed)) assert.ok(a.walkD > 100, `${a.name} não circulou`);
  assert.ok(speakers.size >= 3, 'o festival precisa ter conversas entre moradores');
}
console.log('TOWN_OK: chão, colisão, circulação, conversas e ausência segura da máscara');
