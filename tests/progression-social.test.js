const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
global.document = { hidden:false, addEventListener() {} };
for (const f of ['data','utils','items','progression','roster','builds','engine','icons','assets','ui','panels','lore','lore-book','lore-tales','community','social','social-ui']) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'src', `${f}.js`), 'utf8'), { filename:f });
}
const { State, CombatEngine, Progression:PR, UIController, Community:C, Social, Data:D } = KT;
const P = UIController.prototype;

async function test() {
  const state = State.createState(), engine = new CombatEngine(state, {});
  for (const [id, s] of Object.entries(PR.services)) {
    state.player.level = s.level - 1; assert.equal(engine.serviceStatus(id).locked, true, id);
    state.player.level = s.level; assert.equal(engine.serviceStatus(id).locked, false, id);
  }
  state.player.level = 1; state.player.gold = 1e6;
  const before = JSON.stringify(state);
  for (const [op, args] of [['train',['atk']], ['craft',['potion']], ['awaken',['missing']], ['craftProf',['potion_plus']], ['displayCard',['missing',0]], ['startExpedition',['hunt',1,[]]], ['buyMarket',[0]], ['enchantItem',['missing',0]], ['upgradeBuilding',['forge']]]) assert.equal(engine[op](...args), false, op);
  assert.equal(engine.upgradeItem('missing').ok, false);
  assert.equal(JSON.stringify(state), before, 'serviço bloqueado não consome nem transforma recursos');
  assert.equal(engine.upgradeBuilding('not-a-building'), false);
  assert.equal(PR.serviceFor('shop', 'p2p'), 'trade');
  assert.equal(PR.serviceFor('guild', 'home'), 'clans');
  assert.equal(PR.serviceFor('collection', 'summon'), null, 'convocações iniciais continuam livres');
  state.player.level = 25;
  assert.equal(State.mergeState(JSON.parse(JSON.stringify(state))).player.gold, state.player.gold, 'compatibilidade do save existente');

  const requests = [];
  KT.NeonMarket = {
    wallet:async () => ({ ok:true, config:{ enabled:false, goldMarket:true } }),
    myMarket:async () => ({ ok:true, listings:[], mailbox:[] }),
    market:() => new Promise(resolve => requests.push(resolve))
  };
  const ui = { session:{ mode:'neon', user:{ id:'account' } }, engine, state, view:{ panel:null }, mktFilter:{ type:'all', currency:'gold' }, renderResources() {}, refreshPanel() {} };
  const older = P.loadMarket.call(ui, true), newer = P.loadMarket.call(ui, true);
  requests[1]({ ok:true, listings:[{ id:2 }] }); await newer;
  requests[0]({ ok:true, listings:[{ id:1 }] }); await older;
  assert.equal(ui.mktList[0].id, 2, 'resposta antiga não sobrescreve o filtro recente');
  ui.loadMarket = () => {}; ui.mktCurrency = P.mktCurrency; ui.ordersHtml = () => '';
  ui.mktList = [{ id:5, mine:true, sellerId:'me', seller:'Eu', kind:'mat', payload:{ id:'star', qty:1 }, currency:'gold', price:100 }];
  ui.myMkt.listings = ui.mktList;
  const market = P.p2pPanel.call(ui);
  assert.match(market, /data-cancel-listing="5"/);
  assert.doesNotMatch(market, /data-buy-gold="5"/, 'Neon identifica o anúncio próprio corretamente');

  let apiCalls = 0, response;
  KT.Neon = { enabled:true, user:{ id:'tester' }, api:() => { apiCalls++; return new Promise(resolve => { response = resolve; }); } };
  C.ui = { onChat() {} };
  const a = C.poll(), b = C.poll();
  response({ ok:true, data:[{ id:'9007199254740993', text:'<script>não executar</script>' }, { id:'9007199254740992', text:'anterior' }, { id:'9007199254740993', text:'<script>não executar</script>' }] });
  await Promise.all([a,b]);
  assert.equal(apiCalls, 1, 'polls concorrentes compartilham a consulta');
  assert.equal(C.msgs.length, 2, 'mensagens não duplicam');
  assert.equal(C.last, '9007199254740993', 'cursor bigint é ordenado sem perder precisão');
  KT.Neon.api = async () => ({ ok:true, data:[{ id:1, text:'atrasada' }] }); await C.poll();
  assert.equal(C.last, '9007199254740993', 'cursor nunca regride');
  assert.doesNotMatch(P.chatLines.call(ui), /<script>/, 'chat escapa HTML');
  KT.Neon.api = async () => ({ ok:false, error:'offline' }); await C.poll();
  assert.equal(C.err, 'offline'); assert.equal(C.msgs.length, 3, 'desconexão não apaga histórico');

  let sends = 0, release;
  KT.Neon.api = async () => { sends++; return new Promise(resolve => { release = resolve; }); };
  const firstSend = C.send('olá');
  await assert.rejects(C.send('repetida'), /anterior/);
  release({ ok:true, data:12 }); KT.Neon.api = async () => ({ ok:true, data:[] }); await firstSend;
  assert.equal(sends, 1, 'duplo Enter não envia duas mensagens');

  Social.engine = engine; Social.ui = { toast() {}, renderResources() {}, view:{}, refreshPanel() {} };
  Social.match = { id:1 }; let starts = 0;
  Social.rpc = async () => { starts++; };
  await Social.attack('rival'); assert.equal(starts, 0, 'luta pendente impede novo ingresso');
  Social.match = null; state.player.level = 1; await Social.attack('rival'); assert.equal(starts, 0, 'PvP bloqueado não faz RPC');

  for (const z of Object.values(D.zones).filter(z => !['village','arena'].includes(z.kind))) {
    assert.ok(KT.Lore.fieldNotes[z.id]?.length, `região integrada à história: ${z.id}`);
  }
  for (const id of ['boss','boss_tide','boss_sand','boss_sky','boss_event']) {
    assert.ok(D.story.bossWin[id].some(l => l.book), `desfecho e livro: ${id}`);
  }
  assert.ok(D.roster.every(h => KT.Lore.tales[h.base || h.id]?.length), 'todos os personagens têm conto de travessia');
  assert.equal(KT.Lore.heroJourney('akira', state).filter(p => p.revealed).length, 0);
  state.progress.boss.kills = 1;
  assert.equal(KT.Lore.heroJourney('akira', state).filter(p => p.revealed).length, 1, 'memória acompanha a campanha');
  console.log('PROGRESSION_SOCIAL_OK: desbloqueios, mercado, chat, PvP e narrativa (mocks, sem banco live)');
}
test().catch(err => { console.error(err); process.exitCode = 1; });
