'use strict';
// Fotos de painéis: abre cada painel[:aba[:rolagem]] pedido (com uma luta ao fundo) e fotografa.
// uso: node tools/ui/cdp.js tools/ui/shots.js largura:altura[:dpr[:toque]] painel[:aba[:rolagem]] ...
//   ex.: node tools/ui/cdp.js tools/ui/shots.js 1366:800 city:forge wiki:combat:700 hero:kit collection:summon
module.exports = async (p, [size = '1366:800', ...panels]) => {
  const [w, h, dpr = '1', mobile = '0'] = size.split(':');
  await p.open(p.fightUrl({ mode:'auto' }), { w:+w, h:+h, dpr:+dpr, mobile:mobile === '1' });
  await p.inFight(); await p.wait(2000);
  for (const spec of panels) {
    const [name, tab = '', scroll = '0'] = spec.split(':');
    const ok = await p.eval(`(() => { const ui = KT.dev.ui, e = KT.dev.engine; try { ui.openPanel(${JSON.stringify(name)}, ${JSON.stringify(name)} === 'hero' ? e.party[1].recUid : ${JSON.stringify(name)} === 'destination' ? 'hunt' : null); } catch (err) { return err.message; }
      const t = ${JSON.stringify(tab)}; if (t) { const b = document.querySelector('#modal [data-tab="' + t + '"]'); if (!b) return 'sem a aba ' + t; b.click(); } return true; })()`);
    if (ok !== true) { console.log(spec, '→', ok); continue; }
    await p.wait(700);
    if (+scroll) { await p.eval(`(() => { KT.dev.ui.el.modalBody.scrollTop = ${+scroll}; return true; })()`); await p.wait(300); }
    await p.shot(`painel_${name}${tab ? '_' + tab : ''}.jpg`);
  }
};
