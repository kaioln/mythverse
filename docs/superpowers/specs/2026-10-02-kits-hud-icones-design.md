# Kits únicos, HUD de batalha e ícones pintados: desenho

Data: 2026-10-02. Pedido do Kaio: "heróis precisam ter mais skills", "todos os heróis, todos precisam ser únicos",
"HUD muito sem sal, genérica e tampando os heróis", "cada ícone do site precisa ser CRIADO e ter carisma (API de imagens)",
"mecânica de combate completa, com sua HUD perfeita: descrição das habilidades, posicionamento; veja Final Fantasy 7,
Ragnarok Online, WoW". Complementa `2026-10-02-combate-profundidade-design.md` (as regras de PT, Quebra, intenção,
golpe cronometrado, reações e Assalto Total), que é implementado junto.

## 1. Kit de cada herói

- Todo herói tem **passiva, 3 habilidades e ultimate**, todas só dele (nenhuma habilidade compartilhada por classe ou
  elemento). São 72 heróis: as 72 habilidades de assinatura que já existiam mais 144 novas.
- **Habilidade I (assinatura)**: a que o herói já tinha. Custa 2 PT (3 se a recarga antiga era de 10 s ou mais).
- **Habilidade II (técnica)**: aprende no nível 6. Custa 1 PT. Golpe leve com um efeito de preparo (marca, quebra de
  armadura, escudo curto, cura pequena, ganho de PT, adiantar a vez de um aliado).
- **Habilidade III (arte secreta)**: aprende no nível 16. Custa 3 PT e descansa 3 vezes do herói depois de usada
  (`tcd`). Golpe pesado ou virada de luta; quase sempre tira mais Resistência (`brk`).
- Linguagem de efeitos nova: `sp` (devolve PT), `brk` (tira Resistência), `adv` (adianta a vez de um aliado), status
  `counter` (contra-ataca quando atingido) e modificadores de dano: `vsBroken`, `perDebuff`, `vs`, `spScale`,
  `lowSelf`, `hpm`.
- A descrição mecânica de cada habilidade é gerada dos efeitos (nunca mente); cada uma tem também uma frase de sabor.
- Orçamento de força: uma vez do herói vale em média ~1,45× ATK. Custo 1 ≈ 1,7×, custo 2 ≈ 2,3×, custo 3 ≈ 3,2× (em
  área, conta ~2,2 alvos). Conferido por `tools/balance.js` e `tools/sim.js`.
- Dados em `src/roster.js` (`KITS`), para não mexer na lista de arquivos que servidor, testes e ferramentas carregam.

## 2. HUD de batalha

Princípio: **nada do comando fica sobre o campo**. O palco mostra só o que é do mundo (personagens, placas dos
inimigos, números de dano) e três faixas discretas: região, ordem das ações e controles.

Abaixo do palco, o **console de batalha** (largura do palco), em duas linhas:

1. **Equipe**: quatro molduras (retrato, nome, vida, energia, efeitos, botão da ultimate com a tecla Q/W/E/R). A
   moldura do herói da vez acende; herói caído apaga.
2. **Comando**: à esquerda quem age (retrato grande, nome, "SUA VEZ" ou "AUTO"); no centro os **Pontos de Técnica** em
   gemas e a **barra de ações** com botões quadrados de ícone pintado: Atacar, I, II, III, Ultimate, Defender, Guarda,
   Poção, Elixir. Cada botão mostra tecla, custo em PT, descanso em vezes e o estado (pronto, sem PT, descansando,
   silenciado, bloqueado até o nível N). Embaixo, uma linha com a descrição da ação apontada. À direita, o **alvo**:
   nome, nível, elemento, vida, Resistência, fraquezas, efeitos e a intenção ("vai golpear Akira", "prepara Erupção").
- No AUTO e no SEMI a barra mostra o herói que está agindo e pisca o botão usado: dá para aprender o kit assistindo.
- Dica completa ao passar o mouse (ou dedo segurado): nome, tipo, custo, alvo, efeito, Quebra, frase de sabor, tecla.
- Teclas: Espaço atacar (ou Guarda fora da vez), 1/2/3 habilidades do herói da vez, Q/W/E/R ultimates, G defender,
  T Assalto Total, X próximo alvo, Z comando, F poção, C elixir. (A S D F deixam de ser habilidades: cada herói tem três.)
- Celular em pé: equipe em uma linha de quatro molduras compactas; barra de ações com botões de 52 px em uma linha
  que rola; alvo resumido em uma linha acima da barra.
- No palco, placa de cada inimigo: nome e nível, vida, Resistência em gomos, fraquezas (ícones), intenção. O anel do
  golpe cronometrado aparece sobre o alvo; o do Aparo, sobre a equipe.
- Implementação: `src/battle-hud.js` (módulo novo sobre `UIController`), `theme-battle.css`, marcação em `index.html`.
  O cartão antigo de cada herói (`#party-strip`) deixa de existir em luta.

## 3. Ícones pintados

- Todos os ícones do site passam a ser pinturas feitas para o jogo, no mesmo traço da arte (nanquim grosso, cores
  chapadas com luz simples, grão de papel): habilidades (5 por herói, 360), comandos e navegação, recursos, elementos,
  classes, efeitos, atributos, prédios, itens e talentos.
- Geração por folhas (grade 4×4 em 1024×1024, fundo transparente) com `tools/icon_gen.py`, que recorta cada ícone,
  confere a grade e monta os atlas: `assets/icons/kit/<herói>.webp` (5 ícones) e `assets/icons/ui.webp` + índice.
  Custo anotado em `assets/original/frames-ledger.json`. A primeira folha aprovada vira referência de estilo das demais.
- No jogo: `KT.Icon` (HTML e canvas) devolve a pintura; sem ela, cai no traço antigo (nada some).

## 4. Ordem

1. Dados dos kits e motor (PT, turno de uma ação, Quebra em pontos, intenção, marcas e reações, Assalto Total, golpe
   cronometrado, IA) com `tests/determinism.test.js` atualizado.
2. Console de batalha e placas no palco.
3. Ícones (geração em segundo plano desde o passo 1) e troca dos ícones no resto do site.
4. Ficha do herói com o kit completo, ajuda, wiki, README, dicas de tutorial, balanceamento medido.
