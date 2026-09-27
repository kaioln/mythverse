// Modo AFK Total (botão, confirmação explícita, faixa com resumo da sessão e gerenciamento automático)
// e o botão "⚡ Fortalecer equipe". Carregado depois de ui.js/panels.js.
(() => {
  const KT = globalThis.KT, U = KT.Utils, P = KT.UIController.prototype;
  const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const fmtDur = s => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`; };

  // Dificuldade por extenso a partir de Poder ÷ recomendado.
  KT.difficultyLabel = ratio => ratio >= 1.3 ? ['Fácil', 'easy'] : ratio >= 1 ? ['Justo', 'fair'] : ratio >= .8 ? ['Difícil', 'hard'] : ['Muito difícil', 'deadly'];

  P.initAfk = function() {
    const ctl = document.querySelector('.stage-controls'); if (!ctl || document.querySelector('#afk-btn')) return;
    const afk = document.createElement('button'); afk.id = 'afk-btn'; afk.className = 'ctl afk'; afk.type = 'button';
    afk.dataset.tip = 'Modo AFK Total: luta, avança, recua para treinar, usa poções, equipa itens e distribui pontos sozinho.';
    afk.innerHTML = '<span>AFK</span><b>OFF</b>'; ctl.prepend(afk);
    const boost = document.createElement('button'); boost.id = 'boost-btn'; boost.className = 'ctl boost'; boost.type = 'button';
    boost.dataset.tip = 'Fortalecer equipe: equipa os melhores itens e distribui atributos e talentos de todos de uma vez.';
    boost.innerHTML = '<span>⚡</span><b>FORÇA</b><em class="ctl-dot" hidden></em>'; ctl.prepend(boost);
    const banner = document.createElement('div'); banner.id = 'afk-banner'; banner.hidden = true; document.querySelector('#viewport')?.appendChild(banner);
    this.el.afk = afk; this.el.boost = boost; this.el.afkBanner = banner;
    afk.addEventListener('click', () => this.toggleAfk());
    boost.addEventListener('click', () => this.optimizeTeam());
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
      const ok = await this.ask('🌙 Ativar o Modo AFK Total?', `<div class="afk-explain"><p>Sua equipe passa a jogar <b>sozinha</b>, sem parar:</p><ul>
        <li>⚔ Luta com ultimates automáticas e escolhe os eventos sozinha.</li>
        <li>⏫ Avança de estágio ao vencer. Se perder, recua um estágio, treina 3 vitórias e tenta de novo.</li>
        <li>🧪 Usa poções quando a vida fica baixa e elixires contra chefes.</li>
        <li>⚡ A cada ~45 s equipa itens melhores e distribui pontos de atributo e talento.</li>
        <li>🔁 Masmorras e chefes se repetem enquanto derem espólio; depois volta a caçar.</li></ul>
        <p class="dim">Com o jogo fechado, o progresso continua pelo AFK offline (até 12 h, rendendo menos). Toque em <b>Sair do AFK</b> a qualquer momento.</p></div>`,
        [{ id:'yes', label:'Ativar AFK Total', primary:true }, { id:'no', label:'Cancelar' }]);
      if (ok !== 'yes') return;
    }
    if (this.engine.seg) this.engine.input('afk', on); else { this.engine.setAfk(on); this.cmd('setSetting', 'afk', on); }
    if (on) { this.startAfkSession(); this.afkManage(); this.toast('<b>🌙 Modo AFK Total ativado.</b> Pode deixar rolando!', 'gold'); }
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
    if (e.optimizeHint().any) Promise.resolve(this.cmd('optimizeTeam')).then(() => { this.renderParty?.(); this.renderResources(); });
    this._afkPending = false;
  };

  P.renderAfk = function() {
    if (!this.el.afk) return;
    const on = !!this.state.settings.afk, b = this.el.afkBanner, village = this.engine.zone?.kind === 'village';
    this.el.afk.classList.toggle('active', on); this.el.afk.querySelector('b').textContent = on ? 'ON' : 'OFF';
    this.el.afk.hidden = village;
    const hint = this.engine.optimizeHint(); this.el.boost.querySelector('.ctl-dot').hidden = !hint.any;
    this.el.boost.classList.toggle('pulse', hint.any && !on);
    document.body.classList.toggle('afk-on', on && !village);
    if (!on || village) { b.hidden = true; return; }
    if (this._afkPending && this.engine.phase !== 'fight') this.afkManage();
    const r = this.afkSummary() || { time:'0 min', gold:0, kills:0, loot:0, lv:0, power:0 };
    b.hidden = false;
    b.innerHTML = `<span class="afk-moon">🌙</span><div><b>MODO AFK TOTAL ATIVO</b><small>${r.time} · +${U.fmt(r.gold)} ouro · ${U.fmt(r.kills)} abates · ${r.loot} itens · +${r.lv} níveis${r.power > 0 ? ` · +${U.fmt(r.power)} Poder` : ''}</small></div><button class="action small" data-afk-off type="button">Sair do AFK</button>`;
  };

  P.optimizeTeam = function() {
    if (!this.engine.heroes.length) { this.toast('Monte a equipe primeiro.'); this.openPanel('party'); return; }
    Promise.resolve(this.cmd('optimizeTeam')).then(r => {
      if (!r) return;
      const parts = [r.items && `${r.items} item(ns) equipado(s)`, r.attr && `${r.attr} ponto(s) de atributo`, r.talents && `${r.talents} talento(s)`].filter(Boolean);
      this.toast(parts.length ? `<b>⚡ Equipe fortalecida!</b> ${parts.join(', ')}. Poder ${U.fmt(r.before)} → <b>${U.fmt(r.after)}</b>.` : 'Sua equipe já está no melhor que dá agora. Para crescer: caçar (nível), Forja (refino) e Dojo (treino).', parts.length ? 'gold' : '');
      if (parts.length) this.callbacks.reward?.();
      this.renderParty?.(); this.renderResources(); if (this.view?.panel) this.refreshPanel();
      this.coachEvent?.('optimized');
    });
  };
})();
