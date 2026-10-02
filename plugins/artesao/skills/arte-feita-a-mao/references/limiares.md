# Limiares do art-check e como ler

`art-check.py` dá números; a leitura é sua. Use os limiares abaixo como "olhe aqui", não como nota.

| medida | o que é | suspeito quando | o que costuma significar |
|---|---|---|---|
| `sat` | saturação média (0 a 1) | > 0,45 em cena noturna | cores "ligadas" em toda parte |
| `hi_sat` | fração de pixels com saturação > 0,6 | > 0,30 | arco-íris, luz colorida demais |
| `acesa` | fração com luminância > 0,55 | > 0,15 à noite | tudo aceso ao mesmo tempo |
| `escura` | fração com luminância < 0,12 | < 0,10 | sem massa calma; sem onde o olho descansar |
| `matiz` | entropia dos matizes (bits, 12 faixas) | > 2,2 | cena sem tom próprio |
| `detalhe` | média da variância do laplaciano por ladrilho (6×6), e o coeficiente de variação entre ladrilhos | média alta e variação < 0,6 | microdetalhe igual em todo lugar (sem foco) |
| pares | distância de Hamming entre dHash de 64 bits | ≤ 8 | mesma composição recolorida; ≤ 14 vale conferir |

## O que foi medido no Mythverse (cenários, 2026-10-02)

- `boss` ~ `boss_sand`: 0. `boss` ~ `boss_sky`: 5. Três arenas, uma composição.
- `hunt_desert` ~ `hunt_sky`: 1. `hunt_desert` ~ `hunt_tide`: 1. `hunt_frost` ~ `hunt_sky`: 2. Cinco caçadas, uma composição.
- `dungeon_sky` ~ `dungeon_tide`: 2. `dungeon_forge` ~ `dungeon_tide`: 8.
- `village` ~ `village-expanded`: 4 (aqui é esperado: é a mesma cidade).
- `boss_tide`: `hi_sat` 0,55 e `matiz` 0,87: uma cor só, estourada.
- `village`, `market-city`, `world-map`: `matiz` > 2,3 e `escura` ≤ 0,06: tudo aceso, todas as cores.

Conclusão: o problema das cenas é de composição e luz, não de acabamento. Filtro não resolve; briefing novo por cena resolve (ver `briefing.md`).
