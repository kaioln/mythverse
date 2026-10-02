---
name: hub-ui-ux
description: Padrões de HUB, HUD de combate, painéis, botões e layout de jogo web (desktop e celular) com cara de jogo, não de aplicativo ou template. Use antes de criar ou mudar qualquer tela, painel, botão, HUD ou layout, e para revisar telas com excesso de informação, cartões idênticos, pílulas, degradês, estouro ou responsividade ruim.
---

# HUB e interface com cara de jogo

## Princípio: a tela mostra só o que importa agora
- **Combate**: vida, energia, inimigos e no máximo 3 controles. O resto em "Mais". Nada de objetivo, texto longo ou painel durante a luta.
- **HUB (cidade)**: um único foco de ação ("Continuar" e o próximo objetivo). Os distritos vivem no cenário; o que está pronto aparece como selo numérico, não como texto.
- **Painéis**: uma pergunta por painel. Precisa de mais? Abas ou seções recolhíveis.

## Hierarquia (padrão de jogos mobile e idle)
1. Topo: identidade do jogador à esquerda; moedas no centro; sistema à direita.
2. Esquerda (desktop) ou barra inferior (celular): até 6 destinos fixos e "Menu".
3. Centro: o mundo. Nunca coberto por texto além de rótulos curtos.
4. Direita: rastreador de missão compacto (título, 1 linha, 1 botão).
5. Base: a equipe (retrato, vida, ultimate).

## Cara de app ou de template (reconhecer e trocar)
| sinal | troque por |
|---|---|
| grade de cartões idênticos (ícone, título, texto, botão) | um cartão principal maior e os outros menores; tamanho diz importância |
| pílula arredondada em tudo; raio de 12 a 24 px | canto quase reto (2 a 4 px); selo retangular |
| degradê roxo-azul, 135deg, vidro fosco, glow, sombra colorida | cor chapada; sombra preta curta; luz é contraste de valor |
| emoji como ícone | ícone no mesmo traço de todos |
| cores padrão do Tailwind | carta de cor do projeto, com nome |
| Inter, Outfit, Poppins, Montserrat, Roboto | fontes com origem no mundo do jogo (serifa de título + sem-serifa com caráter) |
| tudo centralizado e simétrico | alinhado à esquerda; assimetria com intenção |
| rótulo em caixa alta espaçada em todo canto | caixa alta só em rótulo de até 2 palavras |
| tela vazia que explica a si mesma | o vazio mostra o que vem: silhueta, exemplo, próximo passo com verbo |
| botão "Clique aqui", "Saiba mais", "Começar agora" | verbo da ação: Resgatar, Partir, Refinar, Convocar |
| 3 cores de ação disputando | uma cor de ação; ouro só para valor ou escolhido |

## Texto na interface
- Título com até 4 palavras. Descrição com 1 linha (~70 caracteres); o detalhe vai para o toque.
- Números antes de palavras: "3 prontos", "12/20", selo vermelho com contagem.
- Verbos nos botões. Plural certo (nunca "(s)").

## Layout e responsividade (obrigatório conferir)
- Larguras: 320, 375, 425, 768, 1024, 1440 e 2560 px. Sem rolagem lateral, sem palavra cortada.
- Altura também conta: notebook é 1366×657; celular com barra do navegador fica em torno de 360×650. O que só cabe em 812 de altura não cabe na tela de quem joga.
- Grades com `minmax(0,1fr)`; textos com `min-width:0` e quebra em até 2 linhas antes de reticências.
- Alvos de toque ≥ 40 px no celular; nada atrás da barra inferior (safe-area).
- Selos sempre acima da arte; nunca sobre o nome.

## Ferramentas (se o projeto tiver `tools/ui`, como o Mythverse)
- `tools/ui/cdp.js` com Chrome headless: celular de verdade (toque, 375), cursor, tempo e recortes ampliados.
- `hud.js` (console de batalha em vários tamanhos), `overflow.js` (nada passa da borda), `panels.js` (abre cada painel e aba e acusa exceção), `shots.js` (fotos de painéis).
- No Linux, o Chrome pode precisar de `--no-sandbox`: aponte `CHROME` para um script que o acrescente.

## Antes de dizer "pronto"
- Screenshot em 375, 768 e 1440 da tela mexida, e em 1366×657.
- `?overflow=1` (ou `overflow.js`) sem elemento passando da borda.
- Mexeu em painel: `panels.js` sem achados.
- `/artesao texto` e `/artesao tela` sem achado alto.
- Testes do projeto verdes.
