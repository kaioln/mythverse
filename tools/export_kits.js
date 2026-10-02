// Exporta o kit de cada herói (passiva, habilidades I a III e ultimate) em JSON, para tools/icon_gen.py pintar os ícones.
// Uso: node tools/export_kits.js > kits.json
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.resolve(__dirname, '..');
const ctx = { console, Math, JSON, Date }; ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ['src/data.js', 'src/utils.js', 'src/items.js', 'src/progression.js', 'src/roster.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename:f });
const D = ctx.KT.Data;
const ST = { burn:'burning', poison:'poison', bleed:'bleeding', stun:'stun', freeze:'freeze', slow:'slow', armorBreak:'armor break', mark:'vulnerability mark', weaken:'weakening', silence:'silence',
  atk:'attack up', def:'defense up', spd:'haste', crit:'critical focus', critDmg:'lethality', dodge:'evasion', lifesteal:'life steal', dr:'damage barrier', regen:'regeneration', stealth:'vanishing', taunt:'taunt', counter:'counter stance' };
const TO = { all:'all enemies', allies:'the whole team', self:'self', lowAlly:'the most wounded ally', atkAlly:'the strongest ally', low:'the weakest enemy', high:'the toughest enemy', back:'the enemy back row', front:'the front row', randEach:'random enemies', rand:'a random enemy' };
// O que a ação faz, em poucas palavras em inglês (o desenhista de ícones precisa do sentido, não dos números).
function gist(effs) {
  const out = [];
  for (const e of effs || []) {
    if (e.k === 'dmg') out.push(`${(e.hits || 1) > 2 ? `${e.hits} rapid hits` : e.m >= 3 ? 'a heavy blow' : 'a strike'} on ${TO[e.to] || 'one enemy'}${e.pierce ? ', armor-piercing' : ''}${e.exec ? ', a finisher' : ''}${e.vsBroken ? ', crushes broken foes' : ''}`);
    else if (e.k === 'st') out.push(`inflicts ${ST[e.s] || e.s}${e.to === 'all' ? ' on all' : ''}`);
    else if (e.k === 'heal') out.push(`heals ${TO[e.to] || 'an ally'}`);
    else if (e.k === 'shield') out.push(`a protective barrier on ${TO[e.to] || 'self'}`);
    else if (e.k === 'buff') out.push(e.v < 0 ? 'at a cost to self' : `${ST[e.s] || e.s}${e.to === 'allies' ? ' for the team' : ''}`);
    else if (e.k === 'taunt') out.push('provokes the enemies');
    else if (e.k === 'drain') out.push('drains life');
    else if (e.k === 'revive') out.push('revives a fallen ally');
    else if (e.k === 'cleanse') out.push('purifies ailments');
    else if (e.k === 'dispel') out.push('strips enemy protections');
    else if (e.k === 'delay') out.push('delays the enemy');
    else if (e.k === 'execute') out.push('executes weakened foes');
    else if (e.k === 'chain') out.push('lightning that jumps between enemies');
    else if (e.k === 'nrg') out.push('restores energy');
    else if (e.k === 'hp') out.push('paid with own life');
    else if (e.k === 'sp') out.push('restores technique');
    else if (e.k === 'brk') out.push('shatters the enemy guard');
    else if (e.k === 'adv') out.push('hastens the next turn');
  }
  return [...new Set(out)].slice(0, 4).join('; ');
}
function hookGist(h) {
  const out = [];
  if (h.stats) out.push('innate ' + Object.keys(h.stats).map(k => ({ atk:'power', hp:'vitality', def:'toughness', spd:'speed', crit:'precision', critDmg:'lethality', dodge:'evasion', dr:'resilience', regen:'regeneration', healPow:'healing gift', dot:'lingering damage', lifesteal:'life steal', pierce:'armor piercing', skill:'arcane mastery' }[k] || k)).join(' and '));
  if (h.aura) out.push('an aura that strengthens the team');
  ['start', 'onAtk', 'every', 'onCrit', 'onKill', 'onHurt', 'onDodge', 'low', 'allyLow'].forEach(k => { if (h[k]) out.push(`${{ start:'at battle start', onAtk:'on attack', every:'every few attacks', onCrit:'on critical hit', onKill:'on kill', onHurt:'when hurt', onDodge:'on dodge', low:'at low health', allyLow:'when an ally is in danger' }[k]}: ${gist(h[k].eff)}`); });
  if (h.vs) out.push(`deadlier against ${ST[h.vs.s] || h.vs.s} targets`);
  return out.slice(0, 3).join('; ');
}
const kits = D.roster.map(t => ({ id:t.id, base:t.base, name:t.name, cls:t.cls, el:t.el, color:t.color, world:t.world,
  icons:[{ slot:'p', kind:'passive trait', name:t.passive.name, gist:hookGist(t.passive.hooks), flavor:'' },
    ...t.skills.map((s, i) => ({ slot:`s${i}`, kind:['signature skill', 'quick technique', 'secret art'][i], name:s.name, gist:gist(s.eff), flavor:s.flavor, fx:s.fx })),
    { slot:'u', kind:'ultimate', name:t.ult.name, gist:gist(t.ult.eff), flavor:t.ult.flavor }] }));
process.stdout.write(JSON.stringify(kits));
