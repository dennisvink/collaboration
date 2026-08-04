import { createGameplay, GAME_STATES, COLLISIONS } from './gameplay.js';
import { createInputController } from './input.js';
import { initScene, syncScene } from './scene3d.js';
import { createHUD } from './hud.js';

const LEVELS = [{ pellets: 30 }, { pellets: 38 }, { pellets: 46 }];
const PLAYER_SPEED = 5.8;
const BOUNDS = Object.freeze({ x: 8.8, z: 6.7 });
const gameRoot = document.querySelector('#game');
const touchRoot = document.querySelector('#touch-controls');
const primaryAction = document.querySelector('#primary-action');
const liveStatus = document.querySelector('#status');
const gameplay = createGameplay({ lives: 3, levels: LEVELS });
const hud = createHUD({ container: document.querySelector('#app'), onboarding: [
  'Start/bewegen: Enter, pijltjes of W, A, S, D',
  'Pauze: P of Escape · Opnieuw: R',
  'Touch: gebruik de grote richtingsknoppen',
] });

const world = { entities: new Map(), pelletsTotal: 0 };
let player;
let invaders = [];
let desiredDirection = { x: 0, z: 0 };
let currentDirection = { x: 0, z: 0 };
let lastFrame = performance.now();
let lastShot = 0;
let invulnerableUntil = 0;
let levelHandled = false;

const entity = (id, kind, x, z, extra = {}) => ({
  id, kind, position: { x, y: 0, z }, velocity: { x: 0, y: 0, z: 0 }, active: true, ...extra,
});

function buildLevel(level) {
  world.entities.clear();
  player = entity('pacman', 'pacman', 0, 5.5);
  world.entities.set(player.id, player);
  const candidates = [];
  for (let z = -6; z <= 6; z += 1.5) {
    for (let x = -8; x <= 8; x += 1.5) {
      if (Math.hypot(x, z - 5.5) > 1.2) candidates.push([x, z]);
    }
  }
  const count = LEVELS[level - 1].pellets;
  for (let i = 0; i < count; i += 1) {
    const [x, z] = candidates[Math.floor(i * candidates.length / count)];
    const pellet = entity(`pellet-${level}-${i}`, i % 15 === 0 ? 'power-pellet' : 'pellet', x, z);
    world.entities.set(pellet.id, pellet);
  }
  world.pelletsTotal = count;
  invaders = [
    entity('invader-red', 'invader', -6, -5, { metadata: { speed: 1.15 } }),
    entity('invader-pink', 'invader', 0, -5, { metadata: { speed: 1.3 } }),
    entity('invader-cyan', 'invader', 6, -5, { metadata: { speed: 1.45 } }),
  ];
  invaders.forEach((item) => world.entities.set(item.id, item));
  desiredDirection = { x: 0, z: 0 };
  currentDirection = { x: 0, z: 0 };
  levelHandled = false;
  refresh();
}

function viewState() {
  const state = gameplay.getState();
  return { ...state, entities: world.entities, pelletsTotal: world.pelletsTotal };
}

function refresh() {
  const state = viewState();
  syncScene(state);
  hud.updateHUD(state);
  const terminal = state.status === GAME_STATES.LEVEL_WON || state.status === GAME_STATES.GAME_OVER;
  if (state.status === GAME_STATES.START) {
    primaryAction.hidden = false;
    primaryAction.textContent = 'Start spel';
  } else if (terminal) {
    primaryAction.hidden = false;
    primaryAction.textContent = state.status === GAME_STATES.GAME_OVER
      ? 'Opnieuw spelen' : (state.level < LEVELS.length ? 'Volgend level' : 'Nog een keer');
  } else primaryAction.hidden = true;
}

function startOrContinue() {
  const state = gameplay.getState();
  if (state.status === GAME_STATES.START) gameplay.start();
  else if (state.status === GAME_STATES.PAUSED) gameplay.resume();
  else if (state.status === GAME_STATES.LEVEL_WON) {
    if (state.level < LEVELS.length) {
      gameplay.advanceLevel();
      buildLevel(gameplay.getState().level);
    } else restart();
  } else if (state.status === GAME_STATES.GAME_OVER) restart();
  refresh();
}

function restart() {
  gameplay.restart();
  buildLevel(1);
}

function loseLife(now) {
  if (now < invulnerableUntil) return;
  gameplay.collide(COLLISIONS.GHOST);
  invulnerableUntil = now + 1800;
  player.position.x = 0;
  player.position.z = 5.5;
  currentDirection = { x: 0, z: 0 };
  for (const [id, item] of world.entities) if (item.kind === 'projectile') world.entities.delete(id);
  liveStatus.textContent = gameplay.getState().status === GAME_STATES.GAME_OVER ? 'Game over' : 'Leven verloren';
  refresh();
}

function collectPellets() {
  for (const [id, item] of world.entities) {
    if ((item.kind === 'pellet' || item.kind === 'power-pellet') && distance(player, item) < .6) {
      world.entities.delete(id);
      gameplay.collide({ type: item.kind === 'power-pellet' ? COLLISIONS.POWER_PELLET : COLLISIONS.PELLET });
    }
  }
}

function updateInvaders(dt, now) {
  invaders.forEach((invader, index) => {
    const dx = player.position.x - invader.position.x;
    const dz = player.position.z - invader.position.z;
    const length = Math.hypot(dx, dz) || 1;
    const speed = invader.metadata.speed + gameplay.getState().level * .12;
    invader.velocity.x = dx / length * speed;
    invader.velocity.z = dz / length * speed;
    invader.position.x = clamp(invader.position.x + invader.velocity.x * dt, -BOUNDS.x, BOUNDS.x);
    invader.position.z = clamp(invader.position.z + invader.velocity.z * dt, -BOUNDS.z, BOUNDS.z);
    if (distance(player, invader) < .72) loseLife(now);
    if (now - lastShot > Math.max(750, 1900 - gameplay.getState().level * 220) && index === Math.floor(now / 1900) % invaders.length) {
      const shot = entity(`shot-${Math.floor(now)}-${index}`, 'projectile', invader.position.x, invader.position.z);
      shot.velocity.x = dx / length * 4.2;
      shot.velocity.z = dz / length * 4.2;
      world.entities.set(shot.id, shot);
      lastShot = now;
    }
  });
}

function updateProjectiles(dt, now) {
  for (const [id, item] of world.entities) {
    if (item.kind !== 'projectile') continue;
    item.position.x += item.velocity.x * dt;
    item.position.z += item.velocity.z * dt;
    if (Math.abs(item.position.x) > 10 || Math.abs(item.position.z) > 8) world.entities.delete(id);
    else if (distance(player, item) < .55) { world.entities.delete(id); loseLife(now); }
  }
}

function update(now) {
  const dt = Math.min(.05, (now - lastFrame) / 1000);
  lastFrame = now;
  const state = gameplay.getState();
  if (state.status === GAME_STATES.PLAYING) {
    gameplay.update(dt * 1000);
    if (desiredDirection.x || desiredDirection.z) currentDirection = desiredDirection;
    player.velocity.x = currentDirection.x * PLAYER_SPEED;
    player.velocity.z = currentDirection.z * PLAYER_SPEED;
    player.position.x = clamp(player.position.x + player.velocity.x * dt, -BOUNDS.x, BOUNDS.x);
    player.position.z = clamp(player.position.z + player.velocity.z * dt, -BOUNDS.z, BOUNDS.z);
    collectPellets();
    updateInvaders(dt, now);
    updateProjectiles(dt, now);
    if (gameplay.getState().status === GAME_STATES.LEVEL_WON && !levelHandled) {
      levelHandled = true;
      liveStatus.textContent = gameplay.getState().level === LEVELS.length ? 'Je hebt gewonnen!' : 'Level voltooid';
    }
    refresh();
  }
  requestAnimationFrame(update);
}

const input = createInputController({
  touchRoot,
  onAction({ action, active }) {
    if (action.startsWith('move-')) {
      if (active) {
        const vectors = { 'move-up': [0, -1], 'move-down': [0, 1], 'move-left': [-1, 0], 'move-right': [1, 0] };
        const [x, z] = vectors[action];
        desiredDirection = { x, z };
        if (gameplay.getState().status === GAME_STATES.START) startOrContinue();
      }
      return;
    }
    if (!active) return;
    if (action === 'pause') {
      gameplay.dispatch('TOGGLE_PAUSE');
      liveStatus.textContent = gameplay.getState().status === GAME_STATES.PAUSED ? 'Spel gepauzeerd' : 'Spel hervat';
      refresh();
    }
    if (action === 'restart') restart();
  },
});

function distance(a, b) { return Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

async function bootstrap() {
  window.__GAME_READY__ = false;
  initScene(gameRoot);
  buildLevel(1);
  input.attach();
  primaryAction.addEventListener('click', startOrContinue);
  document.addEventListener('keydown', (event) => {
    if (event.code === 'Enter' || event.code === 'Space') { event.preventDefault(); startOrContinue(); }
  });
  gameplay.subscribe(refresh);
  refresh();
  window.__GAME_READY__ = true;
  liveStatus.textContent = 'Spel gereed. Start met Enter, de startknop of een richting.';
  requestAnimationFrame(update);
}

bootstrap().catch((error) => {
  liveStatus.textContent = 'Initialisatie mislukt';
  console.error(error);
});
