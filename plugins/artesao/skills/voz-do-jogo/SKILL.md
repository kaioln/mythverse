---
name: voz-do-jogo
description: Voz e texto do jogo em português (botões, dicas, avisos, telas vazias, diálogos, descrições de habilidade e item, nomes, números, plural) sem cara de texto gerado. Use ao escrever ou revisar qualquer texto que o jogador lê, ao nomear herói, item, habilidade, zona ou prédio, e ao revisar lore.
---

# Voz do jogo

## A voz
Alguém que conhece o lugar falando com quem acabou de chegar: direto, concreto, sem vender. Frases curtas. Uma ideia por frase. O jogo nunca pede desculpas, nunca grita, nunca explica o que a tela já mostra.

## Proibido (sinais de texto gerado)
- Travessão (— ou –) e ponto e vírgula em texto de interface. Use ponto, dois-pontos ou vírgula.
- "Não é apenas X, é Y"; tríades ("rápido, forte e letal"); "mais do que um…"; "verdadeiro(a)"; "experiência única/imersiva"; "leve ao próximo nível"; "prepare-se para"; "desvende"; "mergulhe"; "jornada" fora de contexto literal.
- Exclamação em série. Uma por tela, no máximo, e só quando alguém grita de verdade.
- "(s)" para plural, "(a)" para gênero. Escreva o plural certo (ver abaixo).
- "Clique aqui", "Clique para continuar", "Saiba mais", "Começar agora", "Bem-vindo(a)", "Em breve", "Preparando a jornada…".
- Emoji. Use o ícone desenhado ou o kanji da interface.
- Descrição que repete a fórmula em tudo ("Causa X de dano a Y e aplica Z"). A fórmula fica na linha técnica; o item ganha uma linha humana.
- Nome por sorteio de palavras ("Lâmina Sombria do Eclipse Eterno", "Guardião Ancestral das Sombras").

## Regras por tipo de texto
**Botão**: verbo no infinitivo, até 2 palavras. Resgatar, Partir, Refinar, Convocar, Equipar. Nunca "OK", nunca "Clique".
**Dica (tooltip)**: o que é, em 1 linha; o que fazer, em 1 linha. Fala de botão no celular e de tecla no computador (detecte `(hover:none)`).
**Aviso**: o fato e o que mudou. "Forja no nível 3: refino até +6." Nada de "Parabéns!".
**Tela vazia**: o que vai aparecer ali e o próximo passo com verbo. "Nenhum item ainda. Os primeiros caem no Bosque das Lanternas." Nunca "Selecione um item à esquerda para…".
**Diálogo**: quem fala tem jeito de falar (vocabulário, ritmo, assunto preferido). Uma linha por balão, até 110 caracteres. O cursor de "continuar" é um glifo (▼), como em todo JRPG; não escreva "Clique para continuar".
**Habilidade e item**: linha técnica gerada dos efeitos (precisa, curta) + linha humana escrita à mão (o que se vê, o que se sente, de onde vem). Ex.: "Lótus Branca. Cura 18% da vida de todos. / Pétalas de gelo que fecham ferida e dente."
**Lore**: concreto antes de abstrato. Nomes de lugar, objeto, cheiro, hora. Nenhuma frase que sirva para qualquer jogo.
**Nome**: uma ideia; origem no mundo (lugar, material, gesto); até 3 palavras. Teste: se trocar uma palavra por outra da mesma lista e continuar "bom", é sorteio.

## Plural e número
- Função de plural no projeto (`KT.Utils.plural(n, 'ponto')`, `KT.Utils.count(n, 'ponto')` no Mythverse). Verbos também concordam: "1 herói causa", "3 heróis causam".
- Números com separador pt-BR (1.500; 12,5%). Grandes em "14,6M" só onde o espaço manda.
- Tempo: "3 h 20 min", "0:45". Nunca "3h20m" nem "00:45:12" fora de cronômetro.

## Antes e depois
Exemplos reais do Mythverse em `references/antes-depois.md`. Ao revisar, escreva o "depois" ao lado do "antes" antes de mexer no código.
