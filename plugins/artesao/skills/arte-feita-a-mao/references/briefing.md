# Briefing de peça de arte

Preencha tudo antes de desenhar ou gerar. Uma peça sem briefing é uma peça sem decisão.

## Modelo

```
PEÇA: <tipo e id>  (ex.: cenário de caçada hunt_desert, 16:9, 1600×900, espaço livre para sprites no terço de baixo)
MUNDO: <região, hora do dia, clima, o que aconteceu ali>
ESBOÇO 3×3 (C claro, M médio, E escuro):
  E M C
  E M M
  M M E
FOCO: <o único lugar de detalhe>  (ex.: terço direito, a boca de um túnel de areia)
MASSA CALMA: <≥ 40% da área>  (ex.: terço esquerdo e o céu: duas manchas de valor)
LUZ: <uma fonte>  (ex.: lua baixa à direita; sem lanternas)
CARTA DE COR (5 a 7): <nome e hex>  (ex.: sumi #1e1b2c, ai #26345e, nezumi #96a0ac, washi #eee5d0, kin #e2aa4e apagado, areia #c9a46a)
INGREDIENTES E COTAS: <lista>  (ex.: dunas 3, ruína de arenito 1, lua 1, lanterna 0, cerejeira 0)
NÃO APARECE: <lista>  (ex.: gente, texto, brasão, torii, água, bandeira, cachoeira)
TÉCNICA DE REFERÊNCIA: <por técnica, nunca por artista>  (ex.: gravura shin-hanga; nanquim com aguada; massas chapadas com borda de tinta)
ESCALA: <o que mede o quê>  (ex.: a ruína tem 3 alturas de herói; o herói ocupa 1/4 da altura do palco)
FAMÍLIA: <peças irmãs e o que NÃO pode repetir>  (ex.: irmã de hunt_frost: mesma câmera, esboço diferente, foco em lado oposto)
```

## Como vira prompt (gerador de imagem)

Até 12 linhas. Cada linha é uma decisão do briefing, sem adjetivo de qualidade ("lindo", "épico", "detalhado", "8k"). Exemplo para o briefing acima:

```
Cena 16:9 de deserto à noite para um RPG, pintura em massas chapadas com borda de tinta, como gravura.
Terço direito: boca de um túnel de arenito em ruína, única área com detalhe.
Terço esquerdo e céu: duas manchas de valor, sem detalhe.
Luz: só a lua baixa à direita; o chão longe dela afunda no escuro.
Cores: índigo profundo, cinza-azulado, areia apagada, papel cru; ouro só na borda da lua.
Três dunas. Uma ruína. Nenhuma lanterna, nenhuma cerejeira, nenhuma bandeira, nenhuma água.
Terço de baixo livre e plano, para personagens.
Sem gente, sem texto, sem brasão, sem moldura.
```

Gere 4. Escolha pela composição. Faça o passe humano (lista no SKILL.md). Meça.

## Exemplo real (Mythverse, 2026-10-02)

As cenas de caçada `hunt_desert`, `hunt_sky` e `hunt_tide` medem distância dHash 1 entre si: são a mesma composição recolorida. As arenas `boss` e `boss_sand`: distância 0. O briefing de cada uma precisa partir de um esboço 3×3 diferente (foco à esquerda numa, à direita na outra, ao fundo na terceira) e de uma cota de ingredientes própria.
