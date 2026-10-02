// Cidade viva de Tsukimori. Só se anda no chão desenhado (src/town-walk.js, gerado de tools/build_walkmap.py a partir
// do desenho dos caminhos): ruas, escadas e pontes. Rotas célula a célula (A*), espaço pessoal entre todos.
(() => {
  const KT = globalThis.KT = globalThis.KT || {};
  // Pontos de referência (1280×720). Quem anda usa o ponto encaixado no chão; vendedor parado fica ao lado da banca.
  const N = {
    plaza:[560,430], plazaN:[560,408], plazaS:[560,454], plazaW:[515,438], plazaE:[610,438], guardSouth:[560,470],
    marketE:[420,462], marketM:[300,470], marketW:[150,470], marketGuide:[410,451], stallRenji:[338,463], stallYori:[379,467], stallAya:[255,463], stallMio:[303,467], stallGoro:[166,451],
    dojo:[200,312], dojoStairs:[205,380], dojoKata:[126,317], dojoKata2:[207,319], dojoSword:[166,322], dojoMaster:[248,313], guild:[200,168], guildSteps:[285,190], garden:[450,300],
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
    {people:['Emi','Riku'],lines:[['Emi','Já prendeu seu desejo no corrimão?'],['Riku','Sim: que toda primavera tenha esta roda de novo.'],['Emi','Vou prendê-lo junto ao meu. Que esta noite nunca seja esquecida.']]},
    {people:['Gensai','Sota'],lines:[['Gensai','De novo, Sota. O quadril gira antes do punho.'],['Sota','Mestre, o festival já começou…'],['Gensai','Mais dez. Depois eu mesmo pago o seu dango.']]},
    {people:['Kaede','Ichiro'],lines:[['Ichiro','Seu corte assobia. O meu soco só faz vento.'],['Kaede','Vento também derruba lanterna. Continue.'],['Ichiro','Então hoje eu derrubo o boneco!']]}
  ];
  const FOLK = [
    {f:0,name:'Renji',post:'stallRenji',face:1,verb:'Vendendo lámen',festival:'ribbon'},{f:1,name:'Maki',post:'forgePost',face:-1,verb:'Martelando',festival:'ribbon'},{f:2,name:'Suzu',route:['templeL','templeR'],speed:12,verb:'Varrendo'},
    {f:3,name:'Hotaru',route:['shrine','shrineLantern'],speed:13,verb:'Acendendo lanternas',festival:'lantern'},
    {f:4,name:'Goro',post:'stallGoro',face:1,verb:'Vendendo peixe'},{f:5,name:'Aya',post:'stallAya',face:1,verb:'Servindo chá'},{f:6,name:'Tomo',route:['playMarketW','playMarketC','playMarketE','marketW'],speed:30,verb:'Correndo com o cata-vento',sheet:'kid'},
    {f:7,name:'Jinbei',route:['plazaW','guardSouth','plazaE','guardSouth'],speed:19,verb:'De ronda'},{f:8,name:'Natsu',post:'marketGuide',face:-1,verb:'Mercadora'},
    {f:9,name:'Daigo',route:['expedition','dockMid'],speed:15,verb:'Carregando caixas'},{f:3,name:'Koharu',post:'dance',face:1,verb:'Dançando',act:'dancer'},{f:6,name:'Riku',post:'drum',face:-1,verb:'Tocando tambor',act:'taiko'},
    {f:2,name:'Emi',post:'playB',face:-1,verb:'Entregando talismãs',festival:'ribbon'},{f:5,name:'Yori',post:'stallYori',face:-1,verb:'Fazendo doces',festival:'ribbon'},{f:0,name:'Fumi',post:'shrineStory',face:-1,verb:'Contando histórias'},
    {f:4,name:'Kai',route:['dock','dockWest'],speed:12,verb:'Guiando visitantes'},{f:8,name:'Mio',post:'stallMio',face:1,verb:'Pintando máscaras'},
    {f:9,name:'Bento',route:['bankLanding','workshopGate','workshop','workshopGate'],speed:13,verb:'Levando oferendas'},
    {f:3,name:'Hina',post:'danceA',face:-1,verb:'Dançando a roda das pétalas',festival:'fan',act:'dancer'},
    {f:5,name:'Chiyo',post:'danceB',face:1,verb:'Aprendendo a dança',festival:'fan',act:'dancer',beat:.5},
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
    {f:9,name:'Gen',route:['workshopGuest','workshop','workshopGate'],speed:16,verb:'Entregando chá e doces',festival:'ribbon'},
    // Dojo do Eco: o pátio de treino nunca fica vazio.
    {f:6,name:'Ichiro',post:'dojoKata',face:1,verb:'Treinando o kata',act:'kata'},
    {f:6,name:'Sota',post:'dojoKata2',face:-1,verb:'Treinando o kata',act:'kata',beat:.45},
    {f:1,name:'Kaede',post:'dojoSword',face:1,verb:'Cortes com o bokken',act:'bokken',beat:.2},
    {f:2,name:'Gensai',post:'dojoMaster',face:-1,verb:'Corrigindo a postura dos alunos',act:'sensei'},
    // Vida solta pelas ruas.
    {f:6,name:'Mochi',route:['plazaS','garden','templeMid','plazaN','marketE'],speed:21,verb:'Passeando',sheet:'cat',small:true},
    {f:5,name:'Akari',route:['shrineLantern','eastLand','bridgeM','plazaE'],speed:14,verb:'Levando a lanterna ao santuário',sheet:'lanterngirl',festival:'lantern'}
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
    Gen:['A oficina aprendeu a fazer doces sem usar os frascos de poção. Maki ainda confere as etiquetas por garantia.'],
    Ichiro:['Cem socos antes do jantar. O mestre diz que o centésimo é o único que conta.','Quero entrar na Ordem dos Aventureiros. Primeiro, preciso acertar o chute sem cair.'],
    Sota:['O boneco de madeira nunca erra o bloqueio. Um dia eu também não vou errar.'],
    Kaede:['O bokken pesa menos que uma lâmina, mas o corte é o mesmo: do ombro, não do pulso.','Treino aqui desde que o Eclipse levou a espada do meu pai. Vou buscá-la.'],
    Gensai:['Postura antes de força. Quem aprende a ficar de pé não precisa aprender a cair.','O Dojo do Eco devolve o que você entrega: pressa vira tropeço, paciência vira técnica.'],
    Mochi:['Miau.','Mrrrau!','Prrrr…'],
    Akari:['Esta lanterna é para o nome da minha mãe. Hotaru me ensinou a não deixar a chama apagar no caminho.','Se o vento soprar forte, eu canto. A chama gosta de música.']
  };

  // ---- chão ----
  // O chão é o desenho de caminhos feito sobre a arte (src/town-walk.js, gerado por tools/build_walkmap.py): ruas,
  // escadas, pontes e pátios exatamente onde foram traçados. A praça central entra inteira (o traço em espiral deixava
  // frestas) e frestas de uma célula são fechadas. Nada de linhas aproximadas por cima de muros e telhados.
  const PLAZA = [[515,410],[568,393],[640,397],[686,419],[693,445],[664,463],[558,465],[512,443]];
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
    W.rows.split(';').forEach((row, cy) => { let x = 0, on = false; for (const n of row.split(',')) { const len = Number(n); if (on && cy < GH) G.fill(1, cy * GW + x, cy * GW + Math.min(GW, x + len)); x += len; on = !on; } });
    for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) if (!G[cy * GW + cx] && inside(cx * CELL + CELL / 2, cy * CELL + CELL / 2, PLAZA)) G[cy * GW + cx] = 1;
    // Fecha frestas finas do traço: célula vazia com chão dos dois lados (na horizontal ou na vertical) vira chão.
    const gap = []; for (let cy = 1; cy < GH - 1; cy++) for (let cx = 1; cx < GW - 1; cx++) { const i = cy * GW + cx; if (!G[i] && ((G[i - 1] && G[i + 1]) || (G[i - GW] && G[i + GW]))) gap.push(i); }
    gap.forEach(i => { G[i] = 1; });
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
  // Feito para rodar durante o jogo sem engasgar: memória reaproveitada entre chamadas (carimbo de geração em vez de
  // limpar 230 mil células), discos pintados uma vez numa máscara e heurística justa (1,5 × distância octogonal, o
  // menor custo possível por célula). Antes cada rota levava ~14 ms e a cidade dava pequenos trancos.
  let RT = null;
  function route(ax, ay, bx, by, avoid = []) {
    grid(); const [sx, sy] = cellOf(...snap(ax, ay)), [tx, ty] = cellOf(...snap(bx, by)), S = sy * GW + sx, T = ty * GW + tx;
    if (!G[S] || !G[T]) return null;
    if (S === T) return [];
    const n = GW * GH;
    const R = RT && RT.n === n ? RT : (RT = { n, gen:0, g:new Float32Array(n), from:new Int32Array(n), seen:new Uint32Array(n), done:new Uint32Array(n), block:new Uint32Array(n), hf:[], hi:[] });
    const gen = ++R.gen, { g, from, seen, done, block, hf, hi } = R;
    for (const [ox, oy, r] of avoid) {
      const start = Math.hypot(ax - ox, (ay - oy) * 1.55), ry = r / 1.55;
      for (let cy = Math.max(0, Math.floor((oy - ry) / CELL)); cy <= Math.min(GH - 1, Math.ceil((oy + ry) / CELL)); cy++)
        for (let cx = Math.max(0, Math.floor((ox - r) / CELL)); cx <= Math.min(GW - 1, Math.ceil((ox + r) / CELL)); cx++) {
          const d = Math.hypot(cx * CELL + CELL / 2 - ox, (cy * CELL + CELL / 2 - oy) * 1.55);
          // Quem já começa dentro do disco pode sair dele (afastando-se), nunca entrar mais.
          if (d < r && (start >= r || d < start - .01)) block[cy * GW + cx] = gen;
        }
    }
    const blockedAt = (x, y) => { const [cx, cy] = cellOf(x, y); return block[cy * GW + cx] === gen; };
    let size = 0;
    const push = (i, f) => { let k = size++; while (k) { const p = (k - 1) >> 1; if (hf[p] <= f) break; hf[k] = hf[p]; hi[k] = hi[p]; k = p; } hf[k] = f; hi[k] = i; };
    const pop = () => { const top = hi[0], f = hf[--size], i = hi[size]; let k = 0; for (;;) { let c = 2 * k + 1; if (c >= size) break; if (c + 1 < size && hf[c + 1] < hf[c]) c++; if (hf[c] >= f) break; hf[k] = hf[c]; hi[k] = hi[c]; k = c; } hf[k] = f; hi[k] = i; return top; };
    g[S] = 0; seen[S] = gen; push(S, 0); let found = false;
    while (size) {
      const i = pop(); if (done[i] === gen) continue; done[i] = gen; if (i === T) { found = true; break; }
      const x = i % GW, y = (i / GW) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const j = ny * GW + nx; if (!G[j] || done[j] === gen || (dx && dy && (!G[y * GW + nx] || !G[ny * GW + x]))) continue;
        if (block[j] === gen && j !== T) continue;
        const c = g[i] + (dx && dy ? 1.414 : 1) * (1 + 2.5 / Math.min(5, EDGE[j]));
        if (seen[j] !== gen || c < g[j]) { g[j] = c; seen[j] = gen; from[j] = i; const ex = Math.abs(nx - tx), ey = Math.abs(ny - ty); push(j, c + 1.5 * (Math.max(ex, ey) + .414 * Math.min(ex, ey))); }
      }
    }
    if (!found) return null;
    const cells = []; for (let i = T; ; i = from[i]) { cells.unshift(i); if (i === S) break; }
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
  const STAND_GAP = 12, POST_GAP = 9, FOLLOW_GAP = 15;   // distância ao contornar quem está parado / vendedor na banca / fila
  const dist = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * 1.55);

  class TownLife {
    constructor() { this.agents = []; this.key = null; this.dialogueAt = 4; this.dialogue = 0; this.dialogueLine = 0; this.dialoguePair = null; }
    sync(heroes) {
      const key = heroes.map(h => h.uid + h.sprite).join('|'); if (key === this.key) return; this.key = key;
      this.dialoguePair = null; this.dialogueLine = 0; this.dialogueAt = 4;
      const starts = ['plazaN', 'forge', 'marketE', 'dojo', 'garden', 'shrine'];
      this.agents = heroes.map((h, i) => { const [x, y] = at(starts[i % starts.length]); return { id:i, kind:'hero', ...h, x, y, path:[], wait:1.5 + i, face:1, speed:28 + i * 1.5, speedNow:0, verb:'', walkT:Math.random(), walkD:0, animT:Math.random() * 5, speech:'', speechFor:0 }; })
        .concat(FOLK.map((f, i) => { const [x, y] = f.post ? N[f.post] : at(f.route[0]); return { id:heroes.length + i, kind:'folk', f:f.f, def:f, name:f.name, x, y, fixed:!!f.post, path:[], wait:1 + Math.random() * 3, face:f.face || 1, speed:f.speed || 0, speedNow:0, verb:f.verb, ri:0, walkT:Math.random(), walkD:0, animT:f.act ? (f.beat || 0) * 4 : Math.random() * 5, speech:'', speechFor:0 }; }));
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
    // Destino livre: ninguém parado ali nem a caminho dali (quem só está de passagem não conta).
    free(a, p) { return this.agents.every(o => o === a || [o.path.length ? null : [o.x, o.y], o.goal].every(q => !q || Math.hypot(q[0] - p[0], (q[1] - p[1]) * 1.55) > GAP + 4)); }
    // Quem está parado por perto vira obstáculo da rota (vendedor na banca ocupa menos espaço que alguém no meio da rua).
    standing(a) { return this.agents.filter(o => o !== a && !o.moving && !o.path.length && dist(a, o) < 110).map(o => [o.x, o.y, (o.fixed ? POST_GAP : STAND_GAP) + 2]); }
    // Um ponto de chão livre perto de p (anéis de 20 a 46 px), para quando o destino está ocupado.
    beside(a, p) {
      const turn = a.id * 2.4;
      for (const r of [20, 30, 46]) for (let i = 0; i < 8; i++) {
        const q = snap(p[0] + Math.cos(turn + i * Math.PI / 4) * r, p[1] + Math.sin(turn + i * Math.PI / 4) * r / 1.55);
        if (Math.hypot(q[0] - p[0], q[1] - p[1]) <= r + 6 && this.free(a, q)) return q;
      }
      return null;
    }
    go(a, p) {
      const r = route(a.x, a.y, p[0], p[1], this.standing(a)) || route(a.x, a.y, p[0], p[1]);
      if (!r || !r.length) { a.wait = .4 + Math.random() * .5; a.goal = null; return false; }
      a.path = r; a.goal = p; a.stuck = 0; a.ghost = 0; return true;
    }
    // Movimento sem trava e sem vaivém:
    //  · quem anda só desvia de quem está PARADO (a rota já contorna); dois andando se cruzam, como numa rua cheia;
    //  · atrás de alguém mais lento no mesmo sentido, acompanha o passo em vez de atravessar;
    //  · sem espaço para contornar (rua estreita), espera um instante e passa rente. Ninguém volta pelo caminho.
    update(dt) {
      for (const a of this.agents) {
        a.animT += dt; a.speechFor = Math.max(0, a.speechFor - dt); a.speechAge = (a.speechAge || 0) + dt;
        if (!a.speechFor) { a.speech = ''; a.manualSpeech = false; }
        a.ghost = Math.max(0, (a.ghost || 0) - dt);
        if (a.path.length) {
          while (a.path.length && Math.hypot(a.path[0][0] - a.x, a.path[0][1] - a.y) < .35) a.path.shift();
          if (!a.path.length) { this.arrive(a); a.moving = false; continue; }
          const [tx, ty] = a.path[0], dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
          const remaining = Math.hypot(a.goal[0] - a.x, a.goal[1] - a.y);
          let pace = Math.min(a.speed * depth(a.y), Math.max(8, remaining * 2.5));
          // Fila natural: alguém andando logo à frente, no mesmo sentido, dita o passo.
          for (const o of this.agents) {
            if (o === a || !o.moving) continue;
            const ox = o.x - a.x, oy = (o.y - a.y) * 1.55, od = Math.hypot(ox, oy);
            if (od < FOLLOW_GAP && od > .01 && (ox * ux + oy * uy) / od > .6 && (o.vx || 0) * ux + (o.vy || 0) * uy > 0) pace = Math.min(pace, Math.max(4, (o.speedNow || 0) * .9));
          }
          a.speedNow = Math.min(pace, (a.speedNow || 0) + 105 * dt);
          const step = Math.min(d, a.speedNow * dt), nx = a.x + ux * step, ny = a.y + uy * step;
          const blocker = a.ghost > 0 ? null : this.agents.find(o => {
            if (o === a || o.moving || o.path.length) return false;
            const gap = o.fixed ? POST_GAP : STAND_GAP, before = dist(a, o), after = Math.hypot(nx - o.x, (ny - o.y) * 1.55);
            return after < gap && after < before - .01;
          });
          if (!onGround([a.x, a.y], [nx, ny]) || blocker) {
            a.moving = false; a.speedNow = 0; a.vx = a.vy = 0; a.stuck = (a.stuck || 0) + dt;
            if (!blocker) { a.path = []; a.goal = null; a.wait = .3; continue; }      // saiu do chão: escolhe outro destino
            // Uma única tentativa de contornar (a rota é cara); sem espaço, espera um instante e passa rente.
            const around = !a.triedAround && route(a.x, a.y, a.goal[0], a.goal[1], this.standing(a)); a.triedAround = true;
            if (around?.length) a.path = around;
            else if (a.stuck > .5) { a.ghost = 1.6; a.stuck = 0; a.triedAround = false; }
            continue;
          }
          a.stuck = 0; a.triedAround = false;
          if (Math.abs(dx) > Math.max(.4, Math.abs(dy) * .3)) a.face = dx > 0 ? 1 : -1;
          a.vx = ux; a.vy = uy;
          a.x = nx; a.y = ny; a.walkT += dt; a.walkD += step; a.moving = step > .01;
          if (d <= step + .001) { a.path.shift(); if (!a.path.length) this.arrive(a); }
          continue;
        }
        a.moving = false; a.speedNow = 0; a.vx = a.vy = 0;
        if ((a.wait -= dt) > 0) continue;
        if (a.kind === 'hero') {
          const choices = SPOTS.filter(s => this.free(a, at(s.node))), s = choices.length ? pick(choices) : null;
          if (s) { a.spot = s; a.verb = ''; this.go(a, at(s.node)); } else a.wait = 1.5;
        } else if (a.def.route) {
          const next = (a.ri + 1) % a.def.route.length, p = at(a.def.route[next]);
          // Ponto ocupado (vendedor na banca, outro morador parado ali): para ao lado, sem espera mútua nem recuo.
          const spot = this.free(a, p) ? p : this.beside(a, p);
          if (spot && this.go(a, spot)) a.routeTarget = next;
          else a.wait = .8 + Math.random() * .8;
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
    arrive(a) { a.goal = null; a.speedNow = 0; a.vx = a.vy = 0; if (a.kind === 'hero') { a.face = a.spot?.face || a.face; a.verb = a.spot?.verb || ''; a.wait = 2.5 + Math.random() * 4; } else { if (a.routeTarget != null) a.ri = a.routeTarget; a.routeTarget = null; a.wait = 1 + Math.random() * 2; } }
    drawList() { return this.agents.map(a => ({ a, s:depth(a.y), h:34 * depth(a.y) })).sort((p, q) => p.a.y - q.a.y); }
  }
  KT.TownLife = TownLife;
  KT.TownMap = { NODES:N, SPOTS, FOLK, route, isWalk, snap, at };
})();
