'use strict';
// Console de batalha: para cada tamanho, as medidas, uma foto inteira e um recorte ampliado do console.
// uso: node tools/ui/cdp.js tools/ui/hud.js nome:largura:altura[:dpr[:toque(0|1)[:zona[:estágio]]]] ...
//   ex.: d657:1366:657  d1080:1920:1080  m375:375:812:2:1  chefe:1366:657:1:0:boss:1
module.exports = async (p, specs) => {
  if (!specs.length) specs = ['d657:1366:657', 'd730:1536:730', 'd1080:1920:1080', 's1024:1024:700', 't768:768:1024:1:1', 'm375:375:812:2:1', 'm360:360:700:2:1', 'm320:320:640:2:1'];
  for (const spec of specs) {
    const [name, w, h, dpr = '1', mobile = '0', zone = 'hunt', stage = '6'] = spec.split(':');
    await p.open(p.fightUrl({ zone, stage }), { w:+w, h:+h, dpr:+dpr, mobile:mobile === '1' });
    await p.inFight(); await p.wait(2500);
    const info = await p.eval(`(() => { const r = s => { const el = document.querySelector(s); if (!el || !el.offsetWidth) return null; const b = el.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
      const nav = r('.side-nav'), hud = r('#battle-hud'), narrow = matchMedia('(max-width:900px)').matches;
      return { tela:[innerWidth, innerHeight], palco:r('#viewport'), console:hud, herois:r('.bh-party'), equipe:r('.bh-side'), comando:r('.bh-mid'), botao:r('.bh-bar .ab'), alvo:r('.bh-target'), sobra:(narrow ? nav[1] : innerHeight) - (hud[1] + hud[3]), rolagemX:document.documentElement.scrollWidth - innerWidth, aoLado:document.body.classList.contains('bh-l') }; })()`);
    console.log(name, JSON.stringify(info));
    await p.shot(`${name}_tela.jpg`);
    const [x, y, ww, hh] = info.console; await p.shot(`${name}_console.jpg`, { clip:[x - 4, y - 10, ww + 8, hh + 16], scale:Math.min(2, 1600 / ww) });
  }
};
