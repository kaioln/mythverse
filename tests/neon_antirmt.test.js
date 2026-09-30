'use strict';
// Anti-RMT do modo Neon (tools/neon_antirmt.sql) num Postgres embutido (PGlite).
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  await db.exec(`CREATE SCHEMA auth;
    CREATE FUNCTION auth.user_id() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '') $$;
    CREATE ROLE authenticated; CREATE ROLE anonymous;`);
  for (const f of ['neon_setup.sql', 'neon_social.sql', 'neon_economy.sql', 'neon_admin.sql', 'neon_community.sql', 'neon_antirmt.sql']) await db.exec(fs.readFileSync(path.join(__dirname, '..', 'tools', f), 'utf8'));
  let checks = 0;
  const as = async (uid, sql, params = []) => db.transaction(async t => {
    await t.query(`SELECT set_config('test.uid', $1, true)`, [uid]);
    await t.exec('SET LOCAL ROLE authenticated');
    return (await t.query(sql, params)).rows;
  });
  const fails = async (p, msg, re) => { let err = null; try { await p; } catch (e) { err = e; } assert.ok(err && (!re || re.test(err.message)), `${msg}${err ? ` (${err.message})` : ' (não falhou)'}`); checks++; };
  const ok = (c, m) => { assert.ok(c, m); checks++; };
  const list = (uid, key, rarity, payload, price) => as(uid, `SELECT public.mv_market_list('item', $1, 'Peça', $2, 'weapon', $3::jsonb, $4, 'X') id`, [key, rarity, JSON.stringify(payload), price]).then(r => r[0].id);
  const buy = (uid, id) => as(uid, 'SELECT public.mv_market_buy($1) r', [id]);

  // Contas: veteranas (nível 20, antigas), uma nova e uma de nível baixo.
  await db.exec(`INSERT INTO public.mv_saves (user_id, data, account_level) VALUES ('ana', '{"powerScale":3}', 20), ('bia', '{"powerScale":3}', 20), ('caio', '{"powerScale":3}', 20), ('novo', '{"powerScale":3}', 20), ('baixo', '{"powerScale":3}', 5);
    UPDATE public.mv_saves SET created_at = now() - interval '10 days', revision = revision + 1 WHERE user_id <> 'novo';`);

  await fails(list('baixo', 'b:x:rare', 'rare', { uid:'i0', rarity:'rare' }, 1000), 'nível baixo não anuncia', /nível 12/);
  await fails(list('novo', 'b:x:rare', 'rare', { uid:'i1', rarity:'rare' }, 1000), 'conta nova não anuncia', /48 horas/);
  await fails(list('ana', 'b:lixo:common', 'common', { uid:'i2', rarity:'common' }, 5000000), 'lixo caríssimo sem histórico recusado', /teto/);
  const id1 = await list('ana', 'b:lixo:common', 'common', { uid:'i3', rarity:'common' }, 5000);
  ok(id1 > 0, 'preço normal aceito');
  await fails(buy('novo', id1), 'conta nova não compra', /48 horas/);

  // Histórico: 3 vendas a ~10 mil → faixa 2.500–50.000.
  for (const [i, p] of [[10, 9000], [11, 10000], [12, 11000]]) { const id = await list('ana', 'b:espada:rare', 'rare', { uid:`h${i}`, rarity:'rare' }, p); await buy(i === 12 ? 'caio' : 'bia', id); }
  await fails(list('ana', 'b:espada:rare', 'rare', { uid:'h20', rarity:'rare' }, 60000), 'acima de 5× a mediana recusado', /5×/);
  await fails(list('ana', 'b:espada:rare', 'rare', { uid:'h21', rarity:'rare' }, 1000), 'abaixo de 1/4 da mediana recusado', /1\/4/);

  // Pares: a 3ª compra da mesma dupla na semana já passou (bia comprou 2 da ana); a próxima para.
  const idp = await list('ana', 'b:espada:rare', 'rare', { uid:'h30', rarity:'rare' }, 10000); await buy('bia', idp);
  const idq = await list('ana', 'b:espada:rare', 'rare', { uid:'h31', rarity:'rare' }, 10000);
  await fails(buy('bia', idq), 'limite de 3 compras por semana do mesmo vendedor', /3 compras/);

  // Revenda imediata do item comprado (mula).
  await fails(list('bia', 'b:espada:rare', 'rare', { uid:'h30', rarity:'rare' }, 10000), 'item comprado só volta em 72 h', /72 horas/);

  // Ordem de compra fora da faixa (ouro entregue por ordem absurda).
  await fails(as('caio', `SELECT public.mv_order_place('mat', 'm:star', 'Aço Estelar', '{"qty":1}'::jsonb, 1, 50000000, 'Caio')`), 'ordem de compra acima do teto recusada', /teto/);

  // Venda grande: ouro retido 12 h no correio.
  await db.exec(`ALTER TABLE public.mv_listings DISABLE TRIGGER mv_listings_antirmt;
    INSERT INTO public.mv_listings (seller, seller_name, kind, item_key, name, rarity, payload, price, status, buyer, closed_at)
    SELECT 'x', 'x', 'item', 'b:lenda:legendary', 'L', 'legendary', '{}'::jsonb, 5000000, 'sold', 'y', now() FROM generate_series(1, 3);
    ALTER TABLE public.mv_listings ENABLE TRIGGER mv_listings_antirmt;`);
  const big = await list('ana', 'b:lenda:legendary', 'legendary', { uid:'L1', rarity:'legendary' }, 5000000); await buy('caio', big);
  const mail = (await db.query(`SELECT id, available_at > now() held FROM public.mv_mail WHERE user_id = 'ana' AND kind = 'gold' ORDER BY id DESC LIMIT 1`)).rows[0];
  ok(mail.held, 'venda grande fica retida');
  await fails(as('ana', 'SELECT public.mv_mail_claim($1)', [mail.id]), 'ouro retido não é resgatado antes da hora', /disponível/);
  await db.exec(`UPDATE public.mv_mail SET available_at = now() - interval '1 minute' WHERE id = ${mail.id}`);
  ok((await as('ana', 'SELECT public.mv_mail_claim($1) r', [mail.id]))[0].r.kind === 'gold', 'depois das 12 h o ouro sai');
  console.log(JSON.stringify({ ok:true, checks }));
})().catch(e => { console.error(e); process.exit(1); });
