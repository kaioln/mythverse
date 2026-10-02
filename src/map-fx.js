// Mapa do mundo vivo: uma camada de desenho por cima da ilustração. As luzes da própria pintura cintilam, nuvens
// passam devagar e cada região tem o seu clima (pétalas no bosque, neve no planalto, brasas na forja, raios no trono
// de Raijin…). O lugar onde a equipe está e o próximo objetivo pulsam. A camada some sozinha quando o mapa fecha.
(() => {
  const KT = globalThis.KT = globalThis.KT || {};
  const rand = (a, b) => a + Math.random() * (b - a);
  // Clima de cada região: [tipo, cor, quantas partículas por segundo, raio da área em % da largura].
  const WEATHER = {
    village:['lantern', '#ffcf7a', 1.2, 7], hunt:['petal', '#ffb7d0', 5, 9], hunt_sakura:['petal', '#ffc4dc', 7, 8], dungeon:['wisp', '#c9b8ff', 2, 6], boss:['ember', '#ff5a6e', 4, 7],
    hunt_swamp:['firefly', '#c8ff8a', 4, 8], dungeon_crypt:['wisp', '#7dffb8', 2.5, 6], hunt_tide:['glint', '#d7f6ff', 5, 9], dungeon_tide:['wisp', '#7fd8ff', 2.5, 7], boss_tide:['bolt', '#bfe6ff', .45, 8],
    hunt_frost:['snow', '#ffffff', 9, 9], dungeon_forge:['ember', '#ff9a4a', 7, 7], boss_event:['lantern', '#ffb35c', 2.2, 8], rift:['spark', '#e06bff', 6, 6], hunt_desert:['sand', '#ffd9a0', 6, 9],
    hunt_ghost:['wisp', '#d8e2ff', 2.5, 7], dungeon_clock:['spark', '#ffe08a', 3, 5], boss_sand:['sand', '#ffcf8a', 5, 8], hunt_sky:['cloud', '#ffffff', .5, 8], dungeon_sky:['spark', '#fff6c9', 3, 6], boss_sky:['bolt', '#fff7b0', .6, 8]
  };
  class MapFx {
    constructor(host, img, pins, o = {}) {
      this.host = host; this.img = img; this.pins = pins; this.current = o.current; this.next = o.next; this.parts = []; this.lights = []; this.clouds = []; this.t = 0; this.acc = {};
      this.cv = document.createElement('canvas'); this.cv.className = 'map-fx'; this.cv.setAttribute('aria-hidden', 'true'); host.appendChild(this.cv);
      this.c = this.cv.getContext('2d');
      this.reduced = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      for (let i = 0; i < 7; i++) this.clouds.push({ x:rand(-.2, 1.1), y:rand(.02, .92), s:rand(.14, .3), v:rand(.004, .011), a:rand(.05, .12) });
      const ready = () => { this.findLights(); this.resize(); this.last = performance.now(); if (this.reduced) this.frame(this.last, true); else this.raf = requestAnimationFrame(t => this.frame(t)); };
      if (img.complete && img.naturalWidth) ready(); else img.addEventListener('load', ready, { once:true });
      if (globalThis.ResizeObserver) { this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host); }
    }
    // As luzes da pintura (janelas, lanternas, fogueiras): pontos claros e quentes da própria imagem.
    findLights() {
      try {
        const w = 320, h = 180, t = document.createElement('canvas'); t.width = w; t.height = h;
        const g = t.getContext('2d', { willReadFrequently:true }); g.drawImage(this.img, 0, 0, w, h);
        const d = g.getImageData(0, 0, w, h).data, best = new Map();
        for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
          const i = (y * w + x) * 4, r = d[i], gg = d[i + 1], b = d[i + 2];
          if (r < 225 || gg < 150 || b > 170 || r - b < 70) continue;
          const key = `${x >> 3},${y >> 3}`, lum = r + gg, old = best.get(key);
          if (!old || lum > old.lum) best.set(key, { x:x / w, y:y / h, lum });
        }
        this.lights = [...best.values()].sort((a, b) => b.lum - a.lum).slice(0, 170).map(p => ({ ...p, ph:rand(0, 6.28), sp:rand(1.2, 3.4), s:rand(.6, 1.3) }));
      } catch (_) { this.lights = []; }
    }
    resize() {
      const r = this.host.getBoundingClientRect(), dpr = Math.min(2, globalThis.devicePixelRatio || 1);
      if (!r.width) return;
      this.w = r.width; this.h = r.height; this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr); this.dpr = dpr;
    }
    spawn(id, type, color, radius) {
      const pin = this.pins[id]; if (!pin) return;
      const R = radius / 100 * this.w, cx = pin[0] / 100 * this.w, cy = pin[1] / 100 * this.h, x = cx + rand(-R, R), y = cy + rand(-R * .6, R * .6);
      const p = { type, color, x, y, vx:0, vy:0, life:0, max:rand(2.4, 4.6), s:rand(.7, 1.4), ph:rand(0, 6.28) };
      if (type === 'petal') { p.vx = rand(8, 22); p.vy = rand(8, 20); p.y -= R * .5; }
      else if (type === 'snow') { p.vx = rand(-6, 6); p.vy = rand(14, 30); p.y -= R * .6; }
      else if (type === 'ember') { p.vx = rand(-6, 6); p.vy = -rand(12, 30); p.max = rand(1.4, 2.6); }
      else if (type === 'spark') { p.vx = rand(-4, 4); p.vy = -rand(8, 22); p.max = rand(1.6, 3); }
      else if (type === 'firefly') { p.vx = rand(-8, 8); p.vy = rand(-6, 6); p.max = rand(3, 6); }
      else if (type === 'wisp') { p.vx = rand(-5, 5); p.vy = -rand(4, 12); p.max = rand(3, 5); p.s = rand(.8, 1.4); }
      else if (type === 'lantern') { p.vx = rand(-3, 5); p.vy = -rand(7, 14); p.max = rand(6, 10); }
      else if (type === 'sand') { p.vx = rand(26, 54); p.vy = rand(-3, 5); p.max = rand(1.6, 3); p.x -= R; }
      else if (type === 'glint') { p.max = rand(.8, 1.6); }
      else if (type === 'bolt') { p.max = .32; p.x = cx + rand(-R * .6, R * .6); p.y = cy - R * .2; p.seed = Math.random() * 99; }
      else if (type === 'cloud') { p.vx = rand(4, 9); p.max = rand(10, 16); p.s = rand(1.6, 2.6); }
      this.parts.push(p);
    }
    frame(now, once = false) {
      if (!this.host.isConnected) { this.stop(); return; }
      const dt = Math.min(.05, Math.max(0, (now - this.last) / 1000)); this.last = now; this.t += dt;
      const c = this.c, w = this.w, h = this.h;
      if (!w) { this.resize(); if (!once) this.raf = requestAnimationFrame(t => this.frame(t)); return; }
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, w, h);
      // nuvens passando (sombra clara, bem de leve)
      for (const cl of this.clouds) {
        cl.x += cl.v * dt; if (cl.x > 1.2) { cl.x = -.3; cl.y = rand(.02, .92); }
        const g = c.createRadialGradient(cl.x * w, cl.y * h, 0, cl.x * w, cl.y * h, cl.s * w);
        g.addColorStop(0, `rgba(255,255,255,${cl.a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.beginPath(); c.ellipse(cl.x * w, cl.y * h, cl.s * w, cl.s * w * .36, 0, 0, Math.PI * 2); c.fill();
      }
      // luzes da pintura cintilando
      c.globalCompositeOperation = 'lighter';
      for (const l of this.lights) {
        const a = .25 + .55 * (.5 + .5 * Math.sin(this.t * l.sp + l.ph)), r = (2.2 + 2.2 * a) * l.s * Math.max(.7, w / 1200);
        const g = c.createRadialGradient(l.x * w, l.y * h, 0, l.x * w, l.y * h, r * 2.6);
        g.addColorStop(0, `rgba(255,236,190,${.55 * a})`); g.addColorStop(1, 'rgba(255,190,110,0)');
        c.fillStyle = g; c.fillRect(l.x * w - r * 2.6, l.y * h - r * 2.6, r * 5.2, r * 5.2);
      }
      // clima das regiões
      if (!once) for (const [id, [type, color, rate, radius]] of Object.entries(WEATHER)) {
        this.acc[id] = (this.acc[id] || 0) + rate * dt;
        while (this.acc[id] >= 1) { this.acc[id] -= 1; if (this.parts.length < 420) this.spawn(id, type, color, radius); }
      }
      for (const p of this.parts) {
        p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt;
        const k = p.life / p.max, fade = Math.sin(Math.min(1, k) * Math.PI);
        c.globalAlpha = Math.max(0, fade);
        if (p.type === 'petal') { p.x += Math.sin(this.t * 2 + p.ph) * .3; c.globalCompositeOperation = 'source-over'; c.fillStyle = p.color; c.save(); c.translate(p.x, p.y); c.rotate(this.t * 2 + p.ph); c.beginPath(); c.ellipse(0, 0, 3.2 * p.s, 1.6 * p.s, 0, 0, Math.PI * 2); c.fill(); c.restore(); c.globalCompositeOperation = 'lighter'; }
        else if (p.type === 'snow') { p.x += Math.sin(this.t * 1.5 + p.ph) * .25; c.fillStyle = p.color; c.globalAlpha *= .8; c.beginPath(); c.arc(p.x, p.y, 1.5 * p.s, 0, Math.PI * 2); c.fill(); }
        else if (p.type === 'sand') { c.strokeStyle = p.color; c.globalAlpha *= .45; c.lineWidth = 1.1; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - 12 * p.s, p.y - .6); c.stroke(); }
        else if (p.type === 'glint') { const r = 3.2 * p.s; c.strokeStyle = p.color; c.lineWidth = 1.1; c.beginPath(); c.moveTo(p.x - r, p.y); c.lineTo(p.x + r, p.y); c.moveTo(p.x, p.y - r * .6); c.lineTo(p.x, p.y + r * .6); c.stroke(); }
        else if (p.type === 'bolt') {
          c.globalAlpha = 1 - k; c.strokeStyle = p.color; c.lineWidth = 2; c.shadowColor = p.color; c.shadowBlur = 14; c.beginPath(); let x = p.x, y = p.y; c.moveTo(x, y);
          for (let i = 1; i <= 6; i++) { x += Math.sin(p.seed + i * 7.3) * 9; y += h * .022; c.lineTo(x, y); } c.stroke(); c.shadowBlur = 0;
          c.globalAlpha = (1 - k) * .16; c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y + h * .06, w * .08, 0, Math.PI * 2); c.fill();
        }
        else if (p.type === 'cloud') { c.globalCompositeOperation = 'source-over'; c.globalAlpha *= .22; const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 34 * p.s); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(p.x, p.y, 34 * p.s, 11 * p.s, 0, 0, Math.PI * 2); c.fill(); c.globalCompositeOperation = 'lighter'; }
        else if (p.type === 'lantern') { p.x += Math.sin(this.t + p.ph) * .12; const r = 2.6 * p.s; c.fillStyle = p.color; c.shadowColor = '#ff9a3c'; c.shadowBlur = 10; c.fillRect(p.x - r * .7, p.y - r, r * 1.4, r * 2); c.shadowBlur = 0; }
        else { // brasa, faísca, vaga-lume, espírito: um ponto de luz
          if (p.type === 'firefly') { p.vx += rand(-14, 14) * dt; p.vy += rand(-14, 14) * dt; c.globalAlpha *= .5 + .5 * Math.sin(this.t * 6 + p.ph); }
          if (p.type === 'wisp') c.globalAlpha *= .7;
          const r = (p.type === 'wisp' ? 3.4 : 2.6) * p.s, g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.4);
          g.addColorStop(0, '#ffffff'); g.addColorStop(.3, p.color); g.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = g; c.fillRect(p.x - r * 2.4, p.y - r * 2.4, r * 4.8, r * 4.8);
        }
      }
      this.parts = this.parts.filter(p => p.life < p.max);
      c.globalAlpha = 1;
      // onde a equipe está (ouro) e o próximo objetivo (vermelho): anéis que pulsam
      const beacon = (id, color, speed, beam) => {
        const pin = this.pins[id]; if (!pin) return;
        const x = pin[0] / 100 * w, y = pin[1] / 100 * h, u = Math.max(.8, w / 1100), pulse = this.reduced ? .5 : .5 + .5 * Math.sin(this.t * 3);
        // clarão no chão, maior que a plaqueta do marco
        const g = c.createRadialGradient(x, y + 6, 0, x, y + 6, 120 * u); g.addColorStop(0, color); g.addColorStop(.55, color); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.globalAlpha = .16 + .1 * pulse; c.fillStyle = g; c.beginPath(); c.ellipse(x, y + 6, 120 * u, 52 * u, 0, 0, Math.PI * 2); c.fill();
        // feixe de luz sobre o lugar onde a equipe está
        if (beam) {
          const top = y - 96 * u, bw = 30 * u, lg = c.createLinearGradient(0, y, 0, top); lg.addColorStop(0, color); lg.addColorStop(1, 'rgba(0,0,0,0)');
          c.globalAlpha = .3 + .14 * pulse; c.fillStyle = lg; c.beginPath(); c.moveTo(x - bw * .34, y); c.lineTo(x - bw, top); c.lineTo(x + bw, top); c.lineTo(x + bw * .34, y); c.closePath(); c.fill();
        }
        // anéis que se abrem para além da plaqueta
        for (let k = 0; k < 3; k++) { const q = this.reduced ? (k + 1) / 3.4 : ((this.t * speed + k / 3) % 1), rr = (58 + q * 76) * u; c.globalAlpha = Math.min(1, (1 - q) * 1.5) * .9; c.strokeStyle = color; c.lineWidth = 3.4 - q * 1.6; c.beginPath(); c.ellipse(x, y + 6, rr, rr * .46, 0, 0, Math.PI * 2); c.stroke(); }
        c.globalAlpha = 1;
      };
      beacon(this.current, '#ffe28a', .4, true); if (this.next && this.next !== this.current) beacon(this.next, '#ff6a52', .62, false);
      c.globalCompositeOperation = 'source-over';
      if (!once) this.raf = requestAnimationFrame(t => this.frame(t));
    }
    stop() { cancelAnimationFrame(this.raf); this.ro?.disconnect(); this.cv.remove(); }
  }
  KT.MapFx = { mount(host, img, pins, o) { if (!host || !img || host.querySelector('.map-fx')) return null; return new MapFx(host, img, pins, o); } };
})();
