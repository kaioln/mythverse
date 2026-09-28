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
      const paths = [...[...sprites].map(spritePath), ...iconList(), sceneUrl('village'), sceneUrl('world-map')];
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
    // Folhas de animação 3D (assets/anim/<id>.webp + .json), carregadas sob demanda só para quem está em campo.
    animIndex() {
      if (!this._animIdx) { this._animIdx = new Set(); fetch('assets/anim/index.json').then(r => r.ok ? r.json() : []).then(ids => ids.forEach(i => this._animIdx.add(i))).catch(() => {}); }
      return this._animIdx;
    }
    anim(id) {
      this.anims = this.anims || new Map();
      const hit = this.anims.get(id); if (hit) return hit.ready ? hit : null;
      if (!this.animIndex().has(id)) return null;
      const entry = { ready:false }; this.anims.set(id, entry);
      Promise.all([fetch(`assets/anim/${id}.json`).then(r => r.json()), new Promise((res, rej) => { const img = new Image(); img.decoding = 'async'; img.onload = () => res(img); img.onerror = rej; img.src = `assets/anim/${id}.webp`; })])
        .then(([meta, img]) => Object.assign(entry, { meta, img, ready:true })).catch(() => this.anims.set(id, { ready:false, failed:true }));
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
