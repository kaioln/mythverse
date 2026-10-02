---
name: arte-feita-a-mao
description: Direção de arte e protocolo de produção para arte de jogo que não pareça gerada (cenários, retratos, sprites, ícones, logotipo), seja desenhada por artista ou gerada por IA e revisada. Use ao pedir, gerar, revisar, trocar ou medir qualquer imagem do jogo, e ao escrever briefing ou prompt de arte.
---

# Arte feita à mão (ou que pareça)

## Diagnóstico em números

```bash
python "${CLAUDE_PLUGIN_ROOT}/scripts/art-check.py" assets/scenes/thumb assets/ui/banners
```

Mede por imagem e aponta pares repetidos:

| medida | o que pega | olhe quando |
|---|---|---|
| `acesa` | fração de pixels claros | > 0,15 numa cena noturna: tudo aceso |
| `escura` | fração em sombra funda | < 0,10: sem zona calma |
| `sat` e `hi_sat` | saturação média e fração muito saturada | `hi_sat` > 0,30: arco-íris |
| `matiz` | entropia de matiz em bits | > 2,2: cena sem tom próprio |
| `detalhe` | microdetalhe por ladrilho: média e variação | média alta com variação baixa: detalhe igual em todo lugar |
| pares | distância dHash entre duas imagens (0 a 64) | ≤ 8: mesma composição recolorida |

Os limiares apontam onde olhar; não decidem sozinhos. Leitura e exemplos reais em `references/limiares.md`.

## A direção (vale para toda peça nova)

1. **Composição primeiro.** Antes de pintar ou gerar: esboço de 3 valores (claro, médio, escuro) numa grade 3×3. Onde está o foco, onde está a massa calma, por onde a luz entra. Duas cenas da mesma família nunca partilham o esboço.
2. **Uma luz.** Uma fonte principal (lua, forja, uma lanterna) e no máximo duas secundárias apagadas. O chão longe da chama afunda na noite.
3. **Carta de cor com nome.** 5 a 7 cores por peça, tiradas da carta do projeto. Cada região guarda UM tom (areia, gelo, violeta) e só ele.
4. **Ingredientes com limite.** Lanternas ≤ 3. Cerejeira só onde a região é de cerejeiras. Torii só em santuário. Lua só quando a história pede. Bandeiras ≤ 2. O que não está na lista não entra.
5. **Lista do que NÃO aparece.** Toda peça nasce com ela: sem gente, sem texto, sem brasão, sem escada que não leva a lugar nenhum, sem motivo de outro mundo.
6. **Mesma tinta.** Contorno sumi-índigo (nunca preto puro) em figura e fundo; mesma faixa de valor. Nada de boneco chapado sobre pintura brilhante.
7. **Escala do elenco.** Heróis em 2,5 cabeças; yokai e chefes grandes, mas na mesma espessura de linha. Medir: altura do sprite ÷ altura do chefe, e manter a razão por família.
8. **Detalhe só no foco.** O resto em mancha. Se tudo está nítido, nada está.

## Protocolo de produção (artista ou gerador)

Modelo de briefing e um exemplo preenchido: `references/briefing.md`.

1. **Briefing escrito**: esboço 3×3, luz, carta de cor, ingredientes com limite, lista do que não aparece, referência por **técnica** (shin-hanga, nanquim e aguada, recorte de papel), nunca por artista ou obra.
2. **Gerador**: prompt curto e concreto, até 12 linhas. O esboço 3×3 vira frase ("foco no terço direito; terço esquerdo em sombra calma; luz única da forja"). Pedir "pareça feito por humano" não funciona; pedir limites funciona. Pedir o que NÃO entra funciona.
3. Produzir 4 variações, escolher pela **composição** (não pela beleza) e guardar o rascunho em `assets/original/<tipo>/`.
4. **Passe humano obrigatório**, anotando o que mexeu: mãos e dedos; objetos que se fundem; escada, ponte ou cachoeira sem destino; padrão que não continua; texto ou brasão (tirar e refazer com fonte real); motivo fora do mundo; luz contraditória; horizonte torto; lanterna além da cota.
5. **Medir** com `art-check.py` e comparar com a peça vizinha: a mesma família tem que *medir* parecido e não *ser* parecida.
6. **Conferir no jogo** em 375 e 1366×657 com sprites em cima (a cena existe para eles).

## O que não fazer
- Filtro em massa (posterizar, borrar, grão sobre tudo). Unifica, não desenha; apaga detalhe. Tentado neste projeto e desfeito no mesmo dia.
- Recolorir uma cena para fazer outra.
- "Melhorar" com upscale: amplia os erros.
- Trocar só o fundo e manter o boneco de outro traço (ou o contrário).

## Logotipo e marca
Marca tipográfica na fonte de título do projeto + um símbolo que uma mão faria (círculo de tinta com falha de pincel, selo vermelho com um kanji). Duas cores, três no máximo. Sem chanfro dourado, sem orbe, sem faísca, sem partícula, sem pétala solta. Testar em 32 px e em preto chapado: se não se reconhece, não é marca.
