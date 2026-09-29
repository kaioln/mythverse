(() => {
  const KT = globalThis.KT;
  const D = KT.Data, U = KT.Utils, I = KT.Items, PR = KT.Progression, S = () => KT.State;
  const P = KT.UIController.prototype;
  const { esc, portrait, fmtTime, compact, KEYS, ic, skillGlyph, glyphStyle } = KT.UIController.helpers;
  const pct = (v, d = 0) => `${(v * 100).toFixed(d).replace('.', ',')}%`;
  const ROMAN = ['I','II','III'];
  const RORDER = { mythic:0, set:1, legendary:2, epic:3, rare:4, common:5 };
  const rarLabel = id => D.rarities.find(r => r.id === id)?.label || D.heroRarities.find(r => r.id === id)?.label || id;
  const stars = n => `<span class="stars">${'★'.repeat(n)}<span class="off">${'★'.repeat(Math.max(0, 6 - n))}</span></span>`;
  const elTag = el => `<span class="el-tag" style="--ec:${D.elements[el].color}"><i class="kj">${D.elements[el].icon}</i> ${el}</span>`;
  const clsTag = cls => `<span class="cls-tag" style="--cc:${D.classes[cls].color}"><i class="kj">${D.classes[cls].icon}</i> ${cls}</span>`;
  const sceneUrl = id => KT.sceneUrl(D.zones[id]?.scene || id, 'thumb');
  const wtTag = wt => wt ? `<span class="wt-tag wt-${wt}">${I.weaponTypes[wt].icon} ${I.weaponTypes[wt].name}</span>` : '';
  const brt = (ms, opts = { weekday:'short', hour:'2-digit', minute:'2-digit' }) => new Date(ms).toLocaleString('pt-BR', { timeZone:'America/Sao_Paulo', ...opts });
  const kindLabel = k => ({ hunt:'CAÇADA', dungeon:'DUNGEON', boss:'CHEFE', rift:'SEM FIM', village:'REFÚGIO' }[k] || '');

  // ---------------------------------------------------------------------------
  // Formatação de atributos e itens
  // ---------------------------------------------------------------------------
  function statValue(k, v) {
    if (k === 'atkFlat') return `+${U.fmt(v)} ATK`;
    if (k === 'defFlat') return `+${U.fmt(v)} DEF`;
    if (k === 'hpFlat') return `+${U.fmt(v)} HP`;
    if (k === 'startNrg') return `+${Math.round(v)} ${D.statNames.startNrg}`;
    if (k === 'regen') return `+${(v * 100).toFixed(1).replace('.', ',')}% HP/s`;
    const name = D.statNames[k] || ({ ultDmg:'Dano de ultimate', skillMastery:'Maestria da habilidade', thorns:'Reflexo de dano', gold:'Ouro', xp:'EXP', drop:'Chance de itens' }[k] || k);
    return `${v >= 0 ? '+' : ''}${pct(v, Math.abs(v) < .1 && v % .01 ? 1 : 0)} ${name}`;
  }
  P.itemLines = function(item) {
    const st = I.itemStats(item), p = I.slots[item.slot].primary, lines = [];
    const primKey = p === 'skill' ? 'skill' : `${p}Flat`;
    lines.push(`<b>${statValue(primKey, st[primKey] || 0)}</b>`);
    const wt = I.weaponTypeOf(item);
    if (wt) Object.entries(I.weaponTypes[wt].implicit).forEach(([k, v]) => lines.push(`<span class="implicit">${statValue(k, I.implicitValue(item, v))} <small>(${I.weaponTypes[wt].name})</small></span>`));
    (item.affixes || []).forEach(a => lines.push(statValue(a.stat, a.v * (1 + (item.plus || 0) * .05))));
    if (item.kind === 'unique') { const q = I.uniques.find(x => x.id === item.uniqueId); Object.entries(q.stats).forEach(([k, v]) => lines.push(statValue(k, v))); }
    return lines;
  };
  P.itemCard = function(item, opts = {}) {
    const owner = this.engine.ownerOf(item.uid), ownerT = owner && this.engine.template(owner.id);
    const lines = this.itemLines(item);
    let extra = '';
    if (item.kind === 'unique') { const q = I.uniques.find(x => x.id === item.uniqueId); extra = `<p class="unique-fx">✦ ${esc(q.effect)}</p>`; }
    if (item.kind === 'set') { const s = I.sets.find(x => x.id === item.setId); extra = `<p class="set-fx" style="--sc:${s.color}">Conjunto <b>${esc(s.name)}</b><br>(2) ${esc(s.bonus2.text)}<br>(4) ${esc(s.bonus4.text)}</p>`; }
    const base = item.kind === 'base' && I.bases.find(b => b.id === item.baseId);
    const rq = I.reqFor(item), who = opts.reqFor;
    const reqHtml = `<small class="req-line">Requer <span class="${who && who.level < rq.level ? 'bad' : ''}">Nv. ${rq.level}</span>${rq.attr ? ` · <span class="${who && (who.attr?.[rq.attr] || 0) < rq.attrVal ? 'bad' : ''}">${PR.attributes[rq.attr].short} ${rq.attrVal}</span>` : ''}</small>`;
    return `<article class="item rarity-${item.rarity} ${opts.selected ? 'selected' : ''} ${owner ? 'equipped' : ''}" ${opts.selectable ? `data-select-item="${item.uid}"` : ''}>
      <div class="item-head">${KT.itemIcon(item)}<div><b class="rtext">${esc(item.name)}${item.plus ? ` <span class="plus">+${item.plus}</span>` : ''}</b><small>${rarLabel(item.rarity)} · ${I.slots[item.slot].name} · Nv. ${item.ilvl}${item.locked ? ' · travado' : ''}${item.bound ? ' · <span class="bound-tag" title="Obtido na loja ou em recompensa: não pode ser vendido a outros jogadores">Vinculado</span>' : ''}</small>${reqHtml}${I.weaponTypeOf(item) ? `<small class="wt-line">${wtTag(I.weaponTypeOf(item))} ${I.weaponTypes[I.weaponTypeOf(item)].classes ? I.weaponTypes[I.weaponTypeOf(item)].classes.join(' · ') : 'qualquer classe'}</small>` : ''}${owner ? `<small class="owner">Equipado: ${esc(ownerT.name)}</small>` : ''}</div></div>
      <ul class="item-stats">${lines.map(l => `<li>${l}</li>`).join('')}</ul>${extra}${(item.cards || []).length ? `<div class="sockets">${item.cards.map((cid, i) => { const cd = cid && I.cardById(cid); return cd ? `<span class="socket full" data-tip="<b>${esc(cd.name)}</b><br>${Object.entries(cd.stats).map(([k, v]) => statValue(k, v)).join(', ')}"><img src="${KT.spriteUrl(cd.sprite)}" alt=""></span>` : `<span class="socket" data-tip="Slot vazio: encaixe uma carta na Oficina → Cartas."></span>`; }).join('')}</div>` : ''}${base && opts.flavor ? `<p class="flavor">“${esc(base.flavor)}”</p>` : ''}
      ${opts.compare ? opts.compare : ''}
      ${opts.actions ? `<footer>${opts.actions}</footer>` : ''}
    </article>`;
  };
  P.statTable = function(st, compact = false) {
    const rows = [['ATK', U.fmt(st.atk)], ['HP', U.fmt(st.maxHp)], ['DEF', U.fmt(st.def)], ['Velocidade', `×${st.spd.toFixed(2).replace('.', ',')}`], ['Crítico', pct(st.crit, 1)], ['Dano crítico', pct(st.critDmg)], ['Esquiva', pct(st.dodge, 1)]];
    const extra = [['lifesteal','Roubo de vida'], ['dr','Redução de dano'], ['skill','Dano de habilidade'], ['skillMastery','Maestria de habilidade'], ['ultDmg','Dano de ultimate'], ['thorns','Reflexo de dano'], ['healPow','Cura e escudos'], ['nrg','Ganho de energia'], ['cdr','Recarga'], ['pierce','Perfuração de DEF'], ['boss','Contra chefes'], ['dot','Dano contínuo'], ['elem','Dano elemental']];
    extra.forEach(([k, n]) => { if (Math.abs(st[k] || 0) > .001) rows.push([n, `${st[k] > 0 ? '+' : ''}${pct(st[k], 1)}`]); });
    if (st.regen > 0) rows.push(['Regeneração', `${(st.regen * 100).toFixed(2).replace('.', ',')}%/s`]);
    if (st.startNrg > 0) rows.push(['Energia inicial', Math.round(st.startNrg)]);
    return `<div class="stat-table ${compact ? 'compact' : ''}">${rows.map(([n, v]) => `<div><span>${n}</span><b>${v}</b></div>`).join('')}</div>`;
  };

  // ---------------------------------------------------------------------------
  // Abertura de painéis
  // ---------------------------------------------------------------------------
  const PANELS = {
    journey:{ k:'JORNADA', t:'Mapa do Mundo' }, adventure:{ k:'AVENTURAS', t:'O que fazer agora', tabs:[['today','Hoje','lantern'], ['worldboss','Invasão Mundial','dragon'], ['expeditions','Expedições','compass'], ['bounty','Recompensas','target']] }, destination:{ k:'DESTINO', t:'Destino' }, party:{ k:'EQUIPE', t:'Formação e Sinergias' },
    hero:{ k:'HERÓI', t:'Ficha do herói', tabs:[['stats','Atributos'], ['build','Build recomendada'], ['talents','Talentos'], ['kit','Habilidades'], ['gear','Equipamento']] },
    collection:{ k:'HERÓIS', t:'Convocação e Coleção', tabs:[['summon','Convocar'], ['owned','Meus heróis'], ['catalog','Catálogo']] },
    inventory:{ k:'BOLSA', t:'Inventário' }, talents:{ k:'TALENTOS', t:'Árvore de Talentos' },
    ranking:{ k:'RANKING', t:'Ranking', tabs:[['power','Poder'], ['bosses','Chefes'], ['stage','Progresso'], ['rift','Fenda Abissal']] },
    city:{ k:'CIDADE', t:'Tsukimori', tabs:[['forge','Forja'], ['workshop','Oficina'], ['house','Casa do Time'], ['prof','Profissões'], ['dojo','Dojo'], ['shrine','Santuário'], ['guild','Guilda'], ['buildings','Construções']] },
    shop:{ k:'LOJA', t:'Empório Sakura', tabs:[['gold','Ouro'], ['crystal','Cristais'], ['market','Mercado do Porto'], ['p2p','Mercado de Jogadores']] },
    bank:{ k:'BANCO', t:'Banco Kogane', tabs:[['overview','Panorama','crown'], ['quotes','Cotações','scale'], ['wallet','Carteira','gem']] },
    quests:{ k:'MISSÕES', t:'Missões e Conquistas', tabs:[['guide','Guia'], ['daily','Diárias'], ['contracts','Contratos'], ['achievements','Conquistas'], ['advisor','Conselheiro']] },
    wiki:{ k:'WIKI', t:'Enciclopédia', tabs:[['start','Início'], ['combat','Combate'], ['classes','Classes'], ['elements','Elementos'], ['synergy','Sinergias'], ['heroes','Heróis'], ['builds','Builds'], ['trees','Talentos'], ['items','Itens'], ['weapons','Armas'], ['cards','Cartas'], ['monsters','Bestiário'], ['world','Mundo'], ['events','Eventos'], ['progress','Progressão'], ['refine','Refino'], ['systems','Atividades'], ['economy','Economia'], ['market','Mercado']] },
    arena:{ k:'PvP', t:'Coliseu Carmesim', tabs:[['fight','Lutar','swords'], ['shop','Loja de Honra','crown'], ['ranking','Ranking','star'], ['history','Histórico','scroll']] },
    guild:{ k:'GUILDA', t:'Sua Guilda', tabs:[['home','Guilda','shield'], ['war','Guerra de Guildas','flame'], ['list','Encontrar guildas','compass']] },
    record:{ k:'PERFIL', t:'Conta e Configurações' }, profile:{ k:'JOGADOR', t:'Perfil do jogador' }, help:{ k:'AJUDA', t:'Como jogar' }
  };
  P.openPanel = function(name, param = null) {
    if (name === 'destination' && typeof param === 'string' && param.includes(':')) param = param.split(':')[1];
    if (name === 'ranking') this.rankCache = null;
    const def = PANELS[name] || PANELS.help;
    let tab = null;
    if (def.tabs) tab = def.tabs.some(t => t[0] === param) ? param : (this.view.panel === name && this.view.tab ? this.view.tab : def.tabs[0][0]);
    if (name === 'hero') tab = PANELS.hero.tabs.some(t => t[0] === this.pendingHeroTab) ? this.pendingHeroTab : this.view.panel === 'hero' ? this.view.tab : 'stats';
    this.pendingHeroTab = null;
    if (name === 'talents') { param = param || this.view.talentHero || this.state.formation.find(Boolean) || this.state.collection[0]?.uid || null; this.view.talentHero = param; }
    this.view = { panel:name, tab, param:['hero','destination','talents','profile','journey'].includes(name) ? param : this.view.panel === name ? this.view.param : null, talentHero:this.view.talentHero, node:name === this.view.panel ? this.view.node : null };
    if (name === 'inventory') this.newItems = 0;
    this.pickSlot = null; this.hideTip();
    this.el.modal.hidden = false;
    this.refreshPanel(true);
    document.querySelectorAll('.nav').forEach(x => x.classList.toggle('active', x.dataset.panel === name || (name === 'destination' && x.dataset.panel === 'journey') || (name === 'hero' && x.dataset.panel === 'party')));
    this.renderResources();
  };
  P.refreshPanel = function(reset = false) {
    if (this.el.modal.hidden || !this.view.panel) return;
    const v = this.view, def = PANELS[v.panel] || PANELS.help;
    this.el.modalKicker.textContent = def.k;
    let title = def.t;
    if (v.panel === 'destination') title = D.zones[v.param]?.title || title;
    if (v.panel === 'profile') title = this.profiles?.[v.param]?.data?.profile?.name || title;
    if (v.panel === 'hero' || v.panel === 'talents') { const r = this.engine.record(v.param); title = r ? `${v.panel === 'talents' ? 'Talentos · ' : ''}${this.engine.template(r.id).name}` : title; }
    this.el.modalTitle.textContent = title;
    this.el.modalBackNav.hidden = v.panel !== 'destination';
    this.el.modalTabs.innerHTML = def.tabs ? def.tabs.map(([id, n, icon]) => `<button class="${icon ? 'has-ic tone-' + icon : ''} ${id === v.tab ? 'active' : ''}" data-tab="${id}" type="button">${icon ? ic(icon) : ''}<span>${n}</span></button>`).join('') : '';
    const top = this.el.modalBody.scrollTop;
    const fn = { adventure:'adventurePanel', journey:'journeyPanel', destination:'destinationPanel', party:'partyPanel', hero:'heroPanel', collection:'collectionPanel', inventory:'inventoryPanel', talents:'talentPanel', ranking:'rankingPanel', city:'cityPanel', shop:'shopPanel', bank:'bankPanel', quests:'questPanel', wiki:'wikiPanel', record:'recordPanel', profile:'profilePanel', help:'helpPanel', arena:'arenaPanel', guild:'guildPanel' }[v.panel] || 'helpPanel';
    this.el.modalBody.innerHTML = this[fn](v.param, v.tab);
    this.el.modalBody.scrollTop = reset ? 0 : top;
    requestAnimationFrame(() => this.el.modalBody.querySelectorAll('[data-sprite-preview]').forEach(cv => this.drawSprite(cv, cv.dataset.spritePreview)));
    if (v.panel === 'journey') KT.Map3D?.attach(this.el.modalBody.querySelector('.illustrated-map'), this.mapFocus);
  };
  P.closeModal = function() { this.el.modal.hidden = true; this.view.panel = null; this.hideTip(); document.querySelectorAll('.nav').forEach(x => x.classList.remove('active')); };
  P.drawSprite = function(cv, id) { const img = this.assets.spriteImage(id); if (!img) return; const ctx = cv.getContext('2d'), r = img.width / img.height, h = Math.min(cv.height - 4, (cv.width - 4) / r), w = h * r; ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(img, (cv.width - w) / 2, cv.height - h - 2, w, h); };

  // ---------------------------------------------------------------------------
  // MAPA
  // ---------------------------------------------------------------------------
  const MAP_PINS = { village:[46,43], hunt:[48,16], dungeon:[17,38], boss:[13,12], hunt_swamp:[27,60], dungeon_crypt:[10,70], hunt_tide:[66,40], dungeon_tide:[75,73], boss_tide:[87,14], hunt_frost:[9,26], dungeon_forge:[79,31], boss_event:[44,74], rift:[58,60], hunt_desert:[94,46], hunt_ghost:[94,58], dungeon_clock:[94,70], boss_sand:[86,86], hunt_sky:[66,8], hunt_sakura:[32,24], dungeon_sky:[57,28], boss_sky:[76,6] };
  const MAP_LABELS = { village:'Tsukimori', hunt:'Bosque', hunt_swamp:'Pântano', dungeon_crypt:'Cripta', hunt_tide:'Costa', hunt_frost:'Planalto', dungeon:'Templo', dungeon_tide:'Arquivo', dungeon_forge:'Forja', boss:'Eclipse', boss_tide:'Mizuchi', boss_event:'Festival', rift:'Fenda', hunt_desert:'Areias', hunt_ghost:'Fantasmas', dungeon_clock:'Relógio', boss_sand:'Apep', hunt_sky:'Ilhas', hunt_sakura:'Cerejeiras', dungeon_sky:'Santuário', boss_sky:'Raijin' };
  const CHAPTERS = [[1, 'Capítulo I · O Eclipse', ['hunt','dungeon','boss'], ['hunt_swamp','dungeon_crypt']], [2, 'Capítulo II · A Maré', ['hunt_tide','dungeon_tide','boss_tide'], ['hunt_frost','dungeon_forge']], [3, 'Capítulo III · As Areias do Tempo', ['hunt_desert','dungeon_clock','boss_sand'], ['hunt_ghost']], [4, 'Capítulo IV · O Céu Partido', ['hunt_sky','dungeon_sky','boss_sky'], ['hunt_sakura']], [8, 'Sem fim', ['rift'], []], [9, 'Evento por calendário', ['boss_event'], []]];
  P.zoneStatus = function(id) {
    const z = D.zones[id], p = this.state.progress[id] || {}, lock = this.engine.zoneLock(id);
    if (lock.locked) return { cls:'locked', txt:'Bloqueado' };
    if (z.kind === 'hunt') return { cls:p.best >= z.stages ? 'done' : '', txt:`Estágio ${p.best || 0}/${z.stages}` };
    if (z.kind === 'dungeon') return { cls:p.best >= z.floors ? 'done' : '', txt:`Andar ${p.best || 0}/${z.floors}` };
    if (z.kind === 'rift') return { cls:'rift', txt:p.best ? `Recorde: andar ${p.best}` : 'Nenhum andar ainda' };
    if (z.kind === 'boss') return { cls:p.kills ? 'done' : 'boss', txt:p.kills ? `Derrotado ${p.kills}×` : 'Chefe não derrotado' };
    return { cls:'', txt:'Refúgio' };
  };
  P.journeyCard = function(id, small = false) {
    const z = D.zones[id], st = this.zoneStatus(id);
    return `<button class="journey-card ${small ? 'side' : ''} ${st.cls} ${id === this.state.zone ? 'current' : ''} ${id === this.mapFocus ? 'focus' : ''}" data-preview-zone="${id}" type="button" style="background-image:linear-gradient(0deg,rgba(9,8,22,.97) 8%,rgba(9,8,22,.35) 70%,rgba(9,8,22,.15)),url('${sceneUrl(id)}')"><span>${z.side ? 'ROTA SECUNDÁRIA · ' : ''}${kindLabel(z.kind)}</span><b>${esc(z.title)}</b><small>${st.txt}</small></button>`;
  };
  P.journeyPanel = function(focus) {
    this.mapFocus = D.zones[focus] ? focus : null;
    // Próximo passo do guia (se for uma região): ganha destaque no mapa mesmo sem "Ir →".
    const g = this.engine.guideStep(), gz = g ? (KT.goOf(g).split(':')[1] || null) : null;
    const pin = id => { const st = this.zoneStatus(id), z = D.zones[id], cur = id === this.state.zone, next = id === gz && !cur;
      return `<button class="map-pin ${id === this.mapFocus ? 'focus' : ''} ${cur ? 'current' : ''} ${next ? 'next' : ''} ${st.cls} ${z.side ? 'side' : ''} ch${z.chapter}" style="left:${MAP_PINS[id][0]}%;top:${MAP_PINS[id][1]}%" data-preview-zone="${id}" type="button" aria-label="${esc(z.title)}: ${esc(st.txt)}" title="${esc(z.title)} · ${esc(st.txt)}"><span class="pin-name">${MAP_LABELS[id]}</span><small>${cur ? 'Você está aqui' : next ? 'Próximo objetivo' : st.txt}</small></button>`; };
    const chapterDone = ids => ids.filter(id => this.zoneStatus(id).cls === 'done').length;
    const legend = `<div class="map-legend" aria-hidden="true"><span><i class="lg current"></i>Você está aqui</span><span><i class="lg next"></i>Próximo objetivo</span><span><i class="lg open"></i>Disponível</span><span><i class="lg done"></i>Concluído</span><span><i class="lg locked"></i>Bloqueado</span></div>`;
    return `<div class="map-wrap"><div class="illustrated-map"><img src="${KT.sceneUrl('world-map')}" alt="Mapa do mundo" decoding="async">${Object.keys(MAP_PINS).map(pin).join('')}</div>${legend}
      <div class="chapters">${CHAPTERS.map(([n, title, ids, side]) => { const all = [...ids, ...side], done = chapterDone(all); return `<section class="chapter ${all.every(id => this.zoneStatus(id).cls === 'locked') ? 'locked' : ''}"><header class="chapter-head"><h4>${title}</h4><span class="chapter-prog"><i style="width:${Math.round(done / all.length * 100)}%"></i></span><small>${done}/${all.length}</small></header><div class="chapter-steps">${ids.map((id, i) => `${i ? '<span class="arrow">→</span>' : ''}${this.journeyCard(id)}`).join('')}</div>${side.length ? `<div class="chapter-side"><small>Rotas secundárias · monstros, itens e conjuntos próprios</small><div>${side.map(id => this.journeyCard(id, true)).join('')}</div></div>` : ''}</section>`; }).join('')}
      <button class="journey-card village" data-enter="village" type="button" style="background-image:linear-gradient(0deg,rgba(9,8,22,.97),rgba(9,8,22,.2) 75%),url('${KT.sceneUrl('village-expanded', 'thumb')}')"><span>CAPITAL</span><b>Voltar para Tsukimori</b><small>8 distritos, atividades e melhorias</small></button></div></div>`;
  };

  P.destinationPanel = function(id) {
    const z = D.zones[id]; if (!z) return this.journeyPanel();
    if (z.kind === 'village') return `<div class="destination-banner" style="background-image:linear-gradient(0deg,rgba(9,8,22,.96),rgba(9,8,22,.1) 70%),url('${KT.sceneUrl('village-expanded', 'thumb')}')"><div><span class="eyebrow">${z.kicker}</span><h3>${z.title}</h3><p>${z.lore}</p></div></div><div class="destination-actions"><button class="action primary big" data-enter="village" type="button">Entrar na capital</button></div>`;
    const e = this.engine, p = this.state.progress[id], lock = e.zoneLock(id), pow = e.getPower();
    let selector = '', opts = {}, recNote = '';
    if (z.kind === 'hunt') {
      const cur = Math.min(z.stages, this.view.stage || Math.max(1, Math.min(z.stages, p.best + 1)));
      opts = { stage:cur };
      selector = `<div class="stage-grid">${Array.from({ length:z.stages }, (_, i) => { const n = i + 1, done = n <= p.best, open = n <= p.best + 1; const rec = e.recommendedPower(id, { stage:n }); return `<button class="stage-btn ${done ? 'done' : ''} ${n === cur ? 'selected' : ''} ${n === z.stages ? 'final' : ''}" data-pick-stage="${n}" type="button" ${open ? '' : 'disabled'} data-tip="Estágio ${n}${n % 4 === 0 ? ' · Guardião duplo' : ''}${n === z.stages ? ' · Guardiões finais' : ''}<br>Poder recomendado: ${compact(rec)}"><b>${n}</b><small>${done ? '✓' : open ? compact(rec) : '<i class="ic ic-lock"></i>'}</small></button>`; }).join('')}</div>`;
    } else if (z.kind === 'rift') {
      const best = p.best || 0, cur = Math.min(best + 1, this.view.floor || best + 1);
      opts = { floor:cur };
      const from = Math.max(1, best - 10), list = Array.from({ length:best + 2 - from }, (_, i) => from + i);
      selector = `<div class="stage-grid rift-grid">${list.map(n => `<button class="stage-btn ${n <= best ? 'done' : ''} ${n === cur ? 'selected' : ''} ${n % 5 === 0 ? 'final' : ''}" data-pick-floor="${n}" type="button" data-tip="Andar ${n}${n % 5 === 0 ? ' · guardião do abismo' : ''}<br>Mutação: <b>${esc(e.riftMutation(n).name)}</b> (${esc(e.riftMutation(n).text)})<br>Poder recomendado: ${compact(e.recommendedPower(id, { floor:n }))}"><b>${n}</b><small>${n <= best ? '✓' : compact(e.recommendedPower(id, { floor:n }))}</small></button>`).join('')}</div><p class="note">Recorde: <b>andar ${best}</b>. Com o Avanço ligado, a equipe desce sozinha até cair, e recua 1 andar para treinar.</p>`;
    } else if (z.kind === 'dungeon') {
      const cur = Math.min(z.floors, this.view.floor || Math.max(1, Math.min(z.floors, p.best + 1)));
      opts = { floor:cur };
      selector = `<div class="stage-grid floors">${Array.from({ length:z.floors }, (_, i) => { const n = i + 1, done = n <= p.best, open = n <= p.best + 1; return `<button class="stage-btn ${done ? 'done' : ''} ${n === cur ? 'selected' : ''}" data-pick-floor="${n}" type="button" ${open ? '' : 'disabled'}><b>Andar ${ROMAN[i]}</b><small>${done ? '✓ Conquistado' : open ? `Rec. ${compact(e.recommendedPower(id, { floor:n }))}` : '<i class="ic ic-lock"></i>'}</small></button>`; }).join('')}</div>`;
    } else {
      const unlocked = D.bossTiers.filter(t => !t.needKills || (p.kills || 0) >= t.needKills).length - 1;
      const cur = Math.min(unlocked, this.view.tier ?? p.tier ?? 0);
      opts = { tier:cur };
      selector = `<div class="stage-grid floors">${D.bossTiers.map(t => `<button class="stage-btn tier-${t.id} ${t.id === cur ? 'selected' : ''}" data-pick-tier="${t.id}" type="button" ${t.id <= unlocked ? '' : 'disabled'}><b>${t.name}</b><small>${t.id <= unlocked ? `Rec. ${compact(e.recommendedPower(id, { tier:t.id }))} · recompensas ×${t.reward}` : `Vença ${t.needKills}× antes`}</small></button>`).join('')}</div>`;
      recNote = '<p class="note warn-note">⚠ Chefes têm três fases, ataques telegrafados (⚠), invocações e entram em <b>Fúria</b> se a luta demorar. Leve um <b>Suporte</b> e guarde ultimates de escudo e cura.</p>';
    }
    const rec = e.recommendedPower(id, opts), ratio = pow / rec;
    const ctx = e.ctx(), weak = z.weakTo || [];
    const teamWeak = e.heroes.filter(r => weak.includes(e.template(r.id).el)).length;
    // Nível dos inimigos e faixa de EXP plena (travas contra power-leveling e farm de mapa fácil).
    if (['hunt', 'dungeon', 'boss', 'rift'].includes(z.kind)) {
      const lv = S().enemyLevel(S().zonePower(z, opts)), R = S().XP_RULES, cap = Math.min(100, lv), team = e.heroes, avg = team.length ? Math.round(team.reduce((a, r) => a + r.level, 0) / team.length) : 0;
      const f = team.length ? Math.round(team.reduce((a, r) => a + S().xpFactor(r.level, lv), 0) / team.length * 100) : 100;
      recNote += `<p class="note ${f < 100 ? 'warn-note' : ''}">Inimigos nível <b>${lv}</b> · EXP plena para heróis do nível <b>${Math.max(1, cap - R.under)}</b> ao <b>${Math.min(100, cap + R.over)}</b>. Sua equipe (nível médio ${avg}) recebe <b>${f}%</b> da EXP aqui.</p>`;
    }
    if (z.kind === 'boss' && p.kills) { const left = e.bossLootLeft(id, opts.tier ?? p.tier ?? 0); recNote += `<p class="note ${left ? '' : 'warn-note'}">Espólio de hoje nesta dificuldade: <b>${left}/${S().BOSS_LOOT_PER_DAY}</b> vitórias com itens, materiais, chaves e carta MVP.${left ? '' : ' Até a meia-noite (Brasília) a vitória rende só ouro e EXP.'}</p>`; }
    const foes = z.kind === 'boss' ? [z.enemy] : [...(z.pool || []), ...(z.elites || []), ...(z.floorBoss ? [z.floorBoss] : [])];
    const bossE = z.kind === 'boss' && D.enemies[z.enemy];
    const zoneSets = I.sets.filter(st => (I.setSources?.[st.id] || []).some(([zid]) => zid === id));
    const drops = { hunt:'Itens comuns a épicos (lendários são raros); guardiões garantem um item; variantes Alfa garantem loot melhor', dungeon:'Baú no fim de cada andar e itens do chefe do andar', boss:'2 a 3 itens épicos/lendários, conjunto e únicos exclusivos', rift:'Tamahagane e ouro em todo andar, baú com chance crescente; conjunto Herança do Abismo a partir do andar 15' }[z.kind];
    const firstClear = z.kind === 'hunt' ? `Primeira vitória em cada estágio: poucos cristais${z.side ? '' : '; estágio final: 1 chave'}.` : z.kind === 'dungeon' ? 'Primeira conquista de cada andar: cristais; andar final: 1 chave.' : z.kind === 'rift' ? 'Primeira vez em cada andar: cristais; a cada 10 andares: 1 chave.' : 'Primeira vitória: 80 cristais + 1 chave.';
    return `<div class="destination-banner" style="background-image:linear-gradient(0deg,rgba(9,8,22,.96),rgba(9,8,22,.1) 70%),url('${sceneUrl(id)}')"><div><span class="eyebrow">${z.kicker}</span><h3>${z.title}</h3><p>${esc(z.lore)}</p></div></div>
      ${lock.reasons.length ? `<div class="zone-requirements">${lock.reasons.map(r => `<span class="${r.met ? 'met' : 'missing'}">${r.met ? '✓' : '✕'} ${esc(r.text)}</span>`).join('')}</div>` : ''}
      <div class="dest-grid"><div>
        <h4 class="sub-title">${z.kind === 'hunt' ? 'Escolha o estágio' : z.kind === 'dungeon' || z.kind === 'rift' ? 'Escolha o andar' : 'Escolha a dificuldade'}</h4>${selector}
        <div class="power-compare ${ratio >= 1 ? 'ok' : ratio >= .8 ? 'warn' : 'bad'}"><div><small>Seu poder</small><b>${compact(pow)}</b></div><div class="vs">vs</div><div><small>Recomendado</small><b>${compact(rec)}</b></div><p>${ratio >= 1 ? 'Sua equipe está pronta.' : ratio >= .8 ? 'Desafiador, boa estratégia pode vencer.' : 'Muito arriscado. Fortaleça a equipe antes.'}</p></div>
        ${recNote}
        <div class="destination-actions"><button class="action primary big" data-enter="${id}" data-opts='${JSON.stringify(opts)}' type="button" ${lock.locked ? 'disabled' : ''}>${lock.locked ? 'Bloqueado' : 'Partir'}</button></div>
      </div><div>
        <h4 class="sub-title">Dicas de preparo</h4>
        <ul class="prep-list"><li>Fraquezas da região: ${weak.map(elTag).join(' ') || ', '} <small>(${teamWeak} herói(s) da sua equipe causam dano extra)</small></li>
        ${!ctx.clsCount.Suporte ? '<li class="bad">Sua equipe não tem Suporte (cura).</li>' : ''}${!ctx.clsCount.Vanguarda ? '<li class="bad">Sua equipe não tem Vanguarda (tanque).</li>' : ''}
        <li>${drops}.</li><li>${firstClear}</li>${zoneSets.length ? `<li>Conjunto(s) desta região: ${zoneSets.map(st => `<b style="color:${st.color}">${esc(st.name)}</b>`).join(', ')}.</li>` : ''}</ul>
      </div></div>
      <h4 class="sub-title">${bossE ? 'O chefe' : z.kind === 'rift' ? `Monstros do andar ${opts.floor}` : 'Monstros desta região'}</h4>
      ${bossE ? this.bossInfo(bossE) : `<div class="foe-grid">${foes.map(fid => this.foeCard(fid)).join('')}</div>`}`;
  };
  P.foeCard = function(fid, research = false) {
    const f = D.enemies[fid], el = D.elements[f.el], kills = this.state.bestiary?.[fid] || 0, lvl = this.engine.research(fid), next = D.RESEARCH.levels[lvl];
    const res = research ? `<small class="research"><i class="ic ic-scroll"></i> ${U.fmt(kills)} abates · pesquisa ${lvl}/${D.RESEARCH.levels.length}${next ? ` · próximo em ${U.fmt(next)}` : ' · completa'}</small>` : '';
    return `<article class="foe-card ${f.elite ? 'elite' : ''} ${f.miniboss ? 'mini' : ''}" data-wiki-entry><canvas width="130" height="120" data-sprite-preview="${f.sprite}"></canvas><b>${esc(f.name)}</b>${res}<small>${f.miniboss ? '<i class="ic ic-crown"></i> Chefe do andar' : f.elite ? '★ Guardião' : f.role} · <span style="color:${el.color}">${el.icon} ${f.el}</span></small><small class="desc">${esc(f.desc)}</small>${f.skill ? `<small class="skill">✦ <b>${esc(f.skill.name)}</b>: ${esc(KT.Kit.describe(f.skill.eff))}</small>` : ''}${(f.specials || []).map(sp => `<small class="skill danger">⚠ <b>${esc(sp.name)}</b> (${sp.windup}s de preparo): ${esc(KT.Kit.describe(sp.eff))}</small>`).join('')}</article>`;
  };
  P.bossInfo = function(b) {
    return `<div class="boss-info"><canvas width="320" height="260" data-sprite-preview="${b.sprite}"></canvas><div><h3>${esc(b.name)}</h3><p>${esc(b.desc)}</p><p class="dim">${D.elements[b.el].icon} ${b.el} · Fúria após ${b.enrage}s (+25% ATK a cada 10s)</p><p><b>Ataque básico especial: ${esc(b.skill.name)}:</b> ${esc(KT.Kit.describe(b.skill.eff))}</p>
      ${b.phases.map((ph, i) => `<div class="phase"><b>Fase ${i + 1} ${i ? `(abaixo de ${pct(ph.at)} de HP)` : ''}: ${esc(ph.text)}</b>${ph.summon ? `<small>Invoca ${ph.summon.n}× ${esc(D.enemies[ph.summon.id].name)} a cada ${ph.summon.every}s.</small>` : ''}${ph.buff ? `<small>Fortalece: ${Object.entries(ph.buff).map(([k, v]) => statValue(k, v)).join(', ')}.</small>` : ''}${ph.specials.map(sp => `<small class="danger">⚠ <b>${esc(sp.name)}</b>, preparo ${sp.windup}s, a cada ${sp.cd}s: ${esc(KT.Kit.describe(sp.eff))}</small>`).join('')}</div>`).join('')}</div></div>`;
  };

  // ---------------------------------------------------------------------------
  // EQUIPE
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Busca e filtros de heróis (Equipe e Coleção): nome, raridade, classe, elemento, fora da equipe e ordem.
  // ---------------------------------------------------------------------------
  const RAR_RANK = { legendary:0, epic:1, rare:2, common:3 };
  P.heroFilterState = function() { return this.heroFilter || (this.heroFilter = { q:'', rarity:'all', cls:'all', el:'all', sort:'power', free:false }); };
  P.filterHeroes = function(list, ctx) {
    const f = this.heroFilterState(), e = this.engine, team = this.state.formation, q = f.q.trim().toLocaleLowerCase('pt-BR');
    const power = new Map(list.map(r => [r.uid, e.heroPower(r, ctx)]));
    return list.filter(r => { const t = e.template(r.id); return (f.rarity === 'all' || r.rarity === f.rarity) && (f.cls === 'all' || t.cls === f.cls) && (f.el === 'all' || t.el === f.el) && (!f.free || !team.includes(r.uid)) && (!q || t.name.toLocaleLowerCase('pt-BR').includes(q)); })
      .sort((a, b) => f.sort === 'rarity' ? (RAR_RANK[a.rarity] - RAR_RANK[b.rarity]) || power.get(b.uid) - power.get(a.uid)
        : f.sort === 'stars' ? (b.stars - a.stars) || power.get(b.uid) - power.get(a.uid)
        : f.sort === 'level' ? (b.level - a.level) || power.get(b.uid) - power.get(a.uid)
        : f.sort === 'name' ? e.template(a.id).name.localeCompare(e.template(b.id).name, 'pt-BR')
        : power.get(b.uid) - power.get(a.uid));
  };
  P.heroFilterBar = function(total, shown) {
    const f = this.heroFilterState(), opt = (v, n, cur) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${esc(n)}</option>`;
    const count = r => this.state.collection.filter(h => h.rarity === r).length;
    return `<div class="hero-filter">
      <input id="hf-q" type="search" placeholder="Buscar herói pelo nome…" value="${esc(f.q)}" autocomplete="off">
      <div class="hf-rarity">${[['all', 'Todas'], ...D.heroRarities.slice().reverse().map(r => [r.id, r.label])].map(([id, n]) => `<button class="rar-pill r-${id} ${f.rarity === id ? 'active' : ''}" data-hf-rarity="${id}" type="button">${esc(n)}${id === 'all' ? '' : ` <em>${count(id)}</em>`}</button>`).join('')}</div>
      <select id="hf-cls" aria-label="Classe">${opt('all', 'Todas as classes', f.cls)}${Object.keys(D.classes).map(c => opt(c, c, f.cls)).join('')}</select>
      <select id="hf-el" aria-label="Elemento">${opt('all', 'Todos os elementos', f.el)}${Object.keys(D.elements).map(el => opt(el, el, f.el)).join('')}</select>
      <select id="hf-sort" aria-label="Ordenar">${[['power', 'Maior poder'], ['rarity', 'Raridade'], ['stars', 'Estrelas'], ['level', 'Nível'], ['name', 'Nome']].map(([v, n]) => opt(v, n, f.sort)).join('')}</select>
      <label class="check"><input type="checkbox" id="hf-free" ${f.free ? 'checked' : ''}> Só fora da equipe</label>
      <small class="dim">${shown} de ${total}</small></div>`;
  };
  const rarChip = r => `<span class="rar-chip r-${r}">${esc(D.heroRarities.find(x => x.id === r)?.label || r)}</span>`;

  P.partyPanel = function() {
    const e = this.engine, ctx = e.ctx(), f = this.state.formation, canEdit = e.canEditParty();
    if (!this.state.collection.length) return `<div class="empty-state"><h3>Você ainda não tem heróis</h3><p>Abra a Caixa dos Mundos para convocar seus primeiros heróis.</p><button class="action pink big" data-go="collection" type="button">Convocar heróis</button></div>`;
    const slots = f.map((uid, i) => {
      const r = uid && e.record(uid), t = r && e.template(r.id);
      return `<button class="formation-slot ${r ? `filled rarity-${r.rarity}` : ''} ${i === this.selectedSlot ? 'selected' : ''}" data-slot="${i}" type="button"><span class="row-label">${i < 2 ? 'FRENTE' : 'RETAGUARDA'}</span>${r ? `<img src="${portrait(t.id)}" alt=""><span><b>${esc(t.name)}</b><small>${clsTag(t.cls)} Nv.${r.level}</small><small>${compact(e.heroPower(r, ctx))} de poder</small></span>${canEdit ? `<span class="remove" data-remove="${uid}" data-tip="Remover da equipe">✕</span>` : ''}` : `<span class="num">${i + 1}</span><span><b>Vaga livre</b><small>${i === this.selectedSlot ? 'Escolha um herói abaixo' : 'Toque para selecionar'}</small></span>`}</button>`;
    }).join('');
    const warns = [];
    if (e.heroes.length === 4) {
      if (!ctx.clsCount.Suporte) warns.push('Sem <b>Suporte</b>: nenhuma cura, chefes serão muito difíceis.');
      if (!ctx.clsCount.Vanguarda) warns.push('Sem <b>Vanguarda</b>: a linha de frente vai cair rápido.');
      f.forEach((uid, i) => { const r = uid && e.record(uid); if (!r) return; const t = e.template(r.id); if (i < 2 && ['Arcanista','Suporte','Atirador'].includes(t.cls)) warns.push(`${esc(t.name)} (${t.cls}) está na <b>frente</b>: classes frágeis rendem mais na retaguarda.`); if (i >= 2 && t.cls === 'Vanguarda') warns.push(`${esc(t.name)} (Vanguarda) está na <b>retaguarda</b>, não protegerá ninguém.`); });
    }
    const syn = this.synergyHtml(ctx);
    const owned = this.filterHeroes(this.state.collection.slice(), ctx).sort((a, b) => f.includes(b.uid) - f.includes(a.uid));
    return `<div class="party-layout"><section>
      <div class="section-title"><h3>Formação <span>${e.heroes.length}/4</span></h3><small>Poder total: <b>${compact(e.getPower())}</b></small></div>
      <div class="team-quick"><button class="action primary" data-auto-team type="button" ${this.state.collection.length ? '' : 'disabled'}>Montar melhor equipe</button><button class="action" data-optimize type="button" ${e.heroes.length ? '' : 'disabled'}>Fortalecer equipe</button><small class="dim">Montar: escolhe 4 heróis (frente e retaguarda certas). Fortalecer: equipa o melhor e distribui pontos.</small></div>
      <div class="formation-slots">${slots}</div>
      ${canEdit ? '' : '<p class="note">A formação só pode ser alterada na cidade (Tsukimori).</p>'}
      ${warns.length ? `<ul class="warn-list">${warns.map(w => `<li>${w}</li>`).join('')}</ul>` : ''}
      <div class="section-title"><h3>Heróis disponíveis</h3><small>${canEdit ? 'Toque em “Escalar” para colocar na vaga selecionada.' : ''}</small></div>
      ${this.heroFilterBar(this.state.collection.length, owned.length)}
      <div class="roster-list">${owned.map(r => { const t = e.template(r.id), inTeam = f.includes(r.uid), pts = e.freeAttr(r); return `<article class="roster-row rarity-${r.rarity} ${inTeam ? 'in-team' : ''}"><img src="${portrait(t.id)}" alt="" data-hero="${r.uid}"><div data-hero="${r.uid}"><b>${esc(t.name)} ${stars(r.stars)} ${rarChip(r.rarity)}</b><small>${clsTag(t.cls)} ${elTag(t.el)} Nv.${r.level}${pts > 0 ? ` · <span class="pts">${pts} pts</span>` : ''}</small></div><span class="pow">${compact(e.heroPower(r, ctx))}</span>${inTeam ? '<span class="tag green">NA EQUIPE</span>' : canEdit ? `<button class="action small primary" data-assign="${r.uid}" type="button">Escalar</button>` : ''}<button class="action small" data-hero="${r.uid}" type="button">Ficha</button></article>`; }).join('')}</div>
    </section><aside>${syn}</aside></div>`;
  };
  P.synergyHtml = function(ctx) {
    const e = this.engine, teamIds = new Set(e.heroes.map(r => r.id)), owned = new Set(this.state.collection.map(r => r.id));
    const clsRows = Object.entries(D.classes).map(([cls, c]) => { const n = ctx.clsCount[cls] || 0; return `<div class="syn-row ${n >= 2 ? 'on' : ''}"><span>${c.icon} ${cls}</span><b>${n}</b><small>${c.synergy.map(s => `<span class="${n >= s.n ? 'act' : ''}">(${s.n}) ${s.text}</span>`).join('')}</small></div>`; }).join('');
    const elRows = Object.entries(ctx.elCount).filter(([, n]) => n >= 2).map(([el, n]) => `<div class="syn-row ${n >= 2 ? 'on' : ''}"><span>${D.elements[el].icon} ${el}</span><b>${n}</b><small>${D.elementSynergy.map(s => `<span class="${n >= s.n ? 'act' : ''}">(${s.n}) ${s.text}</span>`).join('')}</small></div>`).join('');
    const bonds = D.bonds.filter(b => b.ids.some(id => teamIds.has(id)) && b.ids.every(id => owned.has(id) || teamIds.has(id)));
    const bondRows = bonds.map(b => { const active = b.ids.every(id => teamIds.has(id)); return `<div class="bond ${active ? 'on' : ''}"><div class="bond-faces">${b.ids.map(id => `<img src="${portrait(id)}" class="${teamIds.has(id) ? '' : 'missing'}" alt="">`).join('')}</div><div><b>${esc(b.name)}</b><small>${esc(b.text)}</small></div>${active ? '<span class="tag green">ATIVO</span>' : '<span class="tag">faltam heróis</span>'}</div>`; }).join('');
    return `<div class="syn-panel"><h4 class="sub-title">Sinergias de classe</h4>${clsRows}<h4 class="sub-title">Sinergias de elemento</h4>${elRows || `<p class="dim">Nenhuma ativa. Coloque 2+ heróis do mesmo elemento: ${D.elementSynergy.map(s2 => `(${s2.n}) ${s2.text}`).join(' · ')}.</p>`}<h4 class="sub-title">Laços</h4>${bondRows || '<p class="dim">Laços surgem quando heróis com história juntos estão na mesma equipe. Consulte a Wiki → Sinergias.</p>'}</div>`;
  };

  // ---------------------------------------------------------------------------
  // FICHA DO HERÓI
  // ---------------------------------------------------------------------------
  P.heroPanel = function(uid, tab) {
    const e = this.engine, r = e.record(uid); if (!r) return this.partyPanel();
    const t = e.template(r.id), st = e.heroStats(r), pw = S().heroScore(S().statPower(st));
    const xpNext = S().heroXpNext(r.level), cap = S().heroMaxLevel(), classNext = S().classXpNext(r.classLevel || 1), aw = S().awakenCost(r.stars, this.state.buildings.shrine), shards = this.state.shards[r.id] || 0, scrollUses = e.shopBoughtToday('scroll_use');
    const head = `<div class="hero-head rarity-${r.rarity}" style="--hc:${t.color}"><div class="hero-art"><img src="${KT.spriteUrl(t.sprite)}" alt=""></div><div class="hero-meta">
      <span class="eyebrow">${esc(t.world)}</span><h3>${esc(t.name)} ${stars(r.stars)}</h3>
      <div class="tags">${clsTag(t.cls)} ${elTag(t.el)} <span class="rar-tag">${rarLabel(r.rarity)}</span> <span class="tag">${D.classes[t.cls].row}</span>${r.job ? `<span class="tag job">${esc(PR.jobTitle(t.cls, r))}</span>` : ''}</div>
      <div class="lvl-line"><b>Nível ${r.level}</b><small>/ ${cap}</small><div class="meter"><span style="width:${r.level >= cap ? 100 : r.xp / xpNext * 100}%"></span></div><small>${r.level >= cap ? 'Nível máximo; a EXP excedente alimenta o Paragão' : `${U.fmt(r.xp)} / ${U.fmt(xpNext)} EXP`}</small><b>Classe ${r.classLevel || 1}</b><small>/ ${PR.CLASS_LEVEL_CAP}</small><div class="meter"><span style="width:${(r.classLevel || 1) >= PR.CLASS_LEVEL_CAP ? 100 : (r.classXp || 0) / classNext * 100}%"></span></div><small>${(r.classLevel || 1) >= PR.CLASS_LEVEL_CAP ? 'Classe dominada' : `${U.fmt(r.classXp || 0)} / ${U.fmt(classNext)} EXP de classe`}</small></div>
      <div class="hero-actions"><span class="pow-big"><i class="ic ic-swords"></i> ${compact(pw)}</span>
        <button class="action ${shards >= aw.shards && this.state.player.gold >= aw.gold && r.stars < 6 ? 'pink' : ''}" data-awaken="${uid}" type="button" ${r.stars >= 6 ? 'disabled' : ''} data-tip="Elevar qualidade: +1★ e +12% em HP, ATK e DEF. Fragmentos vêm de convocações repetidas e do Mercado.">★ Qualidade ${r.stars >= 6 ? '(máx.)' : `· ${shards}/${aw.shards} frag. · ${compact(aw.gold)} ouro`}</button>
        ${e.usableTalentPoints(r) > 0 ? `<button class="action pink" data-tab-go="talents" type="button">${e.usableTalentPoints(r)} ponto(s) de talento</button>` : ''}
        ${(!r.job && e.canJobChange(r)) || e.canTranscend(r) ? `<button class="action pink" data-tab-go="talents" type="button" data-tip="Árvore de classes: escolha o caminho no nível ${PR.JOB_LEVEL} e transcenda no ${PR.JOB2_LEVEL}.">${r.job ? 'Transcender classe' : 'Escolher classe avançada'}</button>` : ''}
        <button class="action" data-scroll="${uid}" type="button" ${r.level < cap && this.state.consumables.scroll && scrollUses < 3 ? '' : 'disabled'} data-tip="Concede 8% do próximo nível. Não alimenta o Paragão. Uso diário: ${scrollUses}/3."><i class="ic ic-scroll"></i> EXP (${this.state.consumables.scroll})</button></div>
      </div></div>`;
    let body = '';
    if (tab === 'talents') return `<button class="map-back" data-go="party" type="button">← Equipe</button>${this.talentTree(uid)}`;
    if (tab === 'build') return `<button class="map-back" data-go="party" type="button">← Equipe</button>${head}${this.buildHtml(r)}`;
    if (tab === 'kit') {
      const c = D.classes[t.cls];
      body = `<div class="kit">
        <div class="kit-row"><span class="kit-ico cls">C</span><div><small>TRAÇO DE CLASSE · ${t.cls}</small><b>${c.trait}</b></div></div>
        <div class="kit-row"><span class="kit-ico passive">P</span><div><small>PASSIVA</small><b>${esc(t.passive.name)}</b><p>${esc(t.passiveText)}</p></div></div>
        ${KT.Builds.essences[t.id] ? `<div class="kit-row"><span class="kit-ico ess">✦</span><div><small>ESSÊNCIA · talento exclusivo (Círculo I, 3 ranks)</small><b>${esc(KT.Builds.essences[t.id].name)}</b><p>${esc(KT.Builds.essences[t.id].text(3))} (rank máximo)</p></div></div>` : ''}
        <div class="kit-row"><span class="kit-ico skill">H</span><div><small>HABILIDADE · automática · recarga ${String(t.skill.cd).replace('.', ',')}s</small><b>${esc(t.skill.name)}</b><p>${esc(t.skillText)}</p></div></div>
        <div class="kit-row"><span class="kit-ico ult">U</span><div><small>ULTIMATE · 100 de energia · tecla ${KEYS[this.state.formation.indexOf(uid)] || ', '}</small><b>${esc(t.ult.name)}</b><p>${esc(t.ultText)}</p></div></div>
        <p class="note">Energia: +10 por ataque básico, + ao receber dano. Habilidades de Suporte dão +8 de energia aos aliados. Com AUTO ligado, a ultimate é usada automaticamente.</p>
        ${D.bonds.filter(b => b.ids.includes(t.id)).map(b => `<div class="bond"><div class="bond-faces">${b.ids.map(id => `<img src="${portrait(id)}" alt="">`).join('')}</div><div><b>Laço: ${esc(b.name)}</b><small>${esc(b.text)}</small></div></div>`).join('')}</div>`;
    } else if (tab === 'gear') {
      const slotsHtml = Object.entries(I.slots).map(([slot, s]) => { const it = this.state.inventory.find(x => x.uid === r.equipped[slot]); return `<button class="equip-slot big ${it ? `rarity-${it.rarity}` : 'empty'} ${this.pickSlot === slot ? 'selected' : ''}" data-pick-slot="${slot}" type="button">${it ? KT.itemIcon(it) : `<span class="slot-ico">${s.icon}</span>`}<span><small>${s.name}</small><b>${it ? `${esc(it.name)}${it.plus ? ` +${it.plus}` : ''}` : 'Vazio, toque para equipar'}</b>${it ? `<small>${this.itemLines(it).slice(0, 2).join(' · ').replace(/<[^>]+>/g, '')}</small>` : `<small>${s.desc}</small>`}</span></button>`; }).join('');
      const sets = st.sets.length ? `<div class="set-status">${st.sets.map(s => `<p style="--sc:${s.set.color}"><b>${esc(s.set.name)}</b> (${s.n}/4): ${s.active.length ? s.active.map(n => n === 2 ? esc(s.set.bonus2.text) : esc(s.set.bonus4.text)).join(' · ') : 'equipe 2 peças para ativar'}</p>`).join('')}</div>` : '';
      let picker = '';
      if (this.pickSlot) {
        const cur = this.state.inventory.find(x => x.uid === r.equipped[this.pickSlot]);
        const all = this.state.inventory.filter(x => x.slot === this.pickSlot && x.uid !== cur?.uid);
        const gains = new Map(all.map(x => [x.uid, I.canEquip(x, r.id) ? e.itemGain(r, x) : null]));
        const list = all.filter(x => I.canEquip(x, r.id)).sort((a, b) => (gains.get(b.uid) ?? -9) - (gains.get(a.uid) ?? -9)), blocked = all.length - list.length;
        picker = `<div class="section-title"><h3>${I.slots[this.pickSlot].name}: escolha um item</h3>${cur ? `<button class="action small" data-unequip="${this.pickSlot}" type="button">Remover atual</button>` : ''}</div>${this.pickSlot === 'weapon' ? `<p class="note">${esc(t.name)} empunha: ${I.allowedWeaponTypes(r.id).map(wtTag).join(' ')}${blocked ? ` · ${blocked} arma(s) de outras classes ocultas` : ''}</p>` : ''}<div class="inventory-grid">${list.map(it => { const d = gains.get(it.uid); return this.itemCard(it, { compare:d === null ? `<span class="compare down">Requisito não atendido</span>` : `<span class="compare ${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d * 100).toLocaleString('pt-BR', { maximumFractionDigits:1 })}% para ${esc(t.name)} ${cur ? 'vs atual' : ''}</span>`, actions:`<button class="action small primary" data-equip="${it.uid}" type="button">Equipar</button>` }); }).join('') || '<p class="empty-note">Nenhum item compatível deste tipo na bolsa.</p>'}</div>`;
      }
      body = `<div class="gear-toolbar"><span>Armas aceitas: ${I.allowedWeaponTypes(r.id).map(wtTag).join(' ')}</span></div><div class="gear-grid">${slotsHtml}</div>${sets}${picker}`;
    } else {
      const free = e.freeAttr(r);
      const attrs = Object.entries(PR.attributes).map(([k, a]) => `<div class="attr-row" style="--ac:${a.color}"><span class="attr-name"><b>${a.short}</b>${a.name}</span><span class="attr-val">${r.attr[k] || 0}</span><small>${a.text}</small><span class="attr-btns"><button class="action small" data-attr="${k}" data-n="1" type="button" ${free > 0 ? '' : 'disabled'}>+1</button><button class="action small" data-attr="${k}" data-n="5" type="button" ${free >= 5 ? '' : 'disabled'}>+5</button></span></div>`).join('');
      body = `<div class="hero-stats-layout"><section><div class="section-title"><h3>Atributos</h3><span class="pts-big ${free > 0 ? 'has' : ''}">${free} ponto(s) livre(s)</span></div>
        <p class="note">Ganhe ${PR.ATTR_PER_LEVEL} pontos por nível. Recomendado para ${t.cls}: <b>${PR.classAttrHint[t.cls]}</b></p>
        <div class="attr-list">${attrs}</div>
        <button class="action small" data-attr-reset="${uid}" type="button">Redistribuir (${compact(e.attrResetCost(r))} ouro)</button></section>
        <section><div class="section-title"><h3>Atributos finais</h3></div>${this.statTable(st)}<p class="note">Inclui classe, nível, raridade, estrelas, atributos, itens, conjuntos, treino, talentos, sinergias e laços da equipe atual.</p></section></div>`;
    }
    return `<button class="map-back" data-go="party" type="button">← Equipe</button>${head}${body}`;
  };
  P.buildHtml = function(r) {
    const e = this.engine, b = KT.Builds.buildFor(r.id), t = b.hero, tree = PR.treeFor(r.id);
    const total = Object.values(b.attr).reduce((a, x) => a + x, 0);
    const attrBars = Object.entries(b.attr).map(([k, w]) => `<div class="bw-row" style="--ac:${PR.attributes[k].color}"><b>${PR.attributes[k].short}</b><span class="bw-bar"><i style="width:${w / total * 100}%"></i></span><small>${Math.round(w / total * 100)}% · agora ${r.attr[k] || 0}</small></div>`).join('');
    const path = b.talents.map((id, i) => { const n = tree.find(x => x.id === id); if (!n) return ''; const rk = r.talents[id] || 0; return `<li class="${rk >= n.max ? 'done' : rk ? 'some' : ''}"><em>${i + 1}</em>${esc(n.sig === 'skill' ? `Maestria: ${t.skill.name}` : n.sig === 'ult' ? `Ápice: ${t.ult.name}` : n.name)} <small>${rk}/${n.max}</small></li>`; }).join('');
    const free = e.freeAttr(r), tp = e.usableTalentPoints(r), better = Object.keys(I.slots).filter(sl => e.bestItemFor(r, sl)).length;
    return `<div class="build-layout">
      <section class="build-hero"><span class="eyebrow">ESTILO</span><h3>${esc(b.style)}</h3><p>${esc(b.note)}</p>
        <div class="build-actions"><button class="action primary big" data-auto="all" data-uid="${r.uid}" type="button">Aplicar build completa</button>
        <button class="action" data-auto="attr" data-uid="${r.uid}" type="button" ${free > 0 ? '' : 'disabled'}>Atributos (${free})</button>
        <button class="action" data-auto="talents" data-uid="${r.uid}" type="button" ${tp > 0 ? '' : 'disabled'}>Talentos (${tp})</button>
</div>
        <p class="note">A build recomendada só usa pontos livres. Para refazer do zero, redefina atributos ou talentos antes.</p></section>
      <section><h4 class="sub-title">Distribuição de atributos</h4>${attrBars}
        <h4 class="sub-title">Equipamento</h4><p>Arma recomendada: ${wtTag(b.weapon)}<br><small class="dim">Aceita: ${b.allowedWeapons.map(w => I.weaponTypes[w].name).join(', ')}</small></p>
        <p>Conjuntos: ${b.sets.map(id => { const st = I.sets.find(x => x.id === id); return st ? `<b style="color:${st.color}">${esc(st.name)}</b>` : ''; }).join(' · ')}</p>
        <p>Afixos prioritários: ${b.affixes.map(id => { const a = I.affixes.find(x => x.id === id); return a ? `<span class="tag">${esc(D.statNames[a.stat] || a.stat)}</span>` : ''; }).join(' ')}</p></section>
      <section><h4 class="sub-title">Ordem dos talentos</h4><ol class="talent-path">${path}</ol></section></div>`;
  };

  // ---------------------------------------------------------------------------
  // CONVOCAÇÃO
  // ---------------------------------------------------------------------------
  P.collectionPanel = function(_, tab) {
    const e = this.engine, owned = this.state.collection, free = this.state.starterRolls, keys = this.state.player.keys, avail = free + keys;
    if (tab === 'owned') {
      const ctx = e.ctx();
      const list = this.filterHeroes(owned.slice(), ctx);
      return `${this.heroFilterBar(owned.length, list.length)}<div class="collection-grid">${list.map(r => { const t = e.template(r.id), sh = this.state.shards[r.id] || 0, aw = S().awakenCost(r.stars, this.state.buildings.shrine); return `<button class="collection-card rarity-${r.rarity} ${this.state.formation.includes(r.uid) ? 'active' : ''}" data-hero="${r.uid}" type="button"><div class="art"><span class="badge">${rarLabel(r.rarity)}</span>${this.state.formation.includes(r.uid) ? '<span class="in-party">EQUIPE</span>' : ''}<img src="${KT.spriteUrl(t.sprite)}" alt="" loading="lazy"></div><div class="info"><b>${esc(t.name)}</b><small>${stars(r.stars)} Nv.${r.level}</small><small>${D.classes[t.cls].icon} ${t.cls} · ${D.elements[t.el].icon} ${t.el}</small><small class="${sh >= aw.shards && r.stars < 6 ? 'txt-pink' : 'dim'}">Fragmentos ${sh}/${r.stars >= 6 ? ', ' : aw.shards}</small></div></button>`; }).join('') || '<p class="collection-empty">Nenhum herói ainda.</p>'}</div>`;
    }
    if (tab === 'catalog') {
      const ids = new Set(owned.map(r => r.id));
      return `<p class="note">${ids.size}/${D.roster.length} heróis descobertos. Heróis não descobertos aparecem em silhueta, veja todos os kits na Wiki.</p><div class="roster-grid">${D.roster.map(t => `<div class="roster-card ${ids.has(t.id) ? 'owned' : 'locked'}" data-tip="<b>${esc(t.name)}</b><br>${t.cls} · ${t.el}<br><small>${esc(t.world)}</small>"><img src="${portrait(t.id)}" alt="" loading="lazy"><b>${ids.has(t.id) ? esc(t.name) : '???'}</b></div>`).join('')}</div>`;
    }
    const R = D.heroRarities, rateTxt = b => ['legendary', 'epic', 'rare', 'common'].filter(k => b.rates[k]).map(k => `${R.find(x => x.id === k).label} ${(b.rates[k] * 100).toFixed(0)}%`).join(' · ');
    const seasonOpen = e.seasonOpen(), endsIn = Math.max(0, Date.parse(D.SEASON.ends) - e.now()), days = Math.ceil(endsIn / 86400000);
    const cls = this.summonClass || 'Executor';
    const boxCard = b => {
      if (b.pool === 'season' && !seasonOpen) return '';
      const pity = e.boxPity(b), can1 = !e.canOpenBox(b.id, 1, cls), can10 = !e.canOpenBox(b.id, 10, cls);
      const pick = b.pool === 'class' ? `<select id="summon-class" class="box-class">${Object.keys(D.classes).map(c => `<option value="${c}" ${c === cls ? 'selected' : ''}>${D.classes[c].icon} ${c}</option>`).join('')}</select>` : '';
      const boxIc = { worlds:'star', class:'swords', season:'moon', astral:'crown' }[b.id] || 'star';
      return `<article class="box-card box-${b.id}" style="--bc:${b.color}"><header><span class="box-ico"><i class="ic ic-${boxIc}"></i></span><div><b>${esc(b.name)}</b><small>${b.cost} chave${b.cost > 1 ? 's' : ''} por convocação</small></div></header>
        <p>${esc(b.text)}</p>${pick}<small class="box-rates">${rateTxt(b)}</small>
        <div class="meter"><span style="width:${Math.min(100, pity / b.pity * 100)}%"></span></div><small class="dim">Lendário garantido em ${b.pity - pity} · 10× garante um Épico</small>
        <div class="box-actions"><button class="action ${can1 ? 'pink' : ''}" data-open-box="${b.id}" data-n="1" type="button" ${can1 ? '' : 'disabled'}>Convocar 1× <small>${b.cost} ${b.cost > 1 ? 'chaves' : 'chave'}</small></button><button class="action ${can10 ? 'pink' : ''}" data-open-box="${b.id}" data-n="10" type="button" ${can10 ? '' : 'disabled'}>10× <small>${b.cost * 10} chaves</small></button></div></article>`;
    };
    const featured = D.roster.filter(h => D.SEASON.heroes.includes(h.id));
    const intro = free ? `<section class="summon-banner"><div class="summon-copy"><span class="eyebrow">CAIXA DOS MUNDOS</span><h3>Seu começo. Suas escolhas.</h3>
      <p>Você tem <b>${free} convocações gratuitas</b> iniciais. Descubra seus heróis e escolha quatro para a equipe.</p>
      <div class="box-actions"><button class="action pink big" data-open-box="worlds" data-n="${Math.min(10, free)}" type="button">Convocar ${Math.min(10, free)}× grátis</button></div></div></section>` : '';
    return `${intro}<section class="season-banner"><div><span class="eyebrow">${esc(D.SEASON.name.toUpperCase())}</span><h3>${seasonOpen ? `${featured.length} heróis novos · termina em ${days} dia${days === 1 ? '' : 's'}` : 'Temporada encerrada: os heróis dela agora saem na Caixa dos Mundos'}</h3>
        <div class="season-faces">${featured.map(h => `<span data-tip="<b>${esc(h.name)}</b><br>${h.cls} · ${h.el}"><img src="${portrait(h.id)}" alt=""><small>${esc(h.name.split(' ')[0])}</small></span>`).join('')}</div></div>
        <div class="summon-counts"><span class="pill"><b>${keys}</b> chaves</span><button class="action small" data-go="shop:crystal" type="button">Comprar chaves</button></div></section>
      <div class="box-grid">${D.BOXES.map(boxCard).join('')}</div>
      <small class="dim keys-note">Chaves: a cada 4 estágios novos, fim de caçadas, dungeons, chefes, Fenda (a cada 5 andares), diárias completas, login (dias 4 e 7), a cada 5 níveis de conta, conquistas e Loja. Repetidos viram fragmentos (+2/4/8/16) e podem melhorar a raridade do herói.</small>
      <div class="section-title"><h3>Seus heróis <span>${owned.length}</span></h3><button class="action small" data-tab-go="owned" type="button">Ver todos →</button></div>
      <div class="mini-roster">${owned.slice(-12).reverse().map(r => { const t = e.template(r.id); return `<button class="mini-hero rarity-${r.rarity}" data-hero="${r.uid}" type="button"><img src="${portrait(t.id)}" alt=""><small>${esc(t.name)}</small></button>`; }).join('') || '<p class="dim">Nenhum herói ainda.</p>'}</div>`;
  };

  // ---------------------------------------------------------------------------
  // BOLSA
  // ---------------------------------------------------------------------------
  P.equipTargetUid = function() {
    const team = this.state.formation.filter(Boolean);
    if (!this.equipTarget || !this.engine.record(this.equipTarget)) this.equipTarget = team[0] || this.state.collection[0]?.uid || null;
    return this.equipTarget;
  };
  // Bolsa: à esquerda o herói selecionado (equipamento atual e atributos), à direita os itens.
  // Trocar de herói nunca muda de aba nem perde o filtro.
  P.inventoryPanel = function() {
    const f = this.invFilter, s = this.state, e = this.engine, inv = s.inventory;
    const tab = f.tab || 'items';
    const target = this.equipTargetUid(), tr = target && e.record(target), tt = tr && e.template(tr.id);
    const team = s.formation.filter(Boolean), bench = s.collection.filter(h => !team.includes(h.uid));
    const chip = uid => { const h = e.record(uid), t = e.template(h.id); return `<button class="target-chip ${uid === target ? 'active' : ''}" data-equip-to="${uid}" type="button"><img src="${portrait(t.id)}" alt=""><span><b>${esc(t.name)}</b><small>${D.classes[t.cls].icon} ${t.cls} · Nv.${h.level}</small></span></button>`; };
    const picker = `<div class="hero-strip"><span class="etb-label">Herói</span><div class="etb-chips">${team.map(chip).join('')}${tr && !team.includes(target) ? chip(target) : ''}</div>${bench.length ? `<div class="picker-wrap"><button class="action small ${this.heroPickerOpen ? 'primary' : ''}" data-hero-picker type="button">Outros heróis (${bench.length}) ▾</button>${this.heroPickerOpen ? `<div class="hero-popover">${bench.map(h => { const t = e.template(h.id); return `<button class="pop-hero ${h.uid === target ? 'active' : ''}" data-equip-to="${h.uid}" type="button"><img src="${portrait(t.id)}" alt=""><b>${esc(t.name)}</b><small>${D.classes[t.cls].icon} Nv.${h.level}</small></button>`; }).join('')}</div>` : ''}</div>` : ''}</div>`;
    // Coluna do herói.
    let doll = '<div class="doll empty-note">Monte a equipe para equipar itens.</div>';
    if (tr) {
      const st = e.heroStats(tr), cls = D.classes[tt.cls];
      const slotsHtml = Object.entries(I.slots).map(([slot, sd]) => { const it = inv.find(x => x.uid === tr.equipped[slot]);
        return `<div class="doll-slot ${it ? `rarity-${it.rarity}` : 'empty'} ${f.slot === slot ? 'focus' : ''}"><button class="doll-pick" data-inv-slot="${f.slot === slot ? 'all' : slot}" type="button" data-tip="${it ? 'Mostrar só itens deste espaço' : 'Mostrar itens para este espaço'}">${it ? KT.itemIcon(it) : `<i>${sd.icon}</i>`}<span><small>${sd.name}</small><b class="rtext">${it ? `${esc(it.name)}${it.plus ? ` +${it.plus}` : ''}` : 'Vazio'}</b></span></button>${it ? `<button class="doll-x" data-unequip="${slot}" data-unequip-hero="${tr.uid}" type="button" data-tip="Desequipar">✕</button>` : ''}</div>`; }).join('');
      const kv = [['ATK', U.fmt(st.atk)], ['HP', U.fmt(st.maxHp)], ['DEF', U.fmt(st.def)], ['Crítico', pct(st.crit, 1)], ['Vel.', `×${st.spd.toFixed(2).replace('.', ',')}`], ['Poder', compact(e.heroPower(tr))]];
      doll = `<aside class="doll" style="--hc:${tt.color}"><div class="doll-head"><img src="${portrait(tt.id)}" alt=""><div><b>${esc(tt.name)}</b><small>${clsTag(tt.cls)} Nv.${tr.level}</small><small class="dim">Usa: ${I.allowedTypes(tr.id).filter(k => k !== 'relic').map(k => I.itemTypes[k].name).join(', ')}</small></div></div>
        <div class="doll-slots">${slotsHtml}</div><div class="doll-stats">${kv.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
        <button class="action small" data-hero="${tr.uid}" type="button">Ficha completa</button></aside>`;
    }
    const cardTotal = Object.values(s.cards).reduce((a, b) => a + b, 0);
    const inUse = inv.length - e.bagCount();
    const tabs = [['items', `Bolsa (${e.bagCount()}/${s.invCap}${inUse ? ` · ${inUse} em uso` : ''})`], ['storage', `<i class="ic ic-chest"></i> Armazém (${(s.storage || []).length}/${e.storageCap()})`, 'storage-tab'], ['cards', `Cartas${cardTotal ? ` · ${cardTotal}` : ''}`, 'cards-tab'], ['overflow', `Excedentes (${s.overflow?.length || 0})`], ['mats', 'Materiais'], ['cons', 'Consumíveis']];
    let body = '';
    if (tab === 'items' || tab === 'overflow' || tab === 'storage') {
      const src = tab === 'items' ? inv : tab === 'storage' ? (s.storage || []) : (s.overflow || []);
      const scoreCache = new Map(), scoreFor = it => { if (!scoreCache.has(it.uid)) scoreCache.set(it.uid, tr ? (e.itemGain(tr, it) ?? -9) : I.itemScore(it)); return scoreCache.get(it.uid); };
      // Todos os itens aparecem; os que estão em uso por outro herói ganham o selo "Em uso" e vão para o fim.
      let list = src.filter(it => (f.slot === 'all' || it.slot === f.slot));
      if (f.usable && tr) list = list.filter(it => I.canEquip(it, tr));
      const busyOther = it => { const o = e.ownerOf(it.uid); return o && o.uid !== target ? o : null; };
      list = list.slice().sort((a, b) => (!!busyOther(a) - !!busyOther(b)) || (f.sort === 'score' ? scoreFor(b) - scoreFor(a) : f.sort === 'level' ? b.ilvl - a.ilvl : (RORDER[a.rarity] - RORDER[b.rarity]) || b.ilvl - a.ilvl));
      src.forEach(it => { it.isNew = false; });
      const decor = D.STORAGE.decor.map(dc => { const own = !!s.decor?.[dc.id]; return `<div class="decor ${own ? 'own' : ''}"><span>${dc.icon}</span><div><b>${esc(dc.name)}</b><small>${esc(dc.text)} +${dc.slots} espaços.</small></div>${own ? '<em>Instalado</em>' : `<button class="action small" data-buy-decor="${dc.id}" type="button" ${s.player.crystal >= dc.price.crystal ? '' : 'disabled'}>${U.fmt(dc.price.crystal)} cristais</button>`}</div>`; }).join('');
      const storageHead = `<section class="storage-hero"><div class="storage-deco">${D.STORAGE.decor.filter(dc => s.decor?.[dc.id]).map(dc => `<span title="${esc(dc.name)}">${dc.icon}</span>`).join('') || '<span class="dim"><i class="ic ic-chest"></i></span>'}</div><div><span class="eyebrow">ARMAZÉM DO TANUKI · 狸の蔵</span><h3>Ponta, o guardião das prateleiras</h3>
          <p>“O que você guarda aqui eu protejo: nada é desmontado, nada é vendido sem você pedir, e não ocupa a bolsa. Daqui dá para equipar, refinar e encaixar cartas. Itens que você tira de um herói, e os drops valiosos quando a bolsa enche, vêm direto para cá.”</p>
          <div class="meter"><span style="width:${Math.min(100, (s.storage || []).length / e.storageCap() * 100)}%"></span></div><small class="dim">${(s.storage || []).length}/${e.storageCap()} espaços · ${D.STORAGE.base} de base + enfeites</small></div></section>
        <details class="decor-box"><summary>Enfeites do Armazém (cosméticos, +espaço)</summary><div class="decor-grid">${decor}</div></details>`;
      const tools = tab === 'storage' ? storageHead : tab === 'items' ? `<div class="inv-tools"><button class="action small" data-store-many="epic" type="button" data-tip="Épicos, lendários, míticos e conjuntos livres vão para o Armazém"><i class="ic ic-chest"></i> Guardar épicos+</button><details class="salvage-box"><summary>Desmontar em massa</summary><small class="dim">Nunca afeta itens equipados, trancados ou no Armazém.</small><div class="salvage-row"><button class="action small" data-salvage-all="common" type="button">Comuns</button><button class="action small" data-salvage-all="rare" type="button">Até Raros</button><button class="action small" data-salvage-all="epic" type="button">Até Épicos</button></div>
        <label>Auto-desmontar: <select id="auto-salvage"><option value="none">Nada</option><option value="common" ${s.settings.autoSalvage === 'common' ? 'selected' : ''}>Comuns</option><option value="rare" ${s.settings.autoSalvage === 'rare' ? 'selected' : ''}>Até Raros</option><option value="epic" ${s.settings.autoSalvage === 'epic' ? 'selected' : ''}>Até Épicos</option></select></label></details></div>`
        : `<div class="inv-tools"><span>Itens que chegaram com a bolsa cheia ficam aqui (até ${I.OVERFLOW_CAP}). Itens valiosos (épicos+, refinados, com carta ou melhores que os da equipe) vão para o Armazém enquanto houver espaço; épicos ou melhores nunca são desmontados. Se o baú lotar, só comuns e raros fracos viram materiais.</span><button class="action small primary" data-take-overflow type="button">Trazer para a bolsa</button><button class="action small" data-salvage-overflow="common" type="button">Desmontar comuns</button><button class="action small" data-salvage-overflow="rare" type="button">Desmontar até raros</button></div>`;
      body = `<div class="inv-top"><div class="filter-tabs">${[['all','Tudo'], ...Object.entries(I.slots).map(([k, sd]) => [k, sd.name])].map(([id, n]) => `<button class="${f.slot === id ? 'active' : ''}" data-inv-slot="${id}" type="button">${n}</button>`).join('')}</div>
        <div class="filter-tabs">${[['rarity','Raridade'], ['score', tt ? `Melhor p/ ${esc(tt.name.split(' ')[0])}` : 'Pontuação'], ['level','Nível']].map(([id, n]) => `<button class="${f.sort === id ? 'active' : ''}" data-inv-sort="${id}" type="button">${n}</button>`).join('')}</div>
        <label class="check"><input type="checkbox" id="inv-usable" ${f.usable ? 'checked' : ''}> Só o que ${tt ? esc(tt.name.split(' ')[0]) : 'o herói'} pode usar</label></div>${tools}
        <div class="inventory-grid">${list.map(it => {
          const v = I.salvageValue(it), chk = tr ? I.equipCheck(it, tr) : { ok:false }, cur = tr && inv.find(x => x.uid === tr.equipped[it.slot]), isCur = cur === it;
          const d = tr && chk.ok && !isCur && tab !== 'overflow' ? scoreFor(it) - (cur ? scoreFor(cur) : 0) : null, other = tab === 'items' && busyOther(it);
          const compare = other ? `<span class="compare busy">Em uso por ${esc(e.template(other.id).name)}</span>` : isCur ? `<span class="compare eq">✓ Equipado em ${esc(tt.name)}</span>` : !chk.ok && tr ? `<span class="compare no">✕ ${esc(chk.reason)}</span>` : d === null ? '' : `<span class="compare ${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲ melhor' : '▼ pior'} para ${esc(tt.name)}: ${d >= 0 ? '+' : '−'}${tr ? `${(Math.abs(d) * 100).toFixed(1).replace('.', ',')}% de força` : Math.abs(Math.round(d)).toLocaleString('pt-BR')}</span>`;
          const actions = tab === 'items'
            ? `<button class="action small primary" data-equip-target="${it.uid}" type="button" ${chk.ok && !isCur ? '' : 'disabled'}>${isCur ? 'Equipado' : tt ? `Equipar em ${esc(tt.name.split(' ')[0])}` : 'Equipar'}</button><button class="action small" data-lock="${it.uid}" type="button" data-tip="${it.locked ? 'Destrancar' : 'Trancar (protege de desmontagem)'}">${it.locked ? '<i class="ic ic-unlock"></i>' : '<i class="ic ic-lock"></i>'}</button><button class="action small" data-store="${it.uid}" type="button" data-tip="Guardar no Armazém (protegido, não ocupa a bolsa)" aria-label="Guardar no Armazém"><i class="ic ic-chest"></i></button><button class="action small" data-salvage="${it.uid}" type="button" ${it.locked || e.ownerOf(it.uid) ? 'disabled' : ''} data-tip="Desmontar: +${v.ore} Tamahagane, +${v.dust} Éter, +${v.gold} ouro"><i class="ic ic-rock"></i></button><button class="action small" data-forge-item="${it.uid}" type="button" data-tip="Refinar na Forja"><i class="ic ic-anvil"></i></button>${tradeMode(this) ? `<button class="action small" data-sell-item="${it.uid}" type="button" data-tip="${it.bound ? 'Item vinculado: não pode ser vendido' : 'Vender no Mercado de Jogadores'}" ${it.locked || it.bound || e.ownerOf(it.uid) ? 'disabled' : ''}><i class="ic ic-gem"></i></button>` : ''}`
            : tab === 'storage' ? `<button class="action small primary" data-equip-target="${it.uid}" type="button" ${chk.ok ? '' : 'disabled'}>${tt ? `Equipar em ${esc(tt.name.split(' ')[0])}` : 'Equipar'}</button><button class="action small" data-retrieve="${it.uid}" type="button" ${e.bagFull() ? 'disabled' : ''}>Para a bolsa</button><button class="action small" data-lock="${it.uid}" type="button" data-tip="${it.locked ? 'Destrancar' : 'Trancar'}">${it.locked ? '<i class="ic ic-unlock"></i>' : '<i class="ic ic-lock"></i>'}</button><button class="action small" data-forge-item="${it.uid}" type="button" data-tip="Refinar na Forja"><i class="ic ic-anvil"></i></button>`
            : `<button class="action small primary" data-take-overflow="${it.uid}" type="button" ${e.bagFull() ? 'disabled' : ''}>Para a bolsa</button>`;
          return this.itemCard(it, { flavor:false, compare, actions, reqFor:tr });
        }).join('') || `<p class="collection-empty">${tab === 'items' ? 'Nenhum item aqui. Derrote inimigos para encontrar equipamentos.' : tab === 'storage' ? 'O Armazém está vazio. Desequipe itens ou use o botão de baú na bolsa para guardar.' : 'O Baú de Excedentes está vazio.'}</p>`}</div>`;
    } else if (tab === 'cards') {
      body = this.cardsHtml();
    } else if (tab === 'mats') {
      const mats = [{ key:'ore', name:'Tamahagane', have:s.player.ore, text:I.materials.common.text, color:I.materials.common.color }, ...['rare', 'epic', 'legendary'].map(id => { const m = I.materials[id]; return { key:m.key, id, name:m.name, have:s.mats[m.key] || 0, text:m.text, color:m.color, trade:true }; }), { key:'dust', name:'Pó de Éter', have:s.player.dust, text:'Usado para encantar afixos e na culinária da Oficina.', color:'#9fb3ff' }];
      body = `<div class="mat-grid">${mats.map(m => `<article class="mat-card" style="--mc:${m.color}"><b>${esc(m.name)}</b><em>${U.fmt(m.have)}</em><small>${esc(m.text)}</small>${m.trade && tradeMode(this) ? `<button class="action small" data-go="shop:p2p" type="button">Negociar</button>` : ''}</article>`).join('')}</div>
        <h4 class="sub-title">Materiais de profissão</h4>${this.profMatsGrid ? this.profMatsGrid() : ''}
        <p class="note">Aço Estelar cai de elites, guardiões e chefes; Oricalco de chefes de andar e chefes; Adamantina só de chefes em Pesadelo/Inferno, Invasões Mundiais e andares profundos da Fenda. A Oficina transmuta materiais com limite diário.</p>`;
    } else {
      const cons = [['potion', 'Poção de Cura', 'Usada em combate (tecla 1).'], ['elixir', 'Elixir de Energia', 'Usado em combate (tecla 2).'], ['scroll', 'Pergaminho de Estudo', 'Concede 8% do próximo nível; máximo de 3 usos por dia.'], ...Object.entries(PR.buffs).map(([id, b]) => [id, b.name, b.text, true])];
      body = `<div class="mat-grid">${cons.map(([id, n, t, usable]) => { const until = s.buffs?.[id] || 0, left = until - this.engine.now(); return `<article class="mat-card"><b>${esc(n)}</b><em>${U.fmt(s.consumables[id] || 0)}</em><small>${esc(t)}${left > 0 ? ` <b class="txt-green">Ativo: ${fmtTime(left / 1000)}</b>` : ''}</small>${usable ? `<button class="action small ${(s.consumables[id] || 0) > 0 ? 'primary' : ''}" data-use-item="${id}" type="button" ${(s.consumables[id] || 0) > 0 ? '' : 'disabled'}>Usar</button>` : ''}</article>`; }).join('')}</div>`;
    }
    return `${picker}<div class="inv-layout">${doll}<section class="inv-main"><div class="inv-tabs">${tabs.map(([id, n, cls = '']) => `<button class="${cls} ${tab === id ? 'active' : ''}" data-inv-tab="${id}" type="button">${n}</button>`).join('')}</div>${body}</section></div>`;
  };

  // ---------------------------------------------------------------------------
  // TALENTOS
  // ---------------------------------------------------------------------------
  const TREE_Y = { 0:112, 1:300, 2:650, 3:840 }, NOTABLE_Y = 440, CAPSTONE_Y = 950;
  const svgIcon = (key, size = 26, color = 'currentColor') => `<svg class="ticon" viewBox="0 0 24 24" width="${size}" height="${size}" style="color:${color}"><path d="${PR.icons[key] || PR.icons.star}"/></svg>`;
  P.nodeEffectText = function(n, rank, t) {
    const lines = Object.entries(n.stats || {}).map(([k, v]) => statValue(k === 'skillMastery' ? 'skillMastery' : k, v * rank));
    if (n.hookText) lines.push(n.hookText(rank));
    else if (n.keystone || n.id === 's8') lines.push(n.desc);
    if (n.sig === 'ess') lines.unshift('Essência exclusiva:');
    if (n.sig === 'skill') lines.unshift(`Habilidade “${t.skill.name}”:`);
    if (n.sig === 'ult') lines.unshift(`Ultimate “${t.ult.name}”:`);
    return lines;
  };
  P.talentPanel = function(uid) {
    const e = this.engine, r = e.record(uid);
    if (!r) return '<div class="empty-state"><h3>Nenhum herói</h3><p>Convoque heróis para distribuir talentos.</p><button class="action pink" data-go="collection" type="button">Convocar</button></div>';
    const picker = `<div class="hero-picker">${(this.state.formation.filter(Boolean).length ? this.state.formation.filter(Boolean) : this.state.collection.slice(0, 8).map(h => h.uid)).map(id => { const h = e.record(id), tt = e.template(h.id), pts = e.usableTalentPoints(h); return `<button class="hero-pick ${id === uid ? 'active' : ''}" data-talent-hero="${id}" type="button"><img src="${portrait(tt.id)}" alt="">${esc(tt.name)}${pts > 0 ? `<em>${pts}</em>` : ''}</button>`; }).join('')}<button class="action small" data-go="collection:owned" type="button">Outros heróis…</button></div>`;
    return picker + this.talentTree(uid);
  };
  // Árvore de classes do herói: classe base → caminho A ou B (nível 30) → Transcendência (nível 60).
  P.classPath = function(r, t) {
    const e = this.engine, job = PR.jobs[t.cls], br = PR.branchOf(r), uid = r.uid;
    const need = (lv, cl) => `Nv. ${r.level}/${lv} · Classe ${r.classLevel || 1}/${cl}`;
    const step = (on, name, sub) => `<li class="${on ? 'on' : ''}"><b>${esc(name)}</b><small>${esc(sub)}</small></li>`;
    let action = '';
    if (!r.job) {
      const ready = r.level >= PR.JOB_LEVEL && (r.classLevel || 1) >= PR.JOB_CLASS_LEVEL, can = e.canJobChange(r);
      action = `<div class="branch-pick">${['a', 'b'].map(k => `<article class="branch ${can ? 'ready' : ''}"><small>${esc(job[k].role)}</small><b>${esc(job[k].name)}</b><p>${esc(job[k].text)}</p><em>Transcende em ${esc(job[k].trans)}</em><button class="action small ${can ? 'primary' : ''}" data-job="${uid}" data-branch="${k}" type="button" ${can ? '' : 'disabled'}>${ready ? `Escolher · ${compact(PR.jobCost.gold)} ouro · ${PR.jobCost.crystal} cristais` : need(PR.JOB_LEVEL, PR.JOB_CLASS_LEVEL)}</button></article>`).join('')}</div><small class="branch-note">A escolha é permanente. Cada caminho tem bônus próprios e uma pedra-angular exclusiva no Círculo IV.</small>`;
    } else if (r.job === 1) {
      const ready = r.level >= PR.JOB2_LEVEL && (r.classLevel || 1) >= PR.JOB2_CLASS_LEVEL, can = e.canTranscend(r);
      action = `<button class="action small ${can ? 'primary' : ''}" data-transcend="${uid}" type="button" ${can ? '' : 'disabled'}>${ready ? `Transcender em ${esc(job[br].trans)} · ${compact(PR.job2Cost.gold)} ouro · ${PR.job2Cost.crystal} cristais` : `Transcendência: ${need(PR.JOB2_LEVEL, PR.JOB2_CLASS_LEVEL)}`}</button>`;
    }
    return `<div class="class-path"><ol>${step(true, t.cls, 'Classe base')}${step(r.job >= 1, r.job ? job[br].name : `${job.a.name} ou ${job.b.name}`, `Nível ${PR.JOB_LEVEL} · +10% HP/ATK/DEF · Círculo III`)}${step(r.job >= 2, r.job ? job[br].trans : 'Transcendência', `Nível ${PR.JOB2_LEVEL} · +10% HP/ATK/DEF · Círculo IV`)}</ol>${action}</div>`;
  };
  P.talentTree = function(uid) {
    const e = this.engine, r = e.record(uid), t = e.template(r.id), tree = PR.treeFor(t.id), c = D.classes[t.cls];
    const pts = e.heroTalentPoints(r), spent = e.treeSpent(r), job = PR.jobs[t.cls];
    const pos = n => ({ x:n.x, y:n.notable ? NOTABLE_Y : n.capstone ? CAPSTONE_Y : TREE_Y[n.tier] });
    // Árvore no estilo Sumi: ligações em pincelada curva; o formato do selo diz o tipo do nó (redondo = atributo,
    // quadrado = efeito, octógono = notável, selo vermelho = pedra-chave, anel duplo = pedra-angular, retrato = do herói).
    const links = [];
    tree.forEach(n => n.req.forEach(q => q.split('|').forEach(id => { const o = tree.find(x => x.id === id); if (!o) return; const A = pos(o), B = pos(n); const on = (r.talents[id] || 0) && (r.talents[n.id] || 0);
      const my = (A.y + B.y) / 2, bend = (B.x - A.x) * .18;
      links.push(`<path d="M${A.x} ${A.y} C ${A.x + bend} ${my}, ${B.x - bend} ${my}, ${B.x} ${B.y}" class="tlink ${on ? 'on' : (r.talents[id] || 0) ? 'avail' : ''}"/>`); })));
    const sel = tree.find(n => n.id === this.view.node) || tree[0];
    const octo = rr => Array.from({ length:8 }, (_, k) => { const a = Math.PI / 8 + k * Math.PI / 4; return `${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)}`; }).join(' ');
    const nodes = tree.map(n => {
      const rank = r.talents[n.id] || 0, st = e.talentState(r, n.id), P2 = pos(n);
      const state = rank >= n.max ? 'max' : rank ? 'some' : st.ok ? 'avail' : 'locked';
      const kind = n.sig ? 'sig' : n.keystone ? 'keystone' : n.capstone ? 'capstone' : n.notable ? 'notable' : n.hook ? 'effect' : 'minor';
      const rad = { keystone:40, capstone:40, notable:36, sig:34, effect:29, minor:26 }[kind];
      const shape = kind === 'effect' || kind === 'keystone' ? `<rect class="seal" x="${-rad}" y="${-rad}" width="${rad * 2}" height="${rad * 2}" rx="${kind === 'keystone' ? 8 : 10}"/>`
        : kind === 'notable' ? `<polygon class="seal" points="${octo(rad)}"/>`
        : kind === 'capstone' ? `<circle class="seal" r="${rad}"/><circle class="seal-inner" r="${rad - 7}"/>`
        : `<circle class="seal" r="${rad}"/>`;
      const pips = n.max > 1 ? `<g class="pips" transform="translate(0,${rad + 10})">${Array.from({ length:n.max }, (_, k) => `<circle cx="${(k - (n.max - 1) / 2) * 11}" r="3.6" class="${k < rank ? 'on' : ''}"/>`).join('')}</g>` : '';
      return `<g class="tnode ${state} k-${kind} ${n.branch && n.branch !== PR.branchOf(r) ? 'other-branch' : ''} ${sel.id === n.id ? 'selected' : ''}" data-talent-node="${n.id}" transform="translate(${P2.x},${P2.y})">
        <circle class="halo" r="${rad + 9}"/>${shape}
        ${n.sig ? `<clipPath id="clip-${n.id}"><circle r="${rad - 4}"/></clipPath><image href="${portrait(t.id)}" x="${-rad + 4}" y="${-rad + 4}" width="${(rad - 4) * 2}" height="${(rad - 4) * 2}" clip-path="url(#clip-${n.id})" class="sig-art"/><circle class="sig-ring" r="${rad - 3}"/>` : `<g transform="translate(-15,-15) scale(1.25)" class="glyph"><path d="${PR.icons[n.icon]}"/></g>`}
        ${pips}
        <text y="${rad + (n.max > 1 ? 32 : 24)}" class="lbl">${esc(n.sig === 'skill' ? t.skill.name : n.sig === 'ult' ? t.ult.name : n.name)}</text></g>`;
    }).join('');
    const jb = job[PR.branchOf(r)];
    const bandLocked = i => (i === 2 && !r.job) || (i === 3 && (r.job || 0) < 2) || spent < PR.TIER_REQ[i];
    const bandTxt = i => i === 0 ? 'livre' : i === 1 ? `${PR.TIER_REQ[1]} pontos investidos` : i === 2 ? `classe avançada + ${PR.TIER_REQ[2]} pontos` : `Transcendência (nível ${PR.JOB2_LEVEL}) + ${PR.TIER_REQ[3]} pontos`;
    const BY = [14, 214, 572, 762], BH = [188, 346, 178, 276];
    const bands = [0, 1, 2, 3].map(i => `<rect x="10" y="${BY[i]}" width="940" height="${BH[i]}" rx="12" class="band ${bandLocked(i) ? 'locked' : 'open'}"/>`).join('');
    // Título da faixa por cima das ligações, com fundo próprio (as linhas não cortam o texto).
    const bandLabels = [0, 1, 2, 3].map(i => { const txt = `CÍRCULO ${['I', 'II', 'III', 'IV'][i]} · ${bandTxt(i)}${bandLocked(i) ? ' · bloqueado' : ''}`; return `<g class="band-tag ${bandLocked(i) ? 'locked' : ''}" transform="translate(24,${BY[i] + 12})"><rect width="${58 + txt.length * 7.2}" height="30" rx="7"/><text x="14" y="21" class="band-num">${['壱', '弐', '参', '四'][i]}</text><text x="42" y="20" class="band-sub">${txt}</text></g>`; }).join('');
    const srank = r.talents[sel.id] || 0, sst = e.talentState(r, sel.id);
    const cur = srank ? this.nodeEffectText(sel, srank, t) : [], next = srank < sel.max ? this.nodeEffectText(sel, srank + 1, t) : [];
    const reqs = [];
    if (sel.tier > 0) reqs.push([spent >= PR.TIER_REQ[sel.tier], `${PR.TIER_REQ[sel.tier]} pontos investidos nesta árvore (${spent})`]);
    if (sel.tier === 2) reqs.push([!!r.job, 'Classe avançada (nível 30)']);
    if (sel.tier === 3) reqs.push([(r.job || 0) >= 2, `Transcendência (nível ${PR.JOB2_LEVEL})`]);
    if (sel.branch) reqs.push([sel.branch === PR.branchOf(r), `Caminho: ${job[sel.branch].name} → ${job[sel.branch].trans}`]);
    sel.req.forEach(q => reqs.push([q.split('|').some(x => (r.talents[x] || 0) > 0), `Ter ${q.split('|').map(x => tree.find(n => n.id === x)?.name || x).join(' ou ')}`]));
    const detail = `<aside class="tdetail" style="--nc:${sel.keystone ? '#c9472d' : sel.notable ? '#ffcf6b' : c.color}">
      <div class="tdetail-head"><span class="tdetail-ico">${svgIcon(sel.icon, 34)}</span><div><small>${sel.keystone ? 'PEDRA-CHAVE' : sel.capstone ? 'PEDRA-ANGULAR' : sel.notable ? 'NOTÁVEL' : sel.sig ? 'EXCLUSIVO DO HERÓI' : `CÍRCULO ${['I', 'II', 'III', 'IV'][sel.tier]}`}</small><h4>${esc(sel.sig === 'skill' ? `Maestria: ${t.skill.name}` : sel.sig === 'ult' ? `Ápice: ${t.ult.name}` : sel.sig === 'ess' ? `Essência: ${sel.name}` : sel.name)}</h4><span class="rank-pill">Rank ${srank}/${sel.max}</span></div></div>
      <p>${esc(sel.desc)}</p>
      ${cur.length ? `<div class="teff"><b>Efeito atual</b>${cur.map(l => `<span>${l}</span>`).join('')}</div>` : ''}
      ${next.length ? `<div class="teff next"><b>${srank ? 'Próximo rank' : 'Ao aprender'}</b>${next.map(l => `<span>${l}</span>`).join('')}</div>` : '<div class="teff max"><b>Rank máximo alcançado</b></div>'}
      ${reqs.length ? `<ul class="treqs">${reqs.map(([ok2, txt]) => `<li class="${ok2 ? 'ok' : 'no'}">${ok2 ? '✓' : '✕'} ${esc(txt)}</li>`).join('')}</ul>` : ''}
      <button class="action ${sst.ok ? 'primary' : ''} big" data-learn="${sel.id}" type="button" ${sst.ok ? '' : 'disabled'}>${sst.ok ? 'Aprender (1 ponto)' : esc(sst.reason || 'Indisponível')}</button>
    </aside>`;
    const jobBox = this.classPath(r, t);
    return `<div class="tree-top"><div class="tree-hero"><img src="${portrait(t.id)}" alt=""><div><b>${esc(t.name)}</b><small>${clsTag(t.cls)} Nv. ${r.level}</small></div></div>
      <div class="tree-points"><span class="pts-big ${pts > 0 ? 'has' : ''}">${pts} ponto(s) livre(s)</span><small>${spent} investidos · 1 ponto por nível${r.job ? ` · +${5 * Math.min(2, r.job)} da árvore de classes` : ''}</small></div>
      ${jobBox}
      <button class="action small primary" data-auto="talents" data-uid="${uid}" type="button" ${pts > 0 ? '' : 'disabled'} data-tip="Aprende os talentos na ordem da build recomendada deste herói.">Build recomendada</button>
      <button class="action small" data-hero-talent-reset="${uid}" type="button" ${spent ? '' : 'disabled'}>${this.state.freeRespec ? `Redefinir (grátis ×${this.state.freeRespec})` : `Redefinir (${compact(e.talentResetCost(r))} ouro)`}</button></div>
      <div class="talent-legend"><span><i class="lg-shape round"></i>Atributo</span><span><i class="lg-shape square"></i>Efeito</span><span><i class="lg-shape octo"></i>Notável</span><span><i class="lg-shape key"></i>Pedra-chave</span><span><i class="lg-learned"></i>Aprendido</span><span><i class="lg-available"></i>Disponível</span><small>Toque em um talento para ver efeitos e requisitos.</small></div>
      <div class="tree-layout"><div class="talent-tree"><svg viewBox="0 0 960 1050" preserveAspectRatio="xMidYMid meet">${bands}${links.join('')}${bandLabels}${nodes}</svg></div>${detail}</div>`;
  };

  // ---------------------------------------------------------------------------
  // CIDADE
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // CARTAS (Bolsa) e CASA DO TIME (Cidade)
  // ---------------------------------------------------------------------------
  const cardStatsTxt = cd => Object.entries(cd.stats).map(([k, v]) => statValue(k, v)).join(', ');
  const cardTile = (cd, { n = 0, tag = 'div', attrs = '', missing = false, note = '' } = {}) => `<${tag} class="card-tile tier-${cd.tier} ${cd.mvp ? 'mvp' : ''} ${missing ? 'missing' : ''}" style="--tc:${cd.color}" ${attrs} ${tag === 'button' ? 'type="button"' : ''}>
    <span class="card-art"><img src="${KT.spriteUrl(cd.sprite)}" alt="" loading="lazy"></span><b>${missing ? '???' : esc(cd.name)}</b><small class="tier">${cd.tierLabel}</small>
    <small>${missing ? `Drop de ${esc(D.enemies[cd.enemy].name.split(',')[0])}` : cardStatsTxt(cd)}</small>${!missing && cd.effect ? `<small class="fx">✦ ${esc(cd.effect)}</small>` : ''}${note ? `<small class="card-note">${note}</small>` : ''}${n ? `<em>×${n}</em>` : ''}</${tag}>`;
  P.cardsHtml = function() {
    const e = this.engine, s = this.state;
    const owned = I.cards.filter(cd => (s.cards[cd.id] || 0) > 0), album = e.albumCount();
    const sel = s.inventory.find(x => x.uid === this.cardSel && (x.cards || []).length) || null;
    const socketable = s.inventory.filter(x => (x.cards || []).length).sort((a, b) => (!!e.ownerOf(b.uid) - !!e.ownerOf(a.uid)) || I.itemScore(b) - I.itemScore(a));
    let right = '<p class="empty-note">Escolha um equipamento com slots para encaixar cartas.</p>';
    if (sel) right = `${this.itemCard(sel)}<div class="forge-box"><h4>Slots</h4>${sel.cards.map((cid, i) => { const cd = cid && I.cardById(cid); return `<div class="ench-row"><span>Slot ${i + 1}: ${cd ? `<b>${esc(cd.name)}</b>: ${cardStatsTxt(cd)}` : '<i class="dim">vazio</i>'}</span>${cd ? `<button class="action small" data-unsocket="${sel.uid}" data-idx="${i}" type="button" ${s.player.crystal >= 30 ? '' : 'disabled'}>Remover (30 cristais)</button>` : ''}</div>`; }).join('')}
      ${sel.cards.some(x => !x) ? `<h4 class="sub-title">Encaixar carta</h4><div class="card-grid">${owned.map(cd => cardTile(cd, { n:s.cards[cd.id], tag:'button', attrs:`data-socket="${sel.uid}" data-card="${cd.id}"` })).join('') || '<p class="dim">Nenhuma carta livre.</p>'}</div>` : '<p class="note">Todos os slots estão ocupados.</p>'}</div>`;
    const next = D.HOUSE.album.find(m => album < m.n);
    return `<section class="cards-hero"><div><span class="eyebrow">COLEÇÃO DE CARTAS</span><h3>${owned.reduce((a, cd) => a + s.cards[cd.id], 0)} carta(s) livre(s) · Álbum ${album}/${I.cards.length}</h3>
        <p>Cartas <b>não ocupam espaço</b> na bolsa. Encaixe nos slots dos equipamentos ou exponha na <b>Casa do Time</b> para fortalecer a equipe inteira.${next ? ` Próximo marco do Álbum: <b>${next.n}</b> cartas diferentes (${esc(next.name)}).` : ' Álbum completo!'}</p></div>
        <div class="box-actions"><button class="action pink" data-go="city:house" type="button"><i class="ic ic-lantern"></i> Casa do Time</button><button class="action" data-go="wiki:cards" type="button">Todas as cartas</button></div></section>
      <h4 class="sub-title">Suas cartas</h4><div class="card-grid">${owned.map(cd => cardTile(cd, { n:s.cards[cd.id] })).join('') || '<p class="collection-empty">Você ainda não tem cartas. Todo monstro pode deixar a sua, mas é raríssimo: cartas valem muito no Mercado.</p>'}</div>
      <h4 class="sub-title">Encaixar em equipamentos</h4><p class="note">Itens raros ou melhores podem ter 1 ou 2 slots. Encaixar é permanente; remover custa 30 cristais e devolve a carta.</p>
      <div class="split"><div class="pick-list">${socketable.map(it => `<button class="pick-item rarity-${it.rarity} ${it.uid === this.cardSel ? 'selected' : ''}" data-card-item="${it.uid}" type="button">${KT.itemIcon(it)}<span><b class="rtext">${esc(it.name)}</b><small>${it.cards.filter(Boolean).length}/${it.cards.length} slots${e.ownerOf(it.uid) ? ` · em ${esc(e.template(e.ownerOf(it.uid).id).name)}` : ''}</small></span></button>`).join('') || '<p class="dim">Nenhum item com slots ainda.</p>'}</div><div>${right}</div></div>`;
  };
  P.houseHtml = function(bHead) {
    const e = this.engine, s = this.state, h = s.house || { display:[] }, slots = e.houseSlots(), album = e.albumCount();
    const free = I.cards.filter(cd => (s.cards[cd.id] || 0) > 0 && !h.display.includes(cd.id));
    const pick = Number.isInteger(this.houseSlot) && this.houseSlot < slots ? this.houseSlot : null;
    const bonus = S().houseStats(s), bonusTxt = Object.entries(bonus).filter(([, v]) => v).map(([k, v]) => statValue(k, v)).join(' · ');
    const frames = Array.from({ length:6 }, (_, i) => {
      const id = h.display[i], cd = id && I.cardById(id), locked = i >= slots;
      if (locked) return `<div class="gallery-frame locked"><span><i class="ic ic-lock"></i></span><small>Casa nível ${i * 2}</small></div>`;
      return `<div class="gallery-frame ${cd ? 'filled' : ''} ${pick === i ? 'picking' : ''}">${cd ? `${cardTile(cd, { note:`Equipe: ${Object.entries(cd.stats).map(([k, v]) => statValue(k, v * D.HOUSE.displayShare)).join(', ')}` })}<div class="frame-actions"><button class="action small" data-house-slot="${i}" type="button">Trocar</button><button class="action small" data-remove-display="${i}" type="button">Guardar</button></div>` : `<button class="frame-empty" data-house-slot="${i}" type="button"><b>＋</b><small>Expor carta</small></button>`}</div>`;
    }).join('');
    const milestones = D.HOUSE.album.map(m => `<li class="${album >= m.n ? 'done' : ''}"><b>${m.n}</b><span>${esc(m.name)}</span><small>${Object.entries(m.stats).map(([k, v]) => statValue(k, v)).join(' · ')}</small></li>`).join('');
    const par = s.paragon || { lv:0, xp:0 }, parNext = D.PARAGON.next(par.lv);
    return `${bHead('house')}
      <section class="house-hero"><div><span class="eyebrow">LAR DA EQUIPE</span><h3>Casa do Time</h3><p>Onde os heróis descansam entre as caçadas. Cartas expostas na <b>Galeria</b> emprestam ${Math.round(D.HOUSE.displayShare * 100)}% dos seus atributos a toda a equipe; o <b>Álbum</b> guarda cada carta que você já teve e dá bônus permanentes.</p>
        <div class="house-kpis"><span><b>${slots}</b>espaços na Galeria</span><span><b>${album}/${I.cards.length}</b>cartas no Álbum</span><span><b>${par.lv}</b>Paragão</span></div>
        ${bonusTxt ? `<p class="house-bonus">Bônus da casa para a equipe: <b>${bonusTxt}</b></p>` : ''}</div></section>
      <h4 class="sub-title">Galeria</h4><div class="gallery">${frames}</div>
      ${pick !== null ? `<div class="gallery-pick"><h4 class="sub-title">Escolha a carta para o espaço ${pick + 1}</h4><div class="card-grid">${free.map(cd => cardTile(cd, { n:s.cards[cd.id], tag:'button', attrs:`data-display-card="${cd.id}" data-gallery-slot="${pick}"` })).join('') || '<p class="dim">Nenhuma carta livre. Cartas encaixadas em itens ou já expostas não aparecem aqui.</p>'}</div></div>` : ''}
      <h4 class="sub-title">Álbum de cartas</h4><ol class="album-track">${milestones}</ol>
      <h4 class="sub-title">Paragão</h4><div class="panel paragon-box"><p>No nível 100, a EXP excedente alimenta o <b>Paragão</b> da conta. Cada nível dá <b>+${(D.PARAGON.per * 100).toFixed(1).replace('.', ',')}%</b> de ATK, HP e DEF à equipe (até ${D.PARAGON.cap}).</p><div class="meter"><span style="width:${Math.min(100, par.xp / parNext * 100)}%"></span></div><small>Nível ${par.lv} · ${compact(par.xp)} / ${compact(parNext)} EXP</small></div>`;
  };

  P.cityPanel = function(_, tab) {
    const e = this.engine, s = this.state, b = s.buildings;
    const bHead = id => { const bd = D.buildings[id], lv = b[id], cost = e.buildingCost(id), cap = e.buildingCap(); return `<div class="building-head"><span class="b-icon">${bd.icon}</span><div><b>${bd.name} · Nível ${lv}</b><small>${bd.desc}</small></div><button class="action ${s.player.gold >= cost && lv < cap ? 'primary' : ''}" data-build="${id}" type="button" ${lv >= cap ? 'disabled' : ''}>${lv >= cap ? `Máx. (conta nv ${(lv - 1) * 3 + 3} libera)` : `Melhorar · ${compact(cost)} ouro`}</button></div>`; };
    if (tab === 'forge') {
      const sel = e.findItem(this.forgeSel);
      const inStore = it => (s.storage || []).includes(it);
      const equippedFirst = s.inventory.concat(s.storage || []).filter(it => !it.inOverflow).sort((a, b2) => (!!e.ownerOf(b2.uid) - !!e.ownerOf(a.uid)) || (b2.plus || 0) - (a.plus || 0) || I.itemScore(b2) - I.itemScore(a));
      let right = '<p class="empty-note">Selecione um item à esquerda para refinar. Itens do Armazém também podem ser refinados.</p>';
      if (sel) {
        const max = I.maxPlus(b.forge), have = k => k === 'ore' ? s.player.ore : (s.mats?.[k] || 0);
        const risk = { none:'A falha não tira nível.', regress:'A falha faz o item voltar 1 nível.', break:'<b>A falha QUEBRA o item</b> (ele some).' };
        const mats = Object.values(I.materials).map(m => ({ m, c:I.upgradeCost(sel, b.forge, m.id) }));
        const avail = mats.filter(x => x.c.allowed);
        const pick = avail.find(x => x.m.id === this.forgeMat) || avail.find(x => have(x.c.key) >= x.c.qty && x.c.onFail !== 'break') || avail[0];
        if (pick) this.forgeMat = pick.m.id;
        const matBtns = mats.map(({ m, c }) => `<button class="mat-pick ${pick?.m.id === m.id ? 'active' : ''}" data-forge-mat="${m.id}" type="button" ${c.allowed ? '' : 'disabled'} style="--mc:${m.color}"><b>${esc(m.name)}</b><small>${c.allowed ? `${c.qty} de ${U.fmt(have(c.key))} · ${c.onFail === 'none' ? 'sem risco' : c.onFail === 'regress' ? 'pode voltar' : 'pode quebrar'}` : `até +${m.maxTarget}`}</small></button>`).join('');
        const c = pick?.c, ok = c && s.player.gold >= c.gold && have(c.key) >= c.qty && sel.plus < max;
        right = `${this.itemCard(sel, { flavor:true })}<div class="forge-box"><h4>Refinar para +${(sel.plus || 0) + 1}${inStore(sel) ? ' <small class="dim">(no Armazém)</small>' : ''}</h4><p>Cada nível aumenta o atributo principal e os afixos. Refino alto é raro, caro e valorizado no Mercado.</p>
          <div class="forge-mats">${matBtns}</div>
          ${c ? `<div class="cost-line"><span class="${s.player.gold >= c.gold ? 'cost-ok' : 'cost-bad'}">${U.fmt(c.gold)} ouro</span><span class="${have(c.key) >= c.qty ? 'cost-ok' : 'cost-bad'}">${c.qty} ${esc(I.materials[c.mat].name)}</span><span>Chance ${pct(c.chance)}</span></div>
          ${c.chance < 1 ? `<p class="note ${c.onFail === 'break' ? 'warn' : ''}">${risk[c.onFail]}</p>` : ''}
          <button class="action primary big" data-upgrade="${sel.uid}" data-mat="${c.mat}" ${c.onFail === 'break' && c.chance < 1 ? `data-confirm="Com ${esc(I.materials[c.mat].name)} a falha QUEBRA ${esc(sel.name)}. Chance de sucesso: ${pct(c.chance)}. Continuar?"` : ''} type="button" ${ok ? '' : 'disabled'}>${sel.plus >= max ? `Limite +${max} (melhore a Forja)` : 'Refinar'}</button>` : '<p class="note">Nenhum material refina este item para o próximo nível.</p>'}</div>`;
      }
      return `${bHead('forge')}<div class="split"><div class="pick-list">${equippedFirst.map(it => `<button class="pick-item rarity-${it.rarity} ${it.uid === this.forgeSel ? 'selected' : ''}" data-forge-item="${it.uid}" type="button">${KT.itemIcon(it)}<span><b class="rtext">${esc(it.name)}${it.plus ? ` +${it.plus}` : ''}</b><small>${e.ownerOf(it.uid) ? `em ${esc(e.template(e.ownerOf(it.uid).id).name)}` : inStore(it) ? `Armazém · Nv.${it.ilvl}` : `Nv.${it.ilvl}`}</small></span></button>`).join('') || '<p class="dim">Bolsa vazia.</p>'}</div><div>${right}</div></div>`;
    }
    if (tab === 'workshop') {
      const sel = s.inventory.find(x => x.uid === this.forgeSel && x.affixes?.length) || null;
      const matName = k => ({ gold:'ouro', dust:'Éter', ore:'Tamahagane', star:'Aço Estelar', ori:'Oricalco', adam:'Adamantina' }[k] || k);
      const recipes = e.recipes().map(r => ({ ...r, can:Object.entries(r.cost).every(([k, v]) => e.have(k) >= v) && (!r.limit || e.craftedToday(r.id) < r.limit) }));
      let enchant = '<p class="empty-note">Selecione um item com afixos para encantar.</p>';
      if (sel) { const c = I.enchantCost(sel, b.workshop); enchant = `${this.itemCard(sel)}<div class="forge-box"><h4>Encantar</h4><p>Re-sorteia um afixo (tipo e valor). Custo: <b>${c.dust} Éter</b> + <b>${U.fmt(c.gold)} ouro</b>.</p>${sel.affixes.map((a, i) => `<div class="ench-row"><span>${statValue(a.stat, a.v)}</span><button class="action small" data-enchant="${sel.uid}" data-aff="${i}" type="button" ${s.player.dust >= c.dust && s.player.gold >= c.gold ? '' : 'disabled'}>Re-sortear</button></div>`).join('')}</div>`; }
      return `${bHead('workshop')}<h4 class="sub-title">Culinária, poções e transmutação</h4><div class="recipe-grid">${recipes.map(r => `<div class="craft-row"><div><b>${esc(r.name)}</b><small>${Object.entries(r.cost).map(([k, v]) => `${U.fmt(v)} ${matName(k)}`).join(' · ')}${r.limit ? ` · hoje ${e.craftedToday(r.id)}/${r.limit}` : ''}</small></div><button class="action ${r.can ? 'primary' : ''}" data-craft="${r.id}" type="button" ${r.can ? '' : 'disabled'}>Criar</button></div>`).join('')}</div>
        <h4 class="sub-title">Encantamento</h4><div class="split"><div class="pick-list">${s.inventory.filter(x => x.affixes?.length).map(it => `<button class="pick-item rarity-${it.rarity} ${it.uid === this.forgeSel ? 'selected' : ''}" data-forge-item="${it.uid}" type="button">${KT.itemIcon(it)}<span><b class="rtext">${esc(it.name)}</b><small>${it.affixes.length} afixo(s)</small></span></button>`).join('') || '<p class="dim">Nenhum item com afixos.</p>'}</div><div>${enchant}</div></div>`;
    }
    if (tab === 'house') return this.houseHtml(bHead);
    if (tab === 'prof') return this.profHtml();
    if (tab === 'dojo') {
      const cap = PR.trainingCap(b.dojo);
      return `${bHead('dojo')}<p class="note">Treino da equipe: melhorias permanentes para <b>todos</b> os heróis. Limite atual: nível ${cap} de ${PR.TRAIN_MAX} (melhore o Dojo para aumentar). Os 20 primeiros níveis rendem o bônus cheio; do 21 em diante, metade.${s.dojoRefund ? ` <b>O Dojo foi reformado: os níveis acima do novo teto devolveram ${compact(s.dojoRefund)} de ouro.</b>` : ''} Só os heróis da equipe ganham EXP em combate; os do banco evoluem em <b>Expedições</b>.</p>
        <div class="train-grid">${Object.entries(PR.training).map(([k, tr]) => { const lv = s.training[k] || 0, cost = PR.trainingCost(lv); return `<div class="train-card"><b>${tr.name}</b><small>${tr.text}</small><div class="meter"><span style="width:${lv / cap * 100}%"></span></div><small>Nível ${lv}/${cap} · atual ${statValue(tr.stat, PR.trainingBonus(k, lv))}</small><button class="action ${s.player.gold >= cost && lv < cap ? 'primary' : ''}" data-train="${k}" type="button" ${lv >= cap ? 'disabled' : ''}>${lv >= cap ? 'Limite' : `Treinar · ${compact(cost)} ouro`}</button></div>`; }).join('')}</div>`;
    }
    if (tab === 'shrine') {
      const list = this.state.collection.slice().sort((a, b2) => ((this.state.shards[b2.id] || 0) - (this.state.shards[a.id] || 0)));
      return `${bHead('shrine')}<div class="box-actions"><button class="action pink" data-go="collection" type="button">✦ Ir para Convocação</button><button class="action" data-buy="key1" type="button" ${s.player.crystal >= 60 ? '' : 'disabled'}>Trocar 60 cristais → 1 chave</button></div>
        <h4 class="sub-title">Qualidade dos heróis</h4><p class="note">Fragmentos elevam a qualidade em ★. Cada ★ dá +12% em HP/ATK/DEF; todos os heróis têm limite de nível 100.</p>
        <div class="roster-list">${list.map(r => { const t = this.engine.template(r.id), c = S().awakenCost(r.stars, b.shrine), sh = this.state.shards[r.id] || 0, ok = r.stars < 6 && sh >= c.shards && s.player.gold >= c.gold; return `<article class="roster-row rarity-${r.rarity}"><img src="${portrait(t.id)}" alt=""><div><b>${esc(t.name)} ${stars(r.stars)}</b><small>Fragmentos ${sh}/${r.stars >= 6 ? ', ' : c.shards} · ${compact(c.gold)} ouro</small></div><button class="action small ${ok ? 'pink' : ''}" data-awaken="${r.uid}" type="button" ${ok ? '' : 'disabled'}>${r.stars >= 6 ? 'Máximo' : 'Elevar qualidade'}</button></article>`; }).join('')}</div>`;
    }
    if (tab === 'guild') {
      return `${bHead('guild')}<p class="note">Bônus atual de ouro em combate: <b>+${(b.guild - 1) * 3}%</b>. Contratos renovam ao serem resgatados.</p>${this.contractsHtml()}`;
    }
    const cityLevel = Object.values(b).reduce((sum, lv) => sum + lv, 0), ready = Object.keys(D.buildings).filter(id => b[id] < e.buildingCap() && s.player.gold >= e.buildingCost(id)).length;
    return `<section class="city-overview"><span class="eyebrow">CAPITAL EM EXPANSÃO</span><h3>Grande Tsukimori</h3><p>Escolha um distrito no mapa ou desenvolva suas construções para fortalecer toda a conta.</p><div class="city-kpis"><span><b>${cityLevel}</b>níveis urbanos</span><span><b>${ready}</b>melhorias disponíveis</span><span><b>${s.collection.length}</b>heróis residentes</span></div></section><div class="building-list">${Object.keys(D.buildings).map(id => bHead(id)).join('')}</div><p class="note">O nível máximo das construções é ${e.buildingCap()} (aumenta 1 a cada 3 níveis de conta).</p>`;
  };
  P.contractsHtml = function() {
    return `<div class="grid2">${this.state.contracts.map((c, i) => { const def = D.contracts.find(d => d.id === c.id), done = c.progress >= c.n; return `<article class="panel ${done ? 'done' : ''}"><span class="eyebrow">${['Simples','Médio','Difícil'][c.tier]}</span><h3>${def.title}</h3><p>${def.text.replace('{n}', c.n)}</p><div class="meter"><span style="width:${c.progress / c.n * 100}%"></span></div><p>${c.progress}/${c.n}</p><div class="guide-reward">${this.rewardPills(this.engine.contractReward(c))}</div><button class="action ${done ? 'primary' : ''}" data-claim-contract="${i}" type="button" ${done ? '' : 'disabled'}>${done ? 'Resgatar' : 'Em andamento'}</button></article>`; }).join('')}</div>`;
  };

  // ---------------------------------------------------------------------------
  // RANKING
  // ---------------------------------------------------------------------------
  P.rankingPanel = function(_, tab) {
    if (this.session?.mode !== 'cloud' && this.session?.mode !== 'neon') return '<div class="empty-state"><h3>Ranking online</h3><p>O ranking fica disponível quando o jogo roda no servidor com uma conta. No modo offline o progresso fica só neste navegador.</p></div>';
    const cache = this.rankCache?.[tab];
    if (!cache || Date.now() - cache.at > 30_000) {
      this.rankLoading = this.rankLoading || {};
      if (!this.rankLoading[tab]) {
        this.rankLoading[tab] = (async () => {
          if (this.session.mode === 'neon') {
            this.engine.save();
            if (!await KT.Neon.flush()) return { ok:false, error:'Não foi possível sincronizar seu save antes de atualizar o ranking.' };
            return KT.Neon.leaderboard(tab);
          }
          return KT.Net.leaderboard(tab);
        })().then(r => { this.rankCache = { ...(this.rankCache || {}), [tab]:{ at:Date.now(), data:r } }; if (this.view.panel === 'ranking' && this.view.tab === tab) this.refreshPanel(); return r; }).finally(() => { this.rankLoading[tab] = null; });
      }
      if (!cache) return '<div class="empty-state"><p>Carregando ranking…</p></div>';
    }
    const r = cache.data; if (!r.ok) return `<div class="empty-state"><p>Não foi possível carregar o ranking: ${esc(r.error)}</p></div>`;
    const col = { power:['power', 'Poder', v => compact(v)], bosses:['boss_kills', 'Chefes vencidos', v => U.fmt(v)], stage:['best_stage', 'Estágios vencidos', v => U.fmt(v)], rift:['rift_best', 'Andar da Fenda', v => `Andar ${U.fmt(v)}`] }[tab] || ['power', 'Poder', v => compact(v)];
    const meId = String(this.session.user?.id || ''), rows = r.rows || [], top = Number(rows[0]?.[col[0]]) || 1;
    const teamOf = row => { try { return JSON.parse(row.team || '[]').filter(h => this.engine.template(h.id)); } catch (_) { return []; } };
    const name = row => row.id && this.session.mode === 'cloud' ? `<button class="linkish" data-seller="${row.id}" type="button">${esc(row.name)}</button>` : esc(row.name);
    const minis = team => `<span class="rk-team">${team.map(h => `<img src="${portrait(h.id)}" alt="" title="${esc(this.engine.template(h.id).name)} ${'★'.repeat(h.stars)}" loading="lazy">`).join('')}</span>`;
    const podium = rows.slice(0, 3).map((row, i) => { const team = teamOf(row), lead = team[0]; return `<article class="rk-pod p${i + 1} ${(row.me || String(row.id) === meId) ? 'me' : ''}">
        <span class="rk-medal">${i + 1}</span>
        <div class="rk-lead" ${lead ? `style="background-image:url('${portrait(lead.id)}')"` : ''}>${lead ? '' : ic('crown')}</div>
        <b class="rk-name">${name(row)}</b><small>Nv. ${row.account_level} de conta</small>
        <strong class="rk-val">${col[2](row[col[0]])}</strong>${minis(team)}</article>`; }).join('');
    const myIdx = rows.findIndex(row => (row.me || String(row.id) === meId));
    const mine = myIdx >= 0 ? { rank:myIdx + 1, row:rows[myIdx] } : null;
    const meBox = mine ? `<div class="rank-me"><span>Sua posição em ${col[1].toLowerCase()}</span><b>#${mine.rank}</b><small>${esc(mine.row.name)} · ${col[2](mine.row[col[0]])}</small></div>`
      : r.me ? `<div class="rank-me"><span>Sua posição por poder</span><b>#${r.me.rank}</b><small>${esc(r.me.name)} · ${compact(r.me.power)} de poder${tab !== 'power' ? ' · fora do top 50 nesta categoria' : ''}</small></div>` : '<p class="note">Seu save aparece no ranking após a primeira sincronização.</p>';
    const list = rows.slice(3).map((row, k) => { const i = k + 3, pctW = Math.max(3, Math.round(100 * (Number(row[col[0]]) || 0) / top)); return `<div class="rk-row ${(row.me || String(row.id) === meId) ? 'me' : ''}"><span class="rk-pos">${i + 1}</span>${minis(teamOf(row))}<span class="rk-who">${name(row)}<small>Nv. ${row.account_level}</small></span><span class="rk-bar"><i style="width:${pctW}%"></i><b>${col[2](row[col[0]])}</b></span></div>`; }).join('');
    return `${meBox}
      ${rows.length ? `<div class="rk-podium">${podium}</div>${list ? `<div class="rk-list">${list}</div>` : ''}` : '<div class="empty-state"><p>Ninguém no ranking ainda. Seja o primeiro!</p></div>'}
      <p class="note">${this.session.mode === 'neon' ? 'Ranking de teste: os números vêm do save de cada jogador.' : 'Toque no nome para ver o perfil e a equipe. O poder é recalculado pelo servidor a partir do save; contas com atividade suspeita não aparecem.'}</p>`;
  };

  // ---------------------------------------------------------------------------
  // LOJA
  // ---------------------------------------------------------------------------
  P.shopPanel = function(_, tab) {
    const e = this.engine, s = this.state;
    if (tab === 'econ' || tab === 'gems') return this.bankPanel(null, tab === 'gems' ? 'wallet' : 'overview');
    if (tab === 'market') {
      const offers = e.refreshMarket(); const next = (Math.floor(Date.now() / 7200000) + 1) * 7200000;
      return `<p class="note">Mercado do Porto: ofertas renovam em <b>${fmtTime((next - Date.now()) / 1000)}</b>. Nível do Mercado ${s.buildings.market}: ${2 + s.buildings.market} equipamentos por rodada.</p><div class="inventory-grid">${offers.map((o, i) => o.type === 'item' ? this.itemCard(o.item, { flavor:true, actions:`<button class="action small ${s.player.gold >= o.price && !o.sold ? 'primary' : ''}" data-market="${i}" type="button" ${o.sold || s.player.gold < o.price ? 'disabled' : ''}>${o.sold ? 'Vendido' : `Comprar · ${compact(o.price)} ouro`}</button>` }) : `<article class="item"><div class="item-head"><img class="item-art round" src="${portrait(o.heroId)}" alt=""><div><b>${o.n} fragmentos</b><small>${esc(e.template(o.heroId).name)}</small></div></div><p class="dim">Use para elevar a qualidade deste herói.</p><footer><button class="action small ${s.player.gold >= o.price && !o.sold ? 'primary' : ''}" data-market="${i}" type="button" ${o.sold || s.player.gold < o.price ? 'disabled' : ''}>${o.sold ? 'Vendido' : `Comprar · ${compact(o.price)} ouro`}</button></footer></article>`).join('')}</div>`;
    }
    if (tab === 'p2p') return this.p2pPanel();
    if (tab === 'gems') return this.walletPanel();
    const list = PR.shop[tab] || PR.shop.gold;
    return `<p class="note">${tab === 'gold' ? 'Preços em ouro sobem conforme seu progresso. Poções e elixires são usados no combate (teclas 1 e 2).' : 'Cristais vêm de primeiras vitórias, conquistas, missões e níveis de conta.'}</p><div class="shop-grid">${list.map(o => { const price = e.shopPrice(o), cur = Object.keys(price)[0], bought = e.shopBoughtToday(o.id), can = s.player[cur] >= price[cur] && (!o.limit || bought < o.limit); const owned = o.give.potion ? `Você tem ${s.consumables.potion}` : o.give.elixir ? `Você tem ${s.consumables.elixir}` : o.give.scroll ? `Você tem ${s.consumables.scroll}` : o.give.invCap ? `${s.invCap}/200 espaços` : o.give.boost ? (s.boostUntil > Date.now() ? `Ativo: ${fmtTime((s.boostUntil - Date.now()) / 1000)}` : '') : ''; return `<article class="shop-card"><img class="item-art" src="${KT.iconUrl(o.icon, o.hue)}" alt=""><b>${esc(o.name)}</b><small>${esc(o.text)}</small>${owned ? `<small class="dim">${owned}</small>` : ''}${o.limit ? `<small class="dim">Hoje: ${bought}/${o.limit}</small>` : ''}<button class="action ${can ? 'primary' : ''}" data-buy="${o.id}" type="button" ${can ? '' : 'disabled'}>${o.limit && bought >= o.limit ? 'Limite diário' : `${compact(price[cur])} ${cur === 'gold' ? 'ouro' : 'cristais'}`}</button></article>`; }).join('')}</div>`;
  };

  // ---------------------------------------------------------------------------
  // MERCADO DE JOGADORES E CARTEIRA (Gemas = dinheiro real; tudo é validado no servidor)
  // ---------------------------------------------------------------------------
  const gemFmt = c => `R$ ${(Number(c || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  const gemTxt = c => `<i class="ic ic-gem"></i> ${U.fmt(c || 0)} <small class="dim">(${gemFmt(c)})</small>`;
  const MKT = ui => ui.session?.mode === 'neon' ? KT.NeonMarket : KT.Net;
  const tradeMode = ui => ui.session?.mode === 'cloud' || ui.session?.mode === 'neon';
  P.cloudOnly = function(what) { return `<div class="empty-state"><h3>${what}</h3><p>Disponível apenas no servidor oficial, com conta. No modo offline não há negociação entre jogadores.</p></div>`; };
  P.loadMarket = function(force = false) {
    const now = Date.now();
    if (!force && this.mktAt && now - this.mktAt < 15000) return;
    this.mktAt = now;
    Promise.all([MKT(this).wallet(), MKT(this).market(this.mktFilter || {}), MKT(this).myMarket()]).then(([w, m, mine]) => {
      this.wallet = w.ok ? w : { error:w.error }; this.marketCfg = w.config || m.config || this.marketCfg;
      this.mktList = m.ok ? m.listings : []; this.mktErr = m.ok ? null : m.error; this.myMkt = mine.ok ? mine : null;
      this.renderResources(); if ((this.view.panel === 'shop' && this.view.tab === 'p2p') || (this.view.panel === 'bank' && this.view.tab === 'wallet')) this.refreshPanel();
    });
  };
  // Preço na moeda do anúncio: ouro (economia do jogo) ou Gemas (dinheiro real).
  const priceTxt = (v, cur) => cur === 'gold' ? `<span class="coin-ic" aria-hidden="true"></span> ${U.fmt(v || 0)} <small class="dim">ouro</small>` : gemTxt(v);
  P.mktCurrency = function() { const cfg = this.marketCfg || {}; const f = this.mktFilter || {}; if (f.currency === 'gems' && cfg.enabled !== false) return 'gems'; return cfg.goldMarket === false && cfg.enabled !== false ? 'gems' : 'gold'; };
  P.p2pPanel = function() {
    if (!tradeMode(this)) return this.cloudOnly('Mercado de Jogadores');
    this.loadMarket();
    const f = this.mktFilter || (this.mktFilter = { type:'all', sort:'recent', q:'', slot:'all', rarity:'all', currency:'gold' }), cfg = this.marketCfg || {};
    if (!this.mktList && !this.mktErr) return '<div class="empty-state"><p>Carregando o mercado…</p></div>';
    if (cfg.enabled === false && cfg.goldMarket === false) return `<div class="empty-state"><h3>Mercado fechado</h3><p>${esc(cfg.reason || 'O Mercado de Jogadores está desativado neste servidor.')}</p></div>`;
    const cur = this.mktCurrency(), gold = cur === 'gold';
    const me = this.session.user?.id, bal = gold ? this.state.player.gold : (this.wallet?.balance || 0);
    const sel = this.state.inventory.find(x => x.uid === this.sellSel);
    const ownCards = I.cards.filter(c => (this.state.cards[c.id] || 0) > 0);
    const ownMats = [...Object.keys(I.materials), ...D.PROF_MATS.map(m => m.id)].map(id => I.matInfo(id)).filter(m => m && m.have(this.state) > 0);
    const sellerBtn = l => `<button class="linkish" data-seller="${l.sellerId}" type="button" title="Ver perfil">${esc(l.seller)}</button>`;
    const minP = gold ? (cfg.goldMinPrice || 100) : (cfg.minPrice || 10), unit = gold ? 'ouro' : 'Gemas';
    const feeLine = gold ? `Taxa de anúncio: ${pct((cfg.goldListFeeBps || 100) / 10000, 1)} do preço (mín. ${U.fmt(cfg.goldListFeeMin || 50)} ouro), paga ao anunciar. Imposto na venda: ${pct((cfg.goldTaxBps || 500) / 10000, 1)}.` : `Você recebe o preço menos ${pct((cfg.feeBps || 500) / 10000, 1)} de taxa. Vendas ficam ${cfg.holdHours ?? 72}h em análise antes do saque.`;
    const sell = `<section class="sell-box"><h4 class="sub-title">Anunciar em ${gold ? 'ouro' : 'Gemas'}</h4>${sel ? `<div class="split">${this.itemCard(sel)}<div class="forge-box"><label>Preço em ${unit} <input id="sell-price" type="number" min="${minP}" step="1" value="${this.sellPrice || ''}" placeholder="${gold ? 'ex.: 25000' : 'ex.: 500 (= R$ 5,00)'}"></label><p class="dim" id="sell-preview">${feeLine}</p>${this.priceHint(sel, cur)}<div class="box-actions"><button class="action primary" data-list-item="${sel.uid}" type="button">Anunciar item</button><button class="action" data-sell-clear type="button">Cancelar</button></div></div></div>` : '<p class="dim">Na Bolsa, use o botão de venda em um item para anunciá-lo aqui. Itens <b>vinculados</b> (loja e recompensas) não podem ser vendidos.</p>'}
      ${ownMats.length ? `<div class="card-sell"><select id="sell-mat">${ownMats.map(m => `<option value="${m.id}">${esc(m.name)} (×${U.fmt(m.have(this.state))})</option>`).join('')}</select><input id="sell-mat-qty" type="number" min="1" max="9999" step="1" placeholder="Quantidade"><input id="sell-mat-price" type="number" min="${minP}" step="1" placeholder="Preço do lote em ${unit}"><button class="action" data-list-mat type="button">Anunciar material</button></div>` : ''}
      ${ownCards.length ? `<div class="card-sell"><select id="sell-card">${ownCards.map(c => `<option value="${c.id}">${esc(c.name)} (×${this.state.cards[c.id]})</option>`).join('')}</select><input id="sell-card-price" type="number" min="${minP}" step="1" placeholder="Preço em ${unit}"><button class="action" data-list-card type="button">Anunciar carta</button></div>` : ''}
      <p class="dim small-note">${feeLine}</p></section>`;
    const listing = l => { const own = l.sellerId === me, lc = l.currency || 'gems'; const body = l.kind === 'item' ? this.itemCard(l.payload, { compare:`<span class="compare">Vendedor: ${sellerBtn(l)}</span>` }) : l.kind === 'mat' ? `<article class="item mat-listing"><div class="item-head"><span class="mat-dot" style="--c:${I.matInfo(l.payload.id)?.color || '#aaa'}"></span><div><b>${esc(I.matInfo(l.payload.id)?.name || l.payload.id)} ×${U.fmt(l.payload.qty)}</b><small>Material · Vendedor: ${sellerBtn(l)}</small></div></div><p class="dim">${esc(I.matInfo(l.payload.id)?.text || '')}</p><p class="dim">≈ ${priceTxt(Math.ceil(l.price / Math.max(1, l.payload.qty)), lc)} por unidade</p></article>` : `<article class="item card-listing ${l.payload.mvp ? 'mvp' : ''}"><div class="item-head"><span class="card-art"><img src="${KT.spriteUrl(I.cardById(l.payload.id)?.sprite)}" alt=""></span><div><b>${esc(I.cardById(l.payload.id)?.name || l.payload.id)}</b><small>${l.payload.mvp ? 'Carta MVP' : 'Carta'} · Vendedor: ${sellerBtn(l)}</small></div></div><ul class="item-stats">${Object.entries(I.cardById(l.payload.id)?.stats || {}).map(([k, v]) => `<li>${statValue(k, v)}</li>`).join('')}</ul></article>`;
      const can = (lc === 'gold' ? this.state.player.gold : (this.wallet?.balance || 0)) >= l.price;
      return `<div class="listing">${body}<footer><b class="price">${priceTxt(l.price, lc)}</b>${own ? `<button class="action small" data-cancel-listing="${l.id}" type="button">Cancelar</button>` : `<button class="action small primary" ${lc === 'gold' ? 'data-buy-gold' : 'data-buy-listing'}="${l.id}" data-price="${l.price}" data-name="${esc(l.name || l.payload?.name || '')}" type="button" ${can ? '' : 'disabled'}>Comprar</button>`}</footer></div>`; };
    const mail = this.myMkt?.mailbox || [];
    const mailName = m => m.kind === 'item' ? esc(m.payload.name) : m.kind === 'gold' ? `<span class="coin-ic" aria-hidden="true"></span> ${U.fmt(m.payload.amount)} ouro` : m.kind === 'mat' ? `${esc(I.matInfo(m.payload.id)?.name || 'Material')} ×${U.fmt(m.payload.qty)}` : esc(I.cardById(m.payload.id)?.name || 'Carta');
    const curTabs = `<div class="cur-switch" role="tablist">${cfg.goldMarket !== false ? `<button class="${gold ? 'active' : ''}" data-mkt-cur="gold" type="button"><span class="coin-ic" aria-hidden="true"></span> Ouro</button>` : ''}${cfg.enabled !== false ? `<button class="${!gold ? 'active' : ''}" data-mkt-cur="gems" type="button"><i class="ic ic-gem"></i> Gemas</button>` : ''}</div>`;
    return `<div class="wallet-strip">${curTabs}<span>Saldo: <b>${gold ? priceTxt(bal, 'gold') : gemTxt(bal)}</b></span>${gold ? '' : '<button class="action small" data-tab-go="gems" type="button">Carteira</button>'}<button class="action small" data-mkt-refresh type="button">↻ Atualizar</button></div>
      ${mail.length ? `<section class="mailbox"><h4 class="sub-title">Correio (${mail.length})</h4>${mail.map(m => `<div class="mail-row"><span>${mailName(m)} <small class="dim">${esc(m.reason)}</small></span><button class="action small primary" data-claim-mail="${m.id}" type="button">Resgatar</button></div>`).join('')}</section>` : ''}
      ${sell}
      <div class="inv-top"><div class="filter-tabs">${[['all','Tudo'], ['item','Itens'], ['card','Cartas'], ['mat','Materiais']].map(([id, n]) => `<button class="${f.type === id ? 'active' : ''}" data-mkt-type="${id}" type="button">${n}</button>`).join('')}</div>${f.type === 'item' ? `<select id="mkt-slot" aria-label="Espaço"><option value="all">Todo espaço</option>${Object.entries(I.slots).map(([id, sl]) => `<option value="${id}" ${f.slot === id ? 'selected' : ''}>${esc(sl.name)}</option>`).join('')}</select><select id="mkt-rarity" aria-label="Raridade"><option value="all">Toda raridade</option>${D.rarities.map(r => `<option value="${r.id}" ${f.rarity === r.id ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}</select>` : ''}<div class="filter-tabs">${[['recent','Recentes'], ['price','Menor preço'], ['-price','Maior preço']].map(([id, n]) => `<button class="${f.sort === id ? 'active' : ''}" data-mkt-sort="${id}" type="button">${n}</button>`).join('')}</div><input id="mkt-search" type="search" placeholder="Buscar pelo nome…" value="${esc(f.q)}"></div>
      ${this.mktErr ? `<p class="note warn-note">${esc(this.mktErr)}</p>` : ''}
      ${this.session?.mode === 'neon' ? this.ordersHtml() : ''}
      <div class="listing-grid">${(this.mktList || []).filter(l => l.sellerId !== me && (l.currency || 'gems') === cur).map(listing).join('') || '<p class="empty-note">Nenhum anúncio de outros jogadores encontrado.</p>'}</div>
      ${this.myMkt?.listings?.length ? `<h4 class="sub-title">Meus anúncios</h4><div class="listing-grid">${this.myMkt.listings.map(listing).join('')}</div>` : ''}
      <p class="note">Itens anunciados saem da sua bolsa e voltam pelo Correio se você cancelar ou se o anúncio expirar. Compras em ouro chegam direto na bolsa; o ouro das suas vendas chega pelo Correio.</p>`;
  };
  P.priceLabel = function(price) { return this.mktCurrency() === 'gold' ? `${U.fmt(price)} de ouro` : `<i class="ic ic-gem"></i> ${U.fmt(price)} (${gemFmt(price)})`; };
  P.listFeeNote = function(price) { const cfg = this.marketCfg || {}; if (this.mktCurrency() !== 'gold') return ''; const fee = Math.max(cfg.goldListFeeMin || 50, Math.ceil(price * (cfg.goldListFeeBps || 100) / 10000)); return ` Taxa de anúncio: <b>${U.fmt(fee)} de ouro</b> (não volta se cancelar).`; };
  P.profilePanel = function(id) {
    if (this.session?.mode === 'neon') return this.neonSellerPanel(id);
    if (this.session?.mode !== 'cloud') return this.cloudOnly('Perfil de jogador');
    this.profiles = this.profiles || {};
    const c = this.profiles[id];
    if (!c || Date.now() - c.at > 60_000) {
      if (!c?.loading) { this.profiles[id] = { ...(c || {}), loading:true, at:c?.at || 0 }; Promise.all([KT.Net.profile(id), KT.Net.market({ seller:id, sort:'recent' })]).then(([p, m]) => { this.profiles[id] = { at:Date.now(), data:p, listings:m.ok ? m.listings : [] }; if (this.view.panel === 'profile' && String(this.view.param) === String(id)) this.refreshPanel(); }); }
      if (!c?.data) return '<div class="empty-state"><p>Carregando perfil…</p></div>';
    }
    const r = c.data; if (!r.ok) return `<div class="empty-state"><p>${esc(r.error || 'Perfil indisponível.')}</p></div>`;
    const p = r.profile, me = String(this.session.user?.id) === String(p.id), bal = this.wallet?.balance || 0;
    const since = new Date(p.since).toLocaleDateString('pt-BR');
    const team = p.team.map(h => { const t = this.engine.template(h.id); if (!t) return ''; return `<div class="pf-hero"><span class="pf-portrait" style="background-image:url('${portrait(t.id)}')"></span><div><b>${esc(t.name)}</b><small>${'★'.repeat(h.stars)} · Nv. ${h.level}</small>${clsTag(t.cls)}<div class="pf-gear">${h.gear.map(g => `<span class="rtext rarity-${esc(g.rarity)}" title="${esc(I.slots[g.slot]?.name || g.slot)}">${esc(g.name)}${g.plus ? ` +${g.plus}` : ''}</span>`).join('') || '<span class="dim">Sem equipamento</span>'}</div></div></div>`; }).join('');
    const listing = l => `<div class="listing">${l.kind === 'item' ? this.itemCard(l.payload) : `<article class="item"><b>${esc(l.kind === 'mat' ? `${I.matInfo(l.payload.id)?.name || l.payload.id} ×${U.fmt(l.payload.qty)}` : I.cardById(l.payload.id)?.name || l.payload.id)}</b></article>`}<footer><b class="price">${priceTxt(l.price, l.currency)}</b>${me ? '' : `<button class="action small primary" ${l.currency === 'gold' ? 'data-buy-gold' : 'data-buy-listing'}="${l.id}" data-price="${l.price}" data-name="${esc(l.name || l.payload?.name || '')}" type="button" ${(l.currency === 'gold' ? this.state.player.gold : bal) >= l.price ? '' : 'disabled'}>Comprar</button>`}</footer></div>`;
    return `<div class="profile-head"><div><h3>${esc(p.name)}${me ? ' <small class="dim">(você)</small>' : ''}</h3><small class="dim">Viajante desde ${since} · ${U.fmt(p.playHours)} h de jornada</small></div>
      <div class="pf-stats"><span><b>Nv. ${p.level}</b>Conta</span><span><b>${compact(p.power)}</b>Poder</span><span><b>${U.fmt(p.bossKills)}</b>Chefes</span><span><b>${U.fmt(p.bestStage)}</b>Estágios</span><span><b>${U.fmt(p.riftBest)}</b>Fenda</span><span><b>${U.fmt(p.sales)}</b>Vendas</span></div></div>
      <h4 class="sub-title">Equipe atual</h4><div class="pf-team">${team || '<p class="dim">Sem equipe formada.</p>'}</div>
      <h4 class="sub-title">Anúncios abertos (${p.open})</h4><div class="listing-grid">${(c.listings || []).map(listing).join('') || '<p class="empty-note">Nenhum anúncio aberto.</p>'}</div>`;
  };
  // Modo Neon: o vendedor é anônimo (referência opaca); mostra o nome e os anúncios abertos.
  P.neonSellerPanel = function(ref) {
    const c = (this.profiles = this.profiles || {})[ref];
    if (!c || Date.now() - c.at > 60_000) { if (!c?.loading) { this.profiles[ref] = { ...(c || {}), loading:true, at:c?.at || 0 }; KT.NeonMarket.market({ seller:ref }).then(m => { this.profiles[ref] = { at:Date.now(), listings:m.ok ? m.listings : [] }; if (this.view.panel === 'profile') this.refreshPanel(); }); } if (!c?.listings) return '<div class="empty-state"><p>Carregando anúncios…</p></div>'; }
    const ls = c.listings || [], name = ls[0]?.seller || 'Vendedor';
    return `<div class="profile-head"><div><h3>${esc(name)}</h3><small class="dim">${ls.length} anúncio(s) aberto(s)</small></div></div><div class="listing-grid">${ls.map(l => `<div class="listing">${l.kind === 'item' ? this.itemCard(l.payload) : `<article class="item"><b>${esc(l.name)}</b></article>`}<footer><b class="price">${priceTxt(l.price, 'gold')}</b>${l.mine ? '' : `<button class="action small primary" data-buy-gold="${l.id}" data-price="${l.price}" data-name="${esc(l.name)}" type="button" ${this.state.player.gold >= l.price ? '' : 'disabled'}>Comprar</button>`}</footer></div>`).join('') || '<p class="empty-note">Nenhum anúncio aberto.</p>'}</div>`;
  };
  P.priceHint = function(item, cur = 'gems') {
    const key = item.kind === 'unique' ? `u:${item.uniqueId}` : item.kind === 'set' ? `s:${item.setId}:${item.slot}` : `b:${item.baseId}:${item.rarity}`, hk = `${cur}|${key}`;
    const h = this.priceHistory?.[hk];
    if (!h) { this.priceHistory = this.priceHistory || {}; this.priceHistory[hk] = { loading:true }; MKT(this).priceHistory(key, cur).then(r => { this.priceHistory[hk] = r.ok ? r : { sales:[] }; if (this.view.tab === 'p2p') this.refreshPanel(); }); return ''; }
    if (h.loading || !h.sales?.length) return '<p class="dim">Sem vendas recentes desta peça.</p>';
    const prices = h.sales.map(x => x.price).sort((a, b) => a - b), med = prices[Math.floor(prices.length / 2)];
    return `<p class="price-hint">Mediana das últimas ${prices.length} vendas: <b>${priceTxt(med, cur)}</b></p>`;
  };
  P.walletPanel = function() {
    if (this.session?.mode !== 'cloud') return this.cloudOnly('Carteira de Gemas');
    this.loadMarket();
    const w = this.wallet, cfg = this.marketCfg || {};
    if (!w) return '<div class="empty-state"><p>Carregando carteira…</p></div>';
    if (w.error) return `<div class="empty-state"><p>${esc(w.error)}</p></div>`;
    return `<div class="wallet-hero"><div><span class="eyebrow">CARTEIRA · MOEDA DE DINHEIRO REAL</span><h3>${gemTxt(w.balance)}</h3><p>${w.held ? `Reservado em saques: ${gemTxt(w.held)} · ` : ''}100 Gemas = R$ 1,00. O saldo fica no servidor, nunca no save.</p></div></div>
      <div class="grid2">
        <article class="panel"><h3>Depositar</h3><p>Pix pelo provedor de pagamento do servidor. Mínimo ${gemFmt(cfg.minDeposit || 500)}.</p><div class="mini-form"><input id="dep-amount" type="number" min="${(cfg.minDeposit || 500) / 100}" step="1" placeholder="Valor em R$"><button class="action primary" data-deposit type="button" ${cfg.payments ? '' : 'disabled'}>Gerar Pix</button></div>${cfg.payments ? '' : '<p class="note warn-note">Depósitos ainda não estão configurados neste servidor (falta o provedor de pagamento).</p>'}<div id="dep-out"></div></article>
        <article class="panel"><h3>Sacar</h3><p>Taxa de ${pct((cfg.withdrawFeeBps || 200) / 10000, 1)} (mínimo ${gemFmt(cfg.withdrawMinFee || 100)}). Saque mínimo ${gemFmt(cfg.minWithdraw || 2000)}. Passa por revisão antes do pagamento.</p><div class="mini-form"><input id="wd-amount" type="number" min="${(cfg.minWithdraw || 2000) / 100}" step="1" placeholder="Valor em R$"><input id="wd-key" maxlength="140" placeholder="Sua chave Pix"><input type="password" id="wd-pass" placeholder="Sua senha (confirmação)" autocomplete="current-password"><button class="action" data-withdraw type="button" ${cfg.withdrawals ? '' : 'disabled'}>Solicitar saque</button></div>${cfg.withdrawals ? '' : '<p class="note warn-note">Saques estão desativados neste servidor.</p>'}</article>
      </div>
      <h4 class="sub-title">Movimentações</h4><table class="rank-table"><thead><tr><th>Quando</th><th>Tipo</th><th>Valor</th></tr></thead><tbody>${(w.ledger || []).map(l => `<tr><td>${new Date(Number(l.at)).toLocaleString('pt-BR')}</td><td>${esc(l.label || l.kind)}</td><td class="${l.delta >= 0 ? 'txt-green' : 'txt-red'}">${l.delta >= 0 ? '+' : ''}${U.fmt(l.delta)}</td></tr>`).join('') || '<tr><td colspan="3" class="dim">Nenhuma movimentação.</td></tr>'}</tbody></table>
      ${(w.withdrawals || []).length ? `<h4 class="sub-title">Saques</h4><table class="rank-table"><tbody>${w.withdrawals.map(x => `<tr><td>${new Date(Number(x.created_at)).toLocaleString('pt-BR')}</td><td>${gemFmt(x.amount)} (taxa ${gemFmt(x.fee)})</td><td>${{ pending:'Em revisão', paid:'Pago', rejected:'Recusado (valor devolvido)' }[x.status] || x.status}</td></tr>`).join('')}</tbody></table>` : ''}
      <p class="note">Negociar com dinheiro real envolve regras fiscais e de uso do provedor. Guarde seus comprovantes. Suporte do servidor oficial para contestação.</p>`;
  };
  // ---------------------------------------------------------------------------
  // AVENTURAS, central de atividades paralelas (o jogo não segue um trilho único)
  // ---------------------------------------------------------------------------
  P.loadWorldBoss = function(force = false) {
    if (this.session?.mode !== 'cloud') return;
    if (!force && this.wbAt && Date.now() - this.wbAt < 20000) return;
    this.wbAt = Date.now();
    KT.Net.worldBoss().then(r => { if (r.ok) { this.wbInfo = r; if (this.view.panel === 'adventure') this.refreshPanel(); } });
  };
  P.adventurePanel = function(_, tab) {
    const e = this.engine, s = this.state;
    if (tab === 'worldboss') return this.worldBossHtml();
    if (tab === 'expeditions') return this.expeditionsHtml();
    if (tab === 'bounty') return this.bountyHtml();
    // Hoje: tudo o que dá para fazer agora, em cartões.
    const w = e.wbWindow(), wbDone = s.worldBoss.day === dayKeyNow(e);
    const exp = s.expeditions, expReady = exp.filter(x => e.now() >= x.start + x.hours * 3600000).length;
    const b = s.bounty, d = s.daily?.list || [], dDone = d.filter(x => x.progress >= x.n && !x.claimed).length;
    const riftBest = s.progress.rift?.best || 0, rl = e.zoneLock('rift');
    const ADV_ART = { skull:'boss_event', compass:'hunt_frost', target:'hunt_swamp', rift:'dungeon_forge', scroll:'village', anvil:'dungeon', scale:'hunt_tide', bulb:'summoning' };
    const card = (icon, title, text, action, tone = '') => `<article class="adv-card tone-${icon} ${tone}" style="--art:url('${KT.sceneUrl(ADV_ART[icon] || 'village', 'thumb')}')"><span class="adv-ico tone-${icon}">${ic(icon)}</span>${tone === 'hot' ? '<span class="adv-flag">AGORA</span>' : ''}<div class="adv-copy"><b>${title}</b><small>${text}</small></div><div class="adv-cta">${action}</div></article>`;
    const cards = [
      card('skull', 'Invasão Mundial', w.active ? (wbDone ? 'Você já investiu hoje. Resgate a recompensa quando a janela fechar.' : `Aberta agora (até ${fmtClock(w.end)}). Um chefe gigante contra todos os jogadores.`) : `Próxima janela: ${w.next ? fmtClock(w.next.start) : ', '} (${D.worldBoss.windows.map(x => x.label).join(' e ')}).`,
        `<button class="action small ${w.active && !wbDone ? 'primary' : ''}" data-tab-go="worldboss" type="button">${w.active && !wbDone ? 'Investir' : 'Ver'}</button>`, w.active && !wbDone ? 'hot' : ''),
      card('compass', 'Expedições', exp.length ? `${exp.length}/${e.expeditionSlots()} em andamento${expReady ? ` · <b>${expReady} de volta</b>` : ''}.` : `Mande heróis do banco explorar por até 12h (funciona com o jogo fechado).`, `<button class="action small ${expReady ? 'primary' : ''}" data-tab-go="expeditions" type="button">${expReady ? 'Resgatar' : 'Abrir'}</button>`, expReady ? 'hot' : ''),
      card('target', 'Quadro de Recompensas', b.active ? `${esc(D.enemies[b.active.enemy]?.name || '')}: ${U.fmt(b.active.progress)}/${U.fmt(b.active.n)} · ${U.fmt(b.points)} Marcas de Caçador.` : `Escolha um monstro para caçar e ganhe Marcas de Caçador (${U.fmt(b.points)}).`, `<button class="action small ${b.active && b.active.progress >= b.active.n ? 'primary' : ''}" data-tab-go="bounty" type="button">Abrir</button>`, b.active && b.active.progress >= b.active.n ? 'hot' : ''),
      card('compass', 'Treino livre', `Repita sua melhor caçada sempre que quiser. EXP, EXP de classe, ouro e itens continuam progredindo sem limite diário.`, `<button class="action small primary" data-preview-zone="${s.lastHunt || 'hunt'}" type="button">Caçar agora</button>`),
      card('rift', 'Fenda Abissal', rl.locked ? 'Libera ao derrotar Shirogane.' : `Recorde: andar ${riftBest}. Andares infinitos com mutações.`, rl.locked ? '<button class="action small" type="button" disabled>Bloqueado</button>' : `<button class="action small" data-preview-zone="rift" type="button">Descer</button>`),
      card('scroll', 'Missões diárias', d.length ? `${d.filter(x => x.claimed).length}/${d.length} concluídas${dDone ? ` · <b>${dDone} para resgatar</b>` : ''}.` : 'Renovam à meia-noite.', `<button class="action small ${dDone ? 'primary' : ''}" data-go="quests:daily" type="button">Abrir</button>`, dDone ? 'hot' : ''),
      card('anvil', 'Forja e Oficina', `Refine (${Object.values(I.materials).map(m => `${m.short}: ${U.fmt(m.key === 'ore' ? s.player.ore : s.mats[m.key] || 0)}`).join(' · ')}), cozinhe e transmute materiais.`, `<button class="action small" data-go="city:forge" type="button">Forja</button>`),
      card('scale', 'Mercado de Jogadores', 'Compre e venda itens, cartas e materiais raros.', `<button class="action small" data-go="shop:p2p" type="button">Abrir</button>`),
      card('bulb', 'Conselheiro', 'Travado? Veja o que falta para ficar mais forte.', `<button class="action small" data-go="quests:advisor" type="button">Abrir</button>`)
    ];
    const hot = cards.filter(c => c.includes('adv-flag')).length;
    return `<section class="adv-hero"><div><span class="eyebrow">DIÁRIO DE BORDO</span><h3>${hot ? `${hot} coisa(s) esperando por você` : 'Tudo em dia, viajante'}</h3><p>Não existe um único caminho: escolha o que fazer agora. Tudo aqui rende progresso, até com o jogo fechado.</p></div></section><div class="adv-grid">${cards.join('')}</div>`;
  };
  const dayKeyNow = e => KT.State.dayKey(e.now());
  const fmtClock = ms => ms ? new Date(ms).toLocaleString('pt-BR', { timeZone:'America/Sao_Paulo', weekday:'short', hour:'2-digit', minute:'2-digit' }) : ', ';

  P.worldBossHtml = function() {
    const e = this.engine, s = this.state, w = e.wbWindow(), bossId = e.wbBossId(), boss = D.enemies[bossId], lock = e.zoneLock('world_boss');
    this.loadWorldBoss();
    const info = this.wbInfo, done = s.worldBoss.day === dayKeyNow(e), pow = e.getPower();
    const tiers = D.worldBoss.tiers.map(tr => {
      const live = info?.tiers?.find(x => x.tier === tr.id), pct = live ? Math.min(100, live.damage / live.hp * 100) : 0, can = pow >= tr.minPower;
      return `<article class="wb-tier ${can ? '' : 'locked'}"><header><b>${tr.name}</b><small>${tr.minPower ? `Poder mínimo ${compact(tr.minPower)}` : 'Para todos'} · recompensa ×${String(tr.reward).replace('.', ',')}${tr.ally ? ' · Bênção da Aliança' : ''}</small></header>
        <div class="wb-bar"><span style="width:${pct}%"></span><em>${live ? `${compact(live.damage)} / ${compact(live.hp)}` : 'sem dados'}</em></div>
        <small>${live ? `${live.participants} viajante(s) investiram nesta janela` : ''}${live?.top?.length ? ` · líder: <b>${esc(live.top[0].name)}</b>` : ''}</small>
        <button class="action ${can && w.active && !done && !lock.locked ? 'primary' : ''}" data-enter="world_boss" data-opts='${JSON.stringify({ tier:tr.id })}' type="button" ${can && w.active && !done && !lock.locked ? '' : 'disabled'}>${done ? 'Já investiu hoje' : !w.active ? 'Janela fechada' : !can ? 'Poder insuficiente' : 'Investir (90s)'}</button></article>`;
    }).join('');
    const pending = s.worldBoss.day && !s.worldBoss.claimed;
    return `<div class="wb-hero" style="--wc:${D.elements[boss.el].color}"><canvas width="300" height="240" data-sprite-preview="${boss.sprite}"></canvas><div><span class="eyebrow">INVASÃO MUNDIAL · ${w.active ? `ABERTA ATÉ ${fmtClock(w.end)}` : `PRÓXIMA: ${fmtClock(w.next?.start)}`}</span><h3>${esc(boss.name)}</h3><p>${esc(boss.desc)}</p>
      <ul class="prep-list"><li>Janelas diárias: <b>${D.worldBoss.windows.map(x => x.label).join('</b> e <b>')}</b> (horário de Brasília).</li><li><b>Uma investida por dia</b>, de ${D.worldBoss.duration} segundos. Todo o dano de todos os jogadores vai para a mesma barra de vida.</li><li>Se a comunidade derrubar o chefe antes da janela fechar, todos recebem recompensa maior (chance de itens lendários e Adamantina).</li><li>Heroico e Mítico têm a <b>Bênção da Aliança</b>: cada viajante que investiu antes na janela dá +2% de dano aos seguintes (até +50%).</li></ul>
      ${pending ? `<button class="action pink big" data-claim-wb type="button">Resgatar recompensa da Invasão</button>` : ''}</div></div>
      ${lock.locked && !w.active ? '' : lock.reasons.filter(r => !r.met).length ? `<div class="zone-requirements">${lock.reasons.map(r => `<span class="${r.met ? 'met' : 'missing'}">${r.met ? '✓' : '✕'} ${esc(r.text)}</span>`).join('')}</div>` : ''}
      <div class="wb-tiers">${tiers}</div>
      <h4 class="sub-title">O chefe</h4>${this.bossInfo(boss)}`;
  };

  P.expeditionsHtml = function() {
    const e = this.engine, s = this.state, now = e.now(), slots = e.expeditionSlots();
    const busy = new Set(s.expeditions.flatMap(x => x.uids));
    const bench = s.collection.filter(h => !s.formation.includes(h.uid) && !busy.has(h.uid));
    const zones = Object.values(D.zones).filter(z => z.kind === 'hunt' && (s.progress[z.id]?.best || 0) > 0);
    const sel = this.expSel || (this.expSel = { zone:zones[0]?.id, hours:4, uids:[] });
    sel.uids = sel.uids.filter(u => bench.some(h => h.uid === u));
    const running = s.expeditions.map(x => { const end = x.start + x.hours * 3600000, left = Math.max(0, end - now), done = left <= 0, pct = Math.min(100, (now - x.start) / (x.hours * 3600000) * 100);
      return `<article class="exp-card ${done ? 'done' : ''}"><div class="exp-faces">${x.uids.map(u => { const h = e.record(u); return h ? `<img src="${portrait(h.id)}" alt="">` : ''; }).join('')}</div><div><b>${esc(D.zones[x.zone].title)}</b><small>${x.hours}h · ${done ? 'de volta!' : `volta em ${fmtTime(left / 1000)}`}</small><div class="meter"><span style="width:${pct}%"></span></div></div><button class="action small ${done ? 'primary' : ''}" data-claim-exp="${x.id}" type="button" ${done ? '' : 'disabled'}>Resgatar</button></article>`; }).join('');
    return `<section class="adv-hero sub" style="--art:url('${KT.sceneUrl('hunt_frost', 'thumb')}')"><div><span class="eyebrow">CASA DE EXPEDIÇÕES</span><h3>Vagas: ${s.expeditions.length}/${slots}</h3><p>Heróis <b>fora da equipe</b> partem em expedição e voltam com ouro, materiais, itens e <b>EXP</b> (é o único jeito de o banco evoluir). O tempo corre pelo relógio do servidor, mesmo com o computador desligado. A Guilda libera mais vagas.</p></div></section>
      ${running ? `<div class="exp-list">${running}</div>` : ''}
      ${s.expeditions.length < slots ? `<section class="exp-new"><h4 class="sub-title">Nova expedição</h4>
        ${zones.length ? `<div class="filter-tabs">${zones.map(z => `<button class="${sel.zone === z.id ? 'active' : ''}" data-exp-zone="${z.id}" type="button">${esc(z.title)}</button>`).join('')}</div>
        <div class="filter-tabs">${D.expeditions.durations.map(h => `<button class="${sel.hours === h ? 'active' : ''}" data-exp-hours="${h}" type="button">${h}h</button>`).join('')}</div>
        <p class="dim">Escolha até ${D.expeditions.maxHeroes} heróis do banco:</p>
        <div class="exp-bench">${bench.map(h => { const t = e.template(h.id); return `<button class="target-chip ${sel.uids.includes(h.uid) ? 'active' : ''}" data-exp-hero="${h.uid}" type="button"><img src="${portrait(t.id)}" alt=""><span><b>${esc(t.name)}</b><small>Nv.${h.level}</small></span></button>`; }).join('') || '<p class="dim">Todos os heróis estão na equipe ou em expedição. Convoque mais heróis.</p>'}</div>
        <button class="action primary" data-exp-start type="button" ${sel.uids.length && sel.zone ? '' : 'disabled'}>Partir em expedição</button>` : '<p class="dim">Vença ao menos um estágio de caçada para liberar expedições.</p>'}</section>` : ''}`;
  };

  P.bountyHtml = function() {
    const e = this.engine, s = this.state, b = s.bounty;
    const offers = b.active ? [] : (b.offers || []);
    const act = b.active ? `<article class="bounty-active"><canvas width="110" height="100" data-sprite-preview="${D.enemies[b.active.enemy].sprite}"></canvas><div><span class="eyebrow">CAÇADA ATIVA</span><h3>${esc(D.enemies[b.active.enemy].name)}</h3><div class="meter"><span style="width:${Math.min(100, b.active.progress / b.active.n * 100)}%"></span></div><small>${U.fmt(b.active.progress)} / ${U.fmt(b.active.n)} · recompensa: ${b.active.points} Marcas + ouro</small><div class="box-actions">${b.active.progress >= b.active.n ? '<button class="action primary" data-bounty-claim type="button">Resgatar</button>' : ''}<button class="action small" data-bounty-abandon type="button">Abandonar</button></div></div></article>` : '';
    return `<section class="adv-hero sub" style="--art:url('${KT.sceneUrl('hunt_swamp', 'thumb')}')"><div><span class="eyebrow">QUADRO DE RECOMPENSAS</span><h3>${U.fmt(b.points)} Marcas de Caçador</h3><p>Aceite uma caçada, derrote o alvo e troque as Marcas por materiais raros na Loja do Caçador. Caçadas concluídas: <b>${b.done}</b>.</p></div></section>${act}
      ${!b.active && !offers.length ? '<div class="box-actions"><button class="action primary" data-bounty-refresh type="button">Ver caçadas disponíveis</button></div>' : ''}
      ${offers.length ? `<h4 class="sub-title">Escolha uma caçada</h4><div class="grid3">${offers.map((o, i) => `<article class="panel bounty-offer"><canvas width="110" height="90" data-sprite-preview="${D.enemies[o.enemy].sprite}"></canvas><b>${esc(D.enemies[o.enemy].name)}</b><small>Derrote ${U.fmt(o.n)} · ${o.points} Marcas</small><button class="action small primary" data-bounty-accept="${i}" type="button">Aceitar</button></article>`).join('')}</div>` : ''}
      <h4 class="sub-title">Loja do Caçador</h4><div class="shop-grid">${D.bountyShop.map(o => `<article class="shop-card"><b>${esc(o.name)}</b><small>${esc(o.text)}</small><button class="action ${b.points >= o.cost ? 'primary' : ''}" data-bounty-buy="${o.id}" type="button" ${b.points >= o.cost ? '' : 'disabled'}>${o.cost} Marcas</button></article>`).join('')}</div>`;
  };
  // ---------------------------------------------------------------------------
  // MISSÕES
  // ---------------------------------------------------------------------------
  P.questPanel = function(_, tab) {
    const e = this.engine;
    if (tab === 'contracts') { const g = this.state.guildRank; return `<div class="guild-rank"><b>Rank da Guilda ${g.lv}</b><div class="meter"><span style="width:${g.xp / e.guildNeed() * 100}%"></span></div><small>${g.xp}/${e.guildNeed()} para o rank ${g.lv + 1} · contratos maiores e recompensas melhores a cada rank (sem limite)</small></div>${this.contractsHtml()}`; }
    if (tab === 'daily') {
      e.ensureDaily(); const d = this.state.daily, ls = e.loginStatus(), next = Date.parse(`${d.date}T00:00:00-03:00`) + 86400000;
      return `<div class="login-card ${ls.available ? 'ready' : ''}"><div><span class="eyebrow">LOGIN DIÁRIO · DIA ${ls.day}/7 · sequência ${ls.streak}</span><div class="login-days">${D.loginRewards.map((r, i) => `<span class="${i + 1 < ls.day || (!ls.available && i + 1 === ls.day) ? 'got' : i + 1 === ls.day ? 'now' : ''}"><b>${i + 1}</b>${this.rewardPills(r)}</span>`).join('')}</div></div>${ls.available ? '<button class="action primary big" data-claim-login type="button">Resgatar</button>' : '<span class="tag green">✓ Resgatado hoje</span>'}</div>
        <p class="note">Missões diárias renovam em <b>${fmtTime((next - KT.Clock.now()) / 1000)}</b> (meia-noite de Brasília). Complete as 4 para um bônus extra.</p>
        <div class="grid2">${d.list.map((m, i) => { const def = D.dailies.find(x => x.id === m.id), done = m.progress >= m.n; return `<article class="panel ${m.claimed ? 'claimed' : done ? 'done' : ''}"><h3>${esc(def.title)}</h3><p>${def.text.replace('{n}', U.fmt(m.n))}</p><div class="meter"><span style="width:${Math.min(1, m.progress / m.n) * 100}%"></span></div><p>${U.fmt(Math.min(m.progress, m.n))}/${U.fmt(m.n)}</p><div class="guide-reward">${this.rewardPills(e.dailyReward(m))}</div>${m.claimed ? '<span class="tag green">✓ Resgatada</span>' : `<button class="action ${done ? 'primary' : ''}" data-claim-daily="${i}" type="button" ${done ? '' : 'disabled'}>${done ? 'Resgatar' : 'Em andamento'}</button>`}</article>`; }).join('')}</div>`;
    }
    if (tab === 'advisor') return this.advisorHtml();
    if (tab === 'achievements') {
      return `<div class="ach-grid">${D.achievements.map(a => { const v = e.achievementValue(a), done = v >= a.n, claimed = this.state.achievements[a.id]; return `<article class="ach ${claimed ? 'claimed' : done ? 'done' : ''}"><b>${esc(a.title)}</b><small>${esc(a.text)}</small><div class="meter"><span style="width:${Math.min(1, v / a.n) * 100}%"></span></div><small>${U.fmt(Math.min(v, a.n))}/${U.fmt(a.n)}</small><div class="guide-reward">${this.rewardPills(a.reward)}</div>${claimed ? '<span class="tag green">✓ Resgatada</span>' : `<button class="action small ${done ? 'primary' : ''}" data-claim-ach="${a.id}" type="button" ${done ? '' : 'disabled'}>Resgatar</button>`}</article>`; }).join('')}</div>`;
    }
    const cur = e.guideStep(), ch = e.ensureChronicle();
    const chron = ch ? `<div class="chronicle-card"><span class="eyebrow">CRÔNICA ${ch.k} · metas sem fim</span><h3>${esc(ch.title)}</h3><p>${esc(ch.text)}</p><div class="meter"><span style="width:${Math.min(1, (e.chronicleValue(ch) - ch.start) / Math.max(1, ch.target - ch.start)) * 100}%"></span></div><small>${U.fmt(e.chronicleValue(ch))} / ${U.fmt(ch.target)}</small><div class="guide-reward">${this.rewardPills(e.chronicleReward(ch))}</div>${e.chronicleValue(ch) >= ch.target ? '<button class="action primary" data-claim-chronicle type="button">Resgatar</button>' : ''}</div>` : '';
    return `${chron}<p class="note">O Guia do Viajante mostra o próximo passo da jornada. Cada etapa dá recompensas. Depois dele, as <b>Crônicas</b> seguem sem fim.</p><ol class="guide-list">${D.guide.map(g => { const claimed = this.state.guide.claimed[g.id], isCur = g === cur, done = isCur && e.guideDone(g); return `<li class="${claimed ? 'claimed' : isCur ? 'current' : 'future'}"><div><b>${esc(g.title)}</b><small>${esc(g.desc)}</small><div class="guide-reward">${this.rewardPills(g.reward)}</div></div>${claimed ? '<span class="tag green">✓</span>' : isCur ? (done ? '<button class="action small primary" data-claim-guide type="button">Resgatar</button>' : g.go ? `<button class="action small" data-go="${KT.goOf(g)}" type="button">Ir →</button>` : '') : '<span class="tag"><i class="ic ic-lock"></i></span>'}</li>`; }).join('')}</ol>`;
  };

  P.advisorHtml = function() {
    const tips = this.engine.advice(); this.adviceCache = tips;
    const zone = this.engine.zone.kind !== 'village' ? this.engine.zone : D.zones[this.state.lastHunt || 'hunt'];
    const pr = this.engine.powerRatio ? (this.engine.zone.kind !== 'village' ? this.engine.powerRatio() : null) : null;
    return `<div class="advisor-head"><span class="dlg-portrait small"><span class="dlg-mark">神</span></span><div><span class="eyebrow">CONSELHO DE SAYO</span><h3>${tips.length ? 'Um plano para ficar mais forte' : 'Sua equipe está pronta!'}</h3><p>${pr !== null ? `Poder da equipe: <b>${Math.round(pr * 100)}%</b> do recomendado em ${esc(zone.title)}. ` : ''}Faça os itens de cima para baixo, os primeiros dão mais poder por menos esforço.</p></div></div>
      <ol class="advice-list">${tips.map((t, i) => `<li class="prio-${t.prio >= 8 ? 'high' : t.prio >= 5 ? 'mid' : 'low'}"><span>${t.text}</span>${t.action ? `<button class="action small ${t.prio >= 8 ? 'primary' : ''}" data-advice="${i}" type="button">${esc(t.label || 'Fazer')}</button>` : ''}</li>`).join('') || '<li>Nada pendente. Tente o próximo desafio!</li>'}</ol>`;
  };

  // ---------------------------------------------------------------------------
  // PERFIL / AJUDA
  // ---------------------------------------------------------------------------
  P.recordPanel = function() {
    const s = this.state.stats, p = this.state.player;
    const stats = [['Inimigos derrotados', s.kills], ['Elites e guardiões', s.elites], ['Chefes derrotados', s.bossKills], ['Estágios vencidos', s.stages], ['Andares conquistados', s.floors], ['Ultimates usadas', s.ults], ['Itens obtidos', s.loot], ['Itens desmontados', s.salvage], ['Encontros especiais', s.encounters], ['Aprimoramento máximo', `+${s.maxUpgrade}`], ['Ouro ganho', compact(s.goldEarned)], ['Tempo de jogo', fmtTime(this.state.totalPlaySeconds)]];
    return `<div class="record-banner"><span class="eyebrow">PERFIL</span><h3>${esc(p.name)}</h3><p>Conta nível ${p.level} · Poder ${compact(this.engine.getPower())} · ${this.state.collection.length} heróis</p><div class="player-name-edit"><input id="player-name-entry" maxlength="20" placeholder="Seu nome de viajante" value="${esc(p.name)}" aria-label="Nome"><button class="action primary" data-save-name type="button">Salvar nome</button></div></div>
      <div class="record-grid">${stats.map(([n, v]) => `<article><b>${typeof v === 'number' ? U.fmt(v) : v}</b><span>${n}</span></article>`).join('')}</div>
      ${this.accountHtml()}
      <h4 class="sub-title">Configurações</h4><div class="settings"><label data-tip="HUD limpo mostra só o essencial (objetivo, equipe e controles principais). HUD completo mostra todos os painéis e atalhos."><input type="checkbox" id="set-hud" ${this.hudFull?.() ? 'checked' : ''}> HUD completo (mostrar tudo)</label><label data-tip="Ao subir de nível, os pontos de atributo e de talento vão sozinhos para a build recomendada de cada herói."><input type="checkbox" id="set-points" ${this.state.settings.autoPoints ? 'checked' : ''}> Distribuir pontos automaticamente</label><label data-tip="Tremor de tela, flashes fortes e números grandes. Desligado: combate mais limpo e confortável de assistir."><input type="checkbox" id="set-fx" ${U.safeStorage.get('mythverse-fx') === 'intense' ? 'checked' : ''}> Efeitos de combate intensos</label><label data-tip="Mapa do mundo em 3D e partículas com profundidade no palco (three.js). Desligue em aparelhos lentos."><input type="checkbox" id="set-3d" ${KT.Three?.enabled() ? 'checked' : ''}> Cenário 3D</label><label><input type="checkbox" id="set-sound" ${this.state.settings.sound ? 'checked' : ''}> Som</label><label><input type="checkbox" id="set-repeat" ${this.state.settings.autoRepeat ? 'checked' : ''}> Repetir dungeons/chefes automaticamente</label><button class="action" data-save type="button">Salvar agora</button><button class="action red" data-reset-save type="button">Apagar save e recomeçar</button></div>`;
  };
  P.accountHtml = function() {
    const ses = this.session || {}, c = KT.Server || {};
    if (ses.mode === 'neon') return `<h4 class="sub-title">Conta</h4><div class="panel"><h3>${esc(ses.user?.username || '')}</h3><p>E-mail: ${esc(ses.user?.email || '')}</p><p class="dim">Conta no Neon. O progresso é protegido no navegador a cada 5 s e sincronizado automaticamente com a nuvem.</p><div class="box-actions"><button class="action primary" data-neon-save type="button">Salvar agora</button><button class="action" data-neon-logout type="button">Sair</button></div></div>`;
    if (ses.mode !== 'cloud') return `<h4 class="sub-title">Conta</h4><div class="panel"><p><b>Modo offline.</b> O progresso fica salvo apenas neste navegador. Para ter conta, login e save na nuvem, rode o servidor (<code>npm start</code>) e acesse pelo endereço dele.</p></div>`;
    const u = ses.user || {};
    return `<h4 class="sub-title">Conta</h4><div class="account-grid">
      <article class="panel"><h3>${esc(u.username)}</h3><p>${u.email ? `E-mail: ${esc(u.email)}<br>` : ''}Conta criada em ${new Date(u.createdAt).toLocaleDateString('pt-BR')}</p>
        <p>Servidor: <b>${c.status === 'error' ? 'sem conexão (tentando de novo)' : 'sincronizado'}</b>${c.lastSync ? ` · última vez às ${new Date(c.lastSync).toLocaleTimeString('pt-BR')}` : ''} · revisão ${c.revision || 0}</p><p class="dim">Seu progresso fica só no servidor: lutas e recompensas são conferidas lá.</p>
        <div class="box-actions"><button class="action primary" data-sync-now type="button">Salvar agora</button><button class="action" data-logout type="button">Sair</button><button class="action" data-logout-all type="button">Encerrar outras sessões</button></div></article>
      <article class="panel"><h3>Trocar senha</h3><div class="mini-form"><input type="password" id="pw-current" placeholder="Senha atual" autocomplete="current-password"><input type="password" id="pw-next" placeholder="Nova senha (8+, letras e números)" autocomplete="new-password"><button class="action" data-change-pw type="button">Trocar senha</button></div></article>
      <article class="panel"><h3>Código de recuperação</h3><p>Gere um novo código se perdeu o anterior (o antigo deixa de valer).</p><div class="mini-form"><input type="password" id="rc-pass" placeholder="Sua senha" autocomplete="current-password"><button class="action" data-new-recovery type="button">Gerar novo código</button></div><div id="rc-out"></div></article>
      <article class="panel"><h3>Cópias de segurança</h3><p>O servidor guarda até 20 versões anteriores do seu progresso.</p><button class="action" data-load-history type="button">Ver cópias</button><div id="history-out"></div></article>
      <article class="panel"><h3>Seus dados</h3><p>Baixe tudo que o servidor guarda sobre você (LGPD).</p><a class="action" href="/api/account/export" download>⬇ Exportar meus dados</a></article>
      <article class="panel danger-zone"><h3>Excluir conta</h3><p>Apaga conta, save e histórico permanentemente.</p><div class="mini-form"><input type="password" id="del-pass" placeholder="Sua senha" autocomplete="current-password"><input id="del-confirm" placeholder="Digite seu nome de usuário"><button class="action red" data-delete-account type="button">Excluir definitivamente</button></div></article>
    </div>`;
  };
  P.helpPanel = function() {
    return `<div class="help-top"><button class="action primary" data-coach-restart type="button">▶ Rever tutorial</button><span class="dim">O tutorial guiado mostra, na tela, o que fazer em cada passo.</span></div>
      <div class="help-grid">
      <article class="panel"><h3>1 · Convoque e forme a equipe</h3><p>Use as 10 convocações grátis. Escolha 4 heróis: vagas 1 e 2 são a <b>linha de frente</b> (Vanguardas), 3 e 4 a <b>retaguarda</b> (Suportes, Arcanistas, Atiradores). Sinergias de classe, elemento e laços deixam a equipe mais forte.</p><button class="action primary" data-go="collection" type="button">Convocar</button></article>
      <article class="panel"><h3>2 · Combate</h3><p>Os heróis atacam e usam habilidades sozinhos. A <b>ultimate</b> carrega com energia (barra dourada): use com <b>Q W E R</b> ou deixe no AUTO. Clique num inimigo para focar. <b>1</b> = poção, <b>2</b> = elixir. Quando um inimigo mostrar <b>⚠</b>, prepare escudos e curas.</p></article>
      <article class="panel"><h3>3 · Progressão</h3><p>Cada região tem 12 estágios de dificuldade crescente e um <b>chefe final</b> que libera o próximo capítulo. Se a equipe cair, ela recua um estágio e treina sozinha. Fortaleça-se com <b>atributos</b>, <b>itens</b>, <b>Forja</b>, <b>Dojo</b>, <b>talentos</b> e <b>qualidade</b>.</p><button class="action" data-go="journey" type="button">Abrir mapa</button></article>
      <article class="panel"><h3>4 · Sempre evoluindo</h3><p>Tudo é salvo no servidor. Com o PC desligado, o servidor calcula até <b>12 horas</b> de caça e as <b>expedições</b> continuam. Duas vezes por dia há a <b>Invasão Mundial</b> (${D.worldBoss.windows.map(w => w.label).join(' e ')}). Missões, contratos e conquistas dão chaves, cristais e materiais.</p><button class="action" data-go="adventure" type="button">Aventuras</button> <button class="action" data-go="wiki" type="button">Wiki completa</button></article>
      <article class="panel"><h3>5 · AUTO e escolhas</h3><p>Com <b>AUTO</b> ligado, ultimates e escolhas de rota/encontro são decididas sozinhas (opção recomendada). Com AUTO desligado, você decide, e se não responder em <b>2 minutos</b>, a recomendada é escolhida automaticamente. Ultimates usadas <b>à mão</b> são 25% mais fortes.</p></article>
      <article class="panel"><h3>6 · Travou?</h3><p>Abra <b>Missões → Conselheiro</b>: ele mostra o que falta (pontos, itens melhores, formação, onde treinar) com botões para resolver na hora. Cada herói também tem uma <b>Build recomendada</b> na ficha.</p><button class="action" data-go="quests:advisor" type="button">Abrir Conselheiro</button></article>
      <article class="panel"><h3>7 · Refino e Mercado</h3><p>Refinar deixa o item muito mais forte, mas pode regredir ou quebrar, dependendo do material (Tamahagane, Aço Estelar, Oricalco, Adamantina). Itens raros, refinos altos, cartas e materiais podem ser vendidos a outros jogadores por Gemas no <b>Mercado de Jogadores</b>.</p><button class="action" data-go="wiki:refine" type="button">Regras de refino</button></article>
      <article class="panel"><h3>Atalhos</h3><p><b>Q W E R</b> ultimates · <b>1</b> poção · <b>2</b> elixir · <b>A</b> auto · <b>M</b> mapa · <b>I</b> bolsa · <b>T</b> talentos · <b>ESC</b> fechar</p></article></div>`;
  };

  // ---------------------------------------------------------------------------
  // WIKI COMPLETA (gerada a partir dos dados do jogo)
  // ---------------------------------------------------------------------------
  P.wikiPanel = function(_, tab) {
    const search = `<input id="wiki-search" type="search" placeholder="Buscar nesta seção…" aria-label="Buscar" value="${esc(this.wikiQuery || '')}">`;
    let html = '';
    switch (tab) {
      case 'start': html = `<article class="wiki-art"><h3>Bem-vindo à Fenda</h3><p>Mythverse é um RPG de equipe com combate automático e decisões estratégicas. Heróis de 60 mundos atravessam a Fenda para enfrentar o eclipse que ameaça Tsukimori.</p>
        <h4>Ciclo de jogo</h4><ol><li><b>Convoque</b> heróis na Caixa dos Mundos (10 grátis no início).</li><li><b>Monte a equipe</b> de 4 pensando em classes, elementos, posições e laços.</li><li><b>Cace</b> nos estágios: ganhe ouro, EXP, EXP de classe, itens e materiais.</li><li><b>Fortaleça</b>: atributos, equipamentos, Forja, Dojo, talentos e qualidade.</li><li><b>Avance</b>: vença o estágio 12 e o andar III da dungeon para desafiar o <b>chefe da região</b>, que libera o próximo capítulo.</li><li><b>Repita em dificuldades maiores</b>: chefes têm Pesadelo e Inferno com recompensas multiplicadas.</li></ol>
        <h4>Recursos</h4><ul><li><b>Ouro</b>, combate; gasto em prédios, treino, aprimoramento, loja e qualidade.</li><li><b>Cristais</b>, primeiras vitórias, níveis de conta, missões e conquistas; trocados por chaves e itens especiais.</li><li><b>Éter</b>, desmontando itens; usado em encantamentos e receitas.</li><li><b>Tamahagane</b>, desmontando itens e inimigos fortes; usado para aprimorar.</li><li><b>Chaves</b>, convocações.</li><li><b>Fragmentos</b>, heróis repetidos; usados para elevar qualidade.</li><li><b>Gemas</b>, moeda de dinheiro real (100 = R$ 1,00), guardada no servidor; usada no Mercado de Jogadores. Entra por depósito Pix e sai por saque, com taxas pequenas.</li><li><b>Cartas</b>, drops raríssimos de monstros; valem Gemas no Mercado.</li></ul>
        <h4>Modo AFK (com o PC desligado)</h4><p>O progresso fora do jogo é calculado <b>pelo servidor</b>, com o relógio do servidor: pode fechar a aba ou desligar o computador. Ao voltar (depois de pelo menos 2 minutos), você recebe até <b>12 horas</b> de caça no maior estágio vencido da última caçada: ouro, EXP, alguns itens, Tamahagane e Éter. O AFK rende bem menos que jogar ativo e nunca dá itens acima do que a região permite. Expedições também continuam correndo com o PC desligado.</p></article>`; break;
      case 'combat': html = `<article class="wiki-art"><h3>Como o combate funciona</h3>
        <p><b>Ataque básico:</b> a cada 1,5s ÷ velocidade. Gera 10 de energia. Pode ser esquivado.</p>
        <p><b>Habilidade:</b> automática, com recarga própria. Habilidades de cura/escudo esperam alguém ferido.</p>
        <p><b>Ultimate:</b> exige 100 de energia (ataques, dano recebido, efeitos). Com AUTO, é usada sozinha; sem AUTO, use Q W E R. Ultimates manuais mostram uma cena especial e são <b>mais fortes</b>: +25% de dano e escudo e +20% de cura. O AUTO completo é cômodo, mas jogar no manual sempre rende mais.</p>
        <p><b>Dano:</b> ATK × multiplicador × crítico × vantagem elemental × bônus, reduzido pela DEF do alvo (DEF ÷ (DEF + 2,2 × ATK base do atacante)), Marca, Redução de dano e variação de ±8%.</p>
        <p><b>Posições:</b> inimigos atacam a linha de frente 3× mais que a retaguarda; Vanguardas atraem o dobro. Provocação força todos os ataques no provocador.</p>
        <p><b>Foco:</b> clique num inimigo para que toda a equipe o ataque (clique de novo para soltar).</p>
        <p><b>Ataques telegrafados (⚠):</b> chefes e guardiões preparam golpes enormes; a área vermelha mostra quem será atingido. Escudos absorvem o dano.</p>
        <p><b>Fúria:</b> chefes ganham +25% de ATK a cada 10s após o tempo limite.</p>
        <p><b>Derrota:</b> na caçada (e na Fenda), a equipe recua 1 estágio/andar e desliga o avanço automático; em dungeons e chefes, você pode tentar de novo ou voltar a treinar. Duas derrotas seguidas no mesmo desafio inédito abrem o <b>Conselheiro</b> com um plano do que fazer.</p>
        <p><b>Escolhas (rotas e encontros):</b> com o <b>AUTO ligado</b>, a equipe escolhe sozinha a opção recomendada e nenhuma janela aparece. Com o <b>AUTO desligado</b>, a escolha aparece para você decidir, a opção recomendada vem marcada e, se ninguém escolher em <b>2 minutos</b> (por exemplo, fora da tela ou com a aba minimizada), ela é escolhida automaticamente. A recomendação considera a vida da equipe, heróis caídos, o poder contra o recomendado e o seu ouro.</p>
        <h4>Efeitos de status</h4><div class="wiki-grid">${Object.entries(D.statusInfo).map(([k, s2]) => `<div data-wiki-entry><b style="color:${s2.color}">${s2.icon} ${s2.name}</b><small>${s2.buff ? 'Benéfico · ' : 'Negativo · '}${s2.text}</small></div>`).join('')}</div></article>`; break;
      case 'classes': html = `<div class="wiki-grid wide">${Object.entries(D.classes).map(([cls, c]) => `<article class="wiki-card" data-wiki-entry><h3>${c.icon} ${cls}</h3><p><b>Posição ideal:</b> ${c.row}</p><p><b>Traço:</b> ${c.trait}</p><p><b>Base (nível 1):</b> HP ${c.base.hp} · ATK ${c.base.atk} · DEF ${c.base.def} · Vel ×${c.base.spd} · Crit ${pct(c.base.crit)}</p><p><b>Sinergia:</b> ${c.synergy.map(s2 => `(${s2.n}) ${s2.text}`).join(' · ')}</p><p><b>Atributos sugeridos:</b> ${PR.classAttrHint[cls]}</p><p class="dim">${D.roster.filter(h => h.cls === cls).map(h => h.name).join(', ')}</p></article>`).join('')}</div>`; break;
      case 'elements': html = `<article class="wiki-art"><h3>Vantagens elementais</h3><p>Atacar um elemento fraco causa <b>+30%</b> de dano (mais o bônus Elemental dos itens). Atacar quem é forte contra você causa <b>−20%</b>. Luz e Sombra são fortes uma contra a outra.</p><div class="wiki-grid">${Object.entries(D.elements).map(([el, e2]) => `<div data-wiki-entry><b style="color:${e2.color}">${e2.icon} ${el}</b><small>Forte contra: ${e2.strong.join(', ')}</small><small>Fraco contra: ${Object.entries(D.elements).filter(([, o]) => o.strong.includes(el)).map(([k]) => k).join(', ') || ', '}</small></div>`).join('')}</div><h4>Sinergia de elemento</h4><ul>${D.elementSynergy.map(s2 => `<li>(${s2.n} heróis) ${s2.text}</li>`).join('')}</ul></article>`; break;
      case 'synergy': html = `<article class="wiki-art"><h3>Laços</h3><p>Heróis com história juntos ganham bônus quando estão na mesma equipe. Um herói pode ativar vários laços.</p><div class="wiki-grid wide">${D.bonds.map(b => `<div class="bond" data-wiki-entry><div class="bond-faces">${b.ids.map(id => `<img src="${portrait(id)}" alt="">`).join('')}</div><div><b>${esc(b.name)}</b><small>${b.ids.map(id => D.roster.find(h => h.id === id).name).join(' + ')}</small><small>${esc(b.text)}</small></div></div>`).join('')}</div></article>`; break;
      case 'heroes': html = `<div class="wiki-heroes">${D.roster.map(h => `<article class="wiki-hero" data-wiki-entry><img src="${portrait(h.id)}" alt="" loading="lazy"><div><h4>${esc(h.name)} <small>${esc(h.world)}</small></h4><div class="tags">${clsTag(h.cls)} ${elTag(h.el)}</div><p><b>Passiva: ${esc(h.passive.name)}:</b> ${esc(h.passiveText)}</p><p><b>Habilidade: ${esc(h.skill.name)}</b> (${String(h.skill.cd).replace('.', ',')}s): ${esc(h.skillText)}</p><p><b>Ultimate: ${esc(h.ult.name)}:</b> ${esc(h.ultText)}</p></div></article>`).join('')}</div>`; break;
      case 'trees': html = `<article class="wiki-art"><h3>Árvores de talento e árvore de classes</h3><p>Cada herói tem sua própria árvore, baseada na classe. Ganha <b>1 ponto por nível</b> (+5 em cada evolução de classe). A árvore tem quatro círculos: o I é livre, o II exige ${PR.TIER_REQ[1]} pontos investidos, o III exige a <b>classe avançada</b> e ${PR.TIER_REQ[2]} pontos, e o IV exige a <b>Transcendência</b> e ${PR.TIER_REQ[3]} pontos. Nós <b>Notáveis</b> dão bônus grandes; <b>Pedras-chave</b> mudam o estilo de jogo com uma desvantagem; cada caminho tem uma <b>Pedra-angular</b> exclusiva no Círculo IV.</p><p><b>Árvore de classes:</b> no nível ${PR.JOB_LEVEL} (classe ${PR.JOB_CLASS_LEVEL}) o herói escolhe um de dois caminhos, por ${U.fmt(PR.jobCost.gold)} ouro e ${PR.jobCost.crystal} cristais. No nível ${PR.JOB2_LEVEL} (classe ${PR.JOB2_CLASS_LEVEL}) ele transcende, por ${U.fmt(PR.job2Cost.gold)} ouro e ${PR.job2Cost.crystal} cristais. Cada grau dá +10% HP/ATK/DEF e o bônus do caminho.</p>
        ${Object.keys(PR.jobs).map(cls => `<p><b>${cls}</b>: ${['a', 'b'].map(k => `${esc(PR.jobs[cls][k].name)} → ${esc(PR.jobs[cls][k].trans)} (${esc(PR.jobs[cls][k].text)})`).join(' · ')}</p>`).join('')}

        ${Object.entries(PR.classTrees).map(([cls, tree]) => `<h4>${cls}</h4><div class="wiki-grid">${tree.filter(n => !n.sig).map(n => `<div data-wiki-entry class="uniq"><span class="wiki-ico" style="--nc:${n.keystone ? '#ff7eb6' : n.notable ? '#ffcf6b' : D.classes[cls].color}">${svgIcon(n.icon, 22)}</span><div><b>${esc(n.name)}</b><small>Círculo ${['I', 'II', 'III', 'IV'][n.tier]} · até ${n.max} rank(s)</small><small>${esc(n.hookText ? n.hookText(n.max) : Object.entries(n.stats).map(([k, v]) => statValue(k, v * n.max)).join(', ') || n.desc)}${n.max > 1 ? ' (no rank máximo)' : ''}</small>${n.keystone ? `<small>${esc(n.desc)}</small>` : ''}</div></div>`).join('')}</div>`).join('')}</article>`; break;
      case 'cards': html = `<article class="wiki-art"><h3>Cartas</h3><p>Cada monstro tem uma carta, e cartas são <b>raríssimas de propósito</b>: mesmo caçando o mesmo monstro o dia inteiro, conseguir uma leva dias. Cada carta tem uma raridade que define a chance por abate e a força dos atributos:</p><div class="wiki-grid">${Object.values(I.cardTiers).map(t => `<div data-wiki-entry><b style="color:${t.color}">${t.label}</b><small>1 em ${U.fmt(Math.round(1 / t.chance))} abates · atributos ×${String(t.mult).replace('.', ',')}</small></div>`).join('')}</div><p>Cartas de chefes são MVP; cartas épicas e MVP também trazem um <b>efeito especial</b>. Variantes Alfa e a pesquisa do Bestiário aumentam a chance. Cartas encaixam nos slots dos equipamentos: raros têm 0 a 1, épicos e conjuntos têm 1, lendários 1 ou 2 e míticos 2. Encaixar é permanente; remover custa 30 cristais e devolve a carta. Cartas ficam na <b>Bolsa → Cartas</b> e não ocupam espaço.</p><p><b>Casa do Time</b>: exponha cartas na Galeria (cada uma dá 25% dos seus atributos à equipe inteira; até 6 espaços) e complete o <b>Álbum</b>: ${D.HOUSE.album.map(m => `${m.n} cartas diferentes`).join(', ')} liberam bônus permanentes.</p><div class="card-grid">${I.cards.map(cd => `<div class="card-tile ${cd.mvp ? 'mvp' : ''}" data-wiki-entry><span class="card-art"><img src="${KT.spriteUrl(cd.sprite)}" alt="" loading="lazy"></span><b>${esc(cd.name)}</b><small>${Object.entries(cd.stats).map(([k, v]) => statValue(k, v)).join(', ')}</small><small class="dim" style="color:${cd.color}">${esc(cd.tierLabel)} · 1 em ${U.fmt(Math.round(1 / cd.chance))}</small>${cd.effect ? `<small>✦ ${esc(cd.effect)}</small>` : ''}</div>`).join('')}</div></article>`; break;
      case 'items': html = `<article class="wiki-art"><h3>Equipamentos</h3><p>Cada herói tem 4 espaços: ${Object.values(I.slots).map(s2 => `<b>${s2.name}</b> (${s2.desc.replace('.', '')})`).join(', ')}. O nível do item (Nv.) depende da região e do estágio.</p>
        <h4>Raridades</h4><div class="wiki-grid">${D.rarities.map(r => `<div data-wiki-entry><b style="color:${r.color}">${r.label}</b><small>Atributo principal ×${String(r.mult).replace('.', ',')} · ${r.affixes} afixo(s)${r.id === 'mythic' ? ' + efeito único' : r.id === 'set' ? ' + bônus de conjunto' : ''}</small></div>`).join('')}</div>
        <h4>Afixos possíveis</h4><div class="wiki-grid">${I.affixes.map(a => `<div data-wiki-entry><b>${a.name}</b><small>${D.statNames[a.stat] || a.stat}: ${a.pct ? `${pct(a.min, 1)}–${pct(a.max, 1)}` : `${a.min}–${a.max}`} (escala com o nível)</small></div>`).join('')}</div>
        <h4>Conjuntos</h4><div class="wiki-grid wide">${I.sets.map(s2 => `<div data-wiki-entry style="--sc:${s2.color}" class="set-card"><b style="color:${s2.color}">${s2.name}</b><small>Fonte: ${s2.source} · Nv. mínimo ${s2.ilvl}</small><small>Peças: ${Object.values(s2.pieces).map(p => p[0]).join(', ')}</small><small>(2) ${s2.bonus2.text}</small><small>(4) ${s2.bonus4.text}</small></div>`).join('')}</div>
        <h4>Itens Míticos (únicos)</h4><div class="wiki-grid wide">${I.uniques.map(q => `<div data-wiki-entry class="uniq"><img class="item-art" src="${KT.iconUrl(q.icon, q.hue)}" alt=""><div><b style="color:#ff5d8f">${q.name}</b><small>${I.slots[q.slot].name} · Nv. ${q.minIlvl}+ · ${q.source}</small><small>${Object.entries(q.stats).map(([k, v]) => statValue(k, v)).join(', ')}</small><small>✦ ${q.effect}</small></div></div>`).join('')}</div>
        <h4>Bases</h4><div class="wiki-grid">${I.bases.map(b => `<div data-wiki-entry class="uniq"><img class="item-art" src="${KT.iconUrl(b.icon, b.hue)}" alt=""><div><b>${b.name}</b><small>${I.slots[b.slot].name} · a partir do Nv. ${b.minIlvl}</small><small class="dim">${b.flavor}</small></div></div>`).join('')}</div>
        <h4>Requisitos para equipar</h4><p>Todo item exige um <b>nível mínimo do herói</b> (cresce com o nível do item e com a raridade) e armas pedem um <b>atributo mínimo</b> ligado ao tipo (Força para lâminas pesadas, Destreza para arcos, Inteligência para cajados…). Cada classe só usa os seus tipos de arma, foco e selo; Relíquias de conjunto seguem as classes do conjunto; Amuletos servem para todos. O requisito aparece em vermelho no card quando o herói selecionado não o cumpre.</p>
        <h4>Forja e Oficina</h4><p>O refino usa quatro materiais com regras diferentes (veja a aba <b>Refino</b>). Desmontar gera Tamahagane, Éter e ouro. Encantar re-sorteia um afixo com Éter. A Oficina tem receitas de culinária e de transmutação com limite diário.</p>
        <h4>Bolsa</h4><p>A bolsa começa com ${this.state.invCap || 150} espaços e pode crescer até ${I.MAX_BAG} (Loja). Se ela encher, <b>nada some</b>: os itens novos vão para o <b>Excedente</b> (até ${I.OVERFLOW_CAP}), de onde você pode puxar ou desmontar tudo de uma vez.</p></article>`; break;
      case 'monsters': html = `<article class="wiki-art"><h3>Bestiário</h3><p>Cada criatura derrotada conta para a <b>pesquisa</b>. Níveis em ${D.RESEARCH.levels.map(n => U.fmt(n)).join(' / ')} abates: cada nível dá <b>+${Math.round(D.RESEARCH.dmg * 100)}% de dano</b> contra ela e <b>+${Math.round(D.RESEARCH.card * 100)}% de chance da carta</b>. Variantes <b>Alfa</b> (${pct(D.ALPHA.chance, 1)} por onda nas caçadas) têm ${D.ALPHA.hp}× HP e ${D.ALPHA.atk}× ATK, garantem um item melhor e 5× chance de carta.</p></article>
        <div class="foe-grid">${Object.keys(D.enemies).filter(id => !D.enemies[id].boss).map(id => this.foeCard(id, true)).join('')}</div>`; break;
      case 'world': html = `${Object.values(D.zones).filter(z => z.kind !== 'village' && z.kind !== 'arena').map(z => `<article class="wiki-zone" data-wiki-entry><img src="${sceneUrl(z.id)}" alt="" loading="lazy"><div><h4>${z.title} <small>${z.kicker}</small></h4><p>${esc(z.lore)}</p><p><b>Desbloqueio:</b> ${this.engine.zoneLock(z.id).reasons.map(r => r.text).join(' · ')}</p>${z.weakTo ? `<p><b>Fraquezas:</b> ${z.weakTo.map(elTag).join(' ')}</p>` : ''}<p><b>Monstros:</b> ${z.kind === 'rift' ? 'mistura de duas regiões por andar (sempre as mesmas para o mesmo andar), guardiões a cada sala 3 e chefes de andar a cada 5 andares.' : (z.kind === 'boss' ? [z.enemy] : z.kind === 'worldboss' ? [...new Set(D.worldBoss.byDay)] : [...z.pool, ...z.elites, ...(z.floorBoss ? [z.floorBoss] : [])]).map(id => D.enemies[id].name).join(', ')}</p></div></article>`).join('')}<h3>Chefes</h3>${Object.values(D.zones).filter(z => z.kind === 'boss').map(z => this.bossInfo(D.enemies[z.enemy])).join('')}<h3>Chefes mundiais</h3>${[...new Set(D.worldBoss.byDay)].map(id => this.bossInfo(D.enemies[id])).join('')}<h4>Dificuldades de chefe</h4><ul>${D.bossTiers.map(t => `<li><b>${t.name}</b>: poder ×${String(t.mult).replace('.', ',')} · recompensas ×${String(t.reward).replace('.', ',')}${t.needKills ? ` · libera após ${t.needKills} vitória(s)` : ''}</li>`).join('')}</ul>
        <h4>Eventos mundiais</h4><p>Seguem um calendário fixo pelo horário de Brasília, veja a aba <b>Eventos</b>.</p>
        <h4>Encontros especiais (caçadas)</h4><div class="wiki-grid">${D.encounters.map(en => `<div data-wiki-entry><b>${en.name}</b><small>${en.text}</small></div>`).join('')}${D.blessings.map(b => `<div data-wiki-entry><b>Santuário: ${b.name}</b><small>${b.text}</small></div>`).join('')}</div>`; break;
      case 'events': {
        const days = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'], up = S().upcomingEvents(KT.Clock.now(), 7).slice(0, 14);
        html = `<article class="wiki-art"><h3>Eventos por data e horário</h3><p>Os eventos mundiais seguem um <b>calendário fixo no horário de Brasília (UTC−3)</b>. O horário vem do relógio do servidor, então é o mesmo para todos os jogadores e não muda quando o servidor reinicia. Fora das janelas, o céu fica calmo (sem bônus).</p>
          <div class="wiki-grid wide">${D.worldEvents.map(ev => `<div data-wiki-entry><b style="color:${ev.color}">${ev.icon} ${ev.name}</b><small>${ev.text}</small><small class="dim">${D.eventSchedule.filter(w => w.id === ev.id).map(w => `${w.days.length === 7 ? 'Todo dia' : w.days.map(d => days[d]).join(' e ')} · ${String(w.from).padStart(2, '0')}h–${String(w.to % 24).padStart(2, '0')}h`).join(' · ')}</small></div>`).join('')}</div>
          <h4>Próximos eventos</h4><table class="rank-table"><thead><tr><th>Evento</th><th>Começa</th><th>Termina</th></tr></thead><tbody>${up.map(ev => `<tr><td><b style="color:${ev.color}">${ev.icon} ${ev.name}</b></td><td>${brt(ev.start)}</td><td>${brt(ev.end, { hour:'2-digit', minute:'2-digit' })}</td></tr>`).join('')}</tbody></table>
          <h4>Missões diárias e login</h4><p>As missões diárias e a recompensa de login viram à <b>meia-noite de Brasília</b>. A sequência de login tem 7 dias e recomeça se você pular um dia.</p><div class="wiki-grid">${D.loginRewards.map((r, i) => `<div><b>Dia ${i + 1}</b><small>${this.rewardPills(r)}</small></div>`).join('')}</div></article>`; break;
      }
      case 'builds': html = `<article class="wiki-art"><h3>Builds recomendadas</h3><p>Todo herói tem uma <b>build recomendada</b> (Ficha → Build recomendada): proporção de atributos, ordem dos talentos, tipo de arma, conjuntos e afixos. O botão <b>Aplicar build</b> distribui os pontos livres de atributo seguindo a proporção recomendada; os equipamentos você escolhe na Bolsa. Cada herói também tem uma <b>Essência</b>, um talento exclusivo que nenhum outro tem.</p></article>
        <div class="wiki-heroes">${D.roster.map(h => { const b = KT.Builds.buildFor(h.id), es = KT.Builds.essences[h.id]; return `<article class="wiki-hero" data-wiki-entry><img src="${portrait(h.id)}" alt="" loading="lazy"><div><h4>${esc(h.name)} <small>${esc(h.world)}</small></h4><div class="tags">${clsTag(h.cls)} ${elTag(h.el)} ${wtTag(b.weapon)}</div><p><b>Essência: ${esc(es.name)}:</b> ${esc(es.text(3))}</p><p><b>Atributos:</b> ${Object.entries(b.attr).map(([k, v]) => `${PR.attributes[k].short} ${v}`).join(' · ')} · <b>Conjuntos:</b> ${b.sets.map(id => I.sets.find(x => x.id === id)?.name).join(', ')}</p><p class="dim">${esc(b.note)}</p></div></article>`; }).join('')}</div>`; break;
      case 'weapons': html = `<article class="wiki-art"><h3>Armas por classe</h3><p>Cada classe empunha tipos específicos de arma. Cada tipo tem um <b>atributo implícito</b> (cresce com o nível e o aprimoramento) e afixos mais prováveis. Armas de <b>conjunto</b> são Relíquias: qualquer classe usa. Drops de arma favorecem os tipos que sua equipe atual consegue usar.</p>
        <div class="wiki-grid wide">${Object.entries(I.weaponTypes).map(([id, w]) => `<div data-wiki-entry><b>${w.icon} ${w.name}</b><small>Classes: ${w.classes ? w.classes.join(', ') : 'todas'}</small><small>Implícito: ${Object.entries(w.implicit).map(([k, v]) => statValue(k, v)).join(', ') || ', '}</small><small>Afixos comuns: ${Object.keys(w.affixW).map(a => D.statNames[I.affixes.find(x => x.id === a)?.stat] || a).join(', ') || 'qualquer'}</small><small class="dim">${I.bases.filter(b => b.wt === id).map(b => b.name).join(', ')}</small></div>`).join('')}</div>
        <h4>Exceções pela história</h4><div class="wiki-grid">${Object.entries(I.heroWeaponExtra).filter(([, l]) => l.length).map(([hid, l]) => `<div data-wiki-entry><b>${esc(D.roster.find(h => h.id === hid)?.name || hid)}</b><small>Também usa: ${l.map(w => I.weaponTypes[w].name).join(', ')}</small></div>`).join('')}</div></article>`; break;
      case 'market': html = `<article class="wiki-art"><h3>Mercado de Jogadores</h3>
        <p>O Mercado tem <b>duas moedas</b>. Em <b>ouro</b>, qualquer jogador negocia itens, cartas e materiais raros, sem dinheiro real: anunciar custa <b>1% do preço</b> (mínimo 50 de ouro) e a venda paga <b>5% de imposto</b>. Esse ouro sai do jogo, o que segura a inflação e mantém os preços com sentido. Compras em ouro caem direto na bolsa; o valor das vendas chega pelo Correio.</p>
        <p><b>Itens vinculados</b> (comprados de NPCs, do Mercador Errante ou do baú das Marcas) não podem ser vendidos a outros jogadores: o que vale no Mercado é o que foi conquistado caçando.</p>
        <h4>Gemas (dinheiro real)</h4>
        <p><b>Gemas</b> são a moeda de dinheiro real: 100 Gemas = R$ 1,00. Entram por <b>depósito</b> (Pix, pelo provedor de pagamento do servidor oficial) e saem por <b>saque</b>. O saldo fica no servidor, nunca no save, e toda movimentação é registrada.</p>
        <p><b>Mercado de Jogadores:</b> anuncie itens (não equipados nem trancados) e cartas por um preço em Gemas. Ao anunciar, o item sai da sua bolsa e fica guardado pelo servidor. Ao vender, você recebe o valor menos a <b>taxa de venda</b>. Quem compra recebe o item no <b>Correio</b> do mercado e resgata para a bolsa. Cancelar devolve o item pelo Correio.</p>
        <p><b>Materiais:</b> Aço Estelar, Oricalco e Adamantina podem ser vendidos em lotes (Tamahagane não). <b>Perfis:</b> clique no nome do vendedor (ou de alguém no ranking) para ver o perfil público: nível, poder, equipe, vendas feitas e todos os anúncios abertos dele. Use os filtros de tipo, espaço, raridade e preço para achar o que procura.</p>
        <p><b>Taxas:</b> venda ${this.marketCfg ? pct(this.marketCfg.feeBps / 10000, 1) : '5%'} (paga pelo vendedor) · saque ${this.marketCfg ? pct(this.marketCfg.withdrawFeeBps / 10000, 1) : '2%'} (mínimo ${this.marketCfg ? gemFmt(this.marketCfg.withdrawMinFee) : 'R$ 1,00'}).</p>
        <p><b>Controles:</b> o valor de vendas em Gemas fica ${this.marketCfg?.holdHours ?? 72}h em análise antes de poder ser sacado; compras entre contas da mesma rede são bloqueadas; preços muito acima da mediana e pares que negociam demais entre si são revisados pela equipe antes do saque.</p>
        <p><b>Segurança:</b> um item só pode ser anunciado depois de ${this.marketCfg?.minItemAgeHours ?? 24}h no seu save do servidor; contas novas ou sinalizadas não negociam; itens impossíveis para o seu progresso são recusados; saques passam por revisão manual. Isso protege quem compra contra itens falsificados.</p>
        <p><b>Por que itens valem:</b> lendários, míticos, conjuntos e cartas são raríssimos por design, aprimoramentos altos arriscam o item e o Mercado mostra o histórico de preço de cada peça.</p></article>`; break;
      case 'refine': {
        const chances = Array.from({ length:15 }, (_, p) => I.upgradeCost({ rarity:'epic', ilvl:1, plus:p, slot:'weapon' }, 99, 'legendary')?.chance ?? 0);
        const fail = (m, t) => { const r = I.refineRule(m, t); return !r?.allowed ? '<span class="dim">não</span>' : r.onFail === 'none' ? 'nada' : r.onFail === 'regress' ? '<b style="color:#ffb05c">−1 nível</b>' : '<b style="color:#ff5d6c">quebra</b>'; };
        html = `<article class="wiki-art"><h3>Refino (+1 a +15)</h3><p>Refinar aumenta muito o poder do item: o atributo principal cresce a cada nível e os afixos também. Em +15 o atributo principal fica <b>×${String(1 + I.REFINE_BONUS[15]).replace('.', ',')}</b>. O limite de refino também depende do nível da Forja.</p>
          <h4>Materiais</h4><div class="wiki-grid wide">${Object.values(I.materials).map(m => `<div data-wiki-entry><b style="color:${m.color}">${esc(m.name)}</b><small>Até +${m.maxTarget}${m.tradeable ? ' · negociável no Mercado' : ''}</small><small>${esc(m.text)}</small></div>`).join('')}</div>
          <h4>Tabela</h4><table class="rank-table"><thead><tr><th>Nível</th><th>Chance</th><th>Bônus</th>${Object.values(I.materials).map(m => `<th>Falha com ${esc(m.short)}</th>`).join('')}</tr></thead><tbody>${chances.map((c, p) => `<tr><td>+${p} → +${p + 1}</td><td>${pct(c)}</td><td>+${Math.round(I.REFINE_BONUS[p + 1] * 100)}%</td>${Object.keys(I.materials).map(m => `<td>${fail(m, p + 1)}</td>`).join('')}</tr>`).join('')}</tbody></table>
          <p class="dim">Quebrar destrói o item. Itens com refino alto são raros e valem muito no Mercado de Jogadores. Onde conseguir: Tamahagane desmontando itens; Aço Estelar em elites, guardiões, baús, chefes, na Fenda e na loja (limite diário); Oricalco em chefes, Invasões Mundiais, andares fundos da Fenda e nas lojas (limite); Adamantina só nas Invasões Mundiais, em chefes no Pesadelo ou acima e na Fenda a partir do andar 25.</p></article>`; break;
      }
      case 'systems': {
        const wb = D.worldBoss, days = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
        html = `<article class="wiki-art"><h3>Atividades</h3><p>Além das caçadas, dungeons e chefes, a Fenda tem atividades paralelas. O menu <b>Aventuras</b> reúne tudo o que está disponível agora.</p>
          <h4>Invasão Mundial (chefe mundial)</h4><p>Duas vezes por dia, no horário de Brasília (${wb.windows.map(w => w.label).join(' e ')}), para quem joga de dia e de noite. <b>Uma tentativa por dia</b>, de ${wb.duration}s. Todo o servidor soma dano no mesmo chefe; as recompensas crescem com o seu dano e com a dificuldade. Nas dificuldades mais altas, a <b>Bênção da Aliança</b> dá mais dano quanto mais jogadores participam (cooperativo).</p>
          <div class="wiki-grid">${wb.tiers.map(t => `<div data-wiki-entry><b>${t.name}</b><small>Poder mínimo ${U.fmt(t.minPower)} · recompensas ×${String(t.reward).replace('.', ',')}${t.ally ? ' · cooperativo' : ''}</small></div>`).join('')}</div>
          <p class="dim">Chefe do dia: ${wb.byDay.map((id, i) => `${days[i]}: ${esc(D.enemies[id].name)}`).join(' · ')}.</p>
          <h4>Expedições</h4><p>Envie até ${D.expeditions.maxHeroes} heróis que estão <b>fora da equipe</b> em missões de ${D.expeditions.durations.join(', ')} horas. Elas correm no servidor, mesmo com o PC desligado, e voltam com ouro, materiais e às vezes cristais. Mais heróis e mais estrelas rendem mais.</p>
          <h4>Quadro de Recompensas</h4><p>Escolha uma caçada a um monstro específico, cumpra jogando normalmente e ganhe <b>Marcas de Caçador</b>, trocadas na loja do quadro: ${D.bountyShop.map(b => esc(b.name)).join(', ')}.</p><h4>Contratos da Guilda</h4><p>Metas no painel lateral (abates, estágios, chefes, encontros). Um novo contrato chega a cada resgate, sem fim: sempre há algo para fazer.</p>
          <h4>Fenda Abissal</h4><p>Torre infinita: cada andar tem uma <b>mutação</b> que muda a luta. ${D.riftMutations.map(m => `<b>${esc(m.name)}</b> (${esc(m.text)})`).join(' · ')}. O melhor andar entra no ranking.</p>
          <h4>Eventos mundiais</h4><p>Calendário fixo (aba <b>Eventos</b>): chuvas de itens, luas de sangue e festivais mudam drops e inimigos por algumas horas. Lendários vêm principalmente de eventos, chefes e Invasões.</p></article>`; break;
      }
      case 'progress': html = `<article class="wiki-art"><h3>Progressão</h3>
        <h4>Nível e classe</h4><p>EXP de combate é dividida apenas entre os 4 heróis da equipe. O nível máximo atual é 100 e a curva de atributos desacelera nos níveis altos; no 100, a EXP vai para o Paragão. Em paralelo, cada combate concede EXP de classe; nível ${PR.JOB_LEVEL} e classe ${PR.JOB_CLASS_LEVEL} liberam a evolução avançada. EXP necessária: ${[1, 5, 10, 20, 30].map(l => `Nv.${l}: ${U.fmt(S().heroXpNext(l))}`).join(' · ')}.</p>
        <h4>Atributos (estilo clássico)</h4><div class="wiki-grid">${Object.values(PR.attributes).map(a => `<div data-wiki-entry><b style="color:${a.color}">${a.short} · ${a.name}</b><small>${a.text}</small></div>`).join('')}</div>
        <h4>Raridade e qualidade</h4><p>${D.heroRarities.map(r => `${r.label}: ×${String(r.mult).replace('.', ',')} atributos, começa com ${{ common:1, rare:2, epic:3, legendary:4 }[r.id]}★`).join(' · ')}. Fragmentos elevam a qualidade: cada ★ extra dá +12% HP/ATK/DEF, sem alterar o limite 100. Custos: ${[1, 2, 3, 4, 5].map(s2 => `${s2}→${s2 + 1}★: ${S().awakenCost(s2, 1).shards}`).join(' · ')}.</p>
        <h4>Conta e talentos</h4><p>A conta sobe de nível com 35% da EXP de combate. Cada nível: 1 ponto de talento e 10 cristais. A cada 3 níveis, o limite das construções aumenta. A Constelação do Laço tem três caminhos (Lâmina, Arcano, Guardião), nós Notáveis, Pedras-chave com efeitos fortes e desvantagens, e nós exclusivos de classe.</p>
        <h4>Treino da equipe (Dojo)</h4><div class="wiki-grid">${Object.values(PR.training).map(t => `<div data-wiki-entry><b>${t.name}</b><small>${t.text}</small></div>`).join('')}</div>
        <h4>Estágios</h4><p>Cada estágio tem 3 ondas + 1 onda de Guardião. Inimigos ficam 20% mais fortes a cada estágio. Estágios múltiplos de 4 têm dois guardiões; o estágio 12 é o desafio final da caçada.</p>
        <h4>Guia do Viajante</h4><ol>${D.guide.map(g => `<li><b>${g.title}</b>: ${g.desc}</li>`).join('')}</ol></article>`; break;
      case 'economy': html = `<article class="wiki-art"><h3>Economia</h3><h4>Construções</h4><div class="wiki-grid wide">${Object.values(D.buildings).map(b => `<div data-wiki-entry><b>${b.icon} ${b.name}</b><small>${b.desc}</small><small>Custo base ${U.fmt(b.baseCost)} ouro · ×${String(b.growth).replace('.', ',')} por nível</small></div>`).join('')}</div>
        <h4>Loja</h4><div class="wiki-grid wide">${[...PR.shop.gold, ...PR.shop.crystal].map(o => `<div data-wiki-entry><b>${o.name}</b><small>${o.text}</small><small>${Object.entries(o.price).map(([k, v]) => `${U.fmt(v)} ${k === 'gold' ? 'ouro (escala com o progresso)' : 'cristais'}`).join('')}</small></div>`).join('')}</div>
        <h4>Contratos</h4><div class="wiki-grid">${D.contracts.map(c => `<div data-wiki-entry><b>${c.title}</b><small>${c.text.replace('{n}', c.n.join('/'))}</small></div>`).join('')}</div>
        <h4>Conquistas</h4><div class="wiki-grid">${D.achievements.map(a => `<div data-wiki-entry><b>${a.title}</b><small>${a.text}</small></div>`).join('')}</div>
        <h4>Desmontagem</h4><p>Comum: ~0,5 Tamahagane/0,5 Éter · Raro: 1,5/1,5 · Épico: 4/5 · Lendário: 9/12 · Mítico: 16/26 · Conjunto: 8/14 (escala com o nível e o aprimoramento).</p>
        <h4>Recursos são escassos de propósito</h4><p>Cristais vêm de marcos (primeiras vitórias, conquistas, crônicas, login) em pequenas quantidades; uma chave custa 150 cristais. Fragmentos de herói vêm só de convocações repetidas (2/4/8/16 conforme a raridade) e de ofertas raras do Mercado do Porto. Aprimorar acima de +3 pode falhar, e acima de +10 a falha faz o item perder 1 nível.</p>
        <h4>Rank da Guilda</h4><p>Cada contrato resgatado dá experiência à Guilda. O rank não tem limite: contratos ficam maiores, mais difíceis e mais valiosos a cada rank.</p></article>`; break;
    }
    return `<div class="wiki-search">${search}</div><div class="wiki-body">${html}</div>`;
  };

  // ---------------------------------------------------------------------------
  // AÇÕES
  // ---------------------------------------------------------------------------
  P.handleInput = function(e) {
    const t = e.target;
    if (t.id === 'summon-class' && e.type === 'change') { this.summonClass = t.value; this.refreshPanel(); return; }
    if (t.id === 'hf-q') { this.heroFilterState().q = t.value; clearTimeout(this.hfTimer); this.hfTimer = setTimeout(() => { const pos = t.selectionStart; this.refreshPanel(); const n = this.el.modalBody.querySelector('#hf-q'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 180); return; }
    if (['hf-cls', 'hf-el', 'hf-sort', 'hf-free'].includes(t.id) && e.type === 'change') { const f = this.heroFilterState(); f[t.id.slice(3)] = t.type === 'checkbox' ? t.checked : t.value; this.refreshPanel(); return; }
    if (t.id === 'wiki-search') { this.wikiQuery = t.value; const q = t.value.trim().toLocaleLowerCase('pt-BR'); this.el.modalBody.querySelectorAll('[data-wiki-entry]').forEach(n => { n.hidden = !!q && !n.textContent.toLocaleLowerCase('pt-BR').includes(q); }); }
    if (t.id === 'auto-salvage' && e.type === 'change') { this.cmd('setSetting', 'autoSalvage', t.value); this.toast(t.value === 'none' ? 'Auto-desmontar desligado.' : `Itens ${t.value === 'common' ? 'comuns' : t.value === 'rare' ? 'comuns e raros' : 'até épicos'} serão desmontados automaticamente.`); }
    if (t.id === 'set-sound' && e.type === 'change') document.querySelector('#sound-btn').click();
    if (t.id === 'set-repeat' && e.type === 'change') this.cmd('setSetting', 'autoRepeat', t.checked);
    if (t.id === 'set-3d' && e.type === 'change') { KT.Three?.setEnabled(t.checked); this.toast(t.checked ? 'Cenário 3D ligado.' : 'Cenário 3D desligado (imagens 2D).'); }
    if (t.id === 'set-fx' && e.type === 'change') { U.safeStorage.set('mythverse-fx', t.checked ? 'intense' : 'calm'); this.toast(t.checked ? 'Efeitos intensos ligados.' : 'Combate suave: sem tremor e com menos brilho.'); }
    if (t.id === 'set-hud' && e.type === 'change') { this.setHudFull(t.checked); this.toast(t.checked ? 'HUD completo: todos os painéis visíveis.' : 'HUD limpo: só o essencial na tela.'); }
    if (t.id === 'set-points' && e.type === 'change') { this.cmd('setSetting', 'autoPoints', t.checked); this.toast(t.checked ? 'Pontos serão distribuídos sozinhos ao subir de nível.' : 'Distribuição automática desligada: distribua na ficha do herói.'); }
    if (t.id === 'equip-target-other' && e.type === 'change' && t.value) { this.equipTarget = t.value; this.refreshPanel(); }
    if (t.id === 'inv-usable' && e.type === 'change') { this.invFilter.usable = t.checked; this.refreshPanel(); }
    if ((t.id === 'mkt-slot' || t.id === 'mkt-rarity') && e.type === 'change') { this.mktFilter[t.id === 'mkt-slot' ? 'slot' : 'rarity'] = t.value; this.loadMarket(true); }
    if (t.id === 'mkt-search' && e.type === 'change') { this.mktFilter.q = t.value.trim().slice(0, 40); this.loadMarket(true); }
    if (t.id === 'sell-price' && e.type === 'input') { this.sellPrice = t.value; const v = Math.floor(Number(t.value)) || 0, fee = Math.ceil(v * (this.marketCfg?.feeBps || 500) / 10000), out = this.el.modalBody.querySelector('#sell-preview'); if (out) { const cfg = this.marketCfg || {}; if (this.mktCurrency() === 'gold') { const tax = Math.ceil(v * (cfg.goldTaxBps || 500) / 10000), lf = Math.max(cfg.goldListFeeMin || 50, Math.ceil(v * (cfg.goldListFeeBps || 100) / 10000)); out.innerHTML = `Você paga <b>${U.fmt(lf)} de ouro</b> para anunciar e recebe <b>${U.fmt(Math.max(0, v - tax))} de ouro</b> quando vender (imposto ${U.fmt(tax)}).`; } else out.innerHTML = `Você recebe <b>${U.fmt(Math.max(0, v - fee))} gemas</b> (${gemFmt(Math.max(0, v - fee))}) · taxa ${U.fmt(fee)} gemas.`; } }
  };

  // Toda ação que muda o estado passa por this.cmd: no servidor oficial ela é validada e executada lá;
  // no modo offline roda direto no motor.
  P.cmd = function(op, ...args) {
    if (this.session?.mode === 'neon' && ['marketList', 'marketBuyGold', 'marketClaim'].includes(op)) return KT.NeonMarket.act(this.engine, op, args).then(r => { if (!r.ok && r.error) this.toast(esc(r.error)); this.renderResources(); return r.ok ? r.result : false; });
    if (KT.Server?.enabled) return KT.Server.act(op, args).then(r => { if (!r.ok && r.error) this.toast(esc(r.error)); return r.ok ? r.result : false; });
    try { return Promise.resolve(this.engine[op](...args)); } catch (err) { console.warn(err); return Promise.resolve(false); }
  };
  P.handleAction = function(ev) {
    const b = ev.target.closest('button,[data-talent-node],[data-remove],[data-hero]'); if (!b) return;
    if (this.socialAction?.(b)) return;
    if (b.dataset.hfRarity) { this.heroFilterState().rarity = b.dataset.hfRarity; this.refreshPanel(); return; }
    const d = b.dataset, e = this.engine, s = this.state;
    const refresh = () => { this.refreshPanel(); this.renderResources(); };
    const c = (op, ...a) => this.cmd(op, ...a);
    const busy = b.tagName === 'BUTTON' ? b : null;
    const run = (op, args, then) => { if (busy) busy.disabled = true; return c(op, ...args).then(r => { then?.(r); refresh(); }).finally(() => { if (busy) busy.disabled = false; }); };
    if (d.remove) { ev.stopPropagation(); run('removeFromParty', [d.remove], () => { this.selectedSlot = s.formation.indexOf(null) >= 0 ? s.formation.indexOf(null) : this.selectedSlot; this.dockKey = ''; }); return; }
    if (d.go) { const [p, param] = d.go.split(':'); this.openPanel(p, param); if (p === 'journey' && param && !KT.Map3D?.r) setTimeout(() => this.el.modalBody?.querySelector('.journey-card.focus')?.scrollIntoView({ block:'center', behavior:'smooth' }), 700); return; }
    if (b.hasAttribute('data-neon-save')) { const local = this.engine.save(); KT.Neon.flush().then(ok => this.toast(ok && local ? 'Progresso salvo na sua conta.' : 'Não foi possível confirmar o save agora.', ok && local ? 'gold' : 'red')); return; }
    if (b.hasAttribute('data-neon-logout')) { this.engine.save(); KT.Neon.queue(this.state); KT.Neon.signOut().then(() => location.reload()); return; }
    if (d.tabGo) { this.view.tab = d.tabGo; this.refreshPanel(true); return; }
    if (d.previewZone) { this.view.stage = null; this.view.floor = null; this.view.tier = null; this.openPanel('destination', d.previewZone); return; }
    if (d.pickStage) { this.view.stage = Number(d.pickStage); this.refreshPanel(); return; }
    if (d.pickFloor) { this.view.floor = Number(d.pickFloor); this.refreshPanel(); return; }
    if (d.pickTier !== undefined) { this.view.tier = Number(d.pickTier); this.refreshPanel(); return; }
    if (d.enter) { const opts = d.opts ? JSON.parse(d.opts) : {}; if (d.enter === 'village') { e.enterZone('village'); if (KT.Server?.enabled) c('goVillage'); this.closeModal(); this.el.result.hidden = true; return; } if (e.enterZone(d.enter, opts)) { this.closeModal(); this.el.result.hidden = true; } return; }
    if (d.claimGuide !== undefined) { run('claimGuide', [], r => { if (r) this.callbacks.reward?.(); this.guideHtml = ''; this.renderGuide(); }); return; }
    if (d.claimContract !== undefined) { run('claimContract', [Number(d.claimContract)], r => { if (r) this.callbacks.reward?.(); this.contractKey = ''; this.renderContracts(); }); return; }
    if (d.claimAch) { run('claimAchievement', [d.claimAch], r => { if (r) this.callbacks.reward?.(); }); return; }
    if (d.result) { this.el.result.hidden = true; e.autoAfterResult = null; if (d.result === 'retry') e.repeatRun(); else if (d.result === 'hunt') e.fallbackToHunt(); else if (d.result === 'city') { e.enterZone('village'); if (KT.Server?.enabled) c('goVillage'); } else if (d.result === 'map') { e.fallbackToHunt(); this.openPanel('journey'); } return; }
    if (d.choice) { this.el.choice.hidden = true; e.input('choice', d.choice); return; }
    if (b.hasAttribute('data-open-box')) {
      const box = d.openBox || 'worlds', n = Math.min(10, Math.max(1, Number(d.n) || 1)), cls = box === 'class' ? (this.el.modalBody.querySelector('#summon-class')?.value || 'Executor') : null;
      run('openBoxes', [n, box, cls], got => { if (got && got.length) { this.closeModal(); this.showReveal(got); if (!s.story.seen.intro2) c('markSeen', 'intro2'); } else this.toast(esc(e.lastError || 'Chaves insuficientes.')); });
      return;
    }
    if (d.slot !== undefined) { this.selectedSlot = Number(d.slot); refresh(); return; }
    if (d.assign) { run('setParty', [this.selectedSlot, d.assign], ok2 => { if (ok2) { const nx = s.formation.indexOf(null); this.selectedSlot = nx >= 0 ? nx : this.selectedSlot; this.dockKey = ''; if (e.heroes.length === 4) this.callbacks.reward?.(); } }); return; }
    if (d.hero && this.view.panel !== 'hero') { this.openPanel('hero', d.hero); return; }
    if (d.hero && this.view.panel === 'hero' && d.hero !== this.view.param) { this.openPanel('hero', d.hero); return; }
    if (d.attr) { run('addAttr', [this.view.param, d.attr, Number(d.n || 1)]); return; }
    if (d.attrReset) { run('resetAttr', [d.attrReset], r => { if (!r) this.toast('Ouro insuficiente.'); }); return; }
    if (d.awaken) { run('awaken', [d.awaken], r => { if (!r) this.toast('Fragmentos ou ouro insuficientes.'); else this.callbacks.summon?.('epic'); }); return; }
    if (d.scroll) { run('useScroll', [d.scroll]); return; }
    if (d.pickSlot) { this.pickSlot = this.pickSlot === d.pickSlot ? null : d.pickSlot; this.refreshPanel(); return; }
    if (d.equip) { run('equip', [this.view.param, d.equip], () => { this.pickSlot = null; this.callbacks.click?.(); }); return; }
    if (d.unequip) { run('unequip', [d.unequipHero || this.view.param, d.unequip], r => { if (r) this.toast('Item removido e guardado no <b>Armazém</b> (Bolsa → Armazém).'); }); return; }
    if (d.equipTarget) { const to = this.equipTargetUid(); if (!to) { this.toast('Monte a equipe primeiro.'); return; } run('equip', [to, d.equipTarget], r => { if (r) { this.toast(`Equipado em <b>${esc(e.template(e.record(to).id).name)}</b>.`); this.callbacks.click?.(); } }); return; }
    if (d.equipTo) { this.equipTarget = d.equipTo; this.heroPickerOpen = false; refresh(); return; }
    if (b.hasAttribute('data-hero-picker')) { this.heroPickerOpen = !this.heroPickerOpen; this.refreshPanel(); return; }
    if (d.auto) {
      const uid = d.uid, name = esc(e.template(e.record(uid).id).name);
      const msg = { attr:n => n ? `${name}: ${n} ponto(s) de atributo distribuídos.` : 'Sem pontos de atributo livres.', talents:n => n ? `${name}: ${n} talento(s) aprendidos.` : 'Sem talentos disponíveis agora.', items:n => n ? `${name}: ${n} item(ns) equipados.` : 'Nenhum item melhor na bolsa.', all:r => r ? `${name}: ${r.attr} atributo(s), ${r.talents} talento(s) e ${r.items} item(ns) aplicados.` : 'Nada a aplicar.' };
      const op = { attr:'autoAttr', talents:'autoTalents', items:'autoEquip', all:'autoBuild' }[d.auto];
      run(op, [uid], r => { this.toast(msg[d.auto](r), d.auto === 'all' ? 'gold' : ''); this.callbacks.reward?.(); });
      return;
    }
    if (d.advice !== undefined) {
      const tip = this.adviceCache?.[Number(d.advice)]; if (!tip) return;
      if (tip.action === 'open') { const [p2, prm] = tip.go.split(':'); this.openPanel(p2, tip.uid || prm); return; }
      if (tip.action === 'farm') { this.cmd('setSetting', 'autoAdvance', false).then(() => { e.enterZone(tip.zone, { stage:tip.stage }); this.closeModal(); }); return; }
      const op = { autoAttr:'autoAttr', autoTalents:'autoTalents', autoEquip:'autoEquip', awaken:'awaken' }[tip.action];
      if (op) run(op, [tip.uid], r => this.toast(r ? 'Feito!' : 'Não foi possível agora.', r ? 'gold' : ''));
      return;
    }
    if (d.claimDaily !== undefined) { run('claimDaily', [Number(d.claimDaily)], r => { if (r) this.callbacks.reward?.(); }); return; }
    if (b.hasAttribute('data-claim-login')) { run('claimLogin', [], r => { if (r) { this.toast(`Login do dia ${r.day}: ${this.rewardPills(r.reward)}`, 'gold'); this.callbacks.reward?.(); } this.guideHtml = ''; this.renderGuide(); }); return; }
    if (b.hasAttribute('data-claim-chronicle')) { run('claimChronicle', [], r => { if (r) this.callbacks.reward?.(); this.guideHtml = ''; this.renderGuide(); }); return; }
    if (d.sellItem) { this.sellSel = d.sellItem; this.sellPrice = ''; this.openPanel('shop', 'p2p'); return; }
    if (b.hasAttribute('data-sell-clear')) { this.sellSel = null; refresh(); return; }
    if (b.hasAttribute('data-mkt-refresh')) { this.loadMarket(true); return; }
    if (d.mktType) { this.mktFilter.type = d.mktType; this.loadMarket(true); return; }
    if (d.mktCur) { this.mktFilter.currency = d.mktCur; this.priceHistory = {}; this.refreshPanel(); return; }
    if (d.buyGold) {
      const price = Number(d.price), id = Number(d.buyGold);
      this.ask('Comprar com ouro', `Comprar <b>${esc(d.name || 'este anúncio')}</b> por <b>${U.fmt(price)} de ouro</b>? A compra é definitiva e o item vai direto para a sua bolsa.`, [{ id:'yes', label:'Comprar', primary:true }, { id:'no', label:'Cancelar' }])
        .then(x => { if (x === 'yes') run('marketBuyGold', [id], r => { if (r) { if (r.kind === 'item') this.newItems++; this.toast(r.delivered === 'bag' ? 'Compra concluída: já está na sua bolsa!' : 'Compra concluída: resgate no Correio.', 'gold'); this.loadMarket(true); if (this.profiles) this.profiles = {}; } }); });
      return;
    }
    if (d.mktSort) { this.mktFilter.sort = d.mktSort; this.loadMarket(true); return; }
    if (d.listItem) {
      const price = Math.floor(Number(this.el.modalBody.querySelector('#sell-price')?.value)); const it = s.inventory.find(x => x.uid === d.listItem);
      if (!it || !(price > 0)) { this.toast('Informe um preço válido.'); return; }
      this.ask('Anunciar no Mercado', `Anunciar <b>${esc(it.name)}</b> por <b>${this.priceLabel(price)}</b>?${this.listFeeNote(price)} O item sai da sua bolsa até vender ou você cancelar.`, [{ id:'yes', label:'Anunciar', primary:true }, { id:'no', label:'Cancelar' }])
        .then(x => { if (x === 'yes') c('marketList', { kind:'item', itemUid:it.uid, price, currency:this.mktCurrency() }).then(r => { if (r) { this.sellSel = null; this.toast('Anunciado!', 'gold'); this.loadMarket(true); } refresh(); }); });
      return;
    }
    if (b.hasAttribute('data-list-card')) {
      const cardId = this.el.modalBody.querySelector('#sell-card')?.value, price = Math.floor(Number(this.el.modalBody.querySelector('#sell-card-price')?.value));
      if (!cardId || !(price > 0)) { this.toast('Escolha a carta e um preço válido.'); return; }
      this.ask('Anunciar carta', `Anunciar <b>${esc(I.cardById(cardId).name)}</b> por <b>${this.priceLabel(price)}</b>?${this.listFeeNote(price)}`, [{ id:'yes', label:'Anunciar', primary:true }, { id:'no', label:'Cancelar' }])
        .then(x => { if (x === 'yes') c('marketList', { kind:'card', cardId, price, currency:this.mktCurrency() }).then(r => { if (r) { this.toast('Carta anunciada!', 'gold'); this.loadMarket(true); } refresh(); }); });
      return;
    }
    if (b.hasAttribute('data-list-mat')) {
      const matId = this.el.modalBody.querySelector('#sell-mat')?.value, qty = Math.floor(Number(this.el.modalBody.querySelector('#sell-mat-qty')?.value)), price = Math.floor(Number(this.el.modalBody.querySelector('#sell-mat-price')?.value));
      if (!matId || !(qty > 0) || !(price > 0)) { this.toast('Escolha o material, a quantidade e o preço.'); return; }
      c('marketList', { kind:'mat', matId, qty, price, currency:this.mktCurrency() }).then(r => { if (r) { this.toast('Material anunciado!', 'gold'); this.loadMarket(true); } refresh(); });
      return;
    }
    if (d.buyListing) { const price = Number(d.price); this.ask('Comprar', `Comprar este anúncio por <b>${U.fmt(price)} gemas</b> (${gemFmt(price)})? A compra é definitiva.`, [{ id:'yes', label:'Comprar', primary:true }, { id:'no', label:'Cancelar' }]).then(x => { if (x === 'yes') KT.Net.buyListing(Number(d.buyListing)).then(r => { this.toast(r.ok ? 'Comprado! Resgate no Correio.' : esc(r.error), r.ok ? 'gold' : ''); this.loadMarket(true); }); }); return; }
    if (d.cancelListing) { MKT(this).cancelListing(Number(d.cancelListing)).then(r => { this.toast(r.ok ? 'Anúncio cancelado: o item está no Correio.' : esc(r.error)); this.loadMarket(true); }); return; }
    if (d.claimMail) { run('marketClaim', [Number(d.claimMail)], r => { if (r) { if (r.kind === 'item') this.newItems++; this.toast('Resgatado do Correio!', 'gold'); this.loadMarket(true); } }); return; }
    if (d.seller) { this.openPanel('profile', d.seller); return; }
    if (b.hasAttribute('data-deposit')) { const v = Math.round(Number(this.el.modalBody.querySelector('#dep-amount')?.value) * 100); KT.Net.deposit(v).then(r => { const out = this.el.modalBody.querySelector('#dep-out'); if (!r.ok) { this.toast(esc(r.error)); return; } if (r.credited) { this.toast('Depósito creditado (modo de teste).', 'gold'); this.loadMarket(true); return; } if (out) out.innerHTML = `<div class="recovery-code">${r.pixCopyPaste ? `<code>${esc(r.pixCopyPaste)}</code>` : ''}${r.checkoutUrl ? `<a class="action primary" href="${esc(r.checkoutUrl)}" target="_blank" rel="noopener">Abrir pagamento</a>` : ''}</div><p class="note">O saldo entra assim que o provedor confirmar o pagamento.</p>`; }); return; }
    if (b.hasAttribute('data-withdraw')) { const v = Math.round(Number(this.el.modalBody.querySelector('#wd-amount')?.value) * 100), key = this.el.modalBody.querySelector('#wd-key')?.value, pw = this.el.modalBody.querySelector('#wd-pass')?.value; this.ask('Solicitar saque', `Sacar <b>${gemFmt(v)}</b> para a chave Pix informada? O valor fica reservado até a revisão.`, [{ id:'yes', label:'Solicitar', primary:true }, { id:'no', label:'Cancelar' }]).then(x => { if (x === 'yes') KT.Net.withdraw({ amount:v, pixKey:key, password:pw }).then(r => { this.toast(r.ok ? 'Saque solicitado. Acompanhe na carteira.' : esc(r.error), r.ok ? 'gold' : ''); this.loadMarket(true); }); }); return; }
    if (d.lock) { run('toggleLock', [d.lock]); return; }
    if (d.salvage) { run('salvage', [d.salvage], v => { if (v) this.toast(`Desmontado: +${v.ore} Tamahagane, +${v.dust} Éter.`); }); return; }
    if (d.salvageAll) { run('salvageMany', [d.salvageAll], t => { this.toast(t && t.n ? `${t.n} itens desmontados: +${t.ore} Tamahagane, +${t.dust} Éter, +${U.fmt(t.gold)} ouro.` : 'Nada para desmontar.'); }); return; }
    if (d.forgeMat) { this.forgeMat = d.forgeMat; this.refreshPanel(); return; }
    if (d.forgeItem) { this.forgeSel = d.forgeItem; if (this.view.panel !== 'city') this.openPanel('city', 'forge'); else this.refreshPanel(); return; }
    if (d.upgrade && d.confirm && !d.confirmed) { KT.askBox('Refino arriscado', esc(d.confirm), [{ id:'no', label:'Cancelar' }, { id:'yes', label:'Refinar mesmo assim', danger:true }]).then(r => { if (r === 'yes') { b.dataset.confirmed = '1'; b.click(); } }); return; }
    if (d.upgrade) { run('upgradeItem', [d.upgrade, d.mat || 'common'], r => { if (!r) return; if (r.ok) { this.toast(`Refinado para <b>+${r.plus}</b>!`, 'gold'); this.callbacks.reward?.(); } else this.toast(esc(r.reason)); }); return; }
    if (d.enchant) { run('enchantItem', [d.enchant, Number(d.aff)], r => { if (r) this.callbacks.click?.(); else this.toast('Recursos insuficientes.'); }); return; }
    if (d.craft) { run('craft', [d.craft], r => this.toast(r ? 'Criado!' : 'Recursos insuficientes.')); return; }
    if (d.talentHero) { this.view.talentHero = d.talentHero; this.view.param = d.talentHero; this.view.node = null; refresh(); return; }
    if (d.talentNode) { this.view.node = d.talentNode; this.refreshPanel(); return; }
    if (d.learn) { run('addHeroTalent', [this.view.param, d.learn], r => { if (r) this.callbacks.click?.(); }); return; }
    if (d.heroTalentReset) { this.ask('Redefinir talentos', 'Devolver todos os pontos de talento deste herói?', [{ id:'yes', label:'Redefinir', primary:true }, { id:'no', label:'Cancelar' }]).then(x => { if (x === 'yes') run('resetHeroTalents', [d.heroTalentReset], r => { if (!r) this.toast('Ouro insuficiente.'); }); }); return; }
    if (d.job) { const rec = e.record(d.job), jb = PR.jobs[e.template(rec.id).cls][d.branch === 'b' ? 'b' : 'a']; this.ask('Classe avançada', `Tornar-se <b>${esc(jb.name)}</b>? ${esc(jb.text)} A escolha é permanente.`, [{ id:'yes', label:'Escolher', primary:true }, { id:'no', label:'Cancelar' }]).then(x => { if (x !== 'yes') return; run('jobChange', [d.job, d.branch === 'b' ? 'b' : 'a'], r => { if (r) { this.callbacks.summon?.('legendary'); this.renderer.showBanner('CLASSE AVANÇADA', jb.name, '#d8b062'); } else this.toast('Requisitos não atendidos.'); }); }); return; }
    if (d.transcend) { const rec = e.record(d.transcend); run('transcend', [d.transcend], r => { if (r) { this.callbacks.summon?.('legendary'); this.renderer.showBanner('TRANSCENDÊNCIA', PR.jobTitle(e.template(rec.id).cls, rec), '#d8b062'); } else this.toast('Requisitos não atendidos.'); }); return; }
    if (d.socket) { const it = s.inventory.find(x => x.uid === d.socket); if (!it) return; run('socketCard', [d.socket, it.cards.indexOf(null), d.card], r => { if (r) { this.toast('Carta encaixada!', 'gold'); this.callbacks.reward?.(); } }); return; }
    if (d.cardItem) { this.cardSel = d.cardItem; this.refreshPanel(); return; }
    if (d.houseSlot !== undefined) { this.houseSlot = Number(d.houseSlot); this.refreshPanel(); return; }
    if (d.displayCard) { run('displayCard', [d.displayCard, Number(d.gallerySlot)], r => { if (r) { this.houseSlot = null; this.toast('Carta exposta na Galeria: a equipe inteira ficou mais forte.', 'gold'); this.callbacks.reward?.(); } }); return; }
    if (d.removeDisplay !== undefined) { run('removeDisplay', [Number(d.removeDisplay)], () => {}); return; }
    if (d.unsocket) { run('unsocketCard', [d.unsocket, Number(d.idx)], r => { if (!r) this.toast('Cristais insuficientes.'); }); return; }
    if (b.hasAttribute('data-sync-now')) { if (KT.Server?.enabled) KT.Server.flush().then(r => { this.toast(r.ok ? 'Progresso salvo no servidor.' : 'Não foi possível confirmar o save agora.', r.ok ? 'gold' : 'red'); refresh(); }); else { const ok = e.save(); this.toast(ok ? 'Progresso salvo.' : 'Não foi possível salvar neste navegador.', ok ? 'gold' : 'red'); } return; }
    if (b.hasAttribute('data-logout')) { (KT.Server?.enabled ? KT.Server.flush() : Promise.resolve()).finally(() => KT.Net.logout().then(() => location.reload())); return; }
    if (b.hasAttribute('data-logout-all')) { KT.Net.logoutAll().then(r => this.toast(r.ok ? 'Outras sessões encerradas.' : esc(r.error))); return; }
    if (b.hasAttribute('data-change-pw')) { const cur = this.el.modalBody.querySelector('#pw-current').value, nx = this.el.modalBody.querySelector('#pw-next').value; KT.Net.changePassword({ current:cur, next:nx }).then(r => this.toast(r.ok ? 'Senha alterada. Outras sessões foram encerradas.' : esc(r.error))); return; }
    if (b.hasAttribute('data-new-recovery')) { KT.Net.newRecovery(this.el.modalBody.querySelector('#rc-pass').value).then(r => { const out = this.el.modalBody.querySelector('#rc-out'); if (r.ok) out.innerHTML = `<div class="recovery-code"><code>${esc(r.recoveryCode)}</code></div><p class="note">Guarde este código: ele não será mostrado de novo.</p>`; else this.toast(esc(r.error)); }); return; }
    if (b.hasAttribute('data-load-history')) { KT.Net.history().then(r => { const out = this.el.modalBody.querySelector('#history-out'); out.innerHTML = r.ok ? (r.history.length ? `<ul class="history-list">${r.history.map(h => `<li>${new Date(h.created_at).toLocaleString('pt-BR')} · rev. ${h.revision}<button class="action small" data-restore="${h.id}" type="button">Restaurar</button></li>`).join('')}</ul>` : '<p class="dim">Nenhuma cópia ainda.</p>') : esc(r.error); }); return; }
    if (d.restore) { this.ask('Restaurar cópia', 'O progresso atual será substituído por esta cópia (o atual também vira uma cópia). Continuar?', [{ id:'yes', label:'Restaurar', primary:true }, { id:'no', label:'Cancelar' }]).then(x => { if (x !== 'yes') return; KT.Server.flush().then(() => KT.Net.restore(Number(d.restore))).then(r => { if (r.ok) location.reload(); else this.toast(esc(r.error)); }); }); return; }
    if (b.hasAttribute('data-delete-account')) { const pw = this.el.modalBody.querySelector('#del-pass').value, cf = this.el.modalBody.querySelector('#del-confirm').value; this.ask('Excluir conta', 'Isso apaga sua conta, save e histórico para sempre. Não dá para desfazer.', [{ id:'yes', label:'Excluir tudo', danger:true }, { id:'no', label:'Cancelar', primary:true }]).then(x => { if (x !== 'yes') return; KT.Net.deleteAccount({ password:pw, confirm:cf }).then(r => { if (r.ok) location.reload(); else this.toast(esc(r.error)); }); }); return; }
    if (d.train) { run('train', [d.train], r => { if (!r) this.toast('Ouro insuficiente ou limite atingido.'); else this.callbacks.click?.(); }); return; }
    if (d.build) { run('upgradeBuilding', [d.build], r => { if (!r) this.toast('Ouro insuficiente ou limite de nível.'); }); return; }
    if (d.buy) { run('buy', [d.buy], r => { if (r) { this.toast('Compra realizada!', 'gold'); this.callbacks.reward?.(); } else this.toast('Recursos insuficientes.'); }); return; }
    if (d.market !== undefined) { run('buyMarket', [Number(d.market)], r => { if (r) this.toast('Comprado!', 'gold'); }); return; }
    if (d.invSlot) { this.invFilter.slot = d.invSlot; this.refreshPanel(); return; }
    if (d.invSort) { this.invFilter.sort = d.invSort; this.refreshPanel(); return; }
    if (d.invTab) { this.invFilter.tab = d.invTab; this.refreshPanel(); return; }
    if (b.hasAttribute('data-auto-team')) { run('autoTeam', [], n => { if (n) { this.toast(`<b>Equipe montada!</b> ${n} heróis: frente e retaguarda no lugar certo.`, 'gold'); this.dockKey = ''; this.callbacks.reward?.(); } else this.toast(esc(e.lastError || 'Não foi possível montar a equipe agora (saia da luta).')); }); return; }
    if (b.hasAttribute('data-optimize')) { this.optimizeTeam(); return; }
    if (b.hasAttribute('data-coach-restart')) { this.coachRestart(); return; }
    if (d.store) { run('storeItem', [d.store], r => { if (!r) this.toast(esc(e.lastError || 'Não foi possível guardar.')); }); return; }
    if (d.storeMany) { run('storeMany', [d.storeMany], n => this.toast(n ? `${n} item(ns) guardados no Armazém.` : 'Nada para guardar (ou o Armazém está cheio).')); return; }
    if (d.retrieve) { run('retrieveItem', [d.retrieve], r => { if (!r) this.toast(esc(e.lastError || 'A bolsa está cheia.')); }); return; }
    if (d.buyDecor) { run('buyDecor', [d.buyDecor], r => { if (!r) this.toast(esc(e.lastError || 'Cristais insuficientes.')); else this.callbacks.reward?.(); }); return; }
    if (d.takeOverflow !== undefined) { run('takeOverflow', d.takeOverflow ? [d.takeOverflow] : [], n => this.toast(n ? `${n} item(ns) trazidos para a bolsa.` : 'A bolsa está cheia.')); return; }
    if (d.salvageOverflow) { run('salvageOverflow', [d.salvageOverflow], t => this.toast(t?.n ? `${t.n} itens desmontados: +${t.ore} Tamahagane, +${t.dust} Éter.` : 'Nada para desmontar.')); return; }
    if (d.useItem) { run('useItem', [d.useItem]); return; }
    if (b.hasAttribute('data-claim-wb')) { run('claimWorldBoss', [], r => { if (r) { this.toast(`<b>Invasão:</b> ${r.killed ? 'a comunidade derrubou o chefe!' : 'o chefe resistiu desta vez.'} +${U.fmt(r.gold)} ouro, +${r.crystal} cristais${r.items?.length ? `, ${r.items.map(esc).join(', ')}` : ''}.`, 'gold'); this.callbacks.reward?.(); } }); return; }
    if (d.expZone) { this.expSel.zone = d.expZone; this.refreshPanel(); return; }
    if (d.expHours) { this.expSel.hours = Number(d.expHours); this.refreshPanel(); return; }
    if (d.expHero) { const u = this.expSel.uids, i = u.indexOf(d.expHero); if (i >= 0) u.splice(i, 1); else if (u.length < D.expeditions.maxHeroes) u.push(d.expHero); this.refreshPanel(); return; }
    if (b.hasAttribute('data-exp-start')) { const sel = this.expSel; run('startExpedition', [sel.zone, sel.hours, sel.uids.slice()], r => { if (r) { this.toast('Expedição a caminho!', 'gold'); sel.uids = []; } }); return; }
    if (d.claimExp) { run('claimExpedition', [d.claimExp], r => { if (r) { this.toast(`Expedição voltou: +${U.fmt(r.gold)} ouro, +${r.ore} Tamahagane, +${r.dust} Éter${r.items?.length ? `, ${r.items.length} item(ns)` : ''}.`, 'gold'); this.callbacks.reward?.(); } }); return; }
    if (d.bountyAccept !== undefined) { run('acceptBounty', [Number(d.bountyAccept)]); return; }
    if (b.hasAttribute('data-bounty-abandon')) { this.ask('Abandonar caçada', 'O progresso desta caçada será perdido.', [{ id:'yes', label:'Abandonar', danger:true }, { id:'no', label:'Cancelar', primary:true }]).then(x => { if (x === 'yes') run('abandonBounty', []); }); return; }
    if (b.hasAttribute('data-bounty-claim')) { run('claimBounty', [], r => { if (r) { this.toast(`Caçada concluída: +${r.points} Marcas de Caçador!`, 'gold'); this.callbacks.reward?.(); } }); return; }
    if (b.hasAttribute('data-bounty-refresh')) { run('ensureBounties', []); return; }
    if (d.bountyBuy) { run('buyBountyItem', [d.bountyBuy], r => this.toast(r ? 'Trocado!' : 'Marcas insuficientes.', r ? 'gold' : '')); return; }
    if (b.hasAttribute('data-save-name')) { const name = this.el.modalBody.querySelector('#player-name-entry')?.value || ''; run('setName', [name.slice(0, 40)], r => this.toast(r ? 'Nome salvo.' : 'Nome inválido.')); return; }
    if (b.hasAttribute('data-save')) { if (KT.Server?.enabled) KT.Server.flush().then(r => this.toast(r.ok ? 'Progresso salvo no servidor.' : 'Não foi possível confirmar o save agora.', r.ok ? 'gold' : 'red')); else { const ok = e.save(); this.toast(ok ? 'Progresso salvo.' : 'Não foi possível salvar neste navegador.', ok ? 'gold' : 'red'); } return; }
    if (b.hasAttribute('data-reset-save')) {
      if (this.session?.mode === 'cloud') { this.toast('Para recomeçar uma conta online, fale com o suporte (o progresso fica protegido no servidor).'); return; }
      this.ask('Recomeçar do zero', 'Apagar TODO o progresso deste navegador?', [{ id:'yes', label:'Apagar e recomeçar', danger:true }, { id:'no', label:'Cancelar', primary:true }]).then(x => { if (x !== 'yes') return; e.resetSave(); e.save = () => {}; location.reload(); });
      return;
    }
  };
})();
