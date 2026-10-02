'use strict';
// Comando MANUAL pelo caminho do jogador: entra na caçada pelo botão da cidade, troca o comando no botão da tela e dá
// ordens por clique (ou toque). Acusa se a luta não esperar a ordem, se agir sozinha ou se o comando mudar com a aba
// escondida (o jogo passava para o AUTO sozinho).
// uso: node tools/ui/cdp.js tools/ui/manual.js [largura] [altura] [dpr] [toque(0|1)]
module.exports = async (p, [w = '1366', h = '657', dpr = '1', mobile = '0']) => {
  const touch = mobile === '1', bad = [];
  const st = () => p.eval(`(() => { const e = KT.dev.engine, ui = KT.dev.ui; return { fase:e.phase, modo:e.mode, vez:e.awaiting, pt:Math.round((e.sp || 0) * 10) / 10, anel:!!ui.bhPending, vivos:e.enemies.filter(x => x.alive).length, hp:Math.round(e.enemies.reduce((a, x) => a + Math.max(0, x.hp), 0)), linha:document.querySelector('.bh-info')?.textContent || '' }; })()`);
  const skipTalk = () => p.eval(`(() => { const ui = KT.dev.ui; ui.dialogQueue.length = 0; ui.advanceDialog(); return true; })()`);
  await p.open(`/index.html?devoffline&devseed=erik,akira,warden,aurelia&devlvl=30&v=${Date.now()}`, { w:+w, h:+h, dpr:+dpr, mobile:touch });
  await p.until(`!!(globalThis.KT && KT.dev && KT.dev.ui)`); await p.wait(4500); await skipTalk(); await p.wait(800);
  await p.click('#lobby-bar [data-enter]');
  await p.until(`KT.dev.engine.active && KT.dev.engine.phase === 'fight'`, 20000); await p.wait(800); await skipTalk(); await p.wait(700);
  // troca o comando pelo botão que o jogador vê: seletor do console (PC) ou botão COMANDO (celular)
  for (let i = 0; i < 3 && (await st()).modo !== 'manual'; i++) { await p.click((await p.rect('.bh-mode [data-mode="manual"]')) ? '.bh-mode [data-mode="manual"]' : '#mode-btn'); await p.wait(500); }
  if ((await st()).modo !== 'manual') bad.push('o botão de comando não chegou ao MANUAL');
  await p.until(`KT.dev.engine.phase === 'fight' && KT.dev.engine.awaiting !== null`, 40000);   // a onda pode ter acabado durante a troca
  // 1. a luta espera: 7 s sem ordem, a vez é do mesmo herói e a vida dos inimigos não muda
  const a = await st(); await p.wait(7000); const b = await st();
  console.log('espera', JSON.stringify({ antes:[a.vez, a.hp], depois:[b.vez, b.hp] }));
  if (a.vez === null || a.vez !== b.vez || a.hp !== b.hp) bad.push('a luta não esperou a ordem no MANUAL');
  // 2. aba escondida: o comando continua MANUAL e ninguém age
  await p.eval(`(() => { Object.defineProperty(document, 'hidden', { configurable:true, get:() => true }); document.dispatchEvent(new Event('visibilitychange')); return true; })()`);
  await p.wait(2500);
  const hid = await st();
  await p.eval(`(() => { Object.defineProperty(document, 'hidden', { configurable:true, get:() => false }); document.dispatchEvent(new Event('visibilitychange')); return true; })()`);
  await p.wait(600);
  console.log('aba escondida', JSON.stringify({ modo:hid.modo, vez:hid.vez, hp:hid.hp }));
  if (hid.modo !== 'manual' || hid.vez !== b.vez || hid.hp !== b.hp) bad.push('com a aba escondida o jogo agiu sozinho ou trocou o comando');
  // 3. ordens: atacar (confirma no anel), habilidade II (1 PT) e defender
  for (const what of ['attack', 's1', 'defend']) {
    await p.until(`KT.dev.engine.awaiting !== null || KT.dev.engine.phase !== 'fight'`, 15000);
    const s0 = await st(); if (s0.fase !== 'fight') break;
    await p.click(`[data-ab="${what}"]`); await p.wait(250);
    if ((await st()).anel) { await p.wait(200); await p.click(`[data-ab="${what}"]`); }
    await p.wait(900);
    const s1 = await st();
    console.log(what, JSON.stringify({ vez:[s0.vez, s1.vez], pt:[s0.pt, s1.pt] }));
    if (s1.fase === 'fight' && s1.vez === s0.vez && s1.pt === s0.pt) bad.push(`a ordem "${what}" não foi executada`);
  }
  if (bad.length) throw new Error(bad.join(' · '));
};
