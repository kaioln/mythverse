// Ícones pintados (tools/icon_gen.py). KT.Icon devolve a pintura de um ícone da interface ou do kit de um herói, em HTML
// ou no canvas do combate. O que ainda não tem pintura cai no traço antigo (src/icons.js): nada some da tela.
//   KT.Icon.html('cmd-attack')            <i class="pi pi-cmd-attack">
//   KT.Icon.kit('akira', 's1')            ícone da habilidade II do Akira (slots: p, s0, s1, s2, u)
//   KT.Icon.draw(ctx, 'st-burn', x, y, 18)  no canvas, centrado em (x, y)
(() => {
  const KT = globalThis.KT = globalThis.KT || {};
  const A = KT.ICON_ART || { size:80, packs:{}, kv:'', icons:{}, kits:[] };
  const SLOT = { p:0, s0:1, s1:2, s2:3, u:4 };
  const kits = new Set(A.kits || []);
  // Do nome antigo (kanji dos dados ou nome do traço) para a pintura.
  const EL = { Fogo:'fire', Água:'water', Natureza:'nature', Terra:'earth', Raio:'lightning', Vento:'wind', Gelo:'ice', Luz:'light', Sombra:'shadow' };
  const CLS = { Vanguarda:'vanguarda', Executor:'executor', Arcanista:'arcanista', Atirador:'atirador', Suporte:'suporte' };
  const GLYPH = { '火':'el-fire', '水':'el-water', '木':'el-nature', '土':'el-earth', '雷':'el-lightning', '風':'el-wind', '氷':'el-ice', '光':'el-light', '闇':'el-shadow',
    '盾':'cls-vanguarda', '刃':'cls-executor', '術':'cls-arcanista', '弓':'cls-atirador', '癒':'cls-suporte',
    '焼':'st-burn', '毒':'st-poison', '血':'st-bleed', '眩':'st-stun', '凍':'st-freeze', '遅':'st-slow', '破':'st-armorBreak', '印':'st-mark', '⬇':'st-weaken', '黙':'st-silence',
    '怒':'st-atk', '守':'st-def', '速':'st-spd', '精':'st-crit', '殺':'st-critDmg', '避':'st-dodge', '吸':'st-lifesteal', '障':'st-dr', '✚':'st-regen', '影':'st-stealth', '挑':'st-taunt', '剣':'st-counter',
    // prédios, eventos do mundo, caixas e avulsos
    '鍛':'b-forge', '道':'b-dojo', '社':'b-shrine', '神':'b-shrine', torii:'b-shrine', '工':'b-workshop', '匠':'b-workshop', '鎚':'ic-anvil', '城':'b-guild', '市':'b-market', '家':'b-house',
    '金':'res-gold', '灯':'ic-lantern', '桜':'res-gem', '季':'res-gem', '鬼':'z-boss', '霊':'res-ether', '魂':'ic-orb', '星':'ic-star', '✦':'ic-star', '月':'ic-moon', '界':'z-world',
    '武':'ic-swords', '矢':'ic-arrows', '薬':'potion', '錬':'potion', '屏':'sys-panel', '箱':'res-chest', '龍':'ic-dragon', '書':'nav-wiki', '鋼':'res-ore', '鉱':'res-ore', '章':'nav-guild', '晶':'res-crystal', '◆':'res-gem', '危':'sys-alert' };
  const images = new Map();
  const load = src => { let im = images.get(src); if (!im && typeof Image !== 'undefined') { im = new Image(); im.decoding = 'async'; im.src = src; images.set(src, im); } return im; };
  const Icon = {
    art:A, EL, CLS,
    has(id) { return !!A.icons[id]; },
    hasKit(hero) { return kits.has(hero); },
    // id da pintura para um kanji/nome antigo, um elemento, uma classe ou um efeito
    of(k) { return GLYPH[k] || (A.icons[k] ? k : null); },
    element(el) { return `el-${EL[el] || el}`; },
    cls(c) { return `cls-${CLS[c] || c}`; },
    status(s) { return `st-${s}`; },
    html(id, cls = '') { return A.icons[id] ? `<i class="pi pi-${id}${cls ? ` ${cls}` : ''}" aria-hidden="true"></i>` : ''; },
    kitUrl(hero) { return `assets/icons/kit/${hero}.webp${A.kv ? `?v=${A.kv}` : ''}`; },
    kitStyle(hero, slot) { return `background-image:url(${this.kitUrl(hero)});background-position:${(SLOT[slot] ?? 0) * 25}% 0`; },
    kit(hero, slot, cls = '') { return kits.has(hero) ? `<i class="pk${cls ? ` ${cls}` : ''}" style="${this.kitStyle(hero, slot)}" aria-hidden="true"></i>` : ''; },
    // Canvas: desenha a pintura centrada em (x, y). Devolve false enquanto a imagem não chegou (ou se não existe).
    draw(c, id, x, y, size) {
      const at = A.icons[id]; if (!at) return false;
      const im = load(`assets/icons/ui-${at[0]}.webp?v=${A.packs[at[0]]?.v || ''}`); if (!im?.complete || !im.naturalWidth) return false;
      c.drawImage(im, at[1] * A.size, at[2] * A.size, A.size, A.size, x - size / 2, y - size / 2, size, size); return true;
    },
    drawKit(c, hero, slot, x, y, size) {
      if (!kits.has(hero)) return false;
      const im = load(this.kitUrl(hero)); if (!im?.complete || !im.naturalWidth) return false;
      const s = im.naturalHeight; c.drawImage(im, (SLOT[slot] ?? 0) * s, 0, s, s, x - size / 2, y - size / 2, size, size); return true;
    }
  };
  KT.Icon = Icon;
  // KT.glyph (ícone de traço por kanji) passa a devolver a pintura quando ela existe.
  const old = KT.glyph;
  KT.glyph = (k, cls) => { const id = Icon.of(k); return id && A.icons[id] ? Icon.html(id, cls) : old ? old(k, cls) : String(k ?? ''); };
})();
