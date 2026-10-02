'use strict';
// Dica flutuante: passa o cursor em elementos da cidade e da luta e acusa a dica que sair da tela ou ficar longe do alvo.
// Em tela larga a página inteira é ampliada (html{zoom}): quem posiciona pelo retângulo de outra coisa tem de dividir
// pelo zoom (KT.pageZoom), senão a dica vai parar fora da tela. Por isso o padrão confere 1366, 1920 e 2560.
// uso: node tools/ui/cdp.js tools/ui/tips.js [largura:altura ...]
module.exports = async (p, sizes) => {
  if (!sizes.length) sizes = ['1366:657', '1920:1080', '2560:1440'];
  const bad = [];
  for (const size of sizes) {
    const [W, H] = size.split(':').map(Number);
    const probe = async (label, sel) => {
      const r = await p.rect(sel); if (!r) return;
      await p.hover(5, 5); await p.wait(150);
      await p.hover(r[0] + r[2] / 2, r[1] + r[3] / 2); await p.wait(650);
      const t = await p.eval(`(() => { const t = document.querySelector('#tooltip'); if (!t || t.hidden) return null; const b = t.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; })()`);
      if (!t) return;
      const [x, y, tw, th] = t, out = x < 0 || y < 0 || x + tw > W || y + th > H, gap = Math.min(Math.abs(y - (r[1] + r[3])), Math.abs(r[1] - (y + th)));
      console.log(size, label, JSON.stringify({ alvo:r, dica:t, fora:out, distancia:gap }));
      if (out) bad.push(`${size} ${label}: dica fora da tela`);
      else if (gap > 24) bad.push(`${size} ${label}: dica a ${gap}px do alvo`);
    };
    await p.open(`/index.html?devoffline&devseed=erik,akira,warden,aurelia&devlvl=30&v=${Date.now()}`, { w:W, h:H });
    await p.until(`!!(globalThis.KT && KT.dev && KT.dev.ui)`); await p.wait(4500);
    await p.eval(`(() => { const ui = KT.dev.ui; ui.dialogQueue.length = 0; ui.advanceDialog(); return true; })()`); await p.wait(1200);
    await probe('saguão: mapa', '#lobby-bar [data-go="journey"]');
    await probe('saguão: preparar', '#lobby-bar [data-lobby-prep]');
    await probe('saguão: poder', '#lobby-bar .lt-power');
    await probe('topo: ouro', '.res.gold');
    await probe('topo: salvar', '#save-status');
    await probe('cidade: forja', '#village-actions [data-open="city:forge"]');
    await p.open(p.fightUrl({ zone:'boss', stage:1 }), { w:W, h:H });
    await p.inFight(); await p.wait(2500);
    await probe('chefe: resistência', '#boss-break');
    await probe('luta: velocidade', '#speed-btn');
    await probe('luta: alvo', '.bh-target');
    await probe('luta: técnica', '.bh-sp');
    await probe('luta: comando', '.bh-mode button');
  }
  if (bad.length) throw new Error(`${bad.length} dica(s) fora do lugar: ${bad.slice(0, 6).join(' · ')}`);
};
