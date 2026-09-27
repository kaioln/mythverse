// Recalcula o Poder do ranking de TODAS as contas do modo Neon com o motor do jogo (regras atuais,
// sem comidas/buffs temporários), direto do save no banco. Não depende da versão do jogo em cada aparelho.
// Usado por tools/neon_setup.js; funciona com pg.Client ou PGlite (query(sql, params) → { rows }).
const fs = require('fs'), path = require('path'), vm = require('vm');
let KT = null;
function game() {
  if (KT) return KT;
  const ctx = { console, Math, Date, JSON, Number, String, Object, Array, Set, Map, Symbol, Promise, setTimeout, clearTimeout };
  ctx.globalThis = ctx; vm.createContext(ctx);
  for (const f of ['src/data.js', 'src/utils.js', 'src/items.js', 'src/progression.js', 'src/roster.js', 'src/builds.js', 'src/engine.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename:f });
  return (KT = ctx.KT);
}
function powerOf(data) {
  const { State } = game(), s = State.mergeState(typeof data === 'string' ? JSON.parse(data) : data);
  const recs = State.formationRecords(s), ctx = State.teamContext(s, recs, 0);
  return State.powerScore(recs.reduce((a, r) => a + State.statPower(State.heroStats(s, r, ctx)), 0));
}
async function recomputeAll(db) {
  const rows = (await db.query('SELECT user_id, power, data FROM public.mv_saves')).rows, changed = [];
  await db.query('ALTER TABLE public.mv_saves DISABLE TRIGGER mv_saves_guard');
  try {
    for (const r of rows) {
      let p; try { p = powerOf(r.data); } catch (e) { continue; }
      if (Number(r.power) !== p) { await db.query('UPDATE public.mv_saves SET power = $2 WHERE user_id = $1', [r.user_id, p]); changed.push({ user:r.user_id, from:Number(r.power), to:p }); }
    }
  } finally { await db.query('ALTER TABLE public.mv_saves ENABLE TRIGGER mv_saves_guard'); }
  await db.query('UPDATE public.mv_pvp p SET power = s.power FROM public.mv_saves s WHERE s.user_id = p.user_id');
  await db.query('UPDATE public.mv_guild_members m SET power = s.power FROM public.mv_saves s WHERE s.user_id = m.user_id');
  await db.query('UPDATE public.mv_guild_requests r SET power = s.power FROM public.mv_saves s WHERE s.user_id = r.user_id');
  return changed;
}
module.exports = { recomputeAll, powerOf };
