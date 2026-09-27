'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const storage = new Map();
global.localStorage = {
  getItem:key => storage.has(key) ? storage.get(key) : null,
  setItem:(key, value) => storage.set(key, value),
  removeItem:key => storage.delete(key)
};
global.addEventListener = () => {};
for (const file of ['src/data.js','src/utils.js','src/items.js','src/progression.js','src/roster.js','src/builds.js','src/engine.js','src/net.js','src/neon.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(root, file), 'utf8'), { filename:file });
}

(async () => {
  const { State, Neon, Server } = global.KT;
  State.setSaveKey('persistence-test');
  const state = State.createState();
  state.player.gold = 10;
  assert.ok(State.saveState(state));
  state.player.gold = 20;
  assert.ok(State.saveState(state));
  storage.set('persistence-test:active', 'a');
  assert.equal(State.loadState().player.gold, 20, 'carrega a geração mais nova mesmo com ponteiro antigo');
  const newest = JSON.parse(storage.get('persistence-test:a')).saveGeneration > JSON.parse(storage.get('persistence-test:b')).saveGeneration ? 'a' : 'b';
  storage.set(`persistence-test:${newest}`, '{corrompido');
  assert.equal(State.loadState().player.gold, 10, 'recupera a cópia íntegra se a última gravação corromper');

  const savedStorage = global.localStorage;
  delete global.localStorage;
  assert.equal(State.saveState(State.createState()), false, 'não declara sucesso sem armazenamento');
  global.localStorage = savedStorage;

  storage.clear();
  State.setSaveKey('neon-local');
  Neon.user = { id:'u1', username:'Teste' };
  Neon.row = { revision:7 };
  Neon.conflict = false;
  const local = State.createState(); local.player.gold = 99;
  State.saveState(local); Neon.queue(local); clearTimeout(Neon.timer); Neon.timer = null;
  let fail = true;
  Neon.api = async () => fail ? (fail = false, { ok:false, status:0, error:'offline' }) : ({ ok:true, status:200, data:[{ revision:8 }] });
  assert.equal(await Neon.flush(), false, 'falha de rede é reportada');
  clearTimeout(Neon.retryTimer); Neon.retryTimer = null;
  assert.ok(Neon.readJournal(), 'falha mantém diário durável');
  assert.equal(await Neon.flush(), true, 'reenvio grava o mesmo snapshot');
  assert.equal(Neon.row.revision, 8);
  assert.equal(Neon.readJournal(), null, 'confirmação limpa o diário');

  const pending = State.createState(); pending.player.gold = 123;
  State.saveState(pending); Neon.queue(pending); clearTimeout(Neon.timer); Neon.timer = null; Neon.pending = null;
  const remote = State.createState(); remote.player.gold = 1;
  Neon.api = async () => ({ ok:true, status:200, data:[{ revision:8, data:remote }] });
  const recovered = await Neon.loadSave(); clearTimeout(Neon.timer); Neon.timer = null;
  assert.equal(recovered.player.gold, 123, 'reinício recupera gravação local ainda não confirmada');

  Neon.pending = null; Neon.clearJournal(); Neon.conflict = false;
  let requests = 0;
  global.fetch = async () => ({ ok:true, status:200, json:async () => ({ ok:true, state:State.createState(), revision:2 }) });
  Server.attach({ state:State.createState(), seg:null, abortSegment(){}, refreshPartyUnits(){} }, null, 1);
  const originalFetch = global.fetch;
  global.fetch = async (...args) => { requests++; return originalFetch(...args); };
  assert.ok((await Server.flush()).ok && requests === 1, 'salvar agora confirma a escrita com o servidor');

  console.log(JSON.stringify({ ok:true, checks:12 }));
})().catch(err => { console.error(err); process.exit(1); });
