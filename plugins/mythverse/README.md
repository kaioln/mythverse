# Mythverse

Plugin do Claude Code para tirar a cara de "feito por IA" de um jogo web, em tudo: arte, logotipo, tipografia, HUB e interface, texto, nomes e estrutura. Nasceu no [Mythverse](https://github.com/kaioln/mythverse) e vale para qualquer jogo em HTML, CSS e JavaScript.

## O que vem dentro

| peça | o que faz |
|---|---|
| skill `sem-cara-de-ia` | a régua: o que entrega IA em cada área e o que fazer no lugar. Carrega sozinha antes de qualquer tela, asset ou texto |
| skill `arte-feita-a-mao` | direção de arte e protocolo de produção (briefing, prompt, passe humano, medição) para cenário, retrato, sprite, ícone e logotipo |
| skill `hub-ui-ux` | HUB, HUD de combate, painéis e celular com cara de jogo, não de aplicativo |
| skill `voz-do-jogo` | texto em português sem cara de gerado: botões, dicas, telas vazias, diálogos, descrições, nomes, plural |
| agente `revisor-mythverse` | revisa telas, assets, textos e diffs e devolve achados com gravidade, local e correção pronta |
| comando `/mythverse` | `texto`, `arte`, `tela` ou `tudo`: roda os scripts e resume |
| hook | ao editar .js, .css, .html ou .md, varre o arquivo e avisa o que parece gerado (não bloqueia) |
| `scripts/audit.js` | varredura de texto, CSS e HTML (Node, sem dependências) |
| `scripts/art-check.py` | medição de imagens: luz, saturação, matiz, microdetalhe e composições repetidas (Pillow e NumPy) |

## Instalar

```
/plugin marketplace add kaioln/mythverse
/plugin install mythverse@mythverse
```

Num projeto, o `.claude/settings.json` pode recomendar o plugin a todo mundo que abrir o repositório:

```json
{
  "extraKnownMarketplaces": {
    "mythverse": { "source": { "source": "github", "repo": "kaioln/mythverse" } }
  },
  "enabledPlugins": ["mythverse@mythverse"]
}
```

`art-check.py` precisa de `pip install pillow numpy`.

## Usar

- `/mythverse` ou `/mythverse tudo`: auditoria completa da pasta atual.
- `/mythverse texto src/panels.js`: só um arquivo.
- `/mythverse arte assets/scenes/thumb`: mede as cenas e aponta pares repetidos.
- "Revise esta tela com o revisor-mythverse": o agente lê a régua, roda os scripts e devolve a lista.

## A ideia em uma frase

Imagem, tela ou texto gerados saem com tudo "mais ou menos bom" e nada escolhido. Cada peça precisa mostrar decisões que uma máquina não tomaria sozinha, e as mesmas decisões precisam se repetir de peça em peça. Filtro em massa não resolve; briefing, carta de cor, hierarquia e passe humano resolvem.
