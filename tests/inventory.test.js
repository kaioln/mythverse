// Bolsa, Armazém e equipamento: 6.000 operações aleatórias sem item sumindo, duplicando ou equipado fora da bolsa.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.resolve(__dirname, '..');
let seed = 3; Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
for (const f of ['src/data.js','src/utils.js','src/items.js','src/progression.js','src/roster.js','src/builds.js','src/engine.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'));
const { State, CombatEngine, Items:I } = KT;
const st = State.createState(), e = new CombatEngine(st, {}); st.invCap = 30;
for (let i = 0; i < 10; i++) e.openBox(true); e.autoTeam(); st.collection.forEach(h => { h.level = 60; }); e.optimizeTeam();
const all = () => [...st.inventory, ...st.storage, ...st.overflow];
let known = new Set(), problems = [];
const check = (op) => {
  const ids = all().map(x => x.uid), set = new Set(ids);
  if (set.size !== ids.length) problems.push(op + ': item duplicado');
  st.collection.forEach(h => Object.values(h.equipped).forEach(u => { if (u && !st.inventory.some(x => x.uid === u)) problems.push(op + ': equipado fora da bolsa ' + u); }));
  const inv = new Set(st.inventory.map(x => x.uid)), sto = new Set(st.storage.map(x => x.uid));
  [...inv].forEach(u => { if (sto.has(u)) problems.push(op + ': na bolsa e no armazém'); });
  known.forEach(u => { if (!set.has(u)) problems.push(op + ': sumiu ' + u); });
  known = set;
};
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
for (let k = 0; k < 6000 && problems.length < 5; k++) {
  const ops = ['add', 'equip', 'unequip', 'store', 'retrieve', 'optimize', 'autoTeam', 'remove', 'setParty', 'storeMany', 'save', 'salvage'];
  const op = pick(ops); let skipSalvage = false;
  if (op === 'add') { const it = I.makeItem({ ilvl:10 + Math.floor(Math.random() * 30), rarity:pick(['common','rare','epic','legendary']) }); e.addItem(it); known.add(it.uid); known = new Set([...all().map(x => x.uid)]); }
  if (op === 'equip') { const h = pick(st.collection), it = pick(all()); if (it) e.equip(h.uid, it.uid); }
  if (op === 'unequip') { const h = pick(st.collection); e.unequip(h.uid, pick(Object.keys(I.slots))); }
  if (op === 'store') { const it = pick(st.inventory); if (it) e.storeItem(it.uid); }
  if (op === 'retrieve') { const it = pick(st.storage); if (it) e.retrieveItem(it.uid); }
  if (op === 'optimize') e.optimizeTeam();
  if (op === 'autoTeam') e.autoTeam();
  if (op === 'remove') { const u = pick(st.formation.filter(Boolean)); if (u) e.removeFromParty(u); }
  if (op === 'setParty') { e.setParty(Math.floor(Math.random() * 4), pick(st.collection).uid); }
  if (op === 'storeMany') e.storeMany('epic');
  if (op === 'save') { const m = State.mergeState(JSON.parse(JSON.stringify(st))); Object.keys(st).forEach(k2 => delete st[k2]); Object.assign(st, m); }
  if (op === 'salvage') { const it = pick(st.inventory); if (it && e.salvage(it.uid)) known.delete(it.uid); }
  check(op);
}
if (problems.length) { console.error(problems); process.exit(1); }
console.log(JSON.stringify({ ok:true, checks:6000, bolsa:st.inventory.length, armazem:st.storage.length }));
