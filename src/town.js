// Cidade viva de Tsukimori. Só se anda no chão desenhado (src/town-walk.js, gerado de tools/build_walkmap.py a partir
// do desenho dos caminhos): ruas, escadas e pontes. Rotas célula a célula (A*), espaço pessoal entre todos.
(() => {
  const KT = globalThis.KT = globalThis.KT || {};
  // Pontos de referência (1280×720). Quem anda usa o ponto encaixado no chão; vendedor parado fica ao lado da banca.
  const N = {
    plaza:[560,430], plazaN:[560,408], plazaS:[560,454], plazaW:[515,438], plazaE:[610,438], guardSouth:[560,470],
    marketE:[420,462], marketM:[300,470], marketW:[150,470], marketGuide:[410,451], stallRenji:[338,469], stallYori:[379,474], stallAya:[255,469], stallMio:[303,474], stallGoro:[166,451],
    dojo:[200,312], dojoStairs:[205,380], guild:[200,168], guildSteps:[285,190], garden:[450,300],
    temple:[570,162], templeL:[535,160], templeR:[610,166], templeMid:[610,240],
    forge:[770,372], forgePost:[790,395],
    bridgeW:[815,513], bridgeM:[860,506], eastLand:[935,500], shrine:[1060,410], shrineStory:[1010,470], shrineLantern:[1040,440],
    dockTop:[965,580], dock:[970,600], dockWest:[998,604], dockMid:[1080,630], expedition:[1230,630],
    bankTop:[300,500], bankLanding:[350,590], bank:[190,648],
    workshop:[740,670], workshopGate:[560,640],
    dance:[535,415], drum:[585,415], playMarketW:[320,478], playMarketC:[350,480], playMarketE:[380,478], playB:[630,400],
    danceA:[606,442], danceB:[636,438], danceC:[666,438], teaA:[677,682], teaB:[710,683], guildTea:[139,178], bankTea:[220,660],
    guildGuest:[315,170], bankGuest:[251,650], dockGuest:[1173,640], plazaGuest:[670,419], marketGuest:[213,456], templeGuest:[604,176], gardenGuest:[475,328], shrineGuest:[1018,479], workshopGuest:[744,698]
  };
  const SPOTS = [
    {node:'forge',verb:'Olhando as lâminas',face:1,w:2},{node:'dojo',verb:'Treinando',face:-1,w:2},{node:'marketE',verb:'Pechinchando',face:-1,w:1},{node:'marketM',verb:'Provando chá',face:1,w:1},{node:'marketW',verb:'Vendo tecidos',face:1,w:1},
    {node:'guild',verb:'Lendo contratos',face:-1,w:1},{node:'temple',verb:'Olhando o portal',face:1,w:1},{node:'workshop',verb:'Vendo poções',face:1,w:1},
    {node:'bank',verb:'No banco',face:-1,w:1},{node:'garden',verb:'Descansando',face:1,w:1},{node:'plazaS',verb:'Conversando',face:1,w:1},
    {node:'shrine',verb:'Rezando',face:1,w:1},{node:'bridgeM',verb:'Vendo a cascata',face:-1,w:1},{node:'dockMid',verb:'Olhando os barcos',face:1,w:1}
  ];
  const DIALOGUES = [
    {people:['Renji','Yori'],lines:[['Renji','O caldo está pronto. Guardou dango para a dança?'],['Yori','Guardei dois. O terceiro você provou três vezes!'],['Renji','Controle de qualidade. Hoje a praça merece o melhor.']]},
    {people:['Aya','Mio'],lines:[['Mio','Esta máscara tem uma pétala diferente das outras.'],['Aya','É a marca de quem se perdeu na última primavera.'],['Mio','Vou pintá-la em todas. Assim ninguém será esquecido.']]},
    {people:['Koharu','Riku'],lines:[['Riku','Três toques para chamar o povo à praça.'],['Koharu','O quarto é para os que ainda não chegaram em casa.'],['Riku','Então não deixarei o tambor se calar.']]},
    {people:['Fumi','Hotaru'],lines:[['Fumi','Kira e Sayo mantêm duas lanternas acesas.'],['Hotaru','Uma pelos que estão aqui; outra pelos ausentes.'],['Fumi','Que as pétalas levem ambos os nomes pela cidade.']]},
    {people:['Hina','Chiyo'],lines:[['Hina','Minha avó dançava esta volta antes de existir a Fenda.'],['Chiyo','Então me ensine sem pular o passo das lanternas.'],['Hina','Duas palmas, uma volta. E deixamos o centro livre para quem chega.']]},
    {people:['Nao','Setsu'],lines:[['Nao','O chá ganhou uma pétala. Posso bebê-lo assim?'],['Setsu','Pode. Nesta noite dizemos que é um convite da primavera.'],['Nao','Vou guardar outra xícara para quem voltar da expedição.']]},
    {people:['Natsu','Yori'],lines:[['Natsu','As fitas de desejos acabaram antes dos doces!'],['Yori','Tem mais no cesto. O rosa é para os reencontros.'],['Natsu','Vou guardar uma para cada viajante que voltar.']]},
    {people:['Emi','Riku'],lines:[['Emi','Já prendeu seu desejo no corrimão?'],['Riku','Sim: que toda primavera tenha esta roda de novo.'],['Emi','Vou prendê-lo junto ao meu. Que esta noite nunca seja esquecida.']]}
  ];
  const FOLK = [
    {f:0,name:'Renji',post:'stallRenji',face:1,verb:'Vendendo lámen',festival:'ribbon'},{f:1,name:'Maki',post:'forgePost',face:-1,verb:'Martelando',festival:'ribbon'},{f:2,name:'Suzu',route:['templeL','templeR'],speed:12,verb:'Varrendo'},
    {f:3,name:'Hotaru',route:['shrine','shrineLantern'],speed:13,verb:'Acendendo lanternas',festival:'lantern'},
    {f:4,name:'Goro',post:'stallGoro',face:1,verb:'Vendendo peixe'},{f:5,name:'Aya',post:'stallAya',face:1,verb:'Servindo chá'},{f:6,name:'Tomo',route:['playMarketW','playMarketC','playMarketE'],speed:11,verb:'Brincando'},
    {f:7,name:'Jinbei',route:['plazaW','guardSouth','plazaE','guardSouth'],speed:19,verb:'De ronda'},{f:8,name:'Natsu',post:'marketGuide',face:-1,verb:'Mercadora'},
    {f:9,name:'Daigo',route:['expedition','dockMid'],speed:15,verb:'Carregando caixas'},{f:3,name:'Koharu',post:'dance',face:1,verb:'Dançando'},{f:6,name:'Riku',post:'drum',face:-1,verb:'Tocando tambor'},
    {f:2,name:'Emi',post:'playB',face:-1,verb:'Entregando talismãs',festival:'ribbon'},{f:5,name:'Yori',post:'stallYori',face:-1,verb:'Fazendo doces',festival:'ribbon'},{f:0,name:'Fumi',post:'shrineStory',face:-1,verb:'Contando histórias'},
    {f:4,name:'Kai',route:['dock','dockWest'],speed:12,verb:'Guiando visitantes'},{f:8,name:'Mio',post:'stallMio',face:1,verb:'Pintando máscaras'},
    {f:9,name:'Bento',route:['bankLanding','workshopGate','workshop','workshopGate'],speed:13,verb:'Levando oferendas'},
    {f:3,name:'Hina',post:'danceA',face:-1,verb:'Dançando a roda das pétalas',festival:'fan'},
    {f:5,name:'Chiyo',post:'danceB',face:-1,verb:'Aprendendo a dança',festival:'fan'},
    {f:2,name:'Yume',post:'danceC',face:-1,verb:'Cantando com a roda',festival:'fan'},
    {f:8,name:'Nao',post:'teaA',face:1,verb:'Provando chá de primavera',festival:'ribbon'},
    {f:0,name:'Setsu',post:'teaB',face:-1,verb:'Servindo os viajantes',festival:'ribbon'},
    {f:4,name:'Takeshi',post:'guildTea',face:1,verb:'Recebendo os visitantes',festival:'lantern'},
    {f:5,name:'Sumire',post:'bankTea',face:1,verb:'Distribuindo fitas de desejos',festival:'ribbon'},
    {f:7,name:'Isamu',route:['guildGuest','guild','guildSteps'],speed:16,verb:'Convidando para a roda',festival:'lantern'},
    {f:3,name:'Aoi',route:['bankGuest','bank','bankLanding'],speed:15,verb:'Visitando o festival',festival:'fan'},
    {f:4,name:'Minato',route:['dockGuest','dockMid','expedition'],speed:16,verb:'Recebendo os barcos',festival:'lantern'},
    {f:6,name:'Saki',route:['plazaGuest','plazaN','plazaE'],speed:16,verb:'Levando fitas à praça',festival:'ribbon'},
    {f:8,name:'Kenta',route:['marketGuest','marketW','marketE'],speed:15,verb:'Conhecendo as barracas',festival:'ribbon'},
    {f:2,name:'Rei',route:['templeGuest','templeL','templeR'],speed:14,verb:'Cuidando das lanternas',festival:'lantern'},
    {f:5,name:'Mari',route:['gardenGuest','garden','plazaN'],speed:15,verb:'Levando flores',festival:'fan'},
    {f:0,name:'Shun',route:['shrineGuest','shrine','shrineStory'],speed:14,verb:'Levando nomes ao santuário',festival:'lantern'},
    {f:9,name:'Gen',route:['workshopGuest','workshop','workshopGate'],speed:16,verb:'Entregando chá e doces',festival:'ribbon'}
  ];
  const GREETINGS = {
    Renji:['O caldo é da receita da minha mãe. Na primavera em que ela sumiu, prometi nunca fechar a banca antes da última lanterna.','Yori guarda os doces; eu guardo o fogo. Se alguém regressar da Fenda esta noite, terá uma mesa.'],
    Yori:['Cada dango tem três cores: a neve que passou, a flor de hoje e a folha que ainda virá.','Renji diz que faço doces demais. Mas sempre há um viajante chegando quando a praça já se esvaziou.'],
    Aya:['Escolha uma máscara, mas deixe seus olhos à vista. O festival celebra encontros, não disfarces.','Mio pintou uma pétala diferente em cada máscara. É como lembramos quem não voltou.'],
    Mio:['Esta máscara é para minha irmã. Se ela voltar do Bosque, quero que reconheça a banca de longe.','Aya me ensinou a misturar o rosa. Antes disso, minhas cerejeiras pareciam incêndios.'],
    Maki:['A lâmina deve cantar baixo quando sai da pedra. Se gritar, há uma fissura: não confie nela contra o Eclipse.','Hoje a forja aquece os sinos da praça. Amanhã voltaremos a cuidar das armas.'],
    Suzu:['Suba pela escadaria até o portal. As pétalas escondem os degraus; não há atalho pelos jardins.','Varro para que os recém-chegados vejam o círculo inteiro. Um portal incompleto é uma promessa perigosa.'],
    Hotaru:['Uma lanterna pelos presentes, outra pelos ausentes. Fumi conhece os nomes que não cabem nas fitas.','O vento leva as pétalas para o mar. Não apagamos as luzes até que a última atravesse a ponte.'],
    Goro:['O peixe veio antes da maré mudar. Desde que Mizuchi despertou, só navego quando os sinos estão quietos.','Kai conhece o cais melhor que eu. Pergunte a ele como o rio ganhou tantas lanternas.'],
    Tomo:['Riku prometeu deixar eu tocar o quarto toque! É o que chama todo mundo para casa.','Não corro nas escadas. Jinbei disse que o festival também precisa de joelhos inteiros.'],
    Jinbei:['A ponte é estreita: dê passagem a quem já começou a travessia. Não perdemos ninguém numa noite de festa.','Minha ronda acaba no cais. Daigo deixa as caixas longe dos degraus, e eu confiro as lanternas.'],
    Natsu:['Há chá para os viajantes na rua das barracas. Não suba nos balcões: Aya acabou de arrumar tudo.','Mercadoria tem preço; uma história boa ganha chá de graça. O que você viu além do Bosque?'],
    Daigo:['Estas caixas são oferendas, não espólio. Uma vai ao santuário, outra para as famílias dos expedicionários.','A Casa de Expedições recebe novos grupos no nível 8 da conta. Até lá, aprenda a voltar inteiro.'],
    Koharu:['A dança segue o vento, não o tambor. Riku ainda tenta entender isso.','O último passo fica virado para o portal. Assim os que chegam nunca encontram nossas costas.'],
    Riku:['Três toques para reunir a praça; o quarto para chamar os que ainda estão longe.','Koharu diz que toco depressa quando fico nervoso. Hoje quero acertar cada volta da dança.'],
    Emi:['Prenda a fita no pulso, não na arma. O nome que você carrega deve voltar com você.','Este talismã não promete vitória. Promete que alguém em Tsukimori estará esperando.'],
    Fumi:['Antes da Fenda, o festival durava uma só noite. Agora mantemos duas lanternas, para que a esperança não durma.','Kira e Sayo guardam nomes nas fitas. A cidade sobrevive porque ninguém deixa o outro ser esquecido.'],
    Kai:['O cais fica abaixo do santuário: siga a rua e desça a escada. A água não é um caminho.','Hoje nenhum barco sai sem uma lanterna na proa. Mizuchi pode guardar o mar; os nomes continuam nossos.'],
    Bento:['Kogane contou cada oferenda antes de eu partir. Dinheiro não consola, mas mantém uma casa de pé.','Contorno a praça para chegar à oficina. A cascata engana os visitantes: não existe ponte por cima dela.'],
    Hina:['Duas palmas, uma volta, o leque voltado para a lua. Minha avó dizia que assim a primavera encontra o caminho de casa.'],
    Chiyo:['Errei o passo três vezes, e Hina só riu. Hoje ninguém precisa dançar sozinho.'],
    Yume:['Cantamos os nomes dos viajantes entre uma volta e outra. Você quer que eu acrescente o seu?'],
    Nao:['O chá da oficina é de flor de cerejeira. Setsu promete uma segunda xícara para quem trouxer uma história.'],
    Setsu:['Não vendo este chá. Os aprendizes o prepararam para agradecer a quem mantém os caminhos seguros.'],
    Takeshi:['A guilda pendurou fitas em vez de contratos esta noite. Amanhã retomamos o trabalho; hoje recebemos quem voltou.'],
    Sumire:['Escreva um desejo e guarde a fita. No próximo festival veremos o que a primavera mudou.'],
    Isamu:['Estou chamando os últimos visitantes para a roda. A dança começa na praça, não na escadaria.'],
    Aoi:['Vim pelas lanternas, fiquei pelo cheiro de lámen. Ainda preciso conhecer a banca da Aya.'],
    Minato:['Cada barco trouxe uma cor de lanterna. O rio parece uma estrada de estrelas nesta noite.'],
    Saki:['Esta fita é para meu irmão na Casa de Expedições. Ele sempre diz que volta antes da última dança.'],
    Kenta:['Yori me mandou provar o chá antes dos doces. Será que faz parte da receita ou da brincadeira?'],
    Rei:['Suzu varreu os degraus; eu cuido das luzes. Quem chega pelo portal deve encontrar uma cidade de braços abertos.'],
    Mari:['Estas flores são para a roda da praça. As que sobrarem vão para as famílias que esperam alguém.'],
    Shun:['Não acendemos lanternas só pelos heróis. Cada nome importa: barqueiros, cozinheiras, aprendizes, todos.'],
    Gen:['A oficina aprendeu a fazer doces sem usar os frascos de poção. Maki ainda confere as etiquetas por garantia.']
  };

  // ---- chão ----
  // Ruas verificadas na arte, não cores escuras do telhado. Cada segmento termina numa
  // escada, pátio ou ponte real; a oficina só se liga ao píer contornando a praça.
  const STREETS = [
    [10, [[100,168],[260,171],[328,158]]],
    [8, [[254,141],[266,170],[277,191],[327,225],[290,238],[244,270],[290,288],[332,326],[388,355],[452,394],[512,439]]],
    [10, [[244,270],[201,287],[181,306],[145,308],[90,301],[55,288]]],
    [9, [[448,298],[482,334],[540,347],[591,319],[626,296],[605,244],[586,208],[569,187],[580,158]]],
    [11, [[532,161],[561,174],[586,179],[623,162]]],
    [10, [[540,347],[547,376],[556,410]]],
    [13, [[61,413],[184,464],[263,477],[375,478],[439,445],[482,413],[516,430]]],
    [9, [[166,451],[195,461],[255,469],[303,474],[338,469],[379,474],[420,462]]],
    [12, [[556,410],[606,410],[677,388],[753,388],[792,370],[831,370]]],
    [10, [[685,444],[730,455],[752,495],[787,528],[815,513],[855,506],[913,510]]],
    [10, [[913,510],[965,474],[1017,480],[1067,410]]],
    [10, [[913,510],[933,559],[970,600],[1080,630],[1188,648],[1242,630]]],
    [12, [[184,464],[251,522],[337,588],[368,591],[474,619],[641,698],[740,670]]],
    [12, [[368,591],[266,654],[181,648],[240,637]]]
  ];
  const COURTS = [
    [[515,410],[568,393],[640,397],[686,419],[693,445],[664,463],[558,465],[512,443]],
    [[54,286],[146,276],[193,283],[202,301],[173,317],[88,310]],
    [[115,168],[267,162],[307,173],[260,184],[126,184]],
    [[536,163],[556,155],[610,158],[625,173],[593,186],[554,179]],
    [[150,652],[183,633],[235,631],[270,649],[245,672],[179,673]],
    [[627,695],[676,669],[738,659],[777,675],[747,705],[665,711]],
    [[962,600],[989,589],[1195,625],[1244,620],[1250,640],[1188,664]]
  ];
  function inside(x, y, polygon) {
    let on = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [ax, ay] = polygon[i], [bx, by] = polygon[j];
      if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) on = !on;
    }
    return on;
  }
  let G = null, GW = 640, GH = 360, CELL = 2, EDGE = null;
  function grid() {
    if (G) return G;
    const W = KT.TownWalk; if (!W) { G = new Uint8Array(GW * GH); EDGE = new Uint8Array(GW * GH); return G; }
    GW = W.w; GH = W.h; CELL = W.cell; G = new Uint8Array(GW * GH);
    for (const [radius, points] of STREETS) for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1], [bx, by] = points[i], dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
      for (let cy = Math.max(0, Math.floor((Math.min(ay, by) - radius) / CELL)); cy <= Math.min(GH - 1, Math.ceil((Math.max(ay, by) + radius) / CELL)); cy++)
        for (let cx = Math.max(0, Math.floor((Math.min(ax, bx) - radius) / CELL)); cx <= Math.min(GW - 1, Math.ceil((Math.max(ax, bx) + radius) / CELL)); cx++) {
          const x = cx * CELL + CELL / 2, y = cy * CELL + CELL / 2, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len));
          if (Math.hypot(x - ax - dx * t, y - ay - dy * t) <= radius) G[cy * GW + cx] = 1;
        }
    }
    for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) if (!G[cy * GW + cx] && COURTS.some(p => inside(cx * CELL + CELL / 2, cy * CELL + CELL / 2, p))) G[cy * GW + cx] = 1;
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
    const blockedAt = (x, y) => blockers.some(o => { const d = Math.hypot(x - o.ox, (y - o.oy) * 1.55); return d < o.r && (o.start >= o.r || d < Math.max(GAP + .05, o.start - .01)); });
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
    constructor() { this.agents = []; this.key = null; this.dialogueAt = 4; this.dialogue = 0; this.dialogueLine = 0; this.dialoguePair = null; }
    sync(heroes) {
      const key = heroes.map(h => h.uid + h.sprite).join('|'); if (key === this.key) return; this.key = key;
      this.dialoguePair = null; this.dialogueLine = 0; this.dialogueAt = 4;
      const starts = ['plazaN', 'forge', 'marketE', 'dojo', 'garden', 'shrine'];
      this.agents = heroes.map((h, i) => { const [x, y] = at(starts[i % starts.length]); return { id:i, kind:'hero', ...h, x, y, path:[], wait:1.5 + i, face:1, speed:28 + i * 1.5, speedNow:0, verb:'', walkT:Math.random(), walkD:0, animT:Math.random() * 5, speech:'', speechFor:0 }; })
        .concat(FOLK.map((f, i) => { const [x, y] = f.post ? N[f.post] : at(f.route[0]); return { id:heroes.length + i, kind:'folk', f:f.f, def:f, name:f.name, x, y, fixed:!!f.post, path:[], wait:1 + Math.random() * 3, face:f.face || 1, speed:f.speed || 0, speedNow:0, verb:f.verb, ri:0, walkT:Math.random(), walkD:0, animT:Math.random() * 5, speech:'', speechFor:0 }; }));
      const placed = [];
      for (const a of this.agents) {
        if (placed.some(o => dist(a, o) < GAP + 1)) {
          let found = false;
          for (const radius of [20,32,44,60]) {
            for (let i=0;i<16;i++) {
              const angle = i * Math.PI / 8, x = a.x + Math.cos(angle) * radius, y = a.y + Math.sin(angle) * radius / 1.55;
              if (isWalk(x,y) && placed.every(o => Math.hypot(x-o.x,(y-o.y)*1.55) >= GAP + 1)) { a.x=x; a.y=y; found=true; break; }
            }
            if (found) break;
          }
        }
        placed.push(a);
      }
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
        a.animT += dt; a.speechFor = Math.max(0, a.speechFor - dt); a.speechAge = (a.speechAge || 0) + dt;
        if (!a.speechFor) { a.speech = ''; a.manualSpeech = false; }
        if (!a.fixed && (a.idleFor = (a.idleFor || 0) + dt) > 7 && (a.escapeIn = (a.escapeIn || 0) - dt) <= 0) {
          a.escapeIn = 2; this.giveWay(a);
        }
        if (a.path.length) {
          while (a.path.length && Math.hypot(a.path[0][0] - a.x, a.path[0][1] - a.y) < .35) a.path.shift();
          if (!a.path.length) { this.arrive(a); a.moving = false; continue; }
          const [tx, ty] = a.path[0], dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
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
          if (Math.abs(dx) > Math.max(.4, Math.abs(dy) * .3)) a.face = dx > 0 ? 1 : -1;
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
      for (const a of this.agents) if (a.speechFor > 0 && !a.manualSpeech && (a.moving || a.path.length)) { a.speech = ''; a.speechFor = 0; }
      if (this.dialoguePair && (this.dialoguePair.some(a => a.moving || a.path.length) || dist(...this.dialoguePair) >= 72)) {
        this.dialoguePair.forEach(a => { if (!a.manualSpeech) { a.speech = ''; a.speechFor = 0; } });
        this.dialoguePair = null; this.dialogueLine = 0; this.dialogue++; this.dialogueAt = 8;
      }
      if ((this.dialogueAt -= dt) > 0 || this.agents.some(a => a.manualSpeech && a.speechFor > 0)) return;
      for (let tries = 0; tries < DIALOGUES.length; tries++) {
        const d = DIALOGUES[this.dialogue % DIALOGUES.length], people = d.people.map(n => this.agents.find(a => a.name === n));
        if (people.every(a => a && !a.moving && !a.path.length) && dist(people[0], people[1]) < 72) {
          const [speaker, text] = d.lines[this.dialogueLine % d.lines.length], a = this.agents.find(x => x.name === speaker), other = people.find(x => x !== a);
          this.agents.forEach(o => { o.speech = ''; o.speechFor = 0; });
          this.dialoguePair = people; a.speech = text; a.speechFor = 4.3; a.speechAge = 0; a.manualSpeech = false;
          a.face = other.x >= a.x ? 1 : -1; other.face = a.x >= other.x ? 1 : -1; this.dialogueLine++;
          if (this.dialogueLine >= d.lines.length) { this.dialogueLine = 0; this.dialogue++; this.dialoguePair = null; this.dialogueAt = 10; } else this.dialogueAt = 4.8; return;
        }
        this.dialogue++; this.dialogueLine = 0;
      }
      this.dialoguePair = null; this.dialogueAt = 4;
    }
    talk(a) {
      const greeting = GREETINGS[a.name]; if (!greeting) return false;
      const lines = greeting.flatMap(text => text.split(/(?<=[.!?])\s+/));
      this.agents.forEach(o => { o.speechFor = 0; o.manualSpeech = false; });
      this.dialoguePair = null; this.dialogueLine = 0;
      a.speech = lines[(a.talkLine || 0) % lines.length]; a.talkLine = (a.talkLine || 0) + 1;
      a.speechFor = 6; a.speechAge = 0; a.manualSpeech = true; this.dialogueAt = 9; return true;
    }
    arrive(a) { a.goal = null; a.speedNow = 0; const yielded = a.yielding; a.yielding = false; if (a.kind === 'hero') { a.face = a.spot?.face || a.face; a.verb = a.spot?.verb || ''; a.wait = yielded ? .6 : 2.5 + Math.random() * 4; } else { if (a.routeTarget != null) a.ri = a.routeTarget; a.routeTarget = null; a.wait = yielded ? .6 : 1 + Math.random() * 2; } }
    drawList() { return this.agents.map(a => ({ a, s:depth(a.y), h:34 * depth(a.y) })).sort((p, q) => p.a.y - q.a.y); }
  }
  KT.TownLife = TownLife;
  KT.TownMap = { NODES:N, SPOTS, FOLK, route, isWalk, snap, at };
})();
