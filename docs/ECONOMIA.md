# Economia do Mythverse

Este documento explica como o ouro, os itens, os materiais e as cartas entram e saem do jogo, e mostra os números medidos com o simulador (`node tools/sim.js 10 7`). Tudo o que gera valor é calculado **no servidor** (veja `SEGURANCA.md`).

## Princípios

1. **Raridade de verdade.** Um item só vale Gemas no Mercado de Jogadores se for difícil de conseguir. Por isso as chances de lendário, mítico, conjunto e carta são muito baixas e os mapas iniciais têm teto de raridade.
2. **Cada fonte tem papel próprio.** Caçadas dão ouro, EXP e itens comuns a épicos. Chefes, Invasões Mundiais e eventos são a fonte principal de lendários, míticos, Oricalco e Adamantina.
3. **Sumidouros fortes.** Construções, treino, refino (que pode regredir ou quebrar o item), culinária, transmutação, loja e Despertar consomem ouro e materiais continuamente.
4. **Nada infla sem limite.** Compras de materiais na loja têm limite diário; o AFK tem teto de 12 h e rende menos que jogar ativo; cada Invasão Mundial tem 1 tentativa por dia.

## Fontes

| Fonte | O que dá | Observação |
|---|---|---|
| Caçada (inimigo comum) | ouro, EXP, item (Comum 86% · Raro 13,9% · Épico 0,1% · Lendário 0,004%) | Capítulo I: teto Épico |
| Elite / Guardião | item melhor (Épico ~0,5%, Lendário 0,02%), Aço Estelar raro | variantes Alfa garantem item |
| Chefe de andar | Raro/Épico (5%)/Lendário (0,3%), Aço Estelar 12%, Oricalco 1% | |
| Chefe de região | Épico 27%, Lendário 2,5%, 1 a 2 Aço Estelar, Oricalco 12% + 8% por dificuldade, Adamantina no Pesadelo+ | carta MVP 1 em 900 |
| Invasão Mundial | ouro, cristais, 1 item garantido (chance de Lendário), Aço Estelar, Oricalco, chance de Adamantina, de mítico e da carta do chefe; tudo escala com a dificuldade e com a derrubada do chefe | 2 janelas por dia, 1 tentativa por dia |
| Fenda Abissal | Aço Estelar; Oricalco do andar 10; Adamantina do andar 25 | mutação por andar |
| Expedições | ouro, Tamahagane, Éter, itens comuns/raros, EXP | heróis fora da equipe; correm no servidor |
| Quadro de Recompensas | ouro e Marcas de Caçador | loja: Aço Estelar, Oricalco, Pergaminho da Sorte, Baú do Caçador (épico), chave |
| AFK (servidor) | até 12 h de ouro/EXP/itens no maior estágio vencido | ~0,16 abates/s, ouro ×0,35 e EXP ×0,3: bem abaixo do ativo |
| Cartas | Comum 1/60.000 · Rara 1/22.000 · Épica 1/6.000 · MVP 1/1.500 | pesquisa do Bestiário e Alfas aumentam |

## Sumidouros

- **Construções** (Forja, Dojo, Santuário, Oficina, Guilda, Mercado): custo exponencial por nível.
- **Treino do Dojo**: ATK, HP, DEF e Crítico para toda a equipe.
- **Refino**: ouro crescente por nível e o material. Tamahagane regride de +5 a +8 e quebra depois; Aço Estelar quebra em +9/+10; Oricalco regride acima de +10; Adamantina só falha. Itens quebrados saem da economia.
- **Loja**: poções, comidas (buffs), pergaminho da sorte, expansão da bolsa (preço sobe a cada compra), Aço Estelar (2 por dia) e Oricalco (1 por dia).
- **Oficina**: encantamento com Éter, culinária e transmutação com limite diário.
- **Mercado de Jogadores**: 5% de taxa em cada venda e 2% (mínimo R$ 1,00) no saque. As taxas saem de circulação.

## Controles e fomento ao comércio

**Para o comércio acontecer:**
- **Mercado em ouro** para todos, sem dinheiro real e sem idade mínima de conta: qualquer drop raro vira ouro para quem não usa a peça e progresso para quem compra.
- Itens, **cartas** e **materiais raros** (Aço Estelar, Oricalco, Adamantina) são negociáveis, com filtros por tipo, espaço e raridade, mediana das últimas vendas por moeda e **perfil público** do vendedor (reputação por vendas feitas).
- Compras em ouro entram direto na bolsa; vendas chegam pelo Correio.

**Para a economia não inflar nem ser explorada:**
- **Sumidouros no mercado em ouro**: taxa de anúncio (1%, mín. 50, não volta se cancelar) e imposto de 5% sobre cada venda.
- **Itens vinculados**: tudo o que vem de NPC (loja, Mercador Errante, baú das Marcas) não pode ser revendido, para o mercado não ser inundado por itens comprados com ouro.
- **Idade mínima** do item no save do servidor antes de vender (1 h em ouro, 24 h em Gemas) e limites de anúncios abertos e por dia.
- **Dinheiro real**: retenção de 72 h das vendas antes do saque, bloqueio de compra entre contas da mesma rede, alertas de preço 10× acima da mediana e de pares com muitas trocas, saques com revisão manual.
- **Painel `/admin/`**: ouro total em circulação e maiores estoques, Gemas em circulação, depósitos, saques e taxas da semana, volume do mercado por moeda (24 h e 7 dias), itens mais negociados e a lista de alertas. Com esses números dá para ajustar taxas e drops antes que a economia desande.
- Todos os valores acima são configuráveis por variável de ambiente (`.env.example`).

## Números do simulador (10 h, semente 7, jogador atento)

| Hora | Ouro por hora | Abates por hora | Onde |
|---|---|---|---|
| 1 | ~55 mil | ~1.230 | Bosque 12 |
| 3 | ~194 mil | ~2.020 | Templo |
| 6 | ~322 mil | ~3.470 | chefe do Capítulo I vencido |
| 8 | ~492 mil | ~1.600 | Costa das Marés |
| 10 | ~736 mil | ~2.100 | Costa das Marés 7 |

Itens em 10 h: ~1.000 comuns, ~290 raros, ~8 épicos, 2 conjuntos e ~1 lendário, vindo do chefe. **Nenhum mítico** nos mapas iniciais: míticos só caem onde a fonte já permite Lendário (chefes e Capítulo II em diante). **0 a 1 carta** em 10 h. **~48 Aço Estelar** e **1 Oricalco**. Só a equipe ganha EXP de combate; o banco evolui apenas em Expedições.

**223 mil de ouro depois de algumas horas está dentro do esperado**: no fim do Capítulo I o jogo rende de 250 a 320 mil por hora, e a maior parte vai para construções, treino e refino.

## Valor para o Mercado de Jogadores

- Um **lendário** aparece poucas vezes em 10 h de jogo e quase sempre de chefes; um **mítico** é ainda mais raro.
- Refinos acima de +10 exigem Oricalco ou Adamantina, que são escassos, e arriscam o item: um +13 ou +15 é uma peça rara de verdade.
- **Cartas** levam dias por jogador; cartas MVP e épicas, com efeito especial, são as mais valiosas.
- O Mercado mostra a **mediana das últimas vendas** de cada peça para ajudar a precificar.

## Como recalibrar

Os pesos ficam em `src/items.js` (`DROP_TABLES`, `rarityCap`, `cardTiers`, `materials`, `REFINE_BONUS`) e em `src/engine.js` (`dropMats`, `offlineGains`, `claimExpedition`). Depois de mudar, rode `node tools/sim.js 10 7` e compare as tabelas por hora com as deste documento.
