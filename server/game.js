'use strict';
// Carrega a lógica do jogo (os mesmos arquivos do cliente) numa sandbox para o servidor
// validar saves e calcular o poder real usado no ranking.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const FILES = ['src/data.js', 'src/utils.js', 'src/items.js', 'src/progression.js', 'src/roster.js', 'src/engine.js'];
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
  if (data.collection.some(h => !h || typeof h.id !== 'string' || !num(h.level, 1, 60) || !num(h.stars, 1, 6))) return { ok:false, reason:'Herói inválido no save.' };
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
    bestStage:(prog.hunt?.best || 0) + (prog.hunt_tide?.best || 0),
    accountLevel:Number(state.player?.level) || 1,
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

module.exports = { KT, validateSave, summarize, suspicious, MAX_SAVE_BYTES };
