# Combate com profundidade: desenho

Data: 2026-10-02. Pedido do Kaio: "melhorar mecânica de combate que ainda está muito cru". Direção escolhida por ele
(as quatro): Fraqueza/Quebra/intenção, Pontos de Técnica, golpe cronometrado, reações elementais e ataque em equipe.

## Problema

A luta já é por turnos, mas a decisão de cada turno é rasa: a habilidade tem recarga em segundos e, se está pronta, usa-se.
Não há recurso para administrar, o inimigo não mostra o que vai fazer, só elites e chefes têm barra de postura e os
elementos só multiplicam dano.

## Regras novas

### 1. Pontos de Técnica (PT)

- Reserva da equipe, de 0 a 6. Começa a luta com 3 e ganha +1 a cada onda nova.
- Na vez de um herói ele faz UMA ação: **Atacar** (+1 PT, +10 energia), **Habilidade** (custa PT, +10 energia) ou
  **Defender** (+1 PT, +15 energia, metade do dano até a próxima vez). A **ultimate** continua fora do turno (energia 100).
- Custo da habilidade: 2 PT; as pesadas (recarga antiga de 10 s ou mais) custam 3. `skill.cost` pode fixar outro valor.
- Recarga em segundos das habilidades dos heróis deixa de existir. O atributo `cdr` (itens e talentos) vira
  **Economia**: chance igual ao valor (até 60%) de recuperar 1 PT ao usar a habilidade. Efeitos `cdr` (−N s para aliados)
  somam N/3 PT; `cdreset` devolve o custo; `delay` em heróis tira 1 PT.
- Quebrar um inimigo e aparar no tempo certo dão +1 PT cada.
- Inimigos (e heróis rivais da Arena) seguem com recarga em segundos.

### 2. Fraqueza e Quebra para todos

- Todo inimigo tem **Resistência** (pontos): comum 4, elite e guardião 8, chefe de andar 10, chefe 14, invasão 20.
  Depois de cada Quebra o total cresce 30%.
- Cada ação tira pontos uma vez por alvo: golpe 1, habilidade 2, ultimate 3; efeitos passivos e dano contínuo, 0.
  Em dobro se o atacante explora uma **fraqueza**; pela metade se o elemento dele é resistido. `breakPow` multiplica.
- Fraquezas de um inimigo: os elementos fortes contra o elemento dele (tabela de elementos) e **uma classe**, pela
  família: golem → Vanguarda, oni → Executor, aranha e raposa → Atirador, espírito e dragão → Arcanista,
  espectro → Suporte, baú → Executor.
- Resistência zerada: **QUEBRA**. O inimigo fica 4 s atordoado, perde o golpe preparado, recebe +35% de dano e leva um
  dano de quebra (6% da vida; 3% em chefes). A equipe ganha +1 PT.

### 3. Intenção do inimigo

- Cada inimigo escolhe o alvo do próximo golpe assim que termina o anterior (não mais na hora de bater) e mostra:
  golpe em <herói>, habilidade <nome> ou especial em preparo. Provocar continua puxando o golpe.
- Serve para decidir Defender com quem será atacado e guardar a Guarda para o especial.

### 4. Golpe cronometrado (só no comando MANUAL, luta ao vivo)

- Ao mandar Atacar ou usar a habilidade, um anel fecha sobre o alvo; confirmar na faixa dourada dá **PERFEITO**
  (+30% de dano e +1 ponto de Quebra), perto dela **BOM** (+12%), fora, nada.
- O tempo é julgado na tela (como o Aparo) e vai junto com a ordem: `act attack:q`, `skill i:q` (q = 0, 1, 2).
- Pode ser desligado em Configurações (a ordem sai na hora, sem bônus).

### 5. Reações elementais

- Habilidades e ultimates deixam no inimigo a **marca** do elemento do herói por 8 s. Um golpe de outro elemento
  consome a marca e dispara uma reação (uma por alvo por ação):
  Derretimento (Fogo+Gelo, +50% no golpe), Vapor (Fogo+Água, +40%), Eletrochoque (Água+Raio, atordoa e espalha),
  Supercondução (Gelo+Raio, quebra armadura), Sobrecarga (Fogo+Raio, explode em área), Incêndio (Fogo+Vento, queima
  todos), Queimada (Fogo+Natureza, queimadura forte), Nevasca (Gelo+Vento, lentidão em todos), Congelamento (Gelo+Água),
  Florescer (Natureza+Água, cura o aliado mais ferido), Catalisar (Natureza+Raio), Eclipse (Luz+Sombra, marca de
  vulnerabilidade), Estilhaço (Terra com qualquer um, +3 de Quebra), Redemoinho (Vento com os demais, espalha) e
  Ressonância (os outros pares, +25%).

### 6. Assalto Total

- Com todos os inimigos vivos quebrados ao mesmo tempo, a equipe pode soltar o **Assalto Total**: cada herói vivo golpeia
  cada inimigo (100% do ataque, 20% de perfuração). No AUTO e no SEMI sai sozinho; no MANUAL aparece um botão.
- Uma vez por "janela" de quebra (volta a ficar disponível depois que alguém se recompõe e é quebrado de novo).

## Onde mexe

- `src/data.js`: fraqueza por família, tabela de reações.
- `src/engine.js`: PT, turno de uma ação, Quebra em pontos para todos, alvo antecipado, marca e reações, Assalto Total,
  bônus do golpe cronometrado, IA do AUTO/SEMI gastando PT com reserva para o apoio.
- `src/renderer.js`: fraquezas, pontos de Resistência, intenção, marca elemental, anel do golpe cronometrado, reações.
- `src/ui.js`, `index.html`, CSS: PT na janela de comando, custos, botão do Assalto Total, textos de ajuda e wiki.
- Itens e talentos: textos de "recarga" passam a falar de Pontos de Técnica.

## Verificação

- `tests/determinism.test.js`: cliente e servidor iguais com os comandos novos; asserts de PT, Quebra em pontos,
  intenção estável, reação, Assalto Total e bônus do golpe cronometrado.
- `tests/smoke.js`: lutas completas em todas as regiões no AUTO.
- `tools/balance.js` e `tools/sim.js`: curva de poder refeita depois da mudança (ver o desenho de balanceamento).
