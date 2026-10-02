# Direção de arte: estampa noturna

A arte do Mythverse nasceu de geradores de imagem, peça por peça. O resultado tinha os sinais que qualquer designer
reconhece de longe: cenário de pintura brilhante atrás de boneco chapado (dois jogos colados), tudo aceso ao mesmo
tempo, cada cena com o próprio arco-íris, pontilhado de "falso pixel" dentro dos personagens e uma interface de
aplicativo em modo escuro. Este documento é a régua que passou a valer para tudo, e que vale para toda arte nova.

## A direção

**O jogo é uma gravura japonesa de noite (shin-hanga) com bonecos de papel recortado.**

- **Cenário**: massas calmas de cor em poucos degraus de valor, noite índigo, traço de tinta nas bordas fortes. Luz
  quente só em volta das lanternas e no miolo das chamas; o chão longe da chama afunda na noite. Cada região guarda o
  tom dela (violeta no eclipse, verde no pântano, areia no deserto), sempre contido. Nada estoura, nada brilha por igual.
- **Personagens**: são o que há de mais nítido e colorido na tela. Mesma tinta de contorno (sumi-índigo, nunca preto
  puro) em todo o elenco, sem pontilhado dentro das cores, mesma faixa de valor e de saturação.
- **Luz**: a cena banha quem está nela (um véu do tom do cenário sobre personagens e chão) e a sombra de contato é de
  tinta. Golpes, projéteis e magia ficam com a cor cheia: são o acento.
- **Papel**: um único grão por cima da cena inteira, preso à tela. Fundo e boneco estão impressos na mesma folha.
- **Interface**: o que fica em volta da estampa. Laca escura, papel, fio de tinta e selo vermelho. Canto quase reto;
  uma só cor de ação (vermelhão); ouro para o que é valioso ou está escolhido; raridade em pigmento, como selo.

## Carta de cor

| nome | cor | uso |
|---|---|---|
| sumi | `#1e1b2c` | tinta: contorno, sombra, fundo da interface |
| ai | `#26345e` | noite, o alto da estampa |
| hanada | `#54688e` | meia-noite clara, água, escudo |
| nezumi | `#96a0ac` | pedra, névoa |
| washi | `#eee5d0` | papel: texto, luz mais clara |
| shu | `#cb422c` | selo: ação, alerta, equipe |
| kin | `#e2aa4e` | lanterna, ouro, escolhido |
| sakura | `#d696a0` | cerejeira (rosa seco, nunca néon) |
| koke | `#62764e` | musgo, vida |
| murasaki | `#70588c` | eclipse, raridade épica |

A mesma carta está em `tools/art_style.py` (`PALETTE`) e em `theme-estampa.css` (variáveis CSS).

## Como é aplicada

| o quê | onde |
|---|---|
| tratamento de cenário, personagem, retrato e papel | `tools/art_style.py` |
| aplicar a tudo (sempre a partir da arte sem tratamento) | `python tools/art_apply.py [scenes] [banners] [chars]` |
| a arte sem tratamento | `tools/art_src.py`: `assets/original/art-src/` ou a revisão-fonte do git |
| luz da cena sobre os personagens, sombra de tinta, grão de papel | `src/renderer.js` (`drawLight`, `drawPaper`) |
| interface | `theme-estampa.css` (carregada por último) |
| laboratório (mesmas pranchas para qualquer filtro) | `data/artlab/common.py`, fora do git |

`art_apply.py` nunca trata por cima do já tratado: lê a fonte, grava o resultado. Pode rodar quantas vezes for preciso.
As ferramentas que medem a pintura pela cor (`build_town_lights.py`, `build_scene_masks.py`) também leem a fonte.

## Arte nova

1. Gere ou desenhe a peça e ponha o arquivo **sem tratamento** em `assets/original/art-src/<mesmo caminho do jogo>`
   (por exemplo `assets/original/art-src/assets/scenes/web/novo.webp`).
2. Rode `python tools/art_apply.py scenes --only novo` (ou `chars --only <id>`).
3. Confira no jogo com `tools/ui` (cidade, luta e chefe em 1366×657 e 375×700).

Lista de conferência antes de aceitar uma peça: mãos e dedos; objetos que se fundem; escada, ponte ou cachoeira que
não leva a lugar nenhum; padrão que não continua; texto ou brasão ilegível (escrita sempre com fonte real, nunca
gerada); motivo fora do mundo (carroção de faroeste, cofre de banco, armadura gótica).

## O que o tratamento não resolve

É dizer com clareza: filtro unifica acabamento, cor, luz e traço. Não redesenha.

- **Proporção do elenco**: heróis chibi de 2,5 cabeças ao lado de chefes de 7 cabeças. São duas réguas assumidas
  (gente chibi; yokai e chefes grandes), mas cada peça veio de um desenho diferente.
- **Cenários repetidos**: várias arenas são a mesma composição recolorida. Com a paleta contida isso aparece mais.
- **Conteúdo sem lógica**: escadas que somem, cachoeiras brotando de terraços, lanternas demais. Só repintura.
- **Animação**: o detalhe interno muda de um quadro para o outro (curativo, estampa do haori). A régua de cor é a
  mesma em todos os quadros, mas a forma é a que veio.
- **Ícones**: habilidades, itens e menu ainda falam três línguas; os de menu viram borrão abaixo de 28 px.
- **Logotipo e tipografia**: o logotipo com orbe roxo e a sem-serifa arredondada continuam genéricos.

Na página de loja, a regra é declarar com precisão: a arte parte de imagens geradas e passa por direção de arte e
tratamento próprios. Nunca negar.
