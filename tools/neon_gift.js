// Envia um presente da administração para o correio de uma conta do modo Neon (o jogo resgata sozinho ao abrir).
// Uso:
//   node --env-file=.env tools/neon_gift.js <conta> keys <quantidade> [motivo]
//   node --env-file=.env tools/neon_gift.js <conta> hero <id-do-herói> <raridade> [motivo]
// <conta> é o nome no ranking (ex.: mits) ou o id do Neon Auth.
const pg = require('pg');
(async () => {
  const [who, kind, a, b, ...rest] = process.argv.slice(2);
  if (!process.env.DATABASE_URL || !who || !['keys', 'hero'].includes(kind)) { console.error('Uso: node --env-file=.env tools/neon_gift.js <conta> keys <n> | hero <id> <raridade>'); process.exit(1); }
  let payload, reason;
  if (kind === 'keys') { const n = Math.floor(Number(a)); if (!(n >= 1 && n <= 100000)) throw new Error('quantidade de 1 a 100.000'); payload = { n }; reason = [b, ...rest].filter(Boolean).join(' ') || `Presente: ${n} Chaves de Convocação`; }
  else {
    if (!/^[a-z0-9_]+$/.test(a || '') || !['common', 'rare', 'epic', 'legendary'].includes(b)) throw new Error('herói: id em minúsculas e raridade common|rare|epic|legendary');
    payload = { id:a, rarity:b }; reason = rest.join(' ') || `Presente: herói ${a} (${b})`;
  }
  const c = new pg.Client({ connectionString:process.env.DATABASE_URL }); await c.connect();
  const r = await c.query('SELECT public.mv_gift($1, $2, $3::jsonb, $4) AS id', [who, kind, JSON.stringify(payload), reason]);
  console.log(`Presente enviado para ${who} (${r.rows[0].id}): ${kind} ${JSON.stringify(payload)}`);
  await c.end();
})().catch(e => { console.error('Falhou:', e.message); process.exit(1); });
