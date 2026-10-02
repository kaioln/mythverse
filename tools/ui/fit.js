'use strict';
// Nada comido em tela pequena: em cada painel e aba, acha o que passa da borda do painel (cortado ou escondido), o que
// faz a página rolar para o lado e texto cortado sem reticências. Quem está dentro de uma faixa que rola para o lado de
// propósito (overflow-x: auto/scroll) não conta.
// uso: node tools/ui/cdp.js tools/ui/fit.js [largura:altura[:dpr[:toque]] ...]      padrão: 320, 375 e 437 de largura
const fs = require('node:fs'), path = require('node:path');
module.exports = async (p, sizes) => {
  if (!sizes.length) sizes = ['320:568:2:1', '375:700:2:1', '437:800:2:1'];
  const src = fs.readFileSync(path.resolve(__dirname, '../../src/panels.js'), 'utf8');
  const block = src.slice(src.indexOf('const PANELS = {'), src.indexOf('P.openPanel = function'));
  const names = [...block.matchAll(/(?:^|[ ,{])([a-z][A-Za-z]*):\{ k:'/g)].map(m => m[1]);
  const all = [];
  for (const size of sizes) {
    const [w, h, dpr = '1', mobile = '0'] = size.split(':');
    await p.open(`/index.html?devoffline&devseed=erik,akira,warden,aurelia&devlvl=30&v=${Date.now()}`, { w:+w, h:+h, dpr:+dpr, mobile:mobile === '1' });
    await p.until(`!!(globalThis.KT && KT.dev && KT.dev.ui)`); await p.wait(4200);
    await p.eval(`(() => { const ui = KT.dev.ui; ui.dialogQueue.length = 0; ui.advanceDialog(); return true; })()`); await p.wait(700);
    const scan = where => p.eval(`(() => {
      const body = KT.dev.ui.el.modalBody, box = body.getBoundingClientRect(), out = [], seen = new Set();
      const name = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '');
      const scrolls = el => { for (let a = el.parentElement; a && a !== body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if ((o === 'auto' || o === 'scroll') && a.scrollWidth > a.clientWidth + 1) return true; } return false; };
      const hidden = el => { for (let a = el; a && a !== body; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.visibility === 'hidden' || cs.opacity === '0') return true; } return false; };
      if (document.documentElement.scrollWidth > innerWidth + 1) out.push('a página rola ' + (document.documentElement.scrollWidth - innerWidth) + 'px para o lado');
      if (body.scrollWidth > body.clientWidth + 1 && !['auto', 'scroll'].includes(getComputedStyle(body).overflowX)) out.push('o painel tem ' + (body.scrollWidth - body.clientWidth) + 'px escondidos à direita');
      for (const el of body.querySelectorAll('*')) {
        if (!el.offsetWidth || !el.offsetHeight || el.closest('svg') && el.tagName !== 'svg') continue;
        const r = el.getBoundingClientRect();
        if ((r.right > box.right + 1.5 || r.left < box.left - 1.5) && !scrolls(el) && !hidden(el)) { const k = name(el); if (!seen.has(k)) { seen.add(k); out.push('fora do painel: ' + k + ' (' + Math.round(r.left - box.left) + '..' + Math.round(r.right - box.left) + ' de ' + Math.round(box.width) + ')'); } }
      }
      return out.slice(0, 6).map(x => ${JSON.stringify(where)} + ' · ' + x);
    })()`);
    for (const name of names) {
      const tabs = await p.eval(`(() => { const ui = KT.dev.ui, e = KT.dev.engine; try { ui.openPanel(${JSON.stringify(name)}, ${JSON.stringify(name)} === 'hero' ? ui.state.collection[0].uid : ${JSON.stringify(name)} === 'destination' ? 'hunt' : null); } catch (err) { return []; } return [...new Set([...document.querySelectorAll('#modal [data-tab]')].map(b => b.dataset.tab))]; })()`);
      await p.wait(200);
      if (!tabs.length) { all.push(...await scan(`${w}px ${name}`)); continue; }
      for (const t of tabs) {
        await p.eval(`(() => { const b = document.querySelector('#modal [data-tab="${t}"]'); if (b) b.click(); return true; })()`); await p.wait(200);
        all.push(...await scan(`${w}px ${name}:${t}`));
      }
    }
  }
  const uniq = [...new Set(all)];
  console.log(JSON.stringify({ achados:uniq.length }));
  for (const f of uniq.slice(0, 80)) console.log(' ', f);
  if (uniq.length) throw new Error(`${uniq.length} coisa(s) fora do lugar em tela pequena`);
};
