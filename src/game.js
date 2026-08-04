import { createGameplay, GAME_STATES, COLLISIONS } from './gameplay.js';
import { createInputController } from './input.js';
import { initScene, syncScene } from './scene3d.js';
import { createHUD } from './hud.js';

const gameRoot = document.querySelector('#game');
const controls = document.querySelector('#touch-controls');
const status = document.querySelector('#status');
const pelletPositions = [
  [-8,-6],[-4,-6],[0,-6],[4,-6],[8,-6],[-8,-2],[-4,-2],[0,-2],[4,-2],[8,-2],
  [-8,2],[-4,2],[0,2],[4,2],[8,2],[-8,6],[-4,6],[0,6],[4,6],[8,6],
];
const gameplay = createGameplay({ levels: [{ pellets: 20 }, { pellets: 20 }], lives: 3 });
const hud = createHUD({ container: gameRoot, onboarding: [
  'Bewegen: pijltjes of W, A, S, D', 'Pauze: P, Escape of pauzeknop', 'Start/herstart: Enter, tik of R',
] });
const entities = new Map();
let projectileSequence = 0;
let shotClock = 0;
let previous = performance.now();

function resetWorld() {
  entities.clear();
  entities.set('pacman', { kind: 'pacman', position: { x: 0, z: 6 }, velocity: { x: 0, z: 0 } });
  pelletPositions.forEach(([x, z], index) => entities.set(`pellet-${index}`, {
    kind: index % 9 === 0 ? 'power-pellet' : 'pellet', position: { x, z }, active: true,
  }));
  for (let index = 0; index < 5; index += 1) entities.set(`invader-${index}`, {
    kind: 'invader', position: { x: -6 + index * 3, z: -5 }, velocity: { x: 1.2, z: 0 }, active: true,
  });
}

function presentState() {
  const state = gameplay.getState();
  return { ...state, pelletsTotal: pelletPositions.length, entities };
}

function refresh() {
  const state = presentState();
  syncScene(state);
  hud.updateHUD(state);
  status.textContent = state.status;
  document.body.dataset.gameStatus = state.status;
}

function startOrContinue() {
  const state = gameplay.getState();
  if (state.status === GAME_STATES.START) gameplay.start();
  else if (state.status === GAME_STATES.PAUSED) gameplay.resume();
  else if (state.status === GAME_STATES.LEVEL_WON && state.level < state.levelCount) {
    gameplay.advanceLevel(); resetWorld();
  } else if (state.status === GAME_STATES.GAME_OVER || state.status === GAME_STATES.LEVEL_WON) {
    gameplay.restart(); resetWorld(); gameplay.start();
  }
  refresh();
}

const input = createInputController({ touchRoot: controls, onAction({ action, active }) {
  if (!active) return;
  if (action === 'pause') gameplay.dispatch('TOGGLE_PAUSE');
  if (action === 'restart') { gameplay.restart(); resetWorld(); gameplay.start(); }
  refresh();
} });

function moveEntities(deltaSeconds) {
  const player = entities.get('pacman');
  const direction = input.getDirection();
  const length = Math.hypot(direction.x, direction.z) || 1;
  player.velocity = { x: direction.x / length * 5, z: direction.z / length * 5 };
  player.position.x = Math.max(-8.8, Math.min(8.8, player.position.x + player.velocity.x * deltaSeconds));
  player.position.z = Math.max(-6.8, Math.min(6.8, player.position.z + player.velocity.z * deltaSeconds));

  for (const [id, entity] of entities) {
    if (id.startsWith('pellet-') && distance(player, entity) < 0.55) {
      entities.delete(id);
      gameplay.collide({ type: entity.kind === 'power-pellet' ? COLLISIONS.POWER_PELLET : COLLISIONS.PELLET });
    }
    if (id.startsWith('invader-')) {
      entity.position.x += entity.velocity.x * deltaSeconds;
      if (Math.abs(entity.position.x) > 8) entity.velocity.x *= -1;
      if (distance(player, entity) < 0.75) {
        gameplay.collide(COLLISIONS.GHOST);
        player.position = { x: 0, z: 6 };
      }
    }
    if (id.startsWith('shot-')) {
      entity.position.z -= 9 * deltaSeconds;
      if (entity.position.z < -8) entities.delete(id);
      for (const [invaderId, invader] of entities) {
        if (invaderId.startsWith('invader-') && distance(entity, invader) < 0.6) {
          entities.delete(id); entities.delete(invaderId); break;
        }
      }
    }
  }

  shotClock += deltaSeconds;
  if (shotClock > 0.8) {
    shotClock = 0;
    projectileSequence += 1;
    entities.set(`shot-${projectileSequence}`, {
      kind: 'projectile', position: { x: player.position.x, z: player.position.z - 0.6 }, velocity: { x: 0, z: -9 },
    });
  }
}

function distance(a, b) {
  return Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
}

function frame(now) {
  const deltaMs = Math.min(50, now - previous);
  previous = now;
  if (gameplay.getState().status === GAME_STATES.PLAYING) {
    gameplay.update(deltaMs);
    moveEntities(deltaMs / 1000);
    refresh();
  }
  requestAnimationFrame(frame);
}

async function bootstrap() {
  initScene(gameRoot);
  resetWorld();
  input.attach();
  document.addEventListener('keydown', (event) => { if (event.code === 'Enter') startOrContinue(); });
  gameRoot.addEventListener('click', (event) => { if (!event.target.closest('button, details')) startOrContinue(); });
  gameplay.subscribe(refresh);
  refresh();
  window.__GAME__ = { gameplay, input, entities, startOrContinue };
  window.__GAME_READY__ = true;
  requestAnimationFrame(frame);
}

bootstrap().catch((error) => {
  status.textContent = `Initialization failed: ${error.message}`;
  console.error(error);
});
