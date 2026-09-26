(() => {
  const KT = globalThis.KT = globalThis.KT || {};
  const U = KT.Utils, D = KT.Data;
  const W = 1280, H = 720;
  const DISPLAY_FONT = '"Lilita One", "Arial Black", Impact, sans-serif';
  const UI_FONT = 'Outfit, "Segoe UI", system-ui, sans-serif';

  // Vagas 1–2 = linha de frente (mais perto dos inimigos); 3–4 = retaguarda.
  const HERO_POS = [{x:480,y:552},{x:490,y:668},{x:335,y:600},{x:200,y:656}];
  const ENEMY_POS = [{x:820,y:552},{x:815,y:668},{x:975,y:600},{x:1115,y:655},{x:1120,y:540}];
  const BOSS_POS = {x:990,y:640};
  const BOSS_ADDS = [{x:790,y:560},{x:790,y:675},{x:1170,y:560},{x:1175,y:680}];
  const VILLAGE_POS = [{x:565,y:392},{x:645,y:412},{x:725,y:392},{x:805,y:412}];
  const HERO_H = 176, ENEMY_H = 158, ELITE_H = 205;
  const RANGED = new Set(['Arcanista','Suporte','Atirador']);

  const THEMES = {
    village:{ grade:'rgba(255,170,120,.08)', ambient:'petal' }, forest:{ grade:'rgba(255,120,160,.10)', ambient:'petal' },
    coast:{ grade:'rgba(80,190,255,.12)', ambient:'bubble' }, dungeon:{ grade:'rgba(120,90,220,.14)', ambient:'mote' },
    archive:{ grade:'rgba(40,170,210,.16)', ambient:'bubble' }, boss:{ grade:'rgba(255,90,90,.12)', ambient:'ember' }, abyss:{ grade:'rgba(20,120,200,.18)', ambient:'bubble' }
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
      this.resize();
      if (globalThis.ResizeObserver) new ResizeObserver(() => this.resize()).observe(canvas);
      addEventListener('resize', () => this.resize());
    }
    resize() {
      const rect = this.canvas.getBoundingClientRect(); if (!rect.width) return;
      const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
      const w = Math.round(rect.width * dpr), h = Math.round(rect.width * dpr * H / W);
      if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
      this.scale = w / W;
    }
    toLogical(cx, cy) { const r = this.canvas.getBoundingClientRect(); return { x:(cx - r.left) / r.width * W, y:(cy - r.top) / r.height * H }; }

    // ---------- atores ----------
    v(uid) { let s = this.vis.get(uid); if (!s) { s = { lunge:null, hit:0, hitDir:1, flash:0, dispHp:null, chip:null, death:0, spawn:0, cast:0, castColor:'#fff', level:0, shieldHit:0, revive:0 }; this.vis.set(uid, s); } return s; }
    unit(uid) { return this.engine.party.find(u => u.uid === uid) || this.engine.enemies.find(u => u.uid === uid); }
    heroPos(u) { return HERO_POS[u.slot] || HERO_POS[0]; }
    enemyPos(u) {
      const list = this.engine.enemies, i = list.indexOf(u);
      const boss = list.find(e => e.boss);
      if (u.boss) return BOSS_POS;
      if (boss) { const adds = list.filter(e => !e.boss); return BOSS_ADDS[adds.indexOf(u) % BOSS_ADDS.length]; }
      return ENEMY_POS[i] || ENEMY_POS[i % ENEMY_POS.length];
    }
    enemyHeight(e) { return e.boss ? (e.sprite === 'lantern_kitsune' ? 330 : 390) : e.miniboss ? 250 : e.elite ? ELITE_H : e.treasure ? 120 : ENEMY_H; }
    posOf(uid) {
      const u = this.unit(uid); if (!u) return null;
      if (u.side === 'hero') return { ...this.heroPos(u), h:HERO_H, u };
      return { ...this.enemyPos(u), h:this.enemyHeight(u), u };
    }

    // ---------- eventos ----------
    emit(fx) {
      if (!fx) return;
      const t = fx.type;
      if (t === 'hitstop') { this.hitstop = Math.max(this.hitstop, fx.time || .05); return; }
      if (t === 'attack') {
        const a = this.posOf(fx.source), b = this.posOf(fx.target); if (!a || !b) return;
        const ranged = RANGED.has(fx.role);
        this.v(fx.source).lunge = { t:0, dur:ranged ? .34 : .3, dx:ranged ? 16 : (b.x - a.x) * .42, dy:ranged ? -6 : (b.y - a.y) * .42, hop:ranged };
        if (ranged) this.projectiles.push({ x:a.x + 30, y:a.y - a.h * .55, tx:b.x, ty:b.y - b.h * .45, t:0, dur:.22, color:fx.color });
        else this.later(.12, () => { this.particles.push({ kind:'slash', x:b.x, y:b.y - b.h * .5, color:fx.color || '#fff', life:.26, max:.26, rot:U.rand(-.6, .6), size:1 }); });
        return;
      }
      if (t === 'enemyAttack') { const a = this.posOf(fx.source), b = this.posOf(fx.target); if (a && b) this.v(fx.source).lunge = { t:0, dur:.32, dx:(b.x - a.x) * .3, dy:(b.y - a.y) * .3 }; return; }
      if (t === 'damage') {
        const p = this.posOf(fx.uid); if (!p) return;
        const hero = fx.side === 'hero', dot = fx.kind === 'dot';
        const delay = fx.kind === 'basic' ? .12 : 0;
        this.later(delay, () => {
          if (!dot) this.hitActor(fx.uid, hero ? -1 : 1, fx.crit ? .9 : .55);
          const color = fx.color || (hero ? '#ff6b6b' : fx.crit ? '#ffd76a' : '#ffffff');
          this.number(p.x + U.rand(-26, 26), p.y - p.h - 8, fx.value, color, fx.crit, hero, dot);
          if (fx.weak && !dot) this.text(p.x + 40, p.y - p.h + 14, 'FRACO!', '#ffe28a', 15, .8);
          if (fx.resist && !dot) this.text(p.x + 40, p.y - p.h + 14, 'RESISTE', '#aab4c8', 14, .8);
          if (!dot) this.sparks(p.x, p.y - p.h * .5, fx.crit ? 12 : 5, fx.crit ? '#ffe28a' : hero ? '#ff8a8a' : '#ffffff', fx.crit ? 320 : 200);
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
        this.ring(p.x, p.y, fx.color, fx.ult ? 150 : 90);
        this.text(p.x, p.y - p.h - 34, fx.name, fx.enemy ? '#ffb0b8' : fx.color, fx.ult ? 22 : 18, 1.1);
        if (fx.ult) { const u = this.unit(fx.source); this.cutin = { t:0, dur:fx.manual ? 1.1 : .8, unit:u, color:fx.color, name:fx.name, manual:fx.manual }; this.screenFlash = { color:fx.color, t:.2, max:.2 }; }
        return;
      }
      if (t === 'burst' || t === 'aoe') {
        const a = fx.source && this.posOf(fx.source);
        if (t === 'aoe') { this.engine.enemies.concat(this.engine.party).forEach(u => { if (!u.alive || (a && a.u.side === u.side)) return; const q = this.posOf(u.uid); if (q) this.later(.08, () => { this.ring(q.x, q.y, fx.color, 110); this.sparks(q.x, q.y - 60, 8, fx.color, 240); }); }); this.shake = Math.max(this.shake, 6); return; }
        const p = fx.target && this.posOf(fx.target); if (!p) return;
        if (a) this.particles.push({ kind:'beam', x:a.x + (a.u.side === 'hero' ? 20 : -20), y:a.y - a.h * .55, tx:p.x, ty:p.y - p.h * .5, color:fx.color, life:.32, max:.32 });
        this.later(.06, () => { this.ring(p.x, p.y - p.h * .45, fx.color, 100, true); this.sparks(p.x, p.y - p.h * .5, 14, fx.color, 360); this.shake = Math.max(this.shake, 7); });
        return;
      }
      if (t === 'death') {
        const s = this.v(fx.uid), p = this.posOf(fx.uid); s.death = .0001;
        if (p) this.later(.1, () => { this.sparks(p.x, p.y - p.h * .45, fx.boss ? 60 : 20, '#ffe7b0', fx.boss ? 520 : 300); this.ring(p.x, p.y, '#ffffff', fx.boss ? 260 : 110); });
        if (fx.boss) { this.shake = 18; this.screenFlash = { color:'#ffffff', t:.6, max:.6 }; this.hitstop = .3; }
        return;
      }
      if (t === 'heroDown') { const p = this.posOf(fx.uid); if (p) this.text(p.x, p.y - 40, 'K.O.', '#ff7a7a', 28, 1.4); return; }
      if (t === 'levelUp') {
        const p = this.posOf(fx.uid); if (!p) return;
        this.v(fx.uid).level = 1.4; this.text(p.x, p.y - p.h - 44, 'LEVEL UP!', '#ffd76a', 26, 1.6);
        for (let i = 0; i < 22; i++) this.particles.push({ kind:'rise', x:p.x + U.rand(-45, 45), y:p.y - U.rand(0, 20), vy:-U.rand(120, 260), color:'#ffd76a', life:U.rand(.7, 1.3), max:1.3, size:U.rand(2, 4) });
        return;
      }
      if (t === 'bossWindup') { this.shake = Math.max(this.shake, 4); return; }
      if (t === 'bossBurst') {
        const p = this.posOf(fx.uid);
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
      const txt = typeof value === 'number' ? U.fmt(value) : String(value);
      this.particles.push({ kind:'num', x, y, vx:U.rand(-40, 40), vy:crit ? -170 : dot ? -70 : -130, text:crit ? `${txt}!` : hurt ? `-${txt}` : txt, color, life:crit ? 1.15 : .9, max:crit ? 1.15 : .9, size:crit ? 44 : dot ? 20 : hurt ? 26 : 30, crit });
    }
    text(x, y, text, color, size = 20, life = 1, fixed = false) { this.particles.push({ kind:'label', x, y, text, color, size, life, max:life, fixed }); }
    ring(x, y, color, radius = 80, filled = false) { this.particles.push({ kind:'ring', x, y, color, radius, life:.5, max:.5, filled }); }
    sparks(x, y, n, color, speed = 260) { for (let i = 0; i < n; i++) { const a = U.rand(0, Math.PI * 2), sp = U.rand(.35, 1) * speed; this.particles.push({ kind:'spark', x, y, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp - 60, color, life:U.rand(.25, .55), max:.55, size:U.rand(2, 4.5) }); } }
    showBanner(title, sub = '', color = '#ffd76a') { this.banner = { title, sub, color, t:0, dur:1.9 }; }

    // ---------- atualização ----------
    update(dt) {
      this.worldTime += dt; this.shake = Math.max(0, this.shake - dt * 40); this.hitstop = Math.max(0, this.hitstop - dt);
      if (this.engine.zone.id !== this.zoneId || this.engine.party !== this.lastParty) {
        if (this.engine.zone.id !== this.zoneId) { this.zoneId = this.engine.zone.id; this.zoneFade = 0; this.particles = []; this.loot = []; this.projectiles = []; this.delayed = []; this.seedAmbient(); }
        this.lastParty = this.engine.party; this.vis.clear();
      }
      this.zoneFade = Math.min(1, this.zoneFade + dt * 2.2);
      this.delayed.forEach(d => d.t -= dt);
      const ready = this.delayed.filter(d => d.t <= 0); this.delayed = this.delayed.filter(d => d.t > 0); ready.forEach(d => d.fn());
      for (const s of this.vis.values()) {
        if (s.lunge) { s.lunge.t += dt; if (s.lunge.t >= s.lunge.dur) s.lunge = null; }
        s.hit = Math.max(0, s.hit - dt); s.flash = Math.max(0, s.flash - dt); s.cast = Math.max(0, s.cast - dt); s.level = Math.max(0, s.level - dt); s.shieldHit = Math.max(0, s.shieldHit - dt); s.revive = Math.max(0, s.revive - dt);
        if (s.death > 0) s.death += dt;
        s.spawn = Math.min(1, s.spawn + dt * 2.4);
      }
      for (const p of this.particles) {
        p.life -= dt;
        if (p.kind === 'num') { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.vx *= .96; }
        else if (p.kind === 'label') { if (!p.fixed) p.y -= dt * 26; }
        else if (p.kind === 'spark') { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 520 * dt; p.vx *= .97; }
        else if (p.kind === 'rise' || p.kind === 'wisp') { p.y += p.vy * dt; p.x += Math.sin(this.worldTime * 6 + p.y * .05) * .5; }
      }
      this.particles = this.particles.filter(p => p.life > 0);
      if (this.particles.length > 700) this.particles.splice(0, this.particles.length - 700);
      for (const pr of this.projectiles) { pr.t += dt; if (pr.t >= pr.dur && !pr.done) { pr.done = true; this.sparks(pr.tx, pr.ty, 7, pr.color, 240); this.ring(pr.tx, pr.ty + 30, pr.color, 50); } }
      this.projectiles = this.projectiles.filter(p => p.t < p.dur + .05);
      for (const l of this.loot) {
        l.t += dt;
        if (l.t < 1.3) { l.x += l.vx * dt; l.vy += 900 * dt; l.y += l.vy * dt; if (l.y > l.gy) { l.y = l.gy; l.vy *= -.35; l.vx *= .6; } }
        else { if (!l.fly) { l.fly = .0001; l.sx = l.x; l.sy = l.y; } l.fly += dt * 1.6; }
      }
      this.loot = this.loot.filter(l => l.fly < 1);
      for (const a of this.ambient) { a.x += a.vx * dt; a.y += a.vy * dt; a.r += a.vr * dt; if (a.y > H + 20) a.y = -20; if (a.y < -30) a.y = H + 20; if (a.x > W + 20) a.x = -20; if (a.x < -20) a.x = W + 20; }
      if (this.screenFlash) { this.screenFlash.t -= dt; if (this.screenFlash.t <= 0) this.screenFlash = null; }
      if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.dur) this.banner = null; }
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
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.canvas.width, this.canvas.height); c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      c.save();
      if (this.shake > 0) c.translate(U.rand(-this.shake, this.shake) * .6, U.rand(-this.shake, this.shake) * .6);
      this.hotspots = [];
      this.drawScene(); this.drawAmbient(true); this.drawDanger(); this.drawActors(); this.drawProjectiles(); this.drawLoot(); this.drawParticles(); this.drawAmbient(false);
      c.restore();
      this.drawOverlay(); this.drawCutin(); this.drawBanner();
    }
    drawScene() {
      const c = this.ctx, z = this.engine.zone, img = this.assets.scene(z.id);
      const moving = this.engine.phase === 'between' || this.engine.phase === 'stageClear';
      const zoom = 1.04 + Math.sin(this.worldTime * .08) * .012 + (moving ? .02 : 0);
      const dx = Math.sin(this.worldTime * .05) * 10;
      if (img) { const sw = W * zoom, sh = H * zoom; c.drawImage(img, (W - sw) / 2 + dx, (H - sh) / 2 - 6, sw, sh); } else { c.fillStyle = '#141833'; c.fillRect(0, 0, W, H); }
      c.fillStyle = (THEMES[z.theme] || THEMES.village).grade; c.fillRect(0, 0, W, H);
      const floor = c.createLinearGradient(0, H * .55, 0, H); floor.addColorStop(0, 'rgba(8,6,20,0)'); floor.addColorStop(1, 'rgba(8,6,20,.45)'); c.fillStyle = floor; c.fillRect(0, 0, W, H);
      const vig = c.createRadialGradient(W / 2, H * .55, H * .35, W / 2, H * .55, H * .95); vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(6,4,18,.62)'); c.fillStyle = vig; c.fillRect(0, 0, W, H);
      if (this.zoneFade < 1) { c.fillStyle = `rgba(8,6,20,${1 - easeOut(this.zoneFade)})`; c.fillRect(0, 0, W, H); }
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
      const e = this.engine.enemies.find(x => x.alive && x.windup > 0); if (!e) return;
      const sp = e.windupSpecial, c = this.ctx, p = 1 - e.windup / (e.windupMax || 1.5), pulse = .5 + .5 * Math.sin(this.worldTime * 18);
      const effs = sp?.eff || [];
      const zones = effs.some(x => x.to === 'all') ? [{ x:340, y:612, rx:310, ry:110 }] : effs.some(x => x.to === 'back') ? [{ x:265, y:628, rx:150, ry:70 }] : effs.some(x => x.to === 'front') ? [{ x:485, y:610, rx:120, ry:95 }] : [{ x:340, y:612, rx:310, ry:110 }];
      zones.forEach(zn => {
        c.save(); c.translate(zn.x, zn.y);
        c.fillStyle = `rgba(255,40,70,${.1 + .12 * p})`; c.strokeStyle = `rgba(255,90,110,${.55 + .4 * pulse})`; c.lineWidth = 4; c.setLineDash([16, 10]); c.lineDashOffset = -this.worldTime * 60;
        c.beginPath(); c.ellipse(0, 0, zn.rx, zn.ry, 0, 0, Math.PI * 2); c.fill(); c.stroke();
        c.setLineDash([]); c.fillStyle = `rgba(255,60,80,${.25 + .2 * pulse})`; c.beginPath(); c.ellipse(0, 0, zn.rx * p, zn.ry * p, 0, 0, Math.PI * 2); c.fill();
        c.restore();
      });
    }

    drawActors() {
      const village = this.engine.zone.kind === 'village', list = [];
      if (village) {
        this.engine.state.formation.forEach((uid, i) => { const r = uid && this.engine.record(uid); if (r) list.push({ r, t:this.engine.template(r.id), pos:VILLAGE_POS[i] }); });
        list.forEach(o => { this.drawSprite(o.t.sprite, o.pos.x, o.pos.y + Math.sin(this.worldTime * 2 + o.pos.x) * 1.5, 118, { sy:1 + Math.sin(this.worldTime * 2.4 + o.pos.x) * .015 }); this.nameTag(`${o.t.name} · Nv.${o.r.level}`, o.pos.x, o.pos.y + 16); });
        return;
      }
      this.engine.party.forEach(u => list.push({ u, pos:this.heroPos(u) }));
      this.engine.enemies.forEach(u => list.push({ u, pos:this.enemyPos(u) }));
      list.sort((a, b) => a.pos.y - b.pos.y);
      list.forEach(o => o.u.side === 'hero' ? this.drawHero(o.u, o.pos) : this.drawEnemy(o.u, o.pos));
    }
    actorOffset(s, dirSign) {
      let x = 0, y = 0;
      if (s.lunge) { const k = s.lunge.t / s.lunge.dur, f = k < .35 ? easeOut(k / .35) : 1 - easeOut((k - .35) / .65); x += s.lunge.dx * f; y += s.lunge.dy * f; if (s.lunge.hop) y -= Math.sin(k * Math.PI) * 18; }
      if (s.hit > 0) x -= dirSign * s.hitDir * 16 * (s.hit / .3);
      return { x, y };
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
      const c = this.ctx, s = this.v(u.uid), alive = u.alive, t = this.worldTime + u.slot * .7;
      const moving = this.engine.phase === 'between' && alive;
      const off = this.actorOffset(s, 1), run = moving ? Math.abs(Math.sin(t * 11)) * 8 : 0;
      const x = pos.x + off.x + (moving ? 14 : 0), y = pos.y + off.y - run;
      c.save(); c.fillStyle = 'rgba(0,0,0,.42)'; c.beginPath(); c.ellipse(pos.x + off.x, pos.y + 4, 46, 13, 0, 0, Math.PI * 2); c.fill(); c.restore();
      const ultReady = alive && u.energy >= 100;
      if (alive) this.runeCircle(pos.x + off.x, pos.y + 4, 54, u.color, ultReady ? .95 : .45, ultReady ? 1.8 : .5);
      if (s.cast > 0) this.aura(u.sprite, x, y, HERO_H, s.castColor, s.cast);
      else if (ultReady) this.aura(u.sprite, x, y, HERO_H, u.color, .55 + .25 * Math.sin(t * 5));
      if (s.level > 0) this.aura(u.sprite, x, y, HERO_H, '#ffd76a', s.level / 1.4);
      if (s.revive > 0) this.aura(u.sprite, x, y, HERO_H, '#ffe19a', s.revive);
      const stealth = u.effects.some(e => e.s === 'stealth');
      this.drawSprite(u.sprite, x, y, HERO_H, { sy:alive ? 1 + Math.sin(t * 2.6) * .018 : 1, flash:s.flash / .24, alpha:alive ? (stealth ? .45 : 1) : .35, gray:!alive, tilt:alive ? 0 : -.25 });
      if (u.shield > 0 && alive) { const sh = s.shieldHit > 0 ? .9 : .35 + .1 * Math.sin(t * 4); c.save(); c.globalAlpha = sh; c.strokeStyle = '#8fe9ff'; c.lineWidth = 3; c.fillStyle = 'rgba(120,220,255,.12)'; c.beginPath(); c.ellipse(x, y - HERO_H * .48, 62, HERO_H * .6, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.restore(); }
      if (!alive) return;
      this.statusIcons(u, pos.x - 44, y - HERO_H - 28);
      if (u.effects.some(e => e.s === 'stun' || e.s === 'freeze')) this.stunStars(x, y - HERO_H - 6);
      this.bar(pos.x - 44, y - HERO_H - 16, 88, 9, s, '#57e389', u.shield / u.maxHp);
      this.thin(pos.x - 44, y - HERO_H - 5, 88, U.clamp(u.energy / 100, 0, 1), ultReady ? '#ffd76a' : '#e0a93b');
    }
    drawEnemy(e, pos) {
      const c = this.ctx, s = this.v(e.uid), t = this.worldTime + pos.x * .01, dying = !e.alive;
      if (dying && (s.death > .9 || e.fled)) return;
      const off = this.actorOffset(s, -1), height = this.enemyHeight(e), enter = easeOut(s.spawn);
      const x = pos.x + off.x + (1 - enter) * 240, y = pos.y + off.y, floatY = e.sprite.startsWith('wisp') ? Math.sin(t * 2.4) * 10 - 16 : 0;
      c.save(); c.globalAlpha = enter * (dying ? Math.max(0, 1 - s.death / .9) : 1);
      c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.ellipse(pos.x + off.x, pos.y + 4, height * (e.boss ? .42 : .3), height * .08, 0, 0, Math.PI * 2); c.fill();
      const focused = this.engine.focusUid === e.uid, hovered = this.hoverEnemy === e.uid;
      if ((focused || hovered) && !dying) { c.save(); c.translate(pos.x + off.x, pos.y + 4); c.strokeStyle = focused ? '#ffd76a' : 'rgba(255,255,255,.6)'; c.lineWidth = 3; const r = height * (e.boss ? .42 : .34); for (let k = 0; k < 4; k++) { const a0 = this.worldTime * 1.6 + k * Math.PI / 2; c.beginPath(); c.ellipse(0, 0, r, r * .3, a0 * 0, a0, a0 + .9); c.stroke(); } c.restore(); }
      if ((e.elite || e.miniboss) && !dying) this.aura(e.sprite, x, y + floatY, height, e.miniboss ? '#ff9a3b' : '#c77dff', .5 + .15 * Math.sin(t * 3));
      if (e.treasure && !dying) this.aura(e.sprite, x, y, height, '#ffd76a', .8);
      if (e.windup > 0) this.aura(e.sprite, x, y, height, '#ff3a5a', .6 + .4 * Math.sin(this.worldTime * 20));
      this.drawSprite(e.sprite, x, y + floatY + (dying ? s.death * 30 : 0), height, { sy:1 + Math.sin(t * 2.2) * .022, flash:dying ? Math.max(0, 1 - s.death * 4) : s.flash / .24, alpha:1 });
      c.restore();
      if (dying) return;
      if (e.effects.some(x => x.s === 'burn')) this.flames(x, y, height);
      if (e.effects.some(x => x.s === 'stun' || x.s === 'freeze')) this.stunStars(x, y - height - 4);
      if (e.effects.some(x => x.s === 'freeze')) { c.save(); c.globalAlpha = .35; c.fillStyle = '#bff4ff'; c.beginPath(); c.ellipse(x, y - height * .45, height * .32, height * .5, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
      if (!e.boss) {
        const top = y + floatY - height - 14, bw = e.miniboss ? 150 : e.elite ? 120 : 96;
        this.bar(pos.x - bw / 2, top, bw, e.elite ? 10 : 8, s, e.miniboss ? '#ff9a3b' : e.elite ? '#c77dff' : '#ff5d6c', e.shield / e.maxHp);
        this.nameTag(`${e.guardian ? '👑 ' : e.elite ? '★ ' : ''}Nv.${e.level} ${e.name}`, pos.x, top - 14, e.elite || e.guardian, D.elements[e.el]?.color);
        this.statusIcons(e, pos.x - bw / 2, top - 30);
      }
      if (e.windup > 0) {
        c.save(); c.font = `64px ${DISPLAY_FONT}`; c.textAlign = 'center'; c.fillStyle = '#ff4a6a'; c.strokeStyle = '#1a0610'; c.lineWidth = 8; const bob = Math.sin(this.worldTime * 14) * 6;
        c.strokeText('!', x, y - height - 30 + bob); c.fillText('!', x, y - height - 30 + bob);
        const k = 1 - e.windup / e.windupMax; c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x - 60, y - height - 20, 120, 8); c.fillStyle = '#ff4a6a'; c.fillRect(x - 60, y - height - 20, 120 * k, 8);
        c.restore();
      }
      this.hotspots.push({ enemy:e.uid, x:pos.x - height * .35, y:y - height, w:height * .7, h:height });
    }
    statusIcons(u, x, y) {
      const c = this.ctx, seen = new Set(); let ix = x;
      u.effects.forEach(e => { if (seen.has(e.s) || ix > x + 120) return; seen.add(e.s); const info = D.statusInfo[e.s]; if (!info) return; c.save(); c.font = `12px ${UI_FONT}`; c.textAlign = 'left'; c.fillStyle = 'rgba(12,10,30,.75)'; this.roundRect(ix - 1, y - 12, 18, 16, 4); c.fill(); c.fillStyle = info.color; c.fillText(info.icon, ix + 1, y); c.restore(); ix += 19; });
    }
    drawSprite(id, x, y, height, o = {}) {
      const img = this.assets.spriteImage(id), c = this.ctx;
      if (!img) { c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(x - 30, y - height, 60, height); return; }
      const w = height * img.width / img.height, sy = o.sy || 1;
      c.save(); c.translate(x, y); if (o.tilt) c.rotate(o.tilt); c.scale(2 - sy, sy); c.globalAlpha *= (o.alpha ?? 1);
      if (o.gray) c.filter = 'grayscale(1) brightness(.6)';
      c.drawImage(img, -w / 2, -height, w, height); c.filter = 'none';
      if (o.flash > 0) { c.globalAlpha = U.clamp(o.flash, 0, 1) * .85; c.drawImage(this.flashSprite(id, img), -w / 2, -height, w, height); }
      c.restore();
    }
    flashSprite(id, img) {
      let f = this.flashCache.get(id); if (f) return f;
      f = document.createElement('canvas'); f.width = img.width; f.height = img.height;
      const g = f.getContext('2d'); g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#ffffff'; g.fillRect(0, 0, f.width, f.height);
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
      for (const p of this.projectiles) {
        const k = U.clamp(p.t / p.dur, 0, 1); if (k >= 1) continue;
        for (let j = 0; j < 6; j++) { const kk = Math.max(0, k - j * .04), tx = p.x + (p.tx - p.x) * kk, ty = p.y + (p.ty - p.y) * kk - Math.sin(kk * Math.PI) * 40; c.globalAlpha = .5 - j * .07; c.fillStyle = p.color; c.beginPath(); c.arc(tx, ty, 9 - j, 0, Math.PI * 2); c.fill(); }
        const x = p.x + (p.tx - p.x) * k, y = p.y + (p.ty - p.y) * k - Math.sin(k * Math.PI) * 40; c.globalAlpha = 1; c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill();
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
      for (const p of this.particles) {
        const a = U.clamp(p.life / p.max, 0, 1), age = p.max - p.life;
        c.save(); c.globalAlpha = Math.min(1, a * 2.2);
        if (p.kind === 'num' || p.kind === 'label') {
          const pop = p.kind === 'num' ? (age < .12 ? 1 + (1 - age / .12) * (p.crit ? .9 : .5) : 1) : easeOutBack(Math.min(1, age / .25));
          c.translate(p.x, p.y); c.scale(pop, pop); c.font = `${p.size}px ${DISPLAY_FONT}`; c.lineJoin = 'round';
          c.lineWidth = p.kind === 'num' ? 7 : 6; c.strokeStyle = 'rgba(14,6,26,.95)'; c.strokeText(p.text, 0, 0);
          if (p.crit) { c.shadowColor = '#ff9d2e'; c.shadowBlur = 16; }
          c.fillStyle = p.color; c.fillText(p.text, 0, 0);
        } else if (p.kind === 'ring') {
          const t = 1 - a, r = p.radius * (.3 + easeOut(t) * .9); c.globalCompositeOperation = 'lighter'; c.strokeStyle = p.color; c.lineWidth = 7 * a + 1;
          c.beginPath(); c.ellipse(p.x, p.y, r, r * .36, 0, 0, Math.PI * 2); c.stroke(); if (p.filled) { c.globalAlpha = a * .35; c.fillStyle = p.color; c.fill(); }
        } else if (p.kind === 'slash') {
          const t = 1 - a; c.globalCompositeOperation = 'lighter'; c.translate(p.x, p.y); c.rotate(p.rot); c.scale(p.size, p.size);
          c.strokeStyle = p.color; c.lineWidth = 16 * a; c.lineCap = 'round'; c.beginPath(); c.arc(-30, 0, 60, -.9 + t * .5, .7 + t * .5); c.stroke();
          c.strokeStyle = '#fff'; c.lineWidth = 4 * a; c.beginPath(); c.arc(-30, 0, 60, -.8 + t * .5, .6 + t * .5); c.stroke();
        } else if (p.kind === 'spark' || p.kind === 'rise') { c.globalCompositeOperation = 'lighter'; c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.size * (p.kind === 'spark' ? a : 1), 0, Math.PI * 2); c.fill(); }
        else if (p.kind === 'wisp') { c.globalCompositeOperation = 'lighter'; c.fillStyle = p.color; c.globalAlpha = a * .9; c.beginPath(); c.ellipse(p.x, p.y, p.size * .7, p.size * 2.6, 0, 0, Math.PI * 2); c.fill(); }
        else if (p.kind === 'beam') { c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.strokeStyle = p.color; c.lineWidth = 26 * a; c.globalAlpha = a * .6; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.tx, p.ty); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 7 * a; c.globalAlpha = a; c.stroke(); }
        else if (p.kind === 'bosswave') { const r = (1 - a) * 560; c.globalCompositeOperation = 'lighter'; c.strokeStyle = p.color; c.lineWidth = 22 * a; c.beginPath(); c.ellipse(p.x, p.y, r, r * .36, 0, 0, Math.PI * 2); c.stroke(); }
        c.restore();
      }
      c.restore();
    }
    drawOverlay() {
      const c = this.ctx;
      if (this.engine.enemies.some(e => e.alive && e.windup > 0)) { const pulse = .5 + .5 * Math.sin(this.worldTime * 16); const g = c.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .9); g.addColorStop(0, 'rgba(255,0,40,0)'); g.addColorStop(1, `rgba(255,20,60,${.22 + .18 * pulse})`); c.fillStyle = g; c.fillRect(0, 0, W, H); }
      if (this.screenFlash) { c.save(); c.globalAlpha = (this.screenFlash.t / this.screenFlash.max) * .35; c.globalCompositeOperation = 'lighter'; c.fillStyle = this.screenFlash.color; c.fillRect(0, 0, W, H); c.restore(); }
      if (this.engine.pendingRoute || this.engine.pendingEncounter || this.engine.paused) { c.fillStyle = 'rgba(6,4,18,.45)'; c.fillRect(0, 0, W, H); }
    }
    portrait(sprite) {
      let img = this.portraits.get(sprite); if (!img) { img = new Image(); img.src = KT.portraitUrl(sprite); this.portraits.set(sprite, img); }
      return img.complete && img.naturalWidth ? img : null;
    }
    drawCutin() {
      const ci = this.cutin; if (!ci || !ci.unit) return;
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
      c.font = `${ci.manual ? 58 : 40}px ${DISPLAY_FONT}`; c.lineJoin = 'round'; c.lineWidth = 8; c.strokeStyle = '#0c0820'; c.strokeText(ci.name, tx, y + (ci.manual ? 110 : 80));
      c.shadowColor = ci.color; c.shadowBlur = 20; c.fillStyle = '#fff'; c.fillText(ci.name, tx, y + (ci.manual ? 110 : 80));
      c.restore();
    }
    drawBanner() {
      const b = this.banner; if (!b) return;
      const c = this.ctx, k = b.t / b.dur, inK = easeOutBack(Math.min(1, b.t / .35)), fade = k > .75 ? 1 - (k - .75) / .25 : 1;
      c.save(); c.globalAlpha = fade; c.textAlign = 'center'; c.textBaseline = 'middle';
      const y = 200, band = c.createLinearGradient(0, 0, W, 0); band.addColorStop(0, 'rgba(10,8,26,0)'); band.addColorStop(.5, 'rgba(10,8,26,.8)'); band.addColorStop(1, 'rgba(10,8,26,0)');
      c.fillStyle = band; c.fillRect(0, y - 58 * inK, W, 116 * inK);
      c.fillStyle = b.color; c.fillRect(W / 2 - 220 * inK, y - 58 * inK, 440 * inK, 2); c.fillRect(W / 2 - 220 * inK, y + 56 * inK, 440 * inK, 2);
      c.translate(W / 2, y - 8); c.scale(inK, inK);
      c.font = `60px ${DISPLAY_FONT}`; c.lineJoin = 'round'; c.lineWidth = 9; c.strokeStyle = '#0c0820'; c.strokeText(b.title, 0, 0);
      c.shadowColor = b.color; c.shadowBlur = 24; c.fillStyle = '#fff6df'; c.fillText(b.title, 0, 0); c.shadowBlur = 0;
      if (b.sub) { c.font = `600 19px ${UI_FONT}`; c.fillStyle = b.color; c.fillText(b.sub.toUpperCase(), 0, 42); }
      c.restore();
    }
    enemyAt(px, py) { const hits = this.hotspots.filter(h => h.enemy && px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h); return hits.length ? hits[hits.length - 1].enemy : null; }
  }
  KT.GameRenderer = GameRenderer;
})();
