// Tutorial guiado para jogadores novos: destaca o botão certo na tela e explica em linguagem simples.
// Começa sozinho na primeira vez (conta sem heróis). Cada passo avança quando o jogador faz a ação.
// Progresso guardado neste aparelho; "Rever tutorial" na Ajuda recomeça.
(() => {
  const KT = globalThis.KT, U = KT.Utils, P = KT.UIController.prototype;
  const $ = s => document.querySelector(s);
  const visible = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.bottom > 0 && r.right > 0 && getComputedStyle(el).visibility !== 'hidden'; };

  // target: seletor (ou função) do elemento destacado · done: condição para avançar sozinho · btn: texto do botão (passo só de leitura).
  const STEPS = [
    { title:'Bem-vindo(a) a Mythverse!', text:'Aqui você <b>coleciona heróis</b> de vários mundos, monta uma <b>equipe de 4</b> e eles <b>lutam sozinhos</b>. Seu papel é escolher, fortalecer e avançar pelo mapa. Vamos fazer tudo juntos, passo a passo.', btn:'Vamos lá!' },
    { title:'1 · Seus primeiros heróis', text:'Toque em <b>Heróis</b>. As primeiras <b>10 convocações são grátis</b>.', target:'.nav[data-panel="collection"]', done:ui => ui.view.panel === 'collection' || ui.state.collection.length >= 10 },
    { title:'Convoque grátis', text:'Toque em <b>Convocar 10× grátis</b>. Cada herói tem classe (função na luta) e elemento (fraquezas e vantagens).', target:'[data-open-box="worlds"]', ensure:ui => { if (ui.view.panel !== 'collection') ui.openPanel('collection', 'summon'); }, done:ui => ui.state.collection.length >= 10 },
    { title:'2 · Monte a equipe', text:'Toque em <b>⚡ Montar melhor equipe</b>. O jogo escolhe 4 heróis: <b>frente</b> (vagas 1 e 2, quem aguenta dano) e <b>retaguarda</b> (vagas 3 e 4, quem cura e causa dano de longe).', target:'[data-auto-team]', ensure:ui => { if (ui.view.panel !== 'party') ui.openPanel('party'); }, done:ui => ui.engine.heroes.length >= 4 },
    { title:'Pronto para lutar', text:'Feche esta janela no <b>✕</b>. A cidade é onde você se prepara; a luta acontece no mapa.', target:'.icon-btn.close[data-close-modal]', done:ui => !ui.view.panel },
    { title:'3 · Primeira batalha', text:'Toque em <b>Continuar: Bosque das Lanternas</b> para começar o Estágio 1.', target:'#village-hub [data-enter]', ensure:ui => { if (ui.view.panel) ui.closeModal(); else if (ui.engine.zone?.kind !== 'village') ui.engine.enterZone('village'); }, done:ui => ui.engine.zone?.kind === 'hunt' },
    { title:'Seus heróis na luta', text:'Barra <b style="color:#57e389">verde</b> = vida. Barra <b style="color:#ffd76a">dourada</b> = energia: quando enche, a <b>ultimate</b> (golpe especial) fica pronta. Com <b>AUTO</b> ligado eles usam sozinhos. Você também pode tocar no botão do herói ou usar Q, W, E, R.', target:'#party-strip', btn:'Entendi' },
    { title:'Controles da batalha', text:'<b>⚡ FORÇA</b>: fortalece a equipe num toque. <b>🌙 AFK</b>: farma este estágio sozinho, pode deixar rolando. <b>VEL</b>: acelera a luta. <b>⚙</b>: mostra AUTO (ultimates sozinhas, já ligado) e AVANÇO (próximo estágio ao vencer). <b>CIDADE</b>: volta para se preparar.', target:'.stage-controls', btn:'Entendi' },
    { title:'Poder e dificuldade', text:'Aqui aparece <b>seu Poder / Poder recomendado</b> e a dificuldade por extenso: <b>Fácil, Justo, Difícil</b> ou <b>Muito difícil</b>. Se ficar difícil, fique mais forte antes de insistir.', target:'#power-check', btn:'Entendi' },
    { title:'Vença o Estágio 1', text:'Deixe a equipe lutar: são 4 ondas. Você ganha ouro, EXP (nível) e itens.', done:ui => (ui.state.progress.hunt?.best || 0) >= 1, float:true },
    { title:'4 · Fique mais forte', text:'Você ganhou itens e experiência. Toque em <b>⚡ FORÇA</b>: equipa os melhores itens e distribui os pontos de atributo e talento de toda a equipe.', target:'#boost-btn', ensure:ui => { if (ui.view.panel) ui.closeModal(); }, done:(ui, ev) => ev === 'optimized' },
    { title:'Como crescer', text:'Os 4 jeitos de ficar mais forte: <b>1)</b> subir de nível caçando, <b>2)</b> equipar itens melhores (⚡ FORÇA), <b>3)</b> aprimorar itens na <b>Forja</b> e treinar no <b>Dojo</b> (Cidade), <b>4)</b> convocar heróis e elevar as estrelas deles no <b>Santuário</b>.', btn:'Entendi' },
    { title:'Seu objetivo', text:'Este cartão mostra <b>o que fazer agora</b>. Toque em <b>Ir →</b> para ir direto ao lugar certo e em <b>✓ Resgatar</b> para pegar a recompensa. Cada passo ensina algo novo. Quando quiser, ligue o <b>AFK</b> e deixe o jogo trabalhar. Dúvidas: botão <b>?</b> no topo. Boa jornada!', target:'#goal-chip:not([hidden]), #guide-card', btn:'Concluir tutorial' }
  ];

  P.coachKey = function() { return `mythverse-coach:${this.session?.user?.id || 'local'}`; };
  P.initCoach = function() {
    let st = null; try { st = JSON.parse(U.safeStorage.get(this.coachKey()) || 'null'); } catch (_) { st = null; }
    this.coach = st || { step:0, done:false };
    // Conta nova: começa sozinho. Conta antiga sem registro: não incomoda.
    if (!st && (this.state.collection.length > 0 || (this.state.stats?.kills || 0) > 0)) this.coach.done = true;
    const layer = document.createElement('div'); layer.id = 'coach'; layer.hidden = true;
    layer.innerHTML = '<div class="coach-hole"></div><div class="coach-bubble" role="dialog" aria-live="polite"></div>';
    document.body.appendChild(layer); this.el.coach = layer;
    layer.addEventListener('click', e => {
      if (e.target.closest('[data-coach-next]')) { this.coachNext(); return; }
      if (e.target.closest('[data-coach-skip]')) { this.coachFinish(true); return; }
    });
    addEventListener('resize', () => this.renderCoach());
    setInterval(() => this.coachTick(), 400);
    if (!this.coach.done) setTimeout(() => this.renderCoach(), 900);
  };
  P.coachSave = function() { U.safeStorage.set(this.coachKey(), JSON.stringify(this.coach)); };
  P.coachRestart = function() { this.coach = { step:0, done:false }; this.coachSave(); this.closeModal?.(); this.renderCoach(); };
  P.coachFinish = function(skipped) {
    this.coach.done = true; this.coachSave(); this.el.coach.hidden = true;
    this.toast(skipped ? 'Tutorial pulado. Para rever: botão <b>?</b> → Rever tutorial.' : '<b>Tutorial concluído!</b> Bom jogo.', skipped ? '' : 'gold');
  };
  P.coachNext = function() {
    this.coach.step++; this.coachSave();
    if (this.coach.step >= STEPS.length) { this.coachFinish(false); return; }
    STEPS[this.coach.step].before?.(this); this.renderCoach();
  };
  P.coachEvent = function(ev) { if (!this.coach || this.coach.done) return; const s = STEPS[this.coach.step]; if (s?.done && s.done(this, ev)) this.coachNext(); };
  P.coachTick = function() {
    if (!this.coach || this.coach.done) return;
    const s = STEPS[this.coach.step]; if (!s) return;
    if (s.done && s.done(this)) { this.coachNext(); return; }
    this.renderCoach();
  };
  P.renderCoach = function() {
    const layer = this.el.coach; if (!layer) return;
    if (!this.coach || this.coach.done) { layer.hidden = true; return; }
    const s = STEPS[this.coach.step]; if (!s) { layer.hidden = true; return; }
    // Enquanto uma revelação de convocação ou diálogo está na tela, o tutorial espera.
    if ($('#summon-reveal:not([hidden])') || $('#dialog-box:not([hidden])')) { layer.hidden = true; return; }
    let target = s.target ? (typeof s.target === 'function' ? s.target(this) : [...document.querySelectorAll(s.target)].find(visible)) : null;
    // Alvo fora da tela (ex.: recarregou a página no meio): reabre a tela certa em vez de travar o jogador.
    if (s.target && !target && s.ensure && (!this._coachEnsured || Date.now() - this._coachEnsured > 1500)) { this._coachEnsured = Date.now(); try { s.ensure(this); } catch (_) {} }
    layer.hidden = false; layer.classList.toggle('no-target', !target); layer.classList.toggle('float', !!s.float || (!!s.target && !target)); layer.classList.toggle('blocking', !target && !!s.btn);
    const hole = layer.querySelector('.coach-hole'), bub = layer.querySelector('.coach-bubble');
    const key = `${this.coach.step}|${target ? 1 : 0}`;
    if (this._coachKey !== key) {
      this._coachKey = key;
      bub.innerHTML = `<small>TUTORIAL · ${this.coach.step + 1}/${STEPS.length}</small><strong class="coach-title">${s.title}</strong><p>${s.text}</p>
        <div class="coach-actions">${s.btn ? `<button class="action small primary" data-coach-next type="button">${s.btn}</button>` : `<span class="coach-wait">${target ? '👆 Toque no destaque' : 'Aguardando…'}</span>`}<button class="action small ghost" data-coach-skip type="button">Pular tutorial</button></div>`;
    }
    if (target) {
      const r = target.getBoundingClientRect(), pad = 8;
      Object.assign(hole.style, { display:'block', left:`${r.left - pad}px`, top:`${r.top - pad}px`, width:`${r.width + pad * 2}px`, height:`${r.height + pad * 2}px` });
      const bw = Math.min(360, innerWidth - 24), below = r.bottom + 14 + 200 < innerHeight;
      let left = U.clamp(r.left + r.width / 2 - bw / 2, 12, innerWidth - bw - 12);
      Object.assign(bub.style, { width:`${bw}px`, left:`${left}px`, top:below ? `${r.bottom + 14}px` : '', bottom:below ? '' : `${innerHeight - r.top + 14}px`, transform:'' });
    } else {
      hole.style.display = 'none';
      const bw = Math.min(420, innerWidth - 24);
      Object.assign(bub.style, s.float ? { width:`${bw}px`, left:`${(innerWidth - bw) / 2}px`, top:'78px', bottom:'', transform:'' } : { width:`${bw}px`, left:`${(innerWidth - bw) / 2}px`, top:'50%', bottom:'', transform:'translateY(-50%)' });
    }
  };
})();
