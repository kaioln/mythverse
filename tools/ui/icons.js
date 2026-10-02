'use strict';
// Ícones pintados (.pi, .pk e .ic com pintura): em cada painel, aba, cidade e luta, acha os que ficaram sem imagem
// (regra de quem embrulha o ícone apagou o fundo), sem tamanho, esmagados ou fora do lugar.
// uso: node tools/ui/cdp.js tools/ui/icons.js [largura] [altura] [dpr] [toque(0|1)]
const fs = require('node:fs'), path = require('node:path');
module.exports = async (p, [w = '1366', h = '657', dpr = '1', mobile = '0']) => {
  const src = fs.readFileSync(path.resolve(__dirname, '../../src/panels.js'), 'utf8');
  const block = src.slice(src.indexOf('const PANELS = {'), src.indexOf('P.openPanel = function'));
  const names = [...block.matchAll(/(?:^|[ ,{])([a-z][A-Za-z]*):\{ k:'/g)].map(m => m[1]);
  const scan = where => p.eval(`(() => {
    const out = [], seen = new Set();
    const path = el => { const a = []; for (let n = el; n && a.length < 4 && n.id !== 'app'; n = n.parentElement) a.unshift(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (typeof n.className === 'string' && n.className ? '.' + n.className.trim().split(/\\s+/).slice(0, 3).join('.') : '')); return a.join(' > '); };
    for (const el of document.querySelectorAll('.pi, .pk')) {
      if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;          // escondido: não conta
      const cs = getComputedStyle(el), r = { width:el.offsetWidth, height:el.offsetHeight }, why = [];   // tamanho de layout (animação de escala não conta)
      if (cs.backgroundImage === 'none') why.push('sem imagem');
      if (r.width < 9 || r.height < 9) why.push('pequeno ' + Math.round(r.width) + 'x' + Math.round(r.height));
      if (Math.abs(r.width - r.height) > 1.5) why.push('esmagado ' + Math.round(r.width) + 'x' + Math.round(r.height));
      if (el.classList.contains('pi') && cs.position === 'absolute' && el.parentElement.matches('i, em, small, b')) why.push('posição herdada');
      if (!why.length) continue;
      const key = path(el) + ' | ' + why.join(', '); if (seen.has(key)) continue; seen.add(key); out.push(key);
    }
    return out.map(x => ${JSON.stringify(where)} + ' · ' + x);
  })()`);
  const found = [];
  // cidade
  await p.open(`/index.html?devoffline&devseed=erik,akira,warden,aurelia&devlvl=30&v=${Date.now()}`, { w:+w, h:+h, dpr:+dpr, mobile:mobile === '1' });
  await p.until(`!!(globalThis.KT && KT.dev && KT.dev.ui)`); await p.wait(4500);
  await p.eval(`(() => { const ui = KT.dev.ui; ui.dialogQueue.length = 0; ui.advanceDialog(); return true; })()`); await p.wait(1500);
  found.push(...await scan('cidade'));
  // luta + painéis
  await p.open(p.fightUrl({ mode:'auto' }), { w:+w, h:+h, dpr:+dpr, mobile:mobile === '1' });
  await p.inFight(); await p.wait(3000);
  found.push(...await scan('luta'));
  for (const name of names) {
    const tabs = await p.eval(`(() => { const ui = KT.dev.ui, e = KT.dev.engine; try { ui.openPanel(${JSON.stringify(name)}, ${JSON.stringify(name)} === 'hero' ? e.party[0].recUid : ${JSON.stringify(name)} === 'destination' ? 'hunt' : null); } catch (err) { return ['!' + err.message]; } return [...new Set([...document.querySelectorAll('#modal [data-tab]')].map(b => b.dataset.tab))]; })()`);
    await p.wait(250);
    if (!tabs.length) { found.push(...await scan(name)); continue; }
    for (const t of tabs) {
      if (t[0] === '!') { found.push(`${name} · não abriu: ${t.slice(1)}`); continue; }
      await p.eval(`(() => { const b = document.querySelector('#modal [data-tab="${t}"]'); if (b) b.click(); return true; })()`); await p.wait(220);
      found.push(...await scan(`${name}:${t}`));
    }
  }
  const uniq = [...new Set(found)];
  console.log(JSON.stringify({ achados:uniq.length }));
  for (const f of uniq.slice(0, 60)) console.log(' ', f);
  if (uniq.length) throw new Error(`${uniq.length} ícone(s) com problema`);
};
