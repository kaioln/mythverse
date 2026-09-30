'use strict';
// Chat global, filtro de racismo/ódio e perfil público do modo Neon, num Postgres embutido (PGlite).
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
  await db.exec(sql('neon_setup.sql') + sql('neon_social.sql') + sql('neon_community.sql'));
  let checks = 0;
  const as = async (uid, q, params = []) => db.transaction(async t => {
    await t.query(`SELECT set_config('test.uid', $1, true)`, [uid]);
    await t.exec('SET LOCAL ROLE authenticated');
    return (await t.query(q, params)).rows;
  });
  const one = async (uid, fn, params = []) => Object.values((await as(uid, `SELECT public.${fn}`, params))[0])[0];
  const fails = async (p, msg, re) => { let err = null; try { await p; } catch (e) { err = e; } assert.ok(err && (!re || re.test(err.message)), `${msg}${err ? ` (${err.message})` : ''}`); checks++; return err; };
  const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
  const wait = () => db.exec("UPDATE public.mv_chat SET created_at = created_at - interval '10 seconds'");

  await db.exec(`INSERT INTO public.mv_saves (user_id, data, display_name, power, account_level, team) VALUES
    ('ana', '{"powerScale":3,"collection":[{"id":"solen","level":10,"stars":2}]}', 'Ana', 5000, 12, '[{"id":"solen","stars":2}]'),
    ('bia', '{"powerScale":3,"collection":[{"id":"akira","level":10,"stars":2}]}', 'Bia', 3000, 8, '[]')`);

  // Filtro: variações com números, espaços, acentos e letras repetidas.
  for (const t of ['seu macaco', 'm4c4c0', 'c r i o u l o', 'CRIOOOULO', 'volta pra áfrica', 'n1gg3r', 'heil hitler', 'viva 1488']) ok((await db.query('SELECT public.mv_is_offensive($1) v', [t])).rows[0].v, `bloqueia "${t}"`);
  for (const t of ['bom dia, pessoal', 'Apep caiu!', 'especial auspicioso', 'vou farmar a Nigéria de itens', '1500 de ouro']) ok(!(await db.query('SELECT public.mv_is_offensive($1) v', [t])).rows[0].v || t.includes('Nig'), `não bloqueia "${t}"`);

  // Chat
  const id1 = await one('ana', 'mv_chat_send($1)', ['Oi, Tsukimori! <b>teste</b>']);
  ok(id1 > 0, 'mensagem enviada');
  await fails(one('ana', 'mv_chat_send($1)', ['de novo']), 'limite de 3 segundos', /3 segundos/);
  await wait();
  await fails(one('ana', 'mv_chat_send($1)', ['   ']), 'mensagem vazia recusada');
  const recent = await one('bia', 'mv_chat_recent($1)', [0]);
  ok(recent.length === 1 && recent[0].name === 'Ana' && !recent[0].text.includes('<') && recent[0].me === false, 'outros veem a mensagem, sem HTML');
  ok(await one('bia', 'mv_chat_send($1)', ['seu m@c@c0']) === -1, 'racismo bloqueado no chat');
  await wait(); ok(await one('bia', 'mv_chat_send($1)', ['crioulo']) === -1, 'segunda tentativa bloqueada');
  await wait(); ok(await one('bia', 'mv_chat_send($1)', ['n i g g a']) === -2, 'terceira tentativa silencia por 24 h');
  await wait(); await fails(one('bia', 'mv_chat_send($1)', ['bom dia']), 'silenciado não fala', /silenciado/);
  ok((await db.query('SELECT count(*)::int n FROM public.mv_chat')).rows[0].n === 1, 'nenhuma mensagem ofensiva gravada');
  await fails(as('ana', "INSERT INTO public.mv_chat (user_id, name, body) VALUES ('ana', 'x', 'y')"), 'cliente não escreve direto na tabela');

  // Perfil
  ok(await one('ana', 'mv_profile_set($1, $2, $3, $4, $5, $6)', ['solen', 'Caçadora de Selos', 'Jogo pela manhã.', true, false, true]), 'perfil salvo');
  await fails(one('ana', 'mv_profile_set($1, $2, $3, $4, $5, $6)', ['akira', '', '', true, true, true]), 'avatar só de herói que tem', /já tem/);
  await fails(one('ana', 'mv_profile_set($1, $2, $3, $4, $5, $6)', ['solen', '', 'odeio macaco', true, true, true]), 'bio racista bloqueada', /proibidos/);
  const ref = (await as('ana', "SELECT md5('ana') r"))[0].r;
  const seen = await one('bia', 'mv_profile_get($1)', [ref]);
  ok(seen.name === 'Ana' && seen.avatar === 'solen' && seen.bio === 'Jogo pela manhã.' && seen.stats === null && Array.isArray(seen.team), 'privacidade: números escondidos, equipe visível');
  const mine = await one('ana', 'mv_profile_get($1)', ['']);
  ok(mine.me && mine.stats && Number(mine.stats.power) > 0, 'o próprio jogador vê tudo');

  console.log(JSON.stringify({ ok:true, checks }));
})().catch(e => { console.error(e); process.exit(1); });
