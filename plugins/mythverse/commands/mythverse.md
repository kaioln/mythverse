---
description: Auditoria de "cara de IA" no jogo. Texto e CSS (audit.js), imagens (art-check.py) e, se houver tools/ui, telas. Uso /mythverse [texto|arte|tela|tudo] [caminhos]
argument-hint: "[texto|arte|tela|tudo] [caminhos]"
allowed-tools: Bash(node:*), Bash(python:*), Bash(python3:*), Read, Glob, Grep
---

Auditoria de acabamento. Argumentos: `$ARGUMENTS` (modo e caminhos; sem argumentos é `tudo` na pasta atual).

Modos:
- `texto`: `node "${CLAUDE_PLUGIN_ROOT}/scripts/audit.js" <caminhos ou pasta atual>`. Varre .js, .css, .html e .md por sinais de texto e estilo gerados (travessão, "(s)", "Clique aqui", emoji, fontes genéricas, cores do Tailwind, degradê 135deg, vidro fosco, glow).
- `arte`: `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/art-check.py" <pastas de imagem>` (sem caminho: `assets/scenes/thumb assets/ui/banners assets/portraits` quando existirem). Mede luz, saturação, matiz, microdetalhe e pares repetidos.
- `tela`: se existir `tools/ui/cdp.js`, rode `node tools/ui/cdp.js tools/ui/overflow.js 1366:657 375:812:2:1` e `node tools/ui/cdp.js tools/ui/panels.js`; no Linux, aponte `CHROME` para um script com `--no-sandbox`. Olhe as fotos produzidas e aplique a régua de `hub-ui-ux`.
- `tudo`: os três.

Depois de rodar:
1. Leia os achados no contexto (abra os trechos). Descarte o que, lido, não parece gerado.
2. Responda em português, sem travessão: veredito em uma linha; achados do mais grave ao mais leve com `arquivo:linha`, o trecho e a correção pronta; o que está bom; e, para arte, quais peças precisam de briefing novo (não de filtro).
3. Não corrija nada sem o usuário pedir, a não ser que ele tenha pedido "corrija" no mesmo comando.
