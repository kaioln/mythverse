'use strict';
// Uma tela em vários tamanhos: fotografa a cidade, uma luta ou um painel em cada tamanho pedido, para ver de uma vez o
// que some, corta ou sobra em tela pequena. Também mede se algo passa da largura da tela.
// uso: node tools/ui/cdp.js tools/ui/sizes.js <cidade|luta|chefe|painel[:aba]> [largura:altura[:dpr[:toque]] ...]
//   ex.: node tools/ui/cdp.js tools/ui/sizes.js cidade 437:800:2:1 375:700:2:1 320:568:2:1
module.exports = async (p, [what = 'cidade', ...sizes]) => {
  if (!sizes.length) sizes = ['320:568:2:1', '375:700:2:1', '437:800:2:1', '600:900:1:1', '768:1024:1:1', '1024:640', '1366:657', '1920:1080'];
  const bad = [];
  for (const size of sizes) {
    const [w, h, dpr = '1', mobile = '0'] = size.split(':'), tag = `${what.replace(/[^a-z]/gi, '-')}_${w}x${h}`;
    if (what === 'luta' || what === 'chefe') { await p.open(p.fightUrl({ zone:what === 'chefe' ? 'boss' : 'hunt', stage:what === 'chefe' ? 1 : 6 }), { w:+w, h:+h, dpr:+dpr, mobile:mobile === '1' }); await p.inFight(); await p.wait(2500); }
    else {
      await p.open(`/index.html?devoffline&devseed=erik,akira,warden,aurelia&devlvl=30&v=${Date.now()}`, { w:+w, h:+h, dpr:+dpr, mobile:mobile === '1' });
      await p.until(`!!(globalThis.KT && KT.dev && KT.dev.ui)`); await p.wait(4200);
      await p.eval(`(() => { const ui = KT.dev.ui; ui.dialogQueue.length = 0; ui.advanceDialog(); return true; })()`); await p.wait(900);
      if (what !== 'cidade') { const [name, tab] = what.split(':'); await p.eval(`KT.dev.ui.openPanel(${JSON.stringify(name)}, ${JSON.stringify(tab || null)})`); await p.wait(1300); }
    }
    const info = await p.eval(`(() => { const q = s => { const el = document.querySelector(s); if (!el || !el.offsetWidth) return null; const b = el.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
      const r = KT.dev.renderer, v = r.view || { x:0, w:1280 };
      // unidades da luta: nenhuma pode ficar com parte fora da janela da cena
      const cut = []; for (const u of [...KT.dev.engine.party, ...KT.dev.engine.enemies]) { if (!u.alive) continue; const pp = r.posOf(u.uid); if (!pp) continue; const half = pp.h * .34; if (pp.x - half < v.x - 1 || pp.x + half > v.x + v.w + 1) cut.push(u.name.split(',')[0] + ' ' + Math.round(pp.x - half) + '..' + Math.round(pp.x + half) + ' fora de ' + Math.round(v.x) + '..' + Math.round(v.x + v.w)); }
      return { tela:[innerWidth, innerHeight], palco:q('#viewport'), cena:[Math.round(v.x), Math.round(v.w)], rolagemX:document.documentElement.scrollWidth - innerWidth, cortadas:cut }; })()`);
    console.log(tag, JSON.stringify(info));
    if (info.rolagemX > 0) bad.push(`${tag}: a página rola ${info.rolagemX}px para o lado`);
    if (info.cortadas.length) bad.push(`${tag}: ${info.cortadas.join('; ')}`);
    if (what === 'cidade' && info.cena[1] < 1280) bad.push(`${tag}: a cidade está cortada (${info.cena[1]} de 1280)`);
    await p.shot(`${tag}.jpg`);
  }
  if (bad.length) throw new Error(bad.join(' · '));
};
