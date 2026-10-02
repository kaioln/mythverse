'use strict';
// Os dois bairros da cidade: vai da capital à Cidade Mercado pela placa, confere o que tem de estar certo lá (cena,
// placas só do bairro, gente no chão, nada em cima de nada) e volta pela placa da capital. Fotografa cada passo.
// uso: node tools/ui/cdp.js tools/ui/quarter.js [largura:altura[:dpr[:toque]] ...]      padrão: 1366×768 e 375×700 (toque)
module.exports = async (p, sizes) => {
  if (!sizes.length) sizes = ['1366:768', '375:700:2:1'];
  const bad = [];
  for (const size of sizes) {
    const [w, h, dpr = '1', mobile = '0'] = size.split(':'), tag = `bairro_${w}x${h}`, touch = mobile === '1';
    await p.open(`/index.html?devoffline&devseed=erik,akira,warden,aurelia&devlvl=30&v=${Date.now()}`, { w:+w, h:+h, dpr:+dpr, mobile:touch });
    await p.until(`!!(globalThis.KT && KT.dev && KT.dev.ui)`); await p.wait(4200);
    await p.eval(`(() => { const ui = KT.dev.ui; ui.dialogQueue.length = 0; ui.advanceDialog(); return true; })()`); await p.wait(900);
    // a placa (PC) ou o botão da grade de distritos (celular) que leva ao outro bairro
    const go = q => p.eval(`(() => { const all = [...document.querySelectorAll('#village-actions .signpost')], i = all.findIndex(b => b.dataset.quarter === ${JSON.stringify(q)});
      const b = all[i]?.offsetWidth ? all[i] : document.querySelector('#district-grid [data-district="' + i + '"]'); if (!b || !b.offsetWidth) return false; b.click(); return true; })()`);
    const look = () => p.eval(`(() => { const r = KT.dev.renderer, ui = KT.dev.ui, box = el => { const b = el.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; };
      const posts = [...document.querySelectorAll('#village-actions .signpost')].filter(b => b.offsetWidth), stage = document.querySelector('#viewport').getBoundingClientRect();
      const over = []; posts.forEach((a, i) => posts.slice(i + 1).forEach(b => { const A = box(a), B = box(b); if (A[0] < B[2] - 1 && A[2] > B[0] + 1 && A[1] < B[3] - 1 && A[3] > B[1] + 1) over.push(a.textContent.trim() + ' × ' + b.textContent.trim()); }));
      const out = posts.filter(b => { const B = box(b); return B[0] < stage.left - 1 || B[2] > stage.right + 1 || B[1] < stage.top - 1 || B[3] > stage.bottom + 1; }).map(b => b.textContent.trim());
      const chip = document.querySelector('.zone-chip'), C = chip && chip.offsetWidth ? box(chip) : null;
      const hid = C ? posts.filter(b => { const B = box(b); return B[0] < C[2] && B[2] > C[0] && B[1] < C[3] && B[3] > C[1]; }).map(b => b.textContent.trim()) : [];
      const M = KT.TownMap.of(r.quarter), town = r.town, people = town ? town.agents.filter(a => a.kind !== 'animal') : [];
      const off = people.filter(a => !a.fixed && !M.isWalk(a.x, a.y)).map(a => a.name);
      return { bairro:r.quarter, corpo:document.body.classList.contains('q-market'), titulo:document.querySelector('#zone-title').textContent, placas:posts.map(b => b.querySelector('b').textContent), grade:[...document.querySelectorAll('#district-grid button')].filter(b => b.offsetWidth).map(b => b.textContent.trim()),
        gente:people.length, bichos:town ? town.agents.length - people.length : 0, foraDoChao:off, sobrepostas:over, foraDoPalco:out, sobONome:hid, rolagemX:document.documentElement.scrollWidth - innerWidth }; })()`);
    const check = (step, s, want, n) => {
      console.log(`${tag} ${step}`, JSON.stringify(s));
      if (s.bairro !== want) bad.push(`${tag} ${step}: bairro ${s.bairro}, esperado ${want}`);
      if ((touch ? s.grade : s.placas).length !== n) bad.push(`${tag} ${step}: ${(touch ? s.grade : s.placas).length} placas, esperado ${n}`);
      for (const k of ['foraDoChao', 'sobrepostas', 'foraDoPalco', 'sobONome']) if (s[k].length) bad.push(`${tag} ${step}: ${k} ${s[k].join(', ')}`);
      if (s.rolagemX > 0) bad.push(`${tag} ${step}: a página rola ${s.rolagemX}px para o lado`);
      if (s.gente < 20) bad.push(`${tag} ${step}: só ${s.gente} pessoas na cena`);
    };
    check('capital', await look(), 'capital', 10); await p.shot(`${tag}_1capital.jpg`);
    if (!await go('market')) { bad.push(`${tag}: não achei a placa da Cidade Mercado`); continue; }
    await p.until(`KT.dev.renderer.quarter === 'market' && KT.dev.renderer.zoneFade >= 1`); await p.wait(2600);
    const m = await look(); check('mercado', m, 'market', 7); await p.shot(`${tag}_2mercado.jpg`);
    if (!/Cidade Mercado/.test(m.titulo)) bad.push(`${tag}: o nome do lugar não mudou (${m.titulo})`);
    if (!touch) {     // de perto: portão, bazar e as pontes, onde as pessoas passam por trás da arte
      const st = await p.rect('#game-canvas'), k = st[2] / 1280, crop = (x, y, cw, ch) => [st[0] + x * k, st[1] + y * k, cw * k, ch * k];
      await p.wait(3000);
      await p.shot(`${tag}_3portao.jpg`, { clip:crop(480, 440, 480, 280), scale:Math.min(3, 1280 / (480 * k)) });
      await p.shot(`${tag}_4bazar.jpg`, { clip:crop(380, 220, 600, 330), scale:Math.min(3, 1280 / (600 * k)) });
    }
    // um serviço do bairro abre o painel dele
    await p.eval(`document.querySelectorAll('#village-actions .signpost')[[...document.querySelectorAll('#village-actions .signpost')].findIndex(b => b.dataset.badge === 'bazaar')].click()`); await p.wait(900);
    const panel = await p.eval(`({ painel:KT.dev.ui.view.panel, aba:KT.dev.ui.view.tab })`); console.log(`${tag} bazar`, JSON.stringify(panel));
    if (panel.painel !== 'shop' || panel.aba !== 'market') bad.push(`${tag}: o Grande Bazar abriu ${panel.painel}:${panel.aba}`);
    await p.eval(`KT.dev.ui.closeModal()`); await p.wait(500);
    if (!await go('capital')) { bad.push(`${tag}: não achei a placa de volta à capital`); continue; }
    await p.until(`KT.dev.renderer.quarter === 'capital' && KT.dev.renderer.zoneFade >= 1`); await p.wait(1500);
    check('volta', await look(), 'capital', 10); await p.shot(`${tag}_5volta.jpg`);
  }
  if (bad.length) throw new Error(bad.join(' · '));
};
