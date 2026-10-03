// Console de batalha: tudo o que é comando fica ABAIXO do palco (nada sobre os heróis).
//   heróis   retrato, vida, energia, efeitos e a ultimate de cada um (Q W E R): numa coluna à esquerda do palco quando a
//            janela é larga e baixa (o palco fica maior), senão numa linha logo abaixo dele
//   comando  a equipe: quem comanda (AUTO, SEMI, MANUAL), Guarda, poção e elixir · Pontos de Técnica e a barra de ações
//            de quem age (Atacar, habilidades I a III, ultimate, Defender) com a explicação do que está sob o cursor ·
//            o alvo: vida, Resistência, fraquezas e a intenção dele
// No AUTO e no SEMI a barra acompanha quem está agindo e pisca a ação usada: dá para aprender o kit assistindo.
// Golpe cronometrado (comando MANUAL): depois da ordem, um anel fecha sobre o alvo; confirmar na faixa dourada rende mais.
// O desenho de cada tamanho (largo, normal, estreito, uma coluna no celular) está em theme-battle.css.
(() => {
  const KT = globalThis.KT, U = KT.Utils, D = KT.Data, P = KT.UIController.prototype;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const ULT_KEYS = ['Q', 'W', 'E', 'R'], ROMAN = ['I', 'II', 'III'], SKILL_OF = { s0:0, s1:1, s2:2 };
  const TIMING = { dur:.66, perfect:[.6, .84], good:[.42, .97] };
  const TOUCH = !!globalThis.matchMedia?.('(hover:none)').matches;   // sem teclado: os textos falam dos botões, não das teclas
  const TGT = { tgt:'um inimigo', all:'todos os inimigos', low:'o inimigo mais ferido', high:'o inimigo mais forte', back:'a retaguarda inimiga', front:'a linha de frente inimiga', rand:'um inimigo ao acaso', randEach:'inimigos ao acaso',
    self:'o próprio herói', allies:'toda a equipe', lowAlly:'o aliado mais ferido', atkAlly:'o aliado mais forte' };
  const OFF = new Set(['dmg', 'st', 'dispel', 'delay', 'execute', 'chain', 'brk']);
  const icon = (id, fallback = '') => KT.Icon?.html(id) || fallback;
  const kitIcon = (hero, slot, fallback) => KT.Icon?.kit(hero, slot) || fallback;
  const portrait = id => KT.portraitUrl(id);
  const brief = n => n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace('.', ',')}M` : n >= 1e5 ? `${Math.round(n / 1e3)}k` : U.fmt(n);   // vida máxima sem estourar a barra
  // Só mexe no DOM quando o valor muda (o console é atualizado ~12 vezes por segundo).
  const memo = new WeakMap();
  const put = (el, key, value, apply) => { if (!el) return; let m = memo.get(el); if (!m) memo.set(el, m = {}); if (m[key] === value) return; m[key] = value; apply(el, value); };
  const text = (el, v) => put(el, 'text', v, (n, x) => { n.textContent = x; });
  const html = (el, v) => put(el, 'html', v, (n, x) => { n.innerHTML = x; });
  const cls = (el, name, on) => put(el, `c:${name}`, !!on, (n, x) => n.classList.toggle(name, x));
  const css = (el, prop, v) => put(el, `s:${prop}`, v, (n, x) => n.style.setProperty(prop, x));
  const attr = (el, name, v) => put(el, `a:${name}`, v, (n, x) => { if (x === null || x === false) n.removeAttribute(name); else n.setAttribute(name, x === true ? '' : x); });
  const tip = (el, v) => put(el, 'tip', v, (n, x) => { n.dataset.tip = x; });

  const mainTarget = eff => { const o = eff.find(x => OFF.has(x.k)); return TGT[(o || eff[0] || {}).to] || TGT.self; };
  const breakOf = def => 2 + def.eff.filter(x => x.k === 'brk').reduce((a, x) => a + x.v, 0);
  const firstSentence = s => { const m = String(s || '').match(/^.*?[.!?](\s|$)/); return (m ? m[0] : String(s || '')).trim(); };

  // ---------- dicas ----------
  function skillTip(e, u, k) {
    const s = u.skills[k], def = s.def, st = e.skillState(u, k);
    const why = { locked:`Aprende no nível ${def.lv} do herói.`, silence:'Silenciado: habilidades e ultimate travadas.', rest:`Descansando: volta em ${s.tcd} ${s.tcd > 1 ? 'vezes' : 'vez'} do herói.`, sp:`Faltam Pontos de Técnica (custa ${def.cost}, a equipe tem ${Math.floor(e.sp || 0)}).` }[st] || '';
    return `<div class="tip-kit"><header><b>${esc(def.name)}</b><small>HABILIDADE ${ROMAN[k]}</small></header>
      <div class="meta"><span class="cost">${def.cost} PT</span>${def.tcd ? `<span>descansa ${def.tcd} vezes</span>` : ''}<span>Alvo: ${mainTarget(def.eff)}</span><span>Quebra ${breakOf(def)}</span></div>
      <p>${esc(def.text)}</p>${def.flavor ? `<i class="fl">“${esc(def.flavor)}”</i>` : ''}${why ? `<span class="why">${why}</span>` : ''}</div>`;
  }
  function ultTip(u, key) {
    const t = u.template;
    return `<div class="tip-kit"><header><b>${esc(t.ult.name)}</b><small>ULTIMATE${key && !TOUCH ? ` · ${key}` : ''}</small></header>
      <div class="meta"><span>100 de energia</span><span>fora da vez</span><span>Alvo: ${mainTarget(t.ult.eff)}</span><span>Quebra 3</span></div>
      <p>${esc(t.ultText)}</p>${t.ult.flavor ? `<i class="fl">“${esc(t.ult.flavor)}”</i>` : ''}<p style="color:var(--muted)">À mão rende +25%. Ultimates de heróis diferentes em sequência formam o Elo Kizuna.</p></div>`;
  }
  const TIPS = {
    attack:`<div class="tip-kit"><header><b>Atacar</b><small>AÇÃO DA VEZ</small></header><div class="meta"><span class="cost">+1 PT</span><span>+10 de energia</span><span>Quebra 1</span></div><p>Golpe básico no alvo marcado. Confirme de novo quando o anel chegar à faixa dourada: <b>BOM</b> rende +12%, <b>PERFEITO</b> +30% e 1 ponto a mais de Quebra.</p></div>`,
    defend:`<div class="tip-kit"><header><b>Defender</b><small>AÇÃO DA VEZ</small></header><div class="meta"><span class="cost">+1 PT</span><span>+15 de energia</span></div><p>Abre mão do golpe: o herói leva metade do dano até a próxima vez dele. Bom para quem o inimigo vai atacar e para juntar Pontos de Técnica.</p></div>`,
    guard:`<div class="tip-kit"><header><b>Guarda da equipe</b><small>A QUALQUER MOMENTO</small></header><div class="meta"><span>recarga de 6s</span></div><p>A equipe leva metade do dano por um instante. Erguida no bote de um golpe preparado (quando o anel fecha sobre a equipe) vira <b>APARO</b>: -80% de dano, sem atordoamento, +1 PT, energia para todos e 3 de Quebra no atacante.</p></div>`,
    potion:`<div class="tip-kit"><header><b>Poção de Cura</b><small>CONSUMÍVEL</small></header><div class="meta"><span>recarga de 20s</span></div><p>Recupera 35% da vida de toda a equipe.</p></div>`,
    elixir:`<div class="tip-kit"><header><b>Elixir de Energia</b><small>CONSUMÍVEL</small></header><div class="meta"><span>recarga de 30s</span></div><p>+50 de energia para toda a equipe: ultimates mais cedo.</p></div>`,
    sp:`<div class="tip-kit"><header><b>Pontos de Técnica</b><small>DA EQUIPE</small></header><p>As habilidades gastam PT. Golpe básico, defesa, Quebra de inimigo, Aparo e cada onda nova rendem 1 PT. A reserva vai de 0 a 6: com ela cheia, o que entrar se perde.</p></div>`
  };

  // ---------- montagem ----------
  P.initBattleHud = function() {
    if (this.el.bhud) return;
    // Na barra do herói o botão é só o ícone (o nome e a descrição vão na linha de baixo e na dica); a equipe leva o nome.
    const ab = (id, art, name, key, extra = '') => `<button class="ab ${extra}" data-ab="${id}" data-tip-touch type="button"${name ? ` aria-label="${name}"` : ''}><span class="ab-ic">${art ? icon(art, `<i class="ic ic-${{ 'cmd-attack':'swords', 'cmd-defend':'shield', 'cmd-guard':'shield', potion:'heal', elixir:'bolt' }[art] || 'star'}"></i>`) : ''}<span class="ab-veil"></span>${extra.includes('team') ? '<span class="ab-cd"></span>' : ''}</span>${key ? `<kbd>${key}</kbd>` : ''}${id[0] === 's' ? '<span class="ab-cost"></span>' : ''}${id === 'potion' || id === 'elixir' ? '<span class="ab-count">0</span>' : ''}${extra.includes('team') ? `<b class="ab-name">${name}</b>` : ''}</button>`;
    const hud = document.createElement('section'); hud.id = 'battle-hud'; hud.className = 'bhud'; hud.setAttribute('aria-label', 'Console de batalha');
    const MODE = [['auto', 'cmd-auto', 'AUTO', 'A equipe decide tudo sozinha.'], ['semi', 'cmd-semi', 'SEMI', 'A equipe age sozinha: as ultimates são suas.'], ['manual', 'cmd-manual', 'MANUAL', 'Na vez de cada herói a luta espera a sua ordem.']];
    hud.innerHTML = `<div class="bh-grid">
      <div class="bh-party" id="bh-party"></div>
      <div class="bh-side bh-panel">
        <span class="bh-mode" role="group" aria-label="Quem comanda a luta">${MODE.map(([id, art, label, txt]) => `<button type="button" data-mode="${id}" data-tip="<b>Comando ${label}</b>${TOUCH ? '' : ' · tecla Z'}<br>${txt}">${icon(art)}<b>${label}</b></button>`).join('')}</span>
        <div class="bh-team" role="toolbar" aria-label="Ações da equipe">${ab('guard', 'cmd-guard', 'Guarda', 'ESPAÇO', 'team guard')}${ab('potion', 'potion', 'Poção', 'F', 'team')}${ab('elixir', 'elixir', 'Elixir', 'C', 'team')}</div>
      </div>
      <div class="bh-mid bh-panel">
        <div class="bh-sp"><span class="lbl">TÉCNICA</span><b>0</b><span class="beads">${'<i class="off"></i>'.repeat(KT.State.SP.max)}</span></div>
        <div class="bh-bar" role="toolbar" aria-label="Ações do herói">${ab('attack', 'cmd-attack', 'Atacar', 'ESPAÇO')}${ab('s0', '', '', '1', 'sk')}${ab('s1', '', '', '2', 'sk')}${ab('s2', '', '', '3', 'sk')}${ab('ult', '', '', '4', 'ult')}${ab('defend', 'cmd-defend', 'Defender', 'G')}</div>
        <p class="bh-info" aria-live="polite"></p>
        <button class="bh-allout" type="button" hidden>${icon('cmd-allout')}<span>ASSALTO TOTAL</span><small class="lg">todos quebrados: a equipe inteira golpeia</small><kbd>T</kbd></button>
      </div>
      <button class="bh-target bh-panel none" type="button"></button>
    </div>`;
    (document.querySelector('#party-strip') || document.querySelector('.stage-col').lastElementChild).before(hud);
    const $ = s => hud.querySelector(s);
    this.el.bhud = hud;
    this.bh = { party:$('#bh-party'), side:$('.bh-side'), modes:[...hud.querySelectorAll('.bh-mode button')], sp:$('.bh-sp'), beads:[...hud.querySelectorAll('.bh-sp .beads i')], spNum:$('.bh-sp b'), bar:$('.bh-bar'), info:$('.bh-info'), allout:$('.bh-allout'), target:$('.bh-target'),
      btn:Object.fromEntries([...hud.querySelectorAll('.ab')].map(b => [b.dataset.ab, b])) };
    this.bh.sp.dataset.tip = TIPS.sp;
    ['attack', 'defend', 'guard', 'potion', 'elixir'].forEach(k => { this.bh.btn[k].dataset.tip = TIPS[k]; });
    this.bh.target.dataset.tip = `Alvo da equipe. Para trocar, ${TOUCH ? 'toque num inimigo' : 'clique num inimigo ou aperte <b>X</b>'}.`;
    this.bh.allout.dataset.tip = '<b>Assalto Total</b><br>Todos os inimigos estão quebrados: cada herói golpeia cada inimigo de uma vez. Não gasta a vez de ninguém.';
    hud.addEventListener('click', ev => {
      const b = ev.target.closest('[data-ab]'); if (b) { if (!b.disabled || b.classList.contains('why')) this.bhAct(b.dataset.ab); return; }
      const ult = ev.target.closest('[data-ult]'); if (ult) { this.castUlt(Number(ult.dataset.ult)); return; }
      // No console estreito só o comando atual aparece: clicar nele passa para o próximo (AUTO → SEMI → MANUAL).
      const md = ev.target.closest('[data-mode]'); if (md) { if (md.dataset.mode !== this.engine.mode) this.setMode(md.dataset.mode); else if (this.bh.modes.some(b => !b.offsetWidth)) this.cycleMode(); return; }
      const face = ev.target.closest('[data-hero-detail]'); if (face) { this.openPanel('hero', face.dataset.heroDetail); return; }
      if (ev.target.closest('.bh-allout')) { this.bhAct('allout'); return; }
      if (ev.target.closest('.bh-target')) this.nextTarget();
    });
    // Em tela estreita as ações da equipe descem para a linha dos Pontos de Técnica: o que é toque fica junto, perto do polegar.
    const narrow = matchMedia('(max-width:900px)'), team = $('.bh-team'), seat = () => (narrow.matches ? this.bh.sp.after(team) : this.bh.side.append(team));
    seat(); narrow.addEventListener?.('change', seat);
    // O botão COMANDO do palco só some enquanto o seletor do console está à vista (console estreito não tem seletor).
    const modeBox = $('.bh-mode'), modeSeen = () => document.body.classList.toggle('bh-modes', modeBox.offsetWidth > 0);
    // Janela larga e baixa (a de quase todo notebook): sobra tela dos lados e falta em cima. Os heróis vão para uma coluna
    // à esquerda do palco e só o comando fica embaixo; se assim o palco não ficar maior, fica tudo embaixo.
    // As medidas espelham theme-battle.css: coluna de 250 + 6, comando de 106, console inteiro de 168 (180 no estreito).
    const col = hud.parentElement, low = matchMedia('(max-height:778px)'), SIDE = 256, DOCK_L = 106, ROOMY = 84;
    const fit = () => {
      const cs = getComputedStyle(col), w = col.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), h = col.clientHeight - 34;
      const below = Math.min(w, (h - (low.matches ? 180 : 168)) * 16 / 9), beside = Math.min(w - SIDE, (h - DOCK_L) * 16 / 9);
      document.body.classList.toggle('bh-l', !narrow.matches && beside >= 640 && beside > below);
      modeSeen();
      // Uma coluna com tela sobrando embaixo do console (janela estreita e alta, tablet pequeno): o comando passa para o
      // desenho folgado (botões grandes, de ponta a ponta). ROOMY é quanto ele cresce; só entra se couber e só sai se
      // estourar, para não ficar trocando.
      if (!narrow.matches || !hud.offsetHeight) { hud.classList.remove('roomy'); return; }
      const nav = document.querySelector('.side-nav'), free = innerHeight - (nav ? nav.offsetHeight : 0) - (hud.getBoundingClientRect().bottom + scrollY);
      const need = hud.clientWidth < 520 ? 82 : ROOMY;                                // quanto o desenho folgado cresce (celular / largura média)
      if (!hud.classList.contains('roomy')) { if (free >= need + 14) hud.classList.add('roomy'); }
      else if (free < 0) hud.classList.remove('roomy');
    };
    if (globalThis.ResizeObserver) { const ro = new ResizeObserver(fit); ro.observe(col); ro.observe(hud); }
    fit(); narrow.addEventListener?.('change', fit); low.addEventListener?.('change', fit);
    // Celular de tela muito baixa: se o console não couber inteiro acima da navegação, a página desce só o que falta para
    // a barra de ações ficar à vista (some o alto do cenário, nunca os heróis); se couber, volta para o alto.
    this.bhSeat = () => {
      if (!narrow.matches || !hud.offsetHeight) return;
      const nav = document.querySelector('.side-nav'), over = hud.getBoundingClientRect().bottom + scrollY + 6 - (innerHeight - (nav ? nav.offsetHeight : 0));
      const want = over > 4 ? Math.round(over) : 0;
      if (Math.abs(scrollY - want) > 2) scrollTo({ top:want, behavior:'smooth' });
    };
    // A descrição da ação sob o cursor, com o foco do teclado ou sob o dedo aparece na linha de baixo da barra.
    const hover = ev => { const b = ev.target.closest?.('[data-ab],[data-ult]'); this.bhHover = !b ? null : b.dataset.ab || `u${b.dataset.ult}`; }, leave = () => { this.bhHover = null; };
    [this.bh.bar, team, this.bh.party].forEach(box => {
      box.addEventListener('pointerover', ev => { if (ev.pointerType === 'mouse') hover(ev); }); box.addEventListener('pointerleave', leave);
      box.addEventListener('pointerdown', ev => { if (ev.pointerType !== 'mouse') hover(ev); }); box.addEventListener('pointerup', ev => { if (ev.pointerType !== 'mouse') leave(); }); box.addEventListener('pointercancel', leave);
      box.addEventListener('focusin', ev => { if (ev.target.matches?.(':focus-visible')) hover(ev); }); box.addEventListener('focusout', leave);
    });
    // Palco pequeno: o que a faixa central do canvas diria (ONDA, FASE, ASSALTO TOTAL…) vem para a linha de informação.
    this.renderer.onBanner = (title, sub) => this.bhSay(`<span class="say"><b>${esc(title)}</b>${sub ? ` · ${esc(sub)}` : ''}</span>`, 2800);
    // Durante o golpe cronometrado, um clique no palco confirma o tempo.
    this.el.canvas.addEventListener('pointerdown', ev => { if (this.bhPending) { ev.stopPropagation(); ev.preventDefault(); this.bhConfirm(); } }, true);
  };

  // ---------- ordens ----------
  P.timingOn = function() { return U.safeStorage.get('mythverse-timing') !== 'off'; };
  P.bhAct = function(what) {
    const e = this.engine, i = e.awaiting, u = i === null || i === undefined ? null : e.party[i];
    if (this.bhPending) { if (what === 'attack' || what === 'confirm' || what === this.bhPending.what) this.bhConfirm(); return true; }
    if (what === 'guard') return this.guard();
    if (what === 'potion' || what === 'elixir') { const ok = e.input(what); if (ok) this.bhDone(what); return ok; }
    if (what === 'allout') { const ok = e.input('act', 'allout'); if (ok) this.callbacks.click?.(); return ok; }
    if (what === 'ult') { const who = u ? i : e.party.findIndex(x => x.uid === this.bhActorUid); return who >= 0 ? this.castUlt(who) : false; }
    if (!u || e.phase !== 'fight') {
      if (e.active && e.mode !== 'manual' && !this.bhModeTold) { this.bhModeTold = true; this.toast(`No comando <b>${e.mode === 'auto' ? 'AUTO' : 'SEMI'}</b> a equipe escolhe as ações sozinha. Troque para <b>MANUAL</b> no botão COMANDO para dar as ordens.`, '', 'mode'); }
      return false;
    }
    if (what === 'defend') { const ok = e.input('act', 'defend'); if (ok) this.bhDone('defend'); return ok; }
    if (what === 'attack') return this.bhStart({ what, i });
    const k = SKILL_OF[what]; if (k === undefined) return false;
    const st = e.skillState(u, k);
    if (st !== 'ready') { const def = u.skills[k]?.def; if (def) this.bhSay({ locked:`<b>${esc(def.name)}</b>: aprende no nível ${def.lv}.`, silence:'Silenciado: só golpe básico ou defesa.', rest:`<b>${esc(def.name)}</b> descansa mais ${u.skills[k].tcd} ${u.skills[k].tcd > 1 ? 'vezes' : 'vez'}.`, sp:`Faltam Pontos de Técnica para <b>${esc(def.name)}</b> (custa ${def.cost}).` }[st] || '', 2200); return false; }
    return this.bhStart({ what, i, k });
  };
  // Ordem dada: com o golpe cronometrado ligado, abre o anel e espera a confirmação; senão, vai na hora.
  P.bhStart = function(p) {
    const e = this.engine, u = e.party[p.i];
    if (!this.timingOn() || this.state.settings.afk) return this.bhSend(p, 0);
    const def = p.k !== undefined ? u.skills[p.k].def : null, offensive = !def || def.eff.some(x => OFF.has(x.k));
    const tgt = offensive ? this.bhTargetOf(u) : null;
    this.bhPending = { ...p, t0:performance.now(), dur:TIMING.dur * 1000 };
    this.renderer.timing = { uid:tgt ? tgt.uid : u.uid, t:0, dur:TIMING.dur, result:null, perfect:TIMING.perfect, good:TIMING.good, color:u.color, name:def ? def.name : 'Atacar' };
    this.callbacks.click?.();
    clearTimeout(this.bhTimer); this.bhTimer = setTimeout(() => { if (this.bhPending) this.bhConfirm(true); }, this.bhPending.dur + 90);
    return true;
  };
  P.bhConfirm = function(late = false) {
    const p = this.bhPending; if (!p) return false;
    clearTimeout(this.bhTimer); this.bhPending = null;
    const k = (performance.now() - p.t0) / p.dur;
    const q = late ? 0 : k >= TIMING.perfect[0] && k <= TIMING.perfect[1] ? 2 : k >= TIMING.good[0] && k <= TIMING.good[1] ? 1 : 0;
    if (this.renderer.timing) { this.renderer.timing.result = q; this.renderer.timing.early = !late && k < TIMING.good[0]; this.renderer.timing.t = Math.min(this.renderer.timing.t, this.renderer.timing.dur); this.renderer.timing.done = 0; }
    return this.bhSend(p, q);
  };
  P.bhSend = function(p, q) {
    const e = this.engine;
    if (e.awaiting !== p.i) return false;                                         // a vez mudou (troca de comando, herói caiu)
    const ok = p.what === 'attack' ? e.input('act', `attack:${q}`) : e.input('skill', `${p.i}:${p.k}:${q}`);
    if (ok) this.bhDone(p.what);
    return ok;
  };
  P.bhDone = function(what) {
    this.turnSince = 0; this.callbacks.click?.();
    const b = this.bh?.btn[what]; if (b) { b.classList.remove('used'); void b.offsetWidth; b.classList.add('used'); }
  };
  P.bhSay = function(msg, ms = 2600) { this.bhMsg = msg; this.bhMsgUntil = performance.now() + ms; };
  // Em quem o herói vai bater (a mesma regra do motor, sem sortear nada): foco, provocação, depois a preferência da classe.
  P.bhTargetOf = function(u) {
    const e = this.engine, live = e.enemies.filter(x => x.alive); if (!live.length) return null;
    const vis = live.filter(x => !x.effects.some(f => f.s === 'stealth')), opp = vis.length ? vis : live;
    const taunt = opp.find(x => x.effects.some(f => f.s === 'taunt')); if (taunt) return taunt;
    const f = e.focusUid && opp.find(x => x.uid === e.focusUid); if (f) return f;
    if (u?.cls === 'Executor') return opp.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (u?.cls === 'Atirador') return opp.slice().sort((a, b) => (b.elite || b.boss) - (a.elite || a.boss) || b.hp - a.hp)[0];
    return opp[0];
  };
  // O motor avisa o que aconteceu: a barra pisca a ação usada e a linha de baixo conta.
  P.onFx = function(fx) {
    if (!this.bh || !fx) return;
    const e = this.engine;
    if (fx.type === 'attack' || (fx.type === 'cast' && !fx.enemy)) {
      const u = e.party.find(x => x.uid === fx.source); if (!u) return;
      this.bhLastUid = u.uid;
      if (fx.type === 'attack') this.bhFlash = { key:'attack', until:performance.now() + 380 };
      else {
        const name = fx.ult ? u.template.ult.name : fx.name, short = firstSentence(fx.ult ? u.template.ultText : (u.skills[fx.skill]?.def.text || ''));
        this.bhFlash = { key:fx.ult ? 'ult' : `s${fx.skill}`, uid:u.uid, until:performance.now() + 520 };
        this.bhSay(`<b>${esc(u.name.split(',')[0])}</b> usou <b>${esc(name)}</b>.<span class="lg"> ${esc(short)}</span>`, 3200);
      }
    } else if (fx.type === 'sp' && fx.delta > 0) this.bhSpGain = performance.now();
    else if (fx.type === 'break') { const t = e.enemies.find(x => x.uid === fx.uid); if (t) this.bhSay(`<b>QUEBRA!</b> ${esc(t.name.split(',')[0])} fica sem agir e recebe +35% de dano. +1 PT.`, 3000); }
    else if (fx.type === 'reaction') this.bhSay(`Reação elemental: <b>${esc(fx.name)}</b>.`, 2600);
    else if (fx.type === 'chain') { const u = e.party.find(x => x.uid === fx.uid); this.bhSay(`<span class="say gold"><b>Elo Kizuna ×${fx.n}</b></span> · ${u ? `<b>${esc(u.template.ult.name)}</b> ` : ''}com +${Math.round(e.chainBonus * 100)}%. Outro herói em até ${KT.State.CHAIN.window}s aumenta o elo.`, 3600); }
    else if (fx.type === 'allOutReady' && e.mode === 'manual') this.bhSay(`Todos os inimigos quebrados: <b>ASSALTO TOTAL</b> disponível${TOUCH ? '' : ' (<kbd>T</kbd>)'}.`, 4000);
  };

  // ---------- desenho ----------
  const fxIcons = (u, max) => { const seen = new Set(), out = []; for (const f of u.effects) { if (seen.has(f.s) || out.length >= max) continue; seen.add(f.s); const info = D.statusInfo[f.s]; if (!info) continue; out.push(`<i class="pi pi-st-${f.s} ${info.buff ? 'good' : 'bad'}" title="${esc(info.name)}"></i>`); } if (u.shield > 0 && out.length < max) out.push('<i class="pi pi-st-shield good" title="Escudo"></i>'); return out.join(''); };

  P.renderBattleHud = function() {
    const e = this.engine, B = this.bh; if (!B) return;
    if (!e.active) { this.bhSeated = false; this.turnIdleTold = false; return; }
    const party = [0, 1, 2, 3].map(i => e.party.find(u => u.slot === i) || null), now = performance.now(), fight = e.phase === 'fight';
    if (!this.bhSeated && fight) { this.bhSeated = true; setTimeout(() => this.bhSeat?.(), 450); setTimeout(() => this.bhSeat?.(), 1400); }
    // ----- equipe -----
    const key = party.map(u => (u ? u.uid : '-')).join('|');
    if (key !== this.bhKey) {
      this.bhKey = key; this.bhActorUid = null;
      B.party.innerHTML = party.map((u, n) => {
        if (!u) return '<article class="bh-unit bh-panel dead"></article>';
        const t = u.template, idx = e.party.indexOf(u);
        return `<article class="bh-unit bh-panel" data-uid="${u.uid}" style="--hc:${t.color}">
          <button class="bh-face" data-hero-detail="${u.recUid}" type="button" data-tip="Ficha de ${esc(t.name)}"><img src="${portrait(t.id)}" alt=""><em>${u.level}</em></button>
          <div class="bh-vit"><header><b>${(n => { const [first, ...rest] = n.split(' '); return `${esc(first)}${rest.length ? `<span class="ln"> ${esc(rest.join(' '))}</span>` : ''}`; })(t.name.split(',')[0])}</b><span class="bh-tags">${icon(KT.Icon?.cls(t.cls))}<i class="tx">${t.cls}</i>${icon(KT.Icon?.element(t.el))}<i class="tx">${t.el}</i></span><span class="bh-fx"></span></header><div class="bh-hp"><i class="fill"></i><i class="sh"></i><em><span></span><small></small></em></div><div class="bh-en"><i></i></div><span class="bh-fx row"></span></div>
          <button class="bh-ult" data-ult="${idx}" data-tip-touch type="button">${kitIcon(t.id, 'u', icon('cmd-ult', '<i class="ic ic-star"></i>'))}<kbd>${ULT_KEYS[idx] || ''}</kbd><span class="pct"></span></button>
        </article>`;
      }).join('');
      B.units = [...B.party.children].map(card => ({ card, hp:card.querySelector('.bh-hp'), fill:card.querySelector('.bh-hp .fill'), sh:card.querySelector('.bh-hp .sh'), hpTxt:card.querySelector('.bh-hp em span'), hpMax:card.querySelector('.bh-hp em small'), en:card.querySelector('.bh-en i'), fx:card.querySelector('.bh-fx'), fxRow:card.querySelector('.bh-fx.row'), ult:card.querySelector('.bh-ult'), pct:card.querySelector('.pct'), lv:card.querySelector('.bh-face em') }));
      party.forEach((u, n) => { if (u && B.units[n].ult) B.units[n].ult.dataset.tip = ultTip(u, ULT_KEYS[e.party.indexOf(u)]); });
    }
    const waitI = fight ? e.awaiting : null, waiting = waitI !== null && waitI !== undefined ? e.party[waitI] : null;
    party.forEach((u, n) => {
      const c = B.units[n]; if (!u || !c.fill) return;
      const hp = U.clamp(u.hp / u.maxHp, 0, 1), sh = U.clamp(u.shield / u.maxHp, 0, 1 - hp), ready = u.alive && u.energy >= 100 && fight && e.canAct(u) && !u.effects.some(x => x.s === 'silence');
      css(c.fill, 'width', `${(hp * 100).toFixed(1)}%`); css(c.sh, 'left', `${(hp * 100).toFixed(1)}%`); css(c.sh, 'width', `${(sh * 100).toFixed(1)}%`);
      text(c.hpTxt, u.alive ? U.fmt(Math.max(0, Math.ceil(u.hp))) : 'K.O.'); text(c.hpMax, u.alive ? ` / ${brief(Math.ceil(u.maxHp))}` : ''); cls(c.hp, 'low', hp < .3);
      css(c.en, 'width', `${U.clamp(u.energy, 0, 100).toFixed(0)}%`);
      const fxs = fxIcons(u, 6); html(c.fx, fxs); html(c.fxRow, fxs); text(c.lv, String(u.level));
      // Elo Kizuna aberto: quem pode continuar a corrente (outro herói, com a ultimate pronta) mostra o bônus no botão.
      const CH = KT.State.CHAIN, link = ready && e.ultChain >= 1 && e.zoneElapsed - e.lastUltAt <= CH.window && e.party.indexOf(u) !== e.lastUltHero;
      attr(c.ult, 'disabled', !ready); cls(c.ult, 'ready', ready); cls(c.ult, 'chain', link); css(c.ult, '--nrg', (U.clamp(u.energy / 100, 0, 1)).toFixed(2));
      text(c.pct, !u.alive ? '' : link ? `+${Math.round(e.ultChain * (CH.per + (u.st.chainPow || 0)) * 100)}%` : `${Math.floor(u.energy)}`);
      cls(c.card, 'ultready', ready); cls(c.card, 'dead', !u.alive);
      const prev = this.lastHp.get(u.uid); if (prev !== undefined && u.hp < prev - u.maxHp * .05) { c.card.classList.remove('hurt'); void c.card.offsetWidth; c.card.classList.add('hurt'); }
      this.lastHp.set(u.uid, u.hp);
    });
    // ----- quem está no comando -----
    const manual = e.mode === 'manual';
    let actor = waiting;
    if (!actor && manual && fight) { const nx = e.turnOrder(8).find(o => o.kind === 'hero'); actor = nx && e.party.find(u => u.uid === nx.uid); }
    if (!actor) actor = e.party.find(u => u.uid === this.bhLastUid && u.alive) || e.party.find(u => u.alive) || e.party[0];
    if (!actor) return;
    const state = waiting ? 'turn' : manual ? 'next' : 'auto';
    attr(this.el.bhud, 'data-state', state);
    party.forEach((u, n) => { const c = B.units[n]; if (!c) return; cls(c.card, 'acting', !!u && u === actor && fight); cls(c.card, 'turn', !!u && u === waiting); });
    if (actor.uid !== this.bhActorUid) {
      this.bhActorUid = actor.uid;
      const t = actor.template;
      actor.skills.forEach((s, k) => {
        const b = B.btn[`s${k}`];
        b.querySelector('.ab-ic > i')?.remove();
        b.querySelector('.ab-ic').insertAdjacentHTML('afterbegin', kitIcon(t.id, `s${k}`, `<i class="ic ic-burst"></i>`));
        b.setAttribute('aria-label', `${s.def.name}, ${s.def.cost} PT`);
        b.querySelector('.ab-cost').innerHTML = '<i></i>'.repeat(s.def.cost);
        memo.delete(b); memo.delete(b.querySelector('.ab-veil'));
      });
      const ub = B.btn.ult; ub.querySelector('.ab-ic > i')?.remove();
      ub.querySelector('.ab-ic').insertAdjacentHTML('afterbegin', kitIcon(t.id, 'u', icon('cmd-ult', '<i class="ic ic-star"></i>')));
      ub.setAttribute('aria-label', `Ultimate: ${t.ult.name}`); memo.delete(ub);
    }
    B.modes.forEach(b => cls(b, 'on', b.dataset.mode === e.mode));
    // ----- barra de ações -----
    const silenced = actor.effects.some(x => x.s === 'silence'), myTurn = !!waiting && !this.bhPending, flash = this.bhFlash && now < this.bhFlash.until ? this.bhFlash : null;
    attr(B.btn.attack, 'disabled', !waiting); attr(B.btn.defend, 'disabled', !myTurn);
    cls(B.btn.attack, 'flash', flash?.key === 'attack');
    actor.skills.forEach((s, k) => {
      const b = B.btn[`s${k}`], st = e.skillState(actor, k), veil = b.querySelector('.ab-veil');
      attr(b, 'disabled', !(myTurn && st === 'ready')); cls(b, 'rest', st === 'rest'); cls(b, 'locked', st === 'locked'); cls(b, 'nosp', st === 'sp'); cls(b, 'why', !!waiting && st !== 'ready');
      html(veil, st === 'rest' ? String(s.tcd) : st === 'locked' ? `${icon('sys-lock')}Nv ${s.def.lv}` : '');
      cls(b, 'flash', flash?.key === `s${k}` && flash.uid === actor.uid);
      tip(b, skillTip(e, actor, k));
    });
    const ultReady = actor.alive && actor.energy >= 100 && fight && e.canAct(actor) && !silenced;
    attr(B.btn.ult, 'disabled', !ultReady); cls(B.btn.ult, 'ready', ultReady); css(B.btn.ult, '--nrg', (U.clamp(actor.energy / 100, 0, 1)).toFixed(2));
    cls(B.btn.ult, 'flash', flash?.key === 'ult' && flash.uid === actor.uid); tip(B.btn.ult, ultTip(actor, '4'));
    // Espaço: ataca na vez de um herói; fora dela, ergue a Guarda. O teclado mostra a tecla só no botão que ela aciona agora.
    css(B.btn.attack.querySelector('kbd'), 'visibility', waiting ? 'visible' : 'hidden'); css(B.btn.guard.querySelector('kbd'), 'visibility', waiting ? 'hidden' : 'visible');
    const G = KT.State.GUARD, gcd = e.guardCd || 0, up = e.guardT > 0, danger = e.enemies.some(x => x.alive && x.striking);
    attr(B.btn.guard, 'disabled', !fight || gcd > 0); css(B.btn.guard.querySelector('.ab-cd'), '--cd', U.clamp(gcd / G.cd, 0, 1).toFixed(2));
    cls(B.btn.guard, 'up', up); cls(B.btn.guard, 'alert', danger && !up && gcd <= 0 && fight);
    const cons = this.state.consumables;
    [['potion', e.potionCd, 20], ['elixir', e.elixirCd, 30]].forEach(([id, cd, max]) => { const b = B.btn[id]; attr(b, 'disabled', !cons[id] || cd > 0 || !fight); text(b.querySelector('.ab-count'), String(cons[id] || 0)); css(b.querySelector('.ab-cd'), '--cd', U.clamp((cd || 0) / max, 0, 1).toFixed(2)); });
    // ----- Pontos de Técnica -----
    const sp = e.sp || 0, whole = Math.floor(sp + 1e-6);
    B.beads.forEach((b, n) => { const on = n < whole; put(b, 'on', on, (el, v) => { el.className = v ? 'pi pi-sp' : 'off'; if (v && this.bhSpGain && now - this.bhSpGain < 400) el.classList.add('gain'); }); });
    text(B.spNum, String(whole));
    // ----- Assalto Total -----
    const allOut = !!(e.allOut && manual && fight);
    attr(B.allout, 'hidden', !allOut); cls(this.el.bhud, 'allout', allOut);
    // ----- linha de informação -----
    let info = '';
    if (this.bhPending) info = `${TOUCH ? 'Toque de novo' : 'Confirme'} quando o anel chegar à <b>faixa dourada</b>.`;
    else if (this.bhHover && this.bhHover in SKILL_OF && actor.skills[SKILL_OF[this.bhHover]]) {
      const k = SKILL_OF[this.bhHover], sk = actor.skills[k], d = sk.def, st = e.skillState(actor, k);
      const why = { locked:`Aprende no nível ${d.lv}.`, silence:'Silenciado.', rest:`Descansa mais ${sk.tcd} ${sk.tcd > 1 ? 'vezes' : 'vez'}.`, sp:`Faltam Pontos de Técnica.` }[st];
      info = `<b>${esc(d.name)}</b> · <span class="pt">${d.cost} PT</span> · Quebra ${breakOf(d)}${d.tcd ? ` · descansa ${d.tcd}` : ''} · ${why ? `<span class="why">${why}</span> ` : ''}${esc(d.text)}`;
    }
    else if (this.bhHover === 'ult' || /^u\d/.test(this.bhHover || '')) { const who = this.bhHover === 'ult' ? actor : e.party[Number(this.bhHover.slice(1))] || actor; info = `<b>${esc(who.template.ult.name)}</b> · <span class="pt">100 de energia</span> · fora da vez de ${esc(who.name.split(',')[0])} · ${esc(who.template.ultText)}`; }
    else if (this.bhHover === 'attack') info = '<b>Atacar</b> · <span class="pt">+1 PT</span> · +10 de energia · Golpe básico no alvo marcado. No golpe cronometrado, confirme de novo na faixa dourada.';
    else if (this.bhHover === 'defend') info = '<b>Defender</b> · <span class="pt">+1 PT</span> · +15 de energia · O herói leva metade do dano até a próxima vez dele.';
    else if (this.bhHover === 'guard') info = '<b>Guarda da equipe</b> · recarga de 6s · Metade do dano em todos. Erguida no bote de um golpe preparado vira <b>Aparo</b>.';
    else if (this.bhHover === 'potion') info = '<b>Poção de Cura</b> · recarga de 20s · +35% de vida para toda a equipe.';
    else if (this.bhHover === 'elixir') info = '<b>Elixir de Energia</b> · recarga de 30s · +50 de energia para toda a equipe.';
    else if (this.bhMsg && now < this.bhMsgUntil) info = this.bhMsg;
    else if (state === 'turn') info = `Vez de <b>${esc(actor.name.split(',')[0])}</b>: escolha a ação.`;
    else if (!fight) info = { between:'A próxima onda está chegando…', waiting:'Tomando posição…', defeat:'A equipe caiu.' }[e.phase] || '';
    else info = state !== 'auto' ? 'Aguardando a vez…' : TOUCH ? 'A equipe está no comando. Troque em <b>COMANDO</b> para dar as ordens.' : 'A equipe está no comando. <kbd>Z</kbd> troca para dar as ordens.';
    html(B.info, `<span>${info}</span>`);
    // ----- alvo -----
    const tgt = fight ? this.bhTargetOf(actor) : null;
    this.renderBattleTarget(tgt, actor);
    // Comando MANUAL é manual: a luta espera a ordem pelo tempo que for (com a aba escondida, quem assume é o AUTO, em
    // main.js). Depois de um tempo parado o console só lembra o que fazer, uma vez por luta.
    if (waiting && !this.bhPending) {
      if (this.turnHero !== waiting.uid) { this.turnHero = waiting.uid; this.turnSince = now; }
      if (this.turnSince && now - this.turnSince > 25000 && !this.turnIdleTold) { this.turnIdleTold = true; this.bhSay(`A luta espera a sua ordem: <b>Atacar</b>, uma <b>habilidade</b> ou <b>Defender</b>. No comando AUTO ou SEMI a equipe age sozinha.`, 9000); }
    } else if (!waiting) { this.turnHero = null; this.turnSince = 0; }
    if (this.bhPending && (!waiting || e.awaiting !== this.bhPending.i)) { clearTimeout(this.bhTimer); this.bhPending = null; if (this.renderer.timing) this.renderer.timing = null; }
  };

  P.renderBattleTarget = function(t, actor) {
    const e = this.engine, B = this.bh, el = B.target;
    cls(el, 'none', !t);
    if (!t) { html(el, '<div class="bt-row">Nenhum inimigo à vista</div>'); this.bhTgtKey = ''; return; }
    const it = e.intentOf(t) || {}, weakEls = Object.entries(D.elements).filter(([, v]) => v.strong.includes(t.el)).map(([k]) => k);
    const hit = actor ? e.weakness(actor, t) : 1, many = t.toughMax > 12;
    const key = [t.uid, it.kind, it.name || '', it.target || '', t.broken > 0, many, Math.ceil(t.toughMax), t.effects.map(f => f.s).join(','), t.elMark?.el || '', actor?.uid, hit].join('|');
    if (key !== this.bhTgtKey) {
      this.bhTgtKey = key;
      const who = it.target && e.party.find(h => h.uid === it.target);
      // No console estreito some o começo da frase (.lg): fica o ícone e o nome do golpe, ou a seta e o herói mirado.
      const intent = it.kind === 'broken' ? ['st-broken', 'Quebrou<span class="lg">: não age</span>', ''] : it.kind === 'special' ? ['sys-alert', `<span class="lg">Golpe preparado: </span><b>${esc(it.name)}</b>`, 'danger'] : it.kind === 'windup' ? ['sys-alert', `<span class="lg">Vai preparar </span><b>${esc(it.name)}</b>`, 'danger']
        : it.kind === 'skill' ? ['intent', `<span class="lg">Vai usar </span><b>${esc(it.name)}</b>`, ''] : it.kind === 'attack' ? ['intent', who ? `<span class="lg">Vai golpear </span><span class="sm">→ </span><b>${esc(who.name.split(',')[0])}</b>` : '<span class="lg">Escolhendo o alvo</span><span class="sm">Mirando…</span>', ''] : ['intent', '', ''];
      const segs = many ? '<span class="barx"><i></i></span>' : `<span class="segs">${'<i></i>'.repeat(Math.max(1, Math.ceil(t.toughMax)))}</span>`;
      el.innerHTML = `<span class="bt-thumb"><img src="${t.rival ? portrait(t.id) : KT.spriteUrl(t.sprite)}" alt=""><em>${t.level}</em></span>
        <div class="bt-name"><b>${esc(t.name)}</b><small><i class="pi pi-el-${KT.Icon?.EL[t.el] || t.el}" title="${t.el}"></i>${t.elMark ? `<i class="pi pi-el-${KT.Icon?.EL[t.elMark.el] || t.elMark.el} mark" title="Marca de ${t.elMark.el}"></i>` : ''}</small></div>
        <div class="bt-hp"><i></i><em></em></div>
        ${t.toughMax > 0 ? `<div class="bt-tough">${icon('st-broken')}${segs}<em></em></div>` : ''}
        <div class="bt-row weak">${icon('weak')}<span class="lg">Fraco:</span>${weakEls.map(k => `<i class="pi pi-el-${KT.Icon?.EL[k] || k}${actor && actor.el === k ? ' hit' : ''}" title="${k}"></i>`).join('')}${t.weakCls ? `<i class="pi pi-cls-${KT.Icon?.CLS[t.weakCls] || t.weakCls}${actor && actor.cls === t.weakCls ? ' hit' : ''}" title="${t.weakCls}"></i>` : ''}${hit > 1 ? '<b class="x2"><span class="lg">Quebra </span>×2</b>' : hit < 1 ? '<span class="half"><span class="lg">resiste </span>×½</span>' : ''}</div>
        <div class="bt-row intent ${intent[2]}">${icon(intent[0])}<span class="txt">${intent[1]}</span><span class="bt-fx">${fxIcons(t, 4)}</span></div>`;
      B.tgt = { hp:el.querySelector('.bt-hp i'), hpTxt:el.querySelector('.bt-hp em'), tough:el.querySelector('.bt-tough'), segs:[...el.querySelectorAll('.bt-tough .segs i')], barx:el.querySelector('.bt-tough .barx i'), tTxt:el.querySelector('.bt-tough em') };
    }
    const T = B.tgt, hp = U.clamp(t.hp / t.maxHp, 0, 1);
    T.hp.style.width = `${(hp * 100).toFixed(1)}%`; T.hpTxt.textContent = `${(hp * 100).toFixed(hp < .1 ? 1 : 0)}%`;
    if (T.tough) {
      const broken = t.broken > 0, left = broken ? 0 : t.tough;
      T.tough.classList.toggle('broken', broken);
      if (T.barx) T.barx.style.width = `${(broken ? t.broken / KT.State.TOUGH.time : left / t.toughMax) * 100}%`;
      T.segs.forEach((s, n) => s.classList.toggle('on', broken ? n < Math.ceil(t.broken / KT.State.TOUGH.time * T.segs.length) : n < Math.ceil(left - 1e-6)));
      T.tTxt.textContent = broken ? `${t.broken.toFixed(1).replace('.', ',')}s` : String(Math.ceil(left - 1e-6));
    }
  };
})();
