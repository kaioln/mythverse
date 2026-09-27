'use strict';
// Relógio do servidor, guarda do save, auditoria, presentes e fechamento das tabelas legadas (PGlite).
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  await db.exec(`CREATE SCHEMA auth;
    CREATE FUNCTION auth.user_id() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '') $$;
    CREATE ROLE authenticated; CREATE ROLE anonymous;
    -- Tabela do servidor Node aberta para a API, como estava no Neon real.
    CREATE TABLE public.users (id serial PRIMARY KEY, username text, pass_hash text);
    INSERT INTO public.users (username, pass_hash) VALUES ('x', 'hash');
    GRANT ALL ON public.users TO authenticated;`);
  const sql = f => fs.readFileSync(path.join(__dirname, '..', 'tools', f), 'utf8');
  await db.exec(sql('neon_setup.sql') + sql('neon_social.sql') + sql('neon_economy.sql') + sql('neon_admin.sql'));
  let checks = 0;
  const as = async (uid, q, params = []) => db.transaction(async t => {
    await t.query(`SELECT set_config('test.uid', $1, true)`, [uid]);
    await t.exec('SET LOCAL ROLE authenticated');
    return (await t.query(q, params)).rows;
  });
  const fails = async (p, msg) => { let err = null; try { await p; } catch (e) { err = e; } assert.ok(err, msg); checks++; return err; };
  const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
  const data = o => JSON.stringify({ lastSeen:Date.now(), player:{ name:'Mits', gold:1000, keys:5, crystal:10 }, collection:[{ id:'solen', level:10, stars:2 }], ...o });

  const [{ mv_now:t }] = await as('ana', 'SELECT public.mv_now()');
  ok(Math.abs(Number(t) - Date.now()) < 60000, 'relógio do servidor disponível para a conta');

  await as('ana', `INSERT INTO public.mv_saves (data, display_name) VALUES ($1::jsonb, 'Mits')`, [data()]);
  await fails(as('ana', `UPDATE public.mv_saves SET data = $1::jsonb, revision = revision + 1`, [data({ lastSeen:Date.now() + 3 * 3600000 })]), 'relógio adiantado é recusado');
  await fails(as('ana', `UPDATE public.mv_saves SET data = $1::jsonb, revision = revision + 1`, [data({ collection:[{ id:'solen', level:140, stars:2 }] })]), 'herói acima do nível 100 é recusado');
  await fails(as('ana', `UPDATE public.mv_saves SET data = $1::jsonb, revision = revision + 1`, [data({ player:{ gold:-5, keys:0, crystal:0 } })]), 'recurso negativo é recusado');
  await as('ana', `UPDATE public.mv_saves SET data = $1::jsonb, revision = revision + 1`, [data({ player:{ name:'Mits', gold:1000, keys:900, crystal:10 } })]);
  const audit = (await db.query(`SELECT * FROM public.mv_audit WHERE user_id = 'ana'`)).rows;
  ok(audit.length === 1 && audit[0].kind === 'keys', 'salto de chaves fica registrado na auditoria');
  await fails(as('ana', 'SELECT * FROM public.mv_audit'), 'auditoria não é visível pela API');

  const [{ mv_gift:who }] = (await db.query(`SELECT public.mv_gift('mits', 'keys', '{"n":1000}'::jsonb, 'Presente')`)).rows;
  await db.query(`SELECT public.mv_gift('Mits', 'hero', '{"id":"vegeta_ego","rarity":"legendary"}'::jsonb, 'Presente')`);
  ok(who === 'ana', 'presente encontra a conta pelo nome do ranking');
  const mail = await as('ana', `SELECT id, kind, payload FROM public.mv_mail ORDER BY id`);
  ok(mail.length === 2 && mail[0].kind === 'keys' && mail[1].payload.id === 'vegeta_ego', 'presentes chegam ao correio da conta');
  const [{ mv_mail_claim:c }] = await as('ana', 'SELECT public.mv_mail_claim($1)', [mail[0].id]);
  ok(c.kind === 'keys' && c.payload.n === 1000, 'resgate do presente de chaves');
  await fails(as('bia', `SELECT public.mv_gift('bia', 'keys', '{"n":99}'::jsonb, 'x')`), 'jogador não consegue se dar presentes');
  await fails(as('bia', 'SELECT * FROM public.users'), 'tabela legada com senha fechada para a API');
  await fails(as('bia', `DELETE FROM public.users`), 'tabela legada não pode ser apagada pela API');
  console.log(JSON.stringify({ ok:true, checks }));
})().catch(e => { console.error(e); process.exit(1); });
