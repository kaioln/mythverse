---
name: sem-cara-de-ia
description: Régua para o jogo não parecer feito por IA, em tudo (arte, logotipo, tipografia, HUB/UI, texto, nomes, som, estrutura). Use antes de criar ou revisar qualquer tela, asset, texto, nome, logotipo ou fonte, e sempre que alguém disser que algo "parece IA", "genérico", "cara de template" ou "cara de app".
---

# Sem cara de IA

## O que entrega "feito por IA"

Não é um filtro que falta. É **decisão** que falta. Imagem, tela ou texto gerados saem com tudo "mais ou menos bom" e nada escolhido: tudo aceso, tudo detalhado, tudo simétrico, tudo explicado. Um designer deixa coisas de fora. A régua inteira cabe numa frase: **cada peça precisa mostrar escolhas que uma máquina não faria sozinha, e as mesmas escolhas precisam se repetir de peça em peça** (repetição de escolha é o que vira identidade).

Sinais por área. Formato: como reconhecer → o que fazer.

### Arte (cenário, retrato, sprite, ícone)
- Tudo aceso ao mesmo tempo, sem zona calma → uma fonte de luz; pelo menos 40% da área em massa calma.
- Microdetalhe igual em todo lugar (cada pedra, cada folha) → detalhe só no foco; o resto em mancha.
- Lanterna, cerejeira, lua, torii, bandeira em toda cena → cada ingrediente só onde a história pede, com limite por cena.
- Cada cena com o próprio arco-íris → carta de cor única do projeto; cada região guarda UM tom próprio, contido.
- Mesma composição recolorida (arena "de areia" é a arena "de pedra" com outra cor) → esboço de composição por cena antes de pintar; medir repetição com `art-check.py`.
- Escada que não leva a lugar nenhum, cachoeira brotando de terraço, mãos, texto ilegível → passe humano obrigatório (lista no skill `arte-feita-a-mao`).
- Brilho HDR, bokeh, "trending", véu amarelado → sem brilho. Luz é valor (claro contra escuro), não glow.
- Estilos colados (boneco chapado sobre pintura brilhante; ícone em três traços diferentes) → mesma tinta de contorno e mesma faixa de valor em figura, fundo e ícone.

### Logotipo e tipografia
- Letra dourada chanfrada com brilho, orbe, faíscas, partículas, pétalas soltas → marca tipográfica na fonte de título do projeto + um símbolo que uma mão faria (selo, círculo de tinta). Duas cores. Precisa funcionar em 32 px e em uma cor só.
- Inter, Outfit, Poppins, Montserrat, Roboto, Sora, DM Sans, Plus Jakarta, Manrope, Space Grotesk → fontes com origem no mundo do jogo. Uma serifa para título, uma sem-serifa com caráter para interface e números. (No Mythverse: Shippori Mincho B1 e Zen Kaku Gothic New.)
- Tudo em caixa alta espaçada → caixa alta só em rótulo de até 2 palavras; texto corrido em caixa normal.

### HUB e interface
- Grade de cartões idênticos (ícone, título, texto, botão) → hierarquia: um foco grande, o resto menor; tamanho diz importância.
- Pílulas, raio de 12 px em tudo, degradê roxo-azul, vidro fosco, glow, sombra colorida → canto quase reto, cor chapada, uma única cor de ação.
- Emoji como ícone → ícone desenhado no mesmo traço de todos os outros.
- Cores padrão do Tailwind (#7c3aed, #8b5cf6, #3b82f6, #06b6d4, #22d3ee, #ec4899, #10b981) → carta de cor própria, cada cor com nome.
- Tudo centralizado e simétrico → alinhado à esquerda; assimetria com intenção.
- Tela que explica a si mesma ("Selecione um item à esquerda para…") → o vazio mostra o que vem (silhueta, exemplo, próximo passo com verbo), não um manual.
- Painel que cabe tudo → uma pergunta por painel; o resto em aba.
Detalhes e medidas no skill `hub-ui-ux`.

### Texto
- Travessão, "não é apenas X, é Y", tríades, "jornada", "mergulhe", "desvende", "experiência única", exclamação a cada frase → frases curtas, concretas, uma ideia por frase.
- "(s)" para plural, "Clique aqui", "Bem-vindo(a)", "Em breve", "Preparando a jornada…" → plural certo, verbo no botão, nome do lugar no lugar do clichê.
- Descrição que é fórmula ("Causa X de dano a Y e aplica Z") em tudo → fórmula fica na linha técnica; cada item e habilidade ganha uma linha humana (o que se vê, o que se sente).
- Nome montado por sorteio ("Lâmina Sombria do Eclipse Eterno") → uma ideia por nome, origem no mundo, até 3 palavras.
Detalhes e antes/depois no skill `voz-do-jogo`.

### Estrutura e economia
- Toda região com o mesmo número de estágios, toda recompensa "+10%" → variação deliberada; um estágio marcante por região; números com história (3, 7, 12, 40), tetos e exceções nomeadas.

### Som
- Biblioteca genérica, o mesmo "whoosh" em tudo → poucos sons com assinatura (um instrumento, um material); silêncio onde o jogo pensa.

## Como trabalhar
1. **Antes de criar**, diga em uma linha que decisão a peça mostra e o que ficou de fora.
2. **Depois de criar**, rode `/mythverse` (texto e CSS por `audit.js`, imagens por `art-check.py`) e olhe a tela em 375, 768 e 1366×657.
3. **Nunca resolver com filtro em massa** (posterizar, borrar, grão por cima de tudo). Unifica acabamento e apaga detalhe; o jogador vê "filtro", não "arte". Foi tentado neste projeto e desfeito no mesmo dia.
4. **Peça gerada é rascunho.** Vira arte quando passa por esboço de composição próprio, carta de cor, limpeza humana e conferência de conteúdo.
5. **Quando alguém diz "parece IA"**: peça três sinais concretos desta lista, corrija os sinais, não a peça inteira. Se os sinais são de composição (tudo aceso, mesma cena recolorida), a peça precisa ser refeita, e é melhor dizer isso do que remendar.

## Lista antes de dizer "pronto"
- [ ] Um foco por tela ou cena; 40% de área calma.
- [ ] Só cores da carta do projeto.
- [ ] Zero emoji, zero degradê decorativo, zero glow.
- [ ] Texto sem travessão, sem "(s)", sem "Clique aqui", sem exclamação em série.
- [ ] Nomes com uma ideia.
- [ ] `/mythverse tudo` sem achado alto.
- [ ] Screenshot em 375, 768 e 1366×657 sem estouro.
