// HUD limpo (padrão): na tela fica só o que se usa agora, o resto a um toque.
//  · menu lateral com 6 atalhos principais + "Mais";  · no topo só ouro, cristais e chaves;
//  · painel da direita recolhido, trocado por um único cartão de OBJETIVO na arena;
//  · controles de batalha: ⚡ FORÇA, 🌙 AFK, VEL, CIDADE (AUTO e AVANÇO no ⚙);
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
      more.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg><b>Mais</b><em class="nav-badge nav-more-badge" hidden></em>';
      more.addEventListener('click', () => { if (matchMedia('(max-width:760px)').matches) this.toggleMoreSheet(); else nav.classList.toggle('more-open'); });
      nav.addEventListener('click', e => { if (e.target.closest('.nav-extra')) nav.classList.remove('more-open'); });
      nav.appendChild(more);
    }
    const ctl = document.querySelector('.stage-controls');
    if (ctl && !document.querySelector('#adv-ctl-btn')) {
      const g = document.createElement('button'); g.id = 'adv-ctl-btn'; g.className = 'ctl gear'; g.type = 'button';
      g.dataset.tip = 'Mais controles: AUTO (ultimates sozinhas) e AVANÇO (ir ao próximo estágio ao vencer).';
      g.innerHTML = '<span>⚙</span><b>MAIS</b>';
      g.addEventListener('click', () => ctl.classList.toggle('adv-open'));
      document.querySelector('#retreat-btn')?.before(g);
    }
    const vp = document.querySelector('#viewport');
    if (vp && !document.querySelector('#goal-chip')) {
      const chip = document.createElement('div'); chip.id = 'goal-chip'; vp.appendChild(chip); this.el.goalChip = chip;
      chip.addEventListener('click', e => this.handleAction(e));
    }
    this.applyHud();
    setInterval(() => this.renderGoalChip(), 1000);
  };

  // Celular: "Mais" abre uma folha com os atalhos em grade (a barra de baixo continua com 6 + Mais).
  P.toggleMoreSheet = function(force) {
    let sh = document.querySelector('#more-sheet');
    if (!sh) {
      sh = document.createElement('div'); sh.id = 'more-sheet'; sh.hidden = true; document.body.appendChild(sh);
      sh.addEventListener('click', e => { const b = e.target.closest('[data-more-panel]'); if (b) { sh.hidden = true; document.querySelector(`.nav[data-panel="${b.dataset.morePanel}"]`)?.click(); } else if (e.target === sh) sh.hidden = true; });
    }
    const open = force ?? sh.hidden;
    if (open) sh.innerHTML = `<div class="more-grid"><b>Mais opções</b>${[...document.querySelectorAll('.side-nav .nav-extra')].map(n => `<button type="button" data-more-panel="${n.dataset.panel}">${n.querySelector('svg')?.outerHTML || ''}<span>${n.querySelector('b')?.textContent || n.textContent.trim()}</span>${[...n.querySelectorAll('[id$="-badge"]')].some(x => !x.hidden && x.textContent.trim()) ? '<em>!</em>' : ''}</button>`).join('')}</div>`;
    sh.hidden = !open;
  };
  P.applyHud = function() {
    const clean = !this.hudFull();
    document.body.classList.toggle('hud-clean', clean);
    const app = this.el.app, narrow = matchMedia('(max-width:1100px)').matches;
    if (clean && !narrow) app.classList.add('panel-hidden');
    else if (!clean && !narrow) app.classList.remove('panel-hidden');
    this.renderGoalChip(true);
  };

  // Cartão de objetivo na arena: um só "o que fazer agora", com o botão certo.
  P.renderGoalChip = function(force) {
    const chip = this.el.goalChip; if (!chip) return;
    const panelOpen = !this.el.app.classList.contains('panel-hidden') && !matchMedia('(max-width:1100px)').matches;
    if (!document.body.classList.contains('hud-clean') || panelOpen) { chip.hidden = true; return; }
    const e = this.engine, g = e.guideStep(), ch = !g && e.ensureChronicle(), ls = e.loginStatus();
    let title = '', sub = '', btn = '';
    if (g) {
      const done = e.guideDone(g); title = g.title; sub = done ? 'Concluído! Resgate a recompensa.' : g.desc;
      btn = done ? '<button class="action primary small" data-claim-guide type="button">✓ Resgatar</button>' : g.go ? `<button class="action small" data-go="${g.go}" type="button">Ir →</button>` : '';
    } else if (ch) {
      const v = e.chronicleValue(ch), done = v >= ch.target; title = ch.title; sub = `${U.fmt(v)} / ${U.fmt(ch.target)}`;
      btn = done ? '<button class="action primary small" data-claim-chronicle type="button">✓ Resgatar</button>' : '';
    } else { title = 'Jornada concluída!'; sub = 'Explore a Fenda e os chefes em Pesadelo.'; }
    const gift = ls.available ? `<button class="action pink small" data-claim-login type="button" data-tip="Presente de login do dia">🎁 Presente</button>` : '';
    const html = `<span class="goal-ic">🎯</span><div class="goal-txt"><small>OBJETIVO</small><b>${esc(title)}</b><em>${esc(sub)}</em></div>${btn}${gift}`;
    chip.hidden = false;
    if (force || html !== this._goalHtml) { this._goalHtml = html; chip.innerHTML = html; chip.classList.toggle('done', /data-claim-(guide|chronicle)/.test(btn)); }
    // Selo do "Mais": algum atalho escondido tem novidade.
    const more = document.querySelector('.nav-more-badge');
    if (more) { const any = [...document.querySelectorAll('.nav-extra [id$="-badge"]')].some(x => !x.hidden && x.textContent.trim()); more.hidden = !any; more.textContent = any ? '!' : ''; }
  };
})();
