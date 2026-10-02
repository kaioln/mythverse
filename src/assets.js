(() => {
  const KT = globalThis.KT = globalThis.KT || {};
  // Sprites e retratos gerados por tools/build_sprites.py (recortados, com contorno);
  // variantes de monstros e ícones são versões com matiz alterada das artes originais.
  const spritePath = id => `assets/sprites/web/${id}.webp`;
  const portraitPath = id => `assets/portraits/web/${id}.webp`;
  const iconPath = (name, hue = 0) => `assets/icons/web/${String(name).replace(/\.png$/, '')}${hue ? `_h${hue}` : ''}.webp`;

  // Cenário leve: 'web' (palco) ou 'thumb' (cartões e banners).
  const sceneUrl = (name, size = 'web') => `assets/scenes/${size}/${name}.webp`;
  class AssetBank {
    constructor() { this.images = new Map(); this.loaded = 0; this.failed = 0; this.total = 0; this.onProgress = null; }
    // Abertura leve: só o que a primeira tela usa (a capital e a ilha do festival). Sprites de heróis e criaturas,
    // ícones de itens, cenários e folhas de animação vêm sob demanda, quando aparecem, e os menos usados saem da memória.
    // (Antes a abertura baixava 187 sprites, 115 ícones, a ilha em PNG de 3 MB e, em seguida, todos os cenários: ~17 MB.)
    loadAll() {
      const paths = [sceneUrl(KT.Data.zones.village.scene || 'village'), 'assets/scenes/web/festival-homes.webp'];
      this.total = paths.length;
      return Promise.all(paths.map(path => new Promise(resolve => {
        const img = new Image(); img.decoding = 'async';
        img.onload = () => { this.images.set(path, img); this.loaded++; this.onProgress?.(this.loaded + this.failed, this.total); resolve(); };
        img.onerror = () => { this.failed++; this.onProgress?.(this.loaded + this.failed, this.total); resolve(); };
        img.src = path;
      }))).then(() => this);
    }
    // Carrega uma imagem em segundo plano (uma vez); quem pediu recebe null até ela chegar.
    lazy(path) {
      if (this.images.has(path) || this._pending?.has(path) || this._bad?.has(path)) return;
      (this._pending ||= new Set()).add(path);
      const img = new Image(); img.decoding = 'async';
      img.onload = () => { this.images.set(path, img); this._pending.delete(path); this.trimScenes(path); };
      img.onerror = () => { this._pending.delete(path); (this._bad ||= new Set()).add(path); };
      img.src = path;
    }
    // No máximo 4 cenários na memória (cada um ocupa ~6 MB decodificado): sai o que foi visto há mais tempo.
    trimScenes(fresh) {
      if (!fresh.startsWith('assets/scenes/web/')) return;
      const use = this._sceneUse ||= new Map(); use.set(fresh, performance.now());
      const scenes = [...this.images.keys()].filter(k => k.startsWith('assets/scenes/web/'));
      scenes.sort((x, y) => (use.get(x) || 0) - (use.get(y) || 0));
      while (scenes.length > 4) { const old = scenes.shift(); if (old !== fresh) this.images.delete(old); }
    }
    image(path) { return this.images.get(path) || null; }
    // Folhas de animação (assets/anim/<id>.webp + .json), carregadas sob demanda só para quem está em campo.
    // index.json lista quem tem folha própria (heróis, chefes e criaturas); families.json, a família de cada criatura
    // (quem flutua, quem ataca de longe); variants.json, as que ainda não têm folha e usam a de outra, recolorida aqui
    // na primeira vez que aparecem: [base, matiz, saturação, brilho, aura].
    animIndex() {
      if (!this._animIdx) {
        this._animIdx = new Set(); this._animVar = {}; this._animFam = {};
        const v = KT.VERSION ? `?v=${KT.VERSION}` : '';
        fetch(`assets/anim/index.json${v}`).then(r => r.ok ? r.json() : []).then(ids => ids.forEach(i => this._animIdx.add(i))).catch(() => {});
        fetch(`assets/anim/variants.json${v}`).then(r => r.ok ? r.json() : {}).then(map => { this._animVar = map || {}; }).catch(() => {});
        fetch(`assets/anim/families.json${v}`).then(r => r.ok ? r.json() : {}).then(map => { this._animFam = map || {}; }).catch(() => {});
      }
      return this._animIdx;
    }
    // Família de uma criatura ('fox_bog' → 'fox') e a cor da aura dela, quando ainda é uma variação.
    animBase(id) { this.animIndex(); return this._animFam?.[id] || this._animVar?.[id]?.[0] || (this._animIdx.has(id) ? id : null); }
    animAura(id) { const a = this._animVar?.[id]?.[4]; return a ? `rgba(${a[0]},${a[1]},${a[2]},.7)` : null; }
    anim(id) {
      this.anims = this.anims || new Map();
      const hit = this.anims.get(id); if (hit) { hit.used = performance.now(); return hit.ready ? hit : null; }
      // No máximo 28 folhas de animação na memória (cada uma ~2 MB decodificada): sai a que não aparece há mais tempo.
      if (this.anims.size >= 28) { const now = performance.now(), old = [...this.anims.entries()].filter(([, e]) => now - (e.used || 0) > 20000).sort((x, y) => (x[1].used || 0) - (y[1].used || 0)); for (const [k] of old.slice(0, this.anims.size - 24)) this.anims.delete(k); }
      if (!this.animIndex().has(id)) { const v = this._animVar[id]; return v ? this.animVariant(id, v) : null; }
      const entry = { ready:false, used:performance.now() }; this.anims.set(id, entry);
      const q = KT.VERSION ? `?v=${KT.VERSION}` : '';
      Promise.all([fetch(`assets/anim/${id}.json${q}`).then(r => r.json()), new Promise((res, rej) => { const img = new Image(); img.decoding = 'async'; img.onload = () => res(img); img.onerror = rej; img.src = `assets/anim/${id}.webp${q}`; })])
        .then(([meta, img]) => Object.assign(entry, { meta, img, ready:true })).catch(() => this.anims.set(id, { ready:false, failed:true }));
      return null;
    }
    // Recolore a folha da base (mesma conta de tools/build_sprites.py shift: gira a matiz, multiplica saturação e brilho),
    // em fatias de poucas linhas por vez para não travar um quadro; até ficar pronta o jogo mostra a arte parada.
    animVariant(id, [base, hue, sat, val]) {
      const src = this.anim(base); if (!src) return null;
      const entry = { ready:false }; this.anims.set(id, entry);
      const cv = document.createElement('canvas'); cv.width = src.img.width; cv.height = src.img.height;
      const g = cv.getContext('2d', { willReadFrequently:true }); g.drawImage(src.img, 0, 0);
      const W = cv.width, H = cv.height, step = Math.max(16, Math.floor(220000 / W)), dh = (((hue / 360) % 1) + 1) % 1; let y = 0;
      const run = () => {
        let d;
        try { d = g.getImageData(0, y, W, Math.min(step, H - y)); } catch (_) { this.anims.set(id, { ready:false, failed:true }); return; }
        const px = d.data;
        for (let i = 0; i < px.length; i += 4) {
          if (!px[i + 3]) continue;
          const r = px[i] / 255, gg = px[i + 1] / 255, b = px[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), c = mx - mn;
          let h = 0; if (c) { h = mx === r ? ((gg - b) / c) % 6 : mx === gg ? (b - r) / c + 2 : (r - gg) / c + 4; h /= 6; if (h < 0) h += 1; }
          h = (h + dh) % 1; const s2 = Math.min(1, (mx ? c / mx : 0) * sat), v2 = Math.min(1, mx * val);
          const k = h * 6, f = k - Math.floor(k), p0 = v2 * (1 - s2), q0 = v2 * (1 - s2 * f), t0 = v2 * (1 - s2 * (1 - f));
          let R, G, B2; switch (Math.floor(k) % 6) { case 0: R = v2; G = t0; B2 = p0; break; case 1: R = q0; G = v2; B2 = p0; break; case 2: R = p0; G = v2; B2 = t0; break; case 3: R = p0; G = q0; B2 = v2; break; case 4: R = t0; G = p0; B2 = v2; break; default: R = v2; G = p0; B2 = q0; }
          px[i] = R * 255; px[i + 1] = G * 255; px[i + 2] = B2 * 255;
        }
        g.putImageData(d, 0, y); y += step;
        if (y < H) setTimeout(run, 0); else Object.assign(entry, { meta:src.meta, img:cv, ready:true });
      };
      run();
      return null;
    }
    sprite(id) { const img = this.spriteImage(id); return img ? [spritePath(id), 0, 0, img.width, img.height] : null; }
    spriteImage(id) { const p = spritePath(id), img = this.images.get(p); if (!img) this.lazy(p); return img || null; }
    item(name, hue = 0) { const p = iconPath(name, hue), img = this.images.get(p); if (!img) this.lazy(p); return img || null; }
    loadScene(path) { this.lazy(path); }
    scene(zoneId) { const z = KT.Data.zones[zoneId], p = sceneUrl(z?.scene || zoneId); const img = this.image(p); if (!img) this.loadScene(p); else (this._sceneUse ||= new Map()).set(p, performance.now()); return img; }
  }

  KT.AssetBank = AssetBank;
  KT.sceneUrl = sceneUrl;
  KT.portraitUrl = portraitPath;
  KT.spriteUrl = spritePath;
  KT.iconUrl = iconPath;
  KT.itemIcon = (item, cls = '') => `<img class="item-art ${cls}" src="${iconPath(item.icon, item.hue)}" alt="" loading="lazy" draggable="false">`;
})();
