import { createGameplay, GAME_STATES, COLLISIONS } from './gameplay.js';
import { createInputController } from './input.js';
import { initScene, syncScene } from './scene3d.js';
import { createHUD } from './hud.js';

const gameRoot = document.querySelector('#game');
const controls = document.querySelector('#touch-controls');
const primaryAction = document.querySelector('#primary-action');
const liveStatus = document.querySelector('#status');
const LEVELS = [{ pellets: 24 }, { pellets: 30 }, { pellets: 36 }];
const gameplay = createGameplay({ lives: 3, levels: LEVELS });
const entities = new Map();
let nextId = 0;
let shotClock = 0;
let previous = performance.now();

function add(kind, x, z, extra = {}) {
  const id = `${kind}-${nextId++}`;
  entities.set(id, { id, kind, position: { x, y: 0, z }, velocity: { x: 0, z: 0 }, active: true, ...extra });
  return entities.get(id);
}

function resetWorld(level = gameplay.getState().level) {
  entities.clear();
  const pacman = add('pacman', 0, 6, { speed: 5.2 });
  pacman.id = 'pacman';
  entities.delete([...entities.keys()][0]);
  entities.set('pacman', pacman);
  const count = LEVELS[level - 1].pellets;
  for (let i = 0; i < count; i += 1) {
    const column = i % 8;
    const row = Math.floor(i / 8);
    add(i % 12 === 0 ? 'power-pellet' : 'pellet', -7 + column * 2, -6 + row * 2.1);
  }
  const invaderCount = 2 + level;
  for (let i = 0; i < invaderCount; i += 1) add('invader', -4 + i * (8 / Math.max(1, invaderCount - 1)), -5, { phase: i });
  shotClock = 0;
  renderUI();
}

function gameView() {
  const state = gameplay.getState();
  return { ...state, pelletsTotal: LEVELS[state.level - 1].pellets, entities };
}

const hud = createHUD({ container: gameRoot, onboarding: [
  'Bewegen: pijltjestoetsen of W, A, S, D',
  'Pauze: P, Escape of de pauzeknop',
  'Start/volgende: Enter · Herstart: R',
] });
initScene(gameRoot);

function renderUI() {
  const state = gameView();
  hud.updateHUD(state);
  const finished = state.status === GAME_STATES.GAME_OVER ||
    (state.status === GAME_STATES.LEVEL_WON && state.level === state.levelCount);
  primaryAction.hidden = state.status === GAME_STATES.PLAYING || state.status === GAME_STATES.PAUSED;
  primaryAction.textContent = state.status === GAME_STATES.START ? 'Start spel' : finished ? 'Opnieuw spelen' : 'Volgend level';
  const messages = {
    [GAME_STATES.START]: 'Klaar om te starten', [GAME_STATES.PLAYING]: 'Spel actief',
    [GAME_STATES.PAUSED]: 'Spel gepauzeerd', [GAME_STATES.LEVEL_WON]: 'Level voltooid',
    [GAME_STATES.GAME_OVER]: 'Game over',
  };
  liveStatus.textContent = messages[state.status];
}

gameplay.subscribe(renderUI);

function primary() {
  const state = gameplay.getState();
  if (state.status === GAME_STATES.START) gameplay.start();
  else if (state.status === GAME_STATES.LEVEL_WON && state.level < state.levelCount) {
    gameplay.advanceLevel();
    resetWorld(gameplay.getState().level);
  } else if (state.status === GAME_STATES.GAME_OVER || state.status === GAME_STATES.LEVEL_WON) {
    gameplay.restart();
    resetWorld(1);
  }
}
primaryAction.addEventListener('click', primary);

document.addEventListener('keydown', (event) => {
  if (event.code === 'Enter') primary();
});

const input = createInputController({
  touchRoot: controls,
  onAction({ action, active }) {
    if (!active) return;
    if (action === 'pause') gameplay.dispatch('TOGGLE_PAUSE');
    if (action === 'restart') { gameplay.restart(); resetWorld(1); }
  },
});
input.attach();

function distance(a, b) {
  return Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
}

function hitPlayer() {
  gameplay.collide({ type: COLLISIONS.GHOST });
  for (const [id, entity] of entities) if (entity.kind === 'projectile') entities.delete(id);
  const pacman = entities.get('pacman');
  if (pacman) { pacman.position.x = 0; pacman.position.z = 6; }
}

function updateWorld(delta, now) {
  const state = gameplay.getState();
  if (state.status !== GAME_STATES.PLAYING) return;
  gameplay.update(delta * 1000);
  const pacman = entities.get('pacman');
  const direction = input.getDirection();
  const magnitude = Math.hypot(direction.x, direction.z) || 1;
  pacman.velocity.x = direction.x / magnitude * pacman.speed;
  pacman.velocity.z = direction.z / magnitude * pacman.speed;
  pacman.position.x = Math.max(-8.8, Math.min(8.8, pacman.position.x + pacman.velocity.x * delta));
  pacman.position.z = Math.max(-7, Math.min(7, pacman.position.z + pacman.velocity.z * delta));

  for (const [id, entity] of [...entities]) {
    if (entity.kind === 'pellet' || entity.kind === 'power-pellet') {
      if (distance(entity, pacman) < 0.55) {
        entities.delete(id);
        gameplay.collide({ type: entity.kind === 'power-pellet' ? COLLISIONS.POWER_PELLET : COLLISIONS.PELLET });
      }
    } else if (entity.kind === 'invader') {
      entity.position.x += Math.sin(now * 0.0012 + entity.phase) * delta * 0.8;
      if (distance(entity, pacman) < 0.65) hitPlayer();
    } else if (entity.kind === 'projectile') {
      entity.position.x += entity.velocity.x * delta;
      entity.position.z += entity.velocity.z * delta;
      if (distance(entity, pacman) < 0.5) { entities.delete(id); hitPlayer(); }
      else if (Math.abs(entity.position.x) > 10 || Math.abs(entity.position.z) > 9) entities.delete(id);
    }
  }

  shotClock += delta;
  if (shotClock > Math.max(0.55, 1.45 - state.level * 0.16)) {
    shotClock = 0;
    const shooters = [...entities.values()].filter((entity) => entity.kind === 'invader');
    const shooter = shooters[Math.floor(Math.random() * shooters.length)];
    if (shooter) {
      const dx = pacman.position.x - shooter.position.x;
      const dz = pacman.position.z - shooter.position.z;
      const length = Math.hypot(dx, dz) || 1;
      add('projectile', shooter.position.x, shooter.position.z, { velocity: { x: dx / length * 4, z: dz / length * 4 } });
    }
  }
}

function frame(now) {
  const delta = Math.min(0.05, (now - previous) / 1000);
  previous = now;
  updateWorld(delta, now);
  syncScene(gameView());
  requestAnimationFrame(frame);
}

resetWorld();
requestAnimationFrame(frame);
// Only signal readiness after gameplay, rendering, HUD, input and the game loop are active.
window.__GAME_READY__ = true;
window.__GAME__ = Object.freeze({ gameplay, input, entities });
