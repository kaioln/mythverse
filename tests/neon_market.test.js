'use strict';
// Mercado de Jogadores do modo Neon: roda tools/neon_setup.sql num Postgres embutido (PGlite)
// com um auth.user_id() de teste e confere as regras que o banco garante sozinho.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  await db.exec(`CREATE SCHEMA auth;
    CREATE FUNCTION auth.user_id() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '') $$;
    CREATE ROLE authenticated; CREATE ROLE anonymous;`);
  await db.exec(fs.readFileSync(path.join(__dirname, '..', 'tools', 'neon_setup.sql'), 'utf8'));
  let checks = 0;
  const as = async (uid, sql, params = []) => db.transaction(async t => {
    await t.query(`SELECT set_config('test.uid', $1, true)`, [uid]);
    await t.exec('SET LOCAL ROLE authenticated');
    return (await t.query(sql, params)).rows;
  });
  const fails = async (p, msg) => { let ok = false; try { await p; } catch (_) { ok = true; } assert.ok(ok, msg); checks++; };
  const eq = (a, b, msg) => { assert.deepStrictEqual(a, b, msg); checks++; };

  const item = { uid:'item_1', name:'Katana Lunar', rarity:'epic', slot:'weapon' };
  const [{ mv_market_list:id }] = await as('ana', `SELECT public.mv_market_list('item', 'b:katana:epic', 'Katana Lunar', 'epic', 'weapon', $1::jsonb, 5000, 'Ana')`, [JSON.stringify(item)]);
  const view = await as('bia', 'SELECT * FROM public.mv_market');
  eq(view.length, 1, 'anúncio aparece na vitrine');
  eq(view[0].mine, false, 'vitrine sabe que o anúncio não é do comprador');
  eq('seller' in view[0], false, 'vitrine não expõe o id da conta do vendedor');
  await fails(as('bia', 'SELECT * FROM public.mv_listings'), 'tabela de anúncios não é lida direto pela API');
  await fails(as('bia', `INSERT INTO public.mv_mail (user_id, kind, payload) VALUES ('bia', 'gold', '{"amount":999999}')`), 'ninguém cria correio (ouro) sozinho');
  await fails(as('ana', 'SELECT public.mv_market_buy($1)', [id]), 'vendedor não compra o próprio anúncio');
  await fails(as('ana', `SELECT public.mv_market_list('item', 'k', 'x', '', '', '{}'::jsonb, 50, 'Ana')`), 'preço mínimo de 100 de ouro');

  const [{ mv_market_buy:bought }] = await as('bia', 'SELECT public.mv_market_buy($1)', [id]);
  eq(Number(bought.price), 5000, 'compra devolve o preço');
  await fails(as('caio', 'SELECT public.mv_market_buy($1)', [id]), 'o mesmo anúncio não é vendido duas vezes');
  eq((await as('caio', 'SELECT * FROM public.mv_market')).length, 0, 'anúncio vendido sai da vitrine');

  const biaMail = await as('bia', 'SELECT * FROM public.mv_mail');
  eq(biaMail.length === 1 && biaMail[0].kind === 'item' && biaMail[0].payload.uid === 'item_1', true, 'item comprado chega ao correio do comprador');
  const anaMail = await as('ana', 'SELECT * FROM public.mv_mail');
  eq(Number(anaMail[0].payload.amount), 4750, 'vendedor recebe o preço menos 5% de imposto');
  eq((await as('bia', 'SELECT * FROM public.mv_mail')).every(m => m.user_id === 'bia'), true, 'cada um só vê o próprio correio');

  const [{ mv_mail_claim:claimed }] = await as('ana', 'SELECT public.mv_mail_claim($1)', [anaMail[0].id]);
  eq(claimed.kind, 'gold', 'resgate devolve o conteúdo');
  await fails(as('ana', 'SELECT public.mv_mail_claim($1)', [anaMail[0].id]), 'o mesmo correio não é resgatado duas vezes');
  await fails(as('bia', 'SELECT public.mv_mail_claim($1)', [biaMail[0].id + 999]), 'não resgata correio inexistente');

  const [{ mv_market_list:id2 }] = await as('ana', `SELECT public.mv_market_list('card', 'c:card_fox', 'Carta Raposa', '', '', '{"id":"card_fox"}'::jsonb, 900, 'Ana')`);
  await fails(as('bia', 'SELECT public.mv_market_cancel($1)', [id2]), 'só o vendedor cancela');
  await as('ana', 'SELECT public.mv_market_cancel($1)', [id2]);
  eq((await as('ana', 'SELECT kind FROM public.mv_mail')).map(r => r.kind), ['card'], 'cancelar devolve a carta pelo correio');
  eq((await as('ana', 'SELECT * FROM public.mv_sales')).map(r => Number(r.price)), [5000], 'histórico de preços registra só vendas');

  for (let i = 0; i < 20; i++) await as('dan', `SELECT public.mv_market_list('mat', 'm:star', 'Aço', '', '', '{"id":"rare","qty":1}'::jsonb, 100, 'Dan')`);
  await fails(as('dan', `SELECT public.mv_market_list('mat', 'm:star', 'Aço', '', '', '{"id":"rare","qty":1}'::jsonb, 100, 'Dan')`), 'limite de 20 anúncios abertos');
  await fails(as('', `SELECT public.mv_market_list('mat', 'k', 'x', '', '', '{}'::jsonb, 100, 'x')`), 'sem conta não anuncia');

  // O setup pode rodar de novo sem erro (idempotente).
  await db.exec(fs.readFileSync(path.join(__dirname, '..', 'tools', 'neon_setup.sql'), 'utf8')); checks++;
  await db.close();
  console.log(JSON.stringify({ ok:true, checks }));
})().catch(err => { console.error(err); process.exit(1); });
