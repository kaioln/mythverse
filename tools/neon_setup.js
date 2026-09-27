// Cria/atualiza as tabelas do modo Neon (tools/neon_setup.sql) usando a DATABASE_URL do .env.
// Uso: node --env-file=.env tools/neon_setup.js
const fs = require('fs'), path = require('path'), pg = require('pg');
(async () => {
  if (!process.env.DATABASE_URL) { console.error('Defina DATABASE_URL (arquivo .env).'); process.exit(1); }
  const c = new pg.Client({ connectionString:process.env.DATABASE_URL });
  await c.connect();
  const has = await c.query("SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'auth' AND p.proname = 'user_id'");
  if (!has.rowCount) { console.error('auth.user_id() não existe: ative a Data API no Console do Neon (com o Neon Auth como provedor) e rode de novo.'); await c.end(); process.exit(2); }
  const roles = await c.query("SELECT rolname FROM pg_roles WHERE rolname IN ('authenticated', 'anonymous')");
  if (roles.rowCount < 2) { console.error('Os papéis authenticated/anonymous ainda não existem: ative a Data API e rode de novo.'); await c.end(); process.exit(2); }
  await c.query(fs.readFileSync(path.join(__dirname, 'neon_setup.sql'), 'utf8'));
  await c.query(fs.readFileSync(path.join(__dirname, 'neon_social.sql'), 'utf8'));
  await c.query(fs.readFileSync(path.join(__dirname, 'neon_economy.sql'), 'utf8'));
  await c.query("NOTIFY pgrst, 'reload schema'");
  console.log('Modo Neon pronto: saves (RLS), ranking, Mercado de Jogadores, Arena PvP, Loja de Honra, Guildas, Guerra de Guildas, Banco Central e ordens de compra.');
  await c.end();
})().catch(e => { console.error('Falhou:', e.message); process.exit(1); });
