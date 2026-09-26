(() => {
  const KT = globalThis.KT = globalThis.KT || {};
  // Sprites e retratos gerados por tools/build_sprites.py (recortados, com contorno);
  // variantes de monstros e ícones são versões com matiz alterada das artes originais.
  const spritePath = id => `assets/sprites/${id}.png`;
  const portraitPath = id => `assets/portraits/${id}.png`;
  const iconPath = (name, hue = 0) => `assets/icons/${String(name).replace(/\.png$/, '')}${hue ? `_h${hue}` : ''}.png`;

  function iconList() {
    const I = KT.Items, out = new Set();
    I.bases.forEach(b => out.add(iconPath(b.icon, b.hue)));
    I.uniques.forEach(q => out.add(iconPath(q.icon, q.hue)));
    I.sets.forEach(s => Object.values(s.pieces).forEach(([, icon, hue]) => out.add(iconPath(icon, hue))));
    [...KT.Progression.shop.gold, ...KT.Progression.shop.crystal].forEach(o => out.add(iconPath(o.icon, o.hue)));
    return [...out];
  }

  class AssetBank {
    constructor() { this.images = new Map(); this.loaded = 0; this.failed = 0; this.total = 0; this.onProgress = null; }
    loadAll() {
      const sprites = new Set([...KT.Data.roster.map(h => h.sprite), ...Object.values(KT.Data.enemies).map(e => e.sprite)]);
      const paths = [...[...sprites].map(spritePath), ...iconList(), ...Object.values(KT.Data.zones).map(z => `assets/scenes/${z.scene || z.id}.png`)];
      this.total = paths.length;
      return Promise.all(paths.map(path => new Promise(resolve => {
        const img = new Image(); img.decoding = 'async';
        img.onload = () => { this.images.set(path, img); this.loaded++; this.onProgress?.(this.loaded + this.failed, this.total); resolve(); };
        img.onerror = () => { this.failed++; this.onProgress?.(this.loaded + this.failed, this.total); resolve(); };
        img.src = path;
      }))).then(() => this);
    }
    image(path) { return this.images.get(path) || null; }
    sprite(id) { const img = this.image(spritePath(id)); return img ? [spritePath(id), 0, 0, img.width, img.height] : null; }
    spriteImage(id) { return this.image(spritePath(id)); }
    item(name, hue = 0) { return this.image(iconPath(name, hue)); }
    scene(zoneId) { const z = KT.Data.zones[zoneId]; return this.image(`assets/scenes/${z?.scene || zoneId}.png`); }
  }

  KT.AssetBank = AssetBank;
  KT.portraitUrl = portraitPath;
  KT.spriteUrl = spritePath;
  KT.iconUrl = iconPath;
  KT.itemIcon = (item, cls = '') => `<img class="item-art ${cls}" src="${iconPath(item.icon, item.hue)}" alt="" loading="lazy" draggable="false">`;
})();
