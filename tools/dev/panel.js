// Desenha um painel do jogo isolado (tools/dev/panel.html). ?p=talents|party|collection|city|shop|inventory &hero=<id> &tab=<aba>
(() => {
  const q = new URLSearchParams(location.search), KT = globalThis.KT;
  const state = KT.State.createState();
  const ids = (q.get('team') || 'erik,akira,warden,aurelia').split(',');
  state.collection = ids.map((id, i) => Object.assign(KT.State.newHeroRecord(KT.Data.roster.find(t => t.id === id), i ? 'rare' : 'epic'), { level:62, job:1, classLevel:40 }));
  state.formation = state.collection.map(h => h.uid).concat([null, null, null, null]).slice(0, 4);
  state.player.gold = 5e6; state.player.level = 60; state.player.keys = 40;
  const hero = state.collection.find(h => h.id === (q.get('hero') || ids[0])) || state.collection[0];
  const tree = KT.Progression.treeFor(hero.id);
  tree.slice(0, 10).forEach((n, i) => { if (n.tier <= 1) hero.talents[n.id] = Math.min(n.max, i % 2 ? n.max : 3); });
  const engine = new KT.CombatEngine(state, {});
  const ui = Object.create(KT.UIController.prototype);
  Object.assign(ui, { state, engine, view:{ panel:q.get('p') || 'talents', tab:q.get('tab') || null, param:hero.uid, node:q.get('node') || tree[6]?.id }, invFilter:{ slot:'all', sort:'rarity', usable:false }, heroFilter:{} });
  const p = q.get('p') || 'talents', out = document.querySelector('#out');
  const html = p === 'talents' ? ui.talentTree(hero.uid) : p === 'party' ? ui.partyPanel() : p === 'collection' ? ui.collectionPanel(null, q.get('tab') || 'heroes') : p === 'city' ? ui.cityPanel(null, q.get('tab') || 'forge') : p === 'inventory' ? ui.inventoryPanel(null, q.get('tab') || 'items') : ui[`${p}Panel`]?.(null, q.get('tab'));
  out.innerHTML = html || `<p>Painel "${p}" não encontrado.</p>`;
})();
// ?debug=1: escreve no título as fontes calculadas (para conferir no Chrome headless com --dump-dom).
if (new URLSearchParams(location.search).get('debug')) setTimeout(() => { const t = document.querySelector('.band-sub'), l = document.querySelector('.tnode .lbl'); document.title = [t && getComputedStyle(t).font, l && getComputedStyle(l).font, document.fonts.check('600 12px Outfit')].join(' | '); }, 3000);
// ?overflow=1: lista no título os elementos mais largos que a tela (auditoria de responsividade).
if (new URLSearchParams(location.search).get('overflow')) setTimeout(() => { const W = document.documentElement.clientWidth; const bad = [...document.querySelectorAll('#out *')].filter(el => { const r = el.getBoundingClientRect(); return r.right > W + 1 && r.width > 0 && !el.closest('svg') && getComputedStyle(el.parentElement).overflowX === 'visible'; }).slice(0, 8).map(el => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}:${Math.round(el.getBoundingClientRect().right)}`); document.title = `W=${W} doc=${document.documentElement.scrollWidth} ${bad.join(' ')}`; }, 3000);
