'use strict';
// Enciclopédia: abre cada assunto (nada pode quebrar nem ficar vazio), confere a página inicial, a busca em tudo, o
// salto do resultado até o trecho, o índice das páginas longas e o filtro de heróis. Fotografa os principais.
// uso: node tools/ui/cdp.js tools/ui/wiki.js [largura altura dpr toque]
module.exports = async (p, [w = '1366', h = '800', dpr = '1', mobile = '0']) => {
  const bad = [], tag = `wiki_${w}`;
  await p.open(`/index.html?devoffline&devseed=erik,akira,warden,aurelia&devlvl=30&v=${Date.now()}`, { w:+w, h:+h, dpr:+dpr, mobile:mobile === '1' });
  await p.until(`!!(globalThis.KT && KT.dev && KT.dev.ui)`); await p.wait(4200);
  await p.eval(`(() => { const ui = KT.dev.ui; ui.dialogQueue.length = 0; ui.advanceDialog(); return true; })()`); await p.wait(700);
  await p.eval(`KT.dev.ui.openPanel('wiki', 'start')`); await p.wait(700);
  const tabs = await p.eval(`[...document.querySelectorAll('#modal [data-wiki-tab]')].filter(b => b.closest('.wiki-nav')).map(b => b.dataset.wikiTab)`);
  const hub = await p.eval(`({ cartoes:document.querySelectorAll('.wiki-hub-card').length, semIcone:[...document.querySelectorAll('.wiki-hub-card .pi')].filter(i => getComputedStyle(i).backgroundImage === 'none').length })`);
  console.log('início', JSON.stringify(hub), 'assuntos', tabs.length);
  if (hub.cartoes !== tabs.length - 1) bad.push(`página inicial com ${hub.cartoes} cartões para ${tabs.length - 1} assuntos`);
  if (hub.semIcone) bad.push(`${hub.semIcone} cartão(ões) da página inicial sem ícone`);
  await p.shot(`${tag}_inicio.jpg`, { quality:80 });
  for (const t of tabs) {
    const m = await p.eval(`(() => { let err = ''; try { KT.dev.ui.openPanel('wiki', ${JSON.stringify(t)}); } catch (e) { err = String(e.message || e); } const b = KT.dev.ui.el.modalBody.querySelector('.wiki-body');
      return { err, texto:b ? b.textContent.trim().length : 0, toc:b ? b.querySelectorAll('.wiki-toc button').length : 0, h4:b ? b.querySelectorAll('[data-wiki-h]').length : 0, larg:KT.dev.ui.el.modalBody.scrollWidth - KT.dev.ui.el.modalBody.clientWidth }; })()`);
    if (m.err) bad.push(`${t}: ${m.err}`);
    if (m.texto < 200) bad.push(`${t}: página quase vazia (${m.texto} letras)`);
    if (m.toc && m.toc !== m.h4) bad.push(`${t}: índice com ${m.toc} botões para ${m.h4} subtítulos`);
    if (m.larg > 1) bad.push(`${t}: ${m.larg}px escondidos à direita`);
    if (['combat', 'heroes', 'city', 'items'].includes(t)) { await p.wait(500); await p.shot(`${tag}_${t}.jpg`, { quality:80 }); }
  }
  // busca em tudo: digita, vê resultados de mais de um assunto, clica no primeiro e chega ao trecho
  const type = q => p.eval(`(() => { const i = document.querySelector('#wiki-search'); i.focus(); i.value = ${JSON.stringify(q)}; i.dispatchEvent(new Event('input', { bubbles:true })); return true; })()`);
  await p.eval(`KT.dev.ui.openPanel('wiki', 'start')`); await p.wait(300);
  for (const [q, min] of [['quebra', 3], ['leiloes', 1], ['fragmentos', 2], ['Shirogane', 1], ['cidade mercado', 1]]) {
    await type(q); await p.wait(700);
    const r = await p.eval(`({ n:document.querySelectorAll('.wiki-hit').length, abas:[...new Set([...document.querySelectorAll('.wiki-hit')].map(b => b.dataset.wikiTab))], foco:document.activeElement?.id, marcas:document.querySelectorAll('.wiki-hit mark').length })`);
    console.log('busca', q, JSON.stringify(r));
    if (r.n < min) bad.push(`busca "${q}": ${r.n} resultado(s)`);
    if (r.foco !== 'wiki-search') bad.push(`busca "${q}": o campo perdeu o foco`);
    if (r.n && !r.marcas) bad.push(`busca "${q}": nada destacado nos resultados`);
  }
  await type('aparo'); await p.wait(700); await p.shot(`${tag}_busca.jpg`, { quality:80 });
  const went = await p.eval(`(() => { const b = document.querySelector('.wiki-hit'); const want = b.dataset.wikiTab; b.click(); return { want, tab:KT.dev.ui.view.tab, achou:!!document.querySelector('.wiki-found'), campo:document.querySelector('#wiki-search').value }; })()`);
  console.log('resultado', JSON.stringify(went));
  if (went.tab !== went.want || !went.achou || went.campo) bad.push(`o resultado da busca não levou ao trecho: ${JSON.stringify(went)}`);
  await type('zzzxq'); await p.wait(600);
  if (!await p.eval(`/Nada encontrado/.test(document.querySelector('.wiki-body').textContent)`)) bad.push('busca sem resultado não avisa');
  await type(''); await p.wait(500);
  // filtro de heróis
  await p.eval(`KT.dev.ui.openPanel('wiki', 'heroes')`); await p.wait(400);
  const all = await p.eval(`document.querySelectorAll('.wiki-hero').length`);
  await p.eval(`document.querySelector('[data-wiki-filter="cls:Suporte"]').click()`); await p.wait(400);
  const sup = await p.eval(`({ n:document.querySelectorAll('.wiki-hero').length, ok:[...document.querySelectorAll('.wiki-hero .cls-tag')].every(t => /Suporte/.test(t.textContent)), icones:document.querySelectorAll('.wiki-hero .pk').length })`);
  console.log('heróis', all, 'suporte', JSON.stringify(sup));
  if (!(sup.n > 0 && sup.n < all && sup.ok)) bad.push(`filtro de heróis: ${JSON.stringify(sup)} de ${all}`);
  if (sup.icones < sup.n * 4) bad.push(`heróis sem ícone de habilidade (${sup.icones} ícones para ${sup.n} heróis)`);
  await p.eval(`document.querySelector('[data-wiki-filter="cls:"]').click()`);
  // índice da página: o botão leva ao subtítulo
  await p.eval(`KT.dev.ui.openPanel('wiki', 'items')`); await p.wait(400);
  await p.eval(`document.querySelectorAll('.wiki-toc button')[2].click()`); await p.wait(900);
  const jump = await p.eval(`(() => { const hd = document.querySelector('[data-wiki-h="2"]'); return hd ? Math.round(hd.getBoundingClientRect().top - KT.dev.ui.el.modalBody.getBoundingClientRect().top) || 0 : -999; })()`);
  console.log('salto', jump); if (!(jump >= -4 && jump <= 220)) bad.push(`o índice não levou ao subtítulo (ficou a ${jump}px do topo)`);
  if (bad.length) throw new Error(bad.join(' · '));
};
