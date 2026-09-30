// Cidade viva de Tsukimori. Só se anda no chão desenhado (src/town-walk.js, gerado de tools/build_walkmap.py a partir
// do desenho dos caminhos): ruas, escadas e pontes. Rotas célula a célula (A*), espaço pessoal entre todos.
(() => {
  const KT = globalThis.KT = globalThis.KT || {};
  // Pontos de referência (1280×720). Quem anda usa o ponto encaixado no chão; vendedor parado fica ao lado da banca.
  const N = {
    plaza:[560,430], plazaN:[560,408], plazaS:[560,454], plazaW:[515,438], plazaE:[610,438], guardSouth:[560,470],
    marketE:[420,462], marketM:[300,470], marketW:[150,470], marketGuide:[410,430], stallRenji:[350,435], stallYori:[382,432], stallAya:[250,435], stallMio:[300,438], stallGoro:[161,435],
    dojo:[200,312], dojoStairs:[205,380], guild:[200,168], guildSteps:[285,190], garden:[450,300],
    temple:[570,162], templeL:[535,160], templeR:[610,166], templeMid:[610,240],
    forge:[770,372], forgePost:[790,395],
    bridgeW:[800,512], bridgeM:[860,500], eastLand:[935,500], shrine:[1060,410], shrineStory:[1010,470], shrineLantern:[1040,440],
    dockTop:[965,580], dock:[915,605], dockWest:[945,595], dockMid:[1080,630], expedition:[1230,630],
    bankTop:[300,500], bankLanding:[350,590], bank:[190,648],
    workshop:[740,670], workshopGate:[560,640],
    dance:[535,415], drum:[585,415], playMarketW:[320,478], playMarketC:[350,480], playMarketE:[380,478], playB:[630,400]
  };
  const SPOTS = [
    {node:'forge',verb:'Olhando as lâminas',face:1,w:2},{node:'dojo',verb:'Treinando',face:-1,w:2},{node:'marketE',verb:'Pechinchando',face:-1,w:1},{node:'marketM',verb:'Provando chá',face:1,w:1},{node:'marketW',verb:'Vendo tecidos',face:1,w:1},
    {node:'guild',verb:'Lendo contratos',face:-1,w:1},{node:'temple',verb:'Olhando o portal',face:1,w:1},{node:'workshop',verb:'Vendo poções',face:1,w:1},
    {node:'bank',verb:'No banco',face:-1,w:1},{node:'garden',verb:'Descansando',face:1,w:1},{node:'plazaS',verb:'Conversando',face:1,w:1},
    {node:'shrine',verb:'Rezando',face:1,w:1},{node:'bridgeM',verb:'Vendo a cascata',face:-1,w:1},{node:'dockMid',verb:'Olhando os barcos',face:1,w:1}
  ];
  const DIALOGUES = [
    {people:['Renji','Yori'],lines:[['Renji','Guardei caldo para quem voltar depois da dança.'],['Yori','E dango para quem ainda procura um nome nas fitas.'],['Renji','Então deixamos as duas bancas acesas até amanhecer.']]},
    {people:['Aya','Mio'],lines:[['Mio','Esta máscara tem uma pétala diferente das outras.'],['Aya','É a marca de quem se perdeu na última primavera.'],['Mio','Vou pintá-la em todas. Assim ninguém será esquecido.']]},
    {people:['Koharu','Riku'],lines:[['Riku','Três toques para chamar o povo à praça.'],['Koharu','O quarto é para os que ainda não chegaram em casa.'],['Riku','Então não deixarei o tambor se calar.']]},
    {people:['Fumi','Hotaru'],lines:[['Fumi','Kira e Sayo mantêm duas lanternas acesas.'],['Hotaru','Uma pelos que estão aqui; outra pelos ausentes.'],['Fumi','Que as pétalas levem ambos os nomes pela cidade.']]}
  ];
  const FOLK = [
    {f:0,name:'Renji',post:'stallRenji',face:1,verb:'Vendendo lámen'},{f:1,name:'Maki',post:'forgePost',face:-1,verb:'Martelando'},{f:2,name:'Suzu',route:['templeL','templeR'],speed:12,verb:'Varrendo'},
    {f:3,name:'Hotaru',route:['shrine','shrineLantern'],speed:13,verb:'Acendendo lanternas'},
    {f:4,name:'Goro',post:'stallGoro',face:1,verb:'Vendendo peixe'},{f:5,name:'Aya',post:'stallAya',face:1,verb:'Servindo chá'},{f:6,name:'Tomo',route:['playMarketW','playMarketC','playMarketE'],speed:11,verb:'Brincando'},
    {f:7,name:'Jinbei',route:['plazaW','guardSouth','plazaE','guardSouth'],speed:19,verb:'De ronda'},{f:8,name:'Natsu',post:'marketGuide',face:-1,verb:'Mercadora'},
    {f:9,name:'Daigo',route:['expedition','dockMid'],speed:15,verb:'Carregando caixas'},{f:3,name:'Koharu',post:'dance',face:1,verb:'Dançando'},{f:6,name:'Riku',post:'drum',face:-1,verb:'Tocando tambor'},
    {f:2,name:'Emi',post:'playB',face:-1,verb:'Entregando talismãs'},{f:5,name:'Yori',post:'stallYori',face:-1,verb:'Fazendo doces'},{f:0,name:'Fumi',post:'shrineStory',face:-1,verb:'Contando histórias'},
    {f:4,name:'Kai',route:['dock','dockWest'],speed:12,verb:'Guiando visitantes'},{f:8,name:'Mio',post:'stallMio',face:1,verb:'Pintando máscaras'},
    {f:9,name:'Bento',route:['bankLanding','workshopGate','workshop','workshopGate'],speed:13,verb:'Levando oferendas'}
  ];

  // ---- chão ----
  let G = null, GW = 640, GH = 360, CELL = 2, EDGE = null;
  function grid() {
    if (G) return G;
    const W = KT.TownWalk; if (!W) { G = new Uint8Array(GW * GH); EDGE = new Uint8Array(GW * GH); return G; }
    GW = W.w; GH = W.h; CELL = W.cell; G = new Uint8Array(GW * GH);
    W.rows.split(';').forEach((r, y) => { let x = 0, on = false; for (const n of r.split(',').map(Number)) { if (on) G.fill(1, y * GW + x, y * GW + x + n); x += n; on = !on; } });
    EDGE = new Uint8Array(GW * GH); const q = [];                    // distância até a borda: a rota prefere o meio do caminho
    for (let i = 0; i < G.length; i++) { if (G[i]) EDGE[i] = 255; else q.push(i); }
    for (let h = 0; h < q.length; h++) { const i = q[h], x = i % GW, y = (i / GW) | 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue; const j = ny * GW + nx; if (EDGE[j] > EDGE[i] + 1) { EDGE[j] = EDGE[i] + 1; q.push(j); } } }
    return G;
  }
  const cellOf = (x, y) => [Math.max(0, Math.min(GW - 1, Math.floor(x / CELL))), Math.max(0, Math.min(GH - 1, Math.floor(y / CELL)))];
  const isWalk = (x, y) => { grid(); if (x < 0 || y < 0 || x >= GW * CELL || y >= GH * CELL) return false; const [cx, cy] = cellOf(x, y); return !!G[cy * GW + cx]; };
  const onGround = (p, q, blocked) => {
    if (!isWalk(...p) || !isWalk(...q)) return false;
    const dx = q[0] - p[0], dy = q[1] - p[1], sx = Math.sign(dx), sy = Math.sign(dy);
    let [cx, cy] = cellOf(...p); const [ex, ey] = cellOf(...q);
    let tx = sx ? ((sx > 0 ? cx + 1 : cx) * CELL - p[0]) / dx : Infinity;
    let ty = sy ? ((sy > 0 ? cy + 1 : cy) * CELL - p[1]) / dy : Infinity;
    const ix = sx ? CELL / Math.abs(dx) : Infinity, iy = sy ? CELL / Math.abs(dy) : Infinity;
    while (cx !== ex || cy !== ey) {
      if (tx < ty - 1e-10) { cx += sx; tx += ix; }
      else if (ty < tx - 1e-10) { cy += sy; ty += iy; }
      else { if (!G[cy * GW + cx + sx] || !G[(cy + sy) * GW + cx]) return false; cx += sx; cy += sy; tx += ix; ty += iy; }
      if (cx < 0 || cy < 0 || cx >= GW || cy >= GH || !G[cy * GW + cx]) return false;
    }
    if (blocked) { const n = Math.ceil(Math.hypot(dx, dy)); for (let k = 1; k < n; k++) { const t = k / n; if (blocked(p[0] + dx * t, p[1] + dy * t)) return false; } }
    return true;
  };
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
    if (!G[S] || !G[T]) return null;
    if (S === T) return [];
    const blockers = avoid.map(([ox, oy, r]) => ({ ox, oy, r, start:Math.hypot(ax - ox, (ay - oy) * 1.55) }));
    const blockedAt = (x, y) => blockers.some(o => { const d = Math.hypot(x - o.ox, (y - o.oy) * 1.55); return d < o.r && (o.start >= o.r || d < o.start - .1); });
    const blocked = i => blockedAt((i % GW) * CELL + CELL / 2, ((i / GW) | 0) * CELL + CELL / 2);
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
    const clear = (p, q) => onGround(p, q, avoid.length ? blockedAt : null);
    const out = [pts[0]]; let k = 0;
    while (k < pts.length - 1) { let m = Math.min(pts.length - 1, k + 40); while (m > k + 1 && !clear(pts[k], pts[m])) m--; out.push(pts[m]); k = m; }
    // Sai de onde está só se o trecho até o primeiro ponto for todo chão; senão passa pelo centro da célula inicial.
    return clear([ax, ay], out[1] || out[0]) ? out.slice(1) : out;
  }
  const P = {}; const at = n => (P[n] ||= snap(...N[n]));   // ponto encaixado no chão

  const pick = list => { const total = list.reduce((s, x) => s + x.w, 0); let r = Math.random() * total; for (const x of list) if ((r -= x.w) < 0) return x; return list[0]; };
  const depth = y => .78 + .3 * Math.max(0, Math.min(1, (y - 160) / 540));
  const GAP = 16;             // espaço pessoal (px, com o eixo y achatado pela perspectiva)
  const dist = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * 1.55);

  class TownLife {
    constructor() { this.agents = []; this.key = ''; this.dialogueAt = 2; this.dialogue = 0; this.dialogueLine = 0; }
    sync(heroes) {
      const key = heroes.map(h => h.uid + h.sprite).join('|'); if (key === this.key) return; this.key = key;
      const starts = ['plazaN', 'forge', 'marketE', 'dojo', 'garden', 'shrine'];
      this.agents = heroes.map((h, i) => { const [x, y] = at(starts[i % starts.length]); return { id:i, kind:'hero', ...h, x, y, path:[], wait:1.5 + i, face:1, speed:28 + i * 1.5, speedNow:0, verb:'', walkT:Math.random(), walkD:0, animT:Math.random() * 5, speech:'', speechFor:0 }; })
        .concat(FOLK.map((f, i) => { const [x, y] = f.post ? N[f.post] : at(f.route[0]); return { id:heroes.length + i, kind:'folk', f:f.f, def:f, name:f.name, x, y, fixed:!!f.post, path:[], wait:1 + Math.random() * 3, face:f.face || 1, speed:f.speed || 0, speedNow:0, verb:f.verb, ri:0, walkT:Math.random(), walkD:0, animT:Math.random() * 5, speech:'', speechFor:0 }; }));
    }
    // Destino livre: ninguém parado nem chegando a menos de GAP.
    free(a, p) { return this.agents.every(o => o === a || [[o.x, o.y], (a.kind === 'hero' || Math.hypot(o.x - p[0], (o.y - p[1]) * 1.55) < 80) && o.goal].every(q => !q || Math.hypot(q[0] - p[0], (q[1] - p[1]) * 1.55) > GAP + 4)); }
    go(a, p, avoid) {
      const nearby = avoid || this.agents.filter(o => o !== a && dist(a, o) < 100).map(o => [o.x, o.y, GAP + 3]);
      const r = route(a.x, a.y, p[0], p[1], nearby) || route(a.x, a.y, p[0], p[1]);
      if (!r || !r.length) { a.wait = .4 + Math.random() * .5; a.goal = null; return false; }
      a.path = r; a.goal = p; a.tripStart = [a.x, a.y]; a.yielding = false; a.stuck = 0; a.blockedTries = 0; return true;
    }
    giveWay(a) {
      const near = this.agents.filter(o => o !== a).sort((x, y) => dist(a, x) - dist(a, y))[0];
      const direction = near ? Math.atan2(a.y - near.y, a.x - near.x) : Math.random() * Math.PI * 2;
      const avoid = this.agents.filter(o => o !== a && dist(a, o) < 100).map(o => [o.x, o.y, GAP + 3]);
      for (const radius of [28, 44, 60]) for (const turn of [0, -1, 1, -2, 2, 3]) {
        const x = a.x + Math.cos(direction + turn * Math.PI / 3) * radius;
        const y = a.y + Math.sin(direction + turn * Math.PI / 3) * radius;
        const p = snap(x, y);
        if (Math.hypot(p[0] - x, p[1] - y) > 8 || !this.free(a, p)) continue;
        const path = route(a.x, a.y, ...p, avoid);
        if (!path?.length) continue;
        a.path = path; a.goal = p; a.spot = null; a.routeTarget = null; a.yielding = true;
        a.idleFor = 0; a.stuck = 0; a.blockedTries = 0; return true;
      }
      return false;
    }
    update(dt) {
      for (const a of this.agents) {
        a.animT += dt; a.speechFor = Math.max(0, a.speechFor - dt);
        if (!a.fixed && (a.idleFor = (a.idleFor || 0) + dt) > 7 && (a.escapeIn = (a.escapeIn || 0) - dt) <= 0) {
          a.escapeIn = 2; this.giveWay(a);
        }
        if (a.path.length) {
          const [tx, ty] = a.path[0], dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
          if (d < .35) { a.path.shift(); if (!a.path.length) this.arrive(a); a.moving = false; continue; }
          const remaining = Math.hypot(a.goal[0] - a.x, a.goal[1] - a.y);
          const pace = Math.min(a.speed * depth(a.y), Math.max(8, remaining * 2.5));
          a.speedNow = Math.min(pace, (a.speedNow || 0) + 105 * dt);
          const step = Math.min(d, a.speedNow * dt), nx = a.x + dx / d * step, ny = a.y + dy / d * step;
          const blocker = this.agents.find(o => {
            if (o === a) return false;
            const before = dist(a, o), after = Math.hypot(nx - o.x, (ny - o.y) * 1.55);
            return after < GAP && after < before - .01;
          });
          if (!onGround([a.x, a.y], [nx, ny]) || blocker) {
            a.moving = false; a.speedNow = 0; a.stuck = (a.stuck || 0) + dt;
            if (a.stuck > .45 + (a.id % 3) * .12) {
              a.stuck = 0;
              if (blocker && !blocker.fixed && !a.yielding && a.tripStart && (a.kind === 'folk' && blocker.kind === 'hero' || a.id > blocker.id) && Math.hypot(a.x - a.tripStart[0], a.y - a.tripStart[1]) > 5) {
                const back = route(a.x, a.y, ...a.tripStart);
                if (back?.length) { a.path = back; a.goal = a.tripStart; a.routeTarget = null; a.spot = null; a.yielding = true; a.blockedTries = 0; continue; }
              }
              const avoid = this.agents.filter(o => o !== a && dist(a, o) < 100).map(o => [o.x, o.y, GAP + 3]);
              const alternative = ++a.blockedTries < 3 && route(a.x, a.y, a.goal[0], a.goal[1], avoid);
              if (alternative?.length) a.path = alternative;
              else { a.path = []; a.goal = null; a.wait = .3 + Math.random() * .4; a.blockedTries = 0; }
            }
            continue;
          }
          a.stuck = 0; a.blockedTries = 0;
          if (Math.abs(dx) > .4) a.face = dx > 0 ? 1 : -1;
          a.x = nx; a.y = ny; a.walkT += dt; a.walkD += step; a.moving = step > .01; a.idleFor = 0;
          if (d <= step + .001) { a.path.shift(); if (!a.path.length) this.arrive(a); }
          continue;
        }
        a.moving = false; a.speedNow = 0;
        if ((a.wait -= dt) > 0) continue;
        if (a.kind === 'hero') {
          const choices = SPOTS.filter(s => this.free(a, at(s.node))), s = choices.length ? pick(choices) : null;
          if (s) { a.spot = s; a.verb = ''; this.go(a, at(s.node)); } else a.wait = 1.5;
        } else if (a.def.route) {
          const next = (a.ri + 1) % a.def.route.length, p = at(a.def.route[next]);
          if (this.free(a, p) && this.go(a, p)) a.routeTarget = next;
          else { const back = (a.ri - 1 + a.def.route.length) % a.def.route.length, retreat = at(a.def.route[back]);
            if (a.def.route.length > 2 && Math.hypot(a.x - retreat[0], a.y - retreat[1]) > 25 && this.free(a, retreat) && this.go(a, retreat)) a.routeTarget = back;
            else a.wait = .6 + Math.random() * .5; }
        } else { a.face = Math.random() < .35 ? -a.face : a.face; a.wait = 3 + Math.random() * 4; }
      }
      this.updateDialogue(dt);
    }
    updateDialogue(dt) {
      if ((this.dialogueAt -= dt) > 0) return; this.agents.forEach(a => { a.speech = ''; a.speechFor = 0; });
      for (let tries = 0; tries < DIALOGUES.length; tries++) {
        const d = DIALOGUES[this.dialogue % DIALOGUES.length], people = d.people.map(n => this.agents.find(a => a.name === n));
        if (people.every(a => a && !a.moving) && dist(people[0], people[1]) < 72) {
          const [speaker, text] = d.lines[this.dialogueLine % d.lines.length], a = this.agents.find(x => x.name === speaker), other = people.find(x => x !== a);
          a.speech = text; a.speechFor = 4.3; a.face = other.x >= a.x ? 1 : -1; other.face = a.x >= other.x ? 1 : -1; this.dialogueLine++;
          if (this.dialogueLine >= d.lines.length) { this.dialogueLine = 0; this.dialogue++; this.dialogueAt = 5; } else this.dialogueAt = 4.5; return;
        }
        this.dialogue++; this.dialogueLine = 0;
      }
      this.dialogueAt = 2;
    }
    arrive(a) { a.goal = null; a.speedNow = 0; const yielded = a.yielding; a.yielding = false; if (a.kind === 'hero') { a.face = a.spot?.face || a.face; a.verb = a.spot?.verb || ''; a.wait = yielded ? .6 : 2.5 + Math.random() * 4; } else { if (a.routeTarget != null) a.ri = a.routeTarget; a.routeTarget = null; a.wait = yielded ? .6 : 1 + Math.random() * 2; } }
    drawList() { return this.agents.map(a => ({ a, s:depth(a.y), h:40 * depth(a.y) })).sort((p, q) => p.a.y - q.a.y); }
  }
  KT.TownLife = TownLife;
  KT.TownMap = { NODES:N, SPOTS, FOLK, route, isWalk, snap, at };
})();
