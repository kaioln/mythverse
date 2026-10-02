'use strict';
// Console de batalha em uso: cursor (ou dedo parado) sobre uma habilidade, efeitos, golpe cronometrado, Assalto Total e AUTO.
// uso: node tools/ui/cdp.js tools/ui/play.js nome largura altura [dpr] [toque(0|1)]
module.exports = async (p, [name = 'uso', w = '1366', h = '657', dpr = '1', mobile = '0']) => {
  const touch = mobile === '1', shot = f => p.shot(`${name}_${f}.jpg`);
  await p.open(p.fightUrl(), { w:+w, h:+h, dpr:+dpr, mobile:touch });
  await p.inFight(); await p.wait(2500);
  const crop = async (f, top = 0) => { const [x, y, ww, hh] = await p.rect('#battle-hud'); return p.shot(`${name}_${f}.jpg`, { clip:[x - 4, y - 10 - top, ww + 8, hh + 16 + top], scale:Math.min(2, 1600 / (ww + 8)) }); };
  const state = () => p.eval(`(() => { const e = KT.dev.engine, ui = KT.dev.ui; return { vez:e.awaiting, pt:e.sp, comando:e.mode, anel:!!ui.bhPending, linha:document.querySelector('.bh-info').textContent, dica:!document.querySelector('#tooltip').hidden }; })()`);
  console.log('início', JSON.stringify(await state()));

  // 1. cursor (ou dedo parado) sobre a habilidade I: a linha de informação explica; a dica flutuante é só do toque
  const s0 = await p.rect('[data-ab="s0"]'), cx = s0[0] + s0[2] / 2, cy = s0[1] + s0[3] / 2;
  if (touch) { await p.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{ x:cx, y:cy }] }); await p.wait(750); } else { await p.hover(cx, cy); await p.wait(700); }
  console.log('sobre a habilidade', JSON.stringify(await state()));
  await shot('1_habilidade');
  if (touch) { await p.send('Input.dispatchTouchEvent', { type:'touchCancel', touchPoints:[] }); await p.wait(200); } else await p.hover(5, 300);

  // 2. efeitos, escudo, vida baixa e energia (applyStatus para veneno e queimadura: precisam do ATK de quem aplicou)
  await p.eval(`(() => { const e = KT.dev.engine, h = e.party; e.addEffect(h[0], { s:'atk', v:.2, d:30, src:h[0] }); e.addEffect(h[0], { s:'def', v:.2, d:30, src:h[0] }); e.applyStatus(e.enemies[0], h[1], { s:'burn', v:.05, d:30 }); e.addEffect(h[1], { s:'slow', v:.2, d:30, src:h[0] }); e.addEffect(h[1], { s:'crit', v:.2, d:30, src:h[0] }); e.addEffect(h[1], { s:'regen', v:.02, d:30, src:h[0] }); h[2].shield = h[2].maxHp * .25; h[3].hp = h[3].maxHp * .22; h[0].energy = 100; h[1].energy = 64;
    const t = e.enemies.find(x => x.alive); e.addEffect(t, { s:'armorBreak', v:.2, d:30, src:h[0] }); e.applyStatus(h[0], t, { s:'poison', v:.05, d:30 }); return true; })()`);
  await p.wait(500); await shot('2_efeitos'); await crop('2_efeitos_console');

  // 3. atacar: o anel do golpe cronometrado
  await p.click('[data-ab="attack"]'); await p.wait(330);
  console.log('anel', JSON.stringify(await state())); await shot('3_anel');
  await p.wait(1500); console.log('depois do golpe', JSON.stringify(await state()));

  // 4. Assalto Total: todos os inimigos quebrados
  await p.eval(`(() => { const e = KT.dev.engine; for (const x of e.enemies) if (x.alive) { x.tough = 0; x.broken = 4; } e.checkAllOut(); return e.allOut; })()`);
  await p.wait(400); console.log('assalto', JSON.stringify(await state())); await crop('4_assalto_console', 70);

  // 5. comando AUTO: a barra acompanha quem age
  await p.eval(`KT.dev.ui.setMode('auto')`); await p.wait(2600);
  console.log('auto', JSON.stringify(await state())); await shot('5_auto');
};
