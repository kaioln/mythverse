'use strict';
// Estouro no console de batalha: nada passa da borda do seu painel nem da tela, e texto só corta onde foi previsto
// (reticências ou esfumado). As molduras são enchidas de efeitos antes da medida.
// uso: node tools/ui/cdp.js tools/ui/overflow.js largura:altura[:dpr[:toque(0|1)]] ...
module.exports = async (p, specs) => {
  if (!specs.length) specs = ['1366:657', '1024:700', '1100:900', '1920:1080', '950:620', '768:1024:1:1', '425:900:2:1', '375:812:2:1', '320:640:2:1'];
  let bad = 0;
  for (const spec of specs) {
    const [w, h, dpr = '1', mobile = '0'] = spec.split(':');
    await p.open(p.fightUrl(), { w:+w, h:+h, dpr:+dpr, mobile:mobile === '1' });
    await p.inFight(); await p.wait(2500);
    await p.eval(`(() => { const e = KT.dev.engine, h = e.party; for (const u of h) { for (const s of ['atk', 'def', 'crit', 'regen']) e.addEffect(u, { s, v:.2, d:60, src:u }); u.shield = u.maxHp * .2; } const t = e.enemies.find(x => x.alive); for (const s of ['armorBreak', 'mark', 'weaken']) e.addEffect(t, { s, v:.2, d:60, src:h[0] }); return true; })()`);
    await p.wait(500);
    const res = await p.eval(`(() => {
      const hud = document.querySelector('#battle-hud'), out = [], vw = innerWidth;
      const name = el => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : '');
      // quem está dentro de uma caixa que corta (overflow escondido) não aparece: não conta
      const clipped = el => { const r = el.getBoundingClientRect(); for (let a = el.parentElement; a && a !== hud; a = a.parentElement) { if (getComputedStyle(a).overflow === 'visible') continue; const b = a.getBoundingClientRect(); if (r.right <= b.left || r.left >= b.right || r.bottom <= b.top || r.top >= b.bottom) return true; } return false; };
      for (const el of hud.querySelectorAll('*')) {
        if ((!el.offsetWidth && !el.offsetHeight) || clipped(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.right > vw + .5 || r.left < -.5) out.push('fora da tela: ' + name(el) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
        const panel = el.closest('.bh-panel'); if (!panel || panel === el) continue;
        const pr = panel.getBoundingClientRect(), slack = el.tagName === 'KBD' || el.matches('.ab-cost, .ab-count, .bh-allout') ? 10 : 1.5;
        if (r.left < pr.left - slack || r.right > pr.right + slack || r.top < pr.top - slack || r.bottom > pr.bottom + slack) out.push('fora do painel ' + name(panel).slice(0, 28) + ': ' + name(el).slice(0, 40) + ' [' + [r.left - pr.left, r.top - pr.top, r.right - pr.right, r.bottom - pr.bottom].map(v => Math.round(v)).join(',') + ']');
      }
      for (const el of hud.querySelectorAll('b, small, em, span, p')) {
        if (!el.offsetWidth) continue;
        const cs = getComputedStyle(el); if (cs.overflow === 'visible') continue;
        const mask = (cs.maskImage && cs.maskImage !== 'none') || (cs.webkitMaskImage && cs.webkitMaskImage !== 'none');
        if (el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis' && !mask && cs.flexWrap !== 'wrap') out.push('texto cortado: ' + name(el).slice(0, 40) + ' "' + el.textContent.slice(0, 30) + '"');
      }
      const nav = document.querySelector('.side-nav').getBoundingClientRect(), hr = hud.getBoundingClientRect(), limit = matchMedia('(max-width:900px)').matches ? nav.top : innerHeight;
      if (document.documentElement.scrollWidth > vw) out.push('a página rola para o lado');
      if (hr.bottom > limit + 1) out.push('o console passa do limite em ' + Math.round(hr.bottom - limit) + 'px');
      return { tela:[innerWidth, innerHeight], console:[Math.round(hr.left), Math.round(hr.top), Math.round(hr.width), Math.round(hr.height)], achados:[...new Set(out)].slice(0, 14) };
    })()`);
    bad += res.achados.length;
    console.log(JSON.stringify(res));
  }
  if (bad) throw new Error(`${bad} achado(s) de estouro`);
};
