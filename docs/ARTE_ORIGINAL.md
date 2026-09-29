# Arte original dos heróis

> **Pedidos prontos, com um design próprio por herói:** [ARTE_PROMPTS.md](ARTE_PROMPTS.md). Este arquivo guarda as regras e o formato.

Os nomes, mundos e kits dos 60 heróis já são originais. Falta trocar os **retratos** e **sprites**, que ainda são os do protótipo e lembram personagens de outras obras. Este documento é o briefing para desenhar (ou gerar e revisar) cada herói do zero.

## Regras para evitar problemas de direito autoral

- Crie o personagem a partir do briefing abaixo, **nunca** a partir de uma imagem ou de um personagem existente. Não use como referência nem cite nomes de outras obras no pedido ao artista ou ao gerador de imagens.
- Evite marcas visuais conhecidas: penteados icônicos, uniformes e símbolos de outras franquias, cicatrizes e armas famosas, combinações de cores características.
- Guarde o contrato com o artista (cessão de direitos patrimoniais por escrito) ou os termos da ferramenta de geração usada.
- Mesmo com artes novas, revise o elenco com um advogado antes do lançamento com dinheiro real.

## Formato dos arquivos

| Arquivo | Tamanho | Observação |
|---|---|---|
| `assets/sprites/<id>.png` | altura 310 px, largura livre (até ~280), fundo transparente | personagem inteiro, de frente/3/4 virado para a direita, estilo chibi 2D |
| `assets/portraits/<id>.png` | 160 × 160 px, fundo transparente | rosto e ombros |

Depois de trocar os PNGs, atualize a largura em `assets/sprites/sizes.json` e rode `npm test` (o teste confere se todo herói tem sprite e retrato).

## Briefing por herói

### Picos de Aurum

- **Solen Kairos** (`solen`): Arcanista, Luz. Paleta: dourado e branco. Visual: vestes com detalhes arcanos, mãos emanando energia, postura de conjuração; arma: cajado arcano. Kit: Sangue Estelar / Onda Solar / Esfera dos Mil Sóis.
- **Varyon, o Príncipe Cinza** (`varyon`): Executor, Raio. Paleta: amarelo elétrico e azul. Visual: traje leve e ágil, lâmina ou arma de corte à mão, postura de ataque; arma: espada. Kit: Orgulho Real / Disparo Violeta / Raio Real.

### Vila do Redemoinho

- **Hayato Kazeno** (`hayato`): Vanguarda, Vento. Paleta: verde-claro e prata. Visual: armadura robusta ou traje de combate reforçado, postura firme, silhueta larga; arma: arma pesada. Kit: Espírito do Vento / Legião de Sombras / Ciclone Cortante.
- **Rai Kurogane** (`ren`): Arcanista, Raio. Paleta: amarelo elétrico e azul. Visual: vestes com detalhes arcanos, mãos emanando energia, postura de conjuração; arma: cajado arcano. Kit: Olhos Rubros / Lança Trovejante / Chama do Eclipse.

### Arquipélago das Velas

- **Tobias Maré** (`tobias`): Vanguarda, Fogo. Paleta: vermelho e laranja. Visual: armadura robusta ou traje de combate reforçado, postura firme, silhueta larga; arma: arma pesada. Kit: Corpo Resiliente / Rajada de Punhos / Maré Gigante.
- **Kenji Tríplice** (`kenji`): Executor, Vento. Paleta: verde-claro e prata. Visual: traje leve e ágil, lâmina ou arma de corte à mão, postura de ataque; arma: espada. Kit: Tríade de Aço / Corte Cruzado / Tempestade de Lâminas.

### Vale das Almas

- **Hiro Kagetsu** (`hiro`): Executor, Sombra. Paleta: violeta escuro e preto. Visual: traje leve e ágil, lâmina ou arma de corte à mão, postura de ataque; arma: espada. Kit: Voz Interior / Crescente Cortante / Lua Sem Fim.
- **Yuki Shirasagi** (`yuki`): Suporte, Gelo. Paleta: azul-claro e branco. Visual: vestes claras com símbolos de proteção, cajado, livro ou equipamento médico, postura acolhedora; arma: relíquia sagrada. Kit: Dança da Neve / Lótus Branca / Floresta de Gelo Eterno.

### Montanhas do Carvão

- **Akira Minase** (`akira`): Executor, Água. Paleta: azul-marinho e turquesa. Visual: traje leve e ágil, lâmina ou arma de corte à mão, postura de ataque; arma: espada. Kit: Faro Apurado / Correnteza Giratória / Dança da Brasa.
- **Hana Minase** (`hana`): Vanguarda, Fogo. Paleta: vermelho e laranja. Visual: armadura robusta ou traje de combate reforçado, postura firme, silhueta larga; arma: arma pesada. Kit: Sangue Regenerativo / Chute Carmesim / Sangue Incandescente.

### Academia do Véu

- **Sora Hakuren** (`sora`): Arcanista, Luz. Paleta: dourado e branco. Visual: vestes com detalhes arcanos, mãos emanando energia, postura de conjuração; arma: cajado arcano. Kit: Espaço Intocável / Ponto Rubro / Colapso Índigo.
- **Daichi Kuroba** (`daichi`): Vanguarda, Sombra. Paleta: violeta escuro e preto. Visual: armadura robusta ou traje de combate reforçado, postura firme, silhueta larga; arma: arma pesada. Kit: Punho Maldito / Punho Atrasado / Despertar Amaldiçoado.

### Muralhas de Eldria

- **Lucan Voss** (`lucan`): Executor, Vento. Paleta: verde-claro e prata. Visual: traje leve e ágil, lâmina ou arma de corte à mão, postura de ataque; arma: espada. Kit: Veterano Implacável / Investida Vertical / Giro Cortante.
- **Mira Voss** (`mira`): Executor, Vento. Paleta: verde-claro e prata. Visual: traje leve e ágil, lâmina ou arma de corte à mão, postura de ataque; arma: espada. Kit: Proteger a Família / Lâminas Gêmeas / Fúria do Clã.
- **Erik Hallen** (`erik`): Vanguarda, Terra. Paleta: marrom, ocre e pedra. Visual: armadura robusta ou traje de combate reforçado, postura firme, silhueta larga; arma: arma pesada. Kit: Forma Colossal / Soco Colossal / Colosso Primordial.

### Cidade da Transmutação

- **Alden Ferro** (`alden`): Suporte, Terra. Paleta: marrom, ocre e pedra. Visual: vestes claras com símbolos de proteção, cajado, livro ou equipamento médico, postura acolhedora; arma: relíquia sagrada. Kit: Alquimia de Combate / Muralha de Aço / Transmutação Suprema.
- **Coronel Ignis Varra** (`ignis`): Arcanista, Fogo. Paleta: vermelho e laranja. Visual: vestes com detalhes arcanos, mãos emanando energia, postura de conjuração; arma: cajado arcano. Kit: Mestre das Brasas / Faísca Alquímica / Inferno do Deserto.

### Academia dos Dons

- **Toma Hikari** (`toma`): Vanguarda, Raio. Paleta: amarelo elétrico e azul. Visual: armadura robusta ou traje de combate reforçado, postura firme, silhueta larga; arma: arma pesada. Kit: Poder Herdado / Rajada de Dedo / Soco Supremo.
- **Ryo Kazan** (`ryo`): Arcanista, Fogo. Paleta: vermelho e laranja. Visual: vestes com detalhes arcanos, mãos emanando energia, postura de conjuração; arma: cajado arcano. Kit: Palmas Explosivas / Tiro Guiado / Impacto Giratório.
- **Grant Valor** (`grant`): Vanguarda, Luz. Paleta: dourado e branco. Visual: armadura robusta ou traje de combate reforçado, postura firme, silhueta larga; arma: arma pesada. Kit: Símbolo da Esperança / Golpe Vendaval / Golpe da Nação.

### Metrópole Cinzenta

- **Mestre Kenta** (`kenta`): Vanguarda, Luz. Paleta: dourado e branco. Visual: armadura robusta ou traje de combate reforçado, postura firme, silhueta larga; arma: arma pesada. Kit: Treino Diário / Socos em Série / Golpe Definitivo.
- **Volt-7** (`volt`): Atirador, Fogo. Paleta: vermelho e laranja. Visual: equipamento de longo alcance (arco, arma de fogo ou canhão), coldres e cintos, postura de mira; arma: arco / à distância. Kit: Núcleo Térmico / Canhão Térmico / Sobrecarga do Núcleo.

### Terras Selvagens

- **Kai Morinaga** (`kai`): Vanguarda, Natureza. Paleta: verde-folha e madeira. Visual: armadura robusta ou traje de combate reforçado, postura firme, silhueta larga; arma: arma pesada. Kit: Instinto Selvagem / Punho Carregado / Forma do Juramento.
- **Riku Shiro** (`riku`): Executor, Raio. Paleta: amarelo elétrico e azul. Visual: traje leve e ágil, lâmina ou arma de corte à mão, postura de ataque; arma: espada. Kit: Passo Relâmpago / Coroa Trovejante / Relâmpago Divino.
- **Elian Rubra** (`elian`): Suporte, Luz. Paleta: dourado e branco. Visual: vestes claras com símbolos de proteção, cajado, livro ou equipamento médico, postura acolhedora; arma: relíquia sagrada. Kit: Pacto das Correntes / Grilhão Restaurador / Sentença Acorrentada.

### Reino da Lua Prateada

- **Aiko Lunaris** (`aiko`): Suporte, Luz. Paleta: dourado e branco. Visual: vestes claras com símbolos de proteção, cajado, livro ou equipamento médico, postura acolhedora; arma: relíquia sagrada. Kit: Cristal Lunar / Tiara Lunar / Cura do Luar.

### Era das Brumas

- **Kiba, o Meio-Espírito** (`kiba`): Vanguarda, Vento. Paleta: verde-claro e prata. Visual: armadura robusta ou traje de combate reforçado, postura firme, silhueta larga; arma: arma pesada. Kit: Sangue Espiritual / Garras de Aço / Fenda do Vendaval.
- **Jin Hayate** (`jin`): Executor, Vento. Paleta: verde-claro e prata. Visual: traje leve e ágil, lâmina ou arma de corte à mão, postura de ataque; arma: espada. Kit: Saque Relâmpago / Queda da Garça / Relâmpago do Céu Alto.

### Guildas de Valmar

- **Drake Ember** (`drake`): Arcanista, Fogo. Paleta: vermelho e laranja. Visual: vestes com detalhes arcanos, mãos emanando energia, postura de conjuração; arma: cajado arcano. Kit: Comedor de Chamas / Rugido Flamejante / Forma Draconiana.
- **Sienna Valmar** (`sienna`): Vanguarda, Terra. Paleta: marrom, ocre e pedra. Visual: armadura robusta ou traje de combate reforçado, postura firme, silhueta larga; arma: arma pesada. Kit: Arsenal Mutável / Armadura Adamantina / Armadura do Céu.

### Torneio das Nações

- **Daigo Arashi** (`daigo`): Vanguarda, Fogo. Paleta: vermelho e laranja. Visual: armadura robusta ou traje de combate reforçado, postura firme, silhueta larga; arma: arma pesada. Kit: Caminho do Guerreiro / Esfera de Ki / Punho Ascendente.
- **Mei Lan** (`mei`): Executor, Vento. Paleta: verde-claro e prata. Visual: traje leve e ágil, lâmina ou arma de corte à mão, postura de ataque; arma: espada. Kit: Pernas Relâmpago / Tempestade de Chutes / Giro da Garça.

### Planeta Esmeralda

- **Kael Arden** (`kael`): Executor, Raio. Paleta: amarelo elétrico e azul. Visual: traje leve e ágil, lâmina ou arma de corte à mão, postura de ataque; arma: espada. Kit: Mercenário Errante / Corte em X / Nove Golpes Celestes.
- **Sael, a Asa Negra** (`sael`): Arcanista, Sombra. Paleta: violeta escuro e preto. Visual: vestes com detalhes arcanos, mãos emanando energia, postura de conjuração; arma: cajado arcano. Kit: Asa Sombria / Oito Cortes / Estrela Cadente.
- **Rina Akemi** (`rina`): Suporte, Terra. Paleta: marrom, ocre e pedra. Visual: vestes claras com símbolos de proteção, cajado, livro ou equipamento médico, postura acolhedora; arma: relíquia sagrada. Kit: Estilo do Punho Livre / Sequência de Golpes / Golpe do Firmamento.

### Ruínas Perdidas

- **Nádia Crane** (`nadia`): Atirador, Terra. Paleta: marrom, ocre e pedra. Visual: equipamento de longo alcance (arco, arma de fogo ou canhão), coldres e cintos, postura de mira; arma: arco / à distância. Kit: Sobrevivente / Tiro Preciso / Flechas Explosivas.

### Reinos Nórdicos

- **Thorn Varg** (`thorn`): Vanguarda, Gelo. Paleta: azul-claro e branco. Visual: armadura robusta ou traje de combate reforçado, postura firme, silhueta larga; arma: arma pesada. Kit: Fúria Guerreira / Arremesso do Machado Gélido / Ira do Guerreiro.
- **Bjorn Varg** (`bjorn`): Suporte, Natureza. Paleta: verde-folha e madeira. Visual: vestes claras com símbolos de proteção, cajado, livro ou equipamento médico, postura acolhedora; arma: relíquia sagrada. Kit: Flechas Rúnicas / Flecha de Luz / Invocação Rúnica.

### Frota de Órion

- **Comandante Rook** (`rook`): Atirador, Raio. Paleta: amarelo elétrico e azul. Visual: equipamento de longo alcance (arco, arma de fogo ou canhão), coldres e cintos, postura de mira; arma: arco / à distância. Kit: Escudo de Energia / Granada de Fragmentação / Canhão Orbital.

### Portões do Abismo

- **O Carrasco** (`warden`): Atirador, Fogo. Paleta: vermelho e laranja. Visual: equipamento de longo alcance (arco, arma de fogo ou canhão), coldres e cintos, postura de mira; arma: arco / à distância. Kit: Carnificina / Escopeta Dupla / Canhão de Plasma.

### Cidade Subterrânea

- **Zara Fagulha** (`zara`): Atirador, Fogo. Paleta: vermelho e laranja. Visual: equipamento de longo alcance (arco, arma de fogo ou canhão), coldres e cintos, postura de mira; arma: arco / à distância. Kit: Euforia / Faísca! / Míssil Maluco.

### Bosque Espiritual

- **Kira das Nove Caudas** (`kira`): Arcanista, Luz. Paleta: dourado e branco. Visual: vestes com detalhes arcanos, mãos emanando energia, postura de conjuração; arma: cajado arcano. Kit: Essência Vital / Encanto / Dança dos Fogos-Fátuos.

### Planícies de Ionar

- **Haru Kaze** (`haru`): Executor, Vento. Paleta: verde-claro e prata. Visual: traje leve e ágil, lâmina ou arma de corte à mão, postura de ataque; arma: espada. Kit: Andarilho do Vento / Vórtice de Aço / Vendaval Final.

### Esquadrão Aurora

- **Ivy Tempo** (`ivy`): Atirador, Raio. Paleta: amarelo elétrico e azul. Visual: equipamento de longo alcance (arco, arma de fogo ou canhão), coldres e cintos, postura de mira; arma: arco / à distância. Kit: Salto Temporal / Retrocesso / Mina Cronal.
- **Nari Mecha** (`nari`): Vanguarda, Raio. Paleta: amarelo elétrico e azul. Visual: armadura robusta ou traje de combate reforçado, postura firme, silhueta larga; arma: arma pesada. Kit: Campo Refletor / Propulsores / Autodestruição.
- **Aurélia Asas** (`aurelia`): Suporte, Luz. Paleta: dourado e branco. Visual: vestes claras com símbolos de proteção, cajado, livro ou equipamento médico, postura acolhedora; arma: relíquia sagrada. Kit: Anjo da Guarda / Cajado Curativo / Ressurreição.

### Irmandade Oculta

- **Dario Venturi** (`dario`): Executor, Sombra. Paleta: violeta escuro e preto. Visual: traje leve e ágil, lâmina ou arma de corte à mão, postura de ataque; arma: espada. Kit: Credo das Sombras / Lâmina do Punho / Mergulho do Telhado.

### Cidade Infectada

- **Cole Harper** (`cole`): Atirador, Fogo. Paleta: vermelho e laranja. Visual: equipamento de longo alcance (arco, arma de fogo ou canhão), coldres e cintos, postura de mira; arma: arco / à distância. Kit: Mira de Precisão / Tiro na Cabeça / Magnum e Chute.
- **Dana Reyes** (`dana`): Suporte, Natureza. Paleta: verde-folha e madeira. Visual: vestes claras com símbolos de proteção, cajado, livro ou equipamento médico, postura acolhedora; arma: relíquia sagrada. Kit: Mestra da Sobrevivência / Spray de Primeiros Socorros / Granada Incendiária.

### Fronteira Selvagem

- **Wade Callahan** (`wade`): Atirador, Terra. Paleta: marrom, ocre e pedra. Visual: equipamento de longo alcance (arco, arma de fogo ou canhão), coldres e cintos, postura de mira; arma: arco / à distância. Kit: Código do Fora-da-Lei / Revólver de Seis Tiros / Mira Lenta.

### Reinos do Norte

- **Garrick do Vale** (`garrick`): Arcanista, Fogo. Paleta: vermelho e laranja. Visual: vestes com detalhes arcanos, mãos emanando energia, postura de conjuração; arma: cajado arcano. Kit: Sangue Mutante / Runa Ígnea / Runa de Impacto.
- **Zira** (`zira`): Executor, Vento. Paleta: verde-claro e prata. Visual: traje leve e ágil, lâmina ou arma de corte à mão, postura de ataque; arma: espada. Kit: Sangue Antigo / Salto entre Mundos / Fúria do Relâmpago Branco.

### Guerra das Máquinas

- **Unidade Ômega** (`n9`): Atirador, Sombra. Paleta: violeta escuro e preto. Visual: equipamento de longo alcance (arco, arma de fogo ou canhão), coldres e cintos, postura de mira; arma: arco / à distância. Kit: Drone de Apoio / Programa Laser / Programa Supremo.
- **Unidade Sigma** (`unit7`): Vanguarda, Fogo. Paleta: vermelho e laranja. Visual: armadura robusta ou traje de combate reforçado, postura firme, silhueta larga; arma: arma pesada. Kit: Modo Berserker / Corte Selvagem / Berserker Total.

### Cidade dos Demônios

- **Rex Sable** (`rex`): Atirador, Fogo. Paleta: vermelho e laranja. Visual: equipamento de longo alcance (arco, arma de fogo ou canhão), coldres e cintos, postura de mira; arma: arco / à distância. Kit: Estilo Acrobata / Pistolas Gêmeas / Pacto Demoníaco.
- **Virel Sable** (`virel`): Executor, Sombra. Paleta: violeta escuro e preto. Visual: traje leve e ágil, lâmina ou arma de corte à mão, postura de ataque; arma: espada. Kit: Poder Absoluto / Espadas Espirituais / Corte Dimensional.
- **Selene Noir** (`selene`): Arcanista, Sombra. Paleta: violeta escuro e preto. Visual: vestes com detalhes arcanos, mãos emanando energia, postura de conjuração; arma: cajado arcano. Kit: Tempo Suspenso / Chuva de Balas / Demônio Infernal.

### Terras das Máquinas

- **Tessa Rubra** (`tessa`): Atirador, Natureza. Paleta: verde-folha e madeira. Visual: equipamento de longo alcance (arco, arma de fogo ou canhão), coldres e cintos, postura de mira; arma: arco / à distância. Kit: Foco / Flecha Elemental / Tempestade de Flechas.

### Torneio do Submundo

- **Kaji, o Espectro** (`kaji`): Executor, Fogo. Paleta: vermelho e laranja. Visual: traje leve e ágil, lâmina ou arma de corte à mão, postura de ataque; arma: espada. Kit: Fogo do Inferno / Lança de Corrente / Execução.
- **Kori, o Gélido** (`kori`): Arcanista, Gelo. Paleta: azul-claro e branco. Visual: vestes com detalhes arcanos, mãos emanando energia, postura de conjuração; arma: cajado arcano. Kit: Clã do Gelo / Esfera de Gelo / Congelamento Profundo.

