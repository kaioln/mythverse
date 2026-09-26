(() => {
  const KT = globalThis.KT;
  const D = KT.Data, U = KT.Utils, I = KT.Items, PR = KT.Progression, S = () => KT.State;
  const P = KT.UIController.prototype;
  const { esc, portrait, fmtTime, compact, KEYS } = KT.UIController.helpers;
  const pct = (v, d = 0) => `${(v * 100).toFixed(d).replace('.', ',')}%`;
  const ROMAN = ['I','II','III'];
  const RORDER = { mythic:0, set:1, legendary:2, epic:3, rare:4, common:5 };
  const rarLabel = id => D.rarities.find(r => r.id === id)?.label || D.heroRarities.find(r => r.id === id)?.label || id;
  const stars = n => `<span class="stars">${'★'.repeat(n)}<span class="off">${'★'.repeat(Math.max(0, 6 - n))}</span></span>`;
  const elTag = el => `<span class="el-tag" style="--ec:${D.elements[el].color}">${D.elements[el].icon} ${el}</span>`;
  const clsTag = cls => `<span class="cls-tag" style="--cc:${D.classes[cls].color}">${D.classes[cls].icon} ${cls}</span>`;

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
    return `<article class="item rarity-${item.rarity} ${opts.selected ? 'selected' : ''} ${owner ? 'equipped' : ''}" ${opts.selectable ? `data-select-item="${item.uid}"` : ''}>
      <div class="item-head">${KT.itemIcon(item)}<div><b class="rtext">${esc(item.name)}${item.plus ? ` <span class="plus">+${item.plus}</span>` : ''}</b><small>${rarLabel(item.rarity)} · ${I.slots[item.slot].name} · Nv. ${item.ilvl}${item.locked ? ' · 🔒' : ''}</small>${owner ? `<small class="owner">Equipado: ${esc(ownerT.name)}</small>` : ''}</div></div>
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
    journey:{ k:'JORNADA', t:'Mapa da Fenda' }, destination:{ k:'DESTINO', t:'Destino' }, party:{ k:'EQUIPE', t:'Formação e Sinergias' },
    hero:{ k:'HERÓI', t:'Ficha do herói', tabs:[['stats','Atributos'], ['talents','Talentos'], ['kit','Habilidades'], ['gear','Equipamento']] },
    collection:{ k:'HERÓIS', t:'Convocação e Coleção', tabs:[['summon','Convocar'], ['owned','Meus heróis'], ['catalog','Catálogo']] },
    inventory:{ k:'BOLSA', t:'Inventário' }, talents:{ k:'TALENTOS', t:'Árvore de Talentos' },
    ranking:{ k:'RANKING', t:'Ranking da Fenda', tabs:[['power','Poder'], ['bosses','Chefes'], ['stage','Progresso']] },
    city:{ k:'CIDADE', t:'Tsukimori', tabs:[['forge','Forja'], ['workshop','Oficina'], ['cards','Cartas'], ['dojo','Dojo'], ['shrine','Santuário'], ['guild','Guilda'], ['buildings','Construções']] },
    shop:{ k:'LOJA', t:'Loja da Fenda', tabs:[['gold','Ouro'], ['crystal','Cristais'], ['market','Mercado'], ['gems','Gemas']] },
    quests:{ k:'MISSÕES', t:'Missões e Conquistas', tabs:[['guide','Guia'], ['contracts','Contratos'], ['achievements','Conquistas']] },
    wiki:{ k:'WIKI', t:'Enciclopédia da Fenda', tabs:[['start','Início'], ['combat','Combate'], ['classes','Classes'], ['elements','Elementos'], ['synergy','Sinergias'], ['heroes','Heróis'], ['trees','Talentos'], ['items','Itens'], ['cards','Cartas'], ['monsters','Monstros'], ['world','Mundo'], ['progress','Progressão'], ['economy','Economia']] },
    record:{ k:'PERFIL', t:'Conta e Configurações' }, help:{ k:'AJUDA', t:'Como jogar' }
  };
  P.openPanel = function(name, param = null) {
    if (name === 'destination' && typeof param === 'string' && param.includes(':')) param = param.split(':')[1];
    const def = PANELS[name] || PANELS.help;
    let tab = null;
    if (def.tabs) tab = def.tabs.some(t => t[0] === param) ? param : (this.view.panel === name && this.view.tab ? this.view.tab : def.tabs[0][0]);
    if (name === 'hero') tab = this.view.panel === 'hero' && this.view.param === param ? this.view.tab : (this.view.panel === 'hero' ? this.view.tab : 'stats');
    if (name === 'talents') { param = param || this.view.talentHero || this.state.formation.find(Boolean) || this.state.collection[0]?.uid || null; this.view.talentHero = param; }
    this.view = { panel:name, tab, param:['hero','destination','talents'].includes(name) ? param : this.view.panel === name ? this.view.param : null, talentHero:this.view.talentHero, node:name === this.view.panel ? this.view.node : null };
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
    if (v.panel === 'hero' || v.panel === 'talents') { const r = this.engine.record(v.param); title = r ? `${v.panel === 'talents' ? 'Talentos · ' : ''}${this.engine.template(r.id).name}` : title; }
    this.el.modalTitle.textContent = title;
    this.el.modalTabs.innerHTML = def.tabs ? def.tabs.map(([id, n]) => `<button class="${id === v.tab ? 'active' : ''}" data-tab="${id}" type="button">${n}</button>`).join('') : '';
    const top = this.el.modalBody.scrollTop;
    const fn = { journey:'journeyPanel', destination:'destinationPanel', party:'partyPanel', hero:'heroPanel', collection:'collectionPanel', inventory:'inventoryPanel', talents:'talentPanel', ranking:'rankingPanel', city:'cityPanel', shop:'shopPanel', quests:'questPanel', wiki:'wikiPanel', record:'recordPanel', help:'helpPanel' }[v.panel] || 'helpPanel';
    this.el.modalBody.innerHTML = this[fn](v.param, v.tab);
    this.el.modalBody.scrollTop = reset ? 0 : top;
    requestAnimationFrame(() => this.el.modalBody.querySelectorAll('[data-sprite-preview]').forEach(cv => this.drawSprite(cv, cv.dataset.spritePreview)));
  };
  P.closeModal = function() { this.el.modal.hidden = true; this.view.panel = null; this.hideTip(); document.querySelectorAll('.nav').forEach(x => x.classList.remove('active')); };
  P.drawSprite = function(cv, id) { const img = this.assets.spriteImage(id); if (!img) return; const ctx = cv.getContext('2d'), r = img.width / img.height, h = Math.min(cv.height - 4, (cv.width - 4) / r), w = h * r; ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(img, (cv.width - w) / 2, cv.height - h - 2, w, h); };

  // ---------------------------------------------------------------------------
  // MAPA
  // ---------------------------------------------------------------------------
  P.journeyPanel = function() {
    const pins = { village:[46,43], hunt:[48,16], dungeon:[17,38], boss:[13,12], hunt_tide:[66,40], dungeon_tide:[75,73], boss_tide:[87,14], boss_event:[44,74] };
    const labels = { village:'Tsukimori', hunt:'Bosque', hunt_tide:'Costa', dungeon:'Templo', dungeon_tide:'Arquivo', boss:'Eclipse', boss_tide:'Mizuchi', boss_event:'Festival' };
    const status = id => {
      const z = D.zones[id], p = this.state.progress[id], lock = this.engine.zoneLock(id);
      if (lock.locked) return { cls:'locked', txt:'🔒 Bloqueado' };
      if (z.kind === 'hunt') return { cls:p.best >= z.stages ? 'done' : '', txt:`Estágio ${p.best}/${z.stages}` };
      if (z.kind === 'dungeon') return { cls:p.best >= z.floors ? 'done' : '', txt:`Andar ${p.best}/${z.floors}` };
      if (z.kind === 'boss') return { cls:p.kills ? 'done' : 'boss', txt:p.kills ? `Derrotado ${p.kills}×` : 'Chefe não derrotado' };
      return { cls:'', txt:'Refúgio' };
    };
    const chapters = [[1, 'Capítulo I · O Eclipse', ['hunt','dungeon','boss']], [2, 'Capítulo II · A Maré', ['hunt_tide','dungeon_tide','boss_tide']], [9, 'Evento', ['boss_event']]];
    return `<div class="map-wrap"><div class="illustrated-map"><img src="assets/scenes/world-map.png" alt="Mapa do mundo">${Object.keys(pins).map(id => { const s = status(id); return `<button class="map-pin ${id === this.state.zone ? 'current' : ''} ${s.cls}" style="left:${pins[id][0]}%;top:${pins[id][1]}%" data-preview-zone="${id}" type="button">${labels[id]}<small>${s.txt}</small></button>`; }).join('')}</div>
      <div class="chapters">${chapters.map(([n, title, ids]) => `<section class="chapter"><h4>${title}</h4><div class="chapter-steps">${ids.map((id, i) => { const z = D.zones[id], s = status(id); return `${i ? '<span class="arrow">→</span>' : ''}<button class="journey-card ${s.cls} ${id === this.state.zone ? 'current' : ''}" data-preview-zone="${id}" type="button" style="background-image:linear-gradient(0deg,rgba(12,10,30,.97),rgba(12,10,30,.15) 75%),url('assets/scenes/${id}.png')"><span>${z.kind === 'hunt' ? 'CAÇADA' : z.kind === 'dungeon' ? 'DUNGEON' : 'CHEFE'}</span><b>${z.title}</b><small>${s.txt}</small></button>`; }).join('')}</div></section>`).join('')}
      <button class="journey-card village" data-enter="village" type="button" style="background-image:linear-gradient(0deg,rgba(12,10,30,.97),rgba(12,10,30,.15) 75%),url('assets/scenes/village.png')"><span>REFÚGIO</span><b>Voltar para Tsukimori</b><small>Formação, cidade e loja</small></button></div></div>`;
  };

  P.destinationPanel = function(id) {
    const z = D.zones[id]; if (!z) return this.journeyPanel();
    if (z.kind === 'village') return `<button class="map-back" data-go="journey" type="button">← Mapa</button><div class="destination-banner" style="background-image:linear-gradient(0deg,rgba(12,10,30,.96),rgba(12,10,30,.1) 70%),url('assets/scenes/village.png')"><div><span class="eyebrow">${z.kicker}</span><h3>${z.title}</h3><p>${z.lore}</p></div></div><div class="destination-actions"><button class="action primary big" data-enter="village" type="button">Ir para a cidade</button></div>`;
    const e = this.engine, p = this.state.progress[id], lock = e.zoneLock(id), pow = e.getPower();
    let selector = '', opts = {}, recNote = '';
    if (z.kind === 'hunt') {
      const cur = Math.min(z.stages, this.view.stage || Math.max(1, Math.min(z.stages, p.best + 1)));
      opts = { stage:cur };
      selector = `<div class="stage-grid">${Array.from({ length:z.stages }, (_, i) => { const n = i + 1, done = n <= p.best, open = n <= p.best + 1; const rec = e.recommendedPower(id, { stage:n }); return `<button class="stage-btn ${done ? 'done' : ''} ${n === cur ? 'selected' : ''} ${n === z.stages ? 'final' : ''}" data-pick-stage="${n}" type="button" ${open ? '' : 'disabled'} data-tip="Estágio ${n}${n % 4 === 0 ? ' · Guardião duplo' : ''}${n === z.stages ? ' · Guardiões finais' : ''}<br>Poder recomendado: ${compact(rec)}"><b>${n}</b><small>${done ? '✓' : open ? compact(rec) : '🔒'}</small></button>`; }).join('')}</div>`;
    } else if (z.kind === 'dungeon') {
      const cur = Math.min(z.floors, this.view.floor || Math.max(1, Math.min(z.floors, p.best + 1)));
      opts = { floor:cur };
      selector = `<div class="stage-grid floors">${Array.from({ length:z.floors }, (_, i) => { const n = i + 1, done = n <= p.best, open = n <= p.best + 1; return `<button class="stage-btn ${done ? 'done' : ''} ${n === cur ? 'selected' : ''}" data-pick-floor="${n}" type="button" ${open ? '' : 'disabled'}><b>Andar ${ROMAN[i]}</b><small>${done ? '✓ Conquistado' : open ? `Rec. ${compact(e.recommendedPower(id, { floor:n }))}` : '🔒'}</small></button>`; }).join('')}</div>`;
    } else {
      const unlocked = D.bossTiers.filter(t => !t.needKills || (p.kills || 0) >= t.needKills).length - 1;
      const cur = Math.min(unlocked, this.view.tier ?? p.tier ?? 0);
      opts = { tier:cur };
      selector = `<div class="stage-grid floors">${D.bossTiers.map(t => `<button class="stage-btn tier-${t.id} ${t.id === cur ? 'selected' : ''}" data-pick-tier="${t.id}" type="button" ${t.id <= unlocked ? '' : 'disabled'}><b>${t.name}</b><small>${t.id <= unlocked ? `Rec. ${compact(e.recommendedPower(id, { tier:t.id }))} · recompensas ×${t.reward}` : `🔒 Vença ${t.needKills}× antes`}</small></button>`).join('')}</div>`;
      recNote = '<p class="note warn-note">⚠ Chefes têm três fases, ataques telegrafados (⚠), invocações e entram em <b>Fúria</b> se a luta demorar. Leve um <b>Suporte</b> e guarde ultimates de escudo e cura.</p>';
    }
    const rec = e.recommendedPower(id, opts), ratio = pow / rec;
    const ctx = e.ctx(), weak = z.weakTo || [];
    const teamWeak = e.heroes.filter(r => weak.includes(e.template(r.id).el)).length;
    const foes = z.kind === 'boss' ? [z.enemy] : [...(z.pool || []), ...(z.elites || []), ...(z.floorBoss ? [z.floorBoss] : [])];
    const bossE = z.kind === 'boss' && D.enemies[z.enemy];
    const drops = { hunt:'Itens comuns a épicos; guardiões garantem um item', dungeon:'Baú no fim de cada andar; conjunto Chama/Arquivista', boss:'2–3 itens épicos/lendários, conjunto exclusivo e únicos' }[z.kind];
    const firstClear = z.kind === 'hunt' ? 'Primeira vitória em cada estágio: cristais; a cada 4 estágios: 1 chave.' : z.kind === 'dungeon' ? 'Primeira conquista de cada andar: cristais + 1 chave.' : 'Primeira vitória: 150 cristais + 2 chaves.';
    return `<button class="map-back" data-go="journey" type="button">← Mapa</button>
      <div class="destination-banner" style="background-image:linear-gradient(0deg,rgba(12,10,30,.96),rgba(12,10,30,.1) 70%),url('assets/scenes/${id}.png')"><div><span class="eyebrow">${z.kicker}</span><h3>${z.title}</h3><p>${esc(z.lore)}</p></div></div>
      ${lock.reasons.length ? `<div class="zone-requirements">${lock.reasons.map(r => `<span class="${r.met ? 'met' : 'missing'}">${r.met ? '✓' : '✕'} ${esc(r.text)}</span>`).join('')}</div>` : ''}
      <div class="dest-grid"><div>
        <h4 class="sub-title">${z.kind === 'hunt' ? 'Escolha o estágio' : z.kind === 'dungeon' ? 'Escolha o andar' : 'Escolha a dificuldade'}</h4>${selector}
        <div class="power-compare ${ratio >= 1 ? 'ok' : ratio >= .8 ? 'warn' : 'bad'}"><div><small>Seu poder</small><b>${compact(pow)}</b></div><div class="vs">vs</div><div><small>Recomendado</small><b>${compact(rec)}</b></div><p>${ratio >= 1 ? 'Sua equipe está pronta.' : ratio >= .8 ? 'Desafiador — boa estratégia pode vencer.' : 'Muito arriscado. Fortaleça a equipe antes.'}</p></div>
        ${recNote}
        <div class="destination-actions"><button class="action primary big" data-enter="${id}" data-opts='${JSON.stringify(opts)}' type="button" ${lock.locked ? 'disabled' : ''}>${lock.locked ? '🔒 Bloqueado' : '⚔ Partir'}</button></div>
      </div><div>
        <h4 class="sub-title">Dicas de preparo</h4>
        <ul class="prep-list"><li>Fraquezas da região: ${weak.map(elTag).join(' ') || '—'} <small>(${teamWeak} herói(s) da sua equipe causam dano extra)</small></li>
        ${!ctx.clsCount.Suporte ? '<li class="bad">Sua equipe não tem Suporte (cura).</li>' : ''}${!ctx.clsCount.Vanguarda ? '<li class="bad">Sua equipe não tem Vanguarda (tanque).</li>' : ''}
        <li>${drops}.</li><li>${firstClear}</li></ul>
      </div></div>
      <h4 class="sub-title">${bossE ? 'O chefe' : 'Monstros desta região'}</h4>
      ${bossE ? this.bossInfo(bossE) : `<div class="foe-grid">${foes.map(fid => this.foeCard(fid)).join('')}</div>`}`;
  };
  P.foeCard = function(fid) {
    const f = D.enemies[fid], el = D.elements[f.el];
    return `<article class="foe-card ${f.elite ? 'elite' : ''} ${f.miniboss ? 'mini' : ''}"><canvas width="130" height="120" data-sprite-preview="${f.sprite}"></canvas><b>${esc(f.name)}</b><small>${f.miniboss ? '👑 Chefe do andar' : f.elite ? '★ Guardião' : f.role} · <span style="color:${el.color}">${el.icon} ${f.el}</span></small><small class="desc">${esc(f.desc)}</small>${f.skill ? `<small class="skill">✦ <b>${esc(f.skill.name)}</b>: ${esc(KT.Kit.describe(f.skill.eff))}</small>` : ''}${(f.specials || []).map(sp => `<small class="skill danger">⚠ <b>${esc(sp.name)}</b> (${sp.windup}s de preparo): ${esc(KT.Kit.describe(sp.eff))}</small>`).join('')}</article>`;
  };
  P.bossInfo = function(b) {
    return `<div class="boss-info"><canvas width="320" height="260" data-sprite-preview="${b.sprite}"></canvas><div><h3>${esc(b.name)}</h3><p>${esc(b.desc)}</p><p class="dim">${D.elements[b.el].icon} ${b.el} · Fúria após ${b.enrage}s (+25% ATK a cada 10s)</p><p><b>Ataque básico especial — ${esc(b.skill.name)}:</b> ${esc(KT.Kit.describe(b.skill.eff))}</p>
      ${b.phases.map((ph, i) => `<div class="phase"><b>Fase ${i + 1} ${i ? `(abaixo de ${pct(ph.at)} de HP)` : ''} — ${esc(ph.text)}</b>${ph.summon ? `<small>Invoca ${ph.summon.n}× ${esc(D.enemies[ph.summon.id].name)} a cada ${ph.summon.every}s.</small>` : ''}${ph.buff ? `<small>Fortalece: ${Object.entries(ph.buff).map(([k, v]) => statValue(k, v)).join(', ')}.</small>` : ''}${ph.specials.map(sp => `<small class="danger">⚠ <b>${esc(sp.name)}</b> — preparo ${sp.windup}s, a cada ${sp.cd}s: ${esc(KT.Kit.describe(sp.eff))}</small>`).join('')}</div>`).join('')}</div></div>`;
  };

  // ---------------------------------------------------------------------------
  // EQUIPE
  // ---------------------------------------------------------------------------
  P.partyPanel = function() {
    const e = this.engine, ctx = e.ctx(), f = this.state.formation, canEdit = e.canEditParty();
    if (!this.state.collection.length) return `<div class="empty-state"><h3>Você ainda não tem heróis</h3><p>Abra a Caixa dos Mundos para convocar seus primeiros heróis.</p><button class="action pink big" data-go="collection" type="button">Convocar heróis</button></div>`;
    const slots = f.map((uid, i) => {
      const r = uid && e.record(uid), t = r && e.template(r.id);
      return `<button class="formation-slot ${r ? `filled rarity-${r.rarity}` : ''} ${i === this.selectedSlot ? 'selected' : ''}" data-slot="${i}" type="button"><span class="row-label">${i < 2 ? 'FRENTE' : 'RETAGUARDA'}</span>${r ? `<img src="${portrait(t.id)}" alt=""><span><b>${esc(t.name)}</b><small>${clsTag(t.cls)} Nv.${r.level}</small><small>${compact(e.heroPower(r, ctx))} de poder</small></span>${canEdit ? `<span class="remove" data-remove="${uid}" data-tip="Remover da equipe">✕</span>` : ''}` : `<span class="num">${i + 1}</span><span><b>Vaga livre</b><small>${i === this.selectedSlot ? 'Escolha um herói abaixo' : 'Toque para selecionar'}</small></span>`}</button>`;
    }).join('');
    const warns = [];
    if (e.heroes.length === 4) {
      if (!ctx.clsCount.Suporte) warns.push('Sem <b>Suporte</b>: nenhuma cura — chefes serão muito difíceis.');
      if (!ctx.clsCount.Vanguarda) warns.push('Sem <b>Vanguarda</b>: a linha de frente vai cair rápido.');
      f.forEach((uid, i) => { const r = uid && e.record(uid); if (!r) return; const t = e.template(r.id); if (i < 2 && ['Arcanista','Suporte','Atirador'].includes(t.cls)) warns.push(`${esc(t.name)} (${t.cls}) está na <b>frente</b>: classes frágeis rendem mais na retaguarda.`); if (i >= 2 && t.cls === 'Vanguarda') warns.push(`${esc(t.name)} (Vanguarda) está na <b>retaguarda</b> — não protegerá ninguém.`); });
    }
    const syn = this.synergyHtml(ctx);
    const owned = this.state.collection.slice().sort((a, b) => (f.includes(b.uid) - f.includes(a.uid)) || e.heroPower(b, ctx) - e.heroPower(a, ctx));
    return `<div class="party-layout"><section>
      <div class="section-title"><h3>Formação <span>${e.heroes.length}/4</span></h3><small>Poder total: <b>${compact(e.getPower())}</b></small></div>
      <div class="formation-slots">${slots}</div>
      ${canEdit ? '' : '<p class="note">A formação só pode ser alterada na cidade (Tsukimori).</p>'}
      ${warns.length ? `<ul class="warn-list">${warns.map(w => `<li>${w}</li>`).join('')}</ul>` : ''}
      <div class="section-title"><h3>Heróis disponíveis</h3><small>${canEdit ? 'Toque em “Escalar” para colocar na vaga selecionada.' : ''}</small></div>
      <div class="roster-list">${owned.map(r => { const t = e.template(r.id), inTeam = f.includes(r.uid), pts = e.freeAttr(r); return `<article class="roster-row rarity-${r.rarity} ${inTeam ? 'in-team' : ''}"><img src="${portrait(t.id)}" alt="" data-hero="${r.uid}"><div data-hero="${r.uid}"><b>${esc(t.name)} ${stars(r.stars)}</b><small>${clsTag(t.cls)} ${elTag(t.el)} Nv.${r.level}${pts > 0 ? ` · <span class="pts">${pts} pts</span>` : ''}</small></div><span class="pow">${compact(e.heroPower(r, ctx))}</span>${inTeam ? '<span class="tag green">NA EQUIPE</span>' : canEdit ? `<button class="action small primary" data-assign="${r.uid}" type="button">Escalar</button>` : ''}<button class="action small" data-hero="${r.uid}" type="button">Ficha</button></article>`; }).join('')}</div>
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
    const t = e.template(r.id), st = e.heroStats(r), pw = S().statPower(st);
    const xpNext = S().heroXpNext(r.level), cap = S().heroMaxLevel(r.stars), aw = S().awakenCost(r.stars, this.state.buildings.shrine), shards = this.state.shards[r.id] || 0;
    const head = `<div class="hero-head rarity-${r.rarity}" style="--hc:${t.color}"><div class="hero-art"><img src="${KT.spriteUrl(t.sprite)}" alt=""></div><div class="hero-meta">
      <span class="eyebrow">${esc(t.franchise)}</span><h3>${esc(t.name)} ${stars(r.stars)}</h3>
      <div class="tags">${clsTag(t.cls)} ${elTag(t.el)} <span class="rar-tag">${rarLabel(r.rarity)}</span> <span class="tag">${D.classes[t.cls].row}</span>${r.job ? `<span class="tag job">⚜ ${PR.jobs[t.cls].name}</span>` : ''}</div>
      <div class="lvl-line"><b>Nível ${r.level}</b><small>/ ${cap}</small><div class="meter"><span style="width:${r.level >= cap ? 100 : r.xp / xpNext * 100}%"></span></div><small>${r.level >= cap ? 'Nível máximo — desperte para subir mais' : `${U.fmt(r.xp)} / ${U.fmt(xpNext)} EXP`}</small></div>
      <div class="hero-actions"><span class="pow-big">⚔ ${compact(pw)}</span>
        <button class="action ${shards >= aw.shards && this.state.player.gold >= aw.gold && r.stars < 6 ? 'pink' : ''}" data-awaken="${uid}" type="button" ${r.stars >= 6 ? 'disabled' : ''} data-tip="Despertar: +1★ (+12% atributos e +8 níveis máximos). Fragmentos vêm de convocações repetidas e do Mercado.">★ Despertar ${r.stars >= 6 ? '(máx.)' : `· ${shards}/${aw.shards} frag. · ${compact(aw.gold)} ouro`}</button>
        ${e.heroTalentPoints(r) > 0 ? `<button class="action pink" data-tab-go="talents" type="button">✦ ${e.heroTalentPoints(r)} ponto(s) de talento</button>` : ''}
        ${!r.job ? `<button class="action ${e.canJobChange(r) ? 'pink' : ''}" data-job="${uid}" type="button" ${e.canJobChange(r) ? '' : 'disabled'} data-tip="Mudança de Classe no nível ${PR.JOB_LEVEL}: vira ${PR.jobs[t.cls].name} (+10% HP/ATK/DEF, +5 pontos de talento e Círculo III). Custo: ${U.fmt(PR.jobCost.gold)} ouro e ${PR.jobCost.crystal} cristais.">⚜ ${PR.jobs[t.cls].name}</button>` : ''}
        <button class="action" data-scroll="${uid}" type="button" ${this.state.consumables.scroll ? '' : 'disabled'} data-tip="Usar Pergaminho de EXP (${this.state.consumables.scroll} disponíveis).">📜 EXP (${this.state.consumables.scroll})</button></div>
      </div></div>`;
    let body = '';
    if (tab === 'talents') return `<button class="map-back" data-go="party" type="button">← Equipe</button>${this.talentTree(uid)}`;
    if (tab === 'kit') {
      const c = D.classes[t.cls];
      body = `<div class="kit">
        <div class="kit-row"><span class="kit-ico cls">C</span><div><small>TRAÇO DE CLASSE · ${t.cls}</small><b>${c.trait}</b></div></div>
        <div class="kit-row"><span class="kit-ico passive">P</span><div><small>PASSIVA</small><b>${esc(t.passive.name)}</b><p>${esc(t.passiveText)}</p></div></div>
        <div class="kit-row"><span class="kit-ico skill">H</span><div><small>HABILIDADE · automática · recarga ${String(t.skill.cd).replace('.', ',')}s</small><b>${esc(t.skill.name)}</b><p>${esc(t.skillText)}</p></div></div>
        <div class="kit-row"><span class="kit-ico ult">U</span><div><small>ULTIMATE · 100 de energia · tecla ${KEYS[this.state.formation.indexOf(uid)] || '—'}</small><b>${esc(t.ult.name)}</b><p>${esc(t.ultText)}</p></div></div>
        <p class="note">Energia: +10 por ataque básico, + ao receber dano. Habilidades de Suporte dão +8 de energia aos aliados. Com AUTO ligado, a ultimate é usada automaticamente.</p>
        ${D.bonds.filter(b => b.ids.includes(t.id)).map(b => `<div class="bond"><div class="bond-faces">${b.ids.map(id => `<img src="${portrait(id)}" alt="">`).join('')}</div><div><b>Laço: ${esc(b.name)}</b><small>${esc(b.text)}</small></div></div>`).join('')}</div>`;
    } else if (tab === 'gear') {
      const slotsHtml = Object.entries(I.slots).map(([slot, s]) => { const it = this.state.inventory.find(x => x.uid === r.equipped[slot]); return `<button class="equip-slot big ${it ? `rarity-${it.rarity}` : 'empty'} ${this.pickSlot === slot ? 'selected' : ''}" data-pick-slot="${slot}" type="button">${it ? KT.itemIcon(it) : `<span class="slot-ico">${s.icon}</span>`}<span><small>${s.name}</small><b>${it ? `${esc(it.name)}${it.plus ? ` +${it.plus}` : ''}` : 'Vazio — toque para equipar'}</b>${it ? `<small>${this.itemLines(it).slice(0, 2).join(' · ').replace(/<[^>]+>/g, '')}</small>` : `<small>${s.desc}</small>`}</span></button>`; }).join('');
      const sets = st.sets.length ? `<div class="set-status">${st.sets.map(s => `<p style="--sc:${s.set.color}"><b>${esc(s.set.name)}</b> (${s.n}/4) — ${s.active.length ? s.active.map(n => n === 2 ? esc(s.set.bonus2.text) : esc(s.set.bonus4.text)).join(' · ') : 'equipe 2 peças para ativar'}</p>`).join('')}</div>` : '';
      let picker = '';
      if (this.pickSlot) {
        const cur = this.state.inventory.find(x => x.uid === r.equipped[this.pickSlot]);
        const list = this.state.inventory.filter(x => x.slot === this.pickSlot && x.uid !== cur?.uid).sort((a, b) => I.itemScore(b) - I.itemScore(a));
        picker = `<div class="section-title"><h3>${I.slots[this.pickSlot].name}: escolha um item</h3>${cur ? `<button class="action small" data-unequip="${this.pickSlot}" type="button">Remover atual</button>` : ''}</div><div class="inventory-grid">${list.map(it => { const d = I.itemScore(it) - (cur ? I.itemScore(cur) : 0); return this.itemCard(it, { compare:`<span class="compare ${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toLocaleString('pt-BR')} de pontuação ${cur ? 'vs atual' : ''}</span>`, actions:`<button class="action small primary" data-equip="${it.uid}" type="button">Equipar</button>` }); }).join('') || '<p class="empty-note">Nenhum item deste tipo na bolsa.</p>'}</div>`;
      }
      body = `<div class="gear-grid">${slotsHtml}</div>${sets}${picker}`;
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

  // ---------------------------------------------------------------------------
  // CONVOCAÇÃO
  // ---------------------------------------------------------------------------
  P.collectionPanel = function(_, tab) {
    const e = this.engine, owned = this.state.collection, free = this.state.starterRolls, keys = this.state.player.keys, avail = free + keys;
    if (tab === 'owned') {
      const ctx = e.ctx();
      return `<div class="collection-grid">${owned.slice().sort((a, b) => ({ legendary:0, epic:1, rare:2, common:3 }[a.rarity] - { legendary:0, epic:1, rare:2, common:3 }[b.rarity]) || b.level - a.level).map(r => { const t = e.template(r.id), sh = this.state.shards[r.id] || 0, aw = S().awakenCost(r.stars, this.state.buildings.shrine); return `<button class="collection-card rarity-${r.rarity} ${this.state.formation.includes(r.uid) ? 'active' : ''}" data-hero="${r.uid}" type="button"><div class="art"><span class="badge">${rarLabel(r.rarity)}</span>${this.state.formation.includes(r.uid) ? '<span class="in-party">EQUIPE</span>' : ''}<img src="${KT.spriteUrl(t.sprite)}" alt="" loading="lazy"></div><div class="info"><b>${esc(t.name)}</b><small>${stars(r.stars)} Nv.${r.level}</small><small>${D.classes[t.cls].icon} ${t.cls} · ${D.elements[t.el].icon} ${t.el}</small><small class="${sh >= aw.shards && r.stars < 6 ? 'txt-pink' : 'dim'}">Fragmentos ${sh}/${r.stars >= 6 ? '—' : aw.shards}</small></div></button>`; }).join('') || '<p class="collection-empty">Nenhum herói ainda.</p>'}</div>`;
    }
    if (tab === 'catalog') {
      const ids = new Set(owned.map(r => r.id));
      return `<p class="note">${ids.size}/60 heróis descobertos. Heróis não descobertos aparecem em silhueta — veja todos os kits na Wiki.</p><div class="roster-grid">${D.roster.map(t => `<div class="roster-card ${ids.has(t.id) ? 'owned' : 'locked'}" data-tip="<b>${esc(t.name)}</b><br>${t.cls} · ${t.el}<br><small>${esc(t.franchise)}</small>"><img src="${portrait(t.id)}" alt="" loading="lazy"><b>${ids.has(t.id) ? esc(t.name) : '???'}</b></div>`).join('')}</div>`;
    }
    return `<section class="summon-banner"><div class="summon-copy"><span class="eyebrow">CAIXA DOS MUNDOS</span><h3>${free ? 'Seu começo. Suas escolhas.' : 'Abra a Fenda'}</h3>
      <p>${free ? `Você tem <b>${free} convocações gratuitas</b> iniciais. Descubra seus heróis e escolha quatro para a equipe.` : 'Chaves vêm de estágios (a cada 4), dungeons, chefes, conquistas e da Loja (60 cristais). Heróis repetidos viram fragmentos para Despertar.'}</p>
      <div class="summon-counts"><span class="pill"><b>${free}</b> grátis</span><span class="pill"><b>${keys}</b> chaves</span><span class="pill"><b>${30 - this.state.pity}</b> até lendário garantido</span></div>
      <div class="box-actions">${free > 1 ? `<button class="action pink big" data-open-box-all type="button">✦ Convocar ${free}× grátis</button>` : ''}${!free && keys >= 10 ? `<button class="action pink big" data-open-box-10 type="button">✦ Convocar 10×</button>` : ''}<button class="action ${free > 1 || keys >= 10 ? '' : 'pink big'}" data-open-box type="button" ${avail < 1 ? 'disabled' : ''}>Convocar 1 ${free ? '· grátis' : '· 1 chave'}</button>${!free ? `<button class="action" data-go="shop:crystal" type="button">Comprar chaves</button>` : ''}</div>
      <small>Chances: Comum 55% · Raro 30% · Épico 12% · Lendário 3% (garantido a cada 30). Repetidos: +5/10/20/40 fragmentos conforme a raridade e podem melhorar a raridade do herói.</small></div></section>
      <div class="section-title"><h3>Seus heróis <span>${owned.length}</span></h3><button class="action small" data-tab-go="owned" type="button">Ver todos →</button></div>
      <div class="mini-roster">${owned.slice(-12).reverse().map(r => { const t = e.template(r.id); return `<button class="mini-hero rarity-${r.rarity}" data-hero="${r.uid}" type="button"><img src="${portrait(t.id)}" alt=""><small>${esc(t.name)}</small></button>`; }).join('') || '<p class="dim">Nenhum herói ainda.</p>'}</div>`;
  };

  // ---------------------------------------------------------------------------
  // BOLSA
  // ---------------------------------------------------------------------------
  P.inventoryPanel = function() {
    const f = this.invFilter, inv = this.state.inventory;
    const list = inv.filter(it => f.slot === 'all' || it.slot === f.slot).slice().sort((a, b) => f.sort === 'score' ? I.itemScore(b) - I.itemScore(a) : f.sort === 'level' ? b.ilvl - a.ilvl : (RORDER[a.rarity] - RORDER[b.rarity]) || I.itemScore(b) - I.itemScore(a));
    inv.forEach(it => { it.isNew = false; });
    const heroOpts = this.engine.heroes.map(r => `<option value="${r.uid}">${esc(this.engine.template(r.id).name)}</option>`).join('');
    return `<div class="inv-top"><div class="filter-tabs">${[['all','Tudo'], ...Object.entries(I.slots).map(([k, s]) => [k, s.name])].map(([id, n]) => `<button class="${f.slot === id ? 'active' : ''}" data-inv-slot="${id}" type="button">${n}</button>`).join('')}</div>
      <div class="filter-tabs">${[['rarity','Raridade'], ['score','Pontuação'], ['level','Nível']].map(([id, n]) => `<button class="${f.sort === id ? 'active' : ''}" data-inv-sort="${id}" type="button">${n}</button>`).join('')}</div>
      <span class="pill"><b>${inv.length}</b>/${this.state.invCap} espaços</span></div>
      <div class="inv-tools"><span>Desmontar em massa (não afeta equipados nem trancados):</span><button class="action small" data-salvage-all="common" type="button">Comuns</button><button class="action small" data-salvage-all="rare" type="button">Até Raros</button><button class="action small" data-salvage-all="epic" type="button">Até Épicos</button>
        <label>Auto-desmontar: <select id="auto-salvage"><option value="none">Nada</option><option value="common" ${this.state.settings.autoSalvage === 'common' ? 'selected' : ''}>Comuns</option><option value="rare" ${this.state.settings.autoSalvage === 'rare' ? 'selected' : ''}>Até Raros</option><option value="epic" ${this.state.settings.autoSalvage === 'epic' ? 'selected' : ''}>Até Épicos</option></select></label>
        <label>Equipar em: <select id="equip-target">${heroOpts}</select></label></div>
      <div class="inventory-grid">${list.map(it => { const v = I.salvageValue(it); return this.itemCard(it, { flavor:true, actions:`<button class="action small primary" data-equip-target="${it.uid}" type="button">Equipar</button><button class="action small" data-lock="${it.uid}" type="button" data-tip="${it.locked ? 'Destrancar' : 'Trancar (protege de desmontagem)'}">${it.locked ? '🔓' : '🔒'}</button><button class="action small" data-salvage="${it.uid}" type="button" ${it.locked || this.engine.ownerOf(it.uid) ? 'disabled' : ''} data-tip="Desmontar: +${v.ore} Tamahagane, +${v.dust} Éter, +${v.gold} ouro">♻</button><button class="action small" data-forge-item="${it.uid}" type="button" data-tip="Aprimorar na Forja">⚒</button>` }); }).join('') || '<p class="collection-empty">Nenhum item aqui. Derrote inimigos para encontrar equipamentos.</p>'}</div>`;
  };

  // ---------------------------------------------------------------------------
  // TALENTOS
  // ---------------------------------------------------------------------------
  const TREE_Y = { 0:95, 1:255, 2:470 }, NOTABLE_Y = 360;
  const svgIcon = (key, size = 26, color = 'currentColor') => `<svg class="ticon" viewBox="0 0 24 24" width="${size}" height="${size}" style="color:${color}"><path d="${PR.icons[key] || PR.icons.star}"/></svg>`;
  P.nodeEffectText = function(n, rank, t) {
    const lines = Object.entries(n.stats || {}).map(([k, v]) => statValue(k === 'skillMastery' ? 'skillMastery' : k, v * rank));
    if (n.hookText) lines.push(n.hookText(rank));
    else if (n.keystone || n.id === 's8') lines.push(n.desc);
    if (n.sig === 'skill') lines.unshift(`Habilidade “${t.skill.name}”:`);
    if (n.sig === 'ult') lines.unshift(`Ultimate “${t.ult.name}”:`);
    return lines;
  };
  P.talentPanel = function(uid) {
    const e = this.engine, r = e.record(uid);
    if (!r) return '<div class="empty-state"><h3>Nenhum herói</h3><p>Convoque heróis para distribuir talentos.</p><button class="action pink" data-go="collection" type="button">Convocar</button></div>';
    const picker = `<div class="hero-picker">${(this.state.formation.filter(Boolean).length ? this.state.formation.filter(Boolean) : this.state.collection.slice(0, 8).map(h => h.uid)).map(id => { const h = e.record(id), tt = e.template(h.id), pts = e.heroTalentPoints(h); return `<button class="hero-pick ${id === uid ? 'active' : ''}" data-talent-hero="${id}" type="button"><img src="${portrait(tt.id)}" alt="">${esc(tt.name)}${pts > 0 ? `<em>${pts}</em>` : ''}</button>`; }).join('')}<button class="action small" data-go="collection:owned" type="button">Outros heróis…</button></div>`;
    return picker + this.talentTree(uid);
  };
  P.talentTree = function(uid) {
    const e = this.engine, r = e.record(uid), t = e.template(r.id), tree = PR.classTrees[t.cls], c = D.classes[t.cls];
    const pts = e.heroTalentPoints(r), spent = e.treeSpent(r), job = PR.jobs[t.cls];
    const pos = n => ({ x:n.x, y:n.notable ? NOTABLE_Y : TREE_Y[n.tier] });
    const links = [];
    tree.forEach(n => n.req.forEach(q => q.split('|').forEach(id => { const o = tree.find(x => x.id === id); if (!o) return; const A = pos(o), B = pos(n); const on = (r.talents[id] || 0) && (r.talents[n.id] || 0); links.push(`<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" class="${on ? 'on' : (r.talents[id] || 0) ? 'avail' : ''}"/>`); })));
    const sel = tree.find(n => n.id === this.view.node) || tree[0];
    const nodes = tree.map(n => {
      const rank = r.talents[n.id] || 0, st = e.talentState(r, n.id), P2 = pos(n);
      const state = rank >= n.max ? 'max' : rank ? 'some' : st.ok ? 'avail' : 'locked';
      const rad = n.keystone ? 38 : n.notable ? 34 : 28;
      const color = n.keystone ? '#ff7eb6' : n.notable ? '#ffcf6b' : n.sig ? t.color : c.color;
      return `<g class="tnode ${state} ${n.keystone ? 'keystone' : n.notable ? 'notable' : n.sig ? 'sig' : ''} ${sel.id === n.id ? 'selected' : ''}" data-talent-node="${n.id}" transform="translate(${P2.x},${P2.y})" style="--nc:${color}">
        <circle class="halo" r="${rad + 8}"/><circle class="ring" r="${rad}"/>
        ${n.sig ? `<clipPath id="clip-${n.id}"><circle r="${rad - 4}"/></clipPath><image href="${portrait(t.id)}" x="${-rad + 4}" y="${-rad + 4}" width="${(rad - 4) * 2}" height="${(rad - 4) * 2}" clip-path="url(#clip-${n.id})" opacity=".55"/>` : ''}
        <g transform="translate(-14,-14) scale(1.17)" class="glyph"><path d="${PR.icons[n.icon]}"/></g>
        <g transform="translate(0,${rad + 12})"><rect x="-19" y="-9" width="38" height="17" rx="8" class="rank-bg"/><text y="4" class="rank">${rank}/${n.max}</text></g>
        <text y="${rad + 34}" class="lbl">${esc(n.sig === 'skill' ? t.skill.name : n.sig === 'ult' ? t.ult.name : n.name)}</text></g>`;
    }).join('');
    const bands = [0, 1, 2].map(i => `<rect x="10" y="${[20, 180, 395][i]}" width="940" height="${[150, 210, 160][i]}" rx="16" class="band ${i === 2 && !r.job ? 'locked' : spent >= PR.TIER_REQ[i] ? 'open' : 'locked'}"/><text x="28" y="${[44, 204, 419][i]}" class="band-lbl">CÍRCULO ${['I', 'II', 'III'][i]} · ${i === 0 ? 'livre' : i === 1 ? `${PR.TIER_REQ[1]} pontos investidos` : `${job.name} + ${PR.TIER_REQ[2]} pontos`}</text>`).join('');
    const srank = r.talents[sel.id] || 0, sst = e.talentState(r, sel.id);
    const cur = srank ? this.nodeEffectText(sel, srank, t) : [], next = srank < sel.max ? this.nodeEffectText(sel, srank + 1, t) : [];
    const reqs = [];
    if (sel.tier > 0) reqs.push([spent >= PR.TIER_REQ[sel.tier], `${PR.TIER_REQ[sel.tier]} pontos investidos nesta árvore (${spent})`]);
    if (sel.tier === 2) reqs.push([!!r.job, `Classe avançada: ${job.name}`]);
    sel.req.forEach(q => reqs.push([q.split('|').some(x => (r.talents[x] || 0) > 0), `Ter ${q.split('|').map(x => tree.find(n => n.id === x)?.name || x).join(' ou ')}`]));
    const detail = `<aside class="tdetail" style="--nc:${sel.keystone ? '#ff7eb6' : sel.notable ? '#ffcf6b' : c.color}">
      <div class="tdetail-head"><span class="tdetail-ico">${svgIcon(sel.icon, 34)}</span><div><small>${sel.keystone ? 'PEDRA-CHAVE' : sel.notable ? 'NOTÁVEL' : sel.sig ? 'EXCLUSIVO DO HERÓI' : `CÍRCULO ${['I', 'II', 'III'][sel.tier]}`}</small><h4>${esc(sel.sig === 'skill' ? `Maestria: ${t.skill.name}` : sel.sig === 'ult' ? `Ápice: ${t.ult.name}` : sel.name)}</h4><span class="rank-pill">Rank ${srank}/${sel.max}</span></div></div>
      <p>${esc(sel.desc)}</p>
      ${cur.length ? `<div class="teff"><b>Efeito atual</b>${cur.map(l => `<span>${l}</span>`).join('')}</div>` : ''}
      ${next.length ? `<div class="teff next"><b>${srank ? 'Próximo rank' : 'Ao aprender'}</b>${next.map(l => `<span>${l}</span>`).join('')}</div>` : '<div class="teff max"><b>Rank máximo alcançado</b></div>'}
      ${reqs.length ? `<ul class="treqs">${reqs.map(([ok2, txt]) => `<li class="${ok2 ? 'ok' : 'no'}">${ok2 ? '✓' : '✕'} ${esc(txt)}</li>`).join('')}</ul>` : ''}
      <button class="action ${sst.ok ? 'primary' : ''} big" data-learn="${sel.id}" type="button" ${sst.ok ? '' : 'disabled'}>${sst.ok ? 'Aprender (1 ponto)' : esc(sst.reason || 'Indisponível')}</button>
    </aside>`;
    const jobBox = r.job ? `<div class="job-badge on">⚜ ${job.name}</div>` : `<div class="job-badge"><b>Mudança de Classe: ${job.name}</b><small>Nível ${PR.JOB_LEVEL} · ${compact(PR.jobCost.gold)} ouro · ${PR.jobCost.crystal} cristais — ${job.text}</small><button class="action small ${e.canJobChange(r) ? 'pink' : ''}" data-job="${uid}" type="button" ${e.canJobChange(r) ? '' : 'disabled'}>${r.level < PR.JOB_LEVEL ? `Nv. ${r.level}/${PR.JOB_LEVEL}` : 'Mudar de classe'}</button></div>`;
    return `<div class="tree-top"><div class="tree-hero"><img src="${portrait(t.id)}" alt=""><div><b>${esc(t.name)}</b><small>${clsTag(t.cls)} Nv. ${r.level}</small></div></div>
      <div class="tree-points"><span class="pts-big ${pts > 0 ? 'has' : ''}">${pts} ponto(s) livre(s)</span><small>${spent} investidos · 1 ponto por nível${r.job ? ' · +5 da classe avançada' : ''}</small></div>
      ${jobBox}
      <button class="action small" data-hero-talent-reset="${uid}" type="button" ${spent ? '' : 'disabled'}>${this.state.freeRespec ? `Redefinir (grátis ×${this.state.freeRespec})` : `Redefinir (${compact(e.talentResetCost(r))} ouro)`}</button></div>
      <div class="tree-layout"><div class="talent-tree"><svg viewBox="0 0 960 580" preserveAspectRatio="xMidYMid meet">${bands}${links.join('')}${nodes}</svg></div>${detail}</div>`;
  };

  // ---------------------------------------------------------------------------
  // CIDADE
  // ---------------------------------------------------------------------------
  P.cityPanel = function(_, tab) {
    const e = this.engine, s = this.state, b = s.buildings;
    const bHead = id => { const bd = D.buildings[id], lv = b[id], cost = e.buildingCost(id), cap = e.buildingCap(); return `<div class="building-head"><span class="b-icon">${bd.icon}</span><div><b>${bd.name} · Nível ${lv}</b><small>${bd.desc}</small></div><button class="action ${s.player.gold >= cost && lv < cap ? 'primary' : ''}" data-build="${id}" type="button" ${lv >= cap ? 'disabled' : ''}>${lv >= cap ? `Máx. (conta nv ${(lv - 1) * 3 + 3} libera)` : `Melhorar · ${compact(cost)} ouro`}</button></div>`; };
    if (tab === 'forge') {
      const sel = s.inventory.find(x => x.uid === this.forgeSel) || null;
      const equippedFirst = s.inventory.slice().sort((a, b2) => (!!e.ownerOf(b2.uid) - !!e.ownerOf(a.uid)) || I.itemScore(b2) - I.itemScore(a));
      let right = '<p class="empty-note">Selecione um item à esquerda para aprimorar.</p>';
      if (sel) {
        const c = I.upgradeCost(sel, b.forge), max = I.maxPlus(b.forge), ok = s.player.gold >= c.gold && s.player.ore >= c.ore && sel.plus < max;
        right = `${this.itemCard(sel, { flavor:true })}<div class="forge-box"><h4>Aprimorar para +${sel.plus + 1}</h4><p>+10% no atributo principal e +5% nos afixos por nível.</p><div class="cost-line"><span class="${s.player.gold >= c.gold ? 'cost-ok' : 'cost-bad'}">${U.fmt(c.gold)} ouro</span><span class="${s.player.ore >= c.ore ? 'cost-ok' : 'cost-bad'}">${c.ore} Tamahagane</span><span>Chance ${pct(c.chance)}</span></div>${c.chance < 1 ? '<p class="note">Acima de +5 o aprimoramento pode falhar (o item nunca é perdido).</p>' : ''}<button class="action primary big" data-upgrade="${sel.uid}" type="button" ${ok ? '' : 'disabled'}>${sel.plus >= max ? `Limite +${max} (melhore a Forja)` : '⚒ Aprimorar'}</button></div>`;
      }
      return `${bHead('forge')}<div class="split"><div class="pick-list">${equippedFirst.map(it => `<button class="pick-item rarity-${it.rarity} ${it.uid === this.forgeSel ? 'selected' : ''}" data-forge-item="${it.uid}" type="button">${KT.itemIcon(it)}<span><b class="rtext">${esc(it.name)}${it.plus ? ` +${it.plus}` : ''}</b><small>${e.ownerOf(it.uid) ? `⚔ ${esc(e.template(e.ownerOf(it.uid).id).name)}` : `Nv.${it.ilvl}`}</small></span></button>`).join('') || '<p class="dim">Bolsa vazia.</p>'}</div><div>${right}</div></div>`;
    }
    if (tab === 'workshop') {
      const sel = s.inventory.find(x => x.uid === this.forgeSel && x.affixes?.length) || null;
      const recipes = [{ id:'potion', name:'Poção de Cura', icon:'potion_red_01', gold:180, dust:3 }, { id:'elixir', name:'Elixir de Energia', icon:'potion_blue_01', gold:300, dust:6 }].map(r => ({ ...r, gold:Math.round(r.gold * (1 - (b.workshop - 1) * .05)), dust:Math.max(1, Math.round(r.dust * (1 - (b.workshop - 1) * .05))) }));
      let enchant = '<p class="empty-note">Selecione um item com afixos para encantar.</p>';
      if (sel) { const c = I.enchantCost(sel, b.workshop); enchant = `${this.itemCard(sel)}<div class="forge-box"><h4>Encantar</h4><p>Re-sorteia um afixo (tipo e valor). Custo: <b>${c.dust} Éter</b> + <b>${U.fmt(c.gold)} ouro</b>.</p>${sel.affixes.map((a, i) => `<div class="ench-row"><span>${statValue(a.stat, a.v)}</span><button class="action small" data-enchant="${sel.uid}" data-aff="${i}" type="button" ${s.player.dust >= c.dust && s.player.gold >= c.gold ? '' : 'disabled'}>Re-sortear</button></div>`).join('')}</div>`; }
      return `${bHead('workshop')}<h4 class="sub-title">Receitas</h4><div class="recipe-grid">${recipes.map(r => `<div class="craft-row"><img class="item-art" src="${KT.iconUrl(r.icon)}" alt=""><div><b>${r.name}</b><small>${U.fmt(r.gold)} ouro · ${r.dust} Éter · você tem ${s.consumables[r.id]}</small></div><button class="action ${s.player.gold >= r.gold && s.player.dust >= r.dust ? 'primary' : ''}" data-craft="${r.id}" data-gold="${r.gold}" data-dust="${r.dust}" type="button" ${s.player.gold >= r.gold && s.player.dust >= r.dust ? '' : 'disabled'}>Criar</button></div>`).join('')}</div>
        <h4 class="sub-title">Encantamento</h4><div class="split"><div class="pick-list">${s.inventory.filter(x => x.affixes?.length).map(it => `<button class="pick-item rarity-${it.rarity} ${it.uid === this.forgeSel ? 'selected' : ''}" data-forge-item="${it.uid}" type="button">${KT.itemIcon(it)}<span><b class="rtext">${esc(it.name)}</b><small>${it.affixes.length} afixo(s)</small></span></button>`).join('') || '<p class="dim">Nenhum item com afixos.</p>'}</div><div>${enchant}</div></div>`;
    }
    if (tab === 'cards') {
      const owned = I.cards.filter(cd => (s.cards[cd.id] || 0) > 0);
      const sel = s.inventory.find(x => x.uid === this.forgeSel && (x.cards || []).length) || null;
      const socketable = s.inventory.filter(x => (x.cards || []).length).sort((a, b2) => (!!e.ownerOf(b2.uid) - !!e.ownerOf(a.uid)) || I.itemScore(b2) - I.itemScore(a));
      let right = '<p class="empty-note">Escolha um equipamento com slots à esquerda.</p>';
      if (sel) right = `${this.itemCard(sel)}<div class="forge-box"><h4>Slots</h4>${sel.cards.map((cid, i) => { const cd = cid && I.cardById(cid); return `<div class="ench-row"><span>Slot ${i + 1}: ${cd ? `<b>${esc(cd.name)}</b> — ${Object.entries(cd.stats).map(([k, v]) => statValue(k, v)).join(', ')}` : '<i class="dim">vazio</i>'}</span>${cd ? `<button class="action small" data-unsocket="${sel.uid}" data-idx="${i}" type="button" ${s.player.crystal >= 30 ? '' : 'disabled'}>Remover (30 cristais)</button>` : ''}</div>`; }).join('')}
        ${sel.cards.some(x => !x) ? `<h4 class="sub-title">Encaixar carta</h4><div class="card-grid">${owned.map(cd => `<button class="card-tile ${cd.mvp ? 'mvp' : ''}" data-socket="${sel.uid}" data-card="${cd.id}" type="button"><span class="card-art"><img src="${KT.spriteUrl(cd.sprite)}" alt=""></span><b>${esc(cd.name)}</b><small>${Object.entries(cd.stats).map(([k, v]) => statValue(k, v)).join(', ')}</small><em>×${s.cards[cd.id]}</em></button>`).join('') || '<p class="dim">Você ainda não tem cartas. Monstros deixam cartas raramente; chefes deixam cartas MVP.</p>'}</div>` : '<p class="note">Todos os slots estão ocupados.</p>'}</div>`;
      return `<p class="note">Cartas são drops raros de monstros (cada monstro tem a sua) e encaixam nos <b>slots</b> dos equipamentos. Itens raros ou melhores podem ter de 1 a 2 slots. Cartas de chefe (<b>MVP</b>) são as mais poderosas. Encaixar é permanente; remover custa 30 cristais e devolve a carta.</p>
        <div class="split"><div class="pick-list">${socketable.map(it => `<button class="pick-item rarity-${it.rarity} ${it.uid === this.forgeSel ? 'selected' : ''}" data-forge-item="${it.uid}" type="button">${KT.itemIcon(it)}<span><b class="rtext">${esc(it.name)}</b><small>${it.cards.filter(Boolean).length}/${it.cards.length} slots${e.ownerOf(it.uid) ? ` · ⚔ ${esc(e.template(e.ownerOf(it.uid).id).name)}` : ''}</small></span></button>`).join('') || '<p class="dim">Nenhum item com slots ainda.</p>'}</div><div>${right}</div></div>
        <h4 class="sub-title">Sua coleção de cartas · ${owned.length}/${I.cards.length}</h4><div class="card-grid">${I.cards.map(cd => { const n = s.cards[cd.id] || 0; return `<div class="card-tile ${n ? '' : 'missing'} ${cd.mvp ? 'mvp' : ''}"><span class="card-art"><img src="${KT.spriteUrl(cd.sprite)}" alt=""></span><b>${n ? esc(cd.name) : '???'}</b><small>${n ? Object.entries(cd.stats).map(([k, v]) => statValue(k, v)).join(', ') : `Drop de ${esc(D.enemies[cd.enemy].name.split(',')[0])}`}</small>${n ? `<em>×${n}</em>` : ''}</div>`; }).join('')}</div>`;
    }
    if (tab === 'dojo') {
      const cap = PR.trainingCap(b.dojo);
      return `${bHead('dojo')}<p class="note">Treino da equipe: melhorias permanentes para <b>todos</b> os heróis. Limite atual: nível ${cap} (melhore o Dojo para aumentar). Heróis fora da equipe recebem ${Math.round((.05 + b.dojo * .05) * 100)}% da EXP de combate como treino passivo.</p>
        <div class="train-grid">${Object.entries(PR.training).map(([k, tr]) => { const lv = s.training[k] || 0, cost = PR.trainingCost(lv); return `<div class="train-card"><b>${tr.name}</b><small>${tr.text}</small><div class="meter"><span style="width:${lv / cap * 100}%"></span></div><small>Nível ${lv}/${cap} · atual ${statValue(tr.stat, tr.per * lv)}</small><button class="action ${s.player.gold >= cost && lv < cap ? 'primary' : ''}" data-train="${k}" type="button" ${lv >= cap ? 'disabled' : ''}>${lv >= cap ? 'Limite' : `Treinar · ${compact(cost)} ouro`}</button></div>`; }).join('')}</div>`;
    }
    if (tab === 'shrine') {
      const list = this.state.collection.slice().sort((a, b2) => ((this.state.shards[b2.id] || 0) - (this.state.shards[a.id] || 0)));
      return `${bHead('shrine')}<div class="box-actions"><button class="action pink" data-go="collection" type="button">✦ Ir para Convocação</button><button class="action" data-buy="key1" type="button" ${s.player.crystal >= 60 ? '' : 'disabled'}>Trocar 60 cristais → 1 chave</button></div>
        <h4 class="sub-title">Despertar heróis</h4><p class="note">Cada ★ dá +12% em HP/ATK/DEF e +8 níveis máximos. Fragmentos vêm de convocações repetidas e do Mercado.</p>
        <div class="roster-list">${list.map(r => { const t = this.engine.template(r.id), c = S().awakenCost(r.stars, b.shrine), sh = this.state.shards[r.id] || 0, ok = r.stars < 6 && sh >= c.shards && s.player.gold >= c.gold; return `<article class="roster-row rarity-${r.rarity}"><img src="${portrait(t.id)}" alt=""><div><b>${esc(t.name)} ${stars(r.stars)}</b><small>Fragmentos ${sh}/${r.stars >= 6 ? '—' : c.shards} · ${compact(c.gold)} ouro</small></div><button class="action small ${ok ? 'pink' : ''}" data-awaken="${r.uid}" type="button" ${ok ? '' : 'disabled'}>${r.stars >= 6 ? 'Máximo' : 'Despertar'}</button></article>`; }).join('')}</div>`;
    }
    if (tab === 'guild') {
      return `${bHead('guild')}<p class="note">Bônus atual de ouro em combate: <b>+${(b.guild - 1) * 3}%</b>. Contratos renovam ao serem resgatados.</p>${this.contractsHtml()}`;
    }
    return `<div class="building-list">${Object.keys(D.buildings).map(id => bHead(id)).join('')}</div><p class="note">O nível máximo das construções é ${e.buildingCap()} (aumenta 1 a cada 3 níveis de conta).</p>`;
  };
  P.contractsHtml = function() {
    return `<div class="grid2">${this.state.contracts.map((c, i) => { const def = D.contracts.find(d => d.id === c.id), done = c.progress >= c.n; return `<article class="panel ${done ? 'done' : ''}"><span class="eyebrow">${['Simples','Médio','Difícil'][c.tier]}</span><h3>${def.title}</h3><p>${def.text.replace('{n}', c.n)}</p><div class="meter"><span style="width:${c.progress / c.n * 100}%"></span></div><p>${c.progress}/${c.n}</p><div class="guide-reward">${this.rewardPills(this.engine.contractReward(c))}</div><button class="action ${done ? 'primary' : ''}" data-claim-contract="${i}" type="button" ${done ? '' : 'disabled'}>${done ? 'Resgatar' : 'Em andamento'}</button></article>`; }).join('')}</div>`;
  };

  // ---------------------------------------------------------------------------
  // RANKING
  // ---------------------------------------------------------------------------
  P.rankingPanel = function(_, tab) {
    if (this.session?.mode !== 'cloud') return '<div class="empty-state"><h3>Ranking online</h3><p>O ranking fica disponível quando o jogo roda no servidor com uma conta. No modo offline o progresso fica só neste navegador.</p></div>';
    const cache = this.rankCache?.[tab];
    if (!cache || Date.now() - cache.at > 30_000) {
      KT.Net.leaderboard(tab).then(r => { this.rankCache = { ...(this.rankCache || {}), [tab]:{ at:Date.now(), data:r } }; if (this.view.panel === 'ranking' && this.view.tab === tab) this.refreshPanel(); });
      if (!cache) return '<div class="empty-state"><p>Carregando ranking…</p></div>';
    }
    const r = cache.data; if (!r.ok) return `<div class="empty-state"><p>Não foi possível carregar o ranking: ${esc(r.error)}</p></div>`;
    const col = { power:['power', 'Poder'], bosses:['boss_kills', 'Chefes'], stage:['best_stage', 'Estágios'] }[tab] || ['power', 'Poder'];
    return `${r.me ? `<div class="rank-me"><span>Sua posição por poder</span><b>#${r.me.rank}</b><small>${esc(r.me.name)} · ${compact(r.me.power)} de poder</small></div>` : '<p class="note">Seu save aparece no ranking após a primeira sincronização.</p>'}
      <table class="rank-table"><thead><tr><th>#</th><th>Viajante</th><th>${col[1]}</th><th>Conta</th></tr></thead><tbody>${r.rows.map((row, i) => `<tr class="${i < 3 ? `top top${i + 1}` : ''}"><td>${i + 1}</td><td>${esc(row.name)}</td><td>${compact(row[col[0]])}</td><td>Nv. ${row.account_level}</td></tr>`).join('') || '<tr><td colspan="4" class="dim">Ninguém no ranking ainda. Seja o primeiro!</td></tr>'}</tbody></table>
      <p class="note">O poder é recalculado pelo servidor a partir do save. Contas com atividade suspeita não aparecem.</p>`;
  };

  // ---------------------------------------------------------------------------
  // LOJA
  // ---------------------------------------------------------------------------
  P.shopPanel = function(_, tab) {
    const e = this.engine, s = this.state;
    if (tab === 'market') {
      const offers = e.refreshMarket(); const next = (Math.floor(Date.now() / 7200000) + 1) * 7200000;
      return `<p class="note">Mercado do Porto: ofertas renovam em <b>${fmtTime((next - Date.now()) / 1000)}</b>. Nível do Mercado ${s.buildings.market}: ${2 + s.buildings.market} equipamentos por rodada.</p><div class="inventory-grid">${offers.map((o, i) => o.type === 'item' ? this.itemCard(o.item, { flavor:true, actions:`<button class="action small ${s.player.gold >= o.price && !o.sold ? 'primary' : ''}" data-market="${i}" type="button" ${o.sold || s.player.gold < o.price ? 'disabled' : ''}>${o.sold ? 'Vendido' : `Comprar · ${compact(o.price)} ouro`}</button>` }) : `<article class="item"><div class="item-head"><img class="item-art round" src="${portrait(o.heroId)}" alt=""><div><b>${o.n} fragmentos</b><small>${esc(e.template(o.heroId).name)}</small></div></div><p class="dim">Use para Despertar este herói.</p><footer><button class="action small ${s.player.gold >= o.price && !o.sold ? 'primary' : ''}" data-market="${i}" type="button" ${o.sold || s.player.gold < o.price ? 'disabled' : ''}>${o.sold ? 'Vendido' : `Comprar · ${compact(o.price)} ouro`}</button></footer></article>`).join('')}</div>`;
    }
    if (tab === 'gems') {
      return `<div class="gem-hero"><div><span class="eyebrow">GEMAS · MOEDA PREMIUM</span><h3>Apoie o desenvolvimento de Mythverse</h3><p>Gemas aceleram a jornada (chaves, incensos, cosméticos) sem vender poder exclusivo: tudo também pode ser conquistado jogando.</p></div></div>
        <div class="gem-grid">${PR.shop.gems.map(g => `<article class="gem-card">${g.tag ? `<span class="gem-tag">${g.tag}</span>` : ''}<b>${esc(g.name)}</b><small>${esc(g.text)}</small><button class="action" data-gem="${g.id}" type="button" disabled>${g.price}</button></article>`).join('')}</div>
        <p class="note warn-note">🔒 Compras com dinheiro real estão <b>desativadas</b> nesta versão: é necessário um servidor oficial com provedor de pagamento seguro. Nenhum dado de pagamento é solicitado ou armazenado.</p>`;
    }
    const list = PR.shop[tab] || PR.shop.gold;
    return `<p class="note">${tab === 'gold' ? 'Preços em ouro sobem conforme seu progresso. Poções e elixires são usados no combate (teclas 1 e 2).' : 'Cristais vêm de primeiras vitórias, conquistas, missões e níveis de conta.'}</p><div class="shop-grid">${list.map(o => { const price = e.shopPrice(o), cur = Object.keys(price)[0], can = s.player[cur] >= price[cur]; const owned = o.give.potion ? `Você tem ${s.consumables.potion}` : o.give.elixir ? `Você tem ${s.consumables.elixir}` : o.give.scroll ? `Você tem ${s.consumables.scroll}` : o.give.invCap ? `${s.invCap}/200 espaços` : o.give.boost ? (s.boostUntil > Date.now() ? `Ativo: ${fmtTime((s.boostUntil - Date.now()) / 1000)}` : '') : ''; return `<article class="shop-card"><img class="item-art" src="${KT.iconUrl(o.icon, o.hue)}" alt=""><b>${esc(o.name)}</b><small>${esc(o.text)}</small>${owned ? `<small class="dim">${owned}</small>` : ''}<button class="action ${can ? 'primary' : ''}" data-buy="${o.id}" type="button" ${can ? '' : 'disabled'}>${compact(price[cur])} ${cur === 'gold' ? 'ouro' : 'cristais'}</button></article>`; }).join('')}</div>`;
  };

  // ---------------------------------------------------------------------------
  // MISSÕES
  // ---------------------------------------------------------------------------
  P.questPanel = function(_, tab) {
    const e = this.engine;
    if (tab === 'contracts') return `<p class="note">Contratos da Guilda renovam a cada resgate. Recompensas crescem com seu progresso.</p>${this.contractsHtml()}`;
    if (tab === 'achievements') {
      return `<div class="ach-grid">${D.achievements.map(a => { const v = e.achievementValue(a), done = v >= a.n, claimed = this.state.achievements[a.id]; return `<article class="ach ${claimed ? 'claimed' : done ? 'done' : ''}"><b>${esc(a.title)}</b><small>${esc(a.text)}</small><div class="meter"><span style="width:${Math.min(1, v / a.n) * 100}%"></span></div><small>${U.fmt(Math.min(v, a.n))}/${U.fmt(a.n)}</small><div class="guide-reward">${this.rewardPills(a.reward)}</div>${claimed ? '<span class="tag green">✓ Resgatada</span>' : `<button class="action small ${done ? 'primary' : ''}" data-claim-ach="${a.id}" type="button" ${done ? '' : 'disabled'}>Resgatar</button>`}</article>`; }).join('')}</div>`;
    }
    const cur = e.guideStep();
    return `<p class="note">O Guia do Viajante mostra o próximo passo da jornada. Cada etapa dá recompensas.</p><ol class="guide-list">${D.guide.map(g => { const claimed = this.state.guide.claimed[g.id], isCur = g === cur, done = isCur && e.guideDone(g); return `<li class="${claimed ? 'claimed' : isCur ? 'current' : 'future'}"><div><b>${esc(g.title)}</b><small>${esc(g.desc)}</small><div class="guide-reward">${this.rewardPills(g.reward)}</div></div>${claimed ? '<span class="tag green">✓</span>' : isCur ? (done ? '<button class="action small primary" data-claim-guide type="button">Resgatar</button>' : g.go ? `<button class="action small" data-go="${g.go}" type="button">Ir →</button>` : '') : '<span class="tag">🔒</span>'}</li>`; }).join('')}</ol>`;
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
      <h4 class="sub-title">Configurações</h4><div class="settings"><label><input type="checkbox" id="set-sound" ${this.state.settings.sound ? 'checked' : ''}> Som</label><label><input type="checkbox" id="set-repeat" ${this.state.settings.autoRepeat ? 'checked' : ''}> Repetir dungeons/chefes automaticamente</label><button class="action" data-save type="button">💾 Salvar agora</button><button class="action red" data-reset-save type="button">Apagar save e recomeçar</button></div>`;
  };
  P.accountHtml = function() {
    const ses = this.session || {}, c = KT.Cloud;
    if (ses.mode !== 'cloud') return `<h4 class="sub-title">Conta</h4><div class="panel"><p><b>Modo offline.</b> O progresso fica salvo apenas neste navegador. Para ter conta, login e save na nuvem, rode o servidor (<code>npm start</code>) e acesse pelo endereço dele.</p></div>`;
    const u = ses.user || {};
    return `<h4 class="sub-title">Conta</h4><div class="account-grid">
      <article class="panel"><h3>${esc(u.username)}</h3><p>${u.email ? `E-mail: ${esc(u.email)}<br>` : ''}Conta criada em ${new Date(u.createdAt).toLocaleDateString('pt-BR')}</p>
        <p>Nuvem: <b>${c.status === 'ok' || !c.dirty ? 'sincronizado' : c.status === 'error' ? 'erro' : 'pendente'}</b>${c.lastSync ? ` · última vez às ${new Date(c.lastSync).toLocaleTimeString('pt-BR')}` : ''} · revisão ${c.revision}</p>
        <div class="box-actions"><button class="action primary" data-sync-now type="button">☁ Salvar agora</button><button class="action" data-logout type="button">Sair</button><button class="action" data-logout-all type="button">Encerrar outras sessões</button></div></article>
      <article class="panel"><h3>Trocar senha</h3><div class="mini-form"><input type="password" id="pw-current" placeholder="Senha atual" autocomplete="current-password"><input type="password" id="pw-next" placeholder="Nova senha (8+, letras e números)" autocomplete="new-password"><button class="action" data-change-pw type="button">Trocar senha</button></div></article>
      <article class="panel"><h3>Código de recuperação</h3><p>Gere um novo código se perdeu o anterior (o antigo deixa de valer).</p><div class="mini-form"><input type="password" id="rc-pass" placeholder="Sua senha" autocomplete="current-password"><button class="action" data-new-recovery type="button">Gerar novo código</button></div><div id="rc-out"></div></article>
      <article class="panel"><h3>Cópias de segurança</h3><p>O servidor guarda até 20 versões anteriores do seu progresso.</p><button class="action" data-load-history type="button">Ver cópias</button><div id="history-out"></div></article>
      <article class="panel"><h3>Seus dados</h3><p>Baixe tudo que o servidor guarda sobre você (LGPD).</p><a class="action" href="/api/account/export" download>⬇ Exportar meus dados</a></article>
      <article class="panel danger-zone"><h3>Excluir conta</h3><p>Apaga conta, save e histórico permanentemente.</p><div class="mini-form"><input type="password" id="del-pass" placeholder="Sua senha" autocomplete="current-password"><input id="del-confirm" placeholder="Digite seu nome de usuário"><button class="action red" data-delete-account type="button">Excluir definitivamente</button></div></article>
    </div>`;
  };
  P.helpPanel = function() {
    return `<div class="help-grid">
      <article class="panel"><h3>1 · Convoque e forme a equipe</h3><p>Use as 10 convocações grátis. Escolha 4 heróis: vagas 1–2 são a <b>linha de frente</b> (Vanguardas), 3–4 a <b>retaguarda</b> (Suportes, Arcanistas, Atiradores). Sinergias de classe, elemento e laços deixam a equipe mais forte.</p><button class="action primary" data-go="collection" type="button">Convocar</button></article>
      <article class="panel"><h3>2 · Combate</h3><p>Os heróis atacam e usam habilidades sozinhos. A <b>ultimate</b> carrega com energia (barra dourada): use com <b>Q W E R</b> ou deixe no AUTO. Clique num inimigo para focar. <b>1</b> = poção, <b>2</b> = elixir. Quando um inimigo mostrar <b>⚠</b>, prepare escudos e curas.</p></article>
      <article class="panel"><h3>3 · Progressão</h3><p>Cada região tem 12 estágios de dificuldade crescente e um <b>chefe final</b> que libera o próximo capítulo. Se a equipe cair, ela recua um estágio e treina sozinha. Fortaleça-se com <b>atributos</b>, <b>itens</b>, <b>Forja</b>, <b>Dojo</b>, <b>talentos</b> e <b>Despertar</b>.</p><button class="action" data-go="journey" type="button">Abrir mapa</button></article>
      <article class="panel"><h3>4 · Sempre evoluindo</h3><p>O jogo salva sozinho e calcula até <b>12 horas</b> de progresso offline. Eventos mundiais mudam a cada 2 horas. Missões e conquistas dão chaves e cristais.</p><button class="action" data-go="wiki" type="button">Wiki completa</button></article>
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
        <h4>Ciclo de jogo</h4><ol><li><b>Convoque</b> heróis na Caixa dos Mundos (10 grátis no início).</li><li><b>Monte a equipe</b> de 4 pensando em classes, elementos, posições e laços.</li><li><b>Cace</b> nos estágios: ganhe ouro, EXP, itens e materiais.</li><li><b>Fortaleça</b>: atributos, equipamentos, Forja, Dojo, talentos, Despertar.</li><li><b>Avance</b>: vença o estágio 12 e o andar III da dungeon para desafiar o <b>chefe da região</b>, que libera o próximo capítulo.</li><li><b>Repita em dificuldades maiores</b>: chefes têm Pesadelo e Inferno com recompensas multiplicadas.</li></ol>
        <h4>Recursos</h4><ul><li><b>Ouro</b> — combate; gasto em prédios, treino, aprimoramento, loja e Despertar.</li><li><b>Cristais</b> — primeiras vitórias, níveis de conta, missões e conquistas; trocados por chaves e itens especiais.</li><li><b>Éter</b> — desmontando itens; usado em encantamentos e receitas.</li><li><b>Tamahagane</b> — desmontando itens e inimigos fortes; usado para aprimorar.</li><li><b>Chaves</b> — convocações.</li><li><b>Fragmentos</b> — heróis repetidos; usados para Despertar.</li><li><b>Gemas</b> — moeda premium (compra desativada nesta versão).</li></ul>
        <h4>Offline</h4><p>Ao voltar, o jogo calcula até 12 horas de caça no maior estágio vencido da última caçada: ouro, EXP, itens, Tamahagane e Éter.</p></article>`; break;
      case 'combat': html = `<article class="wiki-art"><h3>Como o combate funciona</h3>
        <p><b>Ataque básico:</b> a cada 1,5s ÷ velocidade. Gera 10 de energia. Pode ser esquivado.</p>
        <p><b>Habilidade:</b> automática, com recarga própria. Habilidades de cura/escudo esperam alguém ferido.</p>
        <p><b>Ultimate:</b> exige 100 de energia (ataques, dano recebido, efeitos). Com AUTO, é usada sozinha; sem AUTO, use Q W E R. Ultimates manuais mostram uma cena especial.</p>
        <p><b>Dano:</b> ATK × multiplicador × crítico × vantagem elemental × bônus, reduzido pela DEF do alvo (DEF ÷ (DEF + 2,2 × ATK base do atacante)), Marca, Redução de dano e variação de ±8%.</p>
        <p><b>Posições:</b> inimigos atacam a linha de frente 3× mais que a retaguarda; Vanguardas atraem o dobro. Provocação força todos os ataques no provocador.</p>
        <p><b>Foco:</b> clique num inimigo para que toda a equipe o ataque (clique de novo para soltar).</p>
        <p><b>Ataques telegrafados (⚠):</b> chefes e guardiões preparam golpes enormes; a área vermelha mostra quem será atingido. Escudos absorvem o dano.</p>
        <p><b>Fúria:</b> chefes ganham +25% de ATK a cada 10s após o tempo limite.</p>
        <p><b>Derrota:</b> na caçada, a equipe recua 1 estágio e desliga o avanço automático; em dungeons e chefes, você pode tentar de novo ou voltar a treinar.</p>
        <h4>Efeitos de status</h4><div class="wiki-grid">${Object.entries(D.statusInfo).map(([k, s2]) => `<div data-wiki-entry><b style="color:${s2.color}">${s2.icon} ${s2.name}</b><small>${s2.buff ? 'Benéfico · ' : 'Negativo · '}${s2.text}</small></div>`).join('')}</div></article>`; break;
      case 'classes': html = `<div class="wiki-grid wide">${Object.entries(D.classes).map(([cls, c]) => `<article class="wiki-card" data-wiki-entry><h3>${c.icon} ${cls}</h3><p><b>Posição ideal:</b> ${c.row}</p><p><b>Traço:</b> ${c.trait}</p><p><b>Base (nível 1):</b> HP ${c.base.hp} · ATK ${c.base.atk} · DEF ${c.base.def} · Vel ×${c.base.spd} · Crit ${pct(c.base.crit)}</p><p><b>Sinergia:</b> ${c.synergy.map(s2 => `(${s2.n}) ${s2.text}`).join(' · ')}</p><p><b>Atributos sugeridos:</b> ${PR.classAttrHint[cls]}</p><p class="dim">${D.roster.filter(h => h.cls === cls).map(h => h.name).join(', ')}</p></article>`).join('')}</div>`; break;
      case 'elements': html = `<article class="wiki-art"><h3>Vantagens elementais</h3><p>Atacar um elemento fraco causa <b>+30%</b> de dano (mais o bônus Elemental dos itens). Atacar quem é forte contra você causa <b>−20%</b>. Luz e Sombra são fortes uma contra a outra.</p><div class="wiki-grid">${Object.entries(D.elements).map(([el, e2]) => `<div data-wiki-entry><b style="color:${e2.color}">${e2.icon} ${el}</b><small>Forte contra: ${e2.strong.join(', ')}</small><small>Fraco contra: ${Object.entries(D.elements).filter(([, o]) => o.strong.includes(el)).map(([k]) => k).join(', ') || '—'}</small></div>`).join('')}</div><h4>Sinergia de elemento</h4><ul>${D.elementSynergy.map(s2 => `<li>(${s2.n} heróis) ${s2.text}</li>`).join('')}</ul></article>`; break;
      case 'synergy': html = `<article class="wiki-art"><h3>Laços</h3><p>Heróis com história juntos ganham bônus quando estão na mesma equipe. Um herói pode ativar vários laços.</p><div class="wiki-grid wide">${D.bonds.map(b => `<div class="bond" data-wiki-entry><div class="bond-faces">${b.ids.map(id => `<img src="${portrait(id)}" alt="">`).join('')}</div><div><b>${esc(b.name)}</b><small>${b.ids.map(id => D.roster.find(h => h.id === id).name).join(' + ')}</small><small>${esc(b.text)}</small></div></div>`).join('')}</div></article>`; break;
      case 'heroes': html = `<div class="wiki-heroes">${D.roster.map(h => `<article class="wiki-hero" data-wiki-entry><img src="${portrait(h.id)}" alt="" loading="lazy"><div><h4>${esc(h.name)} <small>${esc(h.franchise)}</small></h4><div class="tags">${clsTag(h.cls)} ${elTag(h.el)}</div><p><b>Passiva — ${esc(h.passive.name)}:</b> ${esc(h.passiveText)}</p><p><b>Habilidade — ${esc(h.skill.name)}</b> (${String(h.skill.cd).replace('.', ',')}s): ${esc(h.skillText)}</p><p><b>Ultimate — ${esc(h.ult.name)}:</b> ${esc(h.ultText)}</p></div></article>`).join('')}</div>`; break;
      case 'trees': html = `<article class="wiki-art"><h3>Árvores de talento e classes avançadas</h3><p>Cada herói tem sua própria árvore, baseada na classe. Ganha <b>1 ponto por nível</b> (+5 ao mudar de classe). A árvore tem três círculos: o I é livre, o II exige ${PR.TIER_REQ[1]} pontos investidos e o III exige a <b>classe avançada</b> e ${PR.TIER_REQ[2]} pontos. Nós <b>Notáveis</b> dão bônus grandes; <b>Pedras-chave</b> mudam o estilo de jogo com uma desvantagem. Os nós <b>Maestria</b> e <b>Ápice</b> fortalecem a habilidade e a ultimate exclusivas do herói.</p><p><b>Mudança de Classe:</b> no nível ${PR.JOB_LEVEL}, por ${U.fmt(PR.jobCost.gold)} ouro e ${PR.jobCost.crystal} cristais: +10% HP/ATK/DEF, +5 pontos e acesso ao Círculo III.</p>
        ${Object.entries(PR.classTrees).map(([cls, tree]) => `<h4>${D.classes[cls].icon} ${cls} → ${PR.jobs[cls].name}</h4><div class="wiki-grid">${tree.filter(n => !n.sig).map(n => `<div data-wiki-entry class="uniq"><span class="wiki-ico" style="--nc:${n.keystone ? '#ff7eb6' : n.notable ? '#ffcf6b' : D.classes[cls].color}">${svgIcon(n.icon, 22)}</span><div><b>${esc(n.name)}</b><small>Círculo ${['I', 'II', 'III'][n.tier]} · até ${n.max} rank(s)</small><small>${esc(n.hookText ? n.hookText(n.max) : Object.entries(n.stats).map(([k, v]) => statValue(k, v * n.max)).join(', ') || n.desc)}${n.max > 1 ? ' (no rank máximo)' : ''}</small>${n.keystone ? `<small>${esc(n.desc)}</small>` : ''}</div></div>`).join('')}</div>`).join('')}</article>`; break;
      case 'cards': html = `<article class="wiki-art"><h3>Cartas</h3><p>Cada monstro tem uma carta que cai raramente (${pct(.003, 1)} para monstros comuns, ${pct(.012, 1)} para elites, ${pct(.03)} para chefes de andar e ${pct(.04)} para chefes, multiplicado pela dificuldade). Cartas encaixam nos slots dos equipamentos: raros têm 0–1, épicos e conjuntos têm 1, lendários 1–2 e míticos 2. Encaixar é permanente; remover custa 30 cristais e devolve a carta.</p><div class="card-grid">${I.cards.map(cd => `<div class="card-tile ${cd.mvp ? 'mvp' : ''}" data-wiki-entry><span class="card-art"><img src="${KT.spriteUrl(cd.sprite)}" alt="" loading="lazy"></span><b>${esc(cd.name)}</b><small>${Object.entries(cd.stats).map(([k, v]) => statValue(k, v)).join(', ')}</small><small class="dim">${cd.mvp ? 'MVP · ' : ''}${pct(cd.chance, 1)} de chance</small></div>`).join('')}</div></article>`; break;
      case 'items': html = `<article class="wiki-art"><h3>Equipamentos</h3><p>Cada herói tem 4 espaços: ${Object.values(I.slots).map(s2 => `<b>${s2.name}</b> (${s2.desc.replace('.', '')})`).join(', ')}. O nível do item (Nv.) depende da região e do estágio.</p>
        <h4>Raridades</h4><div class="wiki-grid">${D.rarities.map(r => `<div data-wiki-entry><b style="color:${r.color}">${r.label}</b><small>Atributo principal ×${String(r.mult).replace('.', ',')} · ${r.affixes} afixo(s)${r.id === 'mythic' ? ' + efeito único' : r.id === 'set' ? ' + bônus de conjunto' : ''}</small></div>`).join('')}</div>
        <h4>Afixos possíveis</h4><div class="wiki-grid">${I.affixes.map(a => `<div data-wiki-entry><b>${a.name}</b><small>${D.statNames[a.stat] || a.stat}: ${a.pct ? `${pct(a.min, 1)}–${pct(a.max, 1)}` : `${a.min}–${a.max}`} (escala com o nível)</small></div>`).join('')}</div>
        <h4>Conjuntos</h4><div class="wiki-grid wide">${I.sets.map(s2 => `<div data-wiki-entry style="--sc:${s2.color}" class="set-card"><b style="color:${s2.color}">${s2.name}</b><small>Fonte: ${s2.source} · Nv. mínimo ${s2.ilvl}</small><small>Peças: ${Object.values(s2.pieces).map(p => p[0]).join(', ')}</small><small>(2) ${s2.bonus2.text}</small><small>(4) ${s2.bonus4.text}</small></div>`).join('')}</div>
        <h4>Itens Míticos (únicos)</h4><div class="wiki-grid wide">${I.uniques.map(q => `<div data-wiki-entry class="uniq"><img class="item-art" src="${KT.iconUrl(q.icon, q.hue)}" alt=""><div><b style="color:#ff5d8f">${q.name}</b><small>${I.slots[q.slot].name} · Nv. ${q.minIlvl}+ · ${q.source}</small><small>${Object.entries(q.stats).map(([k, v]) => statValue(k, v)).join(', ')}</small><small>✦ ${q.effect}</small></div></div>`).join('')}</div>
        <h4>Bases</h4><div class="wiki-grid">${I.bases.map(b => `<div data-wiki-entry class="uniq"><img class="item-art" src="${KT.iconUrl(b.icon, b.hue)}" alt=""><div><b>${b.name}</b><small>${I.slots[b.slot].name} · a partir do Nv. ${b.minIlvl}</small><small class="dim">${b.flavor}</small></div></div>`).join('')}</div>
        <h4>Forja e Oficina</h4><p>Aprimorar (+1 a +15): +10% no atributo principal e +5% nos afixos por nível. Acima de +5 pode falhar (sem perder o item). O limite depende do nível da Forja. Desmontar gera Tamahagane, Éter e ouro. Encantar re-sorteia um afixo com Éter.</p></article>`; break;
      case 'monsters': html = `<div class="foe-grid">${Object.keys(D.enemies).filter(id => !D.enemies[id].boss).map(id => this.foeCard(id)).join('')}</div>`; break;
      case 'world': html = `${Object.values(D.zones).filter(z => z.kind !== 'village').map(z => `<article class="wiki-zone" data-wiki-entry><img src="assets/scenes/${z.id}.png" alt="" loading="lazy"><div><h4>${z.title} <small>${z.kicker}</small></h4><p>${esc(z.lore)}</p><p><b>Desbloqueio:</b> ${this.engine.zoneLock(z.id).reasons.map(r => r.text).join(' · ')}</p>${z.weakTo ? `<p><b>Fraquezas:</b> ${z.weakTo.map(elTag).join(' ')}</p>` : ''}<p><b>Monstros:</b> ${(z.kind === 'boss' ? [z.enemy] : [...z.pool, ...z.elites, ...(z.floorBoss ? [z.floorBoss] : [])]).map(id => D.enemies[id].name).join(', ')}</p></div></article>`).join('')}<h3>Chefes</h3>${['boss','boss_tide','boss_event'].map(id => this.bossInfo(D.enemies[D.zones[id].enemy])).join('')}<h4>Dificuldades de chefe</h4><ul>${D.bossTiers.map(t => `<li><b>${t.name}</b>: poder ×${String(t.mult).replace('.', ',')} · recompensas ×${String(t.reward).replace('.', ',')}${t.needKills ? ` · libera após ${t.needKills} vitória(s)` : ''}</li>`).join('')}</ul>
        <h4>Eventos mundiais (a cada 2 horas)</h4><div class="wiki-grid">${D.worldEvents.map(ev => `<div data-wiki-entry><b style="color:${ev.color}">${ev.icon} ${ev.name}</b><small>${ev.text}</small></div>`).join('')}</div>
        <h4>Encontros especiais (caçadas)</h4><div class="wiki-grid">${D.encounters.map(en => `<div data-wiki-entry><b>${en.name}</b><small>${en.text}</small></div>`).join('')}${D.blessings.map(b => `<div data-wiki-entry><b>Santuário: ${b.name}</b><small>${b.text}</small></div>`).join('')}</div>`; break;
      case 'progress': html = `<article class="wiki-art"><h3>Progressão</h3>
        <h4>Nível dos heróis</h4><p>EXP de combate é dividida entre os 4 heróis. Cada nível: +6,5% em HP/ATK/DEF e ${PR.ATTR_PER_LEVEL} pontos de atributo. Nível máximo = 12 + 8 × estrelas (1★: 20 · 6★: 60). EXP necessária: ${[1, 5, 10, 20, 30].map(l => `Nv.${l}: ${U.fmt(S().heroXpNext(l))}`).join(' · ')}.</p>
        <h4>Atributos (estilo clássico)</h4><div class="wiki-grid">${Object.values(PR.attributes).map(a => `<div data-wiki-entry><b style="color:${a.color}">${a.short} · ${a.name}</b><small>${a.text}</small></div>`).join('')}</div>
        <h4>Raridade e estrelas</h4><p>${D.heroRarities.map(r => `${r.label}: ×${String(r.mult).replace('.', ',')} atributos, começa com ${{ common:1, rare:2, epic:3, legendary:4 }[r.id]}★`).join(' · ')}. Cada ★ extra: +12% HP/ATK/DEF. Custo de Despertar (fragmentos): ${[1, 2, 3, 4, 5].map(s2 => `${s2}→${s2 + 1}★: ${S().awakenCost(s2, 1).shards}`).join(' · ')}.</p>
        <h4>Conta e talentos</h4><p>A conta sobe de nível com 35% da EXP de combate. Cada nível: 1 ponto de talento e 10 cristais. A cada 3 níveis, o limite das construções aumenta. A Constelação do Laço tem três caminhos (Lâmina, Arcano, Guardião), nós Notáveis, Pedras-chave com efeitos fortes e desvantagens, e nós exclusivos de classe.</p>
        <h4>Treino da equipe (Dojo)</h4><div class="wiki-grid">${Object.values(PR.training).map(t => `<div data-wiki-entry><b>${t.name}</b><small>${t.text}</small></div>`).join('')}</div>
        <h4>Estágios</h4><p>Cada estágio tem 3 ondas + 1 onda de Guardião. Inimigos ficam 20% mais fortes a cada estágio. Estágios múltiplos de 4 têm dois guardiões; o estágio 12 é o desafio final da caçada.</p>
        <h4>Guia do Viajante</h4><ol>${D.guide.map(g => `<li><b>${g.title}</b> — ${g.desc}</li>`).join('')}</ol></article>`; break;
      case 'economy': html = `<article class="wiki-art"><h3>Economia</h3><h4>Construções</h4><div class="wiki-grid wide">${Object.values(D.buildings).map(b => `<div data-wiki-entry><b>${b.icon} ${b.name}</b><small>${b.desc}</small><small>Custo base ${U.fmt(b.baseCost)} ouro · ×${String(b.growth).replace('.', ',')} por nível</small></div>`).join('')}</div>
        <h4>Loja</h4><div class="wiki-grid wide">${[...PR.shop.gold, ...PR.shop.crystal].map(o => `<div data-wiki-entry><b>${o.name}</b><small>${o.text}</small><small>${Object.entries(o.price).map(([k, v]) => `${U.fmt(v)} ${k === 'gold' ? 'ouro (escala com o progresso)' : 'cristais'}`).join('')}</small></div>`).join('')}</div>
        <h4>Contratos</h4><div class="wiki-grid">${D.contracts.map(c => `<div data-wiki-entry><b>${c.title}</b><small>${c.text.replace('{n}', c.n.join('/'))}</small></div>`).join('')}</div>
        <h4>Conquistas</h4><div class="wiki-grid">${D.achievements.map(a => `<div data-wiki-entry><b>${a.title}</b><small>${a.text}</small></div>`).join('')}</div>
        <h4>Desmontagem</h4><p>Comum: 1 Tamahagane/1 Éter · Raro: 3/3 · Épico: 6/8 · Lendário: 12/18 · Mítico: 20/35 · Conjunto: 10/20 (escala com o nível e o aprimoramento).</p></article>`; break;
    }
    return `<div class="wiki-search">${search}</div><div class="wiki-body">${html}</div>`;
  };

  // ---------------------------------------------------------------------------
  // AÇÕES
  // ---------------------------------------------------------------------------
  P.handleInput = function(e) {
    const t = e.target;
    if (t.id === 'wiki-search') { this.wikiQuery = t.value; const q = t.value.trim().toLocaleLowerCase('pt-BR'); this.el.modalBody.querySelectorAll('[data-wiki-entry]').forEach(n => { n.hidden = !!q && !n.textContent.toLocaleLowerCase('pt-BR').includes(q); }); }
    if (t.id === 'auto-salvage' && e.type === 'change') { this.state.settings.autoSalvage = t.value; this.toast(t.value === 'none' ? 'Auto-desmontar desligado.' : `Itens ${t.value === 'common' ? 'comuns' : t.value === 'rare' ? 'comuns e raros' : 'até épicos'} serão desmontados automaticamente.`); }
    if (t.id === 'set-sound' && e.type === 'change') document.querySelector('#sound-btn').click();
    if (t.id === 'set-repeat' && e.type === 'change') this.state.settings.autoRepeat = t.checked;
  };

  P.handleAction = function(ev) {
    const b = ev.target.closest('button,[data-talent-node],[data-remove],[data-hero]'); if (!b) return;
    const d = b.dataset, e = this.engine, s = this.state;
    const refresh = () => { this.refreshPanel(); this.renderResources(); };
    if (d.remove) { ev.stopPropagation(); e.removeFromParty(d.remove); this.selectedSlot = s.formation.indexOf(null) >= 0 ? s.formation.indexOf(null) : this.selectedSlot; this.dockKey = ''; refresh(); return; }
    if (d.go) { const [p, param] = d.go.split(':'); this.openPanel(p, param); return; }
    if (d.tabGo) { this.view.tab = d.tabGo; this.refreshPanel(true); return; }
    if (d.previewZone) { this.view.stage = null; this.view.floor = null; this.view.tier = null; this.openPanel('destination', d.previewZone); return; }
    if (d.pickStage) { this.view.stage = Number(d.pickStage); this.refreshPanel(); return; }
    if (d.pickFloor) { this.view.floor = Number(d.pickFloor); this.refreshPanel(); return; }
    if (d.pickTier !== undefined) { this.view.tier = Number(d.pickTier); this.refreshPanel(); return; }
    if (d.enter) { const opts = d.opts ? JSON.parse(d.opts) : {}; if (e.enterZone(d.enter, opts)) { this.closeModal(); this.el.result.hidden = true; } return; }
    if (d.claimGuide !== undefined) { if (e.claimGuide()) this.callbacks.reward?.(); this.guideHtml = ''; this.renderGuide(); refresh(); return; }
    if (d.claimContract !== undefined) { if (e.claimContract(Number(d.claimContract))) this.callbacks.reward?.(); this.contractKey = ''; this.renderContracts(); refresh(); return; }
    if (d.claimAch) { if (e.claimAchievement(d.claimAch)) this.callbacks.reward?.(); refresh(); return; }
    if (d.result) { this.el.result.hidden = true; e.autoAfterResult = null; if (d.result === 'retry') e.repeatRun(); else if (d.result === 'hunt') e.fallbackToHunt(); else if (d.result === 'city') e.enterZone('village'); else if (d.result === 'map') { e.fallbackToHunt(); this.openPanel('journey'); } return; }
    if (d.choice) { this.el.choice.hidden = true; if (d.kind === 'route') e.chooseRoute(d.choice); else e.resolveEncounter(d.choice); return; }
    if (b.hasAttribute('data-open-box') || b.hasAttribute('data-open-box-all') || b.hasAttribute('data-open-box-10')) {
      const n = b.hasAttribute('data-open-box-all') ? s.starterRolls : b.hasAttribute('data-open-box-10') ? 10 : 1;
      const got = []; for (let i = 0; i < n; i++) { const h = e.openBox(true); if (h) got.push(h); }
      if (got.length) { this.closeModal(); this.showReveal(got); if (!s.story.seen.intro2) s.story.seen.intro2 = true; }
      return;
    }
    if (d.slot !== undefined) { this.selectedSlot = Number(d.slot); refresh(); return; }
    if (d.assign) { if (e.setParty(this.selectedSlot, d.assign)) { const nx = s.formation.indexOf(null); this.selectedSlot = nx >= 0 ? nx : this.selectedSlot; this.dockKey = ''; if (e.heroes.length === 4) this.callbacks.reward?.(); } refresh(); return; }
    if (d.hero && this.view.panel !== 'hero') { this.openPanel('hero', d.hero); return; }
    if (d.hero && this.view.panel === 'hero' && d.hero !== this.view.param) { this.openPanel('hero', d.hero); return; }
    if (d.attr) { e.addAttr(this.view.param, d.attr, Number(d.n || 1)); refresh(); return; }
    if (d.attrReset) { if (!e.resetAttr(d.attrReset)) this.toast('Ouro insuficiente.'); refresh(); return; }
    if (d.awaken) { if (!e.awaken(d.awaken)) this.toast('Fragmentos ou ouro insuficientes.'); else this.callbacks.summon?.('epic'); refresh(); return; }
    if (d.scroll) { e.useScroll(d.scroll); refresh(); return; }
    if (d.pickSlot) { this.pickSlot = this.pickSlot === d.pickSlot ? null : d.pickSlot; this.refreshPanel(); return; }
    if (d.equip) { e.equip(this.view.param, d.equip); this.pickSlot = null; this.callbacks.click?.(); refresh(); return; }
    if (d.unequip) { e.unequip(this.view.param, d.unequip); refresh(); return; }
    if (d.equipTarget) { const to = this.el.modalBody.querySelector('#equip-target')?.value; if (to) { e.equip(to, d.equipTarget); this.toast(`Equipado em <b>${esc(e.template(e.record(to).id).name)}</b>.`); } else this.toast('Monte a equipe primeiro.'); refresh(); return; }
    if (d.lock) { e.toggleLock(d.lock); refresh(); return; }
    if (d.salvage) { const v = e.salvage(d.salvage); if (v) this.toast(`Desmontado: +${v.ore} Tamahagane, +${v.dust} Éter.`); refresh(); return; }
    if (d.salvageAll) { const t = e.salvageMany(d.salvageAll); this.toast(t.n ? `${t.n} itens desmontados: +${t.ore} Tamahagane, +${t.dust} Éter, +${U.fmt(t.gold)} ouro.` : 'Nada para desmontar.'); refresh(); return; }
    if (d.forgeItem) { this.forgeSel = d.forgeItem; if (this.view.panel !== 'city') this.openPanel('city', 'forge'); else this.refreshPanel(); return; }
    if (d.upgrade) { const r = e.upgradeItem(d.upgrade); if (r.ok) { this.toast(`Aprimorado para <b>+${r.plus}</b>!`, 'gold'); this.callbacks.reward?.(); } else this.toast(r.reason); refresh(); return; }
    if (d.enchant) { if (e.enchantItem(d.enchant, Number(d.aff))) this.callbacks.click?.(); else this.toast('Recursos insuficientes.'); refresh(); return; }
    if (d.craft) { const g = Number(d.gold), du = Number(d.dust); if (s.player.gold >= g && s.player.dust >= du) { s.player.gold -= g; s.player.dust -= du; s.consumables[d.craft]++; this.toast('Criado!'); } refresh(); return; }
    if (d.talentHero) { this.view.talentHero = d.talentHero; this.view.param = d.talentHero; this.view.node = null; refresh(); return; }
    if (d.talentNode) { this.view.node = d.talentNode; this.refreshPanel(); return; }
    if (d.learn) { const uid = this.view.param; if (e.addHeroTalent(uid, d.learn)) { this.callbacks.click?.(); } refresh(); return; }
    if (d.heroTalentReset) { this.ask('Redefinir talentos', 'Devolver todos os pontos de talento deste herói?', [{ id:'yes', label:'Redefinir', primary:true }, { id:'no', label:'Cancelar' }]).then(x => { if (x === 'yes') { if (!e.resetHeroTalents(d.heroTalentReset)) this.toast('Ouro insuficiente.'); refresh(); } }); return; }
    if (d.job) { if (e.jobChange(d.job)) { this.callbacks.summon?.('legendary'); this.renderer.showBanner('MUDANÇA DE CLASSE!', PR.jobs[e.template(e.record(d.job).id).cls].name, '#ffcf6b'); } else this.toast('Requisitos não atendidos.'); refresh(); return; }
    if (d.socket) { if (e.socketCard(d.socket, e.state.inventory.find(x => x.uid === d.socket).cards.indexOf(null), d.card)) { this.toast('Carta encaixada!', 'gold'); this.callbacks.reward?.(); } refresh(); return; }
    if (d.unsocket) { if (!e.unsocketCard(d.unsocket, Number(d.idx))) this.toast('Cristais insuficientes.'); refresh(); return; }
    if (b.hasAttribute('data-sync-now')) { KT.Cloud.dirty = true; e.save(); KT.Cloud.push(true).then(() => { this.toast(KT.Cloud.status === 'ok' ? 'Salvo na nuvem!' : `Falha: ${KT.Cloud.error || KT.Cloud.status}`); refresh(); }); return; }
    if (b.hasAttribute('data-logout')) { e.save(); KT.Cloud.push(true).finally(() => KT.Net.logout().then(() => { KT.Cloud.enabled = false; location.reload(); })); return; }
    if (b.hasAttribute('data-logout-all')) { KT.Net.logoutAll().then(r => this.toast(r.ok ? 'Outras sessões encerradas.' : r.error)); return; }
    if (b.hasAttribute('data-change-pw')) { const cur = this.el.modalBody.querySelector('#pw-current').value, nx = this.el.modalBody.querySelector('#pw-next').value; KT.Net.changePassword({ current:cur, next:nx }).then(r => this.toast(r.ok ? 'Senha alterada. Outras sessões foram encerradas.' : r.error)); return; }
    if (b.hasAttribute('data-new-recovery')) { KT.Net.newRecovery(this.el.modalBody.querySelector('#rc-pass').value).then(r => { const out = this.el.modalBody.querySelector('#rc-out'); if (r.ok) out.innerHTML = `<div class="recovery-code"><code>${esc(r.recoveryCode)}</code></div><p class="note">Guarde este código: ele não será mostrado de novo.</p>`; else this.toast(r.error); }); return; }
    if (b.hasAttribute('data-load-history')) { KT.Net.history().then(r => { const out = this.el.modalBody.querySelector('#history-out'); out.innerHTML = r.ok ? (r.history.length ? `<ul class="history-list">${r.history.map(h => `<li>${new Date(h.created_at).toLocaleString('pt-BR')} · rev. ${h.revision}<button class="action small" data-restore="${h.id}" type="button">Restaurar</button></li>`).join('')}</ul>` : '<p class="dim">Nenhuma cópia ainda.</p>') : esc(r.error); }); return; }
    if (d.restore) { this.ask('Restaurar cópia', 'O progresso atual será substituído por esta cópia (o atual também vira uma cópia). Continuar?', [{ id:'yes', label:'Restaurar', primary:true }, { id:'no', label:'Cancelar' }]).then(x => { if (x !== 'yes') return; KT.Net.restore(Number(d.restore)).then(r => { if (r.ok) { KT.Cloud.enabled = false; KT.Utils.safeStorage.remove(KT.Cloud.storageKey); location.reload(); } else this.toast(r.error); }); }); return; }
    if (b.hasAttribute('data-delete-account')) { const pw = this.el.modalBody.querySelector('#del-pass').value, cf = this.el.modalBody.querySelector('#del-confirm').value; this.ask('Excluir conta', 'Isso apaga sua conta, save e histórico para sempre. Não dá para desfazer.', [{ id:'yes', label:'Excluir tudo', danger:true }, { id:'no', label:'Cancelar', primary:true }]).then(x => { if (x !== 'yes') return; KT.Net.deleteAccount({ password:pw, confirm:cf }).then(r => { if (r.ok) { KT.Cloud.enabled = false; KT.Utils.safeStorage.remove(KT.Cloud.storageKey); location.reload(); } else this.toast(r.error); }); }); return; }
    if (d.train) { if (!e.train(d.train)) this.toast('Ouro insuficiente ou limite atingido.'); else this.callbacks.click?.(); refresh(); return; }
    if (d.build) { if (!e.upgradeBuilding(d.build)) this.toast('Ouro insuficiente ou limite de nível.'); refresh(); return; }
    if (d.buy) { if (e.buy(d.buy)) { this.toast('Compra realizada!', 'gold'); this.callbacks.reward?.(); } else this.toast('Recursos insuficientes.'); refresh(); return; }
    if (d.market !== undefined) { if (e.buyMarket(Number(d.market))) this.toast('Comprado!', 'gold'); refresh(); return; }
    if (d.invSlot) { this.invFilter.slot = d.invSlot; this.refreshPanel(); return; }
    if (d.invSort) { this.invFilter.sort = d.invSort; this.refreshPanel(); return; }
    if (b.hasAttribute('data-save-name')) { const name = this.el.modalBody.querySelector('#player-name-entry')?.value.normalize('NFKC').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 20); if (name) { s.player.name = name; e.save(); this.toast('Nome salvo.'); refresh(); } return; }
    if (b.hasAttribute('data-save')) { e.save(); this.toast('Progresso salvo.', 'gold'); return; }
    if (b.hasAttribute('data-reset-save')) { this.ask('Recomeçar do zero', this.session?.mode === 'cloud' ? 'Isso apaga o progresso deste navegador E da nuvem (as cópias de segurança continuam disponíveis por um tempo). Continuar?' : 'Apagar TODO o progresso deste navegador?', [{ id:'yes', label:'Apagar e recomeçar', danger:true }, { id:'no', label:'Cancelar', primary:true }]).then(x => { if (x !== 'yes') return; const fresh = KT.State.createState(); if (this.session?.mode === 'cloud') { KT.Net.putSave(fresh, KT.Cloud.revision, true).then(() => { KT.Cloud.enabled = false; KT.Utils.safeStorage.remove(KT.Cloud.storageKey); location.reload(); }); } else { e.resetSave(); e.save = () => {}; location.reload(); } }); return; }
  };
})();
