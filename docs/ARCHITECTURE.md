# Arquitetura

## Princípio

O mundo jogável é a tela principal. HUD e sistemas existem ao redor dele, não no lugar dele.

## Camadas

### Data
`src/data.js`

Templates de heróis, inimigos, zonas, loot, raridades, missões, Passe, construções e receitas.

### State / Simulation
`src/engine.js`

Responsável por:
- criação/merge/save do estado;
- progressão offline;
- stats e equipamentos;
- waves, rooms e boss phases;
- target selection;
- auto attack;
- manual/auto skill casting;
- statuses;
- reward pipeline;
- crafting, guilda, quests e upgrades.

O motor não depende de DOM, permitindo teste isolado.

### Presentation
`src/renderer.js`

Canvas de 1280×720 com:
- Vila, floresta, dungeon e boss arena;
- path/river/bridge/buildings;
- sprites animados e fallback visual;
- barras de HP/MP;
- VFX, floating text, drop físico;
- hotspots dos prédios da Vila.

### UI
`src/ui.js`

DOM/HUD, modais e input do jogador.

### Boot
`src/main.js`

Inicializa os subsistemas, conecta eventos, roda `requestAnimationFrame`, autosave e Web Audio.

## Fluxo do combate

Hero timer -> target selection -> attack/skill -> damage formula -> status -> HP -> death -> reward -> physical loot -> inventory -> quest/pass progression.

## Extensibilidade

Novas regiões podem reutilizar o motor adicionando templates de zona + desenho/render específico. Novos heróis precisam de template + sprite contract. Backend pode substituir `localStorage` mantendo a API de estado do frontend.
