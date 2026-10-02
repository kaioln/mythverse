---
name: game-ui-ux
description: Padrões de UI/UX de jogos (HUB, HUD de combate, painéis, mobile) para o Mythverse. Use antes de criar ou mudar qualquer tela, painel, botão, HUD ou layout do jogo, e para revisar telas com excesso de informação, desalinhamento, overflow ou responsividade.
---

# UI/UX de jogos: regras do Mythverse

## Princípio: a tela mostra só o que importa AGORA
- **Combate**: vida, energia/ultimate, inimigos e no máximo 3 controles (FORÇA, VEL, CIDADE). O resto fica em "Mais".
  Nada de objetivo, texto longo ou painel durante a luta.
- **HUB (cidade)**: um único foco de ação ("Continuar" e o próximo objetivo). Os distritos ficam no cenário, e o que
  estiver pronto aparece como selo numérico, não como texto.
- **Painéis**: uma pergunta por painel. Se precisar de mais, use abas ou seções.

## Hierarquia (padrão de jogos mobile/idle: AFK Arena, Genshin, Honkai, Ragnarok M)
1. Topo: identidade do jogador (avatar, nível) à esquerda; moedas no centro; sistema à direita.
2. Esquerda (desktop) ou barra inferior (celular): até 6 destinos fixos + "Menu".
3. Centro: o mundo (cenário ou arena). Nunca coberto por texto além de rótulos curtos.
4. Direita: rastreador de missão compacto (título, 1 linha, 1 botão). Seções recolhíveis; o jogador escolhe o que abre.
5. Base: a equipe (retrato, vida, ultimate).

## Texto
- Título com até 4 palavras. Descrição com até 1 linha (~70 caracteres) no HUB; o detalhe vai para o toque/abertura.
- Números > palavras: "3 prontos", "12/20", selo vermelho com contagem.
- Verbos nos botões ("Resgatar", "Continuar", "Ir"), nunca "Clique aqui".

## Visual (identidade Sumi)
- Tinta índigo, papel, **um** acento vermelho-laca (#c9472d) para ação, ouro só para recompensa/valor.
- Sem gradiente decorativo, sem brilho/neon, sem emoji (use kanji `.kj` ou ícones `.ic`).
- Serifa Shippori Mincho B1 em títulos; Zen Kaku Gothic New em texto e números (peso 500-700; 900 só em números grandes). Nada de Outfit, Inter, Poppins: são as fontes de todo site gerado.

## Layout e responsividade (obrigatório conferir)
- Larguras: 320, 375, 425, 768, 1024, 1440 e 2560 px. Sem rolagem lateral, sem texto cortado no meio da palavra.
- Grades com `minmax(0,1fr)`; textos com `min-width:0` e quebra em até 2 linhas antes de reticências.
- Alvos de toque ≥ 40 px no celular; nada atrás da barra inferior (padding-bottom com safe-area).
- Selos/badges sempre acima (z-index) da arte; nunca sobre o nome.
- Altura também conta: notebook é 1366×657 e celular com a barra do navegador fica em torno de 360×650. O que só cabe
  em 768 ou 812 de altura não cabe na tela de quem joga.
- Ferramentas: `tools/dev/panel.html?p=<painel>&overflow=1` e `index.html?devseed=1[&devfight=hunt]` com Chrome headless
  (`--window-size=W,H --screenshot`), e o navegador do app com `resize_window`.
- `tools/ui/cdp.js` (Chrome headless pelo protocolo DevTools): celular de verdade (toque, 375 de largura), cursor, tempo e
  recortes ampliados. Cenários prontos: `hud.js` (console de batalha em vários tamanhos), `play.js` (uso), `overflow.js`
  (estouro) e `panels.js` (abre cada painel e aba e acusa exceção). O navegador do app pausa a animação quando o painel
  não está à vista: foto de coisa que se mexe só vale por aqui.

## Antes de dizer "pronto"
- Screenshot em pelo menos 375, 768 e 1440 px da tela mexida, e em 1366×657.
- `?overflow=1` sem elementos passando da borda (console de batalha: `node tools/ui/cdp.js tools/ui/overflow.js`).
- Mexeu em painel ou em `ui.js`: `node tools/ui/cdp.js tools/ui/panels.js` sem achados.
- `npm test` verde.
