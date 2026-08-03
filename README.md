# 3D Pacman

Browser-native foundation for a modular Three.js game. There is no bundler or build step.

## Run locally

ES modules must be served over HTTP:

```sh
python3 -m http.server 8080
```

Open <http://localhost:8080>. When renderer initialization is complete, the production bootstrap sets `window.__GAME_READY__ = true` and emits `game:ready`.

## Dependency policy

Three.js is pinned to **0.166.1** in the `index.html` import map and imported everywhere as:

```js
import * as THREE from 'three';
```

Do not add alternate CDN URLs or deep imports. Update the single import-map entry deliberately when upgrading.

## Shared contracts

`src/contracts.js` is the documented integration boundary. It exports:

- `GameState`: versioned, serializable state plus an entity map.
- `GameEntity`: stable identity, kind, transform data, active state, and optional metadata.
- `GameEvent`: named, timestamped event with an extensible payload.
- `StateSystem`: update interface receiving state and tick duration and returning events.
- `GameRenderer`: lifecycle interface (`initialize`, `render`, `resize`, `dispose`).
- `createInitialGameState()` and `createGameEventBus()` as safe starting points for downstream modules.

Contracts use JSDoc so editors and `// @ts-check` consumers get type information while browsers execute the source directly. Additive optional metadata is allowed; breaking field changes require incrementing `contractVersion` and coordinating consumers.

## Layout

```text
index.html        import map and application entry
src/contracts.js  shared state/entity/event/system/render contracts
src/game.js       production bootstrap and minimal renderer
src/styles.css    full-screen canvas shell
```
