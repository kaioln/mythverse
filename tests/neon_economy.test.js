'use strict';
// Tesouro Imperial, ordens de compra e travas contra manipulação do mercado (PGlite).
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  await db.exec(`CREATE SCHEMA auth;
    CREATE FUNCTION auth.user_id() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '') $$;
    CREATE ROLE authenticated; CREATE ROLE anonymous;`);
  const sql = f => fs.readFileSync(path.join(__dirname, '..', 'tools', f), 'utf8');
  await db.exec(sql('neon_setup.sql') + sql('neon_social.sql') + sql('neon_economy.sql'));
  let checks = 0;
  const as = async (uid, q, params = []) => db.transaction(async t => {
    await t.query(`SELECT set_config('test.uid', $1, true)`, [uid]);
    await t.exec('SET LOCAL ROLE authenticated');
    return (await t.query(q, params)).rows;
  });
  const one = async (uid, fn, params = []) => Object.values((await as(uid, `SELECT public.${fn}`, params))[0])[0];
  const fails = async (p, msg) => { let err = null; try { await p; } catch (e) { err = e; } assert.ok(err, msg); checks++; return err; };
  const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
  // Renda de 500 mil/h (5 milhões em 10 h de jogo): reserva saudável de 3 milhões.
  const save = (uid, gold, level) => db.query(`INSERT INTO public.mv_saves (user_id, data) VALUES ($1, $2::jsonb) ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, revision = public.mv_saves.revision + 1`, [uid, JSON.stringify({ player:{ gold, level }, stats:{ goldEarned:5000000 }, totalPlaySeconds:36000 })]);

  // ---------- Banco Central ----------
  await save('ana', 100000, 20); await save('bia', 120000, 20);
  let e = await one('ana', 'mv_economy()');
  ok(e.players === 2 && e.index < 1 && Number(e.faucet) >= 1 && e.taxBps === 500, 'economia pobre: torneira aberta e imposto mínimo');
  await fails(as('ana', 'SELECT * FROM public.mv_econ'), 'fotografias da economia não são editáveis pela API');
  // Inflação: muito ouro por jogador → a torneira fecha aos poucos, preços e impostos sobem.
  await save('ana', 900000000, 20); await save('bia', 800000000, 20);
  for (let k = 0; k < 5; k++) { await db.exec(`UPDATE public.mv_econ SET taken_at = taken_at - interval '1 hour'`); e = await one('ana', 'mv_economy()'); }
  ok(e.index > 5 && Number(e.faucet) < 1 && Number(e.faucet) >= 0.85 && Number(e.price) > 1 && e.taxBps > 500 && e.taxBps <= 1200, 'inflação fecha a torneira gradualmente e sobe preços e imposto');
  const f5 = Number(e.faucet);
  for (let k = 0; k < 40; k++) { await db.exec(`UPDATE public.mv_econ SET taken_at = taken_at - interval '1 hour'`); e = await one('ana', 'mv_economy()'); }
  ok(Number(e.faucet) >= 0.6 && Number(e.faucet) < f5, 'torneira nunca passa do limite mínimo');
  const cached = await one('bia', 'mv_economy()'); ok(cached.at === e.at, 'fotografia reaproveitada dentro de 20 minutos');
  ok(Array.isArray(e.history) && e.history.length >= 2, 'histórico da economia para o gráfico');

  // Imposto vigente vale na venda.
  const [{ mv_market_list:lid }] = await as('ana', `SELECT public.mv_market_list('mat', 'm:rare', 'Aço Estelar ×1', '', '', '{"id":"rare","qty":1}'::jsonb, 10000, 'Ana')`);
  await one('bia', 'mv_market_buy($1)', [lid]);
  const mail = (await as('ana', `SELECT * FROM public.mv_mail WHERE kind = 'gold'`))[0];
  ok(Number(mail.payload.amount) === 10000 - Math.ceil(10000 * e.taxBps / 10000), 'venda paga o imposto dinâmico do Banco Central');

  // ---------- Travas do mercado ----------
  for (let k = 0; k < 3; k++) { const [{ mv_market_list:x }] = await as('ana', `SELECT public.mv_market_list('mat', 'm:epic', 'Oricalco ×1', '', '', '{"id":"epic","qty":1}'::jsonb, 5000, 'Ana')`); await one('caio', 'mv_market_buy($1)', [x]); }
  await fails(as('ana', `SELECT public.mv_market_list('mat', 'm:epic', 'Oricalco ×1', '', '', '{"id":"epic","qty":1}'::jsonb, 90000, 'Ana')`), 'preço acima de 15× a mediana é recusado');
  for (let k = 0; k < 2; k++) { const [{ mv_market_list:x }] = await as('ana', `SELECT public.mv_market_list('mat', 'm:epic', 'Oricalco ×1', '', '', '{"id":"epic","qty":1}'::jsonb, 5000, 'Ana')`); await one('caio', 'mv_market_buy($1)', [x]); }
  const [{ mv_market_list:x7 }] = await as('ana', `SELECT public.mv_market_list('mat', 'm:epic', 'Oricalco ×1', '', '', '{"id":"epic","qty":1}'::jsonb, 5000, 'Ana')`);
  await fails(one('caio', 'mv_market_buy($1)', [x7]), 'no máximo 5 compras por dia do mesmo vendedor (anti-lavagem)');
  const [{ mv_market_list:old }] = await as('ana', `SELECT public.mv_market_list('card', 'c:card_fox', 'Carta Raposa', '', '', '{"id":"card_fox"}'::jsonb, 900, 'Ana')`);
  await db.exec(`UPDATE public.mv_listings SET created_at = now() - interval '8 days' WHERE id = ${old}`);
  const expired = await one('bia', 'mv_market_expire()');
  ok(expired >= 1 && (await as('ana', `SELECT * FROM public.mv_mail WHERE reason LIKE 'Anúncio expirou%'`)).length === 1, 'anúncio de 7 dias volta ao correio');
  const hist = await one('dan', 'mv_price_history($1)', ['m:epic']); ok(hist.length === 1 && Number(hist[0].median) === 5000 && Number(hist[0].n) === 5, 'histórico diário de preços');

  // ---------- Ordens de compra ----------
  const oid = await one('dan', 'mv_order_place($1, $2, $3, $4::jsonb, $5, $6, $7)', ['mat', 'm:legendary', 'Adamantina', '{"id":"legendary"}', 3, 40000, 'Dan']);
  const view = await as('bia', 'SELECT * FROM public.mv_orders_open');
  ok(view.length === 1 && view[0].qty_left === 3 && !('buyer' in view[0]) && view[0].mine === false, 'ordem pública sem id do comprador');
  await fails(one('dan', 'mv_order_fill($1, $2)', [oid, 1]), 'ninguém atende a própria ordem');
  await fails(one('bia', 'mv_order_fill($1, $2)', [oid, 4]), 'não vende mais do que a ordem pede');
  const fill = await one('bia', 'mv_order_fill($1, $2)', [oid, 2]);
  ok(fill.qty === 2 && Number(fill.gold) === 80000 - Number(fill.tax), 'vendedor recebe o total menos imposto');
  const danMail = await as('dan', `SELECT * FROM public.mv_mail WHERE kind = 'mat'`);
  ok(danMail.length === 1 && danMail[0].payload.qty === 2 && danMail[0].payload.id === 'legendary', 'comprador recebe a mercadoria pelo correio');
  const refund = await one('dan', 'mv_order_cancel($1)', [oid]); ok(Number(refund.refund) === 40000, 'cancelar devolve só o ouro do que falta');
  await fails(one('dan', 'mv_order_cancel($1)', [oid]), 'ordem não é cancelada duas vezes');
  await fails(one('dan', 'mv_order_place($1, $2, $3, $4::jsonb, $5, $6, $7)', ['mat', 'k', 'x', '{}', 1, 10, 'Dan']), 'preço mínimo por unidade na ordem');
  const ph = await one('dan', 'mv_price_history($1)', ['m:legendary']); ok(ph.length === 1 && Number(ph[0].median) === 40000, 'venda para ordem entra no histórico por unidade');

  await db.exec(sql('neon_setup.sql') + sql('neon_social.sql') + sql('neon_economy.sql')); checks++; // idempotente
  await db.close();
  console.log(JSON.stringify({ ok:true, checks }));
})().catch(err => { console.error(err); process.exit(1); });
