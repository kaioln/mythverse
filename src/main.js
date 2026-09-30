(() => {
  const KT = globalThis.KT;

  // Sons sintetizados via Web Audio (sem arquivos), ativados só após interação.
  class SoundEngine {
    constructor() { this.ctx = null; this.enabled = false; this.master = null; this.last = {}; }
    async enable(on) {
      this.enabled = on;
      if (on && !this.ctx) { const C = globalThis.AudioContext || globalThis.webkitAudioContext; if (C) { this.ctx = new C(); this.master = this.ctx.createGain(); this.master.gain.value = .5; this.master.connect(this.ctx.destination); } }
      if (this.ctx?.state === 'suspended') await this.ctx.resume();
      if (on) this.chord([523, 659, 784], .08, 'triangle', .05);
    }
    throttle(key, ms) { const now = performance.now(); if (now - (this.last[key] || 0) < ms) return false; this.last[key] = now; return true; }
    tone(freq = 320, dur = .08, type = 'sine', gain = .05, slide = 0, delay = 0) {
      if (!this.enabled || !this.ctx) return;
      const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + .02);
    }
    noise(dur = .1, gain = .05, freq = 1800, delay = 0) {
      if (!this.enabled || !this.ctx) return;
      const t = this.ctx.currentTime + delay, len = Math.floor(this.ctx.sampleRate * dur), buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
      src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = .8; g.gain.value = gain;
      src.connect(f); f.connect(g); g.connect(this.master); src.start(t);
    }
    chord(freqs, step = .07, type = 'triangle', gain = .045) { freqs.forEach((f, i) => this.tone(f, .22, type, gain, 0, i * step)); }
    fx(fx) {
      if (!fx || !this.enabled) return;
      switch (fx.type) {
        case 'attack': if (this.throttle('slash', 45)) { this.noise(.07, .05, 2200); this.tone(440, .06, 'triangle', .03, .6); } break;
        case 'damage': if (fx.side === 'hero' && fx.kind !== 'dot' && this.throttle('hurt', 90)) { this.noise(.08, .05, 600); this.tone(160, .1, 'square', .025, .6); } else if (fx.crit && this.throttle('crit', 60)) this.tone(880, .08, 'triangle', .035, .7); break;
        case 'cast': this.tone(fx.ult ? 330 : 440, fx.ult ? .35 : .2, 'sawtooth', .03, 2.2); this.noise(.2, .03, 5000); break;
        case 'burst': this.noise(.25, .07, 900); this.tone(110, .3, 'sine', .08, .4); break;
        case 'heal': if (this.throttle('heal', 150)) this.chord([659, 880, 1175], .05, 'sine', .035); break;
        case 'death': if (this.throttle('death', 60)) { this.tone(260, .2, 'triangle', .04, .3); this.noise(.15, .04, 1200); } break;
        case 'bossWindup': this.tone(90, 1.2, 'sawtooth', .04, 2.5); break;
        case 'bossBurst': this.noise(.5, .1, 300); this.tone(70, .6, 'sine', .12, .5); break;
        case 'levelUp': this.chord([523, 659, 784, 1047], .06, 'triangle', .045); break;
        case 'reward': if (this.throttle('coin', 200)) { this.tone(1320, .08, 'square', .018); this.tone(1760, .12, 'square', .018, 0, .06); } break;
      }
    }
    loot(item) { const base = { mythic:1040, legendary:880, set:800, epic:740, rare:660, common:520 }[item.rarity] || 520; if (item.rarity === 'common') this.tone(base, .1, 'sine', .03); else this.chord([base, base * 1.25, base * 1.5], .05, 'triangle', .035); }
    victory() { this.chord([523, 659, 784, 1047, 1319], .1, 'triangle', .05); }
    warn() { this.tone(220, .15, 'square', .03); this.tone(220, .15, 'square', .03, 0, .2); }
    summon(r) { const n = { legendary:[523, 659, 784, 1047, 1319, 1568], epic:[523, 659, 784, 1047, 1319], rare:[523, 659, 784, 1047] }[r] || [523, 659, 784]; this.chord(n, .08, 'triangle', .045); }
  }

  // Caixa de diálogo simples (também usada antes de a interface existir).
  function askBox(title, text, buttons) {
    return new Promise(resolve => {
      const el = document.querySelector('#ask-modal');
      el.innerHTML = `<section class="ask-card" role="alertdialog"><h3>${title}</h3><p>${text}</p><div class="ask-actions">${buttons.map(b => `<button type="button" class="action ${b.primary ? 'primary' : ''} ${b.danger ? 'red' : ''}" data-ask="${b.id}">${b.label}</button>`).join('')}</div></section>`;
      el.hidden = false;
      el.querySelectorAll('[data-ask]').forEach(b => b.addEventListener('click', () => { el.hidden = true; resolve(b.dataset.ask); }));
    });
  }
  KT.askBox = askBox;

  // Decide de onde vem o save: nuvem (conta) ou navegador (modo offline).
  // Online, o estado vem sempre do servidor (fonte única da verdade): não existe mais conflito
  // entre "local" e "nuvem". Offline (arquivo aberto direto), o progresso fica neste navegador.
  async function resolveState() {
    const online = await KT.Net.detect();
    if (!online) {
      // Site só de arquivos (ex.: GitHub Pages): leva ao servidor configurado; sem servidor, avisa em vez de entrar sem conta.
      const server = String(KT.CONFIG?.server || '').trim();
      if (location.protocol !== 'file:' && server) {
        let target = null; try { target = new URL(server); } catch (_) { target = null; }
        if (target && /^https?:$/.test(target.protocol) && target.origin !== location.origin) { location.replace(target.href); return new Promise(() => {}); }
      }
      if (location.protocol !== 'file:' && KT.Neon?.enabled) return resolveNeon();
      if (location.protocol !== 'file:' && await KT.Auth.unavailable() !== 'offline') { location.reload(); return new Promise(() => {}); }
      KT.State.setSaveKey(KT.State.SAVE_KEY); return { state:KT.State.loadState(), mode:'offline' };
    }
    let user = await KT.Net.me();
    if (!user) user = await KT.Auth.show('login');
    KT.State.setSaveKey(`${KT.State.SAVE_KEY}:srv:${user.id}`);
    let remote = await KT.Net.getState();
    for (let i = 0; !remote.ok && remote.status !== 401 && i < 3; i++) { await new Promise(r => setTimeout(r, 1500)); remote = await KT.Net.getState(); }
    if (!remote.ok) throw new Error(`Não foi possível carregar seu progresso do servidor: ${remote.error}`);
    return { state:KT.State.mergeState(remote.state), mode:'cloud', revision:remote.revision || 0, user, offline:remote.offline };
  }

  // Modo Neon: conta no Neon Auth, save na tabela mv_saves (Data API). O jogo roda no navegador.
  async function resolveNeon() {
    let user = await KT.Neon.currentUser();
    if (!user) user = await KT.Auth.show('login', 'neon');
    KT.State.setSaveKey(`${KT.State.SAVE_KEY}:neon:${user.id}`);
    await KT.Neon.syncClock().catch(() => false);
    const data = await KT.Neon.loadSave();
    const state = data ? KT.State.mergeState(data) : KT.State.createState();
    if (!data) state.player.name = String(user.username || 'Viajante').slice(0, 20);
    return { state, mode:'neon', user:{ ...user, id:'me' } };
  }

  async function boot() {
    const bootEl = document.querySelector('#boot'), fill = document.querySelector('#boot-fill'), label = document.querySelector('#boot-label');
    try {
      label.textContent = 'Conectando à Fenda…';
      const session = await resolveState();
      bootEl.classList.remove('done');
      const state = session.state;
      // Desenvolvimento (arquivo local ou localhost com ?devseed=1): save de teste com equipe nível 80 e tutorial visto,
      // para conferir telas em vários tamanhos. Nunca roda no site publicado.
      if ((location.protocol === 'file:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) && new URLSearchParams(location.search).has('devseed') && !state.collection.length) {
        const ids = (new URLSearchParams(location.search).get('devseed') || '').split(',').filter(id => KT.Data.roster.some(t => t.id === id));
        state.collection = (ids.length ? ids : ['erik', 'akira', 'warden', 'aurelia']).map(id => Object.assign(KT.State.newHeroRecord(KT.Data.roster.find(t => t.id === id), 'epic'), { level:80 }));
        state.formation = state.collection.slice(0, 4).map(h => h.uid);
        Object.assign(state.player, { gold:14.6e6, crystal:993, keys:80, level:56, name:'Teste' });
        state.story.seen.intro = state.story.seen.team = true; state.starterRolls = 0;
        Object.keys(KT.Data.zones).forEach(z => { if (['hunt', 'dungeon', 'boss', 'hunt_swamp', 'dungeon_crypt'].includes(z)) Object.assign(state.progress[z] ||= {}, { best:12, kills:3 }); });
      }
      const assets = new KT.AssetBank();
      const engine = new KT.CombatEngine(state, {});
      // No modo Neon o AFK só conta com a hora do banco (relógio do aparelho pode ser adiantado).
      const offline = session.mode === 'cloud' ? session.offline : session.mode === 'neon' && !KT.Clock.trusted ? null : engine.offlineGains();
      const renderer = new KT.GameRenderer(document.querySelector('#game-canvas'), assets, engine);
      const sound = new SoundEngine();
      const ui = new KT.UIController(state, engine, assets, renderer, {
        sound:on => sound.enable(on), warn:() => sound.warn(), victory:() => sound.victory(),
        summon:r => sound.summon(r), reward:() => sound.chord([784, 988, 1175], .05, 'sine', .04), click:() => sound.tone(660, .05, 'triangle', .03)
      });
      ui.session = session; ui.ask = askBox;
      // Só no servidor local de desenvolvimento: acesso para testes automáticos da interface.
      if (location.protocol === 'file:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) { KT.dev = { ui, engine, renderer }; const f = new URLSearchParams(location.search).get('devfight'); if (f && KT.Data.zones[f]) setTimeout(() => engine.enterZone(f, { stage:1, floor:1, tier:0 }), 800); }
      ui.initAfk?.(); ui.initHud?.(); ui.initCoach?.();
      engine.events = {
        onZone:z => ui.onZone(z), onWave:i => ui.onWave(i), onPhase:p => ui.onPhase(p),
        onLoot:item => { ui.onLoot(item); sound.loot(item); }, onCard:c => { ui.onCard(c); sound.summon(c.mvp ? 'legendary' : 'epic'); },
        onLog:p => ui.onLog(p), onFx:fx => { renderer.emit(fx); sound.fx(fx); },
        onToast:t => ui.toast(t), onWarn:t => ui.onWarn(t),
        onResult:r => ui.onResult(r), onResultClose:() => ui.onResultClose(),
        onChoice:c => ui.onChoice(c), onChoiceResolved:c => ui.onChoiceResolved(c), onStuck:p => ui.onStuck(p), onDialog:l => ui.onDialog(l),
        onStageClear:r => ui.onStageClear(r), onDefeatHunt:r => ui.onDefeatHunt(r),
        onAccountLevel:l => ui.onAccountLevel(l),
        onState:() => { ui.renderResources(); ui.renderSide(); }
      };
      if (session.mode === 'neon') {
        const save0 = engine.save.bind(engine);
        // Se outro aparelho assumiu o save, este para de gravar (nem local, nem nuvem) para não sobrescrever nada.
        engine.save = () => { if (KT.Neon.conflict) return false; const local = save0(), queued = KT.Neon.queue(state); return local && queued; };
        KT.Neon.onTakeover = () => { engine.paused = true; askBox('Jogo aberto em outro aparelho', 'Seu progresso continua no aparelho (ou aba) aberto por último. Este aqui parou de salvar para não apagar nada. Recarregue para continuar jogando aqui.', [{ id:'reload', label:'Continuar aqui', primary:true }]).then(() => location.reload()); };
        KT.Neon.onRemote = remote => {
          const fresh = KT.State.mergeState(remote);
          Object.keys(state).forEach(k => { delete state[k]; }); Object.assign(state, fresh);
          engine.refreshPartyUnits?.(); ui.renderAll();
        };
        KT.Neon.onConflict = () => ui.toast('Outro aparelho salvou primeiro. O progresso mais novo foi sincronizado; a cópia local anterior ficou preservada.', 'red');
        KT.Neon.onError = e => ui.toast(`Não foi possível salvar no Neon: ${e}. Tentando de novo.`);
        KT.Neon.onStatus = () => ui.renderCloud();
        KT.Social?.attach(engine, ui);
        // Tesouro Imperial: ajustes de ouro, preços e impostos (a cada 30 min).
        const econ = () => KT.NeonMarket?.economy(engine).catch(() => {}); econ(); setInterval(econ, 30 * 60_000);
        setInterval(() => KT.Neon.syncClock().catch(() => {}), 10 * 60_000);
        const gifts = () => KT.NeonMarket?.claimGifts(engine).then(list => list.forEach(g => {
          const t = g.kind === 'hero' && engine.template(g.payload.id);
          ui.toast(g.kind === 'keys' ? `<b>Presente:</b> +${Number(g.payload.n).toLocaleString('pt-BR')} Chaves de Convocação!` : `<b>Presente:</b> ${t ? t.name : 'um herói'} (${KT.Data.heroRarities.find(r => r.id === g.payload.rarity)?.label || ''}) entrou na coleção!`, 'gold');
          ui.callbacks.summon?.(g.kind === 'hero' ? g.payload.rarity : 'epic'); ui.renderResources();
        })).catch(() => {});
        setTimeout(gifts, 2500); setInterval(gifts, 5 * 60_000);
        if (KT.Neon.conflict) KT.Neon.onConflict();
        addEventListener('visibilitychange', () => { if (document.hidden && Date.now() - KT.Neon.lastHide > 15000) { KT.Neon.lastHide = Date.now(); engine.save(); KT.Neon.flush(); } });
        addEventListener('pagehide', () => { engine.save(); KT.Neon.flush(); });
        // Assume o save logo na abertura: outro aparelho aberto antes deixa de gravar.
        setTimeout(() => { engine.save(); KT.Neon.flush(); }, 1500);
      }
      // Versão nova publicada: salva e recarrega sozinho (fora de luta), para ninguém ficar preso na versão antiga.
      if (location.protocol !== 'file:') {
        let reloading = false;
        const checkVersion = async () => {
          if (reloading) return;
          try {
            const r = await fetch(`version.json?t=${Date.now()}`, { cache:'no-store' }); if (!r.ok) return;
            const v = (await r.json()).v; if (!v || v === KT.VERSION) return;
            reloading = true; ui.toast('<b>Nova versão do jogo!</b> Salvando e atualizando…', 'gold');
            const go = async () => { if (engine.phase === 'fight' && engine.zone?.kind !== 'village') { setTimeout(go, 5000); return; } engine.save(); try { await KT.Neon?.flush?.(); await KT.Server?.flush?.(); } catch (_) {} location.reload(); };
            setTimeout(go, 3000);
          } catch (_) {}
        };
        setTimeout(checkVersion, 20_000); setInterval(checkVersion, 3 * 60_000);
      }
      if (session.mode === 'cloud') { KT.Server.attach(engine, ui, session.revision); ui.loadMarket(true); setInterval(() => KT.Net.syncClock(), 10 * 60_000); setInterval(() => { if (!engine.seg && !engine.segWaiting && KT.Server.status !== 'saving') KT.Server.flush(); }, 5 * 60_000); }

      assets.onProgress = (done, total) => { fill.style.width = `${Math.round(done / total * 100)}%`; label.textContent = `Preparando a jornada… ${done}/${total}`; };
      let booted = false;
      const ready = () => {
        if (booted) return; booted = true;
        bootEl.classList.add('done'); setTimeout(() => bootEl.remove(), 700);
        ui.renderAll();
        if (session.mode === 'offline') ui.toast(location.protocol === 'file:' ? '<b>Modo offline</b>: progresso salvo só neste navegador. Rode o servidor para contas e saves na nuvem.' : 'Servidor indisponível: jogando no <b>modo offline</b>.');
        if (session.mode === 'cloud' && session.user) ui.toast(`Bem-vindo, <b>${session.user.username}</b>! Seu progresso fica protegido no servidor.`, 'gold');
        if (session.mode === 'neon' && session.user) ui.toast(`Bem-vindo, <b>${session.user.username}</b>! Seu progresso fica salvo na sua conta.`, 'gold');
        if (!state.story.seen.intro) { ui.cmd('markSeen', 'intro'); ui.onDialog(KT.Data.story.intro); }
        if (offline) ui.showOffline(offline);
      };
      assets.loadAll().then(ready);
      setTimeout(ready, 9000);

      const savedZone = state.zone && KT.Data.zones[state.zone] ? state.zone : 'village';
      const reenter = KT.Data.zones[savedZone].kind === 'hunt' ? savedZone : savedZone === 'village' ? 'village' : state.lastHunt;
      if (!engine.enterZone(reenter)) engine.enterZone('village');
      ui.renderAll();

      let last = performance.now(), uiClock = 0, slowClock = 0, saveClock = 0;
      function frame(now) {
        const dt = Math.min(.06, (now - last) / 1000 || 0); last = now;
        if (renderer.hitstop <= 0) engine.update(dt);
        renderer.update(dt); renderer.render();
        uiClock += dt; slowClock += dt; saveClock += dt;
        if (uiClock > .08) { uiClock = 0; ui.renderParty(); ui.renderBoss(); }
        if (slowClock > .5) { slowClock = 0; ui.renderResources(); ui.renderZone(); ui.renderControls(); ui.renderSide(); ui.renderChoiceTimer(); }
        if (saveClock > 5) { saveClock = 0; engine.save(); }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      // Aba em segundo plano, minimizada ou coberta: o requestAnimationFrame para e o navegador espaça os timers
      // (até 1 por minuto). A caçada continua pelo TEMPO REAL decorrido e, ao voltar, recupera o que faltou (até 30 min).
      // A recuperação roda em fatias de ~12 ms por quadro e SEM efeitos (números, sons, avisos, registro): antes ela
      // simulava tudo de uma vez e despejava milhares de efeitos na tela, e o jogo travava por vários segundos.
      const QUIET = new Set(['onFx', 'onLog', 'onToast', 'onWarn', 'onWave', 'onPhase', 'onLoot', 'onCard', 'onState', 'onStageClear', 'onDefeatHunt']);
      let bgSave = 0, bgLast = performance.now(), debt = 0, catching = false, caught = null;
      const quietRun = (budgetMs) => {
        const live = engine.events, t0 = performance.now();
        engine.events = Object.fromEntries(Object.entries(live).filter(([k]) => !QUIET.has(k)));
        engine.events.onLoot = () => { caught.loot++; }; engine.events.onCard = () => { caught.cards++; };
        try { while (debt > .05 && performance.now() - t0 < budgetMs) { const d = Math.min(1, debt); engine.update(d); debt -= d; } }
        finally { engine.events = live; }
      };
      const finishCatch = () => {
        catching = false; renderer.hitstop = 0; renderer.particles = []; renderer.delayed = []; renderer.projectiles = [];
        document.querySelector('#catchup')?.remove();
        const c = caught; caught = null; engine.save(); ui.renderAll();
        if (c && c.secs >= 30 && engine.active) { const g = state.player.gold - c.gold, min = Math.max(1, Math.round(c.secs / 60)); ui.toast(`<b>De volta!</b> A equipe seguiu caçando por ${min} min: +${KT.Utils.fmt(Math.max(0, g))} ouro${c.loot ? `, ${c.loot} itens` : ''}${c.cards ? `, ${c.cards} carta(s)` : ''}.`); }
      };
      const catchUp = (visible) => {
        const now = performance.now(), gap = (now - bgLast) / 1000; bgLast = now;
        debt = Math.min(debt + gap, 1800);
        if (!caught) caught = { secs:0, loot:0, cards:0, gold:state.player.gold };
        caught.secs += gap;
        if (!visible) { quietRun(250); return; }
        if (catching) return;
        if (debt <= .05) { finishCatch(); return; }
        catching = true;
        if (debt > 8) { const el = document.createElement('div'); el.id = 'catchup'; el.innerHTML = '<b>Recuperando a caçada</b><i><s></s></i>'; document.body.appendChild(el); }
        const total = debt;
        const slice = () => { quietRun(12); const bar = document.querySelector('#catchup s'); if (bar) bar.style.width = `${Math.round(100 * (1 - debt / total))}%`; if (debt > .05) requestAnimationFrame(slice); else finishCatch(); };
        slice();
      };
      setInterval(() => {
        if (!document.hidden && performance.now() - last < 1000) { bgLast = performance.now(); return; }
        if (catching) return;
        catchUp(false); if (++bgSave >= 10) { bgSave = 0; engine.save(); }
      }, 1000);
      addEventListener('beforeunload', () => engine.save());
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { bgLast = performance.now(); caught = { secs:0, loot:0, cards:0, gold:state.player.gold }; engine.save(); }
        else catchUp(true);
        last = performance.now();
      });
      if (state.settings.sound) document.addEventListener('pointerdown', () => sound.enable(true).then(() => document.querySelector('#sound-btn').classList.add('on')), { once:true });
      // Atmosfera 3D do palco (three.js sob demanda; some sozinha sem WebGL ou com "reduzir movimento").
      KT.__zone = () => engine.zone; KT.Atmos?.mount(document.querySelector('#viewport'));
      setTimeout(() => KT.Map3D?.prewarm(), 2500);
      globalThis.__KIZUNA__ = { state, engine, renderer, ui, assets, sound };
    } catch (err) {
      console.error(err);
      document.body.innerHTML = `<pre style="white-space:pre-wrap;background:#170d10;color:#ffe7e4;padding:24px;min-height:100vh;margin:0">Falha ao iniciar Mythverse\n\n${String(err?.stack || err).replace(/</g, '&lt;')}</pre>`;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
})();
