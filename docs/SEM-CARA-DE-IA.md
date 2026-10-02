# Sem cara de IA: auditoria e plano

Data: 2026-10-02. Gatilho: um designer gráfico olhou o jogo e disse "essa arte tá com cara de IA". Ele tem razão, e este
documento diz exatamente onde, com número, e o que fazer em cada frente. A régua geral está no plugin
[`mythverse`](../plugins/mythverse/README.md) (skills `sem-cara-de-ia`, `arte-feita-a-mao`, `hub-ui-ux`, `voz-do-jogo`).

## O que foi medido

### Cenários (`assets/scenes`)

`python3 plugins/mythverse/scripts/art-check.py assets/scenes/thumb`:

| o que | resultado |
|---|---|
| mesma composição recolorida (dHash ≤ 8 em 64) | `boss` ~ `boss_sand`: 2 · `boss` ~ `boss_sky`: 5 · `hunt_desert` ~ `hunt_sky` ~ `hunt_tide`: 1 · `hunt_frost` ~ `hunt_sky`: 2 · `dungeon_sky` ~ `dungeon_tide`: 2 · `hunt` ~ `hunt_swamp`: 3 · `hunt` ~ `hunt_sakura`: 4 |
| tudo aceso, sem zona calma (escura < 0,10) | `village` 0,05 · `village-expanded` 0,03 · `market-city` 0,06 · `world-map` 0,06 · `boss_event` 0,08 · `boss_tide` 0,09 · `dungeon_clock` 0,09 · `dungeon_sky` 0,06 |
| arco-íris (hi_sat > 0,30) | `boss_tide` 0,55 · `dungeon_forge` 0,34 · `village-expanded` 0,34 · `hunt_sakura` 0,32 · `market-city` 0,32 |
| sem tom próprio (matiz > 2,2 bits) | `world-map` 2,84 · `village` 2,44 · `market-city` 2,41 · `village-expanded` 2,39 · `hunt_frost` 2,37 · `boss_event` 2,31 |
| microdetalhe igual em todo lugar | todos os 24 cenários menos `summoning` |

Leitura: o problema é de **composição e luz**, não de acabamento. Por isso o tratamento de "estampa" do dia 2 (posterizar,
grão) foi desfeito: filtro unifica acabamento e apaga detalhe, e a composição repetida continua lá.

### Marca
O logotipo era o de todo jogo gerado: letra dourada chanfrada com brilho, orbe roxo, faíscas e pétalas. Trocado hoje.

### Tipografia
Outfit (a sem-serifa de todo site gerado) em toda a interface, mais Lilita One sem uso. Trocadas hoje.

### Texto
`node plugins/mythverse/scripts/audit.js --min=médio src index.html *.css`: 90 achados altos antes das correções. Os reais:
"(s)" em 31 lugares, "Clique para continuar ▸" no diálogo, "Clique aqui" na dica do alvo, "Bem-vindo(a)", "Preparando a
jornada…", telas vazias que explicam a tela, "clique neles para focar a equipe!". O resto eram ★ ✓ ✕ (tipografia, o
auditor foi ajustado) e "próximo nível" (RPG tem nível; o auditor foi ajustado).

### Interface
Depois de `theme-estampa.css` (canto reto, selo, uma cor de ação) a interface já não tem cara de aplicativo. Ficam
pílulas (`border-radius:999px`) e vidro fosco em alguns selos e barras; são achados baixos, listados pelo auditor.

## O que mudou hoje

- **Marca nova** (`tools/brand.js` gera tudo a partir de um desenho): círculo de tinta (ensō) com a falha do pincel no
  alto, "MYTHVERSE" em Shippori Mincho B1, selo vermelho com 月 (Tsukimori é a cidade da lua). Duas cores e o selo.
  Versão de papel para o README e a prévia de link, versão de papel-sobre-noite para o jogo, marca só para ícone.
- **Tipografia**: Zen Kaku Gothic New (desenho japonês, cinco pesos) no lugar de Outfit em interface, números e palco.
  Lilita One saiu da lista de fontes.
- **Texto**: função de plural (`KT.Utils.plural`, `KT.Utils.count`, `KT.Utils.fill`) e 31 trechos reescritos; cursor ▼
  no diálogo em vez de "Clique para continuar"; dica do alvo fala de toque no celular e de tecla no computador; telas
  vazias apontam o próximo passo; abertura diz "Acendendo as lanternas…"; faixa da temporada sem a vírgula no nome.
- **Plugin `mythverse`** em `plugins/mythverse` (marketplace na raiz do repositório; `.claude/settings.json` já aponta).

## O que falta, por ordem

1. **Cenários: repintar por briefing**, não por filtro. Prioridade pelo número: as cinco caçadas que são uma só
   (`hunt_desert`, `hunt_sky`, `hunt_tide`, `hunt_frost`, `hunt_swamp`), as três arenas de chefe (`boss`, `boss_sand`,
   `boss_sky`), `boss_tide` (uma cor estourada), as masmorras gêmeas (`dungeon_sky`, `dungeon_tide`), a cidade e o mapa
   (tudo aceso). Modelo e exemplo em `plugins/mythverse/skills/arte-feita-a-mao/references/briefing.md`: esboço 3×3
   diferente por cena, uma luz, carta de cor com nome, cota de lanternas e cerejeiras, lista do que não aparece, quatro
   variações, escolha pela composição, passe humano, medição.
2. **Pinturas de painel** (`assets/ui/banners`): a mesma régua; todas têm luz de todo lado.
3. **Ícones de interface**: estão no mesmo traço, mas abaixo de 28 px viram borrão. Versão simplificada para o menu.
4. **Elenco**: heróis de 2,5 cabeças ao lado de chefes de 7. Assumir as duas réguas e medir a razão por família.
5. **Texto humano** em habilidades e itens: a linha técnica fica; cada um ganha uma linha escrita à mão.
6. **Som**: conferir se os efeitos têm assinatura ou são biblioteca (fora desta auditoria).

Antes de aceitar qualquer peça nova: `/mythverse arte <pasta>` e `/mythverse texto <arquivo>`, e a lista do skill
`sem-cara-de-ia`.
