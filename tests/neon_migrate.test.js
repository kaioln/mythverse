'use strict';
// Migração entre projetos Neon (tools/neon_migrate.js) com dois Postgres embutidos (PGlite): contas, saves, guilda e mercado.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { migrate } = require('../tools/neon_migrate');

(async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const neonProject = async () => {
    const db = new PGlite();
    await db.exec(`CREATE SCHEMA auth;
      CREATE FUNCTION auth.user_id() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '') $$;
      CREATE ROLE authenticated; CREATE ROLE anonymous;
      CREATE SCHEMA neon_auth;
      CREATE TABLE neon_auth."user" (id text PRIMARY KEY, name text, email text, "emailVerified" boolean, "createdAt" timestamptz DEFAULT now());
      CREATE TABLE neon_auth.account (id text PRIMARY KEY, "accountId" text, "providerId" text, "userId" text REFERENCES neon_auth."user"(id), password text);`);
    return db;
  };
  let checks = 0; const ok = (c, m) => { assert.ok(c, m); checks++; };
  const src = await neonProject(), dst = await neonProject();
  for (const f of ['neon_setup.sql', 'neon_social.sql', 'neon_economy.sql', 'neon_admin.sql', 'neon_community.sql', 'neon_antirmt.sql']) await src.exec(fs.readFileSync(path.join(__dirname, '..', 'tools', f), 'utf8'));
  await src.exec(`INSERT INTO neon_auth."user" (id, name, email) VALUES ('u-ana', 'ana', 'ana@x.test'), ('u-bia', 'bia', 'bia@x.test');
    INSERT INTO neon_auth.account (id, "accountId", "providerId", "userId", password) VALUES ('a1', 'u-ana', 'credential', 'u-ana', 'salt:hashA'), ('a2', 'u-bia', 'credential', 'u-bia', 'salt:hashB');
    INSERT INTO public.mv_saves (user_id, data, display_name, power, account_level) VALUES ('u-ana', '{"powerScale":3,"player":{"gold":5}}', 'Ana', 79700, 56), ('u-bia', '{"powerScale":3}', 'Bia', 3000, 8);
    UPDATE public.mv_saves SET revision = revision + 1, data = '{"powerScale":3,"player":{"gold":777}}' WHERE user_id = 'u-ana';
    UPDATE public.mv_saves SET revision = revision + 1 WHERE user_id = 'u-ana';`);
  await src.transaction(async t => { await t.query(`SELECT set_config('test.uid', 'u-ana', true)`); await t.exec('SET LOCAL ROLE authenticated'); await t.query(`SELECT public.mv_guild_create('Lanternas', 'LR', '月', 'x', true, 'Ana', 1)`); await t.query(`SELECT public.mv_chat_send('oi')`); });
  const before = (await src.query(`SELECT revision, power, data FROM public.mv_saves WHERE user_id = 'u-ana'`)).rows[0];

  const dry = await migrate(src, dst, { apply:false, log:() => {} });
  ok(dry.find(r => r.table === 'mv_saves').src === 2 && !(await dst.query(`SELECT count(*)::int n FROM information_schema.tables WHERE table_name = 'mv_saves'`)).rows[0].n, 'simulação não grava nada');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-mig-'));
  await migrate(src, dst, { apply:true, backupDir:dir, log:() => {} });
  ok(fs.readdirSync(dir).some(f => f.startsWith('neon-backup-')), 'backup do banco antigo gravado');
  const after = (await dst.query(`SELECT revision, power, data FROM public.mv_saves WHERE user_id = 'u-ana'`)).rows[0];
  ok(after && after.revision === before.revision && Number(after.power) === Number(before.power) && after.data.player.gold === 777, 'save idêntico (revisão, poder e dados; regras do save não mexeram)');
  ok((await dst.query(`SELECT password FROM neon_auth.account WHERE "userId" = 'u-bia'`)).rows[0]?.password === 'salt:hashB', 'contas e senhas mantidas');
  ok((await dst.query(`SELECT count(*)::int n FROM public.mv_guild_members WHERE user_id = 'u-ana'`)).rows[0].n === 1, 'guilda migrada');
  const chatId = (await dst.query('SELECT max(id)::int m FROM public.mv_chat')).rows[0].m;
  await dst.exec("UPDATE public.mv_chat SET created_at = created_at - interval '1 minute'");
  const nid = await dst.transaction(async t => { await t.query(`SELECT set_config('test.uid', 'u-ana', true)`); await t.exec('SET LOCAL ROLE authenticated'); return (await t.query(`SELECT public.mv_chat_send('de volta') v`)).rows[0].v; });
  ok(Number(nid) > chatId, 'sequências continuam depois dos ids migrados');
  const trg = (await dst.query(`SELECT count(*)::int n FROM pg_trigger WHERE tgname = 'mv_saves_guard' AND tgenabled <> 'D'`)).rows[0].n;
  ok(trg === 1, 'regras do save religadas depois da cópia');
  let err = null; try { await migrate(src, dst, { apply:true, log:() => {} }); } catch (e) { err = e; }
  ok(err && /já tem/.test(err.message), 'não migra por cima de um projeto com saves');
  console.log(JSON.stringify({ ok:true, checks }));
})().catch(e => { console.error(e); process.exit(1); });
