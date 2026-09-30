// Migra o Mythverse de um projeto Neon para outro sem perder contas nem saves.
//
// Copia as contas do Neon Auth (neon_auth.user e neon_auth.account, com os hashes de senha: todo mundo entra com o
// mesmo e-mail e senha) e todas as tabelas do jogo (mv_*), mantendo os mesmos ids. Antes de tudo grava um backup
// completo do banco antigo em data/backups/. Sessões não são copiadas: cada jogador entra de novo uma vez.
//
// Uso:
//   1. Crie o projeto novo no Neon, ative Auth (e-mail e senha), adicione o domínio https://kaioln.github.io e
//      ative a Data API com o Neon Auth como provedor (igual ao docs/NEON.md).
//   2. Simulação (não grava nada no novo):
//        node --env-file=.env tools/neon_migrate.js "postgresql://…NOVO…"
//   3. Migração de verdade:
//        node --env-file=.env tools/neon_migrate.js "postgresql://…NOVO…" --apply
//   4. Troque DATABASE_URL no .env e KT.CONFIG.neon em src/config.js pelo projeto novo (o script mostra o valor).
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const SQL_FILES = ['neon_setup.sql', 'neon_social.sql', 'neon_economy.sql', 'neon_admin.sql', 'neon_community.sql', 'neon_antirmt.sql'];
const AUTH_TABLES = ['user', 'account'];

const q = (db, sql, params) => db.query(sql, params).then(r => r.rows);
const ident = s => '"' + String(s).replace(/"/g, '""') + '"';

async function gameTables(db) {
  const rows = await q(db, `SELECT c.relname t FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'mv\\_%' ORDER BY 1`);
  const names = rows.map(r => r.t);
  // Ordem pelas chaves estrangeiras (pais antes dos filhos).
  const fk = await q(db, `SELECT cl.relname child, pr.relname parent FROM pg_constraint co
    JOIN pg_class cl ON cl.oid = co.conrelid JOIN pg_class pr ON pr.oid = co.confrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace WHERE co.contype = 'f' AND n.nspname = 'public'`);
  const out = [], seen = new Set(), visit = t => { if (seen.has(t)) return; seen.add(t); fk.filter(f => f.child === t && names.includes(f.parent) && f.parent !== t).forEach(f => visit(f.parent)); out.push(t); };
  names.forEach(visit);
  return out;
}

async function columns(db, schema, table) {
  return q(db, `SELECT column_name c, data_type d, udt_name u, is_generated g, column_default def FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`, [schema, table]);
}

async function copyTable(src, dst, schema, table, apply, log) {
  const sc = await columns(src, schema, table), dc = await columns(dst, schema, table);
  if (!apply) { const n = (await q(src, `SELECT count(*)::int n FROM ${ident(schema)}.${ident(table)}`))[0].n; log(`  ${schema}.${table}: ${n} linha(s) (simulação)`); return { table, src:n, copied:0 }; }
  if (!dc.length) { log(`  ${schema}.${table}: não existe no novo (pulado)`); return { table, src:0, copied:0, skipped:true }; }
  const cols = sc.filter(c => dc.some(d => d.c === c.c && d.g !== 'ALWAYS'));
  const rows = await q(src, `SELECT ${cols.map(c => ident(c.c)).join(', ')} FROM ${ident(schema)}.${ident(table)}`);
  if (!apply || !rows.length) { log(`  ${schema}.${table}: ${rows.length} linha(s)${apply ? '' : ' (simulação)'}`); return { table, src:rows.length, copied:0 }; }
  const json = new Set(dc.filter(d => d.u === 'json' || d.u === 'jsonb').map(d => d.c));
  let copied = 0;
  for (const row of rows) {
    const vals = cols.map(c => (json.has(c.c) && row[c.c] !== null && typeof row[c.c] !== 'string') ? JSON.stringify(row[c.c]) : row[c.c]);
    const res = await dst.query(`INSERT INTO ${ident(schema)}.${ident(table)} (${cols.map(c => ident(c.c)).join(', ')}) VALUES (${cols.map((_, i) => '$' + (i + 1)).join(', ')}) ON CONFLICT DO NOTHING`, vals);
    copied += res.affectedRows ?? res.rowCount ?? 0;
  }
  // Sequências (ids seriais) continuam de onde pararam.
  for (const c of dc.filter(d => /nextval\(/.test(d.def || ''))) {
    await dst.query(`SELECT setval(pg_get_serial_sequence($1, $2), GREATEST(1, (SELECT coalesce(max(${ident(c.c)}), 0) FROM ${ident(schema)}.${ident(table)})))`, [`${schema}.${table}`, c.c]);
  }
  log(`  ${schema}.${table}: ${copied}/${rows.length} copiada(s)`);
  return { table, src:rows.length, copied };
}

async function migrate(src, dst, { apply = false, backupDir = null, sqlDir = __dirname, log = console.log } = {}) {
  // 1. Backup completo do antigo.
  if (backupDir) {
    fs.mkdirSync(backupDir, { recursive:true });
    const dump = {};
    for (const [schema, t] of [...AUTH_TABLES.map(t => ['neon_auth', t]), ...(await gameTables(src)).map(t => ['public', t])]) dump[`${schema}.${t}`] = await q(src, `SELECT * FROM ${ident(schema)}.${ident(t)}`);
    const file = path.join(backupDir, `neon-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify(dump));
    log(`Backup do banco antigo: ${file}`);
  }
  // 2. O novo precisa do Neon Auth e da Data API ativos.
  const ok = await q(dst, `SELECT (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'neon_auth' AND table_name IN ('user', 'account'))::int auth,
    (SELECT count(*) FROM pg_roles WHERE rolname IN ('authenticated', 'anonymous'))::int roles`);
  if (ok[0].auth < 2) throw new Error('O projeto novo ainda não tem o Neon Auth ativo (neon_auth.user/account). Ative Auth no Console e rode de novo.');
  if (ok[0].roles < 2) throw new Error('O projeto novo ainda não tem a Data API ativa (papéis authenticated/anonymous). Ative a Data API com o Neon Auth e rode de novo.');
  const already = (await q(dst, `SELECT count(*)::int n FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'mv_saves'`))[0].n
    ? (await q(dst, 'SELECT count(*)::int n FROM public.mv_saves'))[0].n : 0;
  if (already && apply) throw new Error(`O projeto novo já tem ${already} save(s). Para não misturar dados, use um projeto vazio.`);
  // 3. Estrutura do jogo no novo.
  if (apply) { for (const f of SQL_FILES) { const sql = fs.readFileSync(path.join(sqlDir, f), 'utf8'); await (dst.exec ? dst.exec(sql) : dst.query(sql)); } log('Estrutura do jogo criada no projeto novo.'); }
  // 4. Contas (com hash de senha) e 5. dados do jogo, sem disparar as regras de save (revisão e escala de poder ficam como estão).
  const report = [];
  log('Contas:');
  for (const t of AUTH_TABLES) report.push(await copyTable(src, dst, 'neon_auth', t, apply, log));
  log('Dados do jogo:');
  const tables = apply ? await gameTables(dst) : await gameTables(src);
  for (const t of tables) {
    if (apply) await dst.query(`ALTER TABLE public.${ident(t)} DISABLE TRIGGER USER`);
    try { report.push(await copyTable(src, dst, 'public', t, apply, log)); }
    finally { if (apply) await dst.query(`ALTER TABLE public.${ident(t)} ENABLE TRIGGER USER`); }
  }
  // 6. Conferência: toda linha do antigo precisa estar no novo.
  if (apply) {
    const bad = [];
    for (const r of report.filter(r => !r.skipped)) {
      const schema = AUTH_TABLES.includes(r.table) ? 'neon_auth' : 'public';
      const n = (await q(dst, `SELECT count(*)::int n FROM ${ident(schema)}.${ident(r.table)}`))[0].n;
      if (n < r.src) bad.push(`${r.table}: ${n}/${r.src}`);
    }
    if (bad.length) throw new Error(`Conferência falhou: ${bad.join(', ')}`);
    try { await dst.query("NOTIFY pgrst, 'reload schema'"); } catch (_) { /* PGlite */ }
    log('Conferência: tudo copiado.');
  }
  return report;
}

module.exports = { migrate, gameTables };

if (require.main === module) {
  (async () => {
    const pg = require('pg');
    const target = process.argv.slice(2).find(a => !a.startsWith('--')), apply = process.argv.includes('--apply');
    if (!process.env.DATABASE_URL || !target) { console.error('Uso: node --env-file=.env tools/neon_migrate.js "postgresql://…NOVO…" [--apply]'); process.exit(1); }
    if (target === process.env.DATABASE_URL) { console.error('O destino é o mesmo banco da DATABASE_URL.'); process.exit(1); }
    const src = new pg.Client({ connectionString:process.env.DATABASE_URL }), dst = new pg.Client({ connectionString:target });
    await src.connect(); await dst.connect();
    await src.query('SET default_transaction_read_only = on'); // o banco antigo nunca é alterado
    try {
      await migrate(src, dst, { apply, backupDir:path.join(__dirname, '..', 'data', 'backups') });
      const u = new URL(target); u.username = ''; u.password = ''; u.search = '';
      console.log(apply ? `\nPronto. Agora:\n  · .env: DATABASE_URL=<a URL nova>\n  · src/config.js: neon:'${u.origin.replace(/^postgres(ql)?:/, 'https:')}${u.pathname}'\n  · commit e push. Os jogadores entram de novo com o mesmo e-mail e senha.`
        : '\nSimulação concluída: nada foi gravado. Rode de novo com --apply para migrar.');
    } finally { await src.end(); await dst.end(); }
  })().catch(e => { console.error('Falhou:', e.message); process.exit(1); });
}
