(() => {
  const KT = globalThis.KT = globalThis.KT || {};
  // Sprites e retratos gerados por tools/build_sprites.py (recortados, com contorno);
  // variantes de monstros e ícones são versões com matiz alterada das artes originais.
  const spritePath = id => `assets/sprites/web/${id}.webp`;
  const portraitPath = id => `assets/portraits/web/${id}.webp`;
  const iconPath = (name, hue = 0) => `assets/icons/${String(name).replace(/\.png$/, '')}${hue ? `_h${hue}` : ''}.png`;

  function iconList() {
    const I = KT.Items, out = new Set();
    I.bases.forEach(b => out.add(iconPath(b.icon, b.hue)));
    I.uniques.forEach(q => out.add(iconPath(q.icon, q.hue)));
    I.sets.forEach(s => Object.values(s.pieces).forEach(([, icon, hue]) => out.add(iconPath(icon, hue))));
    [...KT.Progression.shop.gold, ...KT.Progression.shop.crystal].forEach(o => out.add(iconPath(o.icon, o.hue)));
    return [...out];
  }

  // Cenário leve: 'web' (palco) ou 'thumb' (cartões e banners).
  const sceneUrl = (name, size = 'web') => `assets/scenes/${size}/${name}.webp`;
  class AssetBank {
    constructor() { this.images = new Map(); this.loaded = 0; this.failed = 0; this.total = 0; this.onProgress = null; }
    loadAll() {
      const sprites = new Set([...KT.Data.roster.map(h => h.sprite), ...Object.values(KT.Data.enemies).map(e => e.sprite)]);
      // Cenários (webp, ~7 MB no total) não entram no carregamento inicial: só a cidade e o mapa; o resto vem sob demanda
      // e é pré-carregado aos poucos depois que o jogo abre (antes eram 69 MB de PNG na abertura).
      // A capital abre o jogo: a arte dela (e a ilha do festival) entram no carregamento inicial.
      const paths = [...[...sprites].map(spritePath), ...iconList(), sceneUrl(KT.Data.zones.village.scene || 'village'), 'assets/scenes/festival-homes.png', sceneUrl('world-map')];
      const later = () => Object.values(KT.Data.zones).forEach((z, i) => setTimeout(() => this.loadScene(sceneUrl(z.scene || z.id)), 1500 + i * 400));
      setTimeout(later, 4000);
      this.total = paths.length;
      return Promise.all(paths.map(path => new Promise(resolve => {
        const img = new Image(); img.decoding = 'async';
        img.onload = () => { this.images.set(path, img); this.loaded++; this.onProgress?.(this.loaded + this.failed, this.total); resolve(); };
        img.onerror = () => { this.failed++; this.onProgress?.(this.loaded + this.failed, this.total); resolve(); };
        img.src = path;
      }))).then(() => this);
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
      const hit = this.anims.get(id); if (hit) return hit.ready ? hit : null;
      if (!this.animIndex().has(id)) { const v = this._animVar[id]; return v ? this.animVariant(id, v) : null; }
      const entry = { ready:false }; this.anims.set(id, entry);
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
    sprite(id) { const img = this.image(spritePath(id)); return img ? [spritePath(id), 0, 0, img.width, img.height] : null; }
    spriteImage(id) { return this.image(spritePath(id)); }
    item(name, hue = 0) { return this.image(iconPath(name, hue)); }
    loadScene(path) { if (this.images.has(path) || this._pending?.has(path)) return; (this._pending ||= new Set()).add(path); const img = new Image(); img.decoding = 'async'; img.onload = () => { this.images.set(path, img); this._pending.delete(path); }; img.onerror = () => this._pending.delete(path); img.src = path; }
    scene(zoneId) { const z = KT.Data.zones[zoneId], p = sceneUrl(z?.scene || zoneId); const img = this.image(p); if (!img) this.loadScene(p); return img; }
  }

  KT.AssetBank = AssetBank;
  KT.sceneUrl = sceneUrl;
  KT.portraitUrl = portraitPath;
  KT.spriteUrl = spritePath;
  KT.iconUrl = iconPath;
  KT.itemIcon = (item, cls = '') => `<img class="item-art ${cls}" src="${iconPath(item.icon, item.hue)}" alt="" loading="lazy" draggable="false">`;
})();
