// Cidade viva de Tsukimori. Só se anda no chão desenhado (src/town-walk.js, gerado de tools/build_walkmap.py a partir
// do desenho dos caminhos): ruas, escadas e pontes. Rotas célula a célula (A*), espaço pessoal entre todos.
(() => {
  const KT = globalThis.KT = globalThis.KT || {};
  // Pontos de referência (1280×720). Quem anda usa o ponto encaixado no chão; vendedor parado fica ao lado da banca.
  const N = {
    plaza:[560,430], plazaN:[560,408], plazaS:[560,454], plazaW:[515,438], plazaE:[610,438],
    marketE:[420,462], marketM:[300,470], marketW:[150,470], marketGuide:[410,430], stallRenji:[350,435], stallYori:[382,432], stallAya:[250,435], stallMio:[300,438], stallGoro:[190,435],
    dojo:[200,312], dojoStairs:[205,380], guild:[200,168], guildSteps:[285,190], garden:[450,300],
    temple:[570,162], templeL:[535,160], templeR:[610,166], templeMid:[610,240],
    forge:[770,372], forgePost:[790,395],
    bridgeW:[800,512], bridgeM:[860,500], eastLand:[935,500], shrine:[1060,410], shrineStory:[1010,470], shrineLantern:[1040,440],
    dockTop:[965,580], dock:[915,605], dockMid:[1080,630], expedition:[1230,630],
    bankTop:[300,500], bankLanding:[350,590], bank:[190,648],
    workshop:[740,670], workshopGate:[560,640],
    dance:[500,405], drum:[615,460], playA:[540,390], playB:[640,425], playC:[585,458], playD:[500,440]
  };
  const SPOTS = [
    {node:'forge',verb:'Olhando as lâminas',face:1,w:2},{node:'dojo',verb:'Treinando',face:-1,w:2},{node:'marketE',verb:'Pechinchando',face:-1,w:1},{node:'marketM',verb:'Provando chá',face:1,w:1},{node:'marketW',verb:'Vendo tecidos',face:1,w:1},
    {node:'guild',verb:'Lendo contratos',face:-1,w:1},{node:'temple',verb:'Olhando o portal',face:1,w:1},{node:'workshop',verb:'Vendo poções',face:1,w:1},
    {node:'bank',verb:'No banco',face:-1,w:1},{node:'garden',verb:'Descansando',face:1,w:1},{node:'plazaS',verb:'Conversando',face:1,w:1},
    {node:'shrine',verb:'Rezando',face:1,w:1},{node:'bridgeM',verb:'Vendo a cascata',face:-1,w:1},{node:'dockMid',verb:'Olhando os barcos',face:1,w:1}
  ];
  const DIALOGUES = [
    {people:['Renji','Yori'],lines:[['Renji','O caldo descansa até a primeira lanterna.'],['Yori','E o dango desaparece antes da última. Estamos no horário.'],['Renji','Então abrimos juntos quando os tambores começarem.']]},
    {people:['Aya','Mio'],lines:[['Mio','Pintei luas nas máscaras das crianças. Ficou exagerado?'],['Aya','No Festival das Cerejeiras, exagero é tradição. Falta só uma pétala.'],['Mio','Guarde a primeira xícara de chá; ela combina com a máscara.']]},
    {people:['Koharu','Riku'],lines:[['Riku','Depois do terceiro toque, a praça entra na dança.'],['Koharu','Segure o ritmo quando os viajantes chegarem pela ponte.'],['Riku','Combinado. Hoje ninguém dança sozinho.']]},
    {people:['Fumi','Hotaru'],lines:[['Fumi','Cada lanterna leva o nome de quem procura o caminho de casa.'],['Hotaru','Por isso acendo primeiro as que ficam diante do Templo.'],['Fumi','E eu conto a história até todas encontrarem o céu.']]}
  ];
  const FOLK = [
    {f:0,name:'Renji',post:'stallRenji',face:1,verb:'Vendendo lámen'},{f:1,name:'Maki',post:'forgePost',face:-1,verb:'Martelando'},{f:2,name:'Suzu',route:['templeL','templeR'],speed:12,verb:'Varrendo'},
    {f:3,name:'Hotaru',route:['shrine','shrineLantern'],speed:13,verb:'Acendendo lanternas'},
    {f:4,name:'Goro',post:'stallGoro',face:1,verb:'Vendendo peixe'},{f:5,name:'Aya',post:'stallAya',face:1,verb:'Servindo chá'},{f:6,name:'Tomo',post:'playA',face:1,verb:'Brincando'},
    {f:7,name:'Jinbei',route:['plazaW','plazaE'],speed:19,verb:'De ronda'},{f:8,name:'Natsu',post:'marketGuide',face:-1,verb:'Mercadora'},
    {f:9,name:'Daigo',route:['expedition','dockTop'],speed:15,verb:'Carregando caixas'},{f:3,name:'Koharu',post:'dance',face:1,verb:'Dançando'},{f:6,name:'Riku',post:'drum',face:-1,verb:'Tocando tambor'},
    {f:2,name:'Emi',post:'playD',face:-1,verb:'Entregando talismãs'},{f:5,name:'Yori',post:'stallYori',face:-1,verb:'Fazendo doces'},{f:0,name:'Fumi',post:'shrineStory',face:-1,verb:'Contando histórias'},
    {f:4,name:'Kai',route:['dock','dockMid'],speed:12,verb:'Guiando visitantes'},{f:8,name:'Mio',post:'stallMio',face:1,verb:'Pintando máscaras'},
    {f:9,name:'Bento',route:['bankLanding','workshopGate','workshop','workshopGate'],speed:13,verb:'Levando oferendas'}
  ];

  // ---- chão ----
  let G = null, GW = 640, GH = 360, CELL = 2, EDGE = null;
  function grid() {
    if (G) return G;
    const W = KT.TownWalk; if (!W) { G = new Uint8Array(GW * GH).fill(1); EDGE = new Uint8Array(GW * GH).fill(255); return G; }
    GW = W.w; GH = W.h; CELL = W.cell; G = new Uint8Array(GW * GH);
    W.rows.split(';').forEach((r, y) => { let x = 0, on = false; for (const n of r.split(',').map(Number)) { if (on) G.fill(1, y * GW + x, y * GW + x + n); x += n; on = !on; } });
    EDGE = new Uint8Array(GW * GH); const q = [];                    // distância até a borda: a rota prefere o meio do caminho
    for (let i = 0; i < G.length; i++) { if (G[i]) EDGE[i] = 255; else q.push(i); }
    for (let h = 0; h < q.length; h++) { const i = q[h], x = i % GW, y = (i / GW) | 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue; const j = ny * GW + nx; if (EDGE[j] > EDGE[i] + 1) { EDGE[j] = EDGE[i] + 1; q.push(j); } } }
    return G;
  }
  const cellOf = (x, y) => [Math.max(0, Math.min(GW - 1, Math.floor(x / CELL))), Math.max(0, Math.min(GH - 1, Math.floor(y / CELL)))];
  const isWalk = (x, y) => { grid(); const [cx, cy] = cellOf(x, y); return !!G[cy * GW + cx]; };
  function snap(x, y) {
    grid(); const [cx, cy] = cellOf(x, y); if (G[cy * GW + cx]) return [cx * CELL + CELL / 2, cy * CELL + CELL / 2];
    for (let r = 1; r < 60; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const nx = cx + dx, ny = cy + dy;
      if (nx >= 0 && ny >= 0 && nx < GW && ny < GH && G[ny * GW + nx]) return [nx * CELL + CELL / 2, ny * CELL + CELL / 2];
    }
    return [x, y];
  }
  // A* com fila de prioridade; `avoid` = discos [x, y, r] que não podem ser pisados (gente parada no caminho).
  function route(ax, ay, bx, by, avoid = []) {
    grid(); const [sx, sy] = cellOf(...snap(ax, ay)), [tx, ty] = cellOf(...snap(bx, by)), S = sy * GW + sx, T = ty * GW + tx;
    if (S === T) return [];
    const blocked = i => { const x = (i % GW) * CELL, y = ((i / GW) | 0) * CELL; return avoid.some(([ox, oy, r]) => Math.hypot(x - ox, (y - oy) * 1.5) < r); };
    const g = new Float32Array(GW * GH).fill(Infinity), from = new Int32Array(GW * GH).fill(-1), done = new Uint8Array(GW * GH);
    const heap = [], push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    g[S] = 0; push(S, 0); let found = false;
    while (heap.length) {
      const [, i] = pop(); if (done[i]) continue; done[i] = 1; if (i === T) { found = true; break; }
      const x = i % GW, y = (i / GW) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const j = ny * GW + nx; if (!G[j] || done[j] || (dx && dy && (!G[y * GW + nx] || !G[ny * GW + x]))) continue;
        if (avoid.length && j !== T && blocked(j)) continue;
        const c = g[i] + (dx && dy ? 1.414 : 1) * (1 + 2.5 / Math.min(5, EDGE[j]));
        if (c < g[j]) { g[j] = c; from[j] = i; push(j, c + Math.hypot(nx - tx, ny - ty)); }
      }
    }
    if (!found) return null;
    const cells = []; for (let i = T; i !== -1; i = from[i]) cells.unshift(i);
    const pts = cells.map(i => [(i % GW) * CELL + CELL / 2, ((i / GW) | 0) * CELL + CELL / 2]);
    // Encurta por linha de visada, só se o trecho reto também estiver todo no chão.
    const clear = (p, q) => { const n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1])); for (let k = 0; k <= n; k++) { const t = n ? k / n : 0; if (!isWalk(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)) return false; } return true; };
    const out = [pts[0]]; let k = 0;
    while (k < pts.length - 1) { let m = Math.min(pts.length - 1, k + 40); while (m > k + 1 && !clear(pts[k], pts[m])) m--; out.push(pts[m]); k = m; }
    // Sai de onde está só se o trecho até o primeiro ponto for todo chão; senão passa pelo centro da célula inicial.
    return clear([ax, ay], out[1] || out[0]) ? out.slice(1) : out;
  }
  const P = {}; const at = n => (P[n] ||= snap(...N[n]));   // ponto encaixado no chão

  const pick = list => { const total = list.reduce((s, x) => s + x.w, 0); let r = Math.random() * total; for (const x of list) if ((r -= x.w) < 0) return x; return list[0]; };
  const depth = y => .78 + .3 * Math.max(0, Math.min(1, (y - 160) / 540));
  const GAP = 20;             // espaço pessoal (px, com o eixo y achatado pela perspectiva)
  const dist = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * 1.55);

  class TownLife {
    constructor() { this.agents = []; this.key = ''; this.dialogueAt = 2; this.dialogue = 0; this.dialogueLine = 0; }
    sync(heroes) {
      const key = heroes.map(h => h.uid + h.sprite).join('|'); if (key === this.key) return; this.key = key;
      const starts = ['plazaN', 'forge', 'marketE', 'dojo', 'garden', 'shrine'];
      this.agents = heroes.map((h, i) => { const [x, y] = at(starts[i % starts.length]); return { id:i, kind:'hero', ...h, x, y, path:[], wait:3 + i * 2.5, face:1, speed:28 + i * 1.5, verb:'', walkT:Math.random(), animT:Math.random() * 5, speech:'', speechFor:0 }; })
        .concat(FOLK.map((f, i) => { const [x, y] = f.post ? N[f.post] : at(f.route[0]); return { id:heroes.length + i, kind:'folk', f:f.f, def:f, name:f.name, x, y, fixed:!!f.post, path:[], wait:2 + Math.random() * 6, face:f.face || 1, speed:f.speed || 0, verb:f.verb, ri:0, walkT:Math.random(), animT:Math.random() * 5, speech:'', speechFor:0 }; }));
    }
    // Destino livre: ninguém parado nem chegando a menos de GAP.
    free(a, p) { return this.agents.every(o => o === a || Math.hypot((o.goal || [o.x, o.y])[0] - p[0], ((o.goal || [o.x, o.y])[1] - p[1]) * 1.55) > GAP + 4); }
    go(a, p, avoid) {
      const r = route(a.x, a.y, p[0], p[1], avoid); if (!r || !r.length) { a.wait = 1 + Math.random(); a.goal = null; return false; }
      a.path = r; a.goal = p; a.stuck = 0; return true;
    }
    update(dt) {
      for (const a of this.agents) {
        a.animT += dt; a.speechFor = Math.max(0, a.speechFor - dt);
        if (a.path.length) {
          const [tx, ty] = a.path[0], dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
          // Alguém logo à frente: espera; se não abrir, procura outra rota contornando ou desiste do destino.
          const ahead = this.agents.find(o => o !== a && dist(a, o) < GAP + 2 && ((o.x - a.x) * dx + (o.y - a.y) * dy) > 0);
          if (ahead) {
            a.moving = false; a.stuck = (a.stuck || 0) + dt;
            if (a.stuck > .9 + (a.id % 4) * .25) {
              const avoid = this.agents.filter(o => o !== a && dist(a, o) < 80).map(o => [o.x, o.y, 14]);
              if (!this.go(a, a.goal, avoid)) { a.path = []; a.goal = null; a.wait = .6 + Math.random(); }
            }
            continue;
          }
          a.stuck = 0; const step = a.speed * depth(a.y) * dt;
          if (Math.abs(dx) > .4) a.face = dx > 0 ? 1 : -1;
          a.walkT += dt; a.moving = true;
          if (d <= step) { a.x = tx; a.y = ty; a.path.shift(); if (!a.path.length) this.arrive(a); }
          else {
            // Passo só dentro do chão; se a diagonal escapar, desliza só no eixo que continua no chão.
            const nx = a.x + dx / d * step, ny = a.y + dy / d * step;
            if (isWalk(nx, ny)) { a.x = nx; a.y = ny; } else if (isWalk(nx, a.y)) a.x = nx; else if (isWalk(a.x, ny)) a.y = ny; else { a.x = tx; a.y = ty; }
          }
          continue;
        }
        a.moving = false;
        if ((a.wait -= dt) > 0) continue;
        if (a.kind === 'hero') {
          const choices = SPOTS.filter(s => this.free(a, at(s.node))), s = choices.length ? pick(choices) : null;
          if (s) { a.spot = s; a.verb = ''; this.go(a, at(s.node)); } else a.wait = 1.5;
        } else if (a.def.route) {
          a.ri = (a.ri + 1) % a.def.route.length; const p = at(a.def.route[a.ri]);
          if (this.free(a, p)) this.go(a, p); else a.wait = 1.5;
        } else { a.face = Math.random() < .35 ? -a.face : a.face; a.wait = 4 + Math.random() * 6; }
      }
      this.updateDialogue(dt);
    }
    updateDialogue(dt) {
      if ((this.dialogueAt -= dt) > 0) return; this.agents.forEach(a => { a.speech = ''; a.speechFor = 0; });
      for (let tries = 0; tries < DIALOGUES.length; tries++) {
        const d = DIALOGUES[this.dialogue % DIALOGUES.length], people = d.people.map(n => this.agents.find(a => a.name === n));
        if (people.every(a => a && !a.moving)) {
          const [speaker, text] = d.lines[this.dialogueLine % d.lines.length], a = this.agents.find(x => x.name === speaker), other = people.find(x => x !== a);
          a.speech = text; a.speechFor = 4.3; a.face = other.x >= a.x ? 1 : -1; other.face = a.x >= other.x ? 1 : -1; this.dialogueLine++;
          if (this.dialogueLine >= d.lines.length) { this.dialogueLine = 0; this.dialogue++; this.dialogueAt = 5; } else this.dialogueAt = 4.5; return;
        }
        this.dialogue++; this.dialogueLine = 0;
      }
      this.dialogueAt = 2;
    }
    arrive(a) { a.goal = null; if (a.kind === 'hero') { a.face = a.spot?.face || a.face; a.verb = a.spot?.verb || ''; a.wait = 7 + Math.random() * 10; } else a.wait = 2 + Math.random() * 5; }
    drawList() { return this.agents.map(a => ({ a, s:depth(a.y), h:40 * depth(a.y) })).sort((p, q) => p.a.y - q.a.y); }
  }
  KT.TownLife = TownLife;
  KT.TownMap = { NODES:N, SPOTS, FOLK, route, isWalk, snap, at };
})();
