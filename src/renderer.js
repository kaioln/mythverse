(() => {
  const KT = globalThis.KT = globalThis.KT || {};
  const U = KT.Utils, D = KT.Data;
  const W = 1280, H = 720;
  const VIEW_L = { x:0, w:W }, VIEW_P = { x:180, w:920 };
  const DISPLAY_FONT = '"Shippori Mincho B1", "Shippori Mincho", serif'; // mesma serifa da marca (faixas, ultimates, Elo)
  const DISPLAY_FONT_W = DISPLAY_FONT;
  const UI_FONT = 'Outfit, "Segoe UI", system-ui, sans-serif';

  // Vagas 1 e 2 = linha de frente (mais perto dos inimigos); 3 e 4 = retaguarda.
  // Formação em zigue-zague: cada herói numa coluna própria (linha de trás mais alta), sem um cobrir o outro.
  const HERO_POS = [{x:545,y:598},{x:435,y:690},{x:325,y:590},{x:205,y:684}];
  const ENEMY_POS = [{x:755,y:598},{x:865,y:690},{x:975,y:590},{x:1090,y:684},{x:1190,y:588}];
  const BOSS_POS = {x:1000,y:672};
  const BOSS_ADDS = [{x:760,y:598},{x:790,y:694},{x:1200,y:596},{x:1195,y:694}];
  // Na cidade os heróis ficam na escala das construções, em volta do medalhão da praça (linha de frente adiante).
  // Na praça: a equipe em arco na frente do medalhão central, grande o bastante para ver cada herói (placas longe dela).
  const VILLAGE_POS = [{x:488,y:462},{x:562,y:478},{x:636,y:478},{x:710,y:462}], VILLAGE_H = 100;
  const HERO_H = 206, HERO_H0 = HERO_H, ENEMY_H = 184, ELITE_H = 232;
  const RANGED = new Set(['Arcanista','Suporte','Atirador']);
  // Projéteis: forma por classe/elemento; duração, arco e rastro dão o peso (pedra pesada e lenta, raio quase instantâneo).
  const ELEM_PROJ = { Fogo:'fire', Gelo:'shard', Raio:'bolt', Vento:'wind', Água:'water', Natureza:'thorn', Terra:'rock', Luz:'light', Sombra:'void' };
  const PROJ = {
    arrow:{ dur:.18, arc:18, delay:.03, trail:3, scale:1.2, trailFx:null, additive:false },
    fire:{ dur:.30, arc:40, delay:.06, trail:10, scale:1.0, trailFx:'ember', additive:true },
    shard:{ dur:.20, arc:14, delay:.04, trail:4, scale:1.05, trailFx:'frost', additive:false },
    bolt:{ dur:.10, arc:6, delay:.05, trail:0, scale:1, trailFx:null, additive:true },
    wind:{ dur:.26, arc:10, delay:.04, trail:6, scale:1.1, trailFx:null, additive:true, spin:22 },
    water:{ dur:.28, arc:36, delay:.05, trail:9, scale:1.0, trailFx:'drop', additive:false },
    thorn:{ dur:.22, arc:20, delay:.04, trail:4, scale:1.0, trailFx:null, additive:false },
    rock:{ dur:.34, arc:74, delay:.08, trail:5, scale:1.15, trailFx:'dust', additive:false, spin:14 },
    light:{ dur:.15, arc:4, delay:.05, trail:6, scale:1.1, trailFx:null, additive:true },
    void:{ dur:.30, arc:26, delay:.07, trail:8, scale:1.0, trailFx:'wisp', additive:false },
    orb:{ dur:.24, arc:30, delay:.04, trail:8, scale:1.0, trailFx:null, additive:true },
    // Projéteis próprios de heróis (HERO_PROJ).
    sun:{ dur:.28, arc:28, delay:.06, trail:8, scale:1.1, additive:true, spin:6 }, talisman:{ dur:.22, arc:18, delay:.04, trail:3, scale:1, additive:false, spin:10 },
    page:{ dur:.26, arc:30, delay:.04, trail:2, scale:.9, additive:false, spin:8 }, feather:{ dur:.24, arc:22, delay:.04, trail:4, scale:1, additive:false },
    lantern:{ dur:.32, arc:36, delay:.06, trail:6, scale:.95, additive:false }, rune:{ dur:.26, arc:24, delay:.05, trail:5, scale:1, additive:true, spin:5 },
    clock:{ dur:.30, arc:20, delay:.06, trail:5, scale:1, additive:false, spin:-4 }, snow:{ dur:.26, arc:26, delay:.04, trail:4, scale:.9, additive:false, spin:9 },
    vial:{ dur:.36, arc:80, delay:.06, trail:3, scale:.9, additive:false, spin:14 }, bell:{ dur:.28, arc:30, delay:.05, trail:4, scale:.9, additive:false, spin:6 },
    moon:{ dur:.28, arc:22, delay:.05, trail:6, scale:1, additive:true, spin:7 }, leaf:{ dur:.28, arc:34, delay:.04, trail:4, scale:.9, additive:false, spin:10 },
    mist:{ dur:.34, arc:20, delay:.05, trail:10, scale:1.1, additive:false }, steam:{ dur:.26, arc:12, delay:.05, trail:10, scale:1.1, additive:false },
    bullet:{ dur:.10, arc:2, delay:.02, trail:3, scale:.9, additive:true }, pellet:{ dur:.12, arc:4, delay:.02, trail:2, scale:.7, additive:true },
    rocket:{ dur:.40, arc:60, delay:.06, trail:12, scale:1.05, additive:false }, rail:{ dur:.08, arc:0, delay:.08, trail:10, scale:1.2, additive:true },
    laser:{ dur:.12, arc:0, delay:.05, trail:8, scale:1.1, additive:true }
  };
  // Cada herói de longo alcance tem o próprio disparo: tipo, quantidade (n), abertura e cor. Formas da temporada usam o do herói base.
  const HERO_PROJ = {
    solen:{ kind:'sun', color:'#ffcf6b' }, ren:{ kind:'talisman', color:'#ffe066' }, sora:{ kind:'page', color:'#fff6de', n:2 }, ignis:{ kind:'fire', color:'#ff5a3a', n:2 },
    ryo:{ kind:'fire', color:'#ff8a2a', n:3, spread:14, scale:.7 }, drake:{ kind:'fire', color:'#ff6a1a', scale:1.45 }, sael:{ kind:'feather', color:'#7a5cff', n:3, spread:12 },
    kira:{ kind:'lantern', color:'#ffb347' }, garrick:{ kind:'rune', color:'#ff9a3c' }, selene:{ kind:'clock', color:'#c07dff' }, kori:{ kind:'shard', color:'#9fe6ff', n:2 },
    yuki:{ kind:'snow', color:'#dff6ff' }, alden:{ kind:'vial', color:'#6fe39a' }, elian:{ kind:'bell', color:'#ffd76a' }, aiko:{ kind:'moon', color:'#d9c8ff' },
    rina:{ kind:'wind', color:'#ffcf6b' }, bjorn:{ kind:'leaf', color:'#8fdc6a' }, aurelia:{ kind:'leaf', color:'#fff1b8' }, dana:{ kind:'mist', color:'#8fe0a4' },
    volt:{ kind:'steam', color:'#ffb08a' }, nadia:{ kind:'arrow', color:'#d8ad6a' }, tessa:{ kind:'arrow', color:'#8fdc6a', n:3, spread:10 }, rook:{ kind:'rail', color:'#6fc4ff' },
    warden:{ kind:'pellet', color:'#ff7a3a', n:5, spread:16 }, zara:{ kind:'rocket', color:'#ff6fa8' }, ivy:{ kind:'bullet', color:'#ffe066', n:2, spread:6 },
    cole:{ kind:'bullet', color:'#ff9a3c' }, wade:{ kind:'bullet', color:'#e0c393' }, n9:{ kind:'laser', color:'#b58cff' }, rex:{ kind:'bullet', color:'#ff4a5a', n:2, spread:8 }
  };

  const THEMES = {
    village:{ grade:'rgba(255,170,120,.08)', ambient:'petal' }, forest:{ grade:'rgba(255,120,160,.10)', ambient:'petal' },
    coast:{ grade:'rgba(80,190,255,.12)', ambient:'bubble' }, dungeon:{ grade:'rgba(120,90,220,.14)', ambient:'mote' },
    archive:{ grade:'rgba(40,170,210,.16)', ambient:'bubble' }, boss:{ grade:'rgba(255,90,90,.12)', ambient:'ember' }, abyss:{ grade:'rgba(20,120,200,.18)', ambient:'bubble' },
    swamp:{ grade:'rgba(120,200,90,.12)', ambient:'mote' }, crypt:{ grade:'rgba(60,200,150,.14)', ambient:'mote' }, frost:{ grade:'rgba(170,220,255,.14)', ambient:'petal' },
    forge:{ grade:'rgba(255,120,40,.14)', ambient:'ember' }, desert:{ grade:'rgba(255,190,90,.12)', ambient:'mote' }, ghost:{ grade:'rgba(150,140,255,.16)', ambient:'mote' },
    clock:{ grade:'rgba(200,160,255,.12)', ambient:'mote' }, desertBoss:{ grade:'rgba(255,150,60,.16)', ambient:'ember' }, rift:{ grade:'rgba(255,60,140,.16)', ambient:'mote' },
    sky:{ grade:'rgba(170,210,255,.10)', ambient:'mote' }, sakura:{ grade:'rgba(255,150,200,.12)', ambient:'petal' }, skyShrine:{ grade:'rgba(160,150,255,.12)', ambient:'mote' }, skyBoss:{ grade:'rgba(90,200,255,.14)', ambient:'ember' }
  };
  const easeOut = t => 1 - Math.pow(1 - U.clamp(t, 0, 1), 3);
  const easeOutBack = t => { t = U.clamp(t, 0, 1); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

  class GameRenderer {
    constructor(canvas, assets, engine) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.assets = assets; this.engine = engine;
      this.particles = []; this.ambient = []; this.loot = []; this.projectiles = []; this.delayed = [];
      this.vis = new Map(); this.flashCache = new Map(); this.glowCache = new Map(); this.portraits = new Map();
      this.worldTime = 0; this.shake = 0; this.hitstop = 0; this.screenFlash = null; this.banner = null; this.cutin = null;
      this.zoneId = null; this.zoneFade = 1; this.scale = 1; this.hotspots = []; this.hoverEnemy = null; this.lastCaster = null;
      this.cam = { z:1, tz:1, x:W / 2, y:H * .62, tx:W / 2, ty:H * .62, hold:0 }; this.freeze = 0;
      this.resize();
      if (globalThis.ResizeObserver) new ResizeObserver(() => this.resize()).observe(canvas);
      addEventListener('resize', () => this.resize());
    }
    resize() {
      const rect = this.canvas.getBoundingClientRect(); if (!rect.width) return;
      const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
      // Celular em pé: janela mais estreita da cena (VIEW_P), então o palco fica mais alto e os personagens ~40% maiores.
      const portrait = globalThis.innerWidth <= 700 && globalThis.innerHeight > globalThis.innerWidth * 1.2;
      document.body?.classList.toggle('stage-portrait', portrait);
      this.view = portrait ? VIEW_P : VIEW_L;
      const w = Math.round(rect.width * dpr), h = Math.round(rect.width * dpr * H / this.view.w);
      if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
      this.scale = w / this.view.w;
      this.css = rect.width / this.view.w;   // px de tela por unidade da cena (texto e balões da cidade se ajustam a isto)
    }
    toLogical(cx, cy) {
      const r = this.canvas.getBoundingClientRect(), v = this.view || VIEW_L, cm = this.cam;
      let x = v.x + (cx - r.left) / r.width * v.w, y = (cy - r.top) / r.height * H;
      if (cm && cm.z !== 1 && this.engine.zone.kind !== 'village') { x = cm.x + (x - cm.x) / cm.z; y = cm.y + (y - cm.y) / cm.z; }
      return { x, y };
    }
    // Desafio de tempo do Aparo: 1 = guarda no anel dourado, 0 = fora dele, null = não há golpe em andamento.
    qteQuality() {
      const q = this.qte; if (!q || q.result !== null || q.t > q.dur) return null;
      const k = q.t / q.dur; q.result = k >= .56 && k <= .96 ? 1 : 0; q.early = k < .56;
      return q.result;
    }
    // Câmera de luta: aproxima de leve do que importa (ultimate, quebra, aparo) e volta sozinha.
    punch(z, x, y, hold = .5) { const cm = this.cam; if (cm.hold > 0 && z < cm.tz) return; cm.tz = z; cm.tx = U.clamp(x, 360, 920); cm.ty = U.clamp(y, 330, 560); cm.hold = hold; }
    // No enquadramento em pé a formação se aproxima do centro para caber na janela.
    squeeze(p) { return this.view?.x ? { ...p, x:640 + (p.x - 640) * .8 } : p; }

    // ---------- atores ----------
    v(uid) { let s = this.vis.get(uid); if (!s) { s = { lunge:null, hit:0, hitDir:1, flash:0, dispHp:null, chip:null, death:0, spawn:0, cast:0, castColor:'#fff', level:0, shieldHit:0, revive:0, clip:null, clipAt:0, combo:0, guardHit:0 }; this.vis.set(uid, s); } return s; }
    unit(uid) { return this.engine.party.find(u => u.uid === uid) || this.engine.enemies.find(u => u.uid === uid); }
    heroPos(u) { return this.squeeze(HERO_POS[u.slot] || HERO_POS[0]); }
    enemyPos(u) {
      const list = this.engine.enemies, i = list.indexOf(u);
      const boss = list.find(e => e.boss);
      if (u.boss) return this.squeeze(BOSS_POS);
      if (boss) { const adds = list.filter(e => !e.boss); return this.squeeze(BOSS_ADDS[adds.indexOf(u) % BOSS_ADDS.length]); }
      return this.squeeze(ENEMY_POS[i] || ENEMY_POS[i % ENEMY_POS.length]);
    }
    enemyHeight(e) { return e.boss ? (e.sprite === 'lantern_kitsune' ? 370 : 430) : e.miniboss ? 280 : e.elite ? ELITE_H : e.treasure ? 120 : ENEMY_H; }
    posOf(uid) {
      const u = this.unit(uid); if (!u) return null;
      if (u.side === 'hero') return { ...this.heroPos(u), h:HERO_H, u };
      return { ...this.enemyPos(u), h:this.enemyHeight(u), u };
    }

    // ---------- eventos ----------
    // Efeitos de combate: "suave" (padrão) = sem tremor de tela, pausa de impacto mínima, flashes fracos, números
    // compactos e brilho reduzido. "intenso" (Perfil → Configurações) volta ao estilo antigo.
    get intense() { if (this._fxAt !== this.worldTime) { this._fxAt = this.worldTime; try { this._intense = KT.Utils.safeStorage.get('mythverse-fx') === 'intense'; } catch { this._intense = false; } } return this._intense; }
    emit(fx) {
      if (!fx) return;
      const t = fx.type;
      if (t === 'hitstop') { if (this.intense) this.hitstop = Math.max(this.hitstop, fx.time || .05); return; }
      if (t === 'attack') {
        const a = this.posOf(fx.source), b = this.posOf(fx.target); if (!a || !b) return;
        const ranged = RANGED.has(fx.role), sv = this.v(fx.source);
        this.playClip(fx.source, ['attack1', 'attack2', 'attack3'][sv.combo++ % 3]);
        if (ranged) { sv.lunge = { t:0, dur:.34, dx:16, dy:-6, hop:true }; this.launch(a, b, a.u); return; }
        // Corpo a corpo: o herói cruza o campo até o alvo, golpeia e volta num salto (nada de bater de longe).
        const reach = b.h * .3 + 54;
        sv.lunge = { t:0, dur:.5, dx:(b.x - a.x) - reach, dy:(b.y - a.y) * .9, dash:true };
        for (let i = 0; i < 5; i++) this.particles.push({ kind:'spark', x:a.x - 10 + U.rand(-14, 14), y:a.y - 2, vx:-U.rand(40, 150), vy:-U.rand(10, 70), color:'#d8c7a8', life:U.rand(.2, .4), max:.4, size:U.rand(2, 3.5) });
        this.later(.12, () => { this.particles.push({ kind:'slash', x:b.x, y:b.y - b.h * .5, color:fx.color || '#fff', life:.26, max:.26, rot:U.rand(-.6, .6), size:1 }); });
        return;
      }
      if (t === 'enemyAttack') {
        const a = this.posOf(fx.source), b = this.posOf(fx.target); if (!a || !b) return;
        const sv = this.v(fx.source); this.playClip(fx.source, ['attack1', 'attack2'][sv.combo++ % 2]);
        // Espíritos de fogo atiram de longe; os outros avançam sobre o alvo (chefes só inclinam o corpo, são grandes demais).
        if (this.enemyFamily(a.u.sprite) === 'wisp') { sv.lunge = { t:0, dur:.34, dx:-14, dy:-6, hop:true }; this.launch(a, b, a.u); return; }
        const k = a.u.boss ? .22 : a.u.miniboss ? .4 : .62, dist = (b.x - a.x) + (b.h * .3 + 50);
        sv.lunge = { t:0, dur:a.u.boss ? .42 : .46, dx:Math.max(-430, dist * k), dy:(b.y - a.y) * k, dash:!a.u.boss };
        this.later(.12, () => { this.particles.push({ kind:'slash', x:b.x, y:b.y - b.h * .5, color:D.elements[a.u.el]?.color || '#ffb0b8', life:.22, max:.22, rot:Math.PI + U.rand(-.6, .6), size:.85 }); });
        return;
      }
      if (t === 'damage') {
        const p = this.posOf(fx.uid); if (!p) return;
        const hero = fx.side === 'hero', dot = fx.kind === 'dot';
        const delay = fx.kind === 'basic' ? .12 : 0;
        this.later(delay, () => {
          if (!dot) this.hitActor(fx.uid, hero ? -1 : 1, fx.crit ? .9 : .55);
          // Herói reage a cada golpe (menos com a guarda erguida); monstro comum, no máximo a cada 0,3 s; chefe só a críticos
          // e golpes fortes, a cada 2,5 s (senão fica preso na pose de dano).
          const tu = this.unit(fx.uid), bu = !hero && tu?.boss && tu;
          if (!dot && tu) {
            const vs = this.v(fx.uid), cs = vs.clip, big = fx.crit || fx.kind === 'ult' || (bu && fx.value > bu.maxHp * .03);
            const free = !cs || cs === 'idle' || cs === 'run' || cs === 'hit', gap = this.worldTime - (vs.hitAt || -9);
            const guarding = hero && this.engine.guardT > 0;
            if (free && !guarding && (hero ? true : bu ? big && gap > 2.5 : gap > .3)) { vs.hitAt = this.worldTime; this.playClip(fx.uid, 'hit'); }
          }
          const color = fx.color || (hero ? '#ff6b6b' : fx.crit ? '#ffd76a' : '#ffffff');
          this.number(p.x + U.rand(-26, 26), p.y - p.h - 8, fx.value, color, fx.crit, hero, dot);
          if (fx.weak && !dot) this.text(p.x + 40, p.y - p.h + 14, 'FRACO!', '#ffe28a', 15, .8);
          if (fx.resist && !dot) this.text(p.x + 40, p.y - p.h + 14, 'RESISTE', '#aab4c8', 14, .8);
          if (!dot) this.sparks(p.x, p.y - p.h * .5, (fx.crit ? 12 : 5) * (this.intense ? 1 : .5), fx.crit ? '#ffe28a' : hero ? '#ff8a8a' : fx.color || '#ffe9c9', fx.crit ? 320 : 200);
          if (!dot && (fx.crit || fx.kind !== 'basic')) this.impact(p.x + U.rand(-12, 12), p.y - p.h * .5 + U.rand(-10, 10), fx.crit ? '#ffcf6b' : fx.color || '#ffe9c9', fx.crit ? 1.15 : .8);
          if (fx.crit) this.shake = Math.max(this.shake, 6);
        });
        return;
      }
      if (t === 'text') { const p = this.posOf(fx.uid); if (p) this.later(.1, () => this.text(p.x, p.y - p.h - 6, fx.text, fx.color || '#fff', 20)); return; }
      if (t === 'heal') {
        const p = this.posOf(fx.uid); if (!p) return;
        if (fx.value > 0) this.number(p.x, p.y - p.h - 10, `+${U.fmt(fx.value)}`, '#7dffa8', false);
        this.ring(p.x, p.y, '#7dffa8', 60);
        for (let i = 0; i < 10; i++) this.particles.push({ kind:'rise', x:p.x + U.rand(-40, 40), y:p.y - U.rand(0, 40), vy:-U.rand(60, 140), color:'#7dffa8', life:U.rand(.6, 1.1), max:1.1, size:U.rand(2, 4) });
        return;
      }
      if (t === 'shield') { const p = this.posOf(fx.uid); if (p) { this.ring(p.x, p.y, '#8fe9ff', 70); this.text(p.x, p.y - p.h - 22, 'ESCUDO', '#8fe9ff', 15, .8); } return; }
      if (t === 'shieldHit') { this.v(fx.uid).shieldHit = .3; return; }
      if (t === 'revive') { const p = this.posOf(fx.uid); this.v(fx.uid).revive = 1.2; if (p) { this.text(p.x, p.y - p.h - 30, 'REVIVIDO!', '#ffe19a', 24, 1.4); this.ring(p.x, p.y, '#ffe19a', 140, true); } return; }
      if (t === 'cast') {
        const p = this.posOf(fx.source); if (!p) return;
        const s = this.v(fx.source); s.cast = fx.ult ? 1 : .6; s.castColor = fx.color; this.lastCaster = fx.source;
        this.playClip(fx.source, fx.ult ? 'ult' : 'cast');
        this.ring(p.x, p.y, fx.color, fx.ult ? 150 : 90);
        this.text(p.x, p.y - p.h - 34, fx.name, fx.enemy ? '#ffb0b8' : fx.color, fx.ult ? 22 : 18, 1.1);
        if (fx.ult) { const u = this.unit(fx.source); this.cutin = { t:0, dur:fx.manual ? 1.1 : .8, unit:u, color:fx.color, name:fx.name, manual:fx.manual }; this.screenFlash = { color:fx.color, t:.2, max:.2 }; this.punch(fx.manual ? 1.06 : 1.035, (p.x + 860) / 2, p.y - 60, fx.manual ? .7 : .45); }
        // Habilidade comandada pelo jogador: selo de comando e um segundo anel (rende +15%).
        else if (fx.manual) { this.later(.06, () => this.ring(p.x, p.y, '#fff3c4', 120)); this.sparks(p.x, p.y - p.h * .55, 8, '#fff3c4', 260); this.punch(1.02, (p.x + 860) / 2, p.y - 60, .3); }
        return;
      }
      if (t === 'burst' || t === 'aoe') {
        const a = fx.source && this.posOf(fx.source);
        if (t === 'aoe') { this.engine.enemies.concat(this.engine.party).forEach(u => { if (!u.alive || (a && a.u.side === u.side)) return; const q = this.posOf(u.uid); if (q) this.later(.08, () => { this.ring(q.x, q.y, fx.color, 110); this.sparks(q.x, q.y - 60, 8, fx.color, 240); }); }); this.shake = Math.max(this.shake, 6); return; }
        const p = fx.target && this.posOf(fx.target); if (!p) return;
        if (a) this.particles.push({ kind:'beam', x:a.x + (a.u.side === 'hero' ? 20 : -20), y:a.y - a.h * .55, tx:p.x, ty:p.y - p.h * .5, color:fx.color, life:.32, max:.32 });
        this.later(.06, () => { this.ring(p.x, p.y - p.h * .45, fx.color, 100, true); this.sparks(p.x, p.y - p.h * .5, 14, fx.color, 360); this.impact(p.x, p.y - p.h * .5, fx.color, 1.3); this.shake = Math.max(this.shake, 7); });
        return;
      }
      if (t === 'death') {
        const s = this.v(fx.uid), p = this.posOf(fx.uid); s.death = .0001;
        if (p) this.later(.1, () => { this.sparks(p.x, p.y - p.h * .45, fx.boss ? 60 : 20, '#ffe7b0', fx.boss ? 520 : 300); this.ring(p.x, p.y, '#ffffff', fx.boss ? 260 : 110); });
        if (fx.boss) { this.shake = 18; this.screenFlash = { color:'#ffe6c4', t:.5, max:.5 }; this.hitstop = .3; }
        return;
      }
      if (t === 'heroDown') { const p = this.posOf(fx.uid); if (p) this.text(p.x, p.y - 40, 'K.O.', '#ff7a7a', 28, 1.4); return; }
      // Vez de um herói no comando MANUAL: a luta espera a ordem (o destaque é desenhado em drawHero).
      if (t === 'turn') { const p = this.posOf(fx.uid); if (p) this.ring(p.x, p.y, '#ffe9a8', 80); return; }
      // Bote de um golpe preparado: o inimigo avança devagar e abre a janela do Aparo (desafio de tempo na tela).
      if (t === 'strike') {
        const p = this.posOf(fx.uid), B = KT.State.BEAT;
        this.qte = { uid:fx.uid, t:0, dur:B.strike, name:fx.name || '', result:null };
        if (p) { this.playClip(fx.uid, 'attack1'); this.v(fx.uid).lunge = { t:0, dur:B.strike + .3, dx:p.u.boss ? -70 : -160, dy:0, slow:true }; }
        this.punch(1.04, 520, 540, B.strike);
        return;
      }
      if (t === 'defend') { const p = this.posOf(fx.uid); if (p) { this.ring(p.x + 20, p.y, '#ffe9a8', 64); this.text(p.x, p.y - p.h - 30, 'DEFESA', '#ffe9a8', 16, .9); } return; }
      // Guarda da equipe: todos erguem a defesa; cada golpe aparado solta faíscas no escudo.
      if (t === 'guard') { this.engine.party.forEach(u => { if (!u.alive) return; const p = this.posOf(u.uid); this.ring(p.x + 20, p.y, '#ffe9a8', 64); }); return; }
      if (t === 'guardHit') { const p = this.posOf(fx.uid); this.v(fx.uid).guardHit = .22; if (p) this.sparks(p.x + p.h * .24, p.y - p.h * .5, 6, '#ffe9a8', 260); return; }
      // Aparo: a guarda subiu no instante do golpe preparado. Pausa curta, clarão, onda de volta no atacante.
      if (t === 'parry') {
        this.freeze = .16; this.screenFlash = { color:'#fff3c4', t:.32, max:.32, strong:true }; this.shake = Math.max(this.shake, 10); this.qte = null;
        this.punch(1.07, 470, 560, .55);
        this.engine.party.forEach(u => { if (!u.alive) return; const p = this.posOf(u.uid); this.v(u.uid).guardHit = .45; this.ring(p.x + 26, p.y - p.h * .5, '#ffffff', 120, true); this.sparks(p.x + p.h * .24, p.y - p.h * .5, 14, '#fff3c4', 420); });
        const q = this.posOf(fx.uid);
        if (q) this.later(.1, () => { this.hitActor(fx.uid, 1, 1); this.impact(q.x, q.y - q.h * .5, '#ffe28a', 1.5); this.ring(q.x, q.y - q.h * .45, '#ffe28a', 150, true); this.sparks(q.x, q.y - q.h * .5, 18, '#ffe9b0', 460); });
        this.showBanner('APARO!', 'golpe bloqueado no instante certo · energia e postura a favor', '#ffe28a');
        return;
      }
      if (t === 'dodge') {
        const u = this.unit(fx.uid), p = this.posOf(fx.uid); if (!u || !p) return;
        const dir = u.side === 'hero' ? -1 : 1; this.playClip(fx.uid, 'dodge');
        this.v(fx.uid).lunge = { t:0, dur:.36, dx:dir * 46, dy:0, hop:true };
        for (let i = 0; i < 4; i++) this.particles.push({ kind:'spark', x:p.x + U.rand(-10, 10), y:p.y - 2, vx:-dir * U.rand(60, 160), vy:-U.rand(10, 60), color:'#d8c7a8', life:U.rand(.2, .35), max:.35, size:U.rand(2, 3) });
        return;
      }
      if (t === 'levelUp') {
        const p = this.posOf(fx.uid); if (!p) return;
        this.v(fx.uid).level = 1.4; this.text(p.x, p.y - p.h - 44, 'LEVEL UP!', '#ffd76a', 26, 1.6);
        for (let i = 0; i < 22; i++) this.particles.push({ kind:'rise', x:p.x + U.rand(-45, 45), y:p.y - U.rand(0, 20), vy:-U.rand(120, 260), color:'#ffd76a', life:U.rand(.7, 1.3), max:1.3, size:U.rand(2, 4) });
        return;
      }
      if (t === 'bossWindup') { this.shake = Math.max(this.shake, 4); if (fx.uid) this.v(fx.uid).clip = null; return; }   // a pose de preparo vem do estado (animFrame)
      // Quebra de postura: estilhaços, anel duplo e aviso grande.
      if (t === 'break') {
        const p = this.posOf(fx.uid); if (!p) return;
        this.v(fx.uid).broken = 1; this.hitstop = Math.max(this.hitstop, .16); this.shake = Math.max(this.shake, 12); this.freeze = Math.max(this.freeze, .09);
        this.punch(1.05, p.x - 120, p.y - p.h * .4, .6);
        this.screenFlash = { color:'#fff1c9', t:.22, max:.22 };
        this.ring(p.x, p.y - p.h * .45, '#ffe28a', 150, true); this.later(.08, () => this.ring(p.x, p.y - p.h * .45, '#ffffff', 220));
        for (let i = 0; i < 26; i++) { const a = U.rand(0, Math.PI * 2), sp = U.rand(220, 520); this.particles.push({ kind:'shard', x:p.x, y:p.y - p.h * .5, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp - 120, rot:U.rand(0, 6), vr:U.rand(-12, 12), color:i % 3 ? '#ffe9b0' : fx.color || '#ffb35c', life:U.rand(.5, .9), max:.9, size:U.rand(5, 11) }); }
        this.text(p.x, p.y - p.h - 40, fx.canceled ? 'QUEBRA! ATAQUE CANCELADO' : 'QUEBRA!', '#ffe28a', fx.canceled ? 26 : 34, 1.6);
        return;
      }
      if (t === 'chain') {
        const p = this.posOf(fx.uid);
        this.chainFx = { n:fx.n, t:0, dur:1.6, color:fx.color || '#c9472d' };
        if (p) this.ring(p.x, p.y, fx.color || '#c9472d', 120 + fx.n * 30);
        return;
      }
      if (t === 'finale') {
        this.showBanner('ELO KIZUNA', 'a equipe inteira ataca junta', '#c9472d');
        this.screenFlash = { color:'#ffd1e8', t:.45, max:.45 }; this.shake = Math.max(this.shake, 20); this.punch(1.08, 700, 520, .8);
        this.engine.enemies.forEach(u => { if (!u.alive) return; const q = this.posOf(u.uid); if (q) this.later(.15, () => { this.ring(q.x, q.y - q.h * .4, '#ff7eb6', 170, true); this.sparks(q.x, q.y - q.h * .5, 24, '#ffe1f0', 480); this.impact(q.x, q.y - q.h * .5, '#ff7eb6', 1.8); }); });
        return;
      }
      if (t === 'bossBurst') {
        const p = this.posOf(fx.uid);
        if (fx.uid) this.playClip(fx.uid, 'burst');
        this.particles.push({ kind:'bosswave', x:p ? p.x - 200 : 700, y:620, color:fx.color || '#ff7a8a', life:.9, max:.9 });
        this.screenFlash = { color:fx.color || '#ff7a8a', t:.35, max:.35 }; this.shake = Math.max(this.shake, 16); this.hitstop = Math.max(this.hitstop, .12);
        return;
      }
      if (t === 'reward') { const p = this.posOf(fx.uid); if (p && fx.gold) this.later(.3, () => this.text(p.x, p.y - 20, `+${U.fmt(fx.gold)} ouro`, '#ffe08a', 15, .9)); return; }
      if (t === 'loot') {
        const src = fx.item.fromUid && this.posOf(fx.item.fromUid);
        const x = src ? src.x : U.rand(820, 1060), y = src ? src.y : U.rand(560, 660);
        this.loot.push({ item:fx.item, x, y:y - 40, vx:U.rand(-90, 90), vy:-U.rand(260, 380), gy:y + U.rand(-6, 20), t:0, fly:0, sx:0, sy:0 });
      }
    }
    later(d, fn) { if (d <= 0) fn(); else this.delayed.push({ t:d, fn }); }
    hitActor(uid, dir, str) { const s = this.v(uid); s.hit = .22 * str + .08; s.hitDir = dir; s.flash = .16 + .08 * str; }
    number(x, y, value, color, crit = false, hurt = false, dot = false) {
      const calm = !this.intense, n = typeof value === 'number' ? value : null;
      const txt = n === null ? String(value) : calm ? (n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}K` : U.fmt(n)).replace('.', ',') : U.fmt(n);
      if (calm) { const nums = this.particles.filter(p => p.kind === 'num'); if (nums.length > 12) this.particles.splice(this.particles.indexOf(nums[0]), 1); }
      const size = calm ? (crit ? 30 : dot ? 16 : hurt ? 20 : 22) : (crit ? 44 : dot ? 20 : hurt ? 26 : 30);
      this.particles.push({ kind:'num', x, y, vx:U.rand(-40, 40) * (calm ? .5 : 1), vy:crit ? -150 : dot ? -60 : -110, text:crit && !calm ? `${txt}!` : hurt ? `-${txt}` : txt, color, life:crit ? 1.05 : .85, max:crit ? 1.05 : .85, size, crit });
    }
    text(x, y, text, color, size = 20, life = 1, fixed = false) { this.particles.push({ kind:'label', x, y, text, color, size, life, max:life, fixed }); }
    // Texturas de efeito geradas uma vez por cor: brilho radial, corte em crescente e estrela de impacto.
    fxTex(kind, color) {
      this.fxCache = this.fxCache || new Map();
      color = /^#[0-9a-f]{6}$/i.test(color) ? color : /^#[0-9a-f]{3}$/i.test(color) ? '#' + color.slice(1).split('').map(ch => ch + ch).join('') : '#ffe9c9';
      const key = `${kind}|${color}`; let t = this.fxCache.get(key); if (t) return t;
      t = document.createElement('canvas'); const g = t.getContext('2d');
      if (kind === 'glow') {
        t.width = t.height = 64; const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.18, color); r.addColorStop(.55, color + '55'); r.addColorStop(1, color + '00');
        g.fillStyle = r; g.fillRect(0, 0, 64, 64);
      } else if (kind === 'slash') {
        t.width = 256; t.height = 160; g.translate(40, 80);
        const lg = g.createLinearGradient(0, -70, 0, 70); lg.addColorStop(0, color + '00'); lg.addColorStop(.35, color + 'cc'); lg.addColorStop(.5, '#ffffff'); lg.addColorStop(.65, color + 'cc'); lg.addColorStop(1, color + '00');
        g.fillStyle = lg; g.beginPath(); g.arc(0, 0, 150, -.62, .62); g.arc(-26, 0, 150, .5, -.5, true); g.closePath(); g.fill();
        g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, 150, -.5, .5); g.stroke();
      } else if (kind === 'star') {
        t.width = t.height = 128; g.translate(64, 64); g.globalCompositeOperation = 'lighter';
        const r = g.createRadialGradient(0, 0, 0, 0, 0, 40); r.addColorStop(0, 'rgba(255,255,255,.95)'); r.addColorStop(.3, color + 'aa'); r.addColorStop(1, color + '00'); g.fillStyle = r; g.beginPath(); g.arc(0, 0, 40, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ffffff'; for (let i = 0; i < 4; i++) { g.save(); g.rotate(i * Math.PI / 2); g.beginPath(); g.moveTo(0, -62); g.lineTo(5, -5); g.lineTo(0, 0); g.lineTo(-5, -5); g.closePath(); g.globalAlpha = .9; g.fill(); g.restore(); }
      }
      this.fxCache.set(key, t); return t;
    }
    // ---------- projéteis texturizados (por classe e elemento) ----------
    launch(a, b, u) {
      const tid = u.id || u.sprite, base = D.roster?.find(r => r.id === tid)?.base || tid, hp = u.side === 'hero' ? HERO_PROJ[base] : null;
      const kind = hp?.kind || (u.cls === 'Atirador' ? 'arrow' : (ELEM_PROJ[u.el] || 'orb')), P = PROJ[kind], color = hp?.color || D.elements[u.el]?.color || '#ffd76a';
      const dir = u.side === 'hero' ? 1 : -1, x = a.x + 30 * dir, y = a.y - a.h * .55, n = hp?.n || 1, spread = hp?.spread || 10;
      this.particles.push({ kind:'impact', x, y, color, life:.14, max:.14, size:.45, rot:0 });          // antecipação: brilho de carga
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * spread;
        this.projectiles.push({ kind, x, y:y + off * .5, tx:b.x, ty:b.y - b.h * .45 + off, t:-P.delay - i * .05, dur:P.dur, arc:P.arc, color, spin:U.rand(-1, 1), trail:[], seed:Math.random() * 100, scale:hp?.scale || 1 });
      }
    }
    projPos(p, k) {
      const x = p.x + (p.tx - p.x) * k, y = p.y + (p.ty - p.y) * k - Math.sin(k * Math.PI) * p.arc;
      const dx = (p.tx - p.x), dy = (p.ty - p.y) - Math.cos(k * Math.PI) * Math.PI * p.arc;
      return { x, y, a:Math.atan2(dy, dx) };
    }
    projTex(kind, color) {
      this.projCache = this.projCache || new Map();
      const key = `${kind}|${color}`; let t = this.projCache.get(key); if (t) return t;
      t = document.createElement('canvas'); const g = t.getContext('2d'); const W2 = 128, H2 = 64; t.width = W2; t.height = H2; g.translate(W2 / 2, H2 / 2);
      const glow = (r, a) => { const rg = g.createRadialGradient(0, 0, 0, 0, 0, r); rg.addColorStop(0, `rgba(255,255,255,${a})`); rg.addColorStop(.35, color); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill(); };
      if (kind === 'arrow') {
        g.strokeStyle = '#e9d9b8'; g.lineWidth = 3; g.beginPath(); g.moveTo(-44, 0); g.lineTo(26, 0); g.stroke();
        g.fillStyle = color; for (const s2 of [-1, 1]) { g.beginPath(); g.moveTo(-44, 0); g.lineTo(-54, 9 * s2); g.lineTo(-34, 0); g.fill(); }
        g.shadowColor = color; g.shadowBlur = 12; g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(40, 0); g.lineTo(22, -8); g.lineTo(26, 0); g.lineTo(22, 8); g.closePath(); g.fill();
      } else if (kind === 'fire') {
        const lg = g.createLinearGradient(-56, 0, 18, 0); lg.addColorStop(0, 'rgba(255,60,20,0)'); lg.addColorStop(.6, color); lg.addColorStop(1, '#ffe7a0');
        g.fillStyle = lg; g.beginPath(); g.moveTo(-56, 0); g.quadraticCurveTo(-10, -20, 16, -12); g.arc(10, 0, 13, -Math.PI / 2, Math.PI / 2); g.quadraticCurveTo(-10, 20, -56, 0); g.fill();
        glow(20, 1);
      } else if (kind === 'shard') {
        g.shadowColor = color; g.shadowBlur = 10;
        g.fillStyle = '#dff8ff'; g.beginPath(); g.moveTo(38, 0); g.lineTo(-6, -9); g.lineTo(-30, 0); g.closePath(); g.fill();
        g.fillStyle = color; g.beginPath(); g.moveTo(38, 0); g.lineTo(-6, 9); g.lineTo(-30, 0); g.closePath(); g.fill();
        g.strokeStyle = '#ffffff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(38, 0); g.lineTo(-30, 0); g.stroke();
      } else if (kind === 'wind') {
        g.shadowColor = color; g.shadowBlur = 10; g.fillStyle = color; g.globalAlpha = .9;
        g.beginPath(); g.arc(0, 0, 26, -1.2, 1.2); g.arc(-10, 0, 24, 1.05, -1.05, true); g.closePath(); g.fill();
        g.globalAlpha = 1; g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 26, -1, 1); g.stroke();
      } else if (kind === 'water') {
        glow(26, .9); const rg = g.createRadialGradient(-5, -6, 1, 0, 0, 14); rg.addColorStop(0, '#ffffff'); rg.addColorStop(.4, '#bfe8ff'); rg.addColorStop(1, color);
        g.fillStyle = rg; g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 18, -2.2, -1); g.stroke();
      } else if (kind === 'thorn') {
        g.shadowColor = color; g.shadowBlur = 8; g.fillStyle = color; g.beginPath(); g.moveTo(36, 0); g.quadraticCurveTo(0, -14, -30, 0); g.quadraticCurveTo(0, 14, 36, 0); g.fill();
        g.strokeStyle = '#eaffd6'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(34, 0); g.lineTo(-28, 0); g.stroke();
        for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 10, 0); g.lineTo(i * 10 - 6, -6); g.moveTo(i * 10, 0); g.lineTo(i * 10 - 6, 6); g.stroke(); }
      } else if (kind === 'rock') {
        g.shadowColor = '#ffe2b0'; g.shadowBlur = 10; g.fillStyle = '#a88a60';
        const pts = [[16, -4], [10, -14], [-4, -16], [-16, -8], [-17, 6], [-6, 16], [10, 13], [18, 4]];
        g.beginPath(); pts.forEach(([x2, y2], i) => i ? g.lineTo(x2, y2) : g.moveTo(x2, y2)); g.closePath(); g.fill();
        g.shadowBlur = 0; g.fillStyle = '#e0c393'; g.beginPath(); g.moveTo(10, -14); g.lineTo(-4, -16); g.lineTo(-10, -4); g.lineTo(4, -2); g.closePath(); g.fill();
        g.strokeStyle = '#4d3a26'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-6, 2); g.lineTo(4, 6); g.lineTo(8, 12); g.stroke();
      } else if (kind === 'light') {
        const lg = g.createLinearGradient(-60, 0, 44, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(.7, color); lg.addColorStop(1, '#ffffff');
        g.shadowColor = color; g.shadowBlur = 14; g.fillStyle = lg; g.beginPath(); g.moveTo(44, 0); g.lineTo(-60, -4); g.lineTo(-60, 4); g.closePath(); g.fill();
        glow(12, 1);
      } else if (kind === 'void') {
        glow(28, .5); g.fillStyle = '#12061f'; g.beginPath(); g.arc(0, 0, 11, 0, Math.PI * 2); g.fill();
        g.strokeStyle = color; g.lineWidth = 3; g.shadowColor = color; g.shadowBlur = 12; g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 2); g.stroke();
      } else if (kind === 'sun') {
        glow(26, 1); g.strokeStyle = '#fff3c4'; g.lineWidth = 2.5;
        for (let i = 0; i < 8; i++) { const a2 = i * Math.PI / 4; g.beginPath(); g.moveTo(Math.cos(a2) * 13, Math.sin(a2) * 13); g.lineTo(Math.cos(a2) * 22, Math.sin(a2) * 22); g.stroke(); }
        g.fillStyle = '#fff7da'; g.beginPath(); g.arc(0, 0, 10, 0, Math.PI * 2); g.fill();
      } else if (kind === 'talisman') {
        g.fillStyle = '#f1e6c8'; g.fillRect(-16, -9, 32, 18); g.strokeStyle = '#1d1822'; g.lineWidth = 1.5; g.strokeRect(-16, -9, 32, 18);
        g.strokeStyle = '#c9472d'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-8, -5); g.lineTo(2, 0); g.lineTo(-4, 1); g.lineTo(8, 6); g.stroke();
        g.shadowColor = color; g.shadowBlur = 10; g.strokeStyle = color; g.lineWidth = 1.5; g.strokeRect(-18, -11, 36, 22);
      } else if (kind === 'page') {
        g.fillStyle = '#fbf3df'; g.beginPath(); g.moveTo(-14, -12); g.lineTo(12, -10); g.lineTo(14, 12); g.lineTo(-12, 10); g.closePath(); g.fill();
        g.strokeStyle = '#8a7d66'; g.lineWidth = 1; for (let i = -6; i <= 6; i += 4) { g.beginPath(); g.moveTo(-8, i); g.lineTo(8, i + 1); g.stroke(); }
        glow(18, .35);
      } else if (kind === 'feather') {
        g.fillStyle = '#16121f'; g.beginPath(); g.moveTo(34, 0); g.quadraticCurveTo(0, -12, -30, -2); g.quadraticCurveTo(0, 10, 34, 0); g.fill();
        g.strokeStyle = color; g.lineWidth = 1.6; g.shadowColor = color; g.shadowBlur = 10; g.beginPath(); g.moveTo(34, 0); g.lineTo(-30, -1); g.stroke();
      } else if (kind === 'lantern') {
        glow(26, .8); g.fillStyle = '#ffe2b0'; g.beginPath(); g.ellipse(0, 0, 11, 14, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#c9472d'; g.lineWidth = 1.4; for (const yy of [-7, 0, 7]) { g.beginPath(); g.moveTo(-11, yy); g.lineTo(11, yy); g.stroke(); }
        g.fillStyle = '#2a1d0c'; g.fillRect(-6, -16, 12, 3); g.fillRect(-6, 13, 12, 3);
      } else if (kind === 'rune') {
        glow(24, .8); g.strokeStyle = '#fff1d6'; g.lineWidth = 2.4; g.strokeRect(-11, -11, 22, 22);
        g.beginPath(); g.moveTo(-6, -8); g.lineTo(6, 0); g.lineTo(-6, 8); g.moveTo(0, -11); g.lineTo(0, 11); g.stroke();
      } else if (kind === 'clock') {
        g.shadowColor = color; g.shadowBlur = 12; g.strokeStyle = color; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = '#f3e9ff'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -10); g.moveTo(0, 0); g.lineTo(7, 3); g.stroke();
        g.fillStyle = '#f3e9ff'; for (let i = 0; i < 12; i++) { const a2 = i * Math.PI / 6; g.fillRect(Math.cos(a2) * 11 - 1, Math.sin(a2) * 11 - 1, 2, 2); }
      } else if (kind === 'snow') {
        g.strokeStyle = '#ffffff'; g.lineWidth = 2.2; g.shadowColor = color; g.shadowBlur = 10;
        for (let i = 0; i < 6; i++) { const a2 = i * Math.PI / 3, cx = Math.cos(a2), cy = Math.sin(a2); g.beginPath(); g.moveTo(0, 0); g.lineTo(cx * 14, cy * 14); g.moveTo(cx * 8, cy * 8); g.lineTo(cx * 8 + cy * 4, cy * 8 - cx * 4); g.stroke(); }
      } else if (kind === 'vial') {
        g.fillStyle = color; g.beginPath(); g.arc(0, 4, 10, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#e9f7ee'; g.globalAlpha = .6; g.beginPath(); g.arc(-3, 1, 3, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
        g.fillStyle = '#d8d0c0'; g.fillRect(-3, -12, 6, 8); g.fillStyle = '#6b4a2a'; g.fillRect(-4, -15, 8, 4);
        g.strokeStyle = '#1d1822'; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 4, 10, 0, Math.PI * 2); g.stroke();
      } else if (kind === 'bell') {
        glow(20, .6); g.fillStyle = color; g.beginPath(); g.moveTo(-10, 8); g.quadraticCurveTo(-10, -12, 0, -12); g.quadraticCurveTo(10, -12, 10, 8); g.closePath(); g.fill();
        g.fillStyle = '#6b4a1a'; g.beginPath(); g.arc(0, 10, 3, 0, Math.PI * 2); g.fill();
      } else if (kind === 'moon') {
        glow(24, .7); g.fillStyle = '#f4ecff'; g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 2); g.arc(6, -3, 12, 0, Math.PI * 2, true); g.fill('evenodd');
      } else if (kind === 'leaf') {
        g.shadowColor = color; g.shadowBlur = 12; g.fillStyle = color; g.beginPath(); g.moveTo(18, 0); g.quadraticCurveTo(0, -12, -16, 0); g.quadraticCurveTo(0, 12, 18, 0); g.fill();
        g.strokeStyle = '#ffffff'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(16, 0); g.lineTo(-14, 0); g.stroke();
      } else if (kind === 'mist' || kind === 'steam') {
        g.fillStyle = kind === 'mist' ? color : '#efe7e0'; g.globalAlpha = .75;
        for (const [xx, yy, r] of [[-12, 2, 10], [0, -4, 12], [12, 2, 9], [4, 8, 8]]) { g.beginPath(); g.arc(xx, yy, r, 0, Math.PI * 2); g.fill(); }
        g.globalAlpha = 1;
      } else if (kind === 'bullet' || kind === 'pellet') {
        const lg = g.createLinearGradient(-40, 0, 10, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(1, color);
        g.fillStyle = lg; g.fillRect(-40, -2, 50, 4); g.fillStyle = '#fff6e0'; g.beginPath(); g.ellipse(10, 0, 6, 3, 0, 0, Math.PI * 2); g.fill();
      } else if (kind === 'rocket') {
        g.fillStyle = '#d9d0c4'; g.beginPath(); g.moveTo(22, 0); g.lineTo(10, -7); g.lineTo(-14, -7); g.lineTo(-14, 7); g.lineTo(10, 7); g.closePath(); g.fill();
        g.fillStyle = color; g.fillRect(-2, -7, 5, 14);
        g.fillStyle = '#6b6b78'; g.beginPath(); g.moveTo(-14, -7); g.lineTo(-22, -12); g.lineTo(-18, 0); g.lineTo(-22, 12); g.lineTo(-14, 7); g.fill();
        g.fillStyle = '#ffb347'; g.beginPath(); g.moveTo(-22, -4); g.lineTo(-40, 0); g.lineTo(-22, 4); g.fill();
      } else if (kind === 'rail' || kind === 'laser') {
        const lg = g.createLinearGradient(-64, 0, 64, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(.5, color); lg.addColorStop(1, '#ffffff');
        g.shadowColor = color; g.shadowBlur = 14; g.fillStyle = lg; g.fillRect(-64, kind === 'rail' ? -3 : -2, 128, kind === 'rail' ? 6 : 4);
      } else { glow(22, 1); }
      this.projCache.set(key, t); return t;
    }
    drawProj(c, p) {
      if (p.t < 0 || p.t >= p.dur) return;
      const k = p.t / p.dur, q = this.projPos(p, k), P = PROJ[p.kind];
      c.save(); c.globalCompositeOperation = 'lighter';
      // rastro afunilado
      if (p.trail.length > 1 && p.kind !== 'bolt') {
        c.lineCap = 'round'; c.strokeStyle = p.color;
        for (let i = 1; i < p.trail.length; i++) { const a0 = p.trail[i - 1], a1 = p.trail[i], f = 1 - i / p.trail.length; c.globalAlpha = f * .55; c.lineWidth = P.trail * f; c.beginPath(); c.moveTo(a0.x, a0.y); c.lineTo(a1.x, a1.y); c.stroke(); }
      }
      if (p.kind === 'bolt') {   // raio: zigue-zague estável por disparo, sem tremor aleatório por quadro
        c.globalAlpha = 1; c.strokeStyle = p.color; c.lineWidth = 6; c.shadowColor = p.color; c.shadowBlur = 22;
        const pts = [[p.x, p.y]], n = 7;
        for (let i = 1; i <= n; i++) { const kk = k * i / n, pp = this.projPos(p, kk), jx = Math.sin(p.seed * 17.13 + i * 91.7) * 16, jy = Math.sin(p.seed * 31.7 + i * 47.3) * 16; pts.push([pp.x + (i < n ? jx : 0), pp.y + (i < n ? jy : 0)]); }
        c.beginPath(); pts.forEach(([x2, y2], i) => i ? c.lineTo(x2, y2) : c.moveTo(x2, y2)); c.stroke();
        c.strokeStyle = '#ffffff'; c.lineWidth = 1.8; c.shadowBlur = 0; c.stroke();
        c.globalAlpha = .9; const gl = this.fxTex('glow', p.color); c.drawImage(gl, q.x - 22, q.y - 22, 44, 44);
      } else {
        const tex = this.projTex(p.kind, p.color), rot = P.spin ? p.t * P.spin * (p.spin < 0 ? -1 : 1) : q.a;
        const sc = P.scale * (p.scale || 1) * (1 + .08 * Math.sin(p.t * 40 + p.seed));
        const gl = this.fxTex('glow', p.color); c.globalAlpha = .55; c.drawImage(gl, q.x - 26 * sc, q.y - 26 * sc, 52 * sc, 52 * sc);
        c.globalAlpha = 1; c.globalCompositeOperation = P.additive ? 'lighter' : 'source-over';
        const stretch = 1 + Math.sin(Math.PI * k) * .16; c.translate(q.x, q.y); c.rotate(rot); c.scale(sc * stretch, sc / Math.sqrt(stretch)); c.drawImage(tex, -64, -32);
      }
      c.restore();
    }
    projImpact(p) {
      const x = p.tx, y = p.ty;
      switch (p.kind) {
        case 'fire': this.sparks(x, y, 14, '#ffb06b', 300); this.ring(x, y + 30, p.color, 70, true); this.impact(x, y, p.color, .9); break;
        case 'shard': this.sparks(x, y, 12, '#e8fbff', 340); this.impact(x, y, '#bff3ff', .8); break;
        case 'bolt': this.impact(x, y, p.color, 1.1); this.sparks(x, y, 10, '#ffffff', 420); this.shake = Math.max(this.shake, 3); break;
        case 'wind': this.particles.push({ kind:'slash', x, y, color:p.color, life:.24, max:.24, rot:U.rand(-.5, .5), size:.75 }); this.sparks(x, y, 6, p.color, 220); break;
        case 'water': for (let i = 0; i < 12; i++) { const a = U.rand(-Math.PI, 0); this.particles.push({ kind:'spark', x, y, vx:Math.cos(a) * U.rand(80, 220), vy:Math.sin(a) * U.rand(80, 220), color:'#cdeeff', life:U.rand(.3, .5), max:.5, size:U.rand(2, 3.5) }); } this.ring(x, y + 30, p.color, 60); break;
        case 'rock': for (let i = 0; i < 10; i++) { const a = U.rand(-Math.PI, 0); this.particles.push({ kind:'spark', x, y, vx:Math.cos(a) * U.rand(60, 200), vy:Math.sin(a) * U.rand(60, 200) + 40, color:'#c9a57a', life:U.rand(.35, .6), max:.6, size:U.rand(2.5, 4.5) }); } this.impact(x, y, '#ffd9a0', .8); this.shake = Math.max(this.shake, 5); this.hitstop = Math.max(this.hitstop, .03); break;
        case 'light': this.impact(x, y, '#fff6d6', 1.2); this.sparks(x, y, 8, p.color, 260); break;
        case 'void': this.ring(x, y, p.color, 60); this.impact(x, y, p.color, .7); this.sparks(x, y, 8, '#d9b8ff', 180); break;
        case 'arrow': this.sparks(x, y, 6, '#fff3d9', 200); this.impact(x, y, p.color, .55); break;
        case 'rocket': this.impact(x, y, '#ffb347', 1.3); this.ring(x, y + 20, p.color, 80, true); this.sparks(x, y, 16, '#ffd0a0', 360); this.shake = Math.max(this.shake, 4); break;
        case 'bullet': case 'pellet': this.sparks(x, y, 4, '#fff3d9', 240); this.impact(x, y, p.color, .35); break;
        case 'vial': this.ring(x, y + 20, p.color, 60, true); this.sparks(x, y, 10, '#d8ffe4', 160); break;
        case 'mist': case 'steam': this.ring(x, y, p.color, 50); this.sparks(x, y, 6, p.color, 120); break;
        case 'sun': case 'moon': case 'bell': case 'lantern': this.impact(x, y, p.color, 1); this.sparks(x, y, 8, p.color, 220); break;
        default: this.sparks(x, y, 8, p.color, 240); this.ring(x, y + 30, p.color, 50);
      }
    }
    impact(x, y, color, size = 1) { this.particles.push({ kind:'impact', x, y, color, life:.28, max:.28, size, rot:U.rand(0, Math.PI) }); }
    ring(x, y, color, radius = 80, filled = false) { this.particles.push({ kind:'ring', x, y, color, radius, life:.5, max:.5, filled }); }
    sparks(x, y, n, color, speed = 260) { for (let i = 0; i < n; i++) { const a = U.rand(0, Math.PI * 2), sp = U.rand(.35, 1) * speed; this.particles.push({ kind:'spark', x, y, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp - 60, color, life:U.rand(.25, .55), max:.55, size:U.rand(2, 4.5) }); } }
    showBanner(title, sub = '', color = '#ffd76a') { this.banner = { title, sub, color, t:0, dur:1.9 }; }

    // ---------- atualização ----------
    update(dt) {
      this.worldTime += dt; this.shake = Math.max(0, this.shake - dt * 40); this.hitstop = this.intense ? Math.max(0, this.hitstop - dt) : 0;
      this.freeze = Math.max(0, (this.freeze || 0) - dt);
      if (this.qte) { this.qte.t += dt; if (this.qte.t > this.qte.dur + .45) this.qte = null; }
      { const cm = this.cam; cm.hold = Math.max(0, cm.hold - dt); if (cm.hold <= 0) cm.tz = 1;
        cm.z += (cm.tz - cm.z) * Math.min(1, dt * (cm.tz > cm.z ? 9 : 3)); cm.x += (cm.tx - cm.x) * Math.min(1, dt * 8); cm.y += (cm.ty - cm.y) * Math.min(1, dt * 8);
        if (cm.tz === 1 && Math.abs(cm.z - 1) < .0006) cm.z = 1; }
      if (this.engine.zone.id !== this.zoneId || this.engine.party !== this.lastParty) {
        if (this.engine.zone.id !== this.zoneId) { this.zoneId = this.engine.zone.id; this.zoneFade = 0; this.particles = []; this.loot = []; this.projectiles = []; this.delayed = []; this.cam.z = this.cam.tz = 1; this.cam.hold = 0; this.freeze = 0; this.seedAmbient(); }
        this.lastParty = this.engine.party; this.vis.clear();
      }
      this.zoneFade = Math.min(1, this.zoneFade + dt * 2.2);
      this.delayed.forEach(d => d.t -= dt);
      const ready = this.delayed.filter(d => d.t <= 0); this.delayed = this.delayed.filter(d => d.t > 0); ready.forEach(d => d.fn());
      for (const s of this.vis.values()) {
        if (s.lunge) { s.lunge.t += dt; if (s.lunge.t >= s.lunge.dur) s.lunge = null; }
        s.hit = Math.max(0, s.hit - dt); s.flash = Math.max(0, s.flash - dt); s.cast = Math.max(0, s.cast - dt); s.level = Math.max(0, s.level - dt); s.shieldHit = Math.max(0, s.shieldHit - dt); s.revive = Math.max(0, s.revive - dt); s.guardHit = Math.max(0, (s.guardHit || 0) - dt);
        if (s.death > 0) s.death += dt;
        s.spawn = Math.min(1, s.spawn + dt * 2.4);
      }
      for (const p of this.particles) {
        p.life -= dt;
        if (p.kind === 'num') { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.vx *= .96; }
        else if (p.kind === 'label') { if (!p.fixed) p.y -= dt * 26; }
        else if (p.kind === 'spark') { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 520 * dt; p.vx *= .97; }
        else if (p.kind === 'shard') { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; p.vx *= .98; p.rot += p.vr * dt; }
        else if (p.kind === 'rise' || p.kind === 'wisp') { p.y += p.vy * dt; p.x += Math.sin(this.worldTime * 6 + p.y * .05) * .5; }
      }
      this.particles = this.particles.filter(p => p.life > 0);
      if (this.particles.length > 700) this.particles.splice(0, this.particles.length - 700);
      for (const pr of this.projectiles) {
        pr.t += dt;
        if (pr.t >= 0 && pr.t < pr.dur) {
          const q = this.projPos(pr, pr.t / pr.dur); pr.trail.unshift(q); if (pr.trail.length > 10) pr.trail.pop();
          const sp = PROJ[pr.kind].trailFx;
          if (sp && Math.random() < dt * 60) this.particles.push({ kind:'spark', x:q.x + U.rand(-4, 4), y:q.y + U.rand(-4, 4), vx:-Math.cos(q.a) * U.rand(20, 80) + U.rand(-30, 30), vy:-Math.sin(q.a) * U.rand(20, 80) + (sp === 'ember' ? -40 : sp === 'dust' ? 60 : 0), color:sp === 'frost' ? '#e8fbff' : sp === 'dust' ? '#c9a57a' : pr.color, life:U.rand(.15, .35), max:.35, size:U.rand(1.5, 3) });
        }
        if (pr.t >= pr.dur && !pr.done) { pr.done = true; this.projImpact(pr); }
      }
      this.projectiles = this.projectiles.filter(p => p.t < p.dur + .08);
      for (const l of this.loot) {
        l.t += dt;
        if (l.t < 1.3) { l.x += l.vx * dt; l.vy += 900 * dt; l.y += l.vy * dt; if (l.y > l.gy) { l.y = l.gy; l.vy *= -.35; l.vx *= .6; } }
        else { if (!l.fly) { l.fly = .0001; l.sx = l.x; l.sy = l.y; } l.fly += dt * 1.6; }
      }
      this.loot = this.loot.filter(l => l.fly < 1);
      for (const a of this.ambient) { a.x += a.vx * dt; a.y += a.vy * dt; a.r += a.vr * dt; if (a.y > H + 20) a.y = -20; if (a.y < -30) a.y = H + 20; if (a.x > W + 20) a.x = -20; if (a.x < -20) a.x = W + 20; }
      if (this.screenFlash) { this.screenFlash.t -= dt; if (this.screenFlash.t <= 0) this.screenFlash = null; }
      if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.dur) this.banner = null; }
      if (this.chainFx) { this.chainFx.t += dt; if (this.chainFx.t > this.chainFx.dur) this.chainFx = null; }
      for (const s of this.vis.values()) if (s.broken) s.broken = Math.max(0, s.broken - dt);
      if (this.cutin) { this.cutin.t += dt; if (this.cutin.t > this.cutin.dur) this.cutin = null; }
      const track = u => { const s = this.v(u.uid); const pct = U.clamp(u.hp / u.maxHp, 0, 1); if (s.dispHp === null) { s.dispHp = pct; s.chip = pct; } s.dispHp += (pct - s.dispHp) * Math.min(1, dt * 18); if (s.chip < s.dispHp) s.chip = s.dispHp; else s.chip = Math.max(s.dispHp, s.chip - dt * .45); };
      this.engine.party.forEach(track); this.engine.enemies.forEach(track);
      // Faíscas subindo em heróis com a ultimate pronta.
      this.engine.party.forEach(u => { if (u.alive && u.energy >= 100 && Math.random() < dt * 14) { const p = this.heroPos(u); this.particles.push({ kind:'wisp', x:p.x + U.rand(-34, 34), y:p.y - U.rand(10, 60), vy:-U.rand(50, 110), color:u.color, life:U.rand(.5, .9), max:.9, size:U.rand(2, 3.5) }); } });
    }
    seedAmbient() {
      const theme = THEMES[this.engine.zone.theme] || THEMES.village;
      this.ambient = Array.from({ length:36 }, () => { const a = theme.ambient; return { x:U.rand(0, W), y:U.rand(0, H), r:U.rand(0, 6), vx:a === 'petal' ? U.rand(18, 46) : U.rand(-8, 8), vy:a === 'petal' ? U.rand(14, 34) : a === 'bubble' ? -U.rand(12, 30) : a === 'ember' ? -U.rand(20, 50) : U.rand(-6, 6), vr:U.rand(-2, 2), s:U.rand(.6, 1.5), kind:a }; });
    }

    // ---------- desenho ----------
    render() {
      const c = this.ctx;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.canvas.width, this.canvas.height); c.setTransform(this.scale, 0, 0, this.scale, -(this.view?.x || 0) * this.scale, 0);
      c.save();
      if (this.shake > 0 && this.intense) c.translate(U.rand(-this.shake, this.shake) * .6, U.rand(-this.shake, this.shake) * .6);
      { const cm = this.cam; if (cm.z !== 1 && this.engine.zone.kind !== 'village') { c.translate(cm.x, cm.y); c.scale(cm.z, cm.z); c.translate(-cm.x, -cm.y); } }
      this.hotspots = [];
      this.drawScene(); this.drawAmbient(true); this.drawDanger(); this.drawActors(); this.drawProjectiles(); this.drawLoot(); this.drawParticles(); this.drawAmbient(false);
      c.restore();
      this.drawOverlay(); this.drawCutin(); this.drawBanner(); this.drawChain();
    }
    drawScene() {
      const c = this.ctx, z = this.engine.zone, img = this.assets.scene(z.id);
      const moving = this.engine.phase === 'between' || this.engine.phase === 'stageClear';
      // Na cidade a câmera fica parada (as ruas são o chão de quem anda nelas) e a arte aparece clara; nas lutas, leve respiro.
      const town = z.kind === 'village';
      const zoom = town ? 1 : 1.04 + Math.sin(this.worldTime * .08) * .012 + (moving ? .02 : 0);
      const dx = town ? 0 : Math.sin(this.worldTime * .05) * 10;
      // Pintura viva (src/scene-fx.js): na cidade a própria arte se move (água, copas ao vento, fumaça, nuvens). Sem ela, a pintura parada.
      const live = town && img ? KT.SceneFx?.frame('village', img, this.worldTime, this.canvas.width, this.canvas.height, this.cloudColor()) : null;
      if (img) { const sw = W * zoom, sh = H * zoom; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(live || img, (W - sw) / 2 + dx, (H - sh) / 2 - (town ? 0 : 6), sw, sh); } else { c.fillStyle = '#141833'; c.fillRect(0, 0, W, H); }
      if (town) {
        if (!this.festivalHomes) { this.festivalHomes = this.assets.image?.('assets/scenes/festival-homes.png'); if (!this.festivalHomes) { this.festivalHomes = new Image(); this.festivalHomes.src = 'assets/scenes/festival-homes.png'; } }
        // A ilha das casas do festival é uma camada à parte: sobe e desce devagar, como quem flutua.
        if (this.festivalHomes.complete && this.festivalHomes.naturalWidth) c.drawImage(this.festivalHomes, 860, 65 + Math.sin(this.worldTime * .42) * 3, 390, 260);
      }
      c.fillStyle = (THEMES[z.theme] || THEMES.village).grade; c.fillRect(0, 0, W, H);
      if (!town) { const floor = c.createLinearGradient(0, H * .55, 0, H); floor.addColorStop(0, 'rgba(8,6,20,0)'); floor.addColorStop(1, 'rgba(8,6,20,.45)'); c.fillStyle = floor; c.fillRect(0, 0, W, H); }
      const vig = c.createRadialGradient(W / 2, H * .55, H * .35, W / 2, H * .55, H * .95); vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, `rgba(6,4,18,${town ? .32 : .62})`); c.fillStyle = vig; c.fillRect(0, 0, W, H);
      if (z.kind === 'village') this.drawVillageLife();
      if (this.zoneFade < 1) { c.fillStyle = `rgba(8,6,20,${1 - easeOut(this.zoneFade)})`; c.fillRect(0, 0, W, H); }
    }
    // Cor das nuvens que passam no céu, pela hora do jogo: claras de dia, rosadas no fim da tarde, azuladas à noite.
    cloudColor() { const h = new Date(this.engine.now() + D.EVENT_TZ_OFFSET_MIN * 60000).getUTCHours(); return h >= 7 && h < 17 ? [.93, .94, 1] : (h >= 17 && h < 19) || (h >= 5 && h < 7) ? [1, .74, .66] : [.56, .6, .82]; }
    // Cidade viva. A arte é uma pintura parada; por cima dela o jogo acende o que a pintura mostra, nos lugares medidos
    // em src/town-lights.js: a chama de cada lanterna tremula, a fornalha solta labaredas e fagulhas, as chaminés fumegam,
    // a água das cachoeiras corre, o mar cintila, as estrelas piscam, lanternas sobem ao céu e o festival solta fogos.
    softSprite(key, stops) {
      this.softCache ||= new Map(); let s = this.softCache.get(key); if (s) return s;
      s = document.createElement('canvas'); s.width = s.height = 64; const g = s.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      this.softCache.set(key, s); return s;
    }
    drawVillageLife() {
      const c = this.ctx, t = this.worldTime, L = KT.TownLights || {};
      const dt = Math.min(.05, Math.max(0, t - (this.lifeT ?? t))); this.lifeT = t;
      const hour = new Date(this.engine.now() + D.EVENT_TZ_OFFSET_MIN * 60000).getUTCHours();
      const tint = hour >= 7 && hour < 17 ? 'rgba(255,226,180,.07)' : hour >= 17 && hour < 19 ? 'rgba(255,140,90,.13)' : hour >= 5 && hour < 7 ? 'rgba(255,170,200,.1)' : 'rgba(36,34,110,.1)';
      c.fillStyle = tint; c.fillRect(0, 0, W, H);
      const lamp = this.softSprite('lamp', [[0, 'rgba(255,238,196,1)'], [.22, 'rgba(255,198,112,.7)'], [.6, 'rgba(255,150,64,.18)'], [1, 'rgba(255,140,60,0)']]);
      const puff = col => this.softSprite(`puff${col}`, [[0, `rgba(${col},.9)`], [.5, `rgba(${col},.35)`], [1, `rgba(${col},0)`]]);
      const blob = (img, x, y, r, a) => { if (a <= .003 || r <= 0) return; c.globalAlpha = Math.min(1, a); c.drawImage(img, x - r, y - r, r * 2, r * 2); };
      c.save(); c.globalCompositeOperation = 'lighter';
      // Estrelas que cintilam e a lua da cúpula respirando.
      (L.stars || []).forEach(([x, y], i) => { c.globalAlpha = .18 + .7 * Math.pow(.5 + .5 * Math.sin(t * (.55 + (i % 7) * .21) + i * 1.7), 3); c.fillStyle = i % 5 ? '#dfe9ff' : '#ffe9c4'; c.fillRect(x, y, 1.3, 1.3); });
      if (L.moon) {
        const [mx, my, mr] = L.moon; blob(this.softSprite('moon', [[0, 'rgba(190,205,255,.9)'], [.5, 'rgba(120,130,255,.3)'], [1, 'rgba(90,90,255,0)']]), mx, my, mr * (1.25 + .08 * Math.sin(t * .8)), .2 + .05 * Math.sin(t * 1.3));
        for (let i = 0; i < 7; i++) { const a = t * .12 + i * .9, r = mr * (.25 + (i % 4) * .13); c.globalAlpha = .35 + .55 * Math.pow(.5 + .5 * Math.sin(t * 1.7 + i * 2.1), 2); c.fillStyle = '#eef2ff'; c.fillRect(mx + Math.cos(a) * r, my + Math.sin(a) * r * .9, 1.3, 1.3); }
      }
      // Cachoeiras: fios de água descendo e a névoa no pé da queda.
      const mist = puff('232,242,255');
      (L.falls || []).forEach(([x0, x1, y0, y1], k) => {
        const w = x1 - x0, h = y1 - y0, n = Math.round(w * .85); c.fillStyle = 'rgba(226,240,255,1)';
        for (let i = 0; i < n; i++) {
          const len = 6 + (i % 4) * 3.5, sp = 46 + (i % 5) * 11, y = y0 + ((t * sp + i * 37 + k * 11) % (h + len)) - len, top = Math.max(y0, y), bot = Math.min(y1, y + len);
          if (bot <= top) continue; c.globalAlpha = .16 + ((i * 7) % 5) * .035; c.fillRect(x0 + ((i * .6180339 + k * .37) % 1) * w, top, 1.1, bot - top);
        }
        for (let i = 0; i < 3; i++) blob(mist, x0 + w / 2 + Math.sin(t * .7 + i * 2.1 + k) * w * .45, y1 + 1 + Math.sin(t * 1.1 + i + k) * 1.5, w * (.7 + .18 * Math.sin(t * .9 + i * 1.7)), .13);
      });
      // Mar: reflexos que acendem e apagam.
      (L.sea || []).forEach(([x, y], i) => { const a = Math.pow(Math.max(0, Math.sin(t * (1 + (i % 5) * .27) + i * 2.3)), 6); if (a < .02) return; c.globalAlpha = a * .7; c.fillStyle = '#ffdca8'; c.beginPath(); c.ellipse(x, y, 2.6, .8, 0, 0, Math.PI * 2); c.fill(); });
      // Fumaça das chaminés (cinza na Forja, verde e violeta nos alambiques da Oficina).
      this.smoke ||= (L.smoke || []).map(([x, y, kind, power]) => ({ x, y, kind, power, acc:Math.random(), list:[] }));
      const SMOKE = { grey:['196,194,206', 'source-over', .34], steam:['240,240,248', 'source-over', .22], green:['150,238,160', 'lighter', .3], violet:['205,140,255', 'lighter', .32] };
      const wind = KT.SceneFx?.wind(t % 3600) ?? .8;       // o mesmo vento das copas e das nuvens
      for (const e of this.smoke) {
        e.acc += dt * 3.4 * e.power;
        while (e.acc >= 1) { e.acc -= 1; e.list.push({ x:e.x + U.rand(-1.5, 1.5), y:e.y, vx:U.rand(2, 6), vy:-U.rand(9, 15), age:0, life:U.rand(4.2, 7), r:U.rand(3, 5), ph:U.rand(0, 6) }); }
        const [col, mode, alpha] = SMOKE[e.kind] || SMOKE.grey, img = puff(col); c.globalCompositeOperation = mode;
        e.list = e.list.filter(p => { p.age += dt; if (p.age >= p.life) return false; p.x += (p.vx * (.4 + wind * 1.6) + Math.sin(p.age * 1.4 + p.ph) * 4) * dt; p.y += p.vy * dt; p.vy *= 1 - dt * .1;
          blob(img, p.x, p.y, p.r + p.age * 6.5, alpha * Math.min(1, e.power + .2) * Math.min(1, p.age * 2.5) * (1 - p.age / p.life) ** 1.3); return true; });
      }
      c.globalCompositeOperation = 'lighter';
      // Fornalha da Forja: clarão, labaredas e fagulhas.
      if (L.forge) {
        const [fx, fy] = L.forge, fl = .8 + .14 * Math.sin(t * 11) + .06 * Math.sin(t * 27);
        blob(lamp, fx, fy - 4, 30 * fl, .42 * fl);
        for (let k = 0; k < 5; k++) {
          const ph = t * (6.5 + k * 1.3) + k * 2.1, hgt = 7 + 4.5 * Math.sin(ph * 1.7) + 2 * Math.sin(ph * 3.1), x = fx + (k - 2) * 2.6 + Math.sin(ph) * 1.2;
          c.globalAlpha = .34; c.fillStyle = '#ff9a3c'; c.beginPath(); c.ellipse(x, fy - hgt / 2, 2.6, Math.max(1, hgt / 2), 0, 0, Math.PI * 2); c.fill();
          c.globalAlpha = .5; c.fillStyle = '#fff0b8'; c.beginPath(); c.ellipse(x, fy - hgt / 4, 1.2, Math.max(.5, hgt / 4), 0, 0, Math.PI * 2); c.fill();
        }
        this.forgeSparks ||= []; this.sparkAcc = (this.sparkAcc || 0) + dt * 7;
        while (this.sparkAcc >= 1) { this.sparkAcc -= 1; this.forgeSparks.push({ x:fx + U.rand(-6, 6), y:fy - 3, vx:U.rand(-7, 7), vy:-U.rand(16, 34), age:0, life:U.rand(.7, 1.5) }); }
        this.forgeSparks = this.forgeSparks.filter(p => { p.age += dt; if (p.age >= p.life) return false; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 9 * dt; c.globalAlpha = .9 * (1 - p.age / p.life); c.fillStyle = '#ffc878'; c.fillRect(p.x, p.y, 1.2, 1.2); return true; });
      }
      // Lanternas e janelas acesas: cada chama no seu ritmo (tremor rápido + respiração lenta), com o miolo da chama dançando.
      (L.lamps || []).forEach(([x, y, s], i) => {
        const seed = (i * .6180339) % 1, f = .74 + .16 * Math.sin(t * (4.2 + seed * 5) + seed * 40) + .07 * Math.sin(t * 17 + seed * 90) + .03 * Math.sin(t * 43 + seed * 13);
        blob(lamp, x, y, (5.5 + s * 4.2) * (.88 + .26 * f), .3 * f);
        c.globalAlpha = .5 * f; c.fillStyle = '#fff6d8'; c.beginPath(); c.ellipse(x + Math.sin(t * 9 + seed * 20) * .35, y - .3 - f * .5, .55 + s * .22, .9 + s * .3 + f * .35, 0, 0, Math.PI * 2); c.fill();
      });
      // Lanternas do festival soltas na praça, no mercado, no cais e na Oficina: sobem devagar e somem no céu.
      const FROM = [[560, 405], [230, 468], [1060, 612], [700, 664], [990, 500]];
      this.skyLanterns ||= Array.from({ length:11 }, (_, i) => ({ k:i % FROM.length, u:i / 11, ph:U.rand(0, 6), s:U.rand(.7, 1.15), dx:U.rand(-34, 34) }));
      for (const l of this.skyLanterns) {
        l.u += dt * .021 * (1.1 - l.s * .3); if (l.u >= 1) { l.u = 0; l.k = Math.floor(U.rand(0, FROM.length)); l.dx = U.rand(-34, 34); }
        const [ox, oy] = FROM[l.k], x = ox + l.dx + Math.sin(t * .5 + l.ph) * 9 + l.u * 26, y = oy - l.u * (oy + 30), s = l.s * (1 - l.u * .35), a = Math.min(1, l.u * 9) * Math.min(1, (1 - l.u) * 4), fl = .8 + .2 * Math.sin(t * 7 + l.ph * 3);
        blob(lamp, x, y, 13 * s, .4 * a * fl);
        c.globalCompositeOperation = 'source-over'; c.globalAlpha = .9 * a;
        c.fillStyle = l.k % 2 ? '#f6b7c6' : '#f8d49c'; this.roundRect(x - 3.2 * s, y - 4.4 * s, 6.4 * s, 8.4 * s, 2 * s); c.fill();
        c.fillStyle = 'rgba(134,69,66,.7)'; c.fillRect(x - 2.4 * s, y - 4.6 * s, 4.8 * s, .9 * s); c.fillRect(x - 2.4 * s, y + 3.4 * s, 4.8 * s, .9 * s);
        c.globalCompositeOperation = 'lighter';
      }
      // Vaga-lumes nos jardins.
      this.fireflies ||= Array.from({ length:26 }, () => ({ x:U.rand(0, W), y:U.rand(H * .32, H * .96), ph:U.rand(0, 6), sp:U.rand(.4, 1.1) }));
      for (const f of this.fireflies) {
        const x = f.x + Math.sin(t * f.sp + f.ph) * 22, y = f.y + Math.cos(t * f.sp * 1.3 + f.ph) * 10, a = Math.max(0, Math.sin(t * 2.2 * f.sp + f.ph));
        c.globalAlpha = .75 * a; c.fillStyle = '#d2ffaa'; c.beginPath(); c.arc(x, y, 1.6, 0, Math.PI * 2); c.fill();
        c.globalAlpha = .16 * a; c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2); c.fill();
      }
      // Fogos do festival: sobem do cais ou do alto do templo e estouram no céu limpo.
      this.fireworks ||= []; this.fwNext ??= t + 3;
      if (t >= this.fwNext) {
        this.fwNext = t + U.rand(5.5, 10);
        const left = U.random() < .45, x = left ? U.rand(630, 840) : U.rand(880, 1240), y = left ? U.rand(42, 150) : U.rand(18, 52), col = U.pick(['255,160,200', '255,214,130', '150,220,255', '255,130,110', '190,160,255']);
        this.fireworks.push({ x, y, col, age:-.9, from:left ? 250 : 120, parts:Array.from({ length:34 }, (_, i) => { const a = i / 34 * Math.PI * 2 + U.rand(-.08, .08), v = U.rand(30, 52); return { a, v }; }) });
      }
      this.fireworks = this.fireworks.filter(fw => {
        fw.age += dt; if (fw.age > 1.9) return false;
        if (fw.age < 0) { const u = 1 + fw.age / .9, y = fw.y + fw.from * (1 - u * (2 - u)); c.globalAlpha = .7; c.fillStyle = `rgb(${fw.col})`; c.fillRect(fw.x - .6, y, 1.2, 5); return true; }
        const k = fw.age, fade = Math.max(0, 1 - k / 1.9), drag = (1 - Math.exp(-k * 2.2)) / 2.2;
        if (k < .12) blob(lamp, fw.x, fw.y, 40, .5 * (1 - k / .12));
        c.fillStyle = `rgb(${fw.col})`;
        for (const q of fw.parts) { const d = q.v * drag * 2.1, x = fw.x + Math.cos(q.a) * d, y = fw.y + Math.sin(q.a) * d + 13 * k * k; c.globalAlpha = fade * (.55 + .45 * Math.sin(k * 30 + q.a * 9)); c.fillRect(x, y, 1.5, 1.5); c.globalAlpha = fade * .22; c.fillRect(x - Math.cos(q.a) * 2.4, y - Math.sin(q.a) * 2.4, 1.2, 1.2); }
        return true;
      });
      c.restore();
    }
    drawSakura(x,y,r,color) {
      const c=this.ctx;c.save();c.translate(x,y);c.fillStyle=color;
      for(let i=0;i<5;i++){c.rotate(Math.PI*2/5);c.beginPath();c.ellipse(0,-r,r*.55,r*.8,0,0,Math.PI*2);c.fill();}
      c.restore();
    }
    drawAmbient(back) {
      const c = this.ctx; c.save();
      for (let i = back ? 0 : 1; i < this.ambient.length; i += 2) {
        const a = this.ambient[i], s = a.s * (back ? .7 : 1.15); c.globalAlpha = back ? .45 : .75;
        if (a.kind === 'petal') { c.save(); c.translate(a.x, a.y); c.rotate(a.r); c.fillStyle = i % 3 ? '#ffc4dc' : '#ff9ec7'; c.beginPath(); c.ellipse(0, 0, 5 * s, 2.6 * s, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
        else if (a.kind === 'bubble') { c.strokeStyle = 'rgba(200,245,255,.7)'; c.lineWidth = 1.2; c.beginPath(); c.arc(a.x, a.y, 3 * s + 1, 0, Math.PI * 2); c.stroke(); }
        else if (a.kind === 'ember') { c.fillStyle = i % 2 ? '#ffb46b' : '#ff7a4f'; c.fillRect(a.x, a.y, 2.4 * s, 2.4 * s); }
        else { c.fillStyle = 'rgba(210,200,255,.8)'; c.beginPath(); c.arc(a.x, a.y, 1.6 * s, 0, Math.PI * 2); c.fill(); }
      }
      c.restore();
    }
    drawDanger() {
      const eng = this.engine, e = eng.enemies.find(x => x.alive && (x.windup > 0 || x.striking)); if (!e) return;
      const sp = e.windupSpecial, c = this.ctx, pulse = .5 + .5 * Math.sin(this.worldTime * 18);
      const p = e.striking ? 1 : U.clamp(1 - e.windup / Math.max(.001, e.windupMax || 1.5), 0, 1);
      const effs = sp?.eff || [];
      const zones = effs.some(x => x.to === 'all') ? [{ x:340, y:612, rx:310, ry:110 }] : effs.some(x => x.to === 'back') ? [{ x:265, y:628, rx:150, ry:70 }] : effs.some(x => x.to === 'front') ? [{ x:485, y:610, rx:120, ry:95 }] : [{ x:340, y:612, rx:310, ry:110 }];
      zones.forEach(zn => {
        c.save(); c.translate(zn.x, zn.y);
        c.fillStyle = `rgba(255,40,70,${.1 + .12 * p})`; c.strokeStyle = `rgba(255,90,110,${.55 + .4 * pulse})`; c.lineWidth = 4; c.setLineDash([16, 10]); c.lineDashOffset = -this.worldTime * 60;
        c.beginPath(); c.ellipse(0, 0, zn.rx, zn.ry, 0, 0, Math.PI * 2); c.fill(); c.stroke();
        c.setLineDash([]); c.fillStyle = `rgba(255,60,80,${.25 + .2 * pulse})`; c.beginPath(); c.ellipse(0, 0, Math.max(0, zn.rx * p), Math.max(0, zn.ry * p), 0, 0, Math.PI * 2); c.fill();
        c.restore();
      });
      const zn = zones[0], q = this.qte, ready = !(eng.guardCd > 0) || eng.guardT > 0;
      const label = (txt, y, size, color, alpha = 1) => { c.save(); c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${size}px ${UI_FONT}`; c.lineJoin = 'round'; c.globalAlpha = alpha; c.lineWidth = 6; c.strokeStyle = 'rgba(14,10,20,.92)'; c.strokeText(txt, zn.x, y); c.fillStyle = color; c.fillText(txt, zn.x, y); c.restore(); };
      if (eng.state.settings.afk) return;
      if (e.striking && q && q.t <= q.dur + .3) {
        // Aparo: o anel fecha sobre o alvo; a guarda dentro da faixa dourada (o fim do percurso) bloqueia o golpe.
        const k = U.clamp(q.t / q.dur, 0, 1), gold = k >= .56 && k <= .96, cx = zn.x, cy = zn.y - 150, R = 46;
        c.save(); c.translate(cx, cy);
        c.fillStyle = 'rgba(14,10,20,.55)'; c.beginPath(); c.arc(0, 0, R + 10, 0, Math.PI * 2); c.fill();
        c.lineWidth = 9; c.strokeStyle = 'rgba(255,226,138,.95)'; c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.stroke();          // alvo (faixa dourada)
        if (q.result === null) { c.lineWidth = gold ? 6 : 4; c.strokeStyle = gold ? '#ffffff' : 'rgba(255,255,255,.75)'; if (gold) { c.shadowColor = '#ffe28a'; c.shadowBlur = 16; } c.beginPath(); c.arc(0, 0, Math.max(R - 6, R + (1 - Math.min(1, k / .76)) * 104), 0, Math.PI * 2); c.stroke(); }
        c.shadowBlur = 0; if (KT.Icons?.draw) KT.Icons.draw(c, 'shield', 0, 0, 34, q.result === 1 || gold ? '#ffe28a' : '#fff1dc', 3);
        c.restore();
        const msg = q.result === 1 ? 'NO TEMPO!' : q.result === 0 ? (q.early ? 'CEDO DEMAIS' : 'TARDE') : !ready ? 'GUARDA EM RECARGA' : gold ? 'AGORA!' : 'ESPERE O ANEL…';
        label(msg, cy - R - 30, q.result === null && gold ? 30 : 22, q.result === 1 || (q.result === null && gold) ? '#ffe28a' : '#fff1dc');
        return;
      }
      if (!ready) return;
      label(eng.guardT > 0 ? 'GUARDA ERGUIDA' : 'GOLPE PREPARADO: APARE NO BOTE', 296, 20, eng.guardT > 0 ? '#ffe28a' : '#fff1dc', eng.guardT > 0 ? .9 : .7 + .2 * pulse);
    }

    drawActors() {
      const village = this.engine.zone.kind === 'village', list = [];
      if (village && KT.TownLife && this.townReady()) { this.drawTown(); return; }
      if (village && KT.TownLife && !this.townArt.failed) return;
      if (village) {
        this.engine.state.formation.forEach((uid, i) => { const r = uid && this.engine.record(uid); if (r) list.push({ r, t:this.engine.template(r.id), pos:VILLAGE_POS[i] }); });
        list.sort((a, b) => a.pos.y - b.pos.y).forEach(o => {
          const c = this.ctx, bob = Math.sin(this.worldTime * 2 + o.pos.x) * 1;
          c.save(); c.fillStyle = 'rgba(20,10,4,.42)'; c.beginPath(); c.ellipse(o.pos.x, o.pos.y + 2, 26, 7, 0, 0, Math.PI * 2); c.fill(); c.restore();
          const vm = KT.SPRITE_META?.[o.t.sprite] || [1, 0], an = this.assets.anim?.(o.t.sprite), i = list.indexOf(o);
          // Heróis animados (respiração da folha de poses) também na cidade; sem folha, o sprite parado com leve respiração.
          if (an) this.drawAnim(an, this.v(`village_${i}`), { alive:true, slot:i, side:'hero' }, o.pos.x, o.pos.y, VILLAGE_H * 1.12, {});
          else this.drawSprite(o.t.sprite, o.pos.x, o.pos.y + bob + vm[1] * VILLAGE_H * vm[0], VILLAGE_H * vm[0], { sy:1 + Math.sin(this.worldTime * 2.4 + o.pos.x) * .015 });
          const short = o.t.name.replace(/^(Coronel|Mestre|Comandante|Unidade|O|A)\s+/, '').split(/[ ,]/)[0];
          c.save(); c.font = `700 10px ${UI_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; const tw = c.measureText(short).width + 12;
          this.roundRect(o.pos.x - tw / 2, o.pos.y + 6, tw, 14, 7); c.fillStyle = 'rgba(12,10,30,.72)'; c.fill(); c.fillStyle = '#f3f1ff'; c.fillText(short, o.pos.x, o.pos.y + 13.5); c.restore();
        });
        return;
      }
      this.engine.party.forEach(u => list.push({ u, pos:this.heroPos(u) }));
      this.engine.enemies.forEach(u => list.push({ u, pos:this.enemyPos(u) }));
      // Quem está mais à frente (mais baixo na tela) cobre quem está atrás, contando a investida de cada um.
      list.forEach(o => { o.z = o.pos.y + this.actorOffset(this.v(o.u.uid), o.u.side === 'hero' ? 1 : -1).y; });
      list.sort((a, b) => a.z - b.z);
      list.forEach(o => o.u.side === 'hero' ? this.drawHero(o.u, o.pos) : this.drawEnemy(o.u, o.pos));
    }
    // ---------- cidade viva (src/town.js) ----------
    // Folhas de caminhada de tools/build_town_walk.py: 8 quadros do ciclo + 1 parado por personagem, em células iguais,
    // com os pés no chão e a cabeça no mesmo ponto em todos os quadros (nada de medir a folha em tempo de jogo).
    townReady() {
      if (!this.townArt) {
        const A = this.townArt = { index:null, folk:null, failed:false, sheets:new Map() }, v = KT.VERSION ? `?v=${KT.VERSION}` : '';
        fetch(`assets/town-walk/index.json${v}`).then(r => r.ok ? r.json() : null).then(index => {
          if (!index?.folk) { A.failed = true; return; }
          const img = new Image(); img.onload = () => { A.index = index; A.folk = img; }; img.onerror = () => { A.failed = true; }; img.src = `assets/town-walk/folk.webp${v}`;
          if (index.acts) { const acts = new Image(); acts.onload = () => { A.acts = acts; }; acts.src = `assets/town-walk/acts.webp${v}`; }
          if (index.animals) { const an = new Image(); an.onload = () => { A.animals = an; }; an.src = `assets/town-walk/animals.webp${v}`; }
        }).catch(() => { A.failed = true; });
      }
      return !!this.townArt.folk;
    }
    // Carrega a cidade antes de o jogo abrir: índice, moradores, atividades e as folhas da equipe atual. Resolve mesmo se
    // algo falhar (a cidade cai no modo antigo) ou demorar mais de 8 s.
    townPreload() {
      this.townReady();
      return new Promise(resolve => {
        const t0 = Date.now(), A = this.townArt, e = this.engine;
        const tick = () => {
          if (A.failed || Date.now() - t0 > 8000) return resolve(false);
          if (!A.folk || (A.index.acts && !A.acts)) return setTimeout(tick, 60);
          const ids = (e.state.formation || []).map(uid => uid && e.record(uid)).filter(Boolean).map(r => e.template(r.id)?.sprite).filter(id => A.index.heroes[id]);
          ids.forEach(id => this.townSheet(id));
          if (ids.every(id => { const img = A.sheets.get(id); return img.complete; })) return resolve(true);
          setTimeout(tick, 60);
        };
        tick();
      });
    }
    // Folha de caminhada de um herói (carregada sob demanda). null enquanto carrega ou se o herói ainda não tem folha.
    townSheet(id) {
      const A = this.townArt, M = A?.index?.heroes?.[id]; if (!M) return null;
      let img = A.sheets.get(id);
      if (!img) { img = new Image(); img.decoding = 'async'; img.src = `assets/town-walk/${id}.webp${KT.VERSION ? `?v=${KT.VERSION}` : ''}`; A.sheets.set(id, img); }
      return img.complete && img.naturalWidth ? { img, M } : null;
    }
    // Um quadro da folha com os pés em (x, y). col 0–7 = ciclo; 8 = parado.
    drawWalkFrame(img, M, row, col, x, y, h, sx = 1, sy = 1) {
      const c = this.ctx, k = h / M.body;
      c.save(); c.translate(x, y); c.scale(sx, sy);
      c.drawImage(img, col * M.w, row * M.h, M.w, M.h, -M.cx * k, -M.foot * k, M.w * k, M.h * k);
      c.restore();
    }
    // O quadro acompanha o chão percorrido (o pé não desliza): um ciclo completo = dois passos ≈ 1,06 × a altura.
    // Quadro do ciclo pela distância andada. stride = quanto o corpo avança num ciclo inteiro (em alturas do personagem),
    // medido na própria folha (tools/build_town_walk.py): o pé que pisa fica no lugar, sem deslizar.
    walkCol(dist, h, stride = 1.06) { return ((Math.floor(dist / (h * stride / 8)) % 8) + 8) % 8; }
    // Personagem da cidade: virada suave (a folha "gira" em ~0,15 s em vez de espelhar de uma vez) e respiração presa aos pés.
    drawTownActor(img, M, row, a, h, col = null) {
      a.fx = a.fx === undefined ? a.face : a.fx + (a.face - a.fx) * Math.min(1, (this.townDt || 0) * 16);
      const sx = Math.abs(a.fx) < .18 ? .18 * (a.face < 0 ? -1 : 1) : a.fx, breathe = col === null && !a.moving;
      this.drawWalkFrame(img, M, row, col ?? (a.moving ? this.walkCol(a.walkD || 0, h, M.strides ? M.strides[row] : M.stride) : 8), a.x, a.y, h, sx, breathe ? 1 + Math.sin(a.animT * 2.1 + a.id) * .012 : 1);
    }
    // Atividades e bichos (assets/town-walk/acts.webp): quem treina, dança ou toca segue o próprio compasso; quem anda
    // (criança, gato, menina da lanterna) troca de quadro pelo chão percorrido, com o passo do tamanho dele.
    drawTownAct(img, M, R, a, h) {
      const col = R.fps ? Math.floor(a.animT * R.fps) % 8 : a.moving ? ((Math.floor((a.walkD || 0) / (h * R.stride / 8)) % 8) + 8) % 8 : R.idle;
      this.drawTownActor(img, M, R.row, a, h, col);
    }
    drawTown() {
      const c = this.ctx, e = this.engine, A = this.townArt;
      if (!this.town) this.town = new KT.TownLife();
      const heroes = e.state.formation.filter(Boolean).map(uid => { const r = e.record(uid), t = r && e.template(r.id); return t && { uid, sprite:t.sprite, name:t.name.replace(/^(Coronel|Mestre|Comandante|Unidade|O|A)\s+/, '').split(/[ ,]/)[0] }; }).filter(Boolean);
      this.town.sync(heroes);
      const dt = Math.min(.1, Math.max(0, this.worldTime - (this.townT ?? this.worldTime))); this.townT = this.worldTime; this.townDt = dt; this.town.update(dt);
      this.townHits = [];
      c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
      const drawn = this.town.drawList();
      for (const { a, h } of drawn) {
        if (a.kind === 'animal') { this.drawTownAnimal(a, h); continue; }
        { const sh = a.def?.small ? .14 : a.def?.act === 'taiko' ? .46 : .3; c.save(); c.fillStyle = 'rgba(12,8,4,.38)'; c.beginPath(); c.ellipse(a.x, a.y + 1, h * sh, h * sh * .3, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
        if (a.kind === 'hero') {
          const sheet = this.townSheet(a.sprite), an = !sheet && this.assets.anim?.(a.sprite);
          if (sheet) this.drawTownActor(sheet.img, sheet.M, 0, a, h);
          // Herói ainda sem folha de caminhada: a pose parada com um passinho saltado (nunca a pose de corrida congelada).
          else if (an) this.drawFrame(an.img, an.meta, 0, a.x, a.y - (a.moving ? Math.abs(Math.sin((a.walkD || 0) / (h * .21))) * h * .05 : 0), h, a.face < 0);
          else this.drawSprite(a.sprite, a.x, a.y, h, { flip:a.face < 0 });
          this.townHits.push({ uid:a.uid, x:a.x, y:a.y, h });
        } else {
          const R = A.acts && A.index.acts?.rows[a.def.act || a.def.sheet];
          if (R) this.drawTownAct(A.acts, A.index.acts, R, a, h);
          else this.drawTownActor(A.folk, A.index.folk, a.f, a, h);
          this.townHits.push({ folk:true, actor:a, x:a.x, y:a.y, h });
        }
      }
      // Uma fala por vez, ancorada no interlocutor e sem cobrir personagens ou serviços.
      this.townBubbleBoxes = [];
      for (const { a, h } of drawn) {
        if (a.emote) this.townEmote(a, h);
        if (a.kind === 'hero') this.townNameTag(a.x, a.y + 4, a.name);
        else if (a.speechFor > 0 && a.speech && !this.townBubble(a, a.kind === 'animal' ? h * Math.max(.5, (KT.TownMap.SPECIES[a.sp]?.size || .4) * 1.5) : h) && !a.manualSpeech) { a.speech = ''; a.speechFor = 0; }
      }
    }
    // Bicho da cidade (src/town.js): anda pelo chão percorrido, faz a pose do momento, voa (pardal) ou nada (pato, carpa).
    drawTownAnimal(a, h) {
      const c = this.ctx, A = this.townArt, M = A.index?.animals, img = A.animals; if (!img || !M) return;
      const S = KT.TownMap.SPECIES[a.sp]; let name = S.row, col = 0;
      if (a.sp === 'koi') {      // vista de cima, debaixo d'água: gira para onde nada, meio transparente
        const R = M.rows.koi, k = h / M.body; col = a.variant * 4 + Math.floor(a.animT * 5 + a.id) % 4;
        c.save(); c.globalAlpha = .72; c.translate(a.x, a.y); c.rotate(a.heading || 0);
        c.drawImage(img, col * M.w, R.row * M.h, M.w, M.h, -M.cx * k, -(M.foot - M.body * S.size * .5) * k, M.w * k, M.h * k); c.restore();
        this.townHits.push({ folk:true, actor:a, x:a.x, y:a.y + h * .2, h:h * .5 });
        return;
      }
      const pose = a.pose && S.poses?.[a.pose];
      if (a.moving && a.pose !== 'flap' && a.pose !== 'hop') { const R = M.rows[S.row], w = S.walk || [0, 7], n = w[1] - w[0] + 1; col = w[0] + (((Math.floor((a.walkD || 0) / (h * (R.stride || .5) / n)) % n) + n) % n); }
      else if (pose) { name = S.idle || S.row; col = pose[0] + Math.floor(a.animT * pose[2]) % (pose[1] - pose[0] + 1); }
      const R = M.rows[name], size = h * S.size;
      c.save();
      if (S.water) { c.strokeStyle = 'rgba(210,235,255,.35)'; c.lineWidth = 1; c.beginPath(); c.ellipse(a.x, a.y + 1, size * .75 + Math.sin(a.animT * 2 + a.id) * 1.5, size * .22, 0, 0, Math.PI * 2); c.stroke(); }
      else { c.fillStyle = `rgba(12,8,4,${a.lift ? .18 : .34})`; c.beginPath(); c.ellipse(a.x, a.y + 1, size * (a.lift ? .34 : .5), size * .15, 0, 0, Math.PI * 2); c.fill(); }
      c.restore();
      const y0 = a.y; a.y -= (a.lift || 0) + (S.water ? Math.sin(a.animT * 2 + a.id) * .6 : 0);
      this.drawTownActor(img, M, R.row, a, h, col); a.y = y0;
      this.townHits.push({ folk:true, actor:a, x:a.x, y:a.y, h:h * Math.max(.5, S.size * 1.5) });
    }
    // Sinal sobre a cabeça de um bicho ou de um herói (♥ ! ♪ z).
    townEmote(a, h) {
      const c = this.ctx, top = a.kind === 'animal' ? h * (KT.TownMap.SPECIES[a.sp]?.size || .4) + (a.lift || 0) : h, y = a.y - top - 9 - Math.sin((a.emoteFor || 0) * 5) * 1.5, color = { '♥':'#ff7a9c', '!':'#ffd76a', '♪':'#9ce9cc', z:'#cfd6ff' }[a.emote] || '#fff';
      c.save(); c.globalAlpha = Math.min(1, (a.emoteFor || 0) / .3);
      c.fillStyle = 'rgba(14,12,20,.82)'; c.beginPath(); c.arc(a.x, y, 6.5, 0, Math.PI * 2); c.fill();
      c.font = `800 9.5px ${UI_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = color; c.fillText(a.emote, a.x, y + .5);
      c.restore();
    }
    townHeroAt(x, y) { if (this.engine.zone.kind !== 'village') return null; const hit = (this.townHits || []).filter(o => Math.abs(x - o.x) < o.h * .4 && y < o.y + 4 && y > o.y - o.h * 1.1).sort((p, q) => q.y - p.y)[0]; return hit?.uid || null; }
    townFolkAt(x, y) { if (this.engine.zone.kind !== 'village') return null; return (this.townHits || []).filter(o => o.folk && Math.abs(x - o.x) < o.h * .4 && y < o.y + 4 && y > o.y - o.h * 1.1).sort((p, q) => q.y - p.y)[0]?.actor; }
    townTalkAt(x, y) { const a = this.townFolkAt(x, y); return a && this.town.talk(a) ? a : null; }
    // Um quadro da folha de poses do herói, com os pés em (x, y).
    drawFrame(img, M, col, x, y, height, flip) {
      const c = this.ctx, k = height / M.bodyH;
      c.save(); c.translate(x, y); if (flip) c.scale(-1, 1);
      c.drawImage(img, col * M.frameW, 0, M.frameW, M.frameH, -M.cx * k, -M.footY * k, M.frameW * k, M.frameH * k); c.restore();
    }
    // Tamanho de texto e de balão na cidade: a cena tem 1280 de largura lógica, mas o palco costuma ter 700 a 1100 px na
    // tela; sem compensar, uma letra de 10 vira 5 ou 6 px e ninguém lê. k leva a letra a ~11,5 px reais.
    townUi(base = 10, target = 11.5) { return U.clamp(target / (base * (this.css || 1)), 1, 2.6); }
    // Balão de fala em papel, com rabicho apontando para quem fala (um por vez, sem cobrir personagens nem botões).
    townBubble(a, h) {
      const k = this.townUi(), x = a.x, y = a.y - h * 1.15 - 4, name = a.name;
      const c = this.ctx; c.save(); c.font = `500 ${10 * k}px ${UI_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      const words = a.speech.split(/\s+/), lines = []; let line = '';
      for (const word of words) { const next = line ? `${line} ${word}` : word; if (line && c.measureText(next).width > 120 * k) { lines.push(line); line = word; } else line = next; }
      if (line) lines.push(line);
      const w = Math.min(136 * k, Math.max(64 * k, c.measureText(name).width + 14 * k, ...lines.map(t => c.measureText(t).width + 14 * k)));
      const hh = (17 + lines.length * 11) * k, v = this.view || { x:0, w:W };
      if (x < v.x + 6 || x > v.x + v.w - 6) { c.restore(); return false; }
      const blockers = (this.townHits || []).map(o => ({ l:o.x - o.h * .38 - 3, r:o.x + o.h * .38 + 3, t:o.y - o.h * 1.15 - 3, b:o.y + 5 }));
      const rect = this.canvas.getBoundingClientRect(), rectKey = [rect.left,rect.top,rect.width,rect.height,v.x,v.w].join(':');
      if (!this._bubbleRects || this.worldTime >= this._bubbleRectsAt || this._bubbleRectsKey !== rectKey) {
        this._bubbleRects = []; this._bubbleRectsKey = rectKey;
        if (rect.width && rect.height) document.querySelectorAll('#village-actions .signpost, #village-hub, #viewport .zone-chip, #viewport .stage-top button, #viewport .stage-wallet').forEach(el => {
          if (!el.getClientRects().length) return;
          const r = el.getBoundingClientRect();
          this._bubbleRects.push({ l:v.x + (r.left - rect.left) / rect.width * v.w - 4,
            r:v.x + (r.right - rect.left) / rect.width * v.w + 4,
            t:(r.top - rect.top) / rect.height * H - 4,
            b:(r.bottom - rect.top) / rect.height * H + 4, sign:true });
        });
        this._bubbleRectsAt = this.worldTime + .2;
      }
      blockers.push(...this._bubbleRects, ...(this.townBubbleBoxes || []));
      const side = w / 2 + h * .45 + 5, offsets = [0, -side, side], prior = a.bubblePlacement?.text === a.speech ? a.bubblePlacement : null;
      let best = null;
      for (const lift of [0, 18, -hh / 2]) for (const off of offsets) {
        if (lift < 0 && off === 0) continue;
        const cx = Math.max(v.x + w / 2 + 4, Math.min(v.x + v.w - w / 2 - 4, x + off));
        const top = y - hh - 4 - lift;
        const box = { l:cx - w / 2, r:cx + w / 2, t:top, b:top + hh };
        if (box.t < 4 || box.b > H - 4) continue;
        if (blockers.some(q => box.l < q.r && box.r > q.l && box.t < q.b && box.b > q.t)) continue;
        const score = Math.abs(cx - x) + Math.abs(lift) * .5 - (prior?.off === off && prior?.lift === lift ? 1000 : 0);
        if (!best || score < best.score) best = { cx, top, score, off, lift, box };
      }
      if (!best) { c.restore(); return false; }
      const { cx, top } = best, l = cx - w / 2, r = cx + w / 2, b = top + hh;
      a.bubblePlacement = { text:a.speech, off:best.off, lift:best.lift };
      this.townBubbleBoxes?.push(best.box);
      c.globalAlpha = Math.min(1, (a.speechAge || 0) / .15, a.speechFor / .3);
      const PAPER = 'rgba(251,243,226,.97)', INK = 'rgba(46,32,26,.9)';
      c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 7 * k; c.shadowOffsetY = 2 * k;
      this.roundRect(l, top, w, hh, 6 * k); c.fillStyle = PAPER; c.fill();
      c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0; c.lineWidth = .9 * k; c.strokeStyle = INK; c.stroke();
      // Rabicho: sai da borda mais próxima de quem fala (embaixo, em cima ou de lado).
      const tipX = x, tipY = y + 2, t = 4 * k;
      let p1, p2;
      if (tipX >= l + 9 * k && tipX <= r - 9 * k || (tipX > l && tipX < r)) { const ax = Math.max(l + 9 * k, Math.min(r - 9 * k, tipX)), ay = tipY >= b ? b : top; p1 = [ax - t, ay]; p2 = [ax + t, ay]; }
      else { const ax = tipX <= l ? l : r, ay = Math.max(top + 8 * k, Math.min(b - 8 * k, tipY)); p1 = [ax, ay - t]; p2 = [ax, ay + t]; }
      c.fillStyle = PAPER; c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(tipX, tipY); c.lineTo(p2[0], p2[1]); c.fill();
      c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(tipX, tipY); c.lineTo(p2[0], p2[1]); c.stroke();
      c.font = `700 ${8.5 * k}px ${UI_FONT}`; c.fillStyle = '#b8452c'; c.fillText(name, cx, top + 8.5 * k);
      c.font = `500 ${10 * k}px ${UI_FONT}`; c.fillStyle = '#2a211c'; lines.forEach((txt, i) => c.fillText(txt, cx, top + (19.5 + i * 11) * k));
      c.restore(); return true;
    }
    // Nome do herói na cidade: plaquinha escura legível em qualquer tamanho de tela.
    townNameTag(x, y, name) {
      const c = this.ctx, k = this.townUi(8, 10), fs = 8 * k;
      c.save(); c.font = `700 ${fs}px ${UI_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      const w = c.measureText(name).width + 8 * k, hh = fs + 3.5 * k, top = y - 1;
      this.roundRect(x - w / 2, top, w, hh, hh / 2); c.fillStyle = 'rgba(14,11,24,.74)'; c.fill();
      c.fillStyle = '#ffeccb'; c.fillText(name, x, top + hh / 2 + .3 * k);
      c.restore();
    }
    // Deslocamento do ator: x/y andam no chão (a sombra acompanha), lift é o salto.
    actorOffset(s, dirSign) {
      let x = 0, y = 0, lift = 0;
      const L = s.lunge;
      if (L) {
        const k = L.t / L.dur;
        if (L.slow) { const f = k < .78 ? Math.sin(k / .78 * Math.PI / 2) : 1 - (k - .78) / .22; x += L.dx * f; }   // bote: avança devagar e recua
        else if (L.dash) {
          // investida: chega rápido, segura o golpe e volta num salto
          const f = k < .24 ? easeOut(k / .24) : k < .5 ? 1 : 1 - easeOut((k - .5) / .5);
          x += L.dx * f; y += L.dy * f; if (k > .5) lift -= Math.sin((k - .5) / .5 * Math.PI) * 24;
        } else { const f = k < .35 ? easeOut(k / .35) : 1 - easeOut((k - .35) / .65); x += L.dx * f; y += L.dy * f; if (L.hop) lift -= Math.sin(k * Math.PI) * 18; }
      }
      if (s.hit > 0) x -= dirSign * s.hitDir * 16 * (s.hit / .3);
      return { x, y, lift };
    }
    runeCircle(x, y, r, color, alpha = .7, spin = 1) {
      const c = this.ctx; c.save(); c.translate(x, y); c.scale(1, .32); c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = 3;
      c.shadowColor = color; c.shadowBlur = 12;
      c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
      c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, r * .78, 0, Math.PI * 2); c.stroke();
      const rot = this.worldTime * spin;
      for (let i = 0; i < 12; i++) { const a = rot + i * Math.PI / 6; c.beginPath(); c.moveTo(Math.cos(a) * r * .8, Math.sin(a) * r * .8); c.lineTo(Math.cos(a) * r * .96, Math.sin(a) * r * .96); c.stroke(); }
      c.restore();
    }
    drawHero(u, pos) {
      const c = this.ctx, s = this.v(u.uid), alive = u.alive, t = this.worldTime + u.slot * .7, eng = this.engine;
      const moving = eng.phase === 'between' && alive;
      const off = this.actorOffset(s, 1);
      // Escala por sprite (src/sprite-meta.js): todos os heróis com o mesmo tamanho aparente e o pé no chão.
      const hm = KT.SPRITE_META?.[u.sprite] || [1, 0], HERO_H = HERO_H0 * hm[0];
      const gx = pos.x + off.x, gy = pos.y + off.y;                                  // onde ele pisa agora
      const x = gx + (moving ? 14 : 0), y = gy + off.lift + hm[1] * HERO_H;
      const air = 1 + off.lift / 60;                                                  // sombra encolhe no salto
      c.save(); c.fillStyle = 'rgba(0,0,0,.42)'; c.beginPath(); c.ellipse(gx, gy + 4, 46 * air, 13 * air, 0, 0, Math.PI * 2); c.fill(); c.restore();
      const ultReady = alive && u.energy >= 100;
      if (alive) this.runeCircle(gx, gy + 4, ultReady ? 52 : 46, u.color, ultReady ? .7 : .16, ultReady ? 1.5 : .25);
      // É a vez dele e a luta espera a ordem: anel dourado no chão e seta em cima.
      const myTurn = alive && eng.awaiting !== null && eng.party[eng.awaiting] === u;
      if (myTurn) {
        const pl = .5 + .5 * Math.sin(this.worldTime * 6);
        c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = '#ffe28a'; c.lineWidth = 4; c.globalAlpha = .55 + .4 * pl; c.shadowColor = '#ffcf6b'; c.shadowBlur = 14;
        c.beginPath(); c.ellipse(gx, gy + 4, 60 + pl * 5, 17 + pl * 1.5, 0, 0, Math.PI * 2); c.stroke(); c.restore();
      }
      if (s.cast > 0) this.aura(u.sprite, x, y, HERO_H, s.castColor, s.cast);
      else if (ultReady) this.aura(u.sprite, x, y, HERO_H, u.color, .55 + .25 * Math.sin(t * 5));
      if (s.level > 0) this.aura(u.sprite, x, y, HERO_H, '#ffd76a', s.level / 1.4);
      if (s.revive > 0) this.aura(u.sprite, x, y, HERO_H, '#ffe19a', s.revive);
      const stealth = u.effects.some(e => e.s === 'stealth');
      const an = this.assets.anim?.(u.sprite);
      const walk = moving && this.townReady() && this.townSheet(u.sprite);
      const base = { flash:s.flash / .24, alpha:alive ? (stealth ? .45 : 1) : .78, gray:!alive };
      // Rastro da investida: três imagens-fantasma atrás do herói enquanto ele cruza o campo.
      if (an && s.lunge?.dash && s.lunge.t / s.lunge.dur < .32) {
        const L = s.lunge, k = L.t / L.dur;
        for (let g = 3; g >= 1; g--) { const f = easeOut(Math.max(0, k - g * .04) / .24); this.drawAnim(an, s, u, pos.x + L.dx * f, pos.y + L.dy * f + hm[1] * HERO_H, HERO_H, { alpha:.2 - g * .045 }); }
      }
      if (walk) this.drawWalkFrame(walk.img, walk.M, 0, this.walkCol(t * 150, HERO_H, walk.M.stride), x, y, HERO_H);
      else if (an) this.drawAnim(an, s, u, x, y, HERO_H, base);
      else this.drawSprite(u.sprite, x, y, HERO_H, { sy:alive ? 1 + Math.sin(t * 2.6) * .018 : 1, flash:s.flash / .24, alpha:alive ? (stealth ? .45 : 1) : .35, gray:!alive, tilt:alive ? 0 : -.25 });
      if (u.shield > 0 && alive) this.drawBarrier(x, y, HERO_H, U.clamp(u.shield / u.maxHp, 0, 1), s.shieldHit > 0);
      if (alive && eng.phase === 'fight' && (eng.guardT > 0 || u.defend)) this.drawGuard(x, y, HERO_H, u.defend ? 1 : U.clamp(eng.guardT / .22, 0, 1), s.guardHit);
      if (!alive) return;
      if (myTurn) { const by2 = pos.y + hm[1] * HERO_H - HERO_H - 44 + Math.sin(this.worldTime * 5) * 4; c.save(); c.fillStyle = '#ffe28a'; c.strokeStyle = 'rgba(14,10,20,.9)'; c.lineWidth = 3; c.lineJoin = 'round'; c.beginPath(); c.moveTo(pos.x - 11, by2 - 12); c.lineTo(pos.x + 11, by2 - 12); c.lineTo(pos.x, by2 + 3); c.closePath(); c.stroke(); c.fill(); c.restore(); }
      // Barras e selos ficam no lugar do herói na formação (não saem voando com a investida).
      const by = pos.y + hm[1] * HERO_H - HERO_H;
      this.statusIcons(u, pos.x - 44, by - 28);
      if (u.effects.some(e => e.s === 'stun' || e.s === 'freeze')) this.stunStars(x, y - HERO_H - 6);
      this.bar(pos.x - 44, by - 16, 88, 9, s, '#57e389', u.shield / u.maxHp);
      this.thin(pos.x - 44, by - 5, 88, U.clamp(u.energy / 100, 0, 1), ultReady ? '#ffd76a' : '#e0a93b');
    }
    // Guarda erguida: arco de luz à frente do herói; quando segura um golpe, fica branco e largo.
    drawGuard(x, y, h, k, hit) {
      const c = this.ctx, t = this.worldTime, r = h * .5, hot = hit > 0;
      c.save(); c.translate(x + h * .2, y - h * .5); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
      c.strokeStyle = hot ? '#ffffff' : '#ffe9a8'; c.shadowColor = '#ffcf6b'; c.shadowBlur = hot ? 22 : 10;
      c.globalAlpha = Math.min(1, (.5 + .2 * Math.sin(t * 9)) * k + (hot ? .45 : 0)); c.lineWidth = hot ? 6.5 : 3.5;
      c.beginPath(); c.ellipse(0, 0, r * .42, r, 0, -1.25, 1.25); c.stroke();
      c.globalAlpha *= .5; c.lineWidth = 1.5; c.beginPath(); c.ellipse(-7, 0, r * .34, r * .86, 0, -1.1, 1.1); c.stroke();
      c.restore();
    }
    drawBarrier(x, y, h, strength, hit) {
      const c = this.ctx, pulse = .5 + .5 * Math.sin(this.worldTime * 3.2), rx = Math.max(38, h * .31), ry = Math.max(58, h * .48);
      c.save(); c.translate(x, y - h * .48); c.globalCompositeOperation = 'lighter';
      c.fillStyle = `rgba(120,220,255,${.025 + strength * .055})`; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = hit ? '#ffffff' : '#8fe9ff'; c.lineCap = 'round'; c.shadowColor = '#6fdcff'; c.shadowBlur = hit ? 16 : 5;
      for (let i = 0; i < 6; i++) { const gap = .16, a0 = -Math.PI / 2 + i * Math.PI / 3 + gap, a1 = -Math.PI / 2 + (i + 1) * Math.PI / 3 - gap; c.globalAlpha = (hit ? .95 : .34 + pulse * .12) * (.65 + strength * .35); c.lineWidth = hit ? 4 : 2.2; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, a0, a1); c.stroke(); }
      c.globalAlpha = .25 + strength * .25; c.lineWidth = 1; c.setLineDash([3, 8]); c.beginPath(); c.ellipse(0, 0, rx - 6, ry - 7, 0, 0, Math.PI * 2); c.stroke(); c.restore();
    }
    // Família do monstro (fox, oni, golem, spider, wisp, revenant…): todas as criaturas são variações de poucas bases.
    enemyFamily(sprite) { return this.assets.animBase?.(sprite) || String(sprite).split('_')[0]; }
    drawEnemy(e, pos) {
      const c = this.ctx, s = this.v(e.uid), t = this.worldTime + pos.x * .01, dying = !e.alive;
      // Monstros animados (folha de poses da família, recolorida na hora); sem folha, a arte parada de sempre.
      const ban = this.assets.anim?.(e.sprite), full = ban && (ban.meta.poses || 0) >= 16, life = full ? 1.35 : .9;
      if (dying && (s.death > life || e.fled)) return;
      const off = this.actorOffset(s, -1), height = this.enemyHeight(e), enter = easeOut(s.spawn);
      const floats = this.enemyFamily(e.sprite) === 'wisp', floatY = floats ? Math.sin(t * 2.4) * 10 - 16 : 0;
      const gx = pos.x + off.x + (1 - enter) * 240, gy = pos.y + off.y;
      const x = gx + (e.windup > 0 ? Math.sin(this.worldTime * 46) * 2.2 : 0), y = gy + off.lift;
      c.save(); c.globalAlpha = enter * (dying ? (full ? U.clamp((life - s.death) / .45, 0, 1) : Math.max(0, 1 - s.death / .9)) : 1);
      c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.ellipse(gx, gy + 4, height * (e.boss ? .42 : .3), height * .08, 0, 0, Math.PI * 2); c.fill();
      const focused = this.engine.focusUid === e.uid, hovered = this.hoverEnemy === e.uid;
      if ((focused || hovered) && !dying) { c.save(); c.translate(pos.x, pos.y + 4); c.strokeStyle = focused ? '#ffd76a' : 'rgba(255,255,255,.6)'; c.lineWidth = 3; const r = height * (e.boss ? .42 : .34); for (let k = 0; k < 4; k++) { const a0 = this.worldTime * 1.6 + k * Math.PI / 2; c.beginPath(); c.ellipse(0, 0, r, r * .3, a0 * 0, a0, a0 + .9); c.stroke(); } c.restore(); }
      if ((e.elite || e.miniboss) && !dying) this.aura(e.sprite, x, y + floatY, height, e.miniboss ? '#ff9a3b' : '#c77dff', .5 + .15 * Math.sin(t * 3));
      if (e.treasure && !dying) this.aura(e.sprite, x, y, height, '#ffd76a', .8);
      if (e.windup > 0 || e.striking) this.aura(e.sprite, x, y, height, '#ff3a5a', .6 + .4 * Math.sin(this.worldTime * 20));
      const sink = dying && !full ? s.death * 30 : 0, flash = dying ? Math.max(0, .5 - s.death * 3) : s.flash / .24;
      if (ban) this.drawAnim(ban, s, e, x, y + floatY * (dying ? Math.max(0, 1 - s.death * 2) : 1) + sink, height, { flash, alpha:1, gray:dying && s.death > .25, flip:!!e.rival || ban.meta.facing === 'right', glow:dying ? null : this.assets.animAura?.(e.sprite) });
      else this.drawSprite(e.sprite, x, y + floatY + sink, height, { sy:1 + Math.sin(t * 2.2) * .022, flash, alpha:1, gray:dying && s.death > .25, flip:!!e.rival });
      c.restore();
      if (dying) return;
      if (e.effects.some(x => x.s === 'burn')) this.flames(x, y, height);
      if (e.effects.some(x => x.s === 'stun' || x.s === 'freeze')) this.stunStars(x, y - height - 4);
      if (e.effects.some(x => x.s === 'freeze')) { c.save(); c.globalAlpha = .35; c.fillStyle = '#bff4ff'; c.beginPath(); c.ellipse(x, y - height * .45, height * .32, height * .5, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
      if (!e.boss) {
        // Barra e nome ficam no lugar do monstro na formação.
        const top = pos.y + floatY - height - 14, bw = e.miniboss ? 150 : e.elite ? 120 : 96;
        this.bar(pos.x - bw / 2, top, bw, e.elite ? 10 : 8, s, e.miniboss ? '#ff9a3b' : e.elite ? '#c77dff' : '#ff5d6c', e.shield / e.maxHp);
        this.nameTag(`${e.guardian ? '◆ ' : e.elite ? '★ ' : ''}Nv.${e.level} ${e.name}`, pos.x, top - 14, e.elite || e.guardian, D.elements[e.el]?.color);
        this.statusIcons(e, pos.x - bw / 2, top - 30);
        if (e.elite || e.miniboss || e.guardian) this.thin(pos.x - bw / 2, top + (e.elite ? 13 : 11), bw, e.broken > 0 ? e.broken / 4 : U.clamp(e.breakG / e.breakMax, 0, 1), e.broken > 0 ? '#fff1c9' : '#ffb35c');
      }
      if (e.broken > 0) { this.stunStars(x, y - height - 4); c.save(); c.globalAlpha = .18 + .1 * Math.sin(this.worldTime * 10); c.fillStyle = '#ffe9b0'; c.beginPath(); c.ellipse(x, y - height * .45, height * .36, height * .52, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
      if (e.windup > 0) {
        c.save(); c.font = `800 64px ${DISPLAY_FONT_W}`; c.textAlign = 'center'; c.fillStyle = '#ff4a6a'; c.strokeStyle = '#1a0610'; c.lineWidth = 8; const bob = Math.sin(this.worldTime * 14) * 6;
        c.strokeText('!', x, y - height - 30 + bob); c.fillText('!', x, y - height - 30 + bob);
        const k = 1 - e.windup / e.windupMax; c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x - 60, y - height - 20, 120, 8); c.fillStyle = '#ff4a6a'; c.fillRect(x - 60, y - height - 20, 120 * k, 8);
        c.restore();
      }
      this.hotspots.push({ enemy:e.uid, x:pos.x - height * .35, y:pos.y - height, w:height * .7, h:height });
    }
    statusIcons(u, x, y) {
      const c = this.ctx, seen = new Set(); let ix = x;
      u.effects.forEach(e => { if (seen.has(e.s) || ix > x + 115) return; seen.add(e.s); const info = D.statusInfo[e.s]; if (!info) return;
        // Selo do efeito: fundo escuro, borda na cor (benéfico = contorno cheio, negativo = tracejado) e ícone desenhado.
        c.save(); c.fillStyle = 'rgba(12,10,20,.82)'; this.roundRect(ix - 1, y - 15, 21, 20, 5); c.fill();
        c.strokeStyle = info.color; c.lineWidth = 1.4; if (!info.buff) c.setLineDash([3, 2]); this.roundRect(ix - 1, y - 15, 21, 20, 5); c.stroke(); c.setLineDash([]);
        if (!KT.Icons?.draw(c, info.icon, ix + 9.5, y - 5, 14, info.color, 2.6)) { c.font = `800 12px ${DISPLAY_FONT}`; c.textAlign = 'center'; c.fillStyle = info.color; c.fillText(info.name[0], ix + 9.5, y); }
        c.restore(); ix += 23; });
    }
    // ---------- animação por folha de sprites (heróis 3D) ----------
    playClip(uid, clip) { const s = this.v(uid); s.clip = clip; s.clipAt = this.worldTime; }
    baseClip(u) {
      const ph = this.engine.phase;
      if (!u.alive) return 'death';
      if (u.side === 'enemy') return ph === 'defeat' ? 'victory' : 'idle';
      if (ph === 'between') return 'run';
      if (ph === 'stageClear' || ph === 'victory') return 'victory';
      return 'idle';
    }
    // Quadro atual da folha: [linha, pose, próxima pose, fração até a próxima (0–1)]. As folhas têm 8 colunas e 1 ou 2
    // linhas (tools/build_anim.py): a pose p fica na coluna p % 8 da linha p / 8.
    animFrame(an, s, u) {
      const M = an.meta, C = M.clips; let clip = s.clip, t = this.worldTime - s.clipAt;
      if (!u.alive) { if (clip !== 'death') { clip = 'death'; s.clip = 'death'; s.clipAt = this.worldTime; t = 0; } }
      else if (clip === 'death') { s.clip = null; clip = null; }
      const cols = M.cols || Math.max(1, Math.floor(an.img.width / M.frameW)), rows = Math.max(1, Math.floor(an.img.height / M.frameH));
      const total = M.poses || cols, full = total >= 16;
      const pose = (m, i) => U.clamp(Number(m.seq ? m.seq[i] : i) || 0, 0, total - 1);
      const row0 = U.clamp(Number((C.idle || {}).row) || 0, 0, rows - 1), hold = p => [row0, Math.min(p, total - 1), Math.min(p, total - 1), 0];
      const at = (m, x, loop) => { const frames = Math.max(1, Number(m.frames) || 1), i = Math.floor(x), f = x - i, a = loop ? ((i % frames) + frames) % frames : Math.min(Math.max(0, i), frames - 1), b = loop ? (a + 1) % frames : Math.min(a + 1, frames - 1); return [U.clamp(Number(m.row) || 0, 0, rows - 1), pose(m, a), pose(m, b), f]; };
      // Atordoado, congelado ou de postura quebrada: nada de continuar o golpe que estava no meio.
      if (u.alive && (u.broken > 0 || u.effects?.some(e => e.s === 'stun' || e.s === 'freeze'))) { s.clip = null; return hold(u.side === 'enemy' && full ? 8 : 3); }
      if (clip && C[clip]) {
        const m = C[clip], x = t * m.fps;
        if (m.loop) return at(m, x, true);
        if (x < m.frames) return at(m, x, false);
        if (clip === 'death') return at(m, m.frames - 1, false);
        s.clip = null;
      }
      // Poses que o estado segura: ataque sendo preparado, guarda erguida, monstro entrando em campo.
      if (u.alive) {
        if (u.windup > 0) return hold(full ? 12 : 4);
        if (u.striking) return hold(5);
        if (u.side === 'hero' && full && this.engine.phase === 'fight' && (this.engine.guardT > 0 || u.defend)) return hold(8);
        if (u.side === 'enemy' && s.spawn < 1) return hold(2);
      }
      // Repouso numa pose só (a respiração vem de poseMotion): alternar dois desenhos fazia o herói piscar e trocar de lugar.
      const base = this.baseClip(u);
      if (base === 'idle') return [row0, 0, 0, 0];
      if (base === 'victory') return hold(pose(C.victory || C.idle, 0));
      const b = C[base] || C.idle, it = this.worldTime + (u.slot || 0) * .37;
      return at(b, it * b.fps, true);
    }
    // Movimento contínuo por pose: deslocamento, inclinação e escala interpolados entre poses, a cada quadro de tela.
    // 0 parado · 1 respira · 2 corre · 3 dano · 4 prepara · 5 golpe · 6 fim · 7 especial · 8 guarda (monstro: atordoado) ·
    // 9 esquiva · 10 caído · 11 vitória · 12 início da conjuração · 13 disparo · 14 meio do golpe · 15 segundo golpe.
    poseMotion(p, time, slot) {
      const br = Math.sin(time * 2.4 + slot) * .5 + .5;
      switch (p) {
        case 0: case 1: return { x:0, y:0, rot:0, sx:1 + br * .006, sy:1 + br * .014 };
        case 2: return { x:4, y:0, rot:.015, sx:1, sy:1 };
        case 3: return { x:-10 + Math.sin(time * 60) * 2, y:0, rot:-.06, sx:1.02, sy:.97 };
        case 4: return { x:-6, y:0, rot:-.05, sx:1.03, sy:.96 };
        case 5: return { x:18, y:0, rot:.05, sx:1.05, sy:.97 };
        case 6: return { x:8, y:0, rot:.02, sx:1, sy:1 };
        case 7: return { x:4, y:-8, rot:0, sx:1.02, sy:1.03 };
        case 8: return { x:-3, y:0, rot:-.015, sx:1.01, sy:.995 + br * .006 };
        case 9: return { x:-14, y:-6, rot:-.06, sx:1, sy:1 };
        case 10: return { x:-4, y:0, rot:0, sx:1, sy:1 };
        case 11: return { x:0, y:-Math.abs(Math.sin(time * 5.5 + slot)) * 9, rot:0, sx:1, sy:1 + br * .01 };
        case 12: return { x:-5 + Math.sin(time * 38) * 1.2, y:0, rot:-.03, sx:1.02, sy:.98 };
        case 13: return { x:11, y:-2, rot:.03, sx:1.04, sy:.99 };
        case 14: return { x:10, y:0, rot:.03, sx:1.04, sy:.98 };
        case 15: return { x:20, y:-4, rot:.05, sx:1.05, sy:.98 };
        default: return { x:0, y:0, rot:0, sx:1, sy:1 };
      }
    }
    drawAnim(an, s, u, x, y, height, o = {}) {
      const c = this.ctx, M = an.meta, [row, col, next, frac] = this.animFrame(an, s, u);
      const k = height / M.bodyH, fw = M.frameW * k, fh = M.frameH * k;
      const dx = -M.cx * k, dy = -M.footY * k;
      const cols = M.cols || Math.max(1, Math.floor(an.img.width / M.frameW)), fx0 = (col % cols) * M.frameW, fy0 = (row + Math.floor(col / cols)) * M.frameH;
      const e = frac * frac * (3 - 2 * frac), A = this.poseMotion(col, this.worldTime, u.slot || 0), B = this.poseMotion(next, this.worldTime, u.slot || 0);
      const mix = key => A[key] + (B[key] - A[key]) * e, dir = u.side === 'enemy' ? -1 : 1, mk = height / 180;
      c.save(); c.translate(x + mix('x') * mk * dir, y + mix('y') * mk); c.rotate(mix('rot') * dir); c.scale(mix('sx') * (o.flip ? -1 : 1), mix('sy'));
      c.globalAlpha *= (o.alpha ?? 1);
      if (o.gray) c.filter = 'grayscale(.85) brightness(.7)';
      // Troca de pose seca, como em sprites desenhados à mão (sem mistura transparente, que parecia piscar);
      // o movimento entre poses fica por conta de deslocamento, inclinação e escala interpolados acima.
      if (o.glow) { c.shadowColor = o.glow; c.shadowBlur = 13 * this.scale; }   // aura das criaturas únicas (Fenda, chefes mundiais…)
      c.drawImage(an.img, fx0, fy0, M.frameW, M.frameH, dx, dy, fw, fh);
      c.filter = 'none'; c.shadowBlur = 0; c.shadowColor = 'transparent';
      if (o.flash > 0) {
        if (!an.flash) { const f = document.createElement('canvas'); f.width = an.img.width; f.height = an.img.height; const g = f.getContext('2d'); g.drawImage(an.img, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#ffd9b8'; g.fillRect(0, 0, f.width, f.height); an.flash = f; }
        c.globalAlpha *= U.clamp(o.flash, 0, 1) * .42; c.drawImage(an.flash, fx0, fy0, M.frameW, M.frameH, dx, dy, fw, fh);
      }
      c.restore();
    }
    drawSprite(id, x, y, height, o = {}) {
      const img = this.assets.spriteImage(id), c = this.ctx;
      if (!img) { c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(x - 30, y - height, 60, height); return; }
      const w = height * img.width / img.height, sy = o.sy || 1;
      c.save(); c.translate(x, y); if (o.tilt) c.rotate(o.tilt); c.scale((o.flip ? -1 : 1) * (2 - sy), sy); c.globalAlpha *= (o.alpha ?? 1);
      if (o.gray) c.filter = 'grayscale(1) brightness(.6)';
      c.drawImage(img, -w / 2, -height, w, height); c.filter = 'none';
      if (o.flash > 0) { c.globalAlpha *= U.clamp(o.flash, 0, 1) * .42; c.drawImage(this.flashSprite(id, img), -w / 2, -height, w, height); }
      c.restore();
    }
    flashSprite(id, img) {
      let f = this.flashCache.get(id); if (f) return f;
      f = document.createElement('canvas'); f.width = img.width; f.height = img.height;
      const g = f.getContext('2d'); g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#ffd9b8'; g.fillRect(0, 0, f.width, f.height);
      this.flashCache.set(id, f); return f;
    }
    // Aura com a forma do personagem: silhueta colorida e desfocada, em camadas.
    glowSprite(id, color) {
      const key = `${id}|${color}`; let g = this.glowCache.get(key); if (g) return g;
      const img = this.assets.spriteImage(id); if (!img) return null;
      const pad = 24, sc = .5;
      const tmp = document.createElement('canvas'); tmp.width = Math.round(img.width * sc) + pad * 2; tmp.height = Math.round(img.height * sc) + pad * 2;
      const tx = tmp.getContext('2d'); tx.drawImage(img, pad, pad, img.width * sc, img.height * sc); tx.globalCompositeOperation = 'source-in'; tx.fillStyle = color; tx.fillRect(0, 0, tmp.width, tmp.height);
      g = document.createElement('canvas'); g.width = tmp.width; g.height = tmp.height;
      const x = g.getContext('2d');
      if ('filter' in x) { x.filter = 'blur(12px)'; x.drawImage(tmp, 0, 0); x.drawImage(tmp, 0, 0); x.filter = 'blur(4px)'; x.globalAlpha = .8; x.drawImage(tmp, 0, 0); x.filter = 'none'; }
      else { x.globalAlpha = .5; x.drawImage(tmp, 0, 0); }
      g.pad = pad; g.sc = sc;
      this.glowCache.set(key, g); return g;
    }
    aura(id, x, y, height, color, k) {
      const c = this.ctx, g = this.glowSprite(id, color), img = this.assets.spriteImage(id);
      if (!g || !img) return;
      const s = height / (img.height * g.sc), pulse = 1 + Math.sin(this.worldTime * 6) * .035;
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = U.clamp(k, 0, 1) * .9;
      c.translate(x, y - height / 2); c.scale(s * pulse * 1.06, s * pulse * 1.04);
      c.drawImage(g, -g.width / 2, -g.height / 2);
      c.restore();
      if (Math.random() < .3 * k) this.particles.push({ kind:'wisp', x:x + U.rand(-height * .25, height * .25), y:y - U.rand(0, height * .8), vy:-U.rand(40, 90), color, life:U.rand(.4, .8), max:.8, size:U.rand(1.5, 3) });
    }
    flames(x, y, height) { const c = this.ctx; c.save(); c.globalCompositeOperation = 'lighter'; for (let k = 0; k < 5; k++) { const fx = x + Math.sin(this.worldTime * 5 + k * 2) * height * .22, fy = y - height * (.2 + ((this.worldTime * .9 + k * .2) % 1) * .6); c.globalAlpha = .5; c.fillStyle = k % 2 ? '#ff8a4f' : '#ffc16b'; c.beginPath(); c.arc(fx, fy, 4 + (k % 3), 0, Math.PI * 2); c.fill(); } c.restore(); }
    stunStars(x, y) { const c = this.ctx; c.save(); c.fillStyle = '#ffe98a'; c.font = `16px ${UI_FONT}`; c.textAlign = 'center'; for (let k = 0; k < 3; k++) { const a = this.worldTime * 4 + k * 2.1; c.fillText('✦', x + Math.cos(a) * 26, y + Math.sin(a) * 7); } c.restore(); }
    bar(x, y, w, h, s, color, shieldPct) {
      const c = this.ctx, r = h / 2; c.save();
      this.roundRect(x - 2, y - 2, w + 4, h + 4, r + 2); c.fillStyle = 'rgba(10,8,24,.85)'; c.fill();
      this.roundRect(x, y, w, h, r); c.clip();
      c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(x, y, w, h);
      c.fillStyle = '#fff4d8'; c.fillRect(x, y, w * U.clamp(s.chip ?? 1, 0, 1), h);
      const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, this.lighten(color)); g.addColorStop(1, color); c.fillStyle = g; c.fillRect(x, y, w * U.clamp(s.dispHp ?? 1, 0, 1), h);
      if (shieldPct > 0) { c.fillStyle = 'rgba(143,233,255,.85)'; c.fillRect(x + w * U.clamp(s.dispHp ?? 1, 0, 1), y, w * Math.min(shieldPct, 1), h); }
      c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x, y, w, h * .4); c.restore();
    }
    thin(x, y, w, pct, color) { const c = this.ctx; c.fillStyle = 'rgba(10,8,24,.8)'; this.roundRect(x, y, w, 4, 2); c.fill(); c.fillStyle = color; this.roundRect(x, y, Math.max(0, w * pct), 4, 2); c.fill(); }
    lighten(hex) { const n = parseInt(hex.slice(1), 16); return `rgb(${Math.min(255, (n >> 16) + 60)},${Math.min(255, ((n >> 8) & 255) + 60)},${Math.min(255, (n & 255) + 60)})`; }
    roundRect(x, y, w, h, r) { const c = this.ctx; c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
    nameTag(text, x, y, strong, dot) {
      const c = this.ctx; c.save(); c.font = `${strong ? 700 : 600} 12px ${UI_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      const w = c.measureText(text).width + (dot ? 26 : 18); this.roundRect(x - w / 2, y - 10, w, 20, 10); c.fillStyle = 'rgba(12,10,30,.8)'; c.fill();
      c.strokeStyle = strong ? 'rgba(199,125,255,.8)' : 'rgba(255,255,255,.15)'; c.lineWidth = 1; c.stroke();
      if (dot) { c.fillStyle = dot; c.beginPath(); c.arc(x - w / 2 + 10, y, 4, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = strong ? '#f1dcff' : '#f3f1ff'; c.fillText(text, x + (dot ? 5 : 0), y + 1); c.restore();
    }
    drawProjectiles() {
      const c = this.ctx; c.save(); c.globalCompositeOperation = 'lighter';
      for (const p of this.projectiles) { if (p.kind) { this.drawProj(c, p); continue; }
        const k = U.clamp(p.t / p.dur, 0, 1); if (k >= 1) continue;
        const gl = this.fxTex('glow', p.color || '#ffd76a');
        for (let j = 0; j < 8; j++) { const kk = Math.max(0, k - j * .03), tx = p.x + (p.tx - p.x) * kk, ty = p.y + (p.ty - p.y) * kk - Math.sin(kk * Math.PI) * 40, r = 16 - j * 1.6; c.globalAlpha = .55 - j * .06; c.drawImage(gl, tx - r, ty - r, r * 2, r * 2); }
        const x = p.x + (p.tx - p.x) * k, y = p.y + (p.ty - p.y) * k - Math.sin(k * Math.PI) * 40; c.globalAlpha = 1; c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 3.5, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    }
    drawLoot() {
      const c = this.ctx;
      for (const l of this.loot) {
        const img = this.assets.item(l.item.icon, l.item.hue); let x = l.x, y = l.y, sc = 1;
        if (l.fly > 0) { const k = easeOut(l.fly); x = l.sx + (1235 - l.sx) * k; y = l.sy + (-20 - l.sy) * k - Math.sin(k * Math.PI) * 80; sc = 1 - k * .5; }
        const col = D.rarities.find(r => r.id === l.item.rarity)?.color || '#fff', rare = l.item.rarity !== 'common';
        c.save(); c.translate(x, y);
        if (rare && !l.fly) { c.globalCompositeOperation = 'lighter'; const bh = { legendary:220, mythic:260, set:180, epic:150 }[l.item.rarity] || 90; const g = c.createLinearGradient(0, -bh, 0, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, col); c.globalAlpha = .45 + .15 * Math.sin(this.worldTime * 6); c.fillStyle = g; c.fillRect(-9, -bh, 18, bh); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; }
        if (!l.fly) { c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(0, 22, 20, 6, 0, 0, Math.PI * 2); c.fill(); }
        c.scale(sc, sc); c.rotate(l.fly ? l.fly * 6 : Math.sin(this.worldTime * 3 + l.x) * .12); c.shadowColor = col; c.shadowBlur = 18;
        if (img) c.drawImage(img, -26, -26, 52, 52); else { c.fillStyle = col; c.fillRect(-12, -12, 24, 24); }
        c.restore();
      }
    }
    drawParticles() {
      const c = this.ctx; c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
      const glowK = this.intense ? 1 : .55;
      for (const p of this.particles) {
        const a = U.clamp(p.life / p.max, 0, 1), age = p.max - p.life;
        c.save(); c.globalAlpha = Math.min(1, a * 2.2) * (p.kind === 'num' || p.kind === 'label' ? 1 : glowK);
        if (p.kind === 'num' || p.kind === 'label') {
          const calm = !this.intense, pop = p.kind === 'num' ? (age < .12 ? 1 + (1 - age / .12) * (calm ? (p.crit ? .25 : .12) : (p.crit ? .9 : .5)) : 1) : easeOutBack(Math.min(1, age / .25));
          c.translate(p.x, p.y); c.scale(pop, pop); c.font = `800 ${p.size}px ${UI_FONT}`; c.lineJoin = 'round';
          c.lineWidth = calm ? (p.kind === 'num' ? 4.5 : 4) : (p.kind === 'num' ? 7 : 6); c.strokeStyle = 'rgba(14,10,20,.92)'; c.strokeText(p.text, 0, 0);
          if (p.crit && !calm) { c.shadowColor = '#ff9d2e'; c.shadowBlur = 16; }
          c.fillStyle = p.color; c.fillText(p.text, 0, 0);
        } else if (p.kind === 'ring') {
          const t = 1 - a, r = p.radius * (.3 + easeOut(t) * .9); c.globalCompositeOperation = 'lighter'; c.strokeStyle = p.color; c.lineWidth = 4 * a + 1; c.globalAlpha = a * .8;
          c.beginPath(); c.ellipse(p.x, p.y, r, r * .36, 0, 0, Math.PI * 2); c.stroke(); c.lineWidth = 1.5; c.globalAlpha = a * .45; c.beginPath(); c.ellipse(p.x, p.y, r * .78, r * .28, 0, 0, Math.PI * 2); c.stroke(); if (p.filled) { c.globalAlpha = a * .14; c.fillStyle = p.color; c.beginPath(); c.ellipse(p.x, p.y, r, r * .36, 0, 0, Math.PI * 2); c.fill(); }
        } else if (p.kind === 'shard') {
          c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.color; c.globalAlpha = a; c.beginPath(); c.moveTo(0, -p.size); c.lineTo(p.size * .45, 0); c.lineTo(0, p.size * .7); c.lineTo(-p.size * .4, 0); c.closePath(); c.fill();
          c.globalAlpha = a * .7; c.strokeStyle = '#fff'; c.lineWidth = 1; c.stroke();
        } else if (p.kind === 'slash') {
          const t = 1 - a; c.globalCompositeOperation = 'lighter'; c.translate(p.x, p.y); c.rotate(p.rot - .5 + easeOut(t) * 1.1); c.scale(p.size * (.62 + t * .22), p.size * .62);
          c.globalAlpha = a * .95; c.drawImage(this.fxTex('slash', p.color), -150, -80);
          c.globalAlpha = a * .5; c.strokeStyle = p.color; c.lineWidth = 2; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(-40, i * 22); c.lineTo(-40 - 50 * a, i * 22 - 8); c.stroke(); }
        } else if (p.kind === 'spark' || p.kind === 'rise') {
          c.globalCompositeOperation = 'lighter'; c.globalAlpha *= .75; const r = p.size * (p.kind === 'spark' ? .6 + a * .6 : 1) * 3.2;
          if (p.kind === 'spark' && (p.vx || p.vy)) { c.strokeStyle = p.color; c.lineCap = 'round'; c.lineWidth = p.size * .8 * a; c.globalAlpha *= .6; c.beginPath(); c.moveTo(p.x - p.vx * .035, p.y - p.vy * .035); c.lineTo(p.x, p.y); c.stroke(); c.globalAlpha /= .6; }
          c.drawImage(this.fxTex('glow', p.color), p.x - r, p.y - r, r * 2, r * 2);
        } else if (p.kind === 'impact') {
          const t = 1 - a, k = (.55 + easeOut(Math.min(1, t * 2.2)) * .65) * p.size; c.globalCompositeOperation = 'lighter'; c.globalAlpha = a;
          c.translate(p.x, p.y); c.rotate(p.rot + t * .6); c.scale(k, k); c.drawImage(this.fxTex('star', p.color), -64, -64);
        }
        else if (p.kind === 'wisp') { c.globalCompositeOperation = 'lighter'; c.fillStyle = p.color; c.globalAlpha = a * .5; c.beginPath(); c.ellipse(p.x, p.y, p.size * .7, p.size * 2.6, 0, 0, Math.PI * 2); c.fill(); }
        else if (p.kind === 'beam') {
          c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; const dx = p.tx - p.x, dy = p.ty - p.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
          c.strokeStyle = p.color; c.globalAlpha = a * .16; c.lineWidth = 30 * a; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.tx, p.ty); c.stroke();
          c.globalAlpha = a * .45; c.lineWidth = 9 * a; c.beginPath(); c.moveTo(p.x, p.y);
          for (let i = 1; i <= 10; i++) { const k = i / 10, j = Math.sin(this.worldTime * 60 + i * 2.3) * 5 * a * (i < 10 ? 1 : 0); c.lineTo(p.x + dx * k + nx * j, p.y + dy * k + ny * j); } c.stroke();
          c.strokeStyle = '#fff6e6'; c.globalAlpha = a * .7; c.lineWidth = 2.5 * a; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.tx, p.ty); c.stroke();
          const gl = this.fxTex('glow', p.color); c.globalAlpha = a * .8;
          for (let i = 0; i < 5; i++) { const k = ((1 - a) * 2.2 + i / 5) % 1, r = 10 + 6 * Math.sin(i + this.worldTime * 20); c.drawImage(gl, p.x + dx * k - r, p.y + dy * k - r, r * 2, r * 2); }
          const r2 = 34 * a; c.drawImage(gl, p.tx - r2, p.ty - r2, r2 * 2, r2 * 2);
        }
        else if (p.kind === 'bosswave') { const r = (1 - a) * 560; c.globalCompositeOperation = 'lighter'; c.strokeStyle = p.color; c.lineWidth = 12 * a; c.globalAlpha = a * .6; c.beginPath(); c.ellipse(p.x, p.y, r, r * .36, 0, 0, Math.PI * 2); c.stroke(); }
        c.restore();
      }
      c.restore();
    }
    drawOverlay() {
      const c = this.ctx;
      if (this.engine.enemies.some(e => e.alive && (e.windup > 0 || e.striking))) { const pulse = .5 + .5 * Math.sin(this.worldTime * (this.intense ? 16 : 5)), k = this.intense ? 1 : .45; const g = c.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .9); g.addColorStop(0, 'rgba(255,0,40,0)'); g.addColorStop(1, `rgba(200,40,50,${(.22 + .18 * pulse) * k})`); c.fillStyle = g; c.fillRect(0, 0, W, H); }
      if (this.screenFlash) { c.save(); c.globalAlpha = (this.screenFlash.t / this.screenFlash.max) * (this.screenFlash.strong ? .24 : this.intense ? .14 : .05); c.globalCompositeOperation = 'screen'; c.fillStyle = this.screenFlash.color; c.fillRect(0, 0, W, H); c.restore(); }
      if (this.engine.pendingRoute || this.engine.pendingEncounter || this.engine.paused) { c.fillStyle = 'rgba(6,4,18,.45)'; c.fillRect(0, 0, W, H); }
    }
    portrait(sprite) {
      let img = this.portraits.get(sprite); if (!img) { img = new Image(); img.src = KT.portraitUrl(sprite); this.portraits.set(sprite, img); }
      return img.complete && img.naturalWidth ? img : null;
    }
    drawCutin() {
      const ci = this.cutin; if (!ci || !ci.unit) return;
      if (!this.intense) {
        const c = this.ctx, k = ci.t / ci.dur, inK = easeOut(Math.min(1, ci.t / .2)), outK = k > .8 ? (k - .8) / .2 : 0;
        const w = 460, h = 64, x = 24 - (1 - inK) * 40, y = this.banner ? 196 : 118; // abaixo da faixa de estágio quando as duas aparecem juntas
        c.save(); c.globalAlpha = inK * (1 - outK);
        c.fillStyle = 'rgba(14,12,20,.86)'; c.fillRect(x, y, w, h); c.fillStyle = ci.color; c.fillRect(x, y, 3, h);
        const img = this.portrait(ci.unit.sprite); if (img) { c.save(); c.beginPath(); c.rect(x + 3, y, 64, h); c.clip(); c.drawImage(img, x + 3, y - 4, 72, 72); c.restore(); }
        c.textAlign = 'left'; c.textBaseline = 'alphabetic';
        c.font = `600 13px ${UI_FONT}`; c.fillStyle = 'rgba(239,230,212,.72)'; c.fillText(`${ci.unit.name} · ultimate`, x + 80, y + 24);
        c.font = `800 24px ${DISPLAY_FONT_W}`; c.fillStyle = '#efe6d4'; c.fillText(ci.name, x + 80, y + 52, w - 96);
        c.restore(); return;
      }
      const c = this.ctx, k = ci.t / ci.dur, inK = easeOut(Math.min(1, ci.t / .18)), outK = k > .78 ? easeOut((k - .78) / .22) : 0;
      const y = 250, h = ci.manual ? 170 : 110, slide = (1 - inK) * -W + outK * W;
      c.save(); c.globalAlpha = 1 - outK * .6; c.translate(slide, ci.manual ? 0 : 40);
      c.beginPath(); c.moveTo(0, y + 26); c.lineTo(W, y - 10); c.lineTo(W, y + h - 26); c.lineTo(0, y + h + 10); c.closePath();
      const g = c.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(10,8,26,.94)'); g.addColorStop(.55, 'rgba(10,8,26,.82)'); g.addColorStop(1, 'rgba(10,8,26,0)'); c.fillStyle = g; c.fill();
      c.save(); c.clip(); c.strokeStyle = ci.color; c.lineWidth = 2;
      for (let i = 0; i < 14; i++) { const ly = y + (i * 37 + ci.t * 900) % h; c.globalAlpha = .18; c.beginPath(); c.moveTo(0, ly); c.lineTo(W, ly - 20); c.stroke(); }
      c.globalAlpha = 1; const img = this.portrait(ci.unit.sprite); if (img) { const s = ci.manual ? 250 : 170; c.drawImage(img, 120 + ci.t * 30, y + h / 2 - s / 2 + 10, s, s); }
      c.restore();
      c.fillStyle = ci.color; c.fillRect(0, y + 22, W, 4); c.fillRect(0, y + h + 6, W, 4);
      c.textAlign = 'left'; c.textBaseline = 'middle'; const tx = ci.manual ? 420 : 330;
      c.font = `600 17px ${UI_FONT}`; c.fillStyle = 'rgba(255,255,255,.8)'; c.fillText(`${ci.unit.name.toUpperCase()} · ULTIMATE`, tx, y + (ci.manual ? 60 : 44));
      c.font = `800 ${ci.manual ? 58 : 40}px ${DISPLAY_FONT_W}`; c.lineJoin = 'round'; c.lineWidth = 8; c.strokeStyle = '#0c0820'; c.strokeText(ci.name, tx, y + (ci.manual ? 110 : 80));
      c.shadowColor = ci.color; c.shadowBlur = 20; c.fillStyle = '#fff'; c.fillText(ci.name, tx, y + (ci.manual ? 110 : 80));
      c.restore();
    }
    // Contador do Elo Kizuna (canto superior direito do palco).
    drawChain() {
      const f = this.chainFx; if (!f) return;
      if (!this.intense) {
        const c = this.ctx, k = f.t / f.dur, fade = k > .7 ? 1 - (k - .7) / .3 : 1;
        c.save(); c.globalAlpha = fade * Math.min(1, f.t / .15); c.textAlign = 'right'; c.textBaseline = 'alphabetic';
        const x = W - 32, y = 150; c.fillStyle = 'rgba(14,12,20,.8)'; c.fillRect(x - 196, y - 38, 200, 58); c.fillStyle = '#d8b062'; c.fillRect(x + 1, y - 38, 3, 58);
        c.font = `600 12px ${UI_FONT}`; c.fillStyle = 'rgba(239,230,212,.7)'; c.fillText(`Elo Kizuna · +${f.n * 15 - 15}% nas ultimates`, x - 10, y - 18);
        c.font = `800 26px ${DISPLAY_FONT_W}`; c.fillStyle = '#efe6d4'; c.fillText(`×${f.n}`, x - 10, y + 10);
        c.restore(); return;
      }
      const c = this.ctx, k = f.t / f.dur, pop = easeOutBack(Math.min(1, f.t / .25)), fade = k > .7 ? 1 - (k - .7) / .3 : 1;
      c.save(); c.globalAlpha = fade; c.translate(W - 170, 150); c.scale(pop, pop); c.rotate(-.06); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
      c.font = `800 22px ${DISPLAY_FONT_W}`; c.lineWidth = 6; c.strokeStyle = '#1a0a1e'; c.strokeText('ELO KIZUNA', 0, -34); c.fillStyle = '#efe7d8'; c.fillText('ELO KIZUNA', 0, -34);
      c.font = `800 72px ${DISPLAY_FONT_W}`; c.lineWidth = 10; c.strokeText(`×${f.n}`, 0, 16); c.shadowColor = f.color; c.shadowBlur = 22; c.fillStyle = '#fff6df'; c.fillText(`×${f.n}`, 0, 16); c.shadowBlur = 0;
      c.font = `600 15px ${UI_FONT}`; c.fillStyle = '#ffd1e8'; c.fillText(`+${f.n * 15 - 15}% nas ultimates`, 0, 60);
      c.restore();
    }
    drawBanner() {
      const b = this.banner; if (!b) return;
      if (!this.intense) {
        const c = this.ctx, k = b.t / b.dur, inK = easeOut(Math.min(1, b.t / .25)), fade = k > .75 ? 1 - (k - .75) / .25 : 1;
        c.save(); c.globalAlpha = fade * inK; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
        const y = 176; c.fillStyle = 'rgba(14,12,20,.72)'; c.fillRect(W / 2 - 260, y - 44, 520, b.sub ? 74 : 56); c.fillStyle = b.color; c.fillRect(W / 2 - 260, y - 44, 520, 2);
        c.font = `800 32px ${DISPLAY_FONT_W}`; c.fillStyle = '#efe6d4'; c.fillText(b.title, W / 2, y - 4);
        if (b.sub) { c.font = `600 14px ${UI_FONT}`; c.fillStyle = 'rgba(239,230,212,.72)'; c.fillText(b.sub, W / 2, y + 20); }
        c.restore(); return;
      }
      const c = this.ctx, k = b.t / b.dur, inK = easeOutBack(Math.min(1, b.t / .35)), fade = k > .75 ? 1 - (k - .75) / .25 : 1;
      c.save(); c.globalAlpha = fade; c.textAlign = 'center'; c.textBaseline = 'middle';
      const y = 200, band = c.createLinearGradient(0, 0, W, 0); band.addColorStop(0, 'rgba(10,8,26,0)'); band.addColorStop(.5, 'rgba(10,8,26,.8)'); band.addColorStop(1, 'rgba(10,8,26,0)');
      c.fillStyle = band; c.fillRect(0, y - 58 * inK, W, 116 * inK);
      c.fillStyle = b.color; c.fillRect(W / 2 - 220 * inK, y - 58 * inK, 440 * inK, 2); c.fillRect(W / 2 - 220 * inK, y + 56 * inK, 440 * inK, 2);
      c.translate(W / 2, y - 8); c.scale(inK, inK);
      c.font = `800 60px ${DISPLAY_FONT_W}`; c.lineJoin = 'round'; c.lineWidth = 9; c.strokeStyle = '#0c0820'; c.strokeText(b.title, 0, 0);
      c.shadowColor = b.color; c.shadowBlur = 24; c.fillStyle = '#fff6df'; c.fillText(b.title, 0, 0); c.shadowBlur = 0;
      if (b.sub) { c.font = `600 19px ${UI_FONT}`; c.fillStyle = b.color; c.fillText(b.sub.toUpperCase(), 0, 42); }
      c.restore();
    }
    enemyAt(px, py) { const hits = this.hotspots.filter(h => h.enemy && px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h); return hits.length ? hits[hits.length - 1].enemy : null; }
  }
  KT.GameRenderer = GameRenderer;
})();
