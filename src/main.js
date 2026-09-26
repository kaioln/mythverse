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
    if (!online) { KT.State.setSaveKey(KT.State.SAVE_KEY); return { state:KT.State.loadState(), mode:'offline' }; }
    let user = await KT.Net.me();
    if (!user) user = await KT.Auth.show('login');
    KT.State.setSaveKey(`${KT.State.SAVE_KEY}:srv:${user.id}`);
    let remote = await KT.Net.getState();
    for (let i = 0; !remote.ok && remote.status !== 401 && i < 3; i++) { await new Promise(r => setTimeout(r, 1500)); remote = await KT.Net.getState(); }
    if (!remote.ok) throw new Error(`Não foi possível carregar seu progresso do servidor: ${remote.error}`);
    return { state:KT.State.mergeState(remote.state), mode:'cloud', revision:remote.revision || 0, user, offline:remote.offline };
  }

  async function boot() {
    const bootEl = document.querySelector('#boot'), fill = document.querySelector('#boot-fill'), label = document.querySelector('#boot-label');
    try {
      label.textContent = 'Conectando à Fenda…';
      const session = await resolveState();
      bootEl.classList.remove('done');
      const state = session.state;
      const assets = new KT.AssetBank();
      const engine = new KT.CombatEngine(state, {});
      const offline = session.mode === 'cloud' ? session.offline : engine.offlineGains();
      const renderer = new KT.GameRenderer(document.querySelector('#game-canvas'), assets, engine);
      const sound = new SoundEngine();
      const ui = new KT.UIController(state, engine, assets, renderer, {
        sound:on => sound.enable(on), warn:() => sound.warn(), victory:() => sound.victory(),
        summon:r => sound.summon(r), reward:() => sound.chord([784, 988, 1175], .05, 'sine', .04), click:() => sound.tone(660, .05, 'triangle', .03)
      });
      ui.session = session; ui.ask = askBox;
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
      if (session.mode === 'cloud') { KT.Server.attach(engine, ui, session.revision); ui.loadMarket(true); setInterval(() => KT.Net.syncClock(), 10 * 60_000); setInterval(() => { if (!engine.seg && !engine.segWaiting && KT.Server.status !== 'saving') KT.Server.flush(); }, 5 * 60_000); }

      assets.onProgress = (done, total) => { fill.style.width = `${Math.round(done / total * 100)}%`; label.textContent = `Abrindo a Fenda… ${done}/${total}`; };
      let booted = false;
      const ready = () => {
        if (booted) return; booted = true;
        bootEl.classList.add('done'); setTimeout(() => bootEl.remove(), 700);
        ui.renderAll();
        if (session.mode === 'offline') ui.toast(location.protocol === 'file:' ? '<b>Modo offline</b>: progresso salvo só neste navegador. Rode o servidor para contas e saves na nuvem.' : 'Servidor indisponível: jogando no <b>modo offline</b>.');
        if (session.mode === 'cloud' && session.user) ui.toast(`Bem-vindo, <b>${session.user.username}</b>! Seu progresso fica protegido no servidor.`, 'gold');
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
      // Com a aba em segundo plano (ou a janela coberta) o requestAnimationFrame pausa: mantém a caçada rodando.
      let bgSave = 0;
      setInterval(() => { if (!document.hidden && performance.now() - last < 1000) return; engine.update(.5); if (++bgSave >= 20) { bgSave = 0; engine.save(); } }, 500);
      addEventListener('beforeunload', () => engine.save());
      document.addEventListener('visibilitychange', () => { if (document.hidden) engine.save(); last = performance.now(); });
      if (state.settings.sound) document.addEventListener('pointerdown', () => sound.enable(true).then(() => document.querySelector('#sound-btn').classList.add('on')), { once:true });
      globalThis.__KIZUNA__ = { state, engine, renderer, ui, assets, sound };
    } catch (err) {
      console.error(err);
      document.body.innerHTML = `<pre style="white-space:pre-wrap;background:#170d10;color:#ffe7e4;padding:24px;min-height:100vh;margin:0">Falha ao iniciar Mythverse\n\n${String(err?.stack || err).replace(/</g, '&lt;')}</pre>`;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
})();
