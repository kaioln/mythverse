// Cidade viva de Tsukimori, em dois bairros: a capital (src/town-walk.js) e a Cidade Mercado (src/town-walk-market.js).
// Só se anda no chão medido sobre a arte (tools/build_walkmap.py): ruas, escadas e pontes. Rotas célula a célula (A*),
// espaço pessoal entre todos. Cada bairro tem os próprios pontos, moradores, falas e bichos (TOWNS, mais abaixo); o
// código é um só e trabalha sobre o bairro "em uso" (use), trocado na entrada de cada método público.
(() => {
  const KT = globalThis.KT = globalThis.KT || {};
  // ---- capital ----
  // Pontos de referência (1280×720). Quem anda usa o ponto encaixado no chão; vendedor parado fica ao lado da banca.
  const N0 = {
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
  const SPOTS0 = [
    {node:'forge',verb:'Olhando as lâminas',face:1,w:2},{node:'dojo',verb:'Treinando',face:-1,w:2},{node:'marketE',verb:'Pechinchando',face:-1,w:1},{node:'marketM',verb:'Provando chá',face:1,w:1},{node:'marketW',verb:'Vendo tecidos',face:1,w:1},
    {node:'guild',verb:'Lendo contratos',face:-1,w:1},{node:'temple',verb:'Olhando o portal',face:1,w:1},{node:'workshop',verb:'Vendo poções',face:1,w:1},
    {node:'bank',verb:'No banco',face:-1,w:1},{node:'garden',verb:'Descansando',face:1,w:1},{node:'plazaS',verb:'Conversando',face:1,w:1},
    {node:'shrine',verb:'Rezando',face:1,w:1},{node:'bridgeM',verb:'Vendo a cascata',face:-1,w:1},{node:'dockMid',verb:'Olhando os barcos',face:1,w:1}
  ];
  const DIALOGUES0 = [
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
  const FOLK0 = [
    {f:0,name:'Renji',post:'stallRenji',face:1,verb:'Vendendo lámen',festival:'ribbon',treat:2.5},{f:1,name:'Maki',post:'forgePost',face:-1,verb:'Martelando',festival:'ribbon'},{f:2,name:'Suzu',route:['templeL','templeR'],speed:12,verb:'Varrendo'},
    {f:3,name:'Hotaru',route:['shrine','shrineLantern'],speed:13,verb:'Acendendo lanternas',festival:'lantern'},
    {f:4,name:'Goro',post:'stallGoro',face:1,verb:'Vendendo peixe',treat:5},{f:5,name:'Aya',post:'stallAya',face:1,verb:'Servindo chá'},{f:6,name:'Tomo',route:['playMarketW','playMarketC','playMarketE','marketW'],speed:30,verb:'Correndo com o cata-vento',sheet:'kid',pal:4},
    {f:7,name:'Jinbei',route:['plazaW','guardSouth','plazaE','guardSouth'],speed:19,verb:'De ronda',pal:2},{f:8,name:'Natsu',post:'marketGuide',face:-1,verb:'Mercadora'},
    {f:9,name:'Daigo',route:['expedition','dockMid'],speed:15,verb:'Carregando caixas'},{f:3,name:'Koharu',post:'dance',face:1,verb:'Dançando',act:'dancer'},{f:6,name:'Riku',post:'drum',face:-1,verb:'Tocando tambor',act:'taiko'},
    {f:2,name:'Emi',post:'playB',face:-1,verb:'Entregando talismãs',festival:'ribbon'},{f:5,name:'Yori',post:'stallYori',face:-1,verb:'Fazendo doces',festival:'ribbon',treat:2.5},{f:0,name:'Fumi',post:'shrineStory',face:-1,verb:'Contando histórias'},
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
  const GREETINGS0 = {
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
  const ANIMALS0 = [
    { sp:'cat', name:'Mochi', home:'plazaS', range:170 }, { sp:'dog', name:'Pochi', home:'marketE', range:280 },
    { sp:'deer', name:'Shika', home:'garden', range:90 }, { sp:'fox', name:'Yuki', home:'shrineLantern', range:80 },
    { sp:'chicken', home:'marketW', range:44 }, { sp:'chicken', home:'marketW', range:44 }, { sp:'chicken', home:'marketGuest', range:40 },
    { sp:'sparrow' }, { sp:'sparrow' }, { sp:'sparrow' }, { sp:'sparrow' }, { sp:'sparrow' },
    { sp:'duck' }, { sp:'duck' }, { sp:'koi', variant:0 }, { sp:'koi', variant:1 }, { sp:'koi', variant:0 }, { sp:'koi', variant:1 }
  ];
  // Onde os pardais pousam (o bando escolhe um lugar, é espantado e vai para outro).
  const PERCHES0 = ['plazaE', 'plazaW', 'guardSouth', 'marketM', 'templeMid', 'dojoStairs', 'shrineStory', 'workshopGate', 'bankTop', 'guildSteps', 'eastLand'];
  // Água aberta do porto (1280×720), longe dos barcos: onde nadam os patos e as carpas.
  const WATER0 = [[866,638],[948,638],[952,676],[994,704],[988,715],[870,715],[858,694]];
  // O que as pessoas dizem quando um bicho vem até elas (nome do morador, ou '*' para qualquer um).
  const PET = {
    cat: { Goro:['Peixe não, Mochi! …Tá bom, só a cabeça.','De novo você? O freguês vem primeiro.'], Renji:['O caldo é quente, bichana. Sopre antes.'], Aya:['Sem pelo no chá, por favor!'], Yori:['Dango não é comida de gato, Mochi.'],
      Oharu:['Caqui não é para gato, Mikan. …Só um pedacinho.'], Wakana:['Na seda não, Mikan! Desce já daí.'], Otsuya:['Sem pelo na xícara dos fregueses, mocinha.'], '*':['Olha quem veio pedir carinho.','Quem é a gatinha mais esperta da praça?','Mochi! Cuidado com os meus pés.'] },
    dog: { Tomo:['Pega o cata-vento, Pochi!','Corre, Pochi, corre!'], Jinbei:['De ronda comigo, Pochi? Então atenção.'], Daigo:['Sai de baixo das caixas, amigo.'],
      Taro:['Corre, Kuro! Quem chegar por último lava as tigelas!'], Tetsu:['Ronda é coisa séria, Kuro. Junto.'], Masa:['Portão guardado por dois. Bom garoto.'], '*':['Bom garoto, Pochi!','Senta. Isso! Quem quer dango?','Hoje não tenho osso, amigo.'] },
    deer: { Mari:['As flores não são para comer!'], Suzu:['Devagar com os degraus, pequeno.'], '*':['Que educado! Tome um biscoito.','O cervo do jardim cumprimenta todo mundo.','Reverência para você também.'] },
    fox: { Hotaru:['A raposa branca veio ver as lanternas. Bom presságio.'], Fumi:['Dizem que ela guarda os nomes do santuário.'], Shun:['Não se assuste, pequena. Só vim deixar um nome.'], Akari:['Você gosta da minha lanterna, raposinha?'] },
    water: { Kai:['Os patos já conhecem a hora do pão.'], Minato:['Olha as carpas! Vieram ver as lanternas.'], Daigo:['Até os peixes querem as oferendas.'], Daisuke:['As carpas do riacho engordam com as migalhas da Casa de Chá.'], '*':['As carpas vêm sempre que alguém para aqui.'] },
    chicken: { Natsu:['Xô, xô! Longe das barracas!'], Kenta:['As galinhas daqui não têm medo de ninguém.'], Tomo:['Voem, voem!'], Roku:['Sai da frente, penosa, que a caixa pesa!'], Hanbei:['Essas vieram de carona na rota do sul. Ninguém as declarou.'] }
  };
  const VOICE = { cat:['Miau.', 'Mrrrau!', 'Prrrr…'], dog:['Au, au!', 'Uuuf!'], deer:['…'], fox:['Kon!'], chicken:['Có, có!'], duck:['Quá!'], sparrow:['Piu!'], koi:['…'] };
  const TRUSTED = new Set(['Hotaru', 'Fumi', 'Akari', 'Shun', 'Rei']);     // de quem a raposa não foge

  // ---- Cidade Mercado ----
  // O bairro dos mercadores, nos terraços do morro das lanternas (src/town-walk-market.js). A rede principal liga o
  // portão da capital, a escadaria, o largo do sul, o bazar, o Salão de Trocas (pela ponte do oeste), a Casa de Leilões
  // (com o mirante da ponte do norte), o pequeno santuário e a Casa de Chá (pela ponte do sul). O terraço do Empório e
  // o Pátio das Caravanas são ilhas: têm gente própria, que circula só ali.
  const N1 = {
    gate:[650,700], gateN:[648,652], stairs:[651,572], plaza:[640,528], plazaW:[620,506], plazaE:[690,528], cornerE:[745,512], eastWalk:[846,494], eastEnd:[872,497],
    stripW:[492,472], stripM:[548,484], bridgeW:[410,449], hall:[330,410], hallE:[352,396],
    aisle:[677,358], aisleN:[676,346], aisleS:[676,404], alley:[748,434], north:[622,328], northE:[706,333],
    pavStairs:[706,296], pavilion:[730,260], mirante:[866,255], wStairs:[530,262], shrine:[492,194],
    teaWalk:[924,624], teaLane:[968,650], southBridge:[806,636],
    emporium:[1080,386], empW:[962,358], empE:[1092,390], empStairs:[1140,425], empDown:[912,376],
    yard:[180,574], yardM:[300,586], yardE:[333,560], yardS:[378,636],
    // postos fixos (ficam onde a arte pede, mesmo fora do chão de quem anda)
    hallClerk:[291,403], hallCrier:[252,415], auctioneer:[693,231], bidder:[700,258], stallFruit:[444,410], stallSpice:[661,380], stallTools:[694,388],
    stallCloth:[668,515], stallCharm:[826,483], shopkeeper:[1066,372], shopGuest:[1040,385], teaHost:[1012,657], teaGuest:[1046,657],
    caravan:[204,573], tally:[240,578], gateGuard:[618,712], monk:[476,176]
  };
  const SPOTS1 = [
    {node:'hall',verb:'Lendo as etiquetas de oferta',face:-1,w:2},{node:'aisle',verb:'Pechinchando',face:1,w:2},{node:'plaza',verb:'Conversando',face:1,w:1},
    {node:'eastWalk',verb:'Escolhendo um amuleto',face:1,w:1},{node:'stripM',verb:'Vendo cerâmica',face:-1,w:1},{node:'pavilion',verb:'Olhando o palco dos leilões',face:-1,w:1},
    {node:'mirante',verb:'Vendo a cascata',face:1,w:1},{node:'shrine',verb:'Rezando',face:-1,w:1},{node:'teaWalk',verb:'Sentindo o cheiro do chá',face:1,w:1},
    {node:'north',verb:'Olhando as lanternas',face:1,w:1},{node:'gateN',verb:'Chegando da capital',face:1,w:1},{node:'plazaE',verb:'Descansando',face:-1,w:1}
  ];
  const DIALOGUES1 = [
    {people:['Juzo','Tamae'],lines:[['Juzo','Katana do Abismo, pouco uso! Quem dá mais?'],['Tamae','Aqui não tem lance, Juzo. É preço na etiqueta e ouro na mesa.'],['Juzo','Então eu grito o preço. Alguém tem de avisar a praça!']]},
    {people:['Mon','Ginpachi'],lines:[['Mon','Quando o gongo toca de novo, mestre Ginpachi?'],['Ginpachi','Quando o palco estiver pronto. Leilão sem regra clara vira briga.'],['Mon','Vou guardando o meu ouro. O primeiro lote será meu.']]},
    {people:['Shichiro','Benzo'],lines:[['Shichiro','O seu cordão de lanternas tampa a minha placa de novo.'],['Benzo','E o cheiro da sua pimenta espanta a minha freguesia.'],['Shichiro','Meio a meio: você sobe a corda, eu tampo o pote.']]},
    {people:['Ume','Kogoro'],lines:[['Ume','Esta poção cura ou só tem gosto de cereja?'],['Kogoro','Cura. O gosto é cortesia da casa.'],['Ume','Levo três. Minha filha parte com a expedição ao amanhecer.']]},
    {people:['Sakichi','Otsuya'],lines:[['Sakichi','Mais uma xícara, dona Otsuya. A notícia do deserto pede calma.'],['Otsuya','As caravanas atrasaram outra vez?'],['Sakichi','Chegaram. Mas falam de areia andando sozinha perto do Relógio.']]},
    {people:['Otane','Hanbei'],lines:[['Otane','Faltam duas caixas da rota do sul.'],['Hanbei','Não faltam: ficaram de pedágio com os barqueiros da maré.'],['Otane','Então anoto. O preço de hoje sobe um pouco no bazar.']]}
  ];
  const FOLK1 = [
    {f:0,name:'Tamae',post:'hallClerk',face:-1,verb:'Registrando as ofertas'},{f:7,name:'Juzo',post:'hallCrier',face:1,verb:'Anunciando as ofertas do dia'},
    {f:9,name:'Ginpachi',post:'auctioneer',face:1,verb:'Preparando o palco dos leilões'},{f:4,name:'Mon',post:'bidder',face:-1,verb:'Esperando o primeiro leilão'},
    {f:5,name:'Oharu',post:'stallFruit',face:1,verb:'Vendendo caquis e doces',treat:2.5},{f:1,name:'Shichiro',post:'stallSpice',face:1,verb:'Vendendo especiarias'},
    {f:8,name:'Benzo',post:'stallTools',face:-1,verb:'Vendendo ferragens e cordas'},{f:3,name:'Wakana',post:'stallCloth',face:1,verb:'Medindo tecidos'},
    {f:2,name:'Chidori',post:'stallCharm',face:-1,verb:'Vendendo amuletos'},{f:0,name:'Kogoro',post:'shopkeeper',face:-1,verb:'Cuidando do Empório'},
    {f:5,name:'Ume',post:'shopGuest',face:1,verb:'Escolhendo poções'},{f:3,name:'Otsuya',post:'teaHost',face:1,verb:'Servindo chá'},
    {f:8,name:'Sakichi',post:'teaGuest',face:-1,verb:'Tomando chá'},{f:9,name:'Hanbei',post:'caravan',face:1,verb:'Mestre das caravanas'},
    {f:2,name:'Otane',post:'tally',face:-1,verb:'Conferindo a carga'},{f:7,name:'Masa',post:'gateGuard',face:1,verb:'Guardando o portão'},
    {f:4,name:'Jakuen',post:'monk',face:-1,verb:'Cuidando do pequeno santuário'},
    // Quem circula.
    {f:7,name:'Tetsu',route:['gateN','plaza','eastWalk','plaza'],speed:19,verb:'De ronda',pal:2},
    {f:6,name:'Taro',route:['plazaW','stripM','plaza','plazaE'],speed:30,verb:'Correndo entre as barracas',sheet:'kid',pal:4},
    {f:5,name:'Sen',route:['aisle','northE','aisleS','alley'],speed:14,verb:'Comparando preços'},
    {f:1,name:'Yohei',route:['eastWalk','cornerE','stairs','plazaE'],speed:15,verb:'Procurando um presente'},
    {f:2,name:'Rin',route:['pavilion','mirante','pavStairs'],speed:13,verb:'Vendo a cascata do mirante'},
    {f:3,name:'Kiyo',route:['north','aisleN','northE','wStairs'],speed:13,verb:'Acendendo as lanternas do bazar'},
    {f:0,name:'Fuyu',route:['hallE','bridgeW','stripW','hall'],speed:14,verb:'Levando etiquetas ao Salão'},
    {f:8,name:'Daisuke',route:['teaWalk','southBridge','gateN','teaLane'],speed:14,verb:'Indo tomar chá'},
    {f:1,name:'Gohei',route:['shrine','wStairs','north'],speed:12,verb:'Subindo ao pequeno santuário'},
    {f:9,name:'Roku',route:['yard','yardM','yardS','yardE'],speed:14,verb:'Carregando caixas'},
    {f:4,name:'Isuke',route:['empW','empE','emporium'],speed:13,verb:'Olhando a vitrine do Empório'}
  ];
  const GREETINGS1 = {
    Tamae:['Bem-vindo ao Salão de Trocas. Aqui quem põe o preço é quem vende, e a casa fica com uma taxa pequena pelo balcão.','Só aceitamos ouro. Cristal, promessa e história triste ficam do lado de fora do noren.'],
    Juzo:['Oferta nova no Salão! Espólio de caçada, carta rara, material de forja: tudo com etiqueta e preço!','Minha voz chega até a Casa de Leilões. Ginpachi diz que eu devia cobrar por ela.'],
    Ginpachi:['A Casa de Leilões abre quando o palco estiver pronto. Um gongo, um lote, lances em ouro: quem der mais leva.','Guardo este gongo desde antes da Fenda. Ele só toca quando a cidade tem algo raro para disputar.'],
    Mon:['Vim cedo para pegar o melhor lugar. Dizem que o primeiro lote vem do Bosque das Lanternas.','Leilão é como caçada: ganha quem sabe a hora de parar.'],
    Oharu:['Caqui seco, castanha e doce de feijão. O gato já provou: está aprovado.','A fruta sobe do porto ao amanhecer. No fim da tarde, o que sobra vira doce.'],
    Shichiro:['Pimenta do deserto, sal das marés, raiz do pântano. Cada caravana traz um cheiro novo.','O Grande Bazar muda de oferta todo dia. O que você não achou hoje pode chegar amanhã.'],
    Benzo:['Corda, prego, gancho e lanterna. Aventureiro esquece a corda e lembra dela no fundo do poço.','O ferro vem da Forja da capital. Maki reclama do preço, mas nunca recusa uma encomenda.'],
    Wakana:['Seda para festa, linho para viagem. O tecido certo dura mais que muita armadura.','As faixas do festival saíram desta banca. Reconheço uma por uma na praça da capital.'],
    Chidori:['Amuleto não segura golpe. Segura a mão de quem o carrega, e isso às vezes basta.','Este aqui leva o nome de quem espera por você. Escolha com calma.'],
    Kogoro:['Empório Sakura, três andares de tudo o que uma expedição esquece em casa.','Poção, chave e pergaminho têm preço justo. Fiado, só para quem já voltou inteiro uma vez.'],
    Ume:['Minha filha parte ao amanhecer. Levo poção, não conselho: ela não escuta mesmo.'],
    Otsuya:['A Casa de Chá é onde a cidade conversa. Sente, conte de onde veio, ouça para onde os outros vão.','Chá de cerejeira para quem chega, chá forte para quem parte. A casa não fecha em noite de lanternas.'],
    Sakichi:['Viajo com as caravanas há vinte anos. Notícia boa chega devagar; a ruim vem a galope.','Se quer saber do mundo, pergunte numa casa de chá. Se quer saber do preço, pergunte ao Hanbei.'],
    Hanbei:['Cada carroça traz a cotação de onde veio. Antes de vender no bazar, veja quanto o mundo paga hoje.','Rota do deserto, rota da maré, rota do gelo. Só não faço a rota da Fenda: de lá ninguém traz troco.'],
    Otane:['Conto as caixas na chegada e na saída. O que some no meio vira história de caravaneiro.'],
    Masa:['A capital fica logo abaixo: desça a escadaria do portão. A estrada é guardada dia e noite.','Mercador entra, mercadoria entra. Briga fica do lado de fora.'],
    Jakuen:['O pequeno santuário guarda a moeda da primeira venda de cada mercador. É promessa de troco justo.','Suba devagar. Daqui se vê o bazar inteiro e, lá embaixo, as lanternas da capital.'],
    Tetsu:['Ronda do portão ao largo do leste. Bolso de visitante é o que mais some em dia de feira.'],
    Taro:['Eu sei onde cada mercador esconde o doce! Mas não conto.','Um dia vou ter a maior barraca do bazar. Vai vender só cata-vento.'],
    Sen:['O mesmo fio custa três preços em três barracas. Comparar é metade da compra.'],
    Yohei:['Procuro um presente para a minha irmã na Guilda. Amuleto ou tecido? Ela tem de tudo.'],
    Rin:['Do mirante dá para ver a água cair até o riacho do portão. O barulho do bazar some aqui em cima.'],
    Kiyo:['Acendo cada cordão antes de escurecer. Bazar sem lanterna vende a metade.'],
    Fuyu:['Levo as etiquetas novas ao Salão de Trocas. Preço escrito à mão: ninguém discute com tinta.'],
    Daisuke:['Atravesso a ponte do sul só pelo chá da dona Otsuya. E pelas carpas do riacho.'],
    Gohei:['Deixo uma moeda no santuário antes de fechar um negócio grande. Nunca perdi dinheiro assim.'],
    Roku:['Caixa pesada é boa notícia: quer dizer que a caravana voltou cheia.'],
    Isuke:['A vitrine do Empório muda toda semana. Hoje é dia de pergaminho.']
  };
  const ANIMALS1 = [
    { sp:'cat', name:'Mikan', home:'plaza', range:150 }, { sp:'dog', name:'Kuro', home:'plazaE', range:220 },
    { sp:'chicken', home:'yardM', range:40 }, { sp:'chicken', home:'yardM', range:40 }, { sp:'chicken', home:'yard', range:30 },
    { sp:'sparrow' }, { sp:'sparrow' }, { sp:'sparrow' }, { sp:'sparrow' }, { sp:'sparrow' },
    { sp:'duck' }, { sp:'koi', variant:0 }, { sp:'koi', variant:1 }
  ];
  const PERCHES1 = ['plazaE', 'plaza', 'gateN', 'eastWalk', 'north', 'pavilion', 'hallE', 'stripM', 'aisleN', 'teaWalk'];
  // O poço do riacho sob a ponte do sul: onde nadam o pato e as carpas.
  const WATER1 = [[784,672],[798,666],[812,670],[826,680],[842,684],[846,696],[842,714],[808,714],[798,700],[784,688]];

  // ---- os bairros ----
  // walk = grade do chão (KT[walk]) · areas = polígonos que entram inteiros no chão · size = altura de um adulto (px, no
  // meio da cena) · k = escala de passo e de espaço pessoal (gente maior anda e se afasta mais) · starts = onde os heróis
  // aparecem · dock = onde alguém parado atrai os peixes, e para onde eles vêm.
  const TOWNS = {
    capital:{ walk:'TownWalk', areas:[[[515,410],[568,393],[640,397],[686,419],[693,445],[664,463],[558,465],[512,443]]], size:34, k:1,
      N:N0, SPOTS:SPOTS0, DIALOGUES:DIALOGUES0, FOLK:FOLK0, GREETINGS:GREETINGS0, ANIMALS:ANIMALS0, PERCHES:PERCHES0, WATER:WATER0,
      starts:['plazaN', 'forge', 'marketE', 'dojo', 'garden', 'shrine'], perch:'plazaE', home:'plaza',
      waterBox:[858,994,638,715], waterHome:[905,672], dock:{ x0:880, x1:1012, y0:583, y1:626, gx0:872, gx1:944, dx:-20, gy:650, r:22 } },
    market:{ walk:'TownWalkMarket', areas:[], size:40, k:1.18,
      N:N1, SPOTS:SPOTS1, DIALOGUES:DIALOGUES1, FOLK:FOLK1, GREETINGS:GREETINGS1, ANIMALS:ANIMALS1, PERCHES:PERCHES1, WATER:WATER1,
      starts:['gateN', 'plaza', 'stairs', 'plazaE', 'gate', 'plazaW'], perch:'plazaE', home:'plaza',
      waterBox:[784,846,666,714], waterHome:[816,694], dock:{ x0:752, x1:862, y0:626, y1:664, gx0:796, gx1:836, dx:0, gy:690, r:14 } }
  };
  let T = null, N, SPOTS, DIALOGUES, FOLK, GREETINGS, ANIMALS, PERCHES, WATER, SIZE = 34, K = 1;

  // ---- chão ----
  // O chão é o desenho de caminhos feito sobre a arte (src/town-walk*.js, gerado por tools/build_walkmap.py): ruas,
  // escadas, pontes e pátios exatamente onde foram traçados. Na capital a praça central entra inteira (o traço em espiral
  // deixava frestas) e frestas de uma célula são fechadas. Nada de linhas aproximadas por cima de muros e telhados.
  function inside(x, y, polygon) {
    let on = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [ax, ay] = polygon[i], [bx, by] = polygon[j];
      if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) on = !on;
    }
    return on;
  }
  let G = null, GW = 640, GH = 360, CELL = 2, EDGE = null, P = {};
  let GAP = 16;               // espaço pessoal (px, com o eixo y achatado pela perspectiva)
  let STAND_GAP = 12, POST_GAP = 9, FOLLOW_GAP = 15;   // distância ao contornar quem está parado / vendedor na banca / fila
  // Põe um bairro "em uso": pontos, moradores, falas, bichos, grade do chão e medidas passam a ser os dele.
  function use(t) {
    if (T === t) return; T = t;
    ({ N, SPOTS, DIALOGUES, FOLK, GREETINGS, ANIMALS, PERCHES, WATER } = t); SIZE = t.size; K = t.k;
    GAP = 16 * K; STAND_GAP = 12 * K; POST_GAP = 9 * K; FOLLOW_GAP = 15 * K;
    const g = t.ground; G = g ? g.G : null; EDGE = g ? g.EDGE : null; if (g) { GW = g.GW; GH = g.GH; CELL = g.CELL; } else { GW = 640; GH = 360; CELL = 2; }
    P = t.snapped ||= {};
  }
  function grid() {
    if (G) return G;
    const W = KT[T.walk]; if (!W) { G = new Uint8Array(GW * GH); EDGE = new Uint8Array(GW * GH); return G; }
    GW = W.w; GH = W.h; CELL = W.cell; G = new Uint8Array(GW * GH);
    W.rows.split(';').forEach((row, cy) => { let x = 0, on = false; for (const n of row.split(',')) { const len = Number(n); if (on && cy < GH) G.fill(1, cy * GW + x, cy * GW + Math.min(GW, x + len)); x += len; on = !on; } });
    for (const area of T.areas) for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) if (!G[cy * GW + cx] && inside(cx * CELL + CELL / 2, cy * CELL + CELL / 2, area)) G[cy * GW + cx] = 1;
    // Fecha frestas finas do traço: célula vazia com chão dos dois lados (na horizontal ou na vertical) vira chão.
    const gap = []; for (let cy = 1; cy < GH - 1; cy++) for (let cx = 1; cx < GW - 1; cx++) { const i = cy * GW + cx; if (!G[i] && ((G[i - 1] && G[i + 1]) || (G[i - GW] && G[i + GW]))) gap.push(i); }
    gap.forEach(i => { G[i] = 1; });
    EDGE = new Uint8Array(GW * GH); const q = [];                    // distância até a borda: a rota prefere o meio do caminho
    for (let i = 0; i < G.length; i++) { if (G[i]) EDGE[i] = 255; else q.push(i); }
    for (let h = 0; h < q.length; h++) { const i = q[h], x = i % GW, y = (i / GW) | 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue; const j = ny * GW + nx; if (EDGE[j] > EDGE[i] + 1) { EDGE[j] = EDGE[i] + 1; q.push(j); } } }
    T.ground = { G, EDGE, GW, GH, CELL };
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
  const at = n => (P[n] ||= snap(...N[n]));   // ponto encaixado no chão (guardado por bairro)

  const pick = list => { const total = list.reduce((s, x) => s + x.w, 0); let r = Math.random() * total; for (const x of list) if ((r -= x.w) < 0) return x; return list[0]; };
  const depth = y => .78 + .3 * Math.max(0, Math.min(1, (y - 160) / 540));
  const dist = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * 1.55);
  const rnd = (a, b) => a + Math.random() * (b - a);
  // Um ponto de chão ao acaso a até r px de c (ou null).
  const near = (c, r, tries = 10) => { for (let i = 0; i < tries; i++) { const g = Math.random() * 6.283, d = r * (.25 + .75 * Math.random()), x = c[0] + Math.cos(g) * d, y = c[1] + Math.sin(g) * d / 1.55; if (isWalk(x, y)) return [x, y]; } return null; };
  const inWater = (x, y) => inside(x, y, WATER);
  const waterPoint = (c = null, r = 30) => { const B = T.waterBox; for (let i = 0; i < 24; i++) { const x = c ? c[0] + rnd(-r, r) : rnd(B[0], B[1]), y = c ? c[1] + rnd(-r, r) * .6 : rnd(B[2], B[3]); if (inWater(x, y)) return [x, y]; } return T.waterHome.slice(); };

  class TownLife {
    constructor(town = 'capital') { this.town = TOWNS[town] || TOWNS.capital; this.agents = []; this.key = null; this.dialogueAt = 4; this.dialogue = 0; this.dialogueLine = 0; this.dialoguePair = null; }
    sync(heroes) {
      const key = heroes.map(h => h.uid + h.sprite).join('|'); if (key === this.key) return; this.key = key;
      this.dialoguePair = null; this.dialogueLine = 0; this.dialogueAt = 4;
      const starts = T.starts;
      this.agents = heroes.map((h, i) => { const [x, y] = at(starts[i % starts.length]); return { id:i, kind:'hero', ...h, x, y, path:[], wait:1.5 + i, face:1, speed:(28 + i * 1.5) * K, speedNow:0, verb:'', walkT:Math.random(), walkD:0, animT:Math.random() * 5, speech:'', speechFor:0 }; })
        .concat(FOLK.map((f, i) => { const [x, y] = f.post ? N[f.post] : at(f.route[0]); return { id:heroes.length + i, kind:'folk', f:f.f, def:f, name:f.name, x, y, fixed:!!f.post, path:[], wait:1 + Math.random() * 3, face:f.face || 1, speed:(f.speed || 0) * K, speedNow:0, verb:f.verb, ri:0, walkT:Math.random(), walkD:0, animT:f.act ? (f.beat || 0) * 4 : Math.random() * 5, speech:'', speechFor:0 }; }));
      const placed = [];
      this.flock = { perch:T.perch, relocate:rnd(14, 26) };
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
              const angle = i * Math.PI / 8, x = a.x + Math.cos(angle) * radius * K, y = a.y + Math.sin(angle) * radius * K / 1.55;
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
      for (const r0 of [20, 30, 46]) for (let i = 0; i < 8; i++) {
        const r = r0 * K, q = snap(p[0] + Math.cos(turn + i * Math.PI / 4) * r, p[1] + Math.sin(turn + i * Math.PI / 4) * r / 1.55);
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
          const choices = SPOTS.filter(s => s !== a.spot && this.free(a, at(s.node))), s = choices.length ? pick(choices) : null;
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
      if (this.dialoguePair && (this.dialoguePair.some(a => a.moving || a.path.length) || dist(...this.dialoguePair) >= 72 * K)) {
        this.dialoguePair.forEach(a => { if (!a.manualSpeech) { a.speech = ''; a.speechFor = 0; } });
        this.dialoguePair = null; this.dialogueLine = 0; this.dialogue++; this.dialogueAt = 8;
      }
      if ((this.dialogueAt -= dt) > 0 || this.agents.some(a => a.manualSpeech && a.speechFor > 0)) return;
      for (let tries = 0; tries < DIALOGUES.length; tries++) {
        const d = DIALOGUES[this.dialogue % DIALOGUES.length], people = d.people.map(n => this.agents.find(a => a.name === n));
        if (people.every(a => a && !a.moving && !a.path.length) && dist(people[0], people[1]) < 72 * K) {
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
    drawList() { return this.agents.map(a => ({ a, s:depth(a.y), h:SIZE * depth(a.y) })).sort((p, q) => p.a.y - q.a.y); }

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
      a.pace = (run ? S.run || S.speed : S.speed) * K; a.pose = null; return true;
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
          const h = still.length && pick(still.map(o => ({ o, w:o.def?.treat || (o.kind === 'hero' ? 2 : 1) }))).o;
          if (h && this.goAnimal(a, this.by(h))) a.visit = h; else this.setPose(a, 'sit', rnd(2, 4));
        }
      } else if (a.sp === 'dog') {
        if (a.follow) { a.wait = .4; return; }
        if (r < .42) {     // escolhe alguém para acompanhar: o menino do cata-vento, um herói, o guarda…
          const who = people.filter(o => o.kind === 'hero' || o.def?.route);
          const l = who.length && pick(who.map(o => ({ o, w:o.def?.pal || (o.kind === 'hero' ? 3 : 1) }))).o;
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
        const D = T.dock, fan = this.people().find(o => !o.moving && o.x > D.x0 && o.x < D.x1 && o.y > D.y0 && o.y < D.y1);
        a.tgt = fan && Math.random() < .75 ? waterPoint([Math.min(D.gx1, Math.max(D.gx0, fan.x + D.dx)), D.gy], D.r) : waterPoint();
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
  // Todo método público trabalha sobre o bairro da própria cidade viva (duas podem existir ao mesmo tempo).
  for (const name of Object.getOwnPropertyNames(TownLife.prototype)) {
    if (name === 'constructor') continue;
    const fn = TownLife.prototype[name];
    TownLife.prototype[name] = function(...args) { use(this.town); return fn.apply(this, args); };
  }
  use(TOWNS.capital);
  // O mapa de um bairro para quem está de fora (testes, ferramentas): mesmas funções, sempre sobre aquele bairro.
  const mapOf = t => { const on = fn => (...args) => { use(t); return fn(...args); }; return { NODES:t.N, SPOTS:t.SPOTS, FOLK:t.FOLK, SPECIES, ANIMALS:t.ANIMALS, WATER:t.WATER, home:t.home, size:t.size, route:on(route), isWalk:on(isWalk), snap:on(snap), at:on(at) }; };
  KT.TownLife = TownLife;
  KT.TownMap = { ...mapOf(TOWNS.capital), towns:Object.keys(TOWNS), of:name => (TOWNS[name] ? (TOWNS[name].map ||= mapOf(TOWNS[name])) : null) };
})();
