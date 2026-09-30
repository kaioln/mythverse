// Cidade viva: heróis e moradores andando pelas ruas de Tsukimori, cada um com a própria rotina.
// Só visual (o motor de jogo não sabe disso). Coordenadas no espaço lógico do palco (1280×720), sobre a arte 'town'.
// GRAPH: nós da malha de ruas (onde se pode andar) e ligações; SPOTS: lugares com algo para fazer (lojas, dojo, estandes).
(() => {
  const KT = globalThis.KT = globalThis.KT || {};

  // Malha de ruas (ajustada à ilustração assets/scenes/town). [x, y]
  // Malha sobre assets/scenes/village-expanded (arte original da capital, 1280×720 lógicos).
  const NODES = {
    plaza:[590,418], pN:[590,378], pS:[590,462], pW:[455,420], pE:[725,412], pNW:[500,390], pNE:[685,386], pSW:[505,452], pSE:[680,452],
    northSteps:[600,318], upperSteps:[596,248], hall:[575,168],
    houseYard:[500,318], house:[440,292],
    westWalk:[360,432], marketA:[285,438], marketB:[190,438], marketC:[100,440],
    dojoWalk:[240,330], dojo:[175,318], dojoStairs:[195,362], marketGap:[188,408],
    guildSteps:[290,212], guildStairsMid:[268,258], yardGate:[252,285], landing:[300,298], bridgeStairs:[326,334], woodBridge:[372,352], bridgeEnd:[415,375], guild:[205,168],
    bankSteps:[300,540], bankFront:[313,627], bank:[235,655],
    workshopWalk:[392,645], workshop:[560,698],
    forgeWalk:[760,398], forge:[800,380],
    eastWalk:[880,440], shrineSteps:[980,440], eastStairs:[990,488], shrine:[1050,432],
    bridgeW:[770,505], bridge:[850,500], bridgeE:[935,505], dockWalk:[950,592], dock:[1020,628], expedition:[1150,612]
  };
  const EDGES = [
    ['plaza','pN'],['plaza','pS'],['plaza','pW'],['plaza','pE'],['pN','pNW'],['pN','pNE'],['pS','pSW'],['pS','pSE'],['pW','pNW'],['pW','pSW'],['pE','pNE'],['pE','pSE'],
    ['pN','northSteps'],['northSteps','upperSteps'],['upperSteps','hall'],['pNW','houseYard'],['houseYard','house'],['houseYard','northSteps'],
    ['pW','westWalk'],['westWalk','marketA'],['marketA','marketB'],['marketB','marketC'],['dojoWalk','dojo'],['dojoWalk','dojoStairs'],['dojoStairs','marketGap'],['marketGap','marketB'],
    ['guild','guildSteps'],['guildSteps','guildStairsMid'],['guildStairsMid','yardGate'],['yardGate','dojoWalk'],['guildStairsMid','landing'],
    ['landing','bridgeStairs'],['bridgeStairs','woodBridge'],['woodBridge','bridgeEnd'],['bridgeEnd','pW'],
    ['marketA','bankSteps'],['bankSteps','bankFront'],['bankFront','bank'],['bankSteps','workshopWalk'],['workshopWalk','workshop'],
    ['pE','forgeWalk'],['forgeWalk','forge'],['pE','eastWalk'],['eastWalk','shrineSteps'],['shrineSteps','shrine'],
    ['pSE','bridgeW'],['bridgeW','bridge'],['bridge','bridgeE'],['bridgeE','dockWalk'],['dockWalk','dock'],['dock','expedition'],['bridgeE','eastStairs'],['eastStairs','shrineSteps']
  ];
  // Lugares de interesse: nó, o que o herói faz ali (texto curto do balão) e para onde olha (1 direita, -1 esquerda).
  const SPOTS = [
    { node:'forge', verb:'Olhando as lâminas', face:1, w:3 }, { node:'dojo', verb:'Treinando', face:-1, w:3 },
    { node:'marketA', verb:'Pechinchando', face:-1, w:2 }, { node:'marketB', verb:'Vendo tecidos', face:1, w:2 },
    { node:'marketC', verb:'Provando chá', face:-1, w:2 }, { node:'guild', verb:'Lendo contratos', face:-1, w:2 },
    { node:'hall', verb:'Olhando o portal', face:1, w:1 }, { node:'shrine', verb:'Rezando', face:1, w:2 },
    { node:'workshop', verb:'Vendo poções', face:1, w:2 }, { node:'dock', verb:'Olhando os barcos', face:1, w:1 }, { node:'bridge', verb:'Vendo a cascata', face:-1, w:1 },
    { node:'bank', verb:'No banco', face:-1, w:1 }, { node:'house', verb:'Descansando', face:1, w:1 },
    { node:'plaza', verb:'Conversando', face:1, w:2 }
  ];
  // Moradores: folha (assets/folk), papel e onde vivem. post = fica no lugar trabalhando; route = anda entre nós.
  const FOLK = [
    { f:0, post:'marketA', off:[-12, -4], face:1, verb:'Vendendo lámen' },
    { f:1, post:'forge', off:[26, 4], face:-1, verb:'Martelando' },
    { f:2, route:['hall','upperSteps','hall'], speed:12, verb:'Varrendo' },
    { f:3, route:['shrine','shrineSteps','eastWalk','pE','pNE','pN','pNW','pW','westWalk','marketA','westWalk','pW','pNW','pN','pNE','pE','eastWalk','shrineSteps'], speed:17, verb:'Acendendo lanternas' },
    { f:4, post:'marketC', off:[18, -4], face:1, verb:'Vendendo peixe' },
    { f:5, post:'marketB', off:[14, -4], face:1, verb:'Servindo chá' },
    { f:6, route:['plaza','pNE','pE','pSE','pS','pSW','pW','pNW'], speed:34, verb:'Brincando', loop:true },
    { f:7, route:['bridge','bridgeW','pSE','plaza','pW','westWalk','pW','plaza','pSE','bridgeW'], speed:22, verb:'De ronda' },
    { f:8, route:['dock','bridgeE','bridge','bridgeW','pSE','pS','pSW','pW','westWalk','marketA','marketB','marketC'], speed:20, verb:'Mercadora' },
    { f:9, route:['dock','expedition','dock','dockWalk','bridgeE','eastWalk','pE','forgeWalk'], speed:17, verb:'Carregando caixas' }
  ];

  const H0 = 40, TOP = 160, BOT = 700;                // altura base de uma pessoa e faixa de profundidade da cena
  const depth = y => .78 + .3 * Math.max(0, Math.min(1, (y - TOP) / (BOT - TOP)));
  const adj = {}; EDGES.forEach(([a, b]) => { (adj[a] ||= []).push(b); (adj[b] ||= []).push(a); });
  function path(from, to) {                            // menor caminho em número de trechos (malha pequena)
    const prev = { [from]:null }, q = [from];
    while (q.length) { const n = q.shift(); if (n === to) break; for (const m of adj[n] || []) if (!(m in prev)) { prev[m] = n; q.push(m); } }
    if (!(to in prev)) return [to];
    const out = []; for (let n = to; n; n = prev[n]) out.unshift(n); return out.slice(1);
  }
  // Desvio pequeno (dentro da largura do caminho): ninguém sai da rua, escada ou ponte para andar em telhado, rio ou barranco.
  const jitter = () => [(Math.random() - .5) * 8, (Math.random() - .5) * 4];
  const pick = list => { const tot = list.reduce((s, x) => s + x.w, 0); let r = Math.random() * tot; for (const x of list) if ((r -= x.w) < 0) return x; return list[0]; };

  class TownLife {
    constructor() { this.agents = []; this.key = ''; }
    // Recria os agentes quando a equipe muda. heroes: [{ uid, sprite, name }]
    sync(heroes) {
      const key = heroes.map(h => h.uid + h.sprite).join('|'); if (key === this.key) return; this.key = key;
      const starts = ['plaza', 'forge', 'marketA', 'dojo', 'guild', 'shrine'];
      this.agents = heroes.map((h, i) => { const n = starts[i % starts.length], j = jitter(); return { kind:'hero', ...h, x:NODES[n][0] + j[0], y:NODES[n][1] + j[1], node:n, path:[], wait:1 + i * 1.7, face:1, speed:30 + Math.random() * 8, verb:'', walkT:Math.random() }; })
        .concat(FOLK.map((f, i) => { const n = f.post || f.route[0], o = f.off || [0, 0]; return { kind:'folk', f:f.f, def:f, x:NODES[n][0] + o[0], y:NODES[n][1] + o[1], node:n, path:[], wait:Math.random() * 3, face:f.face || 1, speed:f.speed || 0, verb:f.verb, ri:0, walkT:Math.random() }; }));
    }
    update(dt) {
      for (const a of this.agents) {
        if (a.path.length) {                                 // andando até o próximo nó
          const [tx, ty] = a.target, dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy), step = a.speed * depth(a.y) * dt;
          if (Math.abs(dx) > .5) a.face = dx > 0 ? 1 : -1;
          a.walkT += dt; a.moving = true;
          if (d <= step) { a.x = tx; a.y = ty; a.node = a.path.shift(); if (a.path.length) { const n = NODES[a.path[0]], j = jitter(); a.target = [n[0] + j[0] * .5, n[1] + j[1] * .5]; } else this.arrive(a); }
          else { a.x += dx / d * step; a.y += dy / d * step; }
          continue;
        }
        a.moving = false;
        if ((a.wait -= dt) > 0) continue;
        if (a.kind === 'hero') { const s = pick(SPOTS.filter(x => x.node !== a.node)); a.spot = s; a.verb = ''; this.go(a, s.node); }
        else if (a.def.route) { const r = a.def.route; a.ri = a.def.loop ? (a.ri + 1) % r.length : (a.ri + 1) % r.length; this.go(a, r[a.ri]); }
        else { a.face = Math.random() < .5 ? a.face : -a.face; a.wait = 3 + Math.random() * 5; }  // quem trabalha parado vira de lado às vezes
      }
    }
    go(a, to) { a.path = path(a.node, to); if (!a.path.length) { a.wait = 2; return; } const n = NODES[a.path[0]], j = jitter(); a.target = [n[0] + j[0] * .5, n[1] + j[1] * .5]; }
    arrive(a) {
      if (a.kind === 'hero') { a.face = a.spot?.face || a.face; a.verb = a.spot?.verb || ''; a.wait = 5 + Math.random() * 9; }
      else { a.wait = a.def.loop ? .2 : 2 + Math.random() * 4; }
    }
    // Lista para desenhar, de trás para frente, com a escala da profundidade.
    drawList() { return this.agents.map(a => ({ a, s:depth(a.y), h:H0 * depth(a.y) })).sort((p, q) => p.a.y - q.a.y); }
  }
  KT.TownLife = TownLife;
  KT.TownMap = { NODES, EDGES, SPOTS, FOLK };
})();
