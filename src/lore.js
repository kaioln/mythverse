// Lore do Mythverse: o mundo, os mundos de origem e a história de cada herói.
// Só texto (sem regra de jogo). Aparece na ficha do herói (aba História) e na Enciclopédia.
(() => {
  const KT = globalThis.KT = globalThis.KT || {};

  const world = [
    { title:'Tsukimori, a cidade sob o Véu', text:'Tsukimori nasceu em volta de um lago que refletia a lua mesmo em noites sem lua. Os primeiros moradores descobriram que o reflexo era uma porta: o Véu, uma película de luz que separa este mundo de todos os outros. Por gerações, as Guardiãs do Véu o teceram com lanternas e cantos, e a cidade cresceu em oito distritos entre montanhas, canais e cerejeiras.' },
    { title:'O Eclipse', text:'Há três invernos a lua foi engolida. No lugar dela surgiu o Eclipse, um disco negro que não se move. Com ele vieram criaturas que não pertencem a nenhum mundo: onis de névoa, raposas de sombra, autômatos sem dono. Sayo, a última Guardiã, percebeu que o Eclipse não era uma coisa só: quatro senhores o sustentavam, cada um preso a um selo antigo que eles mesmos quebraram.' },
    { title:'Os quatro selos', text:'Shirogane, o Rei do Eclipse, guarda o primeiro selo no Santuário do Véu. Mizuchi, o Dragão Abissal, afundou o segundo sob a Costa das Marés. Apep, a Serpente do Tempo, enrolou o terceiro nas Areias onde um dia dura um segundo. Raijin, o Tambor do Trovão, rachou o céu para esconder o quarto entre as Ilhas Flutuantes. Cada selo restaurado devolve um pedaço da lua.' },
    { title:'A Fenda', text:'Para lutar, Sayo fez o impensável: rasgou o Véu. A ferida virou a Fenda, um corredor sem fundo por onde heróis de outros mundos atravessam, atraídos por quem precisa deles. Ninguém chega por acaso. Cada viajante carrega uma dívida, uma promessa ou uma pergunta que só Tsukimori pode responder. A Fenda também deixa passar coisas piores, e quanto mais fundo se desce, mais antigo é o que se encontra.' },
    { title:'Os laços', text:'Heróis do mesmo mundo se reconhecem na Fenda como quem ouve o próprio nome numa multidão. Lutando juntos, o Véu os fortalece: é o Kizuna, o laço que dá nome às ultimates em sequência. Sayo acredita que o Eclipse só cai para quem luta junto.' },
    { title:'As Invasões', text:'Duas vezes por dia a Fenda se abre sobre a cidade e algo grande demais para uma equipe atravessa. Nessas horas todos os viajantes de Tsukimori lutam juntos, e a vida da criatura é dividida entre todos. É assim que as guildas nasceram: de gente que não queria enfrentar a próxima Invasão sozinha.' }
  ];

  // Mundos de origem (nome exibido e resumo). A chave é o nome usado no elenco (src/roster.js).
  const worlds = {
    'Picos de Aurum':{ text:'Montanhas douradas onde o sol nunca se põe por completo. Os magos solares e a nobreza de esgrima disputam há séculos quem manda nos picos.' },
    'Vale dos Cataventos':{ text:'Uma vila de moinhos presa entre dois ventos. Todo menino aprende a segurar um escudo contra a ventania; todo estudioso, a ler as tempestades.' },
    'Arquipélago das Velas':{ text:'Mil ilhas ligadas por pontes de corda e barcos. Lá, uma dívida se paga com uma viagem, e uma viagem nunca termina.' },
    'Mosteiro da Lua Minguante':{ text:'Um mosteiro no topo de uma montanha nevada, onde espadachins e curandeiras guardam a última luz antes da noite.' },
    'Aldeia do Rio Cinzento':{ text:'Uma aldeia de ferreiros e pescadores às margens de um rio que carrega cinzas de um vulcão adormecido.' },
    'Academia do Véu':{ text:'A escola onde se estuda o próprio Véu, em outro mundo que também tem uma lua falsa. Professores e alunos desconfiam de tudo, principalmente dos livros.' },
    'Fronteira de Eldria':{ text:'Uma cadeia de fortes de pedra que protege os campos do reino de algo que vive do outro lado da serra. A patrulha nunca dorme inteira.' },
    'Cidade dos Alambiques':{ text:'Uma cidade de vidro e cobre onde tudo se transforma em outra coisa, inclusive os soldados, que trocaram espadas por pólvora e fórmulas.' },
    'Liga dos Juramentos':{ text:'Uma escola de oficinas onde cada aluno constrói a própria arma e faz um juramento diante da turma. Quebrar o juramento é quebrar a arma.' },
    'Cidade dos Mil Degraus':{ text:'Uma cidade vertical de escadarias sem fim. Os monges treinam subindo; os autômatos, carregando o que os monges esquecem.' },
    'Floresta de Raízes Altas':{ text:'Árvores tão grandes que há vilas dentro delas. Crianças aprendem a caçar antes de aprender a ler, e ninguém sabe quem plantou a primeira raiz.' },
    'Reino da Lua Prateada':{ text:'Um reino em que a lua ainda brilha e as sacerdotisas a embalam com lanternas. Quando souberam do Eclipse, mandaram a melhor delas.' },
    'Ilhas da Bruma':{ text:'Ilhas cobertas por uma névoa que apaga lembranças. Espíritos e espadachins vivem lado a lado, e ninguém confia totalmente no próprio passado.' },
    'Valmar':{ text:'Uma república de guildas. Tudo em Valmar tem contrato, carimbo e taxa, até a coragem.' },
    'Estrada dos Dojos':{ text:'Uma estrada de peregrinação com um dojo a cada dia de caminhada. Quem chega ao fim pode desafiar o mestre sem nome.' },
    'Coroa Esmeralda':{ text:'Um império caído onde mercenários e bruxos disputam as ruínas de uma coroa verde que ainda canta à noite.' },
    'Deserto dos Mapas Perdidos':{ text:'Um deserto que muda de forma. Quem desenha o mapa certo encontra cidades inteiras enterradas.' },
    'Terras do Gelo Longo':{ text:'Um inverno que dura gerações. As famílias contam a idade pelo número de invernos que sobreviveram juntas.' },
    'Frota de Órion':{ text:'Uma frota de naves-cidade que perdeu o próprio planeta e vaga entre estrelas protegendo quem sobrou.' },
    'Forjas do Abismo':{ text:'Um mundo em chamas onde carrascos de ferro guardam portões que nunca devem ser abertos.' },
    'Galerias de Sucata':{ text:'Túneis cheios de máquinas quebradas e crianças que as consertam. Tudo explode um pouco, e ninguém acha isso um problema.' },
    'Bosque das Nove Lanternas':{ text:'Um bosque de espíritos-raposa que acendem lanternas para guiar os perdidos, ou para perdê-los de vez.' },
    'Estepes do Vento Solto':{ text:'Planícies sem fim onde o vento carrega conversas de quilômetros. Espadachins andarilhos vivem de duelo em duelo.' },
    'Esquadrão Aurora':{ text:'Não é um lugar: é um esquadrão de resgate que atravessa mundos em crise. Três deles estavam em missão quando a Fenda os puxou.' },
    'Irmandade dos Telhados':{ text:'Uma cidade de telhados colados onde uma irmandade secreta protege os fracos sem que eles saibam.' },
    'Cidade da Névoa Verde':{ text:'Uma cidade tomada por uma névoa doente. Os que sobraram aprenderam a lutar e a curar com o que tinham.' },
    'Planalto dos Coiotes':{ text:'Uma fronteira de ranchos, trens e foras-da-lei, onde a palavra de alguém vale mais que ouro.' },
    'Vale das Runas':{ text:'Um vale onde cada pedra tem uma runa. Ferreiros-magos ensinam aprendizes a acender o metal com palavras.' },
    'Cidadela Autômata':{ text:'Uma cidade de máquinas que acordaram sem saber por quê. Algumas procuram quem as construiu; outras, um motivo para lutar.' },
    'Cidade do Pacto Carmesim':{ text:'Uma cidade onde cada família fez um pacto com um demônio. Os filhos herdam o pacto e decidem o que fazer com ele.' },
    'Selva de Engrenagens':{ text:'Uma selva onde bichos e máquinas cresceram juntos. Caçadores respeitam as duas coisas.' },
    'Arena das Cinzas':{ text:'Um torneio eterno num vulcão. Campeões lutam por nomes que perderam e raramente os recuperam.' }
  };

  // Biografia e fala de cada herói (id do elenco).
  const heroes = {
    solen:{ bio:'Aprendiz de mago solar dos Picos de Aurum, Hinata cortou o próprio cabelo no dia em que foi expulso da escola por "brilhar alto demais". A cicatriz no rosto veio do primeiro feitiço que funcionou. Atravessou a Fenda atrás de uma luz que ninguém mais via, e achou Tsukimori sem lua.', quote:'Se o céu apagou, alguém tem que acender.' },
    varyon:{ bio:'Filho mais novo de uma casa de esgrima de Aurum, Shiden nunca venceu o irmão mais velho, e nunca perdeu para mais ninguém. Chegou a Tsukimori entediado e ficou quando descobriu que Hinata, seu velho rival de escola, também estava lá.', quote:'Levante a guarda. Eu só vou avisar uma vez.' },
    hayato:{ bio:'Hayato segurava o escudo do moinho da família contra a ventania desde os oito anos. É barulhento, come demais e ri de tudo, menos de quem ameaça os amigos. Jurou proteger Rai quando os dois ainda eram crianças, e leva o juramento a sério até hoje.', quote:'Fica atrás de mim. Sempre.' },
    ren:{ bio:'Rai estudava tempestades no Vale dos Cataventos e escrevia talismãs de trovão à noite, sem dormir. Fala pouco e só com quem confia. A Fenda o puxou no meio de um raio, e ele ainda tenta entender se foi acidente.', quote:'Raio não erra. Quem erra é quem não lê o céu.' },
    tobias:{ bio:'Capitão de um barco que afundou três vezes, Tobimaru pagou cada dívida com uma viagem e ficou devendo todas. Carrega a âncora do primeiro barco como arma. Chama todo mundo de "tripulação", inclusive inimigos.', quote:'Âncora ao mar! E quem estiver embaixo que se vire.' },
    kenji:{ bio:'Kenji perdeu o olho numa aposta que ganhou. Espadachim de aluguel no Arquipélago, viajava no barco de Tobimaru até o dia em que os dois caíram juntos na Fenda. Carrega uma lâmina longa e duas curtas porque "uma espada só é pouca conversa".', quote:'Três lâminas. Escolha qual vai te acertar.' },
    hiro:{ bio:'Hiro guarda o Mosteiro da Lua Minguante há poucos anos, mas já enterrou mais irmãos do que gostaria. A mecha branca apareceu na noite em que a lua do seu mundo também começou a sumir. Veio a Tsukimori para descobrir se é o mesmo Eclipse.', quote:'A noite é longa. Eu sou mais.' },
    yuki:{ bio:'A menor curandeira do Mosteiro, Yuki toca o sino da neve para acalmar feridos e assustar lobos. É tímida com estranhos e corajosa com amigos. Seguiu Hiro para a Fenda sem pedir permissão a ninguém.', quote:'Respira. O frio passa. Eu fico.' },
    akira:{ bio:'Filho de pescador, Akira aprendeu a espada com o ferreiro da aldeia em troca de peixe. Protege a irmã mais nova, Hana, desde que o vulcão acordou e levou a casa deles. Conversa com o rio como quem conversa com um amigo velho.', quote:'A correnteza não briga com a pedra. Contorna, e vence.' },
    hana:{ bio:'Hana tem treze anos, um porrete de brasa e nenhuma paciência. Carrega uma ombreira de laca grande demais para ela, herança da mãe ferreira. Acha que o irmão se preocupa demais e está certa.', quote:'Eu não sou pequena. Você que é alto.' },
    sora:{ bio:'Professor da Academia do Véu, Sora estuda portais em livros que ele mesmo proibiu os alunos de ler. Chegou a Tsukimori de propósito, algo que ninguém mais conseguiu, e se recusa a explicar como.', quote:'Toda porta tem uma nota de rodapé.' },
    daichi:{ bio:'Aluno problema da Academia do Véu, Daichi tocou num livro amaldiçoado e ganhou manoplas que não saem. Em vez de chorar, aprendeu a bater mais forte. Sora é o único professor que nunca desistiu dele.', quote:'Maldição é só poder com péssimo atendimento.' },
    lucan:{ bio:'O veterano mais velho da patrulha de Eldria, Genzō já viu a serra cuspir coisas que ele se recusa a descrever. Ensinou Mirai a lutar e ainda finge que não se orgulha dela.', quote:'Volte viva. O resto a gente conserta.' },
    mira:{ bio:'Mirai entrou na patrulha de Eldria aos catorze anos, mentindo a idade. Luta com duas foices de colheita porque foi com elas que defendeu a fazenda da família na primeira noite de ataque.', quote:'Eu colho o que vocês plantaram.' },
    erik:{ bio:'Iwao é tão grande que precisa se abaixar para entrar nos fortes que defende. Fala baixo, anda devagar e nunca recua um passo. Na patrulha dizem que a serra tem medo dele.', quote:'Passe por mim. Se conseguir.' },
    alden:{ bio:'Alquimista da Cidade dos Alambiques, Kōji explode pelo menos um laboratório por semana. Cura melhor do que qualquer médico porque já se queimou de todas as formas possíveis.', quote:'Calma, calma, essa aqui quase nunca explode.' },
    ignis:{ bio:'Coronel da guarda da Cidade dos Alambiques, Homura trocou a espada por uma varinha de pederneira e nunca mais perdeu uma batalha. Severo, pontual e secretamente sentimental, guarda carta de cada soldado que perdeu.', quote:'Formação. Ninguém atira antes da minha ordem.' },
    toma:{ bio:'Toma construiu a própria manopla com peças de três oficinas diferentes e nenhuma instrução. Na Liga dos Juramentos, jurou "nunca deixar ninguém para trás", e agora carrega esse peso literalmente.', quote:'Ela faísca, mas funciona! Quase sempre!' },
    ryo:{ bio:'O aluno mais brilhante e mais brigão da Liga, Ryo acende braseiros com as mãos e com o humor. Odeia perder para Toma e odeia ainda mais admitir que são amigos.', quote:'Explosão controlada é explosão sem graça.' },
    grant:{ bio:'Takeru é o professor de combate da Liga dos Juramentos e o maior sorriso de qualquer campo de batalha. Diz que um escudo existe para proteger os outros, nunca a si mesmo.', quote:'Podem ficar tranquilos: eu cheguei!' },
    kenta:{ bio:'Mestre Kenta subiu os Mil Degraus tantas vezes que perdeu a conta e a pressa. Luta sem arma, com um tapa calmo que derruba muralhas. Dorme em pé nas reuniões de guilda.', quote:'Um golpe. Depois um chá.' },
    volt:{ bio:'Jōki-7 é um autômato a vapor que acordou no porão de um templo dos Mil Degraus. Não sabe quem o construiu e decidiu que ser útil é mais importante que saber. Fala em frases curtas e medidas de pressão.', quote:'Pressão em noventa por cento. Recomendo recuar.' },
    kai:{ bio:'Kai nasceu dentro de uma árvore da Floresta de Raízes Altas e acha que qualquer problema se resolve com um galho grande. Tem doze anos, zero medo e uma folha permanentemente presa no cabelo.', quote:'Achei um galho maior!' },
    riku:{ bio:'Riku veio de uma família de caçadores de recompensa que caçava gente. Fugiu com as garras do avô e agora caça monstros para provar que é diferente. Kai foi o primeiro amigo que ele não mentiu para ter.', quote:'Rápido não é pressa. É costume.' },
    elian:{ bio:'Sacerdote andarilho das Raízes Altas, Seiran carrega uma corrente com um sino que só toca quando alguém está prestes a morrer. Ninguém sabe se é bênção ou aviso, nem ele.', quote:'O sino tocou. Hoje não vai ser você.' },
    aiko:{ bio:'Sacerdotisa do Reino da Lua Prateada, Aiko foi enviada porque é a única capaz de embalar uma lua doente. Fala baixo, sorri pouco e segura a lanterna como quem segura uma criança.', quote:'A lua não morreu. Só está com medo.' },
    kiba:{ bio:'Meio espírito, meio homem, Kiba não lembra quem era antes da Bruma. Luta como um lobo e protege Jin como um irmão, porque foi Jin quem o encontrou perdido na névoa.', quote:'Eu não lembro meu nome. Lembro o seu.' },
    jin:{ bio:'Espadachim errante das Ilhas da Bruma, Jin saca a espada uma vez por luta e raramente precisa de uma segunda. Escreve poemas ruins de propósito, para ninguém levá-lo a sério.', quote:'Uma lâmina. Um corte. Um verso.' },
    drake:{ bio:'Mago de fogo registrado em três guildas de Valmar e expulso de duas. Tatsuya acredita que um dragão vive no próprio braço e não aceita outra explicação.', quote:'Taxa de incêndio? Coloca na conta da guilda.' },
    sienna:{ bio:'Comandante da guilda mais séria de Valmar, Kaede preenche formulários com a mesma disciplina com que segura a alabarda. Adotou Tatsuya como responsabilidade pessoal e se arrepende diariamente.', quote:'Formulário primeiro. Heroísmo depois.' },
    daigo:{ bio:'Daigo percorreu metade da Estrada dos Dojos a pé e a outra metade de joelhos, de tanto apanhar. Hoje é um monge-lutador de punhos em brasa que respeita todo adversário, inclusive os que o derrotaram.', quote:'Levanta. A luta ainda nem começou.' },
    mei:{ bio:'Mei chuta mais alto que qualquer um na Estrada dos Dojos e ri mais alto ainda. Viaja pendurando amuletos de papel de cada dojo que venceu.', quote:'Mais um amuleto para a coleção!' },
    kael:{ bio:'Mercenário cansado da Coroa Esmeralda, Kaito já lutou por todos os lados de uma guerra que não acaba. Continua lutando porque Rina pediu, e ele nunca soube dizer não a ela.', quote:'Eu cobro por hora. Hoje é de graça.' },
    sael:{ bio:'Bruxo de uma asa só, Karasu serviu à coroa verde até ela cair e desde então não serve a ninguém. Frio, elegante e perigoso, atravessou a Fenda procurando algo que perdeu no dia da queda.', quote:'Não me confunda com um aliado. Hoje só temos o mesmo inimigo.' },
    rina:{ bio:'Lutadora e curandeira, Rina cuida de um bar nas ruínas da Coroa Esmeralda e de todo mercenário que entra ferido nele. Bate forte e enfaixa melhor ainda.', quote:'Primeiro eu te curo. Depois a gente conversa sobre a conta.' },
    nadia:{ bio:'Cartógrafa e arqueira, Nanami desenha mapas de um deserto que muda toda noite. Chegou a Tsukimori seguindo um mapa que mostrava uma cidade com uma lua falsa.', quote:'Todo mapa mente um pouco. O meu mente menos.' },
    thorn:{ bio:'Gorō sobreviveu a quarenta invernos do Gelo Longo e perdeu a conta do resto. Resmunga, conta histórias longas demais e quebra montanhas de gelo com uma picareta. Viaja para ensinar o neto, Botan, a voltar para casa sozinho.', quote:'No meu tempo o inverno era mais frio. E eu, mais bonito.' },
    bjorn:{ bio:'Botan é o neto de Gorō e o primeiro xamã da família em cem invernos. Fala com passarinhos, lê runas melhor que o avô e finge não ouvir as histórias dele pela décima vez.', quote:'Vô, você já contou essa. Mas conta de novo.' },
    rook:{ bio:'Comandante de uma nave-cidade da Frota de Órion, Rokurō perdeu a nave, mas não a tripulação. Veio sozinho pela Fenda procurando um lugar onde os seus possam pousar.', quote:'Ninguém fica para trás. Nem aqui.' },
    warden:{ bio:'Ninguém sabe o nome do Carrasco. Guardava um portão nas Forjas do Abismo e o fechou por dentro, com tudo o que havia do outro lado. Fala pouco e só com o canhão.', quote:'...' },
    zara:{ bio:'Suzu cresceu nas Galerias de Sucata consertando tudo com fita e fogo. Seu lançador de foguetes é feito de canos de três vizinhos que ainda não perceberam.', quote:'Se não explodir, não está pronto!' },
    kira:{ bio:'Espírito-raposa do Bosque das Nove Lanternas, Kira guiou viajantes perdidos por séculos, às vezes para casa, às vezes não. Decidiu guiar Tsukimori por curiosidade, e fica por gostar das pessoas.', quote:'Sigam a lanterna. As outras mentem.' },
    haru:{ bio:'Andarilho das Estepes do Vento Solto, Haru vive de duelo em duelo e perde de propósito quando o adversário precisa mais do prêmio. Sorri demais para um espadachim.', quote:'O vento não escolhe lado. Eu escolho.' },
    ivy:{ bio:'Mensageira do Esquadrão Aurora, Itsuki corre tão rápido que às vezes chega antes da mensagem. O medidor no peito conta os segundos que ela ainda pode "pular".', quote:'Já cheguei! Espera, já fui?' },
    nari:{ bio:'Nari tem quinze anos e pilota o menor andador de combate do Esquadrão Aurora, que ela mesma remendou. Leva o trabalho a sério e os adultos, nem tanto.', quote:'Escudo erguido! Todo mundo atrás da lata!' },
    aurelia:{ bio:'Médica de campo do Esquadrão Aurora, Akane já salvou mais vidas do que dormiu noites. As pequenas asas de cristal vieram de um mundo que ela salvou e nunca voltou a visitar.', quote:'Fica comigo. Eu não perco ninguém hoje.' },
    dario:{ bio:'Membro da Irmandade dos Telhados, Daisuke protege uma cidade que nem sabe que ele existe. A cicatriz no olho é de uma noite em que falhou, e ele se lembra dela toda noite.', quote:'Ninguém me viu. É assim que funciona.' },
    cole:{ bio:'Guarda novato da Cidade da Névoa Verde, Kōta estava no primeiro dia de trabalho quando a névoa desceu. Aprendeu a lutar do pior jeito e continua acreditando que dá para salvar todo mundo.', quote:'Primeiro dia e já tô atrasado para o fim do mundo.' },
    dana:{ bio:'Nagi sobreviveu à Névoa Verde misturando ervas, remédios e muita teimosia. Não confia em ninguém de primeira, exceto em Kōta, que lembra alguém que ela perdeu.', quote:'Respira pelo pano. Confia em mim.' },
    wade:{ bio:'Patrulheiro do Planalto dos Coiotes, Watari já foi fora-da-lei, xerife e fora-da-lei de novo. Hoje só quer uma boa história para contar na fogueira.', quote:'Palavra dada é bala gasta. Não desperdiço nenhuma.' },
    garrick:{ bio:'Ferreiro-mago do Vale das Runas, Gantetsu acende o metal com palavras e o humor com palavrões. Ensinou Shiina a abrir portais, e se arrepende só quando ela aparece atrás dele.', quote:'Metal é que nem gente: aquece antes de dobrar.' },
    zira:{ bio:'Aprendiz de Gantetsu, Shiina descobriu sozinha como abrir portais do tamanho de uma porta. Usa isso para chegar atrasada e atacar pelas costas, as duas coisas de propósito.', quote:'Não estava ali. Agora estou aqui.' },
    n9:{ bio:'A Unidade Kū acordou na Cidadela Autômata com um drone flutuando ao lado e nenhuma ordem. Decidiu que a primeira ordem seria proteger quem não tem ninguém.', quote:'Alvo marcado. Drone pronto. Protocolo: gentileza.' },
    unit7:{ bio:'A Unidade Tetsu foi feita para a guerra e odeia isso. Luta com uma espada-serra enorme e pede desculpas a cada inimigo que derruba.', quote:'Desculpa. Desculpa. Ah, desculpa.' },
    rex:{ bio:'Herdeiro de um pacto demoníaco na Cidade do Pacto Carmesim, Raizō decidiu usar o poder para caçar os demônios que o fizeram. Exibido, provocador e irresponsável, mas nunca com a vida dos outros.', quote:'Pacto é pacto. Mas o contrato tem letra miúda.' },
    virel:{ bio:'Irmão gêmeo de Raizō, Yūgen aceitou o pacto por inteiro e se tornou frio como ele. Os dois se odeiam na mesma medida em que não conseguem se abandonar.', quote:'Meu irmão fala. Eu termino.' },
    selene:{ bio:'Bruxa do relógio na Cidade do Pacto Carmesim, Tokiko para o tempo por alguns segundos, sempre no momento mais dramático possível. Considera o próprio estilo uma arma.', quote:'Um segundo, querido. É tudo que eu preciso.' },
    tessa:{ bio:'Caçadora da Selva de Engrenagens, Tsubaki respeita bichos e máquinas por igual. A coruja mecânica no ombro foi a primeira presa que ela decidiu não abater.', quote:'Três flechas. Uma para cada erro seu.' },
    kaji:{ bio:'Campeão da Arena das Cinzas, Kaji luta por um nome que perdeu no primeiro torneio. A máscara esconde o rosto e a corrente em chamas afasta quem pergunta demais.', quote:'Me diga seu nome. Eu esqueci o meu.' },
    kori:{ bio:'Rival eterno de Kaji na Arena das Cinzas, Kori é o gelo contra o fogo dele. Os dois não se falam desde a última final, que terminou empatada por mil anos.', quote:'Fogo apaga. Gelo espera.' }
  };

  const chapters = {
    1:{ oath:'A lua roubada', premise:'As lanternas apagam uma a uma enquanto Shirogane transforma antigos guardiões em sombras.', stake:'Restaurar o primeiro selo antes que Tsukimori esqueça como era o luar.', truth:'Shirogane não criou o Eclipse: aceitou a Coroa para salvar a irmã, e a Coroa o consumiu.' },
    2:{ oath:'O mar que se lembra', premise:'O selo restaurado acorda Mizuchi e devolve à costa todos os nomes que o mar havia enterrado.', stake:'Salvar o Arquivo Submerso, onde está registrada a origem do Véu.', truth:'Mizuchi protegeu Tsukimori no passado; sua fúria é uma ordem corrompida, não crueldade.' },
    3:{ oath:'A hora devorada', premise:'Apep engole dias inteiros para impedir que chegue o momento previsto de sua própria morte.', stake:'Fazer o tempo voltar a correr e impedir que cidades inteiras virem lembranças imóveis.', truth:'Os quatro selos também eram fechaduras. Cada vitória enfraquece o Eclipse e liberta algo mais antigo.' },
    4:{ oath:'O céu partido', premise:'Raijin toca o tambor para manter as ilhas no ar, mas cada batida rasga ainda mais a Fenda.', stake:'Silenciar o trovão sem derrubar as cidades suspensas sobre Tsukimori.', truth:'Sayo abriu a Fenda sabendo o preço: os heróis foram chamados para escolher quem o Véu salvará.' },
    8:{ oath:'A dívida da Fenda', premise:'Abaixo dos selos existe um lugar que conhece o nome de cada herói antes de sua chegada.', stake:'Descer, recuperar memórias perdidas e impedir que a Fenda aprenda a imitar os viajantes.', truth:'Os andares não são ruínas: são futuros que falharam.' },
    9:{ oath:'Noites de Tsukimori', premise:'Festivais e invasões revelam histórias que a guerra principal não consegue contar.', stake:'Proteger a vida comum que torna a cidade digna de ser salva.', truth:'Nem toda criatura que atravessa o Véu é inimiga; algumas procuram abrigo.' }
  };
  const bosses = {
    boss:{ desire:'Devolver a irmã perdida, mesmo que precise apagar a lua.', tragedy:'A Coroa responde a cada sacrifício com uma mentira mais convincente.', link:'Sua queda devolve o primeiro fragmento lunar e desperta o mar.' },
    boss_tide:{ desire:'Cumprir para sempre a última ordem de proteger o Arquivo.', tragedy:'O Eclipse trocou “proteger” por “afogar quem se aproxima”.', link:'As memórias do Arquivo revelam o nome de Apep e o caminho das Areias.' },
    boss_sand:{ desire:'Escapar da hora em que foi destinada a morrer.', tragedy:'Ao devorar o futuro, Apep aprisiona inocentes no passado.', link:'Sua última ampulheta aponta para o quarto selo, acima das nuvens.' },
    boss_sky:{ desire:'Sustentar as ilhas e provar que seu trovão ainda governa o céu.', tragedy:'Parar o tambor derruba as ilhas; deixá-lo tocar destrói o Véu.', link:'A vitória fecha os quatro selos e abre a verdadeira Crônica da Fenda.' },
    boss_event:{ desire:'Manter acesas as lanternas dos mortos até que alguém se lembre deles.', tragedy:'O Eclipse transforma saudade em fogo faminto.', link:'Ao libertá-la, Tsukimori recupera nomes apagados de suas famílias.' }
  };
  // Páginas recolhidas durante a jornada. A segunda anotação aparece apenas
  // depois de avançar na região; o estado já existe no progresso do jogador.
  const fieldNotes = {
    village:[
      { by:'Sayo · Praça da Lua', text:'Amarramos nomes às cerejeiras para que ninguém desapareça duas vezes. A fita em branco é para quem acabou de chegar. Não é preciso preenchê-la hoje.' }
    ],
    hunt:[
      { by:'Sayo · entrada do Bosque', text:'As lanternas eram acesas para guiar os perdidos de volta à cidade. Agora brilham quando alguém se afasta da trilha. Caminhem juntos e não respondam à voz que os chamar entre as árvores.' },
      { at:5, by:'Kira · sob a nona lanterna', text:'Esta raposa conhece o cheiro da Coroa. Não é o Bosque que chama os guardiões: alguém no Templo está usando suas lanternas como sinos.' }
    ],
    dungeon:[
      { by:'Sayo · soleira do Templo', text:'As pedras desta escada guardam o primeiro selo. O fogo do vazio entrou pelas juntas; a luz do Véu ainda corre por baixo delas.' },
      { at:2, by:'Inscrição no segundo andar', text:'O nome Yuzuki foi raspado da parede muitas vezes. Sempre reaparece antes da manhã. Quem o apagou queria que Shirogane esquecesse por quem veio até aqui.' }
    ],
    boss:[
      { by:'Sayo · antes do Altar', text:'A Coroa oferece a cada pessoa a voz que mais deseja ouvir. Se Shirogane chamar por Yuzuki, lembrem-se: o que responde não é ela.' },
      { at:1, by:'Sayo · após o primeiro selo', text:'A prata que voltou ao céu não iluminou o lago. Iluminou o mar. O segundo selo já sabe que estamos a caminho.' }
    ],
    hunt_swamp:[
      { by:'Yuki · margem do Pântano', text:'Os vaga-lumes se movem contra o vento. Marco as trilhas com sinos pequenos, porque a luz pode mentir, mas o som volta de onde veio.' },
      { at:4, by:'Pote da Bruxa do Brejo', text:'Dentro do barro alguém canta o nome do rei de Jade. A bruxa não roubou esta voz; encontrou-a chamando debaixo da lama.' }
    ],
    dungeon_crypt:[
      { by:'Sora · porta da Cripta', text:'O jade nos túmulos não serve de ornamento. Cada pedra guarda uma memória do morto; o Eclipse fez os sacerdotes se lembrarem apenas do juramento de servir.' },
      { at:2, by:'Rolo da dinastia de Jade', text:'O último rei mandou esconder o verdadeiro nome da Coroa. Deixou a primeira sílaba no Templo e levou a segunda para o túmulo.' }
    ],
    hunt_tide:[
      { by:'Tobimaru · cais da Costa', text:'A maré devolveu um barco perdido há quarenta anos. Sua tripulação ainda espera a ordem de atracar. Não lhes prometam porto antes de saber quem lhes deu a ordem.' },
      { at:5, by:'Sayo · registro da maré', text:'Os afogados trazem nomes nos bolsos, não armas. Mizuchi está abrindo o Arquivo à procura de uma palavra que perdeu.' }
    ],
    dungeon_tide:[
      { by:'Sora · porta do Arquivo', text:'A tinta escreve sozinha o que teme que aconteça. Não leia em voz alta uma frase sobre seu futuro; procure o nome de quem a escreveu.' },
      { at:2, by:'Escriba sem rosto', text:'Uma escama antiga diz proteger. Todas as cópias recentes dizem afogar. A diferença cabe num único risco de tinta do Eclipse.' }
    ],
    boss_tide:[
      { by:'Sayo · beira do Abismo', text:'Mizuchi recebeu uma ordem boa e a obedeceu até esquecer seu sentido. A água doce de suas lágrimas é a parte dele que ainda se lembra.' },
      { at:1, by:'Ren · após a maré', text:'O mar devolveu os nomes. Entre eles estava um que nunca deveria ter sido escrito numa lista de afogados: Apep.' }
    ],
    hunt_frost:[
      { by:'Yuki · caminho do Planalto', text:'A neve cai para cima quando o sino da Rainha toca. Quem seguir apenas as próprias pegadas terminará no mesmo lugar; sigo o som das pontes abaixo do gelo.' },
      { at:4, by:'Carta presa num galho', text:'A Rainha fecha a passagem para a Forja, mas deixa comida para os viajantes perdidos. Não sei se nos protege dela ou do que trabalha lá dentro.' }
    ],
    dungeon_forge:[
      { by:'Ren · entrada da Forja', text:'Fui aprendiz aqui. A última arma que fizemos não aceitou bainha nem nome. Se a encontrarem nas mãos de um autômato, não a chamem de volta.' },
      { at:2, by:'Marca sob a bigorna', text:'Os autômatos ainda fazem uma pausa ao pôr do sol, embora já não haja janelas. Alguém lhes ensinou a descansar antes de lhes ensinar a lutar.' }
    ],
    hunt_desert:[
      { by:'Nanami · primeira duna', text:'O mapa envelhece mais depressa que eu. Amarrei um fio vermelho em cada marco; se ele aparecer à frente quando deveria estar atrás, a hora foi comida.' },
      { at:5, by:'Diário de uma caravana', text:'Apep não persegue viajantes: persegue a data gravada na placa do oráculo. Nós estamos entre ela e o próximo dia.' }
    ],
    hunt_ghost:[
      { by:'Jin · salão do baile', text:'A mesma valsa começa antes que termine. Ninguém ali parece triste; talvez esquecer a última nota seja mais cruel do que nunca ouvi-la.' },
      { at:4, by:'Convite encontrado no chão', text:'A festa começava ao anoitecer. A criança que derrubou a taça ainda pode segurá-la se a música parar um instante.' }
    ],
    dungeon_clock:[
      { by:'Sora · base da Torre', text:'As engrenagens não contam minutos, contam decisões. Quando uma gira para trás, um caminho que percorremos tenta deixar de ter acontecido.' },
      { at:2, by:'Inscrição atrás do mostrador', text:'Quatro selos, quatro fechaduras. O desenho sob elas não representa um quinto senhor; representa a porta que todos mantinham fechada.' }
    ],
    boss_sand:[
      { by:'Nanami · última ampulheta', text:'O medo de Apep tem uma data. Cada segundo roubado de nós apenas a deixa mais tempo sozinha com essa certeza.' },
      { at:1, by:'Sayo · depois da queda', text:'A areia voltou a correr, mas o céu se abriu. O quarto selo estava acima de nós o tempo todo.' }
    ],
    hunt_sky:[
      { by:'Haru · ponte das nuvens', text:'O vento corre entre as ilhas como se tentasse costurá-las. A cada trovão uma ponte treme, e a cidade aparece menor lá embaixo.' },
      { at:5, by:'Sayo · carta para os viajantes', text:'Não prometo que as ilhas resistirão à queda do tambor. Prometo que ninguém na cidade ficará sem saber por que vocês subiram.' }
    ],
    hunt_sakura:[
      { by:'Kira · Vale suspenso', text:'Estas flores cheiram como as de Tsukimori, mas não caem quando chega a hora. Uma primavera que nunca acaba também pode ser uma prisão.' },
      { at:4, by:'Fita presa num ramo', text:'O nome escrito aqui pertence a alguém que voltou para casa. A flor o guardou mesmo assim. Talvez as árvores ainda estejam aprendendo a diferença.' }
    ],
    dungeon_sky:[
      { by:'Monge do Santuário', text:'Fujin desapareceu antes de romperem os sacos de vento. Continuamos tocando os sinos para que, onde estiver, saiba que ainda estamos aqui.' },
      { at:2, by:'Haru · corredor dos sinos', text:'A badalada empurra, mas o intervalo deixa caminhar. Ouçam antes de correr. O céu não exige pressa de quem o sustenta.' }
    ],
    boss_sky:[
      { by:'Sayo · diante do Trono', text:'Raijin sustenta as ilhas com o mesmo golpe que fere o Véu. É preciso encontrar quem as segure enquanto ele descansa, ainda que seja por uma única batida.' },
      { at:1, by:'Sayo · margem do lago', text:'A lua voltou. No reflexo, ouvi minha voz me chamar do fundo da Fenda. Os quatro selos não eram o fim da história.' }
    ],
    rift:[
      { by:'Aviso na primeira pedra', text:'Se reconhecer sua casa num andar abaixo, não entre pela porta. A Fenda se lembra dos futuros que perdemos melhor do que nós.' },
      { at:5, by:'Sayo · caderno da descida', text:'A cidade em ruínas tinha o mesmo cheiro de pão da nossa. Não era uma lembrança do passado: era um amanhã que não deixaremos acontecer.' }
    ],
    world_boss:[
      { by:'Quadro da Guilda', text:'Quando a Fenda se abre sobre os telhados, os sinos chamam todos os distritos. Cada equipe segura uma parte da muralha; ninguém precisa carregar a criatura inteira sozinho.' }
    ],
    boss_event:[
      { by:'Sayo · vigília das lanternas', text:'À noite, leiam um nome antes de lançar cada lanterna. A Kitsune não distingue uma chama esquecida de uma chama faminta.' },
      { at:1, by:'Kira · depois da vigília', text:'A raposa dormiu. Uma lanterna voltou com o nome escrito do lado de dentro; alguém no outro lado do Véu também se lembrou.' }
    ]
  };
  const heroPurpose = (id, roster = KT.Data?.roster || []) => {
    const h = roster.find(x => x.id === id), same = h ? roster.filter(x => x.id !== id && x.world === h.world).slice(0, 2).map(x => x.name) : [], bonds = (KT.Data?.bonds || []).filter(b => b.ids.includes(id)).map(b => b.name).slice(0, 2);
    const role = { Vanguarda:'manter o grupo unido quando o Véu tentar separar suas memórias', Executor:'encarar a verdade que os grandes inimigos escondem', Arcanista:'decifrar por que mundos diferentes compartilham o mesmo Eclipse', Atirador:'encontrar o caminho que os mapas da Fenda apagam', Suporte:'lembrar aos viajantes quem eram antes da guerra' }[h?.cls] || 'encontrar seu lugar em Tsukimori';
    return { role:`Em Tsukimori, sua promessa é ${role}.`, ties:[same.length ? `Veio do mesmo mundo que ${same.join(' e ')}.` : '', bonds.length ? `Seus laços ativos contam a história de ${bonds.join(' e ')}.` : ''].filter(Boolean) };
  };

  const history = [
    { title:'A Era do Lago Sem Nome', text:'Antes dos reinos, as aldeias mediam o inverno pela espessura do gelo. Os pastores que chegaram ao lago ainda não sabiam das outras margens: foi Tsukiko quem tocou a água e encontrou o fio de prata. Suas primeiras discípulas aprenderam a fechar as portas sem deixar de ouvir quem batia. Os barqueiros conservaram uma luz à margem para os viajantes da terra; as Guardiãs conservaram os nomes dos viajantes de além do Véu.' },
    { title:'O Pacto das Quatro Margens', text:'Prata, Maré, Hora e Trovão deram quatro testemunhas ao pacto. Nenhuma governaria sozinha. O selo de Prata guardava os nomes; o da Maré, as lembranças; o da Hora, a possibilidade de mudar; o do Trovão, a distância entre os mundos. Os reis posteriores chamaram os selos de armas. Os registros mais antigos chamam-nos de deveres.' },
    { title:'A Dinastia de Jade', zone:'dungeon_crypt', text:'Os reis de Jade queriam que nada se perdesse, nem mesmo uma ordem. Prenderam memórias nas pedras dos túmulos e deram aos sacerdotes a tarefa de repeti-las. Quando uma ordem errada atravessou os séculos, ninguém tinha permissão de esquecê-la. O Rei Sem Túmulo é o último soberano dessa lei: seus servos continuam defendendo uma cidade que já não existe.' },
    { title:'O Século dos Nomes Afogados', zone:'dungeon_tide', text:'Ao mar se entregavam os nomes dos que não voltavam, para que a costa não os reclamasse dos vivos. Os escribas do Arquivo transformaram o rito em registro: cada desaparecido teria uma linha, cada família receberia uma cópia. Mizuchi guardava essas páginas. O Eclipse não lhe retirou o amor por elas; retirou a diferença entre conservar alguém e impedir sua volta.' },
    { title:'Os Três Invernos do Eclipse', zone:'boss', text:'A Coroa não conquistou Tsukimori com um exército. Ofereceu a Shirogane uma única pessoa. Depois pediu um nome, uma estação, a lua. As aldeias discordam sobre qual foi o primeiro sacrifício, mas todas conservam uma fita em branco para Yuzuki. O Festival das Cerejeiras é a resposta dos moradores: lembrar sem negociar os vivos pelos mortos.' },
    { title:'O Ano das Travessias', zone:'boss_sky', kill:true, text:'Restaurar os selos não desfaz o que foi vivido. A costa ainda enterra seus mortos; as famílias de Jade ainda procuram nomes; há crianças que nunca viram uma lua inteira. Os viajantes não receberam um mundo terminado. Receberam a tarefa mais lenta de todos os heróis: ensinar uma cidade a confiar novamente em suas próprias portas.' }
  ];
  const customs = [
    { title:'As fitas de cerejeira', text:'Uma fita recebe um nome, não um pedido. Quem retorna desata a própria fita e planta uma semente. As fitas em branco acolhem quem ainda não encontrou as palavras. Kira proíbe que o preço de qualquer prêmio do festival inclua uma delas.' },
    { title:'Os sinos das travessias', text:'Um toque anuncia quem chega; dois, quem parte; três chamam auxílio. Os tambores da praça deixam um compasso vazio para que os sinos de uma ponte possam ser ouvidos. Mesmo durante o festival, a música existe para acompanhar os caminhos, nunca para encobri-los.' },
    { title:'A Ordem e as guildas', text:'A Ordem responde às necessidades da cidade e registra contratos. As guildas são juramentos entre viajantes, livres para escolher suas próprias missões. Uma mantém as portas abertas; as outras decidem quem caminhará junto. Nem o conselho nem Sayo podem obrigar um herói a prometer o que não cumprirá.' },
    { title:'O acordo de Kogane', text:'O ouro remunera trabalho, não mede uma pessoa. Os comerciantes do porto registram lote, origem e taxa diante do comprador. Ren assina suas peças porque quer responder por elas; Aoi recusa chamar uma cópia de relíquia. A cidade nasceu da confiança entre desconhecidos e pode morrer se transformar tudo em promessa sem testemunha.' },
    { title:'O Coliseu Carmesim', text:'Sua primeira arena era um pátio onde sobreviventes ensinavam os mais novos a recuar sem vergonha. Hoje há ligas e Honra, mas o juramento permanece: revelar a própria defesa, aceitar as mesmas regras e não tomar a derrota de alguém como medida de seu valor. Kaji e Kori guardam lados opostos do portão, não para se evitar, mas para que ninguém atravesse sozinho.' }
  ];
  // Os registros entram nas cenas já existentes: não há migração nem novo formato de save.
  const chapterBook = { hunt:'shirogane', hunt_tide:'mizuchi', hunt_desert:'apep', hunt_sky:'raijin', rift:'fenda', boss_event:'kitsune' };
  Object.entries(fieldNotes).forEach(([id, notes]) => {
    if (id === 'village' || !KT.Data.story.zone[id]) return;
    KT.Data.story.zone[id] = [{ who:'Crônica', by:notes[0].by, text:notes[0].text, book:chapterBook[id] }, ...KT.Data.story.zone[id]];
  });
  const endings = {
    boss:{ who:'Shirogane', text:'Eu dei o nome dela à Coroa. Não me peçam que esqueça Yuzuki para provar que fui libertado. Peçam que eu não sacrifique outro nome ao meu luto.', book:'shirogane' },
    boss_tide:{ who:'Mizuchi', text:'Guardei os nomes tão fundo que ninguém pôde voltar por eles. Levem os registros à costa. Uma memória não precisa de grades para permanecer.', book:'mizuchi' },
    boss_sand:{ who:'Apep', text:'Temi tanto a última hora que roubei todas as anteriores. Ouçam o que volta a correr: não é minha morte. É o amanhã daqueles que eu aprisionei.', book:'apep' },
    boss_sky:{ who:'Sayo', text:'Os viajantes seguraram as pontes por uma batida, e Raijin enfim pôde baixar as mãos. A lua voltou; as perdas não desapareceram. Agora teremos de construir uma paz que não precise de outro sacrifício.', book:'raijin' },
    boss_event:{ who:'Kitsune', text:'Não queria roubar ninguém do festival. Só temia que a última lanterna apagasse antes de alguém ler os nomes. Levem as fitas de volta às cerejeiras; eu cuidarei do fogo.', book:'kitsune' }
  };
  Object.entries(endings).forEach(([id, line]) => KT.Data.story.bossWin[id].push(line));
  Object.entries(endings).forEach(([id]) => KT.Data.story.bossWin[id].push(...fieldNotes[id].filter(n => n.at === 1).map(n => ({ who:'Crônica', by:n.by, text:n.text }))));
  const companionArcs = {
    erik:[
      'Iwao mantém o escudo entre Shirogane e a equipe. Reconhece o gesto de um homem que se oferece à morte por alguém, mas recusa chamar de proteção um sacrifício escolhido pelos outros. Ao voltar, fica de guarda enquanto Sayo escreve a primeira fita para Yuzuki.',
      'Na costa, Iwao vê portas lacradas por dentro. Nenhuma muralha de Eldria parecia tão alta. Ajuda a abri-las sem perguntar quais moradores merecem voltar; depois conta a Akira que um escudo também precisa saber sair da frente.',
      'Quando o tempo retorna, Iwao percebe uma marca nova na pedra do escudo. Não se lembra do golpe que a fez. Guarda a marca: esquecer a própria dor não lhe dá o direito de esquecer quem caminhou ao seu lado.',
      'Com a lua inteira, Iwao deixa o escudo encostado à parede do Dojo pela primeira vez. Ensina aos novatos onde apoiar os pés, não como imitá-lo. À noite ainda vigia a ponte, mas agora permite que alguém o substitua.'
    ],
    akira:[
      'Akira amarra uma fita pelo vale do Rio Cinzento. Não pede que o vulcão devolva sua casa. Depois de Shirogane, entende o preço de confundir saudade com uma ordem dirigida ao mundo.',
      'Nos registros devolvidos por Mizuchi, Akira procura uma aldeia que nunca pertenceu àquela costa. Não a encontra. Copia uma página em branco e nela desenha o curso do rio: uma casa pode ganhar testemunhas sem fingir que voltou.',
      'Apep lhe oferece um instante antes da lava. Akira ouve a proposta até o fim, pois negá-la sem desejo seria mentir. Recusa-a quando percebe que o instante roubado teria de ser tirado do amanhã de outra família.',
      'Akira ensina às crianças da praça como reconhecer uma correnteza. Conta sobre a antiga aldeia sem transformar seu desaparecimento na última frase. No festival seguinte, traz a primeira canoa feita em Tsukimori.'
    ],
    yuki:[
      'Yuki não corta a fita de Shirogane. No Mosteiro aprendeu que silêncio e perdão não são a mesma coisa. Espera que ele diga o nome de Yuzuki sem a voz da Coroa respondendo.',
      'O Arquivo registra o nome de uma monja da Lua Minguante que Yuki nunca conheceu. A anotação é mais antiga que o mosteiro. Copia-a para os anciãos: nem toda tradição chegou ao presente sem perder alguém pelo caminho.',
      'Nas Areias, Yuki deixa um sino pequeno junto à ampulheta quebrada. Seu som existe apenas enquanto o ar se move. É uma oração que não pode ser aprisionada num único instante.',
      'Yuki decide ficar até que os novos guardiões aprendam os sinos das pontes. Não é abandonar o Mosteiro. É levar sua disciplina a um lugar onde ouvir corretamente ainda pode salvar uma vida.'
    ],
    sora:[
      'Sora compara as inscrições do primeiro selo com os manuais da Academia. A palavra que os professores traduziam como domínio também pode significar responsabilidade. Anota a diferença à margem, mesmo sabendo quem vai contestá-la.',
      'Mizuchi deixa que Sora copie um registro molhado; a tinta só aparece quando a página sai da água. Para compreender o Véu, a Academia terá de admitir que não basta possuir um documento: é preciso entender como alguém o preservou.',
      'Na Torre, Sora encontra cálculos perfeitos que não deixam lugar para uma escolha humana. Não os destrói. Acrescenta uma pergunta ao fim de cada demonstração: quem perde a própria hora para que esta resposta seja verdadeira?',
      'Sob o céu costurado, Sora funda uma pequena sala de leitura na Casa do Time. Ren leva diagramas; Aoi leva receitas falhadas. As primeiras aulas começam pelas coisas que cada um ainda não sabe explicar.'
    ],
    haru:[
      'Haru corre até a ponte assim que a prata retorna ao céu. Pela primeira vez vê sua sombra inteira. Volta devagar à praça, para que quem caminha atrás também possa vê-la.',
      'O vento sobre a costa traz uma canção diferente das Estepes. Haru aprende seu refrão com uma família que acaba de receber um nome do Arquivo. Não pergunta se a canção é alegre: pergunta em que noites eles a cantam.',
      'Apep afirma que toda estrada termina. Haru concorda; por isso insiste que cada pessoa possa escolher a direção antes do fim. Amarra sua fita num marco da estrada e a deixa apontando para a cidade.',
      'Haru segura a corda de uma ponte enquanto Raijin para o tambor. Mais tarde, ninguém consegue dizer qual herói sustentou a primeira ilha. Haru não corrige a história: prefere que a cidade se lembre das mãos juntas.'
    ]
  };
  const heroJourney = (id, state) => {
    const base = KT.Data.roster.find(h => h.id === id)?.base || id;
    return (companionArcs[base] || []).map((text, i) => ({ text, zone:['boss','boss_tide','boss_sand','boss_sky'][i], title:['A prata devolvida','Os nomes da costa','O direito ao amanhã','Uma ponte para o futuro'][i], revealed:(state.progress?.[['boss','boss_tide','boss_sand','boss_sky'][i]]?.kills || 0) > 0 }));
  };
  KT.Data.speakers.Crônica = { color:'#d8b062', title:'Caderno de campo' };
  KT.Lore = { world, worlds, heroes, chapters, bosses, fieldNotes, heroPurpose, history, customs, heroJourney };
})();
