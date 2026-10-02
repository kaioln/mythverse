// HUD limpo (padrão): na tela fica só o que se usa agora, o resto a um toque.
//  · menu lateral com 6 atalhos principais + "Mais";  · no topo só ouro, cristais e chaves;
//  · painel da direita recolhido, trocado por um único cartão de OBJETIVO na arena;
//  · controles de batalha: PREPARAR, COMANDO, VEL, CIDADE (AFK e AVANÇO em MAIS);
//  · cartões dos heróis sem a linha da passiva; placas da cidade só com o nome.
// "HUD completo" em Perfil volta ao layout com tudo.
(() => {
  const KT = globalThis.KT, U = KT.Utils, D = KT.Data, P = KT.UIController.prototype;
  const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const KEY = 'mythverse-hud';
  const MAIN = ['journey', 'party', 'collection', 'inventory', 'city', 'quests'];

  P.hudFull = function() { return U.safeStorage.get(KEY) === 'full'; };
  P.setHudFull = function(full) { U.safeStorage.set(KEY, full ? 'full' : 'clean'); this.applyHud(); setTimeout(() => this.renderer?.resize?.(), 60); };

  P.initHud = function() {
    const nav = document.querySelector('.side-nav');
    if (nav && !nav.querySelector('.nav-more')) {
      nav.querySelectorAll('.nav[data-panel]').forEach(b => { if (!MAIN.includes(b.dataset.panel)) b.classList.add('nav-extra'); });
      const more = document.createElement('button'); more.className = 'nav nav-more'; more.type = 'button';
      more.innerHTML = '<i class="pi pi-nav-menu"></i><b>Menu</b><em class="nav-badge nav-more-badge" hidden></em>';
      more.dataset.tip = 'Todos os outros lugares: Aventuras, Ranking, Arena, Guilda, Talentos, Loja e Wiki.';
      more.addEventListener('click', () => this.toggleMoreSheet());
      nav.appendChild(more);
    }
    const vp = document.querySelector('#viewport');
    if (vp && !document.querySelector('#goal-chip')) {
      const chip = document.createElement('div'); chip.id = 'goal-chip'; vp.appendChild(chip); this.el.goalChip = chip;
      chip.addEventListener('click', e => this.handleAction(e));
    }
    // Celular: os distritos da cidade viram uma grade de botões abaixo do cenário (as placas não cabem sobre a arte).
    const dock = document.querySelector('#party-strip');
    if (dock && !document.querySelector('#district-grid')) {
      const grid = document.createElement('nav'); grid.id = 'district-grid'; grid.setAttribute('aria-label', 'Distritos da cidade'); dock.before(grid); this.el.districts = grid;
      grid.addEventListener('click', e => { const b = e.target.closest('[data-district]'); if (!b) return; const src = document.querySelectorAll('#village-actions .signpost')[+b.dataset.district]; src?.click(); });
    }
    this.placeHud(); matchMedia('(max-width:900px)').addEventListener?.('change', () => this.placeHud());
    // Combate só com o essencial: PREPARAR, COMANDO, VEL e CIDADE à vista; AFK e AVANÇO no botão "Mais".
    const ctl = document.querySelector('.stage-controls');
    if (ctl && !document.querySelector('#adv-ctl-btn')) {
      const more = document.createElement('button'); more.id = 'adv-ctl-btn'; more.className = 'ctl'; more.type = 'button';
      more.innerHTML = '<span>MAIS</span><b>···</b>'; more.dataset.tip = 'Modo AFK e avanço automático de estágio.';
      more.addEventListener('click', () => ctl.classList.toggle('adv-open'));
      ctl.insertBefore(more, document.querySelector('#retreat-btn'));
    }
    this.applyHud();
    setInterval(() => { this.renderGoalChip(); this.renderDistricts(); }, 1000);
  };

  // Onde fica cada peça conforme a tela. PC: nome da região e controles sobre o palco. Celular e tablet: o palco é
  // pequeno, então durante a luta a barra do topo vira a BARRA DA BATALHA (região e onda à esquerda, controles à
  // direita) e o palco fica só com a luta; o objetivo e a faixa do AFK vão para baixo do palco.
  P.placeHud = function() {
    const $ = s => document.querySelector(s), mob = matchMedia('(max-width:900px)').matches, fight = document.body.classList.contains('in-combat');
    const vp = $('#viewport'), top = $('.hud-top'), stageTop = $('.stage-top'), dock = $('#party-strip');
    const chip = this.el.goalChip, banner = this.el.afkBanner;
    if (chip) { if (mob) $('#district-grid')?.before(chip); else if (chip.parentElement !== vp) vp?.appendChild(chip); }
    if (banner) { if (mob) dock?.before(banner); else if (banner.parentElement !== vp) vp?.appendChild(banner); }
    const ctl = this._ctl ||= $('.stage-controls');
    if (ctl && top && stageTop) { const home = mob ? top : stageTop; if (ctl.parentElement !== home) home.appendChild(ctl); ctl.classList.toggle('in-top', mob); ctl.classList.remove('below-stage'); }
    const zc = this._zc ||= $('.zone-chip');
    if (zc && top && stageTop) { const inTop = mob && fight; if (inTop) { if (zc.parentElement !== top) top.insertBefore(zc, ctl && ctl.parentElement === top ? ctl : null); } else if (zc.parentElement !== stageTop) stageTop.prepend(zc); zc.classList.toggle('in-top', inTop); }
    // Peças antigas do palco (guarda, poções e comando da vez): escondidas na luta pelo console; seguem o mesmo critério.
    const cons = $('#consumables'); if (cons) { if (mob) vp?.after(cons); else if (cons.parentElement !== vp) vp?.appendChild(cons); cons.classList.toggle('below-stage', mob); }
    const turn = $('#turn-cmd'); if (turn) { if (mob) vp?.after(turn); else if (turn.parentElement !== vp) vp?.appendChild(turn); turn.classList.toggle('below-stage', mob); }
  };

  // "Menu" abre os outros lugares em grade: no celular uma folha que sobe do pé da tela; no PC um painel ao lado da
  // navegação, na altura do botão (antes a coluna crescia para baixo e ganhava barra de rolagem em tela baixa).
  P.toggleMoreSheet = function(force) {
    let sh = document.querySelector('#more-sheet');
    if (!sh) {
      sh = document.createElement('div'); sh.id = 'more-sheet'; sh.hidden = true; document.body.appendChild(sh);
      const close = () => { sh.hidden = true; document.querySelector('.side-nav')?.classList.remove('more-open'); };
      sh.addEventListener('click', e => { const b = e.target.closest('[data-more-panel]'); if (b) { close(); document.querySelector(`.nav[data-panel="${b.dataset.morePanel}"]`)?.click(); } else if (e.target === sh) close(); });
      addEventListener('keydown', e => { if (e.key === 'Escape' && !sh.hidden) close(); });
      addEventListener('resize', () => { if (!sh.hidden) close(); });
    }
    const open = force ?? sh.hidden, nav = document.querySelector('.side-nav');
    if (open) {
      sh.innerHTML = `<div class="more-grid" role="menu"><b>Menu</b>${[...document.querySelectorAll('.side-nav .nav-extra')].map(n => `<button type="button" role="menuitem" data-more-panel="${n.dataset.panel}">${n.querySelector('.pi, svg')?.outerHTML || ''}<span>${n.querySelector('b')?.textContent || n.textContent.trim()}</span>${[...n.querySelectorAll('[id$="-badge"]')].some(x => !x.hidden && x.textContent.trim()) ? '<em>!</em>' : ''}</button>`).join('')}</div>`;
      sh.hidden = false;
      // PC: o painel fica ao lado da navegação, centrado no botão Menu e sempre inteiro na tela.
      const grid = sh.firstElementChild, btn = nav?.querySelector('.nav-more');
      if (btn && !matchMedia('(max-width:900px)').matches) {
        const z = KT.pageZoom?.() || 1, r = btn.getBoundingClientRect(), g = grid.getBoundingClientRect();
        const top = U.clamp(r.top + r.height / 2 - g.height / 2, (document.querySelector('.hud-top')?.getBoundingClientRect().bottom || 0) + 8, Math.max(8, innerHeight - g.height - 8));
        grid.style.top = `${top / z}px`; grid.style.left = `${(nav.getBoundingClientRect().right + 8) / z}px`;
      }
    } else sh.hidden = true;
    nav?.classList.toggle('more-open', open);
  };
  P.applyHud = function() {
    const clean = !this.hudFull();
    document.body.classList.toggle('hud-clean', clean);
    const app = this.el.app, narrow = matchMedia('(max-width:1100px)').matches;
    if (clean && !narrow) app.classList.add('panel-hidden');
    else if (!clean && !narrow) app.classList.remove('panel-hidden');
    this.renderGoalChip(true);
  };

  P.renderDistricts = function() {
    const grid = this.el.districts; if (!grid) return;
    const show = this.engine.zone?.kind === 'village'; grid.hidden = !show; if (!show) return;
    const html = [...document.querySelectorAll('#village-actions .signpost')].map((sp, i) => { const badge = sp.querySelector('.sp-badge'), [panel, tab] = sp.dataset.open.split(':'), gate = this.engine.serviceStatus(KT.Progression.serviceFor(panel, tab)); return `<button type="button" data-district="${i}" class="${gate.locked ? 'service-locked' : ''}">${sp.querySelector('.sp-icon')?.innerHTML || ''}<span>${sp.querySelector('b')?.textContent || ''}${gate.locked ? `<small>Conta nv ${gate.level}</small>` : ''}</span>${badge && !badge.hidden && !gate.locked ? `<em>${badge.textContent}</em>` : ''}</button>`; }).join('');
    if (html !== this._distHtml) { this._distHtml = html; grid.innerHTML = html; }
  };
  // Cartão de objetivo na arena: um só "o que fazer agora", com o botão certo.
  P.renderGoalChip = function(force) {
    const chip = this.el.goalChip; if (!chip) return;
    const panelOpen = !this.el.app.classList.contains('panel-hidden') && !matchMedia('(max-width:1100px)').matches;
    const mob = matchMedia('(max-width:900px)').matches;
    if (!document.body.classList.contains('hud-clean') || panelOpen || (this.engine.active && !mob) || (this.engine.zone?.kind === 'village' && !mob)) { chip.hidden = true; return; } // no PC o cartão fica sobre a arena: some em combate; no celular fica abaixo dela // cidade no PC: o objetivo fica no painel de boas-vindas (no celular o painel não aparece)
    const e = this.engine, g = e.guideStep(), ch = !g && e.ensureChronicle(), ls = e.loginStatus();
    let title = '', sub = '', btn = '';
    if (g) {
      const done = e.guideDone(g); title = g.title; sub = done ? 'Concluído! Resgate a recompensa.' : g.desc;
      btn = done ? '<button class="action primary small" data-claim-guide type="button">✓ Resgatar</button>' : g.go ? `<button class="action small" data-go="${KT.goOf(g)}" type="button">Ir →</button>` : '';
    } else if (ch) {
      const v = e.chronicleValue(ch), done = v >= ch.target; title = ch.title; sub = `${U.fmt(v)} / ${U.fmt(ch.target)}`;
      btn = done ? '<button class="action primary small" data-claim-chronicle type="button">✓ Resgatar</button>' : '';
    } else { title = 'Jornada concluída!'; sub = 'Explore a Fenda e os chefes em Pesadelo.'; }
    const gift = ls.available ? `<button class="action pink small" data-claim-login type="button" data-tip="Presente de login do dia"><i class="ic ic-chest"></i> Presente</button>` : '';
    const html = `<span class="goal-ic"><i class="ic ic-target"></i></span><div class="goal-txt"><small>OBJETIVO</small><b>${esc(title)}</b><em>${esc(sub)}</em></div>${btn || gift ? `<div class="goal-actions">${btn}${gift}</div>` : ''}`;
    chip.hidden = false;
    if (force || html !== this._goalHtml) { this._goalHtml = html; chip.innerHTML = html; chip.classList.toggle('done', /data-claim-(guide|chronicle)/.test(btn)); }
    // Selo do "Mais": algum atalho escondido tem novidade.
    const more = document.querySelector('.nav-more-badge');
    if (more) { const any = [...document.querySelectorAll('.nav-extra [id$="-badge"]')].some(x => !x.hidden && x.textContent.trim()); more.hidden = !any; more.textContent = any ? '!' : ''; }
  };
})();
