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
    Akari:['Esta lanterna é para o nome da minha mãe. Hotaru me ensinou a não deixar a chama apagar no caminho.','Se o vento soprar forte, eu canto. A chama gosta de música.']
  };

  // ---- bichos ----
  // Bicho não é morador: não segue rota, não para em barraca nem conversa. Cada espécie tem o próprio jeito e reage a
  // quem passa: a gata pede peixe e foge do cachorro; o cachorro segue gente e faz festa; o cervo do jardim
  // reverencia; a raposa do santuário é arisca e só confia em quem cuida das lanternas; galinhas e pardais se
  // espalham; patos e carpas vêm para quem para no cais.
  // poses: nome → [primeiro quadro, último quadro, quadros por segundo] na folha de poses (assets/town-walk/animals.webp).
  const SPECIES = {
    cat:     { row:'cat', idle:'cat_idle', speed:22, run:62, size:.36, rest:'sit', poses:{ sit:[0,1,1.1], groom:[2,3,2.6], sleep:[4,5,.6], stretch:[6,6,1], scared:[7,7,1] } },
    dog:     { row:'dog', idle:'dog_idle', speed:34, run:74, size:.44, rest:'sit', poses:{ sit:[0,0,1], tilt:[1,1,1], bark:[2,3,5], bow:[4,4,1], jump:[5,5,1], lie:[6,6,1], sniff:[7,7,1] } },
    deer:    { row:'deer', idle:'deer_idle', speed:18, run:66, size:.95, rest:'stand', poses:{ stand:[0,0,1], look:[1,1,1], bow:[2,3,1.5], graze:[4,5,1.1], lie:[6,6,1], alert:[7,7,1] } },
    fox:     { row:'fox', idle:'fox_idle', speed:26, run:80, size:.48, rest:'sit', poses:{ sit:[0,1,1], alert:[2,2,1], crouch:[3,3,1], pounce:[4,5,2.4], sleep:[6,6,1], yawn:[7,7,1] } },
    chicken: { row:'chicken', speed:13, run:46, size:.33, walk:[0,3], rest:'stand', poses:{ stand:[0,0,1], peck:[4,5,3.2], flap:[6,7,9] } },
    sparrow: { row:'sparrow', speed:16, size:.19, rest:'stand', poses:{ stand:[0,0,1], hop:[1,1,1], peck:[2,2,1], look:[3,3,1], fly:[4,7,13] } },
    duck:    { row:'duck', speed:8, size:.26, water:true, rest:'float', poses:{ float:[0,2,1.1], preen:[3,3,1], dabble:[4,5,1], flap:[6,7,7] } },
    koi:     { row:'koi', speed:11, size:.2, water:true }
  };
  const ANIMALS = [
    { sp:'cat', name:'Mochi', home:'plazaS', range:170 }, { sp:'dog', name:'Pochi', home:'marketE', range:280 },
    { sp:'deer', name:'Shika', home:'garden', range:90 }, { sp:'fox', name:'Yuki', home:'shrineLantern', range:80 },
    { sp:'chicken', home:'marketW', range:44 }, { sp:'chicken', home:'marketW', range:44 }, { sp:'chicken', home:'marketGuest', range:40 },
    { sp:'sparrow' }, { sp:'sparrow' }, { sp:'sparrow' }, { sp:'sparrow' }, { sp:'sparrow' },
    { sp:'duck' }, { sp:'duck' }, { sp:'koi', variant:0 }, { sp:'koi', variant:1 }, { sp:'koi', variant:0 }, { sp:'koi', variant:1 }
  ];
  // Onde os pardais pousam (o bando escolhe um lugar, é espantado e vai para outro).
  const PERCHES = ['plazaE', 'plazaW', 'guardSouth', 'marketM', 'templeMid', 'dojoStairs', 'shrineStory', 'workshopGate', 'bankTop', 'guildSteps', 'eastLand'];
  // Água aberta do porto (1280×720), longe dos barcos: onde nadam os patos e as carpas.
  const WATER = [[866,638],[948,638],[952,676],[994,704],[988,715],[870,715],[858,694]];
  // O que as pessoas dizem quando um bicho vem até elas (nome do morador, ou '*' para qualquer um).
  const PET = {
    cat: { Goro:['Peixe não, Mochi! …Tá bom, só a cabeça.','De novo você? O freguês vem primeiro.'], Renji:['O caldo é quente, bichana. Sopre antes.'], Aya:['Sem pelo no chá, por favor!'], Yori:['Dango não é comida de gato, Mochi.'], '*':['Olha quem veio pedir carinho.','Quem é a gatinha mais esperta da praça?','Mochi! Cuidado com os meus pés.'] },
    dog: { Tomo:['Pega o cata-vento, Pochi!','Corre, Pochi, corre!'], Jinbei:['De ronda comigo, Pochi? Então atenção.'], Daigo:['Sai de baixo das caixas, amigo.'], '*':['Bom garoto, Pochi!','Senta. Isso! Quem quer dango?','Hoje não tenho osso, amigo.'] },
    deer: { Mari:['As flores não são para comer!'], Suzu:['Devagar com os degraus, pequeno.'], '*':['Que educado! Tome um biscoito.','O cervo do jardim cumprimenta todo mundo.','Reverência para você também.'] },
    fox: { Hotaru:['A raposa branca veio ver as lanternas. Bom presságio.'], Fumi:['Dizem que ela guarda os nomes do santuário.'], Shun:['Não se assuste, pequena. Só vim deixar um nome.'], Akari:['Você gosta da minha lanterna, raposinha?'] },
    water: { Kai:['Os patos já conhecem a hora do pão.'], Minato:['Olha as carpas! Vieram ver as lanternas.'], Daigo:['Até os peixes querem as oferendas.'], '*':['As carpas vêm sempre que alguém para aqui.'] },
    chicken: { Natsu:['Xô, xô! Longe das barracas!'], Kenta:['As galinhas daqui não têm medo de ninguém.'], Tomo:['Voem, voem!'] }
  };
  const VOICE = { cat:['Miau.', 'Mrrrau!', 'Prrrr…'], dog:['Au, au!', 'Uuuf!'], deer:['…'], fox:['Kon!'], chicken:['Có, có!'], duck:['Quá!'], sparrow:['Piu!'], koi:['…'] };
  const TRUSTED = new Set(['Hotaru', 'Fumi', 'Akari', 'Shun', 'Rei']);     // de quem a raposa não foge

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
  const rnd = (a, b) => a + Math.random() * (b - a);
  // Um ponto de chão ao acaso a até r px de c (ou null).
  const near = (c, r, tries = 10) => { for (let i = 0; i < tries; i++) { const g = Math.random() * 6.283, d = r * (.25 + .75 * Math.random()), x = c[0] + Math.cos(g) * d, y = c[1] + Math.sin(g) * d / 1.55; if (isWalk(x, y)) return [x, y]; } return null; };
  const inWater = (x, y) => inside(x, y, WATER);
  const waterPoint = (c = null, r = 30) => { for (let i = 0; i < 24; i++) { const x = c ? c[0] + rnd(-r, r) : rnd(858, 994), y = c ? c[1] + rnd(-r, r) * .6 : rnd(638, 715); if (inWater(x, y)) return [x, y]; } return [905, 672]; };

  class TownLife {
    constructor() { this.agents = []; this.key = null; this.dialogueAt = 4; this.dialogue = 0; this.dialogueLine = 0; this.dialoguePair = null; }
    sync(heroes) {
      const key = heroes.map(h => h.uid + h.sprite).join('|'); if (key === this.key) return; this.key = key;
      this.dialoguePair = null; this.dialogueLine = 0; this.dialogueAt = 4;
      const starts = ['plazaN', 'forge', 'marketE', 'dojo', 'garden', 'shrine'];
      this.agents = heroes.map((h, i) => { const [x, y] = at(starts[i % starts.length]); return { id:i, kind:'hero', ...h, x, y, path:[], wait:1.5 + i, face:1, speed:28 + i * 1.5, speedNow:0, verb:'', walkT:Math.random(), walkD:0, animT:Math.random() * 5, speech:'', speechFor:0 }; })
        .concat(FOLK.map((f, i) => { const [x, y] = f.post ? N[f.post] : at(f.route[0]); return { id:heroes.length + i, kind:'folk', f:f.f, def:f, name:f.name, x, y, fixed:!!f.post, path:[], wait:1 + Math.random() * 3, face:f.face || 1, speed:f.speed || 0, speedNow:0, verb:f.verb, ri:0, walkT:Math.random(), walkD:0, animT:f.act ? (f.beat || 0) * 4 : Math.random() * 5, speech:'', speechFor:0 }; }));
      const placed = [];
      this.flock = { perch:'plazaE', relocate:rnd(14, 26) };
      const base = this.agents.length;
      ANIMALS.forEach((d, i) => {
        const S = SPECIES[d.sp], home = d.home ? at(d.home) : d.sp === 'sparrow' ? at(this.flock.perch) : null;
        const [x, y] = S.water ? waterPoint() : near(home, d.sp === 'sparrow' ? 16 : 30) || home;
        this.agents.push({ id:base + i, kind:'animal', sp:d.sp, name:d.name || '', variant:d.variant || 0, home, range:d.range || 0, x, y, path:[], wait:rnd(.5, 3), face:Math.random() < .5 ? 1 : -1, pace:S.speed, pose:S.rest || null, moving:false,
          walkD:0, animT:Math.random() * 5, senseT:Math.random() * .3, cool:0, emote:'', emoteFor:0, speech:'', speechFor:0, heading:0, lift:0 });
      });
      for (const a of this.agents) {
        if (a.kind === 'animal') continue;
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
    free(a, p) { return this.agents.every(o => o === a || o.kind === 'animal' || [o.path.length ? null : [o.x, o.y], o.goal].every(q => !q || Math.hypot(q[0] - p[0], (q[1] - p[1]) * 1.55) > GAP + 4)); }
    // Quem está parado por perto vira obstáculo da rota (vendedor na banca ocupa menos espaço que alguém no meio da rua).
    standing(a) { return this.agents.filter(o => o !== a && o.kind !== 'animal' && !o.moving && !o.path.length && dist(a, o) < 110).map(o => [o.x, o.y, (o.fixed ? POST_GAP : STAND_GAP) + 2]); }
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
      this.petCool = Math.max(0, (this.petCool || 0) - dt);
      this.updateFlock(dt);
      for (const a of this.agents) {
        a.animT += dt; a.speechFor = Math.max(0, a.speechFor - dt); a.speechAge = (a.speechAge || 0) + dt;
        if (!a.speechFor) { a.speech = ''; a.manualSpeech = false; }
        if (a.emoteFor > 0 && (a.emoteFor -= dt) <= 0) a.emote = '';
        if (a.kind === 'animal') { this.updateAnimal(a, dt); continue; }
        a.ghost = Math.max(0, (a.ghost || 0) - dt);
        if (a.path.length) {
          while (a.path.length && Math.hypot(a.path[0][0] - a.x, a.path[0][1] - a.y) < .35) a.path.shift();
          if (!a.path.length) { this.arrive(a); a.moving = false; continue; }
          const [tx, ty] = a.path[0], dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
          const remaining = Math.hypot(a.goal[0] - a.x, a.goal[1] - a.y);
          let pace = Math.min(a.speed * depth(a.y), Math.max(8, remaining * 2.5));
          // Fila natural: alguém andando logo à frente, no mesmo sentido, dita o passo.
          for (const o of this.agents) {
            if (o === a || !o.moving || o.kind === 'animal') continue;
            const ox = o.x - a.x, oy = (o.y - a.y) * 1.55, od = Math.hypot(ox, oy);
            if (od < FOLLOW_GAP && od > .01 && (ox * ux + oy * uy) / od > .6 && (o.vx || 0) * ux + (o.vy || 0) * uy > 0) pace = Math.min(pace, Math.max(4, (o.speedNow || 0) * .9));
          }
          a.speedNow = Math.min(pace, (a.speedNow || 0) + 105 * dt);
          const step = Math.min(d, a.speedNow * dt), nx = a.x + ux * step, ny = a.y + uy * step;
          const blocker = a.ghost > 0 ? null : this.agents.find(o => {
            if (o === a || o.kind === 'animal' || o.moving || o.path.length) return false;
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
      if (a.kind === 'animal') return this.poke(a);
      const greeting = GREETINGS[a.name]; if (!greeting) return false;
      const lines = greeting.flatMap(text => text.split(/(?<=[.!?])\s+/));
      this.agents.forEach(o => { o.speechFor = 0; o.manualSpeech = false; });
      this.dialoguePair = null; this.dialogueLine = 0;
      a.speech = lines[(a.talkLine || 0) % lines.length]; a.talkLine = (a.talkLine || 0) + 1;
      a.speechFor = 6; a.speechAge = 0; a.manualSpeech = true; this.dialogueAt = 9; return true;
    }
    arrive(a) { a.goal = null; a.speedNow = 0; a.vx = a.vy = 0; if (a.kind === 'hero') { a.face = a.spot?.face || a.face; a.verb = a.spot?.verb || ''; a.wait = 2.5 + Math.random() * 4; } else { if (a.routeTarget != null) a.ri = a.routeTarget; a.routeTarget = null; a.wait = 1 + Math.random() * 2; } }
    drawList() { return this.agents.map(a => ({ a, s:depth(a.y), h:34 * depth(a.y) })).sort((p, q) => p.a.y - q.a.y); }

    // ---------- bichos ----------
    people() { return this.agents.filter(o => o.kind !== 'animal'); }
    // Um sinal sobre a cabeça (♥ ! ♪ z): é assim que bicho "fala", e como os heróis respondem.
    emote(a, glyph, time = 2.2) { a.emote = glyph; a.emoteFor = time; }
    // A pessoa reage ao bicho: morador fala uma frase curta; herói (que não fala em balão) mostra um ♥.
    react(h, kind, glyph = '♥') {
      if (!h) return;
      if (h.kind === 'hero') { this.emote(h, glyph, 2.4); return; }
      const lines = PET[kind]?.[h.name] || PET[kind]?.['*'];
      if (!lines || this.petCool > 0 || h.manualSpeech || this.dialoguePair?.includes(h) || this.agents.some(o => o.manualSpeech && o.speechFor > 0)) { this.emote(h, glyph, 2); return; }
      h.speech = lines[Math.floor(Math.random() * lines.length)]; h.speechFor = 3.6; h.speechAge = 0; h.manualSpeech = false;
      this.petCool = 9; this.dialogueAt = Math.max(this.dialogueAt, 5);
    }
    setPose(a, pose, time) { a.pose = pose; a.wait = time; a.animT = 0; a.path = []; a.moving = false; }
    goAnimal(a, p, run = false) {
      if (!p) return false;
      const S = SPECIES[a.sp];
      a.path = onGround([a.x, a.y], p) ? [p] : route(a.x, a.y, p[0], p[1]) || [];
      if (!a.path.length) { a.wait = rnd(.4, 1); return false; }
      a.pace = run ? S.run || S.speed : S.speed; a.pose = null; return true;
    }
    // Ponto de chão para o lado oposto de quem assusta.
    away(a, from, d) {
      const g = Math.atan2((a.y - from.y) * 1.55, a.x - from.x);
      for (const k of [0, .5, -.5, 1, -1, 1.6, -1.6]) { const x = a.x + Math.cos(g + k) * d, y = a.y + Math.sin(g + k) * d / 1.55; if (isWalk(x, y)) return [x, y]; }
      return a.home;
    }
    // Um lugar colado numa pessoa (ao lado, um pouco à frente): onde o bicho senta para pedir carinho.
    by(h, d = 11) { for (const sx of Math.random() < .5 ? [1, -1] : [-1, 1]) { const x = h.x + sx * d, y = h.y + 3; if (isWalk(x, y)) return [x, y]; } return null; }
    updateAnimal(a, dt) {
      const S = SPECIES[a.sp];
      a.cool = Math.max(0, a.cool - dt);
      if (S.water) { this.swim(a, S, dt); return; }
      if (a.fly) {
        const f = a.fly; f.t += dt;
        if (f.t < 0) return;                                               // ainda no chão: cada pardal levanta no seu instante
        const k = Math.min(1, f.t / f.dur), e = k * k * (3 - 2 * k);
        a.x = f.x0 + (f.x1 - f.x0) * e; a.y = f.y0 + (f.y1 - f.y0) * e; a.lift = Math.sin(k * Math.PI) * f.lift;
        a.face = f.x1 >= f.x0 ? 1 : -1; a.pose = 'fly'; a.moving = false;
        if (k >= 1) { a.fly = null; a.lift = 0; this.setPose(a, 'stand', rnd(.3, 1.2)); }
        return;
      }
      if ((a.senseT -= dt) <= 0) { a.senseT = rnd(.16, .28); if (this.sense(a, S)) return; }
      if (a.path.length) {
        const [tx, ty] = a.path[0], dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
        if (d < .5) a.path.shift();
        else {
          const step = Math.min(d, a.pace * depth(a.y) * dt), nx = a.x + dx / d * step, ny = a.y + dy / d * step;
          if (!isWalk(nx, ny)) a.path = [];
          else { a.x = nx; a.y = ny; a.walkD += step; a.moving = true; if (Math.abs(dx) > .3) a.face = dx > 0 ? 1 : -1; }
        }
        if (!a.path.length) { a.moving = false; this.animalArrive(a, S); }
        return;
      }
      a.moving = false;
      if ((a.wait -= dt) <= 0) this.animalThink(a, S);
    }
    // O que o bicho percebe em volta (algumas vezes por segundo). Devolve true se largou o que fazia para reagir.
    sense(a, S) {
      const people = this.people();
      if (a.sp === 'cat') {
        const dog = this.agents.find(o => o.sp === 'dog' && dist(a, o) < 46);
        if (dog && a.cool <= 0) { a.cool = 5; a.visit = null; this.emote(a, '!', 1.2); this.goAnimal(a, this.away(a, dog, 130), true); return true; }
        const foot = people.find(o => o.moving && dist(a, o) < 9);          // sai de baixo do pé de quem vem andando
        if (foot && !a.moving) { this.goAnimal(a, this.away(a, foot, 18), true); return true; }
      } else if (a.sp === 'dog') {
        const cat = this.agents.find(o => o.sp === 'cat' && dist(a, o) < 62);
        if (cat && a.cool <= 0 && !a.moving && Math.random() < .3) { a.cool = 12; a.face = cat.x >= a.x ? 1 : -1; this.setPose(a, 'bark', 1.5); this.emote(a, '!', 1.2); return true; }
        const l = a.follow;
        if (l) {
          const d = dist(a, l);
          if ((a.followT -= .22) <= 0 || !this.agents.includes(l)) { a.follow = null; a.wait = rnd(.5, 1.5); return false; }
          if (d > (l.moving ? 22 : 34) && (!a.path.length || Math.hypot(a.path[a.path.length - 1][0] - l.x, a.path[a.path.length - 1][1] - l.y) > 30)) { this.goAnimal(a, this.by(l, 13) || [l.x, l.y], d > 75); return false; }
          if (!l.moving && d <= 34 && !a.path.length && a.pose !== 'sit' && a.pose !== 'jump') {
            a.face = l.x >= a.x ? 1 : -1;
            if (!a.greeted) { a.greeted = true; this.setPose(a, 'jump', 1.1); this.emote(a, '♥', 1.8); l.face = a.x >= l.x ? 1 : -1; this.react(l, 'dog'); }
            else this.setPose(a, 'sit', 1.2);
          }
        }
      } else if (a.sp === 'deer') {
        const h = !a.moving && a.cool <= 0 && people.find(o => dist(a, o) < 40);
        if (h) { a.cool = 11; a.face = h.x >= a.x ? 1 : -1; this.setPose(a, 'bow', 2.6); if (!h.moving) h.face = a.x >= h.x ? 1 : -1; this.react(h, 'deer', '♪'); return true; }
      } else if (a.sp === 'fox') {
        const h = people.find(o => o.moving && !TRUSTED.has(o.name) && dist(a, o) < 48);
        if (h && a.cool <= 0) { a.cool = 4; a.visit = null; this.emote(a, '!', 1); this.goAnimal(a, this.away(a, h, 120), true); return true; }
      } else if (a.sp === 'chicken') {
        const t = this.agents.find(o => o !== a && o.sp !== 'chicken' && o.sp !== 'sparrow' && !SPECIES[o.sp]?.water && o.moving && dist(a, o) < 24);
        if (t && a.cool <= 0) { a.cool = 1.6; if (this.goAnimal(a, this.away(a, t, rnd(34, 60)), true)) a.pose = 'flap'; if (t.kind === 'folk' && Math.random() < .3) this.react(t, 'chicken', '!'); return true; }
      }
      return false;
    }
    animalArrive(a, S) {
      if (a.sp === 'chicken') { this.setPose(a, 'stand', rnd(.3, .8)); return; }
      const h = a.visit; a.visit = null;
      if (h && this.agents.includes(h) && dist(a, h) < 26) {                // chegou em quem ia visitar
        a.face = h.x >= a.x ? 1 : -1; if (!h.moving) h.face = a.x >= h.x ? 1 : -1;
        this.setPose(a, 'sit', rnd(4, 7)); this.emote(a, '♥', 2.4); this.react(h, a.sp);
        return;
      }
      if (a.sniff) { a.sniff = false; this.setPose(a, 'sniff', rnd(1.6, 3)); return; }
      this.setPose(a, S.rest, rnd(.4, 1.4));
    }
    // Decide o que fazer quando fica à toa. Nada de rota: vontades de bicho.
    animalThink(a, S) {
      const r = Math.random(), people = this.people();
      if (a.sp === 'cat') {
        if (r < .2) this.setPose(a, 'sit', rnd(3, 6));
        else if (r < .36) this.setPose(a, 'groom', rnd(3, 5));
        else if (r < .47) { this.setPose(a, 'sleep', rnd(8, 15)); this.emote(a, 'z', a.wait); }
        else if (r < .52) this.setPose(a, 'stretch', 1.3);
        else if (r < .76) this.goAnimal(a, near(a.home, a.range));
        else {      // visita alguém que está parado: o peixeiro primeiro, depois quem cozinha, depois os heróis
          const still = people.filter(o => !o.moving && !o.path.length && dist(a, o) < 300);
          const h = still.length && pick(still.map(o => ({ o, w:o.name === 'Goro' ? 5 : o.name === 'Renji' || o.name === 'Yori' ? 2.5 : o.kind === 'hero' ? 2 : 1 }))).o;
          if (h && this.goAnimal(a, this.by(h))) a.visit = h; else this.setPose(a, 'sit', rnd(2, 4));
        }
      } else if (a.sp === 'dog') {
        if (a.follow) { a.wait = .4; return; }
        if (r < .42) {     // escolhe alguém para acompanhar: o menino do cata-vento, um herói, o guarda…
          const who = people.filter(o => o.kind === 'hero' || o.def?.route);
          const l = who.length && pick(who.map(o => ({ o, w:o.name === 'Tomo' ? 4 : o.kind === 'hero' ? 3 : o.name === 'Jinbei' ? 2 : 1 }))).o;
          if (l) { a.follow = l; a.followT = rnd(14, 26); a.greeted = false; a.wait = .2; } else a.wait = 1;
        }
        else if (r < .62) { if (this.goAnimal(a, near(a.home, a.range))) a.sniff = true; }
        else if (r < .74) this.setPose(a, Math.random() < .5 ? 'sit' : 'tilt', rnd(2, 4));
        else if (r < .86) { const h = people.filter(o => dist(a, o) < 90).sort((p, q) => dist(a, p) - dist(a, q))[0]; if (h) { a.face = h.x >= a.x ? 1 : -1; this.setPose(a, 'bow', 1.6); this.emote(a, '♪', 1.6); } else a.wait = 1; }
        else this.setPose(a, 'lie', rnd(5, 9));
      } else if (a.sp === 'deer') {
        if (r < .4) this.setPose(a, 'graze', rnd(4, 8));
        else if (r < .58) this.setPose(a, Math.random() < .5 ? 'stand' : 'look', rnd(2, 4));
        else if (r < .9) this.goAnimal(a, near(a.home, a.range));
        else this.setPose(a, 'lie', rnd(7, 12));
      } else if (a.sp === 'fox') {
        const friend = people.find(o => TRUSTED.has(o.name) && !o.moving && dist(a, o) < 130);
        if (friend && a.cool <= 0 && r < .3) { a.cool = 28; if (this.goAnimal(a, this.by(friend, 14))) a.visit = friend; return; }
        if (r < .3) this.setPose(a, 'sit', rnd(3, 6));
        else if (r < .44) { this.setPose(a, 'sleep', rnd(7, 12)); this.emote(a, 'z', a.wait); }
        else if (r < .52) this.setPose(a, 'yawn', 1.3);
        else if (r < .66) this.setPose(a, 'pounce', 1.5);
        else if (r < .78) { const h = people.filter(o => dist(a, o) < 150).sort((p, q) => dist(a, p) - dist(a, q))[0]; if (h) a.face = h.x >= a.x ? 1 : -1; this.setPose(a, 'alert', rnd(1.5, 3)); }
        else this.goAnimal(a, near(a.home, a.range));
      } else if (a.sp === 'chicken') {
        if (r < .55) this.setPose(a, 'peck', rnd(1.5, 3.5));
        else if (r < .7) this.setPose(a, 'stand', rnd(.6, 1.4));
        else this.goAnimal(a, near(a.home, a.range, 6));
      } else if (a.sp === 'sparrow') {
        if (r < .4) this.setPose(a, 'peck', rnd(.5, 1.2));
        else if (r < .6) this.setPose(a, 'look', rnd(.5, 1.4));
        else if (r < .75) this.setPose(a, 'stand', rnd(.4, 1));
        else { const p = near([a.x, a.y], 12, 5); if (p && this.goAnimal(a, p)) a.pose = 'hop'; else a.wait = .4; }
      }
    }
    // O bando de pardais: cisca num ponto; se alguém chega perto (ou de tempos em tempos), levanta voo junto e pousa noutro.
    updateFlock(dt) {
      const birds = this.agents.filter(o => o.sp === 'sparrow'); if (!birds.length || birds.some(b => b.fly)) return;
      const c = at(this.flock.perch), threat = this.agents.some(o => o.sp !== 'sparrow' && !SPECIES[o.sp]?.water && (o.moving || o.sp === 'cat') && Math.hypot(o.x - c[0], (o.y - c[1]) * 1.55) < 34);
      if ((this.flock.relocate -= dt) > 0 && !threat) return;
      const free = PERCHES.filter(n => n !== this.flock.perch && !this.agents.some(o => o.kind !== 'animal' && Math.hypot(o.x - at(n)[0], (o.y - at(n)[1]) * 1.55) < 46));
      if (!free.length) { this.flock.relocate = 3; return; }
      this.flock.perch = free[Math.floor(Math.random() * free.length)]; this.flock.relocate = rnd(18, 36);
      const to = at(this.flock.perch);
      birds.forEach(b => { const p = near(to, 16) || to, d = Math.hypot(p[0] - b.x, p[1] - b.y); b.path = []; b.fly = { x0:b.x, y0:b.y, x1:p[0], y1:p[1], t:-rnd(0, .4), dur:Math.max(.9, d / 150), lift:Math.min(95, 34 + d * .22) }; });
    }
    // Patos e carpas: nadam à toa no porto e se juntam perto de quem para no cais.
    swim(a, S, dt) {
      a.swimT = (a.swimT || 0) - dt;
      if (!a.tgt || a.swimT <= 0 || Math.hypot(a.tgt[0] - a.x, a.tgt[1] - a.y) < 2.5) {
        const fan = this.people().find(o => !o.moving && o.x > 880 && o.x < 1012 && o.y > 583 && o.y < 626);
        a.tgt = fan && Math.random() < .75 ? waterPoint([Math.min(944, Math.max(872, fan.x - 20)), 650], 22) : waterPoint();
        a.swimT = rnd(4, 9);
        if (a.sp === 'duck') { const r = Math.random(); a.pose = r < .6 ? 'float' : r < .8 ? 'dabble' : r < .92 ? 'preen' : 'flap'; a.hold = a.pose === 'float' ? 0 : rnd(1.2, 3); if (a.pose === 'flap') a.hold = 1; a.animT = 0; }
        if (fan && this.petCool <= 0 && Math.random() < .12) this.react(fan, 'water', '♪');
      }
      if (a.hold > 0) { a.hold -= dt; if (a.hold <= 0) a.pose = 'float'; return; }
      const dx = a.tgt[0] - a.x, dy = a.tgt[1] - a.y, d = Math.hypot(dx, dy) || 1, v = S.speed * (a.sp === 'koi' ? .7 + .5 * Math.sin(a.animT * 1.3 + a.id) ** 2 : 1) * dt;
      const nx = a.x + dx / d * v, ny = a.y + dy / d * v;
      if (inWater(nx, ny)) { a.x = nx; a.y = ny; } else a.tgt = null;
      if (Math.abs(dx) > .5) a.face = dx > 0 ? 1 : -1;
      const want = Math.atan2(dy, dx); let dh = want - a.heading; while (dh > Math.PI) dh -= 6.283; while (dh < -Math.PI) dh += 6.283; a.heading += dh * Math.min(1, dt * 3);
    }
    // O jogador toca num bicho: cada um responde do seu jeito.
    poke(a) {
      const v = VOICE[a.sp] || ['…'];
      this.agents.forEach(o => { o.speechFor = 0; o.manualSpeech = false; });
      this.dialoguePair = null; this.dialogueLine = 0; this.dialogueAt = 6;
      a.speech = v[Math.floor(Math.random() * v.length)]; a.speechFor = 2.4; a.speechAge = 0; a.manualSpeech = true;
      if (a.sp === 'cat') { this.setPose(a, 'sit', 3); this.emote(a, '♥', 2); }
      else if (a.sp === 'dog') { a.follow = null; this.setPose(a, 'jump', 1.2); this.emote(a, '♥', 2); }
      else if (a.sp === 'deer') this.setPose(a, 'bow', 2.4);
      else if (a.sp === 'fox') { this.emote(a, '!', 1); this.setPose(a, 'crouch', .5); a.cool = 0; }
      else if (a.sp === 'chicken') { if (this.goAnimal(a, near([a.x, a.y], 40, 6), true)) a.pose = 'flap'; }
      else if (a.sp === 'sparrow') this.flock.relocate = 0;
      else if (a.sp === 'duck') { a.pose = 'flap'; a.hold = 1.2; a.animT = 0; }
      else if (a.sp === 'koi') { a.tgt = null; a.swimT = 0; }
      return true;
    }
  }
  KT.TownLife = TownLife;
  KT.TownMap = { NODES:N, SPOTS, FOLK, SPECIES, ANIMALS, WATER, route, isWalk, snap, at };
})();
