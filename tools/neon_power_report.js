// Relatório de poder das contas do modo Neon: de onde vem o poder de cada equipe (nível, raridade,
// qualidade, refino, treino, Paragão, cartas) calculado com as regras ATUAIS do jogo.
// Uso: node --env-file=.env tools/neon_power_report.js [nome da conta]
const fs = require('fs'), path = require('path'), vm = require('vm'), pg = require('pg');
const root = path.resolve(__dirname, '..');
for (const f of ['src/data.js', 'src/utils.js', 'src/items.js', 'src/progression.js', 'src/roster.js', 'src/builds.js', 'src/engine.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename:f });
const { State, Data:D } = global.KT;
(async () => {
  const c = new pg.Client({ connectionString:process.env.DATABASE_URL }); await c.connect();
  const who = process.argv[2];
  const r = await c.query(`SELECT display_name, power, data FROM public.mv_saves ${who ? 'WHERE lower(display_name) = lower($1)' : ''} ORDER BY power DESC`, who ? [who] : []);
  for (const row of r.rows) {
    const s = State.mergeState(row.data), recs = State.formationRecords(s), ctx = State.teamContext(s, recs, 0);
    const now = recs.reduce((a, h) => a + State.statPower(State.heroStats(s, h, ctx)), 0);
    console.log(`\n=== ${row.display_name} · poder no ranking ${Number(row.power).toLocaleString('pt-BR')} · recalculado agora ${now.toLocaleString('pt-BR')}`);
    console.log(`conta nv ${s.player.level} · Paragão ${s.paragon.lv} · treino ${JSON.stringify(s.training)} · Dojo ${s.buildings.dojo} · Casa ${s.buildings.house} · cartas expostas ${(s.house.display || []).filter(Boolean).length}`);
    console.log(`progresso: ${Object.entries(s.progress).filter(([, p]) => p.best || p.kills).map(([z, p]) => `${z} ${p.best || ''}${p.kills ? ` (${p.kills} vit.)` : ''}`).join(' · ')}`);
    recs.forEach(h => {
      const st = State.heroStats(s, h, ctx), t = D.roster.find(x => x.id === h.id);
      const gear = Object.values(h.equipped).map(u => s.inventory.find(i => i.uid === u)).filter(Boolean).map(i => `${i.rarity[0]}${i.plus ? '+' + i.plus : ''}`).join(' ');
      console.log(`  ${t.name.padEnd(28)} nv ${String(h.level).padStart(3)} ${h.stars}★ ${h.rarity.padEnd(9)} classe ${h.job ? 'avançada' : 'base'} · poder ${State.statPower(st).toLocaleString('pt-BR').padStart(10)} · ATK ${st.atk} HP ${st.maxHp} · itens ${gear || '-'}`);
    });
  }
  await c.end();
})().catch(e => { console.error('Falhou:', e.message); process.exit(1); });
