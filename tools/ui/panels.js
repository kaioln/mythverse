'use strict';
// Varredura de painéis: abre cada painel e cada aba, com uma luta rodando ao fundo, e acusa exceção, erro de console
// ou painel vazio. (Os testes de `npm test` não abrem a interface: uma aba quebrada já foi para produção assim.)
// uso: node tools/ui/cdp.js tools/ui/panels.js [largura] [altura] [dpr] [toque(0|1)]
const fs = require('node:fs'), path = require('node:path');
module.exports = async (p, [w = '1366', h = '657', dpr = '1', mobile = '0']) => {
  const src = fs.readFileSync(path.resolve(__dirname, '../../src/panels.js'), 'utf8');
  const block = src.slice(src.indexOf('const PANELS = {'), src.indexOf('P.openPanel = function'));
  const names = [...block.matchAll(/(?:^|[ ,{])([a-z][A-Za-z]*):\{ k:'/g)].map(m => m[1]);
  await p.open(p.fightUrl({ mode:'auto' }), { w:+w, h:+h, dpr:+dpr, mobile:mobile === '1' });
  await p.inFight(); await p.wait(2000);
  const res = await p.eval(`(async () => {
    const ui = KT.dev.ui, e = KT.dev.engine, names = ${JSON.stringify(names)}, out = [], sleep = ms => new Promise(r => setTimeout(r, ms));
    let tabs = 0;
    for (const name of names) {
      const param = name === 'hero' ? e.party[0].recUid : name === 'destination' ? 'hunt' : null;
      try { ui.openPanel(name, param); } catch (err) { out.push(name + ': abrir → ' + err.message); continue; }
      await sleep(60);
      const list = [...new Set([...document.querySelectorAll('#modal [data-tab]')].map(b => b.dataset.tab))];
      for (const t of list) {
        const b = document.querySelector('#modal [data-tab="' + t + '"]'); if (!b) continue;
        try { b.click(); ui.refreshPanel?.(); tabs++; } catch (err) { out.push(name + ':' + t + ' → ' + err.message); }
        await sleep(40);
        if (!ui.el.modalBody.textContent.trim()) out.push(name + ':' + t + ' → vazio');
      }
      if (!list.length) { try { ui.refreshPanel?.(); } catch (err) { out.push(name + ': atualizar → ' + err.message); } if (!ui.el.modalBody.textContent.trim()) out.push(name + ' → vazio'); }
    }
    try { ui.closeModal?.(); } catch {}
    return { paineis:names.length, abas:tabs, achados:out };
  })()`);
  console.log(JSON.stringify(res));
  if (res.achados.length) throw new Error(`${res.achados.length} painel(is) com problema`);
};
