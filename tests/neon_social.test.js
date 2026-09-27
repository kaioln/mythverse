'use strict';
// Guildas, Arena PvP, Loja de Honra e Guerra de Guildas do modo Neon, num Postgres embutido (PGlite).
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  await db.exec(`CREATE SCHEMA auth;
    CREATE FUNCTION auth.user_id() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '') $$;
    CREATE ROLE authenticated; CREATE ROLE anonymous;`);
  const setup = () => db.exec(fs.readFileSync(path.join(__dirname, '..', 'tools', 'neon_setup.sql'), 'utf8') + fs.readFileSync(path.join(__dirname, '..', 'tools', 'neon_social.sql'), 'utf8'));
  await setup();
  // Janela da guerra controlada pelo teste.
  const warWindow = open => db.exec(`CREATE OR REPLACE FUNCTION public.mv_gvg_current() RETURNS text LANGUAGE sql STABLE AS $$ SELECT ${open ? "'GTEST'" : 'NULL::text'} $$`);
  let checks = 0;
  const as = async (uid, sql, params = []) => db.transaction(async t => {
    await t.query(`SELECT set_config('test.uid', $1, true)`, [uid]);
    await t.exec('SET LOCAL ROLE authenticated');
    return (await t.query(sql, params)).rows;
  });
  const one = async (uid, fn, params = []) => Object.values((await as(uid, `SELECT public.${fn}`, params))[0])[0];
  const fails = async (p, msg) => { let err = null; try { await p; } catch (e) { err = e; } assert.ok(err, msg); checks++; return err; };
  const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
  const age = sec => db.exec(`UPDATE public.mv_pvp_matches SET created_at = now() - interval '${sec} seconds' WHERE status = 'open'`);
  const team = (name, atk) => JSON.stringify([{ id:'solen', level:30, stars:3, st:{ atk }, maxHp:5000 }]);

  // ---------- Arena ----------
  for (const [u, n, atk] of [['ana', 'Ana', 900], ['bia', 'Bia', 800], ['caio', 'Caio', 700], ['dan', 'Dan', 600]]) await one(u, 'mv_pvp_defense($1, $2, $3::jsonb)', [n, atk * 10, team(n, atk)]);
  await fails(as('ana', 'SELECT * FROM public.mv_pvp'), 'tabela da arena não é lida direto');
  await fails(as('ana', `UPDATE public.mv_pvp SET honor = 99999`), 'ninguém edita honra direto');
  const foes = await one('ana', 'mv_pvp_find()');
  ok(foes.length === 3 && foes.every(f => f.name !== 'Ana' && f.ref && !('user_id' in f)), 'matchmaking traz 3 oponentes, nunca você, sem expor a conta');
  const bia = foes.find(f => f.name === 'Bia');
  const m1 = await one('ana', 'mv_pvp_start($1)', [bia.ref]);
  ok(m1.seed > 0 && m1.defense[0].id === 'solen', 'início da luta traz semente e defesa do oponente');
  const early = await one('ana', 'mv_pvp_finish($1, true, $2::jsonb, 40)', [m1.match, '[]']);
  ok(early.won === false && early.delta < 0 && early.note, 'luta "vencida" rápido demais conta como derrota');
  await db.exec("UPDATE public.mv_pvp SET mmr = 1000, streak = 0, wins = 0, losses = 0, honor = 0 WHERE display_name IN ('Ana','Bia')");
  const m2 = await one('ana', 'mv_pvp_start($1)', [bia.ref]); await age(60);
  ok((await one('ana', 'mv_pvp_finish($1, true, $2::jsonb, 20000)', [m2.match, '[]'])).won === false, 'duração acima de 3x o tempo real conta como derrota');
  await db.exec("UPDATE public.mv_pvp SET mmr = 1000, streak = 0, honor = 0 WHERE display_name IN ('Ana','Bia')");
  await one('ana', 'mv_pvp_start($1)', [bia.ref]); await one('ana', 'mv_pvp_start($1)', [bia.ref]);
  ok((await one('ana', 'mv_pvp_status()')).mmr < 1000, 'abandonar a luta (começar outra) conta como derrota');
  await db.exec("UPDATE public.mv_pvp SET mmr = 1000, streak = 0, honor = 0, attacks = 0 WHERE display_name IN ('Ana','Bia'); UPDATE public.mv_pvp_matches SET status = 'void' WHERE status = 'open'");
  const m3 = await one('ana', 'mv_pvp_start($1)', [bia.ref]); await age(60);
  const r3 = await one('ana', 'mv_pvp_finish($1, true, $2::jsonb, 900)', [m3.match, JSON.stringify([{ t:10, k:'ult', a:0 }])]);
  ok(r3.delta === 16 && r3.honor === 20 && r3.mmr === 1016, 'vitória entre iguais dá +16 MMR e 20 de honra');
  await fails(one('ana', 'mv_pvp_finish($1, true, $2::jsonb, 900)', [m3.match, '[]']), 'a mesma luta não paga duas vezes');
  const sBia = await one('bia', 'mv_pvp_status()');
  ok(sBia.mmr === 990 && sBia.honor === 0, 'defensor derrotado perde 60% do MMR ganho pelo atacante');
  const m4 = await one('ana', 'mv_pvp_start($1)', [bia.ref]); await age(60);
  const r4 = await one('ana', 'mv_pvp_finish($1, false, $2::jsonb, 900)', [m4.match, '[]']);
  ok(r4.delta < 0 && r4.honor === 4, 'derrota tira MMR e dá só 4 de honra');
  ok((await one('bia', 'mv_pvp_status()')).honor === 6, 'defesa bem-sucedida rende honra');
  for (let k = 0; k < 8; k++) { await one('ana', 'mv_pvp_start($1)', [bia.ref]); }
  const st = await one('ana', 'mv_pvp_status()'); ok(st.attacks === 10, 'cada luta gasta um ingresso');
  await fails(one('ana', 'mv_pvp_start($1)', [bia.ref]), 'limite de 10 lutas por dia');
  await db.exec(`UPDATE public.mv_pvp SET day = '2000-01-01' WHERE display_name = 'Ana'`);
  ok((await one('ana', 'mv_pvp_status()')).attacks === 0, 'ingressos renovam no dia seguinte');
  await fails(one('ana', 'mv_pvp_start($1)', ['nao-existe']), 'oponente inválido é recusado');
  await fails(one('ana', 'mv_pvp_defense($1, $2, $3::jsonb)', ['Ana', 1, '[]']), 'defesa vazia é recusada');

  // Semana e loja
  await fails(one('dan', 'mv_pvp_claim_week()'), 'recompensa semanal exige 5 lutas');
  for (let k = 0; k < 3; k++) { const m = await one('ana', 'mv_pvp_start($1)', [bia.ref]); await age(60); await one('ana', 'mv_pvp_finish($1, true, $2::jsonb, 900)', [m.match, '[]']); }
  const wk = await one('ana', 'mv_pvp_claim_week()'); ok(wk.honor >= 70, 'recompensa semanal pela liga');
  await fails(one('ana', 'mv_pvp_claim_week()'), 'recompensa semanal só uma vez');
  const honor0 = (await one('ana', 'mv_pvp_status()')).honor;
  const buy = await one('ana', 'mv_pvp_buy($1)', ['star']); ok(buy.honor === honor0 - 60, 'loja desconta a honra no banco');
  await fails(one('ana', 'mv_pvp_buy($1)', ['ori']), 'honra insuficiente é recusada');
  await db.exec(`UPDATE public.mv_pvp SET honor = 5000 WHERE display_name = 'Ana'`);
  await one('ana', 'mv_pvp_buy($1)', ['ori']); await fails(one('ana', 'mv_pvp_buy($1)', ['ori']), 'limite semanal da loja');
  await fails(one('ana', 'mv_pvp_buy($1)', ['diamante_infinito']), 'item inexistente é recusado');
  const hist = await one('ana', 'mv_pvp_history()'); ok(hist.length >= 5 && hist.every(h => typeof h.won === 'boolean'), 'histórico de lutas');
  const rank = await as('caio', 'SELECT * FROM public.mv_pvp_ranking ORDER BY mmr DESC');
  ok(rank.length === 4 && rank.every((r, i) => !('user_id' in r) && (i === 0 || rank[i - 1].mmr >= r.mmr)) && rank.some(r => r.display_name === 'Ana'), 'ranking PvP público sem id de conta');

  // ---------- Guildas ----------
  const gid = await one('ana', 'mv_guild_create($1, $2, $3, $4, $5, $6, $7)', ['Lanternas Rubras', 'lr', '🏮', 'Juntos até o fim', true, 'Ana', 9000]);
  ok(gid > 0, 'fundar guilda');
  await fails(one('ana', 'mv_guild_create($1, $2, $3, $4, $5, $6, $7)', ['Outra', 'OT', '', '', true, 'Ana', 1]), 'quem já está numa guilda não funda outra');
  await fails(one('bia', 'mv_guild_create($1, $2, $3, $4, $5, $6, $7)', ['Lanternas Rubras', 'XX', '', '', true, 'Bia', 1]), 'nome repetido é recusado');
  ok(await one('bia', 'mv_guild_join($1, $2, $3)', [gid, 'Bia', 8000]) === 'joined', 'entrar em guilda aberta');
  await one('ana', 'mv_guild_settings($1, $2, $3)', ['Só convidados', false, '🔥']);
  ok(await one('caio', 'mv_guild_join($1, $2, $3)', [gid, 'Caio', 7000]) === 'requested', 'guilda fechada recebe pedido');
  await fails(one('bia', 'mv_guild_manage($1, $2)', ['accept', 'x']), 'membro comum não aceita pedidos');
  const mine = await one('ana', 'mv_guild_mine()');
  ok(mine.guild.tag === 'LR' && mine.members.length === 2 && mine.requests.length === 1 && mine.me.role === 'leader', 'painel da guilda com membros e pedidos');
  ok(await one('ana', 'mv_guild_manage($1, $2)', ['accept', mine.requests[0].ref]) === 'accepted', 'líder aceita pedido');
  const members = (await one('ana', 'mv_guild_mine()')).members, refOf = n => members.find(x => x.name === n).ref;
  ok(await one('ana', 'mv_guild_manage($1, $2)', ['promote', refOf('Bia')]) === 'promoted', 'líder promove oficial');
  await fails(one('bia', 'mv_guild_manage($1, $2)', ['kick', refOf('Ana')]), 'oficial não expulsa o líder');
  ok(await one('bia', 'mv_guild_manage($1, $2)', ['kick', refOf('Caio')]) === 'kicked', 'oficial expulsa membro');
  await fails(one('ana', 'mv_guild_donate($1)', [10]), 'doação mínima');
  const don = await one('bia', 'mv_guild_donate($1)', [2000000]); ok(don.level === 2 && Number(don.xp) === 2000 && Number(don.bank) === 2000000, 'doação sobe o nível e enche o cofre');
  await one('bia', 'mv_guild_post($1)', ['Bora pra guerra <script>']);
  const feed = (await one('ana', 'mv_guild_mine()')).feed; ok(feed.some(f => f.kind === 'chat' && f.text === 'Bora pra guerra script'), 'mural da guilda sem HTML');
  await fails(one('caio', 'mv_guild_post($1)', ['oi']), 'quem não é membro não posta');
  const list = await as('dan', 'SELECT * FROM public.mv_guild_list'); ok(list.length === 1 && list[0].members === 2 && !('leader' in list[0]), 'lista pública de guildas');

  // ---------- Guerra de Guildas ----------
  await warWindow(false);
  await fails(one('ana', 'mv_gvg_enter()'), 'fora da janela não há guerra');
  await warWindow(true);
  const gid2 = await one('caio', 'mv_guild_create($1, $2, $3, $4, $5, $6, $7)', ['Ordem do Trovão', 'OT', '⚡', '', true, 'Caio', 7000]);
  await one('dan', 'mv_guild_join($1, $2, $3)', [gid2, 'Dan', 6000]);
  await one('ana', 'mv_gvg_enter()'); const b2 = await one('caio', 'mv_gvg_enter()');
  ok(b2.entered && b2.them.name === 'Lanternas Rubras', 'guildas inscritas são pareadas');
  const targets = await one('ana', 'mv_gvg_targets()');
  ok(targets.length === 2 && targets.every(t => ['Caio', 'Dan'].includes(t.name)), 'alvos são só da guilda inimiga');
  await fails(one('ana', 'mv_gvg_start($1)', [refOf('Bia')]), 'não dá para atacar a própria guilda');
  const g1 = await one('ana', 'mv_gvg_start($1)', [targets[0].ref]); await age(60);
  const f1 = await one('ana', 'mv_gvg_finish($1, true, $2::jsonb, 900)', [g1.match, '[]']); ok(f1.points === 3, 'primeira vitória sobre um defensor vale 3');
  const g2 = await one('bia', 'mv_gvg_start($1)', [targets[0].ref]); await age(60);
  ok((await one('bia', 'mv_gvg_finish($1, true, $2::jsonb, 900)', [g2.match, '[]'])).points === 1, 'repetir o mesmo defensor vale 1');
  for (let k = 0; k < 2; k++) { await one('ana', 'mv_gvg_start($1)', [targets[1].ref]); }
  await fails(one('ana', 'mv_gvg_start($1)', [targets[1].ref]), '3 investidas por guerra');
  const board = await one('ana', 'mv_gvg_board()'); ok(board.us.points === 4 && board.them.points === 0 && board.feed.length >= 2, 'placar ao vivo e feed de batalha');
  await fails(one('ana', 'mv_gvg_claim()'), 'recompensa só depois da janela');
  await warWindow(false);
  const cl = await one('ana', 'mv_gvg_claim()'); ok(cl.won && cl.honor >= 120, 'vencedora recebe honra');
  await fails(one('ana', 'mv_gvg_claim()'), 'recompensa de guerra só uma vez');
  await fails(one('dan', 'mv_gvg_claim()'), 'quem não lutou não recebe');
  ok((await as('dan', 'SELECT rating FROM public.mv_guild_list ORDER BY rating DESC'))[0].rating === 1025, 'rating da guilda vencedora sobe');

  // Sair / liderança / desfazer
  ok(await one('ana', 'mv_guild_leave()') === 'left', 'líder sai');
  ok((await one('bia', 'mv_guild_mine()')).me.role === 'leader', 'oficial herda a liderança');
  ok(await one('bia', 'mv_guild_leave()') === 'disbanded', 'último membro desfaz a guilda');

  await setup(); checks++; // idempotente
  await db.close();
  console.log(JSON.stringify({ ok:true, checks }));
})().catch(err => { console.error(err); process.exit(1); });
