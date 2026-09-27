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
  const nativeFetch = global.fetch;
  global.KT.CONFIG = { neon:'https://ep-test.region.aws.neon.tech/neondb' };
  Neon.jwt = 'teste'; Neon.jwtExp = Date.now() + 60 * 60_000;
  let requestOptions = null;
  global.fetch = async (_url, options) => { requestOptions = options; return { ok:true, status:200, headers:{ get:() => null }, json:async () => [] }; };
  await Neon.api('PATCH', '/mv_saves', { data:'x'.repeat(70 * 1024) });
  assert.equal(requestOptions.keepalive, false, 'save grande não usa keepalive limitado a 64 KiB');
  await Neon.api('PATCH', '/mv_saves', { data:'ok' });
  assert.equal(requestOptions.keepalive, true, 'requisição pequena pode concluir durante troca de página');
  await Neon.api('GET', '/mv_ranking');
  assert.equal(requestOptions.cache, 'no-store', 'ranking sempre consulta dados atuais');
  global.fetch = nativeFetch; Neon.jwt = null; Neon.jwtExp = 0;
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

  const newerLocal = State.createState(); newerLocal.totalPlaySeconds = 20; newerLocal.player.gold = 222;
  State.saveState(newerLocal); Neon.row = { revision:8 }; Neon.conflict = false; Neon.queue(newerLocal); clearTimeout(Neon.timer); Neon.timer = null;
  let patches = 0;
  const olderRemote = State.createState(); olderRemote.totalPlaySeconds = 10; olderRemote.saveGeneration = 1;
  Neon.api = async (method) => method === 'GET' ? ({ ok:true, data:[{ revision:9, data:olderRemote }] }) : (++patches === 1 ? { ok:true, data:[] } : { ok:true, data:[{ revision:10 }] });
  assert.equal(await Neon.flush(), true, 'conflito com save remoto antigo é reconciliado e reenviado');
  assert.equal(Neon.row.revision, 10);
  assert.equal(Neon.conflict, false, 'conflito recuperável não bloqueia autosaves futuros');

  const staleLocal = State.createState(); staleLocal.totalPlaySeconds = 5; State.saveState(staleLocal); Neon.row = { revision:10 }; Neon.queue(staleLocal); clearTimeout(Neon.timer); Neon.timer = null;
  const newerRemote = State.createState(); newerRemote.totalPlaySeconds = 50; newerRemote.player.gold = 777; newerRemote.saveGeneration = 50;
  let adopted = null; Neon.onRemote = s => { adopted = s; };
  Neon.api = async method => method === 'GET' ? ({ ok:true, data:[{ revision:11, data:newerRemote }] }) : ({ ok:true, data:[] });
  assert.equal(await Neon.flush(), true, 'save remoto mais novo é adotado sem travar a fila');
  assert.equal(adopted.player.gold, 777);
  assert.equal(Neon.conflict, false);

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
