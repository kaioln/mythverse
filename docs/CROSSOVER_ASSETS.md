# Sprites do crossover

Gerados com o ImageGen integrado em 24/09/2026, como atlas PNG RGBA de 5 colunas × 2 linhas com dez personagens em cada arquivo. Produção: ilustrações 2D estáticas em estilo sprite chibi, personagem inteiro, fundo transparente, uma pose por célula, sem texto. O Canvas recorta a célula no carregamento e aplica movimento no combate; não são spritesheets de animação quadro a quadro.

| Arquivo | Personagens na ordem de leitura |
| --- | --- |
| `assets/crossover/anime-1.png` | Goku, Vegeta, Naruto, Sasuke, Luffy, Zoro, Ichigo, Rukia, Tanjiro, Nezuko |
| `assets/crossover/anime-2.png` | Gojo, Yuji, Levi, Mikasa, Eren, Edward Elric, Roy Mustang, Deku, Bakugo, All Might |
| `assets/crossover/anime-3.png` | Saitama, Genos, Gon, Killua, Kurapika, Sailor Moon, Inuyasha, Kenshin, Natsu, Erza |
| `assets/crossover/game-1.png` | Ryu, Chun-Li, Cloud, Sephiroth, Tifa, Lara Croft, Kratos, Atreus, Master Chief, Doom Slayer |
| `assets/crossover/game-2.png` | Jinx, Ahri, Yasuo, Tracer, D.Va, Mercy, Ezio, Leon, Jill, Arthur Morgan |
| `assets/crossover/game-3.png` | Geralt, Ciri, 2B, A2, Dante, Vergil, Bayonetta, Aloy, Scorpion, Sub-Zero |

Prompt de produção de cada atlas: "Uma folha de sprites 2D de dez personagens reconhecíveis [lista da linha correspondente], grade rígida de 5 colunas por 2 linhas, ordem da esquerda para a direita e de cima para baixo, cada personagem sozinho na própria célula, corpo inteiro, estilo chibi ilustrado de jogo, poses distintas, traços limpos, cores fiéis ao personagem, fundo transparente, sem texto, sem moldura, sem cenário."

`assets/original/enemies-atlas.png`, `bosses-atlas.png` e `lantern-kitsune.png` foram gerados pelo mesmo recurso para os mobs e chefes originais do jogo. Prompt da Kitsune: "Raposa mística original de nove caudas, pele marfim, armadura índigo, lanternas rosas e douradas, símbolo de sakura na testa, pose de combate, corpo inteiro, fundo transparente, sem texto." Os personagens e franquias do crossover pertencem a terceiros. As imagens geradas aqui não constituem licença de publicação, distribuição ou venda desses personagens. Não há acordos de licenciamento registrados neste projeto.

## Cenários ilustrados

Também gerados com o ImageGen integrado em 24/09/2026. `assets/scenes/world-map.png` é o mapa mundial sem texto, com Tsukimori e sete rotas conectadas. Os oito fundos em `assets/scenes/` usam o ID do destino: `village`, `hunt`, `hunt_tide`, `dungeon`, `dungeon_tide`, `boss`, `boss_tide`, `boss_event`. O prompt de produção comum pediu uma cena 16:9 de JRPG japonês pintada à mão, com arquitetura e texturas detalhadas, caminhos legíveis, espaço frontal para sprites, sem personagens, texto, interface ou grade geométrica. Cada prompt especificou a região, suas construções, materiais e iluminação. O mapa pediu cartografia ilustrada com trilhas contínuas entre a cidade, bosque, costa, duas dungeons e três altares.

`assets/original/items-atlas.png` reúne oito ícones de loot em grade 4×2: katana, lâmina curva, tomo, poção vermelha, poção azul, pó de Éter, cristal e bolsa. Prompt: "atlas transparente 4 colunas por 2 linhas, um item isolado e centralizado por célula, arte pintada à mão de inventário de JRPG, materiais ricos, sem texto nem moldura". A imagem gerada para o segundo item parecia uma lâmina curva; o nome do loot foi ajustado para corresponder à arte.

Em 25/09/2026, `assets/scenes/summoning.png` foi criado para a abertura de convocação: observatório e santuário autoral de madeira e bronze, portal para paisagens distantes, área escura à esquerda para texto, sem personagens, logotipos ou interface. `assets/original/advanced-items-atlas.png` contém quatro itens autorais em grade 2×2, com fundo transparente: lâmina da maré, coração das marés, selo do eclipse e selo da raposa. Os prompts exigiram materiais legíveis em tamanho de ícone, silhuetas distintas e ausência de texto ou marcas.
