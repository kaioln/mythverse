// Modo AFK Total (botão, confirmação explícita, faixa com resumo da sessão e gerenciamento automático)
// e o botão de preparo. Carregado depois de ui.js/panels.js.
(() => {
  const KT = globalThis.KT, U = KT.Utils, P = KT.UIController.prototype;
  const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const fmtDur = s => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`; };

  // Dificuldade por extenso a partir de Poder ÷ recomendado.
  KT.difficultyLabel = ratio => ratio >= 1.3 ? ['Fácil', 'easy'] : ratio >= 1 ? ['Justo', 'fair'] : ratio >= .8 ? ['Difícil', 'hard'] : ['Muito difícil', 'deadly'];

  P.initAfk = function() {
    const ctl = document.querySelector('.stage-controls'); if (!ctl || document.querySelector('#afk-btn')) return;
    const afk = document.createElement('button'); afk.id = 'afk-btn'; afk.className = 'ctl afk'; afk.type = 'button';
    afk.dataset.tip = 'Modo AFK Total (farm): repete o estágio atual, usa poções e equipa itens melhores. Não avança nem distribui pontos.';
    afk.innerHTML = '<span><i class="ic ic-moon"></i> AFK</span><b>OFF</b>'; ctl.prepend(afk);
    const boost = document.createElement('button'); boost.id = 'boost-btn'; boost.className = 'ctl boost'; boost.type = 'button';
    boost.dataset.tip = 'Preparação: escolha entre farm, equipamento, atributos ou talentos. Nenhuma build inteira é montada sozinha.'; boost.setAttribute('aria-label', 'Preparar equipe');
    boost.innerHTML = '<span><i class="ic ic-bolt"></i></span><b>PREPARAR</b><em class="ctl-dot" hidden></em>'; ctl.prepend(boost);
    const banner = document.createElement('div'); banner.id = 'afk-banner'; banner.hidden = true; document.querySelector('#viewport')?.appendChild(banner);
    this.el.afk = afk; this.el.boost = boost; this.el.afkBanner = banner;
    afk.addEventListener('click', () => this.toggleAfk());
    boost.addEventListener('click', () => this.openPreparation());
    banner.addEventListener('click', e => { if (e.target.closest('[data-afk-off]')) this.toggleAfk(false); });
    setInterval(() => this.afkManage(), 45_000);
    setInterval(() => this.renderAfk(), 1000);
    if (this.state.settings.afk) this.startAfkSession();
    this.renderAfk();
  };

  P.startAfkSession = function() {
    const s = this.state;
    this.afkSession = { at:Date.now(), gold:s.stats.goldEarned || 0, kills:s.stats.kills || 0, loot:s.stats.loot || 0, lv:s.collection.reduce((a, h) => a + h.level, 0), power:this.engine.getPower() };
  };

  P.toggleAfk = async function(force) {
    const on = force ?? !this.state.settings.afk;
    if (on) {
      const ok = await this.ask('Ativar o Modo AFK Total?', `<div class="afk-explain"><p>Sua equipe passa a jogar <b>sozinha</b>, sem parar:</p><ul>
        <li>Luta com ultimates automáticas e escolhe os eventos sozinha.</li>
        <li><b>Farma</b> o estágio atual sem parar (não avança sozinho). Se perder, recua um estágio e farma ali.</li>
        <li>Usa poções quando a vida fica baixa e elixires contra chefes.</li>
        <li>A cada ~45 s equipa itens melhores; atributos e talentos continuam sob sua decisão.</li>
        <li>Masmorras e chefes se repetem enquanto derem espólio; depois volta a caçar.</li></ul>
        <p class="dim">Com o jogo fechado, o progresso continua pelo AFK offline (até 12 h, rendendo menos). Toque em <b>Sair do AFK</b> a qualquer momento.</p></div>`,
        [{ id:'yes', label:'Ativar AFK Total', primary:true }, { id:'no', label:'Cancelar' }]);
      if (ok !== 'yes') return;
    }
    if (this.engine.seg) this.engine.input('afk', on); else { this.engine.setAfk(on); this.cmd('setSetting', 'afk', on); }
    if (on) { this.startAfkSession(); this.afkManage(); this.toast('<b>Modo AFK Total ativado.</b> Farmando este estágio: pode deixar rolando!', 'gold'); }
    else { const r = this.afkSummary(); this.afkSession = null; this.toast(`<b>AFK encerrado.</b> ${r ? `Em ${r.time}: +${U.fmt(r.gold)} ouro, ${U.fmt(r.kills)} abates, ${r.loot} itens, +${r.lv} níveis.` : ''}`); }
    this.renderControls(); this.renderAfk();
  };

  P.afkSummary = function() {
    const a = this.afkSession, s = this.state; if (!a) return null;
    return { time:fmtDur((Date.now() - a.at) / 1000), gold:(s.stats.goldEarned || 0) - a.gold, kills:(s.stats.kills || 0) - a.kills, loot:(s.stats.loot || 0) - a.loot, lv:s.collection.reduce((x, h) => x + h.level, 0) - a.lv, power:this.engine.getPower() - a.power };
  };

  // Gerenciamento automático fora da luta (menus passam pelo servidor/banco como qualquer ação).
  P.afkManage = function() {
    if (!this.state.settings.afk) return;
    const e = this.engine; if (e.phase === 'fight' && e.zone?.kind !== 'village' && e.enemies?.some(x => x.alive)) { this._afkPending = true; return; }
    const heroes = [...e.heroes];
    (async () => { let n = 0; for (const h of heroes) n += Number(await this.cmd('autoEquip', h.uid)) || 0; if (n) { this.renderParty?.(); this.renderResources(); this.toast(`<b>AFK:</b> ${n} equipamento(s) melhor(es) equipado(s).`); } })();
    this._afkPending = false;
  };

  P.renderAfk = function() {
    if (!this.el.afk) return;
    const on = !!this.state.settings.afk, b = this.el.afkBanner, village = this.engine.zone?.kind === 'village';
    this.el.afk.classList.toggle('active', on); this.el.afk.querySelector('b').textContent = on ? 'ON' : 'OFF';
    this.el.afk.hidden = village;
    // Durante o AFK ele controla o comando e o avanço: os botões saem da tela para não confundir.
    ['#mode-btn', '#advance-btn', '#guard-btn'].forEach(id => { const x = document.querySelector(id); if (x) x.classList.toggle('afk-hide', on); });
    const hint = this.engine.optimizeHint(); this.el.boost.querySelector('.ctl-dot').hidden = !hint.any;
    this.el.boost.classList.toggle('pulse', hint.any && !on);
    document.body.classList.toggle('afk-on', on && !village);
    if (!on || village) { b.hidden = true; return; }
    if (this._afkPending && this.engine.phase !== 'fight') this.afkManage();
    const r = this.afkSummary() || { time:'0 min', gold:0, kills:0, loot:0, lv:0, power:0 };
    b.hidden = false;
    b.innerHTML = `<span class="afk-moon"><i class="ic ic-moon"></i></span><div><b>AFK · FARMANDO ${esc(this.engine.zone?.title || '')}${this.engine.opts?.stage ? ` ${this.engine.opts.stage}` : this.engine.opts?.floor ? ` · andar ${this.engine.opts.floor}` : ''}</b><small>${r.time} · +${U.fmt(r.gold)} ouro · ${U.fmt(r.kills)} abates · ${r.loot} itens · +${r.lv} níveis${r.power > 0 ? ` · +${U.fmt(r.power)} Poder` : ''}</small></div><button class="action small" data-afk-off type="button">Sair do AFK</button>`;
  };

  const esc2 = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  P.describeChanges = function(list) {
    const shown = list.slice(0, 3).map(c => `<b>${esc2(c.item)}</b> → ${esc2(c.hero)}${c.old ? ` <small>(${esc2(c.old)} foi para ${c.oldTo === 'Armazém' ? 'o Armazém' : c.oldTo === 'Bolsa' ? 'a Bolsa' : esc2(c.oldTo)})</small>` : ''}`);
    return shown.join(' · ') + (list.length > 3 ? ` e mais ${list.length - 3}.` : '.');
  };
  P.openPreparation = async function() {
    if (!this.engine.heroes.length) { this.toast('Monte a equipe primeiro.'); this.openPanel('party'); return; }
    const choice = await this.ask('Preparar equipe', '<div class="prep-choice"><p>Escolha uma tarefa. A preparação não troca heróis nem cria uma build completa.</p><small>Farm mantém o estágio atual repetindo; as outras ações usam apenas recursos e pontos já disponíveis.</small></div>', [
      { id:'farm', label:'Farmar estágio', primary:true }, { id:'items', label:'Equipar melhores' }, { id:'attr', label:'Distribuir atributos' }, { id:'talents', label:'Aprender talentos' }, { id:'cancel', label:'Cancelar' }
    ]);
    if (!choice || choice === 'cancel') return;
    if (choice === 'farm') {
      await this.cmd('setSetting', 'autoAdvance', false);
      if (this.engine.zone.kind === 'village') { const z = this.state.lastHunt || 'hunt', p = this.state.progress[z] || {}; this.engine.enterZone(z, { stage:Math.max(1, p.cur || p.best || 1) }); }
      this.toast('<b>Farm ativado.</b> O estágio atual será repetido; ligue AFK se quiser automatizar apenas o combate.', 'gold'); return;
    }
    const op = { items:'autoEquip', attr:'autoAttr', talents:'autoTalents' }[choice]; let n = 0;
    for (const h of [...this.engine.heroes]) n += Number(await this.cmd(op, h.uid)) || 0;
    const label = { items:'equipamento(s)', attr:'ponto(s) de atributo', talents:'talento(s)' }[choice];
    this.toast(n ? `<b>Preparação concluída:</b> ${n} ${label}.` : 'Nada disponível para essa tarefa.', n ? 'gold' : '');
    if (n) this.callbacks.reward?.(); this.renderParty?.(); this.renderResources(); if (this.view?.panel) this.refreshPanel();
    this.coachEvent?.('optimized');
  };
})();
