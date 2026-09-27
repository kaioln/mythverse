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
  await db.exec(sql('neon_setup.sql') + sql('neon_social.sql') + sql('neon_economy.sql'));
  // Save gravado antes da escala compacta (força bruta), como o do ranking real.
  await db.exec(`ALTER TABLE public.mv_saves DISABLE TRIGGER mv_saves_guard;
    INSERT INTO public.mv_saves (user_id, data, display_name, power) VALUES ('velho', '{"player":{"gold":1}}', 'Alemao', 684800);
    ALTER TABLE public.mv_saves ENABLE TRIGGER mv_saves_guard;
    INSERT INTO public.mv_pvp (user_id, display_name, power) VALUES ('velho', 'Alemao', 684800);`);
  await db.exec(sql('neon_admin.sql'));
  // Rodar tudo de novo não pode quebrar nada nem converter duas vezes.
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
  // Save real do jogo com força bruta antiga no ranking: o setup recalcula com o motor (exato).
  const { recomputeAll, powerOf } = require('../tools/neon_recompute');
  const fs2 = require('fs'), vm2 = require('vm'), G = { console, Math, Date, JSON }; G.globalThis = G; vm2.createContext(G);
  for (const f of ['src/data.js', 'src/utils.js', 'src/items.js', 'src/progression.js', 'src/roster.js', 'src/builds.js', 'src/engine.js']) vm2.runInContext(fs2.readFileSync(path.join(__dirname, '..', f), 'utf8'), G);
  const st = G.KT.State.createState(), en = new G.KT.CombatEngine(st, {}); for (let i = 0; i < 10; i++) en.openBox(true); [0, 1, 2, 3].forEach(i => en.setParty(i, st.collection[i].uid)); st.collection.forEach(h => { h.level = 40; });
  await db.exec('ALTER TABLE public.mv_saves DISABLE TRIGGER mv_saves_guard');
  await db.query(`UPDATE public.mv_saves SET data = $1::jsonb, power = 684800 WHERE user_id = 'velho'`, [JSON.stringify(st)]);
  await db.exec('ALTER TABLE public.mv_saves ENABLE TRIGGER mv_saves_guard');
  const expected = powerOf(st), changed = await recomputeAll(db);
  const [old] = (await db.query(`SELECT power FROM public.mv_saves WHERE user_id = 'velho'`)).rows, [pv] = (await db.query(`SELECT power FROM public.mv_pvp WHERE user_id = 'velho'`)).rows;
  ok(changed.some(x => x.user === 'velho') && Number(old.power) === expected && Number(pv.power) === expected && expected < 684800, `setup recalcula o poder com o motor do jogo (${expected})`);
  ok(!(await recomputeAll(db)).length, 'recalcular de novo não muda nada (idempotente)');
  await as('velho', `UPDATE public.mv_saves SET data = $1::jsonb, power = 700000, revision = revision + 1`, [data()]);
  ok(Number((await db.query(`SELECT power FROM public.mv_saves WHERE user_id = 'velho'`)).rows[0].power) === Math.round(Math.pow(700000, .77)), 'jogo antigo em cache (força bruta): o banco converte ao salvar');
  await as('velho', `UPDATE public.mv_saves SET data = $1::jsonb, power = 4567, revision = revision + 1`, [data({ powerScale:2 })]);
  ok(Number((await db.query(`SELECT power FROM public.mv_saves WHERE user_id = 'velho'`)).rows[0].power) === Math.round(Math.pow(4567, .77 / .7)), 'jogo da escala anterior (0,7): o banco converte para a atual');
  await as('velho', `UPDATE public.mv_saves SET data = $1::jsonb, power = 12000, revision = revision + 1`, [data({ powerScale:3 })]);
  ok(Number((await db.query(`SELECT power FROM public.mv_saves WHERE user_id = 'velho'`)).rows[0].power) === 12000, 'jogo atual: poder mantido');
  await as('velho', `SELECT public.mv_pvp_defense('Alemao', 999999999, '[{"id":"solen","level":30}]'::jsonb)`);
  ok(Number((await db.query(`SELECT power FROM public.mv_pvp WHERE user_id = 'velho'`)).rows[0].power) === 12000, 'Arena usa o poder do save, não o número enviado');
  console.log(JSON.stringify({ ok:true, checks }));
})().catch(e => { console.error(e); process.exit(1); });
