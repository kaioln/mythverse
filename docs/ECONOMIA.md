# Economia do Mythverse

Este documento explica como o ouro, os itens, os materiais e as cartas entram e saem do jogo, e mostra os números medidos com o simulador (`node tools/sim.js 10 7`). Tudo o que gera valor é calculado **no servidor** (veja `SEGURANCA.md`).

## Princípios

1. **Raridade de verdade.** Um item só vale Gemas no Mercado de Jogadores se for difícil de conseguir. Por isso as chances de lendário, mítico, conjunto e carta são muito baixas e os mapas iniciais têm teto de raridade.
2. **Cada fonte tem papel próprio.** Caçadas dão ouro, EXP e itens comuns a épicos. Chefes, Invasões Mundiais e eventos são a fonte principal de lendários, míticos, Oricalco e Adamantina.
3. **Sumidouros fortes.** Construções, treino, refino (que pode regredir ou quebrar o item), culinária, transmutação, loja e Despertar consomem ouro e materiais continuamente.
4. **Nada infla sem limite.** Compras de materiais na loja têm limite diário; o AFK tem teto de 12 h e rende menos que jogar ativo; cada Invasão Mundial tem 1 tentativa por dia.
5. **Farm AFK tem teto.** Cada chefe dá espólio completo (itens, materiais, chaves e carta MVP) só nas **3 primeiras vitórias do dia** por dificuldade; depois, até a meia-noite de Brasília, a vitória rende 40% do ouro e a EXP. Oricalco e Adamantina de fontes repetíveis (Fenda, masmorras, guardiões) têm teto diário de 3 e 1. O chefe de andar dá 1 item por vitória e a chave aleatória de masmorra caiu para 1%.
6. **Nada some.** Com a bolsa cheia, itens épicos ou melhores entram na bolsa e o comum/raro mais fraco (livre e destrancado) vai para os Excedentes; épicos ou melhores nunca são desmontados automaticamente.

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

## Progressão de EXP (versão 2, 2026-09-29)

A EXP de um inimigo cresce ~6% por nível dele (1,065^0,92), mas a curva antiga dos heróis (60·N^1,9) crescia devagar: **o fim ficava mais rápido que o meio**. Abates por nível, com a equipe de 4 no nível da região:

| Nível | Antes | Agora |
|---|---|---|
| 10 | 808 | 808 |
| 30 | 2.046 | 2.046 |
| 50 | 1.695 | 2.500 |
| 70 | 1.008 | 3.000 |
| 90 | 510 | 3.500 |
| 99 | 363 | 3.725 |

Até o nível 32 nada mudou; depois cada nível custa um pouco mais que o anterior. Travas (em `src/engine.js`, `XP_RULES`):

- **Herói muito abaixo do inimigo** (mais de 15 níveis): −4% de EXP por nível extra, mínimo 10%. Acaba o "carregar" herói nível 1 numa região difícil.
- **Herói muito acima do inimigo** (mais de 8 níveis): −10% por nível extra, mínimo 10%. Farm de mapa fácil não rende.
- **Teto por abate**: nenhum abate dá mais que 5% de um nível.
- **Chefe sem espólio no dia**: a EXP cai para 30% (antes o chefe repetido era o melhor farm de EXP do jogo).
- **Invocações de chefe**: 25% de ouro/EXP e sem itens, cartas ou materiais.
- **Expedições**: antes davam 20% de um nível por hora em qualquer nível (2,4 níveis em 12 h, até no 99). Agora equivalem a caçar a região devagar e **nunca passam do nível dos inimigos da região**.
- **AFK**: usa o nível da região e o mesmo teto por abate.
- **Integridade do save**: ao carregar, qualidade > 6★, atributos ou talentos acima dos pontos, treino acima do Dojo e Paragão acima do teto são corrigidos.
- **Relógio** (modo Neon): a hora vem do banco (`mv_now`); o banco recusa saves com relógio adiantado. Antes, adiantar o relógio do aparelho pulava expedições, renovava limites diários e dava AFK infinito.

A tela de destino mostra o nível dos inimigos e quanto da EXP a equipe recebe ali.

## Convocação (caixas)

| Caixa | Custo | Lendário | Épico | Raro | Comum | Garantia |
|---|---|---|---|---|---|---|
| Caixa dos Mundos | 1 chave | 3% | 12% | 30% | 55% | lendário em 30 |
| Caixa de Classe (escolhe a classe) | 2 chaves | 5% | 17% | 33% | 45% | lendário em 25 |
| Caixa da Temporada (60% herói novo) | 3 chaves | 8% | 22% | 35% | 35% | lendário **da temporada** em 20 |
| Caixa Astral (inclui temporada) | 10 chaves | 20% | 45% | 35% | 0% | lendário em 8 |

Cada caixa tem garantia própria e 10× garante ao menos um Épico. Heróis da temporada (12, `D.SEASON`) só saem da Temporada e da Astral enquanto ela estiver aberta. Novas fontes de chaves: a cada 4 estágios novos, Fenda a cada 5 andares (2 nos múltiplos de 10), todas as diárias, login nos dias 4 (1) e 7 (2) e a cada 5 níveis de conta.

## Banco Kogane

Saiu da Loja e virou um distrito próprio da cidade (Tesoureira Oharu). Cálculo novo do índice (`tools/neon_economy.sql`): para cada jogador ativo, reserva saudável = 6 h da **própria** renda (ouro ganho ÷ horas jogadas); o índice é a **mediana** das razões ouro/reserva (um jogador rico não distorce), suavizado 70/30. Cotações nunca ficam vazias: vendas → menor anúncio → maior ordem → estimativa pelo custo de produção.

## Poder e mapas (2026-09-29, revisão 2)

Os mapas agora acompanham o nível dos heróis (nível do inimigo = 1 + ln(poder)/ln 1,065):

| Capítulo | Níveis dos inimigos | Poder recomendado | Antes |
|---|---|---|---|
| I | 1 a 36 | até 181 mil (chefe) | igual |
| II | 36 a 62 | 59 mil a 939 mil | 84 mil a 2 milhões (nível 42 a 74) |
| III | 64 a 82 | 343 mil a 3,3 milhões | 780 mil a 24 milhões (nível 77 a 114) |
| IV | 84 a 100 | 1,2 a 10,3 milhões | 12 a 262 milhões (nível 112 a 151) |

Antes o fim do jogo exigia inimigos acima do nível 100, e o único jeito de acompanhar era multiplicar o poder por fora do nível (refino, qualidade, Paragão). Pesadelo e Inferno continuam acima do 100, como conteúdo de fim de jogo.

Do lado do jogador: refino acima de +10 rende +14% por nível (o +15 multiplica o atributo principal por ~3, antes 4,25); bônus percentuais de HP/ATK/DEF somados acima de +200% valem metade; o poder do ranking ignora comidas e buffs temporários. Diagnóstico por conta: `node --env-file=.env tools/neon_power_report.js [conta]`.

**Temporada I · Despertares:** as 12 figuras da temporada são formas despertadas de heróis do elenco (Goku Instinto Superior, Luffy Gear 5, Naruto Modo Kurama…), com a arte do próprio personagem recolorida (pele e contorno preservados). Forma e original não entram juntos na equipe. Os ids da primeira versão (itachi, kakashi…) migram sozinhos nos saves.

## Escala compacta, custos e Armazém (2026-09-29, revisão 3)

- **Poder exibido** = força bruta^0,7 (`KT.State.powerScore`). Mesma ordem, escala humana: equipe inicial ~400, chefe do Cap. I ~4,8 mil, chefe final (Cap. IV) ~80 mil. O combate não mudou; `getPowerRaw`/`recommendedPowerRaw` seguem para a lógica interna. Invasão Heroica/Mítica pede 4 mil/20 mil de Poder.
- **Custos em ouro** acompanham a renda (~50 mil/h no fim do Cap. I, ~230 mil/h no II, ~675 mil/h no III, ~1,6 mi/h no IV): obras ×1,42–1,5 por nível (antes ×1,75–1,95: a nível 14 custava 1,9 milhão), treino 450·1,24^nível (antes 400·1,32^nível), loja com multiplicador de progresso até ×6.
- **Armazém do Tanuki**: 300 espaços de base + enfeites cosméticos (Lanternas +50, Biombo +100, Baú Laqueado +150, Cofre do Dragão +200; cristais, compra única). Desequipar ou tirar um herói da equipe manda os itens para lá; nada no Armazém é desmontado nem ocupa a bolsa; "Equipar melhor" também procura no Armazém. Itens equipados deixaram de ocupar a bolsa.

## Rebalanceamento por combate (2026-09-29, revisão 4)

Medido com `node tools/balance.js [lutas] [níveis extras]`: uma equipe de referência no nível dos inimigos (itens do mapa, refino, treino, qualidade, atributos e talentos automáticos) luta cada região com o motor real.

- **Itens**: o atributo principal cresce +12% por nível de item até o 30 e +4,5% depois (antes +12% sempre: no nível 100 os itens multiplicavam o poder por ~600×). Itens antigos acima do 30 são recalculados uma vez, preservando sorte e raridade.
- **Inimigos por nível** (`D.levelPower`): Capítulo I igual; depois +6,2% por nível. Com a mitigação real (DEF ÷ (DEF + 2,2 × ATK base)), a equipe no nível leva ~6 s para matar e ~22 s para morrer em qualquer capítulo. Caçadas no nível: vitória com folga; masmorras pedem ~1 nível; chefes ~4 níveis. Raijin (chefe final, nível 96) exige equipe montada (tanque de Terra etc.) no nível 100.
- **Ouro e EXP** seguem o nível do inimigo (`rewardPower`), não a força: a renda cresce como no Capítulo I.
- **Poder exibido** = força^0,77: equipe inicial ~700, fim do Cap. I ~5–6 mil, Cap. II ~35–45 mil, Cap. III ~110–160 mil, Cap. IV ~340–380 mil. Recomendado calibrado pela curva medida da equipe.
- **Ranking no banco**: `neon_setup.js` recalcula o poder de todas as contas com o motor (`tools/neon_recompute.js`); o guarda do save converte jogos antigos em cache; o jogo recarrega sozinho quando sai versão nova (`version.json`).
- **Sprites**: `src/sprite-meta.js` (gerado) iguala o tamanho aparente dos heróis (Vegeta e outros de arte estreita) e põe as formas despertadas com o pé no chão.

## Economia v3 (2026-09-29): ouro escasso, refino caro, Dojo com teto

Problema medido com `node tools/goldrate.js` (equipe de referência farmando o estágio do próprio nível): o ouro por abate
crescia ~5% por nível do inimigo, mas o custo do refino crescia quase linear. No nível 98 o farm rendia **5,4 milhões/h** e
um +10 se pagava em ~40 min. O Dojo ia até 180 níveis por treino (+360% ATK para a equipe inteira).

Mudanças:

- **Curva de ouro** (`goldPow` em `src/engine.js`): igual até o nível 33; depois o expoente cai para 0,47 do anterior.
  Vale para abates, estágios, andares, chefes, Fenda, expedições, AFK, contratos, missões diárias, crônicas, recompensas e Invasão.
- **Refino** (`upgradeCost` em `src/items.js`): até +4 igual; acima disso cresce mais rápido (+10 ≈ 2,3× o antigo, +15 ≈ 3,1×).
- **Forja**: agora dá para escolher o material (Tamahagane, Aço Estelar, Oricalco, Adamantina) e o risco aparece antes
  (sem risco / volta 1 nível / quebra). Refino que pode quebrar pede confirmação. Antes a tela só usava Tamahagane e dizia
  que o item "nunca é perdido", o que não era verdade.
- **Dojo v2** (`src/progression.js`): teto de 40 níveis por treino (5 + 3 por nível do Dojo); os 20 primeiros valem cheio, os
  seguintes metade (máx. +60% ATK/DEF, +75% HP, +12% crítico); preço antigo até o nível 20 e +15% a mais por nível depois. Níveis acima do teto em saves antigos
  devolvem metade do ouro gasto (uma vez, marcado por `dojoV:2`).

Resultado (`node tools/goldrate.js 6`, ouro por hora de farm ativo):

| Nível | Antes | Depois | +10 (Tamahagane, custo esperado) |
|---|---|---|---|
| 33 | ~59 mil | ~60–110 mil | ~4 mi |
| 60 | ~658 mil | ~150 mil | ~6,8 mi |
| 80 | 1–2,4 mi | ~190–350 mil | ~8,9 mi |
| 98 | 3–5,4 mi | ~180–440 mil | ~11,4 mi |

Um +10 passa a custar dezenas de horas de ouro, e cada nível de Dojo acima do 30 custa horas de farm.


## Dinheiro real sem as falhas do RMT (2026-09-30)

O Mythverse tem comércio oficial com dinheiro real (Gemas, Pix) no servidor Node. O RMT destruiu economias de MMO por
cinco falhas conhecidas; cada uma tem uma defesa, ligada por padrão (`server/economy.js`, variáveis em `.env.example`):

| Falha (Albion, Lost Ark, FFXI) | Defesa no Mythverse |
|---|---|
| **Lavagem de dinheiro e cartão roubado**: deposita dinheiro sujo e saca limpo | Gemas depositadas só compram; **só se saca o que foi ganho vendendo** (`WITHDRAW_EARNED_ONLY`). Sem cartão: só Pix |
| **Estorno** (Pix MED) depois que o item já foi entregue | Estorno tira as Gemas da conta, registra alerta e **bloqueia a conta para negociar**; vendas feitas a contas com menos de 30 dias ficam **7 dias** retidas antes do saque (as demais, 72 h) |
| **Exércitos de bots sacando** | Saque só com **30 dias de conta, nível 30 e 20 h de jogo**, para **chave Pix CPF válida, um CPF por conta**; revisão manual de cada saque |
| **Conta roubada sacando para o invasor** | **72 h sem saque depois de trocar a senha** (`WITHDRAW_AFTER_PASSWORD_HOURS`); o primeiro saque para um CPF que nunca recebeu desta conta gera o alerta `first_cpf_withdraw` para conferir a titularidade antes de pagar |
| **Mulas e revenda em cadeia** | Item comprado com Gemas fica **7 dias travado** para revenda; bloqueio de compra na mesma rede; alerta de pares que negociam demais |
| **Preço combinado** (entregar dinheiro comprando lixo caro) | **Faixa dura**: entre 1/4 e 5× a mediana das vendas daquela peça, no anúncio e na compra; acima de 10× gera alerta |
| **Pay-to-win e inflação** | Gemas não compram ouro nem nada da loja; só itens que outros jogadores **dropam jogando**, com nível mínimo para equipar; taxa de 5% sai da economia |

No modo Neon (site estático) não há dinheiro real: o save é do navegador e não teria como proteger saques. Lá o mercado
em ouro tem as mesmas defesas contra RMT feito por fora (`tools/neon_antirmt.sql`): conta nível 12 e 48 h para negociar,
faixa de preço, revenda só após 72 h, 3 compras por semana do mesmo vendedor, vendas acima de 2 milhões retidas 12 h e
alerta de volume anormal.

Testes: `node tests/rmt.test.js` (dinheiro real com as defesas) e `node tests/neon_antirmt.test.js` (mercado em ouro).
