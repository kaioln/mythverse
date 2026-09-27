'use strict';
// Carrega a lógica do jogo (os mesmos arquivos do cliente) numa sandbox para o servidor
// validar saves e calcular o poder real usado no ranking.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const FILES = ['src/data.js', 'src/utils.js', 'src/items.js', 'src/progression.js', 'src/roster.js', 'src/builds.js', 'src/engine.js'];
const MAX_SAVE_BYTES = 2 * 1024 * 1024;

function loadGame() {
  const sandbox = { console, Math, JSON, Date, Number, String, Array, Object, Map, Set, Promise, setTimeout:() => 0, setInterval:() => 0 };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename:f });
  return sandbox.KT;
}
const KT = loadGame();

const num = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;

// Valida o save enviado pelo cliente. Retorna { ok, state, summary } ou { ok:false, reason }.
function validateSave(raw) {
  if (typeof raw !== 'string') raw = JSON.stringify(raw);
  if (Buffer.byteLength(raw) > MAX_SAVE_BYTES) return { ok:false, reason:'Save grande demais.' };
  let data;
  try { data = JSON.parse(raw); } catch (_) { return { ok:false, reason:'Save inválido (JSON).' }; }
  if (!data || typeof data !== 'object' || data.version !== 3) return { ok:false, reason:'Versão de save incompatível.' };
  const p = data.player || {};
  const checks = [
    num(p.level, 1, 999), num(p.gold, 0, 1e15), num(p.crystal, 0, 1e9), num(p.dust, 0, 1e12), num(p.ore, 0, 1e12), num(p.keys, 0, 1e6),
    Array.isArray(data.collection) && data.collection.length <= 600,
    Array.isArray(data.inventory) && data.inventory.length <= 260,
    Array.isArray(data.formation) && data.formation.length === 4,
    num(data.totalPlaySeconds || 0, 0, 1e9)
  ];
  if (checks.some(c => !c)) return { ok:false, reason:'Save com valores fora dos limites.' };
  if (data.collection.some(h => !h || typeof h.id !== 'string' || !Number.isSafeInteger(h.level) || h.level < 1 || h.level > 100 || !Number.isInteger(h.stars) || !num(h.stars, 1, 6) || !num(Number(h.xp) || 0, 0, Number.MAX_SAFE_INTEGER) || (h.classLevel !== undefined && (!Number.isSafeInteger(h.classLevel) || h.classLevel < 1 || h.classLevel > 50)) || (h.classXp !== undefined && !num(h.classXp, 0, Number.MAX_SAFE_INTEGER)))) return { ok:false, reason:'Herói inválido no save.' };
  let state;
  try { state = KT.State.mergeState(data); } catch (_) { return { ok:false, reason:'Save não pôde ser interpretado.' }; }
  if (!state.collection.length && data.collection.length) return { ok:false, reason:'Heróis desconhecidos no save.' };
  // O nome público nunca vem sem filtro.
  const name = String(p.name || 'Viajante').normalize('NFKC').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 20) || 'Viajante';
  return { ok:true, state, json:JSON.stringify(data), summary:summarize(state, name) };
}

function summarize(state, name) {
  let power = 0;
  try {
    const recs = KT.State.formationRecords(state), ctx = KT.State.teamContext(state, recs);
    power = recs.reduce((s, r) => s + KT.State.statPower(KT.State.heroStats(state, r, ctx)), 0);
  } catch (_) { power = 0; }
  const prog = state.progress || {};
  return {
    name, power:Math.round(power),
    bossKills:Number(state.stats?.bossKills) || 0,
    bestStage:Object.values(KT.Data.zones).filter(z => z.kind === 'hunt' && !z.side).reduce((a, z) => a + (prog[z.id]?.best || 0), 0),
    riftBest:Number(prog.rift?.best) || 0,
    accountLevel:Number(state.player?.level) || 1,
    gold:Math.max(0, Math.floor(Number(state.player?.gold) || 0)),
    team:JSON.stringify((state.formation || []).map(uid => uid && (state.collection || []).find(h => h.uid === uid)).filter(Boolean).slice(0, 4).map(h => ({ id:String(h.id), stars:Number(h.stars) || 1 }))),
    playSeconds:Number(state.totalPlaySeconds) || 0
  };
}

// Heurística de plausibilidade entre dois saves (sinaliza, não bloqueia).
function suspicious(prev, next, elapsedMs) {
  if (!prev) return false;
  const dt = Math.max(1, elapsedMs / 1000);
  const playDelta = next.playSeconds - prev.playSeconds;
  if (playDelta > dt * 3.5 + 120) return 'tempo de jogo avançou mais rápido que o relógio';
  if (next.accountLevel - prev.accountLevel > 10 && dt < 1800) return 'nível de conta subiu rápido demais';
  if (next.power > prev.power * 6 + 50000 && dt < 1800) return 'poder aumentou rápido demais';
  return false;
}

// ---------------------------------------------------------------------------
// Utilidades do Mercado: chaves de item, limites de plausibilidade e procedência.
// ---------------------------------------------------------------------------
const itemKey = it => it.kind === 'unique' ? `u:${it.uniqueId}` : it.kind === 'set' ? `s:${it.setId}:${it.slot}` : `b:${it.baseId}:${it.rarity}`;
// Maior nível de item que o progresso do save permite obter (com folga para baús/Alfas/Fenda).
function maxItemLevel(state) {
  let m = 1;
  Object.values(KT.Data.zones).forEach(z => {
    const p = state.progress?.[z.id] || {};
    if ((z.kind === 'hunt' || z.kind === 'dungeon' || z.kind === 'rift') && p.best) m = Math.max(m, KT.State.itemLevelFor(z, { stage:p.best + 1, floor:p.best + 1 }));
    if (z.kind === 'boss' && p.kills) m = Math.max(m, KT.State.itemLevelFor(z, { tier:2 }));
  });
  return m + 3;
}
// Chaves de procedência de tudo que é negociável num save: uid de cada item e cada cópia de carta.
function provenanceKeys(state) {
  const keys = (state.inventory || []).map(it => `i:${it.uid}`);
  Object.entries(state.cards || {}).forEach(([id, n]) => { for (let i = 1; i <= Math.min(50, Number(n) || 0); i++) keys.push(`c:${id}:${i}`); });
  return keys;
}
const equippedUids = state => new Set((state.collection || []).flatMap(h => Object.values(h.equipped || {})).filter(Boolean));

module.exports = { KT, validateSave, summarize, suspicious, MAX_SAVE_BYTES, itemKey, maxItemLevel, provenanceKeys, equippedUids };
