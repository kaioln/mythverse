// Ícones desenhados (traço 24×24) no lugar dos kanji de efeitos, elementos, classes, eventos, prédios e espaços de item.
// Os dados continuam com o kanji como chave; KT.glyph troca pelo desenho na hora de mostrar (HTML) e
// KT.Icons.draw faz o mesmo no canvas do combate. Kanji sem desenho aparece como texto (nunca some).
(function () {
  const P = {
    flame:'M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-3 2-4 3-6 0 2 1 3 2 3 0-3-1-5 0-8z',
    drop:'M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z',
    poison:'M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11zM10 13h.01M14 16h.01M12 10h.01',
    blood:'M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11zM9 14a3 3 0 0 0 3 3',
    leaf:'M5 19C5 10 10 5 20 4c-1 10-6 15-15 15zM5 19l8-8',
    rock:'M3 19l6-10 4 6 3-4 5 8z',
    bolt:'M13 2 5 14h6l-1 8 8-12h-6z',
    wind:'M3 9h11a3 3 0 1 0-3-3M3 14h15a3 3 0 1 1-3 3M3 19h7',
    snow:'M12 2v20M4 7l16 10M20 7 4 17M9 4l3 2 3-2M9 20l3-2 3 2',
    sun:'M12 8a4 4 0 1 0 0 8 4 4 0 1 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',
    moon:'M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z',
    shield:'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z',
    guard:'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6zM12 8v8M8 12h8',
    barrier:'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6zM8 11h8M8 15h8',
    broken:'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6zM12 6l-2 5 3 2-2 5',
    blade:'M5 19l2-2M4 16l4 4M7 17 19 5V3h-2L5 15',
    sword:'M14.5 4H20v5.5L9 20.5 3.5 15zM6 13l5 5M3 21l3-3',
    staff:'M12 3a3 3 0 1 0 0 6 3 3 0 1 0 0-6M12 9v12M9 21h6M8 5l-2-2M16 5l2-2',
    bow:'M6 3c8 3 8 15 0 18M6 3v18M4 12h16M17 9l3 3-3 3',
    arrow:'M4 20 20 4M14 4h6v6M4 20l2-5M4 20l5-2',
    cross:'M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z',
    coin:'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18M12 7a5 5 0 1 0 0 10 5 5 0 1 0 0-10',
    lantern:'M9 3h6M8 6h8l1 3v6l-1 3H8l-1-3V9zM12 18v3M10 21h4M7 12h10',
    blossom:'M12 3a3 3 0 0 1 3 4 3 3 0 0 1 4 3 3 3 0 0 1-2 4 3 3 0 0 1-1 4 3 3 0 0 1-4-1 3 3 0 0 1-4 1 3 3 0 0 1-1-4 3 3 0 0 1-2-4 3 3 0 0 1 4-3 3 3 0 0 1 3-4zM12 11v2',
    oni:'M5 3l3 5M19 3l-3 5M6 9a6 6 0 0 0 12 0v5a6 6 0 0 1-12 0zM9.5 12h.01M14.5 12h.01M9 16l1.5 1 1.5-1 1.5 1 1.5-1',
    spirit:'M12 3c4 0 6 3 6 7 0 5-3 6-3 11-2-2-4-1-6-2 1-2-3-3-3-7 0-5 3-9 6-9zM10 10h.01M14 10h.01',
    star:'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4l-5.3 3 1.2-6L3.4 9.3l6-.7z',
    anvil:'M3 7h13l5-2v4l-4 2v3H7v-3C5 11 3 9 3 7zM10 14l-2 6h9l-2-6',
    hammer:'M14 3l7 7-3 3-7-7zM11 8 3 16l3 3 8-8',
    path:'M8 21l2-18M16 21l-2-18M12 5v2M12 11v2M12 17v2',
    torii:'M3 5h18M5 5l1 3h12l1-3M7 8v13M17 8v13M5 12h14',
    castle:'M4 21V9h3V6h3v3h4V6h3v3h3v12zM10 21v-5h4v5',
    market:'M4 9l2-5h12l2 5zM5 9v11h14V9M9 20v-6h6v6',
    house:'M3 11l9-7 9 7M5 10v10h14V10M10 20v-5h4v5',
    pick:'M3 21 13 11M6 7c4-4 10-4 14 0-4-1-8 0-11 3z',
    potion:'M10 3h4M10 3v5l-5 9a3 3 0 0 0 3 4h8a3 3 0 0 0 3-4l-5-9V3M7 15h10',
    globe:'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
    screen:'M4 4h7v16H4zM13 4h7v16h-7z',
    chest:'M3 9h18v11H3zM3 9l2-5h14l2 5M10 12h4',
    dragon:'M3 18c4 0 4-6 8-6s4 6 8 6M15 9a3 3 0 1 1 3-3M18 6l3-2M18 9l3 1',
    spiral:'M12 12a1 1 0 0 1 2 0 3 3 0 0 1-3 3 5 5 0 0 1-5-5 7 7 0 0 1 7-7 9 9 0 0 1 9 9',
    clock:'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18M12 7v5l3 2',
    target:'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18M12 8a4 4 0 1 0 0 8 4 4 0 1 0 0-8M12 1v4M12 19v4M1 12h4M19 12h4',
    down:'M12 4v14M6 12l6 6 6-6',
    mute:'M4 5h16v11H9l-5 4zM9 8l6 5M15 8l-6 5',
    swords:'M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M9.5 17.5 21 6V3h-3L6.5 14.5M11 19l-6-6M8 16l-4 4',
    haste:'M5 6l6 6-6 6M13 6l6 6-6 6',
    eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6',
    skull:'M12 3a7 7 0 0 0-7 7c0 3 2 4 2 6h10c0-2 2-3 2-6a7 7 0 0 0-7-7zM9 16v4h6v-4M9.5 10.5h.01M14.5 10.5h.01',
    feather:'M20 4C10 4 5 10 5 19l3-3h5c4-3 7-7 7-12zM5 19 15 9',
    fang:'M5 4h14l-2 6-2-2-2 6-2-6-2 2zM12 15s3 3 3 4.5a3 3 0 0 1-6 0c0-1.5 3-4.5 3-4.5',
    hidden:'M2 12s4-7 10-7c2 0 4 .7 5.5 1.8M22 12s-4 7-10 7c-2 0-4-.7-5.5-1.8M3 3l18 18',
    alert:'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18M12 7v6M12 16.5v.01',
    book:'M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM4 19V5M9 7h7',
    ingot:'M3 17l3-8h12l3 8zM8 9l1-3h6l1 3',
    emblem:'M12 2l3 5 5 1-3.5 4 .5 5.5L12 15l-5 2.5.5-5.5L4 8l5-1z',
    gem:'M6 3h12l4 6-10 12L2 9zM2 9h20M9 3l3 18M15 3l-3 18',
    sparkle:'M12 3l2 7 7 2-7 2-2 7-2-7-7-2 7-2z',
    diamond:'M12 3l8 9-8 9-8-9z'
  };
  const MAP = {
    '火':'flame', '焼':'flame', '水':'drop', '木':'leaf', '土':'rock', '雷':'bolt', '風':'wind', '氷':'snow', '凍':'snow',
    '光':'sun', '闇':'moon', '月':'moon', '盾':'shield', '守':'guard', '障':'barrier', '破':'broken', '刃':'blade', '剣':'sword',
    '武':'sword', '術':'staff', '弓':'bow', '矢':'arrow', '癒':'cross', '✚':'cross', '金':'coin', '血':'blood', '灯':'lantern',
    '桜':'blossom', '季':'blossom', '鬼':'oni', '霊':'spirit', '魂':'spirit', '星':'star', '鍛':'anvil', '匠':'hammer', '鎚':'hammer',
    '工':'hammer', '道':'path', '社':'torii', '城':'castle', '市':'market', '家':'house', '鉱':'pick', '薬':'potion', '錬':'potion',
    '界':'globe', '屏':'screen', '箱':'chest', '龍':'dragon', '毒':'poison', '眩':'spiral', '遅':'clock', '印':'target', '⬇':'down',
    '黙':'mute', '怒':'swords', '速':'haste', '精':'eye', '殺':'skull', '避':'feather', '吸':'fang', '影':'hidden', '挑':'alert',
    '書':'book', '鋼':'ingot', '章':'emblem', '晶':'gem', '✦':'sparkle', '◆':'diamond', '危':'alert', '神':'torii'
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const cache = new Map();
  const Icons = {
    paths:P, map:MAP,
    name(k) { return MAP[k] || (P[k] ? k : null); },
    // HTML: <svg> com traço na cor do texto (use color/--ec do pai). Sem desenho, devolve o texto.
    svg(k, cls = '') { const n = this.name(k); return n ? `<svg class="gl ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[n]}"/></svg>` : esc(k ?? ''); },
    // Canvas: desenha o ícone centrado em (x, y) com o tamanho pedido. Devolve false se não houver desenho.
    draw(c, k, x, y, size, color, width = 2.4) {
      const n = this.name(k); if (!n || typeof Path2D === 'undefined') return false;
      let p = cache.get(n); if (!p) { p = new Path2D(P[n]); cache.set(n, p); }
      c.save(); c.translate(x - size / 2, y - size / 2); c.scale(size / 24, size / 24);
      c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(p); c.restore();
      return true;
    }
  };
  (globalThis.KT ||= {}).Icons = Icons;
  KT.glyph = (k, cls) => Icons.svg(k, cls);
})();
