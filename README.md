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

## Controls and help

Input is exposed as semantic actions by `src/input.js`; gameplay systems consume actions instead of browser key names. Default keyboard bindings are:

| Action | Keys |
| --- | --- |
| Move up | Up arrow or W |
| Move down | Down arrow or S |
| Move left | Left arrow or A |
| Move right | Right arrow or D |
| Pause/resume | Escape or P |
| Restart | R |

Create a controller with `createInputController({ onAction })`, then call `attach()` once and `detach()` when its screen is disposed. Query held movement with `isActive(action)` or `getDirection()`. Replace all bindings at runtime with `setBindings()`; use `KeyboardEvent.code` values so physical controls stay predictable across keyboard layouts.

For touch controls, pass a `touchRoot` containing buttons such as `<button data-action="move-left">◀</button>`. Supported `data-action` values are exported as `INPUT_ACTIONS`. The controller supplies missing accessible names and supports pointer, Enter, and Space input. Keep visible button text or icons, sufficient target sizes, and an on-screen instruction that the same controls work with keyboard or touch.

Held input is cleared on window blur, page hiding, controller detach, or remapping. This prevents movement from sticking after focus changes. Browser shortcuts using Ctrl, Alt, or Meta are left untouched.
