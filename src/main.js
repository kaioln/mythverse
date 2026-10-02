(() => {
  const KT = globalThis.KT;

  // Som do jogo: trilha por cena e efeitos gravados (assets/audio/combat). O áudio só começa depois de um toque do jogador.
  // Três volumes guardados no aparelho: geral, música e efeitos.
  const VOL_KEY = 'mv_audio';
  const loadVolumes = () => { const d = { master:1, music:1, sfx:1 }; try { const v = JSON.parse(localStorage.getItem(VOL_KEY) || '{}'); for (const k of Object.keys(d)) if (Number.isFinite(v[k])) d[k] = Math.max(0, Math.min(1, v[k])); } catch (_) {} return d; };
  class SoundEngine {
    constructor() { this.ctx = null; this.enabled = false; this.master = null; this.music = null; this.sfx = null; this.musicTimer = 0; this.scene = 'city'; this.last = {}; this.buffers = new Map(); this.musicSources = new Set(); this.fxSources = new Set(); this.musicGeneration = 0; this.eventIndex = {}; this.vol = loadVolumes(); this.manifest = {}; this.combatIndex = fetch('assets/audio/combat/index.json' + (KT.VERSION ? '?v=' + KT.VERSION : '')).then(r => r.ok ? r.json() : null).then(index => { this.manifest = index || {}; this.eventIndex = index?.events || {}; return index?.heroes || {}; }).catch(() => ({})); }
    musicVolume() { return (this.scene === 'city' ? .24 : .16) * this.vol.music; }
    masterVolume() { return .5 * this.vol.master; }
    // Volume de 0 a 1 de 'master', 'music' ou 'sfx'; fica guardado neste aparelho.
    setVolume(kind, value) {
      if (!(kind in this.vol)) return;
      this.vol[kind] = Math.max(0, Math.min(1, Number(value) || 0));
      try { localStorage.setItem(VOL_KEY, JSON.stringify(this.vol)); } catch (_) {}
      if (this.master && this.enabled) this.master.gain.value = this.masterVolume();
      if (this.music) this.music.gain.value = this.musicVolume();
      if (this.sfx) this.sfx.gain.value = this.vol.sfx;
    }
    async enable(on) {
      this.enabled = on;
      if (on && !this.ctx) { const C = globalThis.AudioContext || globalThis.webkitAudioContext; if (C) { this.ctx = new C(); this.master = this.ctx.createGain(); this.music = this.ctx.createGain(); this.sfx = this.ctx.createGain(); this.master.gain.value = this.masterVolume(); this.music.gain.value = this.musicVolume(); this.sfx.gain.value = this.vol.sfx; this.music.connect(this.master); this.sfx.connect(this.master); this.master.connect(this.ctx.destination); } }
      if (on && this.ctx?.createDynamicsCompressor && !this.limiter) {
        this.limiter = this.ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -12; this.limiter.knee.value = 12; this.limiter.ratio.value = 8; this.limiter.attack.value = .003; this.limiter.release.value = .18;
        this.master.disconnect(); this.master.connect(this.limiter); this.limiter.connect(this.ctx.destination);
      }
      if (this.ctx?.state === 'suspended') await this.ctx.resume();
      if (this.enabled !== on) return;
      if (this.master) this.master.gain.value = on ? this.masterVolume() : 0;
      if (on) this.startMusic(); else { this.stopMusic(); this.stopFx(); }
    }
    setScene(zone) {
      const kind = typeof zone === 'string' ? zone : zone.kind;
      const themes = { forest:'forest', sakura:'forest', swamp:'forest', sky:'forest', skyShrine:'crypt', dungeon:'crypt', crypt:'crypt', ghost:'crypt', rift:'crypt', coast:'coast', archive:'coast', abyss:'coast', frost:'frost', forge:'forge', desert:'desert', desertBoss:'desert', clock:'clock', boss:'boss', skyBoss:'boss' };
      const scene = kind === 'village' ? 'city' : themes[zone.theme] || (['boss','worldboss'].includes(kind) ? 'boss' : 'battle');
      if (scene === this.scene) return;
      this.stopFx(); this.scene = scene; if (this.enabled) this.startMusic(); else this.stopMusic();
    }
    buffer(url) {
      if (!this.buffers.has(url)) this.buffers.set(url, fetch(url + (url.startsWith('assets/audio/combat/') && KT.VERSION ? '?v=' + KT.VERSION : '')).then(r => { if (!r.ok) throw new Error('audio unavailable'); return r.arrayBuffer(); }).then(b => this.ctx.decodeAudioData(b)).catch(() => null));
      return this.buffers.get(url);
    }
    async startMusic() {
      this.stopMusic(); if (!this.enabled || !this.ctx) return;
      this.music.gain.value = this.musicVolume();
      const url = `assets/audio/music/${this.scene}.mp3${KT.VERSION ? '?v=' + KT.VERSION : ''}`, previous = Array.from(this.buffers.keys()).filter(key => key.startsWith('assets/audio/music/') && key !== url);
      for (const key of previous.slice(0, -1)) this.buffers.delete(key);
      const generation = this.musicGeneration, buffer = await this.buffer(url);
      if (!buffer || !this.enabled || generation !== this.musicGeneration) return;
      const overlap = Math.min(1.5, buffer.duration / 4);
      const play = when => {
        if (!this.enabled || generation !== this.musicGeneration) return;
        const start = Math.max(this.ctx.currentTime, when), source = this.ctx.createBufferSource(), gain = this.ctx.createGain();
        source.buffer = buffer; source.connect(gain); gain.connect(this.music); this.musicSources.add(source);
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(1, start + overlap);
        gain.gain.setValueAtTime(1, start + buffer.duration - overlap); gain.gain.linearRampToValueAtTime(0, start + buffer.duration);
        source.onended = () => { this.musicSources.delete(source); source.disconnect(); gain.disconnect(); };
        source.start(start);
        const next = start + buffer.duration - overlap;
        this.musicTimer = setTimeout(() => play(next), Math.max(0, (next - this.ctx.currentTime - 2) * 1000));
      };
      play(this.ctx.currentTime);
    }
    stopMusic() { this.musicGeneration++; clearTimeout(this.musicTimer); this.musicTimer = 0; for (const source of this.musicSources) source.stop(); this.musicSources.clear(); }
    stopFx() { for (const source of this.fxSources) source.stop(); this.fxSources.clear(); }
    // Deixa na memória os sons de quem está em campo: golpes dos heróis, a voz de cada criatura e os eventos.
    async prepare(units) {
      if (!this.enabled || !this.ctx) return;
      const index = await this.combatIndex, M = this.manifest, urls = new Set();
      const add = file => { if (file) urls.add(`assets/audio/combat/${file}`); };
      units.forEach(u => {
        const hero = index[u.sprite];
        if (hero) { ['attack','skill','ult'].forEach(event => add(hero[event])); return; }
        const c = M.creatures?.[u.sprite];
        if (c) { add(c.a); add(c.d); add(M.families?.[c.f]?.cast); }
      });
      Object.values(this.eventIndex).forEach(add);
      for (const key of this.buffers.keys()) if (key.startsWith('assets/audio/combat/') && !urls.has(key)) this.buffers.delete(key);
      await Promise.all([...urls].map(url => this.buffer(url)));
    }
    // Toca um arquivo de efeito. Cada execução sai um pouco diferente (tom e volume) para nada soar repetido.
    async play(file, o = {}) {
      if (!file || !this.enabled || !this.ctx || (this.scene === 'city' && !o.ui)) return;
      if (o.key && !this.throttle(o.key, o.every || 150)) return;
      const generation = this.musicGeneration, buffer = await this.buffer(`assets/audio/combat/${file}`);
      if (!buffer || generation !== this.musicGeneration || !this.enabled) return;
      const priority = o.priority || 0;
      if (this.fxSources.size >= 6) {
        const victim = [...this.fxSources].find(src => (src.priority || 0) < priority);
        if (!victim) return;
        victim.stop(); this.fxSources.delete(victim);
      }
      const source = this.ctx.createBufferSource(), gain = this.ctx.createGain(), vary = o.vary ?? .035;
      source.buffer = buffer; source.priority = priority;
      if (source.playbackRate) source.playbackRate.value = (o.rate || 1) * (1 + (Math.random() * 2 - 1) * vary);
      gain.gain.value = (o.gain ?? .2) * (.92 + Math.random() * .16);
      const pan = this.ctx.createStereoPanner?.();
      const bus = this.sfx || this.master;
      if (pan) { pan.pan.value = o.pan || 0; source.connect(gain); gain.connect(pan); pan.connect(bus); }
      else { source.connect(gain); gain.connect(bus); }
      this.fxSources.add(source); source.onended = () => { this.fxSources.delete(source); source.disconnect(); gain.disconnect(); pan?.disconnect(); }; source.start();
      if (o.duck) this.duck(o.duck);
    }
    // Abaixa a trilha por um instante para o golpe grande respirar.
    duck(seconds = .7) {
      if (!this.music) return;
      this.music.gain.value = this.musicVolume() * .45;
      clearTimeout(this.duckTimer); this.duckTimer = setTimeout(() => { if (this.music) this.music.gain.value = this.musicVolume(); }, seconds * 1000);
    }
    event(name, o = {}) { return this.play(this.eventIndex[name], { gain:EVENT_GAIN[name] || .32, ...o }); }
    // Sons de um golpe: a arma do herói, ou o golpe da família da criatura com a voz dela por cima (nem sempre, para não cansar).
    async combat(fx, unit) {
      if (!this.enabled || !this.ctx || this.scene === 'city') return;
      const index = await this.combatIndex, M = this.manifest;
      const hero = ['attack','cast'].includes(fx.type) && (unit?.side === 'hero' || unit?.template?.base || (!unit?.side && index[unit?.sprite])) && index[unit?.sprite];
      const who = unit?.uid || unit?.sprite || 'field';
      if (hero) {
        const event = fx.type === 'attack' ? 'attack' : fx.ult ? 'ult' : 'skill', pan = unit.side === 'enemy' ? .3 : ([-.35,-.12,.12,.35][unit?.slot] || 0);
        return this.play(hero[event], { gain:event === 'attack' ? .26 : event === 'skill' ? .34 : .44, pan, priority:event === 'ult' ? 2 : event === 'skill' ? 1 : 0, key:`combat:${who}:${event}`, every:event === 'attack' ? 160 : 300, duck:event === 'ult' ? 1.1 : 0 });
      }
      // Criaturas não têm voz: só o golpe (o de cada uma) e a conjuração da família.
      const c = M.creatures?.[unit?.sprite], fam = c && M.families?.[c.f], pan = unit?.side === 'enemy' ? .3 : 0;
      if (fx.type === 'attack' || fx.type === 'enemyAttack') return this.play(c?.a || fam?.attack || this.eventIndex.enemyAttack, { gain:.24, pan, key:'enemy:attack', every:160 });
      if (fx.type === 'cast') return this.play(fam?.cast || this.eventIndex.enemyCast, { gain:.28, pan, priority:1, key:'enemy:cast', every:400 });
      return this.event(fx.type, { key:`combat:${fx.type === 'bossWindup' ? 'field' : who}:${fx.type}`, every:fx.type === 'bossWindup' ? 1200 : 200, priority:['bossBurst','bossWindup'].includes(fx.type) ? 2 : fx.type === 'heal' ? 1 : 0 });
    }
    throttle(key, ms) { const now = performance.now(); if (now - (this.last[key] || 0) < ms) return false; this.last[key] = now; return true; }
    tone(freq = 320, dur = .08, type = 'sine', gain = .05, slide = 0, delay = 0, bus = null) {
      if (!this.enabled || !this.ctx) return;
      const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g); g.connect(bus || this.master); o.start(t); o.stop(t + dur + .02);
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
    fx(fx, unit) {
      if (!fx || !this.enabled) return;
      const c = this.manifest.creatures?.[unit?.sprite], who = unit?.uid || 'field';
      switch (fx.type) {
        case 'attack': case 'enemyAttack': case 'cast': this.combat(fx, unit); break; // a chamada falada da ultimate vai junto com o golpe
        case 'damage':
          // Um golpe já soa na arma de quem bate: aqui só o impacto em quem apanha (herói) e o estalo do crítico.
          if (fx.kind === 'dot' || fx.kind === 'thorns') break;
          if (fx.side === 'hero') { if (this.throttle('hurt', 260)) this.event(unit?.cls === 'Vanguarda' ? 'damagePlate' : 'damage', { pan:[-.35,-.12,.12,.35][unit?.slot] || 0 }); }
          else if (fx.crit && this.throttle('crit', 450)) this.event('crit', { pan:.3 });
          break;
        case 'bossWindup': this.combat(fx, unit); break;
        case 'burst': if (unit?.side !== 'hero' && !unit?.template?.base) this.combat(fx, unit); break;
        case 'death': this.play(c?.d || this.eventIndex.death, { gain:fx.boss ? .42 : .24, pan:.3, priority:fx.boss ? 2 : 0, key:'death', every:320, duck:fx.boss ? 1.4 : 0 }); break;
        case 'heal': if (this.throttle('heal', 1100)) this.event('heal', { priority:1 }); break;
        case 'levelUp': this.event('levelUp', { priority:1, key:'levelUp', every:1500 }); break;
        case 'reward': this.event('reward', { key:'reward', every:1800 }); break;
        case 'bossBurst': this.event('bossBurst', { priority:2, key:'bossBurst', every:400, duck:1 }); break;
        case 'parry': this.event('parry', { priority:2, duck:1.2 }); break;
        case 'break': this.event('break', { priority:2, pan:.3, duck:.9 }); break;
        case 'finale': this.event('finale', { priority:2, duck:1.6 }); break;
        case 'chain': this.event('chain', { priority:1, rate:1 + Math.min(4, (fx.n || 2) - 2) * .06, vary:0 }); break;
        case 'strike': this.event('strike', { priority:2, key:'strike', every:500 }); break;
        case 'guard': case 'defend': case 'dodge': case 'shield': case 'revive': case 'heroDown': this.event(fx.type, { priority:1, key:`ev:${fx.type}:${who}`, every:160 }); break;
        case 'guardHit': this.event('guardHit', { key:'guardHit', every:260 }); break;
        case 'potion': case 'elixir': this.potion(fx.type); break;
      }
    }
    loot() { this.event('loot', { key:'loot', every:180 }); }
    victory() { this.event('victory', { priority:2, key:'victory', every:1500, duck:1.5 }); }
    defeat() { this.event('defeat', { priority:2, key:'defeat', every:1500, duck:1.5 }); }
    warn() { this.combat({type:'bossWindup'}); }
    potion(kind) { this.event(kind === 'elixir' ? 'elixir' : 'potion', { priority:1, key:'potion', every:300 }); }
    // Interface: toque, confirmação, recusa, painel abrindo e fechando. Toca também na cidade.
    ui(name) { this.play(this.eventIndex[name], { gain:EVENT_GAIN[name] || .3, ui:true, vary:.02, key:'ui', every:140 }); }
    summon() { this.play(this.eventIndex.summon, { gain:.45, ui:true, vary:0, priority:2, key:'summon', every:800 }); }
    // Amostra para acertar os volumes nas Configurações: o golpe e a habilidade de um herói e um aparo.
    async test(heroId) {
      const hero = (await this.combatIndex)[heroId] || {};
      [[hero.attack, .3, 0], [hero.skill, .4, 500], [this.eventIndex.parry, .48, 1900]].forEach(([file, gain, at]) => setTimeout(() => this.play(file, { gain, ui:true, vary:0 }), at));
    }
  }
  // Volume de cada evento na mesa. Os arquivos já saem nivelados por tipo (tools/sfx_pack.py): interface e passos bem
  // baixos, golpes no meio, aparo, quebra e explosões de chefe no alto. Aqui fica só o lugar de cada um na mistura.
  const EVENT_GAIN = { enemyAttack:.24, enemyCast:.28, damage:.26, damagePlate:.26, crit:.28, heal:.3, death:.24, bossWindup:.34, bossBurst:.4, burst:.28, reward:.26, loot:.32, levelUp:.36, victory:.4, defeat:.36,
    guard:.34, guardHit:.3, parry:.42, dodge:.3, break:.38, defend:.3, strike:.3, shield:.32, heroDown:.34, revive:.36, potion:.32, elixir:.32, chain:.26, finale:.44,
    uiClick:.3, uiConfirm:.32, uiDeny:.32, uiOpen:.3, uiClose:.3, summon:.4 };

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
  // Há quanto tempo (ms) ninguém toca, clica nem tecla: o jogo usa para gastar menos quando roda sozinho.
  let lastInput = Date.now();
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => addEventListener(ev, () => { lastInput = Date.now(); }, { passive:true, capture:true }));
  KT.idleFor = () => Date.now() - lastInput;
  // Modo econômico (Configurações): 30 quadros por segundo e desenho em resolução menor.
  KT.saver = () => { try { return localStorage.getItem('mythverse-saver') === 'on'; } catch (_) { return false; } };

  // Tela de carregamento: volta a aparecer (com o que está acontecendo) sempre que o jogo ainda não está pronto.
  KT.bootLabel = text => { const el = document.querySelector('#boot'); if (!el) return; el.classList.remove('done'); const l = el.querySelector('#boot-label'); if (l && text) l.textContent = text; };

  // Decide de onde vem o save: nuvem (conta) ou navegador (modo offline).
  // Online, o estado vem sempre do servidor (fonte única da verdade): não existe mais conflito
  // entre "local" e "nuvem". Offline (arquivo aberto direto), o progresso fica neste navegador.
  async function resolveState() {
    // Atalho estritamente local para QA visual; jamais ativa no site publicado.
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has('devoffline')) {
      KT.State.setSaveKey(KT.State.SAVE_KEY); return { state:KT.State.loadState(), mode:'offline' };
    }
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
    const user = await KT.Auth.requireUser();
    KT.State.setSaveKey(`${KT.State.SAVE_KEY}:srv:${user.id}`);
    let remote = await KT.Net.getState();
    for (let i = 0; !remote.ok && remote.status !== 401 && i < 3; i++) { await new Promise(r => setTimeout(r, 1500)); remote = await KT.Net.getState(); }
    if (!remote.ok) throw new Error(`Não foi possível carregar seu progresso do servidor: ${remote.error}`);
    return { state:KT.State.mergeState(remote.state), mode:'cloud', revision:remote.revision || 0, user, offline:remote.offline };
  }

  // Modo Neon: conta no Neon Auth, save na tabela mv_saves (Data API). O jogo roda no navegador.
  async function resolveNeon() {
    const user = await KT.Auth.requireUser('neon');
    KT.State.setSaveKey(`${KT.State.SAVE_KEY}:neon:${user.id}`);
    KT.bootLabel('Acertando o relógio de Tsukimori…');
    await KT.Neon.syncClock().catch(() => false);
    KT.bootLabel('Carregando seu progresso…');
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
      if ((location.protocol === 'file:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) && new URLSearchParams(location.search).has('devseed') && (!state.collection.length || new URLSearchParams(location.search).has('devlvl'))) {
        const ids = (new URLSearchParams(location.search).get('devseed') || '').split(',').filter(id => KT.Data.roster.some(t => t.id === id));
        state.collection = (ids.length ? ids : ['erik', 'akira', 'warden', 'aurelia']).map(id => Object.assign(KT.State.newHeroRecord(KT.Data.roster.find(t => t.id === id), 'epic'), { level:Number(new URLSearchParams(location.search).get('devlvl')) || 80 }));
        state.formation = state.collection.slice(0, 4).map(h => h.uid);
        Object.assign(state.player, { gold:14.6e6, crystal:993, keys:80, level:56, name:'Teste' });
        state.story.seen.intro = state.story.seen.team = true; state.starterRolls = 0;
        if (new URLSearchParams(location.search).get('devhud')) KT.Utils.safeStorage.set('mythverse-hud', new URLSearchParams(location.search).get('devhud'));
        Object.keys(KT.Data.zones).forEach(z => { if (['hunt', 'dungeon', 'boss', 'hunt_swamp', 'dungeon_crypt'].includes(z)) Object.assign(state.progress[z] ||= {}, { best:12, kills:3 }); });
      }
      const assets = new KT.AssetBank();
      const engine = new KT.CombatEngine(state, {});
      engine.cinematic = true;   // ao vivo: uma ação por vez, com a pausa de cada animação (src/engine.js BEAT)
      // No modo Neon o AFK só conta com a hora do banco (relógio do aparelho pode ser adiantado).
      const offline = session.mode === 'cloud' ? session.offline : session.mode === 'neon' && !KT.Clock.trusted ? null : engine.offlineGains();
      const renderer = new KT.GameRenderer(document.querySelector('#game-canvas'), assets, engine);
      const sound = new SoundEngine(); KT.sound = sound;
      const ui = new KT.UIController(state, engine, assets, renderer, {
        sound:on => sound.enable(on), warn:() => sound.warn(), victory:() => sound.victory(),
        summon:r => sound.summon(r), reward:() => sound.ui('uiConfirm'), click:() => sound.ui('uiClick'), resize:() => renderer.resize()
      });
      ui.session = session; ui.ask = askBox;
      // Interface com som: todo botão responde ao toque; os painéis abrem e fecham como papel deslizando.
      // Só os botões de ação fazem clique (abas, filtros e ícones ficam em silêncio: som demais cansa).
      document.addEventListener('click', e => { if (e.target.closest?.('.action, .lobby-go, .tc-btn, .signpost, .nav')) sound.ui('uiClick'); }, true);
      { const open0 = ui.openPanel?.bind(ui), close0 = ui.closeModal?.bind(ui);
        if (open0) ui.openPanel = (...a) => { if (ui.el.modal.hidden) sound.ui('uiOpen'); return open0(...a); };
        if (close0) ui.closeModal = (...a) => { if (!ui.el.modal.hidden) sound.ui('uiClose'); return close0(...a); }; }
      // Só no servidor local de desenvolvimento: acesso para testes automáticos da interface.
      if (location.protocol === 'file:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) { const q = new URLSearchParams(location.search), f = q.get('devfight'); KT.dev = { ui, engine, renderer, awake:q.has('devmode') || q.has('devawake') }; if (q.has('devstill')) document.head.insertAdjacentHTML('beforeend', '<style>*,*::before,*::after{animation:none!important;transition:none!important}</style>'); if (q.has('devtoast')) setTimeout(() => { ui.setMode('semi'); ui.setMode('manual'); ui.toast('Avanço automático <b>ligado</b>: ao vencer, segue para o próximo estágio.'); ui.toast('<b>Presente:</b> +5 Chaves de Convocação!', 'gold'); }, 2600); if (q.get('devpanel')) setTimeout(() => { ui.dialogQueue.length = 0; ui.advanceDialog(); const [pn, tab] = q.get('devpanel').split(':'); ui.openPanel(pn, tab); }, 1600); if (f && KT.Data.zones[f]) setTimeout(() => { if (q.get('devmode')) engine.setMode(q.get('devmode')); engine.enterZone(f, { stage:Number(q.get('devstage')) || 1, floor:1, tier:0 }); setTimeout(() => { ui.dialogQueue.length = 0; ui.advanceDialog(); }, 400); }, 800); }
      ui.initAfk?.(); ui.initHud?.(); ui.initCoach?.();
      engine.events = {
        onZone:z => { ui.onZone(z); sound.setScene(z); }, onWave:i => { ui.onWave(i); sound.prepare([...engine.party, ...engine.enemies]); }, onPhase:p => ui.onPhase(p),
        onLoot:item => { ui.onLoot(item); sound.loot(item); }, onCard:c => { ui.onCard(c); sound.loot(); },
        onLog:p => ui.onLog(p), onFx:fx => { renderer.emit(fx); const uid = fx.source || fx.uid; sound.fx(fx, engine.party.find(u => u.uid === uid) || engine.enemies.find(u => u.uid === uid)); },
        onToast:t => ui.toast(t), onWarn:t => ui.onWarn(t),
        onResult:r => ui.onResult(r), onResultClose:() => ui.onResultClose(),
        onChoice:c => ui.onChoice(c), onChoiceResolved:c => ui.onChoiceResolved(c), onStuck:p => ui.onStuck(p), onDialog:l => ui.onDialog(l),
        onStageClear:r => ui.onStageClear(r), onDefeatHunt:r => { ui.onDefeatHunt(r); sound.defeat(); },
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
        setInterval(() => KT.Neon.syncClock().catch(() => {}), 30 * 60_000);
        const gifts = () => KT.NeonMarket?.claimGifts(engine).then(list => list.forEach(g => {
          const t = g.kind === 'hero' && engine.template(g.payload.id);
          ui.toast(g.kind === 'keys' ? `<b>Presente:</b> +${Number(g.payload.n).toLocaleString('pt-BR')} Chaves de Convocação!` : `<b>Presente:</b> ${t ? t.name : 'um herói'} (${KT.Data.heroRarities.find(r => r.id === g.payload.rarity)?.label || ''}) entrou na coleção!`, 'gold');
          ui.callbacks.summon?.(g.kind === 'hero' ? g.payload.rarity : 'epic'); ui.renderResources();
        })).catch(() => {});
        // Presentes: na abertura, a cada 30 min e ao voltar para a aba (no máximo uma consulta a cada 5 min).
        let giftAt = 0; const giftCheck = () => { if (Date.now() - giftAt < 5 * 60_000) return; giftAt = Date.now(); gifts(); };
        setTimeout(giftCheck, 2500); setInterval(giftCheck, 30 * 60_000); addEventListener('visibilitychange', () => { if (!document.hidden) giftCheck(); });
        if (KT.Neon.conflict) KT.Neon.onConflict();
        addEventListener('visibilitychange', () => { if (document.hidden && Date.now() - KT.Neon.lastHide > 15000) { KT.Neon.lastHide = Date.now(); engine.save(); KT.Neon.flush(); } });
        addEventListener('pagehide', () => { engine.save(); KT.Neon.flush(); });
        // Assume o save logo na abertura: outro aparelho aberto antes deixa de gravar.
        setTimeout(() => { engine.save(); KT.Neon.flush(); }, 1500);
      }
      // Versão nova publicada: salva e recarrega sozinho (fora de luta), para ninguém ficar preso na versão antiga.
      if (location.protocol !== 'file:') {
        let reloading = false, versionAt = 0;
        const checkVersion = async () => {
          if (reloading || Date.now() - versionAt < 5 * 60_000) return;
          versionAt = Date.now();
          try {
            const r = await fetch(`version.json?t=${Date.now()}`, { cache:'no-store' }); if (!r.ok) return;
            const v = (await r.json()).v; if (!v || v === KT.VERSION) return;
            reloading = true; ui.toast('<b>Nova versão do jogo!</b> Salvando e atualizando…', 'gold');
            const go = async () => { if (engine.phase === 'fight' && engine.zone?.kind !== 'village') { setTimeout(go, 5000); return; } engine.save(); try { await KT.Neon?.flush?.(); if (KT.Server?.enabled) await KT.Server.flush(); } catch (_) {} location.reload(); };
            setTimeout(go, 3000);
          } catch (_) {}
        };
        setTimeout(checkVersion, 20_000); setInterval(checkVersion, 10 * 60_000); addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });
      }
      if (session.mode === 'cloud') { KT.Server.attach(engine, ui, session.revision); ui.loadMarket(true); setInterval(() => KT.Net.syncClock(), 10 * 60_000); setInterval(() => { if (!engine.seg && !engine.segWaiting && KT.Server.status !== 'saving') KT.Server.flush(); }, 5 * 60_000); }

      assets.onProgress = (done, total) => { fill.style.width = `${Math.round(done / total * 100)}%`; label.textContent = `Preparando a jornada… ${done}/${total}`; };
      let booted = false;
      const ready = () => {
        if (booted) return; booted = true;
        ui.renderAll(); renderer.render();
        document.body.classList.remove('booting');
        bootEl.classList.add('done'); setTimeout(() => bootEl.remove(), 700);
        if (session.mode === 'offline') ui.toast(location.protocol === 'file:' ? '<b>Modo offline</b>: progresso salvo só neste navegador. Rode o servidor para contas e saves na nuvem.' : 'Servidor indisponível: jogando no <b>modo offline</b>.');
        if (session.mode === 'cloud' && session.user) ui.toast(`Bem-vindo, <b>${session.user.username}</b>! Seu progresso fica protegido no servidor.`, 'gold');
        if (session.mode === 'neon' && session.user) ui.toast(`Bem-vindo, <b>${session.user.username}</b>! Seu progresso fica salvo na sua conta.`, 'gold');
        if (!state.story.seen.intro) { ui.cmd('markSeen', 'intro'); ui.onDialog(KT.Data.story.intro); }
        if (offline) ui.showOffline(offline);
      };
      // Só abre quando os sprites e a cidade (arte, moradores e a equipe andando) já estão na memória: nada de palco
      // preto nem de personagens aparecendo aos poucos. Se a rede estiver lenta demais, abre assim mesmo em 12 s.
      Promise.all([assets.loadAll(), renderer.townPreload()]).then(ready);
      setTimeout(ready, 12000);

      const savedZone = state.zone && KT.Data.zones[state.zone] ? state.zone : 'village';
      const reenter = KT.Data.zones[savedZone].kind === 'hunt' ? savedZone : savedZone === 'village' ? 'village' : state.lastHunt;
      if (!engine.enterZone(reenter)) engine.enterZone('village');
      sound.setScene(engine.zone);
      ui.renderAll();

      let last = performance.now(), uiClock = 0, slowClock = 0, saveClock = 0, faults = 0;
      // Ritmo de desenho: 60 quadros por segundo no máximo (monitores de 120/144 Hz não dobram o gasto); 30 no AFK e no
      // modo econômico; 15 com um painel aberto por cima do palco (ele fica escondido). A luta em si não muda: o motor
      // recebe sempre o tempo real que passou.
      const interval = () => !ui.el.modal.hidden ? 1000 / 15 : state.settings.afk || KT.saver() ? 1000 / 30 : 1000 / 60;
      function frame(now) {
        requestAnimationFrame(frame);
        const gap = now - last, want = interval();
        if (gap < want - 1) return;
        last = gap > 250 ? now : now - (gap % want);
        const dt = Math.min(.1, gap / 1000 || 0);
        // Um erro num quadro nunca derruba o jogo: registra, segue no próximo e, se insistir, oferece recarregar.
        try {
          if (renderer.hitstop <= 0 && !(renderer.freeze > 0)) engine.update(dt);
          renderer.update(dt); renderer.render();
          uiClock += dt; slowClock += dt; saveClock += dt;
          if (uiClock > .08) { uiClock = 0; ui.renderParty(); ui.renderBoss(); }
          if (slowClock > .5) { slowClock = 0; ui.renderResources(); ui.renderZone(); ui.renderControls(); ui.renderSide(); ui.renderChoiceTimer(); }
          if (saveClock > 5) { saveClock = 0; engine.save(); }
          faults = 0;
        } catch (err) {
          if (faults++ === 0) console.error('quadro com erro', err);
          renderer.hitstop = 0; renderer.freeze = 0;
          if (faults === 120) askBox('O jogo encontrou um problema', 'Algo falhou repetidas vezes ao desenhar a tela. Seu progresso está salvo. Recarregar costuma resolver.', [{ id:'reload', label:'Recarregar', primary:true }, { id:'keep', label:'Continuar assim' }]).then(id => { if (id === 'reload') location.reload(); });
        }
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
        try { catchUp(false); if (++bgSave >= 10) { bgSave = 0; engine.save(); } } catch (err) { console.error('recuperação em segundo plano', err); }
      }, 1000);
      addEventListener('beforeunload', () => engine.save());
      let modeAway = null;
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          bgLast = performance.now(); caught = { secs:0, loot:0, cards:0, gold:state.player.gold };
          // Ninguém olhando: as falas vão para o registro e a equipe luta sozinha (o comando escolhido volta com a aba).
          ui.dropDialog?.();
          if (engine.mode !== 'auto' && !KT.dev?.awake) { modeAway = engine.mode; engine.input('mode', 'auto'); if (engine.awaiting !== null) engine.input('act', 'attack'); }
          engine.save();
        } else {
          if (modeAway) { engine.input('mode', modeAway); modeAway = null; ui.renderControls?.(); }
          catchUp(true);
        }
        last = performance.now();
      });
      state.settings.sound = KT.Utils.safeStorage.get('mythverse-sound') !== 'off';
      document.querySelector('#sound-btn').classList.toggle('on', state.settings.sound);
      if (state.settings.sound) {
        const activate = e => {
          if (e.target?.closest?.('#sound-btn')) return;
          document.removeEventListener('pointerdown', activate); document.removeEventListener('keydown', activate);
          if (state.settings.sound) sound.enable(true).then(() => document.querySelector('#sound-btn').classList.toggle('on', state.settings.sound)).catch(() => {});
        };
        document.addEventListener('pointerdown', activate); document.addEventListener('keydown', activate);
        if (navigator.userActivation?.hasBeenActive) activate({});
      }
      // Atmosfera 3D do palco (three.js sob demanda; some sozinha sem WebGL ou com "reduzir movimento").
      KT.__zone = () => engine.zone; KT.__view = () => renderer.view; KT.Atmos?.mount(document.querySelector('#viewport'));
      // Mapa 3D desligado: o mapa do mundo é plano.
      globalThis.__KIZUNA__ = { state, engine, renderer, ui, assets, sound };
    } catch (err) {
      console.error(err);
      document.body.innerHTML = `<pre style="white-space:pre-wrap;background:#170d10;color:#ffe7e4;padding:24px;min-height:100vh;margin:0">Falha ao iniciar Mythverse\n\n${String(err?.stack || err).replace(/</g, '&lt;')}</pre>`;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
})();
