// Cidade viva: heróis e moradores andando pela capital, cada um com a própria rotina.
// Só visual (o motor de jogo não sabe disso). Coordenadas no espaço lógico do palco (1280×720) sobre a arte
// assets/scenes/village-expanded. Só se anda no PISO: áreas (praça, ruas, pátios, deques) e corredores (escadas,
// pontes) desenhados sobre a arte; as rotas são calculadas célula a célula (A*) dentro desse piso.
(() => {
  const KT = globalThis.KT = globalThis.KT || {};

  // ---- piso ----
  const AREAS = [
    { id:'plaza', ellipse:[560, 430, 150, 48] },
    { id:'temple', poly:[[500,145],[625,145],[642,174],[505,181]] },
    { id:'forge', poly:[[690,350],[900,330],[906,382],[700,398]] },
    { id:'plazaWest', poly:[[382,408],[474,402],[486,455],[392,468]] },
    { id:'westLanding', poly:[[350,370],[438,384],[474,420],[390,432]] },
    { id:'plazaEast', poly:[[652,410],[724,418],[760,470],[682,478]] },
    { id:'market', poly:[[58,398],[395,390],[418,474],[70,480]] },
    { id:'guild', poly:[[38,146],[382,144],[390,184],[45,186]] },
    { id:'dojo', poly:[[46,276],[298,278],[310,320],[55,324]] },
    { id:'garden', poly:[[330,298],[574,296],[592,352],[350,365]] },
    { id:'bank', poly:[[8,604],[302,594],[312,682],[12,694]] },
    { id:'workshop', poly:[[545,620],[866,612],[864,704],[548,708]] },
    { id:'eastLanding', poly:[[790,490],[936,490],[952,522],[798,526]] },
    { id:'shrineYard', poly:[[1010,400],[1188,392],[1190,467],[1018,472]] },
    { id:'dockYard', poly:[[932,568],[1250,550],[1265,672],[940,683]] },
    { id:'pier', poly:[[890,590],[982,578],[994,622],[900,634]] }
  ];
  // Corredores: [largura, pontos]. Escadas, patamares e pontes visíveis na própria arte.
  const PATHS = [
    [34, [[560,404],[588,375],[610,342],[620,302],[608,254],[586,205],[565,174]]],  // praça → Templo (escadaria larga contínua)
    [12, [[360,174],[328,202],[312,238],[296,278]]],                                // Guilda → Dojo
    [13, [[300,304],[330,330],[356,356],[392,382],[432,410]]],                      // Dojo → praça
    [16, [[390,448],[440,436],[488,430]]],                                           // mercado → praça
    [14, [[330,360],[370,350],[420,332],[475,325],[540,326]]],                      // jardim e casas
    [18, [[690,410],[730,390],[776,372]]],                                           // praça → Forja
    [14, [[690,448],[748,468],[800,498],[852,506],[910,510]]],                      // praça → ponte leste
    [13, [[900,510],[930,486],[975,458],[1030,438]]],                               // ponte → Santuário
    [13, [[940,505],[930,540],[944,582]]],                                           // ponte → porto
    [18, [[292,474],[316,510],[340,548],[374,582],[430,602],[505,610],[565,646]]],  // mercado → Banco → Oficina
    [18, [[300,640],[370,620],[455,612],[550,650]]],                                // pátio do Banco → Oficina
    [14, [[860,654],[902,628],[946,602]]],                                           // Oficina → píer
    [16, [[980,610],[1060,616],[1160,620]]]                                          // cais
  ];

  // Lugares com algo para fazer: ponto (no piso), texto do balão, para onde olha, peso do sorteio.
  const SPOTS = [
    { at:[800,370], verb:'Olhando as lâminas', face:1, w:3 }, { at:[180,304], verb:'Treinando', face:-1, w:3 },
    { at:[350,445], verb:'Pechinchando', face:-1, w:2 }, { at:[220,450], verb:'Vendo tecidos', face:1, w:2 },
    { at:[280,455], verb:'Provando chá', face:-1, w:2 }, { at:[205,168], verb:'Lendo contratos', face:-1, w:2 },
    { at:[558,164], verb:'Olhando o portal', face:1, w:2 }, { at:[1080,432], verb:'Rezando', face:1, w:2 },
    { at:[700,670], verb:'Vendo poções', face:1, w:2 }, { at:[1020,620], verb:'Olhando os barcos', face:1, w:1 },
    { at:[850,506], verb:'Vendo a cascata', face:-1, w:1 }, { at:[185,650], verb:'No banco', face:-1, w:1 },
    { at:[450,330], verb:'Descansando', face:1, w:1 }, { at:[560,430], verb:'Conversando', face:1, w:2 },
    { at:[1160,620], verb:'Na Casa de Expedições', face:1, w:1 }, { at:[1040,446], verb:'Sob as cerejeiras', face:-1, w:1 }
  ];
  const LINES = {
    'Olhando as lâminas':['Essa lâmina cantou quando a lua subiu.','A Forja trabalha até o último tambor.'],
    'Treinando':['Mais uma postura. Sem pressa.','O corpo aprende antes da mente.'],
    'Pechinchando':['Duas moedas e um bolinho de lua!','No festival tudo tem história — e preço.'],
    'Vendo tecidos':['Este vermelho protege contra mau-olhado.','As faixas do festival vieram das Ilhas.'],
    'Provando chá':['Chá de pétala. Ainda está quente.','À próxima travessia!'],
    'Lendo contratos':['As rotas mudaram depois da Fenda.','Há trabalho para toda boa equipe.'],
    'Olhando o portal':['Ele pulsa no ritmo dos tambores.','Hoje o Véu parece mais próximo.'],
    'Rezando':['Que cada lanterna encontre seu nome.','Os sinos conhecem quem voltou.'],
    'Vendo poções':['Uma gota para coragem, duas para juízo.','A Oficina não dorme durante o festival.'],
    'Olhando os barcos':['As lanternas chegam antes dos barcos.','A maré está tranquila esta noite.'],
    'Vendo a cascata':['Dizem que a água carrega desejos.','Olhe: as luzes dançam na espuma.'],
    'No banco':['O cofre fecha antes dos fogos.','Festival também exige contas certas.'],
    'Descansando':['Cinco minutos. Talvez dez.','Daqui a música chega mais suave.'],
    'Conversando':['Você viu as lanternas da praça?','Tsukimori nunca esteve tão viva.'],
    'Na Casa de Expedições':['A próxima caravana parte ao amanhecer.','Trouxeram especiarias das nuvens.'],
    'Sob as cerejeiras':['Faça um pedido antes da pétala cair.','As árvores lembram todos os festivais.']
  };
  const DIALOGUES = [
    { people:['Renji','Yori'], lines:[['Renji','O caldo precisa descansar antes da primeira lanterna.'],['Yori','E o dango precisa sumir antes da última. Estamos no horário.'],['Renji','Então abrimos juntos quando os tambores começarem.']] },
    { people:['Aya','Mio'], lines:[['Mio','Pintei luas nas máscaras das crianças. Ficou exagerado?'],['Aya','No Festival das Cerejeiras, exagero é tradição. Só falta uma pétala aqui.'],['Mio','Guarde a primeira xícara de chá; ela combina com a máscara.']] },
    { people:['Koharu','Riku'], lines:[['Riku','Depois do terceiro toque, a praça inteira entra na dança.'],['Koharu','Então segure o ritmo quando os viajantes chegarem pela ponte.'],['Riku','Combinado. Hoje ninguém dança sozinho.']] },
    { people:['Fumi','Hotaru'], lines:[['Fumi','Cada lanterna leva o nome de quem ainda procura o caminho de casa.'],['Hotaru','Por isso acendo primeiro as que ficam diante do Templo.'],['Fumi','E eu conto a história até todas encontrarem o céu.']] }
  ];
  // Moradores: folha (assets/folk). post = trabalha parado; route = anda entre pontos (sempre pelo piso).
  const FOLK = [
    { f:0, name:'Renji', post:[330,445], face:1, verb:'Vendendo lámen', lines:['Lámen da Lua! Uma tigela aquece até a alma.'] },
    { f:1, name:'Maki', post:[828,370], face:-1, verb:'Martelando', lines:['A Forja também celebra — com faíscas!'] },
    { f:2, name:'Suzu', route:[[530,166],[600,166]], speed:12, verb:'Varrendo', lines:['Pétalas bonitas também fazem bagunça.'] },
    { f:3, name:'Hotaru', route:[[1040,446],[900,506],[700,448],[560,430],[420,448],[560,430],[700,448],[900,506]], speed:17, verb:'Acendendo lanternas', lines:['Uma luz para cada viajante que voltou.'] },
    { f:4, name:'Goro', post:[192,450], face:1, verb:'Vendendo peixe', lines:['Peixe da maré da manhã!'] },
    { f:5, name:'Aya', post:[262,447], face:1, verb:'Servindo chá', lines:['Chá de pétalas por conta da casa.'] },
    { f:6, name:'Tomo', route:[[560,402],[660,430],[560,460],[470,430]], speed:34, verb:'Brincando', lines:['Você não me pega!'] },
    { f:7, name:'Jinbei', route:[[850,506],[700,448],[470,440],[700,448]], speed:22, verb:'De ronda', lines:['Ruas livres. Aproveitem o festival.'] },
    { f:8, name:'Natsu', route:[[1020,620],[900,506],[700,448],[400,448],[200,452],[400,448],[700,448],[900,506]], speed:20, verb:'Mercadora', lines:['Sedas das Ilhas! Só hoje!'] },
    { f:9, name:'Daigo', route:[[1160,620],[1040,620],[944,582],[930,520]], speed:17, verb:'Carregando caixas', lines:['Abram caminho — lanternas chegando!'] },
    { f:3, name:'Koharu', post:[530,420], face:1, verb:'Dançando', lines:['Escute! O tambor chama a próxima dança.'] },
    { f:6, name:'Riku', post:[610,438], face:-1, verb:'Tocando tambor', lines:['Um, dois — e a praça inteira responde!'] },
    { f:2, name:'Emi', route:[[420,448],[500,420],[560,438],[680,448]], speed:16, verb:'Entregando talismãs', lines:['Um talismã de sorte para a estrada?'] },
    { f:5, name:'Yori', post:[370,458], face:-1, verb:'Fazendo doces', lines:['Dango lunar! O último é sempre o melhor.'] },
    { f:0, name:'Fumi', post:[1040,446], face:-1, verb:'Contando histórias', lines:['Foi aqui que a primeira lanterna falou.'] },
    { f:4, name:'Kai', route:[[950,610],[1040,615],[1160,620]], speed:13, verb:'Guiando visitantes', lines:['O píer fica iluminado até o amanhecer.'] },
    { f:8, name:'Mio', post:[286,462], face:1, verb:'Pintando máscaras', lines:['Raposa, oni ou lua? Escolha seu rosto.'] },
    { f:9, name:'Bento', route:[[185,650],[300,640],[460,612],[650,670]], speed:14, verb:'Levando oferendas', lines:['Com cuidado. Cada caixa tem um desejo.'] }
  ];

  // ---- grade de navegação (células de 4 px) ----
  const CELL = 4, GW = 1280 / CELL, GH = 720 / CELL;
  const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const segDist = (x, y, [ax, ay], [bx, by]) => { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(x - ax - t * dx, y - ay - t * dy); };
  function walkable(x, y) {
    for (const a of AREAS) {
      if (a.ellipse) { const [cx, cy, rx, ry] = a.ellipse; if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) return true; }
      else if (inPoly(x, y, a.poly)) return true;
    }
    for (const [w, pts] of PATHS) for (let i = 1; i < pts.length; i++) if (segDist(x, y, pts[i - 1], pts[i]) <= w / 2) return true;
    return false;
  }
  let GRID = null, EDGE = null;
  function grid() {
    if (GRID) return GRID;
    GRID = new Uint8Array(GW * GH);
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) GRID[gy * GW + gx] = walkable(gx * CELL + 2, gy * CELL + 2) ? 1 : 0;
    // distância até a borda do piso (em células): a rota prefere o meio da rua.
    EDGE = new Uint8Array(GW * GH); const q = [];
    for (let i = 0; i < GRID.length; i++) if (!GRID[i]) { EDGE[i] = 0; q.push(i); } else EDGE[i] = 255;
    for (let h = 0; h < q.length; h++) { const i = q[h], x = i % GW, y = (i / GW) | 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue; const j = ny * GW + nx; if (EDGE[j] > EDGE[i] + 1) { EDGE[j] = EDGE[i] + 1; q.push(j); } } }
    return GRID;
  }
  const cellOf = (x, y) => [Math.max(0, Math.min(GW - 1, Math.floor(x / CELL))), Math.max(0, Math.min(GH - 1, Math.floor(y / CELL)))];
  // Célula de piso mais próxima (para pontos que caem na borda).
  function snap(x, y) {
    const G = grid(), [cx, cy] = cellOf(x, y); if (G[cy * GW + cx]) return [cx, cy];
    for (let r = 1; r < 30; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const nx = cx + dx, ny = cy + dy; if (nx >= 0 && ny >= 0 && nx < GW && ny < GH && G[ny * GW + nx]) return [nx, ny]; }
    return [cx, cy];
  }
  const isWalk = (x, y) => { const G = grid(), [cx, cy] = cellOf(x, y); return !!G[cy * GW + cx]; };
  const safeWalk = (x, y, r = 3) => isWalk(x, y) && isWalk(x - r, y) && isWalk(x + r, y) && isWalk(x, y - r) && isWalk(x, y + r);
  // A* 8 vizinhos; custo maior colado na borda; a rota final é encurtada por linha de visada (sem atravessar nada).
  function route(ax, ay, bx, by) {
    const G = grid(), [sx, sy] = snap(ax, ay), [tx, ty] = snap(bx, by), S = sy * GW + sx, T = ty * GW + tx;
    const g = new Float32Array(GW * GH).fill(Infinity), from = new Int32Array(GW * GH).fill(-1), open = [S]; g[S] = 0;
    const h = i => Math.hypot(i % GW - tx, ((i / GW) | 0) - ty);
    const f = new Float32Array(GW * GH).fill(Infinity); f[S] = h(S);
    const closed = new Uint8Array(GW * GH); let found = false, guard = 0;
    while (open.length && guard++ < 60000) {
      let bi = 0; for (let k = 1; k < open.length; k++) if (f[open[k]] < f[open[bi]]) bi = k;
      const i = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      if (i === T) { found = true; break; } if (closed[i]) continue; closed[i] = 1;
      const x = i % GW, y = (i / GW) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const j = ny * GW + nx; if (!G[j] || closed[j]) continue;
        if (dx && dy && (!G[y * GW + nx] || !G[ny * GW + x])) continue;          // não corta quina
        const cost = (dx && dy ? 1.414 : 1) * (1 + 2 / Math.min(4, EDGE[j]));
        if (g[i] + cost < g[j]) { g[j] = g[i] + cost; f[j] = g[j] + h(j); from[j] = i; open.push(j); }
      }
    }
    if (!found) return null;
    const cells = []; for (let i = T; i !== -1; i = from[i]) cells.unshift(i);
    const pts = cells.map(i => [(i % GW) * CELL + 2, ((i / GW) | 0) * CELL + 2]);
    const clear = (p, q) => { const n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 2); for (let k = 0; k <= n; k++) { const t = k / n; if (!safeWalk(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)) return false; } return true; };
    const out = [pts[0]]; let k = 0;
    while (k < pts.length - 1) { let m = pts.length - 1; while (m > k + 1 && !clear(pts[k], pts[m])) m--; out.push(pts[m]); k = m; }
    out[out.length - 1] = isWalk(bx, by) ? [bx, by] : out[out.length - 1];
    return out.slice(1);
  }

  const H0 = 40, TOP = 160, BOT = 700;
  const depth = y => .78 + .3 * Math.max(0, Math.min(1, (y - TOP) / (BOT - TOP)));
  const pick = list => { const tot = list.reduce((s, x) => s + x.w, 0); let r = Math.random() * tot; for (const x of list) if ((r -= x.w) < 0) return x; return list[0]; };
  const GAP = 24;   // espaço pessoal (px): ninguém para em cima de ninguém
  const phrase = a => { const list = a.def?.lines || LINES[a.spot?.verb] || LINES[a.verb] || []; return list.length ? list[Math.floor(Math.random() * list.length)] : ''; };

  class TownLife {
    constructor() { this.agents = []; this.key = ''; this.dialogueAt = 2; this.dialogue = 0; this.dialogueLine = 0; }
    sync(heroes) {
      const key = heroes.map(h => h.uid + h.sprite).join('|'); if (key === this.key) return; this.key = key;
      const starts = [[560,430],[800,370],[330,448],[180,304],[205,168],[1080,432]];
      this.agents = heroes.map((h, i) => { const [x, y] = starts[i % starts.length]; return { id:i, kind:'hero', ...h, x:x + i * 6, y, path:[], wait:1 + i * 1.7, face:1, speed:30 + Math.random() * 8, verb:'', walkT:Math.random(), animT:Math.random() * 5, speech:'', speechFor:0 }; })
        .concat(FOLK.map((f, i) => { const [x, y] = f.post || f.route[0]; return { id:heroes.length + i, kind:'folk', f:f.f, def:f, name:f.name, x, y, path:[], wait:Math.random() * 3, face:f.face || 1, speed:f.speed || 0, verb:f.verb, ri:0, walkT:Math.random(), animT:Math.random() * 5, speech:'', speechFor:0 }; }));
    }
    // Lugar livre: o ponto do lugar, deslocado até achar piso sem ninguém a menos de GAP (parado ou chegando).
    freeSpot(a, [x, y]) {
      const taken = this.agents.filter(o => o !== a).map(o => o.goal || [o.x, o.y]);
      for (let k = 0; k < 24; k++) {
        const ang = k * 2.4, r = k ? 8 + k * 3 : 0, p = [x + Math.cos(ang) * r, y + Math.sin(ang) * r * .45];
        if (isWalk(p[0], p[1]) && taken.every(t => Math.hypot(t[0] - p[0], (t[1] - p[1]) * 1.6) > GAP)) return p;
      }
      return null;
    }
    go(a, target) {
      const p = route(a.x, a.y, target[0], target[1]); if (!p || !p.length) { a.wait = 2; a.goal = null; return false; }
      const chokeDefs = [
        ['temple',535,145,645,405], ['westSteps',285,170,405,405], ['bankBridge',285,475,570,660],
        ['eastBridge',730,455,955,535], ['dockSteps',900,500,970,600]
      ];
      const pts = [[a.x,a.y], ...p], crosses = (box) => pts.some(([x,y]) => x >= box[1] && x <= box[3] && y >= box[2] && y <= box[4]);
      const chokes = chokeDefs.filter(crosses).map(x => x[0]);
      if (chokes.some(id => this.agents.some(o => o !== a && o.path.length && o.chokes?.includes(id)))) { a.wait = .8 + Math.random() * .5; a.goal = null; return false; }
      a.path = p; a.goal = target; a.chokes = chokes; return true;
    }
    update(dt) {
      for (const a of this.agents) {
        a.animT += dt; a.speechFor = Math.max(0, (a.speechFor || 0) - dt);
        if (a.path.length) {
          const [tx, ty] = a.path[0], dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
          const step = a.speed * depth(a.y) * dt;
          if (Math.abs(dx) > .5) a.face = dx > 0 ? 1 : -1;
          a.walkT += dt; a.moving = true;
          if (d <= step) { a.x = tx; a.y = ty; a.path.shift(); if (!a.path.length) this.arrive(a); }
          else { const nx = a.x + dx / d * step, ny = a.y + dy / d * step; if (isWalk(nx, ny)) { a.x = nx; a.y = ny; } else { a.path = route(a.x, a.y, tx, ty) || []; a.moving = false; } }
          continue;
        }
        a.moving = false;
        if ((a.wait -= dt) > 0) continue;
        if (a.kind === 'hero') { const s = pick(SPOTS), p = this.freeSpot(a, s.at); if (p) { a.spot = s; a.verb = ''; this.go(a, p); } else a.wait = 1.5; }
        else if (a.def.route) { const r = a.def.route; a.ri = (a.ri + 1) % r.length; const p = this.freeSpot(a, r[a.ri]); if (p) this.go(a, p); else a.wait = 1; }
        else { a.face = Math.random() < .5 ? a.face : -a.face; a.wait = 3 + Math.random() * 5; }
      }
      this.separate();
      this.updateDialogue(dt);
    }
    updateDialogue(dt) {
      if ((this.dialogueAt -= dt) > 0) return;
      this.agents.forEach(a => { a.speech = ''; a.speechFor = 0; });
      for (let tries = 0; tries < DIALOGUES.length; tries++) {
        const d = DIALOGUES[this.dialogue % DIALOGUES.length], people = d.people.map(n => this.agents.find(a => a.name === n));
        if (people.every(a => a && !a.moving)) {
          const [speaker, text] = d.lines[this.dialogueLine % d.lines.length], a = this.agents.find(x => x.name === speaker), other = people.find(x => x !== a);
          a.speech = text; a.speechFor = 4.6; a.face = other.x >= a.x ? 1 : -1; other.face = a.x >= other.x ? 1 : -1;
          this.dialogueLine++; if (this.dialogueLine >= d.lines.length) { this.dialogueLine = 0; this.dialogue++; this.dialogueAt = 4.8; } else this.dialogueAt = 4.3;
          return;
        }
        this.dialogue++; this.dialogueLine = 0;
      }
      this.dialogueAt = 2;
    }
    // Resolve sobreposição inclusive entre dois agentes andando. Empurra cada corpo apenas para células válidas do piso.
    separate() {
      for (let pass = 0; pass < 3; pass++) for (let i = 0; i < this.agents.length; i++) for (let j = i + 1; j < this.agents.length; j++) {
        const a = this.agents[i], b = this.agents[j], dx = b.x - a.x, dy = (b.y - a.y) * 1.55, d = Math.hypot(dx, dy), gap = GAP * Math.min(depth(a.y), depth(b.y));
        if (d >= gap) continue; const nx = d > .01 ? dx / d : ((a.id + b.id) % 2 ? 1 : -1), ny = d > .01 ? dy / d / 1.55 : 0, push = (gap - d) * .52;
        const ax = a.x - nx * push, ay = a.y - ny * push, bx = b.x + nx * push, by = b.y + ny * push;
        if (isWalk(ax, ay)) { a.x = ax; a.y = ay; } if (isWalk(bx, by)) { b.x = bx; b.y = by; }
      }
    }
    arrive(a) {
      if (a.kind === 'hero') { a.face = a.spot?.face || a.face; a.verb = a.spot?.verb || ''; a.wait = 5 + Math.random() * 9; }
      else a.wait = a.def.post ? 4 + Math.random() * 6 : 2 + Math.random() * 4;
      a.chokes = []; a.speech = ''; a.speechFor = 0;
    }
    drawList() { return this.agents.map(a => ({ a, s:depth(a.y), h:H0 * depth(a.y) })).sort((p, q) => p.a.y - q.a.y); }
  }
  KT.TownLife = TownLife;
  KT.TownMap = { AREAS, PATHS, SPOTS, FOLK, walkable, route, isWalk, GW, GH, CELL };
})();
